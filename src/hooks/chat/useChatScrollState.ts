/**
 * useChatScrollState Hook
 *
 * Unified source of truth for chat scroll position, jump-to-latest pill
 * visibility, and new-message tracking.  Replaces the previous split
 * between `useAtBottom` + `useNewMessageAutoscroll` with a single,
 * hysteresis-aware state machine that shows the pill both on scroll-away
 * AND on incoming messages while away.
 *
 * Architecture guarantees:
 * - Hysteresis prevents pill flicker near thresholds
 * - Newest-message detection uses message ID, not count (immune to pagination)
 * - JS auto-scroll when user is at bottom and a new message arrives (replaces
 *   native `autoscrollToTopThreshold` which caused false teleport-to-bottom
 *   during fast upward scroll / pagination)
 * - All real-time reads use refs; React state only updates on boundary crossings
 * - Content-inset-aware scrolling: accounts for KCSV's contentInset so
 *   scroll-to-bottom targets the correct offset in native builds
 *
 * @module hooks/chat/useChatScrollState
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

// Toggle for send-time / scroll diagnostics (set to true when debugging
// keyboard/scroll issues in TestFlight or native builds).
const ENABLE_SCROLL_DIAGNOSTICS = false;

// =============================================================================
// Types
// =============================================================================

export interface ChatScrollStateConfig {
  /** Number of messages currently loaded */
  messageCount: number;
  /** ID of the newest (most recent) message, or undefined if list is empty */
  newestMessageId: string | undefined;
  /** Whether keyboard is currently open (used to keep at-bottom pinning) */
  isKeyboardOpen: boolean;
}

export interface ChatScrollState {
  /** Whether user is at/near bottom of the inverted list (offset ≤ AT_BOTTOM_THRESHOLD) */
  isAtBottom: boolean;
  /** Real-time distance from bottom (ref, updated every scroll frame) */
  distanceRef: { readonly current: number };
  /** Whether the jump-to-latest pill should be visible */
  showJumpPill: boolean;
  /** Count of new messages that arrived while the user was scrolled away */
  newMessagesWhileAway: number;
  /** Attach to FlatList onScroll */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Attach to FlatList onScrollEndDrag */
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Attach to FlatList onMomentumScrollEnd */
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Scroll to latest messages and reset pill + unread count */
  scrollToLatest: () => void;
  /** Dismiss pill manually (e.g. screen-level override) */
  dismissPill: () => void;
  /** Provide the FlatList ref so scrollToLatest can drive it */
  setFlatListRef: (ref: FlatList<any> | null) => void;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Threshold (px) for "at bottom" — matches `autoscrollToTopThreshold`
 * on the native side so JS and native agree on when the user is pinned.
 */
const AT_BOTTOM_THRESHOLD = 200;

/**
 * Pill appears when user scrolls beyond this distance from bottom.
 * Set higher than HIDE to create a hysteresis band.
 */
const SHOW_PILL_THRESHOLD = 400;

/**
 * Pill disappears when user scrolls back within this distance.
 * The 300 px gap between SHOW and HIDE eliminates flicker near the edge.
 */
const HIDE_PILL_THRESHOLD = 100;

// =============================================================================
// Hook
// =============================================================================

export function useChatScrollState(
  config: ChatScrollStateConfig,
): ChatScrollState {
  const { messageCount, newestMessageId, isKeyboardOpen } = config;

  // ── React state (causes re-render on boundary crossings only) ──────────
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpPill, setShowJumpPill] = useState(false);
  const [newMessagesWhileAway, setNewMessagesWhileAway] = useState(0);

  // ── Refs (real-time, no re-render) ─────────────────────────────────────
  const distanceRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const showJumpPillRef = useRef(false);
  const flatListRef = useRef<FlatList<any> | null>(null);

  // Track the native contentInset.top reported by scroll events.
  // On the KCSV path (native builds) this equals the keyboard-driven
  // content inset that KeyboardChatScrollView applies to the inverted
  // FlatList.  On fallback (Expo) or Android it stays 0.
  const contentInsetTopRef = useRef(0);

  // Track previous newest message ID to distinguish new messages from pagination
  const prevNewestIdRef = useRef<string | undefined>(newestMessageId);
  const prevCountRef = useRef(messageCount);

  // Track keyboard state in a ref for real-time reads inside callbacks
  const isKeyboardOpenRef = useRef(isKeyboardOpen);
  useEffect(() => {
    isKeyboardOpenRef.current = isKeyboardOpen;
  }, [isKeyboardOpen]);

