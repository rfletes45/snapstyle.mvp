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
  applyGroupBackgroundStateToConversation,
  setSessionGroupBackgroundState,
  subscribeToGroupBackgroundState,
} from "@/services/chat/groupBackgroundState";
import {
  applyOptimisticInboxUpdate,
  subscribeToOptimisticInboxUpdates,
  type OptimisticInboxUpdate,
} from "@/services/chat/inboxOptimisticUpdates";
import { compareInboxParity } from "@/services/chat/inboxParityTelemetry";
import {
  getDefaultMemberState,
  RECENTLY_READ_TTL_MS,
  sortInboxConversations,
} from "@/services/chat/normalizeInboxRow";
import { isDMVisible } from "@/services/chatMembers";
import { getFirestoreInstance } from "@/services/firebase";
import { isGroupVisible } from "@/services/groupMembers";
import { InboxConversation, MemberStatePrivate } from "@/types/messaging";
import { createLogger, isDebugEnabled } from "@/utils/log";
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
const shouldLogInboxPerf = () =>
  isDebugEnabled("CHAT") || isDebugEnabled("PERF");

// =============================================================================
// AsyncStorage Cache Keys & Config
// =============================================================================

const INBOX_CACHE_KEY = "@inbox_cache:";
const INBOX_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache validity
const OPTIMISTIC_ACTIVITY_TTL_MS = 60_000;

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
export type InboxFilter = "all" | "unread" | "groups" | "dms" | "archived";

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

  // ── Rendered state ──────────────────────────────────────────────────────
  // These arrays are the source of truth for React rendering.
  // Snapshot handlers NEVER call the setters directly.  Instead they write
  // to the staging refs below and call `commitStagedData()` which pushes
  // both lists to state in a single synchronous call (React 18 batches this
  // into one render, eliminating the mixed-old/new intermediate flashes).
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

  // ── Blocked users tracking ──────────────────────────────────────────
  // Real-time subscription to the current user's blockedUsers subcollection.
  // DM conversations with blocked users are filtered out of the inbox.
  const blockedUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid || useAggregatedInbox) return;
    const db = getFirestoreInstance();
    const blockedRef = collection(db, "Users", uid, "blockedUsers");
    const unsubscribe = onSnapshot(
      blockedRef,
      (snapshot) => {
        const ids = new Set<string>();
        snapshot.docs.forEach((d) => ids.add(d.id));
        blockedUserIdsRef.current = ids;
      },
      (err) => {
        log.warn("Blocked users subscription error", { error: err });
      },
    );
    return unsubscribe;
  }, [uid, useAggregatedInbox]);

  // ── Staging infrastructure ────────────────────────────────────────────
  // Snapshot handlers store processed results HERE first.
  // `commitStagedData` then pushes both to state atomically.
  const dmStagedRef = useRef<InboxConversation[]>([]);
  const groupStagedRef = useRef<InboxConversation[]>([]);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snapshot version tracking: each snapshot callback increments this
  // before starting async work.  When the async work completes it checks
  // that its version is still current – if not, a newer snapshot has
  // already started processing, so the stale result is discarded.
  const dmVersionRef = useRef(0);
  const groupVersionRef = useRef(0);

  // Track if we've loaded cached data (to avoid double-loading)
  const cacheLoadedRef = useRef(false);

  // Track whether both live subscriptions have delivered at least once.
  // This prevents the partial flash where groups appear before DMs.
  // IMPORTANT: Once set to true, never reset — real-time listeners stay
  // active and will automatically push updates without needing a restart.
  const bothLiveReadyRef = useRef(false);
  const dmReadyRef = useRef(false);
  const groupReadyRef = useRef(false);

  // Once we have loaded data (from cache OR live), never show the loading
  // spinner again. This prevents flicker when data refreshes in the background.
  const hasEverLoadedRef = useRef(false);

  // Track recently-read conversation IDs to prevent Firestore snapshots from
  // resetting the optimistic unread state before the watermark write propagates.
  // Entries expire after 30 seconds (more than enough for the write to land).
  const recentlyReadRef = useRef<Map<string, number>>(new Map());
  const optimisticActivityRef = useRef<Map<string, OptimisticInboxUpdate>>(
    new Map(),
  );

  // ── Commit functions ──────────────────────────────────────────────────

  const pruneOptimisticActivity = useCallback(() => {
    const now = Date.now();
    for (const [key, update] of optimisticActivityRef.current) {
      if (now - update.timestamp > OPTIMISTIC_ACTIVITY_TTL_MS) {
        optimisticActivityRef.current.delete(key);
      }
    }
  }, []);

  const applyOptimisticActivity = useCallback(
    (conversations: InboxConversation[]) => {
      pruneOptimisticActivity();
      if (optimisticActivityRef.current.size === 0) return conversations;

      return conversations.map((conversation) => {
        const update = optimisticActivityRef.current.get(
          `${conversation.type}:${conversation.id}`,
        );
        return update
          ? applyOptimisticInboxUpdate(conversation, update, uid)
          : conversation;
      });
    },
    [pruneOptimisticActivity, uid],
  );

  /**
   * Push staged DM + Group data to state in a single synchronous call.
   * React 18 batches both `setState` calls into one render.
   */
  const commitStagedData = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (shouldLogInboxPerf()) {
      log.debug("[sort-pipeline] commitStagedData", {
        data: {
          dmCount: dmStagedRef.current.length,
          groupCount: groupStagedRef.current.length,
        },
      });
    }
    setDmConversations(dmStagedRef.current);
    setGroupConversations(groupStagedRef.current);
  }, []);

  /**
   * Schedule a commit after a short delay to coalesce rapid DM + Group
   * snapshot completions into a single render.
   *
   * @param delayMs – debounce window (default 50 ms ≈ 3 frames).
   *   During the initial load the "other" subscription usually
   *   completes within this window, producing one atomic commit.
   */
  const scheduleCommit = useCallback(
    (delayMs = 50) => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(commitStagedData, delayMs);
    },
    [commitStagedData],
  );

  // Loading: show loading state until we have EITHER cached data OR both live
  // subscriptions have resolved. This prevents a partial list flash where
  // groups appear before DMs or vice versa.
  // Once we've loaded data for the first time, never go back to loading=true.
  const hasCachedData =
    cacheLoadedRef.current &&
    (dmConversations.length > 0 || groupConversations.length > 0);
  if (hasCachedData || bothLiveReadyRef.current) {
    hasEverLoadedRef.current = true;
  }
  const loading =
    !hasEverLoadedRef.current && !hasCachedData && !bothLiveReadyRef.current;

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
        if (shouldLogInboxPerf()) {
          log.debug("[sort-pipeline] Loaded inbox from cache", {
            data: {
              dmCount: cached.dmConversations.length,
              groupCount: cached.groupConversations.length,
            },
          });
        }
        // Populate staging refs AND set state directly (immediate display).
        dmStagedRef.current = cached.dmConversations;
        groupStagedRef.current = cached.groupConversations;
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

  // Optimistically mark a conversation as read in local state.
  // Updates both the staging refs (so the next snapshot commit won't clobber
  // the optimistic state) and React state directly (immediate UI feedback).
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

      const applyRead = (c: InboxConversation): InboxConversation =>
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
          : c;

      // Update DM conversations
      if (!conversationType || conversationType === "dm") {
        dmStagedRef.current = dmStagedRef.current.map(applyRead);
        setDmConversations((prev) => prev.map(applyRead));
      }

      // Update Group conversations
      if (!conversationType || conversationType === "group") {
        groupStagedRef.current = groupStagedRef.current.map(applyRead);
        setGroupConversations((prev) => prev.map(applyRead));
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

      const applyPin = (c: InboxConversation): InboxConversation =>
        c.id === conversationId
          ? {
              ...c,
              memberState: {
                ...c.memberState,
                pinnedAt: c.memberState.pinnedAt ? null : now,
              },
            }
          : c;

      if (!conversationType || conversationType === "dm") {
        dmStagedRef.current = dmStagedRef.current.map(applyPin);
        setDmConversations((prev) => prev.map(applyPin));
      }

      if (!conversationType || conversationType === "group") {
        groupStagedRef.current = groupStagedRef.current.map(applyPin);
        setGroupConversations((prev) => prev.map(applyPin));
      }
    },
    [aggregation, useAggregatedInbox],
  );

  useEffect(() => {
    if (useAggregatedInbox || !uid) return;

    return subscribeToOptimisticInboxUpdates((update) => {
      const key = `${update.scope}:${update.conversationId}`;
      optimisticActivityRef.current.set(key, update);
      pruneOptimisticActivity();

      if (shouldLogInboxPerf()) {
        log.debug("[sort-pipeline] optimistic activity received", {
          data: {
            scope: update.scope,
            conversationId: update.conversationId,
            timestamp: update.timestamp,
          },
        });
      }

      const applyUpdate = (conversation: InboxConversation) =>
        applyOptimisticInboxUpdate(conversation, update, uid);

      if (update.scope === "dm") {
        dmStagedRef.current = dmStagedRef.current.map(applyUpdate);
        setDmConversations((prev) => prev.map(applyUpdate));
      } else {
        groupStagedRef.current = groupStagedRef.current.map(applyUpdate);
        setGroupConversations((prev) => prev.map(applyUpdate));
      }
    });
  }, [pruneOptimisticActivity, uid, useAggregatedInbox]);

  useEffect(() => {
    if (useAggregatedInbox || !uid) return;

    return subscribeToGroupBackgroundState((update) => {
      const applyUpdate = (conversation: InboxConversation) =>
        applyGroupBackgroundStateToConversation(conversation, update);

      groupStagedRef.current = groupStagedRef.current.map(applyUpdate);
      setGroupConversations((prev) => prev.map(applyUpdate));
    });
  }, [uid, useAggregatedInbox]);

  // =============================================================================
  // DM Subscription (OPTIMIZED - Parallel fetching)
  // =============================================================================

  useEffect(() => {
    if (useAggregatedInbox || !uid) {
      setDmLoading(false);
      dmReadyRef.current = true;
      if (groupReadyRef.current) {
        bothLiveReadyRef.current = true;
        commitStagedData();
      }
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
        // Snapshot version: if a newer snapshot fires while this one
        // is still doing async work, the result will be discarded.
        const version = ++dmVersionRef.current;

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

            // Hide conversations with blocked users
            if (blockedUserIdsRef.current.has(otherUserId)) continue;

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
                  lastMessageSenderId: chatData.lastMessageSenderId,
                },
                recentlyReadAt,
                currentUserId: uid,
              }),
            );
          }

          if (!cancelled && version === dmVersionRef.current) {
            dmStagedRef.current = applyOptimisticActivity(conversations);
            setDmLoading(false);
            dmReadyRef.current = true;

            if (groupReadyRef.current) {
              // Both subscriptions ready — commit atomically now.
              bothLiveReadyRef.current = true;
              commitStagedData();
            } else {
              // Groups haven't arrived yet.  Schedule a debounced commit
              // so that if groups follow within the window we get one
              // atomic render.  If groups are slow, this still commits
              // after the timeout so DMs aren't invisible.
              scheduleCommit();
            }

            if (shouldLogInboxPerf()) {
              log.debug("[sort-pipeline] DM snapshot committed", {
                data: {
                  count: conversations.length,
                  version,
                  groupReady: groupReadyRef.current,
                },
              });
            }
          } else if (!cancelled) {
            if (shouldLogInboxPerf()) {
              log.debug("[sort-pipeline] DM snapshot discarded (stale)", {
                data: { version, current: dmVersionRef.current },
              });
            }
          }
        } catch (e) {
          log.error("Error processing DM conversations", { error: e });
          if (!cancelled) {
            setError(e as Error);
            setDmLoading(false);
            dmReadyRef.current = true;
            if (groupReadyRef.current) {
              bothLiveReadyRef.current = true;
              commitStagedData();
            }
          }
        }
      },
      (err) => {
        log.error("DM subscription error", { error: err });
        if (!cancelled) {
          setError(err);
          setDmLoading(false);
          dmReadyRef.current = true;
          if (groupReadyRef.current) {
            bothLiveReadyRef.current = true;
            commitStagedData();
          }
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
      // Clean up any pending commit timer owned by this subscription cycle
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    };
  }, [
    uid,
    useAggregatedInbox,
    commitStagedData,
    scheduleCommit,
    applyOptimisticActivity,
  ]);

  // =============================================================================
  // Group Subscription (OPTIMIZED - Parallel fetching)
  // =============================================================================

  useEffect(() => {
    if (useAggregatedInbox || !uid) {
      setGroupLoading(false);
      groupReadyRef.current = true;
      if (dmReadyRef.current) {
        bothLiveReadyRef.current = true;
        commitStagedData();
      }
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
        // Snapshot version: if a newer snapshot fires while this one
        // is still doing async work, the result will be discarded.
        const version = ++groupVersionRef.current;

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
            setSessionGroupBackgroundState({
              groupId,
              backgroundUrl: groupData.backgroundUrl ?? null,
              source: "use-inbox-data-group-snapshot",
              authority: "authoritative",
            });
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
                  lastMessageSenderId: groupData.lastMessageSenderId,
                  backgroundUrl: groupData.backgroundUrl ?? null,
                },
                memberState,
                recentlyReadAt,
                currentUserId: uid,
              }),
            );
          }

          if (!cancelled && version === groupVersionRef.current) {
            groupStagedRef.current = applyOptimisticActivity(conversations);
            setGroupLoading(false);
            groupReadyRef.current = true;

            if (dmReadyRef.current) {
              // Both subscriptions ready — commit atomically now.
              bothLiveReadyRef.current = true;
              commitStagedData();
            } else {
              scheduleCommit();
            }

            if (shouldLogInboxPerf()) {
              log.debug("[sort-pipeline] Group snapshot committed", {
                data: {
                  count: conversations.length,
                  version,
                  dmReady: dmReadyRef.current,
                },
              });
            }
          } else if (!cancelled) {
            if (shouldLogInboxPerf()) {
              log.debug("[sort-pipeline] Group snapshot discarded (stale)", {
                data: { version, current: groupVersionRef.current },
              });
            }
          }
        } catch (e) {
          log.error("Error processing group conversations", { error: e });
          if (!cancelled) {
            setError(e as Error);
            setGroupLoading(false);
            groupReadyRef.current = true;
            if (dmReadyRef.current) {
              bothLiveReadyRef.current = true;
              commitStagedData();
            }
          }
        }
      },
      (err) => {
        log.error("Group subscription error", { error: err });
        if (!cancelled) {
          setError(err);
          setGroupLoading(false);
          groupReadyRef.current = true;
          if (dmReadyRef.current) {
            bothLiveReadyRef.current = true;
            commitStagedData();
          }
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    uid,
    useAggregatedInbox,
    commitStagedData,
    scheduleCommit,
    applyOptimisticActivity,
  ]);

  // =============================================================================
  // Combined & Filtered List
  // =============================================================================

  // STEP 1: Sort ONCE.  All downstream derivations (filter, pinned, search)
  // are subsets of this single sorted array, so no redundant re-sorts.
  const sortedAll = useMemo(() => {
    const all = [...dmConversations, ...groupConversations];
    return sortInboxConversations(all.filter((c) => !c.memberState.archived));
  }, [dmConversations, groupConversations]);

  // Archived conversations — separate sorted list, only computed when needed.
  const sortedArchived = useMemo(() => {
    if (filter !== "archived") return [];
    const all = [...dmConversations, ...groupConversations];
    return sortInboxConversations(all.filter((c) => c.memberState.archived));
  }, [dmConversations, groupConversations, filter]);

  // STEP 2: Apply the tab filter (subset of the sorted list — order preserved).
  const conversations = useMemo(() => {
    switch (filter) {
      case "unread":
        return sortedAll.filter(
          (c) => c.unreadCount > 0 || c.memberState.lastMarkedUnreadAt,
        );
      case "groups":
        return sortedAll.filter((c) => c.type === "group");
      case "dms":
        return sortedAll.filter((c) => c.type === "dm");
      case "archived":
        return sortedArchived;
      default:
        return sortedAll;
    }
  }, [sortedAll, sortedArchived, filter]);

  // Separate pinned and regular
  const pinnedConversations = useMemo(
    () => conversations.filter((c) => c.memberState.pinnedAt),
    [conversations],
  );

  const regularConversations = useMemo(
    () => conversations.filter((c) => !c.memberState.pinnedAt),
    [conversations],
  );

  // All non-archived conversations (for search - bypasses inbox filter).
  // This IS the pre-sorted `sortedAll` — no extra work needed.
  const allConversations = sortedAll;

  const totalUnread = useMemo(
    () => sortedAll.reduce((sum, c) => sum + c.unreadCount, 0),
    [sortedAll],
  );

  // =============================================================================
  // Commit Timer Cleanup
  // =============================================================================

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    };
  }, []);

  // =============================================================================
  // Dev-Mode Parity Telemetry
  // Shadow-compare fan-out vs aggregated inbox in __DEV__ to detect drift
  // before the CHAT_INBOX_AGGREGATION flag is flipped.
  // =============================================================================

  useEffect(() => {
    if (!__DEV__ || useAggregatedInbox || !isDebugEnabled("PERF")) return;
    if (dmLoading || groupLoading || aggregation.loading) return;
    if (
      allConversations.length === 0 &&
      aggregation.allConversations.length === 0
    )
      return;

    compareInboxParity(allConversations, aggregation.allConversations);
  }, [
    allConversations,
    aggregation.allConversations,
    aggregation.loading,
    dmLoading,
    groupLoading,
    useAggregatedInbox,
  ]);

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
