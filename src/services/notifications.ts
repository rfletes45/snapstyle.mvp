/**
 * Notifications Service
 * Handles push notification registration, permissions, and token management
 *
 * Features:
 * - Register for push notifications
 * - Store Expo Push Token in Firestore
 * - Request notification permissions
 * - Handle notification received/tapped events
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { LightColors } from "@/constants/theme";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/notifications");
// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and get Expo Push Token
 * @returns Expo Push Token string or null if failed
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    logger.info("🔵 [notifications] Registering for push notifications");

    // Check if running on a physical device (required for push)
    if (!Device.isDevice) {
      logger.warn(
        "⚠️ [notifications] Push notifications require a physical device",
      );
      // For development, return a mock token
      if (__DEV__) {
        const mockToken = `ExponentPushToken[dev-${Date.now()}]`;
        logger.info(
          "🔵 [notifications] Using development mock token:",
          mockToken,
        );
        return mockToken;
      }
      return null;
    }

    // Check and request permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      logger.info("🔵 [notifications] Requesting permission");
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      logger.warn("⚠️ [notifications] Permission not granted");
      return null;
    }

    logger.info("✅ [notifications] Permission granted");

    // Get Expo Push Token
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: "your-project-id", // Optional: Replace with actual Expo project ID
    });

    const token = tokenResponse.data;
    logger.info("✅ [notifications] Got push token:", token);

    // Set up Android notification channel
    if (Platform.OS === "android") {
      await setupAndroidChannel();
    }

    return token;
  } catch (error: any) {
    logger.error("❌ [notifications] Error registering:", error);
    return null;
  }
}

/**
 * Set up Android notification channel for proper notification display
 */
async function setupAndroidChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync("default", {
    name: "Vibe",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: LightColors.primary,
    sound: "default",
  });
  logger.info("✅ [notifications] Android channel set up");
}

/**
 * Store Expo Push Token in Firestore for the user
 * @param userId - User's UID
 * @param token - Expo Push Token
 */
export async function savePushToken(
  userId: string,
  token: string,
): Promise<void> {
  try {
    logger.info("🔵 [notifications] Saving push token for user:", userId);
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);
    await updateDoc(userRef, {
      expoPushToken: token,
    });
    logger.info("✅ [notifications] Push token saved");
  } catch (error: any) {
    logger.error("❌ [notifications] Error saving token:", error);
    throw error;
  }
}

/**
 * Remove push token from user's profile (on logout)
 * @param userId - User's UID
 */
export async function removePushToken(userId: string): Promise<void> {
  try {
    logger.info("🔵 [notifications] Removing push token for user:", userId);
    const db = getFirestoreInstance();
    const userRef = doc(db, "Users", userId);
    await updateDoc(userRef, {
      expoPushToken: null,
    });
    logger.info("✅ [notifications] Push token removed");
  } catch (error: any) {
    logger.error("❌ [notifications] Error removing token:", error);
    // Don't throw - this is cleanup
  }
}

/**
 * Schedule a local notification (for testing or reminders)
 * @param title - Notification title
 * @param body - Notification body
 * @param seconds - Delay in seconds
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  seconds: number = 1,
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
  logger.info("✅ [notifications] Scheduled local notification:", id);
  return id;
}

/**
 * Add listener for notification received while app is foregrounded
 * @param callback - Function to call when notification is received
 * @returns Subscription to remove listener
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notification tapped/interacted with
 * @param callback - Function to call when notification is tapped
 * @returns Subscription to remove listener
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get the last notification response (if app was opened from notification)
 * @returns Last notification response or null
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  logger.info("✅ [notifications] All notifications cancelled");
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
