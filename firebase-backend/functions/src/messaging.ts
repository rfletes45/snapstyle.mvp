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

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { secureCallableRuntime } from "./callableSecurity";
import { commitStagedAttachments } from "./chatMedia";
import {
  SCORECARD_VISIBLE_TEXT,
  sanitizeMessagePreviewText,
} from "./messagePreview";
import { checkDmAcceptance } from "./messageRequests";
import { checkGlobalRateLimit } from "./rateLimiter";

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

interface SenderStyleV1 {
  bubbleColorId?: string | null;
  bubbleColorHex?: string | null;
  fontId?: string | null;
  fontKey?: string | null;
  fontColorId?: string | null;
  fontColorHex?: string | null;
  animalThemeId?: string | null;
  v: 1;
}

interface ChatAppearanceSnapshot {
  bubbleColorId?: string | null;
  fontId?: string | null;
  fontColorId?: string | null;
  animalThemeId?: string | null;
}

export function normalizeSenderStyleSnapshot(
  senderStyle: SenderStyleV1 | null | undefined,
): SenderStyleV1 | null {
  if (!senderStyle || typeof senderStyle !== "object" || senderStyle.v !== 1) {
    return null;
  }

  return {
    bubbleColorId: senderStyle.bubbleColorId ?? null,
    bubbleColorHex: senderStyle.bubbleColorHex ?? null,
    fontId: senderStyle.fontId ?? null,
    fontKey: senderStyle.fontKey ?? null,
    fontColorId: senderStyle.fontColorId ?? null,
    fontColorHex: senderStyle.fontColorHex ?? null,
    animalThemeId: senderStyle.animalThemeId ?? null,
    v: 1,
  };
}

export function buildSenderStyleFromChatAppearance(
  chatAppearance: ChatAppearanceSnapshot | null | undefined,
): SenderStyleV1 | null {
  if (!chatAppearance) return null;

  return {
    bubbleColorId: chatAppearance.bubbleColorId ?? null,
    bubbleColorHex: null,
    fontId: chatAppearance.fontId ?? null,
    fontKey: null,
    fontColorId: chatAppearance.fontColorId ?? null,
    fontColorHex: null,
    animalThemeId: chatAppearance.animalThemeId ?? null,
    v: 1,
  };
}

// =============================================================================
// Group Settings Types (Segment 9 — mirrored from client)
// =============================================================================

interface GroupSettingsDoc {
  /** Minimum seconds between messages per member (0 = off) */
  slowModeSeconds?: number;
  /** Only admins/owner can send; members read-only */
  announcementOnly?: boolean;
  /** Allow non-admin members to send media attachments */
  allowMediaFromMembers?: boolean;
  /** Allow @all / @everyone mentions from non-admins */
  allowMentionsAll?: boolean;
  /**
   * Message retention semantics (Segment 9 — document only, no server enforcement).
   * - "standard": normal history, search & pins work as usual.
   * - "ephemeral_client_only": clients should auto-expire local messages after a
   *   configurable TTL. Server does NOT delete; it simply skips indexing for
   *   full-text search and disables pinning. Future segments may add server-side
   *   TTL via a scheduled Cloud Function.
   */
  retentionMode?: "standard" | "ephemeral_client_only";
}

// =============================================================================
// Group Settings Helpers (Segment 9)
// =============================================================================

// Server-side permission resolution (mirrors client groupPermissions.ts)
type GroupRole = "owner" | "admin" | "member";
interface PermissionFlags {
  [key: string]: boolean;
}
interface PermissionsConfig {
  adminPermissions?: PermissionFlags;
  memberPermissions?: PermissionFlags;
}

