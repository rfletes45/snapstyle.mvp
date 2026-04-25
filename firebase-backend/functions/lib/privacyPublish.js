"use strict";
/**
 * Privacy-Enforced Publish APIs (Segment 7)
 *
 * Server-side callables that replace direct client Firestore writes for:
 * - typingAt
 * - lastDeliveredAtPublic
 * - lastReadAtPublic
 *
 * Each callable:
 * 1. Validates auth + membership
 * 2. Loads effective settings via server-side resolver
 * 3. If disabled by user's privacy settings → no-op success
 *    (does NOT reveal privacy choices to the other party)
 * 4. If enabled → writes to the Members doc
 *
 * Also contains a Firestore trigger that mirrors user privacy settings
 * to RTDB `/statusVisibility/{uid}` for presence privacy.
 *
 * @module functions/privacyPublish
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
exports.onInboxSettingsChanged = exports.onChatSettingsChanged = exports.publishReadReceipt = exports.publishDeliveryReceipt = exports.publishTypingIndicator = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const callableSecurity_1 = require("./callableSecurity");
// ---------------------------------------------------------------------------
// Lazy Firestore / RTDB accessors
// ---------------------------------------------------------------------------
function getDb() {
    return admin.firestore();
}
function getRtdb() {
    return admin.database();
}
// ---------------------------------------------------------------------------
// Server-side feature flag
// ---------------------------------------------------------------------------
/**
 * Enable server-enforced privacy publish.
 * When false, the callables no-op with success so nothing breaks during rollout.
 */
const ENABLE_PRIVACY_SERVER_ENFORCED = false;
const DEFAULT_CHAT_SETTINGS_V3 = {
    dmAcceptance: "everyone",
    notificationPreview: "full",
    autoDownloadMedia: "wifi",
    publishReadReceipts: true,
    publishDeliveryReceipts: true,
    publishTyping: true,
    publishOnlineStatus: true,
    publishLastSeen: true,
};
// ---------------------------------------------------------------------------
// Server-side settings resolver (mirrors client resolveChatSettings.ts)
// ---------------------------------------------------------------------------
function resolveTriState(override, globalValue) {
    if (override === "on")
        return true;
    if (override === "off")
        return false;
    return globalValue;
}
/**
 * Load the user's ChatSettingsV3 from Firestore.
 * Falls back to InboxSettings mapping, then defaults.
 */
async function loadUserChatSettings(uid) {
    const db = getDb();
    // Try V3 settings first
    const chatSettingsSnap = await db
        .collection("Users")
        .doc(uid)
        .collection("settings")
        .doc("chatSettings")
        .get();
    if (chatSettingsSnap.exists) {
        const v3 = chatSettingsSnap.data();
        return { ...DEFAULT_CHAT_SETTINGS_V3, ...v3 };
    }
    // Fall back to inbox settings
    const inboxSnap = await db
        .collection("Users")
        .doc(uid)
        .collection("settings")
        .doc("inbox")
        .get();
    if (inboxSnap.exists) {
        const inbox = inboxSnap.data();
        return {
            dmAcceptance: inbox.dmAcceptance ?? DEFAULT_CHAT_SETTINGS_V3.dmAcceptance,
            notificationPreview: inbox.notificationPreview ??
                DEFAULT_CHAT_SETTINGS_V3.notificationPreview,
            autoDownloadMedia: inbox.autoDownloadMedia ??
                DEFAULT_CHAT_SETTINGS_V3.autoDownloadMedia,
            publishReadReceipts: inbox.showReadReceipts !== undefined
                ? inbox.showReadReceipts
                : DEFAULT_CHAT_SETTINGS_V3.publishReadReceipts,
            publishDeliveryReceipts: inbox.publishDeliveryReceipts !== undefined
                ? inbox.publishDeliveryReceipts
                : DEFAULT_CHAT_SETTINGS_V3.publishDeliveryReceipts,
            publishTyping: inbox.showTypingIndicators !== undefined
                ? inbox.showTypingIndicators
                : DEFAULT_CHAT_SETTINGS_V3.publishTyping,
            publishOnlineStatus: inbox.showOnlineStatus !== undefined
                ? inbox.showOnlineStatus
                : DEFAULT_CHAT_SETTINGS_V3.publishOnlineStatus,
            publishLastSeen: inbox.showLastSeen !== undefined
                ? inbox.showLastSeen
                : DEFAULT_CHAT_SETTINGS_V3.publishLastSeen,
        };
    }
    return { ...DEFAULT_CHAT_SETTINGS_V3 };
}
/**
 * Load per-chat privacy overrides from MembersPrivate.
 */
