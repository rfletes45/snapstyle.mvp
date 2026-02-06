/**
 * ActivityFeedItem Component
 *
 * Renders a single activity event in the friends activity feed.
 * Shows avatar, activity description, timestamp, and optional like button.
 *
 * @module components/activity/ActivityFeedItem
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import Avatar from "@/components/Avatar";
import { Spacing } from "@/constants/theme";
import { formatTimeAgo } from "@/services/activityFeed";
import {
  ACTIVITY_DISPLAY_CONFIG,
  type AchievementData,
  type ActivityEvent,
  type GameScoreData,
  type GameWinData,
  type LevelUpData,
  type NewFriendData,
  type StatusChangeData,
  type StreakMilestoneData,
} from "@/types/activityFeed";

// =============================================================================
// Props
// =============================================================================

interface ActivityFeedItemProps {
  event: ActivityEvent;
  onPress?: (event: ActivityEvent) => void;
  onUserPress?: (userId: string) => void;
  onLikePress?: (eventId: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export const ActivityFeedItem: React.FC<ActivityFeedItemProps> = React.memo(
  ({ event, onPress, onUserPress, onLikePress }) => {
    const theme = useTheme();
    const config = ACTIVITY_DISPLAY_CONFIG[event.type];

    const handlePress = useCallback(() => {
      onPress?.(event);
    }, [event, onPress]);

    const handleUserPress = useCallback(() => {
      onUserPress?.(event.userId);
    }, [event.userId, onUserPress]);

    const handleLikePress = useCallback(() => {
      onLikePress?.(event.id);
    }, [event.id, onLikePress]);

    /**
     * Build the activity description text based on event type
     */
    const getDescription = (): string => {
      const name = event.displayName || event.username || "Someone";

      switch (event.data.type) {
        case "game_score": {
          const d = event.data as GameScoreData;
          if (d.isPersonalBest) {
            return `${name} set a new personal best in ${d.gameName}: ${d.formattedScore}! 🎉`;
          }
          return `${name} scored ${d.formattedScore} in ${d.gameName}`;
        }
        case "game_win": {
          const d = event.data as GameWinData;
          const streak =
            d.winStreak && d.winStreak > 1
              ? ` (${d.winStreak} win streak! 🔥)`
              : "";
          return `${name} beat ${d.opponentName} in ${d.gameName}${streak}`;
        }
        case "achievement": {
          const d = event.data as AchievementData;
          const rarityLabel = d.rarity ? ` [${d.rarity}]` : "";
          return `${name} earned "${d.achievementName}"${rarityLabel} — ${d.description}`;
        }
        case "level_up": {
          const d = event.data as LevelUpData;
          return `${name} reached Level ${d.newLevel}!`;
        }
        case "streak_milestone": {
          const d = event.data as StreakMilestoneData;
          return `${name} and ${d.friendName} have a ${d.streakDays}-day streak!`;
        }
        case "profile_update":
          return `${name} updated their profile`;
        case "new_friend": {
          const d = event.data as NewFriendData;
          return `${name} and ${d.friendName} are now friends`;
        }
        case "status_change": {
          const d = event.data as StatusChangeData;
          return `${name} ${d.emoji} "${d.text}"`;
        }
        case "decoration_equip":
          return `${name} equipped a new decoration`;
        case "shop_purchase":
          return `${name} got something new from the shop`;
        default:
          return `${name} did something`;
      }
    };

    return (
      <TouchableOpacity
        style={[styles.container, { backgroundColor: theme.colors.surface }]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityLabel={getDescription()}
        accessibilityRole="button"
      >
        {/* Activity type indicator */}
        <View
          style={[
            styles.typeIndicator,
            { backgroundColor: config.color + "20" },
          ]}
        >
          <Text style={styles.typeEmoji}>{config.emoji}</Text>
        </View>

        {/* Avatar */}
        <TouchableOpacity onPress={handleUserPress} activeOpacity={0.8}>
          <Avatar
            config={{ baseColor: event.avatarConfig?.baseColor || "#7C3AED" }}
            size={44}
          />
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          <Text
            style={[styles.description, { color: theme.colors.onSurface }]}
            numberOfLines={3}
          >
            <Text
              style={[styles.userName, { color: theme.colors.primary }]}
              onPress={handleUserPress}
            >
              {event.displayName || event.username || "Someone"}
            </Text>
            {"  "}
            {getDescription().replace(
              event.displayName || event.username || "Someone",
              "",
            )}
          </Text>

          <View style={styles.metaRow}>
            <Text
              style={[
                styles.timestamp,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {formatTimeAgo(event.timestamp)}
            </Text>

            {/* Like button */}
            <TouchableOpacity
              style={styles.likeButton}
              onPress={handleLikePress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={
                event.liked ? "Unlike this activity" : "Like this activity"
              }
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name={event.liked ? "heart" : "heart-outline"}
                size={16}
                color={
                  event.liked
                    ? theme.colors.error
                    : theme.colors.onSurfaceVariant
                }
              />
              {(event.likeCount || 0) > 0 && (
                <Text
                  style={[
                    styles.likeCount,
                    {
                      color: event.liked
                        ? theme.colors.error
                        : theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {event.likeCount}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

ActivityFeedItem.displayName = "ActivityFeedItem";

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: 12,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: "flex-start",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  typeIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: Spacing.md,
    left: Spacing.md,
    zIndex: 1,
  },
  typeEmoji: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  userName: {
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  timestamp: {
    fontSize: 12,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export default ActivityFeedItem;
