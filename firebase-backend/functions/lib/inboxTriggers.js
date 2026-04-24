"use strict";
/**
 * Inbox Trigger Cloud Functions (Segment 4)
 *
 * Firestore triggers that maintain per-user inbox aggregation docs
 * under Users/{uid}/Inbox/{threadId}.
 *
 * Thread ID format:
 *   - DMs:    "dm:{chatId}"
 *   - Groups: "group:{groupId}"
 *
 * These are activated automatically on message creation. The client
 * feature flag CHAT_INBOX_AGGREGATION controls whether the *client*
 * reads from this collection; the server always writes.
 *
 * @module functions/inboxTriggers
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
exports.onGroupMemberStateChanged = exports.onDMMemberStateChanged = exports.markInboxRead = exports.onGroupMessageInbox = exports.onDMMessageInbox = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const messagePreview_1 = require("./messagePreview");
function getDb() {
    return admin.firestore();
}
// =============================================================================
// Helpers
// =============================================================================
/**
 * Build a short preview string for the inbox entry.
 */
function buildPreview(kind, text) {
    const sanitizedText = (0, messagePreview_1.sanitizeMessagePreviewText)(text);
    // Scorecards embed a JSON sentinel in their `text` field. Never leak
    // that into the inbox preview — substitute the generic label.
    if (sanitizedText === messagePreview_1.SCORECARD_VISIBLE_TEXT) {
        return messagePreview_1.SCORECARD_VISIBLE_TEXT;
    }
    if (kind === "text" && sanitizedText) {
        return sanitizedText.length > 80
            ? sanitizedText.substring(0, 80) + "..."
            : sanitizedText;
    }
    if (kind === "system") {
        return sanitizedText || "System message";
    }
    if (kind === "text" && sanitizedText) {
        return text.length > 80 ? text.substring(0, 80) + "…" : text;
    }
    if (kind === "media")
        return "📷 Photo";
    if (kind === "gif")
        return "GIF";
    if (kind === "sticker")
        return "Sticker";
    if (kind === "voice")
        return "🎤 Voice message";
    if (kind === "file")
        return "📎 File";
    if (kind === "game")
        return "🎮 Game";
    return sanitizedText || "New message";
}
/**
 * Get all member UIDs of a group by listing the Members subcollection.
 */
