/**
 * SnapStyle Cloud Functions
 * Handles:
 * - Automatic Storage cleanup when messages are deleted (Phase 4)
 * - Story auto-expiry and cleanup (Phase 5)
 * - Push notifications (Phase 6+)
 * - Streak management (Phase 6+)
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

/**
 * onDeleteMessage: Triggered when a message document is deleted
 * Cleans up associated Storage object if it's an image snap
 *
 * This provides redundant cleanup for snaps deleted via view-once flow
 * If the client-side deletion fails, this Cloud Function ensures cleanup
 */
export const onDeleteMessage = functions.firestore
  .document("Chats/{chatId}/Messages/{messageId}")
  .onDelete(async (snap, context) => {
    const message = snap.data();
    const { chatId } = context.params;

    // Only process image messages (snaps)
    if (message.type !== "image") {
      return;
    }

    const storagePath = message.content; // e.g., "snaps/chatId/messageId.jpg"

    try {
      // Delete the Storage file
      const bucket = storage.bucket();
      await bucket.file(storagePath).delete();
      console.log(`✅ Deleted storage file: ${storagePath}`);
    } catch (error: any) {
      // File may already be deleted or not exist; only log non-404 errors
      if (error.code !== "storage/object-not-found" && error.code !== 404) {
        console.error(
          `⚠️ Error deleting storage file ${storagePath}:`,
          error.message,
        );
      }
    }
  });

/**
 * cleanupExpiredSnaps: Scheduled function to clean up expired snaps from Storage
 * Runs daily to remove any snaps that weren't deleted by TTL
 *
 * This is a safety net for snaps that:
 * - Weren't viewed (message TTL expires, but Storage file may persist)
 * - Failed to delete due to errors
 *
 * Future enhancement: Query Messages with expiresAt < now and delete their storage
 */
export const cleanupExpiredSnaps = functions.pubsub
  .schedule("0 2 * * *") // 2 AM UTC daily
  .timeZone("UTC")
  .onRun(async () => {
    try {
      // Query all messages with expiresAt in the past
      const now = admin.firestore.Timestamp.now();
      const messagesRef = db.collectionGroup("Messages");
      const expiredQuery = await messagesRef.where("expiresAt", "<", now).get();

      console.log(`Found ${expiredQuery.docs.length} expired messages`);

      // Batch delete expired messages and their storage files
      const batch = db.batch();
      let deletedCount = 0;

      for (const doc of expiredQuery.docs) {
        const message = doc.data();

        // If it's an image snap, delete the Storage file
        if (message.type === "image" && message.content) {
          try {
            const bucket = storage.bucket();
            await bucket.file(message.content).delete();
            console.log(`Deleted expired snap: ${message.content}`);
          } catch (error: any) {
            if (
              error.code !== 404 &&
              error.code !== "storage/object-not-found"
            ) {
              console.warn(
                `Failed to delete snap ${message.content}:`,
                error.message,
              );
            }
          }
        }

        // Delete the message document
        batch.delete(doc.ref);
        deletedCount++;

        // Firestore batch write limit is 500
        if (deletedCount % 500 === 0) {
          await batch.commit();
          console.log(`Committed batch of 500 deletes`);
        }
      }

      // Final commit
      if (deletedCount % 500 !== 0) {
        await batch.commit();
      }

      console.log(
        `✅ Cleanup complete: ${deletedCount} expired messages removed`,
      );
      return;
    } catch (error: any) {
      console.error("❌ Error in cleanupExpiredSnaps:", error);
      throw error;
    }
  });

/**
 * cleanupExpiredStories: Scheduled function to clean up expired stories
 * Runs daily at 2 AM UTC to remove stories past their 24h expiry
 *
 * For each expired story:
 * - Delete the storage file from Storage
 * - Delete the story document (views subcollection auto-deletes)
 *
 * This ensures stories expire even if TTL index isn't active
 */
export const cleanupExpiredStories = functions.pubsub
  .schedule("0 2 * * *") // 2 AM UTC daily (same as snap cleanup)
  .timeZone("UTC")
  .onRun(async () => {
    try {
      // Query all stories with expiresAt in the past
      const now = admin.firestore.Timestamp.now();
      const storiesRef = db.collection("stories");
      const expiredQuery = await storiesRef.where("expiresAt", "<", now).get();

      console.log(`Found ${expiredQuery.docs.length} expired stories`);

      const bucket = storage.bucket();
      let deletedCount = 0;

      // Process each expired story
      for (const doc of expiredQuery.docs) {
        const story = doc.data();
        const storagePath = story.storagePath; // e.g., "stories/authorId/storyId.jpg"

        try {
          // Delete the Storage file
          await bucket.file(storagePath).delete();
          console.log(`✅ Deleted expired story storage: ${storagePath}`);
        } catch (error: any) {
          // File may already be deleted; only log real errors
          if (error.code !== 404 && error.code !== "storage/object-not-found") {
            console.warn(
              `⚠️ Failed to delete story storage ${storagePath}:`,
              error.message,
            );
          }
        }

        // Delete the story document (views subcollection auto-deletes)
        await doc.ref.delete();
        deletedCount++;

        console.log(`✅ Deleted expired story document: ${doc.id}`);
      }

      console.log(
        `✅ Story cleanup complete: ${deletedCount} expired stories removed`,
      );
      return;
    } catch (error: any) {
      console.error("❌ Error in cleanupExpiredStories:", error);
      throw error;
    }
  });
