"use strict";
/**
 * Messaging V2 Cloud Functions
 *
 * Server-side message handling with:
 * - Idempotent message creation
 * - Server-authoritative timestamps
 * - Block/rate limit enforcement
 * - Membership validation
 *
 * @module functions/messaging
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
exports.toggleReactionV2Function = exports.sendMessageV2Function = exports.editMessageV2Function = exports.deleteMessageForAllV2Function = exports.toggleReactionV2 = exports.deleteMessageForAllV2 = exports.editMessageV2 = exports.sendMessageV2 = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
// Lazy initialization to avoid "app not initialized" error
// The app is initialized in index.ts before these functions are called
function getDb() {
    return admin.firestore();
}
// =============================================================================
// Input Validation Helpers
// =============================================================================
/**
 * Validate a string parameter
 */
function isValidString(value, minLen = 1, maxLen = 10000) {
    if (typeof value !== "string")
        return false;
    if (value.length < minLen || value.length > maxLen)
        return false;
    return true;
}
/**
 * Validate a user ID format
 */
function isValidUid(value) {
    if (typeof value !== "string")
        return false;
    return (value.length >= 20 && value.length <= 128 && /^[a-zA-Z0-9]+$/.test(value));
}
/**
 * Sanitize input for logging (remove PII)
 */
