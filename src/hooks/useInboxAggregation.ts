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
import {
  batchFetchProfiles,
  getCachedProfileSync,
} from "@/services/cache/profileCache";
import {
  applyGroupBackgroundStateToConversation,
  setSessionGroupBackgroundState,
  subscribeToGroupBackgroundState,
} from "@/services/chat/groupBackgroundState";
import {
  getCachedGroupVisuals,
  setCachedGroupVisuals,
  type GroupVisuals,
} from "@/services/chat/groupVisualCache";
import {
  describeRemoteUrlForLog,
  rememberPreparedGroupChatData,
  traceGroupWallpaper,
} from "@/services/chat/groupWallpaperDebug";
import {
  applyOptimisticInboxUpdate,
  getPersistedLocalInboxUpdates,
  subscribeToOptimisticInboxUpdates,
  type OptimisticInboxUpdate,
} from "@/services/chat/inboxOptimisticUpdates";
import {
  getDefaultMemberState,
  normalizeInboxTimestamp,
  normalizeConversationFromInboxEntry,
  RECENTLY_READ_TTL_MS,
  sortInboxConversations,
} from "@/services/chat/normalizeInboxRow";
import { isDMVisible } from "@/services/chatMembers";
import { getFirestoreInstance } from "@/services/firebase";
import { isGroupVisible } from "@/services/groupMembers";
import { subscribeSyncState } from "@/services/sync/syncEngine";
import {
  InboxConversation,
  InboxEntry,
  MemberStatePrivate,
} from "@/types/messaging";
import { createLogger, isDebugEnabled } from "@/utils/log";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
const shouldLogInboxPerf = () =>
  isDebugEnabled("CHAT") || isDebugEnabled("PERF");

// =============================================================================
// AsyncStorage Cold-Start Cache
// =============================================================================

const AGG_CACHE_KEY = "@agg_inbox_cache:";
const AGG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const OPTIMISTIC_ACTIVITY_TTL_MS = 60_000;

interface AggCacheData {
  conversations: InboxConversation[];
  timestamp: number;
}

async function loadAggCache(uid: string): Promise<AggCacheData | null> {
  try {
    const raw = await AsyncStorage.getItem(`${AGG_CACHE_KEY}${uid}`);
    if (raw) {
      const data = JSON.parse(raw) as AggCacheData;
      if (Date.now() - data.timestamp < AGG_CACHE_TTL) return data;
    }
  } catch {
    // non-critical
  }
  return null;
}

