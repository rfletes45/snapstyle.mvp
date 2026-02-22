/**
 * GameDetailsScreen — Steam-like hub page for a single game.
 *
 * Features:
 * - Collapsing hero header that shrinks to compact bar on scroll
 * - Sticky segmented tab bar with scrollspy
 * - Skeleton loading states per section
 * - Achievements preview with "Next up" and secret-safe rendering
 * - Leaderboard preview with pinned "You" row
 * - Memoized sub-components for scroll performance
 * - Responsive layout (small/large phones, font scaling, dark/light)
 * - Collapsible "Read more" for long descriptions
 *
 * Route: GameDetails({ gameId: string })
 *
 * @file src/screens/games/GameDetailsScreen.tsx
 */

import { Skeleton } from "@/components/ui/SkeletonLoader";
import { GAME_SCREEN_MAP, formatPlayerCount } from "@/config/gameCategories";
import useAchievementsV2 from "@/hooks/useAchievementsV2";
import { formatScore, getPersonalBest } from "@/services/games";
import { getMultiplayerGlobalLeaderboard } from "@/services/multiplayerLeaderboard";
import {
  getAllHighScores,
  getRecentSessions,
  getLeaderboard as getSinglePlayerLeaderboard,
  type PlayerHighScore,
} from "@/services/singlePlayerSessions";
import { useAuth } from "@/store/AuthContext";
import {
  ExtendedGameType,
  GAME_METADATA,
  formatGameScore,
  getGameMetadata,
  isValidGameType,
  type SinglePlayerGameType,
  type TurnBasedGameType,
} from "@/types/games";
import type { MultiplayerLeaderboardEntry } from "@/types/multiplayerLeaderboard";
import { PlayStackParamList } from "@/types/navigation/root";
import type { SinglePlayerLeaderboardEntry } from "@/types/singlePlayerGames";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Chip,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type Props = NativeStackScreenProps<PlayStackParamList, "GameDetails">;

// =============================================================================
// Constants
// =============================================================================

/** Minimum content area height (below safe-area insets). Actual height is
 *  computed at runtime via onLayout to handle font scaling & chip wrapping. */
const HERO_CONTENT_MIN_HEIGHT = 280;
const HERO_COLLAPSED_HEIGHT = 56;
const TAB_BAR_HEIGHT = 44;
const DESCRIPTION_COLLAPSE_LINES = 4;

/** All single-player game IDs */
const SINGLE_PLAYER_IDS = new Set<string>(
  Object.values(GAME_METADATA)
    .filter((g) => !g.isMultiplayer)
    .map((g) => g.id),
);

/** All multiplayer (turn-based) game IDs */
const MULTIPLAYER_IDS = new Set<string>(
  Object.values(GAME_METADATA)
    .filter((g) => g.isMultiplayer)
    .map((g) => g.id),
);

// Shared leaderboard row type
interface LeaderboardRow {
  rank: number;
  name: string;
  score: string;
  isCurrentUser: boolean;
}

// Tab segment definition
interface TabSegment {
  key: string;
  label: string;
  icon: string;
}

// =============================================================================
// Skeleton Sub-components (memoized)
// =============================================================================

const AchievementRowSkeleton = memo(function AchievementRowSkeleton() {
  return (
    <View style={styles.achievementRow}>
      <Skeleton width={28} height={28} variant="rounded" />
      <View style={styles.achievementInfo}>
        <Skeleton width="70%" height={14} variant="text" />
        <View style={{ height: 4 }} />
        <Skeleton width="90%" height={12} variant="text" />
      </View>
    </View>
  );
});

const LeaderboardRowSkeleton = memo(function LeaderboardRowSkeleton() {
  return (
    <View style={styles.leaderboardRow}>
      <View style={styles.leaderboardRankCol}>
        <Skeleton width={20} height={14} variant="text" />
      </View>
      <View style={styles.leaderboardNameCol}>
        <Skeleton width="60%" height={14} variant="text" />
      </View>
      <View style={[styles.leaderboardScoreCol, { alignItems: "flex-end" }]}>
        <Skeleton width={50} height={14} variant="text" />
      </View>
    </View>
  );
});

const StatTileSkeleton = memo(function StatTileSkeleton({
  bgColor,
}: {
  bgColor: string;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: bgColor }]}>
      <Skeleton width={20} height={20} variant="circular" />
      <View style={{ height: 6 }} />
      <Skeleton width={60} height={18} variant="text" />
      <View style={{ height: 4 }} />
      <Skeleton width={50} height={10} variant="text" />
    </View>
  );
});

// =============================================================================
// Empty State Sub-component (memoized)
// =============================================================================

