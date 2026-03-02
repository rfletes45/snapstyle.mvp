/**
 * SocialProofSection — Compact ritual/streak + recent activity rows.
 *
 * Shows at most two one-line rows on the profile:
 * 1. Ritual/Streak summary with milestone tier (e.g. "🔥 12-day Streak · Warming Up")
 * 2. Recent activity with relative timestamp (e.g. "Unlocked X · 2h ago")
 *
 * Each row is tappable to navigate to its detail screen.
 * Rows enter with a subtle fade-in slide animation.
 *
 * @module components/profile/SocialProof/SocialProofSection
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native-paper";
import Animated, { FadeInDown } from "react-native-reanimated";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { fetchUserActivities } from "@/services/activityFeed";
import { useColors } from "@/store/ThemeContext";
import type { ActivityEvent } from "@/types/activityFeed";

import { createLogger } from "@/utils/log";
const logger = createLogger("components/profile/SocialProof");

// =============================================================================
// Streak milestone tiers
// =============================================================================

interface StreakTier {
  /** Minimum streak days to reach this tier */
  min: number;
  label: string;
  emoji: string;
  /** Accent color (hex) applied to the tier badge */
  color: string;
}

const STREAK_TIERS: StreakTier[] = [
  { min: 100, label: "Legendary", emoji: "💎", color: "#A855F7" },
  { min: 60, label: "Unstoppable", emoji: "⚡", color: "#EAB308" },
  { min: 30, label: "Blazing", emoji: "🌟", color: "#F97316" },
  { min: 14, label: "On Fire", emoji: "🔥", color: "#EF4444" },
  { min: 7, label: "Warming Up", emoji: "✨", color: "#F59E0B" },
];

function getStreakTier(days: number): StreakTier | null {
  return STREAK_TIERS.find((t) => days >= t.min) ?? null;
}

// =============================================================================
// Types
// =============================================================================

export interface SocialProofSectionProps {
  /** User ID */
  userId: string;
  /** Best streak count from friendship streaks or daily tasks */
  streakCount?: number;
  /** Whether to show the recent activity line (opt-in via privacy) */
  showRecentActivity?: boolean;
  /** Whether this is the own profile */
  isOwnProfile?: boolean;
  /** Callback when streak row is tapped */
  onStreakPress?: () => void;
  /** Callback when activity row is tapped */
  onActivityPress?: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

/** Format a Date into a concise relative time string */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  return `${Math.floor(days / 30)}mo ago`;
}

/** Format an activity event into a one-line summary */
function formatActivitySummary(event: ActivityEvent): string {
  const data = event.data;
  switch (data.type) {
    case "achievement":
      return `Unlocked "${data.achievementName}"`;
    case "streak_milestone":
      return `Hit a ${data.streakDays}-day streak milestone`;
    default:
      return "Recent activity";
  }
}

/** Get a contextual icon name for an activity event type */
function getActivityIcon(
  event: ActivityEvent,
): React.ComponentProps<typeof MaterialCommunityIcons>["name"] {
  const data = event.data;
  switch (data.type) {
    case "achievement":
      return "trophy-outline";
    case "streak_milestone":
      return "fire";
    default:
      return "lightning-bolt-outline";
  }
}

// =============================================================================
// Component
// =============================================================================

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const SocialProofSection = memo(function SocialProofSection({
  userId,
  streakCount,
  showRecentActivity,
  isOwnProfile,
  onStreakPress,
  onActivityPress,
}: SocialProofSectionProps) {
  const colors = useColors();
  const [latestActivity, setLatestActivity] = useState<ActivityEvent | null>(
    null,
  );

  // Fetch latest activity if opted in
  useEffect(() => {
    if (!showRecentActivity || !userId) return;
    let cancelled = false;

    fetchUserActivities(userId, 1)
      .then((events) => {
        if (!cancelled && events.length > 0) {
          setLatestActivity(events[0]);
        }
      })
      .catch((err) => {
        logger.error("Error fetching latest activity:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, showRecentActivity]);

  const hasStreak = streakCount != null && streakCount > 0;
  const hasActivity = showRecentActivity && latestActivity;
  const tier = hasStreak ? getStreakTier(streakCount!) : null;

  // Nothing to show
  if (!hasStreak && !hasActivity) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Streak row */}
      {hasStreak && (
        <AnimatedTouchable
          entering={FadeInDown.duration(300).delay(50)}
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              borderColor: tier
                ? tier.color + "40"
                : colors.surfaceVariant + "40",
            },
          ]}
          onPress={onStreakPress}
          activeOpacity={onStreakPress ? 0.7 : 1}
          disabled={!onStreakPress}
          accessibilityLabel={`${streakCount}-day streak${tier ? `, ${tier.label}` : ""}`}
        >
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={[styles.rowText, { color: colors.text }]}>
            {streakCount}-day Streak
          </Text>
          {tier && (
            <View
              style={[styles.tierBadge, { backgroundColor: tier.color + "18" }]}
            >
              <Text style={styles.tierEmoji}>{tier.emoji}</Text>
              <Text style={[styles.tierLabel, { color: tier.color }]}>
                {tier.label}
              </Text>
            </View>
          )}
          {onStreakPress && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.textSecondary}
            />
          )}
        </AnimatedTouchable>
      )}

      {/* Recent activity row */}
      {hasActivity && latestActivity && (
        <AnimatedTouchable
          entering={FadeInDown.duration(300).delay(hasStreak ? 150 : 50)}
          style={[
            styles.row,
            {
              backgroundColor: colors.surface,
              borderColor: colors.surfaceVariant + "40",
            },
          ]}
          onPress={onActivityPress}
          activeOpacity={onActivityPress ? 0.7 : 1}
          disabled={!onActivityPress}
          accessibilityLabel="Recent activity"
        >
          <MaterialCommunityIcons
            name={getActivityIcon(latestActivity)}
            size={16}
            color={colors.primary}
          />
          <Text
            style={[styles.rowText, { color: colors.text }]}
            numberOfLines={1}
          >
            {formatActivitySummary(latestActivity)}
          </Text>
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {formatRelativeTime(latestActivity.timestamp)}
          </Text>
          {onActivityPress && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={colors.textSecondary}
            />
          )}
        </AnimatedTouchable>
      )}
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  streakEmoji: {
    fontSize: 16,
  },
  rowText: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
    flex: 1,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 3,
  },
  tierEmoji: {
    fontSize: 11,
  },
  tierLabel: {
    fontSize: FontSizes.xs,
    fontWeight: "700",
  },
  timestamp: {
    fontSize: FontSizes.xs,
    fontWeight: "400",
  },
});

export default SocialProofSection;
