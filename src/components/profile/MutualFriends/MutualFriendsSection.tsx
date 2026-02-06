/**
 * MutualFriendsSection Component
 *
 * Displays a horizontal scroll of mutual friends on a user's profile.
 * Shows avatars with names and navigates to their profile on tap.
 *
 * @module components/profile/MutualFriends/MutualFriendsSection
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, { FadeInRight } from "react-native-reanimated";

import Avatar from "@/components/Avatar";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { Spacing } from "@/constants/theme";
import type { MutualFriendInfo } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface MutualFriendsSectionProps {
  /** Array of mutual friends to display */
  friends: MutualFriendInfo[];
  /** Called when a friend is pressed */
  onFriendPress: (userId: string) => void;
  /** Called when "See All" is pressed */
  onSeeAllPress?: () => void;
  /** Maximum number of friends to show (default: 6) */
  maxDisplay?: number;
  /** Custom container style */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

// =============================================================================
// Component
// =============================================================================

function MutualFriendsSectionBase({
  friends,
  onFriendPress,
  onSeeAllPress,
  maxDisplay = 6,
  style,
  testID,
}: MutualFriendsSectionProps) {
  const theme = useTheme();

  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    primary: theme.colors.primary,
  };

  if (friends.length === 0) {
    return null;
  }

  const displayFriends = friends.slice(0, maxDisplay);
  const remainingCount = friends.length - maxDisplay;

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="account-group"
            size={18}
            color={colors.textSecondary}
          />
          <Text style={[styles.title, { color: colors.textSecondary }]}>
            Mutual Friends ({friends.length})
          </Text>
        </View>
        {onSeeAllPress && friends.length > maxDisplay && (
          <TouchableOpacity onPress={onSeeAllPress}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>
              See All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Friends Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayFriends.map((friend, index) => (
          <Animated.View
            key={friend.userId}
            entering={FadeInRight.delay(index * 50).duration(300)}
          >
            <TouchableOpacity
              style={styles.friendItem}
              onPress={() => onFriendPress(friend.userId)}
              activeOpacity={0.7}
            >
              {friend.profilePictureUrl ? (
                <ProfilePictureWithDecoration
                  pictureUrl={friend.profilePictureUrl}
                  name={friend.displayName}
                  decorationId={null}
                  size={56}
                />
              ) : (
                <Avatar config={friend.avatarConfig} size={56} />
              )}
              <Text
                style={[styles.friendName, { color: colors.text }]}
                numberOfLines={1}
              >
                {friend.displayName}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}

        {/* "More" indicator */}
        {remainingCount > 0 && (
          <Animated.View entering={FadeInRight.delay(maxDisplay * 50)}>
            <TouchableOpacity
              style={[
                styles.moreItem,
                { backgroundColor: colors.surfaceVariant },
              ]}
              onPress={onSeeAllPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.moreCount, { color: colors.primary }]}>
                +{remainingCount}
              </Text>
              <Text style={[styles.moreLabel, { color: colors.textSecondary }]}>
                more
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
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
    gap: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "500",
  },
  scrollContent: {
    paddingRight: Spacing.md,
  },
  friendItem: {
    alignItems: "center",
    marginRight: Spacing.md,
    width: 72,
  },
  friendName: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
    width: "100%",
  },
  moreItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  moreCount: {
    fontSize: 16,
    fontWeight: "700",
  },
  moreLabel: {
    fontSize: 10,
  },
});

export const MutualFriendsSection = memo(MutualFriendsSectionBase);
export default MutualFriendsSection;
