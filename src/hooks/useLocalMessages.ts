/**
 * useLocalMessages Hook
 *
 * React hook for accessing locally-stored messages.
 * Provides real-time updates when messages change in SQLite.
 *
 * @file src/hooks/useLocalMessages.ts
 */

import { USE_LOCAL_STORAGE } from "@/constants/featureFlags";
import {
  getOrCreateDMConversation,
  getOrCreateGroupConversation,
} from "@/services/database/conversationRepository";
import {
  getMessagesByStatus,
  getMessagesForConversation,
  getMessageWindowAroundMessage,
  MessageWithAttachments,
} from "@/services/database/messageRepository";
import {
  fullSyncConversation,
  subscribeToConversation,
  syncOlderMessages,
} from "@/services/sync/syncEngine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useLocalMessages");
// =============================================================================
// Types
// =============================================================================

export interface UseLocalMessagesOptions {
  /**
   * Conversation ID to load messages for
   */
  conversationId: string;

  /**
   * Scope: "dm" or "group"
   */
  scope: "dm" | "group";

  /**
   * Number of messages to load initially
   * @default 50
   */
  initialLimit?: number;

  /**
   * Enable automatic refresh on focus
   * @default true
   */
  autoRefresh?: boolean;
}

export interface UseLocalMessagesReturn {
  /**
   * Array of messages with attachments
   */
  messages: MessageWithAttachments[];

  /**
   * Loading state
   */
  isLoading: boolean;

  /**
   * Whether an older-message batch is currently being fetched from the server.
   * Used by the UI to show a loading indicator at the oldest loaded edge.
   */
  isLoadingOlder: boolean;

  /**
   * Error state
   */
  error: string | null;

  /**
   * Number of pending (unsent) messages
   */
  pendingCount: number;

  /**
   * Number of failed messages
   */
  failedCount: number;

  /**
   * Refresh messages from database
   */
  refresh: () => void;

  /**
   * Prepend a newly-created message row to the in-memory list without
   * re-reading the entire conversation from SQLite.  This gives the
   * FlatList the new item immediately (sub-ms) and avoids rebuilding
   * every existing message object reference.
   */
  prependMessage: (msg: MessageWithAttachments) => void;

  /**
   * Load more (older) messages
   */
  loadMore: () => void;

  /**
   * Replace the latest-page view with a bounded window around a target
   * message that already exists in local storage.
   */
  loadAroundMessage: (messageId: string) => boolean;

  /**
   * Return from an anchored message window back to the latest page.
   */
  clearMessageAnchor: () => void;

  /**
   * Whether there are more messages to load
   */
  hasMore: boolean;

  /**
   * Whether the hook is currently rendering an anchored target-message window.
   */
  isMessageAnchorActive: boolean;
}

