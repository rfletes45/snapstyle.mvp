/**
 * useChat Hook (ARCH-D02)
 *
 * Master chat hook that composes all chat-related functionality into
 * a single, unified interface. This dramatically reduces screen complexity
 * by handling:
 *
 * - Message subscription and pagination
 * - Outbox integration for optimistic messages
 * - Keyboard animation values
 * - Scroll position tracking
 * - Auto-scroll on new messages
 * - Reply-to state management
 * - Message selection state
 * - Send functionality with outbox
 *
 * ## Migration from existing screens
 *
 * Before (multiple hooks + state):
 * ```typescript
 * const { messages, loading, loadOlder } = useUnifiedMessages(scope, conversationId, uid);
 * const { keyboardHeight, keyboardProgress, isKeyboardOpen } = useChatKeyboard();
 * const { isAtBottom, onScroll } = useAtBottom({ threshold: 200 });
 * const autoscroll = useNewMessageAutoscroll({ messageCount, isKeyboardOpen, isAtBottom });
 * const [replyTo, setReplyTo] = useState(null);
 * const [selectedMessage, setSelectedMessage] = useState(null);
 * const flatListRef = useRef(null);
 * ```
 *
 * After (single unified hook):
 * ```typescript
 * const chat = useChat({
 *   scope: "group",
 *   conversationId: groupId,
 *   currentUid: user.uid,
 *   currentUserName: user.displayName,
 * });
 *
 * // Access everything via chat object
 * chat.messages
 * chat.keyboard.keyboardHeight
 * chat.scroll.isAtBottom
 * chat.scroll.showJumpPill
 * chat.replyTo
 * chat.sendMessage("Hello!")
 * ```
 *
 * @module hooks/useChat
 */

import { USE_LOCAL_STORAGE } from "@/constants/featureFlags";
import type { SenderStyle } from "@/cosmetics/types";
import {
  dedupeAndSortMessages,
  getMessageStatusFromSync,
} from "@/services/chat/normalizeMessage";
import { updateReadWatermark as updateDMReadWatermark } from "@/services/chatMembers";
import {
  getOrCreateDMConversation,
  getOrCreateGroupConversation,
} from "@/services/database/conversationRepository";
import {
  getMessageById,
  insertMessage,
  rowToMessageV2,
} from "@/services/database/messageRepository";
import { updateGroupReadWatermark } from "@/services/groupMembers";
import { sendMessage as sendMessageService } from "@/services/messaging/send";
import { syncPendingMessages } from "@/services/sync/syncEngine";
import type { AttachmentRow } from "@/types/database";
import {
  AttachmentV2,
  LocalAttachment,
  MentionSpan,
  MessageKind,
  MessageV2,
  OutboxItem,
  ReplyToMetadata,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlatList } from "react-native";
import {
  useChatKeyboard,
  type ChatKeyboardState,
} from "./chat/useChatKeyboard";
import {
  useChatScrollState,
  type ChatScrollState,
} from "./chat/useChatScrollState";
import { useMessageEnterAnimationQueue } from "./chat/useMessageEnterAnimationQueue";
import { useLocalMessages } from "./useLocalMessages";
import { useUnifiedMessages } from "./useUnifiedMessages";

const log = createLogger("useChat");

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for useChat hook
 */
export interface UseChatConfig {
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
  /** Auto-mark messages as read (default: true) */
  autoMarkRead?: boolean;
  /** Send read receipts (default: true for DM, false for group) */
  sendReadReceipts?: boolean;
  /** Sender's chat style snapshot to stamp on outgoing messages */
  senderStyle?: SenderStyle;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  /** Reply to a specific message */
  replyTo?: ReplyToMetadata;
  /** User IDs mentioned in the message */
  mentionUids?: string[];
  /** Mention spans for highlighting */
  mentionSpans?: MentionSpan[];
  /** Local attachments to upload */
  attachments?: LocalAttachment[];
  /** Already-hosted remote attachments (skip compress/upload pipeline) */
  remoteAttachments?: AttachmentV2[];
  /** Message kind (default: "text") */
  kind?: MessageKind;
  /** Animal theme ID (required when kind="animal") */
  animalId?: string;
  /** Clear reply state after sending (default: true) */
  clearReplyOnSend?: boolean;
}

