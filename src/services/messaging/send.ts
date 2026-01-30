/**
 * Unified Message Send Service
 *
 * Provides a unified API for sending messages across both
 * DM and Group conversations. Uses the V2 system with outbox
 * support for offline resilience.
 *
 * Features:
 * - Outbox-based sending (offline support)
 * - Automatic retry on failure
 * - Optimistic UI support
 * - Idempotent sends via Cloud Function
 *
 * @module services/messaging/send
 *
 * @example
 * ```typescript
 * import { sendMessage, retryMessage } from "@/services/messaging";
 *
 * // Send a text message to a group
 * const { outboxItem, sendPromise } = await sendMessage({
 *   scope: "group",
 *   conversationId: groupId,
 *   kind: "text",
 *   text: "Hello everyone!",
 * });
 *
 * // Use outboxItem for optimistic UI
 * setMessages(prev => [...prev, optimisticMessage]);
 *
 * // Handle result
 * const result = await sendPromise;
 * if (!result.success) {
 *   console.error("Send failed:", result.error);
 * }
 *
 * // Retry a failed message
 * const success = await retryMessage(messageId);
 * ```
 */

import {
  AttachmentV2,
  LocalAttachment,
  MessageKind,
  OutboxItem,
  ReplyToMetadata,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { DEBUG_UNIFIED_MESSAGING } from "../../../constants/featureFlags";

// Import existing send functions
import {
  processPendingMessages as processPendingMessagesV2,
  retryFailedMessage as retryFailedMessageV2,
  sendMessageWithOutbox as sendMessageWithOutboxV2,
} from "../chatV2";

// Import outbox functions
import {
  generateMessageId,
  getClientId,
  getFailedItems,
  getOutboxForConversation,
  getPendingItems,
} from "../outbox";

const log = createLogger("messaging:send");

// =============================================================================
// Types
// =============================================================================

/**
 * Scope determines the conversation type
 */
export type ConversationScope = "dm" | "group";

/**
 * Parameters for sending a message
 */
export interface SendMessageParams {
  /**
   * Conversation scope ("dm" or "group")
   */
  scope: ConversationScope;

  /**
   * Chat ID (for DM) or Group ID (for group)
   */
  conversationId: string;

  /**
   * Message type (text, image, voice, etc.)
   */
  kind: MessageKind;

  /**
   * Message text content
   */
  text?: string;

  /**
   * Reply-to metadata for threaded replies
   */
  replyTo?: ReplyToMetadata;

  /**
   * User IDs mentioned in the message
   */
  mentionUids?: string[];

  /**
   * Local attachments to upload
   * Note: Attachments are uploaded during send process
   */
  localAttachments?: LocalAttachment[];
}

/**
 * Result from sending a message
 */
export interface SendMessageResult {
  /**
   * The outbox item (use for optimistic UI)
   */
  outboxItem: OutboxItem;

  /**
   * Promise that resolves when send completes
   */
  sendPromise: Promise<{ success: boolean; error?: string }>;
}

/**
 * Result from processing pending messages
 */
export interface ProcessPendingResult {
  sent: number;
  failed: number;
  pending: number;
}

// =============================================================================
// Send Functions
// =============================================================================

/**
 * Send a message with outbox support
 *
 * This is the primary way to send messages. The message is:
 * 1. Immediately persisted to the outbox
 * 2. An OutboxItem is returned for optimistic UI
 * 3. Send is attempted in the background
 * 4. Failed sends are automatically queued for retry
 *
 * @param params - Send parameters
 * @returns OutboxItem for optimistic UI and send promise
 *
 * @example
 * ```typescript
 * // Send a text message
 * const { outboxItem, sendPromise } = await sendMessage({
 *   scope: "group",
 *   conversationId: "group123",
 *   kind: "text",
 *   text: "Hello!",
 * });
 *
 * // Add optimistic message to UI
 * setMessages(prev => [
 *   ...prev,
 *   {
 *     id: outboxItem.messageId,
 *     text: outboxItem.text,
 *     status: "sending",
 *     createdAt: outboxItem.createdAt,
 *     senderId: currentUser.uid,
 *   },
 * ]);
 *
 * // Wait for result
 * const result = await sendPromise;
 * if (result.success) {
 *   // Message will appear from real-time subscription
 * } else {
 *   // Update UI to show failed state
 *   updateMessageStatus(outboxItem.messageId, "failed", result.error);
 * }
 * ```
 */
export async function sendMessage(
  params: SendMessageParams,
): Promise<SendMessageResult> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("sendMessage called", {
      operation: "send",
      data: {
        scope: params.scope,
        conversationId: params.conversationId,
        kind: params.kind,
        hasText: !!params.text,
        hasReplyTo: !!params.replyTo,
        mentionCount: params.mentionUids?.length ?? 0,
        attachmentCount: params.localAttachments?.length ?? 0,
      },
    });
  }

  // Delegate to existing V2 send function
  return sendMessageWithOutboxV2({
    conversationId: params.conversationId,
    scope: params.scope,
    kind: params.kind,
    text: params.text,
    replyTo: params.replyTo,
    mentionUids: params.mentionUids,
  });
}

