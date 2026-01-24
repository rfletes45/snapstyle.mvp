import { Chat } from "@/types/models";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { hasBlockBetweenUsers } from "./blocking";
import { getFirestoreInstance } from "./firebase";

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
