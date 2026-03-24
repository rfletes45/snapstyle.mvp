/**
 * Call Screens - Barrel Export
 *
 * CallsScreen is the new main Calls tab (replaces old CallHistoryScreen route).
 * CallSettingsScreen is still used for call preferences.
 * CallHistoryScreen is legacy and no longer routed.
 */

// Main Calls tab
export { default as CallsScreen } from "./CallsScreen";

// Settings (navigated from Calls tab)
export { CallSettingsScreen } from "./CallSettingsScreen";

// Legacy — kept for reference but no longer routed
export { CallHistoryScreen } from "./CallHistoryScreen";
