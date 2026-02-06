/**
 * ProfileStatus Component
 *
 * Displays user's current status/mood indicator.
 * Shows mood emoji, optional text, and expiry info.
 *
 * @module components/profile/ProfileBio/ProfileStatus
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";

import type { ProfileStatus as ProfileStatusType } from "@/types/userProfile";
import { MOOD_CONFIG } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface ProfileStatusProps {
  /** User's current status */
  status?: ProfileStatusType | null;
  /** Whether the status is editable */
  editable?: boolean;
  /** Handler for edit/set status press */
  onPress?: () => void;
  /** Size variant */
  size?: "small" | "medium" | "large";
  /** Custom container style */
  style?: ViewStyle;
}

// =============================================================================
// Helper Functions
// =============================================================================

function isStatusExpired(status: ProfileStatusType): boolean {
  if (!status.expiresAt) return false;
  return Date.now() > status.expiresAt;
}

function getTimeRemaining(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expired";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 60) return `${minutes}m left`;
  if (hours < 24) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}

// =============================================================================
// Component
// =============================================================================

function ProfileStatusBase({
  status,
  editable = false,
  onPress,
  size = "medium",
  style,
}: ProfileStatusProps) {
  const theme = useTheme();
  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    surfaceVariant: theme.colors.surfaceVariant,
    primary: theme.colors.primary,
    border: theme.colors.outline,
  };

  // Check if status is active
  const isActive = status && !isStatusExpired(status);
  const moodConfig = status?.mood ? MOOD_CONFIG[status.mood] : null;

  // Size-based styles
  const sizeStyles = {
    small: {
      padding: 6,
      borderRadius: 16,
      emojiSize: 14,
      textSize: 12,
      gap: 4,
    },
    medium: {
      padding: 10,
      borderRadius: 20,
      emojiSize: 16,
      textSize: 14,
      gap: 6,
    },
    large: {
      padding: 12,
      borderRadius: 24,
      emojiSize: 20,
      textSize: 16,
      gap: 8,
    },
  }[size];

  // Editable empty state - show "Set status" button
  if (editable && !isActive) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[
          styles.emptyContainer,
          {
            borderColor: colors.border,
            padding: sizeStyles.padding,
            borderRadius: sizeStyles.borderRadius,
          },
          style,
        ]}
      >
        <MaterialCommunityIcons
          name="emoticon-outline"
          size={sizeStyles.emojiSize}
          color={colors.primary}
        />
        <Text
          style={[
            styles.emptyText,
            { color: colors.primary, fontSize: sizeStyles.textSize },
          ]}
        >
          Set status
        </Text>
      </TouchableOpacity>
    );
  }

  // No active status and not editable - don't render
  if (!isActive || !moodConfig) {
    return null;
  }

  // Get display emoji (custom or from mood config)
  const displayEmoji =
    status.mood === "custom" && status.customEmoji
      ? status.customEmoji
      : moodConfig.emoji;

  // Status display
  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceVariant,
          padding: sizeStyles.padding,
          paddingHorizontal: sizeStyles.padding + 4,
          borderRadius: sizeStyles.borderRadius,
          gap: sizeStyles.gap,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: sizeStyles.emojiSize }}>{displayEmoji}</Text>
      <Text
        style={[
          styles.statusText,
          { color: colors.text, fontSize: sizeStyles.textSize },
        ]}
        numberOfLines={1}
      >
        {status.text || moodConfig.label}
      </Text>

      {/* Expiry indicator */}
      {status.expiresAt && size !== "small" && (
        <Text
          style={[
            styles.expiryText,
            { color: colors.textSecondary, fontSize: sizeStyles.textSize - 2 },
          ]}
        >
          • {getTimeRemaining(status.expiresAt)}
        </Text>
      )}

      {/* Edit indicator */}
      {editable && (
        <MaterialCommunityIcons
          name="chevron-right"
          size={sizeStyles.emojiSize}
          color={colors.textSecondary}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 6,
  },
  emptyText: {
    fontWeight: "500",
  },
  statusText: {
    fontWeight: "500",
    flexShrink: 1,
  },
  expiryText: {
    flexShrink: 0,
  },
});

// =============================================================================
// Export
// =============================================================================

export const ProfileStatus = memo(ProfileStatusBase);
