/**
 * GameStatsSummary Component
 *
 * Displays weekly gaming statistics summary.
 * Shows games played, wins, and win rate.
 *
 * Layout (per Phase 7 plan):
 * ┌───────────────────────────────────────────────────────────┐
 * │ 📊 This Week                                              │
 * │ 23 games played  •  15 wins  •  65% win rate              │
 * └───────────────────────────────────────────────────────────┘
 *
 * Visual Specs:
 * - Small card below categories
 * - Shows overall gaming activity
 * - Weekly stats update
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 7
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { calculateUserStats } from "@/services/gameHistory";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { PLAY_SCREEN_TOKENS } from "../../../../constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export interface GameStatsSummaryProps {
  /** Called when user taps to view detailed stats */
  onViewDetails?: () => void;
  /** Optional test ID for testing */
  testID?: string;
}

interface WeeklyStats {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  totalPlayTime: number; // in minutes
}

// =============================================================================
// Constants
// =============================================================================

const STATS_CARD_HEIGHT = 72;

// =============================================================================
// StatItem Component
// =============================================================================

interface StatItemProps {
  value: string;
  label: string;
  icon: string;
  iconColor: string;
}

function StatItem({ value, label, icon, iconColor }: StatItemProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.statItem}>
      <View style={styles.statValueRow}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      </View>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

// =============================================================================
// GameStatsSummary Component
// =============================================================================

export function GameStatsSummary({
  onViewDetails,
  testID,
}: GameStatsSummaryProps) {
  const { colors, isDark } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const scale = useSharedValue(1);

  // Stats state - using placeholder data for now
  // In production, this would fetch from gameStats service
  const [stats, setStats] = useState<WeeklyStats>({
    gamesPlayed: 0,
    wins: 0,
    winRate: 0,
    totalPlayTime: 0,
  });
  const [loading, setLoading] = useState(true);

  // Fetch weekly stats
  useEffect(() => {
    if (!currentFirebaseUser?.uid) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // Fetch real stats from game history
        const userStats = await calculateUserStats(currentFirebaseUser.uid);

        setStats({
          gamesPlayed: userStats.totalGames,
          wins: userStats.wins,
          winRate: Math.round(userStats.winRate),
          totalPlayTime: Math.round(userStats.totalPlayTime / 60), // Convert to minutes
        });
      } catch (error) {
        console.error("[GameStatsSummary] Error fetching stats:", error);
        // Reset to zero on error
        setStats({
          gamesPlayed: 0,
          wins: 0,
          winRate: 0,
          totalPlayTime: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentFirebaseUser?.uid]);

  // Animation styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Press handlers
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onViewDetails?.();
  }, [onViewDetails]);

  // Format play time
  const formatPlayTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Don't show if no stats
  if (loading) {
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "transparent",
          },
        ]}
        testID={testID}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading stats...
          </Text>
        </View>
      </Animated.View>
    );
  }

  if (stats.gamesPlayed === 0) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={animatedStyle}
      testID={testID}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "transparent",
            ...PLAY_SCREEN_TOKENS.shadows.card,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerIcon}>📊</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              This Week
            </Text>
          </View>
          {onViewDetails && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatItem
            value={String(stats.gamesPlayed)}
            label="games"
            icon="🎮"
            iconColor={colors.primary}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <StatItem
            value={String(stats.wins)}
            label="wins"
            icon="🏆"
            iconColor="#FFD700"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <StatItem
            value={`${stats.winRate}%`}
            label="win rate"
            icon="📈"
            iconColor="#4CAF50"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <StatItem
            value={formatPlayTime(stats.totalPlayTime)}
            label="played"
            icon="⏱️"
            iconColor={colors.secondary}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: PLAY_SCREEN_TOKENS.spacing.horizontalPadding,
    marginTop: 12,
    borderRadius: PLAY_SCREEN_TOKENS.borderRadius.cardLarge,
    borderWidth: 1,
    padding: 12,
    minHeight: STATS_CARD_HEIGHT,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 13,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statIcon: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
  },
});
