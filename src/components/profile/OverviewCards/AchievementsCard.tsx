/**
 * AchievementsCard — Compact achievements preview for profile overview.
 *
 * Shows completion percentage and latest unlock.
 * Taps through to the full Achievements screen.
 *
 * @module components/profile/OverviewCards/AchievementsCard
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { FontSizes, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";

import { OverviewCard } from "./OverviewCard";

// =============================================================================
// Types
// =============================================================================

export interface AchievementsCardProps {
  /** Total achievements defined */
  totalAchievements: number;
  /** Number unlocked */
  unlockedCount: number;
  /** Title of the latest unlocked achievement (if any) */
  latestUnlockTitle?: string;
  /** Whether achievements are hidden by privacy settings */
  privacyHidden?: boolean;
  /** Whether data is hidden from others (own profile indicator) */
  hiddenFromOthers?: boolean;
  /** Callback when card is pressed */
  onPress?: () => void;
  /** Stagger index for entrance animation */
  enterIndex?: number;
}

// =============================================================================
// Component
// =============================================================================

export const AchievementsCard = memo(function AchievementsCard({
  totalAchievements,
  unlockedCount,
  latestUnlockTitle,
  privacyHidden,
  hiddenFromOthers,
  onPress,
  enterIndex,
}: AchievementsCardProps) {
  const colors = useColors();

  const percentage =
    totalAchievements > 0
      ? Math.round((unlockedCount / totalAchievements) * 100)
      : 0;

  return (
    <OverviewCard
      title="Achievements"
      hiddenFromOthers={hiddenFromOthers}
      privacyHidden={privacyHidden}
      enterIndex={enterIndex}
      onPress={onPress}
      testID="achievements-card"
    >
      <View style={styles.row}>
        {/* Progress indicator */}
        <View style={styles.progressSection}>
          <View
            style={[
              styles.progressRing,
              { borderColor: colors.primary + "30" },
            ]}
          >
            <Text style={[styles.progressPct, { color: colors.primary }]}>
              {percentage}%
            </Text>
          </View>
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            {unlockedCount}/{totalAchievements}
          </Text>
        </View>

        {/* Latest unlock */}
        {latestUnlockTitle ? (
          <View style={styles.latestSection}>
            <View style={styles.latestHeader}>
              <MaterialCommunityIcons
                name="trophy-outline"
                size={14}
                color={colors.primary}
              />
              <Text
                style={[styles.latestLabel, { color: colors.textSecondary }]}
              >
                Latest
              </Text>
            </View>
            <Text
              style={[styles.latestTitle, { color: colors.text }]}
              numberOfLines={2}
            >
              {latestUnlockTitle}
            </Text>
          </View>
        ) : (
          <View style={styles.latestSection}>
            <Text style={[styles.emptyLatest, { color: colors.textSecondary }]}>
              No achievements unlocked yet
            </Text>
          </View>
        )}
      </View>
    </OverviewCard>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  progressSection: {
    alignItems: "center",
    gap: 4,
  },
  progressRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  progressPct: {
    fontSize: FontSizes.md,
    fontWeight: "700",
  },
  countLabel: {
    fontSize: FontSizes.xs,
  },
  latestSection: {
    flex: 1,
  },
  latestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  latestLabel: {
    fontSize: FontSizes.xs,
    fontWeight: "500",
  },
  latestTitle: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
  },
  emptyLatest: {
    fontSize: FontSizes.sm,
  },
});

export default AchievementsCard;
