/**
 * Neckwear Component
 *
 * Renders neckwear items including necklaces, chains, scarves,
 * ties, and special accessories.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

import React, { memo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

import { getNeckwearSafe, NeckwearData } from "@/data/avatarAssets/neckwear";

// =============================================================================
// TYPES
// =============================================================================

export interface NeckwearProps {
  itemId: string | null;
  customColor?: string | null;
  gradientId?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Lighten a color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, ((num >> 16) & 0xff) + amt);
  const G = Math.min(255, ((num >> 8) & 0xff) + amt);
  const B = Math.min(255, (num & 0xff) + amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

/**
 * Darken a color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, ((num >> 16) & 0xff) - amt);
  const G = Math.max(0, ((num >> 8) & 0xff) - amt);
  const B = Math.max(0, (num & 0xff) - amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

/**
 * Check if neckwear is a tie or bowtie (formal)
 */
export function isFormalNeckwear(itemId: string | null): boolean {
  if (!itemId) return false;
  const neckwear = getNeckwearSafe(itemId);
  return neckwear.category === "tie" || neckwear.category === "bowtie";
}

/**
 * Check if neckwear is a scarf
 */
export function isScarf(itemId: string | null): boolean {
  if (!itemId) return false;
  const neckwear = getNeckwearSafe(itemId);
  return neckwear.category === "scarf";
}

/**
 * Check if neckwear is jewelry
 */
export function isJewelry(itemId: string | null): boolean {
  if (!itemId) return false;
  const neckwear = getNeckwearSafe(itemId);
  return (
    neckwear.category === "necklace" ||
    neckwear.category === "chain" ||
    neckwear.category === "choker"
  );
}

// =============================================================================
// NECKWEAR COMPONENT
// =============================================================================

export const NeckwearSvg = memo(function NeckwearSvg({
  itemId,
  customColor,
  gradientId = "neckwearGradient",
}: NeckwearProps) {
  // Handle no neckwear or none selected
  if (!itemId || itemId === "neckwear_none") {
    return null;
  }

  const neckwear: NeckwearData = getNeckwearSafe(itemId);

  // Skip if neckwear has no paths
  if (!neckwear.paths.main) {
    return null;
  }

  // Determine colors
  const primaryColor =
    customColor && neckwear.colorizable ? customColor : neckwear.colors.primary;
  const secondaryColor = neckwear.colors.secondary;
  const accentColor = neckwear.colors.accent;

  // Generate gradient colors
  const lightColor = lightenColor(primaryColor, 15);
  const darkColor = darkenColor(primaryColor, 20);

  // Unique gradient IDs for this instance
  const mainGradientId = `${gradientId}_main`;
  const shadowGradientId = `${gradientId}_shadow`;
  const detailGradientId = `${gradientId}_detail`;

  return (
    <G>
      {/* Gradient Definitions */}
      <Defs>
        <LinearGradient id={mainGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={lightColor} />
          <Stop offset="50%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={darkColor} />
        </LinearGradient>
        <LinearGradient id={shadowGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={darkColor} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={darkColor} stopOpacity={0.6} />
        </LinearGradient>
        {secondaryColor && (
          <LinearGradient
            id={detailGradientId}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <Stop offset="0%" stopColor={lightenColor(secondaryColor, 15)} />
            <Stop offset="100%" stopColor={darkenColor(secondaryColor, 15)} />
          </LinearGradient>
        )}
      </Defs>

      {/* Shadow Layer */}
      {neckwear.paths.shadow && (
        <Path
          d={neckwear.paths.shadow}
          fill={`url(#${shadowGradientId})`}
          strokeWidth={0}
        />
      )}

      {/* Main Neckwear */}
      <Path
        d={neckwear.paths.main}
        fill={`url(#${mainGradientId})`}
        stroke={darkColor}
        strokeWidth={0.5}
      />

      {/* Details Layer */}
      {neckwear.paths.details && (
        <Path
          d={neckwear.paths.details}
          fill={secondaryColor ? `url(#${detailGradientId})` : "none"}
          stroke={accentColor || secondaryColor || darkColor}
          strokeWidth={isJewelry(itemId) ? 1.5 : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Special rendering for headphones */}
      {itemId === "neckwear_headphones" && (
        <G>
          {/* Ear cup cushions */}
          <Path
            d="M63,140 Q63,135 68,135 L68,155 Q63,155 63,145 Z"
            fill="#292524"
            stroke="#1C1917"
            strokeWidth={0.5}
          />
          <Path
            d="M137,140 Q137,135 132,135 L132,155 Q137,155 137,145 Z"
            fill="#292524"
            stroke="#1C1917"
            strokeWidth={0.5}
          />
        </G>
      )}

      {/* Special rendering for medals */}
      {itemId === "neckwear_medal" && (
        <G>
          {/* Medal shine */}
          <Path
            d="M96,163 L99,166 L102,163"
            fill="none"
            stroke="#FCD34D"
            strokeWidth={1}
            opacity={0.7}
          />
          {/* Ribbon stripes */}
          <Path d="M92,142 L94,152" stroke="#DC2626" strokeWidth={1.5} />
          <Path d="M106,142 L108,152" stroke="#DC2626" strokeWidth={1.5} />
        </G>
      )}

      {/* Special rendering for ID badge */}
      {itemId === "neckwear_lanyard" && (
        <G>
          {/* Badge photo placeholder */}
          <Path
            d="M92,182 L108,182 L108,188 L92,188 Z"
            fill="#E5E7EB"
            stroke="#9CA3AF"
            strokeWidth={0.5}
          />
          {/* Badge text lines */}
          <Path d="M85,175 L115,175" stroke="#1C1917" strokeWidth={0.5} />
        </G>
      )}
    </G>
  );
});

NeckwearSvg.displayName = "NeckwearSvg";

export default NeckwearSvg;
