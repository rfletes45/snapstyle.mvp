/**
 * GameScoresDisplay Component
 *
 * Displays user's top game scores on their profile.
 * Shows game icon, name, score, and when achieved.
 * Supports comparison with viewer's scores when viewing another profile.
 *
 * @module components/profile/ProfileGameScores/GameScoresDisplay
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import Animated, { FadeIn, FadeInRight, Layout } from "react-native-reanimated";

import { BorderRadius, Spacing } from "@/constants/theme";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import type { ProfileGameScore } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface GameScoresDisplayProps {
  /** Game scores to display */
  scores: ProfileGameScore[];
  /** Viewer's scores for comparison (optional) */
  viewerScores?: ProfileGameScore[];
  /** Whether the profile owner enabled game scores display */
  enabled?: boolean;
  /** Whether this is the user's own profile */
  isOwnProfile?: boolean;
  /** Callback when edit is pressed (own profile only) */
  onEditPress?: () => void;
  /** Callback when a game is pressed */
  onGamePress?: (gameId: string) => void;
  /** Show in compact mode */
  compact?: boolean;
  /** Maximum scores to show */
  maxScores?: number;
  /** Test ID */
  testID?: string;
}

// =============================================================================
// Constants
// =============================================================================

const TROPHY_COLORS = {
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
};

// =============================================================================
// Helper Functions
// =============================================================================

