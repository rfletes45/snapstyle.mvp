/**
 * Eyewear SVG Component
 *
 * Renders eyewear accessories including glasses, sunglasses,
 * goggles, and special items.
 */

import { getEyewearSafe } from "@/data/avatarAssets/eyewear";
import React, { memo, useMemo } from "react";
import { Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

interface EyewearSvgProps {
  /** Eyewear item ID */
  itemId: string | null | undefined;
  /** Custom frame color (for colorizable items) */
  customFrameColor?: string | null;
  /** Custom lens color (for colorizable sunglasses) */
  customLensColor?: string | null;
  /** Unique gradient ID prefix */
  gradientId?: string;
}

/**
 * EyewearSvg Component
 *
 * Renders eyewear accessories on the avatar.
 * Handles frame and lens color customization.
 */
function EyewearSvgBase({
  itemId,
  customFrameColor,
  customLensColor,
  gradientId = "eyewear",
}: EyewearSvgProps) {
  // Get eyewear data
  const eyewear = useMemo(() => getEyewearSafe(itemId), [itemId]);

  // Don't render if no eyewear or eyewear_none
  if (!itemId || eyewear.id === "eyewear_none") {
    return null;
  }

  // Determine colors to use
  const frameColor =
    customFrameColor && eyewear.colorizable
      ? customFrameColor
      : eyewear.colors.frame;

  const lensColor =
    customLensColor && eyewear.lensColorOptions
      ? customLensColor
      : eyewear.lensTint || eyewear.colors.lens;

  const accentColor = eyewear.colors.accent || frameColor;

  // Generate gradient colors
  const frameHighlight = lightenColor(frameColor, 20);
  const frameShadow = darkenColor(frameColor, 15);

  return (
    <G id={`eyewear-${eyewear.id}`}>
      <Defs>
        {/* Frame gradient */}
        <LinearGradient id={`${gradientId}-frame`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={frameHighlight} />
          <Stop offset="50%" stopColor={frameColor} />
          <Stop offset="100%" stopColor={frameShadow} />
        </LinearGradient>

        {/* Lens gradient (for sunglasses with tint) */}
        {eyewear.lensOpacity > 0.1 && (
          <LinearGradient id={`${gradientId}-lens`} x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0%"
              stopColor={lightenColor(lensColor, 30)}
              stopOpacity={eyewear.lensOpacity * 0.7}
            />
            <Stop
              offset="100%"
              stopColor={lensColor}
              stopOpacity={eyewear.lensOpacity}
            />
          </LinearGradient>
        )}
      </Defs>

      {/* Lens layer (underneath frame) */}
      {eyewear.paths.lens && (
        <G id="eyewear-lenses">
          <Path
            d={eyewear.paths.lens}
            fill={
              eyewear.lensOpacity > 0.1
                ? `url(#${gradientId}-lens)`
                : eyewear.colors.lens
            }
            opacity={eyewear.lensOpacity > 0.1 ? 1 : eyewear.lensOpacity}
          />
          {/* Add slight reflection for lenses */}
          {eyewear.category === "sunglasses" && (
            <Path
              d={eyewear.paths.lens}
              fill="white"
              opacity={0.1}
              transform="translate(-2, -2) scale(0.95)"
            />
          )}
        </G>
      )}

      {/* Frame layer */}
      {eyewear.paths.frame && (
        <Path
          d={eyewear.paths.frame}
          fill={`url(#${gradientId}-frame)`}
          stroke={frameShadow}
          strokeWidth={0.5}
        />
      )}

      {/* Bridge */}
      {eyewear.paths.bridge && (
        <Path
          d={eyewear.paths.bridge}
          fill={frameColor}
          stroke={frameShadow}
          strokeWidth={0.3}
        />
      )}

      {/* Details layer (temple arms, decorations) */}
      {eyewear.paths.details && (
        <Path
          d={eyewear.paths.details}
          fill="none"
          stroke={accentColor}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      )}

      {/* Special handling for 3D glasses - left lens red, right lens blue */}
      {eyewear.id === "eyewear_3d_glasses" && (
        <G id="3d-glasses-tint">
          <Rect
            x={45}
            y={72}
            width={37}
            height={16}
            fill="#DC2626"
            opacity={0.5}
          />
          <Rect
            x={118}
            y={72}
            width={37}
            height={16}
            fill="#3B82F6"
            opacity={0.5}
          />
        </G>
      )}

      {/* Special handling for mirrored lenses - add reflection lines */}
      {eyewear.id === "eyewear_mirrored" && (
        <G id="mirror-reflections">
          <Path
            d="M55,75 L65,85 M60,72 L70,82"
            stroke="white"
            strokeWidth={1}
            opacity={0.4}
          />
          <Path
            d="M145,75 L135,85 M140,72 L130,82"
            stroke="white"
            strokeWidth={1}
            opacity={0.4}
          />
        </G>
      )}
    </G>
  );
}

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  if (hex === "transparent" || !hex.startsWith("#")) return hex;

  try {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);

    return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
  } catch {
    return hex;
  }
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  if (hex === "transparent" || !hex.startsWith("#")) return hex;

  try {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
    const B = Math.max(0, (num & 0x0000ff) - amt);

    return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
  } catch {
    return hex;
  }
}

export const EyewearSvg = memo(EyewearSvgBase);

/**
 * Check if eyewear is sunglasses (has tinted lenses)
 */
export function isSunglasses(itemId: string | null | undefined): boolean {
  const eyewear = getEyewearSafe(itemId);
  return eyewear.category === "sunglasses" || eyewear.lensOpacity > 0.5;
}

/**
 * Get lens opacity for eyewear
 */
export function getEyewearLensOpacity(
  itemId: string | null | undefined,
): number {
  const eyewear = getEyewearSafe(itemId);
  return eyewear.lensOpacity;
}
