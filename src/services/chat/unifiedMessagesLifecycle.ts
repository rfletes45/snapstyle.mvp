import { mergeMessageCollections } from "@/services/chat/normalizeMessage";
import type { MessageV2 } from "@/types/messaging";

export function mergeRealtimeSnapshotMessages(
  existing: MessageV2[],
  snapshotMessages: MessageV2[],
): MessageV2[] {
  return mergeMessageCollections(existing, snapshotMessages);
}

export function mergePaginatedOlderMessages(
  existing: MessageV2[],
  olderMessages: MessageV2[],
): MessageV2[] {
  return mergeMessageCollections(existing, olderMessages);
}

export function runIfMounted(
  mountedRef: { current: boolean },
  fn: () => void,
): boolean {
  if (!mountedRef.current) return false;
  fn();
  return true;
}

export interface UnifiedMessagesSubscriptionInput {
  scope: "dm" | "group";
  conversationId: string;
  initialLimit: number;
  currentUid: string;
  debug: boolean;
  onMessages: (messages: MessageV2[]) => void;
  onPaginationState: (state: { hasMoreBefore: boolean }) => void;
  onError: (error: Error) => void;
}

export interface UnifiedMessagesSubscribeFn {
  (
    scope: "dm" | "group",
    conversationId: string,
    config: {
      initialLimit: number;
      currentUid: string;
      onMessages: (messages: MessageV2[]) => void;
      onPaginationState: (state: { hasMoreBefore: boolean }) => void;
      onError: (error: Error) => void;
      debug: boolean;
    },
  ): () => void;
}

export interface UnifiedMessagesResetCursorFn {
  (scope: "dm" | "group", conversationId: string): void;
}

export function createUnifiedMessagesSubscriptionManager(
  subscribeFn: UnifiedMessagesSubscribeFn,
  resetCursorFn: UnifiedMessagesResetCursorFn,
) {
  let unsubscribe: (() => void) | null = null;
  let activeKey: string | null = null;

  const cleanup = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    activeKey = null;
  };

  return {
    replace(input: UnifiedMessagesSubscriptionInput): void {
      cleanup();
      if (!input.conversationId || !input.currentUid) return;

      resetCursorFn(input.scope, input.conversationId);
      unsubscribe = subscribeFn(input.scope, input.conversationId, {
        initialLimit: input.initialLimit,
        currentUid: input.currentUid,
        onMessages: input.onMessages,
        onPaginationState: input.onPaginationState,
        onError: input.onError,
        debug: input.debug,
      });
      activeKey = `${input.scope}:${input.conversationId}`;
    },
    cleanup,
    getActiveKey(): string | null {
      return activeKey;
    },
  };
}
