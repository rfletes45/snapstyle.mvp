import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { hasBlockBetweenUsers } from "./blocking";
import { getFirestoreInstance } from "./firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/chat");
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
    // Check if there's a block between users
    const isBlocked = await hasBlockBetweenUsers(currentUid, otherUid);
    if (isBlocked) {
      throw new Error("Cannot chat with this user");
    }

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
    logger.error("[getOrCreateChat] Error:", error);
    throw error;
  }
}