/**
 * Return type for useChat hook
 */
export interface UseChatReturn {
  // -------------------------------------------------------------------------
  // Messages & Loading State
  // -------------------------------------------------------------------------
  /** Combined server + optimistic messages (sorted newest first) */
  messages: MessageV2[];
  /** Loading initial messages */
  loading: boolean;
  /** Error if subscription failed */
  error: Error | null;
  /** Pending outbox items for this conversation */
  pendingItems: OutboxItem[];

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------
  /** Pagination state */
  pagination: {
    hasMoreOlder: boolean;
    isLoadingOlder: boolean;
  };
  /** Load older messages */
  loadOlder: () => Promise<void>;
  /** Refresh messages (re-subscribe) */
  refresh: () => void;
  /** Load a bounded message window around a target message already in storage */
  loadAroundMessage: (messageId: string) => boolean;
  /** Clear any anchored target-message window and return to the latest page */
  clearMessageAnchor: () => void;
  /** Whether the chat is currently showing an anchored target-message window */
  isMessageAnchorActive: boolean;

  // -------------------------------------------------------------------------
  // Keyboard Animation
  // -------------------------------------------------------------------------
  /** Keyboard animation state and values */
  keyboard: ChatKeyboardState;

  // -------------------------------------------------------------------------
  // Scroll State
  // -------------------------------------------------------------------------
  /** Unified scroll + jump-pill state */
  scroll: ChatScrollState;

  // -------------------------------------------------------------------------
  // FlatList Ref
  // -------------------------------------------------------------------------
  /** Ref to attach to FlatList */
  flatListRef: React.RefObject<FlatList<MessageV2> | null>;
  /** Set FlatList ref (alternative to using flatListRef) */
  setFlatListRef: (ref: FlatList<MessageV2> | null) => void;

  // -------------------------------------------------------------------------
  // Reply-To State
  // -------------------------------------------------------------------------
  /** Current reply-to metadata (null if not replying) */
  replyTo: ReplyToMetadata | null;
  /** Set reply-to (swipe reply, tap to reply) */
  setReplyTo: (reply: ReplyToMetadata | null) => void;
  /** Clear reply state */
  clearReplyTo: () => void;

  // -------------------------------------------------------------------------
  // Message Selection (for long-press actions)
  // -------------------------------------------------------------------------
  /** Currently selected message for actions */
  selectedMessage: MessageV2 | null;
  /** Select a message (long press) */
  selectMessage: (message: MessageV2 | null) => void;
  /** Clear message selection */
  clearSelection: () => void;

