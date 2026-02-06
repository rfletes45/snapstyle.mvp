/**
 * ScoreComparisonView Component
 *
 * Side-by-side comparison of two users' game scores.
 * Used for comparing scores between the viewer and profile owner.
 *
 * @module components/profile/ProfileGameScores/ScoreComparisonView
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  Layout,
} from "react-native-reanimated";

import { BorderRadius, Spacing } from "@/constants/theme";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import type { ProfileGameScore } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface ScoreComparisonViewProps {
  /** Profile owner's scores */
  ownerScores: ProfileGameScore[];
  /** Viewer's scores */
  viewerScores: ProfileGameScore[];
  /** Profile owner's display name */
  ownerName: string;
  /** Viewer's display name */
  viewerName?: string;
  /** Test ID */
  testID?: string;
}

interface ComparisonData {
  gameId: string;
  gameName: string;
  gameIcon: string;
  ownerScore: number | null;
  viewerScore: number | null;
  winner: "owner" | "viewer" | "tie" | "none";
  diff: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getGameIcon(gameId: string): string {
  const metadata = GAME_METADATA[gameId as ExtendedGameType];
  return metadata?.icon || "🎮";
}

function getGameName(gameId: string): string {
  const metadata = GAME_METADATA[gameId as ExtendedGameType];
  return metadata?.shortName || metadata?.name || gameId;
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  if (score >= 1000000) {
    return `${(score / 1000000).toFixed(1)}M`;
  }
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}K`;
  }
  return score.toLocaleString();
}

// =============================================================================
// Comparison Row Component
// =============================================================================

interface ComparisonRowProps {
  data: ComparisonData;
  index: number;
}

const ComparisonRow = memo(function ComparisonRow({
  data,
  index,
}: ComparisonRowProps) {
  const theme = useTheme();

  const winnerColor =
    data.winner === "owner"
      ? "#4CAF50"
      : data.winner === "viewer"
        ? "#2196F3"
        : theme.colors.onSurfaceVariant;

  const ownerColor =
    data.winner === "owner" ? "#4CAF50" : theme.colors.onSurface;
  const viewerColor =
    data.winner === "viewer" ? "#2196F3" : theme.colors.onSurface;

  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).springify()}
      layout={Layout.springify()}
    >
      <Surface
        style={[
          styles.comparisonRow,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
        elevation={1}
      >
        {/* Owner Score */}
        <Animated.View
          entering={FadeInLeft.delay(index * 80 + 100)}
          style={styles.scoreColumn}
        >
          <Text style={[styles.scoreValue, { color: ownerColor }]}>
            {formatScore(data.ownerScore)}
          </Text>
          {data.winner === "owner" && (
            <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
          )}
        </Animated.View>

        {/* Game Info (Center) */}
        <View style={styles.gameColumn}>
          <View style={styles.gameIconContainer}>
            <Text style={styles.gameIcon}>{data.gameIcon}</Text>
          </View>
          <Text
            style={[styles.gameName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {data.gameName}
          </Text>
          {data.winner !== "none" && data.diff > 0 && (
            <Text
              style={[
                styles.diffText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Δ {formatScore(data.diff)}
            </Text>
          )}
        </View>

        {/* Viewer Score */}
        <Animated.View
          entering={FadeInRight.delay(index * 80 + 100)}
          style={styles.scoreColumn}
        >
          {data.winner === "viewer" && (
            <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
          )}
          <Text style={[styles.scoreValue, { color: viewerColor }]}>
            {formatScore(data.viewerScore)}
          </Text>
        </Animated.View>
      </Surface>
    </Animated.View>
  );
});

// =============================================================================
// Summary Component
// =============================================================================

interface SummaryProps {
  ownerWins: number;
  viewerWins: number;
  ties: number;
  ownerName: string;
  viewerName: string;
}

const Summary = memo(function Summary({
  ownerWins,
  viewerWins,
  ties,
  ownerName,
  viewerName,
}: SummaryProps) {
  const theme = useTheme();

  const winner =
    ownerWins > viewerWins
      ? "owner"
      : viewerWins > ownerWins
        ? "viewer"
        : "tie";

  return (
    <Animated.View entering={FadeIn.delay(300)} style={styles.summary}>
      <Surface
        style={[
          styles.summaryCard,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
        elevation={2}
      >
        <MaterialCommunityIcons
          name="trophy"
          size={32}
          color={winner === "tie" ? theme.colors.onPrimaryContainer : "#FFD700"}
        />
        <Text
          style={[
            styles.summaryTitle,
            { color: theme.colors.onPrimaryContainer },
          ]}
        >
          {winner === "owner"
            ? `${ownerName} leads!`
            : winner === "viewer"
              ? `${viewerName} leads!`
              : "It's a tie!"}
        </Text>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#4CAF50" }]}>
              {ownerWins}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {ownerName}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statValue,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {ties}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              Tied
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#2196F3" }]}>
              {viewerWins}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {viewerName}
            </Text>
          </View>
        </View>
      </Surface>
    </Animated.View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const ScoreComparisonView = memo(function ScoreComparisonView({
  ownerScores,
  viewerScores,
  ownerName,
  viewerName = "You",
  testID,
}: ScoreComparisonViewProps) {
  const theme = useTheme();

  // Build comparison data
  const comparisonData = useMemo((): ComparisonData[] => {
    const ownerMap = new Map(ownerScores.map((s) => [s.gameId, s]));
    const viewerMap = new Map(viewerScores.map((s) => [s.gameId, s]));

    // Get all unique game IDs
    const allGameIds = new Set([
      ...ownerScores.map((s) => s.gameId),
      ...viewerScores.map((s) => s.gameId),
    ]);

    const data: ComparisonData[] = [];

    allGameIds.forEach((gameId) => {
      const ownerScore = ownerMap.get(gameId);
      const viewerScore = viewerMap.get(gameId);

      let winner: ComparisonData["winner"] = "none";
      let diff = 0;

      if (ownerScore && viewerScore) {
        if (ownerScore.score > viewerScore.score) {
          winner = "owner";
          diff = ownerScore.score - viewerScore.score;
        } else if (viewerScore.score > ownerScore.score) {
          winner = "viewer";
          diff = viewerScore.score - ownerScore.score;
        } else {
          winner = "tie";
        }
      }

      data.push({
        gameId,
        gameName:
          ownerScore?.gameName || viewerScore?.gameName || getGameName(gameId),
        gameIcon:
          ownerScore?.gameIcon || viewerScore?.gameIcon || getGameIcon(gameId),
        ownerScore: ownerScore?.score ?? null,
        viewerScore: viewerScore?.score ?? null,
        winner,
        diff,
      });
    });

    // Sort: games with both scores first, then by total score
    return data.sort((a, b) => {
      const aHasBoth = a.ownerScore !== null && a.viewerScore !== null;
      const bHasBoth = b.ownerScore !== null && b.viewerScore !== null;
      if (aHasBoth && !bHasBoth) return -1;
      if (!aHasBoth && bHasBoth) return 1;
      const aTotal = (a.ownerScore ?? 0) + (a.viewerScore ?? 0);
      const bTotal = (b.ownerScore ?? 0) + (b.viewerScore ?? 0);
      return bTotal - aTotal;
    });
  }, [ownerScores, viewerScores]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    let ownerWins = 0;
    let viewerWins = 0;
    let ties = 0;

    comparisonData.forEach((data) => {
      if (data.winner === "owner") ownerWins++;
      else if (data.winner === "viewer") viewerWins++;
      else if (data.winner === "tie") ties++;
    });

    return { ownerWins, viewerWins, ties };
  }, [comparisonData]);

  // Empty state
  if (comparisonData.length === 0) {
    return (
      <View style={styles.container} testID={testID}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons
            name="gamepad-variant-outline"
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            No scores to compare
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Score Comparison
        </Text>
      </View>

      {/* Column Headers */}
      <View style={styles.columnHeaders}>
        <Text
          style={[styles.columnHeader, { color: theme.colors.primary }]}
          numberOfLines={1}
        >
          {ownerName}
        </Text>
        <Text
          style={[
            styles.columnHeaderCenter,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Game
        </Text>
        <Text
          style={[styles.columnHeader, { color: theme.colors.secondary }]}
          numberOfLines={1}
        >
          {viewerName}
        </Text>
      </View>

      {/* Comparison Rows */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {comparisonData.map((data, index) => (
          <ComparisonRow key={data.gameId} data={data} index={index} />
        ))}
      </ScrollView>

      {/* Summary */}
      {summaryStats.ownerWins + summaryStats.viewerWins + summaryStats.ties >
        0 && (
        <Summary
          ownerWins={summaryStats.ownerWins}
          viewerWins={summaryStats.viewerWins}
          ties={summaryStats.ties}
          ownerName={ownerName}
          viewerName={viewerName}
        />
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
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  columnHeaders: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  columnHeader: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  columnHeaderCenter: {
    flex: 1,
    fontSize: 12,
    textAlign: "center",
  },
  list: {
    maxHeight: 300,
  },
  listContent: {
    gap: Spacing.xs,
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  scoreColumn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  gameColumn: {
    flex: 1.2,
    alignItems: "center",
    gap: 2,
  },
  gameIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  gameIcon: {
    fontSize: 18,
  },
  gameName: {
    fontSize: 11,
    textAlign: "center",
  },
  diffText: {
    fontSize: 10,
  },
  summary: {
    marginTop: Spacing.md,
  },
  summaryCard: {
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    marginTop: Spacing.sm,
  },
});

export default ScoreComparisonView;