async function getGroupMemberUids(groupId) {
    try {
        const snap = await getDb()
            .collection("Groups")
            .doc(groupId)
            .collection("Members")
            .get();
        return snap.docs.map((d) => d.id);
    }
    catch (error) {
        functions.logger.error("[inboxTriggers] getGroupMemberUids error", {
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}
// =============================================================================
// A) DM inbox trigger
// =============================================================================
/**
 * On new DM message → update both participants' inbox entries.
 *
 * Each participant gets an inbox doc at:
 *   Users/{uid}/Inbox/dm:{chatId}
 *
 * For the sender: lastActivityAt is updated but unreadCount is NOT incremented.
 * For the recipient: lastActivityAt updated AND unreadCount incremented.
 */
exports.onDMMessageInbox = functions.firestore
    .document("Chats/{chatId}/Messages/{messageId}")
    .onCreate(async (snap, context) => {
    const message = snap.data();
    const { chatId } = context.params;
    const db = getDb();
    // Skip system messages
    if (message.kind === "system" || message.type === "system") {
        return;
    }
    const senderId = message.senderId || message.sender;
    if (!senderId) {
        console.warn("[onDMMessageInbox] No senderId found on message");
        return;
    }
    const kind = message.kind || message.type || "text";
    const text = message.text || message.content;
    const preview = buildPreview(kind, text);
    const threadId = `dm:${chatId}`;
    try {
        // Fetch chat doc to get both members
        const chatDoc = await db.collection("Chats").doc(chatId).get();
        if (!chatDoc.exists) {
            console.warn(`[onDMMessageInbox] Chat ${chatId} not found`);
            return;
        }
        const members = chatDoc.data()?.members || [];
        if (members.length < 2)
            return;
        const batch = db.batch();
        for (const uid of members) {
            const inboxRef = db
                .collection("Users")
                .doc(uid)
                .collection("Inbox")
                .doc(threadId);
            const isSender = uid === senderId;
            const otherUid = members.find((m) => m !== uid) || "";
            // Fetch other user's name for display (best-effort)
            let otherUserName = "";
            try {
                const otherDoc = await db.collection("Users").doc(otherUid).get();
                otherUserName = otherDoc.data()?.displayName || "";
            }
            catch {
                // non-critical
            }
            const baseUpdate = {
                threadId,
                scope: "dm",
                conversationId: chatId,
                lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
                lastSenderId: senderId,
                lastMessageKind: kind,
                lastMessagePreview: preview,
                otherUserId: otherUid,
                otherUserName,
            };
            if (isSender) {
                // Sender: just update activity, reset their unread
                baseUpdate.unreadCount = 0;
                baseUpdate.unreadSince = null;
            }
            else {
                // Recipient: increment unread
                baseUpdate.unreadCount = admin.firestore.FieldValue.increment(1);
                // Set unreadSince only if currently 0 (first unread)
                // We'll use set with merge so existing unreadSince isn't overwritten
            }
            batch.set(inboxRef, baseUpdate, { merge: true });
        }
        await batch.commit();
        console.log(`[onDMMessageInbox] Updated inbox for chat ${chatId.substring(0, 8)}`);
    }
    catch (error) {
        functions.logger.error("[onDMMessageInbox] Error", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
// =============================================================================
// B) Group inbox trigger
// =============================================================================
/**
 * On new group message → update every member's inbox entry.
 *
 * Each member gets an inbox doc at:
 *   Users/{uid}/Inbox/group:{groupId}
 *
 * Sender gets unreadCount reset; other members get increment.
 */
exports.onGroupMessageInbox = functions.firestore
    .document("Groups/{groupId}/Messages/{messageId}")
    .onCreate(async (snap, context) => {
    const message = snap.data();
    const { groupId } = context.params;
    const db = getDb();
    // Skip system messages
    if (message.kind === "system" || message.type === "system") {
        return;
    }
    const senderId = message.senderId || message.sender;
    if (!senderId) {
        console.warn("[onGroupMessageInbox] No senderId found on message");
        return;
    }
    const kind = message.kind || message.type || "text";
    const text = message.text || message.content;
    const preview = buildPreview(kind, text);
    const threadId = `group:${groupId}`;
    const senderName = message.senderName || "";
    try {
        // Fetch group metadata
        const groupDoc = await db.collection("Groups").doc(groupId).get();
        const groupName = groupDoc.data()?.name || "Group Chat";
        const avatarPath = groupDoc.data()?.avatarPath || "";
        const avatarUrl = groupDoc.data()?.avatarUrl || "";
        const backgroundUrl = groupDoc.data()?.backgroundUrl || null;
        // Fetch all member UIDs
        const memberUids = await getGroupMemberUids(groupId);
        if (memberUids.length === 0)
            return;
        // Firestore batches max 500 operations — split if needed
        const BATCH_LIMIT = 450;
        for (let i = 0; i < memberUids.length; i += BATCH_LIMIT) {
            const chunk = memberUids.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            for (const uid of chunk) {
                const inboxRef = db
                    .collection("Users")
                    .doc(uid)
                    .collection("Inbox")
                    .doc(threadId);
                const isSender = uid === senderId;
                const baseUpdate = {
                    threadId,
                    scope: "group",
                    conversationId: groupId,
                    lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastSenderId: senderId,
                    lastSenderName: senderName,
                    lastMessageKind: kind,
                    lastMessagePreview: preview,
                    groupName,
                    avatarPath,
                    avatarUrl,
                    backgroundUrl,
                    memberCount: memberUids.length,
                };
                if (isSender) {
                    baseUpdate.unreadCount = 0;
                    baseUpdate.unreadSince = null;
                }
                else {
                    baseUpdate.unreadCount = admin.firestore.FieldValue.increment(1);
                }
                batch.set(inboxRef, baseUpdate, { merge: true });
            }
            await batch.commit();
        }
        console.log(`[onGroupMessageInbox] Updated ${memberUids.length} inbox entries for group ${groupId.substring(0, 8)}`);
    }
    catch (error) {
        functions.logger.error("[onGroupMessageInbox] Error", {
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
// =============================================================================
// C) Mark-read callable
// =============================================================================
/**
 * Callable to reset a user's unread count for a conversation.
 * Called when the user opens / views a chat.
 */
exports.markInboxRead = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const { threadId } = data;
    if (!threadId || typeof threadId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "threadId is required");
    }
    const uid = context.auth.uid;
    const db = getDb();
    try {
        const inboxRef = db
            .collection("Users")
            .doc(uid)
            .collection("Inbox")
            .doc(threadId);
        await inboxRef.set({
            unreadCount: 0,
            unreadSince: null,
            lastSeenAtPrivate: admin.firestore.FieldValue.serverTimestamp(),
            lastMarkedUnreadAt: null,
        }, { merge: true });
        return { success: true };
    }
    catch (error) {
        functions.logger.error("[markInboxRead] Error", {
            uid,
            threadId,
            error: error instanceof Error ? error.message : String(error),
        });
        throw new functions.https.HttpsError("internal", "Failed to update inbox");
    }
});
// =============================================================================
// D) Member State Sync Triggers
//
// When a user updates their private member state (pin, archive, mute) the
// change needs to propagate to their Inbox doc so the aggregated path can
// display correct state without extra per-conversation reads.
// =============================================================================
/**
 * Sync DM member state changes to the user's Inbox entry.
 */
exports.onDMMemberStateChanged = functions.firestore
    .document("Chats/{chatId}/MembersPrivate/{uid}")
    .onWrite(async (change, context) => {
    const { chatId, uid } = context.params;
    if (!change.after.exists)
        return;
    const before = change.before.exists ? change.before.data() || {} : {};
    const after = change.after.data() || {};
    // Sync all fields that affect inbox display + unread computation
    const changed = !change.before.exists ||
        before.pinnedAt !== after.pinnedAt ||
        before.archived !== after.archived ||
        before.mutedUntil !== after.mutedUntil ||
        before.notifyLevel !== after.notifyLevel ||
        before.deletedAt !== after.deletedAt ||
        before.hiddenUntilNewMessage !== after.hiddenUntilNewMessage ||
        before.lastSeenAtPrivate !== after.lastSeenAtPrivate ||
        before.lastMarkedUnreadAt !== after.lastMarkedUnreadAt;
    if (!changed)
        return;
    const db = getDb();
    const threadId = `dm:${chatId}`;
    const inboxRef = db
        .collection("Users")
        .doc(uid)
        .collection("Inbox")
        .doc(threadId);
    try {
        await inboxRef.set({
            pinnedAt: after.pinnedAt ?? null,
            archived: after.archived ?? false,
            mutedUntil: after.mutedUntil ?? null,
            notifyLevel: after.notifyLevel ?? "all",
            deletedAt: after.deletedAt ?? null,
            hiddenUntilNewMessage: after.hiddenUntilNewMessage ?? false,
            lastSeenAtPrivate: after.lastSeenAtPrivate ?? null,
            lastMarkedUnreadAt: after.lastMarkedUnreadAt ?? null,
        }, { merge: true });
    }
    catch (error) {
        functions.logger.error("[onDMMemberStateChanged] Error", {
            chatId,
            uid,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
/**
 * Sync group member state changes to the user's Inbox entry.
 */
exports.onGroupMemberStateChanged = functions.firestore
    .document("Groups/{groupId}/MembersPrivate/{uid}")
    .onWrite(async (change, context) => {
    const { groupId, uid } = context.params;
    if (!change.after.exists)
        return;
    const before = change.before.exists ? change.before.data() || {} : {};
    const after = change.after.data() || {};
    const changed = !change.before.exists ||
        before.pinnedAt !== after.pinnedAt ||
        before.archived !== after.archived ||
        before.mutedUntil !== after.mutedUntil ||
        before.notifyLevel !== after.notifyLevel ||
        before.deletedAt !== after.deletedAt ||
        before.hiddenUntilNewMessage !== after.hiddenUntilNewMessage ||
        before.lastSeenAtPrivate !== after.lastSeenAtPrivate ||
        before.lastMarkedUnreadAt !== after.lastMarkedUnreadAt;
    if (!changed)
        return;
    const db = getDb();
    const threadId = `group:${groupId}`;
    const inboxRef = db
        .collection("Users")
        .doc(uid)
        .collection("Inbox")
        .doc(threadId);
    try {
        await inboxRef.set({
            pinnedAt: after.pinnedAt ?? null,
            archived: after.archived ?? false,
            mutedUntil: after.mutedUntil ?? null,
            notifyLevel: after.notifyLevel ?? "all",
            deletedAt: after.deletedAt ?? null,
            hiddenUntilNewMessage: after.hiddenUntilNewMessage ?? false,
            lastSeenAtPrivate: after.lastSeenAtPrivate ?? null,
            lastMarkedUnreadAt: after.lastMarkedUnreadAt ?? null,
        }, { merge: true });
    }
    catch (error) {
        functions.logger.error("[onGroupMemberStateChanged] Error", {
            groupId,
            uid,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
//# sourceMappingURL=inboxTriggers.js.map