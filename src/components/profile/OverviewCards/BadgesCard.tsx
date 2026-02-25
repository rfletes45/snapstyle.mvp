/**
 * BadgesCard — Compact badges preview for profile overview.
 *
 * Shows featured badges (or top earned) with a total count.
 * Taps through to the full BadgeCollection screen.
 *
 * @module components/profile/OverviewCards/BadgesCard
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { getBadgeById } from "@/data/badges";
import { useColors } from "@/store/ThemeContext";
import type { UserBadge } from "@/types/profile";

import { OverviewCard } from "./OverviewCard";

// =============================================================================
// Types
// =============================================================================

export interface BadgesCardProps {
  /** Featured or top badges to display */
  badges: UserBadge[];
  /** Total earned badge count */
  totalEarned?: number;
  /** Whether badges are hidden by privacy settings */
  privacyHidden?: boolean;
  /** Whether data is hidden from others (own profile indicator) */
  hiddenFromOthers?: boolean;
  /** Callback when card is pressed */
  onPress?: () => void;
  /** Callback when a specific badge is pressed */
  onBadgePress?: (badge: UserBadge) => void;
  /** Maximum badges to show in preview */
  maxPreview?: number;
  /** Stagger index for entrance animation */
  enterIndex?: number;
}

// =============================================================================
// Component
// =============================================================================

export const BadgesCard = memo(function BadgesCard({
  badges,
  totalEarned,
  privacyHidden,
  hiddenFromOthers,
  onPress,
  onBadgePress,
  maxPreview = 5,
  enterIndex,
}: BadgesCardProps) {
  const colors = useColors();

  const displayBadges = badges.slice(0, maxPreview);
  const count = totalEarned ?? badges.length;

  // Empty state
  if (!privacyHidden && displayBadges.length === 0) {
    return (
      <OverviewCard
        title="Badges"
        count={0}
        hiddenFromOthers={hiddenFromOthers}
        enterIndex={enterIndex}
        onPress={onPress}
        testID="badges-card"
      >
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No badges earned yet
        </Text>
      </OverviewCard>
    );
  }

  return (
    <OverviewCard
      title="Badges"
      count={count}
      hiddenFromOthers={hiddenFromOthers}
      privacyHidden={privacyHidden}
      enterIndex={enterIndex}
      onPress={onPress}
      testID="badges-card"
    >
      <View style={styles.badgeRow}>
        {displayBadges.map((badge) => {
          const def = getBadgeById(badge.badgeId);
          return (
            <View
              key={badge.badgeId}
              style={[
                styles.badgeItem,
                { backgroundColor: colors.surfaceVariant + "40" },
              ]}
            >
              {def?.icon ? (
                <Image
                  source={
                    typeof def.icon === "string" ? { uri: def.icon } : def.icon
                  }
                  style={styles.badgeIcon}
                  resizeMode="contain"
                />
              ) : (
                <MaterialCommunityIcons
                  name="shield-star"
                  size={24}
                  color={colors.primary}
                />
              )}
              {def?.name && (
                <Text
                  style={[styles.badgeName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {def.name}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </OverviewCard>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    alignItems: "center",
  },
  badgeItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    minWidth: 56,
  },
  badgeIcon: {
    width: 28,
    height: 28,
  },
  badgeName: {
    fontSize: FontSizes.xs,
    marginTop: 2,
    maxWidth: 64,
    textAlign: "center",
  },
  emptyText: {
    fontSize: FontSizes.sm,
    paddingVertical: Spacing.xs,
  },
});

export default BadgesCard;
