/**
 * LeaderboardScreen.tsx
 *
 * Features:
 * - Global top 100 leaderboard
 * - Friends-only leaderboard
 * - Game selector (all available games - single player and multiplayer)
 * - Week navigation (for single player games)
 * - User's rank highlight
 * - ELO rating display for multiplayer games
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 8
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { formatScore } from "@/services/games";
import {
  formatWeekKey,
  getFriendsLeaderboard,
  getPreviousWeekKey,
  getRankDisplay,
  getUserRank,
  getWeeklyLeaderboard,
  LeaderboardResult,
} from "@/services/leaderboards";
import {
  getMultiplayerFriendsLeaderboard,
  getMultiplayerGlobalLeaderboard,
  getMultiplayerUserRank,
  MultiplayerLeaderboardData,
  MultiplayerLeaderboardEntry,
  MultiplayerLeaderboardTimeframe,
} from "@/services/multiplayerLeaderboard";
import {
  formatScore as formatSinglePlayerScore,
  getLeaderboard as getSinglePlayerLeaderboard,
  getPlayerRank as getSinglePlayerRank,
} from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import type { PlayStackParamList } from "@/types/navigation/root";
import { SinglePlayerGameType } from "@/types/games";
import {
  GameType,
  getCurrentWeekKey,
  LeaderboardEntry,
  WeekKey,
} from "@/types/models";
import { getRatingTier } from "@/types/multiplayerLeaderboard";
import { TurnBasedGameType } from "@/types/turnBased";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  Card,
  Chip,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/games/LeaderboardScreen");
type Props = NativeStackScreenProps<PlayStackParamList, "Leaderboard">;

type LeaderboardType = "global" | "friends";

// Extended game type that includes legacy, new single-player, and multiplayer games
type ExtendedLeaderboardGameType =
  | GameType
  | SinglePlayerGameType
  | TurnBasedGameType;

// Game category for display purposes
type GameCategory = "legacy" | "single-player" | "multiplayer";

interface LeaderboardGame {
  id: ExtendedLeaderboardGameType;
  name: string;
  icon: string;
  category: GameCategory;
}

// Games that have leaderboards
const LEADERBOARD_GAMES: LeaderboardGame[] = [
  // Single-player games (legacy)
  {
    id: "reaction_tap",
    name: "Reaction",
    icon: "lightning-bolt",
    category: "legacy",
  },
  {
    id: "timed_tap",
    name: "Speed Tap",
    icon: "timer-outline",
    category: "legacy",
  },
  // Single-player games (new)
  {
    id: "bounce_blitz",
    name: "Bounce",
    icon: "circle-multiple",
    category: "single-player",
  },
  {
    id: "clicker_mine",
    name: "Clicker Mine",
    icon: "pickaxe",
    category: "single-player",
  },
  {
    id: "helix_drop",
    name: "Helix Drop",
    icon: "blur-radial",
    category: "single-player",
  },
  {
    id: "memory_master",
    name: "Memory",
    icon: "cards",
    category: "single-player",
  },
  // Multiplayer games
  { id: "chess", name: "Chess", icon: "chess-king", category: "multiplayer" },
  {
    id: "checkers",
    name: "Checkers",
    icon: "checkerboard",
    category: "multiplayer",
  },
  {
    id: "tic_tac_toe",
    name: "Tic Tac Toe",
    icon: "grid",
    category: "multiplayer",
  },
  {
    id: "crazy_eights",
    name: "Crazy 8s",
    icon: "cards-playing-outline",
    category: "multiplayer",
  },
];

export default function LeaderboardScreen({ navigation, route }: Props) {
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;
  const theme = useTheme();

  // Get initial game from route params or default
  const routeGameId = route.params?.gameId;
  const initialGame: ExtendedLeaderboardGameType =
    routeGameId &&
    LEADERBOARD_GAMES.some(
      ({ id }) => id === (routeGameId as ExtendedLeaderboardGameType),
    )
      ? (routeGameId as ExtendedLeaderboardGameType)
      : "reaction_tap";

  const [gameId, setGameId] =
    useState<ExtendedLeaderboardGameType>(initialGame);
  const [leaderboardType, setLeaderboardType] =
    useState<LeaderboardType>("global");
  const [weekKey, setWeekKey] = useState<WeekKey>(getCurrentWeekKey());

  // Legacy/single-player state
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [singlePlayerEntries, setSinglePlayerEntries] = useState<
    LeaderboardEntry[]
  >([]);

  // Multiplayer state
  const [multiplayerData, setMultiplayerData] =
    useState<MultiplayerLeaderboardData | null>(null);
  const [multiplayerTimeframe, setMultiplayerTimeframe] =
    useState<MultiplayerLeaderboardTimeframe>("all-time");

  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Check game category
  const gameConfig = LEADERBOARD_GAMES.find((g) => g.id === gameId);
  const gameCategory = gameConfig?.category || "legacy";
  const isLegacyGame = gameCategory === "legacy";
  const isMultiplayerGame = gameCategory === "multiplayer";

  const loadLeaderboard = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);

      if (isMultiplayerGame) {
        // Use multiplayer leaderboard system
        let data: MultiplayerLeaderboardData;

        if (leaderboardType === "friends") {
          data = await getMultiplayerFriendsLeaderboard(
            userId,
            gameId as TurnBasedGameType,
            multiplayerTimeframe,
          );
        } else {
          data = await getMultiplayerGlobalLeaderboard(
            gameId as TurnBasedGameType,
            multiplayerTimeframe,
            100,
          );

          // Also get user's rank
          const rankResult = await getMultiplayerUserRank(
            userId,
            gameId as TurnBasedGameType,
            multiplayerTimeframe,
          );
          if (rankResult) {
            data.userEntry = rankResult.entry;
            data.userGlobalRank = rankResult.globalRank;
          }
        }

        setMultiplayerData(data);
        setResult(null);
        setSinglePlayerEntries([]);
        setUserRank(data.userGlobalRank || data.userEntry?.rank || null);
      } else if (isLegacyGame) {
        // Use old leaderboard system for legacy games
        let data: LeaderboardResult;

        if (leaderboardType === "friends") {
          data = await getFriendsLeaderboard(
            userId,
            gameId as GameType,
            weekKey,
          );
        } else {
          data = await getWeeklyLeaderboard(gameId as GameType, weekKey);
        }

        setResult(data);
        setSinglePlayerEntries([]);
        setMultiplayerData(null);

        // Get user's global rank if viewing global leaderboard
        if (leaderboardType === "global") {
          const rankResult = await getUserRank(
            userId,
            gameId as GameType,
            weekKey,
          );
          setUserRank(rankResult?.rank || null);
        } else {
          setUserRank(data.userRank || null);
        }
      } else {
        // Use new single player leaderboard system
        const entries = await getSinglePlayerLeaderboard(
          gameId as SinglePlayerGameType,
          "weekly",
          100,
        );

        // Convert to LeaderboardEntry format
        const convertedEntries: LeaderboardEntry[] = entries.map((e) => {
          // Parse avatarConfig from JSON string if present
          let avatarConfig: LeaderboardEntry["avatarConfig"];
          if (e.playerAvatar) {
            try {
              avatarConfig = JSON.parse(e.playerAvatar);
            } catch {
              avatarConfig = undefined;
            }
          }
          return {
            uid: e.playerId,
            displayName: e.playerName,
            avatarConfig,
            score: e.score,
            rank: e.rank,
            updatedAt: e.achievedAt,
          };
        });

        setSinglePlayerEntries(convertedEntries);
        setResult(null);
        setMultiplayerData(null);

        // Get user's rank
        const rank = await getSinglePlayerRank(
          userId,
          gameId as SinglePlayerGameType,
          "weekly",
        );
        setUserRank(rank);
      }
    } catch (err) {
      logger.error("Error loading leaderboard:", err);
      setError("Couldn't load leaderboard");
    }
  }, [
    userId,
    gameId,
    leaderboardType,
    weekKey,
    isLegacyGame,
    isMultiplayerGame,
    multiplayerTimeframe,
  ]);

  useEffect(() => {
    setLoading(true);
    loadLeaderboard().finally(() => setLoading(false));
  }, [loadLeaderboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const goToPreviousWeek = () => {
    setWeekKey(getPreviousWeekKey(weekKey));
  };

  const goToCurrentWeek = () => {
    setWeekKey(getCurrentWeekKey());
  };

  const isCurrentWeek = weekKey === getCurrentWeekKey();

  // Render a single-player/legacy entry
  const renderEntry = ({
    item,
    index,
  }: {
    item: LeaderboardEntry;
    index: number;
  }) => {
    const isCurrentUser = item.uid === userId;
    const rank = item.rank || index + 1;

    return (
      <Card
        style={[
          styles.entryCard,
          { backgroundColor: theme.colors.surface },
          isCurrentUser && {
            backgroundColor: theme.colors.primaryContainer,
            borderColor: theme.colors.primary,
            borderWidth: 2,
          },
        ]}
        mode={isCurrentUser ? "elevated" : "outlined"}
      >
        <Card.Content style={styles.entryContent}>
          {/* Rank */}
          <View style={styles.rankContainer}>
            <Text
              style={[
                styles.rankText,
                { color: theme.colors.onSurfaceVariant },
                rank <= 3 && styles.topRankText,
              ]}
            >
              {getRankDisplay(rank)}
            </Text>
          </View>

          {/* Avatar */}
          <ProfilePictureWithDecoration
            pictureUrl={item.profilePictureUrl}
            name={item.displayName}
            decorationId={item.decorationId}
            size={36}
          />

          {/* Name */}
          <View style={styles.nameContainer}>
            <Text
              style={[
                styles.displayName,
                { color: theme.colors.onSurface },
                isCurrentUser && {
                  color: theme.colors.primary,
                  fontWeight: "600",
                },
              ]}
              numberOfLines={1}
            >
              {item.displayName}
              {isCurrentUser && " (You)"}
            </Text>
          </View>

          {/* Score */}
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreText, { color: theme.colors.primary }]}>
              {isLegacyGame
                ? formatScore(gameId as GameType, item.score)
                : formatSinglePlayerScore(
                    gameId as SinglePlayerGameType,
                    item.score,
                  )}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Render a multiplayer entry with ELO rating
  const renderMultiplayerEntry = ({
    item,
    index,
  }: {
    item: MultiplayerLeaderboardEntry;
    index: number;
  }) => {
    const isCurrentUser = item.userId === userId;
    const rank = item.rank || index + 1;
    const tier = getRatingTier(item.rating);

    return (
      <Card
        style={[
          styles.entryCard,
          { backgroundColor: theme.colors.surface },
          isCurrentUser && {
            backgroundColor: theme.colors.primaryContainer,
            borderColor: theme.colors.primary,
            borderWidth: 2,
          },
        ]}
        mode={isCurrentUser ? "elevated" : "outlined"}
      >
        <Card.Content style={styles.entryContent}>
          {/* Rank */}
          <View style={styles.rankContainer}>
            <Text
              style={[
                styles.rankText,
                { color: theme.colors.onSurfaceVariant },
                rank <= 3 && styles.topRankText,
              ]}
            >
              {getRankDisplay(rank)}
            </Text>
          </View>

          {/* Avatar */}
          <ProfilePictureWithDecoration
            pictureUrl={item.profilePictureUrl || item.avatarUrl}
            name={item.displayName}
            decorationId={item.decorationId}
            size={36}
          />

          {/* Name and Stats */}
          <View style={styles.nameContainer}>
            <Text
              style={[
                styles.displayName,
                { color: theme.colors.onSurface },
                isCurrentUser && {
                  color: theme.colors.primary,
                  fontWeight: "600",
                },
              ]}
              numberOfLines={1}
            >
              {item.displayName}
              {isCurrentUser && " (You)"}
            </Text>
            <Text
              style={[
                styles.statsSubtext,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {item.wins}W - {item.losses}L ({item.winRate.toFixed(0)}%)
            </Text>
          </View>

          {/* Rating with tier */}
          <View style={styles.ratingContainer}>
            <View
              style={[styles.tierBadge, { backgroundColor: tier.color + "30" }]}
            >
              <Text style={styles.tierIcon}>{tier.icon}</Text>
            </View>
            <Text style={[styles.ratingText, { color: tier.color }]}>
              {item.rating}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Game Selector - Scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.gameSelector}
        contentContainerStyle={styles.gameSelectorContent}
      >
        {LEADERBOARD_GAMES.map((game) => (
          <Chip
            key={game.id}
            selected={gameId === game.id}
            onPress={() => setGameId(game.id)}
            icon={game.icon}
            style={styles.gameChip}
          >
            {game.name}
          </Chip>
        ))}
      </ScrollView>

      {/* Leaderboard Type Selector - for legacy and multiplayer games */}
      {(isLegacyGame || isMultiplayerGame) && (
        <SegmentedButtons
          value={leaderboardType}
          onValueChange={(value) =>
            setLeaderboardType(value as LeaderboardType)
          }
          buttons={[
            { value: "global", label: "Global", icon: "earth" },
            { value: "friends", label: "Friends", icon: "account-group" },
          ]}
          style={styles.segmentedButtons}
        />
      )}

      {/* Week Navigation - only for legacy games */}
      {isLegacyGame && (
        <View style={styles.weekNav}>
          <Chip
            icon="chevron-left"
            onPress={goToPreviousWeek}
            style={styles.weekChip}
          >
            Previous
          </Chip>
          <Text style={[styles.weekText, { color: theme.colors.onSurface }]}>
            {formatWeekKey(weekKey)}
          </Text>
          {!isCurrentWeek && (
            <Chip
              icon="calendar-today"
              onPress={goToCurrentWeek}
              style={styles.weekChip}
            >
              Current
            </Chip>
          )}
        </View>
      )}

      {/* Timeframe selector - only for multiplayer games */}
      {isMultiplayerGame && (
        <SegmentedButtons
          value={multiplayerTimeframe}
          onValueChange={(value) =>
            setMultiplayerTimeframe(value as MultiplayerLeaderboardTimeframe)
          }
          buttons={[
            { value: "all-time", label: "All Time" },
            { value: "monthly", label: "Monthly" },
            { value: "weekly", label: "Weekly" },
          ]}
          style={styles.segmentedButtons}
        />
      )}

      {/* User Rank Summary */}
      {userRank && (
        <Card
          style={[
            styles.rankSummaryCard,
            { backgroundColor: theme.colors.tertiaryContainer },
          ]}
          mode="elevated"
        >
          <Card.Content style={styles.rankSummaryContent}>
            <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
            <Text
              style={[
                styles.rankSummaryText,
                { color: theme.colors.onTertiaryContainer },
              ]}
            >
              Your Rank: {getRankDisplay(userRank)}
            </Text>
            {isMultiplayerGame && multiplayerData?.userEntry && (
              <Text
                style={[
                  styles.rankSummarySubtext,
                  { color: theme.colors.onTertiaryContainer },
                ]}
              >
                Rating: {multiplayerData.userEntry.rating}
              </Text>
            )}
          </Card.Content>
        </Card>
      )}
    </View>
  );

  const renderEmptyState = () => {
    const gameName =
      LEADERBOARD_GAMES.find((g) => g.id === gameId)?.name || gameId;
    return (
      <EmptyState
        icon="trophy-outline"
        title="No Scores Yet"
        subtitle={
          leaderboardType === "friends"
            ? "Play some games with friends to see scores here!"
            : `Be the first to set a score this week in ${gameName}!`
        }
      />
    );
  };

  if (!userId) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View style={styles.centerContainer}>
          <Text style={{ color: theme.colors.onBackground }}>
            Please sign in to view leaderboards
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["bottom"]}
    >
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Leaderboards" />
      </Appbar.Header>

      {loading && !refreshing ? (
        <LoadingState message="Loading leaderboard..." />
      ) : error ? (
        <ErrorState
          title="Something went wrong"
          message={error}
          onRetry={loadLeaderboard}
        />
      ) : isMultiplayerGame ? (
        <FlatList
          data={multiplayerData?.entries || []}
          keyExtractor={(item) => item.userId}
          renderItem={renderMultiplayerEntry}
          {...LIST_PERFORMANCE_PROPS}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        <FlatList
          data={isLegacyGame ? result?.entries || [] : singlePlayerEntries}
          keyExtractor={(item) => item.uid}
          renderItem={renderEntry}
          {...LIST_PERFORMANCE_PROPS}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    color: "#666",
  },

  listContent: {
    padding: 16,
    flexGrow: 1,
  },

  headerContainer: {
    marginBottom: 16,
  },

  gameSelector: {
    marginBottom: 16,
  },

  gameSelectorContent: {
    gap: 8,
    paddingHorizontal: 4,
  },

  gameChip: {
    marginRight: 4,
  },

  segmentedButtons: {
    marginBottom: 16,
  },

  weekNav: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  weekChip: {
    height: 36,
  },

  weekText: {
    fontSize: 16,
    fontWeight: "600",
  },

  rankSummaryCard: {
    marginBottom: 16,
  },

  rankSummaryContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  rankSummaryText: {
    fontSize: 16,
    fontWeight: "600",
  },

  rankSummarySubtext: {
    fontSize: 14,
    marginLeft: 8,
  },

  entryCard: {
    marginBottom: 8,
  },

  entryContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  rankContainer: {
    width: 50,
    alignItems: "center",
  },

  rankText: {
    fontSize: 14,
    fontWeight: "600",
  },

  topRankText: {
    fontSize: 16,
    color: "#FFD700",
  },

  nameContainer: {
    flex: 1,
  },

  displayName: {
    fontSize: 16,
  },

  statsSubtext: {
    fontSize: 12,
    marginTop: 2,
  },

  scoreContainer: {
    alignItems: "flex-end",
  },

  scoreText: {
    fontSize: 16,
    fontWeight: "700",
  },

  // Multiplayer rating styles
  ratingContainer: {
    alignItems: "center",
    minWidth: 60,
  },

  tierBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },

  tierIcon: {
    fontSize: 16,
  },

  ratingText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
