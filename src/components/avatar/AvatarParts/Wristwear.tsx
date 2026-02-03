/**
 * Wristwear Component
 *
 * Renders wristwear items including watches, bracelets, bangles,
 * and wrist accessories on both wrists.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

import React, { memo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

import {
  getWristwearSafe,
  hasLeftWristwear,
  hasRightWristwear,
  WristwearData,
} from "@/data/avatarAssets/wristwear";

// =============================================================================
// TYPES
// =============================================================================

export interface WristwearProps {
  itemId: string | null;
  customBandColor?: string | null;
  customFaceColor?: string | null;
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
 * Check if wristwear is a watch
 */
export function isWatch(itemId: string | null): boolean {
  if (!itemId) return false;
  const wristwear = getWristwearSafe(itemId);
  return (
    wristwear.category === "watch" ||
    wristwear.category === "smartwatch" ||
    wristwear.category === "fitness"
  );
}

/**
 * Check if wristwear is a bracelet/bangle
 */
export function isBracelet(itemId: string | null): boolean {
  if (!itemId) return false;
  const wristwear = getWristwearSafe(itemId);
  return wristwear.category === "bracelet" || wristwear.category === "bangle";
}

/**
 * Check if wristwear is metallic (for shine effects)
 */
export function isMetallicWristwear(itemId: string | null): boolean {
  if (!itemId) return false;
  return (
    itemId === "wristwear_watch_gold" ||
    itemId === "wristwear_watch_silver" ||
    itemId === "wristwear_bangle_gold" ||
    itemId === "wristwear_bangle_stack" ||
    itemId === "wristwear_bracelet_chain"
  );
}

// =============================================================================
// WRISTWEAR COMPONENT
// =============================================================================

export const WristwearSvg = memo(function WristwearSvg({
  itemId,
  customBandColor,
  customFaceColor,
  gradientId = "wristwearGradient",
}: WristwearProps) {
  // Handle no wristwear or none selected
  if (!itemId || itemId === "wristwear_none") {
    return null;
  }

  const wristwear: WristwearData = getWristwearSafe(itemId);

  // Skip if wristwear has no paths
  if (!wristwear.paths.left.band && !wristwear.paths.right.band) {
    return null;
  }

  // Determine colors
  const bandColor =
    customBandColor && wristwear.colorizable
      ? customBandColor
      : wristwear.colors.primary;
  const faceColor =
    customFaceColor && wristwear.colorizable
      ? customFaceColor
      : wristwear.colors.secondary;
  const accentColor = wristwear.colors.accent;

  // Generate gradient colors
  const bandLightColor = lightenColor(bandColor, 15);
  const bandDarkColor = darkenColor(bandColor, 20);

  // Unique gradient IDs for this instance
  const bandGradientId = `${gradientId}_band`;
  const faceGradientId = `${gradientId}_face`;
  const shineGradientId = `${gradientId}_shine`;

  const showLeftWrist = hasLeftWristwear(itemId);
  const showRightWrist = hasRightWristwear(itemId);
  const metallic = isMetallicWristwear(itemId);

  return (
    <G>
      {/* Gradient Definitions */}
      <Defs>
        <LinearGradient id={bandGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={bandLightColor} />
          <Stop offset="50%" stopColor={bandColor} />
          <Stop offset="100%" stopColor={bandDarkColor} />
        </LinearGradient>
        {faceColor && (
          <LinearGradient
            id={faceGradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor={lightenColor(faceColor, 10)} />
            <Stop offset="100%" stopColor={darkenColor(faceColor, 10)} />
          </LinearGradient>
        )}
        {metallic && (
          <LinearGradient
            id={shineGradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.5} />
            <Stop offset="40%" stopColor="#FFFFFF" stopOpacity={0.1} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        )}
      </Defs>

      {/* LEFT WRIST */}
      {showLeftWrist && wristwear.paths.left.band && (
        <G>
          {/* Band */}
          <Path
            d={wristwear.paths.left.band}
            fill={`url(#${bandGradientId})`}
            stroke={bandDarkColor}
            strokeWidth={0.5}
          />

          {/* Watch face or decoration */}
          {wristwear.paths.left.face && faceColor && (
            <Path
              d={wristwear.paths.left.face}
              fill={`url(#${faceGradientId})`}
              stroke={darkenColor(faceColor, 20)}
              strokeWidth={0.3}
            />
          )}

          {/* Details */}
          {wristwear.paths.left.details && (
            <Path
              d={wristwear.paths.left.details}
              fill="none"
              stroke={accentColor || bandDarkColor}
              strokeWidth={0.5}
              strokeLinecap="round"
            />
          )}

          {/* Metallic shine overlay */}
          {metallic && wristwear.paths.left.band && (
            <Path
              d={wristwear.paths.left.band}
              fill={`url(#${shineGradientId})`}
              strokeWidth={0}
            />
          )}
        </G>
      )}

      {/* RIGHT WRIST */}
      {showRightWrist && wristwear.paths.right.band && (
        <G>
          {/* Band */}
          <Path
            d={wristwear.paths.right.band}
            fill={`url(#${bandGradientId})`}
            stroke={bandDarkColor}
            strokeWidth={0.5}
          />

          {/* Watch face or decoration */}
          {wristwear.paths.right.face && faceColor && (
            <Path
              d={wristwear.paths.right.face}
              fill={`url(#${faceGradientId})`}
              stroke={darkenColor(faceColor, 20)}
              strokeWidth={0.3}
            />
          )}

          {/* Details */}
          {wristwear.paths.right.details && (
            <Path
              d={wristwear.paths.right.details}
              fill="none"
              stroke={accentColor || bandDarkColor}
              strokeWidth={0.5}
              strokeLinecap="round"
            />
          )}

          {/* Metallic shine overlay */}
          {metallic && wristwear.paths.right.band && (
            <Path
              d={wristwear.paths.right.band}
              fill={`url(#${shineGradientId})`}
              strokeWidth={0}
            />
          )}
        </G>
      )}

      {/* Special rendering for smartwatch - screen glow */}
      {itemId === "wristwear_smartwatch" && (
        <G>
          <Path
            d="M26,275 L34,272 L34,284 L26,287 Z"
            fill="#22C55E"
            opacity={0.15}
          />
        </G>
      )}

      {/* Special rendering for fitness band - activity indicator */}
      {itemId === "wristwear_fitness_band" && (
        <G>
          <Path d="M30,278 L30,280" stroke="#22C55E" strokeWidth={1} />
        </G>
      )}

      {/* Special rendering for gold watch - extra luxury shine */}
      {itemId === "wristwear_watch_gold" && (
        <G>
          <Path
            d="M27,276 L33,274"
            stroke="#FCD34D"
            strokeWidth={0.5}
            opacity={0.7}
          />
        </G>
      )}

      {/* Special rendering for stacked bangles - alternating colors */}
      {itemId === "wristwear_bangle_stack" && (
        <G>
          {/* Second bangle in gold */}
          <Path
            d="M165,274 Q175,272 175,276 Q165,278 165,274"
            fill="#F59E0B"
            stroke="#B45309"
            strokeWidth={0.3}
          />
          {/* Fourth bangle in rose gold */}
          <Path
            d="M165,282 Q175,280 175,284 Q165,286 165,282"
            fill="#F472B6"
            stroke="#DB2777"
            strokeWidth={0.3}
          />
        </G>
      )}
    </G>
  );
});

WristwearSvg.displayName = "WristwearSvg";

export default WristwearSvg;
