import { mergeMessagesWithOutbox } from "@/services/messaging/messageMerge";
import {
  clearOutbox,
  enqueueMessage,
  getOutbox,
  getOutboxItem,
  processOutbox,
} from "@/services/outbox";
import type { MessageV2 } from "@/types/messaging";

jest.mock("firebase/functions", () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

function createServerMessage(
  id: string,
  serverReceivedAt: number,
  createdAt: number = serverReceivedAt,
): MessageV2 {
  return {
    id,
    scope: "dm",
    conversationId: "chat_123",
    senderId: "other-user",
    kind: "text",
    text: `msg-${id}`,
    createdAt,
    serverReceivedAt,
    clientId: "server",
    idempotencyKey: `server:${id}`,
    status: "sent",
  };
}

describe("Messaging invariants: idempotency, ordering, outbox transitions", () => {
  beforeEach(async () => {
    await clearOutbox();
  });

  afterEach(async () => {
    await clearOutbox();
  });

  it("prevents duplicate queued sends for identical message payload", async () => {
    const first = await enqueueMessage({
      scope: "dm",
      conversationId: "chat_123",
      kind: "text",
      text: "hello",
    });

    const second = await enqueueMessage({
      scope: "dm",
      conversationId: "chat_123",
      kind: "text",
      text: "hello",
    });

    const outbox = await getOutbox();

    expect(second.messageId).toBe(first.messageId);
    expect(outbox).toHaveLength(1);
  });

  it("keeps server-authoritative ordering and removes optimistic duplicates", () => {
    const serverMessages: MessageV2[] = [
      createServerMessage("msg-old", 1000),
      createServerMessage("msg-dup", 2000),
    ];

    const merged = mergeMessagesWithOutbox(
      serverMessages,
      [
        {
          messageId: "msg-dup",
          scope: "dm",
          conversationId: "chat_123",
          kind: "text",
          text: "duplicate optimistic",
          createdAt: 1500,
          attemptCount: 0,
          nextRetryAt: 1500,
          state: "queued",
        },
        {
          messageId: "msg-pending",
          scope: "dm",
          conversationId: "chat_123",
          kind: "text",
          text: "pending optimistic",
          createdAt: 2500,
          attemptCount: 1,
          nextRetryAt: 2500,
          state: "failed",
          lastError: "network unavailable",
        },
      ],
      "me",
      "Me",
    );

    expect(merged.map((m) => m.id)).toEqual(["msg-pending", "msg-dup", "msg-old"]);
    expect(merged.filter((m) => m.id === "msg-dup")).toHaveLength(1);

    const optimistic = merged.find((m) => m.id === "msg-pending");
    expect(optimistic?.status).toBe("failed");
  });

  it("transitions queued outbox messages to sent and removes them on success", async () => {
    const queued = await enqueueMessage({
      scope: "dm",
      conversationId: "chat_123",
      kind: "text",
      text: "send me",
    });

    const result = await processOutbox(async () => true);
    const remaining = await getOutboxItem(queued.messageId);

    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(remaining).toBeNull();
  });

  it("marks non-retryable failures as failed with long retry backoff", async () => {
    const queued = await enqueueMessage({
      scope: "dm",
      conversationId: "chat_123",
      kind: "text",
      text: "will fail",
    });

    const before = Date.now();

    const result = await processOutbox(async () => {
      const err = new Error("permission denied");
      (err as Error & { code?: string }).code = "permission-denied";
      throw err;
    });

    const failed = await getOutboxItem(queued.messageId);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(failed?.state).toBe("failed");
    expect(failed?.attemptCount).toBe(1);
    expect(failed?.lastErrorCode).toBeDefined();
    expect((failed?.nextRetryAt ?? 0) - before).toBeGreaterThan(300 * DAY_MS);
  });

  it("uses short backoff for retryable failures", async () => {
    const queued = await enqueueMessage({
      scope: "dm",
      conversationId: "chat_123",
      kind: "text",
      text: "temporary network issue",
    });

    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);
    const before = Date.now();

    const result = await processOutbox(async () => {
      throw new Error("network unavailable");
    });

    randomSpy.mockRestore();

    const failed = await getOutboxItem(queued.messageId);
    const delta = (failed?.nextRetryAt ?? 0) - before;

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(failed?.state).toBe("failed");
    expect(failed?.attemptCount).toBe(1);
    expect(delta).toBeGreaterThanOrEqual(1500);
    expect(delta).toBeLessThanOrEqual(2500);
  });
});
