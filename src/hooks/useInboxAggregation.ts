/**
 * useInboxAggregation Hook (Segment 4)
 *
 * A lightweight alternative to useInboxData that reads from the
 * server-managed Users/{uid}/Inbox subcollection instead of
 * subscribing to every Chat + Group doc plus per-conversation
 * member-state lookups.
 *
 * Activated by CHAT_FEATURES.CHAT_INBOX_AGGREGATION.
 *
 * Single Firestore snapshot listener, no per-conversation fan-out.
 *
 * @module hooks/useInboxAggregation
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import { getFirestoreInstance } from "@/services/firebase";
import {
  InboxConversation,
  InboxEntry,
  MemberStatePrivate,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

const log = createLogger("useInboxAggregation");

// =============================================================================
// Types
// =============================================================================

type InboxFilter = "all" | "dms" | "groups" | "unread";

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
}

// =============================================================================
// Helpers
// =============================================================================

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  return 0;
}

/**
 * Map an InboxEntry doc to the InboxConversation shape expected by the UI.
 */
function mapEntryToConversation(entry: InboxEntry): InboxConversation {
  const isDm = entry.scope === "dm";

  // Map message kind to legacy lastMessage.type
  const legacyTypeMap: Record<string, string> = {
    text: "text",
    media: "image",
    voice: "voice",
    file: "attachment",
    scorecard: "scorecard",
    game_invite: "game_invite",
    system: "text",
  };

  const memberState: MemberStatePrivate = {
    uid: "", // will be set by caller if needed
    lastSeenAtPrivate: 0,
    archived: entry.archived ?? false,
    notifyLevel: entry.notifyLevel ?? "all",
    pinnedAt: entry.pinnedAt ?? undefined,
    mutedUntil: entry.mutedUntil ?? undefined,
  };

  return {
    id: entry.conversationId,
    type: isDm ? "dm" : "group",
    name: isDm
      ? entry.otherUserName || "Chat"
      : entry.groupName || "Group Chat",
    avatarUrl: null,
    otherUserId: isDm ? entry.otherUserId : undefined,
    lastMessage: {
      text: entry.lastMessagePreview || "",
      senderName: "", // we don't store sender name in inbox entry
      timestamp: toMillis(entry.lastActivityAt),
      type: (legacyTypeMap[entry.lastMessageKind || "text"] ||
        "text") as InboxConversation["lastMessage"] extends null
        ? never
        : NonNullable<InboxConversation["lastMessage"]>["type"],
    },
    memberState,
    unreadCount: entry.unreadCount ?? 0,
    hasMentions: false, // could be extended later
    createdAt: toMillis(entry.lastActivityAt),
    participantCount: entry.memberCount,
  };
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
      (snapshot) => {
        try {
          const convos: InboxConversation[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as InboxEntry;
            return mapEntryToConversation(data);
          });
          setEntries(convos);
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

    return list;
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

  const refresh = () => setRefreshKey((k) => k + 1);

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
  };
}
