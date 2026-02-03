/**
 * Clothing SVG Components
 *
 * Renders clothing tops, bottoms, and full outfits.
 */

import React, { memo, useMemo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

import { getClothingBottomSafe } from "@/data/avatarAssets/clothingBottoms";
import { getOutfitSafe } from "@/data/avatarAssets/clothingOutfits";
import { getClothingTopSafe } from "@/data/avatarAssets/clothingTops";
import type {
  ClothingBottomId,
  ClothingOutfitId,
  ClothingTopId,
} from "@/types/avatar";

// =============================================================================
// TYPES
// =============================================================================

export interface ClothingTopProps {
  /** Clothing top ID */
  topId: ClothingTopId | null;
  /** Custom color override */
  customColor?: string;
  /** Scale factor for body proportion adjustments */
  scale?: number;
}

export interface ClothingBottomProps {
  /** Clothing bottom ID */
  bottomId: ClothingBottomId | null;
  /** Custom color override */
  customColor?: string;
  /** Scale factor for body proportion adjustments */
  scale?: number;
}

export interface ClothingOutfitProps {
  /** Full outfit ID */
  outfitId: ClothingOutfitId | null;
  /** Custom color override */
  customColor?: string;
  /** Secondary color override */
  customSecondaryColor?: string;
  /** Scale factor for body proportion adjustments */
  scale?: number;
}

export interface FullClothingProps {
  /** Clothing top ID (ignored if outfit is set) */
  topId: ClothingTopId | null;
  /** Clothing bottom ID (ignored if outfit is set) */
  bottomId: ClothingBottomId | null;
  /** Full outfit ID (overrides top and bottom) */
  outfitId: ClothingOutfitId | null;
  /** Custom top color */
  topColor?: string;
  /** Custom bottom color */
  bottomColor?: string;
  /** Custom outfit color */
  outfitColor?: string;
  /** Scale factor */
  scale?: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a darker shade of a color for shadows
 */
function darkenColor(color: string, amount: number = 0.2): string {
  // Handle hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    const newR = Math.max(0, Math.floor(r * (1 - amount)));
    const newG = Math.max(0, Math.floor(g * (1 - amount)));
    const newB = Math.max(0, Math.floor(b * (1 - amount)));

    return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
  }
  return color;
}

/**
 * Creates a lighter shade of a color for highlights
 */
function lightenColor(color: string, amount: number = 0.15): string {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
    const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
    const newB = Math.min(255, Math.floor(b + (255 - b) * amount));

    return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
  }
  return color;
}

// =============================================================================
// CLOTHING TOP COMPONENT
// =============================================================================

/**
 * Renders a clothing top
 */
