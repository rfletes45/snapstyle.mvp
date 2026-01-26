/**
 * ChatMessageList Component
 *
 * Keyboard-aware inverted FlatList for chat messages.
 * Handles:
 * - Inverted list rendering (newest at bottom)
 * - Dynamic content inset based on keyboard/composer
 * - "At bottom" detection for smart scroll
 * - Performance optimizations
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
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { ReturnToBottomPill } from "./ReturnToBottomPill";

const log = createLogger("ChatMessageList");

// Create animated FlatList
const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList,
) as typeof FlatList;

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
  /** List bottom inset shared value (from useChatKeyboard) */
  listBottomInset?: SharedValue<number>;
  /** Static bottom inset (used when not using animated values) */
  staticBottomInset?: number;
  /** Whether keyboard is open */
  isKeyboardOpen?: boolean;
  /** Header component (load more button) */
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** Empty component */
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  /** Called when scroll position changes significantly */
  onAtBottomChange?: (isAtBottom: boolean) => void;
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
    listBottomInset,
    staticBottomInset = 80,
    isKeyboardOpen = false,
    ListHeaderComponent,
    ListEmptyComponent,
    onAtBottomChange,
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

  // Set FlatList ref for autoscroll
  useEffect(() => {
    autoscroll.setFlatListRef(flatListRef.current);
  }, [autoscroll]);

  // Notify parent of at bottom changes
  useEffect(() => {
    onAtBottomChange?.(atBottom.isAtBottom);
  }, [atBottom.isAtBottom, onAtBottomChange]);

  // Animated content container style
  const animatedContentStyle = useAnimatedStyle(() => {
    if (!listBottomInset) {
      return {
        paddingTop: staticBottomInset, // Inverted: paddingTop = visual bottom
      };
    }

    return {
      paddingTop: listBottomInset.value,
    };
  }, [staticBottomInset]);

  // Combined content container style
  const combinedContentStyle = useMemo(
    () => [
      styles.contentContainer,
      animatedContentStyle,
      contentContainerStyle,
    ],
    [animatedContentStyle, contentContainerStyle],
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

  return (
    <View style={[styles.container, style]}>
      <AnimatedFlatList
        ref={flatListRef as any}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // Inverted list: newest messages at bottom (visually), but at index 0
        inverted
        // Keyboard handling
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        // Scroll events
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        // Content
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        // Performance
        {...LIST_PERFORMANCE_PROPS}
        // Maintain scroll position when content changes
        maintainVisibleContentPosition={{
          minIndexForVisible: 1,
          autoscrollToTopThreshold: 100,
        }}
        // Handle scroll failures
        onScrollToIndexFailed={handleScrollToIndexFailed}
        // Styles
        style={styles.list}
        contentContainerStyle={combinedContentStyle}
        showsVerticalScrollIndicator={false}
        // Extra props
        {...flatListProps}
      />

      {/* Return to bottom pill */}
      <ReturnToBottomPill
        visible={autoscroll.showReturnPill}
        unreadCount={autoscroll.unreadCount}
        onPress={autoscroll.scrollToBottom}
        bottomOffset={staticBottomInset + 16}
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
