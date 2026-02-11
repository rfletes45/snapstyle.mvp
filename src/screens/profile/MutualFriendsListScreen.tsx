/**
 * MutualFriendsListScreen
 *
 * Full-screen list of mutual friends between current user and another user.
 * Features search, filtering, and navigation to individual profiles.
 *
 * @module screens/profile/MutualFriendsListScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Divider,
  IconButton,
  Searchbar,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, { FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar from "@/components/Avatar";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { BorderRadius, Spacing } from "@/constants/theme";
import { getMutualFriends } from "@/services/profileService";
import { useAuth } from "@/store/AuthContext";
import type { MutualFriendInfo } from "@/types/userProfile";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/profile/MutualFriendsListScreen");
// =============================================================================
// Types
// =============================================================================

type MutualFriendsListScreenProps = NativeStackScreenProps<
  any,
  "MutualFriendsList"
>;

// =============================================================================
// Friend Item Component
// =============================================================================

interface FriendItemProps {
  friend: MutualFriendInfo;
  onPress: () => void;
  index: number;
}

function FriendItem({ friend, onPress, index }: FriendItemProps) {
  const theme = useTheme();
  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
  };

  return (
    <Animated.View entering={FadeInRight.delay(index * 50).duration(200)}>
      <TouchableOpacity
        style={styles.friendItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {friend.profilePictureUrl ? (
          <ProfilePictureWithDecoration
            pictureUrl={friend.profilePictureUrl}
            name={friend.displayName}
            decorationId={null}
            size={48}
          />
        ) : (
          <Avatar config={friend.avatarConfig} size={48} />
        )}
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]}>
            {friend.displayName}
          </Text>
          <Text
            style={[styles.friendUsername, { color: colors.textSecondary }]}
          >
            @{friend.username}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function MutualFriendsListScreen({
  route,
  navigation,
}: MutualFriendsListScreenProps) {
  const { userId, targetUserId } = route.params as {
    userId: string;
    targetUserId: string;
  };

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();

  const colors = {
    background: theme.colors.background,
    surface: theme.colors.surface,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    primary: theme.colors.primary,
    error: theme.colors.error,
  };

  // State
  const [friends, setFriends] = useState<MutualFriendInfo[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<MutualFriendInfo[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Load mutual friends
  useEffect(() => {
    const loadFriends = async () => {
      setLoading(true);
      setError(null);

      try {
        const currentUserId = currentFirebaseUser?.uid || userId;
        const mutualFriends = await getMutualFriends(
          currentUserId,
          targetUserId,
        );
        setFriends(mutualFriends);
        setFilteredFriends(mutualFriends);
      } catch (err) {
        logger.error("Error loading mutual friends:", err);
        setError("Failed to load mutual friends");
      } finally {
        setLoading(false);
      }
    };

    loadFriends();
  }, [userId, targetUserId, currentFirebaseUser?.uid]);

  // Filter friends by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = friends.filter(
      (friend) =>
        friend.displayName.toLowerCase().includes(query) ||
        friend.username.toLowerCase().includes(query),
    );
    setFilteredFriends(filtered);
  }, [searchQuery, friends]);

  // Handlers
  const handleFriendPress = useCallback(
    (friendUserId: string) => {
      navigation.push("UserProfile", { userId: friendUserId });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: MutualFriendInfo; index: number }) => (
      <FriendItem
        friend={item}
        onPress={() => handleFriendPress(item.userId)}
        index={index}
      />
    ),
    [handleFriendPress],
  );

  const keyExtractor = useCallback((item: MutualFriendInfo) => item.userId, []);

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name={searchQuery ? "account-search" : "account-group"}
          size={64}
          color={colors.textSecondary}
        />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {searchQuery ? "No Results" : "No Mutual Friends"}
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {searchQuery
            ? `No friends match "${searchQuery}"`
            : "You don't have any friends in common yet"}
        </Text>
      </View>
    );
  };

  const renderSeparator = () => <Divider />;

  // Loading state
  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleMedium" style={{ color: colors.text }}>
            Mutual Friends
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <View style={styles.header}>
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
          <Text variant="titleMedium" style={{ color: colors.text }}>
            Mutual Friends
          </Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={48}
            color={colors.error}
          />
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} />
        <Text variant="titleMedium" style={{ color: colors.text }}>
          Mutual Friends ({friends.length})
        </Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Search Bar */}
      {friends.length > 5 && (
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search friends..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchBar, { backgroundColor: colors.surface }]}
          />
        </View>
      )}

      {/* Friends List */}
      <FlatList
        data={filteredFriends}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={renderEmpty}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchBar: {
    elevation: 0,
    borderRadius: BorderRadius.md,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
    flexGrow: 1,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: "500",
  },
  friendUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
