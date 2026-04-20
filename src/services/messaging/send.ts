/**
 * Unified Message Send Service
 *
 * Canonical client entry point for optimistic sends across DM and group
 * conversations. Native local-first screens write into SQLite before the sync
 * engine publishes to Firestore; this module remains the queue/send runtime for
 * the Firestore-backed compatibility path on web and rollback scenarios.
 *
 * Features:
 * - AsyncStorage-backed optimistic queue
 * - Automatic retry on failure
 * - Idempotent Cloud Function sends
 * - Shared API across DM and group conversations
 *
 * @module services/messaging/send
 */

import type { SenderStyle } from "@/cosmetics/types";
import { getAppInstance } from "@/services/firebase";
import { getNotificationDeviceId } from "@/services/notifications";
import {
  enqueueMessage,
  generateMessageId,
  getClientId,
  getFailedItems,
  getOutboxForConversation,
  getPendingItems,
  processOutbox,
  removeFromOutbox,
  retryItem,
  updateOutboxItem,
} from "@/services/outbox";
import {
  AttachmentV2,
  LocalAttachment,
  MentionSpan,
  MessageKind,
  MessageV2,
  OutboxItem,
  ReplyToMetadata,
} from "@/types/messaging";
import { getFunctions, httpsCallable } from "firebase/functions";

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
   * Animal theme ID (required when kind="animal")
   */
  animalId?: string;

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
   * Mention spans for highlighting
   */
  mentionSpans?: MentionSpan[];

  /**
   * Local attachments to upload.
   * The compatibility runtime does not upload these directly; native local-first
   * flows handle attachment persistence through SQLite + syncEngine instead.
   */
  localAttachments?: LocalAttachment[];

  /**
   * Sender's chat style snapshot (bubble color, font, animal theme).
   * Stamped on each message so recipients can render sender styling.
   */
  senderStyle?: SenderStyle;
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

interface SendMessageV2Params {
  conversationId: string;
  scope: ConversationScope;
  kind: MessageKind;
  text?: string;
  animalId?: string;
  replyTo?: ReplyToMetadata;
  mentionUids?: string[];
  mentionSpans?: MentionSpan[];
  attachments?: AttachmentV2[];
  clientId: string;
  messageId: string;
  createdAt?: number;
  traceId?: string;
  senderDeviceId?: string;
  senderStyle?: {
    bubbleColorId?: string | null;
    bubbleColorHex?: string | null;
    fontId?: string | null;
    fontKey?: string | null;
    animalThemeId?: string | null;
    v: 1;
  };
}

interface SendMessageV2Response {
  success: boolean;
  message: MessageV2;
  isExisting: boolean;
}

// =============================================================================
// Cloud Function Calls
// =============================================================================

let functionsInstance: ReturnType<typeof getFunctions> | null = null;

function getFunctionsInstance() {
  if (!functionsInstance) {
    functionsInstance = getFunctions(getAppInstance());
  }
  return functionsInstance;
}

/**
 * Resolve the stable per-device identifier for self-notification suppression.
 * Failures are swallowed: delivery should never block on this, and the
 * backend has a token-level fallback filter.
 */
async function safeGetSenderDeviceId(): Promise<string | undefined> {
  try {
    return await getNotificationDeviceId();
  } catch {
    return undefined;
  }
}

async function sendMessageV2(
  params: SendMessageV2Params,
): Promise<SendMessageV2Response> {
  const callable = httpsCallable<SendMessageV2Params, SendMessageV2Response>(
    getFunctionsInstance(),
    "sendMessageV2",
  );

  const result = await callable(params);
  return result.data;
}

// =============================================================================
// Send Functions
// =============================================================================

/**
 * Send a message with optimistic queue support.
 */
