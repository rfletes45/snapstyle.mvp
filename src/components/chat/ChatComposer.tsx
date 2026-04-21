/**
 * ChatComposer Component (ARCH-C04)
 *
 * Unified composer component for DM and Group chat screens.
 * Handles keyboard animation, safe area, and provides consistent
 * behavior with scope-specific features.
 *
 * Features:
 * - Scope-aware rendering (dm vs group)
 * - Customizable toolbar with drag-and-drop reordering
 * - Voice button for groups (when input empty)
 * - Mention autocomplete support for groups
 * - Reply preview bar with cancel
 * - Camera/attachment left accessory
 * - Animated keyboard attachment (60fps via Reanimated)
 *
 * @module components/chat/ChatComposer
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { useComposerSheet } from "@/contexts/ComposerSheetContext";
import { VoiceRecording } from "@/hooks/useVoiceRecorder";
import { isNativeComposerAvailable } from "@/modules/nativeKeyboard";
import { useAppTheme } from "@/store/ThemeContext";
import { ReplyToMetadata } from "@/types/messaging";
import { scheduleIdleWork } from "@/utils/scheduleIdleWork";
import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  ActivityIndicator,
  InteractionManager,
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import { AnimalLongPressButton } from "./AnimalLongPressButton";
import { ComposerCustomizeToolbar } from "./ComposerToolbar/ComposerCustomizeToolbar";
import { ComposerItemPicker } from "./ComposerToolbar/ComposerItemPicker";
import { getToolbarItemEditModeLongPressDuration } from "./ComposerToolbar/ComposerToolbarRegistry";
import { ComposerToolbarRow } from "./ComposerToolbar/ComposerToolbarRow";
import type { ComposerToolbarItemId } from "./ComposerToolbar/types";
import { DEFAULT_TOOLBAR_ITEMS } from "./ComposerToolbar/types";
import { EmojiButton } from "./EmojiButton";
import { GameButton } from "./GameButton";
import { GifButton } from "./GifButton";
import { GifStickerButton } from "./GifStickerButton";
import { ImagePickerButton } from "./ImagePickerButton";
import {
  NativeComposerInput,
  type NativeComposerInputRef,
} from "./NativeComposerInput";
import { preloadPickerById, preloadPickersForToolbar } from "./pickerPreload";
import { ReplyPreviewBar } from "./ReplyPreviewBar";
import { SendButton } from "./SendButton";
import { StickerButton } from "./StickerButton";
import { VoiceRecordButton } from "./VoiceRecordButton";

// =============================================================================
// Types
// =============================================================================

/** Chat scope - determines which features are available */
export type ChatScope = "dm" | "group";

