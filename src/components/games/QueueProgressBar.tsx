/**
 * QueueProgressBar
 *
 * Visual progress indicator for multiplayer game queue filling.
 * Shows current/required players with animated fill.
 *
 * @file src/components/games/QueueProgressBar.tsx
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface QueueProgressBarProps {
  /** Number of players who have joined */
  current: number;
  /** Minimum players needed to start */
  required: number;
  /** Maximum players allowed (optional) */
  max?: number;
  /** Show text labels */
  showLabels?: boolean;
  /** Compact mode (smaller height) */
  compact?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function QueueProgressBar({
  current,
  required,
  max,
  showLabels = true,
  compact = false,
}: QueueProgressBarProps) {
  const theme = useTheme();

  // Calculate progress percentage (capped at 100%)
  const progress = Math.min(current / required, 1);
  const isFull = current >= required;
  const isOverflow = max && current > required;

  // Determine color based on state
  const progressColor = isFull
    ? theme.colors.primary // Green-ish when ready
    : "#FFA500"; // Orange when filling

  // Animated width
  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(`${progress * 100}%`, {
      damping: 15,
      stiffness: 100,
    }),
  }));

  return (
    <View style={styles.container}>
      {showLabels && (
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.queueText,
              { color: isFull ? theme.colors.primary : theme.colors.onSurface },
            ]}
          >
            {current}/{required} {isFull ? "ready" : "queued"}
          </Text>
          {isOverflow && (
            <Text
              style={[styles.maxText, { color: theme.colors.onSurfaceVariant }]}
            >
              (max {max})
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.progressTrack,
          compact && styles.progressTrackCompact,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <Animated.View
          style={[
            styles.progressFill,
            compact && styles.progressFillCompact,
            { backgroundColor: progressColor },
            animatedStyle,
          ]}
        />
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  queueText: {
    fontSize: 14,
    fontWeight: "600",
  },
  maxText: {
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: BorderRadius.xs,
    overflow: "hidden",
  },
  progressTrackCompact: {
    height: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: BorderRadius.xs,
  },
  progressFillCompact: {
    borderRadius: BorderRadius.xs,
  },
});

export default QueueProgressBar;
