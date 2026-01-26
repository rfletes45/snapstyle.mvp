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
  /** Distance from bottom in pixels */
  distanceFromBottom: number;
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
  const [distanceFromBottom, setDistanceFromBottom] = useState(0);

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

  // Scroll event handler - throttled via RN's scrollEventThrottle
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      const offset = contentOffset.y;

      lastOffsetRef.current = offset;

      // For inverted FlatList, offset 0 is the bottom (newest messages)
      const atBottom = checkIsAtBottom(offset);
      const distance = Math.max(0, offset);

      // Batch state updates
      if (atBottom !== isAtBottom || distance !== distanceFromBottom) {
        setIsAtBottom(atBottom);
        setDistanceFromBottom(distance);
      }
    },
    [checkIsAtBottom, isAtBottom, distanceFromBottom],
  );

  // Scroll end handlers for final position update
  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      const atBottom = checkIsAtBottom(offset);
      setIsAtBottom(atBottom);
      setDistanceFromBottom(Math.max(0, offset));
    },
    [checkIsAtBottom],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      const atBottom = checkIsAtBottom(offset);
      setIsAtBottom(atBottom);
      setDistanceFromBottom(Math.max(0, offset));
    },
    [checkIsAtBottom],
  );

  return {
    isAtBottom,
    distanceFromBottom,
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
