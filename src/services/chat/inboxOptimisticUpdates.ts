import type { InboxConversation, MessageKind } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { mapMessageKindToPreviewType } from "./normalizeInboxRow";

const log = createLogger("inboxOptimisticUpdates");
const RECENT_UPDATE_TTL_MS = 60_000;

export interface OptimisticInboxUpdate {
  scope: "dm" | "group";
  conversationId: string;
  messageId: string;
  messageKind: MessageKind;
  previewText: string;
  senderId: string;
  senderName?: string | null;
  timestamp: number;
}

type Listener = (update: OptimisticInboxUpdate) => void;

const listeners = new Set<Listener>();
const recentUpdates = new Map<string, OptimisticInboxUpdate>();

function getUpdateKey(update: OptimisticInboxUpdate): string {
  return `${update.scope}:${update.conversationId}`;
}

function pruneRecentUpdates(now = Date.now()): void {
  for (const [key, update] of recentUpdates) {
    if (now - update.timestamp > RECENT_UPDATE_TTL_MS) {
      recentUpdates.delete(key);
    }
  }
}

export function buildOptimisticPreviewText(
  kind: MessageKind,
  text?: string | null,
): string {
  if (kind === "text") return text?.trim() || "";
  if (kind === "media") return "Photo";
  if (kind === "voice") return "Voice message";
  if (kind === "file") return "Attachment";
  if (kind === "animal") return text?.trim() || "Animal message";
  return text?.trim() || "";
}

export function emitOptimisticInboxUpdate(
  update: OptimisticInboxUpdate,
): void {
  if (!update.conversationId || !update.scope) return;

  pruneRecentUpdates();
  recentUpdates.set(getUpdateKey(update), update);

  log.debug("optimistic inbox activity", {
    data: {
      scope: update.scope,
      conversationId: update.conversationId,
      messageKind: update.messageKind,
      timestamp: update.timestamp,
      listenerCount: listeners.size,
    },
  });

  for (const listener of listeners) {
    try {
      listener(update);
    } catch (error) {
      log.warn("optimistic inbox listener failed", { data: { error } });
    }
  }
}

export function subscribeToOptimisticInboxUpdates(
  listener: Listener,
): () => void {
  listeners.add(listener);
  pruneRecentUpdates();
  for (const update of recentUpdates.values()) {
    try {
      listener(update);
    } catch (error) {
      log.warn("optimistic inbox replay failed", { data: { error } });
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

export function applyOptimisticInboxUpdate(
  conversation: InboxConversation,
  update: OptimisticInboxUpdate,
  currentUserId?: string,
): InboxConversation {
  if (conversation.id !== update.conversationId) return conversation;
  if (conversation.type !== update.scope) return conversation;

  const currentTimestamp =
    conversation.lastMessage?.timestamp ?? conversation.createdAt ?? 0;
  if (currentTimestamp >= update.timestamp) return conversation;

  const isSender = currentUserId && update.senderId === currentUserId;

  return {
    ...conversation,
    lastMessage: {
      text: update.previewText,
      senderName: update.scope === "group" ? update.senderName || "" : "",
      timestamp: update.timestamp,
      type: mapMessageKindToPreviewType(update.messageKind),
    },
    unreadCount: isSender ? 0 : conversation.unreadCount,
    memberState: isSender
      ? {
          ...conversation.memberState,
          lastSeenAtPrivate: Math.max(
            conversation.memberState.lastSeenAtPrivate || 0,
            update.timestamp,
          ),
          lastMarkedUnreadAt: undefined,
        }
      : conversation.memberState,
  };
}
