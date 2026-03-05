/**
 * Messaging Types V2
 *
 * This module contains all the type definitions for the new V2 messaging system.
 * These types support:
 * - Server-authoritative timestamps (serverReceivedAt)
 * - Idempotent message creation
 * - Multi-attachment support
 * - Reply threading
 * - Reactions
 * - Mentions
 * - Read receipt watermarks
 * - Per-chat notification preferences
 *
 * @module types/messaging
 */

import { AvatarConfig } from "./models";

// =============================================================================
// Message Types V2
// =============================================================================

/** Message content type */
export type MessageKind =
  | "text"
  | "media"
  | "voice"
  | "file"
  | "system"
  | "animal";

/** Attachment content type */
export type AttachmentKind = "image" | "video" | "audio" | "file";

/** Message delivery/read status */
export type MessageStatusV2 =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

/**
 * V2 Message - Unified for DM and Group
 *
 * Key differences from V1:
 * - `serverReceivedAt` for authoritative ordering (set by Cloud Function)
 * - `idempotencyKey` for duplicate prevention
 * - `attachments[]` for multi-attachment support
 * - `replyTo` for threading
 * - `hiddenFor[]` for delete-for-me
 * - `deletedForAll` for delete-for-everyone
 */
export interface MessageV2 {
  /** Document ID = client-generated UUID */
  id: string;

  /** Conversation scope: "dm" for 1:1 chats, "group" for group chats */
  scope: "dm" | "group";

  /** Chat or Group document ID */
  conversationId: string;

  /** Sender's user ID */
  senderId: string;

  /** Sender display name (required in groups, optional in DMs) */
  senderName?: string;

  /** Sender avatar configuration snapshot */
  senderAvatarConfig?: AvatarConfig;

  /** Message type */
  kind: MessageKind;

  /** Text content (for text messages or captions) */
  text?: string;

  /** Animal theme ID (for kind: "animal") — e.g. "animal_duck", "animal_bear" */
  animalId?: string;

  /** Client-side timestamp when user tapped send (for intent/UI) */
  createdAt: number;

  /**
   * SERVER-AUTHORITATIVE: Timestamp set by Cloud Function
   * Used for message ordering to prevent clock-skew issues
   */
  serverReceivedAt: number;

  /** Timestamp when message was last edited */
  editedAt?: number;

  /** Reply-to metadata for threading */
  replyTo?: ReplyToMetadata;

  /**
   * Thread root message ID.
   * Set when this message is part of a reply thread.
   * Points to the top-level message that started the thread.
   * If a user replies to a reply, this still points to the original root.
   */
  threadRootId?: string | null;

  /** Number of replies in the thread (only set on the root message) */
  replyCount?: number;

  /** Timestamp of the most recent reply (only set on the root message) */
  lastReplyAt?: number;

  /** Soft delete marker for delete-for-everyone */
  deletedForAll?: {
    /** User ID who deleted */
    by: string;
    /** Timestamp of deletion */
    at: number;
  };

  /** User IDs who have hidden this message (delete-for-me) */
  hiddenFor?: string[];

  /** User IDs mentioned in this message */
  mentionUids?: string[];

  /** Text spans for mention highlighting */
  mentionSpans?: MentionSpan[];

  /** Attachments (images, videos, files, etc.) */
  attachments?: AttachmentV2[];

  /** Link preview data */
  linkPreview?: LinkPreviewV2;

  /** Stable client device ID for idempotency */
  clientId: string;

  /** Idempotency key: `${clientId}:${id}` - used to prevent duplicates */
  idempotencyKey: string;

  /** Denormalized reaction counts: { "🔥": 2, "❤️": 1 } */
  reactionsSummary?: Record<string, number>;

  /**
   * Snapshot of the sender's chat style at send time.
   * Used by recipients to render the sender's bubble color, font, etc.
   * Missing on historical messages — fall back to sender profile lookup.
   */
  senderStyle?: {
    bubbleColorId?: string | null;
    bubbleColorHex?: string | null;
    fontId?: string | null;
    fontKey?: string | null;
    animalThemeId?: string | null;
    v: 1;
  };

  // =========================================================================
  // Legacy Compatibility Fields (deprecated)
  // =========================================================================

  /** @deprecated Use `text` instead */
  content?: string;

  /** @deprecated Use `kind` instead */
  type?: "text" | "image";

  /** @deprecated Use member watermarks instead */
  read?: boolean;

  /** @deprecated Use `serverReceivedAt` for ordering */
  expiresAt?: number;

  /** @deprecated Use MessageStatusV2 */
  status?: "sending" | "sent" | "delivered" | "failed";

  /** @deprecated Handled by outbox */
  isLocal?: boolean;

  /** @deprecated Renamed to `id` */
  clientMessageId?: string;

  /** @deprecated Handled by outbox */
  errorMessage?: string;
}

/**
 * Reply-to metadata snapshot
 *
 * Contains a frozen snapshot of the replied-to message
 * to avoid issues if the original is edited or deleted.
 */
