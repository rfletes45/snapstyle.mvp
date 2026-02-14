/**
 * Cross-Platform Confirm Dialog Utility
 *
 * Provides a unified API for confirmation dialogs that works on
 * both web (window.confirm / window.alert) and native (Alert.alert).
 *
 * @module utils/confirmDialog
 */

import { Alert, Platform } from "react-native";

// =============================================================================
// Types
// =============================================================================

export interface ConfirmDialogOptions {
  /** Dialog title */
  title: string;
  /** Dialog message / body text */
  message: string;
  /** Text for the confirm button (default: "OK") */
  confirmText?: string;
  /** Whether the confirm action is destructive (default: false) */
  destructive?: boolean;
  /** Text for the cancel button (default: "Cancel") */
  cancelText?: string;
}

export interface AlertDialogOptions {
  /** Dialog title */
  title: string;
  /** Dialog message / body text */
  message: string;
  /** Text for the dismiss button (default: "OK") */
  buttonText?: string;
}

// =============================================================================
// Confirm Dialog
// =============================================================================

/**
 * Show a cross-platform confirmation dialog.
 *
 * - On web: uses `window.confirm()`
 * - On native: uses `Alert.alert()` with Cancel/Confirm buttons
 *
 * @param options - Dialog configuration
 * @param onConfirm - Callback executed when user confirms
 * @param onCancel - Optional callback executed when user cancels
 *
 * @example
 * ```typescript
 * confirmDialog(
 *   {
 *     title: "Delete Message",
 *     message: "Are you sure you want to delete this message?",
 *     confirmText: "Delete",
 *     destructive: true,
 *   },
 *   async () => {
 *     await deleteMessage(messageId);
 *   },
 * );
 * ```
 */
export function confirmDialog(
  options: ConfirmDialogOptions,
  onConfirm: () => void | Promise<void>,
  onCancel?: () => void,
): void {
  const {
    title,
    message,
    confirmText = "OK",
    destructive = false,
    cancelText = "Cancel",
  } = options;

  if (Platform.OS === "web") {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      onConfirm();
    } else {
      onCancel?.();
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: "cancel", onPress: onCancel },
      {
        text: confirmText,
        style: destructive ? "destructive" : "default",
        onPress: () => onConfirm(),
      },
    ]);
  }
}

// =============================================================================
// Alert Dialog (info only, no confirmation needed)
// =============================================================================

/**
 * Show a cross-platform alert dialog (info/success/error).
 *
 * - On web: uses `window.alert()`
 * - On native: uses `Alert.alert()` with single OK button
 *
 * @param options - Dialog configuration
 *
 * @example
 * ```typescript
 * alertDialog({
 *   title: "Success",
 *   message: "Message has been cancelled",
 * });
 * ```
 */
export function alertDialog(options: AlertDialogOptions): void {
  const { title, message, buttonText = "OK" } = options;

  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message, [{ text: buttonText }]);
  }
}
