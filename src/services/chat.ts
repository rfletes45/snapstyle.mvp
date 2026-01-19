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
  writeBatch,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";
import { updateStreak } from "./friends";
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

  try {
    const chatDoc = await getDoc(chatDocRef);

    if (!chatDoc.exists()) {
      // Create new chat
      await setDoc(chatDocRef, {
        members: [currentUid, otherUid].sort(),
        createdAt: Timestamp.now(),
        lastMessageText: "",
        lastMessageAt: Timestamp.now(),
      });
    }

    return chatId;
  } catch (error) {
    console.error("Error getting or creating chat:", error);
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
): Promise<void> {
  const db = getFirestoreInstance();

  try {
    // Create message document
    const messagesRef = collection(db, "Chats", chatId, "Messages");
    const newMessageRef = doc(messagesRef);

    const messageData = {
      chatId,
      sender,
      content,
      type: "text" as const,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(
        new Date().getTime() + 24 * 60 * 60 * 1000,
      ), // 24 hours
      read: false,
      readAt: null,
    };

    // Update message in subcollection
    await setDoc(newMessageRef, messageData);

    // Update chat's last message
    const chatDocRef = doc(db, "Chats", chatId);
    await updateDoc(chatDocRef, {
      lastMessageText: content.substring(0, 50),
      lastMessageAt: Timestamp.now(),
    });

    // Update streak for sender
    try {
      const friendshipId = generateChatId(sender, friendUid);
      await updateStreak(friendshipId, sender);
    } catch (streakError) {
      console.warn("Could not update streak:", streakError);
      // Don't fail the message send if streak update fails
    }
  } catch (error) {
    console.error("Error sending message:", error);
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
    );

    const snapshot = await getDocs(q);
    const chats = snapshot.docs.map((doc) => ({
      id: doc.id,
      members: doc.data().members,
      createdAt: doc.data().createdAt?.toMillis?.() || 0,
      lastMessageText: doc.data().lastMessageText,
      lastMessageAt: doc.data().lastMessageAt?.toMillis?.() || 0,
    }));

    // Sort by lastMessageAt descending (newest first)
    return chats.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
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

  try {
    const messagesRef = collection(db, "Chats", chatId, "Messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error subscribing to chat:", error);
    throw error;
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