export interface ReplyToMetadata {
  /** Original message ID */
  messageId: string;

  /** Original sender's user ID */
  senderId: string;

  /** Original sender's display name */
  senderName?: string;

  /** Original message type */
  kind: MessageKind;

  /** Truncated text snippet (first 100 chars) */
  textSnippet?: string;

  /** Attachment preview for media messages */
  attachmentPreview?: {
    kind: AttachmentKind;
    thumbUrl?: string;
  };
}

/**
 * Mention span in text for highlighting
 */
export interface MentionSpan {
  /** Mentioned user's ID */
  uid: string;

  /** Start index in text string */
  start: number;

  /** End index in text string (exclusive) */
  end: number;
}

/**
 * V2 Attachment
 *
 * Supports images, videos, audio (voice messages), and files.
 */
export interface AttachmentV2 {
  /** Unique attachment ID within message */
  id: string;

  /** Attachment type */
  kind: AttachmentKind;

  /** MIME type (e.g., "image/jpeg", "video/mp4") */
  mime: string;

  /** Public download URL */
  url: string;

  /** Storage path for deletion */
  path: string;

  /** File size in bytes */
  sizeBytes: number;

  /** Image/video width in pixels */
  width?: number;

  /** Image/video height in pixels */
  height?: number;

  /** Audio/video duration in milliseconds */
  durationMs?: number;

  /** Thumbnail URL for videos/large images */
  thumbUrl?: string;

  /** Thumbnail storage path */
  thumbPath?: string;

  /** User-provided caption */
  caption?: string;

  /** View-once flag (auto-delete after viewing) */
  viewOnce?: boolean;

  /** Auto-delete timestamp for view-once */
  expiresAt?: number;
}

/**
 * Link preview data (Open Graph)
 */
export interface LinkPreviewV2 {
  /** Original URL from message */
  url: string;

  /** Canonical URL if different */
  canonicalUrl?: string;

  /** Page title */
  title?: string;

  /** Page description */
  description?: string;

  /** Site name (e.g., "YouTube") */
  siteName?: string;

  /** Preview image URL */
  imageUrl?: string;

  /** Cached image storage path */
  imagePath?: string;

  /** When preview was fetched */
  fetchedAt: number;

  /** Cache expiration */
  expiresAt?: number;
}

// =============================================================================
// Settings V3 Types (CHAT_SETTINGS_V3)
// =============================================================================

/**
 * Tri-state for per-conversation overrides.
 * - "inherit": use global setting
 * - "on": force enabled regardless of global
 * - "off": force disabled regardless of global
 */
export type TriState = "inherit" | "on" | "off";

/**
 * DM acceptance mode (global user setting).
 * Controls who can initiate DMs with this user.
 */
export type DmAcceptance = "friends_only" | "everyone" | "requests";

/**
 * Notification preview detail level.
 */
export type NotificationPreview = "full" | "sender_only" | "generic";

/**
 * Auto-download media preference.
 */
export type AutoDownloadMedia = "never" | "wifi" | "always";

/**
 * Chat Settings V3 — global user-level settings.
 *
 * Stored at: `Users/{uid}/settings/chatSettings` (new doc) or
 * merged into `Users/{uid}/settings/inbox` (backward compat).
 *
 * When CHAT_SETTINGS_V3 flag is OFF the resolver falls back
 * to the existing InboxSettings shape.
 */
export interface ChatSettingsV3 {
  /** Who can DM this user */
  dmAcceptance: DmAcceptance;

  /** Notification preview detail */
  notificationPreview: NotificationPreview;

  /** Auto-download media preference */
  autoDownloadMedia: AutoDownloadMedia;

  /** Publish read receipts to other members */
  publishReadReceipts: boolean;

  /** Publish delivery receipts (lastDeliveredAtPublic) */
  publishDeliveryReceipts: boolean;

  /** Publish typing indicators */
  publishTyping: boolean;

  /** Publish online status to RTDB */
  publishOnlineStatus: boolean;

  /** Publish last-seen timestamp */
  publishLastSeen: boolean;
}

/**
 * Default V3 settings — matches current production behavior.
 */
export const DEFAULT_CHAT_SETTINGS_V3: ChatSettingsV3 = {
  dmAcceptance: "everyone",
  notificationPreview: "full",
  autoDownloadMedia: "wifi",
  publishReadReceipts: true,
  publishDeliveryReceipts: true,
  publishTyping: true,
  publishOnlineStatus: true,
  publishLastSeen: true,
};

/**
 * Per-conversation privacy overrides (stored in MembersPrivate).
 *
 * Each field uses TriState so "inherit" defers to the global setting.
 */
export interface PerChatPrivacyOverrides {
  readReceipts: TriState;
  deliveryReceipts: TriState;
  typingIndicators: TriState;
  notificationPreview: "inherit" | NotificationPreview;
  autoDownloadMedia: "inherit" | AutoDownloadMedia;
}

