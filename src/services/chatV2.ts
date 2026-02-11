/**
 * Chat V2 Client Service
 *
 * Client-side service for sending messages using the V2 system:
 * - Calls sendMessageV2 Cloud Function for idempotent sends
 * - Integrates with outbox for offline support
 * - Provides optimistic UI helpers
 *
 * @module services/chatV2
 *
 * @deprecated This module is being consolidated into `@/services/messaging`.
 * For new code, import from `@/services/messaging` instead:
 *
 * ```typescript
 * // OLD (deprecated):
 * import { sendMessageWithOutbox, retryFailedMessage } from "@/services/chatV2";
 *
 * // NEW (recommended):
 * import { sendMessage, retryMessage } from "@/services/messaging";
 * ```
 *
 * Migration notes:
 * - `sendMessageWithOutbox` → `sendMessage`
 * - `retryFailedMessage` → `retryMessage`
 * - `processPendingMessages` → `processPendingMessages` (same name)
 * - `getPendingMessages` → `getPendingMessages` (same name)
 * - `getFailedMessages` → `getFailedMessages` (same name)
 *
 * The unified module provides the same functionality with a cleaner API
 * that works consistently for both DM and Group conversations.
 */

import {
  AttachmentV2,
  MessageKind,
  MessageV2,
  OutboxItem,
  ReplyToMetadata,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAppInstance } from "./firebase";
import {
  enqueueMessage,
  getClientId,
  getOutboxForConversation,
  processOutbox,
  removeFromOutbox,
  retryItem,
  updateOutboxItem,
} from "./outbox";

const log = createLogger("chatV2");

// =============================================================================
// Types
// =============================================================================

/** Parameters for sendMessageV2 Cloud Function */
interface SendMessageV2Params {
  conversationId: string;
  scope: "dm" | "group";
  kind: MessageKind;
  text?: string;
  replyTo?: ReplyToMetadata;
  mentionUids?: string[];
  attachments?: AttachmentV2[];
  clientId: string;
  messageId: string;
  createdAt?: number;
}

/** Response from sendMessageV2 Cloud Function */
interface SendMessageV2Response {
  success: boolean;
  message: MessageV2;
  isExisting: boolean;
}

/** Result from sending with outbox */
interface SendWithOutboxResult {
  /** The outbox item (use for optimistic UI) */
  outboxItem: OutboxItem;
  /** Promise that resolves when send completes */
  sendPromise: Promise<{ success: boolean; error?: string }>;
}

// =============================================================================
// Cloud Function Calls
// =============================================================================

let functionsInstance: ReturnType<typeof getFunctions> | null = null;

/**
 * Get Firebase Functions instance
 */
function getFunctionsInstance() {
  if (!functionsInstance) {
    const app = getAppInstance();
    functionsInstance = getFunctions(app);
  }
  return functionsInstance;
}

/**
 * Call the sendMessageV2 Cloud Function directly
 *
 * Use this for immediate sends without outbox integration.
 * Prefer sendMessageWithOutbox() for better offline support.
 *
 * @param params - Message parameters
 * @returns Server response
 */
export async function sendMessageV2(
  params: SendMessageV2Params,
): Promise<SendMessageV2Response> {
  const functions = getFunctionsInstance();
  const callable = httpsCallable<SendMessageV2Params, SendMessageV2Response>(
    functions,
    "sendMessageV2",
  );

  log.debug("Calling sendMessageV2", {
    data: {
      messageId: params.messageId.substring(0, 8) + "...",
      scope: params.scope,
      kind: params.kind,
    },
  });

  try {
    const result = await callable(params);

    log.info("sendMessageV2 response", {
      data: {
        success: result.data.success,
        isExisting: result.data.isExisting,
        messageId: result.data.message.id.substring(0, 8) + "...",
      },
    });

    return result.data;
  } catch (error) {
    log.error("sendMessageV2 failed", {
      data: {
        messageId: params.messageId.substring(0, 8) + "...",
        error,
      },
    });
    throw error;
  }
}

// =============================================================================
// Outbox Integration
// =============================================================================

/**
 * Send a message using the outbox system
 *
 * This is the recommended way to send messages:
 * 1. Immediately enqueues to outbox (persisted)
 * 2. Returns outbox item for optimistic UI
 * 3. Attempts send in background
 * 4. Handles retry on failure
 *
 * @deprecated Use `sendMessage` from `@/services/messaging` instead.
 * This function will be removed in a future version.
 *
 * @param params - Message parameters
 * @returns Outbox item and send promise
 *
 * @example
 * ```typescript
 * const { outboxItem, sendPromise } = await sendMessageWithOutbox({
 *   conversationId: chatId,
 *   scope: "dm",
 *   kind: "text",
 *   text: "Hello!",
 * });
 *
 * // Add optimistic message to UI
 * setMessages(prev => [...prev, {
 *   id: outboxItem.messageId,
 *   text: outboxItem.text,
 *   status: "sending",
 *   // ...
 * }]);
 *
 * // Handle result
 * const result = await sendPromise;
 * if (!result.success) {
 *   // Update UI to show failed state
 * }
 * ```
 */
