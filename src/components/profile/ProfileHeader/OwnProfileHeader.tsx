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
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Text } from "react-native-paper";

import { useProfileThemeColors } from "@/contexts/ProfileThemeColorsContext";
import type { LevelInfo } from "@/types/profile";
import type { ProfileBio, ProfileStatus } from "@/types/userProfile";
import { MOOD_CONFIG } from "@/types/userProfile";
import { LevelProgress } from "../LevelProgress";
import { ProfilePictureWithDecoration } from "../ProfilePicture";

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
  bio,
  status,
  level,
  onEditPicturePress,
  onEditBioPress,
  onEditStatusPress,
  onEditNamePress,
  style,
}: OwnProfileHeaderProps) {
  const colors = useProfileThemeColors();

  // Check if status is expired
  const isStatusActive =
    status && (!status.expiresAt || status.expiresAt > Date.now());
  const moodConfig = status?.mood ? MOOD_CONFIG[status.mood] : null;

  return (
    <View style={[styles.container, style]}>
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
          <Text style={[styles.displayName, { color: colors.text }]}>
            {displayName}
          </Text>
          {onEditNamePress && (
            <MaterialCommunityIcons
              name="pencil-outline"
              size={16}
              color={colors.textSecondary}
              style={styles.editIcon}
            />
          )}
        </TouchableOpacity>
        <Text style={[styles.username, { color: colors.textSecondary }]}>
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
      <View style={styles.levelContainer}>
        <LevelProgress level={level} />
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
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