/**
 * Default per-chat overrides — everything inherits from global.
 */
export const DEFAULT_PER_CHAT_OVERRIDES: PerChatPrivacyOverrides = {
  readReceipts: "inherit",
  deliveryReceipts: "inherit",
  typingIndicators: "inherit",
  notificationPreview: "inherit",
  autoDownloadMedia: "inherit",
};

/**
 * Group-level settings (stored on Groups/{groupId}.settings).
 * Only admins/owner can modify.
 */
export interface GroupSettings {
  /** Minimum seconds between messages per member (0 = off) */
  slowModeSeconds?: number;

  /** Only admins/owner can send; members read-only */
  announcementOnly?: boolean;

  /** Allow non-admin members to send media attachments */
  allowMediaFromMembers?: boolean;

  /** Allow @all / @everyone mentions from non-admins */
  allowMentionsAll?: boolean;

  /**
   * Message retention semantics:
   * - "standard": normal history
   * - "ephemeral_client_only": no server search/pins, best-effort history
   */
  retentionMode?: "standard" | "ephemeral_client_only";
}

/**
 * Resolved (effective) settings after applying:
 *   per-chat override > global V3 setting > default fallback.
 *
 * This is what the UI and services should consume.
 */
export interface EffectiveChatSettings {
  publishReadReceipts: boolean;
  publishDeliveryReceipts: boolean;
  publishTyping: boolean;
  publishOnlineStatus: boolean;
  publishLastSeen: boolean;
  notificationPreview: NotificationPreview;
  autoDownloadMedia: AutoDownloadMedia;
}

/**
 * Default effective settings (production-compatible defaults).
 */
export const DEFAULT_EFFECTIVE_SETTINGS: EffectiveChatSettings = {
  publishReadReceipts: true,
  publishDeliveryReceipts: true,
  publishTyping: true,
  publishOnlineStatus: true,
  publishLastSeen: true,
  notificationPreview: "full",
  autoDownloadMedia: "wifi",
};

// =============================================================================
// Global Rate Limit Types (Segment 6)
// =============================================================================

/**
 * Result from a rate-limit check on the server.
 *
 * The server returns this shape when `CHAT_GLOBAL_RATE_LIMIT` is
 * enabled so the client can display a meaningful retry-after UX.
 */
export interface RateLimitInfo {
  /** Whether the action is allowed */
  allowed: boolean;

  /** Remaining budget in the current window */
  remaining: number;

  /** Window size in seconds */
  windowSeconds: number;

  /** Seconds until the current window resets (if rate-limited) */
  retryAfterSeconds?: number;
}

// =============================================================================
// Staged Attachment Types (Segment 3 — Media Pipeline)
// =============================================================================

/**
 * Attachment metadata without a download URL.
 *
 * When CHAT_STAGED_UPLOADS is enabled, the client uploads to a staging
 * path and stores only the path + metadata. The server commits the
 * staging object to the final path, and viewers mint short-lived
 * signed URLs on demand.
 */
export interface StagedAttachment {
  /** Unique attachment ID within message */
  id: string;

  /** Attachment type */
  kind: AttachmentKind;

  /** MIME type */
  mime: string;

  /**
   * Storage path (staging or final, depending on lifecycle stage).
   * - Client sets: `chat-staging/{scope}/{conversationId}/{messageId}/{id}`
   * - Server commits to: `chat-media/{scope}/{conversationId}/{messageId}/{id}`
   */
  path: string;

  /** File size in bytes */
  sizeBytes: number;

  /** Image/video width */
  width?: number;

  /** Image/video height */
  height?: number;

  /** Audio/video duration in ms */
  durationMs?: number;

  /** Thumbnail storage path (no URL) */
  thumbPath?: string;

  /** User-provided caption */
  caption?: string;

  /** View-once flag */
  viewOnce?: boolean;
}

/**
 * Result from the `mintChatMediaUrl` callable.
 */
export interface SignedMediaUrlResult {
  /** Short-lived signed URL for rendering */
  url: string;

  /** Expiry timestamp (ms since epoch) */
  expiresAt: number;
}

// =============================================================================
// Inbox Aggregation Types (Segment 4)
// =============================================================================

/**
 * Server-managed inbox entry stored at `Users/{uid}/Inbox/{threadId}`.
 *
 * threadId format:
 *   - `dm:{chatId}`   for DM conversations
 *   - `group:{groupId}` for group conversations
 *
 * This doc is written by Cloud Function triggers, not the client.
 * The client only reads.
 */
export interface InboxEntry {
  /** Thread ID (matches the document ID) */
  threadId: string;

  /** Conversation scope */
  scope: "dm" | "group";

  /** Underlying conversation document ID */
  conversationId: string;

  /** Timestamp of the last message — used for sorting */
  lastActivityAt: number;

  /** UID of the last message sender */
  lastSenderId: string;

  /** Kind of the last message */
  lastMessageKind: string;

