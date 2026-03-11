import AsyncStorage from "@react-native-async-storage/async-storage";
import { LightColors } from "@/constants/theme";
import { createLogger } from "@/utils/log";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { v4 as uuidv4 } from "uuid";
import { getFirestoreInstance } from "./firebase";

const logger = createLogger("services/notifications");

const NOTIFICATION_DEVICE_ID_KEY = "@vibe/notification_device_id";

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
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

export async function getNotificationDeviceId(): Promise<string> {
  const existingId = await AsyncStorage.getItem(NOTIFICATION_DEVICE_ID_KEY);
  if (existingId) {
    return existingId;
  }

  const nextId = uuidv4();
  await AsyncStorage.setItem(NOTIFICATION_DEVICE_ID_KEY, nextId);
  return nextId;
}

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return null;
    }

    if (!Device.isDevice) {
      if (__DEV__) {
        return `ExponentPushToken[dev-${Date.now()}]`;
      }
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      "a57e6af7-ac18-4751-90ee-3b9cda7ea645";
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    if (Platform.OS === "android") {
      await setupAndroidChannel();
    }

    return tokenResponse.data;
  } catch (error) {
    logger.error("Failed to register for push notifications", error);
    return null;
  }
}

async function setupAndroidChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync("default", {
    name: "Vibe",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: LightColors.primary,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("game-invites", {
    name: "Game Invites",
    importance: Notifications.AndroidImportance.HIGH,
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

  await Promise.all([
    setDoc(
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
    ),
    setDoc(
      doc(db, "Users", userId),
      {
        expoPushToken: token,
      },
      { merge: true },
    ),
  ]);
}

export async function removePushToken(userId: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const deviceId = await getNotificationDeviceId();

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
      setDoc(
        doc(db, "Users", userId),
        {
          expoPushToken: null,
        },
        { merge: true },
      ),
      clearNotificationSession(userId),
    ]);
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

  await setDoc(
    doc(db, "Users", userId, "NotificationSessions", deviceId),
    {
      deviceId,
      appState: "inactive",
      currentScreen: null,
      currentChatId: null,
      currentConversationScope: null,
      currentGameSessionId: null,
      currentGameInviteId: null,
      currentGameRuntimeType: null,
      updatedAt: serverTimestamp(),
      lastHeartbeatAt: serverTimestamp(),
    },
    { merge: true },
  );
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
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return Notifications.getLastNotificationResponseAsync();
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
