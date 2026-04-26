/**
 * UserProfileHeader Component
 *
 * Read-only profile header for viewing other users' profiles.
 * Displays profile picture with decoration, name, username, bio, and status.
 * Shows friendship info if users are friends.
 *
 * @module components/profile/ProfileHeader/UserProfileHeader
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Text } from "react-native-paper";

import { CosmeticImage } from "@/components/CosmeticImage";
import { LevelProgress } from "@/components/profile/LevelProgress";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { getCosmeticAsset } from "@/cosmetics/assetRegistry";
import type { CosmeticImageSource } from "@/cosmetics/types";
import { useColors } from "@/store/ThemeContext";
import type { LevelInfo } from "@/types/profile";
import type {
  FriendshipDetails,
  ProfileBio,
  ProfileStatus,
} from "@/types/userProfile";
import { MOOD_CONFIG } from "@/types/userProfile";

const PROFILE_IMAGE_STATUS_SURFACE = "rgba(0,0,0,0.62)";
const PROFILE_IMAGE_CARD_SURFACE = "rgba(0,0,0,0.58)";
const PROFILE_IMAGE_LEVEL_SURFACE = "rgba(0,0,0,0.64)";

// =============================================================================
// Types
// =============================================================================

export interface UserProfileHeaderProps {
  /** User's display name */
  displayName: string;
  /** Username (without @ prefix) */
  username: string;
  /** Profile picture URL (null for default) */
  pictureUrl: string | null;
  /** Equipped decoration ID (null if none) */
  decorationId: string | null;
  /** Equipped background ID (null if none) */
  backgroundId?: string | null;
  /** User's bio (may be hidden by privacy settings) */
  bio?: ProfileBio | null;
  /** User's current status (may be hidden by privacy settings) */
  status?: ProfileStatus | null;
  /** Last active timestamp (may be hidden by privacy settings) */
  lastActive?: number | null;
  /** User's level and XP progress */
  level?: LevelInfo | null;
  /** Friendship details (if friends) */
  friendshipDetails?: FriendshipDetails | null;
  /** Top safe-area inset so the background image extends behind the status bar / dynamic island */
  topInset?: number;
  /** Handler for picture press (e.g., to view full size) */
  onPicturePress?: () => void;
  /** Custom container style */
  style?: ViewStyle;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatLastActive(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Active now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  if (hours < 24) return `Active ${hours}h ago`;
  if (days === 1) return "Active yesterday";
  if (days < 7) return `Active ${days}d ago`;
  return "Active recently";
}

function formatFriendshipDuration(since: number): string {
  const now = Date.now();
  const diff = now - since;
  const days = Math.floor(diff / 86400000);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    const remainingMonths = Math.floor((days % 365) / 30);
    if (remainingMonths > 0) {
      return `Friends for ${years}y ${remainingMonths}mo`;
    }
    return `Friends for ${years} year${years === 1 ? "" : "s"}`;
  }
  if (months > 0) {
    return `Friends for ${months} month${months === 1 ? "" : "s"}`;
  }
  if (days > 0) {
    return `Friends for ${days} day${days === 1 ? "" : "s"}`;
  }
  return "Friends since today";
}

// =============================================================================
// Component
// =============================================================================

