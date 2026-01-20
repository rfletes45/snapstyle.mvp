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
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { updateStreak, getFriendshipId } from "./friends";
import { Chat, Message } from "@/types/models";

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
 */
export async function sendMessage(
  chatId: string,
  sender: string,
  content: string,
  friendUid: string,
  type: "text" | "image" = "text",
): Promise<void> {
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

    // Update streak for sender
    try {
      console.log("🔵 [sendMessage] Attempting to update streak...");
      const friendshipId = await getFriendshipId(sender, friendUid);
      if (!friendshipId) {
        console.warn(
          "⚠️ [sendMessage] Friendship not found - cannot update streak",
        );
      } else {
        await updateStreak(friendshipId, sender);
        console.log("✅ [sendMessage] Streak updated successfully");
      }
    } catch (streakError) {
      console.warn("⚠️ [sendMessage] Could not update streak:", streakError);
      // Don't fail the message send if streak update fails
    }

    console.log("✅ [sendMessage] Message send completed successfully");
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
  callback: (messages: Message[]) => void,
): () => void {
  const db = getFirestoreInstance();

  console.log("🔵 [subscribeToChat] Setting up listener for chatId:", chatId);

  try {
    const messagesRef = collection(db, "Chats", chatId, "Messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    console.log("🔵 [subscribeToChat] Creating onSnapshot listener...");

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(
          "✅ [subscribeToChat] Received snapshot with",
          snapshot.docs.length,
          "messages",
        );
        const messages = snapshot.docs.map((doc) => ({
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
        }));

        callback(messages);
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
