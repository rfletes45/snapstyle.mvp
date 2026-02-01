/**
 * Message Adapter Utilities (UNI-05 Extraction)
 *
 * Utilities to convert between message formats used in the app.
 * Extracted from ChatScreen to enable reuse across screens.
 */

import type { MessageWithProfile } from "@/components/DMMessageItem";
import type { MessageV2, ReplyToMetadata } from "@/types/messaging";

/**
 * Convert a V2 message to the MessageWithProfile format used by DM screens.
 *
 * @param msg - The MessageV2 to convert
 * @param friendUid - The friend's UID (for determining who is "other")
 * @param friendProfile - The friend's profile data (for display name)
 * @returns A MessageWithProfile object
 */
export function messageV2ToWithProfile(
  msg: MessageV2,
  friendUid: string,
  friendProfile: { displayName?: string; username?: string } | null,
): MessageWithProfile {
  // Determine message type from V2 kind
  let type: "text" | "image" | "scorecard" = "text";
  if (msg.kind === "media" || msg.kind === "voice") {
    type = "image";
  } else if (msg.text?.startsWith('{"game":')) {
    type = "scorecard";
  }

  // Map V2 status to legacy status
  let status: "sending" | "sent" | "delivered" | "failed" | undefined;
  const msgStatus = (msg as any).status;
  if (msgStatus === "pending") {
    status = "sending";
  } else if (msgStatus === "sent") {
    status = "sent";
  } else if (msgStatus === "delivered") {
    status = "delivered";
  } else if (msgStatus === "failed") {
    status = "failed";
  }

  // Convert timestamp (number) to Date
  const createdAtDate =
    typeof msg.createdAt === "number" ? new Date(msg.createdAt) : msg.createdAt;

  return {
    id: msg.id,
    sender: msg.senderId,
    content: msg.text || msg.attachments?.[0]?.url || "",
    type,
    createdAt: createdAtDate as Date,
    status,
    serverReceivedAt: msg.serverReceivedAt,
    replyTo: msg.replyTo,
  };
}

/**
 * Create a ReplyToMetadata object from a MessageWithProfile.
 *
 * @param message - The message being replied to
 * @param currentUid - The current user's UID
 * @param friendProfile - The friend's profile data
 * @returns A ReplyToMetadata object
 */
export function createReplyMetadataFromMessage(
  message: MessageWithProfile,
  currentUid: string | undefined,
  friendProfile: { displayName?: string; username?: string } | null,
): ReplyToMetadata {
  const senderName =
    message.sender === currentUid
      ? "You"
      : friendProfile?.displayName || friendProfile?.username || "User";

  return {
    messageId: message.id,
    senderId: message.sender,
    senderName,
    kind:
      message.type === "image"
        ? "media"
        : message.type === "scorecard"
          ? "text"
          : "text",
    textSnippet:
      message.type === "text"
        ? message.content.length > 100
          ? message.content.substring(0, 100) + "..."
          : message.content
        : undefined,
    attachmentPreview:
      message.type === "image"
        ? { kind: "image", thumbUrl: undefined }
        : undefined,
  };
}

/**
 * Convert a MessageWithProfile to MessageV2 format (for actions sheet).
 *
 * @param message - The MessageWithProfile to convert
 * @param chatId - The chat/conversation ID
 * @param currentUid - The current user's UID
 * @param friendProfile - The friend's profile data
 * @returns A MessageV2 object or null
 */
export function messageWithProfileToV2(
  message: MessageWithProfile | null,
  chatId: string | null,
  currentUid: string | undefined,
  friendProfile: { displayName?: string; username?: string } | null,
): MessageV2 | null {
  if (!message) return null;

  // Convert Date to timestamp (number)
  const createdAtTimestamp =
    message.createdAt instanceof Date
      ? message.createdAt.getTime()
      : typeof message.createdAt === "number"
        ? message.createdAt
        : Date.now();

  return {
    id: message.id,
    scope: "dm",
    conversationId: chatId || "",
    senderId: message.sender,
    senderName:
      message.sender === currentUid
        ? "You"
        : friendProfile?.displayName || "User",
    kind: message.type === "image" ? "media" : "text",
    text: message.type === "text" ? message.content : undefined,
    attachments:
      message.type === "image"
        ? [
            {
              id: message.id,
              kind: "image" as const,
              mime: "image/jpeg",
              url: message.content,
              path: "",
              sizeBytes: 0,
            },
          ]
        : undefined,
    createdAt: createdAtTimestamp,
    serverReceivedAt: createdAtTimestamp,
    clientId: "",
    idempotencyKey: "",
  };
}
