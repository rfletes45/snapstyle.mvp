/**
 * GameHistoryScreen - View completed games with filtering
 *
 * Features:
 * - Stats card showing overall performance
 * - Filter by outcome (All, Win, Loss, Draw)
 * - Infinite scroll with pagination
 * - Pull-to-refresh
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 5
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/../constants/theme";
import { calculateUserStats, getGameHistory } from "@/services/gameHistory";
import { useAuth } from "@/store/AuthContext";
import { GameHistoryRecord, GameHistoryStats } from "@/types/gameHistory";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { TurnBasedGameType } from "@/types/turnBased";

// =============================================================================
// Types
// =============================================================================

type OutcomeFilter = "all" | "win" | "loss" | "draw";

// =============================================================================
// Component
// =============================================================================

export function GameHistoryScreen() {
  const navigation = useNavigation<any>();
  const { currentFirebaseUser } = useAuth();
  const theme = useTheme();

  // State
  const [records, setRecords] = useState<GameHistoryRecord[]>([]);
  const [stats, setStats] = useState<GameHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastId, setLastId] = useState<string | undefined>();

  // Filters
  const [gameTypeFilter, setGameTypeFilter] = useState<
    TurnBasedGameType | undefined
  >();
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  const loadHistory = useCallback(
    async (refresh = false) => {
      if (!currentFirebaseUser?.uid) return;

      if (refresh) {
        setRefreshing(true);
        setLastId(undefined);
      }

      try {
        const result = await getGameHistory({
          userId: currentFirebaseUser.uid,
          gameType: gameTypeFilter,
          outcome: outcomeFilter === "all" ? undefined : outcomeFilter,
          limit: 20,
          startAfter: refresh ? undefined : lastId,
        });

        if (refresh) {
          setRecords(result.records);
        } else {
          setRecords((prev) => [...prev, ...result.records]);
        }

        setHasMore(result.hasMore);
        setLastId(result.lastId);

        // Load stats on refresh
        if (refresh) {
          const statsResult = await calculateUserStats(
            currentFirebaseUser.uid,
            gameTypeFilter,
          );
          setStats(statsResult);
        }
      } catch (error) {
        console.error("[GameHistoryScreen] Failed to load history:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [currentFirebaseUser?.uid, gameTypeFilter, outcomeFilter, lastId],
  );

  // Initial load and filter changes
  useEffect(() => {
    setLoading(true);
    loadHistory(true);
  }, [gameTypeFilter, outcomeFilter]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      loadHistory(false);
    }
  }, [loadingMore, hasMore, loading, loadHistory]);

  const handleRefresh = useCallback(() => {
    loadHistory(true);
  }, [loadHistory]);

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderStatsCard = () => {
    if (!stats) return null;

    return (
      <View
        style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}
      >
        <Text style={styles.statsTitle} variant="titleMedium">
          Your Stats
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text
              style={[styles.statValue, { color: theme.colors.onSurface }]}
              variant="headlineMedium"
            >
              {stats.totalGames}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
              variant="labelSmall"
            >
              Played
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text
              style={[styles.statValue, { color: theme.colors.primary }]}
              variant="headlineMedium"
            >
              {stats.wins}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
              variant="labelSmall"
            >
              Wins
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text
              style={[styles.statValue, { color: theme.colors.error }]}
              variant="headlineMedium"
            >
              {stats.losses}
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
              variant="labelSmall"
            >
              Losses
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text
              style={[styles.statValue, { color: theme.colors.onSurface }]}
              variant="headlineMedium"
            >
              {stats.winRate.toFixed(0)}%
            </Text>
            <Text
              style={[
                styles.statLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
              variant="labelSmall"
            >
              Win Rate
            </Text>
          </View>
        </View>

        {stats.currentStreak.count > 0 &&
          stats.currentStreak.type !== "none" && (
            <View
              style={[
                styles.streakBadge,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <Ionicons
                name={
                  stats.currentStreak.type === "win" ? "flame" : "trending-down"
                }
                size={16}
                color={
                  stats.currentStreak.type === "win"
                    ? "#FFB300"
                    : theme.colors.error
                }
              />
              <Text
                style={[styles.streakText, { color: theme.colors.onSurface }]}
                variant="labelMedium"
              >
                {stats.currentStreak.count} {stats.currentStreak.type} streak
              </Text>
            </View>
          )}
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filters}>
      <View
        style={[styles.filterTabs, { backgroundColor: theme.colors.surface }]}
      >
        {(["all", "win", "loss", "draw"] as OutcomeFilter[]).map((outcome) => (
          <TouchableOpacity
            key={outcome}
            style={[
              styles.filterTab,
              outcomeFilter === outcome && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            onPress={() => setOutcomeFilter(outcome)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: theme.colors.onSurfaceVariant },
                outcomeFilter === outcome && {
                  color: theme.colors.onPrimary,
                  fontWeight: "600",
                },
              ]}
              variant="labelMedium"
            >
              {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderHistoryItem = ({ item }: { item: GameHistoryRecord }) => {
    const userPlayer = item.players.find(
      (p) => p.userId === currentFirebaseUser?.uid,
    );
    const opponent = item.players.find(
      (p) => p.userId !== currentFirebaseUser?.uid,
    );
    const metadata = GAME_METADATA[item.gameType as ExtendedGameType];

    // Determine outcome
    let outcomeColor = theme.colors.onSurfaceVariant;
    let outcomeText = "Draw";
    if (item.winnerId) {
      if (userPlayer?.isWinner) {
        outcomeColor = theme.colors.primary;
        outcomeText = "Victory";
      } else {
        outcomeColor = theme.colors.error;
        outcomeText = "Defeat";
      }
    }

    return (
      <TouchableOpacity
        style={[styles.historyItem, { backgroundColor: theme.colors.surface }]}
        activeOpacity={0.7}
      >
        {/* Game Icon */}
        <View
          style={[
            styles.gameIcon,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <Text style={styles.gameIconEmoji}>{metadata?.icon || "🎮"}</Text>
        </View>

        {/* Game Info */}
        <View style={styles.historyInfo}>
          <Text
            style={[styles.historyOpponent, { color: theme.colors.onSurface }]}
            variant="titleSmall"
          >
            vs {opponent?.displayName || "Unknown"}
          </Text>
          <Text
            style={[
              styles.historyDate,
              { color: theme.colors.onSurfaceVariant },
            ]}
            variant="labelSmall"
          >
            {new Date(item.completedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Outcome */}
        <View style={styles.historyOutcome}>
          <Text
            style={[styles.outcomeText, { color: outcomeColor }]}
            variant="titleSmall"
          >
            {outcomeText}
          </Text>
          <Text
            style={[
              styles.historyMoves,
              { color: theme.colors.onSurfaceVariant },
            ]}
            variant="labelSmall"
          >
            {item.totalMoves} moves
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <>
      {renderStatsCard()}
      {renderFilters()}
    </>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name="gamepad-variant-outline"
        size={64}
        color={theme.colors.onSurfaceVariant}
      />
      <Text
        style={[styles.emptyText, { color: theme.colors.onSurface }]}
        variant="titleMedium"
      >
        No games yet
      </Text>
      <Text
        style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}
        variant="bodyMedium"
      >
        Play some games to see your history!
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  if (loading && records.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header */}
      <View
        style={[styles.header, { borderBottomColor: theme.colors.outline }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.onSurface}
          />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: theme.colors.onSurface }]}
          variant="titleLarge"
        >
          Game History
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* History List */}
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderHistoryItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontWeight: "600",
  },
  headerSpacer: {
    width: 32,
  },
  listContent: {
    padding: Spacing.md,
    flexGrow: 1,
  },

  // Stats Card
  statsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  statsTitle: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontWeight: "700",
  },
  statLabel: {
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignSelf: "center",
    gap: Spacing.xs,
  },
  streakText: {
    fontWeight: "500",
  },

  // Filters
  filters: {
    marginBottom: Spacing.md,
  },
  filterTabs: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
  },
  filterTabText: {},

  // History Item
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  gameIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  gameIconEmoji: {
    fontSize: 22,
  },
  historyInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  historyOpponent: {
    fontWeight: "500",
  },
  historyDate: {
    marginTop: 2,
  },
  historyOutcome: {
    alignItems: "flex-end",
  },
  outcomeText: {
    fontWeight: "600",
  },
  historyMoves: {
    marginTop: 2,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxxl,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontWeight: "600",
  },
  emptySubtext: {
    marginTop: Spacing.xs,
    textAlign: "center",
  },

  // Loading
  loadingMore: {
    padding: Spacing.md,
    alignItems: "center",
  },
});

export default GameHistoryScreen;
