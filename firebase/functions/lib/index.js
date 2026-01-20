"use strict";
/**
 * SnapStyle Cloud Functions
 * Handles:
 * - Automatic Storage cleanup when messages are deleted
 * - Push notifications (future phases)
 * - Streak management (future phases)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredSnaps = exports.onDeleteMessage = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
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
exports.onDeleteMessage = functions.firestore
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
    }
    catch (error) {
        // File may already be deleted or not exist; only log non-404 errors
        if (error.code !== "storage/object-not-found" && error.code !== 404) {
            console.error(`⚠️ Error deleting storage file ${storagePath}:`, error.message);
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
exports.cleanupExpiredSnaps = functions.pubsub
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
                }
                catch (error) {
                    if (error.code !== 404 &&
                        error.code !== "storage/object-not-found") {
                        console.warn(`Failed to delete snap ${message.content}:`, error.message);
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
        console.log(`✅ Cleanup complete: ${deletedCount} expired messages removed`);
        return;
    }
    catch (error) {
        console.error("❌ Error in cleanupExpiredSnaps:", error);
        throw error;
    }
});
//# sourceMappingURL=index.js.map