const OWNER_PERMISSIONS_SERVER: PermissionFlags = {
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

const DEFAULT_ADMIN_PERMISSIONS_SERVER: PermissionFlags = {
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

const DEFAULT_MEMBER_PERMISSIONS_SERVER: PermissionFlags = {
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

function resolvePermissionsServer(
  role: GroupRole,
  config?: PermissionsConfig,
): PermissionFlags {
  if (role === "owner") return { ...OWNER_PERMISSIONS_SERVER };
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
async function loadGroupSettings(
  groupId: string,
): Promise<GroupSettingsDoc | null> {
  const db = getDb();
  const groupDoc = await db.collection("Groups").doc(groupId).get();
  if (!groupDoc.exists) return null;
  return (groupDoc.data()?.settings as GroupSettingsDoc) ?? null;
}

/**
 * Load a user's role and resolved permissions for a group.
 *
 * Returns the user's role and capability-resolved permission flags,
 * taking the group's permissionsConfig into account.
 */
async function getGroupMemberPermissions(
  groupId: string,
  uid: string,
): Promise<{ role: GroupRole; permissions: PermissionFlags } | null> {
  const db = getDb();
  const [memberDoc, groupDoc] = await Promise.all([
    db.collection("Groups").doc(groupId).collection("Members").doc(uid).get(),
    db.collection("Groups").doc(groupId).get(),
  ]);

  if (!memberDoc.exists) return null;

  const memberData = memberDoc.data();
  let role: GroupRole = (memberData?.role as GroupRole) ?? "member";

  // Also check owner via createdBy / ownerId
  if (groupDoc.exists) {
    const gd = groupDoc.data();
    if (gd?.ownerId === uid || gd?.createdBy === uid) {
      role = "owner";
    }
  }

  const config = groupDoc.exists
    ? (groupDoc.data()?.permissionsConfig as PermissionsConfig | undefined)
    : undefined;

  return { role, permissions: resolvePermissionsServer(role, config) };
}

/**
 * Check whether a user is an admin or owner in a group.
 *
 * Reads Groups/{groupId}/Members/{uid}.role and the top-level
 * Groups/{groupId}.createdBy field.
 */
async function isGroupAdminOrOwner(
  groupId: string,
  uid: string,
): Promise<boolean> {
  const db = getDb();
  const [memberDoc, groupDoc] = await Promise.all([
    db.collection("Groups").doc(groupId).collection("Members").doc(uid).get(),
    db.collection("Groups").doc(groupId).get(),
  ]);

  // Owner check
  if (groupDoc.exists && groupDoc.data()?.createdBy === uid) return true;

  // Admin role check
  if (memberDoc.exists) {
    const role = memberDoc.data()?.role;
    if (role === "admin" || role === "owner") return true;
  }

  return false;
}

/**
 * Look up the last message timestamp by this user in a group.
 *
 * Used for slow-mode enforcement. Returns 0 if no prior messages found.
 */
async function getLastGroupMessageTimestamp(
  groupId: string,
  uid: string,
): Promise<number> {
  const db = getDb();
  const snap = await db
    .collection("Groups")
    .doc(groupId)
    .collection("Messages")
    .where("senderId", "==", uid)
    .orderBy("serverReceivedAt", "desc")
    .limit(1)
    .get();

  if (snap.empty) return 0;
  const data = snap.docs[0].data();
  const ts = data.serverReceivedAt;
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts === "number") return ts;
  return 0;
}

/**
 * Enforce GroupSettings on a sendMessageV2 call (Segment 9).
 *
 * Throws HttpsError if the user's send is rejected.
 * No-op if ENABLE_GROUP_SETTINGS_ENFORCEMENT is false.
 */
async function enforceGroupSettings(
  groupId: string,
  senderId: string,
  kind: string,
  mentionUids?: string[],
): Promise<void> {
  if (!ENABLE_GROUP_SETTINGS_ENFORCEMENT) return;

  const settings = await loadGroupSettings(groupId);
  if (!settings) return; // no settings doc → no restrictions

  // Resolve capability-based permissions for this user
  const memberPerms = await getGroupMemberPermissions(groupId, senderId);
  const perms = memberPerms?.permissions;
  const isAdmin = perms
    ? !!perms.MANAGE_ROLES || !!perms.KICK_MEMBERS
    : await isGroupAdminOrOwner(groupId, senderId);

  // 1. Announcement-only: users without SEND_MESSAGES cannot send
  if (settings.announcementOnly && !(perms?.SEND_MESSAGES ?? isAdmin)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "This group is in announcement-only mode. Only admins can send messages.",
    );
  }

  // 2. Slow mode: enforce minimum gap between messages (exempt admins/owners)
  if (settings.slowModeSeconds && settings.slowModeSeconds > 0 && !isAdmin) {
    const lastTs = await getLastGroupMessageTimestamp(groupId, senderId);
    if (lastTs > 0) {
      const elapsed = (Date.now() - lastTs) / 1000;
      if (elapsed < settings.slowModeSeconds) {
        const waitSec = Math.ceil(settings.slowModeSeconds - elapsed);
        throw new functions.https.HttpsError(
          "resource-exhausted",
          `Slow mode active. Please wait ${waitSec} seconds before sending another message.`,
        );
      }
    }
  }

  // 3. Media permission: check SEND_MEDIA capability
  if (
    settings.allowMediaFromMembers === false &&
    !(perms?.SEND_MEDIA ?? isAdmin) &&
    (kind === "media" || kind === "voice" || kind === "file")
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can send media in this group.",
    );
  }

  // 4. @mention all: check MENTION_EVERYONE capability
  if (
    settings.allowMentionsAll === false &&
    !(perms?.MENTION_EVERYONE ?? isAdmin) &&
    mentionUids
  ) {
    if (
      mentionUids.includes("all") ||
      mentionUids.includes("@all") ||
      mentionUids.includes("everyone")
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can mention @all in this group.",
      );
    }
  }
}