  /**
   * Preview text of the last message.
   * Populated by Cloud Function trigger.
   * Will respect the recipient's notificationPreview setting
   * (full / sender_only / generic) and fall back to "generic" by default.
   */
  lastMessagePreview: string;

  /**
   * Number of unread messages (or a sentinel value).
   * Incremented server-side; reset to 0 when the user marks read.
   */
  unreadCount: number;

  /**
   * Alternative to counting: timestamp since which messages are unread.
   * If the user read at T, and lastActivityAt > T, conversation is unread.
   */
  unreadSince?: number;

  /** Pinned timestamp (null if not pinned) */
  pinnedAt?: number | null;

  /** Whether the user has archived this thread */
  archived: boolean;

  /** Muted until timestamp (-1 = forever, null = not muted) */
  mutedUntil?: number | null;

  /** Notification level override for this thread */
  notifyLevel: "all" | "mentions" | "none";

  // ---- Group-specific snapshot fields ----

  /** Group display name (groups only) */
  groupName?: string;

  /** Group avatar storage path (groups only) */
  avatarPath?: string;

  /** Member count snapshot (groups only) */
  memberCount?: number;

  // ---- DM-specific snapshot fields ----

  /** Other user's display name (DMs only) */
  otherUserName?: string;

  /** Other user's UID (DMs only) */
  otherUserId?: string;
}

// =============================================================================
// Message Request Types (Segment 5 — Message Requests)
// =============================================================================

/**
 * Status of a message request.
 */
export type MessageRequestStatus = "pending" | "accepted" | "declined";

/**
 * A DM message request entry, stored at
 * `Users/{recipientUid}/MessageRequests/{chatId}`.
 *
 * Created server-side when a non-friend sends the first DM and
 * the recipient's `dmAcceptance` is `"requests"` or `"friends_only"`.
 *
 * Once accepted, the Chat doc is "unlocked" — further messages flow
 * normally without gating.
 */
export interface MessageRequest {
  /** Chat document ID (same as document ID) */
  chatId: string;

  /** UID of the user who initiated the DM */
  requesterId: string;

  /** Display name snapshot of the requester (for UI) */
  requesterName: string;

  /** Avatar config snapshot (optional) */
  requesterAvatarConfig?: unknown;

  /** Current status */
  status: MessageRequestStatus;

  /** When the request was created */
  createdAt: number;

  /** When the request was resolved (accepted or declined) */
  resolvedAt?: number;

  /** Preview text of the first message */
  messagePreview: string;

  /** Kind of first message */
  messageKind: string;
}

/**
 * Response returned by the acceptMessageRequest / declineMessageRequest
 * callables.
 */
export interface MessageRequestResponse {
  success: boolean;
}

/**
 * Runtime guard for message request callable responses.
 */
export function isMessageRequestResponse(
  value: unknown,
): value is MessageRequestResponse {
  if (!value || typeof value !== "object") return false;
  return typeof (value as { success?: unknown }).success === "boolean";
}

/**
 * Decode an unknown Firestore snapshot payload into MessageRequest.
 *
 * Returns null when required fields are missing or invalid.
 */
export function decodeMessageRequest(
  value: unknown,
  fallbackChatId: string,
): MessageRequest | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const status = raw.status;
  if (status !== "pending" && status !== "accepted" && status !== "declined") {
    return null;
  }

  const createdAt = coerceTimestamp(raw.createdAt);
  if (createdAt === undefined) return null;

  const resolvedAt = coerceTimestamp(raw.resolvedAt);
  const chatId =
    typeof raw.chatId === "string" && raw.chatId.trim().length > 0
      ? raw.chatId
      : fallbackChatId;

  const requesterId =
    typeof raw.requesterId === "string" ? raw.requesterId : "";
  const requesterName =
    typeof raw.requesterName === "string" && raw.requesterName.trim().length > 0
      ? raw.requesterName
      : "Someone";

  const messagePreview =
    typeof raw.messagePreview === "string" ? raw.messagePreview : "";
  const messageKind =
    typeof raw.messageKind === "string" ? raw.messageKind : "text";

  return {
    chatId,
    requesterId,
    requesterName,
    requesterAvatarConfig: raw.requesterAvatarConfig,
    status,
    createdAt,
    resolvedAt,
    messagePreview,
    messageKind,
  };
}

function coerceTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : undefined;
  }
  return undefined;
}

// =============================================================================
// Member State Types
// =============================================================================

/**
 * Public member state (visible to other members)
 *
 * Stored at:
 * - DMs: `Chats/{chatId}/Members/{uid}`
 * - Groups: `Groups/{groupId}/Members/{uid}`
 */
export interface MemberStatePublic {
  /** User ID */
  uid: string;

  /** Role in group (not used for DMs) */
  role?: "owner" | "admin" | "member";

  /** When user joined the conversation */
  joinedAt: number;

  /**
   * Read receipt watermark (if receipts enabled)
   * Messages with serverReceivedAt <= this value are "read"
   */
  lastReadAtPublic?: number;

