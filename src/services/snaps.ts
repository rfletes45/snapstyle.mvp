/**
 * Snaps Service
 *
 * Handles view-once snap message operations.
 * Extracted from chat.ts for cleaner separation of concerns.
 *
 * @module services/snaps
 */

import { deleteDoc, doc, Timestamp, updateDoc } from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

/**
 * Mark snap as opened and delete message document (view-once flow)
 * Records opening metadata and immediately deletes the message doc
 *
 * @param chatId - The chat ID containing the snap
 * @param messageId - The message ID of the snap
 * @param openedBy - The UID of the user opening the snap
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
