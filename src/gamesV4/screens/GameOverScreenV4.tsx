/**
 * Games V4 — Universal Game Over Screen
 *
 * Shows the result of a completed game session:
 * - Winner / draw announcement (hero section)
 * - Final scoreboard with per-game descriptor formatting
 * - XP awarded (with level-up callout)
 * - Achievement unlocks
 * - Action buttons:
 *   - "Return to Chat" (when conversationId exists)
 *   - "Back to Games" (always)
 *   - "Rematch" (chat = new invite, solo = new session)
 *   - Leaderboard / My Stats
 * - Resilient: loading state + safe exit if results delayed
 *
 * @module gamesV4/screens/GameOverScreenV4
 */

import UserAvatar from "@/gamesV4/components/UserAvatar";
import {
  GAME_METADATA,
  SCOREBOARD_DESCRIPTORS,
  isPersistentSoloGame,
} from "@/gamesV4/constants";
import { ACHIEVEMENT_BY_TYPE } from "@/gamesV4/data/achievementDefinitions";
import {
  createGameInvite,
  createSoloSession,
  subscribeToResult,
  subscribeToSession,
} from "@/gamesV4/services/gameServiceV4";
import type { GameResultV4, GameSessionV4 } from "@/gamesV4/types";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CommonActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<MainStackParamList>;

// =============================================================================
// Component
// =============================================================================