async function loadPerChatOverrides(scope, conversationId, uid) {
    const db = getDb();
    const collection = scope === "dm"
        ? `Chats/${conversationId}/MembersPrivate`
        : `Groups/${conversationId}/MembersPrivate`;
    const snap = await db.collection(collection).doc(uid).get();
    if (!snap.exists)
        return null;
    const data = snap.data();
    return data?.privacyOverrides ?? null;
}
/**
 * Resolve effective settings for a user in a given conversation.
 */
async function resolveServerEffectiveSettings(uid, scope, conversationId) {
    const [global, overrides] = await Promise.all([
        loadUserChatSettings(uid),
        loadPerChatOverrides(scope, conversationId, uid),
    ]);
    const effective = {
        publishReadReceipts: resolveTriState(overrides?.readReceipts, global.publishReadReceipts),
        publishDeliveryReceipts: resolveTriState(overrides?.deliveryReceipts, global.publishDeliveryReceipts),
        publishTyping: resolveTriState(overrides?.typingIndicators, global.publishTyping),
        publishOnlineStatus: global.publishOnlineStatus,
        publishLastSeen: global.publishLastSeen,
        notificationPreview: !overrides?.notificationPreview ||
            overrides.notificationPreview === "inherit"
            ? global.notificationPreview
            : overrides.notificationPreview,
        autoDownloadMedia: !overrides?.autoDownloadMedia || overrides.autoDownloadMedia === "inherit"
            ? global.autoDownloadMedia
            : overrides.autoDownloadMedia,
    };
    return effective;
}
// ---------------------------------------------------------------------------
// Membership check (reused from messaging.ts pattern)
// ---------------------------------------------------------------------------
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
        const memberDoc = await db
            .collection("Groups")
            .doc(conversationId)
            .collection("Members")
            .doc(uid)
            .get();
        return memberDoc.exists;
    }
}
// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------
function validateScope(scope) {
    return scope === "dm" || scope === "group";
}
function validateConversationId(id) {
    return typeof id === "string" && id.length > 0 && id.length <= 128;
}
function validateTimestamp(ts) {
    return typeof ts === "number" && ts > 0 && ts <= Date.now() + 60_000;
}
// =============================================================================
// publishTypingIndicator
// =============================================================================
/**
 * Publish a typing indicator for the calling user.
 *
 * Input: { scope, conversationId, typingAt: number | null }
 *   - typingAt = Date.now()  → user is typing
 *   - typingAt = null        → user stopped typing (deletes field)
 *
 * Behavior:
 *   - If privacy settings disable typing → no-op success
 *   - If feature not enabled → no-op success
 */
exports.publishTypingIndicator = (0, callableSecurity_1.secureCallableRuntime)().https.onCall(async (data, context) => {
    // 1. Auth
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const uid = context.auth.uid;
    const { scope, conversationId, typingAt } = data || {};
    // 2. Validate input
    if (!validateScope(scope)) {
        throw new functions.https.HttpsError("invalid-argument", 'scope must be "dm" or "group"');
    }
    if (!validateConversationId(conversationId)) {
        throw new functions.https.HttpsError("invalid-argument", "conversationId required");
    }
    // typingAt is null (clear) or a number (set)
    if (typingAt !== null && typingAt !== undefined) {
        if (typeof typingAt !== "number" || typingAt <= 0) {
            throw new functions.https.HttpsError("invalid-argument", "typingAt must be a positive number or null");
        }
    }
    // If feature not yet enabled, no-op
    if (!ENABLE_PRIVACY_SERVER_ENFORCED) {
        return { success: true, enforced: false };
    }
    // 3. Membership check
    const isMember = await checkMembership(conversationId, scope, uid);
    if (!isMember) {
        throw new functions.https.HttpsError("permission-denied", "Not a member of this conversation");
    }
    // 4. Resolve effective settings
    const effective = await resolveServerEffectiveSettings(uid, scope, conversationId);
    // 5. If privacy says don't publish → no-op (silent success)
    if (!effective.publishTyping) {
        return { success: true, enforced: true, published: false };
    }
    // 6. Write to Members doc
    const db = getDb();
    const collectionPath = scope === "dm"
        ? `Chats/${conversationId}/Members`
        : `Groups/${conversationId}/Members`;
    const docRef = db.collection(collectionPath).doc(uid);
    if (typingAt === null || typingAt === undefined) {
        // Clear typing
        await docRef.set({
            uid,
            typingAt: admin.firestore.FieldValue.delete(),
        }, { merge: true });
    }
    else {
        // Set typing
        await docRef.set({
            uid,
            typingAt,
        }, { merge: true });
    }
    return { success: true, enforced: true, published: true };
});
// =============================================================================
// publishDeliveryReceipt
// =============================================================================
/**
 * Publish a delivery receipt (lastDeliveredAtPublic watermark).
 *
 * Input: { scope, conversationId, lastDeliveredAt: number }
 *
 * Behavior:
 *   - Validates monotonic increase (new timestamp >= existing)
 *   - If privacy settings disable delivery receipts → no-op success
 */