  // ── Scroll processing (shared by all scroll handlers) ─────────────────
  //
  // For an inverted FlatList the "visual bottom" (newest messages) is at
  // native contentOffset.y = -contentInset.top when KCSV is active.
  // Without KCSV, contentInset.top is 0 and the bottom is at offset 0.
  //
  // The true distance from the visual bottom is therefore:
  //   distance = contentOffset.y − (−contentInset.top)
  //            = contentOffset.y + contentInset.top
  //
  // This replaces the old `Math.max(0, offset)` clamp which inflated the
  // effective at-bottom threshold by the entire contentInset height on
  // native builds.
  const processScrollOffset = useCallback(
    (offset: number, contentInsetTop: number) => {
      contentInsetTopRef.current = contentInsetTop;

      const distanceFromBottom = Math.max(0, offset + contentInsetTop);
      distanceRef.current = distanceFromBottom;

      // ── isAtBottom boundary crossing ──
      const atBottom = distanceFromBottom <= AT_BOTTOM_THRESHOLD;
      if (atBottom !== isAtBottomRef.current) {
        isAtBottomRef.current = atBottom;
        setIsAtBottom(atBottom);
      }

      // ── Pill hysteresis ──
      if (
        !showJumpPillRef.current &&
        distanceFromBottom > SHOW_PILL_THRESHOLD
      ) {
        // Scrolled far enough away → show pill
        showJumpPillRef.current = true;
        setShowJumpPill(true);
      } else if (
        showJumpPillRef.current &&
        distanceFromBottom < HIDE_PILL_THRESHOLD
      ) {
        // Scrolled back close enough → hide pill + reset unread
        showJumpPillRef.current = false;
        setShowJumpPill(false);
        setNewMessagesWhileAway(0);
      }
    },
    [],
  );

  // ── FlatList event handlers ────────────────────────────────────────────
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentInset } = event.nativeEvent;
      processScrollOffset(contentOffset.y, contentInset?.top ?? 0);
    },
    [processScrollOffset],
  );

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentInset } = event.nativeEvent;
      processScrollOffset(contentOffset.y, contentInset?.top ?? 0);
    },
    [processScrollOffset],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentInset } = event.nativeEvent;
      processScrollOffset(contentOffset.y, contentInset?.top ?? 0);
    },
    [processScrollOffset],
  );

  // ── Scroll-to-latest action ────────────────────────────────────────────
  const scrollToLatest = useCallback(() => {
    // On the KCSV path the inverted list's visual bottom sits at
    // contentOffset.y = -contentInset.top, not 0.  Using the tracked
    // inset keeps the scroll target correct regardless of whether KCSV
    // is active (native) or not (Expo fallback, where inset stays 0).
    flatListRef.current?.scrollToOffset({
      offset: -contentInsetTopRef.current,
      animated: true,
    });
    // Reset state immediately so the pill disappears on tap
    showJumpPillRef.current = false;
    setShowJumpPill(false);
    setNewMessagesWhileAway(0);
  }, []);

  const dismissPill = useCallback(() => {
    showJumpPillRef.current = false;
    setShowJumpPill(false);
    setNewMessagesWhileAway(0);
  }, []);

  const setFlatListRef = useCallback((ref: FlatList<any> | null) => {
    flatListRef.current = ref;
  }, []);

  // ── New-message detection ──────────────────────────────────────────────
  // Uses newestMessageId to distinguish genuinely new messages from
  // pagination (which adds old messages but keeps the newest unchanged).
  useEffect(() => {
    const isNewMessage =
      newestMessageId !== undefined &&
      prevNewestIdRef.current !== undefined &&
      newestMessageId !== prevNewestIdRef.current &&
      messageCount > prevCountRef.current;

    if (isNewMessage) {
      if (!isAtBottomRef.current) {
        // User is scrolled away → show pill, increment unread
        showJumpPillRef.current = true;
        setShowJumpPill(true);
        const added = messageCount - prevCountRef.current;
        setNewMessagesWhileAway((prev) => prev + added);
      } else {
        // User IS at bottom → scroll so the new message is visible
        // immediately.  On the KCSV path (native builds) the inverted
        // list's visual bottom is at contentOffset.y = -contentInset.top,
        // not 0.  Scrolling to raw offset 0 would place the newest
        // message behind the keyboard — the exact "teleport downward"
        // bug observed in TestFlight.  Using the tracked contentInset
        // keeps the target correct for both native (KCSV) and Expo
        // fallback (where contentInset.top stays 0).
        const targetOffset = -contentInsetTopRef.current;

        if (ENABLE_SCROLL_DIAGNOSTICS) {
          // eslint-disable-next-line no-console
          console.log("[ChatScroll] auto-scroll on new message", {
            newestMessageId: newestMessageId?.substring(0, 8),
            contentInsetTop: contentInsetTopRef.current,
            targetOffset,
            distanceFromBottom: distanceRef.current,
          });
        }

        flatListRef.current?.scrollToOffset({
          offset: targetOffset,
          animated: false,
        });
      }
    }

    prevNewestIdRef.current = newestMessageId;
    prevCountRef.current = messageCount;
  }, [newestMessageId, messageCount]);

  return {
    isAtBottom,
    distanceRef,
    showJumpPill,
    newMessagesWhileAway,
    onScroll,
    onScrollEndDrag,
    onMomentumScrollEnd,
    scrollToLatest,
    dismissPill,
    setFlatListRef,
  };
}
