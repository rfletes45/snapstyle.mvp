/**
 * SendButton
 *
 * Dedicated send button for the chat composer toolbar.
 * Shows an arrow-up icon when there's text/attachments to send,
 * otherwise displays a muted icon. Can be added as an optional
 * toolbar item for users who prefer a visible send button.
 *
 * @module components/chat/SendButton
 */

import * as Haptics from "expo-haptics";
import React, { memo, useCallback } from "react";
import { StyleSheet } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface SendButtonProps {
  /** Called when the send button is pressed. */
  onSend: () => void;
  /** Whether there is content to send (text or attachments). */
  canSend: boolean;
  /** Whether a send is currently in progress. */
  isSending?: boolean;
  /** Button size in pixels. */
  size?: number;
  /** Disable haptic feedback on press. */
  disableHaptic?: boolean;
}

// =============================================================================
// Component
// =============================================================================

function SendButtonBase({
  onSend,
  canSend,
  isSending = false,
  size = 24,
  disableHaptic = false,
}: SendButtonProps) {
  const theme = useTheme();
  const disabled = !canSend || isSending;

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (!disableHaptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSend();
  }, [onSend, disabled, disableHaptic]);

  return (
    <IconButton
      icon="send"
      size={size}
      iconColor={canSend ? theme.colors.primary : theme.colors.onSurfaceVariant}
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.button,
        canSend && { backgroundColor: theme.colors.primary + "15" },
      ]}
      accessibilityLabel="Send message"
      accessibilityRole="button"
    />
  );
}

export const SendButton = memo(SendButtonBase);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  button: {
    margin: 0,
    width: 40,
    height: 40,
  },
});
