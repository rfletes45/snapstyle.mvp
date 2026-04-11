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
  const [messageAnchor, setMessageAnchor] = useState<MessageAnchorState | null>(
    null,
  );
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const hasSyncedRef = useRef(false);
  const latestLimitRef = useRef(initialLimit);

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
    setCurrentLimit(initialLimit);
    setMessages(initialState.messages);
    setHasMore(initialState.hasMore);
    setIsLoading(initialState.messages.length === 0);
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
      if (messageAnchor) {
        const window = getMessageWindowAroundMessage(
          conversationId,
          scope,
          messageAnchor.targetMessageId,
          messageAnchor.olderLimit,
          messageAnchor.newerLimit,
        );

        if (window) {
          setMessages(window.messages);
          setHasMore(window.hasOlder);
          setError(null);
          updateStatusCounts(window.messages);
          return;
        }

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
  }, [conversationId, scope, currentLimit, messageAnchor, updateStatusCounts]);

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
      loadMessages();
    }

    // Then sync from Firestore in background
    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true;
      fullSyncConversation(scope, conversationId, initialLimit)
        .then((count) => {
          logger.info(
            `[useLocalMessages] Synced ${count} messages from server`,
          );
          // Reload after sync completes
          loadMessages();
        })
        .catch((err) => {
          logger.error("[useLocalMessages] Initial sync failed:", err);
        });
    }

    // Subscribe to real-time updates from Firestore
    if (autoRefresh) {
      unsubscribeRef.current = subscribeToConversation(
        scope,
        conversationId,
        () => {
          // Reload messages when new ones arrive from server
          loadMessages();
        },
      );
    } else {
      unsubscribeRef.current = null;
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [
    conversationId,
    scope,
    initialLimit,
    autoRefresh,
    loadMessages,
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

      latestLimitRef.current = currentLimit;
      setMessageAnchor(nextAnchor);
      setMessages(window.messages);
      setHasMore(window.hasOlder);
      setError(null);
      updateStatusCounts(window.messages);
      return true;
    },
    [conversationId, currentLimit, initialLimit, scope, updateStatusCounts],
  );

  const clearMessageAnchor = useCallback(() => {
    if (!messageAnchor) return;

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
  const isSyncingOlderRef = useRef(false);

  const loadMore = useCallback(() => {
    if (!hasMore || !USE_LOCAL_STORAGE || isSyncingOlderRef.current) return;

    if (messageAnchor) {
      const nextOlderLimit = messageAnchor.olderLimit + initialLimit;
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
        return;
      }

      if (
        currentWindow.olderCount < nextOlderLimit &&
        !isSyncingOlderRef.current
      ) {
        isSyncingOlderRef.current = true;
        // Use server_received_at for pagination cursor (consistent with Firestore ordering)
        const oldest =
          currentWindow.messages.length > 0
            ? currentWindow.messages[currentWindow.messages.length - 1]
            : null;
        const oldestTimestamp =
          oldest?.server_received_at || oldest?.created_at || Date.now();

        logger.info("[useLocalMessages] loadMore(anchor): syncing older", {
          oldestTimestamp,
          currentOlderCount: currentWindow.olderCount,
          nextOlderLimit,
        });

        syncOlderMessages(scope, conversationId, oldestTimestamp, initialLimit)
          .then((count) => {
            logger.info("[useLocalMessages] loadMore(anchor): sync returned", {
              count,
            });
            if (count === 0) {
              // Firestore confirmed: no more messages
              firestoreExhaustedRef.current = true;
              setHasMore(false);
            } else if (count < initialLimit) {
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
          })
          .catch((err) => {
            logger.warn("[useLocalMessages] syncOlderMessages failed:", err);
          })
          .finally(() => {
            isSyncingOlderRef.current = false;
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
      }
      return;
    }

    const nextLimit = currentLimit + initialLimit;
    // Peek at how many messages SQLite actually has right now
    const currentMessages = getMessagesForConversation(
      conversationId,
      scope,
      nextLimit,
    );

    if (currentMessages.length < nextLimit) {
      // SQLite doesn't have enough messages — fetch from Firestore
      isSyncingOlderRef.current = true;
      // Use server_received_at for pagination cursor (matches Firestore index)
      const oldest =
        currentMessages.length > 0
          ? currentMessages[currentMessages.length - 1]
          : null;
      const oldestTimestamp =
        oldest?.server_received_at || oldest?.created_at || Date.now();

      logger.info("[useLocalMessages] loadMore: syncing older from Firestore", {
        currentLimit,
        nextLimit,
        sqliteCount: currentMessages.length,
        oldestTimestamp,
        oldestMessageId: oldest?.id,
      });

      syncOlderMessages(scope, conversationId, oldestTimestamp, initialLimit)
        .then((count) => {
          logger.info("[useLocalMessages] loadMore: sync returned", {
            count,
            requestedLimit: initialLimit,
          });
          if (count === 0) {
            // Firestore confirmed: no more older messages
            firestoreExhaustedRef.current = true;
            setHasMore(false);
          } else if (count < initialLimit) {
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
        })
        .catch((err) => {
          logger.warn("[useLocalMessages] syncOlderMessages failed:", err);
        })
        .finally(() => {
          isSyncingOlderRef.current = false;
        });
    } else {
      // SQLite has enough — just increase the limit
      latestLimitRef.current = nextLimit;
      setCurrentLimit(nextLimit);
    }
  }, [
    hasMore,
    messageAnchor,
    currentLimit,
    initialLimit,
    conversationId,
    scope,
  ]);

  return {
    messages,
    isLoading,
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
