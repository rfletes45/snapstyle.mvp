/**
 * Scheduled Messages Service
 *
 * Handles:
 * - Creating scheduled messages
 * - Listing scheduled messages
 * - Cancelling scheduled messages
 * - Updating scheduled messages
 * - Real-time subscription to scheduled messages
 */

import { ScheduledMessage, ScheduledMessageStatus } from "@/types/models";
import { generateId } from "@/utils/ids";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

// =============================================================================
// Constants
// =============================================================================

/** Minimum time in future to schedule (5 minutes) */
const MIN_SCHEDULE_DELAY_MS = 5 * 60 * 1000;

/** Maximum time in future to schedule (30 days) */
const MAX_SCHEDULE_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

// =============================================================================
// Create Scheduled Message
// =============================================================================

export interface CreateScheduledMessageInput {
  senderId: string;
  recipientId?: string; // Required for DM, not used for groups
  chatId: string; // chatId for DM, groupId for groups
  scope: "dm" | "group";
  content: string;
  type: "text" | "image";
  scheduledFor: Date;
  mentionUids?: string[]; // Mentioned users (groups only)
}

/**
 * Schedule a message to be sent at a future time
 * @returns The created scheduled message, or null if validation fails
 */
export async function scheduleMessage(
  input: CreateScheduledMessageInput,
): Promise<ScheduledMessage | null> {
  const db = getFirestoreInstance();

  try {
    const {
      senderId,
      recipientId,
      chatId,
      scope,
      content,
      type,
      scheduledFor,
      mentionUids,
    } = input;

    // Validate scope-specific requirements
    if (scope === "dm" && !recipientId) {
      console.error("[scheduledMessages] recipientId required for DM scope.");
      return null;
    }

    // Validate scheduled time
    const now = Date.now();
    const scheduledTime = scheduledFor.getTime();
    const delay = scheduledTime - now;

    if (delay < MIN_SCHEDULE_DELAY_MS) {
      console.error(
        "[scheduledMessages] Scheduled time too soon. Must be at least 5 minutes in future.",
      );
      return null;
    }

    if (delay > MAX_SCHEDULE_DELAY_MS) {
      console.error(
        "[scheduledMessages] Scheduled time too far. Must be within 30 days.",
      );
      return null;
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      console.error("[scheduledMessages] Content cannot be empty.");
      return null;
    }

    if (content.length > 2000) {
      console.error(
        "[scheduledMessages] Content too long. Max 2000 characters.",
      );
      return null;
    }

    // Create the scheduled message
    const messageId = generateId();
    const scheduledMessage: ScheduledMessage = {
      id: messageId,
      senderId,
      ...(scope === "dm" && recipientId ? { recipientId } : {}),
      chatId,
      scope,
      content,
      type,
      scheduledFor: scheduledTime,
      createdAt: now,
      status: "pending",
      ...(mentionUids && mentionUids.length > 0 ? { mentionUids } : {}),
    };

    // Write to Firestore with Timestamp
    const messageRef = doc(db, "ScheduledMessages", messageId);
    await setDoc(messageRef, {
      ...scheduledMessage,
      scheduledFor: Timestamp.fromMillis(scheduledTime),
      createdAt: Timestamp.now(),
    });

    console.log(
      "[scheduledMessages] Created scheduled message:",
      messageId,
      "for",
      scheduledFor.toISOString(),
    );

    return scheduledMessage;
  } catch (error) {
    console.error("[scheduledMessages] Error scheduling message:", error);
    return null;
  }
}

// =============================================================================
// Get Scheduled Messages
// =============================================================================

/**
 * Get all scheduled messages for a user (as sender)
 * @param userId The user's UID
 * @param status Optional status filter
 */
export async function getScheduledMessages(
  userId: string,
  status?: ScheduledMessageStatus,
): Promise<ScheduledMessage[]> {
  const db = getFirestoreInstance();

  try {
    const messagesRef = collection(db, "ScheduledMessages");
    let q;

    if (status) {
      q = query(
        messagesRef,
        where("senderId", "==", userId),
        where("status", "==", status),
        orderBy("scheduledFor", "asc"),
      );
    } else {
      q = query(
        messagesRef,
        where("senderId", "==", userId),
        orderBy("scheduledFor", "asc"),
      );
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        senderId: data.senderId,
        recipientId: data.recipientId,
        chatId: data.chatId,
        scope: data.scope || "dm", // Default to dm for backwards compatibility
        content: data.content,
        type: data.type,
        scheduledFor: data.scheduledFor?.toMillis?.() || data.scheduledFor,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        status: data.status,
        sentAt: data.sentAt?.toMillis?.() || data.sentAt,
        failReason: data.failReason,
        mentionUids: data.mentionUids,
      } as ScheduledMessage;
    });
  } catch (error) {
    console.error(
      "[scheduledMessages] Error fetching scheduled messages:",
      error,
    );
    return [];
  }
}

