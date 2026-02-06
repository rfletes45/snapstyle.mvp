/**
 * InitialsAvatar - Fallback avatar showing user's initials
 *
 * Displays when user has no profile picture set.
 * Shows colored circle with user's initials (first letter of first and last name).
 *
 * @module components/profile/ProfilePicture/InitialsAvatar
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";

export interface InitialsAvatarProps {
  /** User's display name or username */
  name: string;
  /** Size of the avatar in pixels */
  size?: number;
  /** Custom background color (optional - will generate from name if not provided) */
  backgroundColor?: string;
  /** Additional container styles */
  style?: ViewStyle;
}

/**
 * Generate a consistent color from a string
 * Same name always produces same color
 */
function stringToColor(str: string): string {
  const colors = [
    "#6366F1", // Indigo
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#EF4444", // Red
    "#F97316", // Orange
    "#F59E0B", // Amber
    "#10B981", // Emerald
    "#14B8A6", // Teal
    "#06B6D4", // Cyan
    "#3B82F6", // Blue
    "#A855F7", // Purple
    "#D946EF", // Fuchsia
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Extract initials from a name
 * "John Doe" -> "JD"
 * "john.doe" -> "JD"
 * "johndoe" -> "J"
 */
function getInitials(name: string): string {
  if (!name || name.trim().length === 0) {
    return "?";
  }

  const cleanName = name.trim();

  // Try splitting by space first
  const spaceParts = cleanName.split(/\s+/);
  if (spaceParts.length >= 2) {
    return (
      spaceParts[0][0] + spaceParts[spaceParts.length - 1][0]
    ).toUpperCase();
  }

  // Try splitting by common separators (. - _)
  const separatorParts = cleanName.split(/[.\-_]/);
  if (separatorParts.length >= 2) {
    return (
      separatorParts[0][0] + separatorParts[separatorParts.length - 1][0]
    ).toUpperCase();
  }

  // Just use first character
  return cleanName[0].toUpperCase();
}

export function InitialsAvatar({
  name,
  size = 64,
  backgroundColor,
  style,
}: InitialsAvatarProps) {
  const { colors } = useTheme();

  const initials = useMemo(() => getInitials(name), [name]);
  const bgColor = useMemo(
    () => backgroundColor || stringToColor(name),
    [backgroundColor, name],
  );

  const fontSize = size * 0.4;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            fontSize,
            color: "#FFFFFF",
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: {
    fontWeight: "700",
    textAlign: "center",
  },
});

export default InitialsAvatar;
