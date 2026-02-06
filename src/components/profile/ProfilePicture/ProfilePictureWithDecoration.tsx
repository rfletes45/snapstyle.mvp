/**
 * ProfilePictureWithDecoration - Combined profile picture with decoration overlay
 *
 * Renders the user's profile picture (or initials fallback) with their
 * equipped avatar decoration overlaid on top.
 *
 * @module components/profile/ProfilePicture/ProfilePictureWithDecoration
 */

import React from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { DecorationOverlay } from "./DecorationOverlay";
import { ProfilePicture } from "./ProfilePicture";

export interface ProfilePictureWithDecorationProps {
  /** Profile picture URL (null for fallback) */
  pictureUrl: string | null | undefined;
  /** Thumbnail URL for faster initial load */
  thumbnailUrl?: string | null;
  /** User's name for fallback initials */
  name: string;
  /** Equipped decoration ID (null for none) */
  decorationId?: string | null;
  /** Size of the component */
  size?: number;
  /** Whether the component is pressable */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Whether to show edit indicator (for own profile) */
  showEditIndicator?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
  /** Whether to show loading state */
  loading?: boolean;
}

export function ProfilePictureWithDecoration({
  pictureUrl,
  thumbnailUrl,
  name,
  decorationId,
  size = 96,
  onPress,
  onLongPress,
  showEditIndicator = false,
  style,
  loading = false,
}: ProfilePictureWithDecorationProps) {
  // Calculate decoration size (slightly larger than picture for frame effect)
  const decorationSize = size * 1.15;
  const decorationOffset = (decorationSize - size) / 2;

  const content = (
    <View
      style={[
        styles.container,
        {
          width: decorationSize,
          height: decorationSize,
        },
        style,
      ]}
    >
      {/* Profile picture centered */}
      <View
        style={[
          styles.pictureContainer,
          {
            top: decorationOffset,
            left: decorationOffset,
          },
        ]}
      >
        <ProfilePicture
          url={pictureUrl}
          thumbnailUrl={thumbnailUrl}
          name={name}
          size={size}
          showLoading={loading}
        />
      </View>

      {/* Decoration overlay */}
      <DecorationOverlay
        decorationId={decorationId}
        size={decorationSize}
        visible={!!decorationId}
      />

      {/* Edit indicator (pencil icon overlay) */}
      {showEditIndicator && (
        <View style={styles.editIndicator}>
          <View style={styles.editBadge}>
            {/* Simple pencil using text */}
            <View style={styles.editIconContainer}>
              <View style={styles.pencilBody} />
              <View style={styles.pencilTip} />
            </View>
          </View>
        </View>
      )}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  pictureContainer: {
    position: "absolute",
  },
  pressable: {
    // No additional styles needed
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  editIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  editBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  editIconContainer: {
    width: 12,
    height: 12,
    transform: [{ rotate: "45deg" }],
  },
  pencilBody: {
    width: 4,
    height: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
    position: "absolute",
    top: 0,
    left: 4,
  },
  pencilTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
    position: "absolute",
    bottom: -2,
    left: 3,
  },
});

export default ProfilePictureWithDecoration;
