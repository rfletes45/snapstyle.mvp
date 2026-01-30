/**
 * SwipeableMessage Component (H6)
 *
 * Wraps a DM message bubble to enable swipe-to-reply gesture.
 * Delegates to SwipeableMessageWrapper for gesture handling.
 *
 * @module components/chat/SwipeableMessage
 */

import { MessageV2, ReplyToMetadata } from "@/types/messaging";
import React from "react";
import { SwipeableMessageWrapper } from "./SwipeableMessageWrapper";

// =============================================================================
// Types
// =============================================================================

interface SwipeableMessageProps {
  /** The message being wrapped */
  message: MessageV2;
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
 * Convert MessageV2 to ReplyToMetadata
 * Adapter function for the generic SwipeableMessageWrapper
 */
function dmMessageToReply(message: MessageV2): ReplyToMetadata {
  // Truncate text to first 100 characters
  const textSnippet = message.text
    ? message.text.length > 100
      ? message.text.substring(0, 100) + "..."
      : message.text
    : undefined;

  return {
    messageId: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    kind: message.kind,
    textSnippet,
    attachmentPreview:
      message.attachments && message.attachments.length > 0
        ? {
            kind: message.attachments[0].kind,
            thumbUrl:
              message.attachments[0].thumbUrl || message.attachments[0].url,
          }
        : undefined,
  };
}

// =============================================================================
// Component
// =============================================================================

export function SwipeableMessage({
  message,
  onReply,
  enabled = true,
  currentUid: _currentUid, // Preserved for backward compatibility
  children,
}: SwipeableMessageProps) {
  return (
    <SwipeableMessageWrapper
      message={message}
      toReplyMetadata={dmMessageToReply}
      onReply={onReply}
      enabled={enabled}
    >
      {children}
    </SwipeableMessageWrapper>
  );
}

export default SwipeableMessage;
