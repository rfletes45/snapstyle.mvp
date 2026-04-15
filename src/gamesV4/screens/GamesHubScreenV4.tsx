/**
 * Games V4 — Games Hub Screen
 *
 * Primary entry point for the V4 game system, accessible via the bottom tab bar.
 * Displays:
 * - Active invites (games you can join or resume)
 * - Game catalog grouped by category (Solo, Turn-Based, Realtime)
 * - Quick-access to My Stats and Leaderboards
 *
 * Tapping a game in the catalog opens the GamePickerModal-style selection
 * which guides the user to pick a conversation for multiplayer, or starts
 * a solo game invite directly.
 *
 * Route: Games tab (AppTabs)
 *
 * @module gamesV4/screens/GamesHubScreenV4
 */

import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { MAX_REWARD_LEVEL } from "@/data/levelRewards";
import {
  GAME_METADATA,
  HIDDEN_GAME_IDS,
  IMPLEMENTED_GAME_IDS,
  isPersistentSoloGame,
  type GameMetadata,
} from "@/gamesV4/constants";
import type { LevelRewardDocV4 } from "@/gamesV4/services/gameServiceV4";
import {
  archiveSoloSession,
  resumeOrCreateSoloSession,
  subscribeToAchievementSections,
  subscribeToActiveSoloSessions,
  subscribeToLevelRewards,
  subscribeToMyActiveInvites,
} from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types/common";
import type { GameInviteV4 } from "@/gamesV4/types/invite";
import { mapSoloLaunchError } from "@/gamesV4/utils/mapCallableError";
import { useProfileData } from "@/hooks/useProfileData";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ProgressBar, Searchbar } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface GameSection {
  title: string;
  emoji: string;
  data: GameMetadata[];
}

type FilterKey = "all" | "solo" | "turnBased" | "realtime";

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "solo", label: "Solo" },
  { key: "turnBased", label: "Turn-Based" },
  { key: "realtime", label: "Realtime" },
];

// =============================================================================
// Component
// =============================================================================