function formatScore(score: number): string {
  if (score >= 1000000) {
    return `${(score / 1000000).toFixed(1)}M`;
  }
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}K`;
  }
  return score.toLocaleString();
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getGameIcon(gameId: string): string {
  const metadata = GAME_METADATA[gameId as ExtendedGameType];
  return metadata?.icon || "🎮";
}

function getGameName(gameId: string): string {
  const metadata = GAME_METADATA[gameId as ExtendedGameType];
  return metadata?.shortName || metadata?.name || gameId;
}

// =============================================================================
// Score Card Component
// =============================================================================

interface ScoreCardProps {
  score: ProfileGameScore;
  rank: number;
  viewerScore?: number;
  onPress?: () => void;
  compact?: boolean;
  index: number;
}

const ScoreCard = memo(function ScoreCard({
  score,
  rank,
  viewerScore,
  onPress,
  compact = false,
  index,
}: ScoreCardProps) {
  const theme = useTheme();

  const comparison = useMemo(() => {
    if (viewerScore === undefined) return null;
    const diff = score.score - viewerScore;
    if (diff > 0) return { type: "higher" as const, diff };
    if (diff < 0) return { type: "lower" as const, diff: Math.abs(diff) };
    return { type: "tie" as const, diff: 0 };
  }, [score.score, viewerScore]);

  const trophyColor =
    rank === 1
      ? TROPHY_COLORS.gold
      : rank === 2
        ? TROPHY_COLORS.silver
        : rank === 3
          ? TROPHY_COLORS.bronze
          : undefined;

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 100).springify()}
      layout={Layout.springify()}
    >
      <TouchableOpacity onPress={onPress} disabled={!onPress}>
        <Surface
          style={[
            styles.scoreCard,
            compact && styles.scoreCardCompact,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
          elevation={1}
        >
          {/* Rank Badge */}
          {trophyColor && (
            <View style={[styles.rankBadge, { backgroundColor: trophyColor }]}>
              <Text style={styles.rankText}>{rank}</Text>
            </View>
          )}

          {/* Game Icon */}
          <View style={styles.gameIconContainer}>
            <Text style={styles.gameIcon}>{getGameIcon(score.gameId)}</Text>
          </View>

          {/* Game Info */}
          <View style={styles.gameInfo}>
            <Text
              style={[styles.gameName, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {score.gameName || getGameName(score.gameId)}
            </Text>
            {!compact && (
              <Text
                style={[
                  styles.achievedDate,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {formatDate(score.achievedAt)}
              </Text>
            )}
          </View>

          {/* Score */}
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreValue, { color: theme.colors.primary }]}>
              {formatScore(score.score)}
            </Text>

            {/* Comparison */}
            {comparison && (
              <View style={styles.comparisonContainer}>
                {comparison.type === "higher" && (
                  <View style={styles.comparisonRow}>
                    <MaterialCommunityIcons
                      name="chevron-up"
                      size={14}
                      color="#4CAF50"
                    />
                    <Text style={[styles.comparisonText, { color: "#4CAF50" }]}>
                      +{formatScore(comparison.diff)}
                    </Text>
                  </View>
                )}
                {comparison.type === "lower" && (
                  <View style={styles.comparisonRow}>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={14}
                      color="#F44336"
                    />
                    <Text style={[styles.comparisonText, { color: "#F44336" }]}>
                      -{formatScore(comparison.diff)}
                    </Text>
                  </View>
                )}
                {comparison.type === "tie" && (
                  <Text
                    style={[
                      styles.comparisonText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Tied!
                  </Text>
                )}
              </View>
            )}
          </View>
        </Surface>
      </TouchableOpacity>
    </Animated.View>
  );
});

// =============================================================================
// Empty State Component
// =============================================================================

interface EmptyStateProps {
  isOwnProfile: boolean;
  onEditPress?: () => void;
}

const EmptyState = memo(function EmptyState({
  isOwnProfile,
  onEditPress,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <Animated.View entering={FadeIn} style={styles.emptyState}>
      <MaterialCommunityIcons
        name="gamepad-variant-outline"
        size={48}
        color={theme.colors.onSurfaceVariant}
      />
      <Text
        style={[styles.emptyTitle, { color: theme.colors.onSurfaceVariant }]}
      >
        {isOwnProfile ? "No Games Played Yet" : "No Scores to Show"}
      </Text>
      <Text
        style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}
      >
        {isOwnProfile
          ? "Play some games to show off your high scores!"
          : "This user hasn't shared any game scores."}
      </Text>
      {isOwnProfile && onEditPress && (
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: theme.colors.primary }]}
          onPress={onEditPress}
        >
          <Text style={{ color: theme.colors.onPrimary }}>
            Configure Display
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const GameScoresDisplay = memo(function GameScoresDisplay({
  scores,
  viewerScores,
  enabled = true,
  isOwnProfile = false,
  onEditPress,
  onGamePress,
  compact = false,
  maxScores = 5,
  testID,
}: GameScoresDisplayProps) {
  const theme = useTheme();

  // Create viewer scores map for quick lookup
  const viewerScoresMap = useMemo(() => {
    if (!viewerScores) return new Map<string, number>();
    return new Map(viewerScores.map((s) => [s.gameId, s.score]));
  }, [viewerScores]);

  // Sort and limit scores
  const displayScores = useMemo(() => {
    return [...scores]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, maxScores);
  }, [scores, maxScores]);

  // Don't render if disabled (unless own profile)
  if (!enabled && !isOwnProfile) {
    return null;
  }

  // Empty state
  if (displayScores.length === 0) {
    return (
      <View style={styles.container} testID={testID}>
        <EmptyState isOwnProfile={isOwnProfile} onEditPress={onEditPress} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="trophy"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            Top Scores
          </Text>
        </View>
        {isOwnProfile && onEditPress && (
          <TouchableOpacity onPress={onEditPress} style={styles.editIcon}>
            <MaterialCommunityIcons
              name="pencil"
              size={18}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Scores List */}
      <ScrollView
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          compact ? styles.horizontalList : styles.verticalList
        }
      >
        {displayScores.map((score, index) => (
          <ScoreCard
            key={score.gameId}
            score={score}
            rank={index + 1}
            viewerScore={viewerScoresMap.get(score.gameId)}
            onPress={onGamePress ? () => onGamePress(score.gameId) : undefined}
            compact={compact}
            index={index}
          />
        ))}
      </ScrollView>

      {/* Comparison Legend (when viewing others) */}
      {viewerScores && viewerScores.length > 0 && !compact && (
        <View style={styles.legend}>
          <Text
            style={[
              styles.legendText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Compared to your scores
          </Text>
        </View>
      )}
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  editIcon: {
    padding: Spacing.xs,
  },
  horizontalList: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  verticalList: {
    gap: Spacing.xs,
    paddingTop: 4,
    paddingLeft: 4,
  },
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    overflow: "visible",
  },
  scoreCardCompact: {
    flexDirection: "column",
    alignItems: "center",
    width: 100,
    padding: Spacing.sm,
  },
  rankBadge: {
    position: "absolute",
    top: -4,
    left: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  gameIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  gameIcon: {
    fontSize: 24,
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 14,
    fontWeight: "500",
  },
  achievedDate: {
    fontSize: 12,
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: "flex-end",
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  comparisonContainer: {
    marginTop: 2,
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  comparisonText: {
    fontSize: 11,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  editButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  legend: {
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  legendText: {
    fontSize: 12,
    fontStyle: "italic",
  },
});

export default GameScoresDisplay;
