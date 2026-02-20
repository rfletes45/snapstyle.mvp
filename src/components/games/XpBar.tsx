/**
 * XpBar — animated XP progress bar with label
 *
 * Displays "Level X" pill, XP progress, and numeric xp/xpToNext.
 *
 * @module components/games/XpBar
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import type { LevelInfo } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import type { DimensionValue } from "react-native";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// =============================================================================
// Props
// =============================================================================

export interface XpBarProps {
  level: LevelInfo;
  /** Compact mode hides numeric XP label */
  compact?: boolean;
}

// =============================================================================
// Component
// =============================================================================

function XpBarBase({ level, compact = false }: XpBarProps) {
  const theme = useTheme();

  const progress = useMemo(
    () =>
      level.xpToNextLevel > 0 ? Math.min(level.xp / level.xpToNextLevel, 1) : 1,
    [level.xp, level.xpToNextLevel],
  );

  const progressPercent = `${Math.round(progress * 100)}%`;

  return (
    <View style={styles.root}>
      {/* Level pill */}
      <View
        style={[styles.levelPill, { backgroundColor: theme.colors.primary }]}
      >
        <MaterialCommunityIcons
          name="star-four-points"
          size={12}
          color={theme.colors.onPrimary}
        />
        <Text
          style={[styles.levelText, { color: theme.colors.onPrimary }]}
          numberOfLines={1}
        >
          Lv {level.current}
        </Text>
      </View>

      {/* Bar + label */}
      <View style={styles.barWrapper}>
        <View
          style={[
            styles.barTrack,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <View
            style={[
              styles.barFill,
              {
                width: progressPercent as DimensionValue,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
        {!compact && (
          <Text
            style={[styles.xpLabel, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {level.xp.toLocaleString()} / {level.xpToNextLevel.toLocaleString()}{" "}
            XP
          </Text>
        )}
      </View>
    </View>
  );
}

export const XpBar = memo(XpBarBase);
export default XpBar;

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  levelText: {
    fontSize: 12,
    fontWeight: "700",
  },
  barWrapper: {
    flex: 1,
    gap: 2,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  xpLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
});