const EmptyState = memo(function EmptyState({
  icon,
  message,
  color,
}: {
  icon: string;
  message: string;
  color: string;
}) {
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name={icon as any}
        size={32}
        color={color}
        style={{ marginBottom: 8, opacity: 0.5 }}
      />
      <Text variant="bodyMedium" style={{ color, textAlign: "center" }}>
        {message}
      </Text>
    </View>
  );
});

// =============================================================================
// Stat Tile Sub-component (memoized)
// =============================================================================

const StatTile = memo(function StatTile({
  label,
  value,
  icon,
  primaryColor,
  bgColor,
  textColor,
  labelColor,
}: {
  label: string;
  value: string;
  icon: string;
  primaryColor: string;
  bgColor: string;
  textColor: string;
  labelColor: string;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: bgColor }]}>
      <MaterialCommunityIcons
        name={icon as any}
        size={20}
        color={primaryColor}
        style={{ marginBottom: 4 }}
      />
      <Text
        variant="titleMedium"
        style={[styles.statValue, { color: textColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text
        variant="labelSmall"
        style={{ color: labelColor, textAlign: "center" }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
});

// =============================================================================
// Achievement Row Sub-component (memoized)
// =============================================================================

const AchievementItem = memo(function AchievementItem({
  icon,
  name,
  description,
  state,
  progressPct,
  secret,
  primaryColor,
  textColor,
  subtextColor,
}: {
  icon: string;
  name: string;
  description: string;
  state: "locked" | "progress" | "unlocked";
  progressPct: number;
  secret: boolean;
  primaryColor: string;
  textColor: string;
  subtextColor: string;
}) {
  // Secret achievements that are locked: hide details
  const isHiddenSecret = secret && state === "locked";

  return (
    <View style={styles.achievementRow}>
      <Text style={styles.achievementIcon}>{isHiddenSecret ? "❓" : icon}</Text>
      <View style={styles.achievementInfo}>
        <Text
          variant="bodyMedium"
          numberOfLines={1}
          style={{
            fontWeight: "600",
            color: state === "unlocked" ? textColor : subtextColor,
            opacity: isHiddenSecret ? 0.6 : 1,
          }}
        >
          {isHiddenSecret ? "Hidden Achievement" : name}
        </Text>
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={{ color: subtextColor, opacity: isHiddenSecret ? 0.5 : 1 }}
        >
          {isHiddenSecret
            ? "Keep playing to discover this one..."
            : description}
        </Text>
        {state === "progress" && !isHiddenSecret && (
          <ProgressBar
            progress={progressPct}
            color={primaryColor}
            style={styles.achievementProgressBar}
          />
        )}
      </View>
      {state === "unlocked" && (
        <MaterialCommunityIcons
          name="check-circle"
          size={20}
          color={primaryColor}
        />
      )}
    </View>
  );
});

// =============================================================================
// Leaderboard Row Sub-component (memoized)
// =============================================================================

const LeaderboardItem = memo(function LeaderboardItem({
  row,
  primaryColor,
  textColor,
  subtextColor,
  highlightBg,
}: {
  row: LeaderboardRow;
  primaryColor: string;
  textColor: string;
  subtextColor: string;
  highlightBg: string;
}) {
  return (
    <View
      style={[
        styles.leaderboardRow,
        row.isCurrentUser && {
          backgroundColor: highlightBg,
          borderRadius: 8,
        },
      ]}
    >
      <Text
        variant="bodyMedium"
        style={[
          styles.leaderboardRankCol,
          {
            fontWeight: row.rank <= 3 ? "700" : "400",
            color: row.rank <= 3 ? primaryColor : textColor,
          },
        ]}
      >
        {row.rank === 1
          ? "\ud83e\udd47"
          : row.rank === 2
            ? "\ud83e\udd48"
            : row.rank === 3
              ? "\ud83e\udd49"
              : row.rank}
      </Text>
      <Text
        variant="bodyMedium"
        numberOfLines={1}
        style={[
          styles.leaderboardNameCol,
          {
            fontWeight: row.isCurrentUser ? "700" : "400",
            color: textColor,
          },
        ]}
      >
        {row.isCurrentUser ? "You" : row.name}
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.leaderboardScoreCol, { color: subtextColor }]}
      >
        {row.score}
      </Text>
    </View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export default function GameDetailsScreen({ navigation, route }: Props) {
  const { gameId } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;

  // Scroll tracking
  const scrollY = useSharedValue(0);
  const scrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Section y-offsets for scrollspy
  const sectionOffsets = useRef<Record<string, number>>({});

  // Dynamic hero height — measured on first layout to prevent content clipping
  // on small devices and with larger accessibility font sizes.
  const [heroContentMeasured, setHeroContentMeasured] = useState(0);
  const heroExpandedHeight = Math.max(
    HERO_CONTENT_MIN_HEIGHT + insets.top,
    heroContentMeasured > 0 ? heroContentMeasured + insets.top : 0,
  );
  const collapseScrollDistance = heroExpandedHeight - HERO_COLLAPSED_HEIGHT;

  // Description expand/collapse
  const [descExpanded, setDescExpanded] = useState(false);
  const [descNeedsCollapse, setDescNeedsCollapse] = useState(false);

  // ── Validate ──
  if (!isValidGameType(gameId)) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Game Not Found" />
        </Appbar.Header>
        <View style={styles.centerContent}>
          <MaterialCommunityIcons
            name="controller-off"
            size={48}
            color={theme.colors.onSurfaceVariant}
            style={{ marginBottom: 12, opacity: 0.5 }}
          />
          <Text variant="headlineSmall">Game not found</Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}
          >
            The game &quot;{gameId}&quot; could not be found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const typedGameId = gameId as ExtendedGameType;
  const game = getGameMetadata(typedGameId);
  const screenName = GAME_SCREEN_MAP[typedGameId];
  const isSinglePlayer = SINGLE_PLAYER_IDS.has(typedGameId);
  const isMultiplayer = MULTIPLAYER_IDS.has(typedGameId);

  // ── Build tab segments ──
  const tabSegments = useMemo<TabSegment[]>(() => {
    const tabs: TabSegment[] = [
      { key: "overview", label: "Overview", icon: "information-outline" },
    ];
    if (game.hasAchievements) {
      tabs.push({
        key: "achievements",
        label: "Achievements",
        icon: "trophy-outline",
      });
    }
    if (game.hasLeaderboard) {
      tabs.push({ key: "leaderboard", label: "Leaderboard", icon: "podium" });
    }
    tabs.push({ key: "stats", label: "Stats", icon: "chart-bar" });
    if (isSinglePlayer) {
      tabs.push({ key: "history", label: "History", icon: "history" });
    }
    return tabs;
  }, [game.hasAchievements, game.hasLeaderboard, isSinglePlayer]);

  // ── Achievements (realtime hook) ──
  const {
    isV2Active: achievementsActive,
    isLoading: achievementsLoading,
    displayItems: allAchievementItems,
    summary: achievementsSummary,
  } = useAchievementsV2(userId, { gameType: typedGameId });

  // Limit preview to first 6 items (secret-safe)
  const achievementPreviewItems = useMemo(
    () => allAchievementItems.slice(0, 6),
    [allAchievementItems],
  );

  // "Next up" — top 3 closest-to-completion locked/progress items
  const nextUpAchievements = useMemo(() => {
    return allAchievementItems
      .filter((a) => a.state === "progress" && !a.secret)
      .sort((a, b) => b.progressPct - a.progressPct)
      .slice(0, 3);
  }, [allAchievementItems]);

  // ── Leaderboard Preview (on mount) ──
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [userLeaderboardRow, setUserLeaderboardRow] =
    useState<LeaderboardRow | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLeaderboardLoading(true);

    (async () => {
      try {
        let rows: LeaderboardRow[] = [];
        let userRow: LeaderboardRow | null = null;

        if (isSinglePlayer && game.hasLeaderboard) {
          const entries = await getSinglePlayerLeaderboard(
            typedGameId as SinglePlayerGameType,
            "allTime",
            10,
          );
          rows = entries.map((e: SinglePlayerLeaderboardEntry) => ({
            rank: e.rank,
            name: e.playerName || "Player",
            score: formatGameScore(typedGameId, e.score),
            isCurrentUser: e.playerId === userId,
          }));
          // Check if user is in the list
          const found = rows.find((r) => r.isCurrentUser);
          if (!found && userId) {
            // User not in top N — we don't have their rank from this API
            // but we can show their PB once stats load
          }
          userRow = found || null;
        } else if (isMultiplayer && game.hasLeaderboard) {
          const data = await getMultiplayerGlobalLeaderboard(
            typedGameId as TurnBasedGameType,
            "all-time",
            10,
          );
          rows = data.entries.map((e: MultiplayerLeaderboardEntry) => ({
            rank: e.rank,
            name: e.displayName || "Player",
            score: `${e.rating} ELO`,
            isCurrentUser: e.userId === userId,
          }));
          const found = rows.find((r) => r.isCurrentUser);
          // If user entry exists from API but not in top N, pin it
          if (!found && data.userEntry) {
            userRow = {
              rank: data.userGlobalRank ?? data.userEntry.rank,
              name: "You",
              score: `${data.userEntry.rating} ELO`,
              isCurrentUser: true,
            };
          } else {
            userRow = found || null;
          }
        }

        if (!cancelled) {
          setLeaderboardRows(rows);
          setUserLeaderboardRow(userRow);
        }
      } catch {
        // silent — section will show "No data"
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [typedGameId, userId, isSinglePlayer, isMultiplayer, game.hasLeaderboard]);

  // ── Personal Stats (on mount) ──
  const [personalBest, setPersonalBest] = useState<{
    score: number;
    achievedAt: number;
  } | null>(null);
  const [highScoreDoc, setHighScoreDoc] = useState<PlayerHighScore | null>(
    null,
  );
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);

    (async () => {
      if (!userId) {
        setStatsLoading(false);
        return;
      }

      try {
        const pb = await getPersonalBest(userId, typedGameId);
        if (!cancelled && pb) {
          setPersonalBest({ score: pb.bestScore, achievedAt: pb.achievedAt });
        }

        if (isSinglePlayer) {
          try {
            const all = await getAllHighScores(userId);
            const match = all.find((h) => h.gameType === typedGameId);
            if (!cancelled && match) setHighScoreDoc(match);
          } catch {
            // silent
          }
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, typedGameId, isSinglePlayer]);

  // ── Recent Sessions (single-player only, on mount) ──
  const [recentSessions, setRecentSessions] = useState<
    Array<{ score: number; endedAt: number }>
  >([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    if (!isSinglePlayer || !userId) return;
    let cancelled = false;
    setSessionsLoading(true);

    (async () => {
      try {
        const sessions = await getRecentSessions(
          userId,
          typedGameId as SinglePlayerGameType,
          5,
        );
        if (!cancelled) {
          setRecentSessions(
            sessions.map((s: any) => ({
              score: s.finalScore ?? s.score ?? 0,
              endedAt: s.endedAt?.toMillis?.() ?? s.endedAt ?? Date.now(),
            })),
          );
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, typedGameId, isSinglePlayer]);

  // ── Navigation handlers (stable refs) ──
  const handlePlay = useCallback(() => {
    if (screenName) {
      (navigation as any).navigate(screenName);
    }
  }, [screenName, navigation]);

  const handleOpenAchievements = useCallback(() => {
    navigation.navigate("Achievements", { gameId });
  }, [navigation, gameId]);

  const handleOpenLeaderboard = useCallback(() => {
    navigation.navigate("Leaderboard", { gameId });
  }, [navigation, gameId]);

  const handleOpenHistory = useCallback(() => {
    navigation.navigate("GameHistory");
  }, [navigation]);

  // ── Scroll handling ──
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.value = y;

      // Scrollspy: determine active tab
      const stickyOffset = heroExpandedHeight + TAB_BAR_HEIGHT + 20;
      const offsets = sectionOffsets.current;
      let active = "overview";
      for (const seg of tabSegments) {
        const off = offsets[seg.key];
        if (off !== undefined && y >= off - stickyOffset) {
          active = seg.key;
        }
      }
      if (active !== activeTab) {
        setActiveTab(active);
      }
    },
    [scrollY, tabSegments, activeTab],
  );

  const handleTabPress = useCallback(
    (key: string) => {
      setActiveTab(key);
      const offset = sectionOffsets.current[key];
      if (offset !== undefined && scrollRef.current) {
        // Account for sticky header + tabs
        const scrollTo = Math.max(
          0,
          offset - HERO_COLLAPSED_HEIGHT - TAB_BAR_HEIGHT - insets.top - 8,
        );
        scrollRef.current.scrollTo({ y: scrollTo, animated: true });
      }
    },
    [insets.top],
  );

  const handleSectionLayout = useCallback(
    (key: string, event: LayoutChangeEvent) => {
      sectionOffsets.current[key] = event.nativeEvent.layout.y;
    },
    [],
  );

  // ── Collapsing header animated styles ──
  const heroAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, collapseScrollDistance],
      [heroExpandedHeight, HERO_COLLAPSED_HEIGHT],
      Extrapolation.CLAMP,
    );
    return { height, overflow: "hidden" as const };
  });

  const heroContentOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, collapseScrollDistance * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const compactHeaderOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [collapseScrollDistance * 0.5, collapseScrollDistance],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // ── Helpers ──
  const formatDate = useCallback((ms: number) => {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  const formatTimeAgo = useCallback((ms: number) => {
    const seconds = Math.floor((Date.now() - ms) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }, []);

  // Description text layout callback
  const handleDescTextLayout = useCallback((e: any) => {
    if (e.nativeEvent?.lines?.length > DESCRIPTION_COLLAPSE_LINES) {
      setDescNeedsCollapse(true);
    }
  }, []);

  // Theme-derived colors (avoid recalc in render)
  const colors = useMemo(
    () => ({
      primary: theme.colors.primary,
      surface: theme.colors.surface,
      surfaceVariant: theme.colors.surfaceVariant,
      background: theme.colors.background,
      text: theme.colors.onSurface,
      subtext: theme.colors.onSurfaceVariant,
      highlight: theme.colors.primaryContainer || theme.colors.primary + "15",
    }),
    [theme.colors],
  );

  // Pre-compute the leaderboard display rows with pinned user
  const displayLeaderboardRows = useMemo(() => {
    const rows = [...leaderboardRows];
    // If user is not in the top N but we have their data, pin at bottom
    if (userLeaderboardRow && !leaderboardRows.some((r) => r.isCurrentUser)) {
      rows.push(userLeaderboardRow);
    }
    return rows;
  }, [leaderboardRows, userLeaderboardRow]);

  const userIsInTopN = useMemo(
    () => leaderboardRows.some((r) => r.isCurrentUser),
    [leaderboardRows],
  );

  // ── Render ──
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["left", "right"]}
    >
      {/* ── Collapsing hero + compact header ── */}
      <Animated.View
        style={[
          styles.heroWrapper,
          { backgroundColor: colors.surface, paddingTop: insets.top },
          heroAnimatedStyle,
        ]}
      >
        {/* Expanded hero content */}
        <Animated.View
          style={[styles.heroExpanded, heroContentOpacity]}
          onLayout={(e) => {
            const h = Math.ceil(e.nativeEvent.layout.height);
            if (h > heroContentMeasured) {
              setHeroContentMeasured(h);
            }
          }}
        >
          <View style={styles.heroTopRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={styles.heroBackButton}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={colors.text}
              />
            </Pressable>
          </View>
          <Text style={styles.heroIcon}>{game.icon}</Text>
          <Text
            variant="headlineMedium"
            style={[styles.heroName, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {game.name}
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.heroTagline, { color: colors.subtext }]}
            numberOfLines={2}
          >
            {game.tagline ?? game.description}
          </Text>

          {/* Quick stat chips */}
          <View style={styles.quickChipsRow}>
            {personalBest && (
              <Chip compact icon="trophy" style={styles.quickChip}>
                {formatScore(typedGameId, personalBest.score)}
              </Chip>
            )}
            {achievementsActive && achievementsSummary.totalAvailable > 0 && (
              <Chip compact icon="medal" style={styles.quickChip}>
                {achievementsSummary.totalUnlocked}/
                {achievementsSummary.totalAvailable}
              </Chip>
            )}
            {highScoreDoc && (
              <Chip compact icon="controller-classic" style={styles.quickChip}>
                {highScoreDoc.totalGames} played
              </Chip>
            )}
          </View>
        </Animated.View>

        {/* Compact collapsed header */}
        <Animated.View
          style={[
            styles.compactHeader,
            compactHeaderOpacity,
            { paddingTop: insets.top },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.compactBackButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.text}
            />
          </Pressable>
          <Text style={styles.compactIcon}>{game.icon}</Text>
          <Text
            variant="titleMedium"
            style={[styles.compactTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {game.name}
          </Text>
          <View style={{ flex: 1 }} />
          {screenName && (
            <TouchableOpacity
              onPress={handlePlay}
              style={[
                styles.compactPlayBtn,
                { backgroundColor: colors.primary },
              ]}
              activeOpacity={0.8}
              accessibilityLabel={`Play ${game.name}`}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="play" size={18} color="#fff" />
              <Text style={styles.compactPlayText}>Play</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>

      {/* ── Sticky Tab Bar ── */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.surfaceVariant,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {tabSegments.map((seg) => (
            <TouchableOpacity
              key={seg.key}
              onPress={() => handleTabPress(seg.key)}
              style={[
                styles.tabItem,
                activeTab === seg.key && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === seg.key }}
            >
              <MaterialCommunityIcons
                name={seg.icon as any}
                size={16}
                color={activeTab === seg.key ? colors.primary : colors.subtext}
              />
              <Text
                variant="labelMedium"
                style={{
                  color:
                    activeTab === seg.key ? colors.primary : colors.subtext,
                  fontWeight: activeTab === seg.key ? "700" : "500",
                  marginLeft: 4,
                }}
              >
                {seg.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ── Overview / About Section ── */}
        <View
          onLayout={(e) => handleSectionLayout("overview", e)}
          style={[styles.section, { backgroundColor: colors.surface }]}
        >
          {/* Tags row */}
          {game.tags && game.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {game.tags.map((tag) => (
                <Chip
                  key={tag}
                  compact
                  style={styles.tagChip}
                  textStyle={styles.tagChipText}
                >
                  {tag}
                </Chip>
              ))}
              <Chip
                compact
                style={styles.tagChip}
                textStyle={styles.tagChipText}
              >
                {formatPlayerCount(game)}
              </Chip>
            </View>
          )}

          {/* Play button (visible when hero is expanded) */}
          {screenName && (
            <Button
              mode="contained"
              onPress={handlePlay}
              style={styles.playButton}
              icon="play"
              accessibilityLabel={`Play ${game.name}`}
              accessibilityRole="button"
            >
              Play
            </Button>
          )}

          <Text
            variant="titleMedium"
            style={[styles.sectionTitle, { marginTop: 20 }]}
          >
            About
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: colors.subtext, lineHeight: 22 }}
            numberOfLines={
              descExpanded || !descNeedsCollapse
                ? undefined
                : DESCRIPTION_COLLAPSE_LINES
            }
            onTextLayout={handleDescTextLayout}
          >
            {game.longDescription ?? game.description}
          </Text>
          {descNeedsCollapse && (
            <Pressable onPress={() => setDescExpanded((v) => !v)}>
              <Text
                variant="labelMedium"
                style={{
                  color: colors.primary,
                  marginTop: 4,
                  fontWeight: "600",
                }}
              >
                {descExpanded ? "Show less" : "Read more"}
              </Text>
            </Pressable>
          )}

          {game.howToPlay && game.howToPlay.length > 0 && (
            <View style={styles.howToPlaySection}>
              <Text
                variant="titleSmall"
                style={[styles.howToPlayTitle, { color: colors.primary }]}
              >
                How to Play
              </Text>
              {game.howToPlay.map((step, i) => (
                <View key={i} style={styles.howToPlayRow}>
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.primary, fontWeight: "700" }}
                  >
                    {i + 1}.
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={[styles.howToPlayText, { color: colors.subtext }]}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Achievements Preview ── */}
        {game.hasAchievements && (
          <View
            onLayout={(e) => handleSectionLayout("achievements", e)}
            style={[styles.section, { backgroundColor: colors.surface }]}
          >
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Achievements
              </Text>
              {achievementsActive && achievementsSummary.totalAvailable > 0 && (
                <Text variant="labelMedium" style={{ color: colors.primary }}>
                  {Math.round(
                    (achievementsSummary.totalUnlocked /
                      achievementsSummary.totalAvailable) *
                      100,
                  )}
                  % complete
                </Text>
              )}
            </View>

            {/* Completion mini-bar */}
            {achievementsActive && achievementsSummary.totalAvailable > 0 && (
              <View style={styles.completionBar}>
                <ProgressBar
                  progress={
                    achievementsSummary.totalUnlocked /
                    achievementsSummary.totalAvailable
                  }
                  color={colors.primary}
                  style={styles.progressBar}
                />
                <Text variant="labelSmall" style={{ color: colors.subtext }}>
                  {achievementsSummary.totalUnlocked} /{" "}
                  {achievementsSummary.totalAvailable} unlocked
                </Text>
              </View>
            )}

            {achievementsLoading ? (
              <View style={styles.achievementsList}>
                {[1, 2, 3, 4].map((i) => (
                  <AchievementRowSkeleton key={`ach-skel-${i}`} />
                ))}
              </View>
            ) : achievementPreviewItems.length > 0 ? (
              <>
                {/* "Next up" section */}
                {nextUpAchievements.length > 0 && (
                  <View style={styles.nextUpSection}>
                    <Text
                      variant="labelMedium"
                      style={{
                        color: colors.primary,
                        fontWeight: "700",
                        marginBottom: 6,
                      }}
                    >
                      Next Up
                    </Text>
                    {nextUpAchievements.map((item) => (
                      <AchievementItem
                        key={`next-${item.id}`}
                        icon={item.icon}
                        name={item.name}
                        description={`${Math.round(item.progressPct * 100)}% — ${item.progress}/${item.target}`}
                        state={item.state}
                        progressPct={item.progressPct}
                        secret={item.secret}
                        primaryColor={colors.primary}
                        textColor={colors.text}
                        subtextColor={colors.subtext}
                      />
                    ))}
                    <View style={styles.divider} />
                  </View>
                )}

                <View style={styles.achievementsList}>
                  {achievementPreviewItems.map((item) => (
                    <AchievementItem
                      key={item.id}
                      icon={item.icon}
                      name={item.name}
                      description={item.description}
                      state={item.state}
                      progressPct={item.progressPct}
                      secret={item.secret}
                      primaryColor={colors.primary}
                      textColor={colors.text}
                      subtextColor={colors.subtext}
                    />
                  ))}
                </View>
              </>
            ) : (
              <EmptyState
                icon="trophy-broken"
                message="No achievements available for this game yet."
                color={colors.subtext}
              />
            )}

            <Button
              mode="outlined"
              onPress={handleOpenAchievements}
              icon="trophy-outline"
              style={styles.sectionButton}
              accessibilityLabel={`View all achievements for ${game.name}`}
            >
              View All Achievements
            </Button>
          </View>
        )}

        {/* ── Leaderboard Preview ── */}
        {game.hasLeaderboard && (
          <View
            onLayout={(e) => handleSectionLayout("leaderboard", e)}
            style={[styles.section, { backgroundColor: colors.surface }]}
          >
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Leaderboard
            </Text>

            {leaderboardLoading ? (
              <View style={styles.leaderboardList}>
                <View style={styles.leaderboardHeaderRow}>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.leaderboardRankCol,
                      { color: colors.subtext },
                    ]}
                  >
                    #
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.leaderboardNameCol,
                      { color: colors.subtext },
                    ]}
                  >
                    Player
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.leaderboardScoreCol,
                      { color: colors.subtext },
                    ]}
                  >
                    Score
                  </Text>
                </View>
                {[1, 2, 3, 4, 5].map((i) => (
                  <LeaderboardRowSkeleton key={`lb-skel-${i}`} />
                ))}
              </View>
            ) : displayLeaderboardRows.length > 0 ? (
              <View style={styles.leaderboardList}>
                {/* Header row */}
                <View style={styles.leaderboardHeaderRow}>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.leaderboardRankCol,
                      { color: colors.subtext },
                    ]}
                  >
                    #
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.leaderboardNameCol,
                      { color: colors.subtext },
                    ]}
                  >
                    Player
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.leaderboardScoreCol,
                      { color: colors.subtext },
                    ]}
                  >
                    Score
                  </Text>
                </View>
                {displayLeaderboardRows.map((row, i) => {
                  // Insert a divider before the pinned user row if they're not in top N
                  const showDivider =
                    !userIsInTopN &&
                    row.isCurrentUser &&
                    i === displayLeaderboardRows.length - 1;
                  return (
                    <React.Fragment key={`lb-${row.rank}-${i}`}>
                      {showDivider && (
                        <View
                          style={[
                            styles.pinnedDivider,
                            { borderColor: colors.surfaceVariant },
                          ]}
                        >
                          <Text
                            variant="labelSmall"
                            style={{ color: colors.subtext }}
                          >
                            ···
                          </Text>
                        </View>
                      )}
                      <LeaderboardItem
                        row={row}
                        primaryColor={colors.primary}
                        textColor={colors.text}
                        subtextColor={colors.subtext}
                        highlightBg={colors.highlight}
                      />
                    </React.Fragment>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                icon="podium-bronze"
                message="No leaderboard entries yet — play a match to get ranked!"
                color={colors.subtext}
              />
            )}

            <Button
              mode="outlined"
              onPress={handleOpenLeaderboard}
              icon="podium"
              style={styles.sectionButton}
              accessibilityLabel={`Open full leaderboard for ${game.name}`}
            >
              Open Full Leaderboard
            </Button>
          </View>
        )}

        {/* ── Your Stats ── */}
        <View
          onLayout={(e) => handleSectionLayout("stats", e)}
          style={[styles.section, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Your Stats
          </Text>

          {statsLoading ? (
            <View style={styles.statsGrid}>
              {[1, 2, 3, 4].map((i) => (
                <StatTileSkeleton
                  key={`stat-skel-${i}`}
                  bgColor={colors.surfaceVariant}
                />
              ))}
            </View>
          ) : personalBest || highScoreDoc ? (
            <View style={styles.statsGrid}>
              {personalBest && (
                <StatTile
                  label="Personal Best"
                  value={formatScore(typedGameId, personalBest.score)}
                  icon="trophy"
                  primaryColor={colors.primary}
                  bgColor={colors.surfaceVariant}
                  textColor={colors.text}
                  labelColor={colors.subtext}
                />
              )}
              {highScoreDoc && (
                <StatTile
                  label="Games Played"
                  value={String(highScoreDoc.totalGames)}
                  icon="controller-classic"
                  primaryColor={colors.primary}
                  bgColor={colors.surfaceVariant}
                  textColor={colors.text}
                  labelColor={colors.subtext}
                />
              )}
              {personalBest && (
                <StatTile
                  label="Best Achieved"
                  value={formatDate(personalBest.achievedAt)}
                  icon="calendar-check"
                  primaryColor={colors.primary}
                  bgColor={colors.surfaceVariant}
                  textColor={colors.text}
                  labelColor={colors.subtext}
                />
              )}
              {highScoreDoc && (
                <StatTile
                  label="Last Played"
                  value={formatTimeAgo(highScoreDoc.achievedAt)}
                  icon="clock-outline"
                  primaryColor={colors.primary}
                  bgColor={colors.surfaceVariant}
                  textColor={colors.text}
                  labelColor={colors.subtext}
                />
              )}
            </View>
          ) : (
            <EmptyState
              icon="chart-bar"
              message="No stats yet — play a match to see your stats here."
              color={colors.subtext}
            />
          )}
        </View>

        {/* ── Recent History (single-player only) ── */}
        {isSinglePlayer && (
          <View
            onLayout={(e) => handleSectionLayout("history", e)}
            style={[styles.section, { backgroundColor: colors.surface }]}
          >
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Recent Games
            </Text>

            {sessionsLoading ? (
              <View style={styles.historyList}>
                {[1, 2, 3].map((i) => (
                  <View key={`hist-skel-${i}`} style={styles.historyRow}>
                    <Skeleton width={80} height={14} variant="text" />
                    <Skeleton width={50} height={12} variant="text" />
                  </View>
                ))}
              </View>
            ) : recentSessions.length > 0 ? (
              <View style={styles.historyList}>
                {recentSessions.map((s, i) => (
                  <View
                    key={`session-${i}`}
                    style={[
                      styles.historyRow,
                      {
                        borderBottomColor: colors.surfaceVariant,
                        borderBottomWidth:
                          i < recentSessions.length - 1 ? 1 : 0,
                      },
                    ]}
                  >
                    <Text variant="bodyMedium" style={{ color: colors.text }}>
                      {formatGameScore(typedGameId, s.score)}
                    </Text>
                    <Text variant="bodySmall" style={{ color: colors.subtext }}>
                      {formatTimeAgo(s.endedAt)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState
                icon="history"
                message="No recent sessions yet."
                color={colors.subtext}
              />
            )}

            <Button
              mode="text"
              onPress={handleOpenHistory}
              icon="history"
              style={styles.sectionButton}
            >
              View Full History
            </Button>
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  // ── Hero ──
  heroWrapper: {
    zIndex: 10,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  heroExpanded: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  heroTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  heroBackButton: {
    padding: 8,
    marginLeft: -4,
  },
  heroIcon: {
    fontSize: 52,
    marginBottom: 4,
  },
  heroName: {
    fontWeight: "700",
    marginBottom: 2,
  },
  heroTagline: {
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  quickChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  quickChip: {
    height: 30,
  },

  // ── Compact header ──
  compactHeader: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: "100%",
  },
  compactBackButton: {
    padding: 8,
  },
  compactIcon: {
    fontSize: 24,
    marginLeft: 4,
  },
  compactTitle: {
    fontWeight: "700",
    marginLeft: 8,
    flexShrink: 1,
  },
  compactPlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
    marginRight: 4,
  },
  compactPlayText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },

  // ── Tab bar ──
  tabBar: {
    zIndex: 9,
    borderBottomWidth: 1,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    gap: 4,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  // ── Scroll content ──
  scrollContent: {
    paddingBottom: 24,
  },

  // ── Sections ──
  section: {
    padding: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 8,
  },
  sectionButton: {
    marginTop: 12,
  },

  // ── Tags ──
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    height: 28,
  },
  tagChipText: {
    fontSize: 12,
  },
  playButton: {
    minWidth: 160,
    marginTop: 8,
    alignSelf: "center",
  },

  // ── About ──
  howToPlaySection: {
    marginTop: 16,
  },
  howToPlayTitle: {
    fontWeight: "600",
    marginBottom: 8,
  },
  howToPlayRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  howToPlayText: {
    flex: 1,
  },

  // ── Achievements ──
  completionBar: {
    marginBottom: 12,
    gap: 4,
  },
  progressBar: {
    borderRadius: 4,
    height: 6,
  },
  nextUpSection: {
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.15)",
    marginVertical: 8,
  },
  achievementsList: {
    gap: 2,
  },
  achievementRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 12,
    minHeight: 48,
  },
  achievementIcon: {
    fontSize: 28,
    width: 32,
    textAlign: "center",
  },
  achievementInfo: {
    flex: 1,
  },
  achievementProgressBar: {
    borderRadius: 3,
    height: 4,
    marginTop: 4,
  },

  // ── Leaderboard ──
  leaderboardList: {
    marginBottom: 4,
  },
  leaderboardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 42,
  },
  leaderboardRankCol: {
    width: 32,
    textAlign: "center",
  },
  leaderboardNameCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  leaderboardScoreCol: {
    width: 90,
    textAlign: "right",
  },
  pinnedDivider: {
    alignItems: "center",
    paddingVertical: 4,
    borderTopWidth: 1,
    marginTop: 4,
  },

  // ── Stats ──
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statTile: {
    width: "47%",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 90,
  },
  statValue: {
    fontWeight: "700",
    marginBottom: 2,
    textAlign: "center",
  },

  // ── History ──
  historyList: {
    marginBottom: 4,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 40,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 24,
  },
});
