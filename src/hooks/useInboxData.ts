/**
 * useInboxData Hook
 *
 * Combined data hook for the inbox screen.
 * Subscribes to both DM and Group conversations and provides
 * unified filtering, sorting, and unread count computation.
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Parallel fetching of member states and user profiles
 * - In-memory caching for user profile data
 * - AsyncStorage caching for immediate display on screen load
 * - Immediate rendering with cached data, background refresh
 *
 * @module hooks/useInboxData
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import {
  normalizeFanoutDMConversation,
  normalizeFanoutGroupConversation,
} from "@/services/chat/fanoutInboxNormalization";
import {
  getDefaultMemberState,
  RECENTLY_READ_TTL_MS,
  sortInboxConversations,
} from "@/services/chat/normalizeInboxRow";
import { isDMVisible } from "@/services/chatMembers";
import { getFirestoreInstance } from "@/services/firebase";
import { isGroupVisible } from "@/services/groupMembers";
import { InboxConversation, MemberStatePrivate } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInboxAggregation } from "./useInboxAggregation";

const log = createLogger("useInboxData");

// =============================================================================
// AsyncStorage Cache Keys & Config
// =============================================================================

const INBOX_CACHE_KEY = "@inbox_cache:";
const INBOX_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache validity

interface InboxCacheData {
  dmConversations: InboxConversation[];
  groupConversations: InboxConversation[];
  timestamp: number;
}

/**
 * Load cached inbox data from AsyncStorage
 */
async function loadInboxCache(uid: string): Promise<InboxCacheData | null> {
  try {
    const cached = await AsyncStorage.getItem(`${INBOX_CACHE_KEY}${uid}`);
    if (cached) {
      const data = JSON.parse(cached) as InboxCacheData;
      // Check if cache is still valid
      if (Date.now() - data.timestamp < INBOX_CACHE_TTL) {
        return data;
      }
    }
  } catch (e) {
    log.warn("Failed to load inbox cache", { data: { error: e } });
  }
  return null;
}

/**
 * Save inbox data to AsyncStorage cache
 */
async function saveInboxCache(
  uid: string,
  dmConversations: InboxConversation[],
  groupConversations: InboxConversation[],
): Promise<void> {
  try {
    const data: InboxCacheData = {
      dmConversations,
      groupConversations,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(
      `${INBOX_CACHE_KEY}${uid}`,
      JSON.stringify(data),
    );
  } catch (e) {
    log.warn("Failed to save inbox cache", { data: { error: e } });
  }
}

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

  /** Manual refresh trigger */
  refresh: () => void;

  /** Optimistically mark a conversation as read (updates local state immediately) */
  markConversationReadOptimistic: (
    conversationId: string,
    conversationType?: "dm" | "group",
  ) => void;

  /** Optimistically toggle pin state (updates local state immediately) */
  togglePinOptimistic: (
    conversationId: string,
    conversationType?: "dm" | "group",
  ) => void;
}

// =============================================================================
// User Profile Cache (In-Memory)
// =============================================================================

interface CachedUserProfile {
  displayName: string;
  avatarUrl: string | null;
  avatarConfig: any;
  profilePictureUrl: string | null;
  decorationId: string | null;
  fetchedAt: number;
}

// Global in-memory cache for user profiles (shared across hook instances)
const userProfileCache = new Map<string, CachedUserProfile>();
const USER_PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached user profile or fetch from Firestore
 * Returns cached data immediately if available, fetches in background if stale
 */
async function getCachedUserProfile(
  db: ReturnType<typeof getFirestoreInstance>,
  userId: string,
): Promise<CachedUserProfile> {
  const cached = userProfileCache.get(userId);
  const now = Date.now();

  // Return cached if fresh
  if (cached && now - cached.fetchedAt < USER_PROFILE_CACHE_TTL) {
    return cached;
  }

  // Fetch from Firestore
  try {
    const userRef = doc(db, "Users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const profile: CachedUserProfile = {
        displayName: userData.displayName || userData.username || "User",
        avatarUrl: userData.avatarUrl || null,
        avatarConfig: userData.avatarConfig || undefined,
        profilePictureUrl: userData.profilePicture?.url || null,
        decorationId: userData.avatarDecoration?.decorationId || null,
        fetchedAt: now,
      };
      userProfileCache.set(userId, profile);
      return profile;
    }
  } catch (e) {
    // Return stale cache if fetch fails
    if (cached) return cached;
  }

  // Return default if no cache and fetch failed
  return {
    displayName: "User",
    avatarUrl: null,
    avatarConfig: undefined,
    profilePictureUrl: null,
    decorationId: null,
    fetchedAt: now,
  };
}

/**
 * Batch fetch multiple user profiles in parallel
 */