// =============================================================================
// Input Validation Helpers
// =============================================================================

/**
 * Validate a string parameter
 */
function isValidString(
  value: unknown,
  minLen = 1,
  maxLen = 10000,
): value is string {
  if (typeof value !== "string") return false;
  if (value.length < minLen || value.length > maxLen) return false;
  return true;
}

/**
 * Validate a user ID format
 */
function isValidUid(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return (
    value.length >= 20 && value.length <= 128 && /^[a-zA-Z0-9]+$/.test(value)
  );
}

/**
 * Sanitize input for logging (remove PII)
 */
function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "text" && typeof value === "string") {
      sanitized[key] = value.length > 0 ? `[${value.length} chars]` : "[empty]";
    } else if (typeof value === "string" && value.length > 50) {
      sanitized[key] = value.substring(0, 20) + "...";
    } else {
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
async function checkMembership(
  conversationId: string,
  scope: "dm" | "group",
  uid: string,
): Promise<boolean> {
  const db = getDb();
  if (scope === "dm") {
    const chatDoc = await db.collection("Chats").doc(conversationId).get();
    if (!chatDoc.exists) return false;
    const members = chatDoc.data()?.members || [];
    return members.includes(uid);
  } else {
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
async function isBlocked(uid1: string, uid2: string): Promise<boolean> {
  const db = getDb();
  // Check if uid1 blocked uid2
  const block1 = await db
    .collection("Users")
    .doc(uid1)
    .collection("blockedUsers")
    .doc(uid2)
    .get();
  if (block1.exists) return true;

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
async function getChatMembers(chatId: string): Promise<string[]> {
  const db = getDb();
  const chatDoc = await db.collection("Chats").doc(chatId).get();
  return chatDoc.exists ? chatDoc.data()?.members || [] : [];
}

/**
 * Get user profile for sender info
 */
async function getUserProfile(uid: string): Promise<{
  displayName?: string;
  avatarConfig?: unknown;
  chatAppearance?: {
    bubbleColorId?: string | null;
    fontId?: string | null;
    fontColorId?: string | null;
    animalThemeId?: string | null;
  };
} | null> {
  const db = getDb();
  const userDoc = await db.collection("Users").doc(uid).get();
  if (!userDoc.exists) return null;
  const data = userDoc.data()!;
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
async function checkRateLimit(uid: string): Promise<boolean> {
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

      const data = rateLimitDoc.data()!;
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
  } catch (error) {
    console.error("[checkRateLimit] Error:", error);
    // Allow on error to prevent blocking legitimate users
    return true;
  }
}

// =============================================================================
// Types
// =============================================================================

interface SendMessageV2Input {
  conversationId: string;
  scope: "dm" | "group";
  kind: "text" | "media" | "voice" | "file" | "system" | "animal";
  text?: string;
  /** Animal theme ID (required when kind="animal") */
  animalId?: string;
  replyTo?: {
    messageId: string;
    senderId: string;
    senderName?: string;
    kind: string;
    textSnippet?: string;
    attachmentPreview?: {
      kind: string;
      thumbUrl?: string;
    };
  };
  mentionUids?: string[];
  mentionSpans?: Array<{
    uid: string;
    start: number;
    end: number;
  }>;
  attachments?: Array<{
    id: string;
    kind: string;
    mime: string;
    url: string;
    path: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    durationMs?: number;
    thumbUrl?: string;
    thumbPath?: string;
    caption?: string;
    viewOnce?: boolean;
  }>;
  /** Staged attachments (Segment 3 — media pipeline). Mutually exclusive with `attachments`. */
  stagedAttachments?: Array<{
    id: string;
    kind: string;
    mime: string;
    path: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    durationMs?: number;
    thumbPath?: string;
    caption?: string;
    viewOnce?: boolean;
  }>;
  clientId: string;
  messageId: string;
  createdAt?: number;
  /** Thread root message ID for reply threading */
  threadRootId?: string;
  /** Client-generated trace ID for cross-system log correlation (Segment 8) */
  traceId?: string;
  /**
   * Stable per-device identifier (matches Users/{uid}/NotificationDevices doc id).
   * Stamped on the message doc so the notification trigger can exclude the
   * sender's own device from push and in-app targeting.
   */
  senderDeviceId?: string;
  /** Sender's chat style snapshot (bubble color, font, font color, animal theme) */
  senderStyle?: SenderStyleV1;
  /**
   * Trusted game-scorecard share payload. When present the server
   * validates the schema, overrides `text` with a generic label, and
   * stamps the message with `clientId: server-share:{senderId}` so the
   * renderer will trust-decode it as a rich scorecard. This is the
   * ONLY client path that can produce a rendered scorecard — raw
   * sentinel text sent via `text` is rejected.
   */
  scorecardPayload?: {
    v: 1;
    sessionId: string;
    gameId: string;
    gameTitle: string;
    runtimeType: string;
    resolutionType: string;
    winnerIds: string[];
    scoreboard: Array<{
      uid: string;
      displayName: string;
      profilePictureUrl?: string | null;
      decorationId?: string | null;
      score: number;
      placement?: number;
    }>;
    durationMs?: number;
    createdAt?: number;
    winnerEquippedBackgroundId?: string | null;
    senderEquippedBackgroundId?: string | null;
  };
}

interface SendMessageV2Response {
  success: boolean;
  message: {
    id: string;
    serverReceivedAt: number;
    [key: string]: unknown;
  };
  isExisting: boolean;
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
export const sendMessageV2 = secureCallableRuntime().https.onCall(
  async (data: SendMessageV2Input, context): Promise<SendMessageV2Response> => {
    const db = getDb();
    // 1. Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to send messages",
      );
    }

    const senderId = context.auth.uid;
    const {
      conversationId,
      scope,
      kind,
      text,
      replyTo,
      threadRootId,
      mentionUids,
      mentionSpans,
      attachments,
      stagedAttachments,
      clientId,
      messageId,
      createdAt,
      traceId,
      senderStyle,
      animalId,
      senderDeviceId,
      scorecardPayload,
    } = data;

    // Segment 8: Log traceId if present (for cross-system correlation)
    const logTraceId =
      traceId || `srv-${messageId?.substring(0, 12) || "unknown"}`;

    console.log(
      `[sendMessageV2] Request from ${senderId.substring(0, 8)}:`,
      sanitizeForLog({
        conversationId,
        scope,
        kind,
        messageId,
        traceId: logTraceId,
      }),
    );

    // 2. Validate required fields
    if (!isValidString(conversationId, 1, 100)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid conversationId",
      );
    }

    if (!["dm", "group"].includes(scope)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Scope must be 'dm' or 'group'",
      );
    }

    if (
      !["text", "media", "voice", "file", "system", "animal"].includes(kind)
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid message kind",
      );
    }

    if (!isValidString(clientId, 1, 100)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid clientId",
      );
    }

    // Security: clients cannot impersonate server-authored messages by
    // sending a `server*` clientId. The renderer's scorecard trust gate
    // keys off this prefix, so we must guard it at ingress.
    if (clientId === "server" || clientId.startsWith("server-share:")) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Reserved clientId",
      );
    }

    if (!isValidString(messageId, 1, 100)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid messageId",
      );
    }

    // Validate text content if present
    if (text !== undefined && text !== null && !isValidString(text, 0, 10000)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Text content too long (max 10000 chars)",
      );
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
    let trustedScorecardClientId: string | null = null;
    let overriddenText: string | null = null;

    if (scorecardPayload) {
      // Structural validation. We deliberately rebuild the payload
      // ourselves from primitives so untrusted fields can't leak into
      // the stored document.
      const sp = scorecardPayload as Record<string, unknown>;
      const scoreboardRaw = Array.isArray(sp.scoreboard) ? sp.scoreboard : [];
      const winnerIdsRaw = Array.isArray(sp.winnerIds) ? sp.winnerIds : [];
      const valid =
        sp.v === 1 &&
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
          if (!e || typeof e !== "object") return false;
          const entry = e as Record<string, unknown>;
          return (
            typeof entry.uid === "string" &&
            entry.uid.length > 0 &&
            entry.uid.length <= 128 &&
            typeof entry.displayName === "string" &&
            entry.displayName.length <= 128 &&
            typeof entry.score === "number" &&
            isFinite(entry.score)
          );
        });

      if (!valid) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Invalid scorecardPayload",
        );
      }

      // Re-serialize. This is the sole path by which a sentinel-prefixed
      // text can land in Firestore from a client call, and we build it
      // ourselves from validated primitives only.
      const cleanPayload = {
        v: 1,
        sessionId: sp.sessionId as string,
        gameId: sp.gameId as string,
        gameTitle: sp.gameTitle as string,
        runtimeType: sp.runtimeType as string,
        resolutionType: sp.resolutionType as string,
        winnerIds: winnerIdsRaw as string[],
        scoreboard: scoreboardRaw.map((e) => {
          const entry = e as Record<string, unknown>;
          return {
            uid: entry.uid as string,
            displayName: entry.displayName as string,
            profilePictureUrl:
              typeof entry.profilePictureUrl === "string"
                ? entry.profilePictureUrl
                : null,
            decorationId:
              typeof entry.decorationId === "string" &&
              entry.decorationId.length <= 128
                ? entry.decorationId
                : null,
            score: entry.score as number,
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
        winnerEquippedBackgroundId:
          typeof sp.winnerEquippedBackgroundId === "string"
            ? sp.winnerEquippedBackgroundId
            : null,
        // Preserve sender-equipped background ID. Solo scorecards
        // personalize from this field regardless of win/loss so the
        // card always shows the sender's profile background.
        senderEquippedBackgroundId:
          typeof sp.senderEquippedBackgroundId === "string"
            ? sp.senderEquippedBackgroundId
            : null,
      };
      overriddenText = `${SCORECARD_SENTINEL}${JSON.stringify(
        cleanPayload,
      )}\nGame Scorecard`;
      trustedScorecardClientId = `server-share:${senderId}`;
    } else if (text && text.startsWith(SCORECARD_SENTINEL)) {
      // No structured payload but the text begins with the scorecard
      // sentinel — this is a spoofing attempt (a regular user trying to
      // fake a game result by pasting scorecard text). Reject.
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Scorecard messages must be sent via the structured scorecard payload",
      );
    }

    // Validate kind requires content
    if (kind === "text" && (!text || text.trim().length === 0)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Text messages must have content",
      );
    }

    // Validate mentions count
    if (mentionUids && mentionUids.length > 5) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Maximum 5 mentions per message",
      );
    }

    // === Animal message entitlement enforcement ===
    if (kind === "animal") {
      if (!animalId || typeof animalId !== "string" || animalId.length < 1) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Animal messages must include a valid animalId",
        );
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
        console.warn(
          `[sendMessageV2] Animal entitlement denied: ${senderId.substring(0, 8)} does not own ${animalId}`,
        );
        throw new functions.https.HttpsError(
          "permission-denied",
          "You do not own this animal theme",
        );
      }

      // Verify the animal is currently equipped
      const senderProfile = await getUserProfile(senderId);
      if (senderProfile?.chatAppearance?.animalThemeId !== animalId) {
        console.warn(
          `[sendMessageV2] Animal equip denied: ${senderId.substring(0, 8)} has ${senderProfile?.chatAppearance?.animalThemeId} equipped, tried ${animalId}`,
        );
        throw new functions.https.HttpsError(
          "permission-denied",
          "This animal theme is not equipped",
        );
      }
    }

    // Validate attachments
    if (attachments && attachments.length > 10) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Maximum 10 attachments per message",
      );
    }

    // Validate staged attachments
    if (stagedAttachments && stagedAttachments.length > 10) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Maximum 10 attachments per message",
      );
    }

    // Mutual exclusion: cannot provide both legacy and staged attachments
    if (
      attachments &&
      attachments.length > 0 &&
      stagedAttachments &&
      stagedAttachments.length > 0
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Cannot provide both attachments and stagedAttachments",
      );
    }

    // 3. Membership check
    const isMember = await checkMembership(conversationId, scope, senderId);
    if (!isMember) {
      console.log(
        `[sendMessageV2] Non-member attempt: ${senderId.substring(0, 8)}`,
      );
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not a member of this conversation",
      );
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
          console.log(
            `[sendMessageV2] Blocked user attempt: ${senderId.substring(0, 8)} <-> ${otherUid.substring(0, 8)}`,
          );
          throw new functions.https.HttpsError(
            "permission-denied",
            "Cannot send message to this user",
          );
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
        const gatingResult = await checkDmAcceptance(
          senderId,
          otherUid,
          conversationId,
          previewForGating,
          kind,
        );

        if (gatingResult.outcome === "rejected") {
          throw new functions.https.HttpsError(
            "permission-denied",
            gatingResult.reason,
          );
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
      const globalResult = await checkGlobalRateLimit(senderId);
      if (!globalResult.allowed) {
        console.log(
          `[sendMessageV2] Global rate limited: ${senderId.substring(0, 8)} ` +
            `(remaining=${globalResult.remaining}, retryAfter=${globalResult.retryAfterSeconds}s)`,
        );
        throw new functions.https.HttpsError(
          "resource-exhausted",
          `Rate limit exceeded. Please wait ${globalResult.retryAfterSeconds ?? 60} seconds.`,
        );
      }
    } else {
      const rateLimitOk = await checkRateLimit(senderId);
      if (!rateLimitOk) {
        console.log(
          `[sendMessageV2] Rate limited: ${senderId.substring(0, 8)}`,
        );
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "Rate limit exceeded. Please wait before sending more messages.",
        );
      }
    }

    // 6. Build collection path
    const collectionPath =
      scope === "dm"
        ? `Chats/${conversationId}/Messages`
        : `Groups/${conversationId}/Messages`;

    // 7. IDEMPOTENCY: Check if message already exists
    const existingDoc = await db
      .collection(collectionPath)
      .doc(messageId)
      .get();
    if (existingDoc.exists) {
      console.log(
        `[sendMessageV2] Idempotent return for existing message ${messageId.substring(0, 8)}`,
      );
      const existingData = existingDoc.data()!;
      return {
        success: true,
        message: {
          id: existingDoc.id,
          ...existingData,
          serverReceivedAt:
            existingData.serverReceivedAt?.toMillis?.() ||
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
    const legacyTypeMap: Record<string, string> = {
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

    const messageData: Record<string, unknown> = {
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
    const normalizedSenderStyle = normalizeSenderStyleSnapshot(senderStyle);
    if (normalizedSenderStyle) {
      messageData.senderStyle = normalizedSenderStyle;
    }

    // Segment 3: Staged media pipeline — commit staged attachments to final
    // paths, strip download tokens, and store path-only references.
    if (stagedAttachments && stagedAttachments.length > 0) {
      const committed = await commitStagedAttachments(
        scope,
        conversationId,
        messageId,
        stagedAttachments,
      );
      messageData.attachments = committed;
      console.log(
        `[sendMessageV2] Committed ${committed.length} staged attachment(s) for ${messageId.substring(0, 8)}`,
      );
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
          const fallbackSenderStyle = buildSenderStyleFromChatAppearance(
            senderProfile.chatAppearance as ChatAppearanceSnapshot,
          );
          if (fallbackSenderStyle) {
            messageData.senderStyle = fallbackSenderStyle;
          }
        }
      }
    }

    // For DMs: server-side fallback for senderStyle when not provided by client
    if (scope === "dm" && !messageData.senderStyle) {
      const senderProfile = await getUserProfile(senderId);
      if (senderProfile?.chatAppearance) {
        const fallbackSenderStyle = buildSenderStyleFromChatAppearance(
          senderProfile.chatAppearance as ChatAppearanceSnapshot,
        );
        if (fallbackSenderStyle) {
          messageData.senderStyle = fallbackSenderStyle;
        }
      }
    }

    // 9. Write message document
    console.log(
      `[sendMessageV2] Creating message ${messageId.substring(0, 8)}`,
    );
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
      } catch (threadErr) {
        // Non-fatal: root message may have been deleted; log and continue
        console.warn(
          `[sendMessageV2] Failed to update thread root ${threadRootId.substring(0, 8)}:`,
          threadErr,
        );
      }
    }

    // 10. Update conversation preview (lastMessage fields)
    const previewText = getPreviewText(
      kind,
      text,
      attachments || stagedAttachments,
    );
    const conversationRef =
      scope === "dm"
        ? db.collection("Chats").doc(conversationId)
        : db.collection("Groups").doc(conversationId);

    try {
      const conversationUpdate: Record<string, unknown> = {
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
      } else {
        conversationUpdate.lastMentionUids =
          admin.firestore.FieldValue.delete();
      }

      await conversationRef.update(conversationUpdate);
    } catch (updateError) {
      // Log but don't fail - preview is not critical
      console.warn(
        `[sendMessageV2] Failed to update conversation preview:`,
        updateError,
      );
    }

    console.log(
      `[sendMessageV2] Successfully created message ${messageId.substring(0, 8)}`,
    );

    return {
      success: true,
      message: {
        id: messageId,
        ...messageData,
        serverReceivedAt: serverNow, // Approximate for immediate response
      },
      isExisting: false,
    };
  },
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate preview text for conversation list
 */
