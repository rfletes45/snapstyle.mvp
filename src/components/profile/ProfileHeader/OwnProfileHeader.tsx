/**
 * OwnProfileHeader Component
 *
 * Editable profile header for the current user's profile.
 * Displays profile picture with decoration, name, username, bio, and status.
 * Allows editing of picture, decoration, and bio.
 *
 * @module components/profile/ProfileHeader/OwnProfileHeader
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useMemo } from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Text } from "react-native-paper";

import { CosmeticImage } from "@/components/CosmeticImage";
import { LevelProgress } from "@/components/profile/LevelProgress";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { getCosmeticAsset } from "@/cosmetics/assetRegistry";
import type { CosmeticImageSource } from "@/cosmetics/types";
import { useColors } from "@/store/ThemeContext";
import type { LevelInfo } from "@/types/profile";
import type { ProfileBio, ProfileStatus } from "@/types/userProfile";
import { MOOD_CONFIG } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface OwnProfileHeaderProps {
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
  /** User's bio */
  bio?: ProfileBio | null;
  /** User's current status */
  status?: ProfileStatus | null;
  /** Level information */
  level: LevelInfo;
  /** Handler for picture/decoration edit */
  onEditPicturePress: () => void;
  /** Handler for bio edit */
  onEditBioPress?: () => void;
  /** Handler for status edit */
  onEditStatusPress?: () => void;
  /** Handler for name edit (navigates to settings) */
  onEditNamePress?: () => void;
  /** Handler for level bar press (navigates to level rewards) */
  onLevelPress?: () => void;
  /** Custom container style */
  style?: ViewStyle;
}

// =============================================================================
// Component
// =============================================================================

function OwnProfileHeaderBase({
  displayName,
  username,
  pictureUrl,
  decorationId,
  backgroundId,
  bio,
  status,
  level,
  onEditPicturePress,
  onEditBioPress,
  onEditStatusPress,
  onEditNamePress,
  onLevelPress,
  style,
}: OwnProfileHeaderProps) {
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

  return (
    <View style={[styles.outerWrapper, style]}>
      {/* Header region with overflow hidden for background crop */}
      <View style={styles.headerRegion}>
        {/* Background Image (fills entire header region, cropped at level bar) */}
        {backgroundSource && (
          <CosmeticImage
            source={backgroundSource}
            style={styles.backgroundImage}
            debugLabel="profile-bg"
            transition={0}
          />
        )}

        {/* Scrim overlay for text readability when background is present */}
        {backgroundSource && <View style={styles.backgroundScrim} />}

        {/* Foreground content */}
        <View style={styles.foregroundContent}>
          {/* Profile Picture with Decoration */}
          <View style={styles.pictureSection}>
            <ProfilePictureWithDecoration
              pictureUrl={pictureUrl}
              name={displayName}
              decorationId={decorationId}
              size={120}
              onPress={onEditPicturePress}
              showEditIndicator
            />
          </View>

          {/* Name and Username */}
          <View style={styles.nameSection}>
            <TouchableOpacity
              onPress={onEditNamePress}
              activeOpacity={0.7}
              style={styles.nameRow}
            >
              <Text
                style={[
                  styles.displayName,
                  { color: primaryTextColor },
                  textShadow,
                ]}
              >
                {displayName}
              </Text>
              {onEditNamePress && (
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={16}
                  color={secondaryTextColor}
                  style={styles.editIcon}
                />
              )}
            </TouchableOpacity>
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
            <TouchableOpacity
              onPress={onEditStatusPress}
              activeOpacity={0.7}
              style={[
                styles.statusContainer,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Text style={styles.statusEmoji}>{moodConfig.emoji}</Text>
              <Text style={[styles.statusText, { color: colors.text }]}>
                {status.text || moodConfig.label}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}

          {/* Add Status Button (if no active status) */}
          {!isStatusActive && onEditStatusPress && (
            <TouchableOpacity
              onPress={onEditStatusPress}
              activeOpacity={0.7}
              style={[styles.addStatusButton, { borderColor: colors.outline }]}
            >
              <MaterialCommunityIcons
                name="emoticon-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.addStatusText, { color: colors.primary }]}>
                Set status
              </Text>
            </TouchableOpacity>
          )}

          {/* Bio Section */}
          <TouchableOpacity
            onPress={onEditBioPress}
            activeOpacity={0.7}
            style={[
              styles.bioContainer,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            {bio?.text ? (
              <Text
                style={[styles.bioText, { color: colors.text }]}
                numberOfLines={3}
              >
                {bio.text}
              </Text>
            ) : (
              <Text
                style={[styles.bioPlaceholder, { color: colors.textSecondary }]}
              >
                Add a bio to tell people about yourself...
              </Text>
            )}
            <MaterialCommunityIcons
              name="pencil-outline"
              size={14}
              color={colors.textSecondary}
              style={styles.bioEditIcon}
            />
          </TouchableOpacity>

          {/* Level Progress */}
          <TouchableOpacity
            style={styles.levelContainer}
            onPress={onLevelPress}
            activeOpacity={0.7}
            disabled={!onLevelPress}
            accessibilityLabel="View level rewards"
            accessibilityRole="button"
          >
            <LevelProgress level={level} compact={!!backgroundSource} />
          </TouchableOpacity>
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
  },
  editIcon: {
    marginTop: 2,
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
  addStatusButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 12,
    gap: 6,
  },
  addStatusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  bioContainer: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bioText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  bioPlaceholder: {
    flex: 1,
    fontSize: 14,
    fontStyle: "italic",
  },
  bioEditIcon: {
    marginLeft: 8,
    marginTop: 2,
  },
  levelContainer: {
    width: "100%",
    paddingHorizontal: 16,
  },
});

// =============================================================================
// Export
// =============================================================================

export const OwnProfileHeader = memo(OwnProfileHeaderBase);
