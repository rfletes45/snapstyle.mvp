/**
 * useUnifiedMessages Hook (ARCH-D01)
 *
 * Unified hook for message subscription that works for both DM and Group
 * conversations. Handles:
 * - Real-time message subscription
 * - Outbox integration for optimistic messages
 * - Pagination (load older)
 * - Automatic read watermark updates
 * - Legacy GroupMessage conversion (via service layer)
 *
 * @module hooks/useUnifiedMessages
 *
 * @example
 * ```typescript
 * const {
 *   messages,
 *   loading,
 *   error,
 *   pagination,
 *   loadOlder,
 *   refresh,
 *   pendingItems,
 * } = useUnifiedMessages({
 *   scope: "group",
 *   conversationId: groupId,
 *   currentUid: user.uid,
 *   currentUserName: user.displayName,
 * });
 * ```
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
  subscribeToMessages,
} from "@/services/messaging/subscribe";
import { MessageV2, OutboxItem } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const log = createLogger("useUnifiedMessages");

// =============================================================================
// Types
// =============================================================================

export interface UseUnifiedMessagesOptions {
  /** Conversation scope ("dm" or "group") */
  scope: "dm" | "group";
  /** Chat ID (for DM) or Group ID (for group) */
  conversationId: string;
  /** Current user ID */
  currentUid: string;
  /** Current user display name (for optimistic messages) */
  currentUserName?: string;
  /** Initial message limit (default: 50) */
  initialLimit?: number;
  /**
   * Auto-update read watermark when viewing
   * @default true
   */
  autoMarkRead?: boolean;
  /**
   * Whether to send read receipts (update public watermark)
   * For DM: default true (shows blue checkmarks)
   * For Group: default false (no public receipts)
   */
  sendReadReceipts?: boolean;
  /** Callback when messages change */
  onMessagesChange?: (messages: MessageV2[]) => void;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseUnifiedMessagesReturn {
  /** Combined server + optimistic messages (sorted by serverReceivedAt DESC) */
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
  /** Refresh messages (re-subscribe) */
  refresh: () => void;
  /** Pending outbox items for this conversation */
  pendingItems: OutboxItem[];
}

// =============================================================================
// Constants
// =============================================================================

/** Debounce interval for loadOlder to prevent rapid-fire calls */
const LOAD_OLDER_DEBOUNCE_MS = 500;

// =============================================================================
// Hook Implementation
// =============================================================================

export function useUnifiedMessages(
  options: UseUnifiedMessagesOptions,
): UseUnifiedMessagesReturn {
  const {
    scope,
    conversationId,
    currentUid,
    currentUserName,
    initialLimit = 50,
    autoMarkRead = true,
    // sendReadReceipts - available in options for future use
    onMessagesChange,
    debug = false,
  } = options;

  // Note: sendReadReceipts option available for future use when we add
  // optional read receipt hiding. Currently watermarks are always updated.

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
  const lastLoadOlderTimeRef = useRef<number>(0);

  // Merge server messages with outbox items for optimistic UI
  const messages = useMemo(() => {
    return mergeMessagesWithOutbox(
      serverMessages,
      outboxItems,
      currentUid,
      currentUserName,
    );
  }, [serverMessages, outboxItems, currentUid, currentUserName]);

  // Subscribe to messages
  useEffect(() => {
    if (!conversationId || !currentUid) {
      setLoading(false);
      return;
    }

    if (debug) {
      log.info("Subscribing to messages", {
        operation: "subscribe",
        data: { scope, conversationId },
      });
    }

    setLoading(true);
    setError(null);

    // Reset pagination cursor on new conversation
    resetPaginationCursor(scope, conversationId);

    // Subscribe using unified messaging service
    unsubscribeRef.current = subscribeToMessages(scope, conversationId, {
      initialLimit,
      currentUid,
      onMessages: (msgs) => {
        setServerMessages(msgs);
        setLoading(false);

        // Update hasMoreOlder based on returned count
        setHasMoreOlder(msgs.length >= initialLimit);

        // Auto-mark as read
        if (autoMarkRead && msgs.length > 0) {
          const latestTimestamp = Math.max(
            ...msgs.map((m) => m.serverReceivedAt),
          );
          if (latestTimestamp > lastWatermarkRef.current) {
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
      debug,
    });

    // Load outbox items for this conversation
    loadOutboxItems();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    // Note: loadOutboxItems is stable via useCallback with [conversationId] deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, conversationId, currentUid, initialLimit, autoMarkRead, debug]);

  // Notify parent of message changes
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Load outbox items
  const loadOutboxItems = useCallback(async () => {
    if (!conversationId) return;
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
      if (!conversationId || !currentUid) return;
      try {
        if (scope === "dm") {
          // Note: updateDMReadWatermark updates both public and private watermarks
          // The shouldSendReceipts option could be added to the service in future
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

  // Load older messages (with debounce protection)
  const loadOlder = useCallback(async () => {
    // Guards
    if (isLoadingOlder || !hasMoreOlder || serverMessages.length === 0) {
      return;
    }

    // Debounce
    const now = Date.now();
    if (now - lastLoadOlderTimeRef.current < LOAD_OLDER_DEBOUNCE_MS) {
      if (debug) {
        log.debug("loadOlder debounced", {
          operation: "loadOlder",
          data: { timeSinceLastCall: now - lastLoadOlderTimeRef.current },
        });
      }
      return;
    }
    lastLoadOlderTimeRef.current = now;

    setIsLoadingOlder(true);

    try {
      // Get oldest message timestamp (last in array for inverted list)
      const oldestMessage = serverMessages[serverMessages.length - 1];
      const result = await loadOlderMessages(
        scope,
        conversationId,
        oldestMessage.serverReceivedAt,
        25,
      );

      // Append older messages to the end
      setServerMessages((prev) => [...prev, ...result.messages]);
      setHasMoreOlder(result.hasMore);

      if (debug) {
        log.debug("Loaded older messages", {
          operation: "loadOlder",
          data: {
            loaded: result.messages.length,
            hasMore: result.hasMore,
          },
        });
      }
    } catch (err) {
      log.error("Failed to load older messages", err);
      setError(err as Error);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [
    scope,
    conversationId,
    serverMessages,
    isLoadingOlder,
    hasMoreOlder,
    debug,
  ]);

  // Refresh (re-subscribe)
  const refresh = useCallback(() => {
    if (!conversationId) return;

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

export default useUnifiedMessages;