  /**
   * Delivery receipt watermark (Segment 2 — CHAT_DELIVERY_ACKS).
   * Messages with serverReceivedAt <= this value have been delivered
   * to the user's device. Only written if effectiveSettings.publishDeliveryReceipts
   * is true. Must increase monotonically.
   */
  lastDeliveredAtPublic?: number;

  /**
   * Typing indicator timestamp
   * If (now - typingAt) < TYPING_TIMEOUT_MS, user is typing
   */
  typingAt?: number;
}

/**
 * Private member state (owner-only access)
 *
 * Stored at:
 * - DMs: `Chats/{chatId}/MembersPrivate/{uid}`
 * - Groups: `Groups/{groupId}/MembersPrivate/{uid}`
 *
 * Only the owner ({uid}) can read/write this document.
 */
export interface MemberStatePrivate {
  /** User ID */
  uid: string;

  /** Chat is archived (hidden from main list) */
  archived?: boolean;

  /**
   * Mute until timestamp
   * - null: not muted
   * - -1: muted forever
   * - timestamp: muted until that time
   */
  mutedUntil?: number | null;

  /** Notification level for this conversation */
  notifyLevel?: "all" | "mentions" | "none";

  /** Custom notification settings */
  customNotifications?: {
    push: boolean;
    inApp: boolean;
  };

  /**
   * Send read receipts to other members
   * When false, lastReadAtPublic won't be updated
   * @default true
   */
  sendReadReceipts?: boolean;

  // =========================================================================
  // Per-Chat Privacy Overrides (Settings V3 — CHAT_SETTINGS_V3)
  // =========================================================================

  /**
   * Per-conversation privacy overrides.
   * When CHAT_SETTINGS_V3 is enabled, these tri-state fields override
   * the user's global ChatSettingsV3. "inherit" defers to global.
   */
  privacyOverrides?: PerChatPrivacyOverrides;

  /**
   * Private last-seen watermark for unread computation
   * Unlike lastReadAtPublic, this is not shared with other members
   */
  lastSeenAtPrivate: number;

  /**
   * Manual "mark as unread" timestamp
   * If set, conversation shows as unread until next view
   */
  lastMarkedUnreadAt?: number;

  /**
   * Timestamp when conversation was pinned
   * - null: not pinned
   * - timestamp: pinned at that time (used for sorting)
   */
  pinnedAt?: number | null;

  /**
   * Soft delete timestamp
   * - null: not deleted
   * - timestamp: when user "deleted" the conversation
   */
  deletedAt?: number | null;

  /**
   * Hide conversation until new message arrives
   * Used with soft delete to restore on new activity
   */
  hiddenUntilNewMessage?: boolean;

  /**
   * Show other members' custom chat styles (bubble colors, fonts).
   * When false, all incoming messages render with theme defaults.
   * @default true
   */
  showMemberChatStyles?: boolean;
}

// =============================================================================
// Error Taxonomy (Segment 8)
// =============================================================================

/**
 * Structured error codes for the chat system.
 *
 * These replace ad-hoc string matching in the outbox and provide
 * a single source of truth for error classification.
 */
export enum ChatErrorCode {
  /** Device is offline */
  NETWORK_OFFLINE = "NETWORK_OFFLINE",

  /** User lacks permission for this action */
  PERMISSION_DENIED = "PERMISSION_DENIED",

  /** Per-conversation rate limit exceeded */
  RATE_LIMIT_CONVERSATION = "RATE_LIMIT_CONVERSATION",

  /** Global per-user rate limit exceeded */
  RATE_LIMIT_GLOBAL = "RATE_LIMIT_GLOBAL",

  /** DM blocked by message request gating */
  MESSAGE_REQUEST_REQUIRED = "MESSAGE_REQUEST_REQUIRED",

  /** Staged attachment commit failed on server */
  ATTACHMENT_COMMIT_FAILED = "ATTACHMENT_COMMIT_FAILED",

  /** Signed media URL minting failed */
  SIGNED_URL_MINT_FAILED = "SIGNED_URL_MINT_FAILED",

  /** Privacy publish callable rejected the write */
  PRIVACY_PUBLISH_DISABLED = "PRIVACY_PUBLISH_DISABLED",

  /** Server returned invalid-argument */
  INVALID_ARGUMENT = "INVALID_ARGUMENT",

  /** User is not authenticated */
  UNAUTHENTICATED = "UNAUTHENTICATED",

  /** Message already exists (idempotency) */
  ALREADY_EXISTS = "ALREADY_EXISTS",

  /** Target resource not found */
  NOT_FOUND = "NOT_FOUND",

  /** Uncategorized / unexpected error */
  UNKNOWN = "UNKNOWN",
}

/**
 * Whether a ChatErrorCode is retryable.
 *
 * Non-retryable errors should NOT be retried — the condition will
 * not change without user action (e.g. unblocking, auth re-login).
 */
