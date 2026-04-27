import { LightColors } from "@/constants/theme";
import { createLogger } from "@/utils/log";
import { generateUUID } from "@/utils/uuid";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { getFirestoreInstance } from "./firebase";

const logger = createLogger("services/notifications");

const NOTIFICATION_DEVICE_ID_KEY = "@vibe/notification_device_id";
const IS_EXPO_GO = Constants.appOwnership === "expo";

export interface NotificationSessionState {
  appState: string;
  currentScreen?: string | null;
  currentChatId?: string | null;
  currentConversationScope?: "dm" | "group" | null;
  currentGameSessionId?: string | null;
  currentGameInviteId?: string | null;
  currentGameRuntimeType?: string | null;
  inAppEnabled?: boolean;
  pushEnabled?: boolean;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

/**
 * Generate a device-stable UUID using expo-crypto (preferred) with a
 * Math.random-based fallback.  This avoids the "crypto.getRandomValues()
 * not supported" crash that uuid v4 triggers in React Native.
 */
function safeUUID(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return generateUUID();
  }
}

export async function getNotificationDeviceId(): Promise<string> {
  try {
    const existingId = await AsyncStorage.getItem(NOTIFICATION_DEVICE_ID_KEY);
    if (existingId) {
      return existingId;
    }
  } catch (e) {
    logger.warn("Failed to read device ID from storage, generating new one", e);
  }

  const nextId = safeUUID();
  try {
    await AsyncStorage.setItem(NOTIFICATION_DEVICE_ID_KEY, nextId);
  } catch (e) {
    logger.warn("Failed to persist device ID", e);
  }
  return nextId;
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      logger.info("Push registration skipped (web)");
      return null;
    }

    if (IS_EXPO_GO) {
      logger.info("Push registration skipped (Expo Go)");
      return null;
    }

    if (!Device.isDevice) {
      if (__DEV__) {
        logger.info(
          "Push registration: non-device dev environment, using dev token",
        );
        return `ExponentPushToken[dev-${Date.now()}]`;
      }
      logger.info("Push registration skipped (not a physical device)");
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      logger.info("Notification permission requested", { result: finalStatus });
    }

    if (finalStatus !== "granted") {
      logger.info("Push registration skipped (permission not granted)", {
        status: finalStatus,
      });
      return null;
    }

    if (Platform.OS === "android") {
      // Expo requires the Android notification channel to exist before asking
      // for the Expo push token on Android 13+.
      await setupAndroidChannel();
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      "a57e6af7-ac18-4751-90ee-3b9cda7ea645";
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    logger.info("Push token obtained", {
      token: tokenResponse.data.slice(0, 30) + "...",
    });

    return tokenResponse.data;
  } catch (error) {
    logger.error("Failed to register for push notifications", error);
    return null;
  }
}