function getPreviewText(
  kind: string,
  text?: string,
  attachments?: Array<{ kind?: string }>,
): string {
  const sanitizedText = sanitizeMessagePreviewText(text);
  if (sanitizedText === SCORECARD_VISIBLE_TEXT) {
    return SCORECARD_VISIBLE_TEXT;
  }
  if (kind === "text" && sanitizedText) {
    return sanitizedText.length > 50
      ? sanitizedText.substring(0, 50) + "..."
      : sanitizedText;
  }

  if (kind === "media") {
    const count = attachments?.length || 1;
    if (count > 1) return `📷 ${count} photos`;
    const attachment = attachments?.[0];
    if (attachment?.kind === "video") return "📹 Video";
    return "📷 Photo";
  }

  if (kind === "voice") return "🎤 Voice message";
  if (kind === "file") return "📎 File";
  if (kind === "system") return sanitizedText || "System message";
  if (kind === "animal") return "🐾 Animal sticker";

  return sanitizedText || "";
}

// =============================================================================
// H7: Edit Message Cloud Function
// =============================================================================

/** Edit window in milliseconds (15 minutes) */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

interface EditMessageInput {
  conversationId: string;
  scope: "dm" | "group";
  messageId: string;
  newText: string;
}

interface EditMessageResponse {
  success: boolean;
  editedAt?: number;
  error?: string;
}