interface MessageAnchorState {
  targetMessageId: string;
  olderLimit: number;
  newerLimit: number;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for accessing locally-stored messages
 *
 * @example
 * ```tsx
 * const { messages, isLoading, refresh, pendingCount } = useLocalMessages({
 *   conversationId: chatId,
 *   scope: "dm",
 * });
 *
 * return (
 *   <FlatList
 *     data={messages}
 *     renderItem={({ item }) => <MessageBubble message={item} />}
 *     ListHeaderComponent={pendingCount > 0 && <Text>Sending...</Text>}
 *   />
 * );
 * ```
 */
// Page size for loading older messages — intentionally larger than
// initialLimit so pagination feels responsive.
const PAGE_SIZE = 75;

// Minimum time (ms) the loading indicator stays visible to prevent flicker.
const MIN_LOADING_INDICATOR_MS = 300;

export function useLocalMessages(
  options: UseLocalMessagesOptions,
): UseLocalMessagesReturn {
  const {
    conversationId,
    scope,
    initialLimit = 50,
    autoRefresh = true,
  } = options;

  // OPTIMIZATION: Initialize state synchronously from SQLite
  // This eliminates the loading flicker by reading cached data immediately
  const initialState = useMemo(() => {
    if (!USE_LOCAL_STORAGE || !conversationId) {
      return { messages: [], hasMore: true };
    }
    try {
      // Ensure conversation exists (synchronous)
      if (scope === "dm") {
        getOrCreateDMConversation(conversationId);
      } else {
        getOrCreateGroupConversation(conversationId, "");
      }
      // Synchronous SQLite read - instant!
      const cached = getMessagesForConversation(
        conversationId,
        scope,
        initialLimit,
      );
      return {
        messages: cached,
        hasMore: cached.length >= initialLimit,
      };
    } catch (err) {
      logger.warn("[useLocalMessages] Initial sync read failed:", err);
      return { messages: [], hasMore: true };
    }
  }, [conversationId, scope, initialLimit]);
  const shouldShowLoadingOnBootstrap = initialState.messages.length === 0;

  // Start with cached data - NO loading state if we have data
  const [messages, setMessages] = useState<MessageWithAttachments[]>(
    initialState.messages,
  );
  const [isLoading, setIsLoading] = useState(
    initialState.messages.length === 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [currentLimit, setCurrentLimit] = useState(initialLimit);
  const [hasMore, setHasMore] = useState(initialState.hasMore);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [messageAnchor, setMessageAnchor] = useState<MessageAnchorState | null>(
    null,
  );
  // Synchronous mirror of `messageAnchor`.  The subscription callback below
  // captures `loadMessages` at subscribe time, which in turn closes over the
  // React state `messageAnchor`.  A snapshot arriving BEFORE React commits a
  // fresh `loadAroundMessage()` state update would otherwise read the stale
  // `messageAnchor === null` closure and overwrite the anchor window with
  // the latest-N page.  Reading from this ref inside `loadMessages` removes
  // that race entirely because we update the ref synchronously in
  // `loadAroundMessage()` and `clearMessageAnchor()`.
  const messageAnchorRef = useRef<MessageAnchorState | null>(null);
  // True while a deep-jump anchor commit is in flight.  Subscription
  // callbacks skip re-reads during this window so the list cannot flash
  // back to the latest page between `loadAroundMessage()` and the first
  // React commit that settles the new window.
  const isAnchoringRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const hasSyncedRef = useRef(false);
  const latestLimitRef = useRef(initialLimit);

  // When true, the subscription callback skips re-reading messages from SQLite.
  // This prevents intermediate/stale re-reads while a pagination batch is being
  // synced from Firestore — the loadMore callback handles the final batch commit.
  const isPaginatingRef = useRef(false);

  // Track whether Firestore has confirmed no more older messages exist.
  // This prevents loadMessages() from prematurely closing pagination based
  // on SQLite row count alone — only an explicit Firestore exhaustion can
  // set hasMore to false.
  const firestoreExhaustedRef = useRef(false);

  const updateStatusCounts = useCallback(
    (loadedMessages: MessageWithAttachments[]) => {
      const pending = loadedMessages.filter(
        (m: MessageWithAttachments) => m.sync_status === "pending",
      ).length;
      const failed = loadedMessages.filter(
        (m: MessageWithAttachments) => m.sync_status === "failed",
      ).length;

      setPendingCount(pending);
      setFailedCount(failed);
    },
    [],
  );

  // Reset per-conversation state when route params change so pagination,
  // sync bootstrap, and visible rows never bleed across threads.
  useEffect(() => {
    hasSyncedRef.current = false;
    firestoreExhaustedRef.current = false;
    isPaginatingRef.current = false;
    isAnchoringRef.current = false;
    messageAnchorRef.current = null;
    setCurrentLimit(initialLimit);
    setMessages(initialState.messages);
    setHasMore(initialState.hasMore);
    setIsLoading(initialState.messages.length === 0);
    setIsLoadingOlder(false);
    setError(null);
    setMessageAnchor(null);
    latestLimitRef.current = initialLimit;
    updateStatusCounts(initialState.messages);
  }, [conversationId, scope, initialLimit, initialState, updateStatusCounts]);

  // Load messages from SQLite
  const loadMessages = useCallback(() => {
    if (!USE_LOCAL_STORAGE) {
      setIsLoading(false);
      return;
    }

    try {
      // Prefer the synchronous ref over React state so that subscription
      // callbacks triggered during the commit window of loadAroundMessage()
      // still see the active anchor.
      const activeAnchor = messageAnchorRef.current ?? messageAnchor;
      if (activeAnchor) {
        const window = getMessageWindowAroundMessage(
          conversationId,
          scope,
          activeAnchor.targetMessageId,
          activeAnchor.olderLimit,
          activeAnchor.newerLimit,
        );

        if (window) {
          setMessages(window.messages);
          setHasMore(window.hasOlder);
          setError(null);
          updateStatusCounts(window.messages);
          return;
        }

        messageAnchorRef.current = null;
        setMessageAnchor(null);
      }

      const loadedMessages = getMessagesForConversation(
        conversationId,
        scope,
        currentLimit,
      );

      setMessages(loadedMessages);
      // Do NOT set hasMore here — only loadMore() should control pagination
      // state via explicit Firestore confirmation. Setting hasMore based on
      // SQLite row count caused premature cutoffs when a partial page from
      // syncOlderMessages left the count below currentLimit.
      // Exception: on first load (limit = initialLimit), use the heuristic
      // to avoid unnecessary loadMore attempts on short conversations.
      if (!firestoreExhaustedRef.current && currentLimit === initialLimit) {
        setHasMore(loadedMessages.length >= currentLimit);
      }
      setError(null);
      updateStatusCounts(loadedMessages);
    } catch (err: any) {
      logger.error("[useLocalMessages] Failed to load messages:", err);
      setError(err.message || "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [
    conversationId,
    scope,
    currentLimit,
    initialLimit,
    messageAnchor,
    updateStatusCounts,
  ]);

  const loadMessagesRef = useRef(loadMessages);

  useEffect(() => {
    loadMessagesRef.current = loadMessages;
  }, [loadMessages]);

  // Initial load + sync from Firestore
  useEffect(() => {
    if (!USE_LOCAL_STORAGE || !conversationId) {
      setIsLoading(false);
      return;
    }

    // Skip conversation creation here - already done in initialState useMemo

    // Only show loading if we have no cached data
    // (initialState already loaded synchronously)
    if (shouldShowLoadingOnBootstrap) {
      setIsLoading(true);
      loadMessagesRef.current();
    }

    let isCancelled = false;
    let localUnsubscribe: (() => void) | null = null;

    const attachRealtime = () => {
      if (isCancelled || !autoRefresh || localUnsubscribe) return;
      localUnsubscribe = subscribeToConversation(
        scope,
        conversationId,
        () => {
          // Skip re-reads while a pagination batch is being synced from
          // Firestore. The loadMore callback will commit the full batch
          // itself once the sync completes, preventing intermediate/stale
          // re-reads from overwriting the visible timeline.
          if (isPaginatingRef.current) return;
          // Skip re-reads while a deep-jump anchor commit is in flight.
          // Without this, a Firestore snapshot that fires between the
          // synchronous `setMessageAnchor()` call and its React commit
          // would capture a stale `loadMessages` closure whose anchor is
          // still `null` and flash the latest-N page over the anchor
          // window.
          if (isAnchoringRef.current) return;
          // Reload messages when new ones arrive from server
          loadMessagesRef.current();
        },
      );
      unsubscribeRef.current = localUnsubscribe;
    };

    const bootstrap = async () => {
      if (!hasSyncedRef.current) {
        hasSyncedRef.current = true;
        try {
          const count = await fullSyncConversation(
            scope,
            conversationId,
            initialLimit,
          );
          if (!isCancelled) {
            logger.info(
              `[useLocalMessages] Synced ${count} messages from server`,
            );
            // Reload after sync completes
            loadMessagesRef.current();
          }
        } catch (err) {
          logger.error("[useLocalMessages] Initial sync failed:", err);
        }
      }

      attachRealtime();
    };

    void bootstrap();

    return () => {
      isCancelled = true;
      const toCleanup = localUnsubscribe;
      if (toCleanup) {
        toCleanup();
        if (unsubscribeRef.current === toCleanup) {
          unsubscribeRef.current = null;
        }
        localUnsubscribe = null;
      }
    };
  }, [
    conversationId,
    scope,
    initialLimit,
    autoRefresh,
    shouldShowLoadingOnBootstrap,
  ]);

  // Refresh function
  const refresh = useCallback(() => {
    loadMessages();
  }, [loadMessages]);

  const loadAroundMessage = useCallback(
    (messageId: string) => {
      if (!USE_LOCAL_STORAGE || !conversationId) return false;

      const windowSize = Math.max(initialLimit, 30);
      const nextAnchor: MessageAnchorState = {
        targetMessageId: messageId,
        olderLimit: windowSize,
        newerLimit: windowSize,
      };

      const window = getMessageWindowAroundMessage(
        conversationId,
        scope,
        messageId,
        nextAnchor.olderLimit,
        nextAnchor.newerLimit,
      );

      if (!window) {
        return false;
      }

      // Update the synchronous mirror BEFORE any React state write so that
      // a subscription snapshot arriving during the React commit window
      // still observes the active anchor via `messageAnchorRef`.
      messageAnchorRef.current = nextAnchor;
      isAnchoringRef.current = true;

      latestLimitRef.current = currentLimit;
      setMessageAnchor(nextAnchor);
      setMessages(window.messages);
      setHasMore(window.hasOlder);
      setError(null);
      updateStatusCounts(window.messages);

      // Release the in-flight anchor guard after the next tick so that
      // state updates flush and subscription callbacks resume normal
      // anchor-aware re-reads.
      setTimeout(() => {
        isAnchoringRef.current = false;
      }, 0);
      return true;
    },
    [conversationId, currentLimit, initialLimit, scope, updateStatusCounts],
  );

  const clearMessageAnchor = useCallback(() => {
    if (!messageAnchor) return;

    // Keep the synchronous mirror in step with React state.
    messageAnchorRef.current = null;
    setMessageAnchor(null);
    setCurrentLimit(latestLimitRef.current);

    const latestMessages = getMessagesForConversation(
      conversationId,
      scope,
      latestLimitRef.current,
    );
    setMessages(latestMessages);
    // Only close pagination if Firestore explicitly said no more exist
    if (firestoreExhaustedRef.current) {
      setHasMore(false);
    } else {
      setHasMore(latestMessages.length >= latestLimitRef.current);
    }
    setError(null);
    updateStatusCounts(latestMessages);
  }, [conversationId, messageAnchor, scope, updateStatusCounts]);

  // Prepend a single message without full reload
  const prependMessage = useCallback((msg: MessageWithAttachments) => {
    setMessages((prev) => {
      // Dedup: if already present, skip
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [msg, ...prev];
    });
    // Update pending count inline for the new pending message
    if (msg.sync_status === "pending") {
      setPendingCount((c) => c + 1);
    }
  }, []);

  // Load more function — increases local limit, and when SQLite is exhausted,
  // fetches older messages from Firestore into the local cache.
  //
  // Pagination guard: while a Firestore sync is in progress, the subscription
  // callback is suppressed (via isPaginatingRef) to prevent intermediate state
  // updates. The full batch is committed to visible state once the sync
  // completes, ensuring messages appear together rather than one-by-one.
  const isSyncingOlderRef = useRef(false);

  const loadMore = useCallback(() => {
    if (
      !hasMore ||
      firestoreExhaustedRef.current ||
      !USE_LOCAL_STORAGE ||
      isSyncingOlderRef.current ||
      isPaginatingRef.current
    )
      return;

    // Show loading indicator immediately for ALL paths (local + remote).
    // The subscription pre-populates SQLite with all history, so the local
    // branch is the common case — without this, the indicator never appears.
    setIsLoadingOlder(true);
    const loadingStartedAt = Date.now();

    // Enforce a minimum display time so the indicator doesn't flash away
    // before the user notices it (covers fast SQLite reads and cached
    // Firestore responses).
    const clearLoadingWithMinTime = () => {
      const elapsed = Date.now() - loadingStartedAt;
      const remaining = Math.max(0, MIN_LOADING_INDICATOR_MS - elapsed);
      if (remaining > 0) {
        setTimeout(() => setIsLoadingOlder(false), remaining);
      } else {
        setIsLoadingOlder(false);
      }
    };

    if (messageAnchor) {
      const nextOlderLimit = messageAnchor.olderLimit + PAGE_SIZE;
      const currentWindow = getMessageWindowAroundMessage(
        conversationId,
        scope,
        messageAnchor.targetMessageId,
        nextOlderLimit,
        messageAnchor.newerLimit,
      );

      if (!currentWindow) {
        firestoreExhaustedRef.current = true;
        setHasMore(false);
        clearLoadingWithMinTime();
        return;
      }

      if (
        currentWindow.olderCount < nextOlderLimit &&
        !isSyncingOlderRef.current
      ) {
        isSyncingOlderRef.current = true;
        isPaginatingRef.current = true;
        // Use created_at for pagination cursor (consistent with SQLite order).
        const oldest =
          currentWindow.messages.length > 0
            ? currentWindow.messages[currentWindow.messages.length - 1]
            : null;
        const oldestTimestamp =
          oldest?.created_at || oldest?.server_received_at || Date.now();

        logger.info("[useLocalMessages] loadMore(anchor): syncing older", {
          oldestTimestamp,
          currentOlderCount: currentWindow.olderCount,
          nextOlderLimit,
        });

        syncOlderMessages(scope, conversationId, oldestTimestamp, PAGE_SIZE)
          .then((count) => {
            logger.info("[useLocalMessages] loadMore(anchor): sync returned", {
              count,
            });
            if (count === 0) {
              // Firestore confirmed: no more messages
              firestoreExhaustedRef.current = true;
              setHasMore(false);
            } else if (count < PAGE_SIZE) {
              // Partial page: this is the last page of history
              firestoreExhaustedRef.current = true;
              setMessageAnchor((prev) =>
                prev ? { ...prev, olderLimit: nextOlderLimit } : prev,
              );
              // Allow showing the partial page, but mark as exhausted
              setHasMore(false);
            } else {
              // Full page: more likely exists
              setMessageAnchor((prev) =>
                prev ? { ...prev, olderLimit: nextOlderLimit } : prev,
              );
            }
            // Reload the anchor window so newly-synced older messages appear
            if (count > 0 && messageAnchor) {
              const updatedWindow = getMessageWindowAroundMessage(
                conversationId,
                scope,
                messageAnchor.targetMessageId,
                nextOlderLimit,
                messageAnchor.newerLimit,
              );
              if (updatedWindow) {
                setMessages(updatedWindow.messages);
                setHasMore(updatedWindow.hasOlder);
                updateStatusCounts(updatedWindow.messages);
              }
            }
          })
          .catch((err) => {
            logger.warn("[useLocalMessages] syncOlderMessages failed:", err);
          })
          .finally(() => {
            isSyncingOlderRef.current = false;
            isPaginatingRef.current = false;
            clearLoadingWithMinTime();
          });
      } else {
        setMessageAnchor((prev) =>
          prev
            ? {
                ...prev,
                olderLimit: nextOlderLimit,
              }
            : prev,
        );
        // Display the expanded window — defer so loading indicator renders
        setTimeout(() => {
          setMessages(currentWindow.messages);
          setHasMore(currentWindow.hasOlder);
          updateStatusCounts(currentWindow.messages);
          clearLoadingWithMinTime();
        }, 0);
      }
      return;
    }

    const nextLimit = currentLimit + PAGE_SIZE;
    // Peek at how many messages SQLite actually has right now
    const currentMessages = getMessagesForConversation(
      conversationId,
      scope,
      nextLimit,
    );

    if (currentMessages.length < nextLimit) {
      // SQLite doesn't have enough messages — fetch from Firestore.
      // Set pagination guard so the subscription callback doesn't cause
      // intermediate re-reads while the batch is being synced.
      isSyncingOlderRef.current = true;
      isPaginatingRef.current = true;
      // Use created_at for pagination cursor (matches local timeline order).
      const oldest =
        currentMessages.length > 0
          ? currentMessages[currentMessages.length - 1]
          : null;
      const oldestTimestamp =
        oldest?.created_at || oldest?.server_received_at || Date.now();

      logger.info("[useLocalMessages] loadMore: syncing older from Firestore", {
        currentLimit,
        nextLimit,
        sqliteCount: currentMessages.length,
        oldestTimestamp,
        oldestMessageId: oldest?.id,
      });

      syncOlderMessages(scope, conversationId, oldestTimestamp, PAGE_SIZE)
        .then((count) => {
          logger.info("[useLocalMessages] loadMore: sync returned", {
            count,
            requestedLimit: PAGE_SIZE,
          });
          if (count === 0) {
            // Firestore confirmed: no more older messages
            firestoreExhaustedRef.current = true;
            setHasMore(false);
          } else if (count < PAGE_SIZE) {
            // Partial page: last page of history — show results but stop pagination
            firestoreExhaustedRef.current = true;
            latestLimitRef.current = nextLimit;
            setCurrentLimit(nextLimit);
            setHasMore(false);
          } else {
            // Full page: more likely exists
            latestLimitRef.current = nextLimit;
            setCurrentLimit(nextLimit);
          }
          // Batch commit: read the full expanded set from SQLite and commit
          // to visible state in a single update. The pagination guard has
          // prevented any intermediate re-reads during the sync.
          if (count > 0) {
            const freshMessages = getMessagesForConversation(
              conversationId,
              scope,
              nextLimit,
            );
            setMessages(freshMessages);
            updateStatusCounts(freshMessages);
          }
        })
        .catch((err) => {
          logger.warn("[useLocalMessages] syncOlderMessages failed:", err);
        })
        .finally(() => {
          isSyncingOlderRef.current = false;
          isPaginatingRef.current = false;
          clearLoadingWithMinTime();
        });
    } else {
      // SQLite has enough — defer state update to next tick so the
      // loading indicator renders for at least one frame.
      isPaginatingRef.current = true;
      setTimeout(() => {
        latestLimitRef.current = nextLimit;
        setCurrentLimit(nextLimit);
        setMessages(currentMessages);
        updateStatusCounts(currentMessages);
        isPaginatingRef.current = false;
        clearLoadingWithMinTime();
      }, 0);
    }
  }, [
    hasMore,
    messageAnchor,
    currentLimit,
    conversationId,
    scope,
    updateStatusCounts,
  ]);

  return {
    messages,
    isLoading,
    isLoadingOlder,
    error,
    pendingCount,
    failedCount,
    refresh,
    prependMessage,
    loadMore,
    loadAroundMessage,
    clearMessageAnchor,
    hasMore,
    isMessageAnchorActive: messageAnchor !== null,
  };
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Get pending messages across all conversations
 */
export function usePendingMessages(): {
  pendingMessages: MessageWithAttachments[];
  count: number;
  refresh: () => void;
} {
  const [pendingMessages, setPendingMessages] = useState<
    MessageWithAttachments[]
  >([]);

  const refresh = useCallback(() => {
    if (!USE_LOCAL_STORAGE) {
      setPendingMessages([]);
      return;
    }

    try {
      const pending = getMessagesByStatus("pending", 100);
      setPendingMessages(pending);
    } catch (err) {
      logger.error("[usePendingMessages] Failed to load:", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    pendingMessages,
    count: pendingMessages.length,
    refresh,
  };
}

/**
 * Get failed messages across all conversations
 */
export function useFailedMessages(): {
  failedMessages: MessageWithAttachments[];
  count: number;
  refresh: () => void;
} {
  const [failedMessages, setFailedMessages] = useState<
    MessageWithAttachments[]
  >([]);

  const refresh = useCallback(() => {
    if (!USE_LOCAL_STORAGE) {
      setFailedMessages([]);
      return;
    }

    try {
      const failed = getMessagesByStatus("failed", 100);
      setFailedMessages(failed);
    } catch (err) {
      logger.error("[useFailedMessages] Failed to load:", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    failedMessages,
    count: failedMessages.length,
    refresh,
  };
}