export async function sendMessageWithOutbox(params: {
  conversationId: string;
  scope: "dm" | "group";
  kind: MessageKind;
  text?: string;
  replyTo?: ReplyToMetadata;
  mentionUids?: string[];
}): Promise<SendWithOutboxResult> {
  // 1. Enqueue to outbox first (ensures persistence)
  const outboxItem = await enqueueMessage({
    scope: params.scope,
    conversationId: params.conversationId,
    kind: params.kind,
    text: params.text,
    replyTo: params.replyTo,
    mentionUids: params.mentionUids,
  });

  log.info("Message enqueued", {
    data: {
      messageId: outboxItem.messageId.substring(0, 8) + "...",
    },
  });

  // 2. Get client ID for idempotency
  const clientId = await getClientId();

  // 3. Create send promise (runs in background)
  const sendPromise = (async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      // Mark as sending
      await updateOutboxItem(outboxItem.messageId, { state: "sending" });

      // Call Cloud Function
      const result = await sendMessageV2({
        conversationId: params.conversationId,
        scope: params.scope,
        kind: params.kind,
        text: params.text,
        replyTo: params.replyTo,
        mentionUids: params.mentionUids,
        attachments: [],
        clientId,
        messageId: outboxItem.messageId,
        createdAt: outboxItem.createdAt,
      });

      if (result.success) {
        // Remove from outbox on success
        await removeFromOutbox(outboxItem.messageId);
        log.info("Message sent successfully", {
          data: {
            messageId: outboxItem.messageId.substring(0, 8) + "...",
            isExisting: result.isExisting,
          },
        });
        return { success: true };
      } else {
        throw new Error("Server returned success: false");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error("Message send failed", {
        data: {
          messageId: outboxItem.messageId.substring(0, 8) + "...",
          error: errorMessage,
        },
      });

      // Update outbox with failure state
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
 * Retry sending a failed message
 *
 * @deprecated Use `retryMessage` from `@/services/messaging` instead.
 *
 * @param messageId - Message ID to retry
 * @returns True if sent successfully
 */
export async function retryFailedMessage(messageId: string): Promise<boolean> {
  const clientId = await getClientId();

  return retryItem(messageId, async (item) => {
    const result = await sendMessageV2({
      conversationId: item.conversationId,
      scope: item.scope,
      kind: item.kind,
      text: item.text,
      replyTo: item.replyTo,
      mentionUids: item.mentionUids,
      attachments: [], // NOTE: Handle attachments
      clientId,
      messageId: item.messageId,
      createdAt: item.createdAt,
    });

    return result.success;
  });
}

/**
 * Process all pending messages in outbox
 *
 * Call this:
 * - On app startup
 * - When network connectivity is restored
 * - Periodically in background
 *
 * @deprecated Use `processPendingMessages` from `@/services/messaging` instead.
 *
 * @returns Send statistics
 */
export async function processPendingMessages(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  const clientId = await getClientId();

  return processOutbox(async (item) => {
    const result = await sendMessageV2({
      conversationId: item.conversationId,
      scope: item.scope,
      kind: item.kind,
      text: item.text,
      replyTo: item.replyTo,
      mentionUids: item.mentionUids,
      attachments: [], // NOTE: Handle attachments
      clientId,
      messageId: item.messageId,
      createdAt: item.createdAt,
    });

    return result.success;
  });
}

// =============================================================================
// Optimistic UI Helpers
// =============================================================================

/**
 * Create an optimistic MessageV2 from an outbox item
 *
 * Use this to render the message in UI immediately while send is in progress.
 *
 * @param outboxItem - Outbox item
 * @param senderId - Current user's ID
 * @param senderName - Current user's display name
 * @returns Optimistic MessageV2
 */
function createOptimisticMessage(
  outboxItem: OutboxItem,
  senderId: string,
  senderName?: string,
): MessageV2 {
  return {
    id: outboxItem.messageId,
    scope: outboxItem.scope,
    conversationId: outboxItem.conversationId,
    senderId,
    senderName,
    kind: outboxItem.kind,
    text: outboxItem.text,
    createdAt: outboxItem.createdAt,
    serverReceivedAt: outboxItem.createdAt, // Placeholder until server confirms
    replyTo: outboxItem.replyTo,
    mentionUids: outboxItem.mentionUids,
    clientId: "optimistic",
    idempotencyKey: `optimistic:${outboxItem.messageId}`,
    // Mark as local/sending for UI
    status: "sending",
    isLocal: true,
    clientMessageId: outboxItem.messageId,
  };
}

/**
 * Merge server messages with optimistic messages
 *
 * Handles deduplication when server message arrives for an optimistic message.
 *
 * @param serverMessages - Messages from Firestore subscription
 * @param outboxItems - Current outbox items
 * @param currentUid - Current user's ID
 * @param currentUserName - Current user's display name
 * @returns Merged and deduplicated message list
 */
export function mergeMessagesWithOutbox(
  serverMessages: MessageV2[],
  outboxItems: OutboxItem[],
  currentUid: string,
  currentUserName?: string,
): MessageV2[] {
  // Create set of server message IDs for fast lookup
  const serverIds = new Set(serverMessages.map((m) => m.id));

  // Filter outbox to items NOT yet in server messages
  const pendingOptimistic = outboxItems
    .filter((item) => !serverIds.has(item.messageId))
    .map((item) => {
      const msg = createOptimisticMessage(item, currentUid, currentUserName);
      // Set status based on outbox state
      msg.status = item.state === "failed" ? "failed" : "sending";
      msg.errorMessage = item.lastError;
      return msg;
    });

  // Combine: server messages + pending optimistic
  // Sort by serverReceivedAt (or createdAt for optimistic)
  // For inverted FlatList: descending order (newest first, index 0 = newest)
  const combined = [...serverMessages, ...pendingOptimistic];

  combined.sort((a, b) => {
    const aTime = a.serverReceivedAt || a.createdAt;
    const bTime = b.serverReceivedAt || b.createdAt;
    return bTime - aTime; // descending = newest first
  });

  return combined;
}

/**
 * Get pending outbox items for a conversation
 *
 * @param conversationId - Conversation ID
 * @returns Outbox items for the conversation
 */
export async function getPendingForConversation(
  conversationId: string,
): Promise<OutboxItem[]> {
  return getOutboxForConversation(conversationId);
}