async function setupAndroidChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync("default", {
    name: "General",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: LightColors.primary,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("messages", {
    name: "Messages",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: LightColors.primary,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("social", {
    name: "Social",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: LightColors.primary,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("game-invites", {
    name: "Games",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: LightColors.primary,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("achievements", {
    name: "Achievements & Streaks",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: LightColors.primary,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("vibe-incoming-calls", {
    name: "Incoming Calls",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 500, 500],
    lightColor: LightColors.primary,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("vibe-group-calls", {
    name: "Group Calls",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 500, 500, 500],
    lightColor: LightColors.primary,
    sound: "default",
  });
}

export async function savePushToken(
  userId: string,
  token: string,
): Promise<void> {
  const db = getFirestoreInstance();
  const deviceId = await getNotificationDeviceId();

  // Primary write — device registry (essential)
  await setDoc(
    doc(db, "Users", userId, "NotificationDevices", deviceId),
    {
      deviceId,
      expoPushToken: token,
      platform: Platform.OS,
      pushEnabled: true,
      updatedAt: serverTimestamp(),
      lastRegisteredAt: serverTimestamp(),
    },
    { merge: true },
  );

  // Legacy fallback write — root user doc (non-critical; server reads
  // from NotificationDevices as primary source).  The Users/{uid} update
  // rule enforces strict field validation, so a bare merge of just
  // expoPushToken can be rejected. Do not let it block device registration.
  try {
    await setDoc(
      doc(db, "Users", userId),
      { expoPushToken: token },
      { merge: true },
    );
  } catch (e) {
    logger.warn(
      "Failed to write legacy expoPushToken to user doc (non-critical)",
      e,
    );
  }
}

export async function removePushToken(userId: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const deviceId = await getNotificationDeviceId();

    // Critical: disable device + clear session
    await Promise.all([
      setDoc(
        doc(db, "Users", userId, "NotificationDevices", deviceId),
        {
          deviceId,
          expoPushToken: null,
          pushEnabled: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
      clearNotificationSession(userId),
    ]);

    // Non-critical legacy root-doc cleanup
    try {
      await setDoc(
        doc(db, "Users", userId),
        { expoPushToken: null },
        { merge: true },
      );
    } catch {
      // Silently ignore — Users update rule may reject bare merges
    }
  } catch (error) {
    logger.warn("Failed to remove push token", error);
  }
}

export async function syncNotificationSession(
  userId: string,
  session: NotificationSessionState,
): Promise<void> {
  const db = getFirestoreInstance();
  const deviceId = await getNotificationDeviceId();

  await setDoc(
    doc(db, "Users", userId, "NotificationSessions", deviceId),
    {
      deviceId,
      appState: session.appState,
      currentScreen: session.currentScreen ?? null,
      currentChatId: session.currentChatId ?? null,
      currentConversationScope: session.currentConversationScope ?? null,
      currentGameSessionId: session.currentGameSessionId ?? null,
      currentGameInviteId: session.currentGameInviteId ?? null,
      currentGameRuntimeType: session.currentGameRuntimeType ?? null,
      inAppEnabled: session.inAppEnabled !== false,
      pushEnabled: session.pushEnabled !== false,
      platform: Platform.OS,
      updatedAt: serverTimestamp(),
      lastHeartbeatAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function clearNotificationSession(userId: string): Promise<void> {
  const db = getFirestoreInstance();
  const deviceId = await getNotificationDeviceId();
  const ref = doc(db, "Users", userId, "NotificationSessions", deviceId);

  // Hard delete the session doc on logout / unmount.  Previously we wrote
  // appState:"inactive" which kept the session row alive with a fresh
  // updatedAt — the backend would still read it as a "recent" session and
  // could incorrectly believe the user was foregrounded from that device.
  try {
    await deleteDoc(ref);
  } catch (err) {
    // Fallback: if delete fails (rules edge-case), blank the row and mark
    // background so the staleness filter excludes it quickly.
    logger.warn(
      "Failed to delete notification session (falling back to blank write)",
      err,
    );
    await setDoc(
      ref,
      {
        deviceId,
        appState: "background",
        currentScreen: null,
        currentChatId: null,
        currentConversationScope: null,
        currentGameSessionId: null,
        currentGameInviteId: null,
        currentGameRuntimeType: null,
        inAppEnabled: false,
        pushEnabled: false,
        updatedAt: serverTimestamp(),
        lastHeartbeatAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  seconds: number = 1,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
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
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export function getLastNotificationResponse(): Notifications.NotificationResponse | null {
  return Notifications.getLastNotificationResponse();
}

export async function clearLastNotificationResponse(): Promise<void> {
  const notificationsModule = Notifications as typeof Notifications & {
    clearLastNotificationResponseAsync?: () => Promise<void>;
    clearLastNotificationResponse?: () => void;
  };

  if (
    typeof notificationsModule.clearLastNotificationResponseAsync === "function"
  ) {
    await notificationsModule.clearLastNotificationResponseAsync();
    return;
  }

  if (typeof notificationsModule.clearLastNotificationResponse === "function") {
    notificationsModule.clearLastNotificationResponse();
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.setBadgeCountAsync(count);
}
