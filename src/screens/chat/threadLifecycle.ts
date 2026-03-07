export interface ThreadRealtimeLifecycleInput {
  scope: "dm" | "group";
  conversationId: string;
  subscribeFn: (
    scope: "dm" | "group",
    conversationId: string,
    callback: () => void,
  ) => () => void;
  onConversationUpdate: () => void;
}

export function createThreadRealtimeLifecycle(
  input: ThreadRealtimeLifecycleInput,
): () => void {
  let active = true;
  const unsubscribe = input.subscribeFn(
    input.scope,
    input.conversationId,
    () => {
      if (!active) return;
      input.onConversationUpdate();
    },
  );

  return () => {
    active = false;
    unsubscribe();
  };
}
