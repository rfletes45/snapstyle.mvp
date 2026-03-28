/**
 * AchievementsTrophyCaseCard — Profile trophy case preview card.
 *
 * Shows recently earned game achievements + featured achievement chips.
 * Taps through to the ProfileAchievements screen (trophy case),
 * NOT the Games achievements hub.
 *
 * Replaces what was previously GamesAchievementsCard.
 * Matches the OverviewCard pattern used by BadgesCard/FriendsCard.
 *
 * @module components/profile/OverviewCards/AchievementsTrophyCaseCard
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import {
  ACHIEVEMENT_BY_TYPE,
  ACHIEVEMENT_DEFS,
  DIFFICULTY_META,
  type AchievementDifficulty,
} from "@/gamesV4/data/achievementDefinitions";
import {
  deriveFeaturedAchievements,
  subscribeToUserAchievements,
  type ProfileAchievement,
} from "@/services/profileAchievementsService";
import { useColors } from "@/store/ThemeContext";

import { OverviewCard } from "./OverviewCard";

// =============================================================================
// Types
// =============================================================================

export interface AchievementsTrophyCaseCardProps {
  /** User ID whose achievements to display */
  userId: string;
  /** Featured achievement IDs from profile data */
  featuredAchievementIds?: string[];
  /** Whether data is hidden from others (own profile indicator) */
  hiddenFromOthers?: boolean;
  /** Whether this section is privacy-hidden (viewing other user) */
  privacyHidden?: boolean;
  /** Callback when card is pressed — should navigate to ProfileAchievements */
  onPress?: () => void;
  /** Maximum recent achievements to preview */
  maxPreview?: number;
  /** Stagger index for entrance animation */
  enterIndex?: number;
  /** When true, strip card chrome for widget board embedding */
  embedded?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const AchievementsTrophyCaseCard = memo(
  function AchievementsTrophyCaseCard({
    userId,
    featuredAchievementIds = [],
    hiddenFromOthers,
    privacyHidden,
    onPress,
    maxPreview = 4,
    enterIndex,
    embedded,
  }: AchievementsTrophyCaseCardProps) {
    const colors = useColors();

    const [achievements, setAchievements] = useState<ProfileAchievement[]>([]);
    const [ownedTypes, setOwnedTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (!userId) {
        setLoading(false);
        return;
      }
      const unsub = subscribeToUserAchievements(
        userId,
        (data, rawTypes) => {
          setAchievements(data);
          setOwnedTypes(rawTypes);
          setLoading(false);
        },
        featuredAchievementIds,
        () => setLoading(false),
      );
      return unsub;
    }, [userId, featuredAchievementIds]);

    const total = ACHIEVEMENT_DEFS.length;
    const earned = achievements.length;

    // Derive valid featured
    const validFeatured = useMemo(
      () => deriveFeaturedAchievements(featuredAchievementIds, ownedTypes),
      [featuredAchievementIds, ownedTypes],
    );

    // Recent achievements for chips (exclude featured, they show separately)
    const recentNonFeatured = useMemo(() => {
      const featuredSet = new Set(validFeatured);
      return achievements
        .filter((a) => !featuredSet.has(a.id))
        .slice(0, maxPreview);
    }, [achievements, validFeatured, maxPreview]);

    // Empty state
    if (!loading && earned === 0) {
      return (
        <OverviewCard
          title="Achievements"
          count={0}
          hiddenFromOthers={hiddenFromOthers}
          privacyHidden={privacyHidden}
          enterIndex={enterIndex}
          onPress={onPress}
          testID="achievements-trophy-card"
          embedded={embedded}
        >
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Play games to earn achievements!
          </Text>
        </OverviewCard>
      );
    }

    return (
      <OverviewCard
        title="Achievements"
        count={earned}
        hiddenFromOthers={hiddenFromOthers}
        privacyHidden={privacyHidden}
        enterIndex={enterIndex}
        onPress={onPress}
        testID="achievements-trophy-card"
        embedded={embedded}
      >
        {/* Summary line */}
        <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
          {earned} / {total} earned
        </Text>

        {/* Featured achievements (highlighted) */}
        {validFeatured.length > 0 && (
          <View style={styles.featuredRow}>
            {validFeatured.map((achId) => {
              const def = ACHIEVEMENT_BY_TYPE[achId];
              const diffMeta = def
                ? DIFFICULTY_META[def.difficulty as AchievementDifficulty]
                : null;
              return (
                <View
                  key={achId}
                  style={[
                    styles.featuredChip,
                    {
                      backgroundColor:
                        (diffMeta?.color ?? colors.primary) + "20",
                      borderColor: (diffMeta?.color ?? colors.primary) + "50",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="star"
                    size={11}
                    color={colors.primary}
                  />
                  <MaterialCommunityIcons
                    name="trophy"
                    size={12}
                    color={diffMeta?.color ?? colors.primary}
                  />
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: diffMeta?.color ?? colors.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {def?.name ?? achId}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent earned achievement chips */}
        {recentNonFeatured.length > 0 && (
          <View style={styles.chipRow}>
            {recentNonFeatured.map((a) => {
              const def = ACHIEVEMENT_BY_TYPE[a.id];
              const diffMeta = def
                ? DIFFICULTY_META[def.difficulty as AchievementDifficulty]
                : null;
              return (
                <View
                  key={a.id}
                  style={[
                    styles.achievementChip,
                    {
                      backgroundColor:
                        (diffMeta?.color ?? colors.primary) + "20",
                      borderColor: (diffMeta?.color ?? colors.primary) + "40",
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="trophy"
                    size={12}
                    color={diffMeta?.color ?? colors.primary}
                  />
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: diffMeta?.color ?? colors.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {def?.name ?? a.id}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* CTA row */}
        <View style={styles.ctaRow}>
          <Text style={[styles.ctaText, { color: colors.primary }]}>
            View Trophy Case
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color={colors.primary}
          />
        </View>
      </OverviewCard>
    );
  },
);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  emptyText: {
    fontSize: FontSizes.sm,
    textAlign: "center",
    paddingVertical: Spacing.sm,
  },
  summaryText: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.sm,
  },
  featuredRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  featuredChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: 4,
    maxWidth: "48%",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  achievementChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
    maxWidth: "48%",
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 2,
  },
  ctaText: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
});
