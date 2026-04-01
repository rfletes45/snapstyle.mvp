/**
 * Firebase Notification Listeners — Android
 *
 * Wires the Stream Video SDK's push notification handlers into React Native
 * Firebase Messaging and Notifee event systems. These handlers process
 * incoming call pushes on Android (foreground, background, and terminated).
 *
 * Platform-specific file: React Native automatically selects this over
 * setFirebaseListeners.ts when bundling for Android.
 */

import notifee from "@notifee/react-native";
import messaging from "@react-native-firebase/messaging";
import {
  firebaseDataHandler,
  isFirebaseStreamVideoMessage,
  isNotifeeStreamVideoEvent,
  onAndroidNotifeeEvent,
} from "@stream-io/video-react-native-sdk";

export const setFirebaseListeners = (): void => {
  // ── Background message handler ──────────────────────────────────────────
  // Fires when a Firebase data message arrives while the app is in the
  // background or terminated. The SDK displays a Notifee notification with
  // accept/decline actions.
  messaging().setBackgroundMessageHandler(async (msg) => {
    if (isFirebaseStreamVideoMessage(msg)) {
      await firebaseDataHandler(msg.data);
    }
    // Non-Stream messages are ignored here; they are handled by the
    // existing Expo notification system.
  });

  // ── Notifee background event handler ────────────────────────────────────
  // Fires when the user taps Accept/Decline on the Notifee notification
  // while the app is in the background.
  notifee.onBackgroundEvent(async (event) => {
    if (isNotifeeStreamVideoEvent(event)) {
      await onAndroidNotifeeEvent({ event, isBackground: true });
    }
  });

  // ── Foreground message handler ──────────────────────────────────────────
  // Fires when a Firebase data message arrives while the app is in the
  // foreground. The SDK may display a heads-up notification or route to
  // the in-app ringing UI.
  messaging().onMessage((msg) => {
    if (isFirebaseStreamVideoMessage(msg)) {
      firebaseDataHandler(msg.data);
    }
  });

  // ── Notifee foreground event handler ────────────────────────────────────
  // Fires when the user interacts with a Notifee notification while the
  // app is in the foreground.
  notifee.onForegroundEvent((event) => {
    if (isNotifeeStreamVideoEvent(event)) {
      onAndroidNotifeeEvent({ event, isBackground: false });
    }
  });
};
