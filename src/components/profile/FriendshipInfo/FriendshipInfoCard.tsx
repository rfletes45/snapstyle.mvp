/**
 * FriendshipInfoCard Component
 *
 * Displays friendship information including:
 * - Streak count with milestone badge
 * - Friendship duration
 * - Friendship anniversary indicator
 *
 * @module components/profile/FriendshipInfo/FriendshipInfoCard
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, { FadeInUp } from "react-native-reanimated";

import { BorderRadius, Spacing } from "@/constants/theme";
import type { FriendshipDetails } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface FriendshipInfoCardProps {
  /** Friendship details */
  details: FriendshipDetails;
  /** Compact mode for smaller display */
  compact?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Streak milestones with special recognition
 */
const STREAK_MILESTONES = [
  { days: 7, name: "Week Warriors", emoji: "⭐", color: "#F1C40F" },
  { days: 30, name: "Monthly Masters", emoji: "🔥", color: "#E67E22" },
  { days: 100, name: "Century Club", emoji: "💫", color: "#9B59B6" },
  { days: 365, name: "Year Strong", emoji: "🏆", color: "#F1C40F" },
  { days: 1000, name: "Legendary Bond", emoji: "👑", color: "#E91E63" },
] as const;

function getStreakMilestone(count: number) {
  return [...STREAK_MILESTONES].reverse().find((m) => count >= m.days);
}

function formatDuration(since: number): string {
  const now = Date.now();
  const diff = now - since;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    const remainingMonths = months % 12;
    if (remainingMonths > 0) {
      return `${years}y ${remainingMonths}m`;
    }
    return `${years} year${years > 1 ? "s" : ""}`;
  }

  if (months > 0) {
    return `${months} month${months > 1 ? "s" : ""}`;
  }

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`;
  }

  return "Today";
}

function isAnniversaryToday(since: number): boolean {
  const now = new Date();
  const friendsDate = new Date(since);

  return (
    now.getMonth() === friendsDate.getMonth() &&
    now.getDate() === friendsDate.getDate() &&
    now.getFullYear() !== friendsDate.getFullYear()
  );
}

function getDaysUntilAnniversary(since: number): number | null {
  const now = new Date();
  const friendsDate = new Date(since);

  // Create this year's anniversary date
  const thisYearAnniversary = new Date(
    now.getFullYear(),
    friendsDate.getMonth(),
    friendsDate.getDate(),
  );

  // If already passed this year, use next year
  if (thisYearAnniversary <= now) {
    thisYearAnniversary.setFullYear(now.getFullYear() + 1);
  }

  const diff = thisYearAnniversary.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  // Only show if within 7 days
  return days <= 7 ? days : null;
}

// =============================================================================
// Component
// =============================================================================

function FriendshipInfoCardBase({
  details,
  compact = false,
  style,
  testID,
}: FriendshipInfoCardProps) {
  const theme = useTheme();

  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    primary: theme.colors.primary,
    error: theme.colors.error,
  };

  const milestone = useMemo(
    () => getStreakMilestone(details.streakCount),
    [details.streakCount],
  );
  const isAnniversary = useMemo(
    () => isAnniversaryToday(details.friendsSince),
    [details.friendsSince],
  );
  const daysUntilAnniversary = useMemo(
    () => getDaysUntilAnniversary(details.friendsSince),
    [details.friendsSince],
  );
  const duration = useMemo(
    () => formatDuration(details.friendsSince),
    [details.friendsSince],
  );

  if (compact) {
    // Compact version - single row
    return (
      <Animated.View
        entering={FadeInUp.duration(300)}
        style={[
          styles.compactContainer,
          { backgroundColor: colors.surfaceVariant },
          style,
        ]}
        testID={testID}
      >
        {/* Streak */}
        {details.streakCount > 0 && (
          <View style={styles.compactItem}>
            <Text style={styles.streakEmoji}>{milestone?.emoji || "🔥"}</Text>
            <Text style={[styles.compactValue, { color: colors.text }]}>
              {details.streakCount}
            </Text>
            <Text
              style={[styles.compactLabel, { color: colors.textSecondary }]}
            >
              day streak
            </Text>
          </View>
        )}

        {/* Duration */}
        <View style={styles.compactItem}>
          <MaterialCommunityIcons
            name="account-heart"
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.compactValue, { color: colors.text }]}>
            {duration}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // Full card version
  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      style={[
        styles.container,
        { backgroundColor: colors.surfaceVariant },
        style,
      ]}
      testID={testID}
    >
      {/* Anniversary Banner */}
      {isAnniversary && (
        <View
          style={[styles.anniversaryBanner, { backgroundColor: "#FFD700" }]}
        >
          <Text style={styles.anniversaryText}>
            🎉 Friendship Anniversary! 🎉
          </Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Streak Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.streakEmojiLarge}>
              {milestone?.emoji || (details.streakCount > 0 ? "🔥" : "❄️")}
            </Text>
            <Text
              style={[
                styles.streakCount,
                { color: milestone?.color || colors.text },
              ]}
            >
              {details.streakCount}
            </Text>
          </View>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Day Streak
          </Text>
          {milestone && (
            <Text style={[styles.milestoneLabel, { color: milestone.color }]}>
              {milestone.name}
            </Text>
          )}
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.surface }]} />

        {/* Duration Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="heart"
              size={28}
              color={colors.error}
            />
          </View>
          <Text style={[styles.durationValue, { color: colors.text }]}>
            {duration}
          </Text>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Friends
          </Text>
          {daysUntilAnniversary !== null && !isAnniversary && (
            <Text style={[styles.anniversaryHint, { color: colors.primary }]}>
              🎂{" "}
              {daysUntilAnniversary === 0
                ? "Tomorrow!"
                : `In ${daysUntilAnniversary}d`}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    width: "100%",
  },
  anniversaryBanner: {
    paddingVertical: 8,
    alignItems: "center",
  },
  anniversaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  content: {
    flexDirection: "row",
    padding: Spacing.md,
  },
  section: {
    flex: 1,
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  streakEmojiLarge: {
    fontSize: 28,
  },
  streakCount: {
    fontSize: 32,
    fontWeight: "800",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  milestoneLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  divider: {
    width: 1,
    marginHorizontal: Spacing.md,
  },
  durationValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  anniversaryHint: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },
  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  compactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  streakEmoji: {
    fontSize: 14,
  },
  compactValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  compactLabel: {
    fontSize: 12,
  },
});

export const FriendshipInfoCard = memo(FriendshipInfoCardBase);
export default FriendshipInfoCard;
