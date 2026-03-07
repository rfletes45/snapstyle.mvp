/**
 * ProfileAchievementsScreen — Profile Trophy Case
 *
 * Full-screen route for viewing and managing featured profile achievements.
 *
 * Owner mode:
 * - Shows all owned/unlocked achievements
 * - Allows selecting up to 2 to feature on the profile
 * - Featured state persists immediately on tap
 *
 * Viewer mode:
 * - Shows all visible achievements for another user
 * - Featured achievements visually distinguished
 * - No edit controls
 *
 * @module screens/profile/ProfileAchievementsScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { DIFFICULTY_META } from "@/gamesV4/data/achievementDefinitions";
import {
  deriveFeaturedAchievements,
  MAX_FEATURED_ACHIEVEMENTS,
  sortAchievementsForDisplay,
  subscribeToUserAchievements,
  updateFeaturedAchievements,
  type ProfileAchievement,
} from "@/services/profileAchievementsService";
import { useAuth } from "@/store/AuthContext";
import { useColors } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";

// =============================================================================
// Types
// =============================================================================

type Props = NativeStackScreenProps<MainStackParamList, "ProfileAchievements">;

// =============================================================================
// Component
// =============================================================================

export default function ProfileAchievementsScreen({
  route,
  navigation,
}: Props) {
  const { userId } = route.params;
  const { currentFirebaseUser } = useAuth();
  const isOwner = currentFirebaseUser?.uid === userId;
  const insets = useSafeAreaInsets();
  const colors = useColors();

  // State
  const [achievements, setAchievements] = useState<ProfileAchievement[]>([]);
  const [ownedTypes, setOwnedTypes] = useState<string[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>(
    (route.params as { featuredIds?: string[] }).featuredIds ?? [],
  );
  const [loading, setLoading] = useState(true);

  // Subscribe to achievements
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToUserAchievements(
      userId,
      (data, rawTypes) => {
        setAchievements(data);
        setOwnedTypes(rawTypes);
        setLoading(false);
      },
      featuredIds,
      () => setLoading(false),
    );
    return unsub;
    // Only re-subscribe when userId changes; featuredIds are handled locally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Derive valid featured set (intersection with owned)
  const validFeatured = useMemo(
    () => deriveFeaturedAchievements(featuredIds, ownedTypes),
    [featuredIds, ownedTypes],
  );

  // Re-tag achievements with current featured state
  const displayAchievements = useMemo(() => {
    const featuredSet = new Set(validFeatured);
    const retagged = achievements.map((a) => ({
      ...a,
      isFeatured: featuredSet.has(a.id),
    }));
    return sortAchievementsForDisplay(retagged);
  }, [achievements, validFeatured]);

  // Toggle featured
  const handleToggleFeatured = useCallback(
    async (achId: string) => {
      if (!isOwner) return;

      let next: string[];
      if (validFeatured.includes(achId)) {
        // Unfeature
        next = validFeatured.filter((id) => id !== achId);
      } else {
        if (validFeatured.length >= MAX_FEATURED_ACHIEVEMENTS) {
          // Replace oldest featured
          next = [...validFeatured.slice(1), achId];
        } else {
          next = [...validFeatured, achId];
        }
      }

      setFeaturedIds(next);

      try {
        await updateFeaturedAchievements(userId, next);
      } catch {
        // Revert on error
        setFeaturedIds(validFeatured);
      }
    },
    [isOwner, userId, validFeatured],
  );

  // Render achievement item
  const renderItem = useCallback(
    ({ item }: { item: ProfileAchievement }) => {
      const diffMeta = DIFFICULTY_META[item.difficulty] ?? DIFFICULTY_META.easy;
      const isFeatured = item.isFeatured;

      return (
        <TouchableOpacity
          style={[
            styles.achievementItem,
            {
              backgroundColor: colors.surface,
              borderColor: isFeatured
                ? colors.primary + "60"
                : colors.surfaceVariant + "30",
              borderWidth: isFeatured ? 2 : 1,
            },
          ]}
          activeOpacity={isOwner ? 0.7 : 1}
          onPress={() => isOwner && handleToggleFeatured(item.id)}
          disabled={!isOwner}
          accessibilityLabel={`${item.title}${isFeatured ? ", featured" : ""}`}
        >
          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: diffMeta.color + "20" },
            ]}
          >
            <MaterialCommunityIcons
              name="trophy"
              size={24}
              color={diffMeta.color}
            />
          </View>

          {/* Text content */}
          <View style={styles.textContent}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.achievementTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {isFeatured && (
                <View
                  style={[
                    styles.featuredBadge,
                    { backgroundColor: colors.primary + "15" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="star"
                    size={10}
                    color={colors.primary}
                  />
                  <Text
                    style={[styles.featuredText, { color: colors.primary }]}
                  >
                    Featured
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.achievementDesc, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.difficultyChip,
                  { backgroundColor: diffMeta.color + "15" },
                ]}
              >
                <Text
                  style={[styles.difficultyText, { color: diffMeta.color }]}
                >
                  {diffMeta.label}
                </Text>
              </View>
              <Text
                style={[styles.categoryText, { color: colors.textSecondary }]}
              >
                {item.category}
              </Text>
              {item.unlockedAt && (
                <Text
                  style={[styles.dateText, { color: colors.textSecondary }]}
                >
                  {formatRelativeDate(item.unlockedAt)}
                </Text>
              )}
            </View>
          </View>

          {/* Featured toggle indicator (owner only) */}
          {isOwner && (
            <View style={styles.toggleIndicator}>
              <MaterialCommunityIcons
                name={isFeatured ? "star" : "star-outline"}
                size={22}
                color={
                  isFeatured ? colors.primary : colors.textSecondary + "60"
                }
              />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [colors, isOwner, handleToggleFeatured],
  );

  const keyExtractor = useCallback((item: ProfileAchievement) => item.id, []);

  // Empty state
  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="trophy-outline"
          size={64}
          color={colors.textSecondary + "40"}
        />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
          {isOwner ? "No achievements yet" : "No achievements to show"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {isOwner
            ? "Play games to earn achievements and showcase them here!"
            : "This user hasn\u2019t unlocked any achievements yet."}
        </Text>
      </View>
    ),
    [colors, isOwner],
  );

  // Header
  const ListHeaderComponent = useMemo(() => {
    if (!isOwner || displayAchievements.length === 0) return null;
    const featuredCount = displayAchievements.filter(
      (a) => a.isFeatured,
    ).length;
    return (
      <View style={styles.headerInfo}>
        <Text style={[styles.headerInfoText, { color: colors.textSecondary }]}>
          Tap a{"\u00A0"}
          <MaterialCommunityIcons
            name="star-outline"
            size={14}
            color={colors.textSecondary}
          />{" "}
          to feature up to {MAX_FEATURED_ACHIEVEMENTS} achievements on your
          profile ({featuredCount}/{MAX_FEATURED_ACHIEVEMENTS} selected)
        </Text>
      </View>
    );
  }, [isOwner, displayAchievements, colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <IconButton
          icon="arrow-left"
          onPress={() => navigation.goBack()}
          iconColor={colors.text}
          size={24}
        />
        <Text style={[styles.screenTitle, { color: colors.text }]}>
          {isOwner
            ? "Trophy Case"
            : `${(route.params as { displayName?: string }).displayName ?? "User"}\u2019s Achievements`}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Achievement list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.textSecondary }}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={displayAchievements}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={ListEmptyComponent}
          ListHeaderComponent={ListHeaderComponent}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatRelativeDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(ts).toLocaleDateString();
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
  screenTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  headerInfo: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  headerInfoText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  achievementItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  textContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  achievementTitle: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    flexShrink: 1,
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 2,
  },
  featuredText: {
    fontSize: 10,
    fontWeight: "700",
  },
  achievementDesc: {
    fontSize: FontSizes.sm,
    lineHeight: 18,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  difficultyChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  categoryText: {
    fontSize: 11,
  },
  dateText: {
    fontSize: 11,
  },
  toggleIndicator: {
    marginLeft: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: FontSizes.sm,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
});
