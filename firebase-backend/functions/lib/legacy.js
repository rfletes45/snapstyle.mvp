"use strict";
/**
 * SnapStyle Cloud Functions
 * Handles:
 * - Automatic Storage cleanup when messages are deleted
 * - Story auto-expiry and cleanup
 * - Push notifications
 * - Streak management
 * - V2 Messaging with idempotent sends
 *
 * Security Note:
 * - All onCall functions require authentication via context.auth
 * - Admin functions verify context.auth.token.admin claim
 * - Input validation is performed on all user-supplied data
 * - Structured logging includes context for debugging/audit
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
exports.initializeFirstAdmin = exports.adminSetAdminClaim = exports.adminResolveReport = exports.adminApplyWarning = exports.adminApplyStrike = exports.adminLiftBan = exports.adminSetBan = exports.cleanupExpiredPushTokens = exports.checkMessageRateLimit = exports.sendFriendRequestWithRateLimit = exports.seedShopCatalog = exports.initializeExistingWallets = exports.seedMonthlyTasks = exports.seedDailyTasks = exports.recordDailyLogin = exports.onFriendAddedTaskProgress = exports.onStoryPostedTaskProgress = exports.onStoryViewedTaskProgress = exports.onMessageSentTaskProgress = exports.claimTaskReward = exports.onUserCreated = exports.cleanupOldScheduledMessages = exports.onScheduledMessageCreated = exports.processScheduledMessages = exports.cleanupExpiredStories = exports.cleanupExpiredSnaps = exports.onDeleteMessage = exports.onStoryViewed = exports.onCallUpdated = exports.onCallCreated = exports.handleCallTimeouts = exports.getTurnCredentials = exports.cleanupCallSignaling = exports.triggerDailyDeals = exports.generateWeeklyDeals = exports.generateDailyDeals = exports.cleanupOldDeals = exports.sendGift = exports.openGift = exports.getGiftHistory = exports.expireGifts = exports.validateReceipt = exports.restorePurchases = exports.getPurchaseHistory = exports.purchaseWithTokens = exports.grantItem = exports.toggleReactionV2 = exports.deleteMessageForAllV2 = exports.editMessageV2 = exports.sendMessageV2 = void 0;
exports.fetchLinkPreview = exports.updateExpiredBans = exports.onNewReport = exports.onNewMessageEvent = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const httpAuth_1 = require("./httpAuth");
// Import V2 Messaging functions
const messaging_1 = require("./messaging");
// Import Shop functions
const shop_1 = require("./shop");
Object.defineProperty(exports, "grantItem", { enumerable: true, get: function () { return shop_1.grantItem; } });
Object.defineProperty(exports, "purchaseWithTokens", { enumerable: true, get: function () { return shop_1.purchaseWithTokens; } });
// Import IAP functions
const iap_1 = require("./iap");
Object.defineProperty(exports, "getPurchaseHistory", { enumerable: true, get: function () { return iap_1.getPurchaseHistory; } });
Object.defineProperty(exports, "restorePurchases", { enumerable: true, get: function () { return iap_1.restorePurchases; } });
Object.defineProperty(exports, "validateReceipt", { enumerable: true, get: function () { return iap_1.validateReceipt; } });
// Import Gifting functions (Phase 4)
const gifting_1 = require("./gifting");
Object.defineProperty(exports, "expireGifts", { enumerable: true, get: function () { return gifting_1.expireGifts; } });
Object.defineProperty(exports, "getGiftHistory", { enumerable: true, get: function () { return gifting_1.getGiftHistory; } });
Object.defineProperty(exports, "openGift", { enumerable: true, get: function () { return gifting_1.openGift; } });
Object.defineProperty(exports, "sendGift", { enumerable: true, get: function () { return gifting_1.sendGift; } });
// Import Daily Deals functions (Phase 4)
const dailyDeals_1 = require("./dailyDeals");
Object.defineProperty(exports, "cleanupOldDeals", { enumerable: true, get: function () { return dailyDeals_1.cleanupOldDeals; } });
Object.defineProperty(exports, "generateDailyDeals", { enumerable: true, get: function () { return dailyDeals_1.generateDailyDeals; } });
Object.defineProperty(exports, "generateWeeklyDeals", { enumerable: true, get: function () { return dailyDeals_1.generateWeeklyDeals; } });
Object.defineProperty(exports, "triggerDailyDeals", { enumerable: true, get: function () { return dailyDeals_1.triggerDailyDeals; } });
// Import Call functions (Voice/Video Calling)
const calls_1 = require("./calls");
Object.defineProperty(exports, "cleanupCallSignaling", { enumerable: true, get: function () { return calls_1.cleanupCallSignaling; } });
Object.defineProperty(exports, "getTurnCredentials", { enumerable: true, get: function () { return calls_1.getTurnCredentials; } });
Object.defineProperty(exports, "handleCallTimeouts", { enumerable: true, get: function () { return calls_1.handleCallTimeouts; } });
Object.defineProperty(exports, "onCallCreated", { enumerable: true, get: function () { return calls_1.onCallCreated; } });
Object.defineProperty(exports, "onCallUpdated", { enumerable: true, get: function () { return calls_1.onCallUpdated; } });
// Import Link Preview function
const linkPreview_1 = require("./linkPreview");
const utils_1 = require("./utils");
// Re-export V2 Messaging functions
exports.sendMessageV2 = messaging_1.sendMessageV2Function;
exports.editMessageV2 = messaging_1.editMessageV2Function;
exports.deleteMessageForAllV2 = messaging_1.deleteMessageForAllV2Function;
exports.toggleReactionV2 = messaging_1.toggleReactionV2Function;
// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        databaseURL: "https://gamerapp-37e70-default-rtdb.firebaseio.com",
    });
}
const db = admin.firestore();
const storage = admin.storage();
// =============================================================================
// Dead notification triggers removed (2026-04-12)
//
// The following legacy triggers were never imported by index.ts and served as
// dead code alongside the canonical versions in notifications.ts and social.ts:
//   - onNewMessage          → canonical: notifications.ts
//   - onNewGroupMessageV2   → canonical: notifications.ts
//   - onNewFriendRequest    → canonical: social.ts
//
// Their private helpers (getGroupNotifyLevel, isGroupMuted,
// getGroupMemberUids) were only used by the dead triggers and have also been
// removed.
// =============================================================================
// ═══════════════════════════════════════════════════════════════════════════════
// STREAK LOGIC — REMOVED
// Streak management (updateStreakOnMessage, streakReminder, milestone cosmetics)
// has been moved to the canonical streak engine in streaks.ts.
// The server-authoritative streak updates are now wired through
// notifications.ts onNewMessage → streaks.updateStreakOnMessage.
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * onStoryViewed: Notify story author when their story is viewed
 */
