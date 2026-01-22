/**
 * AchievementsScreen.tsx
 * Phase 17: Display user achievements with progress
 *
 * Features:
 * - List all achievements by category
 * - Show earned vs locked achievements
 * - Display rarity and progress
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Card,
  Chip,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";
import {
  getUserAchievements,
  ACHIEVEMENT_DEFINITIONS,
  getAchievementsByCategory,
  getRarityColor,
  getCompletionPercentage,
  getTotalAchievementCount,
} from "@/services/achievements";
import {
  Achievement,
  AchievementDefinition,
  AchievementType,
} from "@/types/models";
import { LoadingState, ErrorState } from "@/components/ui";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import { Spacing, BorderRadius } from "../../../constants/theme";

type Props = NativeStackScreenProps<any, "Achievements">;

interface SectionData {
  title: string;
  icon: string;
  data: (AchievementDefinition & { earned?: Achievement })[];
}

export default function AchievementsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const userId = currentFirebaseUser?.uid;

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

  // Build sections with earned status
  const earnedTypes = new Set(userAchievements.map((a) => a.type));
  const earnedMap = new Map(userAchievements.map((a) => [a.type, a]));

  const sections: SectionData[] = [
    {
      title: "Games",
      icon: "gamepad-variant",
      data: getAchievementsByCategory("game").map((def) => ({
        ...def,
        earned: earnedMap.get(def.type),
      })),
    },
    {
      title: "Streaks",
      icon: "fire",
      data: getAchievementsByCategory("streak").map((def) => ({
        ...def,
        earned: earnedMap.get(def.type),
      })),
    },
    {
      title: "Social",
      icon: "account-group",
      data: getAchievementsByCategory("social").map((def) => ({
        ...def,
        earned: earnedMap.get(def.type),
      })),
    },
    {
      title: "Collection",
      icon: "palette",
      data: getAchievementsByCategory("collection").map((def) => ({
        ...def,
        earned: earnedMap.get(def.type),
      })),
    },
  ];

  const earnedCount = userAchievements.length;
  const totalCount = getTotalAchievementCount();
  const completionPercent = getCompletionPercentage(earnedCount);

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
    item: AchievementDefinition & { earned?: Achievement };
  }) => {
    const isEarned = !!item.earned;
    const rarityColor = getRarityColor(item.rarity);

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
              { backgroundColor: isEarned ? rarityColor + "30" : "#E0E0E0" },
            ]}
          >
            <MaterialCommunityIcons
              name={item.icon as any}
              size={28}
              color={isEarned ? rarityColor : "#9E9E9E"}
            />
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
                  { backgroundColor: rarityColor + "20" },
                ]}
                textStyle={{ color: rarityColor, fontSize: 10 }}
              >
                {item.rarity.toUpperCase()}
              </Chip>
            </View>

            <Text
              style={[styles.achievementDesc, !isEarned && styles.lockedText]}
            >
              {item.description}
            </Text>

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
        <Appbar.Content title="Achievements" />
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
          keyExtractor={(item) => item.type}
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
