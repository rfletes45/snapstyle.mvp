/**
 * AvatarStack — layered PFP with decoration slots
 *
 * Renders the user's profile picture with up to 5 decoration layers
 * (backplate, aura, frame, badge pin, overlay sticker).
 *
 * Falls back gracefully when decoration IDs are missing or invalid.
 * Re-uses the existing ProfilePictureWithDecoration for the core PFP+
 * legacy decoration, then adds the new layered slots around it.
 *
 * @module components/games/AvatarStack
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import type { EquippedDecor } from "@/types/playerSummary";
import React, { memo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

// =============================================================================
// Props
// =============================================================================

export interface AvatarStackProps {
  /** Profile picture URL */
  photoURL?: string | null;
  /** User name for initials fallback */
  name: string;
  /** Legacy decoration id (from existing profile system) */
  decorationId?: string | null;
  /** New layered decoration slots */
  equippedDecor?: EquippedDecor;
  /** Base size of the avatar (px) */
  size?: number;
  /** Show online/away/offline dot */
  presence?: "online" | "away" | "offline";
  /** Additional container style */
  style?: ViewStyle;
}

// =============================================================================
// Presence dot colours
// =============================================================================

const PRESENCE_COLORS: Record<string, string> = {
  online: "#4CAF50",
  away: "#FFC107",
  offline: "#9E9E9E",
};

// =============================================================================
// Component
// =============================================================================

function AvatarStackBase({
  photoURL,
  name,
  decorationId,
  equippedDecor,
  size = 64,
  presence,
  style,
}: AvatarStackProps) {
  const dotSize = Math.max(10, size * 0.2);

  return (
    <View style={[styles.root, { width: size, height: size }, style]}>
      {/* Backplate gradient (decoration slot) — rendered behind everything */}
      {equippedDecor?.backplateId ? (
        <View
          style={[
            styles.backplate,
            {
              width: size + 8,
              height: size + 8,
              borderRadius: (size + 8) / 2,
              top: -4,
              left: -4,
            },
          ]}
        />
      ) : null}

      {/* Aura glow (decoration slot) */}
      {equippedDecor?.auraId ? (
        <View
          style={[
            styles.aura,
            {
              width: size + 12,
              height: size + 12,
              borderRadius: (size + 12) / 2,
              top: -6,
              left: -6,
            },
          ]}
        />
      ) : null}

      {/* Core PFP (delegates to existing ProfilePictureWithDecoration) */}
      <ProfilePictureWithDecoration
        pictureUrl={photoURL}
        name={name}
        size={size}
        decorationId={decorationId}
      />

      {/* Frame ring (decoration slot) */}
      {equippedDecor?.frameId ? (
        <View
          style={[
            styles.frame,
            {
              width: size + 4,
              height: size + 4,
              borderRadius: (size + 4) / 2,
              top: -2,
              left: -2,
            },
          ]}
        />
      ) : null}

      {/* Overlay sticker (decoration slot) */}
      {equippedDecor?.overlayId ? (
        <View
          style={[
            styles.overlay,
            {
              width: size * 0.35,
              height: size * 0.35,
              borderRadius: size * 0.175,
            },
          ]}
        />
      ) : null}

      {/* Badge pin (decoration slot) */}
      {equippedDecor?.badgeId ? (
        <View
          style={[
            styles.badgePin,
            {
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
            },
          ]}
        />
      ) : null}

      {/* Presence dot */}
      {presence ? (
        <View
          style={[
            styles.presenceDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor:
                PRESENCE_COLORS[presence] ?? PRESENCE_COLORS.offline,
              borderWidth: 2,
              borderColor: "#121212",
            },
          ]}
        />
      ) : null}
    </View>
  );
}

export const AvatarStack = memo(AvatarStackBase);
export default AvatarStack;

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  root: {
    position: "relative",
    overflow: "visible",
  },
  backplate: {
    position: "absolute",
    backgroundColor: "rgba(139, 92, 246, 0.25)",
    zIndex: -2,
  },
  aura: {
    position: "absolute",
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    zIndex: -1,
  },
  frame: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255, 215, 0, 0.6)",
    zIndex: 2,
  },
  overlay: {
    position: "absolute",
    bottom: -2,
    left: -2,
    backgroundColor: "rgba(255, 152, 0, 0.6)",
    zIndex: 3,
  },
  badgePin: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "rgba(76, 175, 80, 0.8)",
    zIndex: 4,
    borderWidth: 1.5,
    borderColor: "#121212",
  },
  presenceDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    zIndex: 5,
  },
});
