/**
 * Headwear SVG Component
 *
 * Renders headwear accessories including hats, caps, beanies,
 * headbands, crowns, and special items.
 */

import { getHeadwearSafe } from "@/data/avatarAssets/headwear";
import React, { memo, useMemo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

interface HeadwearSvgProps {
  /** Headwear item ID */
  itemId: string | null | undefined;
  /** Custom primary color (for colorizable items) */
  customColor?: string | null;
  /** Whether the avatar is wearing this with hair that might be affected */
  hairVisible?: boolean;
  /** Unique gradient ID prefix */
  gradientId?: string;
}

/**
 * HeadwearSvg Component
 *
 * Renders headwear accessories on the avatar.
 * Handles color customization for colorizable items.
 */
function HeadwearSvgBase({
  itemId,
  customColor,
  gradientId = "headwear",
}: HeadwearSvgProps) {
  // Get headwear data
  const headwear = useMemo(() => getHeadwearSafe(itemId), [itemId]);

  // Don't render if no headwear or headwear_none
  if (!itemId || headwear.id === "headwear_none" || !headwear.paths.main) {
    return null;
  }

  // Determine colors to use
  const primaryColor =
    customColor && headwear.colorizable ? customColor : headwear.colors.primary;
  const secondaryColor = headwear.colors.secondary || primaryColor;
  const accentColor = headwear.colors.accent || secondaryColor;

  // Generate gradient colors (slightly lighter/darker variants)
  const highlightColor = lightenColor(primaryColor, 15);
  const shadowColor = darkenColor(primaryColor, 15);

  return (
    <G id={`headwear-${headwear.id}`}>
      <Defs>
        {/* Primary gradient for main shape */}
        <LinearGradient
          id={`${gradientId}-primary`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <Stop offset="0%" stopColor={highlightColor} />
          <Stop offset="50%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={shadowColor} />
        </LinearGradient>

        {/* Secondary gradient for details */}
        <LinearGradient
          id={`${gradientId}-secondary`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <Stop offset="0%" stopColor={lightenColor(secondaryColor, 10)} />
          <Stop offset="100%" stopColor={secondaryColor} />
        </LinearGradient>
      </Defs>

      {/* Back layer (if exists) - renders behind head */}
      {headwear.paths.back && (
        <Path
          d={headwear.paths.back}
          fill={`url(#${gradientId}-primary)`}
          opacity={0.9}
        />
      )}

      {/* Shadow layer */}
      {headwear.paths.shadow && (
        <Path d={headwear.paths.shadow} fill={shadowColor} opacity={0.3} />
      )}

      {/* Main headwear shape */}
      <Path d={headwear.paths.main} fill={`url(#${gradientId}-primary)`} />

      {/* Details layer */}
      {headwear.paths.details && (
        <Path
          d={headwear.paths.details}
          fill={secondaryColor}
          stroke={accentColor !== secondaryColor ? accentColor : undefined}
          strokeWidth={accentColor !== secondaryColor ? 0.5 : 0}
        />
      )}
    </G>
  );
}

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  if (hex === "transparent") return hex;

  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);

  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  if (hex === "transparent") return hex;

  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);

  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}

export const HeadwearSvg = memo(HeadwearSvgBase);

/**
 * Get hair interaction mode for a headwear item
 * Useful for determining how to render hair underneath
 */
export function getHeadwearHairInteraction(
  itemId: string | null | undefined,
): "hide" | "partial" | "none" {
  const headwear = getHeadwearSafe(itemId);
  return headwear.hairInteraction;
}

/**
 * Check if headwear covers hair completely
 */
export function doesHeadwearHideHair(
  itemId: string | null | undefined,
): boolean {
  return getHeadwearHairInteraction(itemId) === "hide";
}

/**
 * Check if headwear partially covers hair
 */
export function doesHeadwearPartiallyHideHair(
  itemId: string | null | undefined,
): boolean {
  return getHeadwearHairInteraction(itemId) === "partial";
}