export async function sendMessage(
  params: SendMessageParams,
): Promise<SendMessageResult> {
  const outboxItem = await enqueueMessage({
    scope: params.scope,
    conversationId: params.conversationId,
    kind: params.kind,
    text: params.text,
    replyTo: params.replyTo,
    mentionUids: params.mentionUids,
    mentionSpans: params.mentionSpans,
  });

  const clientId = await getClientId();
  const senderDeviceId = await safeGetSenderDeviceId();

  const sendPromise = (async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      await updateOutboxItem(outboxItem.messageId, { state: "sending" });

      const result = await sendMessageV2({
        conversationId: params.conversationId,
        scope: params.scope,
        kind: params.kind,
        text: params.text,
        animalId: params.animalId,
        replyTo: params.replyTo,
        mentionUids: params.mentionUids,
        mentionSpans: params.mentionSpans,
        attachments: [],
        clientId,
        messageId: outboxItem.messageId,
        createdAt: outboxItem.createdAt,
        traceId: outboxItem.traceId,
        senderStyle: params.senderStyle,
        senderDeviceId,
      });

      if (!result.success) {
        throw new Error("Server returned success: false");
      }

      await removeFromOutbox(outboxItem.messageId);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await updateOutboxItem(outboxItem.messageId, {
        state: "failed",
        lastError: errorMessage,
        attemptCount: outboxItem.attemptCount + 1,
        nextRetryAt:
          Date.now() + Math.pow(2, outboxItem.attemptCount + 1) * 1000,
      });

      return { success: false, error: errorMessage };
    }
  })();

  return { outboxItem, sendPromise };
}

/**
 * Retry sending a failed message.
 */
export async function retryMessage(messageId: string): Promise<boolean> {
  const clientId = await getClientId();
  const senderDeviceId = await safeGetSenderDeviceId();

  return retryItem(messageId, async (item) => {
    const result = await sendMessageV2({
      conversationId: item.conversationId,
      scope: item.scope,
      kind: item.kind,
      text: item.text,
      replyTo: item.replyTo,
      mentionUids: item.mentionUids,
      mentionSpans: item.mentionSpans,
      attachments: [],
      clientId,
      messageId: item.messageId,
      createdAt: item.createdAt,
      traceId: item.traceId,
      senderDeviceId,
    });

    return result.success;
  });
}

/**
 * Process all pending/failed messages in the compatibility queue.
 */
export async function processPendingMessages(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const clientId = await getClientId();
  const senderDeviceId = await safeGetSenderDeviceId();

  return processOutbox(async (item) => {
    const result = await sendMessageV2({
      conversationId: item.conversationId,
      scope: item.scope,
      kind: item.kind,
      text: item.text,
      replyTo: item.replyTo,
      mentionUids: item.mentionUids,
      mentionSpans: item.mentionSpans,
      attachments: [],
      clientId,
      messageId: item.messageId,
      createdAt: item.createdAt,
      traceId: item.traceId,
      senderDeviceId,
    });

    return result.success;
  });
}

// =============================================================================
// Queue Query Functions
// =============================================================================

/**
 * Get pending messages for a specific conversation.
 */
export async function getPendingForConversation(
  scope: ConversationScope,
  conversationId: string,
): Promise<OutboxItem[]> {
  const pending = await getPendingItems();
  return pending.filter(
    (item) =>
      item.scope === scope && item.conversationId === conversationId,
  );
}

/**
 * Get all queued/sending/failed items for a specific conversation.
 */
export async function getQueueItemsForConversation(
  conversationId: string,
  scope?: ConversationScope,
): Promise<OutboxItem[]> {
  return getOutboxForConversation(conversationId, scope);
}

/**
 * Get all pending messages (across all conversations).
 */
export async function getPendingMessages(): Promise<OutboxItem[]> {
  return getPendingItems();
}

/**
 * Get all failed messages (across all conversations).
 */
export async function getFailedMessages(): Promise<OutboxItem[]> {
  return getFailedItems();
}

// =============================================================================
// Utility Functions
// =============================================================================

export { generateMessageId };
export { getClientId };

// =============================================================================
// Re-export types
// =============================================================================

export type {
  AttachmentV2,
  LocalAttachment,
  MentionSpan,
  MessageKind,
  OutboxItem,
  ReplyToMetadata,
};
