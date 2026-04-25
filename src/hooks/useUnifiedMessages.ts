/**
 * useUnifiedMessages Hook (ARCH-D01)
 *
 * Firestore-backed compatibility hook used on web and rollback scenarios.
 * Native screens should prefer the SQLite-first path through `useChat`.
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
 * // NEW (SQLite-first):
 * const { messages, isLoading, loadMore } = useLocalMessages({
 *   conversationId: groupId,
 *   scope: "group",
 * });
 *
 * // Compatibility (Firestore-first):
 * const { messages, loading, loadOlder } = useUnifiedMessages({
 *   scope: "group",
 *   conversationId: groupId,
 *   currentUid: user.uid,
 * });
 * ```
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import {
  updateDeliveryWatermark as updateDMDeliveryWatermark,
  updateReadWatermark as updateDMReadWatermark,
} from "@/services/chatMembers";
import { mergeMessagesWithOutbox } from "@/services/messaging/messageMerge";
import { getPendingForConversation } from "@/services/messaging/send";
import {
  updateGroupDeliveryWatermark,
  updateGroupReadWatermark,
} from "@/services/groupMembers";
import { subscribeToInboxSettings } from "@/services/inboxSettings";
import { resolveFromInboxSettings } from "@/services/messaging/resolveChatSettings";
import {
  loadOlderMessages,
  resetPaginationCursor,
  subscribeToMessages,
} from "@/services/messaging/subscribe";
import {
  DEFAULT_INBOX_SETTINGS,
  InboxSettings,
  MessageV2,
  OutboxItem,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  createUnifiedMessagesSubscriptionManager,
  mergePaginatedOlderMessages,
  mergeRealtimeSnapshotMessages,
  runIfMounted,
} from "@/services/chat/unifiedMessagesLifecycle";
import { serverReceivedCursorFromMessage } from "@/services/chat/messagePagination";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const log = createLogger("useUnifiedMessages");

// =============================================================================
// Types
// =============================================================================

export interface UseUnifiedMessagesOptions {
  /**
   * Enable the Firestore-first runtime.
   * When false, this hook stays inert so local-first screens do not mount
   * duplicate subscriptions or settings listeners just to satisfy hook order.
   * @default true
   */
  enabled?: boolean;
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
    enabled = true,
    scope,
    conversationId,
    currentUid,
    currentUserName,
    initialLimit = 50,
    autoMarkRead = true,
    sendReadReceipts: sendReadReceiptsOption,
    onMessagesChange,
  } = options;

  // State
  const [serverMessages, setServerMessages] = useState<MessageV2[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [inboxSettings, setInboxSettings] = useState<InboxSettings>(
    DEFAULT_INBOX_SETTINGS,
  );

  // Refs
  const subscriptionManagerRef = useRef(
    createUnifiedMessagesSubscriptionManager(
      subscribeToMessages,
      resetPaginationCursor,
    ),
  );
  const lastWatermarkRef = useRef<number>(0);
  const lastDeliveryWatermarkRef = useRef<number>(0);
  const updateWatermarkRef = useRef<
    ((timestamp: number) => Promise<void>) | undefined
  >(undefined);
  const updateDeliveryWatermarkRef = useRef<
    ((timestamp: number) => Promise<void>) | undefined
  >(undefined);
  const lastLoadOlderTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (enabled) return;

    subscriptionManagerRef.current.cleanup();
    setServerMessages([]);
    setOutboxItems([]);
    setLoading(false);
    setError(null);
    setHasMoreOlder(false);
    setIsLoadingOlder(false);
    setInboxSettings(DEFAULT_INBOX_SETTINGS);
  }, [enabled]);

  // Resolve effective settings via the V3 resolver
  const effectiveSettings = useMemo(
    () => resolveFromInboxSettings(inboxSettings),
    [inboxSettings],
  );

  // Compute sendReadReceipts: use option if provided, else use effective setting
  // For DMs, we respect the user's publishReadReceipts setting
  const sendReadReceipts =
    sendReadReceiptsOption ??
    (scope === "dm" ? effectiveSettings.publishReadReceipts : false);

  // Subscribe to user's inbox settings for dynamic read receipt control
  useEffect(() => {
    if (!enabled || !currentUid || scope !== "dm") return;

    const unsubscribe = subscribeToInboxSettings(currentUid, (settings) => {
      setInboxSettings(settings);
    });

    return unsubscribe;
  }, [enabled, currentUid, scope]);

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
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }

    if (!conversationId || !currentUid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const subscriptionManager = subscriptionManagerRef.current;

    subscriptionManager.replace({
      scope,
      conversationId,
      initialLimit,
      currentUid,
      onMessages: (msgs) => {
        if (
          !runIfMounted(isMountedRef, () => {
            setServerMessages((prev) =>
              mergeRealtimeSnapshotMessages(prev, msgs),
            );
            setLoading(false);
          })
        ) {
          return;
        }

        // Update hasMoreOlder based on returned count
        setHasMoreOlder(msgs.length >= initialLimit);

        // Auto-mark as read
        if (autoMarkRead && msgs.length > 0) {
          const latestTimestamp = Math.max(
            ...msgs.map((m) => m.serverReceivedAt),
          );
          if (latestTimestamp > lastWatermarkRef.current) {
            // Use Date.now() as watermark instead of serverReceivedAt.
            // The Chat/Group doc's lastMessageAt is a server timestamp written
            // AFTER the message's serverReceivedAt (separate Firestore write),
            // so lastMessageAt > serverReceivedAt. Using serverReceivedAt as
            // lastSeenAtPrivate would leave lastMessageAt > lastSeenAtPrivate,
            // causing the conversation to perpetually show as unread.
            // Date.now() is always after the message was received, so it's
            // guaranteed to be >= lastMessageAt.
            const watermark = Math.max(latestTimestamp, Date.now());
            updateWatermarkRef.current?.(watermark);
            lastWatermarkRef.current = latestTimestamp;
          }

          // Segment 2: Delivery ack — update delivery watermark
          if (
            CHAT_FEATURES.CHAT_DELIVERY_ACKS &&
            effectiveSettings.publishDeliveryReceipts &&
            latestTimestamp > lastDeliveryWatermarkRef.current
          ) {
            updateDeliveryWatermarkRef.current?.(latestTimestamp);
            lastDeliveryWatermarkRef.current = latestTimestamp;
          }
        }
      },
      onPaginationState: (state) => {
        runIfMounted(isMountedRef, () => {
          setHasMoreOlder(state.hasMoreBefore);
        });
      },
      onError: (err) => {
        log.error("Subscription error", err);
        runIfMounted(isMountedRef, () => {
          setError(err);
          setLoading(false);
        });
      },
    });

    // Load outbox items for this conversation
    loadOutboxItems();

    return () => {
      subscriptionManager.cleanup();
    };
    // Note: loadOutboxItems is stable via useCallback with [conversationId] deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enabled,
    scope,
    conversationId,
    currentUid,
    initialLimit,
    autoMarkRead,
    refreshKey,
  ]);

  // Notify parent of message changes
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Load outbox items
  const loadOutboxItems = useCallback(async () => {
    if (!enabled || !conversationId) {
      runIfMounted(isMountedRef, () => {
        setOutboxItems([]);
      });
      return;
    }
    try {
      const items = await getPendingForConversation(scope, conversationId);
      runIfMounted(isMountedRef, () => {
        setOutboxItems(items);
      });
    } catch (err) {
      log.error("Failed to load outbox items", err);
    }
  }, [enabled, scope, conversationId]);

  // Update read watermark
  const updateWatermark = useCallback(
    async (timestamp: number) => {
      if (!conversationId || !currentUid) return;
      try {
        if (scope === "dm") {
          // Pass sendReadReceipts option to control public watermark updates
          await updateDMReadWatermark(conversationId, currentUid, timestamp, {
            sendPublicReceipt: sendReadReceipts,
          });
        } else {
          await updateGroupReadWatermark(conversationId, currentUid, timestamp);
        }
      } catch (err) {
        log.error("Failed to update watermark", err);
      }
    },
    [scope, conversationId, currentUid, sendReadReceipts],
  );

  // Update delivery watermark (Segment 2)
  const updateDeliveryWatermark = useCallback(
    async (timestamp: number) => {
      if (!CHAT_FEATURES.CHAT_DELIVERY_ACKS) return;
      if (!conversationId || !currentUid) return;
      try {
        if (scope === "dm") {
          await updateDMDeliveryWatermark(
            conversationId,
            currentUid,
            timestamp,
          );
        } else {
          await updateGroupDeliveryWatermark(
            conversationId,
            currentUid,
            timestamp,
          );
        }
      } catch (err) {
        log.error("Failed to update delivery watermark", err);
      }
    },
    [scope, conversationId, currentUid],
  );

  // Keep refs updated for use in subscription callback
  useEffect(() => {
    updateWatermarkRef.current = updateWatermark;
  }, [updateWatermark]);

  useEffect(() => {
    updateDeliveryWatermarkRef.current = updateDeliveryWatermark;
  }, [updateDeliveryWatermark]);

  // Load older messages (with debounce protection)
  const loadOlder = useCallback(async () => {
    // Guards
    if (
      !enabled ||
      isLoadingOlder ||
      !hasMoreOlder ||
      serverMessages.length === 0
    ) {
      return;
    }

    // Debounce
    const now = Date.now();
    if (now - lastLoadOlderTimeRef.current < LOAD_OLDER_DEBOUNCE_MS) {
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
        serverReceivedCursorFromMessage(oldestMessage),
        25,
      );

      if (
        !runIfMounted(isMountedRef, () => {
          // Merge and dedupe to protect against page-boundary overlap.
          setServerMessages((prev) =>
            mergePaginatedOlderMessages(prev, result.messages),
          );
          setHasMoreOlder(result.hasMore);
        })
      ) {
        return;
      }

    } catch (err) {
      log.error("Failed to load older messages", err);
      runIfMounted(isMountedRef, () => {
        setError(err as Error);
      });
    } finally {
      runIfMounted(isMountedRef, () => {
        setIsLoadingOlder(false);
      });
    }
  }, [
    enabled,
    scope,
    conversationId,
    serverMessages,
    isLoadingOlder,
    hasMoreOlder,
  ]);

  // Refresh (re-subscribe)
  const refresh = useCallback(() => {
    if (!enabled || !conversationId) return;

    subscriptionManagerRef.current.cleanup();
    setServerMessages([]);
    setLoading(true);
    resetPaginationCursor(scope, conversationId);
    setRefreshKey((k) => k + 1);
  }, [enabled, scope, conversationId]);

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