export default function GamesHubScreenV4() {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<Nav>();
  const uid = currentFirebaseUser?.uid;

  // ── State ──────────────────────────────────────────────────────────────
  const [invites, setInvites] = useState<GameInviteV4[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [launchingSolo, setLaunchingSolo] = useState<GameId | null>(null);
  const [rewardDocs, setRewardDocs] = useState<LevelRewardDocV4[]>([]);
  /** Map of gameId → sessionId for solo games with an active/suspended session. */
  const [activeSoloSessions, setActiveSoloSessions] = useState<
    Record<string, string>
  >({});
  /** Set of gameIds whose achievement section badge has been claimed (mastered). */
  const [masteredGameIds, setMasteredGameIds] = useState<Set<string>>(
    new Set(),
  );
  /** Tracks which game sections are collapsed. */
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const scrollViewRef = useRef<ScrollView>(null);
  /** Y offset of the sticky section inside the ScrollView (child 0 height). */
  const [child0Height, setChild0Height] = useState(0);
  const hasAutoScrolledRef = useRef(false);

  // ── Level/XP data ──────────────────────────────────────────────────────
  const { levelInfo: profileLevel } = useProfileData(uid);
  const currentLevel = profileLevel?.current ?? 1;
  const isMaxLevel = currentLevel >= MAX_REWARD_LEVEL;
  const xpCurrent = profileLevel?.xp ?? 0;
  const xpNeeded = profileLevel?.xpToNextLevel ?? 100;
  const xpProgress = isMaxLevel
    ? 1
    : xpNeeded > 0
      ? Math.min(1, xpCurrent / xpNeeded)
      : 0;
  const unclaimedRewards = useMemo(
    () => rewardDocs.filter((r) => r.claimedAt === null).length,
    [rewardDocs],
  );

  // ── Subscribe to level rewards ──────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToLevelRewards(uid, setRewardDocs, (err) => {
      // Silently handle permission errors — rules may not be deployed yet
      console.warn("[GamesHub] LevelRewards subscription error:", err.message);
    });
    return unsub;
  }, [uid]);

  // ── Subscribe to active invites ────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    setInvitesLoading(true);
    const unsub = subscribeToMyActiveInvites(
      uid,
      (data) => {
        setInvites(data);
        setInvitesLoading(false);
        setRefreshing(false);
      },
      () => {
        setInvitesLoading(false);
        setRefreshing(false);
      },
    );
    return unsub;
  }, [uid]);

  // ── Subscribe to active solo sessions (for resume affordances) ──────────
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToActiveSoloSessions(
      uid,
      (sessions) => setActiveSoloSessions(sessions),
      (err) => {
        console.warn(
          "[GamesHub] Active solo sessions subscription error:",
          err.message,
        );
      },
    );
    return unsub;
  }, [uid]);

  // ── Subscribe to achievement section badges (mastery detection) ────────
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToAchievementSections(
      uid,
      (sections) => {
        const claimed = new Set<string>();
        for (const s of sections) {
          if (s.claimed) claimed.add(s.sectionId);
        }
        setMasteredGameIds(claimed);
      },
      (err) => {
        console.warn(
          "[GamesHub] AchievementSections subscription error:",
          err.message,
        );
      },
    );
    return unsub;
  }, [uid]);

  // ── Game sections ──────────────────────────────────────────────────────
  const sections = useMemo<GameSection[]>(() => {
    const all = Object.values(GAME_METADATA).filter(
      (g) => !HIDDEN_GAME_IDS.has(g.gameId),
    );
    const solo = all.filter((g) => g.runtimeType === "solo");
    const turnBased = all.filter((g) => g.runtimeType === "turnBased");
    const realtime = all.filter((g) => g.runtimeType === "realtime");

    const result: GameSection[] = [];
    if (solo.length > 0)
      result.push({ title: "Solo", emoji: "🎯", data: solo });
    if (turnBased.length > 0)
      result.push({ title: "Turn-Based", emoji: "♟️", data: turnBased });
    if (realtime.length > 0)
      result.push({ title: "Realtime", emoji: "⚡", data: realtime });
    return result;
  }, []);

  // ── Filtered sections ──────────────────────────────────────────────────
  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sections
      .filter((s) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "solo") return s.title === "Solo";
        if (activeFilter === "turnBased") return s.title === "Turn-Based";
        if (activeFilter === "realtime") return s.title === "Realtime";
        return true;
      })
      .map((s) => {
        if (!query) return s;
        const filtered = s.data.filter((g) =>
          g.displayName.toLowerCase().includes(query),
        );
        return { ...s, data: filtered };
      })
      .filter((s) => s.data.length > 0);
  }, [sections, searchQuery, activeFilter]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleInviteTap = useCallback(
    (invite: GameInviteV4) => {
      if (invite.status === "active" && invite.sessionId) {
        navigation.navigate("GamePlayV4", {
          sessionId: invite.sessionId,
          gameId: invite.gameId,
        });
      } else if (invite.status === "sent" || invite.status === "lobby") {
        navigation.navigate("GameLobbyV4", { inviteId: invite.inviteId });
      }
    },
    [navigation],
  );

  const handleGameTap = useCallback(
    async (_gameId: GameId) => {
      if (!IMPLEMENTED_GAME_IDS.has(_gameId)) {
        // Placeholder game — no playable implementation yet
        return;
      }

      const meta = GAME_METADATA[_gameId];

      // Solo games: resume existing session or create new one, then navigate to play
      if (meta?.runtimeType === "solo") {
        if (launchingSolo) return; // Prevent double-tap
        setLaunchingSolo(_gameId);
        try {
          const { sessionId, resumed } = await resumeOrCreateSoloSession({
            gameId: _gameId,
          });
          if (resumed) {
            console.log(
              `[GamesHub] Resuming existing solo session ${sessionId} for ${_gameId}`,
            );
          }
          navigation.navigate("GamePlayV4", { sessionId, gameId: _gameId });
        } catch (err: unknown) {
          const msg = mapSoloLaunchError(err);
          Alert.alert("Error", msg);
        } finally {
          setLaunchingSolo(null);
        }
        return;
      }

      // Multiplayer games: open game detail page
      navigation.navigate("GameDetailV4", { gameId: _gameId });
    },
    [navigation, launchingSolo],
  );

  const handleMyStats = useCallback(() => {
    navigation.navigate("GameStatsV4");
  }, [navigation]);

  /**
   * Long-press on a solo game card shows an action sheet.
   * Persistent solo games with an active session get extra options.
   */
  const handleSoloLongPress = useCallback(
    (_gameId: GameId) => {
      if (!IMPLEMENTED_GAME_IDS.has(_gameId)) return;
      const meta = GAME_METADATA[_gameId];
      if (!meta) return;

      const isPersistent = isPersistentSoloGame(_gameId);
      const activeSessionId = activeSoloSessions[_gameId];

      const buttons: Array<{
        text: string;
        onPress?: () => void;
        style?: "cancel" | "destructive";
      }> = [];

      // Primary action
      buttons.push({
        text: isPersistent && activeSessionId ? "Resume Run" : "Play Now",
        onPress: () => handleGameTap(_gameId),
      });

      // Archive existing persistent run (destructive)
      if (isPersistent && activeSessionId) {
        buttons.push({
          text: "Archive Run",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Archive Run?",
              "This will end the current run, award XP, and let you start a fresh run.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Archive",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await archiveSoloSession({ sessionId: activeSessionId });
                    } catch (err) {
                      Alert.alert(
                        "Archive Failed",
                        err instanceof Error
                          ? err.message
                          : "Could not archive run.",
                      );
                    }
                  },
                },
              ],
            );
          },
        });
      }

      buttons.push({
        text: "View Details",
        onPress: () => navigation.navigate("GameDetailV4", { gameId: _gameId }),
      });
      buttons.push({
        text: "View Achievements",
        onPress: () =>
          navigation.navigate("AchievementSection", {
            sectionId: _gameId,
          }),
      });
      buttons.push({
        text: "View Leaderboard",
        onPress: () =>
          navigation.navigate("GameLeaderboardV4", { gameId: _gameId }),
      });
      buttons.push({ text: "Cancel", style: "cancel" });

      Alert.alert(meta.displayName, undefined, buttons);
    },
    [navigation, handleGameTap, activeSoloSessions],
  );

  const handleAchievements = useCallback(() => {
    navigation.navigate("AchievementsHub");
  }, [navigation]);

  const toggleSectionCollapse = useCallback((title: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }, []);

  const handleLevelRewards = useCallback(() => {
    navigation.navigate("LevelRewards");
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  // ── Auto-scroll to sticky section when user starts typing ─────────────
  /** scrollContent paddingTop must be accounted for so the sticky bar is flush. */
  const SCROLL_CONTENT_PAD_TOP = 12;
  const stickyScrollTarget = child0Height + SCROLL_CONTENT_PAD_TOP;

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (text.trim().length > 0 && child0Height > 0 && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          y: stickyScrollTarget,
          animated: true,
        });
      }
    },
    [child0Height, stickyScrollTarget],
  );

  const handleSearchFocus = useCallback(() => {
    if (child0Height > 0 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: stickyScrollTarget, animated: true });
    }
  }, [child0Height, stickyScrollTarget]);

  // ── Colors ─────────────────────────────────────────────────────────────
  const bgColor = theme.isDark ? "#000" : theme.colors.background;
  const cardBg = theme.isDark ? "#1A1A1A" : "#FFF";
  const textColor = theme.isDark ? "#FFF" : "#222";
  const subtextColor = theme.isDark ? "#AAA" : "#666";
  const borderColor = theme.isDark ? "#333" : "#E0E0E0";
  const accentBg = theme.isDark ? "#2C2C2E" : "#F2F2F7";

  // ── Invite status label ────────────────────────────────────────────────
  const inviteStatusLabel = (status: string): string => {
    switch (status) {
      case "sent":
        return "Waiting";
      case "lobby":
        return "In Lobby";
      case "active":
        return "In Progress";
      default:
        return status;
    }
  };

  const inviteStatusColor = (status: string): string => {
    switch (status) {
      case "sent":
        return "#FF9500";
      case "lobby":
        return "#5AC8FA";
      case "active":
        return "#34C759";
      default:
        return subtextColor;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <ScreenHeader
        title="Games"
        renderRight={() => (
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              onPress={handleAchievements}
              style={[styles.headerCircleButton, { backgroundColor: accentBg }]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="trophy-outline"
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleMyStats}
              style={[styles.headerButton, { backgroundColor: accentBg }]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="chart-bar"
                size={18}
                color={theme.colors.primary}
              />
              <Text
                style={[
                  styles.headerButtonText,
                  { color: theme.colors.primary },
                ]}
              >
                My Stats
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* ── Child 0: Level & Active Games (scrolls normally) ── */}
        <View onLayout={(e) => setChild0Height(e.nativeEvent.layout.height)}>
          {/* ── Level & Rewards Card ───────────────────────────────── */}
          <TouchableOpacity
            style={[
              styles.levelRewardsCard,
              {
                backgroundColor: cardBg,
                borderColor,
              },
            ]}
            onPress={handleLevelRewards}
            activeOpacity={0.7}
          >
            {/* Top row: Level badge + XP numbers */}
            <View style={styles.lrTopRow}>
              <View
                style={[
                  styles.lrLevelBadge,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text style={styles.lrLevelBadgeText}>{currentLevel}</Text>
              </View>
              <View style={styles.lrXpInfo}>
                <Text style={[styles.lrLevelLabel, { color: textColor }]}>
                  Level {currentLevel}
                  {isMaxLevel ? " (MAX)" : ""}
                </Text>
                <Text style={[styles.lrXpText, { color: subtextColor }]}>
                  {isMaxLevel
                    ? "MAX LEVEL"
                    : `${xpCurrent.toLocaleString()}/${xpNeeded.toLocaleString()} XP`}
                </Text>
              </View>
              {unclaimedRewards > 0 && (
                <View style={styles.lrUnclaimedPill}>
                  <MaterialCommunityIcons name="gift" size={14} color="#FFF" />
                  <Text style={styles.lrUnclaimedText}>{unclaimedRewards}</Text>
                </View>
              )}
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={subtextColor}
              />
            </View>

            {/* XP progress bar */}
            <View style={styles.lrBarRow}>
              <ProgressBar
                progress={xpProgress}
                color={theme.colors.primary}
                style={[styles.lrBar, { backgroundColor: accentBg }]}
              />
            </View>

            {/* Bottom label */}
            <Text style={[styles.lrBottomHint, { color: subtextColor }]}>
              {unclaimedRewards > 0
                ? `${unclaimedRewards} reward${unclaimedRewards !== 1 ? "s" : ""} ready to claim!`
                : isMaxLevel
                  ? "All tiers unlocked — claim your rewards!"
                  : `${Math.max(0, xpNeeded - xpCurrent).toLocaleString()} XP to next level`}
            </Text>
          </TouchableOpacity>

          {/* ── Active Games Section ─────────────────────────────────── */}
          {!invitesLoading && invites.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: subtextColor }]}>
                🎮 ACTIVE GAMES
              </Text>
              {invites.map((invite) => {
                const meta = GAME_METADATA[invite.gameId];
                return (
                  <TouchableOpacity
                    key={invite.inviteId}
                    style={[
                      styles.inviteCard,
                      { backgroundColor: cardBg, borderColor },
                    ]}
                    onPress={() => handleInviteTap(invite)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[styles.inviteIcon, { backgroundColor: accentBg }]}
                    >
                      <MaterialCommunityIcons
                        name={
                          (meta?.icon ??
                            "gamepad-variant") as keyof typeof MaterialCommunityIcons.glyphMap
                        }
                        size={24}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.inviteInfo}>
                      <Text style={[styles.inviteName, { color: textColor }]}>
                        {meta?.displayName ?? invite.gameId}
                      </Text>
                      <Text
                        style={[styles.invitePlayers, { color: subtextColor }]}
                      >
                        {invite.participantIds.length} player
                        {invite.participantIds.length !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            inviteStatusColor(invite.status) + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: inviteStatusColor(invite.status) },
                        ]}
                      >
                        {inviteStatusLabel(invite.status)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={subtextColor}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Child 1: Search + Tab Bar (sticky) ─────────────────── */}
        <View
          style={[styles.stickySearchContainer, { backgroundColor: bgColor }]}
        >
          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search games\u2026"
              onChangeText={handleSearchChange}
              onFocus={handleSearchFocus}
              value={searchQuery}
              style={[
                styles.searchBar,
                { backgroundColor: theme.colors.background },
              ]}
              inputStyle={[styles.searchInput, { color: textColor }]}
              iconColor={subtextColor}
              placeholderTextColor={subtextColor}
              elevation={0}
            />
          </View>

          {/* Filter tab bar */}
          <View
            style={[styles.filterTabBar, { borderBottomColor: borderColor }]}
          >
            {FILTER_PILLS.map((pill) => {
              const isActive = activeFilter === pill.key;
              return (
                <TouchableOpacity
                  key={pill.key}
                  style={[
                    styles.filterTab,
                    isActive && {
                      borderBottomColor: theme.colors.primary,
                      borderBottomWidth: 2,
                    },
                  ]}
                  onPress={() => setActiveFilter(pill.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterTabLabel,
                      {
                        color: isActive ? theme.colors.primary : subtextColor,
                        fontWeight: isActive ? "600" : "400",
                      },
                    ]}
                  >
                    {pill.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Divider */}
          <View
            style={[styles.searchDivider, { backgroundColor: borderColor }]}
          />
        </View>

        {/* ── Game Catalog ─────────────────────────────────────────── */}
        {filteredSections.map((section) => {
          const isCollapsed = collapsedSections.has(section.title);
          return (
            <View key={section.title} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionTitleRow}
                onPress={() => toggleSectionCollapse(section.title)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: subtextColor, marginBottom: 0 },
                  ]}
                >
                  {section.emoji} {section.title.toUpperCase()}
                </Text>
                <MaterialCommunityIcons
                  name={isCollapsed ? "chevron-down" : "chevron-up"}
                  size={20}
                  color={subtextColor}
                />
              </TouchableOpacity>
              {!isCollapsed && (
                <View style={[styles.catalogGrid, { marginTop: 10 }]}>
                  {section.data.map((game) => {
                    const isImplemented = IMPLEMENTED_GAME_IDS.has(game.gameId);
                    const isLaunching = launchingSolo === game.gameId;
                    const isSolo = game.runtimeType === "solo";
                    const hasActiveSession = !!activeSoloSessions[game.gameId];
                    const isPersistent = isPersistentSoloGame(game.gameId);
                    const isMastered = masteredGameIds.has(game.gameId);
                    const hasThumbnail = !!game.thumbnail;

                    // ── Solo game with full-bleed thumbnail ──────────
                    if (hasThumbnail && isSolo) {
                      return (
                        <TouchableOpacity
                          key={game.gameId}
                          style={[
                            styles.thumbnailCard,
                            !isImplemented && { opacity: 0.5 },
                            isMastered && {
                              borderColor: "#DAA520",
                              borderWidth: 2,
                            },
                          ]}
                          onPress={() => handleGameTap(game.gameId)}
                          onLongPress={
                            isImplemented
                              ? () => handleSoloLongPress(game.gameId)
                              : undefined
                          }
                          activeOpacity={isImplemented ? 0.7 : 1}
                          disabled={isLaunching}
                        >
                          <ImageBackground
                            source={game.thumbnail}
                            style={styles.thumbnailBg}
                            imageStyle={styles.thumbnailImage}
                            resizeMode="cover"
                          >
                            {isLaunching && (
                              <View style={styles.thumbnailLoadingOverlay}>
                                <ActivityIndicator size="small" color="#FFF" />
                              </View>
                            )}
                            {/* Bottom frosted banner */}
                            <View style={styles.thumbnailBanner}>
                              <Text
                                style={styles.thumbnailBannerTitle}
                                numberOfLines={1}
                              >
                                {game.displayName}
                              </Text>
                              <Text style={styles.thumbnailBannerCta}>
                                {isLaunching
                                  ? "Starting…"
                                  : !isImplemented
                                    ? "Coming Soon"
                                    : hasActiveSession && isPersistent
                                      ? "Resume"
                                      : "Play Now"}
                              </Text>
                            </View>
                          </ImageBackground>
                        </TouchableOpacity>
                      );
                    }

                    // ── Default card (multiplayer / no thumbnail) ────
                    return (
                      <TouchableOpacity
                        key={game.gameId}
                        style={[
                          styles.catalogCard,
                          { backgroundColor: cardBg, borderColor },
                          !isImplemented && { opacity: 0.5 },
                          isMastered && {
                            borderColor: "#DAA520",
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() => handleGameTap(game.gameId)}
                        onLongPress={
                          isSolo && isImplemented
                            ? () => handleSoloLongPress(game.gameId)
                            : undefined
                        }
                        activeOpacity={isImplemented ? 0.7 : 1}
                        disabled={isLaunching}
                      >
                        {isLaunching ? (
                          <View
                            style={[
                              styles.catalogIcon,
                              { backgroundColor: accentBg },
                            ]}
                          >
                            <ActivityIndicator
                              size="small"
                              color={theme.colors.primary}
                            />
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.catalogIcon,
                              { backgroundColor: accentBg },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={
                                game.icon as keyof typeof MaterialCommunityIcons.glyphMap
                              }
                              size={28}
                              color={
                                isImplemented
                                  ? theme.colors.primary
                                  : subtextColor
                              }
                            />
                          </View>
                        )}
                        <Text
                          style={[styles.catalogName, { color: textColor }]}
                          numberOfLines={1}
                        >
                          {game.displayName}
                        </Text>
                        {isImplemented ? (
                          isSolo ? (
                            <Text
                              style={[
                                styles.playNowBadge,
                                { color: theme.colors.primary },
                              ]}
                            >
                              {isLaunching
                                ? "Starting…"
                                : hasActiveSession && isPersistent
                                  ? "Resume"
                                  : "Play Now"}
                            </Text>
                          ) : (
                            <Text
                              style={[
                                styles.catalogPlayers,
                                { color: subtextColor },
                              ]}
                            >
                              {game.minPlayers === game.maxPlayers
                                ? `${game.minPlayers}P`
                                : `${game.minPlayers}–${game.maxPlayers}P`}
                            </Text>
                          )
                        ) : (
                          <Text
                            style={[
                              styles.comingSoonBadge,
                              { color: subtextColor },
                            ]}
                          >
                            Coming Soon
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

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
  container: {
    flex: 1,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerCircleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Sticky search + filters
  stickySearchContainer: {
    marginHorizontal: -16,
    paddingTop: 0,
    paddingBottom: 0,
    zIndex: 3,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },

  // Section
  section: {
    marginBottom: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  // Active invite cards
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  inviteIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteName: {
    fontSize: 16,
    fontWeight: "600",
  },
  invitePlayers: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Search & Filters (GroupInfo-style)
  filterTabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterTabLabel: {
    fontSize: 13,
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBar: {
    borderRadius: 12,
    height: 36,
  },
  searchInput: {
    fontSize: 13,
    minHeight: 0,
  },
  searchDivider: {
    height: StyleSheet.hairlineWidth,
  },

  // Catalog grid
  catalogGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  catalogCard: {
    width: "31%",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  catalogIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  catalogName: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  catalogPlayers: {
    fontSize: 11,
    marginTop: 2,
  },
  comingSoonBadge: {
    fontSize: 10,
    fontWeight: "600",
    fontStyle: "italic",
    marginTop: 3,
  },
  playNowBadge: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },

  // Thumbnail-backed solo game cards
  thumbnailCard: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  thumbnailBg: {
    flex: 1,
    justifyContent: "flex-end",
  },
  thumbnailImage: {
    borderRadius: 12,
  },
  thumbnailLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  thumbnailBanner: {
    backgroundColor: "rgba(255,255,255,0.55)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
  },
  thumbnailBannerCta: {
    fontSize: 10,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
    marginTop: 1,
  },

  // Level Rewards card
  levelRewardsCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    gap: 8,
  },
  lrTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  lrLevelBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  lrLevelBadgeText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  lrXpInfo: {
    flex: 1,
  },
  lrLevelLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  lrXpText: {
    fontSize: 12,
    marginTop: 1,
  },
  lrUnclaimedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  lrUnclaimedText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  lrBarRow: {
    paddingLeft: 46,
  },
  lrBar: {
    height: 6,
    borderRadius: 3,
  },
  lrBottomHint: {
    fontSize: 12,
    paddingLeft: 46,
  },
});
