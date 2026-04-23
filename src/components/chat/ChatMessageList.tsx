/**
 * ChatMessageList Component
 *
 * Keyboard-aware inverted FlatList for chat messages.
 * Handles:
 * - Inverted list rendering (newest at bottom)
 * - Keyboard-synchronised content repositioning (via KeyboardChatScrollView)
 * - "At bottom" detection for smart scroll
 * - Performance optimizations
 *
 * Keyboard layout is driven entirely on the UI thread by
 * KeyboardChatScrollView (from react-native-keyboard-controller).
 * It uses contentInset (not content spacers), so
 * maintainVisibleContentPosition never fights the keyboard motion.
 *
 * @module components/chat/ChatMessageList
 */

import { useChatScrollState } from "@/hooks/chat/useChatScrollState";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  FlatList,
  FlatListProps,
  ListRenderItemInfo,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { ReturnToBottomPill } from "./ReturnToBottomPill";

// =============================================================================
// Types
// =============================================================================

export interface ChatMessageListProps<T> {
  /** Message data array */
  data: T[];
  /** Render function for each message */
  renderItem: (info: ListRenderItemInfo<T>) => React.ReactElement | null;
  /** Key extractor */
  keyExtractor: (item: T, index: number) => string;
  /**
   * ID of the newest (most recent) message in `data`, used to distinguish
   * genuinely new messages from pagination-loaded old messages.
   * For an inverted list this is typically `keyExtractor(data[0], 0)`.
   */
  newestMessageId: string | undefined;
  /**
   * Scroll component factory — screens pass a memoised callback that returns
   * a KeyboardChatScrollView configured with the correct offset / lift
   * behaviour for the current conversation.
   */
  renderScrollComponent: (
    props: ScrollViewProps,
  ) => React.ReactElement<ScrollViewProps>;
  /** Whether keyboard is open (for auto-scroll rules) */
  isKeyboardOpen?: boolean;
  /** Header component (load more button) */
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** Empty component */
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** Called when at-bottom state changes */
  onAtBottomChange?: (isAtBottom: boolean) => void;
  /**
   * Bottom offset for the "return to bottom" pill (px above screen bottom).
   * Typically composerHeight + safeAreaBottom + small padding.
   */
  pillBottomOffset?: number;
  /**
   * When true, the return-to-bottom pill is suppressed regardless of
   * scroll position.  Used by screens to hand off floating-button
   * real-estate to another overlay (e.g. the reply-jump "Back to reply"
   * button) and avoid stacking two overlapping buttons.
   */
  suppressReturnToBottom?: boolean;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Custom content container style */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra FlatList props */
  flatListProps?: Partial<FlatListProps<T>>;
  /**
   * Called when the return-to-bottom pill is pressed, BEFORE scrolling.
   * Used to dismiss all transient chat overlay UI (sheets, keyboard)
   * through the unified collapse path.
   */
  onDismissTransientUi?: () => void;
}

export interface ChatMessageListRef {
  /** Scroll to bottom (newest messages) */
  scrollToBottom: (animated?: boolean) => void;
  /** Scroll to a specific index */
  scrollToIndex: (index: number, animated?: boolean) => void;
  /**
   * Scroll to a raw content offset.  Used by reply-navigation to return
   * the user to the exact scroll position they were at before jumping
   * to a referenced message.
   */
  scrollToOffset: (offset: number, animated?: boolean) => void;
  /**
   * Returns the most recently observed content offset (from the last
   * onScroll event).  Used by reply-navigation to snapshot the user's
   * position before scrolling to the reply target.
   */
  getLastScrollOffset: () => number;
  /** Get the FlatList ref */
  getFlatListRef: () => FlatList<any> | null;
  /**
   * Reset the per-target scrollToIndex retry counter.  Callers invoke this
   * whenever a new deep-jump request begins so a fresh retry budget is
   * available even when re-jumping to the same index.
   */
  resetScrollToIndexAttempts: () => void;
}

// =============================================================================
// Component
// =============================================================================

