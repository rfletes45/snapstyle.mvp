/**
 * useInboxTyping Hook
 *
 * Provides per-conversation typing state for the inbox / Messages screen.
 * Watches the Members subcollection of each visible conversation for
 * typing indicators so that conversation rows can show "typing..." in
 * the preview area.
 *
 * **Performance**: Only subscribes to the conversations rendered on
 * screen (max ~20). Each subscription is a single Firestore onSnapshot
 * on the Members subcollection (same listener used by the chat screen).
 * When conversations scroll off-screen, subscriptions are cleaned up.
 *
 * @module hooks/useInboxTyping
 */

import { subscribeToAllTyping } from "@/services/chatMembers";
import { subscribeToGroupTyping } from "@/services/groupMembers";
import { subscribeToInboxSettings } from "@/services/inboxSettings";
import { resolveFromInboxSettings } from "@/services/messaging/resolveChatSettings";
import { DEFAULT_INBOX_SETTINGS, InboxSettings } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useEffect, useMemo, useRef, useState } from "react";

const log = createLogger("useInboxTyping");

/** Max conversations to track typing for simultaneously */
const MAX_SUBSCRIPTIONS = 25;

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
 * @param conversations - Array of { id, type } for conversations currently visible.
 *                        Pass a stable reference (memoized) to avoid re-subscribing.
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

  useEffect(() => {
    if (!currentUid || !effective.publishTyping) {
      // Clean up all subscriptions if disabled
      unsubMapRef.current.forEach((unsub) => unsub());
      unsubMapRef.current.clear();
      setTypingMap(new Map());
      return;
    }

    const desired = new Set(
      conversations.slice(0, MAX_SUBSCRIPTIONS).map((c) => c.id),
    );
    const current = unsubMapRef.current;

    // Unsubscribe from conversations no longer visible
    for (const [id, unsub] of current) {
      if (!desired.has(id)) {
        unsub();
        current.delete(id);
        setTypingMap((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    }

    // Subscribe to new conversations
    for (const conv of conversations.slice(0, MAX_SUBSCRIPTIONS)) {
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
    }

    // Cleanup all on unmount
    return () => {
      current.forEach((unsub) => unsub());
      current.clear();
    };
  }, [currentUid, conversations, effective.publishTyping]);

  return typingMap;
}
