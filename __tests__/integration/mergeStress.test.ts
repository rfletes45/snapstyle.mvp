/**
 * High-volume merge + lifecycle stress tests (S2 / S5 roadmap items).
 *
 * Covers:
 * - Large-scale message merge with overlapping pagination windows
 * - Modified-snapshot merges preserving identity
 * - Rapid thread route churning with no leaked listeners
 * - Post-cleanup callback suppression
 * - Subscribe/unsubscribe count parity
 */

import {
  createUnifiedMessagesSubscriptionManager,
  mergePaginatedOlderMessages,
  mergeRealtimeSnapshotMessages,
  runIfMounted,
} from "../../src/services/chat/unifiedMessagesLifecycle";
import type { MessageV2 } from "../../src/types/messaging";

// =============================================================================
// Helpers
// =============================================================================

function msg(
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
    clientId: `client-${id}`,
    idempotencyKey: `idem-${id}`,
    ...overrides,
  };
}

/** Generate N messages with descending timestamps starting from `base`. */
function generateBatch(
  prefix: string,
  count: number,
  baseTs: number,
  step = 1000,
): MessageV2[] {
  return Array.from({ length: count }, (_, i) =>
    msg(`${prefix}-${i}`, baseTs - i * step),
  );
}

// =============================================================================
// S2 — High-Volume Merge Stress Testing
// =============================================================================

describe("High-volume merge stress", () => {
  it("merges 200 realtime messages into 200 existing without duplicates", () => {
    const existing = generateBatch("e", 200, 200_000);
    const snapshot = generateBatch("s", 200, 400_000);

    const merged = mergeRealtimeSnapshotMessages(existing, snapshot);

    expect(merged).toHaveLength(400);
    const ids = merged.map((m) => m.id);
    expect(new Set(ids).size).toBe(400);
    // Verify descending order
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].serverReceivedAt).toBeGreaterThanOrEqual(
        merged[i].serverReceivedAt,
      );
    }
  });

  it("handles overlapping pagination windows with shared messages", () => {
    // Page 1: messages 50-100, Page 2: messages 30-70 (overlap 30-50)
    const page1 = generateBatch("p", 50, 100_000);
    const page2 = generateBatch("p", 40, 70_000);

    // page2 re-uses same prefix so IDs overlap from p-30 to p-49
    const merged = mergePaginatedOlderMessages(page1, page2);

    const ids = merged.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Order must be descending
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i - 1].serverReceivedAt).toBeGreaterThanOrEqual(
        merged[i].serverReceivedAt,
      );
    }
  });

  it("repeated modified-snapshot merges converge to latest version", () => {
    let state = [msg("m1", 1000, { text: "v1" })];

    // Simulate 5 rapid modified snapshots for the same message
    for (let v = 2; v <= 6; v++) {
      const snapshot = [msg("m1", 1000 + v * 100, { text: `v${v}` })];
      state = mergeRealtimeSnapshotMessages(state, snapshot);
    }

    expect(state).toHaveLength(1);
    expect(state[0].text).toBe("v6");
    expect(state[0].serverReceivedAt).toBe(1600);
  });

  it("interleaved realtime + pagination + edits maintain stable identity", () => {
    // Start with initial page
    let state = generateBatch("init", 20, 20_000);

    // Realtime adds 5 new messages at the top
    const realtime1 = generateBatch("rt", 5, 25_000);
    state = mergeRealtimeSnapshotMessages(state, realtime1);

    // Paginate backward: older messages with some overlap
    const olderPage = generateBatch("init", 10, 10_000);
    state = mergePaginatedOlderMessages(state, olderPage);

    // Edit one of the existing messages
    const edited = msg("init-5", 15_500, { text: "edited" });
    state = mergeRealtimeSnapshotMessages(state, [edited]);

    // Verify no duplicates
    const ids = state.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Verify the edit is present
    const editedMsg = state.find((m) => m.id === "init-5");
    expect(editedMsg?.text).toBe("edited");

    // Verify descending order
    for (let i = 1; i < state.length; i++) {
      expect(state[i - 1].serverReceivedAt).toBeGreaterThanOrEqual(
        state[i].serverReceivedAt,
      );
    }
  });

  it("concurrent pagination windows don't produce phantom rows", () => {
    const base = generateBatch("base", 30, 30_000);

    // Two "concurrent" pagination calls that partly overlap
    const pageA = generateBatch("base", 15, 15_000); // base-15..base-29
    const pageB = generateBatch("base", 15, 20_000); // base-10..base-24

    let state = base;
    state = mergePaginatedOlderMessages(state, pageA);
    state = mergePaginatedOlderMessages(state, pageB);

    const ids = state.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (let i = 1; i < state.length; i++) {
      expect(state[i - 1].serverReceivedAt).toBeGreaterThanOrEqual(
        state[i].serverReceivedAt,
      );
    }
  });
});

