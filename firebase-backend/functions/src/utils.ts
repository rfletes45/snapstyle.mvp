import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Validate that a string is safe (non-empty, reasonable length, no control chars)
 */
export function isValidString(
  value: unknown,
  minLen = 1,
  maxLen = 1000,
): value is string {
  if (typeof value !== "string") return false;
  if (value.length < minLen || value.length > maxLen) return false;
  // Reject control characters (except newlines/tabs for content)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) return false;
  return true;
}

/**
 * Validate that a value is a valid Firebase UID
 */
export function isValidUid(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // Firebase UIDs are typically 20-128 chars, alphanumeric
  return (
    value.length >= 20 && value.length <= 128 && /^[a-zA-Z0-9]+$/.test(value)
  );
}

/**
 * Sanitize string for logging (truncate, remove newlines)
 */
export function sanitizeForLog(value: string, maxLen = 100): string {
  const truncated =
    value.length > maxLen ? value.slice(0, maxLen) + "..." : value;
  return truncated.replace(/[\r\n]+/g, " ");
}

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

/**
 * Send push notification via Expo's push service
 */
export async function sendExpoPushNotification(
  message: ExpoPushMessage,
): Promise<void> {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("Push notification result:", result);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

/**
 * Get user's Expo Push Token from Firestore
 */
export async function getUserPushToken(userId: string): Promise<string | null> {
  try {
    const userDoc = await db.collection("Users").doc(userId).get();
    if (!userDoc.exists) return null;
    return userDoc.data()?.expoPushToken || null;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

/**
 * Check if user has muted a DM chat
 * Uses the MembersPrivate subcollection of Chats
 */
export async function isDmChatMuted(
  chatId: string,
  userId: string,
): Promise<boolean> {
  try {
    const memberPrivateDoc = await db
      .collection("Chats")
      .doc(chatId)
      .collection("MembersPrivate")
      .doc(userId)
      .get();

    if (!memberPrivateDoc.exists) {
      return false;
    }

    const data = memberPrivateDoc.data();
    const mutedUntil = data?.mutedUntil;

    if (!mutedUntil) {
      return false;
    }

    if (mutedUntil === -1) {
      return true;
    }

    return mutedUntil > Date.now();
  } catch (error) {
    console.error("Error checking DM mute status:", error);
    return false;
  }
}

/**
 * Check if user has muted a Group chat
 * Uses GroupMembers collection with mute settings
 */
export async function isGroupChatMuted(
  groupId: string,
  userId: string,
): Promise<boolean> {
  try {
    const memberPrivateDoc = await db
      .collection("Groups")
      .doc(groupId)
      .collection("MembersPrivate")
      .doc(userId)
      .get();

    if (!memberPrivateDoc.exists) {
      return false;
    }

    const data = memberPrivateDoc.data();
    const mutedUntil = data?.mutedUntil;

    if (!mutedUntil) {
      return false;
    }

    if (mutedUntil === -1) {
      return true;
    }

    return mutedUntil > Date.now();
  } catch (error) {
    console.error("Error checking group mute status:", error);
    return false;
  }
}

export const isGroupMuted = isGroupChatMuted;
