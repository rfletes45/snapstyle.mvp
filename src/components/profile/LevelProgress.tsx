/**
 * LevelProgress Component
 *
 * Displays user's level with XP progress bar.
 */

import { MAX_REWARD_LEVEL } from "@/data/levelRewards";
import { useColors } from "@/store/ThemeContext";
import type { LevelInfo } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { ProgressBar, Text } from "react-native-paper";

export interface LevelProgressProps {
  /** Level information */
  level: LevelInfo;
  /** Show detailed XP numbers */
  showDetails?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

function LevelProgressBase({
  level,
  showDetails = true,
  compact = false,
}: LevelProgressProps) {
  const colors = useColors();

  const isMaxLevel = level.current >= MAX_REWARD_LEVEL;
  const progress = isMaxLevel
    ? 1
    : level.xpToNextLevel > 0
      ? level.xp / level.xpToNextLevel
      : 1;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View
          style={[styles.levelBadgeSmall, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.levelTextSmall}>{level.current}</Text>
        </View>
        <View style={styles.compactProgressWrapper}>
          <ProgressBar
            progress={progress}
            color={colors.primary}
            style={styles.compactProgress}
          />
        </View>
      </View>
    );
  }

  const xpRemaining = isMaxLevel
    ? 0
    : Math.max(0, level.xpToNextLevel - level.xp);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <MaterialCommunityIcons
            name="star-circle"
            size={20}
            color={colors.primary}
          />
          <Text style={[styles.levelLabel, { color: colors.text }]}>
            Level {level.current}
            {isMaxLevel ? " (MAX)" : ""}
          </Text>
        </View>
        {showDetails && (
          <Text style={[styles.xpText, { color: colors.textSecondary }]}>
            {isMaxLevel
              ? `${level.xpToNextLevel.toLocaleString()}/${level.xpToNextLevel.toLocaleString()} XP`
              : `${level.xp.toLocaleString()}/${level.xpToNextLevel.toLocaleString()} XP`}
          </Text>
        )}
      </View>
      <ProgressBar
        progress={progress}
        color={colors.primary}
        style={[styles.progressBar, { backgroundColor: colors.surfaceVariant }]}
      />
      {showDetails && !isMaxLevel && (
        <Text style={[styles.xpRemainingText, { color: colors.textSecondary }]}>
          {xpRemaining.toLocaleString()} XP to next level
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  xpText: {
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  xpRemainingText: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelBadgeSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  levelTextSmall: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  compactProgressWrapper: {
    flex: 1,
  },
  compactProgress: {
    height: 4,
    borderRadius: 2,
  },
});

export const LevelProgress = memo(LevelProgressBase);
export default LevelProgress;