export default function GameOverScreenV4() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const { refreshProfile } = useUser();
  const navigation = useNavigation<Nav>();
  const route = useRoute<{
    key: string;
    name: "GameOverV4";
    params: { sessionId: string };
  }>();

  const { sessionId } = route.params;
  const uid = currentFirebaseUser?.uid;

  const [result, setResult] = useState<GameResultV4 | null>(null);
  const [session, setSession] = useState<GameSessionV4 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rematchLoading, setRematchLoading] = useState(false);

  // Subscribe to result doc
  useEffect(() => {
    const unsub = subscribeToResult(
      sessionId,
      (r) => {
        setResult(r);
        setLoading(false);
        // Refresh user profile so XP bars everywhere pick up the new level/XP
        if (r) {
          refreshProfile().catch(() => {});
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [sessionId, refreshProfile]);

  // Subscribe to session for conversation context (Return to Chat / Rematch)
  useEffect(() => {
    const unsub = subscribeToSession(
      sessionId,
      (s) => setSession(s),
      () => {},
    );
    return unsub;
  }, [sessionId]);

  // Fallback: stop loading after 10s if results haven't arrived
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setLoading(false);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [loading]);

  const colors = theme.colors;
  const gameId = result?.gameId ?? session?.gameId;
  const displayMeta = gameId ? GAME_METADATA[gameId] : null;

  // Conversation context
  const conversationId =
    result?.conversationId || session?.conversationId || "";
  const conversationScope = session?.conversationScope ?? "dm";
  const isChatGame = !!conversationId;
  const isSolo = session?.runtimeType === "solo";
  const isPersistent = gameId ? isPersistentSoloGame(gameId) : false;

  // Winner text — persistent solo "win" resolution means the run was archived
  const winnerText = (() => {
    if (!result) return "";
    if (result.resolutionType === "resign") {
      if (isSolo) return "Game Over";
      return result.winnerIds.includes(uid ?? "")
        ? "Opponent Resigned"
        : "You Resigned";
    }
    if (isPersistent && result.resolutionType === "win") return "Run Archived";
    if (result.winnerIds.length === 0) return "It's a Draw!";
    if (result.winnerIds.includes(uid ?? "")) return "You Won! 🏆";
    if (isSolo) return "Game Over";
    return "You Lost";
  })();

  const winnerColor = (() => {
    if (!result) return theme.isDark ? "#FFF" : "#000";
    // Persistent solo archive → neutral color (not red)
    if (isPersistent && result.resolutionType === "win")
      return theme.isDark ? "#FFF" : "#333";
    if (result.winnerIds.includes(uid ?? "")) return "#34C759";
    if (result.winnerIds.length === 0) return "#FF9500";
    return "#FF3B30";
  })();

  const medalColors: Record<number, string> = {
    0: "#FFD700",
    1: "#C0C0C0",
    2: "#CD7F32",
  };

  // Scoreboard descriptor for formatting
  const descriptor = gameId ? SCOREBOARD_DESCRIPTORS[gameId] : undefined;
  const formatScore = (score: number) => {
    if (descriptor?.formatScore) return descriptor.formatScore(score);
    return String(score);
  };

  // ── Navigation Actions ──────────────────────────────────────────────

  const handleReturnToChat = useCallback(() => {
    if (!conversationId) return;
    if (conversationScope === "group") {
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "MainTabs", params: { screen: "Inbox" } },
            { name: "GroupChat", params: { groupId: conversationId } },
          ],
        }),
      );
    } else {
      const parts = conversationId.split("_");
      const friendUid = parts.find((p) => p !== uid) ?? parts[0];
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "MainTabs", params: { screen: "Inbox" } },
            { name: "ChatDetail", params: { friendUid } },
          ],
        }),
      );
    }
  }, [conversationId, conversationScope, uid, navigation]);

  const handleBackToGames = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "MainTabs", params: { screen: "Games" } }],
      }),
    );
  }, [navigation]);

  const handleRematch = useCallback(async () => {
    if (!gameId) return;
    setRematchLoading(true);
    try {
      if (isSolo) {
        const res = await createSoloSession({ gameId });
        if (res?.sessionId) {
          navigation.replace("GamePlayV4", {
            sessionId: res.sessionId,
            gameId,
          });
        }
      } else if (isChatGame) {
        await createGameInvite({
          conversationId,
          conversationScope,
          gameId,
        });
        handleReturnToChat();
      }
    } catch (err) {
      Alert.alert(
        "Rematch Failed",
        err instanceof Error ? err.message : "Could not start rematch.",
      );
    } finally {
      setRematchLoading(false);
    }
  }, [
    gameId,
    isSolo,
    isChatGame,
    conversationId,
    conversationScope,
    navigation,
    handleReturnToChat,
  ]);

  const handleSafeExit = useCallback(() => {
    if (isChatGame) {
      handleReturnToChat();
    } else {
      handleBackToGames();
    }
  }, [isChatGame, handleReturnToChat, handleBackToGames]);

  // XP info for current user
  const myXP = result?.xpAwards?.find((xp) => xp.uid === uid);
  const myAchievements =
    result?.achievementUnlocks?.filter((a) => a.uid === uid) ?? [];

  // Intercept Android hardware back → route through safe exit
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleSafeExit();
      return true;
    });
    return () => handler.remove();
  }, [handleSafeExit]);

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.isDark ? "#000" : colors.background },
        ]}
      >
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={[
              styles.loadingText,
              { color: theme.isDark ? "#AAA" : "#666" },
            ]}
          >
            Loading results...
          </Text>
          <TouchableOpacity
            onPress={handleSafeExit}
            style={styles.safeExitButton}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              Exit Game
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!result) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.isDark ? "#000" : colors.background },
        ]}
      >
        <View style={styles.centerContent}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color="#FF9500"
          />
          <Text
            style={[
              styles.errorMainText,
              { color: theme.isDark ? "#FFF" : "#000" },
            ]}
          >
            Results not available yet
          </Text>
          <Text
            style={[
              styles.errorSubText,
              { color: theme.isDark ? "#AAA" : "#666" },
            ]}
          >
            {error ?? "The game has ended but results haven't loaded."}
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleSafeExit}
          >
            <Text style={styles.primaryButtonText}>
              {isChatGame ? "Return to Chat" : "Back to Games"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? "#000" : colors.background },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleSafeExit} style={styles.backButton}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.isDark ? "#FFF" : "#000"}
            />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: theme.isDark ? "#FFF" : "#000" },
            ]}
          >
            Game Over
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <MaterialCommunityIcons
            name={
              (displayMeta?.icon ??
                "gamepad-variant") as keyof typeof MaterialCommunityIcons.glyphMap
            }
            size={56}
            color={colors.primary}
          />
          <Text
            style={[styles.gameName, { color: theme.isDark ? "#FFF" : "#000" }]}
          >
            {displayMeta?.displayName ?? result.gameId}
          </Text>
          <Text style={[styles.winnerText, { color: winnerColor }]}>
            {winnerText}
          </Text>
        </View>

        {/* Scoreboard */}
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.isDark ? "#AAA" : "#666" },
          ]}
        >
          {descriptor?.title ?? "SCOREBOARD"}
        </Text>
        <View style={styles.scoreList}>
          {result.scoreboard.map((item, index) => {
            const isMe = item.uid === uid;
            const isWinner = result.winnerIds.includes(item.uid);
            return (
              <View
                key={item.uid}
                style={[
                  styles.scoreRow,
                  {
                    backgroundColor: isMe
                      ? colors.primary + "10"
                      : theme.isDark
                        ? "#1C1C1E"
                        : "#FFF",
                    borderBottomColor: theme.isDark ? "#333" : "#E0E0E0",
                  },
                ]}
              >
                <View
                  style={[
                    styles.rankCircle,
                    {
                      backgroundColor:
                        medalColors[index] ?? (theme.isDark ? "#333" : "#DDD"),
                    },
                  ]}
                >
                  <Text style={styles.rankText}>
                    {item.placement ?? index + 1}
                  </Text>
                </View>
                <View style={styles.playerInfo}>
                  <UserAvatar
                    profilePictureUrl={item.profilePictureUrl}
                    displayName={item.displayName}
                    uid={item.uid}
                    size={28}
                  />
                  <Text
                    style={[
                      styles.playerName,
                      {
                        color: theme.isDark ? "#FFF" : "#000",
                        fontWeight: isMe ? "700" : "500",
                      },
                    ]}
                  >
                    {isMe ? "You" : item.displayName || `Player ${index + 1}`}
                    {isWinner ? " 🏆" : ""}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.scoreText,
                    { color: theme.isDark ? "#FFF" : "#000" },
                  ]}
                >
                  {formatScore(item.score)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Per-Player Stats (game-specific) */}
        {(() => {
          const myEntry = result.scoreboard.find((e) => e.uid === uid);
          const stats = myEntry?.stats;
          if (!stats || Object.keys(stats).length === 0) return null;

          const STAT_LABELS: Record<string, { label: string; icon: string }> = {
            levelsCleared: { label: "Levels", icon: "stairs" },
            bricksDestroyed: { label: "Bricks", icon: "cube-outline" },
            maxCombo: { label: "Best Combo", icon: "fire" },
            durationMs: { label: "Time", icon: "clock-outline" },
            powerupsUsed: { label: "Power-ups", icon: "lightning-bolt" },
            moveCount: { label: "Moves", icon: "swap-horizontal" },
            mergeCount: { label: "Merges", icon: "merge" },
            bestTile: { label: "Best Tile", icon: "numeric" },
          };

          const formatStatValue = (key: string, value: unknown): string => {
            if (key === "durationMs" && typeof value === "number") {
              const secs = Math.round(value / 1000);
              const m = Math.floor(secs / 60);
              const s = secs % 60;
              return m > 0 ? `${m}m ${s}s` : `${s}s`;
            }
            if (key === "maxCombo" && typeof value === "number") {
              return `x${value}`;
            }
            if (typeof value === "number") return value.toLocaleString();
            return String(value ?? "");
          };

          const entries = Object.entries(stats).filter(
            ([, v]) => v !== undefined && v !== null && v !== 0,
          );
          if (entries.length === 0) return null;

          return (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.isDark ? "#AAA" : "#666" },
                ]}
              >
                GAME STATS
              </Text>
              <View
                style={[
                  styles.statsGrid,
                  { backgroundColor: theme.isDark ? "#1C1C1E" : "#F2F2F7" },
                ]}
              >
                {entries.map(([key, value]) => {
                  const meta = STAT_LABELS[key] ?? {
                    label: key.replace(/([A-Z])/g, " $1").trim(),
                    icon: "information-outline",
                  };
                  return (
                    <View key={key} style={styles.statCell}>
                      <MaterialCommunityIcons
                        name={
                          meta.icon as keyof typeof MaterialCommunityIcons.glyphMap
                        }
                        size={18}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.statValue,
                          { color: theme.isDark ? "#FFF" : "#000" },
                        ]}
                      >
                        {formatStatValue(key, value)}
                      </Text>
                      <Text
                        style={[
                          styles.statLabel,
                          { color: theme.isDark ? "#AAA" : "#666" },
                        ]}
                      >
                        {meta.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          );
        })()}

        {/* XP + Rewards */}
        {myXP && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.isDark ? "#AAA" : "#666" },
              ]}
            >
              REWARDS
            </Text>
            <View
              style={[
                styles.rewardCard,
                { backgroundColor: theme.isDark ? "#1C1C1E" : "#F2F2F7" },
              ]}
            >
              <View style={styles.rewardRow}>
                <MaterialCommunityIcons name="star" size={20} color="#FFD700" />
                <Text
                  style={[
                    styles.rewardText,
                    { color: theme.isDark ? "#FFF" : "#000" },
                  ]}
                >
                  +{myXP.totalXP} XP
                </Text>
                <Text
                  style={[
                    styles.rewardReason,
                    { color: theme.isDark ? "#AAA" : "#666" },
                  ]}
                >
                  {myXP.bonusReason ?? "Game completion"}
                </Text>
              </View>
              {myXP.levelUp && (
                <>
                  <View style={styles.levelUpRow}>
                    <MaterialCommunityIcons
                      name="arrow-up-bold-circle"
                      size={20}
                      color="#34C759"
                    />
                    <Text
                      style={[
                        styles.rewardText,
                        { color: "#34C759", fontWeight: "800" },
                      ]}
                    >
                      Level Up! Lv {myXP.levelUp.oldLevel} → Lv{" "}
                      {myXP.levelUp.newLevel}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{
                      marginTop: 8,
                      backgroundColor: "#34C759",
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 16,
                      alignSelf: "flex-start",
                      marginLeft: 26,
                    }}
                    onPress={() => navigation.navigate("LevelRewards")}
                  >
                    <Text
                      style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}
                    >
                      🎁 Claim Reward
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}

        {/* Achievement Unlocks */}
        {myAchievements.length > 0 && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.isDark ? "#AAA" : "#666" },
              ]}
            >
              ACHIEVEMENTS UNLOCKED
            </Text>
            <View
              style={[
                styles.rewardCard,
                { backgroundColor: theme.isDark ? "#1C1C1E" : "#F2F2F7" },
              ]}
            >
              {myAchievements.map((a, i) => {
                const def = ACHIEVEMENT_BY_TYPE[a.achievementType];
                return (
                  <View key={`ach-${i}`} style={styles.rewardRow}>
                    <MaterialCommunityIcons
                      name="trophy"
                      size={20}
                      color="#FF9500"
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.rewardText,
                          { color: theme.isDark ? "#FFF" : "#000" },
                        ]}
                      >
                        {def?.name ?? a.achievementType}
                      </Text>
                      {def?.tokenReward ? (
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#FF9500",
                            fontWeight: "600",
                            marginTop: 2,
                          }}
                        >
                          +{def.tokenReward} tokens (claim to collect)
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                style={{
                  marginTop: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  backgroundColor: "#FF9500",
                  borderRadius: 8,
                  alignSelf: "center",
                }}
                onPress={() => navigation.navigate("AchievementsHub")}
              >
                <Text
                  style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}
                >
                  🏆 Claim Achievements
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {isChatGame ? (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleReturnToChat}
            >
              <MaterialCommunityIcons
                name="message-text-outline"
                size={18}
                color="#FFF"
              />
              <Text style={styles.primaryButtonText}>Return to Chat</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleBackToGames}
            >
              <MaterialCommunityIcons
                name="gamepad-variant-outline"
                size={18}
                color="#FFF"
              />
              <Text style={styles.primaryButtonText}>Back to Games</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.rematchButton,
              {
                backgroundColor: theme.isDark ? "#1C1C1E" : "#FFF",
                borderColor: colors.primary,
              },
            ]}
            onPress={handleRematch}
            disabled={rematchLoading}
          >
            {rematchLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="refresh"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: colors.primary },
                  ]}
                >
                  {isSolo
                    ? isPersistent
                      ? "Start New Run"
                      : "Play Again"
                    : "Rematch"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
              onPress={() =>
                navigation.navigate("GameLeaderboardV4", {
                  gameId: result.gameId,
                })
              }
            >
              <MaterialCommunityIcons
                name="trophy-outline"
                size={16}
                color={colors.primary}
              />
              <Text
                style={[styles.secondaryButtonText, { color: colors.primary }]}
              >
                Leaderboard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.primary }]}
              onPress={() => navigation.navigate("GameStatsV4")}
            >
              <MaterialCommunityIcons
                name="chart-bar"
                size={16}
                color={colors.primary}
              />
              <Text
                style={[styles.secondaryButtonText, { color: colors.primary }]}
              >
                My Stats
              </Text>
            </TouchableOpacity>
          </View>

          {isChatGame && (
            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={handleBackToGames}
            >
              <Text
                style={[
                  styles.tertiaryButtonText,
                  { color: theme.isDark ? "#AAA" : "#666" },
                ]}
              >
                Back to Games Hub
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  loadingText: { fontSize: 14, marginTop: 8 },
  safeExitButton: { marginTop: 24, padding: 12 },
  linkText: { fontSize: 14, fontWeight: "600" },
  errorMainText: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  errorSubText: { fontSize: 14, textAlign: "center", marginTop: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSpacer: { width: 32 },
  heroSection: { alignItems: "center", paddingVertical: 20, gap: 8 },
  gameName: { fontSize: 20, fontWeight: "700" },
  winnerText: { fontSize: 24, fontWeight: "800" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  scoreList: { flexGrow: 0, maxHeight: 300 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  playerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  playerName: { fontSize: 15 },
  scoreText: { fontSize: 17, fontWeight: "700" },
  rewardCard: { marginHorizontal: 16, borderRadius: 12, padding: 12, gap: 8 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  levelUpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#333",
    marginTop: 4,
  },
  rewardText: { fontSize: 15, fontWeight: "600" },
  rewardReason: { fontSize: 12 },
  actionsContainer: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  primaryButton: {
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  rematchButton: {
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryRow: { flexDirection: "row", gap: 12 },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: "600" },
  tertiaryButton: { paddingVertical: 8, alignItems: "center" },
  tertiaryButtonText: { fontSize: 13, fontWeight: "500" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statCell: {
    width: "31%" as unknown as number,
    alignItems: "center",
    paddingVertical: 8,
    gap: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
});
