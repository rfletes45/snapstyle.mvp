/**
 * Skeleton Loader Component
 *
 * Phase 7 of Profile Screen Overhaul
 *
 * Provides shimmer/skeleton loading effects for:
 * - Text placeholders
 * - Avatar placeholders
 * - Card placeholders
 * - Custom shapes
 *
 * Uses Reanimated for smooth shimmer animation
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 7
 */

import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// =============================================================================
// Types
// =============================================================================

export interface SkeletonProps {
  /** Width of the skeleton */
  width: number | `${number}%`;
  /** Height of the skeleton */
  height: number;
  /** Border radius */
  borderRadius?: number;
  /** Skeleton variant */
  variant?: "text" | "circular" | "rectangular" | "rounded";
  /** Custom style */
  style?: ViewStyle;
  /** Whether to show shimmer animation */
  shimmer?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
}

export interface SkeletonGroupProps {
  /** Number of skeletons to render */
  count?: number;
  /** Gap between skeletons */
  gap?: number;
  /** Direction */
  direction?: "row" | "column";
  /** Skeleton props to apply to all children */
  skeletonProps?: Partial<SkeletonProps>;
  /** Custom children (array of widths/heights) */
  items?: Array<{ width: number | `${number}%`; height: number }>;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_ANIMATION_DURATION = 1500;
const SHIMMER_COLORS: [string, string, string] = [
  "transparent",
  "rgba(255,255,255,0.3)",
  "transparent",
];

// =============================================================================
// Skeleton Component
// =============================================================================

export const Skeleton = memo<SkeletonProps>(function Skeleton({
  width,
  height,
  borderRadius,
  variant = "rectangular",
  style,
  shimmer = true,
  animationDuration = DEFAULT_ANIMATION_DURATION,
}) {
  const theme = useTheme();
  const shimmerPosition = useSharedValue(0);

  // Determine border radius based on variant
  const computedBorderRadius = (() => {
    if (borderRadius !== undefined) return borderRadius;
    switch (variant) {
      case "circular":
        return height / 2;
      case "rounded":
        return 8;
      case "text":
        return 4;
      default:
        return 0;
    }
  })();

  // Start shimmer animation
  useEffect(() => {
    if (shimmer) {
      shimmerPosition.value = withRepeat(
        withTiming(1, {
          duration: animationDuration,
          easing: Easing.linear,
        }),
        -1, // Infinite repeat
        false, // Don't reverse
      );
    }
  }, [shimmer, animationDuration]);

  // Animated shimmer style
  const shimmerStyle = useAnimatedStyle(() => {
    if (!shimmer) return {};

    const translateX = interpolate(shimmerPosition.value, [0, 1], [-200, 200]);

    return {
      transform: [{ translateX }],
    };
  });

  const baseColor = theme.dark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(0, 0, 0, 0.08)";

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius: computedBorderRadius,
          backgroundColor: baseColor,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {shimmer && (
        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
          <LinearGradient
            colors={SHIMMER_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
});

// =============================================================================
// Skeleton Group Component
// =============================================================================

export const SkeletonGroup = memo<SkeletonGroupProps>(function SkeletonGroup({
  count = 3,
  gap = 8,
  direction = "column",
  skeletonProps,
  items,
}) {
  const skeletons =
    items ||
    Array.from({ length: count }, () => ({
      width: skeletonProps?.width ?? "100%",
      height: skeletonProps?.height ?? 16,
    }));

  return (
    <View
      style={[
        styles.group,
        {
          flexDirection: direction,
          gap,
        },
      ]}
    >
      {skeletons.map((item, index) => (
        <Skeleton
          key={index}
          {...skeletonProps}
          width={item.width}
          height={item.height}
        />
      ))}
    </View>
  );
});

// =============================================================================
// Preset Skeletons
// =============================================================================

/**
 * Avatar skeleton with circular shape
 */
export const AvatarSkeleton = memo<{ size?: number }>(function AvatarSkeleton({
  size = 48,
}) {
  return <Skeleton width={size} height={size} variant="circular" />;
});

/**
 * Text line skeleton
 */
export const TextSkeleton = memo<{
  width?: number | `${number}%`;
  height?: number;
  lines?: number;
  gap?: number;
}>(function TextSkeleton({ width = "100%", height = 16, lines = 1, gap = 8 }) {
  if (lines === 1) {
    return <Skeleton width={width} height={height} variant="text" />;
  }

  return (
    <SkeletonGroup
      count={lines}
      gap={gap}
      skeletonProps={{
        width,
        height,
        variant: "text",
      }}
    />
  );
});

/**
 * Badge skeleton
 */
export const BadgeSkeleton = memo<{ size?: number }>(function BadgeSkeleton({
  size = 64,
}) {
  return (
    <View style={styles.badgeSkeleton}>
      <Skeleton
        width={size}
        height={size}
        variant="rounded"
        borderRadius={12}
      />
      <Skeleton
        width={size - 16}
        height={12}
        variant="text"
        style={{ marginTop: 4 }}
      />
    </View>
  );
});

/**
 * Card skeleton
 */
export const CardSkeleton = memo<{
  height?: number;
  showAvatar?: boolean;
  showTitle?: boolean;
  showSubtitle?: boolean;
}>(function CardSkeleton({
  height = 120,
  showAvatar = true,
  showTitle = true,
  showSubtitle = true,
}) {
  return (
    <View style={[styles.cardSkeleton, { minHeight: height }]}>
      {showAvatar && <AvatarSkeleton size={48} />}
      <View style={styles.cardContent}>
        {showTitle && <Skeleton width="70%" height={18} variant="text" />}
        {showSubtitle && (
          <Skeleton
            width="50%"
            height={14}
            variant="text"
            style={{ marginTop: 8 }}
          />
        )}
      </View>
    </View>
  );
});

/**
 * Stat skeleton (number + label)
 */
export const StatSkeleton = memo(function StatSkeleton() {
  return (
    <View style={styles.statSkeleton}>
      <Skeleton width={48} height={28} variant="text" />
      <Skeleton
        width={60}
        height={12}
        variant="text"
        style={{ marginTop: 4 }}
      />
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  skeleton: {
    position: "relative",
  },
  group: {
    alignItems: "flex-start",
  },
  badgeSkeleton: {
    alignItems: "center",
  },
  cardSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  cardContent: {
    flex: 1,
  },
  statSkeleton: {
    alignItems: "center",
  },
});

export default Skeleton;
