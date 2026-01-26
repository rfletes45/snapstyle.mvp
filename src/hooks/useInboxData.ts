/**
 * useInboxData Hook
 *
 * Combined data hook for the inbox screen.
 * Subscribes to both DM and Group conversations and provides
 * unified filtering, sorting, and unread count computation.
 *
 * @module hooks/useInboxData
 */

import { isDMVisible } from "@/services/chatMembers";
import { getFirestoreInstance } from "@/services/firebase";
import { isGroupVisible } from "@/services/groupMembers";
import { InboxConversation, MemberStatePrivate } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";

const log = createLogger("useInboxData");

// =============================================================================
// Types
// =============================================================================

/** Filter options for inbox */
export type InboxFilter = "all" | "unread" | "groups" | "dms" | "requests";

/** Sort options for inbox */
export type InboxSort = "recent" | "unread" | "alphabetical";

/** Return type for useInboxData hook */
export interface UseInboxDataResult {
  /** All visible conversations (filtered and sorted) */
  conversations: InboxConversation[];

  /** Pinned conversations only */
  pinnedConversations: InboxConversation[];

  /** Non-pinned conversations only */
  regularConversations: InboxConversation[];

  /** All non-archived conversations (for search - bypasses inbox filter) */
  allConversations: InboxConversation[];

  /** Loading state */
  loading: boolean;

  /** Error state */
  error: Error | null;

  /** Total unread count across all conversations */
  totalUnread: number;

  /** Current filter */
  filter: InboxFilter;

  /** Set filter */
  setFilter: (filter: InboxFilter) => void;

  /** Show archived conversations */
  showArchived: boolean;

  /** Toggle archived view */
  setShowArchived: (show: boolean) => void;

  /** Manual refresh trigger */
  refresh: () => void;

  /** Optimistically mark a conversation as read (updates local state immediately) */
  markConversationReadOptimistic: (conversationId: string) => void;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert Firestore timestamp to milliseconds
 */
function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  return 0;
}

/**
 * Get default member state
 */
