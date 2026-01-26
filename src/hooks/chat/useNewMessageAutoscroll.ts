/**
 * useNewMessageAutoscroll Hook
 *
 * Implements smart auto-scroll rules for new messages:
 * - Always scroll when keyboard is open and new message arrives
 * - Scroll if within 30 messages of bottom when keyboard closed
 * - Show "return to bottom" pill if too far from bottom
 *
 * @module hooks/chat/useNewMessageAutoscroll
 */

import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FlatList } from "react-native";

const log = createLogger("useNewMessageAutoscroll");

// =============================================================================
// Types
// =============================================================================

export interface AutoscrollConfig {
  /** Current message count */
  messageCount: number;
  /** Whether keyboard is currently open */
  isKeyboardOpen: boolean;
  /** Whether user is at bottom of list */
  isAtBottom: boolean;
  /** Distance from bottom in pixels */
  distanceFromBottom?: number;
  /** Message threshold for auto-scroll when keyboard closed (default: 30) */
  messageThreshold?: number;
  /** Pixel threshold for "close to bottom" (default: 2400 = ~30 messages) */
  pixelThreshold?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface AutoscrollState {
  /** Whether to show "return to bottom" pill */
  showReturnPill: boolean;
  /** Count of unread messages while scrolled away */
  unreadCount: number;
  /** Dismiss the return pill (e.g., when user scrolls to bottom manually) */
  dismissPill: () => void;
  /** Callback to run when new messages arrive */
  onNewMessages: (newCount: number) => { shouldScroll: boolean };
  /** Scroll to bottom and dismiss pill */
  scrollToBottom: () => void;
  /** Set the FlatList ref for scrolling */
  setFlatListRef: (ref: FlatList<any> | null) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MESSAGE_THRESHOLD = 30;
const DEFAULT_PIXEL_THRESHOLD = 2400; // ~30 messages * 80px avg height

// =============================================================================
// Hook Implementation
// =============================================================================

export function useNewMessageAutoscroll(
  config: AutoscrollConfig,
): AutoscrollState {
  const {
    messageCount,
    isKeyboardOpen,
    isAtBottom,
    distanceFromBottom = 0,
    messageThreshold = DEFAULT_MESSAGE_THRESHOLD,
    pixelThreshold = DEFAULT_PIXEL_THRESHOLD,
    debug = false,
  } = config;

  const [showReturnPill, setShowReturnPill] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Track previous message count to detect new messages
  const prevMessageCountRef = useRef(messageCount);
  const flatListRef = useRef<FlatList<any> | null>(null);
  const wasAtBottomRef = useRef(isAtBottom);

  // Set FlatList ref for scrolling
  const setFlatListRef = useCallback((ref: FlatList<any> | null) => {
    flatListRef.current = ref;
  }, []);

  // Determine if we should auto-scroll based on current state
  const shouldAutoScroll = useCallback((): boolean => {
    // Rule: Keyboard open → always scroll to show new message
    if (isKeyboardOpen) {
      if (debug) {
        log.debug("Auto-scroll: keyboard open", {
          operation: "shouldAutoScroll",
          data: { reason: "keyboardOpen" },
        });
      }
      return true;
    }

    // Rule: At bottom or very close → scroll
    if (isAtBottom) {
      if (debug) {
        log.debug("Auto-scroll: at bottom", {
          operation: "shouldAutoScroll",
          data: { reason: "atBottom", isAtBottom },
        });
      }
      return true;
    }

    // Rule: Within threshold distance → scroll
    // Use pixel threshold as a proxy for message count
    if (distanceFromBottom <= pixelThreshold) {
      if (debug) {
        log.debug("Auto-scroll: within threshold", {
          operation: "shouldAutoScroll",
          data: {
            reason: "withinThreshold",
            distanceFromBottom,
            pixelThreshold,
          },
        });
      }
      return true;
    }

    // Too far from bottom → don't scroll, show pill instead
    if (debug) {
      log.debug("No auto-scroll: too far from bottom", {
        operation: "shouldAutoScroll",
        data: {
          reason: "tooFar",
          distanceFromBottom,
          pixelThreshold,
        },
      });
    }
    return false;
  }, [isKeyboardOpen, isAtBottom, distanceFromBottom, pixelThreshold, debug]);

  // Handle new messages arriving
  const onNewMessages = useCallback(
    (newCount: number): { shouldScroll: boolean } => {
      const messagesAdded = newCount - prevMessageCountRef.current;

      if (messagesAdded <= 0) {
        return { shouldScroll: false };
      }

      if (debug) {
        log.debug("New messages detected", {
          operation: "onNewMessages",
          data: {
            messagesAdded,
            newCount,
            prevCount: prevMessageCountRef.current,
          },
        });
      }

      prevMessageCountRef.current = newCount;

      const scroll = shouldAutoScroll();

      if (!scroll) {
        // Don't scroll, show pill and track unread
        setShowReturnPill(true);
        setUnreadCount((prev) => prev + messagesAdded);

        if (debug) {
          log.debug("Showing return pill", {
            operation: "onNewMessages",
            data: { unreadCount: unreadCount + messagesAdded },
          });
        }
      }

      return { shouldScroll: scroll };
    },
    [shouldAutoScroll, debug, unreadCount],
  );

  // Scroll to bottom and dismiss pill
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current) {
      // For inverted list, scrollToOffset(0) goes to bottom (newest)
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });

      if (debug) {
        log.debug("Scrolling to bottom", { operation: "scrollToBottom" });
      }
    }

    setShowReturnPill(false);
    setUnreadCount(0);
  }, [debug]);

  // Dismiss the pill (e.g., when user manually scrolls to bottom)
  const dismissPill = useCallback(() => {
    setShowReturnPill(false);
    setUnreadCount(0);
  }, []);

  // Auto-dismiss pill when user scrolls back to bottom
  useEffect(() => {
    if (isAtBottom && !wasAtBottomRef.current) {
      // User just scrolled to bottom
      dismissPill();

      if (debug) {
        log.debug("Auto-dismissing pill - user scrolled to bottom", {
          operation: "autoDissmiss",
        });
      }
    }
    wasAtBottomRef.current = isAtBottom;
  }, [isAtBottom, dismissPill, debug]);

  // Detect new messages and trigger scroll if needed
  useEffect(() => {
    if (messageCount > prevMessageCountRef.current) {
      const result = onNewMessages(messageCount);

      if (result.shouldScroll && flatListRef.current) {
        // Small delay to let the new message render
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 50);
      }
    } else {
      prevMessageCountRef.current = messageCount;
    }
  }, [messageCount, onNewMessages]);

  return {
    showReturnPill,
    unreadCount,
    dismissPill,
    onNewMessages,
    scrollToBottom,
    setFlatListRef,
  };
}
