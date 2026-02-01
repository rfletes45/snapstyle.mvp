/**
 * useHighlightedMessage Hook
 *
 * Manages the highlighted message state for reply navigation.
 * When a user taps a reply bubble, the original message is scrolled to
 * and highlighted with a visual pulse animation.
 *
 * Features:
 * - Tracks highlighted message ID
 * - Auto-clears highlight after configurable duration
 * - Provides animated value for smooth highlight transitions
 * - Stores original scroll position for jump-back functionality
 *
 * @module hooks/useHighlightedMessage
 */

import { useCallback, useRef, useState } from "react";
import {
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

interface UseHighlightedMessageOptions {
  /** Duration in ms before highlight auto-clears (default: 2000) */
  highlightDuration?: number;
  /** Duration in ms for fade-in animation (default: 300) */
  fadeInDuration?: number;
  /** Duration in ms for fade-out animation (default: 500) */
  fadeOutDuration?: number;
  /** Debug logging enabled */
  debug?: boolean;
}

interface UseHighlightedMessageReturn {
  /** Currently highlighted message ID (null if none) */
  highlightedMessageId: string | null;
  /** Animated value for highlight opacity (0-1) */
  highlightOpacity: ReturnType<typeof useSharedValue<number>>;
  /** Set a message as highlighted (auto-clears after duration) */
  highlightMessage: (messageId: string) => void;
  /** Manually clear the highlight */
  clearHighlight: () => void;
  /** Original scroll position before jump (for return navigation) */
  originalScrollPosition: number | null;
  /** Store current scroll position before jumping to a message */
  storeScrollPosition: (position: number) => void;
  /** Clear the stored scroll position */
  clearScrollPosition: () => void;
  /** Whether there's a stored position to return to */
  canReturnToPosition: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export function useHighlightedMessage(
  options: UseHighlightedMessageOptions = {},
): UseHighlightedMessageReturn {
  const {
    highlightDuration = 2000,
    fadeInDuration = 300,
    fadeOutDuration = 500,
    debug = false,
  } = options;

  // State
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [originalScrollPosition, setOriginalScrollPosition] = useState<
    number | null
  >(null);

  // Refs
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated values
  const highlightOpacity = useSharedValue(0);

  // Debug log helper
  const log = useCallback(
    (message: string, data?: unknown) => {
      if (debug) {
        console.log(`[useHighlightedMessage] ${message}`, data ?? "");
      }
    },
    [debug],
  );

  // Clear any pending timeout
  const clearPendingTimeout = useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }
  }, []);

  // Highlight a message with animation
  const highlightMessage = useCallback(
    (messageId: string) => {
      log("Highlighting message", { messageId });

      // Clear any existing highlight
      clearPendingTimeout();

      // Set the highlighted message
      setHighlightedMessageId(messageId);

      // Animate opacity: fade in → hold → fade out
      highlightOpacity.value = withSequence(
        // Fade in
        withTiming(1, { duration: fadeInDuration }),
        // Hold at full opacity
        withDelay(
          highlightDuration - fadeInDuration - fadeOutDuration,
          // Fade out
          withTiming(0, { duration: fadeOutDuration }),
        ),
      );

      // Clear highlighted message ID after full animation
      clearTimeoutRef.current = setTimeout(() => {
        log("Auto-clearing highlight");
        setHighlightedMessageId(null);
        clearTimeoutRef.current = null;
      }, highlightDuration);
    },
    [
      clearPendingTimeout,
      fadeInDuration,
      fadeOutDuration,
      highlightDuration,
      highlightOpacity,
      log,
    ],
  );

  // Manually clear the highlight
  const clearHighlight = useCallback(() => {
    log("Manually clearing highlight");
    clearPendingTimeout();
    setHighlightedMessageId(null);
    highlightOpacity.value = withTiming(0, { duration: fadeOutDuration / 2 });
  }, [clearPendingTimeout, fadeOutDuration, highlightOpacity, log]);

  // Store scroll position for return navigation
  const storeScrollPosition = useCallback(
    (position: number) => {
      log("Storing scroll position", { position });
      setOriginalScrollPosition(position);
    },
    [log],
  );

  // Clear stored scroll position
  const clearScrollPosition = useCallback(() => {
    log("Clearing scroll position");
    setOriginalScrollPosition(null);
  }, [log]);

  return {
    highlightedMessageId,
    highlightOpacity,
    highlightMessage,
    clearHighlight,
    originalScrollPosition,
    storeScrollPosition,
    clearScrollPosition,
    canReturnToPosition: originalScrollPosition !== null,
  };
}

export default useHighlightedMessage;
