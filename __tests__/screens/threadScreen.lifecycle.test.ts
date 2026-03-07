import { createThreadRealtimeLifecycle } from "../../src/screens/chat/threadLifecycle";

describe("ThreadScreen realtime lifecycle", () => {
  it("subscribes and unsubscribes exactly once", () => {
    const unsubscribe = jest.fn();
    const subscribeFn = jest.fn().mockReturnValue(unsubscribe);
    const onConversationUpdate = jest.fn();

    const cleanup = createThreadRealtimeLifecycle({
      scope: "dm",
      conversationId: "chat-1",
      subscribeFn,
      onConversationUpdate,
    });

    expect(subscribeFn).toHaveBeenCalledTimes(1);
    expect(subscribeFn).toHaveBeenCalledWith(
      "dm",
      "chat-1",
      expect.any(Function),
    );

    cleanup();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not invoke update callback after cleanup", () => {
    let listener: (() => void) | undefined;
    const unsubscribe = jest.fn();
    const subscribeFn = jest.fn().mockImplementation((_scope, _id, cb) => {
      listener = cb;
      return unsubscribe;
    });
    const onConversationUpdate = jest.fn();

    const cleanup = createThreadRealtimeLifecycle({
      scope: "group",
      conversationId: "group-1",
      subscribeFn,
      onConversationUpdate,
    });

    listener?.();
    expect(onConversationUpdate).toHaveBeenCalledTimes(1);

    cleanup();
    listener?.();
    expect(onConversationUpdate).toHaveBeenCalledTimes(1);
  });
});
