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
const chatMedia_1 = require("./chatMedia");
const messageRequests_1 = require("./messageRequests");
const rateLimiter_1 = require("./rateLimiter");
// Lazy initialization to avoid "app not initialized" error
// The app is initialized in index.ts before these functions are called
function getDb() {
    return admin.firestore();
}
// =============================================================================
// Server-side feature flags (Segment 6)
// Cloud Functions don't import client-side featureFlags.
// Set to true when ready for Phase 2 rollout.
// =============================================================================
/** Enable the global per-user bucketed rate limiter (Segment 6). */
const ENABLE_GLOBAL_RATE_LIMIT = false;
/** Enable group settings enforcement — slow mode, announcement-only,
 *  media permissions, @mention all (Segment 9). */
const ENABLE_GROUP_SETTINGS_ENFORCEMENT = false;
const OWNER_PERMISSIONS_SERVER = {
    SEND_MESSAGES: true,
    DELETE_OWN_MESSAGES: true,
    DELETE_ANY_MESSAGE: true,
    EDIT_GROUP_NAME: true,
    EDIT_GROUP_PHOTO: true,
    MANAGE_INVITES: true,
    KICK_MEMBERS: true,
    MANAGE_ROLES: true,
    MANAGE_PERMISSIONS: true,
    TRANSFER_OWNERSHIP: true,
    DELETE_GROUP: true,
    PIN_MESSAGES: true,
    MUTE_MEMBERS: true,
    MENTION_EVERYONE: true,
    SEND_MEDIA: true,
};
const DEFAULT_ADMIN_PERMISSIONS_SERVER = {
    SEND_MESSAGES: true,
    DELETE_OWN_MESSAGES: true,
    DELETE_ANY_MESSAGE: true,
    EDIT_GROUP_NAME: true,
    EDIT_GROUP_PHOTO: true,
    MANAGE_INVITES: true,
    KICK_MEMBERS: true,
    MANAGE_ROLES: false,
    MANAGE_PERMISSIONS: false,
    TRANSFER_OWNERSHIP: false,
    DELETE_GROUP: false,
    PIN_MESSAGES: true,
    MUTE_MEMBERS: true,
    MENTION_EVERYONE: true,
    SEND_MEDIA: true,
};
const DEFAULT_MEMBER_PERMISSIONS_SERVER = {
    SEND_MESSAGES: true,
    DELETE_OWN_MESSAGES: true,
    DELETE_ANY_MESSAGE: false,
    EDIT_GROUP_NAME: false,
    EDIT_GROUP_PHOTO: false,
    MANAGE_INVITES: false,
    KICK_MEMBERS: false,
    MANAGE_ROLES: false,
    MANAGE_PERMISSIONS: false,
    TRANSFER_OWNERSHIP: false,
    DELETE_GROUP: false,
    PIN_MESSAGES: false,
    MUTE_MEMBERS: false,
    MENTION_EVERYONE: false,
    SEND_MEDIA: true,
};
function resolvePermissionsServer(role, config) {
    if (role === "owner")
        return { ...OWNER_PERMISSIONS_SERVER };
    if (role === "admin") {
        return {
            ...DEFAULT_ADMIN_PERMISSIONS_SERVER,
            ...(config?.adminPermissions ?? {}),
        };
    }
    return {
        ...DEFAULT_MEMBER_PERMISSIONS_SERVER,
        ...(config?.memberPermissions ?? {}),
    };
}
/**
 * Load group-level settings from the Groups/{groupId} document.
 *
 * Returns `null` if the group doc doesn't exist or has no `settings` field.
 */
async function loadGroupSettings(groupId) {
    const db = getDb();
    const groupDoc = await db.collection("Groups").doc(groupId).get();
    if (!groupDoc.exists)
        return null;
    return groupDoc.data()?.settings ?? null;
}
/**
 * Load a user's role and resolved permissions for a group.
 *
 * Returns the user's role and capability-resolved permission flags,
 * taking the group's permissionsConfig into account.
 */