export const NON_RETRYABLE_CHAT_ERRORS: ReadonlySet<ChatErrorCode> = new Set([
  ChatErrorCode.PERMISSION_DENIED,
  ChatErrorCode.UNAUTHENTICATED,
  ChatErrorCode.NOT_FOUND,
  ChatErrorCode.ALREADY_EXISTS,
  ChatErrorCode.INVALID_ARGUMENT,
  ChatErrorCode.MESSAGE_REQUEST_REQUIRED,
  ChatErrorCode.PRIVACY_PUBLISH_DISABLED,
]);

/**
 * Structured chat error with trace ID.
 *
 * Wraps any raw error with classification metadata.
 */
export interface ChatError {
  /** Structured error code */
  code: ChatErrorCode;

  /** Human-readable message */
  message: string;

  /** Trace ID linking client → server logs */
  traceId: string;

  /** Whether this error should be retried */
  retryable: boolean;

  /** Seconds until next retry (from rate limiter) */
  retryAfterSeconds?: number;

  /** Original raw error (for debugging) */
  rawError?: unknown;
}

/**
 * Generate a trace ID for correlating a send operation across
 * client outbox → Cloud Function → Firestore write → logs.
 *
 * Format: `msg-{random12chars}`
 */
export function generateTraceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "msg-";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Map a raw Firebase/network error to a structured ChatError.
 *
 * @param rawError - The raw error (HttpsError, TypeError, etc.)
 * @param traceId - The trace ID for this operation
 * @returns Structured ChatError
 */
export function classifyChatError(
  rawError: unknown,
  traceId: string,
): ChatError {
  // Handle network / offline errors
  if (rawError instanceof TypeError && rawError.message?.includes("network")) {
    return {
      code: ChatErrorCode.NETWORK_OFFLINE,
      message:
        "No network connection. Message will be sent when you're back online.",
      traceId,
      retryable: true,
      rawError,
    };
  }

  // Handle Firebase HttpsError (has a `code` property)
  const errAny = rawError as Record<string, unknown>;
  const fbCode = errAny?.code as string | undefined;
  const fbMessage = (errAny?.message as string) ?? "Unknown error";

  // Map Firebase error codes to ChatErrorCode
  const codeMap: Record<string, ChatErrorCode> = {
    unauthenticated: ChatErrorCode.UNAUTHENTICATED,
    "permission-denied": ChatErrorCode.PERMISSION_DENIED,
    "invalid-argument": ChatErrorCode.INVALID_ARGUMENT,
    "not-found": ChatErrorCode.NOT_FOUND,
    "already-exists": ChatErrorCode.ALREADY_EXISTS,
    "resource-exhausted": ChatErrorCode.RATE_LIMIT_GLOBAL,
  };

  if (fbCode && codeMap[fbCode]) {
    const code = codeMap[fbCode];

    // Refine based on message content
    let refinedCode = code;
    if (
      fbCode === "resource-exhausted" &&
      fbMessage.toLowerCase().includes("conversation")
    ) {
      refinedCode = ChatErrorCode.RATE_LIMIT_CONVERSATION;
    }
    if (
      fbCode === "permission-denied" &&
      fbMessage.toLowerCase().includes("message request")
    ) {
      refinedCode = ChatErrorCode.MESSAGE_REQUEST_REQUIRED;
    }
    if (
      fbCode === "permission-denied" &&
      fbMessage.toLowerCase().includes("blocked")
    ) {
      refinedCode = ChatErrorCode.PERMISSION_DENIED;
    }

    // Extract retry-after from message if present
    let retryAfterSeconds: number | undefined;
    const retryMatch = fbMessage.match(/retry.after.*?(\d+)/i);
    if (retryMatch) {
      retryAfterSeconds = parseInt(retryMatch[1], 10);
    }

    return {
      code: refinedCode,
      message: fbMessage,
      traceId,
      retryable: !NON_RETRYABLE_CHAT_ERRORS.has(refinedCode),
      retryAfterSeconds,
      rawError,
    };
  }

  // Generic string-based fallback for old error patterns
  const msg = fbMessage.toLowerCase();
  if (msg.includes("offline") || msg.includes("network")) {
    return {
      code: ChatErrorCode.NETWORK_OFFLINE,
      message: "Network unavailable",
      traceId,
      retryable: true,
      rawError,
    };
  }

  // Unknown error — treat as retryable
  return {
    code: ChatErrorCode.UNKNOWN,
    message: fbMessage || "An unexpected error occurred",
    traceId,
    retryable: true,
    rawError,
  };
}

/**
 * Get a user-friendly message for a ChatErrorCode.
 */
