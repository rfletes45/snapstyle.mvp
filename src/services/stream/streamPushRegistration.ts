/**
 * Stream Push Device Registration
 *
 * Registers the device's native push token (FCM on Android, APNs on iOS)
 * with Stream Video so that incoming calls trigger push notifications
 * when the app is backgrounded or closed.
 *
 * This is separate from Expo push token registration in notifications.ts.
 * Expo tokens → your own notification system (chat, social, etc.)
 * Native tokens → Stream's call ringing system
 */

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { StreamVideoClient } from "@stream-io/video-react-native-sdk";

/**
 * Register the device's native push token with Stream Video.
 *
 * Must be called AFTER:
 * 1. The Stream client is initialized and connected
 * 2. Push notification permissions have been granted
 *
 * On Android: registers FCM token with push_provider = "firebase"
 * On iOS:     registers APNs token with push_provider = "apn"
 */
export async function registerStreamPushToken(
  client: StreamVideoClient,
): Promise<void> {
  try {
    // Skip on web — no push tokens
    if (Platform.OS === "web") return;

    // Simulators/emulators don't have push tokens
    if (!Device.isDevice) {
      console.log(
        "[StreamPush] Skipping push registration (not a physical device)",
      );
      return;
    }

    // Check permission status — don't request here, notifications.ts handles that
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      console.warn(
        "[StreamPush] Push permission not granted, skipping registration",
      );
      return;
    }

    // Get the NATIVE device push token (FCM on Android, APNs on iOS)
    // This is different from getExpoPushTokenAsync() which returns an Expo token
    const tokenData = await Notifications.getDevicePushTokenAsync();

    if (!tokenData?.data) {
      console.warn("[StreamPush] No device push token available");
      return;
    }

    // tokenData.data is a string on Android (FCM token), string on iOS (APNs hex token)
    const token =
      typeof tokenData.data === "string"
        ? tokenData.data
        : JSON.stringify(tokenData.data);

    if (Platform.OS === "android") {
      // Register with Stream as a Firebase (FCM) device
      // The 4th arg "vibe-firebase" must match the Name you set in Stream Dashboard (step 7c)
      await client.addDevice(token, "firebase", undefined, "vibe-firebase");
      console.log("[StreamPush] ✓ Registered FCM token with Stream");
    } else if (Platform.OS === "ios") {
      // Register with Stream as an APNs device
      // The 4th arg "vibe-apn" must match the Name you set in Stream Dashboard (step 8b)
      await client.addDevice(token, "apn", undefined, "vibe-apn");
      console.log("[StreamPush] ✓ Registered APNs token with Stream");
    }
  } catch (err) {
    // Non-fatal — calls still work in foreground without push registration.
    // Common failure: permission not granted, no Google Play Services (Android emulator).
    console.warn("[StreamPush] Failed to register push token:", err);
  }
}

/**
 * Unregister the device's push token from Stream.
 * Call this on logout to stop receiving call pushes for the old user.
 */
export async function unregisterStreamPushToken(
  client: StreamVideoClient,
): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    if (!Device.isDevice) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const tokenData = await Notifications.getDevicePushTokenAsync();
    if (!tokenData?.data) return;

    const token =
      typeof tokenData.data === "string"
        ? tokenData.data
        : JSON.stringify(tokenData.data);

    await client.removeDevice(token);
    console.log("[StreamPush] ✓ Unregistered push token from Stream");
  } catch (err) {
    // Non-fatal — if this fails, the token will expire naturally
    console.warn("[StreamPush] Failed to unregister push token:", err);
  }
}