export const ClothingTopSvg = memo(function ClothingTopSvg({
  topId,
  customColor,
  scale = 1,
}: ClothingTopProps): React.ReactElement | null {
  const topData = useMemo(() => getClothingTopSafe(topId), [topId]);

  if (!topData || !topData.mainPath) {
    return null;
  }

  const mainColor = customColor ?? topData.defaultColor;
  const shadowColor = darkenColor(mainColor, 0.25);
  const highlightColor = lightenColor(mainColor, 0.1);

  const gradientId = `topGradient_${topId}`;
  const shadowGradientId = `topShadowGradient_${topId}`;

  return (
    <G transform={scale !== 1 ? `scale(${scale})` : undefined}>
      {/* Gradient definitions */}
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={highlightColor} />
          <Stop offset="50%" stopColor={mainColor} />
          <Stop offset="100%" stopColor={shadowColor} />
        </LinearGradient>
        <LinearGradient id={shadowGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="transparent" />
          <Stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
        </LinearGradient>
      </Defs>

      {/* Main garment body */}
      <Path
        d={topData.mainPath}
        fill={`url(#${gradientId})`}
        stroke={shadowColor}
        strokeWidth={0.5}
      />

      {/* Sleeves (if present) */}
      {topData.sleevesPath && (
        <Path
          d={topData.sleevesPath}
          fill={`url(#${gradientId})`}
          stroke={shadowColor}
          strokeWidth={0.5}
        />
      )}

      {/* Shadow/folds overlay */}
      {topData.shadowPath && (
        <Path d={topData.shadowPath} fill={`url(#${shadowGradientId})`} />
      )}

      {/* Details (seams, buttons, etc.) */}
      {topData.detailsPath && (
        <Path
          d={topData.detailsPath}
          fill="none"
          stroke={topData.secondaryColor ?? shadowColor}
          strokeWidth={0.8}
          strokeLinecap="round"
        />
      )}
    </G>
  );
});

// =============================================================================
// CLOTHING BOTTOM COMPONENT
// =============================================================================

/**
 * Renders a clothing bottom (pants, shorts, skirts)
 */
export const ClothingBottomSvg = memo(function ClothingBottomSvg({
  bottomId,
  customColor,
  scale = 1,
}: ClothingBottomProps): React.ReactElement | null {
  const bottomData = useMemo(() => getClothingBottomSafe(bottomId), [bottomId]);

  if (!bottomData || !bottomData.mainPath) {
    return null;
  }

  const mainColor = customColor ?? bottomData.defaultColor;
  const shadowColor = darkenColor(mainColor, 0.25);
  const highlightColor = lightenColor(mainColor, 0.1);

  const gradientId = `bottomGradient_${bottomId}`;
  const shadowGradientId = `bottomShadowGradient_${bottomId}`;

  return (
    <G transform={scale !== 1 ? `scale(${scale})` : undefined}>
      {/* Gradient definitions */}
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={highlightColor} />
          <Stop offset="50%" stopColor={mainColor} />
          <Stop offset="100%" stopColor={shadowColor} />
        </LinearGradient>
        <LinearGradient id={shadowGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="transparent" />
          <Stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
        </LinearGradient>
      </Defs>

      {/* Main garment body */}
      <Path
        d={bottomData.mainPath}
        fill={`url(#${gradientId})`}
        stroke={shadowColor}
        strokeWidth={0.5}
      />

      {/* Shadow/folds overlay */}
      {bottomData.shadowPath && (
        <Path d={bottomData.shadowPath} fill={`url(#${shadowGradientId})`} />
      )}

      {/* Details (seams, pockets, etc.) */}
      {bottomData.detailsPath && (
        <Path
          d={bottomData.detailsPath}
          fill="none"
          stroke={bottomData.secondaryColor ?? shadowColor}
          strokeWidth={0.8}
          strokeLinecap="round"
        />
      )}
    </G>
  );
});

// =============================================================================
// FULL OUTFIT COMPONENT
// =============================================================================

/**
 * Renders a full outfit (dress, jumpsuit, etc.)
 */
export const ClothingOutfitSvg = memo(function ClothingOutfitSvg({
  outfitId,
  customColor,
  customSecondaryColor,
  scale = 1,
}: ClothingOutfitProps): React.ReactElement | null {
  const outfitData = useMemo(() => getOutfitSafe(outfitId), [outfitId]);

  if (!outfitData || !outfitData.mainPath) {
    return null;
  }

  const mainColor = customColor ?? outfitData.defaultColor;
  const secondaryColor =
    customSecondaryColor ?? outfitData.secondaryColor ?? mainColor;
  const accentColor = outfitData.accentColor ?? secondaryColor;
  const shadowColor = darkenColor(mainColor, 0.25);
  const highlightColor = lightenColor(mainColor, 0.1);

  const gradientId = `outfitGradient_${outfitId}`;
  const shadowGradientId = `outfitShadowGradient_${outfitId}`;
  const sleeveGradientId = `outfitSleeveGradient_${outfitId}`;

  return (
    <G transform={scale !== 1 ? `scale(${scale})` : undefined}>
      {/* Gradient definitions */}
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={highlightColor} />
          <Stop offset="45%" stopColor={mainColor} />
          <Stop offset="100%" stopColor={shadowColor} />
        </LinearGradient>
        <LinearGradient id={shadowGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="transparent" />
          <Stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
        </LinearGradient>
        <LinearGradient
          id={sleeveGradientId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="50%"
        >
          <Stop offset="0%" stopColor={mainColor} />
          <Stop offset="100%" stopColor={shadowColor} />
        </LinearGradient>
      </Defs>

      {/* Main garment body */}
      <Path
        d={outfitData.mainPath}
        fill={`url(#${gradientId})`}
        stroke={shadowColor}
        strokeWidth={0.5}
      />

      {/* Sleeves (if present) */}
      {outfitData.sleevesPath && (
        <Path
          d={outfitData.sleevesPath}
          fill={`url(#${sleeveGradientId})`}
          stroke={shadowColor}
          strokeWidth={0.5}
        />
      )}

      {/* Shadow/folds overlay */}
      {outfitData.shadowPath && (
        <Path d={outfitData.shadowPath} fill={`url(#${shadowGradientId})`} />
      )}

      {/* Details (seams, buttons, accents, etc.) */}
      {outfitData.detailsPath && (
        <Path
          d={outfitData.detailsPath}
          fill={accentColor !== shadowColor ? accentColor : "none"}
          stroke={secondaryColor}
          strokeWidth={0.8}
          strokeLinecap="round"
        />
      )}
    </G>
  );
});

// =============================================================================
// COMBINED CLOTHING COMPONENT
// =============================================================================

/**
 * Renders complete clothing (either outfit or top+bottom combo)
 * If outfitId is provided, it overrides top and bottom.
 */
export const FullClothingSvg = memo(function FullClothingSvg({
  topId,
  bottomId,
  outfitId,
  topColor,
  bottomColor,
  outfitColor,
  scale = 1,
}: FullClothingProps): React.ReactElement | null {
  // Check if we should render a full outfit
  const outfitData = useMemo(() => getOutfitSafe(outfitId), [outfitId]);

  if (outfitData) {
    // Render full outfit (overrides top + bottom)
    return (
      <ClothingOutfitSvg
        outfitId={outfitId}
        customColor={outfitColor}
        scale={scale}
      />
    );
  }

  // Render separate top and bottom
  const topData = useMemo(() => getClothingTopSafe(topId), [topId]);
  const bottomData = useMemo(() => getClothingBottomSafe(bottomId), [bottomId]);

  // Determine render order based on top layer type
  const renderTopFirst = topData?.layer === "base"; // Base layer renders first (underneath)

  if (renderTopFirst) {
    return (
      <G>
        {/* Bottom rendered on top of base layer top (like a tank under jacket) */}
        <ClothingTopSvg topId={topId} customColor={topColor} scale={scale} />
        <ClothingBottomSvg
          bottomId={bottomId}
          customColor={bottomColor}
          scale={scale}
        />
      </G>
    );
  }

  // Normal render order: bottom first, then top (like a jacket over pants)
  return (
    <G>
      <ClothingBottomSvg
        bottomId={bottomId}
        customColor={bottomColor}
        scale={scale}
      />
      <ClothingTopSvg topId={topId} customColor={topColor} scale={scale} />
    </G>
  );
});

// =============================================================================
// EXPORTS
// =============================================================================

export default FullClothingSvg;