function ChatMessageListInner<T>(
  props: ChatMessageListProps<T>,
  ref: React.Ref<ChatMessageListRef>,
): React.JSX.Element {
  const {
    data,
    renderItem,
    keyExtractor,
    newestMessageId,
    renderScrollComponent,
    isKeyboardOpen = false,
    ListHeaderComponent,
    ListEmptyComponent,
    onAtBottomChange,
    pillBottomOffset = 96,
    suppressReturnToBottom = false,
    style,
    contentContainerStyle,
    flatListProps,
    onDismissTransientUi,
  } = props;

  const flatListRef = useRef<FlatList<T>>(null);
  // Track most recent scroll offset so parent screens (via imperative ref)
  // can snapshot the user's scroll position before triggering a scroll-to-
  // message, and later restore it (back-to-reply).
  const lastScrollOffsetRef = useRef<number>(0);

  // ── Unified scroll state (replaces useAtBottom + useNewMessageAutoscroll) ──
  const scrollState = useChatScrollState({
    messageCount: data.length,
    newestMessageId,
    isKeyboardOpen,
  });

  // Wire FlatList ref into the scroll state hook
  const { setFlatListRef } = scrollState;
  useEffect(() => {
    setFlatListRef(flatListRef.current);
  }, [setFlatListRef]);

  // Notify parent of at-bottom changes
  useEffect(() => {
    onAtBottomChange?.(scrollState.isAtBottom);
  }, [scrollState.isAtBottom, onAtBottomChange]);

  // Content container style
  const dynamicContentStyle = useMemo(
    () => [styles.contentContainer, contentContainerStyle],
    [contentContainerStyle],
  );

  // maintainVisibleContentPosition keeps scroll position stable when items are
  // added above the viewport (pagination) or below it (new messages while
  // scrolled up).
  //
  // autoscrollToTopThreshold is intentionally OMITTED.  The native auto-scroll
  // fires whenever content changes and the offset is within the threshold of 0.
  // During fast upward scroll, pagination loads can transiently place the
  // offset near 0 *before* the position-maintenance adjustment lands, causing
  // the native auto-scroll to snap the user back to the bottom ("teleport"
  // bug).  Instead, new-message auto-scroll is handled in JS by
  // useChatScrollState, which only fires when the user is genuinely at-bottom
  // AND a new message arrives.
  const maintainVisibleContentPosition = useMemo(
    () => ({
      minIndexForVisible: 1,
    }),
    [],
  );

  // Scroll to bottom (for inverted list, visual bottom = -contentInset.top
  // on the KCSV path, or offset 0 on fallback).  Delegates to the unified
  // scroll state's scrollToLatest which uses the inset-aware offset.
  const scrollToBottom = useCallback(
    (animated = true) => {
      scrollState.scrollToLatest();
    },
    [scrollState],
  );

  // Scroll to index
  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      if (index >= 0 && index < data.length) {
        flatListRef.current?.scrollToIndex({
          index,
          animated,
          viewPosition: 0.5,
        });
      }
    },
    [data.length],
  );

  // Scroll to raw offset (used by reply-navigation to restore prior position)
  const scrollToOffset = useCallback((offset: number, animated = true) => {
    flatListRef.current?.scrollToOffset({ offset, animated });
  }, []);

  // Per-target scrollToIndex retry bookkeeping.  Declared here (ahead of
  // `useImperativeHandle`) so the imperative `resetScrollToIndexAttempts`
  // can write to it.
  const scrollToIndexAttemptsRef = useRef<{ index: number; attempts: number }>({
    index: -1,
    attempts: 0,
  });

  // Expose ref methods
  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom,
      scrollToIndex,
      scrollToOffset,
      getLastScrollOffset: () => lastScrollOffsetRef.current,
      getFlatListRef: () => flatListRef.current,
      // Reset the per-target scrollToIndex retry counter.  Called from
      // ChatScreen / GroupChatScreen whenever a new deep-jump request
      // arrives (via `jumpRequestId`).  Without this reset, re-jumping to
      // the SAME index (e.g. re-tapping a reply or a search result) would
      // inherit an exhausted attempts counter from the prior jump and the
      // retry would immediately fall back to `highestMeasuredFrameIndex`
      // instead of re-attempting the real target.
      resetScrollToIndexAttempts: () => {
        scrollToIndexAttemptsRef.current = { index: -1, attempts: 0 };
      },
    }),
    [scrollToBottom, scrollToIndex, scrollToOffset],
  );

  // Handle scroll-to-index failure.
  // FlatList invokes this whenever a target index can't be scrolled to
  // because the cell isn't measured yet (virtualization hasn't mounted it).
  // A single retry at `highestMeasuredFrameIndex` was not reliable for
  // deep-jumps: after an anchor page loads, the target cell can take
  // several frames to mount + measure.  We track per-target attempts on a
  // ref and retry the ORIGINAL index up to 5 times with increasing delays.
  // Only after that do we fall back to the measured-frame index.
  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number }) => {
      const state = scrollToIndexAttemptsRef.current;
      if (state.index !== info.index) {
        state.index = info.index;
        state.attempts = 0;
      }
      const MAX_ATTEMPTS = 5;
      state.attempts += 1;
      if (state.attempts > MAX_ATTEMPTS) {
        // Last resort: jump to the nearest measured frame so the user at
        // least moves in the right direction instead of staying put.
        flatListRef.current?.scrollToIndex({
          index: Math.min(info.index, info.highestMeasuredFrameIndex),
          animated: true,
        });
        return;
      }
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.5,
        });
      }, 120 * state.attempts);
    },
    [],
  );

  // Common FlatList props
  //
  // ── Virtualization strategy (Discord-like fast-scroll resilience) ──
  //
  // The goal: once messages have been loaded in the current session, the
  // user should NEVER out-scroll the render window and land in blank space.
  //
  // windowSize: 101 (= 50 screens above + 1 viewport + 50 screens below).
  //   At ~8-10 messages per viewport, this keeps ~800-1 000 messages mounted.
  //   For typical chat histories (<500 loaded messages) this means virtually
  //   every loaded cell is kept alive, so a fast fling in EITHER direction
  //   never out-scrolls the render window.
  //
  // maxToRenderPerBatch: 50 — aggressive batching.  When the render window
  //   shifts during a fast fling, 50 cells per batch means the newly-exposed
  //   region fills in within 1-2 JS frames.
  //
  // updateCellsBatchingPeriod: 16 — one frame (≈60 fps cadence).  Eliminates
  //   dead time between batches so rendering keeps pace with the fling.
  //
  // initialNumToRender: 20 — snappy first paint without blocking the thread.
  //
  // removeClippedSubviews: false — MUST remain false on inverted FlatLists
  //   due to the known React Native bug where clipped cells are never
  //   re-created, causing permanent blank screens.
  //
  const flatListCommonProps = {
    data,
    renderItem,
    keyExtractor,
    inverted: true,
    // "on-drag" — instantly dismiss the keyboard the moment the user begins
    // dragging the chat, rather than letting it follow the finger
    // interactively.  Matches the product requirement that dragging the
    // chat should close the keyboard outright instead of pulling it down.
    keyboardDismissMode: "on-drag" as const,
    keyboardShouldPersistTaps: "handled" as const,
    // Scroll events → unified hook.  We also intercept to record the most
    // recent contentOffset.y so parent screens can snapshot/restore
    // scroll position via the imperative ref.
    onScroll: (e: any) => {
      lastScrollOffsetRef.current = e?.nativeEvent?.contentOffset?.y ?? 0;
      scrollState.onScroll(e);
    },
    onScrollEndDrag: scrollState.onScrollEndDrag,
    onMomentumScrollEnd: scrollState.onMomentumScrollEnd,
    scrollEventThrottle: 16,
    // Content
    ListHeaderComponent,
    ListEmptyComponent,
    // ── Performance: chat-optimised virtualization ──
    windowSize: 101,
    initialNumToRender: 20,
    maxToRenderPerBatch: 50,
    updateCellsBatchingPeriod: 16,
    removeClippedSubviews: false,
    // Maintain scroll position when content changes (new messages / pagination)
    maintainVisibleContentPosition,
    // Handle scroll failures
    onScrollToIndexFailed: handleScrollToIndexFailed,
    // Styles
    style: styles.list,
    showsVerticalScrollIndicator: false,
    // Keyboard-synchronised scroll component
    renderScrollComponent,
    // Extra props
    ...flatListProps,
  };

  // Unified return-to-bottom handler: dismiss all transient overlay UI
  // (sheets, keyboard) through the canonical collapse path, then scroll.
  const handleReturnToBottom = useCallback(() => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[ChatTransientUi] return-to-bottom pressed");
    }
    onDismissTransientUi?.();
    scrollState.scrollToLatest();
  }, [onDismissTransientUi, scrollState]);

  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={flatListRef}
        {...flatListCommonProps}
        contentContainerStyle={dynamicContentStyle}
      />

      {/* Jump-to-latest pill — positioned above the composer.
          Suppressed while reply-navigation is active so it does not
          stack with the "Back to reply" button. */}
      <ReturnToBottomPill
        visible={scrollState.showJumpPill && !suppressReturnToBottom}
        unreadCount={scrollState.newMessagesWhileAway}
        onPress={handleReturnToBottom}
        bottomOffset={pillBottomOffset}
      />
    </View>
  );
}

// Forward ref with generic support
export const ChatMessageList = forwardRef(ChatMessageListInner) as <T>(
  props: ChatMessageListProps<T> & { ref?: React.Ref<ChatMessageListRef> },
) => React.JSX.Element;

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 8,
    // paddingTop = visual bottom gap on an inverted FlatList.
    // Provides space between the newest message and the composer.
    paddingTop: 16,
  },
});

export default ChatMessageList;
