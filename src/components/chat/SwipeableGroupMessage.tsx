/**
 * SwipeableGroupMessage Component
 *
 * Wraps a group chat message bubble to enable swipe-to-reply gesture.
 * Delegates to SwipeableMessageWrapper for gesture handling.
 *
 * @module components/chat/SwipeableGroupMessage
 */

import { ReplyToMetadata } from "@/types/messaging";
import { GroupMessage } from "@/types/models";
import React from "react";
import { SwipeableMessageWrapper } from "./SwipeableMessageWrapper";

// Re-export for backwards compatibility
export type GroupReplyToMetadata = ReplyToMetadata;

// =============================================================================
// Types
// =============================================================================

interface SwipeableGroupMessageProps {
  /** The group message being wrapped */
  message: GroupMessage;
  /** Called when swipe threshold is reached */
  onReply: (replyTo: ReplyToMetadata) => void;
  /** Whether swipe is enabled (disabled for system messages, etc.) */
  enabled?: boolean;
  /** Current user ID (to determine if replying to own message) */
  currentUid?: string;
  /** Children to render (the message bubble) */
  children: React.ReactNode;
}

// =============================================================================
// Adapter Functions
// =============================================================================

/**
 * Convert GroupMessage to ReplyToMetadata
 * Adapter function for the generic SwipeableMessageWrapper
 */
function groupMessageToReply(message: GroupMessage): ReplyToMetadata {
  // Truncate text to first 100 characters
  const textSnippet =
    message.type === "text" && message.content
      ? message.content.length > 100
        ? message.content.substring(0, 100) + "..."
        : message.content
      : undefined;

  // Map GroupMessage type to MessageKind
  // MessageKind = "text" | "media" | "voice" | "file" | "system"
  const kindMap: Record<string, ReplyToMetadata["kind"]> = {
    text: "text",
    image: "media", // GroupMessage "image" maps to MessageKind "media"
    voice: "voice",
    system: "system",
    scorecard: "text", // Treat scorecard as text for reply purposes
  };
  const kind = kindMap[message.type] || "text";

  // Determine attachment preview if applicable
  // AttachmentKind = "image" | "video" | "audio" | "file"
  let attachmentPreview: ReplyToMetadata["attachmentPreview"] | undefined;
  if (message.type === "image") {
    attachmentPreview = {
      kind: "image", // AttachmentKind uses "image"
      thumbUrl: message.content, // Image URL is in content
    };
  } else if (message.type === "voice") {
    attachmentPreview = {
      kind: "audio", // AttachmentKind uses "audio" not "voice"
      thumbUrl: undefined,
    };
  }

  return {
    messageId: message.id,
    senderId: message.sender,
    senderName: message.senderDisplayName,
    kind,
    textSnippet,
    attachmentPreview,
  };
}

// =============================================================================
// Component
// =============================================================================

export function SwipeableGroupMessage({
  message,
  onReply,
  enabled = true,
  currentUid: _currentUid, // Preserved for backward compatibility
  children,
}: SwipeableGroupMessageProps) {
  return (
    <SwipeableMessageWrapper
      message={message}
      toReplyMetadata={groupMessageToReply}
      onReply={onReply}
      enabled={enabled}
    >
      {children}
    </SwipeableMessageWrapper>
  );
}

export default SwipeableGroupMessage;
