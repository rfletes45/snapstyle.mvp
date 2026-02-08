/**
 * GameHistoryScreen - View completed games with filtering
 *
 * Features:
 * - Two primary tabs: Multiplayer and Single-player
 * - Stats card showing performance (updates per tab and filters)
 * - Filter by game type (per tab)
 * - Filter by outcome (multiplayer only: Win, Loss, Draw)
 * - Detailed stats display per game type
 * - Infinite scroll with pagination
 * - Pull-to-refresh
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 5
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/../constants/theme";
import {
  calculateStatsFromRecords,
  getGameHistory,
} from "@/services/gameHistory";
import { useAuth } from "@/store/AuthContext";
import { GameHistoryRecord, GameHistoryStats } from "@/types/gameHistory";
import {
  ExtendedGameType,
  GAME_METADATA,
  SinglePlayerGameType,
} from "@/types/games";
import {
  BounceBlitzStats,
  MemoryMasterStats,
  Play2048Stats,
  SinglePlayerGameStats,
  SnakeMasterStats,
  WordMasterStats,
} from "@/types/singlePlayerGames";
import { TurnBasedGameType } from "@/types/turnBased";

// =============================================================================
// Types
// =============================================================================

type HistoryTab = "multiplayer" | "singleplayer";
type OutcomeFilter = "all" | "win" | "loss" | "draw";
type GameTypeFilterOption = "all" | ExtendedGameType;

// Extended record type to include single-player stats
type ExtendedGameHistoryRecord = GameHistoryRecord & {
  isSinglePlayer?: boolean;
  singlePlayerScore?: number;
  isNewHighScore?: boolean;
  singlePlayerStats?: SinglePlayerGameStats;
};

// Multiplayer games for filtering
const MULTIPLAYER_GAMES: {
  type: GameTypeFilterOption;
  label: string;
  icon: string;
}[] = [
  { type: "all", label: "All Games", icon: "🎮" },
  { type: "chess", label: "Chess", icon: "♟️" },
  { type: "checkers", label: "Checkers", icon: "⚫" },
  { type: "tic_tac_toe", label: "Tic-Tac-Toe", icon: "⭕" },
  { type: "crazy_eights", label: "Crazy Eights", icon: "🎴" },
];

// Single-player games for filtering
const SINGLEPLAYER_GAMES: {
  type: GameTypeFilterOption;
  label: string;
  icon: string;
}[] = [
  { type: "all", label: "All Games", icon: "🎮" },
  { type: "word_master", label: "Word", icon: "📝" },
  { type: "flappy_bird", label: "Flappy Bird", icon: "🐦" },
  { type: "bounce_blitz", label: "Bounce Blitz", icon: "⚪" },
  { type: "play_2048", label: "2048", icon: "🔢" },
  { type: "snake_master", label: "Snake", icon: "🐍" },
  { type: "memory_master", label: "Memory", icon: "🧠" },
];

// =============================================================================
// Cache Types
// =============================================================================

interface TabCache {
  records: ExtendedGameHistoryRecord[];
  stats: GameHistoryStats | null;
  hasMore: boolean;
  lastId: string | undefined;
  timestamp: number;
}

const CACHE_TTL = 60000; // 1 minute cache validity

// =============================================================================
// Component
// =============================================================================

export function GameHistoryScreen() {
  const navigation = useNavigation<any>();
  const { currentFirebaseUser } = useAuth();
  const theme = useTheme();

  // Track loaded record IDs to prevent duplicates
  const loadedIdsRef = useRef<Set<string>>(new Set());

  // Cache for each tab to avoid refetching on tab switch
  const cacheRef = useRef<Map<string, TabCache>>(new Map());

  // State
  const [records, setRecords] = useState<ExtendedGameHistoryRecord[]>([]);
  const [stats, setStats] = useState<GameHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastId, setLastId] = useState<string | undefined>();

  // Tab state
  const [activeTab, setActiveTab] = useState<HistoryTab>("multiplayer");

  // Separate filters per tab
  const [multiplayerGameFilter, setMultiplayerGameFilter] =
    useState<GameTypeFilterOption>("all");
  const [singlePlayerGameFilter, setSinglePlayerGameFilter] =
    useState<GameTypeFilterOption>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

  // Get current filter based on active tab
  const currentGameFilter =
    activeTab === "multiplayer"
      ? multiplayerGameFilter
      : singlePlayerGameFilter;
  const setCurrentGameFilter =
    activeTab === "multiplayer"
      ? setMultiplayerGameFilter
      : setSinglePlayerGameFilter;

  // Computed game type for API
  const apiGameType = useMemo(() => {
    return currentGameFilter === "all"
      ? undefined
      : (currentGameFilter as TurnBasedGameType | SinglePlayerGameType);
  }, [currentGameFilter]);

  // Generate cache key based on current filters
  const getCacheKey = useCallback(() => {
    return `${activeTab}_${currentGameFilter}_${outcomeFilter}`;
  }, [activeTab, currentGameFilter, outcomeFilter]);

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  const loadHistory = useCallback(
    async (refresh = false, useCache = true) => {
      if (!currentFirebaseUser?.uid) return;

      const cacheKey = getCacheKey();

      // Check cache on initial load (refresh=true means first load or explicit refresh)
      if (refresh && useCache) {
        const cached = cacheRef.current.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          // Use cached data
          setRecords(cached.records);
          setStats(cached.stats);
          setHasMore(cached.hasMore);
          setLastId(cached.lastId);
          setLoading(false);
          setRefreshing(false);

          // Populate loadedIdsRef from cache
          loadedIdsRef.current.clear();
          cached.records.forEach((r) => loadedIdsRef.current.add(r.id));
          return;
        }
      }

      if (refresh) {
        setRefreshing(true);
        setLastId(undefined);
        loadedIdsRef.current.clear();
      }

      try {
        // Fetch records with a larger limit on refresh to have enough for stats
        const fetchLimit = refresh ? 50 : 20;

        const result = await getGameHistory({
          userId: currentFirebaseUser.uid,
          gameType: apiGameType,
          outcome: outcomeFilter === "all" ? undefined : outcomeFilter,
          limit: fetchLimit,
          startAfter: refresh ? undefined : lastId,
          scope: activeTab, // Pass the tab scope to filter multiplayer vs single-player
        });

        // Filter out duplicates using ref
        const newRecords = result.records.filter((record) => {
          if (loadedIdsRef.current.has(record.id)) {
            return false;
          }
          loadedIdsRef.current.add(record.id);
          return true;
        });

        if (refresh) {
          setRecords(newRecords as ExtendedGameHistoryRecord[]);
          // Calculate stats from fetched records instead of making a second API call
          // This saves a full round-trip to Firebase
          const statsResult = calculateStatsFromRecords(
            result.records,
            currentFirebaseUser.uid,
          );
          setStats(statsResult);

          // Cache the results
          cacheRef.current.set(cacheKey, {
            records: newRecords as ExtendedGameHistoryRecord[],
            stats: statsResult,
            hasMore: result.hasMore && newRecords.length > 0,
            lastId: result.lastId,
            timestamp: Date.now(),
          });
        } else {
          setRecords(
            (prev) => [...prev, ...newRecords] as ExtendedGameHistoryRecord[],
          );
        }

        setHasMore(result.hasMore && newRecords.length > 0);
        setLastId(result.lastId);
      } catch (error) {
        console.error("[GameHistoryScreen] Failed to load history:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [
      currentFirebaseUser?.uid,
      apiGameType,
      outcomeFilter,
      lastId,
      activeTab,
      getCacheKey,
    ],
  );

  // Initial load and filter/tab changes
  useEffect(() => {
    setLoading(true);
    setRecords([]);
    loadedIdsRef.current.clear();
    loadHistory(true, true); // Use cache if available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentGameFilter, outcomeFilter, currentFirebaseUser?.uid]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading && !refreshing) {
      setLoadingMore(true);
      loadHistory(false, false);
    }
  }, [loadingMore, hasMore, loading, refreshing, loadHistory]);

  const handleRefresh = useCallback(() => {
    // Clear cache for current filter and force refresh
    const cacheKey = getCacheKey();
    cacheRef.current.delete(cacheKey);
    loadHistory(true, false); // Bypass cache on manual refresh
  }, [loadHistory, getCacheKey]);

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  // Tab selector component
  const renderTabSelector = () => (
    <View
      style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}
    >
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === "multiplayer" && {
            backgroundColor: theme.colors.primary,
          },
        ]}
        onPress={() => setActiveTab("multiplayer")}
        activeOpacity={0.7}
      >
        <Ionicons
          name="people"
          size={18}
          color={
            activeTab === "multiplayer"
              ? theme.colors.onPrimary
              : theme.colors.onSurfaceVariant
          }
        />
        <Text
          style={[
            styles.tabText,
            { color: theme.colors.onSurfaceVariant },
            activeTab === "multiplayer" && {
              color: theme.colors.onPrimary,
              fontWeight: "600",
            },
          ]}
          variant="labelLarge"
        >
          Multiplayer
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === "singleplayer" && {
            backgroundColor: theme.colors.primary,
          },
        ]}
        onPress={() => setActiveTab("singleplayer")}
        activeOpacity={0.7}
      >
        <Ionicons
          name="person"
          size={18}
          color={
            activeTab === "singleplayer"
              ? theme.colors.onPrimary
              : theme.colors.onSurfaceVariant
          }
        />
        <Text
          style={[
            styles.tabText,
            { color: theme.colors.onSurfaceVariant },
            activeTab === "singleplayer" && {
              color: theme.colors.onPrimary,
              fontWeight: "600",
            },
          ]}
          variant="labelLarge"
        >
          Single-player
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStatsCard = () => {
    if (!stats) return null;

    const filterLabel =
      currentGameFilter === "all"
        ? activeTab === "multiplayer"
          ? "Multiplayer"
          : "Single-player"
        : GAME_METADATA[currentGameFilter as ExtendedGameType]?.name ||
          currentGameFilter;

    return (
      <View
        style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}
      >
        <Text style={styles.statsTitle} variant="titleMedium">
          {filterLabel} Stats
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

  const renderGameTypeFilter = () => {
    const games =
      activeTab === "multiplayer" ? MULTIPLAYER_GAMES : SINGLEPLAYER_GAMES;

    return (
      <View style={styles.gameTypeFilterContainer}>
        <Text
          style={[
            styles.filterSectionLabel,
            { color: theme.colors.onSurfaceVariant },
          ]}
          variant="labelMedium"
        >
          Filter by Game
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gameTypeFilterScroll}
        >
          {games.map((game) => (
            <TouchableOpacity
              key={game.type}
              style={[
                styles.gameTypeChip,
                { backgroundColor: theme.colors.surfaceVariant },
                currentGameFilter === game.type && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
              onPress={() => setCurrentGameFilter(game.type)}
              activeOpacity={0.7}
            >
              <Text style={styles.gameTypeChipIcon}>{game.icon}</Text>
              <Text
                style={[
                  styles.gameTypeChipText,
                  { color: theme.colors.onSurfaceVariant },
                  currentGameFilter === game.type && {
                    color: theme.colors.onPrimary,
                    fontWeight: "600",
                  },
                ]}
                variant="labelSmall"
              >
                {game.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderOutcomeFilter = () => {
    // Only show outcome filter for multiplayer games
    if (activeTab !== "multiplayer") return null;

    return (
      <View style={styles.filters}>
        <Text
          style={[
            styles.filterSectionLabel,
            { color: theme.colors.onSurfaceVariant },
          ]}
          variant="labelMedium"
        >
          Filter by Outcome
        </Text>
        <View
          style={[styles.filterTabs, { backgroundColor: theme.colors.surface }]}
        >
          {(["all", "win", "loss", "draw"] as OutcomeFilter[]).map(
            (outcome) => (
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
            ),
          )}
        </View>
      </View>
    );
  };

  // Helper function to get game-specific stats display for single-player games
  const getSinglePlayerStatsDisplay = (
    item: ExtendedGameHistoryRecord,
  ): string => {
    const stats = item.singlePlayerStats;
    if (!stats) {
      // Fallback to just showing score
      return item.singlePlayerScore !== undefined
        ? `Score: ${item.singlePlayerScore}`
        : "";
    }

    switch (stats.gameType) {
      case "word_master": {
        const ws = stats as WordMasterStats;
        if (ws.wordGuessed) {
          return `✅ Guessed in ${ws.attemptsUsed} attempt${ws.attemptsUsed !== 1 ? "s" : ""}`;
        }
        return `❌ ${ws.attemptsUsed}/6 attempts`;
      }
      case "snake_master": {
        const ss = stats as SnakeMasterStats;
        return `🍎 ${ss.foodEaten} apples • ${ss.maxLength} max length`;
      }
      case "play_2048": {
        const s2 = stats as Play2048Stats;
        return `🔢 Best: ${s2.bestTile} • ${s2.moveCount} moves`;
      }
      case "memory_master": {
        const ms = stats as MemoryMasterStats;
        return `🧠 ${ms.pairsMatched} pairs • ${ms.attempts} attempts`;
      }
      case "bounce_blitz": {
        const bb = stats as BounceBlitzStats;
        return `⚪ Level ${bb.levelReached} • ${bb.blocksDestroyed} blocks`;
      }
      default:
        return item.singlePlayerScore !== undefined
          ? `Score: ${item.singlePlayerScore}`
          : "";
    }
  };

  const renderHistoryItem = ({ item }: { item: ExtendedGameHistoryRecord }) => {
    const userPlayer = item.players.find(
      (p) => p.userId === currentFirebaseUser?.uid,
    );
    const opponent = item.players.find(
      (p) => p.userId !== currentFirebaseUser?.uid,
    );
    const metadata = GAME_METADATA[item.gameType as ExtendedGameType];

    // Check if this is a single-player game
    const isSinglePlayer = item.players.length === 1 || item.isSinglePlayer;
    const isNewHighScore = item.isNewHighScore;

    // Determine outcome display
    let outcomeColor = theme.colors.onSurfaceVariant;
    let outcomeText = "Draw";
    let statsText = "";

    if (isSinglePlayer) {
      // Single-player games show detailed stats
      statsText = getSinglePlayerStatsDisplay(item);

      if (userPlayer?.isWinner || item.winnerId === currentFirebaseUser?.uid) {
        outcomeColor = theme.colors.primary;
        outcomeText = isNewHighScore ? "🏆 New Best!" : "Completed";
      } else {
        outcomeColor = theme.colors.error;
        outcomeText = "Game Over";
      }
    } else {
      // Multiplayer games show moves and opponent
      statsText = `${item.totalMoves} moves`;
      if (item.winnerId) {
        if (userPlayer?.isWinner) {
          outcomeColor = theme.colors.primary;
          outcomeText = "Victory";
        } else {
          outcomeColor = theme.colors.error;
          outcomeText = "Defeat";
        }
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
          <View style={styles.historyTitleRow}>
            <Text
              style={[
                styles.historyOpponent,
                { color: theme.colors.onSurface },
              ]}
              variant="titleSmall"
              numberOfLines={1}
            >
              {isSinglePlayer
                ? metadata?.name || "Game"
                : `vs ${opponent?.displayName || "Unknown"}`}
            </Text>
            {!isSinglePlayer && metadata && (
              <Text style={styles.gameTypeLabel}>{metadata.icon}</Text>
            )}
          </View>
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
          {/* Stats line for detailed info */}
          {statsText && (
            <Text
              style={[
                styles.historyStats,
                { color: theme.colors.onSurfaceVariant },
              ]}
              variant="labelSmall"
              numberOfLines={1}
            >
              {statsText}
            </Text>
          )}
        </View>

        {/* Outcome */}
        <View style={styles.historyOutcome}>
          <Text
            style={[styles.outcomeText, { color: outcomeColor }]}
            variant="titleSmall"
          >
            {outcomeText}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <>
      {renderTabSelector()}
      {renderStatsCard()}
      {renderGameTypeFilter()}
      {renderOutcomeFilter()}
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

  // Tab Selector
  tabContainer: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  tabText: {},

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

  // Filter Section Label
  filterSectionLabel: {
    marginBottom: Spacing.xs,
    marginLeft: Spacing.xs,
  },

  // Game Type Filter
  gameTypeFilterContainer: {
    marginBottom: Spacing.md,
  },
  gameTypeFilterScroll: {
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  gameTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  gameTypeChipIcon: {
    fontSize: 14,
  },
  gameTypeChipText: {},

  // Outcome Filters
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
  historyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  historyOpponent: {
    fontWeight: "500",
    flex: 1,
  },
  gameTypeLabel: {
    fontSize: 14,
  },
  historyDate: {
    marginTop: 2,
  },
  historyStats: {
    marginTop: 2,
  },
  historyOutcome: {
    alignItems: "flex-end",
    marginLeft: Spacing.sm,
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
