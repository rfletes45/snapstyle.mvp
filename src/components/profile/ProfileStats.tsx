/**
 * ProfileStats Component
 *
 * Displays user statistics in a grid layout.
 */

import type { ProfileStats as ProfileStatsType } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface ProfileStatsProps {
  /** Statistics data */
  stats: ProfileStatsType;
  /** Show all stats or just primary */
  expanded?: boolean;
}

interface StatItemProps {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
}

const StatItem = memo(function StatItem({
  icon,
  value,
  label,
  color,
}: StatItemProps) {
  const theme = useTheme();

  return (
    <View style={styles.statItem}>
      <MaterialCommunityIcons
        name={icon as any}
        size={24}
        color={color || theme.colors.primary}
      />
      <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>
      <Text
        style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        {label}
      </Text>
    </View>
  );
});

function ProfileStatsBase({ stats, expanded = false }: ProfileStatsProps) {
  const theme = useTheme();

  const primaryStats = [
    { icon: "gamepad-variant", value: stats.gamesPlayed, label: "Games" },
    { icon: "trophy", value: stats.gamesWon, label: "Wins" },
    {
      icon: "fire",
      value: stats.currentStreak,
      label: "Streak",
      color: "#FF6B6B",
    },
    { icon: "account-group", value: stats.friendCount, label: "Friends" },
  ];

  const secondaryStats = [
    { icon: "percent", value: `${stats.winRate}%`, label: "Win Rate" },
    { icon: "medal", value: stats.totalBadges, label: "Badges" },
    { icon: "chart-line", value: stats.highestStreak, label: "Best Streak" },
    { icon: "calendar", value: stats.daysActive, label: "Days Active" },
  ];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.statsGrid,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        {primaryStats.map((stat, index) => (
          <StatItem key={index} {...stat} />
        ))}
      </View>

      {expanded && (
        <View
          style={[
            styles.statsGrid,
            styles.secondaryGrid,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          {secondaryStats.map((stat, index) => (
            <StatItem key={index} {...stat} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 16,
    padding: 8,
  },
  secondaryGrid: {
    marginTop: 12,
  },
  statItem: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

export const ProfileStats = memo(ProfileStatsBase);
export default ProfileStats;
