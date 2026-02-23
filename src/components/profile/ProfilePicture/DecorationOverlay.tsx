/**
 * DecorationOverlay - Renders avatar decoration on top of profile picture
 *
 * Displays a 320x320 PNG/GIF decoration asset as an overlay.
 * Supports both static and animated decorations.
 *
 * Resolution order for assets:
 *   1. Legacy avatarDecorations data (full metadata + asset)
 *   2. Unified cosmetics asset registry (covers new catalog IDs)
 *
 * @module components/profile/ProfilePicture/DecorationOverlay
 */

import { CosmeticImage } from "@/components/CosmeticImage";
import { getCosmeticAsset } from "@/cosmetics/assetRegistry";
import { getCosmeticById } from "@/cosmetics/catalog";
import { getDecorationById } from "@/data/avatarDecorations";
import React, { useMemo } from "react";
import { ImageSourcePropType, StyleSheet, View, ViewStyle } from "react-native";

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
  // Resolve decoration data: legacy first, then cosmetics registry fallback
  const decoration = useMemo<{
    assetPath: ImageSourcePropType | null;
    rarity: keyof typeof RARITY_COLORS;
  } | null>(() => {
    if (!decorationId) return null;

    // 1) Try legacy avatarDecorations (has full metadata + asset)
    const legacy = getDecorationById(decorationId);
    if (legacy?.assetPath) {
      return { assetPath: legacy.assetPath, rarity: legacy.rarity };
    }

    // 2) Fall back to unified cosmetics asset registry
    const asset = getCosmeticAsset("decoration", decorationId);
    if (asset) {
      const catalogDef = getCosmeticById(decorationId);
      const rarity = (catalogDef?.rarity ??
        "common") as keyof typeof RARITY_COLORS;
      return { assetPath: asset as ImageSourcePropType, rarity };
    }

    return null;
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
      <CosmeticImage
        source={decoration.assetPath}
        style={[
          styles.decoration,
          {
            width: size,
            height: size,
          },
        ]}
        contentFit="contain"
        debugLabel={`decoration-${decorationId}`}
        transition={0}
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
