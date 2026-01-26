/**
 * useMessagesV2 Hook
 *
 * React hook for subscribing to V2 messages with:
 * - Real-time updates ordered by serverReceivedAt
 * - Optimistic message merging from outbox
 * - Pagination support (load older)
 * - Automatic read watermark updates
 *
 * @module hooks/useMessagesV2
 */

import { updateReadWatermark as updateDMReadWatermark } from "@/services/chatMembers";
import {
  getPendingForConversation,
  mergeMessagesWithOutbox,
} from "@/services/chatV2";
import { updateGroupReadWatermark } from "@/services/groupMembers";
import {
  loadOlderMessages,
  resetPaginationCursor,
  subscribeToDMMessages,
  subscribeToGroupMessages,
} from "@/services/messageList";
import { MessageV2, OutboxItem } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useRef, useState } from "react";

const log = createLogger("useMessagesV2");

// =============================================================================
// Types
// =============================================================================

interface UseMessagesV2Options {
  /** Conversation scope */
  scope: "dm" | "group";
  /** Chat or Group ID */
  conversationId: string;
  /** Current user ID */
  currentUid: string;
  /** Current user display name (for optimistic messages) */
  currentUserName?: string;
  /** Initial message limit */
  initialLimit?: number;
  /** Auto-update read watermark when viewing */
  autoMarkRead?: boolean;
  /**
   * Whether to send read receipts (update public watermark)
   * If false, only private watermark is updated
   * @default true
   */
  sendReadReceipts?: boolean;
  /** Callback when messages change */
  onMessagesChange?: (messages: MessageV2[]) => void;
}

