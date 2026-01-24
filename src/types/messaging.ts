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
  | "scorecard";

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

  // =========================================================================
  // Legacy Compatibility Fields (deprecated)
  // =========================================================================

  /** @deprecated Use `text` instead */
  content?: string;

  /** @deprecated Use `kind` instead */
  type?: "text" | "image" | "scorecard";

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
// Conversion Helpers
// =============================================================================

/**
 * Convert legacy Message to MessageV2 format
 */
export function convertLegacyMessage(
  legacy: {
    id: string;
    sender: string;
    type?: string;
    content?: string;
    createdAt: number;
    read?: boolean;
    status?: string;
    mediaUrl?: string;
    clientMessageId?: string;
  },
  conversationId: string,
  scope: "dm" | "group",
): MessageV2 {
  const attachments: AttachmentV2[] = [];

  if (legacy.mediaUrl) {
    attachments.push({
      id: `${legacy.id}_0`,
      kind: "image",
      mime: "image/jpeg",
      url: legacy.mediaUrl,
      path: "",
      sizeBytes: 0,
    });
  }

  return {
    id: legacy.id,
    scope,
    conversationId,
    senderId: legacy.sender,
    kind: legacy.type === "image" ? "media" : "text",
    text: legacy.content,
    createdAt: legacy.createdAt,
    serverReceivedAt: legacy.createdAt, // Fallback for legacy
    attachments: attachments.length > 0 ? attachments : undefined,
    clientId: "legacy",
    idempotencyKey: `legacy:${legacy.clientMessageId || legacy.id}`,
    // Legacy fields for backwards compat
    content: legacy.content,
    type: legacy.type as "text" | "image" | "scorecard",
    read: legacy.read,
    status: legacy.status as any,
    clientMessageId: legacy.clientMessageId,
  };
}

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
