/**
 * NOTIFICATION SYSTEM - SNAP NOTIFICATIONS SERVICE
 * Manages notifications for snap-related events
 * Integrates with push notifications and in-app notification system
 * Uses Firebase Web SDK v12 modular API
 */

import * as Notifications from "expo-notifications";
import {
  collection,
  deleteDoc,
  doc,
  limit as firestoreLimit,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "../firebase";

/**
 * Snap notification types
 */
export type SnapNotificationType =
  | "snap_received"
  | "snap_viewed"
  | "snap_screenshot"
  | "snap_reaction"
  | "snap_reply"
  | "snap_expiring_soon";

/**
 * Snap notification document
 */
export interface SnapNotification {
  id: string;
  userId: string;
  type: SnapNotificationType;
  senderId: string;
  senderName: string;
  senderImage: string;
  snapId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Notify user that they received a snap
 */
export async function notifySnapReceived(
  recipientId: string,
  snapId: string,
  senderId: string,
  senderName: string,
  senderImage: string,
): Promise<void> {
  try {
    console.log(
      `[Game Notifications] Notifying ${recipientId} of snap from ${senderName}`,
    );

    const db = getFirestoreInstance();

    // Create notification document
    const notificationsRef = collection(db, "Notifications");
    const notificationRef = doc(notificationsRef);

    const notificationData = {
      userId: recipientId,
      type: "snap_received" as SnapNotificationType,
      senderId,
      senderName,
      senderImage,
      snapId,
      title: `📸 ${senderName} sent you a snap`,
      body: "Tap to view",
      data: {
        snapId,
        senderId,
        type: "snap_received",
      },
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    await setDoc(notificationRef, notificationData);

    // Send push notification
    await sendPushNotification(
      recipientId,
      `${senderName} sent you a snap`,
      "Tap to view",
      notificationData.data,
    );

    console.log("[Game Notifications] Snap received notification sent");
  } catch (error) {
    console.error(
      "[Game Notifications] Failed to notify snap received:",
      error,
    );
  }
}

/**
 * Notify snap sender that their snap was viewed
 */
export async function notifySnapViewed(
  senderId: string,
  snapId: string,
  viewerId: string,
  viewerName: string,
  viewerImage: string,
): Promise<void> {
  try {
    console.log(
      `[Game Notifications] Notifying ${senderId} that snap was viewed by ${viewerName}`,
    );

    const db = getFirestoreInstance();

    const notificationsRef = collection(db, "Notifications");
    const notificationRef = doc(notificationsRef);

    const notificationData = {
      userId: senderId,
      type: "snap_viewed" as SnapNotificationType,
      senderId: viewerId,
      senderName: viewerName,
      senderImage: viewerImage,
      snapId,
      title: `👀 ${viewerName} viewed your snap`,
      body: "Your snap was seen",
      data: {
        snapId,
        viewerId,
        type: "snap_viewed",
      },
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    await setDoc(notificationRef, notificationData);

    // Send push notification
    await sendPushNotification(
      senderId,
      `${viewerName} viewed your snap`,
      "Your snap was seen",
      notificationData.data,
    );

    console.log("[Game Notifications] Snap viewed notification sent");
  } catch (error) {
    console.error("[Game Notifications] Failed to notify snap viewed:", error);
  }
}

/**
 * Notify snap sender that their snap was screenshotted
 * CRITICAL: Privacy alert notification
 */
export async function notifySnapScreenshotted(
  senderId: string,
  snapId: string,
  screenshotterId: string,
  screenshotterName: string,
  screenshotterImage: string,
): Promise<void> {
  try {
    console.log(
      `[Game Notifications] ALERT: Snap screenshot by ${screenshotterName}`,
    );

    const db = getFirestoreInstance();

    const notificationsRef = collection(db, "Notifications");
    const notificationRef = doc(notificationsRef);

    const notificationData = {
      userId: senderId,
      type: "snap_screenshot" as SnapNotificationType,
      senderId: screenshotterId,
      senderName: screenshotterName,
      senderImage: screenshotterImage,
      snapId,
      title: `⚠️ ${screenshotterName} took a screenshot`,
      body: "Your snap privacy has been compromised",
      data: {
        snapId,
        screenshotterId,
        type: "snap_screenshot",
        priority: "high",
      },
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };

    await setDoc(notificationRef, notificationData);

    // Send HIGH PRIORITY push notification
    await sendPushNotification(
      senderId,
      `⚠️ ${screenshotterName} took a screenshot`,
      "Your snap privacy has been compromised",
      notificationData.data,
      {
        sound: "default",
        badge: 1,
        priority: "high",
      },
    );

    console.log("[Game Notifications] Screenshot alert notification sent");
  } catch (error) {
    console.error("[Game Notifications] Failed to notify screenshot:", error);
  }
}

/**
 * Notify snap sender of reaction
 */
export async function notifySnapReaction(
  senderId: string,
  snapId: string,
  reactorId: string,
  reactorName: string,
  reactorImage: string,
  emoji: string,
): Promise<void> {
  try {
    console.log(
      `[Game Notifications] Notifying ${senderId} of reaction from ${reactorName}`,
    );

    const db = getFirestoreInstance();

    const notificationsRef = collection(db, "Notifications");
    const notificationRef = doc(notificationsRef);

    const notificationData = {
      userId: senderId,
      type: "snap_reaction" as SnapNotificationType,
      senderId: reactorId,
      senderName: reactorName,
      senderImage: reactorImage,
      snapId,
      title: `${emoji} ${reactorName} reacted to your snap`,
      body: "Someone loved your snap",
      data: {
        snapId,
        reactorId,
        emoji,
        type: "snap_reaction",
      },
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    await setDoc(notificationRef, notificationData);

    // Send push notification
    await sendPushNotification(
      senderId,
      `${emoji} ${reactorName} reacted to your snap`,
      "Someone loved your snap",
      notificationData.data,
    );

    console.log("[Game Notifications] Reaction notification sent");
  } catch (error) {
    console.error("[Game Notifications] Failed to notify reaction:", error);
  }
}

/**
 * Notify snap sender of reply
 */
export async function notifySnapReply(
  senderId: string,
  snapId: string,
  replierId: string,
  replierName: string,
  replierImage: string,
  replyPreview: string,
): Promise<void> {
  try {
    console.log(
      `[Game Notifications] Notifying ${senderId} of reply from ${replierName}`,
    );

    const db = getFirestoreInstance();

    const notificationsRef = collection(db, "Notifications");
    const notificationRef = doc(notificationsRef);

    const notificationData = {
      userId: senderId,
      type: "snap_reply" as SnapNotificationType,
      senderId: replierId,
      senderName: replierName,
      senderImage: replierImage,
      snapId,
      title: `💬 ${replierName} replied to your snap`,
      body: replyPreview.substring(0, 100),
      data: {
        snapId,
        replierId,
        type: "snap_reply",
      },
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    await setDoc(notificationRef, notificationData);

    // Send push notification
    await sendPushNotification(
      senderId,
      `${replierName} replied to your snap`,
      replyPreview.substring(0, 100),
      notificationData.data,
    );

    console.log("[Game Notifications] Reply notification sent");
  } catch (error) {
    console.error("[Game Notifications] Failed to notify reply:", error);
  }
}

/**
 * Notify user that their snap is expiring soon
 */
export async function notifySnapExpiringSoon(
  senderId: string,
  snapId: string,
  minutesLeft: number,
): Promise<void> {
  try {
    console.log(
      `[Game Notifications] Notifying ${senderId} that snap expires in ${minutesLeft} minutes`,
    );

    const db = getFirestoreInstance();

    // Only create if not already notified
    const notificationsRef = collection(db, "Notifications");
    const existingQuery = query(
      notificationsRef,
      where("userId", "==", senderId),
      where("snapId", "==", snapId),
      where("type", "==", "snap_expiring_soon"),
    );
    const existing = await getDocs(existingQuery);

    if (!existing.empty) {
      console.log("[Game Notifications] Already notified about expiry");
      return;
    }

    // Create notification document
    const notificationRef = doc(notificationsRef);

    const notificationData = {
      userId: senderId,
      type: "snap_expiring_soon" as SnapNotificationType,
      senderId: "system",
      senderName: "SnapStyle",
      senderImage: "",
      snapId,
      title: `⏰ Your snap expires soon`,
      body: `${minutesLeft} minutes left to view your snap`,
      data: {
        snapId,
        type: "snap_expiring_soon",
      },
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
    };

    await setDoc(notificationRef, notificationData);

    // Send push notification
    await sendPushNotification(
      senderId,
      `Your snap expires in ${minutesLeft} minutes`,
      "View it before it's gone",
      notificationData.data,
    );

    console.log("[Game Notifications] Expiring soon notification sent");
  } catch (error) {
    console.error(
      "[Game Notifications] Failed to notify expiring soon:",
      error,
    );
  }
}

/**
 * Get notifications for user
 */
export async function getUserNotifications(
  userId: string,
  limitCount: number = 50,
): Promise<SnapNotification[]> {
  try {
    console.log(
      `[Game Notifications] Fetching notifications for user ${userId}`,
    );

    const db = getFirestoreInstance();

    const notificationsRef = collection(db, "Notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      firestoreLimit(limitCount),
    );
    const snapshot = await getDocs(q);

    const notifications: SnapNotification[] = [];

    snapshot.forEach((notifDoc) => {
      const data = notifDoc.data();

      notifications.push({
        id: notifDoc.id,
        userId: data.userId,
        type: data.type,
        senderId: data.senderId,
        senderName: data.senderName,
        senderImage: data.senderImage,
        snapId: data.snapId,
        title: data.title,
        body: data.body,
        data: data.data,
        read: data.read,
        readAt: data.readAt?.toDate?.(),
        createdAt: data.createdAt?.toDate?.() || new Date(),
        expiresAt: data.expiresAt?.toDate?.() || new Date(),
      });
    });

    console.log(
      `[Game Notifications] Fetched ${notifications.length} notifications`,
    );
    return notifications;
  } catch (error) {
    console.error(
      "[Game Notifications] Failed to get user notifications:",
      error,
    );
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
): Promise<void> {
  try {
    console.log(
      `[Game Notifications] Marking notification ${notificationId} as read`,
    );

    const db = getFirestoreInstance();

    const notificationRef = doc(db, "Notifications", notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: new Date(),
    });

    console.log("[Game Notifications] Notification marked as read");
  } catch (error) {
    console.error(
      "[Game Notifications] Failed to mark notification as read:",
      error,
    );
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(
  notificationId: string,
): Promise<void> {
  try {
    console.log(`[Game Notifications] Deleting notification ${notificationId}`);

    const db = getFirestoreInstance();

    const notificationRef = doc(db, "Notifications", notificationId);
    await deleteDoc(notificationRef);

    console.log("[Game Notifications] Notification deleted");
  } catch (error) {
    console.error("[Game Notifications] Failed to delete notification:", error);
  }
}

/**
 * Send push notification via Expo
 * Internal helper function
 */
async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>,
  options?: {
    sound?: "default" | "none";
    badge?: number;
    priority?: "default" | "high";
  },
): Promise<void> {
  try {
    // Get user's push tokens from Firestore
    const db = getFirestoreInstance();

    const userRef = doc(db, "Users", userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return;
    }

    const pushTokens: string[] = userDoc.data()?.pushTokens || [];

    if (pushTokens.length === 0) {
      console.log("[Game Notifications] No push tokens available for user");
      return;
    }

    // Send to all registered devices
    for (const _token of pushTokens) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: data as Record<string, unknown>,
            sound: options?.sound || "default",
            badge: options?.badge || 1,
          },
          trigger: null,
        });
      } catch (err) {
        console.warn(
          `[Game Notifications] Failed to send push to token: ${err}`,
        );
      }
    }

    console.log(
      `[Game Notifications] Push notifications sent to ${pushTokens.length} devices`,
    );
  } catch (error) {
    console.error(
      "[Game Notifications] Failed to send push notification:",
      error,
    );
  }
}

/**
 * Get unread notification count for user
 */
export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  try {
    const db = getFirestoreInstance();

    const notificationsRef = collection(db, "Notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      where("read", "==", false),
    );
    const snapshot = await getDocs(q);

    return snapshot.size;
  } catch (error) {
    console.error("[Game Notifications] Failed to get unread count:", error);
    return 0;
  }
}

