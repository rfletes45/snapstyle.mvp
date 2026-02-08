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

/**
 * Scale multiplier applied to the profile picture size to get the decoration
 * overlay size.  Exported so callers can compute the outer bounds when doing
 * layout (e.g. list-item row height).
 */
export const DECORATION_SCALE = 1.55;

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
  // The decoration asset is 320×320 with a ~200×200 clear center, giving a
  // natural scale of 1.6×.  We use 1.55× as a comfortable fit.
  //
  // LAYOUT STRATEGY: The outer container always stays at the base `size` so
  // consumers never see the decoration bleed into adjacent elements.  The
  // decoration itself renders in an absolutely-positioned layer that overflows
  // the container (overflow: 'visible').  This keeps list rows, chat bubbles,
  // player bars, etc. perfectly aligned whether or not a user has a decoration.
  const hasDecoration = !!decorationId;
  const decorationScale = DECORATION_SCALE;
  const decorationSize = size * decorationScale;
  // How much the decoration extends beyond the base `size` on each side.
  const bleed = (decorationSize - size) / 2;

  const content = (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
        },
        style,
      ]}
    >
      {/* Profile picture — fills the container exactly */}
      <ProfilePicture
        url={pictureUrl}
        thumbnailUrl={thumbnailUrl}
        name={name}
        size={size}
        showLoading={loading}
      />

      {/* Decoration overlay — overflows the container on all sides */}
      {hasDecoration && (
        <View
          style={[
            styles.decorationLayer,
            {
              top: -bleed,
              left: -bleed,
              width: decorationSize,
              height: decorationSize,
            },
          ]}
          pointerEvents="none"
        >
          <DecorationOverlay
            decorationId={decorationId}
            size={decorationSize}
            visible
          />
        </View>
      )}

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
    overflow: "visible" as const,
  },
  decorationLayer: {
    position: "absolute",
    // Allow the decoration to render outside the container bounds
    overflow: "visible" as const,
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