/**
 * Get scheduled messages for a specific chat
 */
export async function getScheduledMessagesForChat(
  userId: string,
  chatId: string,
): Promise<ScheduledMessage[]> {
  const db = getFirestoreInstance();

  try {
    const messagesRef = collection(db, "ScheduledMessages");
    const q = query(
      messagesRef,
      where("senderId", "==", userId),
      where("chatId", "==", chatId),
      where("status", "==", "pending"),
      orderBy("scheduledFor", "asc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        senderId: data.senderId,
        recipientId: data.recipientId,
        chatId: data.chatId,
        scope: data.scope || "dm", // Default to dm for backwards compatibility
        content: data.content,
        type: data.type,
        scheduledFor: data.scheduledFor?.toMillis?.() || data.scheduledFor,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        status: data.status,
        mentionUids: data.mentionUids,
      } as ScheduledMessage;
    });
  } catch (error) {
    console.error(
      "[scheduledMessages] Error fetching chat scheduled messages:",
      error,
    );
    return [];
  }
}

// =============================================================================
// Update Scheduled Message
// =============================================================================

/**
 * Cancel a scheduled message
 */
export async function cancelScheduledMessage(
  messageId: string,
  userId: string,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    console.log(
      "[scheduledMessages] Attempting to cancel message:",
      messageId,
      "for user:",
      userId,
    );
    const messageRef = doc(db, "ScheduledMessages", messageId);
    const messageDoc = await getDoc(messageRef);

    if (!messageDoc.exists()) {
      const error = "Message not found";
      console.error("[scheduledMessages]", error, messageId);
      throw new Error(error);
    }

    const data = messageDoc.data();
    console.log("[scheduledMessages] Message data:", {
      senderId: data.senderId,
      status: data.status,
    });

    // Verify ownership
    if (data.senderId !== userId) {
      const error = "User doesn't own this message";
      console.error("[scheduledMessages]", error);
      throw new Error(error);
    }

    // Can only cancel pending messages
    if (data.status !== "pending") {
      const error = "Can only cancel pending messages";
      console.error(
        "[scheduledMessages]",
        error,
        "Current status:",
        data.status,
      );
      throw new Error(error);
    }

    console.log("[scheduledMessages] Updating status to cancelled...");
    await updateDoc(messageRef, {
      status: "cancelled",
    });

    console.log(
      "[scheduledMessages] Successfully cancelled message:",
      messageId,
    );
    return true;
  } catch (error) {
    console.error("[scheduledMessages] Error cancelling message:", error);
    throw error;
  }
}

/**
 * Update the content of a scheduled message
 */
export async function updateScheduledMessageContent(
  messageId: string,
  userId: string,
  newContent: string,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    if (!newContent || newContent.trim().length === 0) {
      console.error("[scheduledMessages] Content cannot be empty");
      return false;
    }

    if (newContent.length > 2000) {
      console.error("[scheduledMessages] Content too long");
      return false;
    }

    const messageRef = doc(db, "ScheduledMessages", messageId);
    const messageDoc = await getDoc(messageRef);

    if (!messageDoc.exists()) {
      console.error("[scheduledMessages] Message not found:", messageId);
      return false;
    }

    const data = messageDoc.data();

    // Verify ownership
    if (data.senderId !== userId) {
      console.error("[scheduledMessages] User doesn't own this message");
      return false;
    }

    // Can only update pending messages
    if (data.status !== "pending") {
      console.error("[scheduledMessages] Can only update pending messages");
      return false;
    }

    await updateDoc(messageRef, {
      content: newContent,
    });

    console.log("[scheduledMessages] Updated message content:", messageId);
    return true;
  } catch (error) {
    console.error("[scheduledMessages] Error updating message:", error);
    return false;
  }
}

/**
 * Update the scheduled time of a message
 */
