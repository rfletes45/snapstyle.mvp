/**
 * useInboxTyping Hook
 *
 * Provides per-conversation typing state for the inbox / Messages screen.
 * Watches the Members subcollection of each visible conversation for
 * typing indicators so that conversation rows can show "typing..." in
 * the preview area.
 *
 * **Performance**: Subscribes to a visible-screen-sized leading window
 * (max 12). Each subscription is a single Firestore onSnapshot on the
 * Members subcollection (same listener used by the chat screen). The hook
 * diffs subscriptions across updates so normal inbox rerenders do not
 * tear down and recreate every listener.
 *
 * @module hooks/useInboxTyping
 */

import { subscribeToAllTyping } from "@/services/chatMembers";
import { subscribeToGroupTyping } from "@/services/groupMembers";
import { subscribeToInboxSettings } from "@/services/inboxSettings";
import { resolveFromInboxSettings } from "@/services/messaging/resolveChatSettings";
import { DEFAULT_INBOX_SETTINGS, InboxSettings } from "@/types/messaging";
import { createLogger, isDebugEnabled } from "@/utils/log";
import { useEffect, useMemo, useRef, useState } from "react";

const log = createLogger("useInboxTyping");

/** Max conversations to track typing for simultaneously */
const MAX_SUBSCRIPTIONS = 12;

export interface ConversationTypingInfo {
  /** Whether anyone is typing in this conversation */
  isTyping: boolean;
  /** UIDs of users who are typing */
  typingUserIds: string[];
}

interface ConversationSpec {
  id: string;
  type: "dm" | "group";
}

/**
 * Subscribe to typing state for visible inbox conversations.
 *
 * @param currentUid - Authenticated user's UID
 * @param conversations - Array of { id, type } ordered by inbox visibility.
 *                        Pass a stable reference (memoized) to avoid extra diff work.
 * @returns Map from conversationId → ConversationTypingInfo
 */
export function useInboxTyping(
  currentUid: string | undefined,
  conversations: ConversationSpec[],
): Map<string, ConversationTypingInfo> {
  const [typingMap, setTypingMap] = useState<
    Map<string, ConversationTypingInfo>
  >(new Map());

  // Settings
  const [settings, setSettings] = useState<InboxSettings>(
    DEFAULT_INBOX_SETTINGS,
  );
  const effective = useMemo(
    () => resolveFromInboxSettings(settings),
    [settings],
  );

  useEffect(() => {
    if (!currentUid) return;
    return subscribeToInboxSettings(currentUid, setSettings);
  }, [currentUid]);

  // Track active subscriptions
  const unsubMapRef = useRef<Map<string, () => void>>(new Map());
  const ownerUidRef = useRef<string | undefined>(undefined);

  const clearSubscriptions = () => {
    const count = unsubMapRef.current.size;
    unsubMapRef.current.forEach((unsub) => unsub());
    unsubMapRef.current.clear();
    if (count > 0 && isDebugEnabled("PERF")) {
      log.debug("typing subscriptions cleared", { data: { count } });
    }
  };

  useEffect(() => {
    if (ownerUidRef.current !== currentUid) {
      clearSubscriptions();
      ownerUidRef.current = currentUid;
      setTypingMap(new Map());
    }

    if (!currentUid || !effective.publishTyping) {
      // Clean up all subscriptions if disabled
      clearSubscriptions();
      setTypingMap(new Map());
      return;
    }

    const trackedConversations = conversations.slice(0, MAX_SUBSCRIPTIONS);
    const desired = new Set(trackedConversations.map((c) => c.id));
    const current = unsubMapRef.current;
    let attached = 0;
    let detached = 0;

    // Unsubscribe from conversations no longer visible
    for (const [id, unsub] of current) {
      if (!desired.has(id)) {
        unsub();
        current.delete(id);
        detached += 1;
        setTypingMap((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    }

    // Subscribe to new conversations
    for (const conv of trackedConversations) {
      if (current.has(conv.id)) continue;

      const handleUpdate = (typingUids: string[]) => {
        setTypingMap((prev) => {
          const existing = prev.get(conv.id);
          // Skip no-op updates
          if (
            existing &&
            existing.typingUserIds.length === typingUids.length &&
            existing.typingUserIds.every((uid, i) => uid === typingUids[i])
          ) {
            return prev;
          }
          const next = new Map(prev);
          next.set(conv.id, {
            isTyping: typingUids.length > 0,
            typingUserIds: typingUids,
          });
          return next;
        });
      };

      let unsub: () => void;
      if (conv.type === "dm") {
        unsub = subscribeToAllTyping(conv.id, currentUid, handleUpdate);
      } else {
        unsub = subscribeToGroupTyping(conv.id, currentUid, handleUpdate);
      }
      current.set(conv.id, unsub);
      attached += 1;
    }

    if ((attached > 0 || detached > 0) && isDebugEnabled("PERF")) {
      log.debug("typing subscription diff", {
        data: {
          attached,
          detached,
          active: current.size,
          requested: conversations.length,
          tracked: trackedConversations.length,
        },
      });
    }
  }, [currentUid, conversations, effective.publishTyping]);

  useEffect(() => clearSubscriptions, []);

  return typingMap;
}
