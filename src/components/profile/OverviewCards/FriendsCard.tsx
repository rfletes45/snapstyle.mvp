/**
 * FriendsCard — Compact friends preview for profile overview.
 *
 * Shows up to N avatar circles and a friend count.
 * Taps through to the full friends list (Connections screen).
 *
 * @module components/profile/OverviewCards/FriendsCard
 */

import React, { memo, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { Spacing } from "@/constants/theme";
import { getFriends } from "@/services/friends";
import { getFullProfileData } from "@/services/profileService";
import { useColors } from "@/store/ThemeContext";

import { OverviewCard } from "./OverviewCard";

import { createLogger } from "@/utils/log";
const logger = createLogger("components/profile/OverviewCards/FriendsCard");

// =============================================================================
// Types
// =============================================================================

export interface FriendsCardProps {
  /** User ID to fetch friends for */
  userId: string;
  /** Whether this is the current user's own profile */
  isOwnProfile?: boolean;
  /** Whether friends list is hidden by privacy settings */
  privacyHidden?: boolean;
  /** Whether data is hidden from others (own profile indicator) */
  hiddenFromOthers?: boolean;
  /** Maximum avatars to display */
  maxAvatars?: number;
  /** Callback when card is pressed */
  onPress?: () => void;
  /** Callback when a friend avatar is pressed */
  onFriendPress?: (friendUid: string) => void;
  /** Stagger index for entrance animation */
  enterIndex?: number;
}

interface FriendPreview {
  uid: string;
  displayName: string;
  pictureUrl: string | null;
  decorationId: string | null;
}

// =============================================================================
// Component
// =============================================================================

export const FriendsCard = memo(function FriendsCard({
  userId,
  isOwnProfile,
  privacyHidden,
  hiddenFromOthers,
  maxAvatars = 8,
  onPress,
  onFriendPress,
  enterIndex,
}: FriendsCardProps) {
  const colors = useColors();
  const [friends, setFriends] = useState<FriendPreview[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip querying if privacy-hidden (avoids unnecessary Firestore reads)
    if (privacyHidden) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadFriends() {
      try {
        setLoading(true);
        const friendsList = await getFriends(userId);
        if (cancelled) return;

        setTotalCount(friendsList.length);

        // Fetch preview data for the first N friends
        const previews = await Promise.all(
          friendsList.slice(0, maxAvatars).map(async (friend) => {
            // Derive the other user's UID from the users tuple
            const friendUid =
              friend.users[0] === userId ? friend.users[1] : friend.users[0];
            try {
              const profile = await getFullProfileData(friendUid);
              return {
                uid: friendUid,
                displayName: profile?.displayName || "User",
                pictureUrl: profile?.profilePicture?.url || null,
                decorationId: profile?.avatarDecoration?.decorationId || null,
              };
            } catch {
              return {
                uid: friendUid,
                displayName: "User",
                pictureUrl: null,
                decorationId: null,
              };
            }
          }),
        );

        if (!cancelled) {
          setFriends(previews);
        }
      } catch (err) {
        // Treat permission errors as hidden (graceful degradation)
        logger.debug("Could not load friends (may be permission-denied):", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFriends();
    return () => {
      cancelled = true;
    };
  }, [userId, maxAvatars, privacyHidden]);

  // Empty state
  if (!loading && totalCount === 0 && !privacyHidden) {
    return (
      <OverviewCard
        title="Friends"
        count={0}
        hiddenFromOthers={hiddenFromOthers}
        enterIndex={enterIndex}
        onPress={onPress}
        testID="friends-card"
      >
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {isOwnProfile ? "No friends yet" : "No friends to show"}
        </Text>
      </OverviewCard>
    );
  }

  return (
    <OverviewCard
      title="Friends"
      count={totalCount}
      hiddenFromOthers={hiddenFromOthers}
      privacyHidden={privacyHidden}
      enterIndex={enterIndex}
      onPress={onPress}
      testID="friends-card"
    >
      <View style={styles.avatarRow}>
        {friends.map((friend, i) => (
          <View key={friend.uid} style={styles.avatarWrap}>
            <ProfilePictureWithDecoration
              pictureUrl={friend.pictureUrl}
              decorationId={friend.decorationId}
              name={friend.displayName}
              size={40}
              onPress={
                onFriendPress ? () => onFriendPress(friend.uid) : undefined
              }
            />
          </View>
        ))}
        {totalCount > maxAvatars && (
          <View
            style={[
              styles.moreCircle,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <Text style={[styles.moreText, { color: colors.textSecondary }]}>
              +{totalCount - maxAvatars}
            </Text>
          </View>
        )}
      </View>
    </OverviewCard>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  avatarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    alignItems: "center",
  },
  avatarWrap: {
    // no extra styling; just a container for flex gap
  },
  moreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  moreText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 13,
    paddingVertical: Spacing.xs,
  },
});

export default FriendsCard;
