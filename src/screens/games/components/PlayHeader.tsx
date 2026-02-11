/**
 * PlayHeader
 *
 * Custom header component for the Play screen with navigation shortcuts.
 *
 * Features:
 * - "🎮 Play" title on the left
 * - Leaderboard, Achievements, History icon buttons on the right
 * - Notification badges for pending invites/turns
 * - Safe area handling
 * - Compact 56px height
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 1
 */

import { HeaderIconButton } from "@/components/ui/HeaderIconButton";
import { useAppTheme } from "@/store/ThemeContext";
import { PlayHeaderProps } from "@/types/playScreen";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PLAY_SCREEN_TOKENS } from "@/constants/gamesTheme";

const { spacing, typography } = PLAY_SCREEN_TOKENS;

/**
 * PlayHeader Component
 *
 * Renders a custom header with the Play title and navigation shortcuts
 * to Leaderboards, Achievements, and Game History.
 *
 * @example
 * <PlayHeader
 *   onLeaderboardPress={() => navigation.navigate('Leaderboard')}
 *   onAchievementsPress={() => navigation.navigate('Achievements')}
 *   onHistoryPress={() => navigation.navigate('GameHistory')}
 *   inviteCount={3}
 *   yourTurnCount={2}
 * />
 */
function PlayHeaderComponent({
  onLeaderboardPress,
  onAchievementsPress,
  onHistoryPress,
  inviteCount = 0,
  yourTurnCount = 0,
  showBadges = true,
}: PlayHeaderProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top, backgroundColor: colors.background },
      ]}
    >
      <View style={styles.headerContent}>
        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Text style={styles.headerEmoji}>🎮</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Play</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.headerActions}>
          <HeaderIconButton
            icon="trophy"
            color="#FFD700"
            onPress={onLeaderboardPress}
            accessibilityLabel="View leaderboards"
          />
          <HeaderIconButton
            icon="medal"
            color={colors.primary}
            onPress={onAchievementsPress}
            showBadge={showBadges && yourTurnCount > 0}
            badgeCount={showBadges ? yourTurnCount : 0}
            accessibilityLabel="View achievements"
          />
          <HeaderIconButton
            icon="history"
            color={colors.textSecondary}
            onPress={onHistoryPress}
            accessibilityLabel="View game history"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "transparent",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.horizontalPadding,
    height: spacing.headerHeight,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerEmoji: {
    fontSize: typography.headerTitle.fontSize,
  },
  headerTitle: {
    fontSize: typography.headerTitle.fontSize,
    fontWeight: typography.headerTitle.fontWeight,
    lineHeight: typography.headerTitle.lineHeight,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});

export const PlayHeader = memo(PlayHeaderComponent);
export default PlayHeader;