/**
 * Retry sending a failed message
 *
 * Use this to retry a message that previously failed to send.
 *
 * @param messageId - The message ID to retry
 * @returns true if sent successfully, false otherwise
 *
 * @example
 * ```typescript
 * // Retry a failed message
 * const success = await retryMessage("msg_abc123");
 *
 * if (success) {
 *   // Update UI to show sent status
 * } else {
 *   // Still failed, maybe show error to user
 * }
 * ```
 */
export async function retryMessage(messageId: string): Promise<boolean> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("retryMessage called", {
      operation: "retry",
      data: { messageId: messageId.substring(0, 8) + "..." },
    });
  }

  return retryFailedMessageV2(messageId);
}

/**
 * Process all pending/failed messages in outbox
 *
 * Call this:
 * - On app startup
 * - When network connectivity is restored
 * - Periodically in background
 *
 * @returns Statistics about processed messages
 *
 * @example
 * ```typescript
 * // Process pending messages on app start
 * const { sent, failed, skipped } = await processPendingMessages();
 * console.log(`Processed: ${sent} sent, ${failed} failed, ${skipped} skipped`);
 * ```
 */
export async function processPendingMessages(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  if (DEBUG_UNIFIED_MESSAGING) {
    log.debug("processPendingMessages called", {
      operation: "processAll",
    });
  }

  return processPendingMessagesV2();
}

// =============================================================================
// Outbox Query Functions
// =============================================================================

/**
 * Get pending messages for a specific conversation
 *
 * Useful for showing optimistic UI for messages still being sent.
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @returns Array of outbox items for this conversation
 */
export async function getPendingForConversation(
  scope: ConversationScope,
  conversationId: string,
): Promise<OutboxItem[]> {
  return getOutboxForConversation(conversationId);
}

/**
 * Get all pending messages (across all conversations)
 *
 * @returns Array of pending outbox items
 */
export async function getPendingMessages(): Promise<OutboxItem[]> {
  return getPendingItems();
}

/**
 * Get all failed messages (across all conversations)
 *
 * @returns Array of failed outbox items
 */
export async function getFailedMessages(): Promise<OutboxItem[]> {
  return getFailedItems();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a new message ID
 *
 * Use this if you need to create a message ID before calling sendMessage.
 * This is rarely needed as sendMessage generates IDs automatically.
 *
 * @returns New unique message ID
 */
export { generateMessageId };

/**
 * Get the client ID for this device
 *
 * The client ID is used for idempotency in message sending.
 *
 * @returns Client ID string
 */
export { getClientId };

// =============================================================================
// Re-export types
// =============================================================================

export type {
  AttachmentV2,
  LocalAttachment,
  MessageKind,
  OutboxItem,
  ReplyToMetadata,
};
