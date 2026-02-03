/**
 * BadgeShowcase Component
 *
 * Displays featured badges in a horizontal row on the profile.
 * Shows up to 5 badges with "View All" option.
 */

import { getBadgeById } from "@/data/badges";
import type { UserBadge } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { BadgeCard } from "./BadgeCard";

export interface BadgeShowcaseProps {
  /** User's featured badges */
  badges: UserBadge[];
  /** Maximum badges to display */
  maxDisplay?: number;
  /** Handler when a badge is pressed */
  onBadgePress?: (badge: UserBadge) => void;
  /** Handler for "View All" press */
  onViewAll?: () => void;
  /** Show section header */
  showHeader?: boolean;
  /** Title for the section */
  title?: string;
}

function BadgeShowcaseBase({
  badges,
  maxDisplay = 5,
  onBadgePress,
  onViewAll,
  showHeader = true,
  title = "Featured Badges",
}: BadgeShowcaseProps) {
  const theme = useTheme();

  const displayBadges = badges.slice(0, maxDisplay);

  if (displayBadges.length === 0) {
    return (
      <View style={styles.container}>
        {showHeader && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.emptyContainer,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <MaterialCommunityIcons
            name="medal-outline"
            size={32}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            No featured badges yet
          </Text>
          {onViewAll && (
            <TouchableOpacity onPress={onViewAll}>
              <Text style={[styles.emptyLink, { color: theme.colors.primary }]}>
                View all badges
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          {onViewAll && (
            <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
              <Text
                style={[styles.viewAllText, { color: theme.colors.primary }]}
              >
                View All
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayBadges.map((userBadge) => {
          const badge = getBadgeById(userBadge.badgeId);
          if (!badge) return null;

          return (
            <BadgeCard
              key={userBadge.badgeId}
              badge={badge}
              userBadge={userBadge}
              mode="standard"
              showFeatured={false}
              onPress={() => onBadgePress?.(userBadge)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  emptyContainer: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyLink: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
  },
});

export const BadgeShowcase = memo(BadgeShowcaseBase);
export default BadgeShowcase;