async function getGroupMemberPermissions(groupId, uid) {
    const db = getDb();
    const [memberDoc, groupDoc] = await Promise.all([
        db.collection("Groups").doc(groupId).collection("Members").doc(uid).get(),
        db.collection("Groups").doc(groupId).get(),
    ]);
    if (!memberDoc.exists)
        return null;
    const memberData = memberDoc.data();
    let role = memberData?.role ?? "member";
    // Also check owner via createdBy / ownerId
    if (groupDoc.exists) {
        const gd = groupDoc.data();
        if (gd?.ownerId === uid || gd?.createdBy === uid) {
            role = "owner";
        }
    }
    const config = groupDoc.exists
        ? groupDoc.data()?.permissionsConfig
        : undefined;
    return { role, permissions: resolvePermissionsServer(role, config) };
}
/**
 * Check whether a user is an admin or owner in a group.
 *
 * Reads Groups/{groupId}/Members/{uid}.role and the top-level
 * Groups/{groupId}.createdBy field.
 */
async function isGroupAdminOrOwner(groupId, uid) {
    const db = getDb();
    const [memberDoc, groupDoc] = await Promise.all([
        db.collection("Groups").doc(groupId).collection("Members").doc(uid).get(),
        db.collection("Groups").doc(groupId).get(),
    ]);
    // Owner check
    if (groupDoc.exists && groupDoc.data()?.createdBy === uid)
        return true;
    // Admin role check
    if (memberDoc.exists) {
        const role = memberDoc.data()?.role;
        if (role === "admin" || role === "owner")
            return true;
    }
    return false;
}
/**
 * Look up the last message timestamp by this user in a group.
 *
 * Used for slow-mode enforcement. Returns 0 if no prior messages found.
 */
async function getLastGroupMessageTimestamp(groupId, uid) {
    const db = getDb();
    const snap = await db
        .collection("Groups")
        .doc(groupId)
        .collection("Messages")
        .where("senderId", "==", uid)
        .orderBy("serverReceivedAt", "desc")
        .limit(1)
        .get();
    if (snap.empty)
        return 0;
    const data = snap.docs[0].data();
    const ts = data.serverReceivedAt;
    if (ts && typeof ts.toMillis === "function")
        return ts.toMillis();
    if (typeof ts === "number")
        return ts;
    return 0;
}
/**
 * Enforce GroupSettings on a sendMessageV2 call (Segment 9).
 *
 * Throws HttpsError if the user's send is rejected.
 * No-op if ENABLE_GROUP_SETTINGS_ENFORCEMENT is false.
 */