/**
 * Edit a message (sender only, within edit window)
 *
 * Rules:
 * - Only sender can edit
 * - Must be within 15-minute window
 * - Only text field can change
 * - Cannot edit deleted messages
 */
export const editMessageV2 = secureCallableRuntime().https.onCall(
  async (data: EditMessageInput, context): Promise<EditMessageResponse> => {
    const db = getDb();
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to edit messages",
      );
    }

    const uid = context.auth.uid;
    const { conversationId, scope, messageId, newText } = data;

    console.log(
      `[editMessageV2] Request from ${uid.substring(0, 8)}: messageId=${messageId.substring(0, 8)}`,
    );

    // Validate inputs
    if (!isValidString(conversationId, 1, 100)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid conversationId",
      );
    }

    if (!["dm", "group"].includes(scope)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Scope must be 'dm' or 'group'",
      );
    }

    if (!isValidString(messageId, 1, 100)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid messageId",
      );
    }

    if (!isValidString(newText, 1, 10000)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "New text must be 1-10000 characters",
      );
    }

    // Get the message
    const collectionPath =
      scope === "dm"
        ? `Chats/${conversationId}/Messages`
        : `Groups/${conversationId}/Messages`;

    const messageRef = db.collection(collectionPath).doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Message not found");
    }

    const messageData = messageDoc.data()!;

    // Check sender
    if (messageData.senderId !== uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Can only edit your own messages",
      );
    }

    // Check if deleted
    if (messageData.deletedForAll) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot edit a deleted message",
      );
    }

    // Check message kind
    if (messageData.kind !== "text") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Can only edit text messages",
      );
    }

    // Check edit window
    const serverReceivedAt =
      messageData.serverReceivedAt?.toMillis?.() ||
      messageData.serverReceivedAt ||
      messageData.createdAt;
    const elapsed = Date.now() - serverReceivedAt;

    if (elapsed > EDIT_WINDOW_MS) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Edit window has expired (15 minutes)",
      );
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

    console.log(
      `[editMessageV2] Successfully edited message ${messageId.substring(0, 8)}`,
    );

    return {
      success: true,
      editedAt,
    };
  },
);

