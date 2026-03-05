/**
 * Games V4 — Leaderboard Screen
 *
 * Displays weekly leaderboards for a selected game.
 * Shows ranked entries with the current user highlighted.
 *
 * Route: GameLeaderboardV4 { gameId }
 *
 * @module gamesV4/screens/GameLeaderboardScreenV4
 */

import { GAME_METADATA } from "@/gamesV4/constants";
import { useLeaderboardV4 } from "@/gamesV4/hooks/useLeaderboardV4";
import type { LeaderboardEntryV4 } from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types/common";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function GameLeaderboardScreenV4() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<{
    key: string;
    name: string;
    params: { gameId: string };
  }>();

  const gameId = route.params.gameId as GameId;
  const meta = GAME_METADATA[gameId];
  const { entries, weekKey, loading, error } = useLeaderboardV4(gameId);
  const myUid = currentFirebaseUser?.uid;

  const rankedEntries = useMemo(
    () =>
      entries.map((e, idx) => ({
        ...e,
        rank: idx + 1,
        isMe: e.uid === myUid,
      })),
    [entries, myUid],
  );

  const renderItem = ({
    item,
  }: {
    item: LeaderboardEntryV4 & { rank: number; isMe: boolean };
  }) => {
    const bg = item.isMe
      ? theme.colors.primary + "22"
      : theme.isDark
        ? "#1A1A1A"
        : "#FFF";
    const textColor = theme.isDark ? "#FFF" : "#222";

    return (
      <View style={[styles.row, { backgroundColor: bg }]}>
        <View style={styles.rankContainer}>
          <Text
            style={[
              styles.rankText,
              {
                color: item.rank <= 3 ? theme.colors.primary : textColor,
                fontWeight: item.rank <= 3 ? "800" : "600",
              },
            ]}
          >
            {item.rank <= 3
              ? ["🥇", "🥈", "🥉"][item.rank - 1]
              : `#${item.rank}`}
          </Text>
        </View>
        <View style={styles.nameContainer}>
          <Text
            style={[
              styles.nameText,
              {
                color: textColor,
                fontWeight: item.isMe ? "700" : "400",
              },
            ]}
            numberOfLines={1}
          >
            {item.displayName}
            {item.isMe ? " (You)" : ""}
          </Text>
        </View>
        <Text style={[styles.scoreText, { color: theme.colors.primary }]}>
          {item.score.toLocaleString()}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? "#000" : theme.colors.background,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text
            style={[styles.title, { color: theme.isDark ? "#FFF" : "#222" }]}
          >
            {meta?.displayName ?? gameId} Leaderboard
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.isDark ? "#AAA" : "#666" }]}
          >
            Week {weekKey}
          </Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error || entries.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons
            name="trophy-outline"
            size={48}
            color={theme.isDark ? "#555" : "#CCC"}
          />
          <Text
            style={[
              styles.emptyText,
              { color: theme.isDark ? "#777" : "#999" },
            ]}
          >
            No scores yet this week. Be the first!
          </Text>
        </View>
      ) : (
        <FlatList
          data={rankedEntries}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  rankContainer: {
    width: 40,
  },
  rankText: {
    fontSize: 16,
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  nameText: {
    fontSize: 15,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
});