export function getChatErrorUserMessage(code: ChatErrorCode): string {
  switch (code) {
    case ChatErrorCode.NETWORK_OFFLINE:
      return "You're offline. Message will send when you reconnect.";
    case ChatErrorCode.PERMISSION_DENIED:
      return "You don't have permission to send this message.";
    case ChatErrorCode.RATE_LIMIT_CONVERSATION:
      return "Slow down! You're sending messages too fast in this chat.";
    case ChatErrorCode.RATE_LIMIT_GLOBAL:
      return "Slow down! You've reached your messaging limit. Try again shortly.";
    case ChatErrorCode.MESSAGE_REQUEST_REQUIRED:
      return "This person only accepts messages from friends.";
    case ChatErrorCode.ATTACHMENT_COMMIT_FAILED:
      return "Failed to process attachment. Please try again.";
    case ChatErrorCode.SIGNED_URL_MINT_FAILED:
      return "Failed to load media. Tap to retry.";
    case ChatErrorCode.PRIVACY_PUBLISH_DISABLED:
      return "This action is disabled by your privacy settings.";
    case ChatErrorCode.INVALID_ARGUMENT:
      return "Invalid message. Please check and try again.";
    case ChatErrorCode.UNAUTHENTICATED:
      return "Session expired. Please sign in again.";
    case ChatErrorCode.ALREADY_EXISTS:
      return "Message already sent.";
    case ChatErrorCode.NOT_FOUND:
      return "Conversation not found.";
    case ChatErrorCode.UNKNOWN:
    default:
      return "Something went wrong. Please try again.";
  }
}

// =============================================================================
// Outbox Types
// =============================================================================

/** Outbox item state */
export type OutboxState = "queued" | "uploading" | "sending" | "failed";

/**
 * Outbox item for offline message queue
 *
 * Stored in AsyncStorage and processed in order.
 */
export interface OutboxItem {
  /** Client-generated message ID (will become Firestore doc ID) */
  messageId: string;

  /** Conversation scope */
  scope: "dm" | "group";

  /** Chat or Group ID */
  conversationId: string;

  /** Message type */
  kind: MessageKind;

  /** Text content */
  text?: string;

  /** Reply-to metadata */
  replyTo?: ReplyToMetadata;

  /** Mentioned user IDs */
  mentionUids?: string[];

  /** Mention spans for highlighting */
  mentionSpans?: MentionSpan[];

  /** Local attachments pending upload */
  localAttachments?: LocalAttachment[];

  /** Client timestamp when enqueued */
  createdAt: number;

  /** Number of send attempts */
  attemptCount: number;

  /** Next retry timestamp (for exponential backoff) */
  nextRetryAt: number;

  /** Current state */
  state: OutboxState;

  /** Last error message */
  lastError?: string;

  /**
   * Trace ID for correlating this send across
   * client outbox → Cloud Function → Firestore write → logs.
   * Format: msg-xxxxxxxxxxxx
   * (Segment 8)
   */
  traceId?: string;

  /**
   * Structured error code from the last failed attempt.
   * Replaces ad-hoc string matching for retry classification.
   * (Segment 8)
   */
  lastErrorCode?: ChatErrorCode;
}

/**
 * Local attachment pending upload
 */
export interface LocalAttachment {
  /** Unique ID */
  id: string;

  /** Attachment type */
  kind: AttachmentKind;

  /** Local file URI (file:// or content://) */
  uri: string;

  /** MIME type */
  mime: string;

  /** Optional caption */
  caption?: string;

  /** Duration in milliseconds (for audio/video) */
  durationMs?: number;
}

// =============================================================================
// Reaction Types
// =============================================================================

/**
 * Reaction document
 *
 * Stored at: `{Messages collection}/{messageId}/Reactions/{emoji}`
 */
export interface ReactionDoc {
  /** Emoji character */
  emoji: string;

  /** User IDs who reacted with this emoji */
  uids: string[];

  /** Last update timestamp */
  updatedAt: number;
}

// =============================================================================
// Conversation Preview Types
// =============================================================================

/**
 * Fields added to Chat/Group docs for list display
 */
export interface ConversationPreview {
  /** Timestamp of last message */
  lastMessageAt: number;

  /** ID of last message */
  lastMessageId: string;

  /** Preview text for last message */
  lastMessageText: string;

  /** Type of last message */
  lastMessageKind: MessageKind;

  /** Sender of last message */
  lastMessageSenderId: string;
}

// =============================================================================
// Inbox Types
// =============================================================================

/**
 * Unified inbox conversation item for list display
 *
 * Combines DM and Group data into a single format for the inbox screen.
 */
export interface InboxConversation {
  /** Conversation ID (Chat or Group document ID) */
  id: string;

  /** Conversation type */
  type: "dm" | "group";

  /** Display name */
  name: string;

  /** Avatar URL (DM) or null (use avatarIds for groups) */
  avatarUrl: string | null;

  /** Avatar configuration for DMs (custom avatar) */
  avatarConfig?: AvatarConfig;

  /** Profile picture URL for DMs (actual photo) */
  profilePictureUrl?: string | null;

  /** Avatar decoration ID for DMs */
  decorationId?: string | null;

  /** Avatar user IDs for group avatar generation */
  avatarIds?: string[];

  /** Other user ID (DM only) */
  otherUserId?: string;

