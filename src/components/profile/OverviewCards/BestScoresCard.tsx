/**
 * BestScoresCard — Compact game scores preview for profile overview.
 *
 * Shows top 3-5 game scores in a compact horizontal row.
 * Taps through to the full GameStats screen.
 *
 * @module components/profile/OverviewCards/BestScoresCard
 */

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";
import { GAME_METADATA } from "@/types/games";
import type { ProfileGameScore } from "@/types/userProfile";

import { OverviewCard } from "./OverviewCard";

// =============================================================================
// Types
// =============================================================================

export interface BestScoresCardProps {
  /** Game scores to display */
  scores: ProfileGameScore[];
  /** Whether game scores are hidden by privacy settings */
  privacyHidden?: boolean;
  /** Whether data is hidden from others (own profile indicator) */
  hiddenFromOthers?: boolean;
  /** Callback when card is pressed */
  onPress?: () => void;
  /** Callback when a specific game is pressed */
  onGamePress?: (gameId: string) => void;
  /** Maximum scores to show in preview */
  maxPreview?: number;
  /** Stagger index for entrance animation */
  enterIndex?: number;
}

// =============================================================================
// Helper
// =============================================================================

function formatScore(score: number): string {
  if (score >= 1_000_000) return `${(score / 1_000_000).toFixed(1)}M`;
  if (score >= 1_000) return `${(score / 1_000).toFixed(1)}K`;
  return score.toLocaleString();
}

/** Returns the emoji icon for a game (from GAME_METADATA), falling back to 🎮. */
function getGameEmoji(gameId: string): string {
  const meta = GAME_METADATA[gameId as keyof typeof GAME_METADATA];
  return meta?.icon || "🎮";
}

// =============================================================================
// Component
// =============================================================================

export const BestScoresCard = memo(function BestScoresCard({
  scores,
  privacyHidden,
  hiddenFromOthers,
  onPress,
  onGamePress,
  maxPreview = 4,
  enterIndex,
}: BestScoresCardProps) {
  const colors = useColors();

  const displayScores = scores.slice(0, maxPreview);

  // Empty state
  if (!privacyHidden && displayScores.length === 0) {
    return (
      <OverviewCard
        title="Best Scores"
        hiddenFromOthers={hiddenFromOthers}
        enterIndex={enterIndex}
        onPress={onPress}
        testID="best-scores-card"
      >
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No scores recorded yet
        </Text>
      </OverviewCard>
    );
  }

  return (
    <OverviewCard
      title="Best Scores"
      hiddenFromOthers={hiddenFromOthers}
      privacyHidden={privacyHidden}
      privacyMessage="Game stats hidden"
      enterIndex={enterIndex}
      onPress={onPress}
      testID="best-scores-card"
    >
      <View style={styles.scoresRow}>
        {displayScores.map((score, i) => (
          <View
            key={score.gameId}
            style={[
              styles.scoreItem,
              { backgroundColor: colors.surfaceVariant + "40" },
            ]}
          >
            <Text style={styles.gameEmoji}>{getGameEmoji(score.gameId)}</Text>
            <Text
              style={[styles.gameName, { color: colors.text }]}
              numberOfLines={1}
            >
              {score.gameName || score.gameId}
            </Text>
            <Text style={[styles.scoreValue, { color: colors.primary }]}>
              {formatScore(score.score)}
            </Text>
          </View>
        ))}
      </View>
    </OverviewCard>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  scoresRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  scoreItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 72,
    flex: 1,
  },
  gameEmoji: {
    fontSize: 20,
    lineHeight: 24,
    textAlign: "center",
  },
  gameName: {
    fontSize: FontSizes.xs,
    marginTop: 2,
    textAlign: "center",
  },
  scoreValue: {
    fontSize: FontSizes.sm,
    fontWeight: "700",
    marginTop: 2,
  },
  emptyText: {
    fontSize: FontSizes.sm,
    paddingVertical: Spacing.xs,
  },
});

export default BestScoresCard;