export async function updateScheduledMessageTime(
  messageId: string,
  userId: string,
  newScheduledFor: Date,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    // Validate new time
    const now = Date.now();
    const scheduledTime = newScheduledFor.getTime();
    const delay = scheduledTime - now;

    if (delay < MIN_SCHEDULE_DELAY_MS) {
      console.error("[scheduledMessages] New time too soon");
      return false;
    }

    if (delay > MAX_SCHEDULE_DELAY_MS) {
      console.error("[scheduledMessages] New time too far");
      return false;
    }

    const messageRef = doc(db, "ScheduledMessages", messageId);
    const messageDoc = await getDoc(messageRef);

    if (!messageDoc.exists()) {
      console.error("[scheduledMessages] Message not found:", messageId);
      return false;
    }

    const data = messageDoc.data();

    // Verify ownership
    if (data.senderId !== userId) {
      console.error("[scheduledMessages] User doesn't own this message");
      return false;
    }

    // Can only update pending messages
    if (data.status !== "pending") {
      console.error("[scheduledMessages] Can only update pending messages");
      return false;
    }

    await updateDoc(messageRef, {
      scheduledFor: Timestamp.fromMillis(scheduledTime),
    });

    console.log("[scheduledMessages] Updated message time:", messageId);
    return true;
  } catch (error) {
    console.error("[scheduledMessages] Error updating message time:", error);
    return false;
  }
}

/**
 * Delete a scheduled message entirely
 */
export async function deleteScheduledMessage(
  messageId: string,
  userId: string,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    console.log(
      "[scheduledMessages] Attempting to delete message:",
      messageId,
      "for user:",
      userId,
    );
    const messageRef = doc(db, "ScheduledMessages", messageId);
    const messageDoc = await getDoc(messageRef);

    if (!messageDoc.exists()) {
      const error = "Message not found";
      console.error("[scheduledMessages]", error, messageId);
      throw new Error(error);
    }

    const data = messageDoc.data();
    console.log("[scheduledMessages] Message data:", {
      senderId: data.senderId,
      status: data.status,
    });

    // Verify ownership
    if (data.senderId !== userId) {
      const error = "User doesn't own this message";
      console.error("[scheduledMessages]", error);
      throw new Error(error);
    }

    console.log("[scheduledMessages] Deleting message...");
    await deleteDoc(messageRef);

    console.log("[scheduledMessages] Successfully deleted message:", messageId);
    return true;
  } catch (error) {
    console.error("[scheduledMessages] Error deleting message:", error);
    throw error;
  }
}

// =============================================================================
// Real-time Subscription
// =============================================================================

/**
 * Subscribe to real-time updates of user's scheduled messages
 * @returns Unsubscribe function
 */
export function subscribeToScheduledMessages(
  userId: string,
  callback: (messages: ScheduledMessage[]) => void,
): () => void {
  const db = getFirestoreInstance();
  const messagesRef = collection(db, "ScheduledMessages");

  const q = query(
    messagesRef,
    where("senderId", "==", userId),
    where("status", "==", "pending"),
    orderBy("scheduledFor", "asc"),
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const messages: ScheduledMessage[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          senderId: data.senderId,
          recipientId: data.recipientId,
          chatId: data.chatId,
          content: data.content,
          type: data.type,
          scheduledFor: data.scheduledFor?.toMillis?.() || data.scheduledFor,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt,
          status: data.status,
        } as ScheduledMessage;
      });
      callback(messages);
    },
    (error) => {
      console.error("[scheduledMessages] Subscription error:", error);
      callback([]);
    },
  );

  return unsubscribe;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get a human-readable time until scheduled delivery
 */
export function getTimeUntilDelivery(scheduledFor: number): string {
  const now = Date.now();
  const diff = scheduledFor - now;

  if (diff <= 0) {
    return "Sending soon...";
  }

  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (days > 0) {
    return `in ${days} day${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `in ${hours} hour${hours > 1 ? "s" : ""}`;
  }
  if (minutes > 0) {
    return `in ${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
  return "in less than a minute";
}

/**
 * Format scheduled time for display
 */
export function formatScheduledTime(scheduledFor: number): string {
  const date = new Date(scheduledFor);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) {
    return `Today at ${timeStr}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  return `${dateStr} at ${timeStr}`;
}

/**
 * Get count of pending scheduled messages
 */
export async function getPendingScheduledCount(
  userId: string,
): Promise<number> {
  const messages = await getScheduledMessages(userId, "pending");
  return messages.length;
}
