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

import { VoiceRecording } from "@/hooks/useVoiceRecorder";
import { ReplyToMetadata } from "@/types/messaging";
import React, { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, Spacing } from "../../../constants/theme";
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
  /** Game button handler (opens game picker) */
  onGamePress?: () => void;
  /** Upload progress indicator (shown when uploading) */
  uploadProgress?: { current: number; total: number } | null;
  /** Mention autocomplete component (groups only) */
  mentionAutocomplete?: React.ReactNode;
  /** Keyboard height shared value (from useChatKeyboard) */
  keyboardHeight?: SharedValue<number>;
  /** Safe area bottom inset */
  safeAreaBottom?: number;
  /** Whether to use animated positioning */
  animated?: boolean;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** TextInput props passthrough */
  textInputProps?: Partial<TextInputProps>;
  /** TextInput ref */
  textInputRef?: React.RefObject<TextInput | null>;
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
  onGamePress,
  uploadProgress,
  mentionAutocomplete,
  keyboardHeight,
  safeAreaBottom: customSafeAreaBottom,
  animated = true,
  style,
  textInputProps,
  textInputRef,
}: ChatComposerProps): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const safeAreaBottom = customSafeAreaBottom ?? insets.bottom;

  // Internal ref for TextInput - use provided ref or create our own
  const internalTextInputRef = useRef<TextInput | null>(null);
  const inputRef = textInputRef || internalTextInputRef;

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

    // When keyboard is open (translateY is negative), we don't need safe area padding
    // When keyboard is closed (translateY is 0), we add safe area padding
    const safeAreaPadding = translateY < 0 ? 0 : safeAreaBottom;

    return {
      transform: [{ translateY }],
      paddingBottom: safeAreaPadding,
    };
  }, [keyboardHeight, safeAreaBottom, animated]);

  // Determine if send button should be visible vs other actions
  const hasText = value.trim().length > 0;
  const canSend = hasText && !sendDisabled;

  // Show voice button for groups when no text and not recording
  // Can use custom voiceButtonComponent or built-in VoiceRecordButton
  const showVoiceButton =
    scope === "group" &&
    !hasText &&
    !rightAccessory &&
    (onVoicePress || onVoiceComplete || voiceButtonComponent);

  // Determine if uploading
  const isUploading = uploadProgress !== null;

  // Determine if reply is to own message
  const isOwnMessage =
    replyTo && currentUid ? replyTo.senderId === currentUid : false;

  // Background colors based on theme
  const containerBg = theme.dark ? "#000" : "#fff";
  const inputBg = theme.dark ? "#1A1A1A" : "#f0f0f0";
  const inputColor = theme.dark ? "#FFF" : "#000";
  const borderColor = theme.dark ? "#222" : "#e0e0e0";
  const placeholderColor = theme.dark ? "#888" : "#999";

  // Static container style (non-animated properties)
  const staticContainerStyle = useMemo(
    () => [styles.container, { backgroundColor: containerBg }, style],
    [containerBg, style],
  );

  return (
    <Animated.View style={[staticContainerStyle, animatedKeyboardStyle]}>
      {/* Mention autocomplete (groups only) - shown above everything */}
      {scope === "group" && mentionAutocomplete}

      {/* Header content (attachment tray, etc.) */}
      {headerContent}

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
        {leftAccessory}

        {/* Text input container with voice button inside */}
        <View style={[styles.textInputContainer, { backgroundColor: inputBg }]}>
          <TextInput
            ref={inputRef}
            style={[styles.textInput, { color: inputColor }]}
            placeholder={placeholder}
            placeholderTextColor={placeholderColor}
            value={value}
            onChangeText={onChangeText}
            multiline
            maxLength={1000}
            textAlignVertical="center"
            editable={!isRecording}
            {...textInputProps}
          />

          {/* Voice button inside text input (when no text) */}
          {showVoiceButton &&
            (voiceButtonComponent ||
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
        {rightAccessory}

        {/* Additional right accessory (schedule button, etc.) */}
        {additionalRightAccessory}

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

        {/* Send button - shown when there's text */}
        {canSend && (
          <IconButton
            icon="send"
            size={24}
            iconColor={theme.colors.primary}
            onPress={handleSend}
            disabled={!canSend || isSending}
            loading={isSending}
            style={styles.sendButton}
          />
        )}
      </View>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    // Background and padding set dynamically
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
    alignItems: "flex-end",
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
    marginBottom: 4,
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
  sendButton: {
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
