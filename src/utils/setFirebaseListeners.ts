/**
 * Firebase Notification Listeners — iOS stub
 *
 * On iOS, push notifications for calls are handled via VoIP push
 * (react-native-voip-push-notification) not Firebase messaging.
 * This file is a no-op so the import works cross-platform.
 *
 * The Android-specific handlers are in setFirebaseListeners.android.ts.
 * React Native's platform-specific file resolution will pick the correct
 * file at bundle time.
 */

export const setFirebaseListeners = (): void => {
  // No Firebase call listeners needed on iOS — VoIP push handles it
};
