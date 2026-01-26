/**
 * Haptic Feedback Patterns
 *
 * Centralized haptic feedback utilities for consistent tactile responses
 * across the app. Each pattern is designed for specific use cases.
 *
 * @module utils/haptics
 */

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// =============================================================================
// Utility
// =============================================================================

/**
 * Check if haptics are available on the current platform
 */
const isHapticsAvailable = Platform.OS !== "web";

/**
 * Safe haptic wrapper that silently fails on unsupported platforms
 */
async function safeHaptic(action: () => Promise<void>): Promise<void> {
  if (!isHapticsAvailable) return;
  try {
    await action();
  } catch {
    // Haptics not available, fail silently
  }
}

// =============================================================================
// Haptic Pattern Functions
// =============================================================================

/**
 * Light impact feedback
 * Use for: Small selections, light taps, subtle UI feedback
 */
export function light(): Promise<void> {
  return safeHaptic(() =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  );
}

/**
 * Medium impact feedback
 * Use for: Confirmations, successful actions, moderate feedback
 */
export function medium(): Promise<void> {
  return safeHaptic(() =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  );
}

/**
 * Heavy impact feedback
 * Use for: Important actions, significant state changes
 */
export function heavy(): Promise<void> {
  return safeHaptic(() =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  );
}

/**
 * Success notification feedback
 * Use for: Successful completions, positive outcomes
 */
export function success(): Promise<void> {
  return safeHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

/**
 * Warning notification feedback
 * Use for: Warnings, caution states, approaching limits
 */
export function warning(): Promise<void> {
  return safeHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
}

/**
 * Error notification feedback
 * Use for: Errors, failures, blocked actions
 */
export function error(): Promise<void> {
  return safeHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  );
}

/**
 * Selection changed feedback
 * Use for: Picker changes, toggle switches, segmented controls
 */
export function selection(): Promise<void> {
  return safeHaptic(() => Haptics.selectionAsync());
}

// =============================================================================
// Contextual Patterns
// =============================================================================

/**
 * Swipe threshold reached
 * Use for: When user swipes past the action threshold
 */
export function swipeThreshold(): Promise<void> {
  return light();
}

/**
 * Action confirmed
 * Use for: When an action is about to be executed
 */
export function actionConfirm(): Promise<void> {
  return medium();
}

/**
 * Message sent
 * Use for: When a message is successfully queued/sent
 */
export function messageSent(): Promise<void> {
  return light();
}

/**
 * Item pinned/unpinned
 * Use for: Conversation pin state changes
 */
export function pinToggle(): Promise<void> {
  return medium();
}

/**
 * Item muted/unmuted
 * Use for: Mute state changes
 */
export function muteToggle(): Promise<void> {
  return light();
}

/**
 * Item archived
 * Use for: Moving items to archive
 */
export function archive(): Promise<void> {
  return medium();
}

/**
 * Item deleted
 * Use for: Deleting items (before confirmation)
 */
export function deleteWarning(): Promise<void> {
  return warning();
}

/**
 * Tab changed
 * Use for: Switching between inbox tabs
 */
export function tabChange(): Promise<void> {
  return selection();
}

/**
 * Long press activated
 * Use for: Context menu trigger
 */
export function longPress(): Promise<void> {
  return medium();
}

/**
 * Button press
 * Use for: Standard button interactions
 */
export function buttonPress(): Promise<void> {
  return light();
}

/**
 * Friend request accepted/rejected
 * Use for: Friend request actions
 */
export function friendRequestAction(): Promise<void> {
  return medium();
}

/**
 * Refresh completed
 * Use for: Pull-to-refresh completion
 */
export function refreshComplete(): Promise<void> {
  return light();
}

/**
 * Modal opened
 * Use for: Bottom sheet/modal appearance
 */
export function modalOpen(): Promise<void> {
  return light();
}

/**
 * Modal closed
 * Use for: Bottom sheet/modal dismissal
 */
export function modalClose(): Promise<void> {
  return light();
}

// =============================================================================
// Exported Pattern Object (for backward compatibility)
// =============================================================================

/**
 * All haptic patterns as an object for easy access
 */
export const hapticPatterns = {
  light,
  medium,
  heavy,
  success,
  warning,
  error,
  selection,
  swipeThreshold,
  actionConfirm,
  messageSent,
  pinToggle,
  muteToggle,
  archive,
  deleteWarning,
  tabChange,
  longPress,
  buttonPress,
  friendRequestAction,
  refreshComplete,
  modalOpen,
  modalClose,
};

export default hapticPatterns;
