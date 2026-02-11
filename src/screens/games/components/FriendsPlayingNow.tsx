/**
 * FriendsPlayingNow Component
 *
 * Shows friends who are currently playing games.
 * Tapping a friend opens their active game to spectate or join.
 *
 * Layout (per Phase 7 plan):
 * ┌───────────────────────────────────────────────────────────┐
 * │ 🟢 Friends Playing                                        │
 * │ ┌─────────┐ ┌─────────┐ ┌─────────┐                      │
 * │ │  👤     │ │  👤     │ │  👤     │                      │
 * │ │  Alex   │ │  Sam    │ │  Riley  │                      │
 * │ │ ♟️ Chess│ │ 🎱 Pool │ │ 🃏 Cards│                      │
 * │ └─────────┘ └─────────┘ └─────────┘                      │
 * └───────────────────────────────────────────────────────────┘
 *
 * Visual Specs:
 * - Horizontal scroll of friend avatars
 * - Shows game they're playing
 * - Green dot for online/in-game
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 7
 */

import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { ExtendedGameType } from "@/types/games";
import { PLAY_SCREEN_TOKENS } from "@/constants/gamesTheme";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/games/components/FriendsPlayingNow");
// =============================================================================
// Types
// =============================================================================

export interface FriendsPlayingNowProps {
  /** Called when a friend is tapped */
  onFriendPress?: (friendId: string, gameType?: string) => void;
  /** Optional test ID for testing */
  testID?: string;
}

interface FriendPlaying {
  id: string;
  friendId: string;
  name: string;
  avatarColor: string;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
  gameType?: ExtendedGameType;
  gameName?: string;
  gameIcon?: string;
  matchId?: string;
}

// =============================================================================
// Constants
// =============================================================================

const AVATAR_SIZE = 48;
const ITEM_WIDTH = 72;

// =============================================================================
// FriendPlayingItem Component
// =============================================================================

interface FriendPlayingItemProps {
  friend: FriendPlaying;
  onPress: () => void;
}

function FriendPlayingItem({ friend, onPress }: FriendPlayingItemProps) {
  const { colors, isDark } = useAppTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.friendItem}
      >
        {/* Avatar with online indicator */}
        <View style={styles.avatarContainer}>
          <ProfilePictureWithDecoration
            pictureUrl={friend.profilePictureUrl}
            name={friend.name}
            decorationId={friend.decorationId}
            size={44}
          />
          {/* Online/playing indicator */}
          <View
            style={[styles.onlineIndicator, { borderColor: colors.background }]}
          />
        </View>

        {/* Name */}
        <Text
          style={[styles.friendName, { color: colors.text }]}
          numberOfLines={1}
        >
          {friend.name}
        </Text>

        {/* Game badge */}
        {friend.gameIcon && (
          <View
            style={[
              styles.gameBadge,
              {
                backgroundColor: isDark
                  ? colors.surfaceVariant
                  : colors.primaryContainer,
              },
            ]}
          >
            <Text style={styles.gameIconText}>{friend.gameIcon}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// EmptyState Component
// =============================================================================

function EmptyState() {
  const { colors } = useAppTheme();

  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        No friends playing right now
      </Text>
    </View>
  );
}

// =============================================================================
// FriendsPlayingNow Component
// =============================================================================

export function FriendsPlayingNow({
  onFriendPress,
  testID,
}: FriendsPlayingNowProps) {
  const { colors, isDark } = useAppTheme();
  const { currentFirebaseUser } = useAuth();

  const [friendsPlaying, setFriendsPlaying] = useState<FriendPlaying[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch friends and check who's actually playing
  // NOTE: Real in-game presence tracking requires:
  // 1. Game screens to update presence with current game when entering/exiting
  // 2. A real-time subscription to friends' game presence
  // Until that infrastructure is built, we don't show mock data
  useEffect(() => {
    if (!currentFirebaseUser?.uid) {
      setLoading(false);
      return;
    }

    const fetchFriendsPlaying = async () => {
      try {
        // NOTE: Implement real in-game presence tracking
        // This requires:
        // 1. Each game screen to call setGamePresence(gameType) on mount
        //    and clearGamePresence() on unmount
        // 2. A subscription to friends' presence that includes inGame status
        // 3. Query: presence/${friendId}/inGame to check if actively in a game screen
        //
        // For now, return empty to avoid showing incorrect "friends playing" data

        // Don't show mock data - only show real data when we have it
        setFriendsPlaying([]);
      } catch (error) {
        logger.error("[FriendsPlayingNow] Error fetching friends:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFriendsPlaying();
  }, [currentFirebaseUser?.uid]);

  const handleFriendPress = useCallback(
    (friend: FriendPlaying) => {
      onFriendPress?.(friend.friendId, friend.gameType);
    },
    [onFriendPress],
  );

  const renderItem = useCallback(
    ({ item }: { item: FriendPlaying }) => (
      <FriendPlayingItem
        friend={item}
        onPress={() => handleFriendPress(item)}
      />
    ),
    [handleFriendPress],
  );

  const keyExtractor = useCallback((item: FriendPlaying) => item.id, []);

  // Don't show during initial load
  if (loading) {
    return null;
  }

  // Don't show if no friends playing
  if (friendsPlaying.length === 0) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: isDark ? colors.border : "transparent",
          ...PLAY_SCREEN_TOKENS.shadows.card,
        },
      ]}
      testID={testID}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.pulsingDot} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Friends Playing
          </Text>
        </View>
        <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
          {friendsPlaying.length} online
        </Text>
      </View>

      {/* Friends List */}
      <FlatList
        data={friendsPlaying}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={EmptyState}
      />
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: PLAY_SCREEN_TOKENS.spacing.horizontalPadding,
    marginTop: 12,
    borderRadius: PLAY_SCREEN_TOKENS.borderRadius.cardLarge,
    borderWidth: 1,
    paddingVertical: 12,
    // overflow: visible so avatar decorations can bleed outside the card
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerCount: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  friendItem: {
    width: ITEM_WIDTH,
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 6,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
  },
  friendName: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 4,
  },
  gameBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gameIconText: {
    fontSize: 12,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: "italic",
  },
});
