/**
 * Facial Hair SVG Component
 *
 * Renders facial hair (mustaches, beards, etc.) with customizable style and color.
 * Uses same color system as head hair by default but can be overridden.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 3: Hair System
 */

import { getFacialHairStyleSafe } from "@/data/avatarAssets/facialHairStyles";
import { getHairGradientColors } from "@/data/avatarAssets/hairColors";
import type { FacialHairStyleId, HairColorId } from "@/types/avatar";
import React, { memo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

interface FacialHairSvgProps {
  /** Facial hair style ID */
  style: FacialHairStyleId;
  /** Facial hair color ID (usually matches hair color) */
  color: HairColorId;
  /** Thickness scale factor (0.8 - 1.2) */
  thickness?: number;
  /** Whether to show facial hair */
  visible?: boolean;
  /** Unique ID prefix for gradients */
  gradientId?: string;
}

/**
 * Facial Hair SVG Component
 *
 * Renders on the face layer, typically after mouth and before hair front.
 */
function FacialHairSvgBase({
  style,
  color,
  thickness = 1.0,
  visible = true,
  gradientId = "facial-hair",
}: FacialHairSvgProps) {
  // Early return for no facial hair or not visible
  if (!visible || style === "none") return null;

  const facialHairStyle = getFacialHairStyleSafe(style);
  const hairColors = getHairGradientColors(color);

  // Skip if no paths
  if (!facialHairStyle.mainPath) return null;

  // Combined thickness from style and user preference
  const combinedThickness = facialHairStyle.thickness * thickness;

  // Calculate anchor position
  const anchorX = 100 + facialHairStyle.anchorOffset.x;
  const anchorY = 150 + facialHairStyle.anchorOffset.y;

  // Transform for thickness adjustment
  const scaleTransform =
    combinedThickness !== 1.0
      ? `translate(${anchorX}, ${anchorY}) scale(${combinedThickness}) translate(${-anchorX}, ${-anchorY})`
      : undefined;

  return (
    <G id="facial-hair" transform={scaleTransform}>
      {/* Gradient definitions */}
      <Defs>
        {/* Main facial hair gradient */}
        <LinearGradient id={`${gradientId}-main`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={hairColors.highlight} />
          <Stop offset="40%" stopColor={hairColors.base} />
          <Stop offset="100%" stopColor={hairColors.shadow} />
        </LinearGradient>

        {/* Shadow gradient for depth */}
        <LinearGradient id={`${gradientId}-shadow`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={hairColors.base} stopOpacity={0.6} />
          <Stop offset="100%" stopColor={hairColors.shadow} stopOpacity={0.8} />
        </LinearGradient>
      </Defs>

      {/* Shadow layer for depth - render first */}
      {facialHairStyle.shadowPath && (
        <Path
          d={facialHairStyle.shadowPath}
          fill={`url(#${gradientId}-shadow)`}
          opacity={0.5}
        />
      )}

      {/* Main facial hair */}
      <Path
        d={facialHairStyle.mainPath}
        fill={`url(#${gradientId}-main)`}
        stroke={hairColors.shadow}
        strokeWidth={0.3}
        strokeLinejoin="round"
      />
    </G>
  );
}

// Export memoized component
export const FacialHairSvg = memo(FacialHairSvgBase);

// Type exports
export type { FacialHairSvgProps };
