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

import { useAtBottom, useNewMessageAutoscroll } from "@/hooks/chat";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import { createLogger } from "@/utils/log";
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
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { ReturnToBottomPill } from "./ReturnToBottomPill";

const log = createLogger("ChatMessageList");

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
  /** Called when scroll position changes significantly */
  onAtBottomChange?: (isAtBottom: boolean) => void;
  /**
   * Bottom offset for the "return to bottom" pill (px above screen bottom).
   * Typically composerHeight + safeAreaBottom + small padding.
   */
  pillBottomOffset?: number;
  /** Enable debug logging */
  debug?: boolean;
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
    renderScrollComponent,
    isKeyboardOpen = false,
    ListHeaderComponent,
    ListEmptyComponent,
    onAtBottomChange,
    pillBottomOffset = 96,
    debug = false,
    style,
    contentContainerStyle,
    flatListProps,
  } = props;

  const flatListRef = useRef<FlatList<T>>(null);

  // At bottom detection
  const atBottom = useAtBottom({
    threshold: 200,
    debug,
  });

  // Autoscroll behavior
  const autoscroll = useNewMessageAutoscroll({
    messageCount: data.length,
    isKeyboardOpen,
    isAtBottom: atBottom.isAtBottom,
    distanceFromBottom: atBottom.distanceFromBottom,
    debug,
  });

  // Set FlatList ref for autoscroll - use stable ref setter
  const { setFlatListRef } = autoscroll;
  useEffect(() => {
    setFlatListRef(flatListRef.current);
  }, [setFlatListRef]);

  // Notify parent of at bottom changes
  useEffect(() => {
    onAtBottomChange?.(atBottom.isAtBottom);
  }, [atBottom.isAtBottom, onAtBottomChange]);

  // Content container style - static styles only
  const dynamicContentStyle = useMemo(
    () => [styles.contentContainer, contentContainerStyle],
    [contentContainerStyle],
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

  // Handle scroll for at bottom detection
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      atBottom.onScroll(event);
    },
    [atBottom],
  );

  // Handle scroll end
  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      atBottom.onScrollEndDrag(event);
    },
    [atBottom],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      atBottom.onMomentumScrollEnd(event);
    },
    [atBottom],
  );

  // Handle scroll to index failure
  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number }) => {
      log.warn("scrollToIndex failed", {
        operation: "scrollToIndexFailed",
        data: info,
      });

      // Retry with a delay
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
    // Inverted list: newest messages at bottom (visually), but at index 0
    inverted: true,
    // Keyboard handling — interactive dismiss is handled by KCSV on the
    // native side so this prop stays for the swipe gesture integration.
    keyboardDismissMode: "interactive" as const,
    keyboardShouldPersistTaps: "handled" as const,
    // Scroll events
    onScroll: handleScroll,
    onScrollEndDrag: handleScrollEndDrag,
    onMomentumScrollEnd: handleMomentumScrollEnd,
    scrollEventThrottle: 16,
    // Content
    ListHeaderComponent,
    ListEmptyComponent,
    // Performance
    ...LIST_PERFORMANCE_PROPS,
    // Maintain scroll position when content changes (new messages / pagination)
    maintainVisibleContentPosition: {
      minIndexForVisible: 1,
      autoscrollToTopThreshold: 100,
    },
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

      {/* Return to bottom pill - positioned above the composer */}
      <ReturnToBottomPill
        visible={autoscroll.showReturnPill}
        unreadCount={autoscroll.unreadCount}
        onPress={autoscroll.scrollToBottom}
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
  },
});

export default ChatMessageList;
