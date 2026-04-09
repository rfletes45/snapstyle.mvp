import { createLogger } from "@/utils/log";
import { useCallback, useMemo, useRef } from "react";

const log = createLogger("MessageEnterAnimationQueue");

export interface MessageEnterAnimationQueue {
  clear: () => void;
  consumeAnimation: (id: string) => boolean;
  queueAnimation: (id: string) => void;
  shouldAnimateOnMount: (id: string) => boolean;
}

export function createMessageEnterAnimationState(): Set<string> {
  return new Set<string>();
}

export function queueMessageEnterAnimation(
  state: Set<string>,
  id: string,
): void {
  state.add(id);
  if (__DEV__) {
    log.debug("queueAnimation", {
      operation: "queue",
      data: { messageId: id.substring(0, 8), queueSize: state.size },
    });
  }
}

export function shouldAnimateQueuedMessage(
  state: Set<string>,
  id: string,
): boolean {
  const result = state.has(id);
  if (__DEV__) {
    log.debug("shouldAnimateOnMount", {
      operation: "check",
      data: { messageId: id.substring(0, 8), result, queueSize: state.size },
    });
  }
  return result;
}

export function consumeQueuedMessageEnterAnimation(
  state: Set<string>,
  id: string,
): boolean {
  if (!state.has(id)) {
    return false;
  }

  state.delete(id);
  return true;
}

export function clearQueuedMessageEnterAnimations(state: Set<string>): void {
  if (__DEV__ && state.size > 0) {
    log.debug("clear", {
      operation: "clear",
      data: { clearedCount: state.size },
    });
  }
  state.clear();
}

export function useMessageEnterAnimationQueue(): MessageEnterAnimationQueue {
  const stateRef = useRef<Set<string>>(createMessageEnterAnimationState());

  const queueAnimation = useCallback((id: string) => {
    queueMessageEnterAnimation(stateRef.current, id);
  }, []);

  const shouldAnimateOnMount = useCallback((id: string) => {
    return shouldAnimateQueuedMessage(stateRef.current, id);
  }, []);

  const consumeAnimation = useCallback((id: string) => {
    return consumeQueuedMessageEnterAnimation(stateRef.current, id);
  }, []);

  const clear = useCallback(() => {
    clearQueuedMessageEnterAnimations(stateRef.current);
  }, []);

  return useMemo(
    () => ({
      clear,
      consumeAnimation,
      queueAnimation,
      shouldAnimateOnMount,
    }),
    [clear, consumeAnimation, queueAnimation, shouldAnimateOnMount],
  );
}
