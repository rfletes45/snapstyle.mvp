import {
  createUnifiedMessagesSubscriptionManager,
  mergePaginatedOlderMessages,
  mergeRealtimeSnapshotMessages,
  runIfMounted,
} from "../../src/services/chat/unifiedMessagesLifecycle";
import type { MessageV2 } from "../../src/types/messaging";

function buildMessage(
  id: string,
  serverReceivedAt: number,
  overrides: Partial<MessageV2> = {},
): MessageV2 {
  return {
    id,
    scope: "dm",
    conversationId: "chat-1",
    senderId: "user-b",
    kind: "text",
    text: id,
    createdAt: serverReceivedAt,
    serverReceivedAt,
    clientId: "client-a",
    idempotencyKey: `client-a:${id}`,
    ...overrides,
  };
}

describe("Unified chat lifecycle integration", () => {
  it("re-subscribes on route change and cleans up previous listener", () => {
    const unsubA = jest.fn();
    const unsubB = jest.fn();
    const subscribeFn = jest
      .fn()
      .mockReturnValueOnce(unsubA)
      .mockReturnValueOnce(unsubB);
    const resetCursorFn = jest.fn();

    const manager = createUnifiedMessagesSubscriptionManager(
      subscribeFn as any,
      resetCursorFn as any,
    );

    manager.replace({
      scope: "dm",
      conversationId: "chat-1",
      initialLimit: 50,
      currentUid: "user-a",
      debug: false,
      onMessages: jest.fn(),
      onPaginationState: jest.fn(),
      onError: jest.fn(),
    });

    manager.replace({
      scope: "dm",
      conversationId: "chat-2",
      initialLimit: 50,
      currentUid: "user-a",
      debug: false,
      onMessages: jest.fn(),
      onPaginationState: jest.fn(),
      onError: jest.fn(),
    });

    expect(subscribeFn).toHaveBeenCalledTimes(2);
    expect(resetCursorFn).toHaveBeenNthCalledWith(1, "dm", "chat-1");
    expect(resetCursorFn).toHaveBeenNthCalledWith(2, "dm", "chat-2");
    expect(unsubA).toHaveBeenCalledTimes(1);
    expect(unsubB).toHaveBeenCalledTimes(0);
    expect(manager.getActiveKey()).toBe("dm:chat-2");

    manager.cleanup();
    expect(unsubB).toHaveBeenCalledTimes(1);
    expect(manager.getActiveKey()).toBeNull();
  });

  it("avoids state updates when unmounted", () => {
    const mountedRef = { current: true };
    const setState = jest.fn();

    expect(
      runIfMounted(mountedRef, () => {
        setState("ran");
      }),
    ).toBe(true);
    expect(setState).toHaveBeenCalledTimes(1);

    mountedRef.current = false;
    expect(
      runIfMounted(mountedRef, () => {
        setState("should-not-run");
      }),
    ).toBe(false);
    expect(setState).toHaveBeenCalledTimes(1);
  });

  it("dedupes realtime + pagination overlap without duplicate messages", () => {
    const initial = [buildMessage("m3", 3000), buildMessage("m2", 2000)];
    const realtimeSnapshot = [buildMessage("m4", 4000), buildMessage("m3", 3000)];
    const paginatedOlder = [buildMessage("m2", 2000), buildMessage("m1", 1000)];

    const mergedRealtime = mergeRealtimeSnapshotMessages(initial, realtimeSnapshot);
    const mergedAll = mergePaginatedOlderMessages(mergedRealtime, paginatedOlder);

    expect(mergedAll.map((m) => m.id)).toEqual(["m4", "m3", "m2", "m1"]);
    expect(new Set(mergedAll.map((m) => m.id)).size).toBe(4);
  });

  it("keeps modified snapshots by preferring newer timestamp", () => {
    const existing = [buildMessage("m1", 2000, { text: "old" })];
    const modified = [buildMessage("m1", 3500, { text: "new" })];

    const merged = mergeRealtimeSnapshotMessages(existing, modified);
    expect(merged).toHaveLength(1);
    expect(merged[0].text).toBe("new");
    expect(merged[0].serverReceivedAt).toBe(3500);
  });
});
