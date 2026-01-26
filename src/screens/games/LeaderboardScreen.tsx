/**
 * LeaderboardScreen.tsx
 *
 * Features:
 * - Global top 100 leaderboard
 * - Friends-only leaderboard
 * - Game selector (all available games)
 * - Week navigation
 * - User's rank highlight
 */

import { AvatarMini } from "@/components/Avatar";
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
  formatScore as formatSinglePlayerScore,
  getLeaderboard as getSinglePlayerLeaderboard,
  getPlayerRank as getSinglePlayerRank,
} from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import { SinglePlayerGameType } from "@/types/games";
import {
  GameType,
  getCurrentWeekKey,
  LeaderboardEntry,
  WeekKey,
} from "@/types/models";
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
import { Appbar, Card, Chip, SegmentedButtons, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<any, "Leaderboard">;

type LeaderboardType = "global" | "friends";

// Extended game type that includes both legacy and new games
type ExtendedLeaderboardGameType = GameType | SinglePlayerGameType;

// Games that have leaderboards
const LEADERBOARD_GAMES: {
  id: ExtendedLeaderboardGameType;
  name: string;
  icon: string;
  isLegacy: boolean;
}[] = [
  {
    id: "reaction_tap",
    name: "Reaction",
    icon: "lightning-bolt",
    isLegacy: true,
  },
  { id: "timed_tap", name: "Speed Tap", icon: "timer-outline", isLegacy: true },
  { id: "flappy_snap", name: "Flappy", icon: "bird", isLegacy: false },
  {
    id: "bounce_blitz",
    name: "Bounce",
    icon: "circle-multiple",
    isLegacy: false,
  },
  { id: "memory_snap", name: "Memory", icon: "cards", isLegacy: false },
];

export default function LeaderboardScreen({ navigation, route }: Props) {
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;

  // Get initial game from route params or default
  const initialGame = (route.params as any)?.gameId || "reaction_tap";

  const [gameId, setGameId] =
    useState<ExtendedLeaderboardGameType>(initialGame);
  const [leaderboardType, setLeaderboardType] =
    useState<LeaderboardType>("global");
  const [weekKey, setWeekKey] = useState<WeekKey>(getCurrentWeekKey());
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [singlePlayerEntries, setSinglePlayerEntries] = useState<
    LeaderboardEntry[]
  >([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Check if current game is a legacy game (uses old leaderboard system)
  const isLegacyGame =
    LEADERBOARD_GAMES.find((g) => g.id === gameId)?.isLegacy ?? false;

  const loadLeaderboard = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);

      if (isLegacyGame) {
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

        // Get user's rank
        const rank = await getSinglePlayerRank(
          userId,
          gameId as SinglePlayerGameType,
          "weekly",
        );
        setUserRank(rank);
      }
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      setError("Couldn't load leaderboard");
    }
  }, [userId, gameId, leaderboardType, weekKey, isLegacyGame]);

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
        style={[styles.entryCard, isCurrentUser && styles.currentUserCard]}
        mode={isCurrentUser ? "elevated" : "outlined"}
      >
        <Card.Content style={styles.entryContent}>
          {/* Rank */}
          <View style={styles.rankContainer}>
            <Text style={[styles.rankText, rank <= 3 && styles.topRankText]}>
              {getRankDisplay(rank)}
            </Text>
          </View>

          {/* Avatar */}
          <AvatarMini
            config={item.avatarConfig || { baseColor: "#6200EE" }}
            size={40}
          />

          {/* Name */}
          <View style={styles.nameContainer}>
            <Text
              style={[
                styles.displayName,
                isCurrentUser && styles.currentUserName,
              ]}
              numberOfLines={1}
            >
              {item.displayName}
              {isCurrentUser && " (You)"}
            </Text>
          </View>

          {/* Score */}
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>
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

      {/* Leaderboard Type Selector - only for legacy games */}
      {isLegacyGame && (
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
          <Text style={styles.weekText}>{formatWeekKey(weekKey)}</Text>
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

      {/* User Rank Summary */}
      {userRank && (
        <Card style={styles.rankSummaryCard} mode="elevated">
          <Card.Content style={styles.rankSummaryContent}>
            <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
            <Text style={styles.rankSummaryText}>
              Your Rank: {getRankDisplay(userRank)}
            </Text>
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
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Please sign in to view leaderboards</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Appbar.Header>
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
    backgroundColor: "#f5f5f5",
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
    color: "#333",
  },

  rankSummaryCard: {
    backgroundColor: "#FFF8E1",
    marginBottom: 16,
  },

  rankSummaryContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  rankSummaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF8F00",
  },

  entryCard: {
    marginBottom: 8,
    backgroundColor: "#fff",
  },

  currentUserCard: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
    borderWidth: 2,
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
    color: "#666",
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
    color: "#333",
  },

  currentUserName: {
    fontWeight: "600",
    color: "#2196F3",
  },

  scoreContainer: {
    alignItems: "flex-end",
  },

  scoreText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4CAF50",
  },
});
