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


import { createLogger } from "@/utils/log";
const logger = createLogger("services/snaps");
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
    logger.info(
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
    logger.info("🔵 [markSnapOpened] Deleting picture message document");
    await deleteDoc(messageDocRef);

    logger.info("✅ [markSnapOpened] Picture deleted after viewing");
  } catch (error: any) {
    logger.error("❌ [markSnapOpened] Error:", error);
    throw error;
  }
}
