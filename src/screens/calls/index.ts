/**
 * Call Screens - Barrel Export
 *
 * Legacy call screens (AudioCallScreen, VideoCallScreen, GroupCallScreen)
 * have been replaced by Stream-based screens in @/screens/stream/.
 * Only CallHistoryScreen and CallSettingsScreen remain here.
 */

// Platform-agnostic screens (no native dependencies)
export { CallHistoryScreen } from "./CallHistoryScreen";
export { CallSettingsScreen } from "./CallSettingsScreen";
