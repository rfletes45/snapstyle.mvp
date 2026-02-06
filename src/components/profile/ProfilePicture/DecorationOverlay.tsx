/**
 * DecorationOverlay - Renders avatar decoration on top of profile picture
 *
 * Displays a 320x320 PNG/GIF decoration asset as an overlay.
 * Supports both static and animated decorations.
 *
 * @module components/profile/ProfilePicture/DecorationOverlay
 */

import { getDecorationById } from "@/data/avatarDecorations";
import React, { useMemo } from "react";
import { Image, StyleSheet, View, ViewStyle } from "react-native";

export interface DecorationOverlayProps {
  /** Decoration ID to display */
  decorationId: string | null | undefined;
  /** Size to render the decoration (will scale from 320x320) */
  size: number;
  /** Additional styles */
  style?: ViewStyle;
  /** Whether to show the decoration (for toggling) */
  visible?: boolean;
}

/**
 * Rarity colors for glow effects
 */
const RARITY_COLORS = {
  common: "transparent",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#F59E0B",
  mythic: "#EC4899",
} as const;

export function DecorationOverlay({
  decorationId,
  size,
  style,
  visible = true,
}: DecorationOverlayProps) {
  // Get decoration data
  const decoration = useMemo(() => {
    if (!decorationId) return null;
    return getDecorationById(decorationId);
  }, [decorationId]);

  // Don't render if no decoration, not visible, or no asset
  if (!visible || !decoration || !decoration.assetPath) {
    return null;
  }

  // Calculate glow effect for rare+ decorations
  const glowColor = RARITY_COLORS[decoration.rarity] || "transparent";
  const hasGlow = decoration.rarity !== "common";

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
        },
        style,
      ]}
      pointerEvents="none"
    >
      {/* Glow effect for rare+ decorations */}
      {hasGlow && (
        <View
          style={[
            styles.glowLayer,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              shadowColor: glowColor,
              shadowOpacity: 0.6,
              shadowRadius: size * 0.1,
            },
          ]}
        />
      )}

      {/* Decoration image */}
      <Image
        source={decoration.assetPath}
        style={[
          styles.decoration,
          {
            width: size,
            height: size,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  glowLayer: {
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  decoration: {
    position: "absolute",
  },
});

export default DecorationOverlay;
