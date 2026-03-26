/**
 * ChatComposer Component (ARCH-C04)
 *
 * Unified composer component for DM and Group chat screens.
 * Handles keyboard animation, safe area, and provides consistent
 * behavior with scope-specific features.
 *
 * Features:
 * - Scope-aware rendering (dm vs group)
 * - Voice button for groups (when input empty)
 * - Mention autocomplete support for groups
 * - Reply preview bar with cancel
 * - Camera/attachment left accessory
 * - Animated keyboard attachment (60fps via Reanimated)
 *
 * @module components/chat/ChatComposer
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { VoiceRecording } from "@/hooks/useVoiceRecorder";
import { useAppTheme } from "@/store/ThemeContext";
import { ReplyToMetadata } from "@/types/messaging";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimalIcon } from "./AnimalIcon";
import { AnimalPickerBubble } from "./AnimalPickerBubble";
import { ReplyPreviewBar } from "./ReplyPreviewBar";
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
  /** Animal button handler (sends an animal bubble based on equipped theme) */
  onAnimalPress?: () => void;
  /** The equipped animal theme ID (e.g. "animal_duck", "animal_bear") */
  animalThemeId?: string | null;
  /** Whether the user can send the equipped animal (entitlement gated) */
  animalLocked?: boolean;
  /** Whether the animal picker bubble is open */
  animalPickerVisible?: boolean;
  /** Called on long press of the animal button (opens picker) */
  onAnimalLongPress?: () => void;
  /** Called to close the animal picker */
  onAnimalPickerClose?: () => void;
  /** Current user ID (for animal picker ownership) */
  currentUserId?: string;
  /** Called when an animal is equipped from the picker */
  onAnimalEquipped?: (animalId: string) => void;
  /** Game button handler (opens game picker) */
  onGamePress?: () => void;
  /** Upload progress indicator (shown when uploading) */
  uploadProgress?: { current: number; total: number } | null;
  /** Called when the cursor position changes (for mention trigger detection) */
  onCursorChange?: (position: number) => void;
  /** Mention autocomplete component (groups only) */
  mentionAutocomplete?: React.ReactNode;
  /** Keyboard height shared value (from useChatKeyboard) */
  keyboardHeight?: SharedValue<number>;
  /** Keyboard animation progress 0→1 shared value (from useChatKeyboard) */
  keyboardProgress?: SharedValue<number>;
  /** Safe area bottom inset */
  safeAreaBottom?: number;
  /** Whether to use animated positioning */
  animated?: boolean;
  /**
   * Whether to use absolute positioning at the bottom of the screen.
   * When true, the composer will be fixed at the bottom and slide in
   * with the screen transition, covering other UI elements if needed.
   * This prevents the composer from jumping when the tab bar disappears.
   */
  absolutePosition?: boolean;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** TextInput props passthrough */
  textInputProps?: Partial<TextInputProps>;
  /** TextInput ref */
  textInputRef?: React.RefObject<TextInput | null>;
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
  animalThemeId,
  animalLocked = false,
  animalPickerVisible = false,
  onAnimalLongPress,
  onAnimalPickerClose,
  currentUserId,
  onAnimalEquipped,
  onGamePress,
  uploadProgress,
  onCursorChange,
  mentionAutocomplete,
  keyboardHeight,
  keyboardProgress,
  safeAreaBottom: customSafeAreaBottom,
  animated = true,
  absolutePosition = false,
  style,
  textInputProps,
  textInputRef,
}: ChatComposerProps): React.JSX.Element {
  const theme = useTheme();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const safeAreaBottom = customSafeAreaBottom ?? insets.bottom;

  // Internal ref for TextInput - use provided ref or create our own
  const internalTextInputRef = useRef<TextInput | null>(null);
  const inputRef = textInputRef || internalTextInputRef;
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

  // Animal button ref for anchor measurement
  const animalButtonRef = useRef<View>(null);
  const [animalAnchor, setAnimalAnchor] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Measure animal button position when picker opens
  const measureAnimalButton = useCallback(() => {
    if (animalButtonRef.current) {
      animalButtonRef.current.measureInWindow((x, y, width, height) => {
        setAnimalAnchor({ x, y, width, height });
      });
    }
  }, []);

  // Re-measure anchor when keyboard state changes while picker is visible
  // so the bubble repositions correctly
  useEffect(() => {
    if (!animalPickerVisible) return;

    const showEvent =
      Platform.OS === "ios" ? "keyboardDidShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardDidHide" : "keyboardDidHide";

    // Small delay allows the layout to settle after keyboard animation
    const remeasure = () => setTimeout(measureAnimalButton, 100);

    const sub1 = Keyboard.addListener(showEvent, remeasure);
    const sub2 = Keyboard.addListener(hideEvent, remeasure);
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [animalPickerVisible, measureAnimalButton]);

  // Long press handler for animal button
  const handleAnimalLongPress = useCallback(() => {
    if (animalLocked || !onAnimalLongPress) return;
    measureAnimalButton();
    onAnimalLongPress();
  }, [animalLocked, onAnimalLongPress, measureAnimalButton]);

  // Wrapper for onSend that refocuses the TextInput after sending
  // This keeps the keyboard open after sending a message
  // We handle both sync and async onSend handlers
  const handleSend = useCallback(async () => {
    // Store ref to input before calling onSend (in case of re-renders)
    const input = inputRef.current;

    try {
      // Call onSend and await it in case it's async
      await Promise.resolve(onSend());
    } finally {
      // Refocus the TextInput after send completes to keep keyboard open
      // Use multiple attempts to handle race conditions with re-renders
      const refocusInput = () => {
        if (input) {
          input.focus();
        } else if (inputRef.current) {
          inputRef.current.focus();
        }
      };

      // Immediate refocus attempt
      refocusInput();
      // Delayed refocus to handle post-render scenarios
      setTimeout(refocusInput, 50);
      setTimeout(refocusInput, 150);
    }
  }, [onSend, inputRef]);

  // Animated style for smooth 60fps keyboard tracking
  // Uses transform: translateY for buttery smooth animations that work with
  // interactive keyboard dismiss (when user drags to close keyboard)
  // The keyboardHeight from useChatKeyboard is NEGATIVE when keyboard is open (e.g., -318)
  const animatedKeyboardStyle = useAnimatedStyle(() => {
    "worklet";
    // If no keyboard tracking or not animated, return static values
    if (!keyboardHeight || !animated) {
      return {
        transform: [{ translateY: 0 }],
        paddingBottom: safeAreaBottom,
      };
    }

    // keyboardHeight.value is negative when keyboard is open (e.g., -318)
    // We use translateY to move the composer up with the keyboard
    // This works smoothly with interactive dismiss because transform
    // animates on the UI thread without layout recalculation
    const translateY = Platform.OS === "ios" ? keyboardHeight.value : 0;

    // Smoothly interpolate safe area padding using keyboard progress
    // instead of a hard if/else on translateY which caused a visual jump
    // (safeAreaBottom→0 instantly when translateY went from 0 to -1)
    const progress = keyboardProgress?.value ?? (translateY < 0 ? 1 : 0);
    const safeAreaPadding = safeAreaBottom * (1 - progress);

    return {
      transform: [{ translateY }],
      paddingBottom: safeAreaPadding,
    };
  }, [keyboardHeight, keyboardProgress, safeAreaBottom, animated]);

  // Keyboard backdrop: opaque black view behind the iOS translucent keyboard
  // so chat content/images are not visible through the keyboard blur.
  // Positioned absolutely at the bottom; height tracks keyboard height on UI thread.
  const keyboardBackdropColor = colors.keyboardSurface ?? colors.background;
  const backdropAnimatedStyle = useAnimatedStyle(() => {
    "worklet";
    if (!keyboardHeight) {
      return { height: 0, opacity: 0 };
    }
    const kbHeight = -keyboardHeight.value;
    return {
      height: Math.max(kbHeight, 0),
      opacity: kbHeight > 0 ? 1 : 0,
    };
  }, [keyboardHeight]);

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

  // Static container style (non-animated properties)
  // When absolutePosition is true, position at bottom of screen to prevent jumping
  const staticContainerStyle = useMemo(
    () => [
      styles.container,
      { backgroundColor: containerBg },
      absolutePosition && styles.absoluteContainer,
      style,
    ],
    [containerBg, absolutePosition, style],
  );

  return (
    <>
      {/* Keyboard backdrop: opaque layer behind the iOS translucent keyboard */}
      {Platform.OS === "ios" && keyboardHeight && animated && (
        <Animated.View
          style={[
            styles.keyboardBackdrop,
            { backgroundColor: keyboardBackdropColor },
            backdropAnimatedStyle,
          ]}
          pointerEvents="none"
        />
      )}
      <Animated.View style={[staticContainerStyle, animatedKeyboardStyle]}>
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

        {/* Input row */}
        <View
          style={[
            styles.inputRow,
            { backgroundColor: containerBg, borderTopColor: borderColor },
          ]}
        >
          {/* Left accessory */}
          {normalizedLeftAccessory}

          {/* Text input container with voice button inside */}
          <View
            style={[styles.textInputContainer, { backgroundColor: inputBg }]}
          >
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: inputColor }]}
              placeholder={placeholder}
              placeholderTextColor={placeholderColor}
              selectionColor={colors.primary}
              keyboardAppearance={
                Platform.OS === "ios" ? (isDark ? "dark" : "light") : undefined
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
              editable={!isRecording}
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={canSend ? handleSend : undefined}
              {...textInputProps}
            />

            {/* Voice button inside text input (when no text) */}
            {showVoiceButton &&
              (normalizedVoiceButtonComponent ||
                (onVoiceComplete ? (
                  // Built-in VoiceRecordButton (hold-to-record with visual feedback)
                  <VoiceRecordButton
                    onRecordingComplete={onVoiceComplete}
                    onRecordingCancelled={onVoiceCancelled}
                    disabled={isSending}
                    size={32}
                    maxDuration={maxVoiceDuration / 1000} // Convert ms to seconds
                    style={styles.voiceButtonInside}
                  />
                ) : (
                  // Legacy simple IconButton (for backwards compatibility)
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

          {/* Right accessory (custom) */}
          {normalizedRightAccessory}

          {/* Additional right accessory (schedule button, etc.) */}
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

          {/* Game button - opens game picker */}
          {onGamePress && (
            <IconButton
              icon="gamepad-variant-outline"
              size={24}
              iconColor={theme.colors.onSurfaceVariant}
              onPress={onGamePress}
              style={styles.gameButton}
            />
          )}

          {/* Animal button - sends an animal bubble based on equipped theme */}
          {onAnimalPress && (
            <View ref={animalButtonRef} collapsable={false}>
              {animalPickerVisible ? (
                // X close button when picker is open
                <Pressable
                  onPress={onAnimalPickerClose}
                  style={styles.animalCloseButton}
                  accessibilityLabel="Close animal picker"
                  accessibilityRole="button"
                >
                  <IconButton
                    icon="close"
                    size={18}
                    iconColor={colors.onPrimary}
                    style={{ margin: 0 }}
                  />
                </Pressable>
              ) : (
                <TouchableOpacity
                  onPress={animalLocked ? undefined : onAnimalPress}
                  onLongPress={handleAnimalLongPress}
                  delayLongPress={500}
                  activeOpacity={animalLocked ? 1 : 0.7}
                  style={[
                    styles.animalButton,
                    animalLocked && { opacity: 0.35 },
                  ]}
                  accessibilityLabel={
                    animalLocked ? "Animal locked" : "Send animal"
                  }
                  accessibilityRole="button"
                  disabled={animalLocked}
                >
                  <AnimalIcon animalId={animalThemeId} size={25} wide />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Animated.View>

      {/* Animal picker bubble overlay — always mounted for pre-loading */}
      {onAnimalPress &&
        currentUserId &&
        onAnimalPickerClose &&
        onAnimalEquipped && (
          <AnimalPickerBubble
            visible={animalPickerVisible}
            onClose={onAnimalPickerClose}
            uid={currentUserId}
            equippedAnimalId={animalThemeId ?? null}
            onEquipped={onAnimalEquipped}
            anchorLayout={animalAnchor}
            keyboardHeight={0}
            safeAreaBottom={safeAreaBottom}
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
  keyboardBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  // Absolute positioning for the composer to prevent jumping during screen transitions
  // This ensures the composer slides in at the exact correct position
  absoluteContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
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
  animalButton: {
    margin: 0,
    width: 36,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  animalCloseButton: {
    margin: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D32F2F",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginVertical: 6,
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