export interface ChatComposerProps {
  /** Chat scope - determines voice button, mention autocomplete visibility */
  scope?: ChatScope;
  /** Current input value */
  value: string;
  /** Input change handler */
  onChangeText: (text: string) => void;
  /** Send button handler */
  onSend: () => void;
  /** Whether send is currently disabled */
  sendDisabled?: boolean;
  /** Whether currently sending */
  isSending?: boolean;
  /** Whether there are attachments ready to send */
  hasAttachments?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Left accessory (camera button, etc.) */
  leftAccessory?: React.ReactNode;
  /** Right accessory (additional buttons - overrides voice button) */
  rightAccessory?: React.ReactNode;
  /** Additional right accessory (schedule button, etc. - shown before send/voice) */
  additionalRightAccessory?: React.ReactNode;
  /** Header content (attachment tray, etc. - shown above reply preview) */
  headerContent?: React.ReactNode;
  /** Reply metadata for preview bar */
  replyTo?: ReplyToMetadata | null;
  /** Called when reply is cancelled */
  onCancelReply?: () => void;
  /** Current user ID for reply preview (to show "yourself" for own messages) */
  currentUid?: string;
  /** Voice button handler (groups only, when input empty) */
  onVoicePress?: () => void;
  /** Whether voice recording is active */
  isRecording?: boolean;
  /** Custom voice button component (replaces built-in VoiceRecordButton) */
  voiceButtonComponent?: React.ReactNode;
  /** Voice recording completion handler (for built-in VoiceRecordButton) */
  onVoiceComplete?: (recording: VoiceRecording) => void;
  /** Voice recording cancelled handler (for built-in VoiceRecordButton) */
  onVoiceCancelled?: () => void;
  /** Maximum voice recording duration in ms (default: 60000 = 60s) */
  maxVoiceDuration?: number;
  /** Sends the equipped animal into chat on tap. */
  onAnimalPress?: () => void;
  /** Opens the alternate animal picker surface (full catalog/customization). */
  onAnimalAlternatePress?: () => void;
  /** The equipped animal theme ID (e.g. "animal_duck", "animal_bear") */
  animalThemeId?: string | null;
  /** Whether the animal button is temporarily disabled. */
  animalDisabled?: boolean;
  /** Game button handler (opens game picker) — DEPRECATED, use onGameSelected */
  onGamePress?: () => void;
  /** Called when a game is selected from the inline game picker. */
  onGameSelected?: (gameId: import("@/gamesV4/types").GameId) => void;
  /** Upload progress indicator (shown when uploading) */
  uploadProgress?: { current: number; total: number } | null;
  /** Called when the cursor position changes (for mention trigger detection) */
  onCursorChange?: (position: number) => void;
  /** Mention autocomplete component (groups only) */
  mentionAutocomplete?: React.ReactNode;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** TextInput props passthrough */
  textInputProps?: Partial<TextInputProps>;
  /** TextInput ref */
  textInputRef?: React.RefObject<TextInput | null>;
  // ── Customizable Toolbar Props ──────────────────────────────────────
  /** Ordered toolbar items from useComposerToolbarLayout. Uses defaults if omitted. */
  toolbarItems?: {
    id: ComposerToolbarItemId;
    position: number;
    flexWeight?: number;
  }[];
  /** Whether the toolbar is in edit/customize mode. */
  toolbarEditing?: boolean;
  /** Whether toolbar layout is being saved. */
  toolbarSaving?: boolean;
  /** Enter toolbar edit mode. */
  onToolbarEnterEdit?: () => void;
  /** Save toolbar changes and exit edit mode. */
  onToolbarSaveAndExit?: () => void;
  /** Cancel toolbar changes and exit edit mode. */
  onToolbarCancelEdit?: () => void;
  /** Move a toolbar item to a new position. */
  onToolbarMoveItem?: (
    itemId: ComposerToolbarItemId,
    toPosition: number,
  ) => void;
  /** Add a toolbar item. */
  onToolbarAddItem?: (itemId: ComposerToolbarItemId) => void;
  /** Remove a toolbar item. */
  onToolbarRemoveItem?: (itemId: ComposerToolbarItemId) => void;
  /** Reset toolbar to defaults. */
  onToolbarResetDefaults?: () => void;
  /** Called when an emoji is selected from the emoji picker toolbar button. */
  onEmojiSelected?: (emoji: string) => void;
  /** Called when a GIF is selected from the GIF picker toolbar button. */
  onGifSelected?: (gif: import("@/services/gif/types").GifItem) => void;
  /** Called when a sticker is selected from the sticker picker toolbar button. */
  onStickerSelected?: (
    sticker: import("@/services/sticker/types").StickerItem,
  ) => void;
  /** Schedule button handler (for the schedule toolbar item). */
  onSchedulePress?: () => void;
  /** Called when images are picked from the image picker toolbar button. */
  onImagesPicked?: (imageUris: string[]) => void;
  /** Whether the image picker button should be disabled (e.g. during send). */
  imagePickerDisabled?: boolean;
}

function normalizeNodeForView(node: React.ReactNode): React.ReactNode {
  return React.Children.map(node, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      const text = String(child).trim();
      if (!text) return null;
      return <Text>{text}</Text>;
    }
    return child;
  });
}

// =============================================================================
// Component
// =============================================================================