async function batchFetchUserProfiles(
  db: ReturnType<typeof getFirestoreInstance>,
  userIds: string[],
): Promise<Map<string, CachedUserProfile>> {
  const results = new Map<string, CachedUserProfile>();
  const fetchPromises = userIds.map(async (userId) => {
    const profile = await getCachedUserProfile(db, userId);
    results.set(userId, profile);
  });
  await Promise.all(fetchPromises);
  return results;
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
  const aggregation = useInboxAggregation(uid);
  const useAggregatedInbox = CHAT_FEATURES.CHAT_INBOX_AGGREGATION;

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

  // Track if we've loaded cached data (to avoid double-loading)
  const cacheLoadedRef = useRef(false);

  // Track whether both live subscriptions have delivered at least once.
  // This prevents the partial flash where groups appear before DMs.
  // IMPORTANT: Once set to true, never reset — real-time listeners stay
  // active and will automatically push updates without needing a restart.
  const [bothLiveReady, setBothLiveReady] = useState(false);
  const dmReadyRef = useRef(false);
  const groupReadyRef = useRef(false);

  // Once we have loaded data (from cache OR live), never show the loading
  // spinner again. This prevents flicker when data refreshes in the background.
  const hasEverLoadedRef = useRef(false);

  // Track recently-read conversation IDs to prevent Firestore snapshots from
  // resetting the optimistic unread state before the watermark write propagates.
  // Entries expire after 30 seconds (more than enough for the write to land).
  const recentlyReadRef = useRef<Map<string, number>>(new Map());

  // Loading: show loading state until we have EITHER cached data OR both live
  // subscriptions have resolved. This prevents a partial list flash where
  // groups appear before DMs or vice versa.
  // Once we've loaded data for the first time, never go back to loading=true.
  const hasCachedData =
    cacheLoadedRef.current &&
    (dmConversations.length > 0 || groupConversations.length > 0);
  if (hasCachedData || bothLiveReady) {
    hasEverLoadedRef.current = true;
  }
  const loading = !hasEverLoadedRef.current && !hasCachedData && !bothLiveReady;

  // =============================================================================
  // Load Cached Data on Mount (INSTANT LOAD)
  // =============================================================================

  useEffect(() => {
    if (useAggregatedInbox || !uid || cacheLoadedRef.current) return;

    const loadCache = async () => {
      // If either live subscription has already delivered data by the time
      // the cache promise resolves, skip the cache entirely.  In production
      // (Hermes), Firestore listeners often fire before AsyncStorage
      // completes, and writing stale cached data on top of fresh live data
      // causes the visible "second reload" stutter.
      if (dmReadyRef.current || groupReadyRef.current) {
        cacheLoadedRef.current = true;
        return;
      }

      const cached = await loadInboxCache(uid);

      // Re-check after the async gap — a listener may have fired while
      // we were reading from AsyncStorage.
      if (dmReadyRef.current || groupReadyRef.current) {
        cacheLoadedRef.current = true;
        return;
      }

      if (cached) {
        log.debug("Loaded inbox from cache", {
          data: {
            dmCount: cached.dmConversations.length,
            groupCount: cached.groupConversations.length,
          },
        });
        setDmConversations(cached.dmConversations);
        setGroupConversations(cached.groupConversations);
        cacheLoadedRef.current = true;
      }
    };

    loadCache();
  }, [uid, useAggregatedInbox]);

  // Manual refresh trigger.
  // For the non-aggregated path, the Firestore onSnapshot listeners are
  // already real-time and will push updates automatically.  A "refresh"
  // simply clears any stale error state so the UI can recover after a
  // transient failure.  We do NOT tear down & recreate the subscriptions
  // because that causes the visible list stutter the user reported.
  const refresh = useCallback(() => {
    if (useAggregatedInbox) {
      aggregation.refresh();
      return;
    }
    setError(null);
  }, [aggregation, useAggregatedInbox]);

  // Optimistically mark a conversation as read in local state
  // This immediately updates the UI while the actual Firestore write happens in the background
  const markConversationReadOptimistic = useCallback(
    (conversationId: string, conversationType?: "dm" | "group") => {
      if (useAggregatedInbox) {
        aggregation.markConversationReadOptimistic(
          conversationId,
          conversationType,
        );
        return;
      }

      // Track this conversation as recently read to prevent snapshot overwrites
      recentlyReadRef.current.set(conversationId, Date.now());

      // Clean up old entries (>30 seconds)
      const now = Date.now();
      for (const [id, ts] of recentlyReadRef.current) {
        if (now - ts > RECENTLY_READ_TTL_MS) {
          recentlyReadRef.current.delete(id);
        }
      }

      // Update DM conversations
      if (!conversationType || conversationType === "dm") {
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
      }

      // Update Group conversations
      if (!conversationType || conversationType === "group") {
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
      }
    },
    [aggregation, useAggregatedInbox],
  );

  // Optimistically toggle pin state in local state
  const togglePinOptimistic = useCallback(
    (conversationId: string, conversationType?: "dm" | "group") => {
      if (useAggregatedInbox) {
        aggregation.togglePinOptimistic(conversationId, conversationType);
        return;
      }

      const now = Date.now();

      if (!conversationType || conversationType === "dm") {
        setDmConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  memberState: {
                    ...c.memberState,
                    pinnedAt: c.memberState.pinnedAt ? null : now,
                  },
                }
              : c,
          ),
        );
      }

      if (!conversationType || conversationType === "group") {
        setGroupConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  memberState: {
                    ...c.memberState,
                    pinnedAt: c.memberState.pinnedAt ? null : now,
                  },
                }
              : c,
          ),
        );
      }
    },
    [aggregation, useAggregatedInbox],
  );

  // =============================================================================
  // DM Subscription (OPTIMIZED - Parallel fetching)
  // =============================================================================

  useEffect(() => {
    if (useAggregatedInbox || !uid) {
      setDmLoading(false);
      dmReadyRef.current = true;
      if (groupReadyRef.current) setBothLiveReady(true);
      return;
    }

    let cancelled = false;
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
          // STEP 1: Extract all chat data and user IDs first (synchronous)
          const chatEntries: Array<{
            chatId: string;
            chatData: any;
            otherUserId: string;
          }> = [];

          for (const chatDoc of snapshot.docs) {
            const chatData = chatDoc.data();
            const chatId = chatDoc.id;
            const otherUserId = (chatData.members as string[]).find(
              (m) => m !== uid,
            );
            if (otherUserId) {
              chatEntries.push({ chatId, chatData, otherUserId });
            }
          }

          // STEP 2: Fetch all member states in PARALLEL
          const memberStatePromises = chatEntries.map(async ({ chatId }) => {
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
                return {
                  chatId,
                  memberState: {
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
                  } as MemberStatePrivate,
                };
              }
            } catch (e) {
              // Private doc may not exist yet
            }
            return { chatId, memberState: getDefaultMemberState(uid) };
          });

          const memberStatesResults = await Promise.all(memberStatePromises);
          const memberStatesMap = new Map(
            memberStatesResults.map((r) => [r.chatId, r.memberState]),
          );

          // STEP 3: Fetch all user profiles in PARALLEL (with caching)
          const uniqueUserIds = [
            ...new Set(chatEntries.map((e) => e.otherUserId)),
          ];
          const userProfiles = await batchFetchUserProfiles(db, uniqueUserIds);

          // STEP 4: Build conversations (synchronous)
          const conversations: InboxConversation[] = [];

          for (const { chatId, chatData, otherUserId } of chatEntries) {
            const memberState =
              memberStatesMap.get(chatId) || getDefaultMemberState(uid);

            // Check visibility
            if (!isDMVisible(memberState)) continue;

            const lastMessageAt = toMillis(chatData.lastMessageAt);
            const recentlyReadAt = recentlyReadRef.current.get(chatId);

            // Get user profile from cache
            const profile = userProfiles.get(otherUserId) || {
              displayName: "User",
              avatarUrl: null,
              avatarConfig: undefined,
              profilePictureUrl: null,
              decorationId: null,
            };

            conversations.push(
              normalizeFanoutDMConversation({
                chatId,
                profile,
                otherUserId,
                memberState,
                chatData: {
                  lastMessageText: chatData.lastMessageText,
                  lastMessageType: chatData.lastMessageType,
                  lastMessageAt: lastMessageAt,
                  createdAt: toMillis(chatData.createdAt),
                },
                recentlyReadAt,
              }),
            );
          }

          if (!cancelled) {
            setDmConversations(conversations);
            setDmLoading(false);
            dmReadyRef.current = true;
            if (groupReadyRef.current) setBothLiveReady(true);
          }
        } catch (e) {
          log.error("Error processing DM conversations", { error: e });
          if (!cancelled) {
            setError(e as Error);
            setDmLoading(false);
            dmReadyRef.current = true;
            if (groupReadyRef.current) setBothLiveReady(true);
          }
        }
      },
      (err) => {
        log.error("DM subscription error", { error: err });
        if (!cancelled) {
          setError(err);
          setDmLoading(false);
          dmReadyRef.current = true;
          if (groupReadyRef.current) setBothLiveReady(true);
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid, useAggregatedInbox]);

  // =============================================================================
  // Group Subscription (OPTIMIZED - Parallel fetching)
  // =============================================================================

  useEffect(() => {
    if (useAggregatedInbox || !uid) {
      setGroupLoading(false);
      groupReadyRef.current = true;
      if (dmReadyRef.current) setBothLiveReady(true);
      return;
    }

    let cancelled = false;

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
          // STEP 1: Extract all group data (synchronous)
          const groupEntries = snapshot.docs.map((groupDoc) => ({
            groupId: groupDoc.id,
            groupData: groupDoc.data(),
          }));

          // STEP 2: Fetch all member states in PARALLEL
          const memberStatePromises = groupEntries.map(async ({ groupId }) => {
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
                return {
                  groupId,
                  memberState: {
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
                  } as MemberStatePrivate,
                };
              }
            } catch (e) {
              // Private doc may not exist yet
            }
            return { groupId, memberState: getDefaultMemberState(uid) };
          });

          const memberStatesResults = await Promise.all(memberStatePromises);
          const memberStatesMap = new Map(
            memberStatesResults.map((r) => [r.groupId, r.memberState]),
          );

          // STEP 3: Build conversations (synchronous)
          const conversations: InboxConversation[] = [];

          for (const { groupId, groupData } of groupEntries) {
            const memberState =
              memberStatesMap.get(groupId) || getDefaultMemberState(uid);

            // Check visibility
            if (!isGroupVisible(memberState)) continue;

            const lastMessageAt = toMillis(groupData.lastMessageAt);
            const recentlyReadAt = recentlyReadRef.current.get(groupId);
            conversations.push(
              normalizeFanoutGroupConversation({
                groupId,
                groupData: {
                  name: groupData.name,
                  avatarUrl: groupData.avatarUrl || null,
                  memberIds: groupData.memberIds as string[] | undefined,
                  lastMessageText: groupData.lastMessageText,
                  lastMessageSenderName: groupData.lastMessageSenderName,
                  lastMessageType: groupData.lastMessageType,
                  lastMessageAt: lastMessageAt,
                  createdAt: toMillis(groupData.createdAt),
                  memberCount: groupData.memberCount,
                },
                memberState,
                recentlyReadAt,
              }),
            );
          }

          if (!cancelled) {
            setGroupConversations(conversations);
            setGroupLoading(false);
            groupReadyRef.current = true;
            if (dmReadyRef.current) setBothLiveReady(true);
          }
        } catch (e) {
          log.error("Error processing group conversations", { error: e });
          if (!cancelled) {
            setError(e as Error);
            setGroupLoading(false);
            groupReadyRef.current = true;
            if (dmReadyRef.current) setBothLiveReady(true);
          }
        }
      },
      (err) => {
        log.error("Group subscription error", { error: err });
        if (!cancelled) {
          setError(err);
          setGroupLoading(false);
          groupReadyRef.current = true;
          if (dmReadyRef.current) setBothLiveReady(true);
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid, useAggregatedInbox]);

  // =============================================================================
  // Combined & Filtered List
  // =============================================================================

  const conversations = useMemo(() => {
    let all = [...dmConversations, ...groupConversations];

    // Exclude archived conversations (archive feature removed)
    all = all.filter((c) => !c.memberState.archived);

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

    return sortInboxConversations(all);
  }, [dmConversations, groupConversations, filter]);

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
    return sortInboxConversations(all.filter((c) => !c.memberState.archived));
  }, [dmConversations, groupConversations]);

  const totalUnread = useMemo(
    () => allConversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [allConversations],
  );

  // =============================================================================
  // Save to Cache when Data Changes
  // =============================================================================

  useEffect(() => {
    // Only save to cache if we have loaded fresh data from Firestore
    // (not just cached data, and both subscriptions have completed)
    if (useAggregatedInbox || !uid || dmLoading || groupLoading) return;

    // Only cache if we have at least some data
    if (dmConversations.length === 0 && groupConversations.length === 0) return;

    // Save to cache in background
    saveInboxCache(uid, dmConversations, groupConversations);
  }, [
    uid,
    dmConversations,
    groupConversations,
    dmLoading,
    groupLoading,
    useAggregatedInbox,
  ]);

  if (useAggregatedInbox) {
    return {
      conversations: aggregation.conversations,
      pinnedConversations: aggregation.pinnedConversations,
      regularConversations: aggregation.regularConversations,
      allConversations: aggregation.allConversations,
      loading: aggregation.loading,
      error: aggregation.error,
      totalUnread: aggregation.totalUnread,
      filter: aggregation.filter as InboxFilter,
      setFilter: aggregation.setFilter as (filter: InboxFilter) => void,
      refresh,
      markConversationReadOptimistic,
      togglePinOptimistic,
    };
  }

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
    refresh,
    markConversationReadOptimistic,
    togglePinOptimistic,
  };
}
