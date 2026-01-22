/**
 * GamesScreen - Game Hub
 * Phase 16: Real Games + Scorecards
 *
 * Features:
 * - List of available games
 * - Personal best scores
 * - Recent game history
 * - Navigation to individual game screens
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Text, Card, Button, Divider, useTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui";
import {
  getRecentGames,
  getAllPersonalBests,
  formatScore,
  getGameDisplayName,
  getGameDescription,
  getGameIcon,
  PersonalBest,
} from "@/services/games";
import { GameSession, GameType } from "@/types/models";
import { Spacing, BorderRadius } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

interface GamesScreenProps {
  navigation: any;
}

interface GameCardProps {
  gameId: GameType;
  personalBest: PersonalBest | null;
  onPlay: () => void;
}

// =============================================================================
// Game Card Component
// =============================================================================

function GameCard({ gameId, personalBest, onPlay }: GameCardProps) {
  const theme = useTheme();
  const icon = getGameIcon(gameId);
  const name = getGameDisplayName(gameId);
  const description = getGameDescription(gameId);

  return (
    <Card
      style={[styles.gameCard, { backgroundColor: theme.colors.surface }]}
      onPress={onPlay}
    >
      <Card.Content style={styles.gameCardContent}>
        <View
          style={[
            styles.gameIconContainer,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <MaterialCommunityIcons
            name={icon as any}
            size={48}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.gameInfo}>
          <Text style={[styles.gameName, { color: theme.colors.onSurface }]}>
            {name}
          </Text>
          <Text
            style={[
              styles.gameDescription,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {description}
          </Text>
          {personalBest && (
            <View style={styles.personalBestContainer}>
              <MaterialCommunityIcons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.personalBestText}>
                Best: {formatScore(gameId, personalBest.bestScore)}
              </Text>
            </View>
          )}
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={theme.colors.onSurfaceVariant}
        />
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// Recent Game Item
// =============================================================================

function RecentGameItem({ session }: { session: GameSession }) {
  const theme = useTheme();
  const date = new Date(session.playedAt);
  const timeAgo = getTimeAgo(session.playedAt);

  return (
    <View
      style={[
        styles.recentGameItem,
        { borderBottomColor: theme.colors.outlineVariant },
      ]}
    >
      <View
        style={[
          styles.recentGameIcon,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <MaterialCommunityIcons
          name={getGameIcon(session.gameId) as any}
          size={24}
          color={theme.colors.onSurfaceVariant}
        />
      </View>
      <View style={styles.recentGameInfo}>
        <Text
          style={[styles.recentGameName, { color: theme.colors.onSurface }]}
        >
          {getGameDisplayName(session.gameId)}
        </Text>
        <Text
          style={[
            styles.recentGameTime,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {timeAgo}
        </Text>
      </View>
      <Text
        style={[
          styles.recentGameScore,
          {
            color: theme.colors.primary,
            backgroundColor: theme.colors.surfaceVariant,
          },
        ]}
      >
        {formatScore(session.gameId, session.score)}
      </Text>
    </View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function GamesScreen({ navigation }: GamesScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [recentGames, setRecentGames] = useState<GameSession[]>([]);

  const loadData = useCallback(async () => {
    if (!currentFirebaseUser) return;

    try {
      setError(null);
      const [bests, recent] = await Promise.all([
        getAllPersonalBests(currentFirebaseUser.uid),
        getRecentGames(currentFirebaseUser.uid, undefined, 5),
      ]);

      setPersonalBests(bests);
      setRecentGames(recent);
    } catch (err) {
      console.error("[GamesScreen] Error loading data:", err);
      setError("Couldn't load games");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentFirebaseUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh when coming back from a game
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getPersonalBestForGame = (gameId: GameType): PersonalBest | null => {
    return personalBests.find((pb) => pb.gameId === gameId) || null;
  };

  const navigateToGame = (gameId: GameType) => {
    if (gameId === "reaction_tap") {
      navigation.navigate("ReactionTapGame");
    } else if (gameId === "timed_tap") {
      navigation.navigate("TimedTapGame");
    }
  };

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <LoadingState message="Loading games..." />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ErrorState
          title="Something went wrong"
          message={error}
          onRetry={loadData}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* Games Section */}
      <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
        Play Games
      </Text>
      <Text
        style={[
          styles.sectionSubtitle,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        Challenge yourself and share your scores!
      </Text>

      <GameCard
        gameId="reaction_tap"
        personalBest={getPersonalBestForGame("reaction_tap")}
        onPlay={() => navigateToGame("reaction_tap")}
      />

      <GameCard
        gameId="timed_tap"
        personalBest={getPersonalBestForGame("timed_tap")}
        onPlay={() => navigateToGame("timed_tap")}
      />

      {/* Leaderboards & Achievements Section */}
      <Divider style={styles.divider} />
      <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
        Compete & Collect
      </Text>

      <View style={styles.navCardsRow}>
        <TouchableOpacity
          style={[
            styles.navCard,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          onPress={() => navigation.navigate("Leaderboard")}
        >
          <MaterialCommunityIcons name="trophy" size={32} color="#FFD700" />
          <Text
            style={[styles.navCardTitle, { color: theme.colors.onSurface }]}
          >
            Leaderboards
          </Text>
          <Text
            style={[
              styles.navCardSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Weekly rankings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navCard,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          onPress={() => navigation.navigate("Achievements")}
        >
          <MaterialCommunityIcons
            name="medal"
            size={32}
            color={theme.colors.primary}
          />
          <Text
            style={[styles.navCardTitle, { color: theme.colors.onSurface }]}
          >
            Achievements
          </Text>
          <Text
            style={[
              styles.navCardSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Unlock badges
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Games Section */}
      {recentGames.length > 0 && (
        <>
          <Divider style={styles.divider} />
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
          >
            Recent Games
          </Text>

          <View
            style={[
              styles.recentGamesContainer,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            {recentGames.map((session) => (
              <RecentGameItem key={session.id} session={session} />
            ))}
          </View>
        </>
      )}

      {/* No games yet */}
      {recentGames.length === 0 && (
        <>
          <Divider style={styles.divider} />
          <View style={styles.noGamesContainer}>
            <MaterialCommunityIcons
              name="gamepad-variant-outline"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.noGamesText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Play your first game to see your history here!
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor applied inline via theme
  },
  content: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
    // color applied inline
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
    // color applied inline
  },
  gameCard: {
    marginBottom: Spacing.md,
    elevation: 2,
    // backgroundColor applied inline
  },
  gameCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
  },
  gameIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
    // backgroundColor applied inline
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "bold",
    // color applied inline
  },
  gameDescription: {
    fontSize: 12,
    marginTop: 2,
    // color applied inline
  },
  personalBestContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  personalBestText: {
    fontSize: 12,
    color: "#FFD700",
    marginLeft: 4,
    fontWeight: "600",
  },
  divider: {
    marginVertical: Spacing.xl,
  },
  recentGamesContainer: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    // backgroundColor applied inline
  },
  recentGameItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    // borderBottomColor applied inline
  },
  recentGameIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
    // backgroundColor applied inline
  },
  recentGameInfo: {
    flex: 1,
  },
  recentGameName: {
    fontSize: 14,
    fontWeight: "600",
    // color applied inline
  },
  recentGameTime: {
    fontSize: 12,
    // color applied inline
  },
  recentGameScore: {
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    // color and backgroundColor applied inline
  },
  noGamesContainer: {
    alignItems: "center",
    padding: Spacing.xxl,
  },
  noGamesText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.md,
    // color applied inline
  },
  navCardsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  navCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    // backgroundColor and borderColor applied inline
  },
  navCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: Spacing.sm,
    // color applied inline
  },
  navCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    // color applied inline
  },
});