exports.onStoryViewed = functions.firestore
    .document("stories/{storyId}/views/{viewerId}")
    .onCreate(async (snap, context) => {
    const { storyId, viewerId } = context.params;
    try {
        // Get story to find author
        const storyDoc = await db.collection("stories").doc(storyId).get();
        if (!storyDoc.exists)
            return;
        const story = storyDoc.data();
        const authorId = story.authorId;
        // Don't notify if viewing own story
        if (authorId === viewerId)
            return;
        // Get viewer's display name
        const viewerDoc = await db.collection("Users").doc(viewerId).get();
        const viewerName = viewerDoc.exists
            ? viewerDoc.data()?.displayName || "Someone"
            : "Someone";
        const { notifyUser: notifyUserCenter } = await Promise.resolve().then(() => __importStar(require("./notificationCenter")));
        await notifyUserCenter({
            recipientUid: authorId,
            type: "story_viewed",
            category: "social",
            dedupeKey: `story_viewed:${storyId}:${viewerId}`,
            collapseKey: `story_viewed:${authorId}`,
            title: `${viewerName} viewed your story`,
            body: "Tap to see who's watching",
            actorUid: viewerId,
            actorName: viewerName,
            route: {
                screen: "MainTabs",
            },
            data: {
                storyId,
                viewerId,
            },
            badgeEligible: false,
        });
        console.log(`✅ Sent story view notification to ${authorId}`);
    }
    catch (error) {
        console.error("❌ Error in onStoryViewed:", error);
    }
});
// NOTE: streakReminder has been moved to streaks.ts
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
 * cleanupExpiredSnaps: Scheduled function to strip legacy message expiry fields
 * Runs daily at 2 AM UTC.
 *
 * Older releases stored expiresAt on chat messages and a cleanup job deleted
 * them later. We now preserve chat history, so this job only removes the
 * legacy expiresAt field from any old message docs that still have it.
 */
exports.cleanupExpiredSnaps = functions.pubsub
    .schedule("0 2 * * *") // 2 AM UTC daily
    .timeZone("UTC")
    .onRun(async () => {
    try {
        const now = admin.firestore.Timestamp.now();
        const messagesRef = db.collectionGroup("Messages");
        const expiredQuery = await messagesRef.where("expiresAt", "<", now).get();
        console.log(`Found ${expiredQuery.docs.length} messages with legacy expiry`);
        let batch = db.batch();
        let updatedCount = 0;
        let batchCount = 0;
        for (const doc of expiredQuery.docs) {
            batch.update(doc.ref, {
                expiresAt: admin.firestore.FieldValue.delete(),
            });
            updatedCount++;
            batchCount++;
            if (batchCount === 500) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
                console.log("Committed batch of 500 expiry removals");
            }
        }
        if (batchCount > 0) {
            await batch.commit();
        }
        console.log(`[cleanupExpiredSnaps] Cleanup complete: removed legacy expiry from ${updatedCount} messages`);
        return;
    }
    catch (error) {
        console.error("[cleanupExpiredSnaps] Error:", error);
        throw error;
    }
});
/**
 * cleanupExpiredStories: Scheduled function to clean up expired stories
 * Runs daily at 2 AM UTC to remove stories past their 24h expiry.
 *
 * For each expired story:
 * - Delete the storage file from Storage
 * - Delete the story document (views subcollection auto-deletes)
 */
exports.cleanupExpiredStories = functions.pubsub
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
            }
            catch (error) {
                // File may already be deleted; only log real errors
                if (error.code !== 404 && error.code !== "storage/object-not-found") {
                    console.warn(`⚠️ Failed to delete story storage ${storagePath}:`, error.message);
                }
            }
            // Delete the story document (views subcollection auto-deletes)
            await doc.ref.delete();
            deletedCount++;
            console.log(`✅ Deleted expired story document: ${doc.id}`);
        }
        console.log(`✅ Story cleanup complete: ${deletedCount} expired stories removed`);
        return;
    }
    catch (error) {
        console.error("❌ Error in cleanupExpiredStories:", error);
        throw error;
    }
});
// ============================================
// SCHEDULED MESSAGES
// ============================================
/**
 * processScheduledMessages: Runs every minute to check for scheduled messages
 * that are due to be sent and delivers them.
 */
