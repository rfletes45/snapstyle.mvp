/**
 * ProfileBio Component
 *
 * Displays user's bio text on their profile.
 * Can be used in both own profile (with edit) and user profile (read-only).
 *
 * @module components/profile/ProfileBio/ProfileBio
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Text, useTheme } from "react-native-paper";

import type { ProfileBio as ProfileBioType } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface ProfileBioProps {
  /** User's bio data */
  bio?: ProfileBioType | null;
  /** Whether the bio is editable (shows edit UI) */
  editable?: boolean;
  /** Handler for edit press */
  onEditPress?: () => void;
  /** Maximum lines to display before truncating */
  maxLines?: number;
  /** Custom container style */
  style?: ViewStyle;
}

// =============================================================================
// Component
// =============================================================================

function ProfileBioBase({
  bio,
  editable = false,
  onEditPress,
  maxLines = 4,
  style,
}: ProfileBioProps) {
  const theme = useTheme();
  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    surfaceVariant: theme.colors.surfaceVariant,
    primary: theme.colors.primary,
    border: theme.colors.outline,
  };

  const hasBio = bio?.text && bio.text.trim().length > 0;

  // Editable empty state
  if (editable && !hasBio) {
    return (
      <TouchableOpacity
        onPress={onEditPress}
        activeOpacity={0.7}
        style={[
          styles.container,
          styles.emptyContainer,
          { borderColor: colors.border },
          style,
        ]}
      >
        <MaterialCommunityIcons
          name="text-box-outline"
          size={20}
          color={colors.primary}
        />
        <Text style={[styles.emptyText, { color: colors.primary }]}>
          Add a bio to tell people about yourself
        </Text>
      </TouchableOpacity>
    );
  }

  // No bio and not editable - don't render anything
  if (!hasBio) {
    return null;
  }

  // Bio display
  const content = (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surfaceVariant },
        style,
      ]}
    >
      <Text
        style={[styles.bioText, { color: colors.text }]}
        numberOfLines={maxLines}
      >
        {bio.text}
      </Text>
      {editable && (
        <MaterialCommunityIcons
          name="pencil-outline"
          size={14}
          color={colors.textSecondary}
          style={styles.editIcon}
        />
      )}
    </View>
  );

  if (editable && onEditPress) {
    return (
      <TouchableOpacity onPress={onEditPress} activeOpacity={0.7}>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  emptyContainer: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  bioText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "500",
  },
  editIcon: {
    marginLeft: 8,
    marginTop: 2,
  },
});

// =============================================================================
// Export
// =============================================================================

export const ProfileBio = memo(ProfileBioBase);
