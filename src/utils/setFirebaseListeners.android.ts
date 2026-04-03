/**
 * Firebase Notification Listeners - Android
 *
 * Wires Stream's Android push handlers into Firebase Messaging and Notifee,
 * but only when the required native modules are actually available.
 *
 * This file must stay safe to import in Expo Go. Do not add top-level imports
 * from Notifee, React Native Firebase Messaging, or Stream's video SDK here.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";

let listenersRegistered = false;

export const setFirebaseListeners = (): void => {
  if (!CALL_FEATURES.CALLS_ENABLED) {
    console.log(
      "[setFirebaseListeners] Stream calling native modules unavailable; skipping Android call listener bootstrap",
    );
    return;
  }

  if (listenersRegistered) {
    return;
  }

  try {
    const notifee = require("@notifee/react-native").default;
    const messaging = require("@react-native-firebase/messaging").default;
    const {
      firebaseDataHandler,
      isFirebaseStreamVideoMessage,
      isNotifeeStreamVideoEvent,
      onAndroidNotifeeEvent,
    } = require("@stream-io/video-react-native-sdk") as typeof import("@stream-io/video-react-native-sdk");

    messaging().setBackgroundMessageHandler(async (msg: any) => {
      if (isFirebaseStreamVideoMessage(msg)) {
        await firebaseDataHandler(msg.data);
      }
    });

    notifee.onBackgroundEvent(async (event: any) => {
      if (isNotifeeStreamVideoEvent(event)) {
        await onAndroidNotifeeEvent({ event, isBackground: true });
      }
    });

    messaging().onMessage((msg: any) => {
      if (isFirebaseStreamVideoMessage(msg)) {
        firebaseDataHandler(msg.data);
      }
    });

    notifee.onForegroundEvent((event: any) => {
      if (isNotifeeStreamVideoEvent(event)) {
        onAndroidNotifeeEvent({ event, isBackground: false });
      }
    });

    listenersRegistered = true;
  } catch (error) {
    console.warn(
      "[setFirebaseListeners] Android call listeners unavailable in this runtime; continuing without them",
      error,
    );
  }
};