async function enforceGroupSettings(groupId, senderId, kind, mentionUids) {
    if (!ENABLE_GROUP_SETTINGS_ENFORCEMENT)
        return;
    const settings = await loadGroupSettings(groupId);
    if (!settings)
        return; // no settings doc → no restrictions
    // Resolve capability-based permissions for this user
    const memberPerms = await getGroupMemberPermissions(groupId, senderId);
    const perms = memberPerms?.permissions;
    const isAdmin = perms
        ? !!perms.MANAGE_ROLES || !!perms.KICK_MEMBERS
        : await isGroupAdminOrOwner(groupId, senderId);
    // 1. Announcement-only: users without SEND_MESSAGES cannot send
    if (settings.announcementOnly && !(perms?.SEND_MESSAGES ?? isAdmin)) {
        throw new functions.https.HttpsError("permission-denied", "This group is in announcement-only mode. Only admins can send messages.");
    }
    // 2. Slow mode: enforce minimum gap between messages (exempt admins/owners)
    if (settings.slowModeSeconds && settings.slowModeSeconds > 0 && !isAdmin) {
        const lastTs = await getLastGroupMessageTimestamp(groupId, senderId);
        if (lastTs > 0) {
            const elapsed = (Date.now() - lastTs) / 1000;
            if (elapsed < settings.slowModeSeconds) {
                const waitSec = Math.ceil(settings.slowModeSeconds - elapsed);
                throw new functions.https.HttpsError("resource-exhausted", `Slow mode active. Please wait ${waitSec} seconds before sending another message.`);
            }
        }
    }
    // 3. Media permission: check SEND_MEDIA capability
    if (settings.allowMediaFromMembers === false &&
        !(perms?.SEND_MEDIA ?? isAdmin) &&
        (kind === "media" || kind === "voice" || kind === "file")) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can send media in this group.");
    }
    // 4. @mention all: check MENTION_EVERYONE capability
    if (settings.allowMentionsAll === false &&
        !(perms?.MENTION_EVERYONE ?? isAdmin) &&
        mentionUids) {
        if (mentionUids.includes("all") ||
            mentionUids.includes("@all") ||
            mentionUids.includes("everyone")) {
            throw new functions.https.HttpsError("permission-denied", "Only admins can mention @all in this group.");
        }
    }
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
        chatAppearance: data.chatAppearance,
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
    const { conversationId, scope, kind, text, replyTo, threadRootId, mentionUids, mentionSpans, attachments, stagedAttachments, clientId, messageId, createdAt, traceId, senderStyle, animalId, senderDeviceId, scorecardPayload, } = data;
    // Segment 8: Log traceId if present (for cross-system correlation)
    const logTraceId = traceId || `srv-${messageId?.substring(0, 12) || "unknown"}`;
    console.log(`[sendMessageV2] Request from ${senderId.substring(0, 8)}:`, sanitizeForLog({
        conversationId,
        scope,
        kind,
        messageId,
        traceId: logTraceId,
    }));
    // 2. Validate required fields
    if (!isValidString(conversationId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid conversationId");
    }
    if (!["dm", "group"].includes(scope)) {
        throw new functions.https.HttpsError("invalid-argument", "Scope must be 'dm' or 'group'");
    }
    if (!["text", "media", "voice", "file", "system", "animal"].includes(kind)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid message kind");
    }
    if (!isValidString(clientId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid clientId");
    }
    // Security: clients cannot impersonate server-authored messages by
    // sending a `server*` clientId. The renderer's scorecard trust gate
    // keys off this prefix, so we must guard it at ingress.
    if (clientId === "server" || clientId.startsWith("server-share:")) {
        throw new functions.https.HttpsError("invalid-argument", "Reserved clientId");
    }
    if (!isValidString(messageId, 1, 100)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid messageId");
    }
    // Validate text content if present
    if (text !== undefined && text !== null && !isValidString(text, 0, 10000)) {
        throw new functions.https.HttpsError("invalid-argument", "Text content too long (max 10000 chars)");
    }
    // ─────────────────────────────────────────────────────────────────
    // Scorecard trust gate
    // ─────────────────────────────────────────────────────────────────
    // Scorecards are privacy- and authenticity-sensitive. The renderer
    // only decodes the sentinel when `clientId` is server-authored, so
    // we must (a) reject any attempt to sneak the sentinel into a
    // plain user-sent text message (spoofing), and (b) accept only a
    // validated structured `scorecardPayload`, which we ourselves
    // re-encode and stamp with the trusted clientId prefix.
    const SCORECARD_SENTINEL = "[SCORECARD_V1]";
    let trustedScorecardClientId = null;
    let overriddenText = null;
    if (scorecardPayload) {
        // Structural validation. We deliberately rebuild the payload
        // ourselves from primitives so untrusted fields can't leak into
        // the stored document.
        const sp = scorecardPayload;
        const scoreboardRaw = Array.isArray(sp.scoreboard) ? sp.scoreboard : [];
        const winnerIdsRaw = Array.isArray(sp.winnerIds) ? sp.winnerIds : [];
        const valid = sp.v === 1 &&
            typeof sp.sessionId === "string" &&
            sp.sessionId.length > 0 &&
            sp.sessionId.length <= 128 &&
            typeof sp.gameId === "string" &&
            sp.gameId.length > 0 &&
            sp.gameId.length <= 64 &&
            typeof sp.gameTitle === "string" &&
            sp.gameTitle.length > 0 &&
            sp.gameTitle.length <= 128 &&
            typeof sp.runtimeType === "string" &&
            sp.runtimeType.length <= 32 &&
            typeof sp.resolutionType === "string" &&
            sp.resolutionType.length <= 32 &&
            winnerIdsRaw.length <= 32 &&
            scoreboardRaw.length > 0 &&
            scoreboardRaw.length <= 32 &&
            winnerIdsRaw.every((u) => typeof u === "string" && u.length <= 128) &&
            scoreboardRaw.every((e) => {
                if (!e || typeof e !== "object")
                    return false;
                const entry = e;
                return (typeof entry.uid === "string" &&
                    entry.uid.length > 0 &&
                    entry.uid.length <= 128 &&
                    typeof entry.displayName === "string" &&
                    entry.displayName.length <= 128 &&
                    typeof entry.score === "number" &&
                    isFinite(entry.score));
            });
        if (!valid) {
            throw new functions.https.HttpsError("invalid-argument", "Invalid scorecardPayload");
        }
        // Re-serialize. This is the sole path by which a sentinel-prefixed
        // text can land in Firestore from a client call, and we build it
        // ourselves from validated primitives only.
        const cleanPayload = {
            v: 1,
            sessionId: sp.sessionId,
            gameId: sp.gameId,
            gameTitle: sp.gameTitle,
            runtimeType: sp.runtimeType,
            resolutionType: sp.resolutionType,
            winnerIds: winnerIdsRaw,
            scoreboard: scoreboardRaw.map((e) => {
                const entry = e;
                return {
                    uid: entry.uid,
                    displayName: entry.displayName,
                    profilePictureUrl: typeof entry.profilePictureUrl === "string"
                        ? entry.profilePictureUrl
                        : null,
                    decorationId: typeof entry.decorationId === "string" &&
                        entry.decorationId.length <= 128
                        ? entry.decorationId
                        : null,
                    score: entry.score,
                    ...(typeof entry.placement === "number"
                        ? { placement: entry.placement }
                        : {}),
                };
            }),
            ...(typeof sp.durationMs === "number"
                ? { durationMs: sp.durationMs }
                : {}),
            ...(typeof sp.createdAt === "number"
                ? { createdAt: sp.createdAt }
                : {}),
            winnerEquippedBackgroundId: typeof sp.winnerEquippedBackgroundId === "string"
                ? sp.winnerEquippedBackgroundId
                : null,
            // Preserve sender-equipped background ID. Solo scorecards
            // personalize from this field regardless of win/loss so the
            // card always shows the sender's profile background.
            senderEquippedBackgroundId: typeof sp.senderEquippedBackgroundId === "string"
                ? sp.senderEquippedBackgroundId
                : null,
        };
        overriddenText = `${SCORECARD_SENTINEL}${JSON.stringify(cleanPayload)}\nGame Scorecard`;
        trustedScorecardClientId = `server-share:${senderId}`;
    }
    else if (text && text.startsWith(SCORECARD_SENTINEL)) {
        // No structured payload but the text begins with the scorecard
        // sentinel — this is a spoofing attempt (a regular user trying to
        // fake a game result by pasting scorecard text). Reject.
        throw new functions.https.HttpsError("invalid-argument", "Scorecard messages must be sent via the structured scorecard payload");
    }
    // Validate kind requires content
    if (kind === "text" && (!text || text.trim().length === 0)) {
        throw new functions.https.HttpsError("invalid-argument", "Text messages must have content");
    }
    // Validate mentions count
    if (mentionUids && mentionUids.length > 5) {
        throw new functions.https.HttpsError("invalid-argument", "Maximum 5 mentions per message");
    }
    // === Animal message entitlement enforcement ===
    if (kind === "animal") {
        if (!animalId || typeof animalId !== "string" || animalId.length < 1) {
            throw new functions.https.HttpsError("invalid-argument", "Animal messages must include a valid animalId");
        }
        // Verify the sender owns the animal cosmetic (entitlement check)
        const entitlementSnap = await getDb()
            .collection("Users")
            .doc(senderId)
            .collection("Entitlements")
            .doc(animalId)
            .get();
        // Also allow free/starter animals (animal_duck, animal_turtle) via catalog
        const FREE_ANIMALS = ["animal_duck", "animal_turtle"];
        if (!entitlementSnap.exists && !FREE_ANIMALS.includes(animalId)) {
            console.warn(`[sendMessageV2] Animal entitlement denied: ${senderId.substring(0, 8)} does not own ${animalId}`);
            throw new functions.https.HttpsError("permission-denied", "You do not own this animal theme");
        }
        // Verify the animal is currently equipped
        const senderProfile = await getUserProfile(senderId);
        if (senderProfile?.chatAppearance?.animalThemeId !== animalId) {
            console.warn(`[sendMessageV2] Animal equip denied: ${senderId.substring(0, 8)} has ${senderProfile?.chatAppearance?.animalThemeId} equipped, tried ${animalId}`);
            throw new functions.https.HttpsError("permission-denied", "This animal theme is not equipped");
        }
    }
    // Validate attachments
    if (attachments && attachments.length > 10) {
        throw new functions.https.HttpsError("invalid-argument", "Maximum 10 attachments per message");
    }
    // Validate staged attachments
    if (stagedAttachments && stagedAttachments.length > 10) {
        throw new functions.https.HttpsError("invalid-argument", "Maximum 10 attachments per message");
    }
    // Mutual exclusion: cannot provide both legacy and staged attachments
    if (attachments &&
        attachments.length > 0 &&
        stagedAttachments &&
        stagedAttachments.length > 0) {
        throw new functions.https.HttpsError("invalid-argument", "Cannot provide both attachments and stagedAttachments");
    }
    // 3. Membership check
    const isMember = await checkMembership(conversationId, scope, senderId);
    if (!isMember) {
        console.log(`[sendMessageV2] Non-member attempt: ${senderId.substring(0, 8)}`);
        throw new functions.https.HttpsError("permission-denied", "Not a member of this conversation");
    }
    // 3b. Group settings enforcement (Segment 9)
    // Checks slow mode, announcement-only, media permissions, @mention all.
    // No-op when ENABLE_GROUP_SETTINGS_ENFORCEMENT is false.
    if (scope === "group") {
        await enforceGroupSettings(conversationId, senderId, kind, mentionUids);
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
            // 4b. Message request gating (Segment 5)
            // Checks the recipient's dmAcceptance setting and friendship status.
            // When the flag is off on the server this function is still called but
            // will only act if the recipient has explicitly set dmAcceptance ≠ "everyone".
            const previewForGating = text
                ? text.length > 80
                    ? text.substring(0, 80) + "…"
                    : text
                : kind;
            const gatingResult = await (0, messageRequests_1.checkDmAcceptance)(senderId, otherUid, conversationId, previewForGating, kind);
            if (gatingResult.outcome === "rejected") {
                throw new functions.https.HttpsError("permission-denied", gatingResult.reason);
            }
            if (gatingResult.outcome === "request_created") {
                // Don't write the message; inform the client a request was created
                return {
                    success: true,
                    message: {
                        id: messageId,
                        serverReceivedAt: Date.now(),
                        messageRequestCreated: true,
                    },
                    isExisting: false,
                };
            }
        }
    }
    // 5. Rate limit check
    // Segment 6: When CHAT_GLOBAL_RATE_LIMIT is enabled (server-side
    // config), use the global bucketed limiter. Otherwise, fall back
    // to the legacy per-conversation limiter.
    const useGlobalRateLimit = ENABLE_GLOBAL_RATE_LIMIT;
    if (useGlobalRateLimit) {
        const globalResult = await (0, rateLimiter_1.checkGlobalRateLimit)(senderId);
        if (!globalResult.allowed) {
            console.log(`[sendMessageV2] Global rate limited: ${senderId.substring(0, 8)} ` +
                `(remaining=${globalResult.remaining}, retryAfter=${globalResult.retryAfterSeconds}s)`);
            throw new functions.https.HttpsError("resource-exhausted", `Rate limit exceeded. Please wait ${globalResult.retryAfterSeconds ?? 60} seconds.`);
        }
    }
    else {
        const rateLimitOk = await checkRateLimit(senderId);
        if (!rateLimitOk) {
            console.log(`[sendMessageV2] Rate limited: ${senderId.substring(0, 8)}`);
            throw new functions.https.HttpsError("resource-exhausted", "Rate limit exceeded. Please wait before sending more messages.");
        }
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
        system: "system",
        file: "text", // files shown as text in legacy
    };
    const legacyType = legacyTypeMap[kind] || "text";
    // Scorecard override — when the caller supplied a validated
    // `scorecardPayload`, the server-authored wire text + trusted
    // clientId supersede whatever the client sent.
    const effectiveText = overriddenText !== null ? overriddenText : text || "";
    const effectiveClientId = trustedScorecardClientId ?? clientId;
    const effectiveIdempotencyKey = trustedScorecardClientId
        ? `${trustedScorecardClientId}:${messageId}`
        : idempotencyKey;
    const messageData = {
        id: messageId,
        scope,
        conversationId,
        // New unified field names
        senderId,
        kind,
        text: effectiveText,
        // Legacy field names for backward compatibility with groups.ts subscription
        sender: senderId,
        type: legacyType,
        content: effectiveText,
        // Timestamps
        createdAt: createdAt || serverNow,
        serverReceivedAt: admin.firestore.FieldValue.serverTimestamp(),
        idempotencyKey: effectiveIdempotencyKey,
        clientId: effectiveClientId,
        // Segment 8: Include traceId in message doc for debugging/correlation
        ...(traceId ? { traceId: logTraceId } : {}),
        // Stamp the sender's stable device ID so notification triggers can
        // exclude the sender's device from push and in-app delivery.
        ...(senderDeviceId ? { senderDeviceId } : {}),
    };
    // Add optional fields
    if (replyTo) {
        messageData.replyTo = replyTo;
    }
    if (threadRootId) {
        messageData.threadRootId = threadRootId;
    }
    // Stamp animalId for animal messages
    if (kind === "animal" && animalId) {
        messageData.animalId = animalId;
    }
    if (mentionUids && mentionUids.length > 0) {
        messageData.mentionUids = mentionUids;
    }
    if (mentionSpans && mentionSpans.length > 0) {
        messageData.mentionSpans = mentionSpans;
    }
    if (attachments && attachments.length > 0) {
        messageData.attachments = attachments;
    }
    // Stamp sender's chat style if provided by client
    if (senderStyle && typeof senderStyle === "object" && senderStyle.v === 1) {
        messageData.senderStyle = {
            bubbleColorId: senderStyle.bubbleColorId ?? null,
            bubbleColorHex: senderStyle.bubbleColorHex ?? null,
            fontId: senderStyle.fontId ?? null,
            fontKey: senderStyle.fontKey ?? null,
            animalThemeId: senderStyle.animalThemeId ?? null,
            v: 1,
        };
    }
    // Segment 3: Staged media pipeline — commit staged attachments to final
    // paths, strip download tokens, and store path-only references.
    if (stagedAttachments && stagedAttachments.length > 0) {
        const committed = await (0, chatMedia_1.commitStagedAttachments)(scope, conversationId, messageId, stagedAttachments);
        messageData.attachments = committed;
        console.log(`[sendMessageV2] Committed ${committed.length} staged attachment(s) for ${messageId.substring(0, 8)}`);
    }
    // For groups, add sender profile snapshot
    if (scope === "group") {
        const senderProfile = await getUserProfile(senderId);
        if (senderProfile) {
            messageData.senderName = senderProfile.displayName;
            messageData.senderDisplayName = senderProfile.displayName; // Legacy field
            messageData.senderAvatarConfig = senderProfile.avatarConfig;
            // Server-side fallback: if client didn't send senderStyle, build it
            // from the sender's chatAppearance profile field.
            if (!messageData.senderStyle && senderProfile.chatAppearance) {
                const ca = senderProfile.chatAppearance;
                messageData.senderStyle = {
                    bubbleColorId: ca.bubbleColorId ?? null,
                    fontId: ca.fontId ?? null,
                    animalThemeId: ca.animalThemeId ?? null,
                    v: 1,
                };
            }
        }
    }
    // For DMs: server-side fallback for senderStyle when not provided by client
    if (scope === "dm" && !messageData.senderStyle) {
        const senderProfile = await getUserProfile(senderId);
        if (senderProfile?.chatAppearance) {
            const ca = senderProfile.chatAppearance;
            messageData.senderStyle = {
                bubbleColorId: ca.bubbleColorId ?? null,
                fontId: ca.fontId ?? null,
                animalThemeId: ca.animalThemeId ?? null,
                v: 1,
            };
        }
    }
    // 9. Write message document
    console.log(`[sendMessageV2] Creating message ${messageId.substring(0, 8)}`);
    await db.collection(collectionPath).doc(messageId).set(messageData);
    // 9b. If this message belongs to a thread, atomically update the root
    //     message's replyCount and lastReplyAt so clients can display
    //     "View thread (X replies)" badges.
    if (threadRootId) {
        try {
            await db
                .collection(collectionPath)
                .doc(threadRootId)
                .update({
                replyCount: admin.firestore.FieldValue.increment(1),
                lastReplyAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch (threadErr) {
            // Non-fatal: root message may have been deleted; log and continue
            console.warn(`[sendMessageV2] Failed to update thread root ${threadRootId.substring(0, 8)}:`, threadErr);
        }
    }
    // 10. Update conversation preview (lastMessage fields)
    const previewText = getPreviewText(kind, text, attachments || stagedAttachments);
    const conversationRef = scope === "dm"
        ? db.collection("Chats").doc(conversationId)
        : db.collection("Groups").doc(conversationId);
    try {
        const conversationUpdate = {
            lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMessageId: messageId,
            lastMessageText: previewText,
            lastMessageKind: kind,
            lastMessageSenderId: senderId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        // Store mention UIDs on conversation doc for in-app notification routing
        if (mentionUids && mentionUids.length > 0) {
            conversationUpdate.lastMentionUids = mentionUids;
        }
        else {
            conversationUpdate.lastMentionUids =
                admin.firestore.FieldValue.delete();
        }
        await conversationRef.update(conversationUpdate);
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
    if (kind === "animal")
        return "🐾 Animal sticker";
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
/** Allowed emoji set — accepts any valid emoji string (≤ 10 chars) */
function isValidEmoji(emoji) {
    return typeof emoji === "string" && emoji.length > 0 && emoji.length <= 10;
}
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
    if (!isValidEmoji(emoji)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid emoji — must be a non-empty string of at most 10 characters");
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