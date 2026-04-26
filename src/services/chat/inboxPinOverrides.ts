import type { InboxConversation } from "@/types/messaging";

export interface PendingPinOverride {
  pinnedAt: number | null;
  requestedAt: number;
}

export function getConversationKey(
  scope: "dm" | "group",
  conversationId: string,
): string {
  return `${scope}:${conversationId}`;
}

export function resolveGroupAvatarUrl(
  hydratedAvatarUrl?: string | null,
  previousAvatarUrl?: string | null,
): string | null {
  return hydratedAvatarUrl ?? previousAvatarUrl ?? null;
}

export function applyPendingPinOverrides(
  conversations: InboxConversation[],
  overrides: ReadonlyMap<string, PendingPinOverride>,
): InboxConversation[] {
  if (overrides.size === 0) return conversations;

  let didChange = false;
  const next = conversations.map((conversation) => {
    const override = overrides.get(
      getConversationKey(conversation.type, conversation.id),
    );
    if (!override) return conversation;

    const serverPinned = !!conversation.memberState.pinnedAt;
    const desiredPinned = !!override.pinnedAt;
    if (serverPinned === desiredPinned) {
      return conversation;
    }

    didChange = true;
    return {
      ...conversation,
      memberState: {
        ...conversation.memberState,
        pinnedAt: override.pinnedAt,
      },
    };
  });

  return didChange ? next : conversations;
}

export function clearConfirmedPendingPinOverrides(
  conversations: InboxConversation[],
  overrides: Map<string, PendingPinOverride>,
): string[] {
  if (overrides.size === 0) return [];

  const clearedKeys: string[] = [];
  for (const conversation of conversations) {
    const key = getConversationKey(conversation.type, conversation.id);
    const override = overrides.get(key);
    if (!override) continue;

    const serverPinned = !!conversation.memberState.pinnedAt;
    const desiredPinned = !!override.pinnedAt;
    if (serverPinned !== desiredPinned) continue;

    overrides.delete(key);
    clearedKeys.push(key);
  }

  return clearedKeys;
}
