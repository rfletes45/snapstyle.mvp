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

import { useCallback, useEffect, useRef, useState } from "react";
import type { FlatList } from "react-native";

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
  /**
   * Ref holding the latest distance-from-bottom value (pixels).
   * Read inside shouldAutoScroll for a real-time value without
   * adding a state dependency that recreates the callback every frame.
   */
  distanceRef?: { readonly current: number };
  /** Pixel threshold for "close to bottom" (default: 2400 = ~30 messages) */
  pixelThreshold?: number;
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
    distanceRef,
    pixelThreshold = DEFAULT_PIXEL_THRESHOLD,
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
      return true;
    }

    // Rule: At bottom or very close → scroll
    if (isAtBottom) {
      return true;
    }

    // Rule: Within threshold distance → scroll
    // Read from the ref for a real-time value (avoids stale closure from
    // state-based distanceFromBottom which lagged behind by a render cycle).
    const distance = distanceRef?.current ?? Number.POSITIVE_INFINITY;
    if (distance <= pixelThreshold) {
      return true;
    }

    // Too far from bottom → don't scroll, show pill instead
    return false;
  }, [
    isKeyboardOpen,
    isAtBottom,
    distanceRef,
    pixelThreshold,
  ]);

  // Handle new messages arriving
  const onNewMessages = useCallback(
    (newCount: number): { shouldScroll: boolean } => {
      const messagesAdded = newCount - prevMessageCountRef.current;

      if (messagesAdded <= 0) {
        return { shouldScroll: false };
      }

      prevMessageCountRef.current = newCount;

      const scroll = shouldAutoScroll();

      if (!scroll) {
        // Don't scroll, show pill and track unread
        setShowReturnPill(true);
        setUnreadCount((prev) => prev + messagesAdded);

      }

      return { shouldScroll: scroll };
    },
    [shouldAutoScroll],
  );

  // Scroll to bottom and dismiss pill
  const scrollToBottom = useCallback(() => {
    if (flatListRef.current) {
      // For inverted list, scrollToOffset(0) goes to bottom (newest)
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }

    setShowReturnPill(false);
    setUnreadCount(0);
  }, []);

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
    }
    wasAtBottomRef.current = isAtBottom;
  }, [isAtBottom, dismissPill]);

  // Detect new messages and trigger scroll if needed
  useEffect(() => {
    if (messageCount > prevMessageCountRef.current) {
      const result = onNewMessages(messageCount);

      if (result.shouldScroll && flatListRef.current) {
        // For an inverted FlatList, offset 0 is the bottom (newest). Use a
        // non-animated scroll so it completes in one frame and doesn't fight
        // maintainVisibleContentPosition which adjusts scroll position to
        // compensate for content-size changes (e.g. grouped-message timestamp
        // removal).  A delayed animated scroll previously caused visible
        // jitter on every consecutive send.
        flatListRef.current.scrollToOffset({ offset: 0, animated: false });
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
