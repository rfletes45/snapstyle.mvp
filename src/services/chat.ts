import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  orderBy,
  getDoc,
  onSnapshot,
  Timestamp,
  deleteDoc,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { Chat, Message, MessageStatus } from "@/types/models";
import { updateStreakAfterMessage } from "./streakCosmetics";
import { hasBlockBetweenUsers } from "./blocking";

/** Default number of messages to load per page */
const DEFAULT_PAGE_SIZE = 25;

/** Cursor for pagination - stores last document snapshot */
let lastMessageCursor: QueryDocumentSnapshot<DocumentData> | null = null;

/**
 * Generate a deterministic chat ID from two user IDs
 */
function generateChatId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

/**
 * Get or create a chat between two users
 */
export async function getOrCreateChat(
  currentUid: string,
  otherUid: string,
): Promise<string> {
  const db = getFirestoreInstance();
  const chatId = generateChatId(currentUid, otherUid);
  const chatDocRef = doc(db, "Chats", chatId);

  console.log("🔵 [getOrCreateChat] Starting with:", {
    currentUid,
    otherUid,
    chatId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Check if there's a block between users
    const isBlocked = await hasBlockBetweenUsers(currentUid, otherUid);
    if (isBlocked) {
      console.log("❌ [getOrCreateChat] Cannot create chat - user is blocked");
      throw new Error("Cannot chat with this user");
    }

    console.log(
      "🔵 [getOrCreateChat] Attempting to get existing chat document...",
    );
    const chatDoc = await getDoc(chatDocRef);
    console.log(
      "✅ [getOrCreateChat] Successfully retrieved chat doc. Exists:",
      chatDoc.exists(),
    );

    if (!chatDoc.exists()) {
      console.log(
        "🔵 [getOrCreateChat] Chat doesn't exist. Creating new chat with members:",
        [currentUid, otherUid].sort(),
      );

      // Create new chat
      await setDoc(chatDocRef, {
        members: [currentUid, otherUid].sort(),
        createdAt: Timestamp.now(),
        lastMessageText: "",
        lastMessageAt: Timestamp.now(),
      });
      console.log(
        "✅ [getOrCreateChat] Successfully created new chat document",
      );
    } else {
      console.log("✅ [getOrCreateChat] Chat already exists");
    }

    console.log("✅ [getOrCreateChat] Returning chatId:", chatId);
    return chatId;
  } catch (error: any) {
    console.error("❌ [getOrCreateChat] ERROR:", {
      message: error.message,
      code: error.code,
      errorType: error.constructor.name,
      fullError: error,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Send a message to a chat
 * Returns milestone info if a streak milestone was reached
 */
export async function sendMessage(
  chatId: string,
  sender: string,
  content: string,
  friendUid: string,
  type: "text" | "image" = "text",
): Promise<{ milestoneReached?: number; streakCount?: number }> {
  const db = getFirestoreInstance();

  console.log("🔵 [sendMessage] Starting message send:", {
    chatId,
    sender,
    type,
    contentLength: content.length,
    friendUid,
    timestamp: new Date().toISOString(),
  });

  try {
    // Check if there's a block between users
    console.log("🔵 [sendMessage] Checking for blocks...");
    const isBlocked = await hasBlockBetweenUsers(sender, friendUid);
    console.log("✅ [sendMessage] Block check complete, isBlocked:", isBlocked);

    if (isBlocked) {
      console.log("❌ [sendMessage] Cannot send - user is blocked");
      throw new Error("Cannot send message to this user");
    }

    // Create message document
    console.log(
      "🔵 [sendMessage] Creating message reference for subcollection...",
    );
    const messagesRef = collection(db, "Chats", chatId, "Messages");
    const newMessageRef = doc(messagesRef);

    const messageData = {
      chatId,
      sender,
      content,
      type: type,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(
        new Date().getTime() + 24 * 60 * 60 * 1000,
      ), // 24 hours
      read: false,
      readAt: null,
    };

    // Update message in subcollection
    console.log(
      "🔵 [sendMessage] Writing message to Firestore subcollection...",
    );
    await setDoc(newMessageRef, messageData);
    console.log("✅ [sendMessage] Message written successfully");

    // Update chat's last message
    console.log("🔵 [sendMessage] Updating chat document with last message...");
    const chatDocRef = doc(db, "Chats", chatId);

    let previewText = content;
    if (type === "image") {
      previewText = "[Photo snap]";
    } else {
      previewText = content.substring(0, 50);
    }

    await updateDoc(chatDocRef, {
      lastMessageText: previewText,
      lastMessageAt: Timestamp.now(),
    });
    console.log("✅ [sendMessage] Chat document updated successfully");

    // Update streak and grant cosmetics if milestone reached
    // This runs client-side as a fallback if Cloud Functions aren't deployed
    try {
      const { newCount, milestoneReached } = await updateStreakAfterMessage(
        sender,
        friendUid,
      );
      if (milestoneReached) {
        console.log(
          `🎉 [sendMessage] Milestone reached! ${milestoneReached}-day streak!`,
        );
      }
      if (newCount > 0) {
        console.log(`🔥 [sendMessage] Current streak: ${newCount} days`);
      }

      console.log("✅ [sendMessage] Message send completed successfully");
      return {
        milestoneReached: milestoneReached || undefined,
        streakCount: newCount,
      };
    } catch (streakError) {
      console.error("⚠️ [sendMessage] Streak update error:", streakError);
      // Don't throw - message was sent successfully, streak is secondary
      return {};
    }
  } catch (error: any) {
    console.error("❌ [sendMessage] ERROR:", {
      message: error.message,
      code: error.code,
      errorType: error.constructor.name,
      chatId,
      sender,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Generate a temporary local message ID for optimistic updates
 */
function generateLocalMessageId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an optimistic local message (Phase 12)
 * Returns a Message object immediately for UI display while sending in background
 */
export function createOptimisticMessage(
  chatId: string,
  sender: string,
  content: string,
  type: "text" | "image" = "text",
): Message {
  const now = Date.now();
  return {
    id: generateLocalMessageId(),
    sender,
    type,
    content,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
    read: false,
    status: "sending",
    isLocal: true,
  };
}

/**
 * Send message with optimistic update support (Phase 12)
 * Returns both the local message (for immediate UI) and a promise for the result
 */
export function sendMessageOptimistic(
  chatId: string,
  sender: string,
  content: string,
  friendUid: string,
  type: "text" | "image" = "text",
): {
  localMessage: Message;
  sendPromise: Promise<{
    success: boolean;
    milestoneReached?: number;
    streakCount?: number;
    error?: string;
  }>;
} {
  // Create optimistic message immediately
  const localMessage = createOptimisticMessage(chatId, sender, content, type);

  // Send in background
  const sendPromise = sendMessage(chatId, sender, content, friendUid, type)
    .then((result) => ({
      success: true,
      milestoneReached: result.milestoneReached,
      streakCount: result.streakCount,
    }))
    .catch((error: any) => ({
      success: false,
      error: error.message || "Failed to send message",
    }));

  return { localMessage, sendPromise };
}

/**
 * Get all chats for a user, sorted by last message time
 */
export async function getUserChats(uid: string): Promise<Chat[]> {
  const db = getFirestoreInstance();

  try {
    const chatsRef = collection(db, "Chats");
    const q = query(
      chatsRef,
      where("members", "array-contains", uid),
      orderBy("lastMessageAt", "desc"),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      members: doc.data().members,
      createdAt: doc.data().createdAt?.toMillis?.() || 0,
      lastMessageText: doc.data().lastMessageText,
      lastMessageAt: doc.data().lastMessageAt?.toMillis?.() || 0,
    }));
  } catch (error) {
    console.error("Error getting user chats:", error);
    throw error;
  }
}

/**
 * Get all messages for a specific chat
 */
export async function getChatMessages(chatId: string): Promise<Message[]> {
  const db = getFirestoreInstance();

  try {
    const messagesRef = collection(db, "Chats", chatId, "Messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      chatId,
      sender: doc.data().sender,
      type: doc.data().type || "text",
      content: doc.data().content,
      createdAt: doc.data().createdAt?.toMillis?.() || 0,
      expiresAt:
        doc.data().expiresAt?.toMillis?.() || Date.now() + 24 * 60 * 60 * 1000,
      read: doc.data().read || false,
      readAt: doc.data().readAt?.toMillis?.() || undefined,
    }));
  } catch (error) {
    console.error("Error getting chat messages:", error);
    throw error;
  }
}

/**
 * Subscribe to real-time message updates for a chat
 * Returns unsubscribe function
 */
export function subscribeToChat(
  chatId: string,
  callback: (messages: Message[], hasMore: boolean) => void,
  messageLimit: number = DEFAULT_PAGE_SIZE,
): () => void {
  const db = getFirestoreInstance();

  console.log("🔵 [subscribeToChat] Setting up listener for chatId:", chatId);

  try {
    const messagesRef = collection(db, "Chats", chatId, "Messages");
    const q = query(
      messagesRef,
      orderBy("createdAt", "desc"),
      limit(messageLimit),
    );

    console.log("🔵 [subscribeToChat] Creating onSnapshot listener...");

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(
          "✅ [subscribeToChat] Received snapshot with",
          snapshot.docs.length,
          "messages",
        );

        // Store cursor for pagination (oldest message in current batch)
        if (snapshot.docs.length > 0) {
          lastMessageCursor = snapshot.docs[snapshot.docs.length - 1];
        }

        const messages: Message[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          chatId,
          sender: doc.data().sender,
          type: doc.data().type || "text",
          content: doc.data().content,
          createdAt: doc.data().createdAt?.toMillis?.() || 0,
          expiresAt:
            doc.data().expiresAt?.toMillis?.() ||
            Date.now() + 24 * 60 * 60 * 1000,
          read: doc.data().read || false,
          readAt: doc.data().readAt?.toMillis?.() || undefined,
          status: "sent" as MessageStatus, // Messages from Firestore are confirmed sent
        }));

        // Reverse to show oldest first in UI (we fetched newest first for limit)
        // Also determine if there might be more messages
        const hasMore = snapshot.docs.length >= messageLimit;
        callback(messages.reverse(), hasMore);
      },
      (error: any) => {
        console.error("❌ [subscribeToChat] ERROR in listener:", {
          message: error.message,
          code: error.code,
          errorType: error.constructor.name,
          chatId,
          timestamp: new Date().toISOString(),
        });
      },
    );

    console.log("✅ [subscribeToChat] Listener set up successfully");
    return unsubscribe;
  } catch (error: any) {
    console.error("❌ [subscribeToChat] ERROR setting up listener:", {
      message: error.message,
      code: error.code,
      errorType: error.constructor.name,
      chatId,
      timestamp: new Date().toISOString(),
    });
    return () => {};
  }
}

/**
 * Load older messages for pagination (Phase 12)
 * Uses cursor from last subscription snapshot
 * @returns Object with messages array and hasMore flag
 */
export async function loadOlderMessages(
  chatId: string,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const db = getFirestoreInstance();

  console.log("🔵 [loadOlderMessages] Loading older messages for:", chatId);

  if (!lastMessageCursor) {
    console.log("ℹ️ [loadOlderMessages] No cursor available, returning empty");
    return { messages: [], hasMore: false };
  }

  try {
    const messagesRef = collection(db, "Chats", chatId, "Messages");
    const q = query(
      messagesRef,
      orderBy("createdAt", "desc"),
      startAfter(lastMessageCursor),
      limit(pageSize),
    );

    const snapshot = await getDocs(q);
    console.log(
      "✅ [loadOlderMessages] Loaded",
      snapshot.docs.length,
      "older messages",
    );

    // Update cursor for next pagination
    if (snapshot.docs.length > 0) {
      lastMessageCursor = snapshot.docs[snapshot.docs.length - 1];
    }

    const messages: Message[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      chatId,
      sender: doc.data().sender,
      type: doc.data().type || "text",
      content: doc.data().content,
      createdAt: doc.data().createdAt?.toMillis?.() || 0,
      expiresAt:
        doc.data().expiresAt?.toMillis?.() || Date.now() + 24 * 60 * 60 * 1000,
      read: doc.data().read || false,
      readAt: doc.data().readAt?.toMillis?.() || undefined,
      status: "sent" as MessageStatus,
    }));

    // Return in chronological order (oldest first)
    const hasMore = snapshot.docs.length >= pageSize;
    return { messages: messages.reverse(), hasMore };
  } catch (error: any) {
    console.error("❌ [loadOlderMessages] Error:", error);
    return { messages: [], hasMore: false };
  }
}

