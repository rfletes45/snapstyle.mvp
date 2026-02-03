/**
 * ProfileHeader Component
 *
 * Displays avatar with frame, username, display name, and level progress.
 * Central header for the redesigned profile screen.
 * Supports both legacy and digital avatar configurations.
 */

import Avatar from "@/components/Avatar";
import type { DigitalAvatarConfig } from "@/types/avatar";
import type { AvatarConfig } from "@/types/models";
import type { ExtendedAvatarConfig, LevelInfo } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { LevelProgress } from "./LevelProgress";

export interface ProfileHeaderProps {
  /** User's display name */
  displayName: string;
  /** Username with @ prefix */
  username: string;
  /** Avatar configuration - supports legacy and digital formats */
  avatarConfig: ExtendedAvatarConfig | DigitalAvatarConfig | AvatarConfig;
  /** Level information */
  level: LevelInfo;
  /** Handler for edit profile button */
  onEditPress?: () => void;
  /** Handler for avatar/customization press */
  onAvatarPress?: () => void;
}

function ProfileHeaderBase({
  displayName,
  username,
  avatarConfig,
  level,
  onEditPress,
  onAvatarPress,
}: ProfileHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Avatar with optional frame */}
      <TouchableOpacity
        onPress={onAvatarPress}
        activeOpacity={0.8}
        style={styles.avatarContainer}
      >
        <View style={styles.avatarWrapper}>
          <Avatar config={avatarConfig} size={100} />
          {/* Customize overlay */}
          <View
            style={[
              styles.customizeOverlay,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <MaterialCommunityIcons name="palette" size={16} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>

      {/* User info */}
      <View style={styles.infoContainer}>
        <Text style={[styles.displayName, { color: theme.colors.onSurface }]}>
          {displayName}
        </Text>
        <Text
          style={[styles.username, { color: theme.colors.onSurfaceVariant }]}
        >
          @{username}
        </Text>

        {/* Edit button */}
        {onEditPress && (
          <TouchableOpacity
            onPress={onEditPress}
            style={[styles.editButton, { borderColor: theme.colors.outline }]}
          >
            <MaterialCommunityIcons
              name="pencil"
              size={14}
              color={theme.colors.primary}
            />
            <Text style={[styles.editText, { color: theme.colors.primary }]}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Level progress */}
      <View style={styles.levelContainer}>
        <LevelProgress level={level} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarWrapper: {
    position: "relative",
  },
  customizeOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  infoContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    marginBottom: 12,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  editText: {
    fontSize: 14,
    fontWeight: "600",
  },
  levelContainer: {
    width: "100%",
    maxWidth: 300,
  },
});

export const ProfileHeader = memo(ProfileHeaderBase);
export default ProfileHeader;
