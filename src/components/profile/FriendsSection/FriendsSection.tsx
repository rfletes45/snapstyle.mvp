/**
 * FriendsSection Component
 *
 * Displays a horizontal scrollable preview of the user's friends list
 * on their profile, with a "See All" button to navigate to the full list.
 *
 * @module components/profile/FriendsSection/FriendsSection
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { Surface, Text, useTheme } from "react-native-paper";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { Spacing } from "@/constants/theme";
import { getFriends } from "@/services/friends";
import { getFullProfileData } from "@/services/profileService";

// =============================================================================
// Types
// =============================================================================

export interface FriendsSectionProps {
  /** Current user ID */
  userId: string;
  /** Maximum friends to show in preview */
  maxDisplay?: number;
  /** Callback when "See All" is pressed */
  onSeeAllPress?: () => void;
  /** Callback when a friend is pressed */
  onFriendPress?: (friendUid: string) => void;
}

interface FriendPreview {
  uid: string;
  displayName: string;
  username: string;
  pictureUrl: string | null;
  decorationId: string | null;
}

// =============================================================================
// Friend Avatar Component
// =============================================================================

const FriendAvatar = memo(function FriendAvatar({
  friend,
  onPress,
  index,
}: {
  friend: FriendPreview;
  onPress?: () => void;
  index: number;
}) {
  const theme = useTheme();

  return (
    <Animated.View entering={FadeInRight.delay(index * 60).springify()}>
      <TouchableOpacity
        onPress={onPress}
        style={styles.friendItem}
        activeOpacity={0.7}
      >
        <ProfilePictureWithDecoration
          pictureUrl={friend.pictureUrl}
          name={friend.displayName}
          size={52}
          decorationId={friend.decorationId}
        />
        <Text
          style={[styles.friendName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {friend.displayName}
        </Text>
        <Text
          style={[
            styles.friendUsername,
            { color: theme.colors.onSurfaceVariant },
          ]}
          numberOfLines={1}
        >
          @{friend.username}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const FriendsSection = memo(function FriendsSection({
  userId,
  maxDisplay = 10,
  onSeeAllPress,
  onFriendPress,
}: FriendsSectionProps) {
  const theme = useTheme();
  const [friends, setFriends] = useState<FriendPreview[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load friends data
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadFriends() {
      setIsLoading(true);
      try {
        const friendships = await getFriends(userId);
        setTotalCount(friendships.length);

        // Get profile data for each friend (limited to maxDisplay)
        const friendPreviews: FriendPreview[] = [];
        const limited = friendships.slice(0, maxDisplay);

        await Promise.all(
          limited.map(async (friendship) => {
            const otherUid = friendship.users.find((u: string) => u !== userId);
            if (!otherUid) return;

            try {
              const profile = await getFullProfileData(otherUid);
              if (profile && !cancelled) {
                friendPreviews.push({
                  uid: otherUid,
                  displayName: profile.displayName || "User",
                  username: profile.username || "",
                  pictureUrl: profile.profilePicture?.url || null,
                  decorationId: profile.avatarDecoration?.decorationId || null,
                });
              }
            } catch {
              // Skip friends whose profile can't be loaded
            }
          }),
        );

        if (!cancelled) {
          setFriends(friendPreviews);
        }
      } catch (error) {
        console.error("Error loading friends:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFriends();
    return () => {
      cancelled = true;
    };
  }, [userId, maxDisplay]);

  const renderFriend = useCallback(
    ({ item, index }: { item: FriendPreview; index: number }) => (
      <FriendAvatar
        friend={item}
        onPress={onFriendPress ? () => onFriendPress(item.uid) : undefined}
        index={index}
      />
    ),
    [onFriendPress],
  );

  // Don't render anything if loading or no friends
  if (isLoading) {
    return null;
  }

  if (friends.length === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="account-group"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            Friends
          </Text>
          <Surface
            style={[
              styles.countBadge,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
            elevation={0}
          >
            <Text
              style={[
                styles.countText,
                { color: theme.colors.onPrimaryContainer },
              ]}
            >
              {totalCount}
            </Text>
          </Surface>
        </View>
        {onSeeAllPress && totalCount > maxDisplay && (
          <TouchableOpacity onPress={onSeeAllPress} style={styles.seeAllButton}>
            <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>
              See All
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={16}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Friends List */}
      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.uid}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </Animated.View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: "600",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    paddingVertical: Spacing.xs,
  },
  separator: {
    width: Spacing.sm,
  },
  friendItem: {
    alignItems: "center",
    width: 72,
  },
  friendName: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
    width: "100%",
  },
  friendUsername: {
    fontSize: 9,
    textAlign: "center",
    width: "100%",
  },
});

export default FriendsSection;