export function ChatComposer({
  scope = "dm",
  value,
  onChangeText,
  onSend,
  sendDisabled = false,
  isSending = false,
  hasAttachments = false,
  placeholder = "Message...",
  leftAccessory,
  rightAccessory,
  additionalRightAccessory,
  headerContent,
  replyTo,
  onCancelReply,
  currentUid,
  onVoicePress,
  isRecording = false,
  voiceButtonComponent,
  onVoiceComplete,
  onVoiceCancelled,
  maxVoiceDuration = 60000,
  onAnimalPress,
  onAnimalAlternatePress,
  animalThemeId,
  animalDisabled = false,
  onGamePress,
  onGameSelected,
  uploadProgress,
  onCursorChange,
  mentionAutocomplete,
  style,
  textInputProps,
  textInputRef,
  // Customizable toolbar props
  toolbarItems,
  toolbarEditing = false,
  toolbarSaving = false,
  onToolbarEnterEdit,
  onToolbarSaveAndExit,
  onToolbarCancelEdit,
  onToolbarMoveItem,
  onToolbarAddItem,
  onToolbarRemoveItem,
  onToolbarResetDefaults,
  onEmojiSelected,
  onGifSelected,
  onStickerSelected,
  onSchedulePress,
  onImagesPicked,
  imagePickerDisabled = false,
}: ChatComposerProps): React.JSX.Element {
  const theme = useTheme();
  const { colors, isDark } = useAppTheme();

  // Dismiss active composer-attached sheet when main input gains focus.
  // Picker search fields do NOT trigger this because they are separate
  // TextInput instances inside the picker — only the main NativeComposerInput /
  // TextInput fires this callback.
  // beginKeyboardHandoff() captures the current sheet height as a handoff
  // floor so the footer stays stable until the keyboard has risen far enough
  // to take over — preventing the transient downward teleport.
  const { dismissActiveSheet, beginKeyboardHandoff } = useComposerSheet();
  const handleMainInputFocus = useCallback(() => {
    beginKeyboardHandoff();
    dismissActiveSheet();
  }, [beginKeyboardHandoff, dismissActiveSheet]);

  // Internal ref for TextInput - use provided ref or create our own
  const internalTextInputRef = useRef<TextInput | null>(null);
  const inputRef = textInputRef || internalTextInputRef;
  const nativeComposerRef = useRef<NativeComposerInputRef | null>(null);
  const useNative = Platform.OS === "ios" && isNativeComposerAvailable;
  const normalizedMentionAutocomplete = useMemo(
    () => normalizeNodeForView(mentionAutocomplete),
    [mentionAutocomplete],
  );
  const normalizedHeaderContent = useMemo(
    () => normalizeNodeForView(headerContent),
    [headerContent],
  );
  const normalizedLeftAccessory = useMemo(
    () => normalizeNodeForView(leftAccessory),
    [leftAccessory],
  );
  const normalizedRightAccessory = useMemo(
    () => normalizeNodeForView(rightAccessory),
    [rightAccessory],
  );
  const normalizedAdditionalRightAccessory = useMemo(
    () => normalizeNodeForView(additionalRightAccessory),
    [additionalRightAccessory],
  );
  const normalizedVoiceButtonComponent = useMemo(
    () => normalizeNodeForView(voiceButtonComponent),
    [voiceButtonComponent],
  );

  const handleAnimalTap = useCallback(() => {
    if (animalDisabled || !onAnimalPress) return;
    onAnimalPress();
  }, [animalDisabled, onAnimalPress]);

  // Wrapper for onSend that refocuses the TextInput after sending.
  // Keeps the keyboard open after sending a message.
  // On the native path, clear() does NOT resign first responder, so
  // a single post-send refocus is sufficient (the keyboard stays open).
  // The previous triple-setTimeout pattern caused unnecessary JS wakeups
  // that interleaved with KCSV layout passes, triggering a visible
  // content-offset flicker ("send teleport").
  const handleSend = useCallback(async () => {
    const input = inputRef.current;
    const nativeInput = nativeComposerRef.current;

    // Clear the native buffer immediately so that any keystrokes
    // typed while the async send is in flight start from an empty buffer.
    if (nativeInput) {
      nativeInput.clear();
    } else if (input) {
      input.clear();
    }

    try {
      await Promise.resolve(onSend());
    } finally {
      // Single refocus — only if the input lost focus during the send.
      // On the native path clear() never resigns focus, so this is
      // typically a no-op.  On the fallback path it re-opens the keyboard.
      if (nativeInput) {
        if (!nativeInput.isFocused()) nativeInput.focus();
      } else {
        const fallback = input ?? inputRef.current;
        if (fallback && !fallback.isFocused()) fallback.focus();
      }
    }
  }, [onSend, inputRef]);

  // Determine if send button should be visible vs other actions
  const hasText = value.trim().length > 0;
  const hasContent = hasText || hasAttachments;
  const canSend = hasContent && !sendDisabled;

  // Show voice button when no content and not recording
  // Can use custom voiceButtonComponent or built-in VoiceRecordButton
  const showVoiceButton =
    !hasContent &&
    !rightAccessory &&
    (onVoicePress || onVoiceComplete || voiceButtonComponent);

  // Determine if uploading
  const isUploading = uploadProgress !== null;

  // Determine if reply is to own message
  const isOwnMessage =
    replyTo && currentUid ? replyTo.senderId === currentUid : false;

  // Background colors from semantic theme tokens
  const containerBg = colors.composerBackground ?? colors.background;
  const inputBg = colors.inputBackground ?? colors.surface;
  const inputColor = colors.inputText ?? colors.text;
  const borderColor = colors.composerBorder ?? colors.divider;
  const placeholderColor = colors.inputPlaceholder ?? colors.textMuted;

  // Container style — positioning is now handled by KeyboardStickyView
  const containerStyle = useMemo(
    () => [styles.container, { backgroundColor: containerBg }, style],
    [containerBg, style],
  );

  // ── Toolbar state ─────────────────────────────────────────────────────
  const [itemPickerVisible, setItemPickerVisible] = React.useState(false);
  const [warmMountedPickersEnabled, setWarmMountedPickersEnabled] =
    React.useState(false);

  // Determine which toolbar items to render (use provided or defaults)
  const activeToolbarItems = toolbarItems ?? DEFAULT_TOOLBAR_ITEMS;

  // Preload picker bundles for equipped toolbar items after the first paint.
  useEffect(() => {
    preloadPickersForToolbar(activeToolbarItems.map((i) => i.id));
  }, [activeToolbarItems]);

  // Warm-mount picker sheets after chat entry settles so first visible open
  // does not pay for the initial sheet/list tree mount on button press.
  useEffect(() => {
    let cancelled = false;
    let cancelIdle: (() => void) | null = null;

    const task = InteractionManager.runAfterInteractions(() => {
      cancelIdle = scheduleIdleWork(() => {
        if (cancelled) return;
        startTransition(() => {
          setWarmMountedPickersEnabled(true);
        });
      });
    });

    return () => {
      cancelled = true;
      cancelIdle?.();
      task.cancel();
    };
  }, []);

  // ── Toolbar item renderer ─────────────────────────────────────────────
  const renderToolbarItem = useCallback(
    (itemId: ComposerToolbarItemId): React.ReactNode => {
      switch (itemId) {
        case "message-bar":
          return (
            <View
              style={[styles.textInputContainer, { backgroundColor: inputBg }]}
            >
              {useNative ? (
                <NativeComposerInput
                  ref={nativeComposerRef}
                  style={[styles.textInput, { color: inputColor }]}
                  value={value}
                  onChangeText={onChangeText}
                  onSelectionChange={
                    onCursorChange
                      ? (e: any) => onCursorChange(e.nativeEvent.selection.end)
                      : undefined
                  }
                  onSubmitEditing={canSend ? handleSend : undefined}
                  onFocus={handleMainInputFocus}
                  placeholder={placeholder}
                  placeholderTextColor={placeholderColor}
                  selectionColor={colors.primary}
                  editable={!isRecording && !toolbarEditing}
                  maxLength={1000}
                />
              ) : (
                <TextInput
                  ref={inputRef}
                  style={[styles.textInput, { color: inputColor }]}
                  placeholder={placeholder}
                  placeholderTextColor={placeholderColor}
                  selectionColor={colors.primary}
                  keyboardAppearance={
                    Platform.OS === "ios"
                      ? isDark
                        ? "dark"
                        : "light"
                      : undefined
                  }
                  value={value}
                  onChangeText={onChangeText}
                  onSelectionChange={
                    onCursorChange
                      ? (e) => onCursorChange(e.nativeEvent.selection.end)
                      : undefined
                  }
                  multiline
                  maxLength={1000}
                  textAlignVertical="center"
                  editable={!isRecording && !toolbarEditing}
                  returnKeyType="send"
                  submitBehavior="submit"
                  onSubmitEditing={canSend ? handleSend : undefined}
                  onFocus={handleMainInputFocus}
                  {...textInputProps}
                />
              )}
              {/* Voice button inside text input (when no text) */}
              {showVoiceButton &&
                (normalizedVoiceButtonComponent ||
                  (onVoiceComplete ? (
                    <VoiceRecordButton
                      onRecordingComplete={onVoiceComplete}
                      onRecordingCancelled={onVoiceCancelled}
                      disabled={isSending}
                      size={32}
                      maxDuration={maxVoiceDuration / 1000}
                      style={styles.voiceButtonInside}
                    />
                  ) : (
                    <IconButton
                      icon={isRecording ? "stop" : "microphone"}
                      size={20}
                      iconColor={
                        isRecording
                          ? theme.colors.error
                          : theme.colors.onSurfaceVariant
                      }
                      onPress={onVoicePress}
                      style={styles.voiceButtonInside}
                    />
                  )))}
            </View>
          );

        case "camera":
          return normalizedLeftAccessory ?? null;

        case "game":
          // Prefer the new inline picker (onGameSelected) over the legacy
          // onGamePress callback so the game sheet integrates with the
          // composer sheet system like GIFs and Stickers.
          if (onGameSelected) {
            return (
              <GameButton onGameSelected={onGameSelected} multiplayerOnly />
            );
          }
          return onGamePress ? (
            <IconButton
              icon="gamepad-variant-outline"
              size={24}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={onGamePress}
              style={styles.gameButton}
            />
          ) : null;

        case "animal":
          return onAnimalPress ? (
            <AnimalLongPressButton
              animalId={animalThemeId}
              onShortPress={handleAnimalTap}
              onLongPress={onAnimalAlternatePress ?? handleAnimalTap}
              disabled={animalDisabled}
              interactionLocked={toolbarEditing}
              editModeActivationDurationMs={getToolbarItemEditModeLongPressDuration(
                "animal",
              )}
            />
          ) : null;

        case "send":
          return (
            <SendButton
              onSend={handleSend}
              canSend={canSend}
              isSending={isSending}
              disableHaptic={scope === "dm"}
            />
          );

        case "emoji":
          return onEmojiSelected ? (
            <EmojiButton onEmojiSelected={onEmojiSelected} />
          ) : null;

        case "gif":
          return onGifSelected ? (
            <GifButton
              onGifSelected={onGifSelected}
              warmMountEnabled={warmMountedPickersEnabled}
            />
          ) : null;

        case "sticker":
          return onStickerSelected ? (
            <StickerButton
              onStickerSelected={onStickerSelected}
              warmMountEnabled={warmMountedPickersEnabled}
            />
          ) : null;

        case "schedule":
          return onSchedulePress ? (
            <IconButton
              icon="clock-outline"
              size={22}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={onSchedulePress}
              style={styles.actionButton}
            />
          ) : null;

        case "gif-sticker":
          return onGifSelected && onStickerSelected ? (
            <GifStickerButton
              onGifSelected={onGifSelected}
              onStickerSelected={onStickerSelected}
              warmMountEnabled={warmMountedPickersEnabled}
            />
          ) : null;

        case "image-picker":
          return onImagesPicked ? (
            <ImagePickerButton
              onImagesPicked={onImagesPicked}
              disabled={imagePickerDisabled}
            />
          ) : null;

        default:
          return null;
      }
    },
    [
      inputBg,
      inputColor,
      placeholder,
      placeholderColor,
      colors,
      isDark,
      value,
      onChangeText,
      onCursorChange,
      isRecording,
      toolbarEditing,
      canSend,
      handleSend,
      handleMainInputFocus,
      textInputProps,
      showVoiceButton,
      normalizedVoiceButtonComponent,
      onVoiceComplete,
      onVoiceCancelled,
      isSending,
      maxVoiceDuration,
      onVoicePress,
      theme,
      normalizedLeftAccessory,
      onGamePress,
      onGameSelected,
      onAnimalPress,
      onAnimalAlternatePress,
      animalDisabled,
      handleAnimalTap,
      animalThemeId,
      onEmojiSelected,
      onGifSelected,
      onStickerSelected,
      onSchedulePress,
      onImagesPicked,
      imagePickerDisabled,
      inputRef,
      scope,
      useNative,
      warmMountedPickersEnabled,
    ],
  );

  return (
    <>
      <View style={containerStyle}>
        {/* Customize mode toolbar (shown above composer when editing) */}
        {toolbarEditing && onToolbarSaveAndExit && onToolbarCancelEdit && (
          <ComposerCustomizeToolbar
            saving={toolbarSaving}
            onDone={onToolbarSaveAndExit}
            onCancel={onToolbarCancelEdit}
            onAddItem={() => setItemPickerVisible(true)}
          />
        )}

        {/* Mention autocomplete (groups only) - shown above everything */}
        {scope === "group" && normalizedMentionAutocomplete}

        {/* Header content (attachment tray, etc.) */}
        {normalizedHeaderContent}

        {/* Reply preview bar */}
        {replyTo && onCancelReply && (
          <ReplyPreviewBar
            replyTo={replyTo}
            onCancel={onCancelReply}
            isOwnMessage={isOwnMessage}
          />
        )}

        {/* Input row — now driven by customizable toolbar */}
        <View
          style={[
            styles.inputRow,
            { backgroundColor: containerBg, borderTopColor: borderColor },
          ]}
        >
          <ComposerToolbarRow
            items={activeToolbarItems}
            isEditing={toolbarEditing}
            onMoveItem={onToolbarMoveItem}
            onRemoveItem={onToolbarRemoveItem}
            onEnterEditMode={onToolbarEnterEdit}
            renderItem={renderToolbarItem}
          />

          {/* Right accessory (custom, non-toolbar) */}
          {normalizedRightAccessory}

          {/* Additional right accessory (non-toolbar) */}
          {normalizedAdditionalRightAccessory}

          {/* Upload progress indicator */}
          {isUploading && uploadProgress && (
            <View style={styles.uploadProgressContainer}>
              <ActivityIndicator size={20} color={theme.colors.primary} />
              <Text style={[styles.uploadProgressText, { color: inputColor }]}>
                {Math.round(
                  (uploadProgress.current / uploadProgress.total) * 100,
                )}
                %
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Item picker bottom sheet */}
      {onToolbarAddItem && onToolbarResetDefaults && (
        <ComposerItemPicker
          visible={itemPickerVisible}
          currentItemIds={activeToolbarItems.map((i) => i.id)}
          onAddItem={(itemId) => {
            preloadPickerById(itemId);
            onToolbarAddItem(itemId);
            setItemPickerVisible(false);
          }}
          onRestoreDefaults={onToolbarResetDefaults}
          onClose={() => setItemPickerVisible(false)}
        />
      )}
    </>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    // Background and padding set dynamically
    overflow: "visible" as const,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.xl,
    minHeight: 40,
    maxHeight: 100,
    paddingRight: Spacing.xs,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "transparent",
  },
  voiceButtonInside: {
    margin: 0,
    width: 32,
    height: 32,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
  gameButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
  uploadProgressContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    gap: 4,
  },
  uploadProgressText: {
    fontSize: 12,
    fontWeight: "500",
  },
});

export default ChatComposer;