  // -------------------------------------------------------------------------
  // Send Message
  // -------------------------------------------------------------------------
  /**
   * Send a text message
   * @param text - Message text
   * @param options - Send options (reply, mentions, attachments)
   * @returns Promise that resolves when message is sent
   */
  sendMessage: (
    text: string,
    options?: SendMessageOptions,
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
  /** Whether currently sending a message */
  sending: boolean;
  /** One-shot enter animation queue for locally sent messages */
  messageEnterAnimation: {
    shouldAnimateOnMount: (id: string) => boolean;
  };

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------
  /** Scroll to bottom of messages */
  scrollToBottom: () => void;
  /** Scope of this chat */
  scope: "dm" | "group";
  /** Conversation ID */
  conversationId: string;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useChat(config: UseChatConfig): UseChatReturn {
  const {
    scope,
    conversationId,
    currentUid,
    currentUserName,
    initialLimit = 50,
    autoMarkRead = true,
    sendReadReceipts,
    senderStyle,
  } = config;

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  const flatListRef = useRef<FlatList<MessageV2>>(null);
  const lastLocalReadWatermarkRef = useRef(0);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [replyTo, setReplyToState] = useState<ReplyToMetadata | null>(null);
  const [selectedMessage, setSelectedMessageState] = useState<MessageV2 | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  const messageEnterAnimation = useMessageEnterAnimationQueue();
  const messageEnterAnimationControls = useMemo(
    () => ({
      shouldAnimateOnMount: messageEnterAnimation.shouldAnimateOnMount,
    }),
    [messageEnterAnimation.shouldAnimateOnMount],
  );

  // -------------------------------------------------------------------------
  // Composed Hooks
  // -------------------------------------------------------------------------

  // === LOCAL STORAGE MODE ===
  // Use SQLite-based message storage when USE_LOCAL_STORAGE is enabled
  const localMessagesHook = useLocalMessages({
    conversationId,
    scope,
    initialLimit,
    autoRefresh: true,
  });
  const {
    messages: localRows,
    isLoading: isLocalLoading,
    isLoadingOlder: isLocalLoadingOlder,
    error: localError,
    hasMore: localHasMore,
    loadMore: loadMoreLocalMessages,
    refresh: refreshLocalMessages,
    prependMessage: prependLocalMessage,
    loadAroundMessage: loadAroundLocalMessage,
    clearMessageAnchor: clearLocalMessageAnchor,
    isMessageAnchorActive: isLocalMessageAnchorActive,
  } = localMessagesHook;

  // === FIRESTORE COMPATIBILITY MODE ===
  // Use Firestore subscriptions when the local database runtime is disabled.
  const firestoreMessagesHook = useUnifiedMessages({
    enabled: !USE_LOCAL_STORAGE,
    scope,
    conversationId,
    currentUid,
    currentUserName,
    initialLimit,
    autoMarkRead,
    sendReadReceipts,
  });

  // ── MessageV2 reference cache ──────────────────────────────────────────
  // Keeps a Map<messageId, MessageV2> so that unchanged messages preserve
  // the same JS object reference across re-renders.  FlatList compares
  // items by key AND reference; if the object is identical, the cell is
  // skipped entirely, cutting render time from O(n) to O(1) for sends.
  const messageCacheRef = useRef(new Map<string, MessageV2>());

  // Convert local messages to MessageV2 format (with reference cache)
  const localMessages = useMemo<MessageV2[]>(() => {
    if (!USE_LOCAL_STORAGE) return [];
    const cache = messageCacheRef.current;

    const normalized = localRows
      .map((row) => {
        // Cache hit: same id + same sync_status + same edited_at → reuse
        const cached = cache.get(row.id);
        if (
          cached &&
          cached.status === getMessageStatusFromSync(row.sync_status) &&
          (cached.editedAt ?? null) === (row.edited_at ?? null)
        ) {
          return cached;
        }
        // Cache miss: convert and store
        const msg = rowToMessageV2(row, currentUid);
        if (msg) cache.set(msg.id, msg);
        return msg;
      })
      .filter((m): m is MessageV2 => m !== null);
    return dedupeAndSortMessages(normalized);
  }, [localRows, currentUid]);

  // Select which data source to use based on feature flag
  const messagesHook = useMemo(() => {
    if (USE_LOCAL_STORAGE) {
      return {
        messages: localMessages,
        loading: isLocalLoading,
        error: localError ? new Error(localError) : null,
        pagination: {
          hasMoreOlder: localHasMore,
          isLoadingOlder: isLocalLoadingOlder,
        },
        loadOlder: async () => loadMoreLocalMessages(),
        refresh: refreshLocalMessages,
        loadAroundMessage: loadAroundLocalMessage,
        clearMessageAnchor: clearLocalMessageAnchor,
        isMessageAnchorActive: isLocalMessageAnchorActive,
        pendingItems: [] as OutboxItem[],
      };
    }
    return {
      ...firestoreMessagesHook,
      loadAroundMessage: () => false,
      clearMessageAnchor: () => {},
      isMessageAnchorActive: false,
    };
  }, [
    localMessages,
    isLocalLoading,
    isLocalLoadingOlder,
    localError,
    localHasMore,
    loadMoreLocalMessages,
    refreshLocalMessages,
    loadAroundLocalMessage,
    clearLocalMessageAnchor,
    isLocalMessageAnchorActive,
    firestoreMessagesHook,
  ]);

  useEffect(() => {
    lastLocalReadWatermarkRef.current = 0;
  }, [scope, conversationId, currentUid]);

  useEffect(() => {
    messageEnterAnimation.clear();
    // Clear the MessageV2 reference cache when navigating to a new thread
    messageCacheRef.current.clear();
  }, [messageEnterAnimation, scope, conversationId]);

  useEffect(() => {
    if (!USE_LOCAL_STORAGE || !autoMarkRead) return;
    if (!conversationId || !currentUid) return;
    if (messagesHook.messages.length === 0) return;

    const latestTimestamp = messagesHook.messages.reduce((latest, message) => {
      if (message.status === "failed") {
        return latest;
      }
      const timestamp = message.serverReceivedAt || message.createdAt || 0;
      return Math.max(latest, timestamp);
    }, 0);

    if (
      !latestTimestamp ||
      latestTimestamp <= lastLocalReadWatermarkRef.current
    ) {
      return;
    }

    lastLocalReadWatermarkRef.current = latestTimestamp;
    const watermark = Math.max(latestTimestamp, Date.now());

    const writeReadWatermark =
      scope === "dm"
        ? updateDMReadWatermark(conversationId, currentUid, watermark, {
            sendPublicReceipt: sendReadReceipts ?? true,
          })
        : updateGroupReadWatermark(conversationId, currentUid, watermark);

    writeReadWatermark.catch((error) => {
      log.error("Failed to update local-first read watermark", error);
    });
  }, [
    scope,
    conversationId,
    currentUid,
    autoMarkRead,
    sendReadReceipts,
    messagesHook.messages,
  ]);

  // Keyboard animation
  const keyboard = useChatKeyboard();

  // Unified scroll position + jump-pill state
  const msgs = messagesHook.messages;
  const scroll = useChatScrollState({
    messageCount: msgs.length,
    newestMessageId: msgs.length > 0 ? msgs[0].id : undefined,
    isKeyboardOpen: keyboard.isKeyboardOpen,
  });

  // -------------------------------------------------------------------------
  // Reply-To Handlers
  // -------------------------------------------------------------------------
  const setReplyTo = useCallback((reply: ReplyToMetadata | null) => {
    setReplyToState(reply);
  }, []);

  const clearReplyTo = useCallback(() => {
    setReplyToState(null);
  }, []);

  // -------------------------------------------------------------------------
  // Selection Handlers
  // -------------------------------------------------------------------------
  const selectMessage = useCallback((message: MessageV2 | null) => {
    setSelectedMessageState(message);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedMessageState(null);
  }, []);

  // -------------------------------------------------------------------------
  // FlatList Ref Handler
  // -------------------------------------------------------------------------
  const setFlatListRef = useCallback(
    (ref: FlatList<MessageV2> | null) => {
      flatListRef.current = ref;
      scroll.setFlatListRef(ref);
    },
    [scroll],
  );

  // -------------------------------------------------------------------------
  // Send Message
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (
      text: string,
      options: SendMessageOptions = {},
    ): Promise<{ success: boolean; error?: string }> => {
      const {
        replyTo: optionsReplyTo,
        mentionUids,
        mentionSpans,
        attachments,
        remoteAttachments,
        kind = "text",
        animalId,
        clearReplyOnSend = true,
      } = options;

      // Use options.replyTo if provided, otherwise use hook state
      const replyToUse = optionsReplyTo ?? replyTo;

      // Animal messages don't require text content
      if (
        kind !== "animal" &&
        !text.trim() &&
        !attachments?.length &&
        !remoteAttachments?.length
      ) {
        return { success: false, error: "Message cannot be empty" };
      }

      setSending(true);

      try {
        const sendStartMs = Date.now();

        // === LOCAL STORAGE MODE ===
        if (USE_LOCAL_STORAGE) {
          // Ensure conversation exists in SQLite
          if (scope === "dm") {
            getOrCreateDMConversation(conversationId);
          } else {
            getOrCreateGroupConversation(conversationId, "");
          }

          // Insert message into SQLite first (optimistic)
          // Compute threadRootId: if replying, thread root = replied-to msg's
          // own threadRootId (if it's already a thread reply) OR the replied-to
          // msg's ID itself (it *is* the root).
          let threadRootId: string | undefined;
          if (replyToUse) {
            const parentRow = getMessageById(replyToUse.messageId);
            if (parentRow) {
              threadRootId = parentRow.thread_root_id || replyToUse.messageId;
            } else {
              // Fallback: treat replied-to message as root
              threadRootId = replyToUse.messageId;
            }
          }

          const messageRow = insertMessage({
            conversationId,
            scope,
            senderId: currentUid,
            senderName: currentUserName,
            kind,
            // For animal messages, store animalId in text column
            text: kind === "animal" && animalId ? animalId : text.trim(),
            replyTo: replyToUse ?? undefined,
            threadRootId,
            mentions: mentionUids,
            attachments: remoteAttachments, // Already-hosted (skip upload)
            localAttachments: attachments, // Pass local attachments for upload
          });

          messageEnterAnimation.queueAnimation(messageRow.id);

          // ── Optimistic instant injection ──────────────────────────
          // Build a lightweight MessageWithAttachments from the row we
          // just inserted and prepend it to the in-memory list.  This
          // avoids re-reading all 50+ messages from SQLite + a batch
          // attachment query + full rowToMessageV2 map + dedup/sort
          // of the entire array.  FlatList only renders the one new
          // cell.
          const localAttachmentRows: AttachmentRow[] = (attachments ?? []).map(
            (att) => ({
              id: att.id,
              message_id: messageRow.id,
              kind: att.kind as AttachmentRow["kind"],
              mime: att.mime,
              local_uri: att.uri,
              remote_url: null,
              remote_path: null,
              thumb_local_uri: null,
              thumb_remote_url: null,
              size_bytes: null,
              width: null,
              height: null,
              duration_ms: att.durationMs ?? null,
              caption: att.caption ?? null,
              view_once: 0 as const,
              expires_at: null,
              download_status: "downloaded" as const,
              upload_status: "pending" as const,
            }),
          );
          const remoteAttachmentRows: AttachmentRow[] = (
            remoteAttachments ?? []
          ).map((att) => ({
            id: att.id,
            message_id: messageRow.id,
            kind: att.kind as AttachmentRow["kind"],
            mime: att.mime,
            local_uri: null,
            remote_url: att.url ?? null,
            remote_path: att.path ?? null,
            thumb_local_uri: null,
            thumb_remote_url: att.thumbUrl ?? null,
            size_bytes: att.sizeBytes ?? null,
            width: att.width ?? null,
            height: att.height ?? null,
            duration_ms: att.durationMs ?? null,
            caption: att.caption ?? null,
            view_once: att.viewOnce ? (1 as const) : (0 as const),
            expires_at: att.expiresAt ?? null,
            download_status: "none" as const,
            upload_status: "uploaded" as const,
          }));

          prependLocalMessage({
            ...messageRow,
            attachments: [...localAttachmentRows, ...remoteAttachmentRows],
          });

          // Also cache the MessageV2 so subsequent useMemo runs reuse
          // the same object reference instead of creating a new one.
          const optimisticV2 = rowToMessageV2(
            {
              ...messageRow,
              attachments: [...localAttachmentRows, ...remoteAttachmentRows],
            },
            currentUid,
          );
          if (optimisticV2) {
            messageCacheRef.current.set(optimisticV2.id, optimisticV2);
          }

          log.info("[SendPipeline] Optimistic message injected", {
            operation: "optimisticInsert",
            data: {
              messageId: messageRow.id.substring(0, 8),
              scope,
              kind,
              textLen: text.length,
              attachments:
                localAttachmentRows.length + remoteAttachmentRows.length,
              elapsedMs: Date.now() - sendStartMs,
            },
          });

          if (clearReplyOnSend) {
            clearReplyTo();
          }

          // Trigger background sync to push to Firestore
          syncPendingMessages().catch((err) => {
            log.error("Background sync failed", err);
          });

          return { success: true };
        }

        // === FIRESTORE COMPATIBILITY MODE ===
        const { outboxItem, sendPromise } = await sendMessageService({
          scope,
          conversationId,
          kind,
          text: text.trim(),
          animalId,
          replyTo: replyToUse ?? undefined,
          mentionUids,
          mentionSpans,
          localAttachments: attachments,
          senderStyle,
        });

        messageEnterAnimation.queueAnimation(outboxItem.messageId);

        log.info("[SendPipeline] Outbox item enqueued (Firestore path)", {
          operation: "outboxEnqueue",
          data: {
            messageId: outboxItem.messageId.substring(0, 8),
            scope,
            kind,
            elapsedMs: Date.now() - sendStartMs,
          },
        });

        const result = await sendPromise;

        if (result.success && clearReplyOnSend) {
          clearReplyTo();
        }

        log.info("[SendPipeline] Backend confirmed (Firestore path)", {
          operation: "sendComplete",
          data: {
            success: result.success,
            error: result.error,
            totalMs: Date.now() - sendStartMs,
          },
        });

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Send failed";
        log.error("[SendPipeline] Send error", err);
        return { success: false, error: errorMessage };
      } finally {
        setSending(false);
      }
    },
    [
      scope,
      conversationId,
      currentUid,
      currentUserName,
      replyTo,
      clearReplyTo,
      prependLocalMessage,
      messageEnterAnimation,
      senderStyle,
    ],
  );

  // -------------------------------------------------------------------------
  // Scroll to Bottom
  // -------------------------------------------------------------------------
  const scrollToBottom = useCallback(() => {
    scroll.scrollToLatest();
  }, [scroll]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return useMemo<UseChatReturn>(
    () => ({
      // Messages
      messages: messagesHook.messages,
      loading: messagesHook.loading,
      error: messagesHook.error,
      pendingItems: messagesHook.pendingItems,

      // Pagination
      pagination: messagesHook.pagination,
      loadOlder: messagesHook.loadOlder,
      refresh: messagesHook.refresh,
      loadAroundMessage: messagesHook.loadAroundMessage,
      clearMessageAnchor: messagesHook.clearMessageAnchor,
      isMessageAnchorActive: messagesHook.isMessageAnchorActive,

      // Keyboard
      keyboard,

      // Scroll
      scroll,

      // FlatList
      flatListRef,
      setFlatListRef,

      // Reply-to
      replyTo,
      setReplyTo,
      clearReplyTo,

      // Selection
      selectedMessage,
      selectMessage,
      clearSelection,

      // Send
      sendMessage,
      sending,
      messageEnterAnimation: messageEnterAnimationControls,

      // Utility
      scrollToBottom,
      scope,
      conversationId,
    }),
    [
      messagesHook.messages,
      messagesHook.loading,
      messagesHook.error,
      messagesHook.pendingItems,
      messagesHook.pagination,
      messagesHook.loadOlder,
      messagesHook.refresh,
      messagesHook.loadAroundMessage,
      messagesHook.clearMessageAnchor,
      messagesHook.isMessageAnchorActive,
      keyboard,
      scroll,
      flatListRef,
      setFlatListRef,
      replyTo,
      setReplyTo,
      clearReplyTo,
      selectedMessage,
      selectMessage,
      clearSelection,
      sendMessage,
      sending,
      messageEnterAnimationControls,
      scrollToBottom,
      scope,
      conversationId,
    ],
  );
}

export default useChat;
