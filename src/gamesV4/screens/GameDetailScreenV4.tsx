/**
 * Games V4 — Game Detail Screen ("Steam-like" game page)
 *
 * A unified detail page for each game, including:
 * 1. Overview — game info, description, how to play
 * 2. Play actions — solo play / challenge a friend
 * 3. Your progress — achievement completion %, quick stats
 * 4. Leaderboards — friends + global toggle
 * 5. Achievements — per-game achievements list with progress
 * 6. Game history — recent matches with opponents
 *
 * Route: GameDetailV4 { gameId: string }
 *
 * @module gamesV4/screens/GameDetailScreenV4
 */

import {
  ConversationPickerModal,
  type ConversationPickerResult,
} from "@/gamesV4/components/ConversationPickerModal";
import {
  GAME_DESCRIPTIONS,
  GAME_METADATA,
  IMPLEMENTED_GAME_IDS,
  LEADERBOARD_DESCRIPTORS,
  SCOREBOARD_DESCRIPTORS,
} from "@/gamesV4/constants";
import {
  DIFFICULTY_META,
  getDefsForGame,
  type AchievementDifficulty,
} from "@/gamesV4/data/achievementDefinitions";
import { useAchievementsV4 } from "@/gamesV4/hooks/useAchievementsV4";
import { useGamePBV4 } from "@/gamesV4/hooks/useGameStatsV4";
import { useLeaderboardV4 } from "@/gamesV4/hooks/useLeaderboardV4";
import {
  createGameInvite,
  fetchFriendsLeaderboard,
  fetchGameHistoryByGame,
  resumeOrCreateSoloSession,
  type LeaderboardEntryV4,
} from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types/common";
import type { GameResultV4 } from "@/gamesV4/types/result";
import { mapSoloLaunchError } from "@/gamesV4/utils/mapCallableError";
import { getCachedProfile } from "@/services/cache/profileCache";
import { getFriends } from "@/services/friends";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, "GameDetailV4">;

const LIST_CAP = 5;

// =============================================================================
// Component
// =============================================================================

