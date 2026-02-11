/**
 * ActivityFeedScreen
 *
 * Displays a timeline of friends' recent activity.
 * Shows game scores, achievements, level ups, new friendships, and more.
 *
 * Features:
 * - Pull-to-refresh
 * - Infinite scroll pagination
 * - Activity type filtering
 * - Tap to navigate to user profile
 * - Like/react to activities
 * - Empty state for new users
 *
 * @module screens/social/ActivityFeedScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ActivityFeedItem from "@/components/activity/ActivityFeedItem";
import { EmptyState } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { fetchActivityFeed } from "@/services/activityFeed";
import { useAuth } from "@/store/AuthContext";
import type { ActivityEvent, ActivityEventType } from "@/types/activityFeed";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/social/ActivityFeedScreen");
// =============================================================================
// Types
// =============================================================================

interface ActivityFeedScreenProps {
  navigation: any;
}

type FilterType = "all" | ActivityEventType;

interface FilterOption {
  id: FilterType;
  label: string;
  emoji: string;
}

// =============================================================================
// Constants
// =============================================================================

const FILTER_OPTIONS: FilterOption[] = [
  { id: "all", label: "All", emoji: "📋" },
  { id: "game_score", label: "Scores", emoji: "🎮" },
  { id: "game_win", label: "Wins", emoji: "🏆" },
  { id: "achievement", label: "Achievements", emoji: "🏅" },
  { id: "level_up", label: "Level Ups", emoji: "⬆️" },
  { id: "streak_milestone", label: "Streaks", emoji: "🔥" },
  { id: "new_friend", label: "Friendships", emoji: "🤝" },
];

const PAGE_SIZE = 20;

// =============================================================================
// Component
// =============================================================================

export default function ActivityFeedScreen({
  navigation,
}: ActivityFeedScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  // State
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  const loadFeed = useCallback(
    async (isRefresh = false) => {
      if (!uid) return;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const feedEvents = await fetchActivityFeed(uid, PAGE_SIZE);
        setEvents(feedEvents);
        setHasMore(feedEvents.length >= PAGE_SIZE);
      } catch (error) {
        logger.error("[ActivityFeed] Error loading feed:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [uid],
  );

  const loadMore = useCallback(async () => {
    if (!uid || loadingMore || !hasMore || events.length === 0) return;

    setLoadingMore(true);
    try {
      const lastEvent = events[events.length - 1];
      const moreEvents = await fetchActivityFeed(
        uid,
        PAGE_SIZE,
        lastEvent.timestamp,
      );

      if (moreEvents.length < PAGE_SIZE) {
        setHasMore(false);
      }

      setEvents((prev) => [...prev, ...moreEvents]);
    } catch (error) {
      logger.error("[ActivityFeed] Error loading more:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [uid, loadingMore, hasMore, events]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // ==========================================================================
  // Filtered Events
  // ==========================================================================

  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return events;
    return events.filter((e) => e.type === activeFilter);
  }, [events, activeFilter]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleRefresh = useCallback(() => {
    loadFeed(true);
  }, [loadFeed]);

  const handleEventPress = useCallback(
    (event: ActivityEvent) => {
      // Navigate based on event type
      switch (event.type) {
        case "game_score":
        case "game_win":
          navigation.navigate("MainTabs", {
            screen: "Play",
            params: { screen: "GamesHub" },
          });
          break;
        case "achievement":
          navigation.navigate("UserProfile", { userId: event.userId });
          break;
        default:
          navigation.navigate("UserProfile", { userId: event.userId });
          break;
      }
    },
    [navigation],
  );

  const handleUserPress = useCallback(
    (userId: string) => {
      navigation.navigate("UserProfile", { userId });
    },
    [navigation],
  );

  const handleLikePress = useCallback((eventId: string) => {
    // Optimistic update
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              liked: !e.liked,
              likeCount: e.liked
                ? (e.likeCount || 1) - 1
                : (e.likeCount || 0) + 1,
            }
          : e,
      ),
    );
    // NOTE: Persist like to Firestore
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  const renderItem = useCallback(
    ({ item }: { item: ActivityEvent }) => (
      <ActivityFeedItem
        event={item}
        onPress={handleEventPress}
        onUserPress={handleUserPress}
        onLikePress={handleLikePress}
      />
    ),
    [handleEventPress, handleUserPress, handleLikePress],
  );

  const renderFilterBar = () => (
    <View style={styles.filterBar}>
      <FlatList
        horizontal
        data={FILTER_OPTIONS}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        renderItem={({ item }) => (
          <Chip
            mode={activeFilter === item.id ? "flat" : "outlined"}
            selected={activeFilter === item.id}
            onPress={() => setActiveFilter(item.id)}
            style={[
              styles.filterChip,
              activeFilter === item.id && {
                backgroundColor: theme.colors.primaryContainer,
              },
            ]}
            textStyle={[
              styles.filterChipText,
              activeFilter === item.id && {
                color: theme.colors.onPrimaryContainer,
              },
            ]}
          >
            {item.emoji} {item.label}
          </Chip>
        )}
      />
    </View>
  );

  const renderHeader = () => (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + Spacing.sm,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.onSurface}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Activity Feed
        </Text>
        <View style={{ width: 24 }} />
      </View>
      {renderFilterBar()}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <Text
          style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}
        >
          Loading more...
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {renderHeader()}

      <FlatList
        data={filteredEvents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="account-group-outline"
              title="No activity yet"
              subtitle="When your friends play games, earn achievements, or update their profiles, you'll see it here!"
            />
          )
        }
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  filterBar: {
    paddingVertical: Spacing.xs,
  },
  filterContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  filterChip: {
    height: 32,
  },
  filterChipText: {
    fontSize: 13,
  },
  listContent: {
    paddingTop: Spacing.md,
  },
  footer: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
  },
});