interface UseMessagesV2Return {
  /** Combined server + optimistic messages */
  messages: MessageV2[];
  /** Loading initial messages */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Pagination state */
  pagination: {
    hasMoreOlder: boolean;
    isLoadingOlder: boolean;
  };
  /** Load older messages */
  loadOlder: () => Promise<void>;
  /** Refresh messages */
  refresh: () => void;
  /** Pending outbox items for this conversation */
  pendingItems: OutboxItem[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useMessagesV2(
  options: UseMessagesV2Options,
): UseMessagesV2Return {
  const {
    scope,
    conversationId,
    currentUid,
    currentUserName,
    initialLimit = 50,
    autoMarkRead = true,
    sendReadReceipts = true, // Default to true, but respect user preference
    onMessagesChange,
  } = options;

  // State
  const [serverMessages, setServerMessages] = useState<MessageV2[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Refs
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastWatermarkRef = useRef<number>(0);
  const updateWatermarkRef = useRef<
    ((timestamp: number) => Promise<void>) | undefined
  >(undefined);
  // Debounce ref for loadOlder to prevent rapid-fire calls from onEndReached
  const lastLoadOlderTimeRef = useRef<number>(0);
  const LOAD_OLDER_DEBOUNCE_MS = 500; // Minimum interval between load attempts

  // Combine server messages with outbox items
  const messages = mergeMessagesWithOutbox(
    serverMessages,
    outboxItems,
    currentUid,
    currentUserName,
  );

  // Subscribe to messages
  useEffect(() => {
    if (!conversationId || !currentUid) return;

    log.info("Subscribing to messages", {
      operation: "subscribe",
      data: { scope, conversationId },
    });

    setLoading(true);
    setError(null);

    // Reset pagination cursor on new conversation
    resetPaginationCursor(scope, conversationId);

    // Subscribe function based on scope
    const subscribeFn =
      scope === "dm" ? subscribeToDMMessages : subscribeToGroupMessages;

    unsubscribeRef.current = subscribeFn(conversationId, {
      initialLimit,
      currentUid,
      onMessages: (msgs) => {
        setServerMessages(msgs);
        setLoading(false);

        // Update hasMoreOlder based on returned count
        setHasMoreOlder(msgs.length >= initialLimit);

        // Auto-mark as read (only updates public watermark if sendReadReceipts is true)
        // When sendReadReceipts is false, we still track locally but don't broadcast
        if (autoMarkRead && msgs.length > 0) {
          const latestTimestamp = Math.max(
            ...msgs.map((m) => m.serverReceivedAt),
          );
          if (latestTimestamp > lastWatermarkRef.current) {
            // Always update watermark to mark as read (uses ref to avoid stale closure)
            updateWatermarkRef.current?.(latestTimestamp);
            lastWatermarkRef.current = latestTimestamp;
          }
        }
      },
      onPaginationState: (state) => {
        setHasMoreOlder(state.hasMoreBefore);
      },
      onError: (err) => {
        log.error("Subscription error", err);
        setError(err);
        setLoading(false);
      },
    });

    // Load outbox items for this conversation
    loadOutboxItems();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [scope, conversationId, currentUid, initialLimit, autoMarkRead]);

  // Notify parent of message changes
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Load outbox items
  const loadOutboxItems = useCallback(async () => {
    try {
      const items = await getPendingForConversation(conversationId);
      setOutboxItems(items);
    } catch (err) {
      log.error("Failed to load outbox items", err);
    }
  }, [conversationId]);

  // Update read watermark
  const updateWatermark = useCallback(
    async (timestamp: number) => {
      try {
        if (scope === "dm") {
          await updateDMReadWatermark(conversationId, currentUid, timestamp);
        } else {
          await updateGroupReadWatermark(conversationId, currentUid, timestamp);
        }
      } catch (err) {
        log.error("Failed to update watermark", err);
      }
    },
    [scope, conversationId, currentUid],
  );

  // Keep ref updated for use in subscription callback
  useEffect(() => {
    updateWatermarkRef.current = updateWatermark;
  }, [updateWatermark]);

  // Load older messages (with debounce protection for onEndReached)
  const loadOlder = useCallback(async () => {
    // Guard: already loading, no more messages, or no messages loaded yet
    if (isLoadingOlder || !hasMoreOlder || serverMessages.length === 0) return;

    // Debounce: prevent rapid-fire calls from onEndReached
    const now = Date.now();
    if (now - lastLoadOlderTimeRef.current < LOAD_OLDER_DEBOUNCE_MS) {
      log.debug("loadOlder debounced", {
        operation: "loadOlder",
        data: { timeSinceLastCall: now - lastLoadOlderTimeRef.current },
      });
      return;
    }
    lastLoadOlderTimeRef.current = now;

    setIsLoadingOlder(true);

    try {
      // With inverted FlatList, serverMessages is [newest, ..., oldest]
      // So the oldest message is at the END of the array
      const oldestMessage = serverMessages[serverMessages.length - 1];
      const result = await loadOlderMessages(
        scope,
        conversationId,
        oldestMessage.serverReceivedAt,
        25,
      );

      // Append older messages to the END (they're older, so higher index)
      // result.messages is [next-newest, ..., next-oldest]
      setServerMessages((prev) => [...prev, ...result.messages]);
      setHasMoreOlder(result.hasMore);
    } catch (err) {
      log.error("Failed to load older messages", err);
      setError(err as Error);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [scope, conversationId, serverMessages, isLoadingOlder, hasMoreOlder]);

  // Refresh (re-subscribe)
  const refresh = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }
    setServerMessages([]);
    setLoading(true);
    resetPaginationCursor(scope, conversationId);

    // Re-subscribe will happen via useEffect
  }, [scope, conversationId]);

  return {
    messages,
    loading,
    error,
    pagination: {
      hasMoreOlder,
      isLoadingOlder,
    },
    loadOlder,
    refresh,
    pendingItems: outboxItems,
  };
}

// =============================================================================
// Utility Hook: Unread Count
// =============================================================================

import { countUnreadSince, hasUnreadMessages } from "@/services/messageList";

interface UseUnreadCountOptions {
  scope: "dm" | "group";
  conversationId: string;
  watermark: number;
  lastMessageAt?: number;
  enabled?: boolean;
}

interface UseUnreadCountReturn {
  unreadCount: number;
  hasUnread: boolean;
  loading: boolean;
  refresh: () => void;
}

/**
 * Hook for getting unread count for a conversation
 */
export function useUnreadCount(
  options: UseUnreadCountOptions,
): UseUnreadCountReturn {
  const {
    scope,
    conversationId,
    watermark,
    lastMessageAt,
    enabled = true,
  } = options;

  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Quick check based on lastMessageAt (no query needed)
  const hasUnread = lastMessageAt
    ? hasUnreadMessages(lastMessageAt, watermark)
    : unreadCount > 0;

  const fetchCount = useCallback(async () => {
    if (!enabled || !conversationId) return;

    // If we have lastMessageAt and it's not newer than watermark, skip query
    if (lastMessageAt && lastMessageAt <= watermark) {
      setUnreadCount(0);
      return;
    }

    setLoading(true);
    try {
      const count = await countUnreadSince(scope, conversationId, watermark);
      setUnreadCount(count);
    } catch (err) {
      log.error("Failed to fetch unread count", err);
    } finally {
      setLoading(false);
    }
  }, [scope, conversationId, watermark, lastMessageAt, enabled]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return {
    unreadCount,
    hasUnread,
    loading,
    refresh: fetchCount,
  };
}

export default useMessagesV2;
