/**
 * TaskProgressRail — compact daily / monthly task progress bar
 *
 * Shows label, progress fraction, claimable dot, and navigates to Tasks screen.
 *
 * @module components/games/TaskProgressRail
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import type { DimensionValue } from "react-native";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// =============================================================================
// Props
// =============================================================================

export interface TaskProgressRailProps {
  /** "Daily Tasks" or "Monthly Tasks" */
  label: string;
  /** Completed count */
  completed: number;
  /** Total count */
  total: number;
  /** Number of claimable rewards */
  claimableCount?: number;
  /** Whether the rail is locked (e.g. monthly not unlocked) */
  locked?: boolean;
  /** Message when locked */
  lockMessage?: string;
  /** Icon name (MaterialCommunityIcons) */
  icon?: string;
  /** Tap handler */
  onPress?: () => void;
}

// =============================================================================
// Component
// =============================================================================

function TaskProgressRailBase({
  label,
  completed,
  total,
  claimableCount = 0,
  locked = false,
  lockMessage,
  icon = "checkbox-marked-circle-outline",
  onPress,
}: TaskProgressRailProps) {
  const theme = useTheme();

  const progress = total > 0 ? Math.min(completed / total, 1) : 0;
  const progressPercent = `${Math.round(progress * 100)}%`;
  const hasClaimable = claimableCount > 0;

  if (locked) {
    return (
      <View
        style={[
          styles.rail,
          { backgroundColor: theme.colors.surfaceVariant, opacity: 0.5 },
        ]}
      >
        <MaterialCommunityIcons
          name="lock"
          size={14}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          style={[styles.lockText, { color: theme.colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {lockMessage ?? label}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.rail,
        {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: hasClaimable ? theme.colors.primary : "transparent",
          borderWidth: hasClaimable ? 1 : 0,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      accessibilityLabel={`${label}: ${completed} of ${total}`}
      accessibilityRole="button"
    >
      <MaterialCommunityIcons
        name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={14}
        color={theme.colors.primary}
      />
      <Text
        style={[styles.label, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.progressContainer}>
        <View style={[styles.track, { backgroundColor: theme.colors.surface }]}>
          <View
            style={[
              styles.fill,
              {
                width: progressPercent as DimensionValue,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
      </View>
      <Text
        style={[styles.fraction, { color: theme.colors.onSurfaceVariant }]}
        numberOfLines={1}
      >
        {completed}/{total}
      </Text>
      {hasClaimable && (
        <View
          style={[styles.claimDot, { backgroundColor: theme.colors.error }]}
        />
      )}
    </TouchableOpacity>
  );
}

export const TaskProgressRail = memo(TaskProgressRailBase);
export default TaskProgressRail;

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  rail: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  progressContainer: {
    flex: 1,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  fraction: {
    fontSize: 11,
    fontWeight: "500",
    minWidth: 28,
    textAlign: "right",
  },
  claimDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#121212",
  },
  lockText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