  /** Last message preview */
  lastMessage: {
    /** Preview text */
    text: string;
    /** Sender display name (for groups) */
    senderName: string;
    /** Message timestamp */
    timestamp: number;
    /** Message type */
    type: "text" | "image" | "voice" | "attachment";
  } | null;

  /** User's private state for this conversation */
  memberState: MemberStatePrivate;

  /** Unread message count */
  unreadCount: number;

  /** Has unread @mentions (groups only) */
  hasMentions: boolean;

  /** Other user is online (DM only) */
  isOnline?: boolean;

  /** Conversation created timestamp */
  createdAt: number;

  /** Number of participants (groups only) */
  participantCount?: number;
}

/**
 * User's global inbox settings
 *
 * Stored at: `Users/{uid}/settings/inbox`
 */
export interface InboxSettings {
  /** Default notification level for new conversations */
  defaultNotifyLevel: "all" | "mentions" | "none";

  /** Send read receipts by default */
  showReadReceipts: boolean;

  /** Show typing indicators */
  showTypingIndicators: boolean;

  /** Show online status to others */
  showOnlineStatus: boolean;

  /** Show last seen timestamp to others */
  showLastSeen: boolean;

  /** Maximum number of pinned conversations (default: 5) */
  maxPinnedConversations: number;

  /** Show confirmation dialog before deleting */
  confirmBeforeDelete: boolean;

  /** Enable swipe actions on conversation items */
  swipeActionsEnabled: boolean;

  /** Recent search terms (max 10) */
  recentSearches: string[];

  // =========================================================================
  // Settings V3 extensions (CHAT_SETTINGS_V3)
  // These fields are optional for backward compatibility.
  // When present they are used by the resolver; when absent the resolver
  // uses DEFAULT_CHAT_SETTINGS_V3 values.
  // =========================================================================

  /** V3: Who can DM this user */
  dmAcceptance?: DmAcceptance;

  /** V3: Notification preview mode */
  notificationPreview?: NotificationPreview;

  /** V3: Auto-download media preference */
  autoDownloadMedia?: AutoDownloadMedia;

  /** V3: Publish delivery receipts */
  publishDeliveryReceipts?: boolean;
}

/**
 * Default inbox settings for new users
 */
export const DEFAULT_INBOX_SETTINGS: InboxSettings = {
  defaultNotifyLevel: "all",
  showReadReceipts: true,
  showTypingIndicators: true,
  showOnlineStatus: true,
  showLastSeen: true,
  maxPinnedConversations: 5,
  confirmBeforeDelete: true,
  swipeActionsEnabled: true,
  recentSearches: [],
};

// =============================================================================
// Constants
// =============================================================================

/** Edit window in milliseconds (15 minutes) */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Typing indicator timeout in milliseconds (8 seconds) */
export const TYPING_TIMEOUT_MS = 8000;

/** Typing update throttle in milliseconds (2 seconds) */
export const TYPING_THROTTLE_MS = 2000;

/** Max mentions per message */
export const MAX_MENTIONS_PER_MESSAGE = 5;

/** Max unique emoji reactions per message */
export const MAX_REACTIONS_PER_MESSAGE = 12;

/** Max attachments per message */
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

/** Max attachment size in bytes (10MB) */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Link preview cache TTL in milliseconds (24 hours) */
export const LINK_PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

/** Max message text length */
export const MAX_MESSAGE_TEXT_LENGTH = 10000;

/** Reply text snippet max length */
export const REPLY_SNIPPET_MAX_LENGTH = 100;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a message is deleted for all
 */
export function isDeletedForAll(message: MessageV2): boolean {
  return !!message.deletedForAll;
}

/**
 * Check if a message is hidden for a specific user
 */
export function isHiddenFor(message: MessageV2, uid: string): boolean {
  return message.hiddenFor?.includes(uid) ?? false;
}

/**
 * Check if a message can be edited (within edit window)
 */
export function canEdit(message: MessageV2, currentUid: string): boolean {
  if (message.senderId !== currentUid) return false;
  if (message.deletedForAll) return false;
  const age = Date.now() - message.serverReceivedAt;
  return age < EDIT_WINDOW_MS;
}

/**
 * Check if a message is from the current user
 */
export function isOwnMessage(message: MessageV2, currentUid: string): boolean {
  return message.senderId === currentUid;
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Get display text for a message (for previews/notifications)
 */
export function getMessagePreviewText(message: MessageV2): string {
  if (message.deletedForAll) {
    return "This message was deleted";
  }

  if (message.kind === "text" && message.text) {
    return message.text.length > 50
      ? message.text.substring(0, 50) + "..."
      : message.text;
  }

  if (message.kind === "media") {
    const count = message.attachments?.length || 1;
    if (count > 1) return `📷 ${count} photos`;
    const attachment = message.attachments?.[0];
    if (attachment?.kind === "video") return "📹 Video";
    return "📷 Photo";
  }

  if (message.kind === "voice") return "🎤 Voice message";
  if (message.kind === "file") return "📎 File";
  if (message.kind === "system") return message.text || "System message";

  return message.text || "";
}
