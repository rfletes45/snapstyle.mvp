import type { MessageV2, OutboxItem } from "@/types/messaging";
import { mergeMessageCollections } from "@/services/chat/normalizeMessage";

/**
 * Create an optimistic MessageV2 from an outbox item.
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
    serverReceivedAt: outboxItem.createdAt,
    replyTo: outboxItem.replyTo,
    mentionUids: outboxItem.mentionUids,
    clientId: "optimistic",
    idempotencyKey: `optimistic:${outboxItem.messageId}`,
    status: "sending",
  };
}

/**
 * Merge server messages with optimistic outbox items.
 *
 * Dedupes by message ID and keeps descending timestamp order for inverted lists.
 */
export function mergeMessagesWithOutbox(
  serverMessages: MessageV2[],
  outboxItems: OutboxItem[],
  currentUid: string,
  currentUserName?: string,
): MessageV2[] {
  const serverIds = new Set(serverMessages.map((m) => m.id));

  const pendingOptimistic = outboxItems
    .filter((item) => !serverIds.has(item.messageId))
    .map((item) => {
      const msg = createOptimisticMessage(item, currentUid, currentUserName);
      msg.status = item.state === "failed" ? "failed" : "sending";
      return msg;
    });

  return mergeMessageCollections(serverMessages, pendingOptimistic);
}
