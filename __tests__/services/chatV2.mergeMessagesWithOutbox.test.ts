import { mergeMessagesWithOutbox } from "../../src/services/messaging/messageMerge";
import type { MessageV2, OutboxItem } from "../../src/types/messaging";

function makeOutboxItem(
  overrides: Partial<OutboxItem> = {},
): OutboxItem {
  return {
    messageId: "outbox-1",
    scope: "dm",
    conversationId: "chat-1",
    kind: "text",
    text: "pending",
    createdAt: 1_000,
    attemptCount: 0,
    nextRetryAt: 1_000,
    state: "queued",
    ...overrides,
  };
}

function makeServerMessage(
  overrides: Partial<MessageV2> = {},
): MessageV2 {
  return {
    id: "server-1",
    scope: "dm",
    conversationId: "chat-1",
    senderId: "user-b",
    kind: "text",
    text: "hello",
    createdAt: 1_000,
    serverReceivedAt: 1_000,
    clientId: "client-a",
    idempotencyKey: "client-a:server-1",
    ...overrides,
  };
}

describe("mergeMessagesWithOutbox", () => {
  it("deduplicates optimistic item when server message with same id exists", () => {
    const serverMessages: MessageV2[] = [
      makeServerMessage({ id: "msg-1", serverReceivedAt: 5_000 }),
    ];
    const outboxItems: OutboxItem[] = [
      makeOutboxItem({ messageId: "msg-1", createdAt: 4_000 }),
    ];

    const merged = mergeMessagesWithOutbox(
      serverMessages,
      outboxItems,
      "user-a",
      "User A",
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("msg-1");
    expect(merged[0].status).toBeUndefined();
  });

  it("maps pending and failed outbox states to optimistic message status", () => {
    const serverMessages: MessageV2[] = [];
    const outboxItems: OutboxItem[] = [
      makeOutboxItem({
        messageId: "queued-1",
        state: "sending",
        createdAt: 3_000,
      }),
      makeOutboxItem({
        messageId: "failed-1",
        state: "failed",
        lastError: "network",
        createdAt: 2_000,
      }),
    ];

    const merged = mergeMessagesWithOutbox(
      serverMessages,
      outboxItems,
      "user-a",
      "User A",
    );

    const queued = merged.find((m) => m.id === "queued-1");
    const failed = merged.find((m) => m.id === "failed-1");

    expect(queued?.status).toBe("sending");
    expect(failed?.status).toBe("failed");
    expect(failed?.errorMessage).toBe("network");
    expect(queued?.isLocal).toBe(true);
  });

  it("keeps combined output ordered newest-first", () => {
    const serverMessages: MessageV2[] = [
      makeServerMessage({ id: "server-old", serverReceivedAt: 2_000 }),
      makeServerMessage({ id: "server-new", serverReceivedAt: 8_000 }),
    ];
    const outboxItems: OutboxItem[] = [
      makeOutboxItem({
        messageId: "optimistic-mid",
        state: "queued",
        createdAt: 5_000,
      }),
    ];

    const merged = mergeMessagesWithOutbox(
      serverMessages,
      outboxItems,
      "user-a",
      "User A",
    );

    expect(merged.map((m) => m.id)).toEqual([
      "server-new",
      "optimistic-mid",
      "server-old",
    ]);
  });
});