exports.processScheduledMessages = functions.pubsub
    .schedule("every 1 minutes")
    .timeZone("UTC")
    .onRun(async () => {
    try {
        const now = admin.firestore.Timestamp.now();
        console.log(`🕐 [ScheduledMessages] Processing at ${now.toDate().toISOString()}`);
        console.log(`🕐 [ScheduledMessages] Current timestamp (ms): ${now.toMillis()}`);
        // Query pending messages that are due (scheduledFor <= now)
        const scheduledRef = db.collection("ScheduledMessages");
        // First, let's check all pending messages to debug
        const allPending = await scheduledRef
            .where("status", "==", "pending")
            .get();
        console.log(`🔍 [ScheduledMessages] Total pending messages: ${allPending.docs.length}`);
        if (allPending.docs.length > 0) {
            allPending.docs.forEach((doc) => {
                const data = doc.data();
                const scheduledFor = data.scheduledFor;
                console.log(`🔍 [ScheduledMessages] Pending message ${doc.id}:`, {
                    scheduledFor: scheduledFor?.toDate?.()?.toISOString() || scheduledFor,
                    scheduledForMs: scheduledFor?.toMillis?.() || scheduledFor,
                    nowMs: now.toMillis(),
                    isDue: scheduledFor?.toMillis?.() <= now.toMillis(),
                });
            });
        }
        const dueMessages = await scheduledRef
            .where("status", "==", "pending")
            .where("scheduledFor", "<=", now)
            .limit(100) // Process up to 100 messages per run
            .get();
        console.log(`📬 Found ${dueMessages.docs.length} scheduled messages to deliver`);
        let sentCount = 0;
        let failedCount = 0;
        for (const doc of dueMessages.docs) {
            const scheduledMessage = doc.data();
            const messageId = doc.id;
            try {
                // Determine scope — default to "dm" for backward compatibility
                const scope = scheduledMessage.scope || "dm";
                const isGroup = scope === "group";
                // Verify the conversation still exists
                const conversationCollection = isGroup ? "Groups" : "Chats";
                const conversationDoc = await db
                    .collection(conversationCollection)
                    .doc(scheduledMessage.chatId)
                    .get();
                if (!conversationDoc.exists) {
                    await doc.ref.update({
                        status: "failed",
                        failReason: `${conversationCollection.slice(0, -1)} no longer exists`,
                    });
                    failedCount++;
                    console.log(`❌ ${conversationCollection.slice(0, -1)} not found for scheduled message ${messageId}`);
                    continue;
                }
                // Route to the correct Messages sub-collection
                const newMessageRef = db
                    .collection(conversationCollection)
                    .doc(scheduledMessage.chatId)
                    .collection("Messages")
                    .doc();
                const messageData = {
                    id: newMessageRef.id,
                    scope,
                    conversationId: scheduledMessage.chatId,
                    // V2 field names
                    senderId: scheduledMessage.senderId,
                    text: scheduledMessage.content,
                    kind: scheduledMessage.type === "image" ? "media" : "text",
                    // Legacy field names for backward compatibility
                    sender: scheduledMessage.senderId,
                    content: scheduledMessage.content,
                    type: scheduledMessage.type,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    serverReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                };
                // Copy mention UIDs from the scheduled message
                if (scheduledMessage.mentionUids &&
                    scheduledMessage.mentionUids.length > 0) {
                    messageData.mentionUids = scheduledMessage.mentionUids;
                }
                // If it's an image message, include the image URL
                if (scheduledMessage.type === "image" && scheduledMessage.imageUrl) {
                    messageData.imageUrl = scheduledMessage.imageUrl;
                }
                // For groups, add sender profile snapshot
                if (isGroup) {
                    const senderDoc = await db
                        .collection("Users")
                        .doc(scheduledMessage.senderId)
                        .get();
                    if (senderDoc.exists) {
                        const senderData = senderDoc.data();
                        messageData.senderName = senderData?.displayName || "Unknown";
                        messageData.senderDisplayName =
                            senderData?.displayName || "Unknown";
                        if (senderData?.avatarConfig) {
                            messageData.senderAvatarConfig = senderData.avatarConfig;
                        }
                    }
                }
                // Create the message
                await newMessageRef.set(messageData);
                // Update the conversation's lastMessage
                const previewText = scheduledMessage.type === "image"
                    ? "📸 Picture"
                    : scheduledMessage.content;
                const conversationUpdate = {
                    lastMessage: previewText,
                    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastMessageText: previewText,
                    lastMessageKind: scheduledMessage.type === "image" ? "media" : "text",
                    lastMessageSenderId: scheduledMessage.senderId,
                    lastMessageId: newMessageRef.id,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                if (scheduledMessage.mentionUids &&
                    scheduledMessage.mentionUids.length > 0) {
                    conversationUpdate.lastMentionUids = scheduledMessage.mentionUids;
                }
                await db
                    .collection(conversationCollection)
                    .doc(scheduledMessage.chatId)
                    .update(conversationUpdate);
                // Mark scheduled message as sent
                await doc.ref.update({
                    status: "sent",
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                sentCount++;
                console.log(`✅ Delivered scheduled message ${messageId} to chat ${scheduledMessage.chatId}`);
            }
            catch (error) {
                // Mark as failed with reason
                await doc.ref.update({
                    status: "failed",
                    failReason: error.message || "Unknown error",
                });
                failedCount++;
                console.error(`❌ Failed to deliver scheduled message ${messageId}:`, error);
            }
        }
        console.log(`✅ Scheduled messages processing complete: ${sentCount} sent, ${failedCount} failed`);
        return;
    }
    catch (error) {
        console.error("❌ Error in processScheduledMessages:", error);
        throw error;
    }
});
/**
 * onScheduledMessageCreated: Triggered when a new scheduled message is created
 * Can be used for additional validation or logging
 */
exports.onScheduledMessageCreated = functions.firestore
    .document("ScheduledMessages/{messageId}")
    .onCreate(async (snap, context) => {
    const message = snap.data();
    const { messageId } = context.params;
    console.log(`📅 New scheduled message created: ${messageId}`);
    console.log(`   Sender: ${message.senderId}`);
    console.log(`   Chat: ${message.chatId}`);
    console.log(`   Scheduled for: ${message.scheduledFor?.toDate?.()?.toISOString() || "unknown"}`);
    return;
});
/**
 * cleanupOldScheduledMessages: Runs daily to clean up old sent/cancelled/failed messages
 * Keeps scheduled messages for 30 days after they've been processed
 */
exports.cleanupOldScheduledMessages = functions.pubsub
    .schedule("0 3 * * *") // 3 AM UTC daily
    .timeZone("UTC")
    .onRun(async () => {
    try {
        // Calculate 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffTimestamp = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);
        console.log(`🧹 Cleaning up scheduled messages older than ${thirtyDaysAgo.toISOString()}`);
        const scheduledRef = db.collection("ScheduledMessages");
        // Delete old sent messages
        const oldSent = await scheduledRef
            .where("status", "==", "sent")
            .where("sentAt", "<", cutoffTimestamp)
            .limit(500)
            .get();
        // Delete old cancelled messages
        const oldCancelled = await scheduledRef
            .where("status", "==", "cancelled")
            .where("createdAt", "<", cutoffTimestamp)
            .limit(500)
            .get();
        // Delete old failed messages
        const oldFailed = await scheduledRef
            .where("status", "==", "failed")
            .where("createdAt", "<", cutoffTimestamp)
            .limit(500)
            .get();
        const allDocs = [
            ...oldSent.docs,
            ...oldCancelled.docs,
            ...oldFailed.docs,
        ];
        console.log(`Found ${allDocs.length} old scheduled messages to clean up`);
        let deletedCount = 0;
        for (const doc of allDocs) {
            await doc.ref.delete();
            deletedCount++;
        }
        console.log(`✅ Scheduled message cleanup complete: ${deletedCount} messages removed`);
        return;
    }
    catch (error) {
        console.error("❌ Error in cleanupOldScheduledMessages:", error);
        throw error;
    }
});
// ============================================
// ECONOMY + WALLET + TASKS
// ============================================
/** Default starting tokens for new users */
const DEFAULT_STARTING_TOKENS = 100;
/** Default timezone for day calculations */
const DEFAULT_TIMEZONE = "America/Indiana/Indianapolis";
/**
 * Helper to get current day key in timezone
 */
function getCurrentDayKey(timezone = DEFAULT_TIMEZONE) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return formatter.format(now);
}
/**
 * Get current month key for monthly tasks (timezone-aware)
 * Returns "YYYY-MM" format
 */
function getCurrentMonthKey(timezone = DEFAULT_TIMEZONE) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
    });
    return formatter.format(now);
}
/**
 * Initialize wallet when new user is created
 * Grants starting tokens to new users
 */
