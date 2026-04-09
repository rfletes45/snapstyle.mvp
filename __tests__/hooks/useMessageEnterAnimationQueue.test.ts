import {
  clearQueuedMessageEnterAnimations,
  consumeQueuedMessageEnterAnimation,
  createMessageEnterAnimationState,
  queueMessageEnterAnimation,
  shouldAnimateQueuedMessage,
} from "@/hooks/chat/useMessageEnterAnimationQueue";

describe("message enter animation queue", () => {
  it("queues and consumes a message animation once", () => {
    const state = createMessageEnterAnimationState();

    queueMessageEnterAnimation(state, "msg-1");

    expect(shouldAnimateQueuedMessage(state, "msg-1")).toBe(true);
    expect(consumeQueuedMessageEnterAnimation(state, "msg-1")).toBe(true);
    expect(shouldAnimateQueuedMessage(state, "msg-1")).toBe(false);
    expect(consumeQueuedMessageEnterAnimation(state, "msg-1")).toBe(false);
  });

  it("tracks multiple rapid sends independently", () => {
    const state = createMessageEnterAnimationState();

    queueMessageEnterAnimation(state, "msg-1");
    queueMessageEnterAnimation(state, "msg-2");
    queueMessageEnterAnimation(state, "msg-3");

    expect(consumeQueuedMessageEnterAnimation(state, "msg-2")).toBe(true);
    expect(shouldAnimateQueuedMessage(state, "msg-1")).toBe(true);
    expect(shouldAnimateQueuedMessage(state, "msg-2")).toBe(false);
    expect(shouldAnimateQueuedMessage(state, "msg-3")).toBe(true);
  });

  it("clears queued animations when switching conversations", () => {
    const state = createMessageEnterAnimationState();

    queueMessageEnterAnimation(state, "msg-1");
    queueMessageEnterAnimation(state, "msg-2");
    clearQueuedMessageEnterAnimations(state);

    expect(shouldAnimateQueuedMessage(state, "msg-1")).toBe(false);
    expect(shouldAnimateQueuedMessage(state, "msg-2")).toBe(false);
  });
});
