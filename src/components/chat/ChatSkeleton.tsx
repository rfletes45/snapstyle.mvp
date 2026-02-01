/**
 * ChatSkeleton Component
 *
 * Shimmer loading skeleton that matches the chat message layout.
 * Used instead of a spinner to prevent UI flicker during load.
 *
 * @file src/components/chat/ChatSkeleton.tsx
 */

import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { Spacing } from "../../../constants/theme";

// =============================================================================
// Props
// =============================================================================

interface ChatSkeletonProps {
  /**
   * Number of skeleton message bubbles to show
   * @default 8
   */
  bubbleCount?: number;
}

// =============================================================================
// ShimmerPlaceholder Sub-Component
// =============================================================================

interface ShimmerProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

function ShimmerPlaceholder({
  width,
  height,
  borderRadius = 8,
  style,
}: ShimmerProps) {
  const theme = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 300],
  });

  const baseColor = theme.dark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(0, 0, 0, 0.06)";
  const shimmerColor = theme.dark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.1)";

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: shimmerColor,
          transform: [{ translateX }],
          opacity: 0.5,
        }}
      />
    </View>
  );
}

// =============================================================================
// ChatSkeleton Component
// =============================================================================

export function ChatSkeleton({ bubbleCount = 8 }: ChatSkeletonProps) {
  const theme = useTheme();

  // Generate varied bubble patterns for realistic appearance
  const bubblePatterns = React.useMemo(() => {
    return Array.from({ length: bubbleCount }).map((_, index) => {
      // Alternate sides with some variation
      const isRight = index % 3 === 0 || index % 4 === 1;
      // Vary widths based on index
      const widthVariants = [160, 200, 140, 220, 180, 240, 150, 190];
      const width = widthVariants[index % widthVariants.length];
      // Some messages have multiple lines
      const hasSecondLine = index % 2 === 1;

      return { isRight, width, hasSecondLine };
    });
  }, [bubbleCount]);

  return (
    <View style={styles.container}>
      {bubblePatterns.map((pattern, index) => (
        <View
          key={index}
          style={[
            styles.bubbleRow,
            pattern.isRight ? styles.bubbleRowRight : styles.bubbleRowLeft,
          ]}
        >
          {/* Avatar placeholder for left-side messages */}
          {!pattern.isRight && (
            <ShimmerPlaceholder
              width={36}
              height={36}
              borderRadius={18}
              style={styles.avatar}
            />
          )}

          <View
            style={[
              styles.bubbleContent,
              pattern.isRight
                ? styles.bubbleContentRight
                : styles.bubbleContentLeft,
            ]}
          >
            {/* Message bubble */}
            <ShimmerPlaceholder
              width={pattern.width}
              height={pattern.hasSecondLine ? 56 : 36}
              borderRadius={16}
            />

            {/* Timestamp placeholder */}
            <ShimmerPlaceholder
              width={40}
              height={12}
              borderRadius={4}
              style={[
                styles.timestamp,
                pattern.isRight ? styles.timestampRight : styles.timestampLeft,
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// Conversation Skeleton (for inbox)
// =============================================================================

export function ConversationSkeleton() {
  return (
    <View style={styles.conversationRow}>
      <ShimmerPlaceholder width={52} height={52} borderRadius={26} />
      <View style={styles.conversationContent}>
        <ShimmerPlaceholder
          width={120}
          height={16}
          borderRadius={4}
          style={styles.conversationName}
        />
        <ShimmerPlaceholder width={200} height={14} borderRadius={4} />
      </View>
      <ShimmerPlaceholder
        width={40}
        height={12}
        borderRadius={4}
        style={styles.conversationTime}
      />
    </View>
  );
}

export function ConversationListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.conversationList}>
      {Array.from({ length: count }).map((_, i) => (
        <ConversationSkeleton key={i} />
      ))}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    justifyContent: "flex-end",
  },

  // Message bubble rows
  bubbleRow: {
    flexDirection: "row",
    marginVertical: Spacing.xs,
    alignItems: "flex-end",
  },
  bubbleRowLeft: {
    justifyContent: "flex-start",
  },
  bubbleRowRight: {
    justifyContent: "flex-end",
  },

  // Avatar
  avatar: {
    marginRight: Spacing.xs,
  },

  // Bubble content
  bubbleContent: {
    maxWidth: "75%",
  },
  bubbleContentLeft: {
    alignItems: "flex-start",
  },
  bubbleContentRight: {
    alignItems: "flex-end",
  },

  // Timestamp
  timestamp: {
    marginTop: 4,
  },
  timestampLeft: {
    marginLeft: 4,
  },
  timestampRight: {
    marginRight: 4,
  },

  // Conversation list skeleton
  conversationList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  conversationContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  conversationName: {
    marginBottom: Spacing.xs,
  },
  conversationTime: {
    marginLeft: Spacing.sm,
  },
});

export default ChatSkeleton;
