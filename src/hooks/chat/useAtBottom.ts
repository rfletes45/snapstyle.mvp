/**
 * useAtBottom Hook
 *
 * Detects if user is scrolled to the bottom of an inverted FlatList.
 * For inverted lists, "bottom" means offset ≈ 0 (latest messages at top of content).
 *
 * @module hooks/chat/useAtBottom
 */

import { createLogger } from "@/utils/log";
import { useCallback, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

const log = createLogger("useAtBottom");

// =============================================================================
// Types
// =============================================================================

export interface AtBottomConfig {
  /** Pixel threshold to consider "at bottom" (default: 200) */
  threshold?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface AtBottomState {
  /** Whether user is at bottom (within threshold) */
  isAtBottom: boolean;
  /** Distance from bottom in pixels (snapshot at last render) */
  distanceFromBottom: number;
  /**
   * Ref holding the latest distance from bottom, updated on every scroll
   * frame.  Prefer this over the `distanceFromBottom` state value when you
   * need a real-time read inside a callback (e.g. shouldAutoScroll).
   */
  distanceRef: { readonly current: number };
  /** Handler to attach to FlatList onScroll */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Handler for scroll end events */
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Handler for momentum end */
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Force check and update state */
  checkIsAtBottom: (offset: number) => boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_THRESHOLD = 200; // ~2-3 messages worth of scroll

// =============================================================================
// Hook Implementation
// =============================================================================

export function useAtBottom(config: AtBottomConfig = {}): AtBottomState {
  const { threshold = DEFAULT_THRESHOLD, debug = false } = config;

  const [isAtBottom, setIsAtBottom] = useState(true); // Start at bottom
  // Distance lives in a ref so high-frequency scroll events don't trigger
  // re-renders.  The ref is exposed directly for real-time reads.
  const distanceRef = useRef(0);

  // Track last known offset for stable updates
  const lastOffsetRef = useRef(0);
  const isAtBottomRef = useRef(true);

  // Check if at bottom based on scroll offset
  // For INVERTED lists: offset 0 = bottom (newest messages)
  const checkIsAtBottom = useCallback(
    (offset: number): boolean => {
      const atBottom = offset <= threshold;

      if (debug && atBottom !== isAtBottomRef.current) {
        log.debug("At bottom state changed", {
          operation: "checkAtBottom",
          data: { offset, threshold, atBottom },
        });
      }

      isAtBottomRef.current = atBottom;
      return atBottom;
    },
    [threshold, debug],
  );

  // Scroll event handler — only commits state on threshold boundary crossing
  // to avoid re-rendering ChatMessageList (and re-computing dependents like
  // maintainVisibleContentPosition) on every 16 ms scroll frame.
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = Math.max(0, event.nativeEvent.contentOffset.y);

      lastOffsetRef.current = offset;
      distanceRef.current = offset;

      // Only update React state when crossing the threshold boundary
      const atBottom = offset <= threshold;
      if (atBottom !== isAtBottomRef.current) {
        isAtBottomRef.current = atBottom;
        setIsAtBottom(atBottom);
      }
    },
    [threshold],
  );

  // Scroll end handlers commit final position state
  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = Math.max(0, event.nativeEvent.contentOffset.y);
      lastOffsetRef.current = offset;
      distanceRef.current = offset;
      const atBottom = offset <= threshold;
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
    },
    [threshold],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = Math.max(0, event.nativeEvent.contentOffset.y);
      lastOffsetRef.current = offset;
      distanceRef.current = offset;
      const atBottom = offset <= threshold;
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
    },
    [threshold],
  );

  return {
    isAtBottom,
    distanceFromBottom: distanceRef.current,
    distanceRef,
    onScroll,
    onScrollEndDrag,
    onMomentumScrollEnd,
    checkIsAtBottom,
  };
}

// =============================================================================
// Utility: Estimate message count from scroll distance
// =============================================================================

/**
 * Estimate how many messages from bottom based on scroll offset
 * Assumes average message height of ~80px
 */
export function estimateMessageCountFromOffset(
  offset: number,
  avgMessageHeight: number = 80,
): number {
  return Math.ceil(offset / avgMessageHeight);
}
