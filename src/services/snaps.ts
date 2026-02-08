/**
 * Snaps Service
 *
 * Handles view-once picture message operations.
 * Extracted from chat.ts for cleaner separation of concerns.
 *
 * @module services/snaps
 */

import { deleteDoc, doc, Timestamp, updateDoc } from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

/**
 * Mark picture as opened and delete message document (view-once flow)
 * Records opening metadata and immediately deletes the message doc
 *
 * @param chatId - The chat ID containing the picture
 * @param messageId - The message ID of the picture
 * @param openedBy - The UID of the user opening the picture
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
      "🔵 [markSnapOpened] Marking picture as opened:",
      messageId,
      "by:",
      openedBy,
    );
    await updateDoc(messageDocRef, {
      openedAt: Timestamp.now(),
      openedBy: openedBy,
    });

    // Immediately delete the message document (view-once)
    console.log("🔵 [markSnapOpened] Deleting picture message document");
    await deleteDoc(messageDocRef);

    console.log("✅ [markSnapOpened] Picture deleted after viewing");
  } catch (error: any) {
    console.error("❌ [markSnapOpened] Error:", error);
    throw error;
  }
}