/**
 * Reset pagination cursor (call when switching chats)
 */
export function resetPaginationCursor(): void {
  lastMessageCursor = null;
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead(
  chatId: string,
  messageId: string,
): Promise<void> {
  const db = getFirestoreInstance();

  try {
    const messageDocRef = doc(db, "Chats", chatId, "Messages", messageId);
    await updateDoc(messageDocRef, {
      read: true,
      readAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error marking message as read:", error);
    throw error;
  }
}

/**
 * Get chat with a specific friend
 */
export async function getChatWithFriend(
  currentUid: string,
  friendUid: string,
): Promise<Chat | null> {
  const db = getFirestoreInstance();
  const chatId = generateChatId(currentUid, friendUid);

  try {
    const chatDocRef = doc(db, "Chats", chatId);
    const chatDoc = await getDoc(chatDocRef);

    if (!chatDoc.exists()) {
      return null;
    }

    return {
      id: chatDoc.id,
      members: chatDoc.data().members,
      createdAt: chatDoc.data().createdAt?.toMillis?.() || 0,
      lastMessageText: chatDoc.data().lastMessageText,
      lastMessageAt: chatDoc.data().lastMessageAt?.toMillis?.() || 0,
    };
  } catch (error) {
    console.error("Error getting chat with friend:", error);
    throw error;
  }
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(
  chatId: string,
  messageId: string,
): Promise<void> {
  const db = getFirestoreInstance();

  try {
    const messageDocRef = doc(db, "Chats", chatId, "Messages", messageId);
    await updateDoc(messageDocRef, {
      content: "[deleted]",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
}

/**
 * Mark snap as opened and delete message document (view-once flow)
 * Records opening metadata and immediately deletes the message doc
 */
export async function markSnapOpened(
  chatId: string,
  messageId: string,
  openedBy: string,
): Promise<void> {
  const db = getFirestoreInstance();

  try {
    const messageDocRef = doc(db, "Chats", chatId, "Messages", messageId);

    // Update with opening metadata
    console.log(
      "🔵 [markSnapOpened] Marking snap as opened:",
      messageId,
      "by:",
      openedBy,
    );
    await updateDoc(messageDocRef, {
      openedAt: Timestamp.now(),
      openedBy: openedBy,
    });

    // Immediately delete the message document (view-once)
    console.log("🔵 [markSnapOpened] Deleting snap message document");
    await deleteDoc(messageDocRef);

    console.log("✅ [markSnapOpened] Snap deleted after viewing");
  } catch (error: any) {
    console.error("❌ [markSnapOpened] Error:", error);
    throw error;
  }
}
