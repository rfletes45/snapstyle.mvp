"use strict";
/**
 * Games V4 — Shared Backend Helpers
 *
 * Utility functions used across all V4 Cloud Functions:
 * auth assertions, membership checks, pinning, ID generation.
 *
 * @module gamesV4/helpers
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
exports.getDb = getDb;
exports.assertAuth = assertAuth;
exports.isConversationMember = isConversationMember;
exports.assertConversationMember = assertConversationMember;
exports.getConversationMemberIds = getConversationMemberIds;
exports.pinInviteToConversation = pinInviteToConversation;
exports.unpinInviteFromConversation = unpinInviteFromConversation;
exports.generateTraceId = generateTraceId;
exports.serverTimestamp = serverTimestamp;
exports.nowMs = nowMs;
exports.getUserProfile = getUserProfile;
exports.computeIntegrityHash = computeIntegrityHash;
exports.currentWeekKey = currentWeekKey;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("./types");
// =============================================================================
// Firestore accessor
// =============================================================================
function getDb() {
    return admin.firestore();
}
// =============================================================================
// Auth helpers
// =============================================================================
/**
 * Assert the caller is authenticated, returning their UID.
 * Throws `unauthenticated` HttpsError if not.
 */
function assertAuth(context) {
    if (!context.auth?.uid) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    return context.auth.uid;
}
// =============================================================================
// Membership helpers
// =============================================================================
/**
 * Check if a user is a member of a conversation (DM or group).
 */
async function isConversationMember(uid, conversationId, scope) {
    const db = getDb();
    if (scope === "dm") {
        const chatDoc = await db.collection("Chats").doc(conversationId).get();
        if (!chatDoc.exists)
            return false;
        const members = chatDoc.data()?.members || [];
        return members.includes(uid);
    }
    else {
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
 * Assert the caller is a member of the conversation.
 * Throws `permission-denied` if not.
 */
async function assertConversationMember(uid, conversationId, scope) {
    const isMember = await isConversationMember(uid, conversationId, scope);
    if (!isMember) {
        throw new functions.https.HttpsError("permission-denied", "You are not a member of this conversation.");
    }
}
/**
 * Get all member UIDs for a conversation.
 */
async function getConversationMemberIds(conversationId, scope) {
    const db = getDb();
    if (scope === "dm") {
        const chatDoc = await db.collection("Chats").doc(conversationId).get();
        return chatDoc.exists ? chatDoc.data()?.members || [] : [];
    }
    else {
        const snap = await db
            .collection("Groups")
            .doc(conversationId)
            .collection("Members")
            .get();
        return snap.docs.map((d) => d.id);
    }
}
// =============================================================================
// Pinning helpers
// =============================================================================
/** Collection name for the conversation doc (Chats or Groups). */
function conversationCollection(scope) {
    return scope === "dm" ? "Chats" : "Groups";
}
/**
 * Pin an invite ID to the conversation's pinnedGameInviteIds array.
 * Respects MAX_PINNED_INVITES — oldest are evicted (FIFO) if at capacity.
 */
async function pinInviteToConversation(conversationId, scope, inviteId) {
    const db = getDb();
    const docRef = db
        .collection(conversationCollection(scope))
        .doc(conversationId);
    await db.runTransaction(async (tx) => {
        const doc = await tx.get(docRef);
        const current = doc.data()?.[types_1.PINNED_INVITE_IDS_FIELD] || [];
        // Already pinned
        if (current.includes(inviteId))
            return;
        // Evict oldest if at capacity
        const updated = [...current, inviteId];
        while (updated.length > types_1.MAX_PINNED_INVITES) {
            updated.shift();
        }
        tx.update(docRef, { [types_1.PINNED_INVITE_IDS_FIELD]: updated });
    });
}
/**
 * Unpin an invite ID from the conversation.
 */
async function unpinInviteFromConversation(conversationId, scope, inviteId) {
    const db = getDb();
    const docRef = db
        .collection(conversationCollection(scope))
        .doc(conversationId);
    await docRef.update({
        [types_1.PINNED_INVITE_IDS_FIELD]: admin.firestore.FieldValue.arrayRemove(inviteId),
    });
}
// =============================================================================
// ID & trace generation
// =============================================================================
/** Generate a random trace ID for debugging. */
function generateTraceId() {
    return crypto.randomBytes(16).toString("hex");
}
/** Server timestamp shorthand. */
function serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
}
/** Current epoch millis. */
function nowMs() {
    return Date.now();
}
/**
 * Fetch minimal profile data for a user.
 */
async function getUserProfile(uid) {
    const db = getDb();
    const doc = await db.collection("Users").doc(uid).get();
    if (!doc.exists)
        return null;
    const data = doc.data();
    return {
        displayName: data.displayName || "Unknown",
        avatarConfig: data.avatarConfig,
        profilePictureUrl: data.profilePictureUrl ?? null,
    };
}
// =============================================================================
// Integrity hash
// =============================================================================
/**
 * Compute an integrity hash for PB anti-forgery.
 */
function computeIntegrityHash(uid, gameId, pbValue, sessionId) {
    const payload = `${uid}:${gameId}:${pbValue}:${sessionId ?? "none"}`;
    return crypto.createHash("sha256").update(payload).digest("hex");
}
// =============================================================================
// Week key for leaderboards
// =============================================================================
/**
 * Compute a weekly leaderboard key: "YYYY-Wnn" (ISO week).
 */
function currentWeekKey() {
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const weekNumber = Math.ceil(dayOfYear / 7);
    return `${now.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}
//# sourceMappingURL=helpers.js.map