// =============================================================================
// H7: Delete Message For All Cloud Function
// =============================================================================

interface DeleteMessageInput {
  conversationId: string;
  scope: "dm" | "group";
  messageId: string;
}

interface DeleteMessageResponse {
  success: boolean;
  deletedAt?: number;
  error?: string;
}

/**
 * Get user's role in a group
 */
async function getGroupRole(
  groupId: string,
  uid: string,
): Promise<"owner" | "admin" | "moderator" | "member" | null> {
  const db = getDb();
  const memberDoc = await db
    .collection("Groups")
    .doc(groupId)
    .collection("Members")
    .doc(uid)
    .get();

  if (!memberDoc.exists) return null;
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
export const deleteMessageForAllV2 = secureCallableRuntime().https.onCall(
  async (data: DeleteMessageInput, context): Promise<DeleteMessageResponse> => {
    const db = getDb();
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to delete messages",
      );
    }

    const uid = context.auth.uid;
    const { conversationId, scope, messageId } = data;

    console.log(
      `[deleteMessageForAllV2] Request from ${uid.substring(0, 8)}: messageId=${messageId.substring(0, 8)}`,
    );

    // Validate inputs
    if (!isValidString(conversationId, 1, 100)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid conversationId",
      );
    }

    if (!["dm", "group"].includes(scope)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Scope must be 'dm' or 'group'",
      );
    }

    if (!isValidString(messageId, 1, 100)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid messageId",
      );
    }

    // Get the message
    const collectionPath =
      scope === "dm"
        ? `Chats/${conversationId}/Messages`
        : `Groups/${conversationId}/Messages`;

    const messageRef = db.collection(collectionPath).doc(messageId);
    const messageDoc = await messageRef.get();

    if (!messageDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Message not found");
    }

    const messageData = messageDoc.data()!;

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
      const serverReceivedAt =
        messageData.serverReceivedAt?.toMillis?.() ||
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
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not authorized to delete this message",
      );
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

    console.log(
      `[deleteMessageForAllV2] Successfully deleted message ${messageId.substring(0, 8)}`,
    );

    return {
      success: true,
      deletedAt,
    };
  },
);

