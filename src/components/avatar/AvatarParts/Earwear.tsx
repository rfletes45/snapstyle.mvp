/**
 * Earwear Component
 *
 * Renders earwear items including studs, hoops, dangle earrings,
 * ear cuffs, and special ear accessories.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

import React, { memo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

import { EarwearData, getEarwearSafe } from "@/data/avatarAssets/earwear";

// =============================================================================
// TYPES
// =============================================================================

export interface EarwearProps {
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
 * Check if earwear is a hoop style
 */
export function isHoopEarwear(itemId: string | null): boolean {
  if (!itemId) return false;
  const earwear = getEarwearSafe(itemId);
  return earwear.category === "hoop";
}

/**
 * Check if earwear is a dangle style
 */
export function isDangleEarwear(itemId: string | null): boolean {
  if (!itemId) return false;
  const earwear = getEarwearSafe(itemId);
  return earwear.category === "dangle";
}

/**
 * Check if earwear is a stud style
 */
export function isStudEarwear(itemId: string | null): boolean {
  if (!itemId) return false;
  const earwear = getEarwearSafe(itemId);
  return earwear.category === "stud";
}

// =============================================================================
// EARWEAR COMPONENT
// =============================================================================

export const EarwearSvg = memo(function EarwearSvg({
  itemId,
  customColor,
  gradientId = "earwearGradient",
}: EarwearProps) {
  // Handle no earwear or none selected
  if (!itemId || itemId === "earwear_none") {
    return null;
  }

  const earwear: EarwearData = getEarwearSafe(itemId);

  // Skip if earwear has no paths
  if (!earwear.paths.left.main && !earwear.paths.right.main) {
    return null;
  }

  // Determine colors
  const primaryColor =
    customColor && earwear.colorizable ? customColor : earwear.colors.primary;
  const secondaryColor = earwear.colors.secondary;
  const accentColor = earwear.colors.accent;

  // Generate gradient colors
  const lightColor = lightenColor(primaryColor, 20);
  const darkColor = darkenColor(primaryColor, 15);

  // Unique gradient IDs for this instance
  const mainGradientId = `${gradientId}_main`;
  const detailGradientId = `${gradientId}_detail`;
  const shineGradientId = `${gradientId}_shine`;

  // Determine if this is a metallic item (for shine effect)
  const isMetallic =
    earwear.category === "stud" ||
    earwear.category === "hoop" ||
    earwear.category === "dangle" ||
    earwear.category === "ear_cuff";

  return (
    <G>
      {/* Gradient Definitions */}
      <Defs>
        <LinearGradient id={mainGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={lightColor} />
          <Stop offset="40%" stopColor={primaryColor} />
          <Stop offset="100%" stopColor={darkColor} />
        </LinearGradient>
        {secondaryColor && (
          <LinearGradient
            id={detailGradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor={lightenColor(secondaryColor, 15)} />
            <Stop offset="100%" stopColor={darkenColor(secondaryColor, 15)} />
          </LinearGradient>
        )}
        {isMetallic && (
          <LinearGradient
            id={shineGradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.6} />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.2} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        )}
      </Defs>

      {/* LEFT EAR */}
      <G>
        {/* Main earwear shape - left */}
        {earwear.paths.left.main && (
          <Path
            d={earwear.paths.left.main}
            fill={`url(#${mainGradientId})`}
            stroke={darkColor}
            strokeWidth={0.5}
          />
        )}

        {/* Detail elements - left */}
        {earwear.paths.left.details && (
          <Path
            d={earwear.paths.left.details}
            fill={secondaryColor ? `url(#${detailGradientId})` : "none"}
            stroke={accentColor || secondaryColor || lightColor}
            strokeWidth={0.5}
            strokeLinecap="round"
          />
        )}
      </G>

      {/* RIGHT EAR */}
      <G>
        {/* Main earwear shape - right */}
        {earwear.paths.right.main && (
          <Path
            d={earwear.paths.right.main}
            fill={`url(#${mainGradientId})`}
            stroke={darkColor}
            strokeWidth={0.5}
          />
        )}

        {/* Detail elements - right */}
        {earwear.paths.right.details && (
          <Path
            d={earwear.paths.right.details}
            fill={secondaryColor ? `url(#${detailGradientId})` : "none"}
            stroke={accentColor || secondaryColor || lightColor}
            strokeWidth={0.5}
            strokeLinecap="round"
          />
        )}
      </G>

      {/* Special rendering for diamond studs - sparkle effect */}
      {itemId === "earwear_stud_diamond" && (
        <G>
          {/* Left sparkle */}
          <Path
            d="M50,93 L50,90 M48,92 L52,92"
            stroke="#67E8F9"
            strokeWidth={0.5}
            opacity={0.8}
          />
          {/* Right sparkle */}
          <Path
            d="M150,93 L150,90 M148,92 L152,92"
            stroke="#67E8F9"
            strokeWidth={0.5}
            opacity={0.8}
          />
        </G>
      )}

      {/* Special rendering for pearl studs - highlight */}
      {itemId === "earwear_stud_pearl" && (
        <G>
          <Path
            d="M49,92 Q50,91 51,92"
            stroke="#FFFFFF"
            strokeWidth={0.8}
            opacity={0.7}
            fill="none"
          />
          <Path
            d="M149,92 Q150,91 151,92"
            stroke="#FFFFFF"
            strokeWidth={0.8}
            opacity={0.7}
            fill="none"
          />
        </G>
      )}

      {/* Special rendering for wireless earbuds - LED indicator */}
      {itemId === "earwear_airpods" && (
        <G>
          <Path
            d="M48,97 Q48,96 49,97 Q48,98 48,97"
            fill="#22C55E"
            opacity={0.9}
          />
          <Path
            d="M152,97 Q152,96 153,97 Q152,98 152,97"
            fill="#22C55E"
            opacity={0.9}
          />
        </G>
      )}

      {/* Special rendering for elf ears - skin tone matching */}
      {itemId === "earwear_elf" && (
        <G>
          {/* Inner ear shadow */}
          <Path
            d="M38,82 Q37,75 35,68"
            stroke="#FCA5A5"
            strokeWidth={1}
            opacity={0.5}
            fill="none"
          />
          <Path
            d="M162,82 Q163,75 165,68"
            stroke="#FCA5A5"
            strokeWidth={1}
            opacity={0.5}
            fill="none"
          />
        </G>
      )}
    </G>
  );
});

EarwearSvg.displayName = "EarwearSvg";

export default EarwearSvg;
