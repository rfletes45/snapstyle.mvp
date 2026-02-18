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
exports.markInboxRead = exports.onGroupMessageInbox = exports.onDMMessageInbox = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
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
    if (kind === "text" && text) {
        return text.length > 80 ? text.substring(0, 80) + "…" : text;
    }
    if (kind === "media")
        return "📷 Photo";
    if (kind === "voice")
        return "🎤 Voice message";
    if (kind === "file")
        return "📎 File";
    if (kind === "system")
        return text || "System message";
    if (kind === "scorecard" || kind === "game_invite")
        return "🎮 Game";
    return text || "";
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
        console.error(`[inboxTriggers] getGroupMemberUids error:`, error);
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
        console.error("[onDMMessageInbox] Error:", error);
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
    try {
        // Fetch group metadata
        const groupDoc = await db.collection("Groups").doc(groupId).get();
        const groupName = groupDoc.data()?.name || "Group Chat";
        const avatarPath = groupDoc.data()?.avatarPath || "";
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
                    lastMessageKind: kind,
                    lastMessagePreview: preview,
                    groupName,
                    avatarPath,
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
        console.error("[onGroupMessageInbox] Error:", error);
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
        }, { merge: true });
        return { success: true };
    }
    catch (error) {
        console.error("[markInboxRead] Error:", error);
        throw new functions.https.HttpsError("internal", "Failed to update inbox");
    }
});
//# sourceMappingURL=inboxTriggers.js.map