exports.publishDeliveryReceipt = (0, callableSecurity_1.secureCallableRuntime)().https.onCall(async (data, context) => {
    // 1. Auth
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const uid = context.auth.uid;
    const { scope, conversationId, lastDeliveredAt } = data || {};
    // 2. Validate
    if (!validateScope(scope)) {
        throw new functions.https.HttpsError("invalid-argument", 'scope must be "dm" or "group"');
    }
    if (!validateConversationId(conversationId)) {
        throw new functions.https.HttpsError("invalid-argument", "conversationId required");
    }
    if (!validateTimestamp(lastDeliveredAt)) {
        throw new functions.https.HttpsError("invalid-argument", "lastDeliveredAt must be a valid timestamp");
    }
    // If feature not yet enabled, no-op
    if (!ENABLE_PRIVACY_SERVER_ENFORCED) {
        return { success: true, enforced: false };
    }
    // 3. Membership check
    const isMember = await checkMembership(conversationId, scope, uid);
    if (!isMember) {
        throw new functions.https.HttpsError("permission-denied", "Not a member of this conversation");
    }
    // 4. Resolve effective settings
    const effective = await resolveServerEffectiveSettings(uid, scope, conversationId);
    // 5. If privacy says don't publish → silent no-op
    if (!effective.publishDeliveryReceipts) {
        return { success: true, enforced: true, published: false };
    }
    // 6. Monotonic write — only update if new value >= existing
    const db = getDb();
    const collectionPath = scope === "dm"
        ? `Chats/${conversationId}/Members`
        : `Groups/${conversationId}/Members`;
    const docRef = db.collection(collectionPath).doc(uid);
    await db.runTransaction(async (tx) => {
        const existing = await tx.get(docRef);
        const existingTs = existing.data()?.lastDeliveredAtPublic ?? 0;
        if (lastDeliveredAt < existingTs) {
            // Non-monotonic, silently ignore (not an error)
            return;
        }
        tx.set(docRef, {
            uid,
            lastDeliveredAtPublic: lastDeliveredAt,
        }, { merge: true });
    });
    return { success: true, enforced: true, published: true };
});
// =============================================================================
// publishReadReceipt
// =============================================================================
/**
 * Publish a read receipt (lastReadAtPublic watermark).
 *
 * Input: { scope, conversationId, lastReadAt: number }
 *
 * Behavior:
 *   - Validates monotonic increase
 *   - If privacy settings disable read receipts → no-op success
 *   - Always updates private lastSeenAtPrivate (for unread badge)
 *     regardless of public receipt setting
 */