// =============================================================================
// H8: Toggle Reaction Cloud Function
// =============================================================================

/** Rate limit: max 10 reactions per minute per user */
const REACTION_RATE_LIMIT_PER_MINUTE = 10;

/** Max unique emojis per message */
const MAX_EMOJIS_PER_MESSAGE = 12;

/** Allowed emoji set — accepts any valid emoji string (≤ 10 chars) */
function isValidEmoji(emoji: unknown): emoji is string {
  return typeof emoji === "string" && emoji.length > 0 && emoji.length <= 10;
}

interface ToggleReactionInput {
  conversationId: string;
  scope: "dm" | "group";
  messageId: string;
  emoji: string;
}

interface ToggleReactionResponse {
  success: boolean;
  action: "added" | "removed";
  reactionsSummary: Record<string, number>;
  error?: string;
}

/**
 * Check and update rate limit for reactions
 */
async function checkReactionRateLimit(uid: string): Promise<boolean> {
  const db = getDb();
  const rateLimitRef = db.collection("RateLimits").doc(`reactions_${uid}`);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const rateLimitDoc = await transaction.get(rateLimitRef);

      if (!rateLimitDoc.exists) {
        transaction.set(rateLimitRef, { windowStart: Date.now(), count: 1 });
        return true;
      }

      const data = rateLimitDoc.data()!;
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
  } catch (error) {
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
export const toggleReactionV2 = secureCallableRuntime().https.onCall(
  async (
    data: ToggleReactionInput,
    context,
  ): Promise<ToggleReactionResponse> => {
    const db = getDb();
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to react to messages",
      );
    }

    const uid = context.auth.uid;
    const { conversationId, scope, messageId, emoji } = data;

    console.log(
      `[toggleReactionV2] Request from ${uid.substring(0, 8)}: emoji=${emoji} on message=${messageId.substring(0, 8)}`,
    );

    // Validate inputs
    if (!isValidString(conversationId, 1, 100)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid conversationId",
      );
    }

    if (!["dm", "group"].includes(scope)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Scope must be 'dm' or 'group'",
      );
    }

    if (!isValidString(messageId, 1, 100)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid messageId",
      );
    }

    // Validate emoji
    if (!isValidEmoji(emoji)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid emoji — must be a non-empty string of at most 10 characters",
      );
    }

    // Membership check
    const isMember = await checkMembership(conversationId, scope, uid);
    if (!isMember) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not a member of this conversation",
      );
    }

    // Rate limit check
    const rateLimitOk = await checkReactionRateLimit(uid);
    if (!rateLimitOk) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Reaction rate limit exceeded. Please wait before reacting again.",
      );
    }

    // Build paths
    const collectionPath =
      scope === "dm"
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

      const messageData = messageDoc.data()!;

      // Can't react to deleted messages
      if (messageData.deletedForAll) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Cannot react to a deleted message",
        );
      }

      // Get current reaction doc
      const reactionDoc = await transaction.get(reactionRef);
      const currentSummary: Record<string, number> =
        messageData.reactionsSummary || {};
      let action: "added" | "removed";

      if (reactionDoc.exists) {
        const reactionData = reactionDoc.data()!;
        const uids: string[] = reactionData.uids || [];
        const hasReacted = uids.includes(uid);

        if (hasReacted) {
          // Remove reaction
          const newUids = uids.filter((u) => u !== uid);

          if (newUids.length === 0) {
            // Delete reaction doc
            transaction.delete(reactionRef);
            delete currentSummary[emoji];
          } else {
            // Update reaction doc
            transaction.update(reactionRef, {
              uids: newUids,
              count: newUids.length,
              updatedAt: Date.now(),
            });
            currentSummary[emoji] = newUids.length;
          }

          action = "removed";
        } else {
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
      } else {
        // New emoji reaction - check max emoji limit
        const uniqueEmojis = Object.keys(currentSummary).length;
        if (uniqueEmojis >= MAX_EMOJIS_PER_MESSAGE) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Maximum ${MAX_EMOJIS_PER_MESSAGE} unique emojis per message`,
          );
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

    console.log(
      `[toggleReactionV2] ${result.action} ${emoji} on message ${messageId.substring(0, 8)}`,
    );

    return {
      success: true,
      action: result.action,
      reactionsSummary: result.reactionsSummary,
    };
  },
);

// =============================================================================
// Exports
// =============================================================================

export {
  deleteMessageForAllV2 as deleteMessageForAllV2Function,
  editMessageV2 as editMessageV2Function,
  sendMessageV2 as sendMessageV2Function,
  toggleReactionV2 as toggleReactionV2Function,
};