function UserProfileHeaderBase({
  displayName,
  username,
  pictureUrl,
  decorationId,
  backgroundId,
  bio,
  status,
  level,
  lastActive,
  friendshipDetails,
  topInset = 0,
  onPicturePress,
  style,
}: UserProfileHeaderProps) {
  const colors = useColors();

  // Resolve the background image source from the asset registry
  const backgroundSource: CosmeticImageSource | null = useMemo(() => {
    if (!backgroundId) return null;
    return getCosmeticAsset("background", backgroundId);
  }, [backgroundId]);

  // Check if status is expired
  const isStatusActive =
    status && (!status.expiresAt || status.expiresAt > Date.now());
  const moodConfig = status?.mood ? MOOD_CONFIG[status.mood] : null;

  // Streak display
  const hasStreak =
    friendshipDetails?.streakCount && friendshipDetails.streakCount > 0;

  // Text colors adapt when background is present
  const primaryTextColor = backgroundSource ? "#FFFFFF" : colors.text;
  const secondaryTextColor = backgroundSource
    ? "rgba(255,255,255,0.85)"
    : colors.textSecondary;
  const textShadow = backgroundSource
    ? {
        textShadowColor: "rgba(0,0,0,0.6)",
        textShadowOffset: { width: 0, height: 1 } as const,
        textShadowRadius: 3,
      }
    : {};
  const statusSurface = backgroundSource
    ? PROFILE_IMAGE_STATUS_SURFACE
    : colors.surfaceElevated;
  const cardSurface = backgroundSource
    ? PROFILE_IMAGE_CARD_SURFACE
    : colors.surfaceElevated;
  const levelSurface = backgroundSource
    ? PROFILE_IMAGE_LEVEL_SURFACE
    : colors.surfaceElevated;

  return (
    <View style={[styles.outerWrapper, style]}>
      {/* Header region with overflow hidden for background crop.
       * Negative top margin + extra padding pull the bg behind the status bar
       * while keeping foreground content below the safe area. */}
      <View
        style={[
          styles.headerRegion,
          topInset > 0 && { marginTop: -topInset, paddingTop: 0 },
        ]}
      >
        {/* Background Image */}
        {backgroundSource && (
          <CosmeticImage
            source={backgroundSource}
            style={styles.backgroundImage}
            debugLabel="user-profile-bg"
            transition={0}
          />
        )}

        {/* Scrim overlay for text readability */}
        {backgroundSource && <View style={styles.backgroundScrim} />}

        {/* Foreground content — padded down by the safe-area inset */}
        <View
          style={[
            styles.foregroundContent,
            topInset > 0 && { paddingTop: 24 + topInset * 2 },
          ]}
        >
          {/* Profile Picture with Decoration */}
          <View style={styles.pictureSection}>
            <ProfilePictureWithDecoration
              pictureUrl={pictureUrl}
              name={displayName}
              decorationId={decorationId}
              size={120}
              onPress={onPicturePress}
            />
          </View>

          {/* Name and Username */}
          <View style={styles.nameSection}>
            <Text
              style={[
                styles.displayName,
                { color: primaryTextColor },
                textShadow,
              ]}
            >
              {displayName}
            </Text>
            <Text
              style={[
                styles.username,
                { color: secondaryTextColor },
                textShadow,
              ]}
            >
              @{username}
            </Text>
          </View>

          {/* Status Indicator */}
          {isStatusActive && moodConfig && (
            <View
              style={[
                styles.statusContainer,
                { backgroundColor: statusSurface },
              ]}
            >
              <Text style={styles.statusEmoji}>{moodConfig.emoji}</Text>
              <Text style={[styles.statusText, { color: primaryTextColor }]}>
                {status.text || moodConfig.label}
              </Text>
            </View>
          )}

          {/* Last Active (if not showing status) */}
          {!isStatusActive && lastActive && (
            <Text style={[styles.lastActive, { color: colors.textSecondary }]}>
              {formatLastActive(lastActive)}
            </Text>
          )}

          {/* Friendship Info */}
          {friendshipDetails && (
            <View
              style={[
                styles.friendshipContainer,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              {/* Streak */}
              {hasStreak && (
                <View style={styles.friendshipItem}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <Text
                    style={[styles.friendshipValue, { color: colors.text }]}
                  >
                    {friendshipDetails.streakCount}
                  </Text>
                  <Text
                    style={[
                      styles.friendshipLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    day streak
                  </Text>
                </View>
              )}

              {/* Duration */}
              {friendshipDetails.friendsSince && (
                <View style={styles.friendshipItem}>
                  <MaterialCommunityIcons
                    name="account-heart"
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.friendshipDuration,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {formatFriendshipDuration(friendshipDetails.friendsSince)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Bio Section */}
          {bio?.text && (
            <View
              style={[
                styles.bioContainer,
                { backgroundColor: cardSurface },
              ]}
            >
              <Text
                style={[styles.bioText, { color: primaryTextColor }]}
                numberOfLines={4}
              >
                {bio.text}
              </Text>
            </View>
          )}

          {/* Level Progress */}
          {level && (
            <View
              style={[
                styles.levelContainer,
                { backgroundColor: levelSurface },
              ]}
            >
              <LevelProgress level={level} compact={!!backgroundSource} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  outerWrapper: {
    width: "100%",
  },
  headerRegion: {
    overflow: "hidden",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    minHeight: 220,
    justifyContent: "flex-end",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  foregroundContent: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  pictureSection: {
    marginBottom: 16,
  },
  nameSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
  },
  username: {
    fontSize: 15,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
    gap: 6,
  },
  statusEmoji: {
    fontSize: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  lastActive: {
    fontSize: 13,
    marginBottom: 12,
  },
  friendshipContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    gap: 20,
  },
  friendshipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakEmoji: {
    fontSize: 16,
  },
  friendshipValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  friendshipLabel: {
    fontSize: 13,
  },
  friendshipDuration: {
    fontSize: 13,
    fontWeight: "500",
  },
  bioContainer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  levelContainer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 12,
  },
});

// =============================================================================
// Export
// =============================================================================

export const UserProfileHeader = memo(UserProfileHeaderBase);
