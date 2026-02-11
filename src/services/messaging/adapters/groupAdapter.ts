/**
 * Group Message Adapter
 *
 * Converts legacy GroupMessage format to unified MessageV2 format.
 * This allows the unified messaging system to work with existing
 * group messages stored in the old format.
 *
 * @module services/messaging/adapters/groupAdapter
 */

import {
  AttachmentKind,
  AttachmentV2,
  MessageKind,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import { GroupMessage } from "@/types/models";

// =============================================================================
// Constants
// =============================================================================

/**
 * Maps GroupMessage.type to MessageV2.kind
 *
 * GroupMessage types:
 * - "text" → "text"
 * - "image" → "media"
 * - "voice" → "voice"
 * - "scorecard" → "scorecard"
 * - "system" → "system"
 */
const KIND_MAP: Record<GroupMessage["type"], MessageKind> = {
  text: "text",
  image: "media",
  voice: "voice",
  scorecard: "scorecard",
  system: "system",
};

/**
 * Maps GroupMessage attachment types to AttachmentKind
 */
const ATTACHMENT_KIND_MAP: Record<string, AttachmentKind> = {
  image: "image",
  voice: "audio",
};

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if data is a legacy GroupMessage format
 *
 * GroupMessage has:
 * - `sender` (string) - senderId
 * - `content` (string) - message text
 * - `type` - message type
 * - `groupId` - group identifier
 *
 * MessageV2 has:
 * - `senderId` (string)
 * - `scope` ("dm" | "group")
 * - `kind` - message kind
 * - `conversationId`
 *
 * @param data - Unknown data to check
 * @returns True if data matches GroupMessage shape
 */
export function isLegacyGroupMessage(data: unknown): data is GroupMessage {
  if (!data || typeof data !== "object") {
    return false;
  }

  const msg = data as Record<string, unknown>;

  // GroupMessage has `sender` and `content` fields
  // MessageV2 has `senderId` and optionally `text`
  const hasLegacyFields =
    typeof msg.sender === "string" &&
    typeof msg.content === "string" &&
    typeof msg.groupId === "string";

  // Also check it doesn't have V2-specific fields
  const hasV2Fields =
    typeof msg.senderId === "string" &&
    (msg.scope === "dm" || msg.scope === "group");

  return hasLegacyFields && !hasV2Fields;
}

/**
 * Type guard to check if data is a MessageV2 format
 *
 * @param data - Unknown data to check
 * @returns True if data matches MessageV2 shape
 */
export function isMessageV2(data: unknown): data is MessageV2 {
  if (!data || typeof data !== "object") {
    return false;
  }

  const msg = data as Record<string, unknown>;

  return (
    typeof msg.senderId === "string" &&
    (msg.scope === "dm" || msg.scope === "group") &&
    typeof msg.conversationId === "string"
  );
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert GroupMessage.replyTo to ReplyToMetadata
 *
 * @param replyTo - Legacy reply metadata
 * @returns Unified ReplyToMetadata format
 */
function convertReplyTo(
  replyTo: NonNullable<GroupMessage["replyTo"]>,
): ReplyToMetadata {
  // Map attachment kind - GroupMessage uses "image" | "voice"
  let attachmentPreview: ReplyToMetadata["attachmentPreview"] | undefined;

  if (replyTo.attachmentKind) {
    const kind: AttachmentKind =
      replyTo.attachmentKind === "voice" ? "audio" : "image";
    attachmentPreview = { kind };
  }

  return {
    messageId: replyTo.messageId,
    senderId: replyTo.senderId,
    senderName: replyTo.senderName,
    kind: replyTo.attachmentKind === "voice" ? "voice" : "text",
    textSnippet: replyTo.textSnippet,
    attachmentPreview,
  };
}

/**
 * Convert GroupMessage image to AttachmentV2
 *
 * @param msg - GroupMessage with imagePath
 * @returns AttachmentV2 array with single image
 */
function convertImageAttachment(msg: GroupMessage): AttachmentV2[] {
  if (!msg.imagePath) {
    return [];
  }

  return [
    {
      id: `${msg.id}-img`,
      kind: "image",
      mime: "image/jpeg", // Default, actual MIME unknown from legacy
      url: msg.imagePath,
      path: msg.imagePath,
      sizeBytes: 0, // Unknown from legacy format
    },
  ];
}

/**
 * Convert GroupMessage voice metadata to AttachmentV2
 *
 * @param msg - GroupMessage with voiceMetadata
 * @returns AttachmentV2 array with single audio
 */
function convertVoiceAttachment(msg: GroupMessage): AttachmentV2[] {
  if (!msg.voiceMetadata) {
    return [];
  }

  return [
    {
      id: `${msg.id}-voice`,
      kind: "audio",
      mime: "audio/m4a", // Default audio format
      url: msg.voiceMetadata.storagePath || "",
      path: msg.voiceMetadata.storagePath || "",
      sizeBytes: msg.voiceMetadata.sizeBytes || 0,
      durationMs: msg.voiceMetadata.durationMs,
    },
  ];
}

/**
 * Convert legacy GroupMessage to unified MessageV2 format
 *
 * Handles all GroupMessage types:
 * - text: Plain text messages
 * - image: Messages with imagePath
 * - voice: Messages with voiceMetadata
 * - scorecard: Game scorecard messages
 * - system: System notifications (join/leave/etc)
 *
 * @param msg - Legacy GroupMessage to convert
 * @returns Unified MessageV2 format
 *
 * @example
 * ```typescript
 * const legacy: GroupMessage = {
 *   id: "msg1",
 *   groupId: "group1",
 *   sender: "user1",
 *   senderDisplayName: "John",
 *   type: "text",
 *   content: "Hello!",
 *   createdAt: 1706400000000,
 * };
 *
 * const v2 = fromGroupMessage(legacy);
 * // {
 * //   id: "msg1",
 * //   scope: "group",
 * //   conversationId: "group1",
 * //   senderId: "user1",
 * //   senderName: "John",
 * //   kind: "text",
 * //   text: "Hello!",
 * //   createdAt: 1706400000000,
 * //   serverReceivedAt: 1706400000000,
 * //   ...
 * // }
 * ```
 */
export function fromGroupMessage(msg: GroupMessage): MessageV2 {
  // Determine attachments based on message type
  let attachments: AttachmentV2[] = [];

  if (msg.type === "image") {
    attachments = convertImageAttachment(msg);
  } else if (msg.type === "voice") {
    attachments = convertVoiceAttachment(msg);
  }

  // Build the unified message
  const messageV2: MessageV2 = {
    // Identity
    id: msg.id,
    scope: "group",
    conversationId: msg.groupId,

    // Sender
    senderId: msg.sender,
    senderName: msg.senderDisplayName,
    // Note: senderAvatarConfig is not available in legacy format

    // Content
    kind: KIND_MAP[msg.type] || "text",
    text: msg.content,

    // Timestamps
    createdAt: msg.createdAt,
    // Legacy messages don't have serverReceivedAt, use createdAt as fallback
    serverReceivedAt: msg.createdAt,

    // Threading
    replyTo: msg.replyTo ? convertReplyTo(msg.replyTo) : undefined,

    // Deletion
    hiddenFor: msg.hiddenFor,
    deletedForAll: msg.deletedForAll,

    // Attachments
    attachments: attachments.length > 0 ? attachments : undefined,

    // Idempotency (legacy messages don't have these)
    clientId: "",
    idempotencyKey: "",

    // Status - legacy messages are already sent
    status: "sent",
  };

  // Handle scorecard-specific data
  if (msg.type === "scorecard" && msg.scorecard) {
    // Store scorecard data in text field as JSON for now
    // Components can parse this when rendering
    messageV2.text = JSON.stringify({
      type: "scorecard",
      gameId: msg.scorecard.gameId,
      score: msg.scorecard.score,
      playerName: msg.scorecard.playerName,
    });
  }

  // Handle system message metadata
  if (msg.type === "system" && msg.systemType) {
    // Store system metadata in text field as JSON
    messageV2.text = JSON.stringify({
      type: "system",
      systemType: msg.systemType,
      meta: msg.systemMeta,
      displayText: msg.content,
    });
  }

  return messageV2;
}

/**
 * Batch convert multiple GroupMessages to MessageV2
 *
 * @param messages - Array of legacy GroupMessages
 * @returns Array of unified MessageV2 format
 */
export function fromGroupMessages(messages: GroupMessage[]): MessageV2[] {
  return messages.map(fromGroupMessage);
}

/**
 * Convert MessageV2 back to GroupMessage format (for legacy code compatibility)
 *
 * Note: Some data may be lost in round-trip conversion as MessageV2 has
 * more fields than GroupMessage.
 *
 * @param msg - MessageV2 to convert
 * @returns Legacy GroupMessage format
 */
export function toGroupMessage(msg: MessageV2): GroupMessage {
  // Reverse the kind mapping
  const typeMap: Record<MessageKind, GroupMessage["type"]> = {
    text: "text",
    media: "image",
    voice: "voice",
    scorecard: "scorecard",
    system: "system",
    file: "text", // No file type in legacy format
    game_invite: "scorecard", // Game invites map to scorecard in legacy format
  };

  const groupMessage: GroupMessage = {
    id: msg.id,
    groupId: msg.conversationId,
    sender: msg.senderId,
    senderDisplayName: msg.senderName || "Unknown",
    type: typeMap[msg.kind] || "text",
    content: msg.text || "",
    createdAt: msg.createdAt,
  };

  // Handle image attachment
  if (msg.kind === "media" && msg.attachments?.[0]) {
    groupMessage.imagePath = msg.attachments[0].url;
  }

  // Handle voice attachment
  if (msg.kind === "voice" && msg.attachments?.[0]) {
    const attachment = msg.attachments[0];
    groupMessage.voiceMetadata = {
      durationMs: attachment.durationMs || 0,
      storagePath: attachment.path,
      sizeBytes: attachment.sizeBytes,
    };
  }

  // Handle replyTo
  if (msg.replyTo) {
    groupMessage.replyTo = {
      messageId: msg.replyTo.messageId,
      senderId: msg.replyTo.senderId,
      senderName: msg.replyTo.senderName || "",
      textSnippet: msg.replyTo.textSnippet,
      attachmentKind:
        msg.replyTo.attachmentPreview?.kind === "audio"
          ? "voice"
          : msg.replyTo.attachmentPreview?.kind === "image"
            ? "image"
            : undefined,
    };
  }

  // Handle deletion markers
  if (msg.hiddenFor) {
    groupMessage.hiddenFor = msg.hiddenFor;
  }

  if (msg.deletedForAll) {
    groupMessage.deletedForAll = msg.deletedForAll;
  }

  return groupMessage;
}
