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
 * const { messages, loading, loadOlder } = useMessagesV2(scope, conversationId, uid);
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
 * chat.autoscroll.showReturnPill
 * chat.replyTo
 * chat.sendMessage("Hello!")
 * ```
 *
 * @module hooks/useChat
 */

import { sendMessage as sendMessageService } from "@/services/messaging/send";
import {
  LocalAttachment,
  MessageKind,
  MessageV2,
  OutboxItem,
  ReplyToMetadata,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useMemo, useRef, useState } from "react";
import type { FlatList } from "react-native";
import { useAtBottom, type AtBottomState } from "./chat/useAtBottom";
import {
  useChatKeyboard,
  type ChatKeyboardState,
} from "./chat/useChatKeyboard";
import {
  useNewMessageAutoscroll,
  type AutoscrollState,
} from "./chat/useNewMessageAutoscroll";
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
  /** Pixel threshold for "at bottom" detection (default: 200) */
  atBottomThreshold?: number;
  /** Message threshold for auto-scroll (default: 30) */
  autoscrollMessageThreshold?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  /** Reply to a specific message */
  replyTo?: ReplyToMetadata;
  /** User IDs mentioned in the message */
  mentionUids?: string[];
  /** Local attachments to upload */
  attachments?: LocalAttachment[];
  /** Message kind (default: "text") */
  kind?: MessageKind;
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

  // -------------------------------------------------------------------------
  // Keyboard Animation
  // -------------------------------------------------------------------------
  /** Keyboard animation state and values */
  keyboard: ChatKeyboardState;

  // -------------------------------------------------------------------------
  // Scroll State
  // -------------------------------------------------------------------------
  /** Scroll position state and handlers */
  scroll: AtBottomState;

  // -------------------------------------------------------------------------
  // Auto-scroll
  // -------------------------------------------------------------------------
  /** Auto-scroll state and handlers */
  autoscroll: AutoscrollState;

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
    atBottomThreshold = 200,
    autoscrollMessageThreshold = 30,
    debug = false,
  } = config;

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  const flatListRef = useRef<FlatList<MessageV2>>(null);

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [replyTo, setReplyToState] = useState<ReplyToMetadata | null>(null);
  const [selectedMessage, setSelectedMessageState] = useState<MessageV2 | null>(
    null,
  );
  const [sending, setSending] = useState(false);

  // -------------------------------------------------------------------------
  // Composed Hooks
  // -------------------------------------------------------------------------

  // Messages subscription
  const messagesHook = useUnifiedMessages({
    scope,
    conversationId,
    currentUid,
    currentUserName,
    initialLimit,
    autoMarkRead,
    sendReadReceipts,
    debug,
  });

  // Keyboard animation
  const keyboard = useChatKeyboard({ debug });

  // Scroll position tracking
  const scroll = useAtBottom({
    threshold: atBottomThreshold,
    debug,
  });

  // Auto-scroll on new messages
  const autoscroll = useNewMessageAutoscroll({
    messageCount: messagesHook.messages.length,
    isKeyboardOpen: keyboard.isKeyboardOpen,
    isAtBottom: scroll.isAtBottom,
    distanceFromBottom: scroll.distanceFromBottom,
    messageThreshold: autoscrollMessageThreshold,
    pixelThreshold: autoscrollMessageThreshold * 80, // ~80px per message
    debug,
  });

  // -------------------------------------------------------------------------
  // Reply-To Handlers
  // -------------------------------------------------------------------------
  const setReplyTo = useCallback(
    (reply: ReplyToMetadata | null) => {
      setReplyToState(reply);
      if (debug) {
        log.debug("Reply state changed", {
          operation: "setReplyTo",
          data: {
            hasReply: !!reply,
            messageId: reply?.messageId?.substring(0, 8),
          },
        });
      }
    },
    [debug],
  );

  const clearReplyTo = useCallback(() => {
    setReplyToState(null);
  }, []);

  // -------------------------------------------------------------------------
  // Selection Handlers
  // -------------------------------------------------------------------------
  const selectMessage = useCallback(
    (message: MessageV2 | null) => {
      setSelectedMessageState(message);
      if (debug) {
        log.debug("Message selection changed", {
          operation: "selectMessage",
          data: {
            hasSelection: !!message,
            messageId: message?.id?.substring(0, 8),
          },
        });
      }
    },
    [debug],
  );

  const clearSelection = useCallback(() => {
    setSelectedMessageState(null);
  }, []);

  // -------------------------------------------------------------------------
  // FlatList Ref Handler
  // -------------------------------------------------------------------------
  const setFlatListRef = useCallback(
    (ref: FlatList<MessageV2> | null) => {
      (
        flatListRef as React.MutableRefObject<FlatList<MessageV2> | null>
      ).current = ref;
      autoscroll.setFlatListRef(ref);
    },
    [autoscroll],
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
        attachments,
        kind = "text",
        clearReplyOnSend = true,
      } = options;

      // Use options.replyTo if provided, otherwise use hook state
      const replyToUse = optionsReplyTo ?? replyTo;

      if (!text.trim() && !attachments?.length) {
        return { success: false, error: "Message cannot be empty" };
      }

      setSending(true);

      try {
        if (debug) {
          log.debug("Sending message", {
            operation: "send",
            data: {
              scope,
              textLength: text.length,
              hasReply: !!replyToUse,
              mentionCount: mentionUids?.length ?? 0,
              attachmentCount: attachments?.length ?? 0,
            },
          });
        }

        const { sendPromise } = await sendMessageService({
          scope,
          conversationId,
          kind,
          text: text.trim(),
          replyTo: replyToUse ?? undefined,
          mentionUids,
          localAttachments: attachments,
        });

        const result = await sendPromise;

        if (result.success && clearReplyOnSend) {
          clearReplyTo();
        }

        if (debug) {
          log.debug("Message send completed", {
            operation: "sendComplete",
            data: { success: result.success, error: result.error },
          });
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Send failed";
        log.error("Message send error", err);
        return { success: false, error: errorMessage };
      } finally {
        setSending(false);
      }
    },
    [scope, conversationId, replyTo, clearReplyTo, debug],
  );

  // -------------------------------------------------------------------------
  // Scroll to Bottom
  // -------------------------------------------------------------------------
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
    autoscroll.dismissPill();
  }, [autoscroll]);

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

      // Keyboard
      keyboard,

      // Scroll
      scroll,

      // Auto-scroll
      autoscroll,

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
      keyboard,
      scroll,
      autoscroll,
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
      scrollToBottom,
      scope,
      conversationId,
    ],
  );
}

export default useChat;
