/**
 * AchievementsScreen.tsx
 *
 * Features:
 * - Tab-based filtering: General, Single Player, Multiplayer, Miscellaneous
 * - Collapsible sections per category
 * - Show earned vs locked achievements
 * - Display tier-based rewards and progress
 * - Game-specific filtering (when accessed from a game context)
 */

import { ErrorState, LoadingState } from "@/components/ui";
import {
  ALL_GAME_ACHIEVEMENTS,
  getAchievementsByCategory as getNewAchievementsByCategory,
} from "@/data/gameAchievements";
import { getUserAchievements } from "@/services/achievements";
import { useAuth } from "@/store/AuthContext";
import type { PlayStackParamList } from "@/types/navigation/root";
import {
  AchievementCategory,
  GameAchievementDefinition,
  TIER_COLORS,
} from "@/types/achievements";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { Achievement } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  Card,
  Chip,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { BorderRadius, Spacing } from "@/constants/theme";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/games/AchievementsScreen");
type Props = NativeStackScreenProps<PlayStackParamList, "Achievements">;

// =============================================================================
// Tab & Category Configuration
// =============================================================================

/** Tab IDs for the achievement screen */
type AchievementTab = "general" | "single_player" | "multiplayer" | "misc";

/** Tab configuration */
const TABS: { id: AchievementTab; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "star-circle" },
  { id: "single_player", label: "Solo", icon: "account" },
  { id: "multiplayer", label: "Multi", icon: "account-group" },
  { id: "misc", label: "Misc", icon: "dots-horizontal-circle" },
];

/** Map each AchievementCategory to a tab */
const CATEGORY_TO_TAB: Record<AchievementCategory, AchievementTab> = {
  // General tab — cross-game, streaks, social
  general: "general",
  social: "general",
  streak: "general",

  // Single player tab
  casual_games: "single_player",
  bounce_blitz: "single_player",
  play_2048: "single_player",
  memory_master: "single_player",
  word_master: "single_player",
  snake_master: "single_player",
  brick_breaker: "single_player",
  tile_slide: "single_player",

  // Multiplayer tab
  multiplayer: "multiplayer",
  chess: "multiplayer",
  checkers: "multiplayer",
  tic_tac_toe: "multiplayer",
  crazy_eights: "multiplayer",
  pool: "multiplayer",

  // Miscellaneous tab
  daily: "misc",
  seasonal: "misc",
};

/** Category display configuration */
const CATEGORY_CONFIG: Record<
  AchievementCategory,
  { title: string; icon: string; order: number }
> = {
  general: { title: "General", icon: "gamepad-variant", order: 1 },
  social: { title: "Social", icon: "account-multiple", order: 2 },
  streak: { title: "Streaks", icon: "fire", order: 3 },
  bounce_blitz: { title: "Bounce Blitz", icon: "circle-multiple", order: 4 },
  memory_master: { title: "Memory", icon: "cards", order: 6 },
  play_2048: { title: "2048", icon: "numeric", order: 7 },
  snake_master: { title: "Snake", icon: "snake", order: 8 },
  word_master: { title: "Word", icon: "alphabetical", order: 9 },
  brick_breaker: { title: "Brick Breaker", icon: "wall", order: 10 },
  tile_slide: { title: "Tile Slide", icon: "view-grid", order: 11 },
  casual_games: {
    title: "Casual Games",
    icon: "controller-classic",
    order: 12,
  },
  multiplayer: { title: "Multiplayer", icon: "account-group", order: 13 },
  chess: { title: "Chess", icon: "chess-queen", order: 14 },
  checkers: { title: "Checkers", icon: "checkerboard", order: 15 },
  tic_tac_toe: { title: "Tic-Tac-Toe", icon: "grid", order: 16 },
  crazy_eights: { title: "Crazy Eights", icon: "cards-playing", order: 17 },
  pool: { title: "8-Ball Pool", icon: "billiards", order: 18 },
  daily: { title: "Daily", icon: "calendar-today", order: 19 },
  seasonal: { title: "Seasonal", icon: "star", order: 20 },
};

/** Map game IDs to their specific achievement categories */
const gameIdToCategoryMap: Record<string, AchievementCategory[]> = {
  bounce_blitz: ["bounce_blitz"],
  memory_master: ["memory_master"],
  play_2048: ["play_2048"],
  snake_master: ["snake_master"],
  word_master: ["word_master"],
  brick_breaker: ["brick_breaker"],
  tile_slide: ["tile_slide"],
  reaction_tap: ["casual_games"],
  timed_tap: ["casual_games"],
  clicker_mine: ["casual_games"],
  helix_drop: ["casual_games"],
  tic_tac_toe: ["tic_tac_toe"],
  checkers: ["checkers"],
  chess: ["chess"],
  crazy_eights: ["crazy_eights"],
  "8ball_pool": ["pool"],
};

// =============================================================================
// Section Data Type
// =============================================================================

interface SectionData {
  title: string;
  icon: string;
  category: AchievementCategory;
  order: number;
  data: (GameAchievementDefinition & { earned?: Achievement })[];
  earnedCount: number;
  totalCount: number;
}

