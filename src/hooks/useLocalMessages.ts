/**
 * useLocalMessages Hook
 *
 * React hook for accessing locally-stored messages.
 * Provides real-time updates when messages change in SQLite.
 *
 * @file src/hooks/useLocalMessages.ts
 */

import {
  getOrCreateDMConversation,
  getOrCreateGroupConversation,
} from "@/services/database/conversationRepository";
import {
  getMessagesByStatus,
  getMessagesForConversation,
  MessageWithAttachments,
} from "@/services/database/messageRepository";
import {
  fullSyncConversation,
  subscribeToConversation,
} from "@/services/sync/syncEngine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { USE_LOCAL_STORAGE } from "@/constants/featureFlags";


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
   * Load more (older) messages
   */
  loadMore: () => void;

  /**
   * Whether there are more messages to load
   */
  hasMore: boolean;
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
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const hasSyncedRef = useRef(false);

  // Load messages from SQLite
  const loadMessages = useCallback(() => {
    if (!USE_LOCAL_STORAGE) {
      setIsLoading(false);
      return;
    }

    try {
      const loadedMessages = getMessagesForConversation(
        conversationId,
        scope,
        currentLimit,
      );

      setMessages(loadedMessages);
      setHasMore(loadedMessages.length >= currentLimit);
      setError(null);

      // Count pending and failed messages
      const pending = loadedMessages.filter(
        (m: MessageWithAttachments) => m.sync_status === "pending",
      ).length;
      const failed = loadedMessages.filter(
        (m: MessageWithAttachments) => m.sync_status === "failed",
      ).length;

      setPendingCount(pending);
      setFailedCount(failed);
    } catch (err: any) {
      logger.error("[useLocalMessages] Failed to load messages:", err);
      setError(err.message || "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, scope, currentLimit]);

  // Initial load + sync from Firestore
  useEffect(() => {
    if (!USE_LOCAL_STORAGE || !conversationId) {
      setIsLoading(false);
      return;
    }

    // Skip conversation creation here - already done in initialState useMemo

    // Only show loading if we have no cached data
    // (initialState already loaded synchronously)
    if (messages.length === 0) {
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
    unsubscribeRef.current = subscribeToConversation(
      scope,
      conversationId,
      () => {
        // Reload messages when new ones arrive from server
        loadMessages();
      },
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [conversationId, scope, initialLimit, loadMessages]);

  // Refresh function
  const refresh = useCallback(() => {
    loadMessages();
  }, [loadMessages]);

  // Load more function
  const loadMore = useCallback(() => {
    if (!hasMore) return;
    setCurrentLimit((prev) => prev + initialLimit);
  }, [hasMore, initialLimit]);

  return {
    messages,
    isLoading,
    error,
    pendingCount,
    failedCount,
    refresh,
    loadMore,
    hasMore,
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