export default function GameDetailScreenV4() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const uid = currentFirebaseUser?.uid ?? "";

  const gameId = route.params.gameId as GameId;
  const meta = GAME_METADATA[gameId];
  const desc = GAME_DESCRIPTIONS[gameId];
  const lbDescriptor = LEADERBOARD_DESCRIPTORS[gameId];
  const isImplemented = IMPLEMENTED_GAME_IDS.has(gameId);
  const isSolo = meta?.runtimeType === "solo";

  // ── State ──────────────────────────────────────────────────────────────
  const [lbTab, setLbTab] = useState<"global" | "friends">("global");
  const [friendsLb, setFriendsLb] = useState<LeaderboardEntryV4[]>([]);
  const [friendsLbLoading, setFriendsLbLoading] = useState(false);
  const [history, setHistory] = useState<GameResultV4[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showConversationPicker, setShowConversationPicker] = useState(false);
  const [inviting, setInviting] = useState(false);

  // ── Hooks ──────────────────────────────────────────────────────────────
  const { pb, loading: pbLoading } = useGamePBV4(gameId);
  const { entries: lbEntries, loading: lbLoading } = useLeaderboardV4(gameId);
  const { achievements: allAchievements } = useAchievementsV4();

  // Achievement progress for this game
  const gameDefs = useMemo(() => getDefsForGame(gameId), [gameId]);
  const earnedForGame = useMemo(() => {
    const typeSet = new Set(gameDefs.map((d) => d.type));
    return allAchievements.filter((a) => typeSet.has(a.type));
  }, [gameDefs, allAchievements]);
  const achievementPct =
    gameDefs.length > 0
      ? Math.round((earnedForGame.length / gameDefs.length) * 100)
      : 0;

  // Game history
  useEffect(() => {
    if (!uid) return;
    setHistoryLoading(true);
    fetchGameHistoryByGame(uid, gameId, 20)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [uid, gameId]);

  // Friends leaderboard — lazy load when tab selected
  useEffect(() => {
    if (lbTab !== "friends" || !uid) return;
    if (friendsLb.length > 0) return; // already loaded

    let cancelled = false;
    setFriendsLbLoading(true);

    (async () => {
      try {
        const friends = await getFriends(uid);
        const friendUids = friends
          .map((f) => f.users.find((u: string) => u !== uid))
          .filter((id): id is string => Boolean(id));

        const entries = await fetchFriendsLeaderboard(uid, friendUids, gameId);

        // Resolve display names via profile cache
        const resolved = await Promise.all(
          entries.map(async (e) => {
            const profile = await getCachedProfile(e.uid);
            return {
              ...e,
              displayName: profile.displayName || profile.username || "Player",
            };
          }),
        );

        if (!cancelled) setFriendsLb(resolved);
      } catch {
        // Silently fail — show empty state
      } finally {
        if (!cancelled) setFriendsLbLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lbTab, uid, gameId, friendsLb.length]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handlePlaySolo = useCallback(async () => {
    if (launching) return;
    setLaunching(true);
    try {
      const { sessionId } = await resumeOrCreateSoloSession({ gameId });
      navigation.navigate("GamePlayV4", { sessionId, gameId });
    } catch (err: unknown) {
      const msg = mapSoloLaunchError(err);
      Alert.alert("Error", msg);
    } finally {
      setLaunching(false);
    }
  }, [gameId, launching, navigation]);

  const handleInviteFriend = useCallback(() => {
    setShowConversationPicker(true);
  }, []);

  const handleConversationSelected = useCallback(
    async (result: ConversationPickerResult) => {
      setShowConversationPicker(false);
      if (inviting) return;
      setInviting(true);
      try {
        const { inviteId } = await createGameInvite({
          conversationId: result.conversationId,
          conversationScope: result.conversationScope,
          gameId,
        });
        // Navigate to the chat where the invite was sent
        if (result.conversationScope === "dm") {
          // For DM: extract friend UID from chat ID
          const parts = result.conversationId.split("_");
          const friendUid = parts.find((p: string) => p !== uid);
          if (friendUid) {
            navigation.navigate("ChatDetail", {
              friendUid,
              friendName: result.displayName,
            });
          } else {
            navigation.navigate("GameLobbyV4", { inviteId });
          }
        } else {
          navigation.navigate("GroupChat", {
            groupId: result.conversationId,
            groupName: result.displayName,
          });
        }
        Alert.alert(
          "Invite Sent!",
          `Game invite sent to ${result.displayName}.`,
        );
      } catch (err: unknown) {
        const errObj = err as { code?: string; message?: string };
        const msg =
          errObj?.code === "functions/not-found" ||
          errObj?.message === "not-found"
            ? "Game service is not available. Please make sure Cloud Functions are deployed."
            : (errObj?.message ?? "Failed to create game invite");
        Alert.alert("Invite Error", msg);
      } finally {
        setInviting(false);
      }
    },
    [gameId, uid, navigation, inviting],
  );

  // ── Colors ─────────────────────────────────────────────────────────────
  const bgColor = theme.isDark ? "#000" : theme.colors.background;
  const cardBg = theme.isDark ? "#1A1A1A" : "#FFF";
  const textColor = theme.isDark ? "#FFF" : "#222";
  const subtextColor = theme.isDark ? "#AAA" : "#666";
  const borderColor = theme.isDark ? "#333" : "#E0E0E0";
  const accentBg = theme.isDark ? "#2C2C2E" : "#F2F2F7";

  if (!meta) {
    return (
      <View style={[styles.center, { backgroundColor: bgColor }]}>
        <Text style={{ color: subtextColor }}>Game not found.</Text>
      </View>
    );
  }

  // ── Render helpers ─────────────────────────────────────────────────────
  const renderProgressBar = (pct: number, color: string) => (
    <View style={[styles.progressBarBg, { backgroundColor: accentBg }]}>
      <View
        style={[
          styles.progressBarFill,
          { width: `${Math.min(pct, 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
  );

  const formatOutcome = (result: GameResultV4) => {
    if (!uid) return "—";
    if (result.resolutionType === "draw") return "Draw";
    return result.winnerIds.includes(uid) ? "Win" : "Loss";
  };

  const outcomeColor = (result: GameResultV4) => {
    if (!uid) return subtextColor;
    if (result.resolutionType === "draw") return "#FF9500";
    return result.winnerIds.includes(uid) ? "#34C759" : "#FF3B30";
  };

  const formatDate = (ts: unknown): string => {
    if (!ts) return "";
    const d =
      ts instanceof Date
        ? ts
        : ((ts as { toDate?: () => Date })?.toDate?.() ?? new Date());
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const visibleAchievements = showAllAchievements
    ? gameDefs
    : gameDefs.slice(0, LIST_CAP);
  const visibleHistory = showAllHistory ? history : history.slice(0, LIST_CAP);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.headerBackground ?? bgColor,
            borderBottomColor: borderColor,
          },
        ]}
      >
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
        <Text style={[styles.headerTitle, { color: textColor }]}>
          {meta.displayName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 1. Overview ───────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.overviewHeader}>
            <View style={[styles.gameIconLarge, { backgroundColor: accentBg }]}>
              <MaterialCommunityIcons
                name={meta.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={40}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.overviewInfo}>
              <Text style={[styles.gameTitleLarge, { color: textColor }]}>
                {meta.displayName}
              </Text>
              <Text style={[styles.gameSubtitle, { color: subtextColor }]}>
                {meta.runtimeType === "solo"
                  ? "Solo"
                  : meta.runtimeType === "turnBased"
                    ? `Turn-Based · ${meta.minPlayers}–${meta.maxPlayers} players`
                    : `Realtime · ${meta.minPlayers}–${meta.maxPlayers} players`}
              </Text>
            </View>
          </View>

          {desc && (
            <>
              <Text style={[styles.descText, { color: textColor }]}>
                {desc.shortDescription}
              </Text>

              <View style={styles.howToPlaySection}>
                <Text
                  style={[styles.sectionLabel, { color: theme.colors.primary }]}
                >
                  How to Play
                </Text>
                <Text style={[styles.howToPlayText, { color: subtextColor }]}>
                  {desc.howToPlay}
                </Text>
              </View>

              {desc.tips && (
                <View
                  style={[
                    styles.tipsBox,
                    { backgroundColor: theme.colors.primary + "10" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="lightbulb-on-outline"
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[styles.tipsText, { color: theme.colors.primary }]}
                  >
                    {desc.tips}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ─── 2. Play Actions ───────────────────────────────────── */}
        {isImplemented && (
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {isSolo ? (
              <TouchableOpacity
                style={[
                  styles.playButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={handlePlaySolo}
                disabled={launching}
                activeOpacity={0.7}
              >
                {launching ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="play"
                      size={20}
                      color="#FFF"
                    />
                    <Text style={styles.playButtonText}>Play Now</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.actionRow}>
                {/* Invite a Friend CTA */}
                <TouchableOpacity
                  style={[
                    styles.playButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={handleInviteFriend}
                  disabled={inviting}
                  activeOpacity={0.7}
                >
                  {inviting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="account-plus"
                        size={20}
                        color="#FFF"
                      />
                      <Text style={styles.playButtonText}>Invite a Friend</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={[styles.inviteHintText, { color: subtextColor }]}>
                  Choose a chat to send this game invite.
                </Text>

                {/* Alternate info */}
                <View
                  style={[styles.actionInfoBox, { backgroundColor: accentBg }]}
                >
                  <MaterialCommunityIcons
                    name="chat-outline"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.actionInfoText, { color: textColor }]}>
                    You can also challenge a friend from any chat using the
                    gamepad icon
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Conversation Picker Modal */}
        <ConversationPickerModal
          visible={showConversationPicker}
          onSelect={handleConversationSelected}
          onClose={() => setShowConversationPicker(false)}
        />

        {/* ─── 3. Your Progress ──────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Your Progress
          </Text>

          {/* Achievement completion bar */}
          {gameDefs.length > 0 && (
            <View style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color: subtextColor }]}>
                Achievements
              </Text>
              <View style={styles.progressBarContainer}>
                {renderProgressBar(achievementPct, theme.colors.primary)}
              </View>
              <Text
                style={[styles.progressPct, { color: theme.colors.primary }]}
              >
                {earnedForGame.length}/{gameDefs.length}
              </Text>
            </View>
          )}

          {/* Quick stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: accentBg }]}>
              <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                {pb?.totalPlays ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: subtextColor }]}>
                Plays
              </Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: accentBg }]}>
              <Text style={[styles.statValue, { color: "#34C759" }]}>
                {pb?.totalWins ?? 0}
              </Text>
              <Text style={[styles.statLabel, { color: subtextColor }]}>
                Wins
              </Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: accentBg }]}>
              <Text style={[styles.statValue, { color: "#FF9500" }]}>
                {pb?.pbValue != null
                  ? (SCOREBOARD_DESCRIPTORS[gameId]?.formatScore?.(
                      pb.pbValue,
                    ) ?? pb.pbValue.toLocaleString())
                  : "—"}
              </Text>
              <Text style={[styles.statLabel, { color: subtextColor }]}>
                {lbDescriptor?.label ?? "Best"}
              </Text>
            </View>
          </View>

          {/* Empty state for new users */}
          {!pbLoading && !pb && (
            <Text style={[styles.emptyHint, { color: subtextColor }]}>
              Play your first match to start tracking progress!
            </Text>
          )}
        </View>

        {/* ─── 4. Leaderboards ───────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Leaderboard
          </Text>

          {/* Tab toggle */}
          <View style={[styles.tabRow, { backgroundColor: accentBg }]}>
            {(["global", "friends"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabButton,
                  lbTab === tab && {
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                onPress={() => setLbTab(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: lbTab === tab ? "#FFF" : subtextColor },
                  ]}
                >
                  {tab === "global" ? "Global" : "Friends"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Leaderboard entries */}
          {(lbTab === "global" ? lbLoading : friendsLbLoading) ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={{ marginVertical: 16 }}
            />
          ) : (
            (() => {
              const entries = lbTab === "global" ? lbEntries : friendsLb;
              return entries.length > 0 ? (
                <View style={styles.lbList}>
                  {entries.slice(0, 10).map((entry, idx) => {
                    const isMe = entry.uid === uid;
                    const medal =
                      idx === 0
                        ? "🥇"
                        : idx === 1
                          ? "🥈"
                          : idx === 2
                            ? "🥉"
                            : null;
                    return (
                      <View
                        key={entry.uid}
                        style={[
                          styles.lbRow,
                          isMe && {
                            backgroundColor: theme.colors.primary + "10",
                            borderRadius: 8,
                          },
                        ]}
                      >
                        <Text style={[styles.lbRank, { color: subtextColor }]}>
                          {medal ?? `#${idx + 1}`}
                        </Text>
                        <Text
                          style={[
                            styles.lbName,
                            { color: textColor },
                            isMe && { fontWeight: "700" },
                          ]}
                          numberOfLines={1}
                        >
                          {entry.displayName || "Player"}
                          {isMe ? " (You)" : ""}
                        </Text>
                        <Text
                          style={[
                            styles.lbScore,
                            { color: theme.colors.primary },
                          ]}
                        >
                          {lbDescriptor?.formatValue
                            ? lbDescriptor.formatValue(entry.score)
                            : entry.score.toLocaleString()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.emptyHint, { color: subtextColor }]}>
                  {lbTab === "friends"
                    ? "No friends on the board yet.\nChallenge friends in chat to get started!"
                    : "No leaderboard entries yet this week.\nPlay a game to get on the board!"}
                </Text>
              );
            })()
          )}
        </View>

        {/* ─── 5. Achievements ───────────────────────────────────── */}
        {gameDefs.length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Achievements
              </Text>
              <Text style={[styles.sectionCount, { color: subtextColor }]}>
                {earnedForGame.length} / {gameDefs.length}
              </Text>
            </View>

            {visibleAchievements.map((def) => {
              const earned = earnedForGame.some((a) => a.type === def.type);
              const diffMeta =
                DIFFICULTY_META[def.difficulty as AchievementDifficulty];
              return (
                <View
                  key={def.type}
                  style={[
                    styles.achieveRow,
                    !earned && styles.achieveRowLocked,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={earned ? "check-circle" : "lock-outline"}
                    size={20}
                    color={earned ? "#34C759" : subtextColor}
                  />
                  <View style={styles.achieveInfo}>
                    <Text
                      style={[
                        styles.achieveName,
                        { color: earned ? textColor : subtextColor },
                      ]}
                    >
                      {def.name}
                    </Text>
                    <Text
                      style={[styles.achieveDesc, { color: subtextColor }]}
                      numberOfLines={1}
                    >
                      {def.description}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.diffBadge,
                      { backgroundColor: diffMeta.color + "20" },
                    ]}
                  >
                    <Text
                      style={[styles.diffBadgeText, { color: diffMeta.color }]}
                    >
                      {diffMeta.label}
                    </Text>
                  </View>
                </View>
              );
            })}

            {gameDefs.length > LIST_CAP && (
              <TouchableOpacity
                style={styles.showMoreBtn}
                onPress={() => setShowAllAchievements(!showAllAchievements)}
              >
                <Text
                  style={[styles.showMoreText, { color: theme.colors.primary }]}
                >
                  {showAllAchievements
                    ? "Show Less"
                    : `Show All (${gameDefs.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─── 6. Game History ───────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Game History
          </Text>

          {historyLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.primary}
              style={{ marginVertical: 16 }}
            />
          ) : visibleHistory.length > 0 ? (
            <>
              {visibleHistory.map((result, idx) => {
                // Find opponents
                const opponents = result.scoreboard.filter(
                  (e) => e.uid !== uid,
                );
                const opponentLabel =
                  opponents.length === 0
                    ? "Solo"
                    : opponents.length === 1
                      ? opponents[0].displayName || "Opponent"
                      : `${opponents[0].displayName || "Player"} +${opponents.length - 1}`;

                return (
                  <View
                    key={`${result.sessionId}-${idx}`}
                    style={[
                      styles.historyRow,
                      { borderBottomColor: borderColor },
                    ]}
                  >
                    <View style={styles.historyLeft}>
                      <Text
                        style={[styles.historyOpponent, { color: textColor }]}
                        numberOfLines={1}
                      >
                        vs. {opponentLabel}
                      </Text>
                      <Text
                        style={[styles.historyDate, { color: subtextColor }]}
                      >
                        {formatDate(result.createdAt)} ·{" "}
                        {(() => {
                          const secs = Math.round(result.durationMs / 1000);
                          const m = Math.floor(secs / 60);
                          const s = secs % 60;
                          return m > 0 ? `${m}m ${s}s` : `${s}s`;
                        })()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.historyOutcome,
                        { color: outcomeColor(result) },
                      ]}
                    >
                      {formatOutcome(result)}
                    </Text>
                  </View>
                );
              })}

              {history.length > LIST_CAP && (
                <TouchableOpacity
                  style={styles.showMoreBtn}
                  onPress={() => setShowAllHistory(!showAllHistory)}
                >
                  <Text
                    style={[
                      styles.showMoreText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    {showAllHistory
                      ? "Show Less"
                      : `View More (${history.length})`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={[styles.emptyHint, { color: subtextColor }]}>
              No games played yet. Play your first match!
            </Text>
          )}
        </View>

        {/* ─── Recent Activity (micro-section) ───────────────────── */}
        {!isSolo && history.length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Invite Friends
            </Text>
            <View style={[styles.actionInfoBox, { backgroundColor: accentBg }]}>
              <MaterialCommunityIcons
                name="account-group-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={[styles.actionInfoText, { color: textColor }]}>
                Send a challenge from any chat to play with friends!
              </Text>
            </View>
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: 8, marginRight: 4 },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },

  // Cards
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionCount: { fontSize: 13, fontWeight: "600" },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // Overview
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 14,
  },
  gameIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  overviewInfo: { flex: 1 },
  gameTitleLarge: { fontSize: 22, fontWeight: "800" },
  gameSubtitle: { fontSize: 13, marginTop: 2 },
  descText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  howToPlaySection: { marginBottom: 10 },
  howToPlayText: { fontSize: 13, lineHeight: 19 },
  tipsBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  tipsText: { fontSize: 13, flex: 1, lineHeight: 18 },

  // Play actions
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  playButtonText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  actionRow: { gap: 10 },
  actionInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  actionInfoText: { fontSize: 13, flex: 1, lineHeight: 18 },
  inviteHintText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: -2,
    marginBottom: 8,
  },

  // Progress
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  progressLabel: { fontSize: 13, fontWeight: "500", width: 90 },
  progressBarContainer: { flex: 1 },
  progressBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: 8, borderRadius: 4 },
  progressPct: {
    fontSize: 13,
    fontWeight: "700",
    width: 40,
    textAlign: "right",
  },
  statsGrid: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 10,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  emptyHint: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
    lineHeight: 18,
  },

  // Leaderboard
  tabRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  lbList: { gap: 0 },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  lbRank: { width: 36, fontSize: 14, fontWeight: "600" },
  lbName: { flex: 1, fontSize: 14 },
  lbScore: { fontSize: 14, fontWeight: "700" },

  // Achievements
  achieveRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  achieveRowLocked: { opacity: 0.6 },
  achieveInfo: { flex: 1 },
  achieveName: { fontSize: 14, fontWeight: "600" },
  achieveDesc: { fontSize: 12, marginTop: 1 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffBadgeText: { fontSize: 11, fontWeight: "600" },

  // History
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyLeft: { flex: 1 },
  historyOpponent: { fontSize: 14, fontWeight: "500" },
  historyDate: { fontSize: 12, marginTop: 2 },
  historyOutcome: { fontSize: 14, fontWeight: "700" },

  // Show more
  showMoreBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  showMoreText: { fontSize: 13, fontWeight: "600" },
});