// =============================================================================
// S5 — Thread Lifecycle Route-Churn Testing
// =============================================================================

describe("Thread lifecycle route churn", () => {
  it("rapid route changes unsubscribe previous before subscribing next", () => {
    const unsubFns = Array.from({ length: 10 }, () => jest.fn());
    let callIdx = 0;
    const subscribeFn = jest.fn().mockImplementation(() => {
      return unsubFns[callIdx++];
    });
    const resetCursorFn = jest.fn();

    const manager = createUnifiedMessagesSubscriptionManager(
      subscribeFn as any,
      resetCursorFn as any,
    );

    // Rapidly switch through 10 conversations
    for (let i = 0; i < 10; i++) {
      manager.replace({
        scope: "dm",
        conversationId: `chat-${i}`,
        initialLimit: 50,
        currentUid: "user-a",
        debug: false,
        onMessages: jest.fn(),
        onPaginationState: jest.fn(),
        onError: jest.fn(),
      });
    }

    expect(subscribeFn).toHaveBeenCalledTimes(10);
    // First 9 should be unsubscribed (each replaced by the next)
    for (let i = 0; i < 9; i++) {
      expect(unsubFns[i]).toHaveBeenCalledTimes(1);
    }
    // Last one still active
    expect(unsubFns[9]).not.toHaveBeenCalled();

    // Final cleanup
    manager.cleanup();
    expect(unsubFns[9]).toHaveBeenCalledTimes(1);
    expect(manager.getActiveKey()).toBeNull();
  });

  it("subscribe and unsubscribe counts match exactly", () => {
    const subscribeFn = jest.fn().mockImplementation(() => jest.fn());
    const resetCursorFn = jest.fn();

    const manager = createUnifiedMessagesSubscriptionManager(
      subscribeFn as any,
      resetCursorFn as any,
    );

    const CHURN_COUNT = 25;
    for (let i = 0; i < CHURN_COUNT; i++) {
      manager.replace({
        scope: i % 2 === 0 ? "dm" : "group",
        conversationId: `conv-${i}`,
        initialLimit: 50,
        currentUid: "user-a",
        debug: false,
        onMessages: jest.fn(),
        onPaginationState: jest.fn(),
        onError: jest.fn(),
      });
    }
    manager.cleanup();

    // Every subscribe should have a matching unsubscribe
    const allUnsubs = subscribeFn.mock.results.map(
      (r: { value: jest.Mock }) => r.value,
    );
    for (const unsub of allUnsubs) {
      expect(unsub).toHaveBeenCalledTimes(1);
    }
    expect(subscribeFn).toHaveBeenCalledTimes(CHURN_COUNT);
  });

  it("no callback execution after cleanup via runIfMounted", () => {
    const mountedRef = { current: true };
    const callback = jest.fn();

    // Before cleanup
    expect(runIfMounted(mountedRef, callback)).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);

    // After cleanup
    mountedRef.current = false;
    expect(runIfMounted(mountedRef, callback)).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);

    // Rapid repeated calls after cleanup
    for (let i = 0; i < 100; i++) {
      runIfMounted(mountedRef, callback);
    }
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cleanup is idempotent", () => {
    const unsub = jest.fn();
    const subscribeFn = jest.fn().mockReturnValue(unsub);
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

    manager.cleanup();
    manager.cleanup(); // Idempotent
    manager.cleanup();

    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it("replace after cleanup is safe", () => {
    const unsub1 = jest.fn();
    const unsub2 = jest.fn();
    const subscribeFn = jest
      .fn()
      .mockReturnValueOnce(unsub1)
      .mockReturnValueOnce(unsub2);
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

    manager.cleanup();
    expect(unsub1).toHaveBeenCalledTimes(1);

    // Replace after cleanup should work cleanly
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
    expect(manager.getActiveKey()).toBe("dm:chat-2");

    manager.cleanup();
    expect(unsub2).toHaveBeenCalledTimes(1);
  });
});