function getDefaultMemberState(uid: string): MemberStatePrivate {
  return {
    uid,
    lastSeenAtPrivate: 0,
    archived: false,
    notifyLevel: "all",
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Combined inbox data hook
 *
 * Subscribes to both DM threads and Groups, merges them into a unified
 * conversation list, and provides filtering/sorting functionality.
 *
 * @param uid - Current user's ID
 * @returns Inbox data and controls
 */
export function useInboxData(uid: string): UseInboxDataResult {
  // State
  const [dmConversations, setDmConversations] = useState<InboxConversation[]>(
    [],
  );
  const [groupConversations, setGroupConversations] = useState<
    InboxConversation[]
  >([]);
  const [dmLoading, setDmLoading] = useState(true);
  const [groupLoading, setGroupLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loading = dmLoading || groupLoading;

  // Manual refresh trigger
  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Optimistically mark a conversation as read in local state
  // This immediately updates the UI while the actual Firestore write happens in the background
  const markConversationReadOptimistic = useCallback(
    (conversationId: string) => {
      // Update DM conversations
      setDmConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                unreadCount: 0,
                memberState: {
                  ...c.memberState,
                  lastSeenAtPrivate: Date.now(),
                  lastMarkedUnreadAt: undefined,
                },
              }
            : c,
        ),
      );

      // Update Group conversations
      setGroupConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                unreadCount: 0,
                memberState: {
                  ...c.memberState,
                  lastSeenAtPrivate: Date.now(),
                  lastMarkedUnreadAt: undefined,
                },
              }
            : c,
        ),
      );
    },
    [],
  );

  // =============================================================================
  // DM Subscription
  // =============================================================================

  useEffect(() => {
    if (!uid) {
      setDmLoading(false);
      return;
    }

    const db = getFirestoreInstance();

    // Query DM threads where user is a participant
    const dmQuery = query(
      collection(db, "Chats"),
      where("members", "array-contains", uid),
    );

    const unsubscribe = onSnapshot(
      dmQuery,
      async (snapshot) => {
        try {
          const conversations: InboxConversation[] = [];

          for (const chatDoc of snapshot.docs) {
            const chatData = chatDoc.data();
            const chatId = chatDoc.id;

            // Get other user's ID
            const otherUserId = (chatData.members as string[]).find(
              (m) => m !== uid,
            );
            if (!otherUserId) continue;

            // Get member private state
            let memberState: MemberStatePrivate = getDefaultMemberState(uid);
            try {
              const privateRef = doc(
                db,
                "Chats",
                chatId,
                "MembersPrivate",
                uid,
              );
              const privateSnap = await getDoc(privateRef);
              if (privateSnap.exists()) {
                const privateData = privateSnap.data();
                memberState = {
                  uid,
                  archived: privateData.archived ?? false,
                  mutedUntil: privateData.mutedUntil ?? null,
                  notifyLevel: privateData.notifyLevel ?? "all",
                  sendReadReceipts: privateData.sendReadReceipts ?? true,
                  lastSeenAtPrivate: toMillis(privateData.lastSeenAtPrivate),
                  lastMarkedUnreadAt:
                    toMillis(privateData.lastMarkedUnreadAt) || undefined,
                  pinnedAt: toMillis(privateData.pinnedAt) || null,
                  deletedAt: toMillis(privateData.deletedAt) || null,
                  hiddenUntilNewMessage:
                    privateData.hiddenUntilNewMessage ?? false,
                };
              }
            } catch (e) {
              // Private doc may not exist yet
            }

            // Check visibility
            if (!isDMVisible(memberState)) continue;

            // Calculate unread count
            const lastMessageAt = toMillis(chatData.lastMessageAt);
            let unreadCount = 0;
            if (
              memberState.lastMarkedUnreadAt &&
              memberState.lastMarkedUnreadAt > memberState.lastSeenAtPrivate
            ) {
              unreadCount = 1; // Manual unread marker
            } else if (lastMessageAt > memberState.lastSeenAtPrivate) {
              unreadCount = 1; // Has new messages
            }

            // Get other user's profile for display
            let displayName = "User";
            let avatarUrl: string | null = null;
            let avatarConfig = undefined;
            try {
              const userRef = doc(db, "Users", otherUserId);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                displayName =
                  userData.displayName || userData.username || "User";
                avatarUrl = userData.avatarUrl || null;
                avatarConfig = userData.avatarConfig || undefined;
              }
            } catch (e) {
              // User doc may not exist
            }

            conversations.push({
              id: chatId,
              type: "dm",
              name: displayName,
              avatarUrl,
              avatarConfig,
              otherUserId,
              lastMessage: chatData.lastMessageText
                ? {
                    text: chatData.lastMessageText,
                    senderName: "",
                    timestamp: lastMessageAt,
                    type: chatData.lastMessageType || "text",
                  }
                : null,
              memberState,
              unreadCount,
              hasMentions: false,
              createdAt: toMillis(chatData.createdAt),
            });
          }

          setDmConversations(conversations);
          setDmLoading(false);
        } catch (e) {
          log.error("Error processing DM conversations", { error: e });
          setError(e as Error);
          setDmLoading(false);
        }
      },
      (err) => {
        log.error("DM subscription error", { error: err });
        setError(err);
        setDmLoading(false);
      },
    );

    return unsubscribe;
  }, [uid, refreshKey]);

  // =============================================================================
  // Group Subscription
  // =============================================================================

  useEffect(() => {
    if (!uid) {
      setGroupLoading(false);
      return;
    }

    const db = getFirestoreInstance();

    // Query groups where user is a member
    const groupQuery = query(
      collection(db, "Groups"),
      where("memberIds", "array-contains", uid),
    );

    const unsubscribe = onSnapshot(
      groupQuery,
      async (snapshot) => {
        try {
          const conversations: InboxConversation[] = [];

          for (const groupDoc of snapshot.docs) {
            const groupData = groupDoc.data();
            const groupId = groupDoc.id;

            // Get member private state
            let memberState: MemberStatePrivate = getDefaultMemberState(uid);
            try {
              const privateRef = doc(
                db,
                "Groups",
                groupId,
                "MembersPrivate",
                uid,
              );
              const privateSnap = await getDoc(privateRef);
              if (privateSnap.exists()) {
                const privateData = privateSnap.data();
                memberState = {
                  uid,
                  archived: privateData.archived ?? false,
                  mutedUntil: privateData.mutedUntil ?? null,
                  notifyLevel: privateData.notifyLevel ?? "all",
                  sendReadReceipts: privateData.sendReadReceipts ?? true,
                  lastSeenAtPrivate: toMillis(privateData.lastSeenAtPrivate),
                  lastMarkedUnreadAt:
                    toMillis(privateData.lastMarkedUnreadAt) || undefined,
                  pinnedAt: toMillis(privateData.pinnedAt) || null,
                  deletedAt: toMillis(privateData.deletedAt) || null,
                  hiddenUntilNewMessage:
                    privateData.hiddenUntilNewMessage ?? false,
                };
              }
            } catch (e) {
              // Private doc may not exist yet
            }

            // Check visibility
            if (!isGroupVisible(memberState)) continue;

            // Calculate unread count
            const lastMessageAt = toMillis(groupData.lastMessageAt);
            let unreadCount = 0;
            if (
              memberState.lastMarkedUnreadAt &&
              memberState.lastMarkedUnreadAt > memberState.lastSeenAtPrivate
            ) {
              unreadCount = 1; // Manual unread marker
            } else if (lastMessageAt > memberState.lastSeenAtPrivate) {
              unreadCount = 1; // Has new messages
            }

            // Check for mentions
            // TODO: Implement mention tracking

            conversations.push({
              id: groupId,
              type: "group",
              name: groupData.name || "Unnamed Group",
              avatarUrl: groupData.avatarUrl || null,
              avatarIds: (groupData.memberIds as string[])?.slice(0, 4),
              lastMessage: groupData.lastMessageText
                ? {
                    text: groupData.lastMessageText,
                    senderName: groupData.lastMessageSenderName || "",
                    timestamp: lastMessageAt,
                    type: groupData.lastMessageType || "text",
                  }
                : null,
              memberState,
              unreadCount,
              hasMentions: false,
              createdAt: toMillis(groupData.createdAt),
              participantCount:
                groupData.memberCount ||
                (groupData.memberIds as string[])?.length ||
                0,
            });
          }

          setGroupConversations(conversations);
          setGroupLoading(false);
        } catch (e) {
          log.error("Error processing group conversations", { error: e });
          setError(e as Error);
          setGroupLoading(false);
        }
      },
      (err) => {
        log.error("Group subscription error", { error: err });
        setError(err);
        setGroupLoading(false);
      },
    );

    return unsubscribe;
  }, [uid, refreshKey]);

  // =============================================================================
  // Combined & Filtered List
  // =============================================================================

  const conversations = useMemo(() => {
    let all = [...dmConversations, ...groupConversations];

    // Filter by archive status
    all = all.filter((c) => c.memberState.archived === showArchived);

    // Apply filter
    switch (filter) {
      case "unread":
        all = all.filter(
          (c) => c.unreadCount > 0 || c.memberState.lastMarkedUnreadAt,
        );
        break;
      case "groups":
        all = all.filter((c) => c.type === "group");
        break;
      case "dms":
        all = all.filter((c) => c.type === "dm");
        break;
      // "requests" is handled separately in the UI
    }

    // Sort: pinned first (by pinnedAt desc), then by last message time
    return all.sort((a, b) => {
      const aPinned = a.memberState.pinnedAt ?? 0;
      const bPinned = b.memberState.pinnedAt ?? 0;

      // Both pinned: sort by pinnedAt (most recent first)
      if (aPinned && bPinned) {
        return bPinned - aPinned;
      }

      // Only one pinned: pinned goes first
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Neither pinned: sort by last message time
      const aTime = a.lastMessage?.timestamp ?? a.createdAt;
      const bTime = b.lastMessage?.timestamp ?? b.createdAt;
      return bTime - aTime;
    });
  }, [dmConversations, groupConversations, filter, showArchived]);

  // Separate pinned and regular
  const pinnedConversations = useMemo(
    () => conversations.filter((c) => c.memberState.pinnedAt),
    [conversations],
  );

  const regularConversations = useMemo(
    () => conversations.filter((c) => !c.memberState.pinnedAt),
    [conversations],
  );

  // Total unread count
  // All non-archived conversations (for search - bypasses filter)
  const allConversations = useMemo(() => {
    const all = [...dmConversations, ...groupConversations];
    // Only filter by archive status, not by the inbox filter
    return all.filter((c) => !c.memberState.archived);
  }, [dmConversations, groupConversations]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  );

  return {
    conversations,
    pinnedConversations,
    regularConversations,
    allConversations, // Unfiltered list for search
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

// =============================================================================
// Unread Count Hook (Standalone)
// =============================================================================

/**
 * Hook to get just the total unread count
 *
 * Lighter weight than useInboxData when you only need the count.
 *
 * @param uid - Current user's ID
 * @returns Total unread count
 */
export function useInboxUnreadCount(uid: string): number {
  const { totalUnread } = useInboxData(uid);
  return totalUnread;
}
