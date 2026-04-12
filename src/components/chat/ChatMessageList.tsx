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
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
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
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Custom content container style */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra FlatList props */
  flatListProps?: Partial<FlatListProps<T>>;
}

export interface ChatMessageListRef {
  /** Scroll to bottom (newest messages) */
  scrollToBottom: (animated?: boolean) => void;
  /** Scroll to a specific index */
  scrollToIndex: (index: number, animated?: boolean) => void;
  /** Get the FlatList ref */
  getFlatListRef: () => FlatList<any> | null;
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
    style,
    contentContainerStyle,
    flatListProps,
  } = props;

  const flatListRef = useRef<FlatList<T>>(null);

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
  // scrolled up).  autoscrollToTopThreshold tells the native scroll view to
  // snap to offset 0 whenever the first visible item is within 200 px of the
  // start — matching the AT_BOTTOM_THRESHOLD — so new messages at the bottom
  // appear instantly on the UI thread without a JS-round-trip delay.
  const maintainVisibleContentPosition = useMemo(
    () => ({
      minIndexForVisible: 1,
      autoscrollToTopThreshold: 200,
    }),
    [],
  );

  // Scroll to bottom (for inverted list, this is offset 0)
  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

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

  // Expose ref methods
  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom,
      scrollToIndex,
      getFlatListRef: () => flatListRef.current,
    }),
    [scrollToBottom, scrollToIndex],
  );

  // Handle scroll-to-index failure
  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number }) => {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: Math.min(info.index, info.highestMeasuredFrameIndex),
          animated: true,
        });
      }, 100);
    },
    [],
  );

  // Common FlatList props
  const flatListCommonProps = {
    data,
    renderItem,
    keyExtractor,
    inverted: true,
    keyboardDismissMode: "interactive" as const,
    keyboardShouldPersistTaps: "handled" as const,
    // Scroll events → unified hook
    onScroll: scrollState.onScroll,
    onScrollEndDrag: scrollState.onScrollEndDrag,
    onMomentumScrollEnd: scrollState.onMomentumScrollEnd,
    scrollEventThrottle: 16,
    // Content
    ListHeaderComponent,
    ListEmptyComponent,
    // Performance
    ...LIST_PERFORMANCE_PROPS,
    // CRITICAL: removeClippedSubviews must be false on inverted FlatLists.
    // React Native has a known bug where clipped cells on inverted lists are
    // removed and never re-rendered during fast scroll, causing a permanent
    // blank/white screen soft-lock.
    removeClippedSubviews: false,
    // Raise windowSize so fast-scroll doesn't outpace virtualization
    windowSize: 21,
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

  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={flatListRef}
        {...flatListCommonProps}
        contentContainerStyle={dynamicContentStyle}
      />

      {/* Jump-to-latest pill — positioned above the composer */}
      <ReturnToBottomPill
        visible={scrollState.showJumpPill}
        unreadCount={scrollState.newMessagesWhileAway}
        onPress={scrollState.scrollToLatest}
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