exports.publishReadReceipt = (0, callableSecurity_1.secureCallableRuntime)().https.onCall(async (data, context) => {
    // 1. Auth
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }
    const uid = context.auth.uid;
    const { scope, conversationId, lastReadAt } = data || {};
    // 2. Validate
    if (!validateScope(scope)) {
        throw new functions.https.HttpsError("invalid-argument", 'scope must be "dm" or "group"');
    }
    if (!validateConversationId(conversationId)) {
        throw new functions.https.HttpsError("invalid-argument", "conversationId required");
    }
    if (!validateTimestamp(lastReadAt)) {
        throw new functions.https.HttpsError("invalid-argument", "lastReadAt must be a valid timestamp");
    }
    // If feature not yet enabled, no-op
    if (!ENABLE_PRIVACY_SERVER_ENFORCED) {
        return { success: true, enforced: false };
    }
    // 3. Membership check
    const isMember = await checkMembership(conversationId, scope, uid);
    if (!isMember) {
        throw new functions.https.HttpsError("permission-denied", "Not a member of this conversation");
    }
    // 4. Resolve effective settings
    const effective = await resolveServerEffectiveSettings(uid, scope, conversationId);
    // 5. Build writes
    const db = getDb();
    const collectionBase = scope === "dm" ? `Chats/${conversationId}` : `Groups/${conversationId}`;
    const publicDocRef = db.collection(`${collectionBase}/Members`).doc(uid);
    const privateDocRef = db
        .collection(`${collectionBase}/MembersPrivate`)
        .doc(uid);
    // Always update private lastSeenAtPrivate (for unread badge computation)
    const privateUpdate = {
        uid,
        lastSeenAtPrivate: Math.max(lastReadAt, Date.now()),
        lastMarkedUnreadAt: null,
    };
    // 6. If privacy allows, update public watermark with monotonic check
    if (effective.publishReadReceipts) {
        await db.runTransaction(async (tx) => {
            const existing = await tx.get(publicDocRef);
            const existingTs = existing.data()?.lastReadAtPublic ?? 0;
            // Always update private
            tx.set(privateDocRef, privateUpdate, { merge: true });
            // Only update public if monotonically increasing
            if (lastReadAt >= existingTs) {
                tx.set(publicDocRef, {
                    uid,
                    lastReadAtPublic: lastReadAt,
                }, { merge: true });
            }
        });
    }
    else {
        // Privacy disabled — only update private (no public receipt)
        await privateDocRef.set(privateUpdate, { merge: true });
    }
    return {
        success: true,
        enforced: true,
        published: effective.publishReadReceipts,
    };
});
// =============================================================================
// RTDB Presence Privacy Mirror
// =============================================================================
/**
 * Firestore trigger: when user's chat settings change, mirror privacy
 * flags to RTDB at `/statusVisibility/{uid}`.
 *
 * This is necessary because RTDB security rules cannot read Firestore
 * documents. By mirroring the relevant flags, client-side presence
 * publishers can be validated (or at least audited) against RTDB rules.
 *
 * Trigger paths:
 *   - Users/{uid}/settings/chatSettings
 *   - Users/{uid}/settings/inbox (legacy)
 *
 * RTDB shape:
 *   /statusVisibility/{uid} = {
 *     onlineAllowed: boolean,
 *     lastSeenAllowed: boolean,
 *     updatedAt: number
 *   }
 */
exports.onChatSettingsChanged = functions.firestore
    .document("Users/{uid}/settings/chatSettings")
    .onWrite(async (change, context) => {
    const uid = context.params.uid;
    // Read the new data
    const after = change.after.exists ? change.after.data() : null;
    const onlineAllowed = after?.publishOnlineStatus ?? true;
    const lastSeenAllowed = after?.publishLastSeen ?? true;
    // Write to RTDB
    const rtdb = getRtdb();
    await rtdb.ref(`statusVisibility/${uid}`).set({
        onlineAllowed,
        lastSeenAllowed,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
    });
    functions.logger.info("Mirrored privacy settings to RTDB", {
        uid,
        onlineAllowed,
        lastSeenAllowed,
    });
});
/**
 * Legacy inbox settings trigger — same mirror logic for users who
 * haven't migrated to chatSettings V3.
 */
exports.onInboxSettingsChanged = functions.firestore
    .document("Users/{uid}/settings/inbox")
    .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const after = change.after.exists ? change.after.data() : null;
    // Legacy field names
    const onlineAllowed = after?.showOnlineStatus ?? true;
    const lastSeenAllowed = after?.showLastSeen ?? true;
    const rtdb = getRtdb();
    await rtdb.ref(`statusVisibility/${uid}`).set({
        onlineAllowed,
        lastSeenAllowed,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
    });
    functions.logger.info("Mirrored legacy inbox settings to RTDB", {
        uid,
        onlineAllowed,
        lastSeenAllowed,
    });
});
//# sourceMappingURL=privacyPublish.js.map