// =============================================================================
// Sub-components
// =============================================================================

/** Collapsible section header */
function CollapsibleSectionHeader({
  section,
  isExpanded,
  onToggle,
}: {
  section: SectionData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.sectionHeader,
        {
          backgroundColor: theme.dark
            ? theme.colors.surfaceVariant
            : theme.colors.elevation.level1,
        },
      ]}
    >
      <View style={styles.sectionHeaderLeft}>
        <MaterialCommunityIcons
          name={section.icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={20}
          color={theme.colors.primary}
        />
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {section.title}
        </Text>
        <Text
          style={[
            styles.sectionCount,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {section.earnedCount}/{section.totalCount}
        </Text>
      </View>
      <MaterialCommunityIcons
        name={isExpanded ? "chevron-up" : "chevron-down"}
        size={24}
        color={theme.colors.onSurfaceVariant}
      />
    </Pressable>
  );
}

/** Single achievement card */
function AchievementCard({
  item,
}: {
  item: GameAchievementDefinition & { earned?: Achievement };
}) {
  const theme = useTheme();
  const isEarned = !!item.earned;
  const tierColor = TIER_COLORS[item.tier];

  return (
    <Card
      style={[
        styles.achievementCard,
        { backgroundColor: theme.colors.surface },
        !isEarned && {
          backgroundColor: theme.colors.surfaceVariant,
          opacity: 0.8,
        },
      ]}
      mode="outlined"
    >
      <Card.Content style={styles.achievementContent}>
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: isEarned ? tierColor + "30" : "#E0E0E0" },
          ]}
        >
          <Text style={{ fontSize: 24 }}>{item.icon}</Text>
        </View>

        {/* Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.achievementName, !isEarned && styles.lockedText]}
            >
              {item.name}
            </Text>
            <Chip
              style={[styles.rarityChip, { backgroundColor: tierColor + "20" }]}
              textStyle={{ color: tierColor, fontSize: 10 }}
            >
              {item.tier.toUpperCase()}
            </Chip>
          </View>

          <Text
            style={[styles.achievementDesc, !isEarned && styles.lockedText]}
          >
            {item.secret && !isEarned ? "???" : item.description}
          </Text>

          {/* Rewards */}
          <View style={styles.rewardsRow}>
            <Text style={styles.rewardText}>
              🪙 {item.coinReward} • ⭐ {item.xpReward} XP
            </Text>
          </View>

          {isEarned && item.earned && (
            <Text style={styles.earnedDate}>
              Earned {formatDate(item.earned.earnedAt)}
            </Text>
          )}
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          {isEarned ? (
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color={theme.colors.primary}
            />
          ) : (
            <MaterialCommunityIcons
              name="lock"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// Main Screen
// =============================================================================

export default function AchievementsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;

  // Get optional gameId filter from route params
  const filterGameId = route.params?.gameId;

  const [userAchievements, setUserAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AchievementTab>("general");
  const [collapsedSections, setCollapsedSections] = useState<
    Set<AchievementCategory>
  >(new Set());

  const loadAchievements = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);
      const achievements = await getUserAchievements(userId);
      setUserAchievements(achievements);
    } catch (err) {
      logger.error("Error loading achievements:", err);
      setError("Couldn't load achievements");
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    loadAchievements().finally(() => setLoading(false));
  }, [loadAchievements]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAchievements();
    setRefreshing(false);
  };

  // Toggle section collapse
  const toggleSection = useCallback((category: AchievementCategory) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Build achievement data
  const earnedIds = useMemo(
    () => new Set(userAchievements.map((a) => a.type)),
    [userAchievements],
  );
  const earnedMap = useMemo(
    () => new Map<string, Achievement>(userAchievements.map((a) => [a.type, a])),
    [userAchievements],
  );

  // Determine which categories to show based on filter
  const allowedCategories = useMemo(() => {
    if (!filterGameId) return null; // null = show all
    // When filtering by game, ONLY show that game's specific categories
    // Do NOT include "general" — the user wants game-specific only
    return new Set(gameIdToCategoryMap[filterGameId] || []);
  }, [filterGameId]);

  // Build all sections
  const allSections = useMemo(() => {
    const categories = new Set(ALL_GAME_ACHIEVEMENTS.map((a) => a.category));
    return Array.from(categories)
      .map((category) => {
        // Skip categories not related to the filtered game
        if (allowedCategories && !allowedCategories.has(category)) {
          return null;
        }

        const config = CATEGORY_CONFIG[category] || {
          title: category,
          icon: "star",
          order: 99,
        };
        const achievements = getNewAchievementsByCategory(category);
        const data = achievements.map((def) => ({
          ...def,
          earned: earnedMap.get(def.id),
        }));

        return {
          title: config.title,
          icon: config.icon,
          category,
          order: config.order,
          data,
          earnedCount: data.filter((d) => !!d.earned).length,
          totalCount: data.length,
        } as SectionData;
      })
      .filter(
        (section): section is SectionData =>
          section !== null && section.data.length > 0,
      )
      .sort((a, b) => a.order - b.order);
  }, [allowedCategories, earnedMap]);

  // Filter sections by active tab (only when not in game-specific mode)
  const visibleSections = useMemo(() => {
    if (filterGameId) return allSections; // Show all matching when game-filtered
    return allSections.filter(
      (section) => CATEGORY_TO_TAB[section.category] === activeTab,
    );
  }, [allSections, activeTab, filterGameId]);

  // Stats for the summary card
  const { earnedCount, totalCount, completionPercent } = useMemo(() => {
    const sections = filterGameId ? allSections : visibleSections;
    const total = sections.reduce((sum, s) => sum + s.totalCount, 0);
    const earned = sections.reduce((sum, s) => sum + s.earnedCount, 0);
    return {
      earnedCount: earned,
      totalCount: total,
      completionPercent: total > 0 ? Math.round((earned / total) * 100) : 0,
    };
  }, [allSections, visibleSections, filterGameId]);

  // Tab-level earned counts for badges
  const tabCounts = useMemo(() => {
    const counts: Record<AchievementTab, { earned: number; total: number }> = {
      general: { earned: 0, total: 0 },
      single_player: { earned: 0, total: 0 },
      multiplayer: { earned: 0, total: 0 },
      misc: { earned: 0, total: 0 },
    };
    for (const section of allSections) {
      const tab = CATEGORY_TO_TAB[section.category];
      counts[tab].earned += section.earnedCount;
      counts[tab].total += section.totalCount;
    }
    return counts;
  }, [allSections]);

  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Please sign in to view achievements</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["bottom"]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title={
            filterGameId && GAME_METADATA[filterGameId as ExtendedGameType]
              ? `${GAME_METADATA[filterGameId as ExtendedGameType].name} Achievements`
              : "Achievements"
          }
        />
      </Appbar.Header>

      {/* Tab bar — hidden in game-specific mode */}
      {!filterGameId && (
        <View
          style={[
            styles.tabBar,
            { borderBottomColor: theme.colors.outlineVariant },
          ]}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <Pressable
                key={tab.id}
                style={[
                  styles.tab,
                  isActive && [
                    styles.activeTab,
                    { borderBottomColor: theme.colors.primary },
                  ],
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <MaterialCommunityIcons
                  name={tab.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={18}
                  color={
                    isActive
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                    },
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {count.total > 0 && (
                  <Text
                    style={[
                      styles.tabCount,
                      {
                        color: isActive
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {count.earned}/{count.total}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {loading && !refreshing ? (
        <LoadingState message="Loading achievements..." />
      ) : error ? (
        <ErrorState
          title="Something went wrong"
          message={error}
          onRetry={loadAchievements}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        >
          {/* Summary Card */}
          <Card
            style={[
              styles.summaryCard,
              { backgroundColor: theme.colors.surface },
            ]}
            mode="elevated"
          >
            <Card.Content>
              <View style={styles.summaryRow}>
                <MaterialCommunityIcons
                  name="trophy"
                  size={32}
                  color="#FFD700"
                />
                <View style={styles.summaryText}>
                  <Text
                    style={[
                      styles.summaryTitle,
                      { color: theme.colors.onSurface },
                    ]}
                  >
                    {earnedCount} / {totalCount} Achievements
                  </Text>
                  <Text
                    style={[
                      styles.summarySubtitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {completionPercent}% Complete
                  </Text>
                </View>
              </View>
              <ProgressBar
                progress={completionPercent / 100}
                color={theme.colors.primary}
                style={styles.progressBar}
              />
            </Card.Content>
          </Card>

          {/* Collapsible Sections */}
          {visibleSections.length === 0 ? (
            <View style={styles.emptySections}>
              <MaterialCommunityIcons
                name="trophy-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.emptyText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                No achievements in this category yet
              </Text>
            </View>
          ) : (
            visibleSections.map((section) => {
              const isExpanded = !collapsedSections.has(section.category);
              return (
                <View key={section.category}>
                  <CollapsibleSectionHeader
                    section={section}
                    isExpanded={isExpanded}
                    onToggle={() => toggleSection(section.category)}
                  />
                  {isExpanded &&
                    section.data.map((item) => (
                      <AchievementCard key={item.id} item={item} />
                    ))}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    paddingVertical: 10,
    gap: 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    // borderBottomColor applied inline
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  tabLabelActive: {
    fontWeight: "700",
  },
  tabCount: {
    fontSize: 10,
    fontWeight: "500",
  },

  // List content
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  // Summary
  summaryCard: {
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  summarySubtitle: {
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    borderRadius: BorderRadius.xs,
  },

  // Section headers (collapsible)
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 4,
  },

  // Achievement cards
  achievementCard: {
    marginBottom: Spacing.sm,
  },
  achievementContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  detailsContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: "600",
  },
  rarityChip: {
    height: 20,
  },
  achievementDesc: {
    fontSize: 13,
  },
  rewardsRow: {
    flexDirection: "row",
    marginTop: Spacing.xs,
  },
  rewardText: {
    fontSize: 11,
    color: "#888",
  },
  lockedText: {
    // Opacity handled at card level
  },
  earnedDate: {
    fontSize: 11,
    marginTop: Spacing.xs,
  },
  statusContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty state
  emptySections: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});
