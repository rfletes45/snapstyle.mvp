/**
 * Games V4 — Game Stats Screen
 *
 * Shows the current user's game statistics:
 * - Global stats (games played, won, win rate)
 * - Per-game personal bests
 * - Recent achievements
 * - Game history
 *
 * Route: GameStatsV4
 *
 * @module gamesV4/screens/GameStatsScreenV4
 */

import { GAME_METADATA } from "@/gamesV4/constants";
import { useGameStatsV4 } from "@/gamesV4/hooks/useGameStatsV4";
import type { GameId } from "@/gamesV4/types/common";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const LIST_CAP = 5;

export default function GameStatsScreenV4() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid ?? "";
  const { pbs, globalStats, history, achievements, loading, error, refresh } =
    useGameStatsV4();

  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const cardBg = theme.isDark ? "#1A1A1A" : "#FFF";
  const textColor = theme.isDark ? "#FFF" : "#222";
  const subtextColor = theme.isDark ? "#AAA" : "#666";

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          {
            backgroundColor: theme.isDark ? "#000" : theme.colors.background,
          },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? "#000" : theme.colors.background,
        },
      ]}
      contentContainerStyle={styles.scrollContent}
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
        <Text style={[styles.title, { color: textColor }]}>Game Stats</Text>
      </View>

      {error && (
        <Text style={[styles.errorText, { color: "#FF3B30" }]}>{error}</Text>
      )}

      {/* Global Stats */}
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Overall Stats
        </Text>
        <View style={styles.statsRow}>
          <StatBox
            label="Played"
            value={globalStats?.gamesPlayed ?? 0}
            color={theme.colors.primary}
          />
          <StatBox
            label="Won"
            value={globalStats?.gamesWon ?? 0}
            color="#34C759"
          />
          <StatBox
            label="Win Rate"
            value={`${globalStats?.winRate ?? 0}%`}
            color="#FF9500"
          />
        </View>
      </View>

      {/* Personal Bests */}
      {pbs.length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Personal Bests
          </Text>
          {pbs.map((pb) => {
            const meta = GAME_METADATA[pb.gameId as GameId];
            return (
              <View key={pb.gameId} style={styles.pbRow}>
                <View style={styles.pbInfo}>
                  <Text style={[styles.pbGame, { color: textColor }]}>
                    {meta?.displayName ?? pb.gameId}
                  </Text>
                  <Text style={[styles.pbSub, { color: subtextColor }]}>
                    {pb.totalPlays} plays · {pb.totalWins} wins
                  </Text>
                </View>
                <Text style={[styles.pbScore, { color: theme.colors.primary }]}>
                  {pb.pbValue.toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Recent Achievements */}
      {achievements.length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Achievements ({achievements.length})
          </Text>
          {(showAllAchievements
            ? achievements
            : achievements.slice(0, LIST_CAP)
          ).map((a, idx) => (
            <View key={`${a.type}-${idx}`} style={styles.achievementRow}>
              <MaterialCommunityIcons name="trophy" size={20} color="#FFD700" />
              <View style={styles.achievementInfo}>
                <Text style={[styles.achievementName, { color: textColor }]}>
                  {a.name}
                </Text>
                <Text style={[styles.achievementDesc, { color: subtextColor }]}>
                  {a.description}
                </Text>
              </View>
            </View>
          ))}
          {achievements.length > LIST_CAP && (
            <TouchableOpacity
              style={styles.showMoreBtn}
              onPress={() => setShowAllAchievements(!showAllAchievements)}
            >
              <Text
                style={[styles.showMoreText, { color: theme.colors.primary }]}
              >
                {showAllAchievements
                  ? "Show Less"
                  : `Show All (${achievements.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Recent History */}
      {history.length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Recent Games
          </Text>
          {(showAllHistory ? history : history.slice(0, LIST_CAP)).map(
            (result, idx) => {
              const meta = GAME_METADATA[result.gameId as GameId];
              const opponents = result.scoreboard.filter((e) => e.uid !== uid);
              const opponentLabel =
                opponents.length === 0
                  ? null
                  : opponents.length === 1
                    ? opponents[0].displayName || "Opponent"
                    : `${opponents[0].displayName || "Player"} +${opponents.length - 1}`;
              const won = uid && result.winnerIds.includes(uid);
              const isDraw = result.resolutionType === "draw";
              return (
                <View
                  key={`${result.sessionId}-${idx}`}
                  style={styles.historyRow}
                >
                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyGame, { color: textColor }]}>
                      {meta?.displayName ?? result.gameId}
                      {opponentLabel ? ` vs. ${opponentLabel}` : ""}
                    </Text>
                    <Text style={[styles.historySub, { color: subtextColor }]}>
                      {result.resolutionType} ·{" "}
                      {Math.round(result.durationMs / 1000)}s
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.historyResult,
                      {
                        color: isDraw ? "#FF9500" : won ? "#34C759" : "#FF3B30",
                      },
                    ]}
                  >
                    {isDraw ? "Draw" : won ? "Win" : "Loss"}
                  </Text>
                </View>
              );
            },
          )}
          {history.length > LIST_CAP && (
            <TouchableOpacity
              style={styles.showMoreBtn}
              onPress={() => setShowAllHistory(!showAllHistory)}
            >
              <Text
                style={[styles.showMoreText, { color: theme.colors.primary }]}
              >
                {showAllHistory ? "Show Less" : `View More (${history.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Empty state */}
      {pbs.length === 0 &&
        achievements.length === 0 &&
        history.length === 0 &&
        !loading && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="gamepad-variant-outline"
              size={48}
              color={subtextColor}
            />
            <Text style={[styles.emptyText, { color: subtextColor }]}>
              No game stats yet. Play some games!
            </Text>
          </View>
        )}
    </ScrollView>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  errorText: {
    paddingHorizontal: 24,
    marginBottom: 8,
    fontSize: 13,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statBox: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  pbRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  pbInfo: {
    flex: 1,
  },
  pbGame: {
    fontSize: 14,
    fontWeight: "600",
  },
  pbSub: {
    fontSize: 12,
    marginTop: 2,
  },
  pbScore: {
    fontSize: 18,
    fontWeight: "700",
  },
  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 14,
    fontWeight: "600",
  },
  achievementDesc: {
    fontSize: 12,
    marginTop: 1,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  historyInfo: {
    flex: 1,
  },
  historyGame: {
    fontSize: 14,
    fontWeight: "500",
  },
  historySub: {
    fontSize: 12,
    marginTop: 1,
  },
  historyResult: {
    fontSize: 14,
    fontWeight: "700",
  },
  showMoreBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
