/**
 * useInboxAggregation Hook (Segment 4)
 *
 * A lightweight alternative to useInboxData that reads from the
 * server-managed Users/{uid}/Inbox subcollection instead of
 * subscribing to every Chat + Group doc directly.
 *
 * Activated by CHAT_FEATURES.CHAT_INBOX_AGGREGATION.
 *
 * The inbox feed itself is a single Firestore listener, but the current
 * implementation still hydrates `MembersPrivate` per conversation so archive,
 * mute, pin, and private read state stay aligned with the fan-out inbox path.
 *
 * @module hooks/useInboxAggregation
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import { getFirestoreInstance } from "@/services/firebase";
import {
  getDefaultMemberState,
  normalizeConversationFromInboxEntry,
  RECENTLY_READ_TTL_MS,
  sortInboxConversations,
} from "@/services/chat/normalizeInboxRow";
import {
  InboxConversation,
  InboxEntry,
  MemberStatePrivate,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const log = createLogger("useInboxAggregation");

// =============================================================================
// Types
// =============================================================================

type InboxFilter = "all" | "dms" | "groups" | "unread" | "requests";

export interface UseInboxAggregationResult {
  /** Filtered & sorted conversations */
  conversations: InboxConversation[];
  /** Pinned conversations (subset of conversations) */
  pinnedConversations: InboxConversation[];
  /** Non-pinned conversations */
  regularConversations: InboxConversation[];
  /** Unfiltered list for search */
  allConversations: InboxConversation[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Total unread count */
  totalUnread: number;
  /** Current filter */
  filter: InboxFilter;
  /** Set filter */
  setFilter: (f: InboxFilter) => void;
  /** Whether to show archived */
  showArchived: boolean;
  /** Toggle archived visibility */
  setShowArchived: (v: boolean) => void;
  /** Force refresh */
  refresh: () => void;
  /** Optimistically mark a conversation as read in local state */
  markConversationReadOptimistic: (
    conversationId: string,
    conversationType?: "dm" | "group",
  ) => void;
}

// =============================================================================
// Helpers
// =============================================================================

