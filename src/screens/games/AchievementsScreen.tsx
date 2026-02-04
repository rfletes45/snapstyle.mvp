/**
 * AchievementsScreen.tsx
 *
 * Features:
 * - List all achievements by category (new game achievements system)
 * - Show earned vs locked achievements
 * - Display tier-based rewards and progress
 */

import { ErrorState, LoadingState } from "@/components/ui";
import {
  ALL_GAME_ACHIEVEMENTS,
  getAchievementsByCategory as getNewAchievementsByCategory,
} from "@/data/gameAchievements";
import { getUserAchievements } from "@/services/achievements";
import { useAuth } from "@/store/AuthContext";
import {
  AchievementCategory,
  GameAchievementDefinition,
  TIER_COLORS,
} from "@/types/achievements";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import { Achievement } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import {
  Appbar,
  Card,
  Chip,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { BorderRadius, Spacing } from "../../../constants/theme";

type Props = NativeStackScreenProps<any, "Achievements">;

// Category display configuration
const CATEGORY_CONFIG: Record<
  AchievementCategory,
  { title: string; icon: string; order: number }
> = {
  general: { title: "General", icon: "gamepad-variant", order: 1 },
  flappy_snap: { title: "Flappy Snap", icon: "bird", order: 2 },
  bounce_blitz: { title: "Bounce Blitz", icon: "circle-multiple", order: 3 },
  memory_snap: { title: "Memory Snap", icon: "cards", order: 4 },
  snap_2048: { title: "2048", icon: "numeric", order: 5 },
  snap_snake: { title: "Snake", icon: "snake", order: 6 },
  word_snap: { title: "Word Snap", icon: "alphabetical", order: 7 },
  multiplayer: { title: "Multiplayer", icon: "account-group", order: 8 },
  tic_tac_toe: { title: "Tic-Tac-Toe", icon: "grid", order: 9 },
  checkers: { title: "Checkers", icon: "checkerboard", order: 10 },
  chess: { title: "Chess", icon: "chess-queen", order: 11 },
  pool: { title: "8-Ball Pool", icon: "billiards", order: 12 },
  crazy_eights: { title: "Crazy Eights", icon: "cards-playing", order: 13 },
  streak: { title: "Streaks", icon: "fire", order: 14 },
  social: { title: "Social", icon: "account-multiple", order: 15 },
  daily: { title: "Daily", icon: "calendar-today", order: 16 },
  seasonal: { title: "Seasonal", icon: "star", order: 17 },
  casual_games: {
    title: "Casual Games",
    icon: "controller-classic",
    order: 18,
  },
};

interface SectionData {
  title: string;
  icon: string;
  category: AchievementCategory;
  data: (GameAchievementDefinition & { earned?: Achievement })[];
}

export default function AchievementsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;

  // Get optional gameId filter from route params
  const filterGameId = (route.params as any)?.gameId as string | undefined;

  const [userAchievements, setUserAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAchievements = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);
      const achievements = await getUserAchievements(userId);
      setUserAchievements(achievements);
    } catch (err) {
      console.error("Error loading achievements:", err);
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

  // Build sections with earned status using new achievement system
  // Map old achievement types to new IDs for compatibility
  const earnedIds = new Set(userAchievements.map((a) => a.type));
  const earnedMap = new Map(userAchievements.map((a) => [a.type, a]));

  // Get unique categories from all achievements
  const categories = new Set(ALL_GAME_ACHIEVEMENTS.map((a) => a.category));

  // Map game IDs to their achievement categories
  const gameIdToCategoryMap: Record<string, AchievementCategory[]> = {
    // Single player games
    bounce_blitz: ["bounce_blitz"],
    memory_snap: ["memory_snap"],
    snap_2048: ["snap_2048"],
    snap_snake: ["snap_snake"],
    word_snap: ["word_snap"],
    reaction_tap: ["casual_games"],
    timed_tap: ["casual_games"],
    cart_course: ["casual_games"],
    // Multiplayer games
    tic_tac_toe: ["tic_tac_toe", "multiplayer"],
    checkers: ["checkers", "multiplayer"],
    chess: ["chess", "multiplayer"],
    crazy_eights: ["crazy_eights", "multiplayer"],
    "8ball_pool": ["pool", "multiplayer"],
    air_hockey: ["multiplayer"],
  };

  // Determine which categories to show based on filter
  const allowedCategories = filterGameId
    ? new Set([
        ...(gameIdToCategoryMap[filterGameId] || []),
        "general", // Always show general achievements
      ])
    : null; // null means show all

  // Build sections from the new achievement definitions
  const sections: SectionData[] = Array.from(categories)
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

      return {
        title: config.title,
        icon: config.icon,
        category,
        order: config.order,
        data: achievements.map((def) => ({
          ...def,
          earned: earnedMap.get(def.id as any),
        })),
      };
    })
    .filter(
      (section): section is SectionData =>
        section !== null && section.data.length > 0,
    )
    .sort((a, b) => (a as any).order - (b as any).order);

  // Calculate stats using new system - filter by allowed categories if gameId is set
  const filteredAchievements = filterGameId
    ? ALL_GAME_ACHIEVEMENTS.filter(
        (a) => allowedCategories?.has(a.category) ?? true,
      )
    : ALL_GAME_ACHIEVEMENTS;
  const filteredTotal = filteredAchievements.length;
  const filteredEarned = filteredAchievements.filter((a) =>
    earnedIds.has(a.id as any),
  ).length;
  const earnedCount = filteredEarned;
  const totalCount = filteredTotal;
  const completionPercent =
    filteredTotal > 0 ? Math.round((filteredEarned / filteredTotal) * 100) : 0;

  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons
        name={section.icon as any}
        size={20}
        color={theme.colors.onSurfaceVariant}
      />
      <Text
        style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
      >
        {section.title}
      </Text>
    </View>
  );

  const renderAchievement = ({
    item,
  }: {
    item: GameAchievementDefinition & { earned?: Achievement };
  }) => {
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
                style={[
                  styles.rarityChip,
                  { backgroundColor: tierColor + "20" },
                ]}
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
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Card
        style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}
        mode="elevated"
      >
        <Card.Content>
          <View style={styles.summaryRow}>
            <MaterialCommunityIcons name="trophy" size={32} color="#FFD700" />
            <View style={styles.summaryText}>
              <Text
                style={[styles.summaryTitle, { color: theme.colors.onSurface }]}
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
    </View>
  );

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

      {loading && !refreshing ? (
        <LoadingState message="Loading achievements..." />
      ) : error ? (
        <ErrorState
          title="Something went wrong"
          message={error}
          onRetry={loadAchievements}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderAchievement}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor applied inline via theme
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },

  loadingText: {
    marginTop: Spacing.md,
    // color applied inline
  },

  listContent: {
    padding: Spacing.lg,
  },

  headerContainer: {
    marginBottom: Spacing.lg,
  },

  summaryCard: {
    // backgroundColor applied inline via theme
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
    // color applied inline
  },

  summarySubtitle: {
    fontSize: 14,
    // color applied inline
  },

  progressBar: {
    height: 8,
    borderRadius: BorderRadius.xs,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    marginTop: Spacing.sm,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    // color applied inline
  },

  achievementCard: {
    marginBottom: Spacing.sm,
    // backgroundColor applied inline via theme
  },

  lockedCard: {
    // Now handled via inline styles with theme
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
    // color from rarity
  },

  rarityChip: {
    height: 20,
  },

  achievementDesc: {
    fontSize: 13,
    // color applied inline
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
    // Deprecated - handled inline
  },

  earnedDate: {
    fontSize: 11,
    marginTop: Spacing.xs,
    // color based on success
  },

  statusContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
