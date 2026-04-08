import { mergeMessagesWithOutbox } from "../../src/services/messaging/messageMerge";
import type { MessageV2, OutboxItem } from "../../src/types/messaging";

function makeOutboxItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
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

function makeServerMessage(overrides: Partial<MessageV2> = {}): MessageV2 {
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
    expect(failed).not.toHaveProperty("errorMessage");
  });

  it("keeps combined output ordered newest-first", () => {
    const serverMessages: MessageV2[] = [
      makeServerMessage({
        id: "server-old",
        createdAt: 2_000,
        serverReceivedAt: 2_100,
      }),
      makeServerMessage({
        id: "server-new",
        createdAt: 8_000,
        serverReceivedAt: 8_100,
      }),
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

  it("handles pagination overlap without duplicate messages", () => {
    const pageOne: MessageV2[] = [
      makeServerMessage({ id: "m3", serverReceivedAt: 3000 }),
      makeServerMessage({ id: "m2", serverReceivedAt: 2000 }),
    ];
    const pageTwoWithOverlap: MessageV2[] = [
      makeServerMessage({ id: "m2", serverReceivedAt: 2000 }),
      makeServerMessage({ id: "m1", serverReceivedAt: 1000 }),
    ];

    const merged = mergeMessagesWithOutbox(
      [...pageOne, ...pageTwoWithOverlap],
      [],
      "user-a",
      "User A",
    );

    expect(merged.map((m) => m.id)).toEqual(["m3", "m2", "m1"]);
  });

  it("prefers newer modified snapshot over older version with same id", () => {
    const olderSnapshot: MessageV2 = makeServerMessage({
      id: "msg-1",
      text: "old text",
      serverReceivedAt: 5000,
    });
    const modifiedSnapshot: MessageV2 = makeServerMessage({
      id: "msg-1",
      text: "new text",
      serverReceivedAt: 7000,
    });

    const merged = mergeMessagesWithOutbox(
      [olderSnapshot, modifiedSnapshot],
      [],
      "user-a",
      "User A",
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("new text");
    expect(merged[0].serverReceivedAt).toBe(7000);
  });

  it("reconciles optimistic outbox with server ack by id", () => {
    const outboxItems: OutboxItem[] = [
      makeOutboxItem({
        messageId: "ack-msg",
        state: "sending",
        createdAt: 4_000,
      }),
    ];
    const serverMessages: MessageV2[] = [
      makeServerMessage({
        id: "ack-msg",
        text: "acked",
        serverReceivedAt: 4_500,
      }),
    ];

    const merged = mergeMessagesWithOutbox(
      serverMessages,
      outboxItems,
      "user-a",
      "User A",
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("ack-msg");
    expect(merged[0].status).toBeUndefined();
    expect(merged[0].text).toBe("acked");
  });
});
