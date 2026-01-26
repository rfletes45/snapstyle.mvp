/**
 * ChatComposer Component
 *
 * Animated wrapper for chat input that stays attached to keyboard.
 * Handles keyboard animation, safe area, and provides consistent
 * behavior across DM and Group chat screens.
 *
 * @module components/chat/ChatComposer
 */

import React, { useMemo } from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { IconButton, useTheme } from "react-native-paper";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface ChatComposerProps {
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
  /** Right accessory (additional buttons) */
  rightAccessory?: React.ReactNode;
  /** Header content (reply preview, attachment tray) */
  headerContent?: React.ReactNode;
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
  textInputRef?: React.RefObject<TextInput>;
}

// =============================================================================
// Component
// =============================================================================

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  sendDisabled = false,
  isSending = false,
  placeholder = "Message...",
  leftAccessory,
  rightAccessory,
  headerContent,
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

  // Animated style for keyboard attachment
  const animatedContainerStyle = useAnimatedStyle(() => {
    if (!keyboardHeight || !animated) {
      return {};
    }

    return {
      // On iOS, transform moves the composer up with the keyboard
      // On Android, the system handles this via windowSoftInputMode
      transform: Platform.OS === "ios" ? [{ translateY: 0 }] : [],
      // Padding bottom accounts for safe area when keyboard is closed
      paddingBottom: keyboardHeight.value > 0 ? 0 : safeAreaBottom,
    };
  }, [safeAreaBottom, animated]);

  // Determine if send button should be visible vs other actions
  const canSend = value.trim().length > 0 && !sendDisabled;

  // Background colors based on theme
  const containerBg = theme.dark ? "#000" : "#fff";
  const inputBg = theme.dark ? "#1A1A1A" : "#f0f0f0";
  const inputColor = theme.dark ? "#FFF" : "#000";
  const borderColor = theme.dark ? "#222" : "#e0e0e0";
  const placeholderColor = theme.dark ? "#888" : "#999";

  const containerStyle = useMemo(
    () => [
      styles.container,
      { backgroundColor: containerBg, paddingBottom: safeAreaBottom },
      animated && animatedContainerStyle,
      style,
    ],
    [containerBg, safeAreaBottom, animated, animatedContainerStyle, style],
  );

  return (
    <Animated.View style={containerStyle}>
      {/* Header content (reply preview, attachments) */}
      {headerContent}

      {/* Input row */}
      <View
        style={[
          styles.inputRow,
          { backgroundColor: containerBg, borderTopColor: borderColor },
        ]}
      >
        {/* Left accessory */}
        {leftAccessory}

        {/* Text input */}
        <TextInput
          ref={textInputRef}
          style={[
            styles.textInput,
            { backgroundColor: inputBg, color: inputColor },
          ]}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={1000}
          textAlignVertical="center"
          editable={!isSending}
          {...textInputProps}
        />

        {/* Right accessory or send button */}
        {rightAccessory}

        {/* Send button - shown when there's text */}
        {canSend && (
          <IconButton
            icon="send"
            size={24}
            iconColor={theme.colors.primary}
            onPress={onSend}
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
  textInput: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
});

export default ChatComposer;
