"use strict";
/**
 * Message Requests Cloud Functions (Segment 5)
 *
 * Enforces the recipient's `dmAcceptance` setting when a non-friend
 * sends a DM for the first time.
 *
 * Flow:
 *  1. `checkDmAcceptance()` is called from sendMessageV2 before write.
 *  2. If the recipient allows everyone → pass.
 *  3. If the recipient requires friends-only or requests:
 *     a. Check the Friends collection for a friendship doc.
 *     b. If friends → pass.
 *     c. If friends_only → reject ("This user isn't accepting DMs").
 *     d. If requests → create a MessageRequest doc and return "request_created".
 *  4. `acceptMessageRequest` callable → sets status to "accepted", allows
 *     future messages.
 *  5. `declineMessageRequest` callable → sets status to "declined", optionally
 *     blocks the requester.
 *
 * @module functions/messageRequests
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
exports.declineMessageRequest = exports.acceptMessageRequest = void 0;
exports.checkDmAcceptance = checkDmAcceptance;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const callableSecurity_1 = require("./callableSecurity");
function getDb() {
    return admin.firestore();
}
// =============================================================================
// Helpers
// =============================================================================
/**
 * Determine if two users are friends by checking the Friends collection.
 * Friends docs have `{ users: [uid1, uid2] }`.
 */
async function areFriends(uid1, uid2) {
    const db = getDb();
    const snap = await db
        .collection("Friends")
        .where("users", "array-contains", uid1)
        .get();
    return snap.docs.some((doc) => {
        const users = doc.data().users || [];
        return users.includes(uid2);
    });
}
/**
 * Read the recipient's dmAcceptance setting from their settings doc.
 * Falls back to "everyone" if unset (default production behaviour).
 */
async function getDmAcceptance(uid) {
    const db = getDb();
    // Check chatSettings doc first (V3), fall back to inbox settings
    const chatSettingsDoc = await db
        .collection("Users")
        .doc(uid)
        .collection("settings")
        .doc("chatSettings")
        .get();
    if (chatSettingsDoc.exists) {
        const val = chatSettingsDoc.data()?.dmAcceptance;
        if (val === "friends_only" || val === "requests")
            return val;
        return "everyone";
    }
    // Fallback: inbox settings doc
    const inboxDoc = await db
        .collection("Users")
        .doc(uid)
        .collection("settings")
        .doc("inbox")
        .get();
    if (inboxDoc.exists) {
        const val = inboxDoc.data()?.dmAcceptance;
        if (val === "friends_only" || val === "requests")
            return val;
    }
    return "everyone";
}
/**
 * Check whether a message request already exists for this chat → recipient.
 */
async function getExistingRequest(recipientUid, chatId) {
    const db = getDb();
    const doc = await db
        .collection("Users")
        .doc(recipientUid)
        .collection("MessageRequests")
        .doc(chatId)
        .get();
    return doc.exists ? doc : null;
}
/**
 * Pre-send check for DM conversations.
 *
 * Called from `sendMessageV2` after membership + block checks.
 *
 * @returns outcome "allowed" | "request_created" | "rejected"
 */
async function checkDmAcceptance(senderId, recipientUid, chatId, messagePreview, messageKind) {
    // 1. Read recipient's setting
    const acceptance = await getDmAcceptance(recipientUid);
    if (acceptance === "everyone") {
        return { outcome: "allowed" };
    }
    // 2. Check friendship
    const friends = await areFriends(senderId, recipientUid);
    if (friends) {
        return { outcome: "allowed" };
    }
    // 3. Not friends — decide based on setting
    if (acceptance === "friends_only") {
        return {
            outcome: "rejected",
            reason: "This user isn't accepting DMs from non-friends",
        };
    }
    // acceptance === "requests"
    // 4. Check if we already have a pending/accepted request for this chat
    const existing = await getExistingRequest(recipientUid, chatId);
    if (existing) {
        const status = existing.data()?.status;
        if (status === "accepted") {
            // Already accepted — allow
            return { outcome: "allowed" };
        }
        if (status === "pending") {
            // Already pending — don't create a duplicate, still block
            return { outcome: "request_created" };
        }
        if (status === "declined") {
            // Previously declined — reject
            return {
                outcome: "rejected",
                reason: "Your message request was declined",
            };
        }
    }
    // 5. Create a new message request
    const db = getDb();
    const senderProfile = await db.collection("Users").doc(senderId).get();
    const senderName = senderProfile.data()?.displayName || "Someone";
    const senderAvatarConfig = senderProfile.data()?.avatarConfig || null;
    await db
        .collection("Users")
        .doc(recipientUid)
        .collection("MessageRequests")
        .doc(chatId)
        .set({
        chatId,
        requesterId: senderId,
        requesterName: senderName,
        requesterAvatarConfig: senderAvatarConfig,
        status: "pending",
        createdAt: Date.now(),
        messagePreview: messagePreview.length > 80
            ? messagePreview.substring(0, 80) + "…"
            : messagePreview,
        messageKind,
    });
    console.log(`[checkDmAcceptance] Created message request: ${senderId.substring(0, 8)} → ${recipientUid.substring(0, 8)} chat=${chatId.substring(0, 8)}`);
    return { outcome: "request_created" };
}
// =============================================================================
// B) acceptMessageRequest callable
// =============================================================================
/**
 * Accept a pending DM message request.
 *
 * Sets the request status to "accepted" so future messages
 * from the requester bypass the gating check.
 */
exports.acceptMessageRequest = (0, callableSecurity_1.secureCallableRuntime)().https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const { chatId } = data;
    if (!chatId || typeof chatId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "chatId is required");
    }
    const uid = context.auth.uid;
    const db = getDb();
    const reqRef = db
        .collection("Users")
        .doc(uid)
        .collection("MessageRequests")
        .doc(chatId);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Message request not found");
    }
    const status = reqDoc.data()?.status;
    if (status === "accepted") {
        return { success: true }; // idempotent
    }
    await reqRef.update({
        status: "accepted",
        resolvedAt: Date.now(),
    });
    console.log(`[acceptMessageRequest] ${uid.substring(0, 8)} accepted request for chat ${chatId.substring(0, 8)}`);
    return { success: true };
});
// =============================================================================
// C) declineMessageRequest callable
// =============================================================================
/**
 * Decline a pending DM message request.
 *
 * Optionally blocks the requester.
 */
exports.declineMessageRequest = (0, callableSecurity_1.secureCallableRuntime)().https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const { chatId, blockRequester } = data;
    if (!chatId || typeof chatId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "chatId is required");
    }
    const uid = context.auth.uid;
    const db = getDb();
    const reqRef = db
        .collection("Users")
        .doc(uid)
        .collection("MessageRequests")
        .doc(chatId);
    const reqDoc = await reqRef.get();
    if (!reqDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Message request not found");
    }
    const batch = db.batch();
    // Update request status
    batch.update(reqRef, {
        status: "declined",
        resolvedAt: Date.now(),
    });
    // Optionally block the requester
    if (blockRequester) {
        const requesterId = reqDoc.data()?.requesterId;
        if (requesterId) {
            const blockRef = db
                .collection("Users")
                .doc(uid)
                .collection("blockedUsers")
                .doc(requesterId);
            batch.set(blockRef, {
                blockedUserId: requesterId,
                blockedAt: Date.now(),
            });
        }
    }
    await batch.commit();
    console.log(`[declineMessageRequest] ${uid.substring(0, 8)} declined request for chat ${chatId.substring(0, 8)}` +
        (blockRequester ? " (blocked)" : ""));
    return { success: true };
});
//# sourceMappingURL=messageRequests.js.map