function sanitizeForLog(obj) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (key === "text" && typeof value === "string") {
            sanitized[key] = value.length > 0 ? `[${value.length} chars]` : "[empty]";
        }
        else if (typeof value === "string" && value.length > 50) {
            sanitized[key] = value.substring(0, 20) + "...";
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
// =============================================================================
// Authorization Helpers
// =============================================================================
/**
 * Check if user is a member of a conversation
 */
async function checkMembership(conversationId, scope, uid) {
    const db = getDb();
    if (scope === "dm") {
        const chatDoc = await db.collection("Chats").doc(conversationId).get();
        if (!chatDoc.exists)
            return false;
        const members = chatDoc.data()?.members || [];
        return members.includes(uid);
    }
    else {
        // For groups, check Members subcollection
        const memberDoc = await db
            .collection("Groups")
            .doc(conversationId)
            .collection("Members")
            .doc(uid)
            .get();
        return memberDoc.exists;
    }
}
/**
 * Check if users have blocked each other
 */
async function isBlocked(uid1, uid2) {
    const db = getDb();
    // Check if uid1 blocked uid2
    const block1 = await db
        .collection("Users")
        .doc(uid1)
        .collection("blockedUsers")
        .doc(uid2)
        .get();
    if (block1.exists)
        return true;
    // Check if uid2 blocked uid1
    const block2 = await db
        .collection("Users")
        .doc(uid2)
        .collection("blockedUsers")
        .doc(uid1)
        .get();
    return block2.exists;
}
/**
 * Get all members of a DM chat
 */
async function getChatMembers(chatId) {
    const db = getDb();
    const chatDoc = await db.collection("Chats").doc(chatId).get();
    return chatDoc.exists ? chatDoc.data()?.members || [] : [];
}
/**
 * Get user profile for sender info
 */
async function getUserProfile(uid) {
    const db = getDb();
    const userDoc = await db.collection("Users").doc(uid).get();
    if (!userDoc.exists)
        return null;
    const data = userDoc.data();
    return {
        displayName: data.displayName,
        avatarConfig: data.avatarConfig,
    };
}
// =============================================================================
// Rate Limiting
// =============================================================================
const RATE_LIMIT_MESSAGES_PER_MINUTE = 30;
/**
 * Check and update rate limit for message sending
 *
 * Uses atomic FieldValue.increment to prevent race conditions.
 * Window is reset when expired, using server timestamp for consistency.
 */
async function checkRateLimit(uid) {
    const db = getDb();
    const rateLimitRef = db.collection("RateLimits").doc(`messages_${uid}`);
    const now = Date.now();
    try {
        const result = await db.runTransaction(async (transaction) => {
            const rateLimitDoc = await transaction.get(rateLimitRef);
            if (!rateLimitDoc.exists) {
                // First message - initialize with count=1
                transaction.set(rateLimitRef, {
                    windowStart: now,
                    count: 1,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                });
                return true;
            }
            const data = rateLimitDoc.data();
            const windowStart = data.windowStart || 0;
            const count = data.count || 0;
            // Check if window has expired (1 minute)
            if (now - windowStart >= 60000) {
                // Reset window - atomic set with count=1
                transaction.set(rateLimitRef, {
                    windowStart: now,
                    count: 1,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                });
                return true;
            }
            // Check if within limit BEFORE incrementing
            if (count >= RATE_LIMIT_MESSAGES_PER_MINUTE) {
                return false;
            }
            // Increment counter
            transaction.update(rateLimitRef, {
                count: admin.firestore.FieldValue.increment(1),
            });
            return true;
        });
        return result;
    }
    catch (error) {
        console.error("[checkRateLimit] Error:", error);
        // Allow on error to prevent blocking legitimate users
        return true;
    }
}
// =============================================================================
// sendMessageV2 Callable
// =============================================================================
/**
 * Idempotent message creation with server-authoritative timestamp
 *
 * Key features:
 * 1. Uses messageId as document ID for idempotency
 * 2. Sets serverReceivedAt on server (not client-editable)
 * 3. Validates membership before write
 * 4. Checks block status for DMs
 * 5. Enforces rate limits
 */
exports.sendMessageV2 = functions.https.onCall(async (data, context) => {
    const db = getDb();
    // 1. Auth check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in to send messages");
    }
    const senderId = context.auth.uid;
    const { conversationId, scope, kind, text, replyTo, mentionUids, attachments, clientId, messageId, createdAt, } = data;
    console.log(`[sendMessageV2] Request from ${senderId.substring(0, 8)}:`, sanitizeForLog({ conversationId, scope, kind, messageId }));
    // 2. Validate required fields
    if (!isValidString(conversationId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid conversationId");
    }
    if (!["dm", "group"].includes(scope)) {
        throw new functions.https.HttpsError("invalid-argument", "Scope must be 'dm' or 'group'");
    }
    if (!["text", "media", "voice", "file", "system", "scorecard"].includes(kind)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid message kind");
    }
    if (!isValidString(clientId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid clientId");
    }
    if (!isValidString(messageId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid messageId");
    }
    // Validate text content if present
    if (text !== undefined && text !== null && !isValidString(text, 0, 10000)) {
        throw new functions.https.HttpsError("invalid-argument", "Text content too long (max 10000 chars)");
    }
    // Validate kind requires content
    if (kind === "text" && (!text || text.trim().length === 0)) {
        throw new functions.https.HttpsError("invalid-argument", "Text messages must have content");
    }
    // Validate mentions count
    if (mentionUids && mentionUids.length > 5) {
        throw new functions.https.HttpsError("invalid-argument", "Maximum 5 mentions per message");
    }
    // Validate attachments
    if (attachments && attachments.length > 10) {
        throw new functions.https.HttpsError("invalid-argument", "Maximum 10 attachments per message");
    }
    // 3. Membership check
    const isMember = await checkMembership(conversationId, scope, senderId);
    if (!isMember) {
        console.log(`[sendMessageV2] Non-member attempt: ${senderId.substring(0, 8)}`);
        throw new functions.https.HttpsError("permission-denied", "Not a member of this conversation");
    }
    // 4. Block check (DM only)
    if (scope === "dm") {
        const members = await getChatMembers(conversationId);
        const otherUid = members.find((m) => m !== senderId);
        if (otherUid) {
            const blocked = await isBlocked(senderId, otherUid);
            if (blocked) {
                console.log(`[sendMessageV2] Blocked user attempt: ${senderId.substring(0, 8)} <-> ${otherUid.substring(0, 8)}`);
                throw new functions.https.HttpsError("permission-denied", "Cannot send message to this user");
            }
        }
    }
    // 5. Rate limit check
    const rateLimitOk = await checkRateLimit(senderId);
    if (!rateLimitOk) {
        console.log(`[sendMessageV2] Rate limited: ${senderId.substring(0, 8)}`);
        throw new functions.https.HttpsError("resource-exhausted", "Rate limit exceeded. Please wait before sending more messages.");
    }
    // 6. Build collection path
    const collectionPath = scope === "dm"
        ? `Chats/${conversationId}/Messages`
        : `Groups/${conversationId}/Messages`;
    // 7. IDEMPOTENCY: Check if message already exists
    const existingDoc = await db
        .collection(collectionPath)
        .doc(messageId)
        .get();
    if (existingDoc.exists) {
        console.log(`[sendMessageV2] Idempotent return for existing message ${messageId.substring(0, 8)}`);
        const existingData = existingDoc.data();
        return {
            success: true,
            message: {
                id: existingDoc.id,
                ...existingData,
                serverReceivedAt: existingData.serverReceivedAt?.toMillis?.() ||
                    existingData.serverReceivedAt ||
                    Date.now(),
            },
            isExisting: true,
        };
    }
    // 8. Build message document
    const serverNow = Date.now();
    const idempotencyKey = `${clientId}:${messageId}`;
    // Map kind to legacy type field
    const legacyTypeMap = {
        text: "text",
        media: "image",
        voice: "voice",
        scorecard: "scorecard",
        system: "system",
        file: "text", // files shown as text in legacy
    };
    const legacyType = legacyTypeMap[kind] || "text";
    const messageData = {
        id: messageId,
        scope,
        conversationId,
        // New unified field names
        senderId,
        kind,
        text: text || "",
        // Legacy field names for backward compatibility with groups.ts subscription
        sender: senderId,
        type: legacyType,
        content: text || "",
        // Timestamps
        createdAt: createdAt || serverNow,
        serverReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
        idempotencyKey,
        clientId,
    };
    // Add optional fields
    if (replyTo) {
        messageData.replyTo = replyTo;
    }
    if (mentionUids && mentionUids.length > 0) {
        messageData.mentionUids = mentionUids;
    }
    if (attachments && attachments.length > 0) {
        messageData.attachments = attachments;
    }
    // For groups, add sender profile snapshot
    if (scope === "group") {
        const senderProfile = await getUserProfile(senderId);
        if (senderProfile) {
            messageData.senderName = senderProfile.displayName;
            messageData.senderDisplayName = senderProfile.displayName; // Legacy field
            messageData.senderAvatarConfig = senderProfile.avatarConfig;
        }
    }
    // 9. Write message document
    console.log(`[sendMessageV2] Creating message ${messageId.substring(0, 8)}`);
    await db.collection(collectionPath).doc(messageId).set(messageData);
    // 10. Update conversation preview (lastMessage fields)
    const previewText = getPreviewText(kind, text, attachments);
    const conversationRef = scope === "dm"
        ? db.collection("Chats").doc(conversationId)
        : db.collection("Groups").doc(conversationId);
    try {
        await conversationRef.update({
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageId: messageId,
            lastMessageText: previewText, // Match field name used by ChatListScreen
            lastMessageKind: kind,
            lastMessageSenderId: senderId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (updateError) {
        // Log but don't fail - preview is not critical
        console.warn(`[sendMessageV2] Failed to update conversation preview:`, updateError);
    }
    console.log(`[sendMessageV2] Successfully created message ${messageId.substring(0, 8)}`);
    return {
        success: true,
        message: {
            id: messageId,
            ...messageData,
            serverReceivedAt: serverNow, // Approximate for immediate response
        },
        isExisting: false,
    };
});
exports.sendMessageV2Function = exports.sendMessageV2;
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Generate preview text for conversation list
 */
function getPreviewText(kind, text, attachments) {
    if (kind === "text" && text) {
        return text.length > 50 ? text.substring(0, 50) + "..." : text;
    }
    if (kind === "media") {
        const count = attachments?.length || 1;
        if (count > 1)
            return `📷 ${count} photos`;
        const attachment = attachments?.[0];
        if (attachment?.kind === "video")
            return "📹 Video";
        return "📷 Photo";
    }
    if (kind === "voice")
        return "🎤 Voice message";
    if (kind === "file")
        return "📎 File";
    if (kind === "system")
        return text || "System message";
    return text || "";
}
// =============================================================================
// H7: Edit Message Cloud Function
// =============================================================================
/** Edit window in milliseconds (15 minutes) */
const EDIT_WINDOW_MS = 15 * 60 * 1000;
/**
 * Edit a message (sender only, within edit window)
 *
 * Rules:
 * - Only sender can edit
 * - Must be within 15-minute window
 * - Only text field can change
 * - Cannot edit deleted messages
 */
exports.editMessageV2 = functions.https.onCall(async (data, context) => {
    const db = getDb();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in to edit messages");
    }
    const uid = context.auth.uid;
    const { conversationId, scope, messageId, newText } = data;
    console.log(`[editMessageV2] Request from ${uid.substring(0, 8)}: messageId=${messageId.substring(0, 8)}`);
    // Validate inputs
    if (!isValidString(conversationId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid conversationId");
    }
    if (!["dm", "group"].includes(scope)) {
        throw new functions.https.HttpsError("invalid-argument", "Scope must be 'dm' or 'group'");
    }
    if (!isValidString(messageId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid messageId");
    }
    if (!isValidString(newText, 1, 10000)) {
        throw new functions.https.HttpsError("invalid-argument", "New text must be 1-10000 characters");
    }
    // Get the message
    const collectionPath = scope === "dm"
        ? `Chats/${conversationId}/Messages`
        : `Groups/${conversationId}/Messages`;
    const messageRef = db.collection(collectionPath).doc(messageId);
    const messageDoc = await messageRef.get();
    if (!messageDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Message not found");
    }
    const messageData = messageDoc.data();
    // Check sender
    if (messageData.senderId !== uid) {
        throw new functions.https.HttpsError("permission-denied", "Can only edit your own messages");
    }
    // Check if deleted
    if (messageData.deletedForAll) {
        throw new functions.https.HttpsError("failed-precondition", "Cannot edit a deleted message");
    }
    // Check message kind
    if (messageData.kind !== "text") {
        throw new functions.https.HttpsError("failed-precondition", "Can only edit text messages");
    }
    // Check edit window
    const serverReceivedAt = messageData.serverReceivedAt?.toMillis?.() ||
        messageData.serverReceivedAt ||
        messageData.createdAt;
    const elapsed = Date.now() - serverReceivedAt;
    if (elapsed > EDIT_WINDOW_MS) {
        throw new functions.https.HttpsError("failed-precondition", "Edit window has expired (15 minutes)");
    }
    // Perform edit
    const editedAt = Date.now();
    await messageRef.update({
        text: newText,
        editedAt,
        // Optionally store edit history
        editHistory: admin.firestore.FieldValue.arrayUnion({
            text: messageData.text,
            editedAt,
            editedBy: uid,
        }),
    });
    console.log(`[editMessageV2] Successfully edited message ${messageId.substring(0, 8)}`);
    return {
        success: true,
        editedAt,
    };
});
exports.editMessageV2Function = exports.editMessageV2;
/**
 * Get user's role in a group
 */
async function getGroupRole(groupId, uid) {
    const db = getDb();
    const memberDoc = await db
        .collection("Groups")
        .doc(groupId)
        .collection("Members")
        .doc(uid)
        .get();
    if (!memberDoc.exists)
        return null;
    return memberDoc.data()?.role || "member";
}
/**
 * Delete a message for all participants
 *
 * Rules:
 * - Sender can delete within edit window
 * - Group admins/mods can delete any message
 * - Sets deletedForAll marker
 * - Clears text and attachments
 */
exports.deleteMessageForAllV2 = functions.https.onCall(async (data, context) => {
    const db = getDb();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in to delete messages");
    }
    const uid = context.auth.uid;
    const { conversationId, scope, messageId } = data;
    console.log(`[deleteMessageForAllV2] Request from ${uid.substring(0, 8)}: messageId=${messageId.substring(0, 8)}`);
    // Validate inputs
    if (!isValidString(conversationId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid conversationId");
    }
    if (!["dm", "group"].includes(scope)) {
        throw new functions.https.HttpsError("invalid-argument", "Scope must be 'dm' or 'group'");
    }
    if (!isValidString(messageId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid messageId");
    }
    // Get the message
    const collectionPath = scope === "dm"
        ? `Chats/${conversationId}/Messages`
        : `Groups/${conversationId}/Messages`;
    const messageRef = db.collection(collectionPath).doc(messageId);
    const messageDoc = await messageRef.get();
    if (!messageDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Message not found");
    }
    const messageData = messageDoc.data();
    // Check if already deleted
    if (messageData.deletedForAll) {
        return {
            success: true,
            deletedAt: messageData.deletedForAll.at,
        };
    }
    // Authorization check
    let canDelete = false;
    const isSender = messageData.senderId === uid;
    if (isSender) {
        // Sender can always delete within edit window
        const serverReceivedAt = messageData.serverReceivedAt?.toMillis?.() ||
            messageData.serverReceivedAt ||
            messageData.createdAt;
        const elapsed = Date.now() - serverReceivedAt;
        if (elapsed <= EDIT_WINDOW_MS) {
            canDelete = true;
        }
    }
    // For groups, check admin/mod role
    if (!canDelete && scope === "group") {
        const role = await getGroupRole(conversationId, uid);
        if (role === "owner" || role === "admin" || role === "moderator") {
            canDelete = true;
        }
    }
    if (!canDelete) {
        throw new functions.https.HttpsError("permission-denied", "Not authorized to delete this message");
    }
    // Perform deletion
    const deletedAt = Date.now();
    await messageRef.update({
        deletedForAll: {
            by: uid,
            at: deletedAt,
        },
        text: "[Message deleted]",
        // Clear sensitive content
        attachments: admin.firestore.FieldValue.delete(),
        linkPreview: admin.firestore.FieldValue.delete(),
    });
    // NOTE: Trigger storage cleanup for attachments if needed
    // This could be done via a separate Cloud Function triggered by the update
    console.log(`[deleteMessageForAllV2] Successfully deleted message ${messageId.substring(0, 8)}`);
    return {
        success: true,
        deletedAt,
    };
});
exports.deleteMessageForAllV2Function = exports.deleteMessageForAllV2;
// =============================================================================
// H8: Toggle Reaction Cloud Function
// =============================================================================
/** Rate limit: max 10 reactions per minute per user */
const REACTION_RATE_LIMIT_PER_MINUTE = 10;
/** Max unique emojis per message */
const MAX_EMOJIS_PER_MESSAGE = 12;
/** Allowed emoji set */
const ALLOWED_EMOJIS = new Set([
    "👍",
    "👎",
    "❤️",
    "🔥",
    "😂",
    "😢",
    "😮",
    "😡",
    "🎉",
    "👏",
    "🙌",
    "💯",
    "⭐",
    "🚀",
    "💪",
    "🤔",
]);
/**
 * Check and update rate limit for reactions
 */
async function checkReactionRateLimit(uid) {
    const db = getDb();
    const rateLimitRef = db.collection("RateLimits").doc(`reactions_${uid}`);
    try {
        const result = await db.runTransaction(async (transaction) => {
            const rateLimitDoc = await transaction.get(rateLimitRef);
            if (!rateLimitDoc.exists) {
                transaction.set(rateLimitRef, { windowStart: Date.now(), count: 1 });
                return true;
            }
            const data = rateLimitDoc.data();
            const windowStart = data.windowStart || 0;
            const count = data.count || 0;
            // Check if window has expired (1 minute)
            if (Date.now() - windowStart >= 60000) {
                transaction.set(rateLimitRef, { windowStart: Date.now(), count: 1 });
                return true;
            }
            // Check if within limit
            if (count >= REACTION_RATE_LIMIT_PER_MINUTE) {
                return false;
            }
            // Increment counter
            transaction.update(rateLimitRef, {
                count: admin.firestore.FieldValue.increment(1),
            });
            return true;
        });
        return result;
    }
    catch (error) {
        console.error("[checkReactionRateLimit] Error:", error);
        return true; // Allow on error
    }
}
/**
 * Toggle a reaction on a message
 *
 * Features:
 * - Adds reaction if user hasn't reacted with this emoji
 * - Removes reaction if user already reacted with this emoji
 * - Updates Reactions subcollection per emoji
 * - Denormalizes summary on message document
 * - Rate limited (10/minute)
 * - Max 12 unique emojis per message
 */
exports.toggleReactionV2 = functions.https.onCall(async (data, context) => {
    const db = getDb();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in to react to messages");
    }
    const uid = context.auth.uid;
    const { conversationId, scope, messageId, emoji } = data;
    console.log(`[toggleReactionV2] Request from ${uid.substring(0, 8)}: emoji=${emoji} on message=${messageId.substring(0, 8)}`);
    // Validate inputs
    if (!isValidString(conversationId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid conversationId");
    }
    if (!["dm", "group"].includes(scope)) {
        throw new functions.https.HttpsError("invalid-argument", "Scope must be 'dm' or 'group'");
    }
    if (!isValidString(messageId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid messageId");
    }
    // Validate emoji
    if (!emoji || typeof emoji !== "string" || !ALLOWED_EMOJIS.has(emoji)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid or disallowed emoji");
    }
    // Membership check
    const isMember = await checkMembership(conversationId, scope, uid);
    if (!isMember) {
        throw new functions.https.HttpsError("permission-denied", "Not a member of this conversation");
    }
    // Rate limit check
    const rateLimitOk = await checkReactionRateLimit(uid);
    if (!rateLimitOk) {
        throw new functions.https.HttpsError("resource-exhausted", "Reaction rate limit exceeded. Please wait before reacting again.");
    }
    // Build paths
    const collectionPath = scope === "dm"
        ? `Chats/${conversationId}/Messages`
        : `Groups/${conversationId}/Messages`;
    const messageRef = db.collection(collectionPath).doc(messageId);
    const reactionRef = messageRef.collection("Reactions").doc(emoji);
    // Use transaction for atomic toggle
    const result = await db.runTransaction(async (transaction) => {
        // Get message
        const messageDoc = await transaction.get(messageRef);
        if (!messageDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Message not found");
        }
        const messageData = messageDoc.data();
        // Can't react to deleted messages
        if (messageData.deletedForAll) {
            throw new functions.https.HttpsError("failed-precondition", "Cannot react to a deleted message");
        }
        // Get current reaction doc
        const reactionDoc = await transaction.get(reactionRef);
        const currentSummary = messageData.reactionsSummary || {};
        let action;
        if (reactionDoc.exists) {
            const reactionData = reactionDoc.data();
            const uids = reactionData.uids || [];
            const hasReacted = uids.includes(uid);
            if (hasReacted) {
                // Remove reaction
                const newUids = uids.filter((u) => u !== uid);
                if (newUids.length === 0) {
                    // Delete reaction doc
                    transaction.delete(reactionRef);
                    delete currentSummary[emoji];
                }
                else {
                    // Update reaction doc
                    transaction.update(reactionRef, {
                        uids: newUids,
                        count: newUids.length,
                        updatedAt: Date.now(),
                    });
                    currentSummary[emoji] = newUids.length;
                }
                action = "removed";
            }
            else {
                // Add reaction
                const newUids = [...uids, uid];
                transaction.update(reactionRef, {
                    uids: newUids,
                    count: newUids.length,
                    updatedAt: Date.now(),
                });
                currentSummary[emoji] = newUids.length;
                action = "added";
            }
        }
        else {
            // New emoji reaction - check max emoji limit
            const uniqueEmojis = Object.keys(currentSummary).length;
            if (uniqueEmojis >= MAX_EMOJIS_PER_MESSAGE) {
                throw new functions.https.HttpsError("failed-precondition", `Maximum ${MAX_EMOJIS_PER_MESSAGE} unique emojis per message`);
            }
            // Create new reaction doc
            transaction.set(reactionRef, {
                emoji,
                uids: [uid],
                count: 1,
                updatedAt: Date.now(),
            });
            currentSummary[emoji] = 1;
            action = "added";
        }
        // Update message's denormalized summary
        transaction.update(messageRef, {
            reactionsSummary: currentSummary,
        });
        return { action, reactionsSummary: currentSummary };
    });
    console.log(`[toggleReactionV2] ${result.action} ${emoji} on message ${messageId.substring(0, 8)}`);
    return {
        success: true,
        action: result.action,
        reactionsSummary: result.reactionsSummary,
    };
});
exports.toggleReactionV2Function = exports.toggleReactionV2;
//# sourceMappingURL=messaging.js.map
