/**
 * BadgeCollectionScreen
 *
 * Displays all badges - earned, in progress, and locked.
 * Allows featuring/unfeaturing badges.
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 */

import { BadgeCard } from "@/components/badges";
import { BADGE_DEFINITIONS } from "@/data/badges";
import { useBadges } from "@/hooks/useBadges";
import { useAuth } from "@/store/AuthContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/profile/BadgeCollectionScreen");
export default function BadgeCollectionScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { earnedBadges, hasBadge, stats } = useBadges(currentFirebaseUser?.uid);

  const visibleBadges = BADGE_DEFINITIONS.filter((b) => !b.hidden);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Badges" />
      </Appbar.Header>

      {/* Stats Header */}
      <View
        style={[
          styles.statsHeader,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {stats.earned}
          </Text>
          <Text
            style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Earned
          </Text>
        </View>
        <View
          style={[
            styles.statDivider,
            { backgroundColor: theme.colors.outline },
          ]}
        />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
            {stats.total}
          </Text>
          <Text
            style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Total
          </Text>
        </View>
        <View
          style={[
            styles.statDivider,
            { backgroundColor: theme.colors.outline },
          ]}
        />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.secondary }]}>
            {stats.percentage}%
          </Text>
          <Text
            style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Complete
          </Text>
        </View>
      </View>

      {/* Badge Grid */}
      <FlatList
        data={visibleBadges}
        keyExtractor={(item) => item.id}
        numColumns={4}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => {
          const userBadge = earnedBadges.find((b) => b.badgeId === item.id);
          return (
            <View style={styles.badgeWrapper}>
              <BadgeCard
                badge={item}
                userBadge={userBadge}
                mode="compact"
                locked={!hasBadge(item.id)}
                onPress={() => {
                  // NOTE: Open badge detail modal
                  logger.info("Badge:", item.id);
                }}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="medal-outline"
              size={48}
              color={theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No badges available yet
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
  },
  gridContent: {
    padding: 16,
  },
  badgeWrapper: {
    width: "25%",
    padding: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
  },
});