function toMillisLike(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (
    typeof value === "object" &&
    value &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

async function getMemberPrivateStateForEntry(
  uid: string,
  entry: InboxEntry,
): Promise<MemberStatePrivate> {
  const db = getFirestoreInstance();
  const collectionPath = entry.scope === "dm" ? "Chats" : "Groups";
  const privateRef = doc(
    db,
    collectionPath,
    entry.conversationId,
    "MembersPrivate",
    uid,
  );

  try {
    const snap = await getDoc(privateRef);
    if (!snap.exists()) {
      return {
        ...getDefaultMemberState(uid),
        archived: entry.archived ?? false,
        notifyLevel: entry.notifyLevel ?? "all",
        pinnedAt: entry.pinnedAt ?? null,
        mutedUntil: entry.mutedUntil ?? null,
      };
    }
    const data = snap.data();
    return {
      uid,
      archived: data.archived ?? entry.archived ?? false,
      mutedUntil:
        toMillisLike(data.mutedUntil) ??
        toMillisLike(entry.mutedUntil) ??
        null,
      notifyLevel: data.notifyLevel ?? entry.notifyLevel ?? "all",
      sendReadReceipts: data.sendReadReceipts ?? true,
      lastSeenAtPrivate: toMillisLike(data.lastSeenAtPrivate) ?? 0,
      lastMarkedUnreadAt: toMillisLike(data.lastMarkedUnreadAt) ?? undefined,
      pinnedAt:
        toMillisLike(data.pinnedAt) ?? toMillisLike(entry.pinnedAt) ?? null,
      deletedAt: toMillisLike(data.deletedAt) ?? null,
      hiddenUntilNewMessage: data.hiddenUntilNewMessage ?? false,
      showMemberChatStyles: data.showMemberChatStyles ?? true,
    };
  } catch (e) {
    log.warn("Failed to load MembersPrivate for inbox aggregation", {
      data: { conversationId: entry.conversationId, scope: entry.scope, error: e },
    });
    return getDefaultMemberState(uid);
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Aggregated inbox hook — reads Users/{uid}/Inbox collection.
 *
 * When CHAT_INBOX_AGGREGATION is disabled, returns an empty "not-ready" state
 * so callers fall back to useInboxData.
 */
export function useInboxAggregation(uid: string): UseInboxAggregationResult {
  const [entries, setEntries] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const recentlyReadRef = useRef<Map<string, number>>(new Map());

  const enabled = CHAT_FEATURES.CHAT_INBOX_AGGREGATION;

  // -------------------------------------------------------
  // Subscribe to Users/{uid}/Inbox ordered by lastActivityAt
  // -------------------------------------------------------
  useEffect(() => {
    if (!uid || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getFirestoreInstance();
    const inboxRef = collection(db, "Users", uid, "Inbox");
    const q = query(inboxRef, orderBy("lastActivityAt", "desc"));

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const inboxEntries = snapshot.docs.map(
            (docSnap) => docSnap.data() as InboxEntry,
          );
          const memberStates = await Promise.all(
            inboxEntries.map((entry) => getMemberPrivateStateForEntry(uid, entry)),
          );
          const convos = inboxEntries.map((entry, index) =>
            normalizeConversationFromInboxEntry(
              entry,
              memberStates[index] || getDefaultMemberState(uid),
              recentlyReadRef.current.get(entry.conversationId),
            ),
          );

          setEntries(sortInboxConversations(convos));
          setError(null);
        } catch (e) {
          log.error("Error processing inbox snapshot", { data: { error: e } });
          setError(e instanceof Error ? e : new Error(String(e)));
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        log.error("Inbox snapshot error", { data: { error: err } });
        setError(err);
        setLoading(false);
      },
    );

    return unsub;
  }, [uid, enabled, refreshKey]);

  // -------------------------------------------------------
  // Memoised derived lists
  // -------------------------------------------------------

  const allConversations = useMemo(() => {
    if (!enabled) return [];
    return entries;
  }, [entries, enabled]);

  const conversations = useMemo(() => {
    let list = showArchived
      ? allConversations.filter((c) => c.memberState.archived)
      : allConversations.filter((c) => !c.memberState.archived);

    if (filter === "dms") list = list.filter((c) => c.type === "dm");
    else if (filter === "groups") list = list.filter((c) => c.type === "group");
    else if (filter === "unread") list = list.filter((c) => c.unreadCount > 0);
    // "requests" is handled by ChatListScreen tabs and not part of inbox rows.

    return sortInboxConversations(list);
  }, [allConversations, filter, showArchived]);

  const pinnedConversations = useMemo(
    () => conversations.filter((c) => c.memberState.pinnedAt),
    [conversations],
  );

  const regularConversations = useMemo(
    () => conversations.filter((c) => !c.memberState.pinnedAt),
    [conversations],
  );

  const totalUnread = useMemo(
    () =>
      allConversations
        .filter((c) => !c.memberState.archived)
        .reduce((sum, c) => sum + c.unreadCount, 0),
    [allConversations],
  );

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const markConversationReadOptimistic = useCallback(
    (conversationId: string, conversationType?: "dm" | "group") => {
      recentlyReadRef.current.set(conversationId, Date.now());

      const now = Date.now();
      for (const [id, ts] of recentlyReadRef.current) {
        if (now - ts > RECENTLY_READ_TTL_MS) {
          recentlyReadRef.current.delete(id);
        }
      }

      setEntries((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          if (conversationType && conversation.type !== conversationType) {
            return conversation;
          }
          return {
            ...conversation,
            unreadCount: 0,
            memberState: {
              ...conversation.memberState,
              lastSeenAtPrivate: now,
              lastMarkedUnreadAt: undefined,
            },
          };
        }),
      );
    },
    [],
  );

  return {
    conversations,
    pinnedConversations,
    regularConversations,
    allConversations,
    loading,
    error,
    totalUnread,
    filter,
    setFilter,
    showArchived,
    setShowArchived,
    refresh,
    markConversationReadOptimistic,
  };
}
