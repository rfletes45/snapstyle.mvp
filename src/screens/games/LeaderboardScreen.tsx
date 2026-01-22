/**
 * LeaderboardScreen.tsx
 * Phase 17: Weekly per-game leaderboards + friends-only view
 *
 * Features:
 * - Global top 100 leaderboard
 * - Friends-only leaderboard
 * - Game selector (Reaction Time, Speed Tap)
 * - Week navigation
 * - User's rank highlight
 */

import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Card,
  Chip,
  SegmentedButtons,
  Text,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";
import { AvatarMini } from "@/components/Avatar";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import {
  getWeeklyLeaderboard,
  getFriendsLeaderboard,
  getUserRank,
  getRankDisplay,
  formatWeekKey,
  getPreviousWeekKey,
  LeaderboardResult,
} from "@/services/leaderboards";
import {
  GameType,
  LeaderboardEntry,
  WeekKey,
  getCurrentWeekKey,
} from "@/types/models";
import { formatScore, getGameDisplayName } from "@/services/games";

type Props = NativeStackScreenProps<any, "Leaderboard">;

type LeaderboardType = "global" | "friends";

export default function LeaderboardScreen({ navigation, route }: Props) {
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;

  // Get initial game from route params or default
  const initialGame = (route.params as any)?.gameId || "reaction_tap";

  const [gameId, setGameId] = useState<GameType>(initialGame);
  const [leaderboardType, setLeaderboardType] =
    useState<LeaderboardType>("global");
  const [weekKey, setWeekKey] = useState<WeekKey>(getCurrentWeekKey());
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);
      let data: LeaderboardResult;

      if (leaderboardType === "friends") {
        data = await getFriendsLeaderboard(userId, gameId, weekKey);
      } else {
        data = await getWeeklyLeaderboard(gameId, weekKey);
      }

      setResult(data);

      // Get user's global rank if viewing global leaderboard
      if (leaderboardType === "global") {
        const rankResult = await getUserRank(userId, gameId, weekKey);
        setUserRank(rankResult?.rank || null);
      } else {
        setUserRank(data.userRank || null);
      }
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      setError("Couldn't load leaderboard");
    }
  }, [userId, gameId, leaderboardType, weekKey]);

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
              {formatScore(gameId, item.score)}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Game Selector */}
      <View style={styles.gameSelector}>
        <Chip
          selected={gameId === "reaction_tap"}
          onPress={() => setGameId("reaction_tap")}
          icon="lightning-bolt"
          style={styles.gameChip}
        >
          Reaction
        </Chip>
        <Chip
          selected={gameId === "timed_tap"}
          onPress={() => setGameId("timed_tap")}
          icon="timer-outline"
          style={styles.gameChip}
        >
          Speed Tap
        </Chip>
      </View>

      {/* Leaderboard Type Selector */}
      <SegmentedButtons
        value={leaderboardType}
        onValueChange={(value) => setLeaderboardType(value as LeaderboardType)}
        buttons={[
          { value: "global", label: "Global", icon: "earth" },
          { value: "friends", label: "Friends", icon: "account-group" },
        ]}
        style={styles.segmentedButtons}
      />

      {/* Week Navigation */}
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

  const renderEmptyState = () => (
    <EmptyState
      icon="trophy-outline"
      title="No Scores Yet"
      subtitle={
        leaderboardType === "friends"
          ? "Play some games with friends to see scores here!"
          : `Be the first to set a score this week in ${getGameDisplayName(gameId)}!`
      }
    />
  );

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
          data={result?.entries || []}
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
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },

  gameChip: {
    flex: 1,
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