exports.onUserCreated = functions.firestore
    .document("Users/{uid}")
    .onCreate(async (snap, context) => {
    const { uid } = context.params;
    const userData = snap.data();
    console.log(`👤 New user created: ${uid} (${userData.displayName})`);
    try {
        // Create wallet with starting balance
        const walletRef = db.collection("Wallets").doc(uid);
        const walletDoc = await walletRef.get();
        if (!walletDoc.exists) {
            await walletRef.set({
                uid,
                tokensBalance: DEFAULT_STARTING_TOKENS,
                totalEarned: DEFAULT_STARTING_TOKENS,
                totalSpent: 0,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Create transaction record for starting bonus
            await db.collection("Transactions").add({
                uid,
                type: "earn",
                amount: DEFAULT_STARTING_TOKENS,
                reason: "daily_bonus",
                description: "Welcome bonus!",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`💰 Created wallet for ${uid} with ${DEFAULT_STARTING_TOKENS} starting tokens`);
        }
    }
    catch (error) {
        console.error(`❌ Error creating wallet for ${uid}:`, error);
    }
});
/**
 * claimTaskReward: Callable function to claim reward for completed task
 * Validates completion, prevents double claims, awards tokens atomically
 */
exports.claimTaskReward = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const uid = context.auth.uid;
    const { taskId, dayKey } = data;
    // Enhanced input validation (Security)
    if (!(0, utils_1.isValidString)(taskId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid taskId format");
    }
    if (!(0, utils_1.isValidString)(dayKey, 8, 15)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid dayKey format");
    }
    console.log(`🎯 [claimTaskReward] User ${(0, utils_1.sanitizeForLog)(uid)} claiming task ${(0, utils_1.sanitizeForLog)(taskId)} for day ${(0, utils_1.sanitizeForLog)(dayKey)}`);
    try {
        // Get task definition
        const taskRef = db.collection("Tasks").doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Task not found");
        }
        const task = taskDoc.data();
        if (!task.active) {
            throw new functions.https.HttpsError("failed-precondition", "Task is not active");
        }
        // Check availability window
        const now = Date.now();
        if (task.availableFrom && now < task.availableFrom.toMillis()) {
            throw new functions.https.HttpsError("failed-precondition", "Task not yet available");
        }
        if (task.availableTo && now > task.availableTo.toMillis()) {
            throw new functions.https.HttpsError("failed-precondition", "Task has expired");
        }
        // Get user's progress for this task
        const progressRef = db
            .collection("Users")
            .doc(uid)
            .collection("TaskProgress")
            .doc(taskId);
        const progressDoc = await progressRef.get();
        if (!progressDoc.exists) {
            throw new functions.https.HttpsError("failed-precondition", "No progress found for this task");
        }
        const progress = progressDoc.data();
        // Verify dayKey matches (for daily and monthly tasks)
        if ((task.cadence === "daily" || task.cadence === "monthly") &&
            progress.dayKey !== dayKey) {
            throw new functions.https.HttpsError("failed-precondition", "Progress is from a different period");
        }
        // Check if already claimed
        if (progress.claimed) {
            throw new functions.https.HttpsError("already-exists", "Reward already claimed");
        }
        // Check if task is completed
        if (progress.progress < task.target) {
            throw new functions.https.HttpsError("failed-precondition", `Task not completed: ${progress.progress}/${task.target}`);
        }
        // All checks passed - award reward atomically
        const batch = db.batch();
        // 1. Mark progress as claimed
        batch.update(progressRef, {
            claimed: true,
            claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // 2. Award tokens
        const tokensAwarded = task.rewardTokens || 0;
        if (tokensAwarded > 0) {
            const walletRef = db.collection("Wallets").doc(uid);
            batch.update(walletRef, {
                tokensBalance: admin.firestore.FieldValue.increment(tokensAwarded),
                totalEarned: admin.firestore.FieldValue.increment(tokensAwarded),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Create transaction record
            const txRef = db.collection("Transactions").doc();
            batch.set(txRef, {
                uid,
                type: "earn",
                amount: tokensAwarded,
                reason: "task_reward",
                refId: taskId,
                refType: "task",
                description: task.title,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // 3. Award cosmetic item if specified
        let itemAwarded;
        if (task.rewardItemId) {
            const inventoryRef = db
                .collection("Users")
                .doc(uid)
                .collection("inventory")
                .doc(task.rewardItemId);
            // Check if user already has this item
            const existingItem = await inventoryRef.get();
            if (!existingItem.exists) {
                batch.set(inventoryRef, {
                    itemId: task.rewardItemId,
                    acquiredAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                itemAwarded = task.rewardItemId;
            }
        }
        await batch.commit();
        console.log(`✅ [claimTaskReward] Awarded ${tokensAwarded} tokens to ${uid} for completing ${taskId}`);
        return {
            success: true,
            tokensAwarded,
            itemAwarded,
        };
    }
    catch (error) {
        console.error(`❌ [claimTaskReward] Error:`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", error.message || "Failed to claim reward");
    }
});
/**
 * Helper to update task progress atomically
 */
async function updateTaskProgress(uid, taskType, incrementBy = 1) {
    const dayKey = getCurrentDayKey();
    const monthKey = getCurrentMonthKey();
    // Find active tasks of this type
    const tasksRef = db.collection("Tasks");
    const tasksQuery = await tasksRef
        .where("active", "==", true)
        .where("type", "==", taskType)
        .get();
    if (tasksQuery.empty) {
        return;
    }
    const batch = db.batch();
    for (const taskDoc of tasksQuery.docs) {
        const task = taskDoc.data();
        const taskId = taskDoc.id;
        // Choose key based on cadence
        const periodKey = task.cadence === "monthly" ? monthKey : dayKey;
        // Get or create progress document
        const progressRef = db
            .collection("Users")
            .doc(uid)
            .collection("TaskProgress")
            .doc(taskId);
        const progressDoc = await progressRef.get();
        if (!progressDoc.exists) {
            // Create new progress
            batch.set(progressRef, {
                taskId,
                progress: incrementBy,
                claimed: false,
                dayKey: periodKey,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            const progress = progressDoc.data();
            // For daily/monthly tasks, reset if period has changed
            if ((task.cadence === "daily" || task.cadence === "monthly") &&
                progress.dayKey !== periodKey) {
                batch.set(progressRef, {
                    taskId,
                    progress: incrementBy,
                    claimed: false,
                    dayKey: periodKey,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            else if (!progress.claimed) {
                // Increment existing progress (only if not already claimed)
                batch.update(progressRef, {
                    progress: admin.firestore.FieldValue.increment(incrementBy),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
    }
    await batch.commit();
    console.log(`📈 [updateTaskProgress] Updated ${taskType} progress for ${uid}`);
}
/**
 * Update task progress when message is sent
 */
exports.onMessageSentTaskProgress = functions.firestore
    .document("Chats/{chatId}/Messages/{messageId}")
    .onCreate(async (snap, context) => {
    const message = snap.data();
    const senderId = message.sender;
    try {
        // Update "send_message" tasks
        await updateTaskProgress(senderId, "send_message");
        // If it's an image message, also update "send_snap" tasks
        if (message.type === "image") {
            await updateTaskProgress(senderId, "send_snap");
        }
    }
    catch (error) {
        console.error("❌ [onMessageSentTaskProgress] Error:", error);
    }
});
/**
 * Update task progress when story is viewed
 */
exports.onStoryViewedTaskProgress = functions.firestore
    .document("stories/{storyId}/views/{userId}")
    .onCreate(async (snap, context) => {
    const { userId } = context.params;
    try {
        // Update "view_story" tasks for the viewer
        await updateTaskProgress(userId, "view_story");
    }
    catch (error) {
        console.error("❌ [onStoryViewedTaskProgress] Error:", error);
    }
});
/**
 * Update task progress when story is posted
 */
exports.onStoryPostedTaskProgress = functions.firestore
    .document("stories/{storyId}")
    .onCreate(async (snap, context) => {
    const story = snap.data();
    const authorId = story.authorId;
    try {
        // Update "post_story" tasks for the author
        await updateTaskProgress(authorId, "post_story");
    }
    catch (error) {
        console.error("❌ [onStoryPostedTaskProgress] Error:", error);
    }
});
/**
 * Update task progress when friend is added
 */
exports.onFriendAddedTaskProgress = functions.firestore
    .document("Friends/{friendId}")
    .onCreate(async (snap, context) => {
    const friend = snap.data();
    const users = friend.users;
    try {
        // Update "add_friend" tasks for both users
        for (const userId of users) {
            await updateTaskProgress(userId, "add_friend");
        }
    }
    catch (error) {
        console.error("❌ [onFriendAddedTaskProgress] Error:", error);
    }
});
/**
 * Daily login task trigger
 * This is called when user opens app (client-side via callable)
 */
exports.recordDailyLogin = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const uid = context.auth.uid;
    try {
        await updateTaskProgress(uid, "login");
        return { success: true };
    }
    catch (error) {
        console.error("❌ [recordDailyLogin] Error:", error);
        throw new functions.https.HttpsError("internal", error.message || "Failed to record login");
    }
});
/**
 * Seed initial daily tasks (run once via admin or console)
 * This creates default task definitions
 */
exports.seedDailyTasks = functions.https.onRequest(async (req, res) => {
    const authResult = await (0, httpAuth_1.authorizeAdminHttpRequest)(req);
    if (!authResult.ok) {
        res.status(authResult.status).json({
            success: false,
            error: authResult.error,
        });
        return;
    }
    const defaultTasks = [
        {
            id: "daily_send_5_messages",
            title: "Social Butterfly",
            description: "Send 5 messages to friends",
            icon: "message-text",
            cadence: "daily",
            type: "send_message",
            target: 5,
            rewardTokens: 10,
            active: true,
            sortOrder: 1,
        },
        {
            id: "daily_send_3_pictures",
            title: "Picture Perfect",
            description: "Send 3 pictures to friends",
            icon: "camera",
            cadence: "daily",
            type: "send_snap",
            target: 3,
            rewardTokens: 15,
            active: true,
            sortOrder: 2,
        },
        {
            id: "daily_view_5_stories",
            title: "Story Explorer",
            description: "View 5 stories from friends",
            icon: "eye",
            cadence: "daily",
            type: "view_story",
            target: 5,
            rewardTokens: 10,
            active: true,
            sortOrder: 3,
        },
        {
            id: "daily_post_story",
            title: "Story Time",
            description: "Post a story",
            icon: "image-plus",
            cadence: "daily",
            type: "post_story",
            target: 1,
            rewardTokens: 20,
            active: true,
            sortOrder: 4,
        },
        {
            id: "daily_play_game",
            title: "Game On",
            description: "Play a game",
            icon: "gamepad-variant",
            cadence: "daily",
            type: "play_game",
            target: 1,
            rewardTokens: 15,
            active: true,
            sortOrder: 5,
        },
        {
            id: "daily_win_game",
            title: "Champion",
            description: "Win a game (under 300ms reaction or 50+ taps)",
            icon: "trophy",
            cadence: "daily",
            type: "win_game",
            target: 1,
            rewardTokens: 25,
            active: true,
            sortOrder: 6,
        },
        {
            id: "daily_login",
            title: "Daily Check-In",
            description: "Open the app today",
            icon: "login",
            cadence: "daily",
            type: "login",
            target: 1,
            rewardTokens: 5,
            active: true,
            sortOrder: 0,
        },
    ];
    const batch = db.batch();
    for (const task of defaultTasks) {
        const taskRef = db.collection("Tasks").doc(task.id);
        batch.set(taskRef, {
            ...task,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
    console.log(`✅ Seeded ${defaultTasks.length} daily tasks`);
    res.json({ success: true, tasksCreated: defaultTasks.length });
});
/**
 * Seed monthly tasks into the Tasks collection
 * Run once from admin panel to populate monthly challenges
 */
exports.seedMonthlyTasks = functions.https.onRequest(async (req, res) => {
    const authResult = await (0, httpAuth_1.authorizeAdminHttpRequest)(req);
    if (!authResult.ok) {
        res.status(authResult.status).json({
            success: false,
            error: authResult.error,
        });
        return;
    }
    const monthlyTasks = [
        {
            id: "monthly_play_20_games",
            title: "Seasoned Player",
            description: "Play 20 games this month",
            icon: "gamepad-variant",
            cadence: "monthly",
            type: "play_game",
            target: 20,
            rewardTokens: 150,
            active: true,
            sortOrder: 1,
        },
        {
            id: "monthly_win_10_games",
            title: "Monthly Champion",
            description: "Win 10 games this month",
            icon: "trophy",
            cadence: "monthly",
            type: "win_game",
            target: 10,
            rewardTokens: 200,
            active: true,
            sortOrder: 2,
        },
        {
            id: "monthly_send_100_messages",
            title: "Chatterbox",
            description: "Send 100 messages this month",
            icon: "message-text-outline",
            cadence: "monthly",
            type: "send_message",
            target: 100,
            rewardTokens: 100,
            active: true,
            sortOrder: 3,
        },
        {
            id: "monthly_post_10_stories",
            title: "Content Creator",
            description: "Post 10 stories this month",
            icon: "image-multiple",
            cadence: "monthly",
            type: "post_story",
            target: 10,
            rewardTokens: 120,
            active: true,
            sortOrder: 4,
        },
        {
            id: "monthly_view_50_stories",
            title: "Story Binge",
            description: "View 50 stories this month",
            icon: "eye-check",
            cadence: "monthly",
            type: "view_story",
            target: 50,
            rewardTokens: 80,
            active: true,
            sortOrder: 5,
        },
        {
            id: "monthly_add_3_friends",
            title: "Expanding Circles",
            description: "Add 3 new friends this month",
            icon: "account-group",
            cadence: "monthly",
            type: "add_friend",
            target: 3,
            rewardTokens: 100,
            active: true,
            sortOrder: 6,
        },
        {
            id: "monthly_7_day_streak",
            title: "Streak Master",
            description: "Maintain a 7-day login streak",
            icon: "fire",
            cadence: "monthly",
            type: "maintain_streak",
            target: 7,
            rewardTokens: 250,
            active: true,
            sortOrder: 7,
        },
    ];
    const batch = db.batch();
    for (const task of monthlyTasks) {
        const taskRef = db.collection("Tasks").doc(task.id);
        batch.set(taskRef, {
            ...task,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
    console.log(`✅ Seeded ${monthlyTasks.length} monthly tasks`);
    res.json({ success: true, tasksCreated: monthlyTasks.length });
});
/**
 * Initialize wallet for existing users who don't have one
 * Run once via admin to migrate existing users
 */
exports.initializeExistingWallets = functions.https.onRequest(async (req, res) => {
    const authResult = await (0, httpAuth_1.authorizeAdminHttpRequest)(req);
    if (!authResult.ok) {
        res.status(authResult.status).json({
            success: false,
            error: authResult.error,
        });
        return;
    }
    try {
        const usersSnapshot = await db.collection("Users").get();
        let created = 0;
        let skipped = 0;
        for (const userDoc of usersSnapshot.docs) {
            const uid = userDoc.id;
            const walletRef = db.collection("Wallets").doc(uid);
            const walletDoc = await walletRef.get();
            if (!walletDoc.exists) {
                await walletRef.set({
                    uid,
                    tokensBalance: DEFAULT_STARTING_TOKENS,
                    totalEarned: DEFAULT_STARTING_TOKENS,
                    totalSpent: 0,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                // Create transaction record
                await db.collection("Transactions").add({
                    uid,
                    type: "earn",
                    amount: DEFAULT_STARTING_TOKENS,
                    reason: "daily_bonus",
                    description: "Welcome bonus!",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                created++;
            }
            else {
                skipped++;
            }
        }
        console.log(`✅ Initialized wallets: ${created} created, ${skipped} skipped`);
        res.json({ success: true, created, skipped });
    }
    catch (error) {
        console.error("❌ Error initializing wallets:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================
// SHOP + LIMITED-TIME DROPS
// ============================================
/**
 * Seed shop catalog with sample items (run once via admin)
 * Creates initial shop items for testing
 */
exports.seedShopCatalog = functions.https.onRequest(async (req, res) => {
    const authResult = await (0, httpAuth_1.authorizeAdminHttpRequest)(req);
    if (!authResult.ok) {
        res.status(authResult.status).json({
            success: false,
            error: authResult.error,
        });
        return;
    }
    // Sample shop items based on existing cosmetics
    const shopItems = [
        // Featured limited-time items
        {
            id: "shop_hat_crown",
            cosmeticId: "hat_crown",
            name: "Royal Crown",
            description: "Rule the chat with this majestic crown!",
            category: "featured",
            slot: "hat",
            priceTokens: 150,
            rarity: "legendary",
            imagePath: "👑",
            featured: true,
            availableFrom: Date.now(),
            availableTo: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
            purchaseCount: 0,
            active: true,
            sortOrder: 1,
        },
        {
            id: "shop_bg_galaxy",
            cosmeticId: "bg_galaxy",
            name: "Galaxy Background",
            description: "A stunning cosmic background",
            category: "featured",
            slot: "background",
            priceTokens: 100,
            rarity: "epic",
            imagePath: "🌌",
            featured: true,
            availableFrom: Date.now(),
            availableTo: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days
            purchaseCount: 0,
            active: true,
            sortOrder: 2,
        },
        // Regular shop items - Hats
        {
            id: "shop_hat_cap",
            cosmeticId: "hat_cap",
            name: "Cool Cap",
            description: "A stylish cap for everyday wear",
            category: "hat",
            slot: "hat",
            priceTokens: 25,
            rarity: "common",
            imagePath: "🧢",
            featured: false,
            purchaseCount: 0,
            active: true,
            sortOrder: 10,
        },
        {
            id: "shop_hat_beanie",
            cosmeticId: "hat_beanie",
            name: "Cozy Beanie",
            description: "Stay warm and stylish",
            category: "hat",
            slot: "hat",
            priceTokens: 30,
            rarity: "common",
            imagePath: "🎿",
            featured: false,
            purchaseCount: 0,
            active: true,
            sortOrder: 11,
        },
        {
            id: "shop_hat_tophat",
            cosmeticId: "hat_tophat",
            name: "Top Hat",
            description: "For the distinguished avatar",
            category: "hat",
            slot: "hat",
            priceTokens: 50,
            rarity: "rare",
            imagePath: "🎩",
            featured: false,
            purchaseCount: 0,
            active: true,
            sortOrder: 12,
        },
        // Glasses
        {
            id: "shop_glasses_round",
            cosmeticId: "glasses_round",
            name: "Round Glasses",
            description: "Classic round frames",
            category: "glasses",
            slot: "glasses",
            priceTokens: 20,
            rarity: "common",
            imagePath: "👓",
            featured: false,
            purchaseCount: 0,
            active: true,
            sortOrder: 20,
        },
        {
            id: "shop_glasses_sunglasses",
            cosmeticId: "glasses_sunglasses",
            name: "Cool Sunglasses",
            description: "Block the haters",
            category: "glasses",
            slot: "glasses",
            priceTokens: 35,
            rarity: "rare",
            imagePath: "🕶️",
            featured: false,
            purchaseCount: 0,
            active: true,
            sortOrder: 21,
        },
        {
            id: "shop_glasses_vr",
            cosmeticId: "glasses_vr",
            name: "VR Headset",
            description: "Enter the metaverse in style",
            category: "glasses",
            slot: "glasses",
            priceTokens: 75,
            rarity: "epic",
            imagePath: "🥽",
            featured: false,
            purchaseCount: 0,
            active: true,
            sortOrder: 22,
        },
        // Backgrounds
        {
            id: "shop_bg_sunset",
            cosmeticId: "bg_sunset",
            name: "Sunset Vibes",
            description: "A beautiful sunset backdrop",
            category: "background",
            slot: "background",
            priceTokens: 40,
            rarity: "rare",
            imagePath: "🌅",
            featured: false,
            purchaseCount: 0,
            active: true,
            sortOrder: 30,
        },
        {
            id: "shop_bg_city",
            cosmeticId: "bg_city",
            name: "City Lights",
            description: "Urban cityscape at night",
            category: "background",
            slot: "background",
            priceTokens: 45,
            rarity: "rare",
            imagePath: "🌃",
            featured: false,
            purchaseCount: 0,
            active: true,
            sortOrder: 31,
        },
        {
            id: "shop_bg_neon",
            cosmeticId: "bg_neon",
            name: "Neon Dreams",
            description: "Vibrant neon aesthetic",
            category: "background",
            slot: "background",
            priceTokens: 60,
            rarity: "epic",
            imagePath: "💜",
            featured: false,
            purchaseCount: 0,
            active: true,
            sortOrder: 32,
        },
    ];
    const batch = db.batch();
    for (const item of shopItems) {
        const itemRef = db.collection("ShopCatalog").doc(item.id);
        batch.set(itemRef, {
            ...item,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    await batch.commit();
    console.log(`✅ Seeded ${shopItems.length} shop items`);
    res.json({ success: true, itemsCreated: shopItems.length });
});
// ============================================
// TRUST & SAFETY V1.5
// Rate Limiting, Bans, Strikes, Admin Moderation
// ============================================
/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
    FRIEND_REQUESTS_PER_HOUR: 20,
    MESSAGES_PER_MINUTE: 30,
    REPORTS_PER_DAY: 10,
    GROUP_INVITES_PER_HOUR: 30,
};
/**
 * Strike thresholds for automatic bans
 */
const STRIKE_THRESHOLDS = {
    WARNING_AT: 1,
    TEMP_BAN_AT: 2, // 1 day ban
    LONG_BAN_AT: 3, // 1 week ban
    PERM_BAN_AT: 5, // Permanent ban
};
/**
 * Helper: Check if user is an admin
 */
async function isAdmin(context) {
    if (!context.auth)
        return false;
    return context.auth.token.admin === true;
}
/**
 * Helper: Check rate limit for a user action
 * Returns true if action is allowed, false if rate limited
 */
async function checkRateLimit(uid, actionType, limitPerPeriod, periodMs) {
    const now = Date.now();
    const periodStart = now - periodMs;
    // Get rate limit doc
    const rateLimitRef = db.collection("RateLimits").doc(`${uid}_${actionType}`);
    const rateLimitDoc = await rateLimitRef.get();
    if (!rateLimitDoc.exists) {
        // First action, create tracking doc
        await rateLimitRef.set({
            uid,
            actionType,
            actions: [now],
            updatedAt: now,
        });
        return { allowed: true, remaining: limitPerPeriod - 1 };
    }
    const data = rateLimitDoc.data();
    const actions = (data.actions || []).filter((ts) => ts > periodStart);
    if (actions.length >= limitPerPeriod) {
        return { allowed: false, remaining: 0 };
    }
    // Add new action
    actions.push(now);
    await rateLimitRef.update({
        actions,
        updatedAt: now,
    });
    return { allowed: true, remaining: limitPerPeriod - actions.length };
}
/**
 * Rate-limited friend request creation
 * Validates rate limits server-side
 */
exports.sendFriendRequestWithRateLimit = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    const { toUid } = data;
    // Enhanced input validation (Security)
    if (!(0, utils_1.isValidUid)(toUid)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid recipient ID");
    }
    // Prevent self-friending
    if (toUid === uid) {
        throw new functions.https.HttpsError("invalid-argument", "Cannot send friend request to yourself");
    }
    // Check if sender is banned
    const banDoc = await db.collection("Bans").doc(uid).get();
    if (banDoc.exists) {
        const ban = banDoc.data();
        if (ban.status === "active") {
            if (ban.expiresAt === null || Date.now() < ban.expiresAt) {
                throw new functions.https.HttpsError("permission-denied", "Your account is currently restricted");
            }
        }
    }
    // Check rate limit (20 per hour)
    const rateCheck = await checkRateLimit(uid, "friend_request", RATE_LIMITS.FRIEND_REQUESTS_PER_HOUR, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
        throw new functions.https.HttpsError("resource-exhausted", "Too many friend requests. Please wait before sending more.");
    }
    console.log(`✅ Friend request rate check passed. Remaining: ${rateCheck.remaining}`);
    return { allowed: true, remaining: rateCheck.remaining };
});
/**
 * Rate-limited message sending check
 * Called before sending messages to enforce limits
 */
exports.checkMessageRateLimit = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    // Check if sender is banned
    const banDoc = await db.collection("Bans").doc(uid).get();
    if (banDoc.exists) {
        const ban = banDoc.data();
        if (ban.status === "active") {
            if (ban.expiresAt === null || Date.now() < ban.expiresAt) {
                throw new functions.https.HttpsError("permission-denied", "Your account is currently restricted");
            }
        }
    }
    // Check rate limit (30 per minute)
    const rateCheck = await checkRateLimit(uid, "message", RATE_LIMITS.MESSAGES_PER_MINUTE, 60 * 1000);
    if (!rateCheck.allowed) {
        throw new functions.https.HttpsError("resource-exhausted", "Slow down! You're sending messages too quickly.");
    }
    return { allowed: true, remaining: rateCheck.remaining };
});
/**
 * Send push notification with invalid token cleanup
 * Enhanced version that removes invalid tokens
 */
async function sendExpoPushNotificationWithCleanup(message, userId) {
    try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
        });
        const result = (await response.json());
        console.log("📱 Push notification result:", result);
        // Check for device not registered error
        if (result.status === "error" &&
            result.details?.error === "DeviceNotRegistered") {
            console.log(`🧹 Cleaning up invalid token for user ${userId}`);
            await cleanupInvalidPushToken(userId);
        }
    }
    catch (error) {
        console.error("❌ Error sending push notification:", error);
    }
}
/**
 * Remove invalid push token from user document
 */
async function cleanupInvalidPushToken(userId) {
    try {
        await db.collection("Users").doc(userId).update({
            expoPushToken: admin.firestore.FieldValue.delete(),
        });
        console.log(`✅ Removed invalid push token for user ${userId}`);
    }
    catch (error) {
        console.error(`❌ Error removing push token for ${userId}:`, error);
    }
}
/**
 * Scheduled function to clean up expired push tokens
 * Runs daily to check for tokens that haven't been updated in 30 days
 */
exports.cleanupExpiredPushTokens = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
    console.log("🧹 Starting push token cleanup...");
    // This is a placeholder - in production, you would:
    // 1. Track token last-used timestamps
    // 2. Send test pushes to dormant tokens
    // 3. Remove tokens that fail with DeviceNotRegistered
    // For now, we rely on real-time cleanup in sendExpoPushNotificationWithCleanup
    console.log("✅ Push token cleanup completed (no-op for now)");
    return null;
});
// ============================================
// ADMIN MODERATION FUNCTIONS
// ============================================
/**
 * Admin: Set a ban on a user
 * Requires admin custom claim
 */
exports.adminSetBan = functions.https.onCall(async (data, context) => {
    // Verify admin
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required");
    }
    const { targetUid, reason, durationMs, details } = data;
    const adminUid = context.auth.uid;
    if (!targetUid || !reason) {
        throw new functions.https.HttpsError("invalid-argument", "Missing targetUid or reason");
    }
    // Don't allow banning admins
    const targetAuth = await admin
        .auth()
        .getUser(targetUid)
        .catch(() => null);
    if (targetAuth?.customClaims?.admin) {
        throw new functions.https.HttpsError("permission-denied", "Cannot ban an admin");
    }
    const now = Date.now();
    const expiresAt = durationMs ? now + durationMs : null;
    const ban = {
        uid: targetUid,
        status: "active",
        reason,
        reasonDetails: details || null,
        bannedBy: adminUid,
        createdAt: now,
        expiresAt,
    };
    await db.collection("Bans").doc(targetUid).set(ban);
    // Log the event
    await logDomainEvent("ban_applied", adminUid, {
        targetUid,
        reason,
        expiresAt,
    });
    console.log(`🔨 Admin ${adminUid} banned user ${targetUid} for ${reason}`);
    return { success: true };
});
/**
 * Admin: Lift a ban
 * Requires admin custom claim
 */
exports.adminLiftBan = functions.https.onCall(async (data, context) => {
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required");
    }
    const { targetUid } = data;
    const adminUid = context.auth.uid;
    if (!targetUid) {
        throw new functions.https.HttpsError("invalid-argument", "Missing targetUid");
    }
    const banRef = db.collection("Bans").doc(targetUid);
    const banDoc = await banRef.get();
    if (!banDoc.exists) {
        throw new functions.https.HttpsError("not-found", "No ban found for user");
    }
    await banRef.update({
        status: "lifted",
        liftedAt: Date.now(),
        liftedBy: adminUid,
    });
    console.log(`✅ Admin ${adminUid} lifted ban for user ${targetUid}`);
    return { success: true };
});
/**
 * Admin: Apply a strike to a user
 * Automatically applies bans based on strike thresholds
 */
exports.adminApplyStrike = functions.https.onCall(async (data, context) => {
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required");
    }
    const { targetUid, reason, details, reportId } = data;
    const adminUid = context.auth.uid;
    if (!targetUid || !reason) {
        throw new functions.https.HttpsError("invalid-argument", "Missing targetUid or reason");
    }
    const now = Date.now();
    const strikeRef = db.collection("UserStrikes").doc(targetUid);
    const strikeDoc = await strikeRef.get();
    let strikeCount = 1;
    let strikeHistory = [];
    if (strikeDoc.exists) {
        const existingData = strikeDoc.data();
        strikeCount = (existingData.strikeCount || 0) + 1;
        strikeHistory = existingData.strikeHistory || [];
    }
    // Add new strike to history
    strikeHistory.push({
        reason,
        details: details || null,
        issuedBy: adminUid,
        issuedAt: now,
        reportId: reportId || null,
    });
    await strikeRef.set({
        uid: targetUid,
        strikeCount,
        lastStrikeAt: now,
        lastStrikeReason: reason,
        strikeHistory,
    });
    // Log the event
    await logDomainEvent("strike_issued", adminUid, {
        targetUid,
        reason,
        strikeCount,
        reportId,
    });
    // Check if automatic ban should be applied
    let autoBanApplied = false;
    let banDuration = null;
    if (strikeCount >= STRIKE_THRESHOLDS.PERM_BAN_AT) {
        banDuration = null; // Permanent
        autoBanApplied = true;
    }
    else if (strikeCount >= STRIKE_THRESHOLDS.LONG_BAN_AT) {
        banDuration = 7 * 24 * 60 * 60 * 1000; // 1 week
        autoBanApplied = true;
    }
    else if (strikeCount >= STRIKE_THRESHOLDS.TEMP_BAN_AT) {
        banDuration = 24 * 60 * 60 * 1000; // 1 day
        autoBanApplied = true;
    }
    if (autoBanApplied) {
        const ban = {
            uid: targetUid,
            status: "active",
            reason: "multiple_violations",
            reasonDetails: `Automatic ban after ${strikeCount} strikes`,
            bannedBy: "system",
            createdAt: now,
            expiresAt: banDuration ? now + banDuration : null,
        };
        await db.collection("Bans").doc(targetUid).set(ban);
        console.log(`🔨 Auto-ban applied to ${targetUid} after ${strikeCount} strikes`);
    }
    console.log(`⚠️ Admin ${adminUid} applied strike #${strikeCount} to user ${targetUid}`);
    return { success: true, strikeCount, autoBanApplied };
});
/**
 * Admin: Apply a warning to a user
 * Requires admin custom claim
 * Warnings are stored in UserWarnings collection and user is notified
 */
exports.adminApplyWarning = functions.https.onCall(async (data, context) => {
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required");
    }
    const { targetUid, reason, details, reportId } = data;
    const adminUid = context.auth.uid;
    if (!targetUid || !reason) {
        throw new functions.https.HttpsError("invalid-argument", "Missing targetUid or reason");
    }
    const now = Date.now();
    const warningId = `${targetUid}_${now}`;
    // Create warning record
    const warning = {
        id: warningId,
        uid: targetUid,
        reason,
        details: details || null,
        issuedBy: adminUid,
        issuedAt: now,
        reportId: reportId || null,
        status: "unread",
    };
    await db.collection("UserWarnings").doc(warningId).set(warning);
    // Log the event
    await logDomainEvent("warning_issued", adminUid, {
        targetUid,
        reason,
        warningId,
        reportId,
    });
    // Try to send push notification to the user
    try {
        const userDoc = await db.collection("Users").doc(targetUid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const pushToken = userData?.expoPushToken;
            if (pushToken) {
                await sendExpoPushNotificationWithCleanup({
                    to: pushToken,
                    title: "Warning from SnapStyle",
                    body: "You have received a warning. Please review it in the app.",
                    data: { type: "warning", warningId },
                }, targetUid);
            }
        }
    }
    catch (error) {
        console.error("Failed to send warning push notification:", error);
        // Don't throw - warning was still created
    }
    console.log(`⚠️ Admin ${adminUid} issued warning to user ${targetUid} for ${reason}`);
    return { success: true, warningId };
});
/**
 * Admin: Resolve a report
 * Requires admin custom claim
 */
exports.adminResolveReport = functions.https.onCall(async (data, context) => {
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required");
    }
    const { reportId, resolution, actionTaken } = data;
    const adminUid = context.auth.uid;
    if (!reportId || !resolution || !actionTaken) {
        throw new functions.https.HttpsError("invalid-argument", "Missing reportId, resolution, or actionTaken");
    }
    const reportRef = db.collection("Reports").doc(reportId);
    const reportDoc = await reportRef.get();
    if (!reportDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Report not found");
    }
    const now = Date.now();
    await reportRef.update({
        status: actionTaken === "none" ? "dismissed" : "resolved",
        reviewedBy: adminUid,
        reviewedAt: now,
        resolution,
        actionTaken,
    });
    // Log the event
    await logDomainEvent("report_resolved", adminUid, {
        reportId,
        actionTaken,
    });
    console.log(`✅ Admin ${adminUid} resolved report ${reportId} with action: ${actionTaken}`);
    return { success: true };
});
/**
 * Admin: Set admin claim on a user
 * Only callable by existing admins
 */
exports.adminSetAdminClaim = functions.https.onCall(async (data, context) => {
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required");
    }
    const { targetUid, isAdmin: setAdmin } = data;
    if (!targetUid) {
        throw new functions.https.HttpsError("invalid-argument", "Missing targetUid");
    }
    await admin.auth().setCustomUserClaims(targetUid, { admin: setAdmin });
    console.log(`✅ Set admin=${setAdmin} for user ${targetUid}`);
    return { success: true };
});
/**
 * HTTP endpoint to set the first admin (use once during setup)
 * Protected by a secret key from environment
 */
exports.initializeFirstAdmin = functions.https.onRequest(async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    const authResult = await (0, httpAuth_1.authorizeAdminHttpRequest)(req, {
        allowAdminToken: false,
        allowSetupKey: true,
        requireSetupKey: true,
    });
    if (!authResult.ok) {
        res.status(authResult.status).json({ error: authResult.error });
        return;
    }
    const { uid } = req.body;
    if (!uid) {
        res.status(400).json({ error: "Missing uid" });
        return;
    }
    try {
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        console.log(`✅ Initialized first admin: ${uid}`);
        res.json({ success: true, message: `User ${uid} is now an admin` });
    }
    catch (error) {
        console.error("Error setting admin:", error);
        res.status(500).json({ error: error.message });
    }
});
// ============================================
// DOMAIN EVENTS (For Migration Prep)
// ============================================
/**
 * Log a domain event for future sync/migration
 */
async function logDomainEvent(type, uid, payload) {
    try {
        await db.collection("Events").add({
            type,
            uid,
            payload,
            createdAt: Date.now(),
            version: 1,
            processed: false,
        });
    }
    catch (error) {
        console.error("Error logging domain event:", error);
        // Don't throw - events are non-critical
    }
}
/**
 * Trigger to log message events
 */
exports.onNewMessageEvent = functions.firestore
    .document("Chats/{chatId}/Messages/{messageId}")
    .onCreate(async (snap, context) => {
    const message = snap.data();
    await logDomainEvent("message_sent", message.sender, {
        chatId: context.params.chatId,
        messageId: context.params.messageId,
        type: message.type,
    });
});
/**
 * Trigger to log report events
 */
exports.onNewReport = functions.firestore
    .document("Reports/{reportId}")
    .onCreate(async (snap) => {
    const report = snap.data();
    await logDomainEvent("report_submitted", report.reporterId, {
        reportId: snap.id,
        reportedUserId: report.reportedUserId,
        reason: report.reason,
    });
});
// ============================================
// BAN EXPIRATION CHECK (Scheduled)
// ============================================
/**
 * Scheduled function to update expired bans
 * Runs every hour to mark expired bans as inactive
 */
exports.updateExpiredBans = functions.pubsub
    .schedule("every 1 hours")
    .onRun(async () => {
    console.log("🔄 Checking for expired bans...");
    const now = Date.now();
    const expiredBansQuery = await db
        .collection("Bans")
        .where("status", "==", "active")
        .where("expiresAt", "<=", now)
        .get();
    if (expiredBansQuery.empty) {
        console.log("✅ No expired bans found");
        return null;
    }
    const batch = db.batch();
    expiredBansQuery.docs.forEach((doc) => {
        batch.update(doc.ref, { status: "expired" });
    });
    await batch.commit();
    console.log(`✅ Marked ${expiredBansQuery.docs.length} bans as expired`);
    return null;
});
// Re-export Link Preview function
exports.fetchLinkPreview = linkPreview_1.fetchLinkPreviewFunction;
//# sourceMappingURL=legacy.js.map