async function saveAggCache(
  uid: string,
  conversations: InboxConversation[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${AGG_CACHE_KEY}${uid}`,
      JSON.stringify({ conversations, timestamp: Date.now() } as AggCacheData),
    );
  } catch {
    // non-critical
  }
}

// =============================================================================
// Types
// =============================================================================

type InboxFilter =
  | "all"
  | "dms"
  | "groups"
  | "unread"
  | "requests"
  | "archived";

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
  togglePinOptimistic: (
    conversationId: string,
    conversationType?: "dm" | "group",
  ) => void;
}

// =============================================================================
// Helpers
// =============================================================================

function toMillisLike(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return normalizeInboxTimestamp(
    value as Parameters<typeof normalizeInboxTimestamp>[0],
  );
}

/**
 * Build MemberStatePrivate from the Inbox entry's synced fields.
 * Returns null if the entry is missing lastSeenAtPrivate (pre-sync entry),
 * signalling the caller should fall back to a MembersPrivate fetch.
 */
function buildMemberStateFromEntry(
  uid: string,
  entry: InboxEntry,
): MemberStatePrivate | null {
  // If lastSeenAtPrivate has never been synced to this Inbox doc,
  // we can't compute unread correctly — fall back to MembersPrivate.
  if (entry.lastSeenAtPrivate == null) return null;

  return {
    uid,
    archived: entry.archived ?? false,
    mutedUntil: toMillisLike(entry.mutedUntil) ?? null,
    notifyLevel: entry.notifyLevel ?? "all",
    sendReadReceipts: true, // Not synced — default is fine for inbox display
    lastSeenAtPrivate: toMillisLike(entry.lastSeenAtPrivate) ?? 0,
    lastMarkedUnreadAt: toMillisLike(entry.lastMarkedUnreadAt) ?? undefined,
    pinnedAt: toMillisLike(entry.pinnedAt) ?? null,
    deletedAt: toMillisLike(entry.deletedAt) ?? null,
    hiddenUntilNewMessage: entry.hiddenUntilNewMessage ?? false,
    showMemberChatStyles: true, // Not synced — not needed for inbox display
  };
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
        pinnedAt: toMillisLike(entry.pinnedAt) ?? null,
        mutedUntil: toMillisLike(entry.mutedUntil) ?? null,
      };
    }
    const data = snap.data();
    return {
      uid,
      archived: data.archived ?? entry.archived ?? false,
      mutedUntil:
        toMillisLike(data.mutedUntil) ?? toMillisLike(entry.mutedUntil) ?? null,
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
      data: {
        conversationId: entry.conversationId,
        scope: entry.scope,
        error: e,
      },
    });
    return {
      ...getDefaultMemberState(uid),
      archived: entry.archived ?? false,
      notifyLevel: entry.notifyLevel ?? "all",
      pinnedAt: toMillisLike(entry.pinnedAt) ?? null,
      mutedUntil: toMillisLike(entry.mutedUntil) ?? null,
      deletedAt: toMillisLike(entry.deletedAt) ?? null,
      hiddenUntilNewMessage: entry.hiddenUntilNewMessage ?? false,
    };
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
  const optimisticActivityRef = useRef<Map<string, OptimisticInboxUpdate>>(
    new Map(),
  );
  const persistedActivityKeysRef = useRef<Set<string>>(new Set());
  // Keep the expensive shadow aggregation path opt-in. The active production
  // path is controlled by CHAT_INBOX_AGGREGATION; PERF can temporarily enable
  // it for diagnostics when fan-out is active.
  const enabled =
    CHAT_FEATURES.CHAT_INBOX_AGGREGATION || isDebugEnabled("PERF");

  // ── Blocked users tracking ──────────────────────────────────────────
  const blockedUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid || !enabled) return;
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
        log.warn("Blocked users subscription error (agg)", { error: err });
      },
    );
    return unsubscribe;
  }, [uid, enabled]);

  const pruneOptimisticActivity = useCallback(() => {
    const now = Date.now();
    for (const [key, update] of optimisticActivityRef.current) {
      if (update.persisted) continue;
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

  const refreshPersistedLocalActivity = useCallback(() => {
    if (!uid || !enabled) return;

    for (const key of persistedActivityKeysRef.current) {
      optimisticActivityRef.current.delete(key);
    }

    const nextKeys = new Set<string>();
    for (const update of getPersistedLocalInboxUpdates()) {
      const key = `${update.scope}:${update.conversationId}`;
      nextKeys.add(key);
      optimisticActivityRef.current.set(key, update);
    }
    persistedActivityKeysRef.current = nextKeys;
    pruneOptimisticActivity();

    setEntries((prev) => sortInboxConversations(applyOptimisticActivity(prev)));
  }, [applyOptimisticActivity, enabled, pruneOptimisticActivity, uid]);

  useEffect(() => {
    if (!uid || !enabled) return;
    refreshPersistedLocalActivity();
    return subscribeSyncState(() => {
      refreshPersistedLocalActivity();
    });
  }, [enabled, refreshPersistedLocalActivity, uid]);

  useEffect(() => {
    if (!uid || !enabled) return;

    return subscribeToOptimisticInboxUpdates((update) => {
      const key = `${update.scope}:${update.conversationId}`;
      optimisticActivityRef.current.set(key, update);
      pruneOptimisticActivity();

      if (shouldLogInboxPerf()) {
        log.debug("optimistic activity received", {
          data: {
            scope: update.scope,
            conversationId: update.conversationId,
            timestamp: update.timestamp,
          },
        });
      }

      setEntries((prev) =>
        sortInboxConversations(
          prev.map((conversation) =>
            applyOptimisticInboxUpdate(conversation, update, uid),
          ),
        ),
      );
    });
  }, [enabled, pruneOptimisticActivity, uid]);

  useEffect(() => {
    if (!uid || !enabled) return;

    return subscribeToGroupBackgroundState((update) => {
      setEntries((prev) =>
        prev.map((conversation) =>
          applyGroupBackgroundStateToConversation(conversation, update),
        ),
      );
    });
  }, [enabled, uid]);

  // -------------------------------------------------------
  // Subscribe to Users/{uid}/Inbox ordered by lastActivityAt
  // -------------------------------------------------------
  useEffect(() => {
    if (!uid || !enabled) {
      setLoading(false);
      return;
    }

    let isCancelled = false;

    // Load cold-start cache for instant render
    loadAggCache(uid).then((cached) => {
      if (cached && !isCancelled) {
        setEntries(cached.conversations);
        setLoading(false);
      }
    });

    const db = getFirestoreInstance();
    const inboxRef = collection(db, "Users", uid, "Inbox");
    const q = query(inboxRef, orderBy("lastActivityAt", "desc"));
    if (shouldLogInboxPerf()) {
      log.debug("inbox listener attached", { data: { uid } });
    }

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const startedAt = performance.now();
        let memberFallbackReads = 0;
        let groupVisualFetches = 0;
        try {
          // Convert Firestore Timestamps to millis at the boundary so
          // all downstream code sees plain numbers.
          const inboxEntries = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              ...data,
              lastActivityAt: toMillisLike(data.lastActivityAt) ?? 0,
            } as InboxEntry;
          });

          // ── Member state hydration ──
          // Try to build MemberStatePrivate from Inbox entry fields first
          // (zero Firestore reads). Fall back to MembersPrivate fetch for
          // entries that haven't had their read watermark synced yet.
          const memberStates = await Promise.all(
            inboxEntries.map((entry) => {
              const fromEntry = buildMemberStateFromEntry(uid, entry);
              if (fromEntry) return Promise.resolve(fromEntry);
              memberFallbackReads += 1;
              return getMemberPrivateStateForEntry(uid, entry);
            }),
          );

          // ── Visibility filtering (Blocker #1) ──
          const visibleEntries: {
            entry: InboxEntry;
            state: MemberStatePrivate;
          }[] = [];
          for (let i = 0; i < inboxEntries.length; i++) {
            const entry = inboxEntries[i];
            const state = memberStates[i] || getDefaultMemberState(uid);
            if (entry.scope === "dm" && !isDMVisible(state)) continue;
            if (entry.scope === "group" && !isGroupVisible(state)) continue;
            // Hide DM conversations with blocked users
            if (
              entry.scope === "dm" &&
              entry.otherUserId &&
              blockedUserIdsRef.current.has(entry.otherUserId)
            )
              continue;
            visibleEntries.push({ entry, state });
          }

          // ── Avatar / profile hydration (Blocker #2) ──
          // DM: batch-fetch user profiles for avatar + profilePicture
          const dmOtherUids = visibleEntries
            .filter((v) => v.entry.scope === "dm" && v.entry.otherUserId)
            .map((v) => v.entry.otherUserId!);
          if (dmOtherUids.length > 0) {
            await batchFetchProfiles(dmOtherUids);
          }

          // Group: fetch Group docs in parallel for avatar + background visual data
          const groupEntryIds = visibleEntries
            .filter((v) => v.entry.scope === "group")
            .map((v) => v.entry.conversationId);
          const groupVisualsMap = new Map<string, GroupVisuals>();
          const groupVisualSourceMap = new Map<string, "cache" | "fetch">();
          if (groupEntryIds.length > 0) {
            const groupIdsToFetch: string[] = [];
            for (const groupId of groupEntryIds) {
              const cached = getCachedGroupVisuals(groupId);
              if (cached) {
                groupVisualsMap.set(groupId, cached);
                groupVisualSourceMap.set(groupId, "cache");
              } else {
                groupIdsToFetch.push(groupId);
              }
            }
            groupVisualFetches = groupIdsToFetch.length;
            await Promise.all(
              groupIdsToFetch.map(async (groupId) => {
                try {
                  const groupSnap = await getDoc(doc(db, "Groups", groupId));
                  if (groupSnap.exists()) {
                    const visuals = setCachedGroupVisuals(groupId, {
                      avatarUrl: groupSnap.data()?.avatarUrl || null,
                      backgroundUrl: groupSnap.data()?.backgroundUrl || null,
                    });
                    if (visuals) {
                      groupVisualsMap.set(groupId, visuals);
                      groupVisualSourceMap.set(groupId, "fetch");
                    }
                  }
                } catch {
                  // non-critical — group will show generic icon
                }
              }),
            );
          }

          const convos = visibleEntries.map(({ entry, state }) => {
            const convo = normalizeConversationFromInboxEntry(
              entry,
              state,
              recentlyReadRef.current.get(entry.conversationId),
              uid,
            );

            // Hydrate DM avatar fields from profile cache
            if (entry.scope === "dm" && entry.otherUserId) {
              const cached = getCachedProfileSync(entry.otherUserId);
              if (cached) {
                convo.avatarUrl = cached.avatar ?? null;
                convo.avatarConfig = cached.avatarConfig;
                convo.profilePictureUrl = cached.profilePictureUrl ?? null;
                convo.decorationId = cached.decorationId ?? null;
              }
            }

            // Hydrate group avatar from fetched Group doc
            if (entry.scope === "group") {
              const visuals = groupVisualsMap.get(entry.conversationId);
              const visualsSource = groupVisualSourceMap.get(
                entry.conversationId,
              );
              const entryBackgroundUrl = convo.backgroundUrl ?? null;
              convo.avatarUrl = visuals?.avatarUrl ?? null;
              convo.backgroundUrl = visuals ? visuals.backgroundUrl : null;

              if (__DEV__) {
                traceGroupWallpaper(
                  entry.conversationId,
                  "use-inbox-aggregation-group-background-proposal",
                  {
                    visualsSource: visualsSource ?? "none",
                    visualsPresent: !!visuals,
                    entryBackgroundKey:
                      describeRemoteUrlForLog(entryBackgroundUrl).key,
                    visualsBackgroundKey: describeRemoteUrlForLog(
                      visuals?.backgroundUrl,
                    ).key,
                    acceptedBackgroundKey: describeRemoteUrlForLog(
                      convo.backgroundUrl,
                    ).key,
                    staleHelperBlocked:
                      !!entryBackgroundUrl &&
                      entryBackgroundUrl !== convo.backgroundUrl,
                  },
                );
              }

              if (visuals) {
                setSessionGroupBackgroundState({
                  groupId: entry.conversationId,
                  backgroundUrl: visuals.backgroundUrl,
                  source:
                    visualsSource === "cache"
                      ? "use-inbox-aggregation-group-visual-cache"
                      : "use-inbox-aggregation-group-doc",
                  authority: "authoritative",
                });
              }

              rememberPreparedGroupChatData(
                entry.conversationId,
                {
                  name: convo.name,
                  avatarUrl: visuals?.avatarUrl ?? null,
                  backgroundUrl: convo.backgroundUrl,
                },
                visualsSource === "cache"
                  ? "use-inbox-aggregation-group-visual-cache"
                  : visualsSource === "fetch"
                    ? "use-inbox-aggregation-group-doc"
                    : "use-inbox-aggregation-no-authoritative-background",
              );
            }

            return convo;
          });

          const sorted = sortInboxConversations(
            applyOptimisticActivity(convos),
          );
          if (!isCancelled) {
            setEntries(sorted);
            setError(null);
            // Persist for cold-start
            saveAggCache(uid, sorted);
            if (shouldLogInboxPerf()) {
              log.debug("inbox snapshot processed", {
                data: {
                  entryCount: inboxEntries.length,
                  visibleCount: visibleEntries.length,
                  memberFallbackReads,
                  groupVisualFetches,
                  durationMs: Math.round(performance.now() - startedAt),
                },
              });
            }
          }
        } catch (e) {
          log.error("Error processing inbox snapshot", { data: { error: e } });
          if (!isCancelled) {
            setError(e instanceof Error ? e : new Error(String(e)));
          }
        } finally {
          if (!isCancelled) setLoading(false);
        }
      },
      (err) => {
        log.error("Inbox snapshot error", { data: { error: err } });
        if (!isCancelled) {
          setError(err);
          setLoading(false);
        }
      },
    );

    return () => {
      isCancelled = true;
      unsub();
      if (shouldLogInboxPerf()) {
        log.debug("inbox listener detached", { data: { uid } });
      }
    };
  }, [uid, enabled, refreshKey, applyOptimisticActivity]);

  // -------------------------------------------------------
  // Memoised derived lists
  // -------------------------------------------------------

  const allConversations = useMemo(() => {
    if (!enabled) return [];
    return entries;
  }, [entries, enabled]);

  const conversations = useMemo(() => {
    const isArchivedFilter = filter === "archived";
    let list =
      isArchivedFilter || showArchived
        ? allConversations.filter((c) => c.memberState.archived)
        : allConversations.filter((c) => !c.memberState.archived);

    if (filter === "dms") list = list.filter((c) => c.type === "dm");
    else if (filter === "groups") list = list.filter((c) => c.type === "group");
    else if (filter === "unread") list = list.filter((c) => c.unreadCount > 0);
    // "requests" and "archived" are handled by the archive/show toggle above.

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

  const togglePinOptimistic = useCallback(
    (conversationId: string, conversationType?: "dm" | "group") => {
      const now = Date.now();
      setEntries((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          if (conversationType && conversation.type !== conversationType) {
            return conversation;
          }
          return {
            ...conversation,
            memberState: {
              ...conversation.memberState,
              pinnedAt: conversation.memberState.pinnedAt ? null : now,
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
    togglePinOptimistic,
  };
}
