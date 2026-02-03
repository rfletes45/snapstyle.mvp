/**
 * Hair SVG Components
 *
 * Renders hair with a two-part system for proper layering:
 * - HairBackSvg: Renders behind the head (ponytails, back of hair)
 * - HairFrontSvg: Renders over the forehead and face edges
 *
 * Both components accept the same props for consistent styling.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 3: Hair System
 */

import { getHairGradientColors } from "@/data/avatarAssets/hairColors";
import { getHairStyleSafe } from "@/data/avatarAssets/hairStyles";
import type { HairColorId, HairStyleId } from "@/types/avatar";
import React, { memo, useMemo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

interface HairSvgProps {
  /** Hair style ID */
  style: HairStyleId;
  /** Primary hair color ID */
  color: HairColorId;
  /** Optional highlight color for streaks */
  highlightColor?: HairColorId;
  /** Size scale factor (0.8 - 1.2) */
  scale?: number;
  /** Whether to show hair (can be hidden by some hats) */
  visible?: boolean;
  /** Whether currently wearing a hat (may modify rendering) */
  wearingHat?: boolean;
  /** Unique ID prefix for gradients (to avoid conflicts) */
  gradientId?: string;
}

/**
 * Hair Back SVG Component
 *
 * Renders behind the head - includes ponytails, back of hair, etc.
 * Should be placed at Layer 2 in the avatar rendering order.
 */
function HairBackSvgBase({
  style,
  color,
  highlightColor,
  scale = 1.0,
  visible = true,
  wearingHat = false,
  gradientId = "hair-back",
}: HairSvgProps) {
  // Early return if not visible
  if (!visible) return null;

  const hairStyle = getHairStyleSafe(style);
  const hairColors = getHairGradientColors(color);
  const highlightColors = highlightColor
    ? getHairGradientColors(highlightColor)
    : null;

  // Use hat override paths if wearing hat and available
  const paths = useMemo(() => {
    if (wearingHat && hairStyle.hatOverridePaths) {
      // Hat override paths are typically front-focused, so back is minimal
      return [];
    }
    return hairStyle.backPaths;
  }, [wearingHat, hairStyle]);

  // Skip rendering if no back paths
  if (paths.length === 0) return null;

  // Calculate transform for scaling
  const transform = scale !== 1.0 ? `scale(${scale})` : undefined;
  const transformOrigin = "100 100"; // Center of head area

  return (
    <G id="hair-back" transform={transform} origin={transformOrigin}>
      {/* Gradient definitions */}
      <Defs>
        {/* Main hair gradient - top to bottom */}
        <LinearGradient
          id={`${gradientId}-gradient`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <Stop offset="0%" stopColor={hairColors.highlight} />
          <Stop offset="40%" stopColor={hairColors.base} />
          <Stop offset="100%" stopColor={hairColors.shadow} />
        </LinearGradient>

        {/* Side gradient for depth */}
        <LinearGradient
          id={`${gradientId}-side-gradient`}
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <Stop offset="0%" stopColor={hairColors.shadow} />
          <Stop offset="50%" stopColor={hairColors.base} />
          <Stop offset="100%" stopColor={hairColors.shadow} />
        </LinearGradient>

        {/* Highlight streak gradient if provided */}
        {highlightColors && (
          <LinearGradient
            id={`${gradientId}-highlight`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0%" stopColor={highlightColors.highlight} />
            <Stop offset="100%" stopColor={highlightColors.base} />
          </LinearGradient>
        )}
      </Defs>

      {/* Render back hair paths */}
      {paths.map((pathData, index) => (
        <Path
          key={`back-${index}`}
          d={pathData}
          fill={`url(#${gradientId}-gradient)`}
          stroke={hairColors.shadow}
          strokeWidth={0.5}
        />
      ))}
    </G>
  );
}

/**
 * Hair Front SVG Component
 *
 * Renders over the face - includes bangs, front strands, etc.
 * Should be placed at Layer 6 in the avatar rendering order.
 */
function HairFrontSvgBase({
  style,
  color,
  highlightColor,
  scale = 1.0,
  visible = true,
  wearingHat = false,
  gradientId = "hair-front",
}: HairSvgProps) {
  // Early return if not visible
  if (!visible) return null;

  const hairStyle = getHairStyleSafe(style);
  const hairColors = getHairGradientColors(color);
  const highlightColors = highlightColor
    ? getHairGradientColors(highlightColor)
    : null;

  // Use hat override paths if wearing hat and available
  const paths = useMemo(() => {
    if (wearingHat && hairStyle.hatOverridePaths) {
      return hairStyle.hatOverridePaths;
    }
    return hairStyle.frontPaths;
  }, [wearingHat, hairStyle]);

  // Skip rendering if no front paths
  if (paths.length === 0) return null;

  // Calculate transform for scaling
  const transform = scale !== 1.0 ? `scale(${scale})` : undefined;
  const transformOrigin = "100 100"; // Center of head area

  return (
    <G id="hair-front" transform={transform} origin={transformOrigin}>
      {/* Gradient definitions */}
      <Defs>
        {/* Main hair gradient - top to bottom */}
        <LinearGradient
          id={`${gradientId}-gradient`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <Stop offset="0%" stopColor={hairColors.highlight} />
          <Stop offset="35%" stopColor={hairColors.base} />
          <Stop offset="100%" stopColor={hairColors.shadow} />
        </LinearGradient>

        {/* Inner shadow for depth on forehead area */}
        <LinearGradient
          id={`${gradientId}-inner-shadow`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <Stop offset="0%" stopColor={hairColors.base} />
          <Stop offset="100%" stopColor={hairColors.shadow} stopOpacity={0.8} />
        </LinearGradient>

        {/* Highlight streak gradient if provided */}
        {highlightColors && (
          <LinearGradient
            id={`${gradientId}-highlight`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <Stop offset="0%" stopColor={highlightColors.highlight} />
            <Stop offset="100%" stopColor={highlightColors.base} />
          </LinearGradient>
        )}
      </Defs>

      {/* Render front hair paths */}
      {paths.map((pathData, index) => {
        // First path is typically the main hair shape
        // Additional paths are often texture/detail strokes
        const isMainPath = index === 0;
        return (
          <Path
            key={`front-${index}`}
            d={pathData}
            fill={isMainPath ? `url(#${gradientId}-gradient)` : "none"}
            stroke={isMainPath ? hairColors.shadow : hairColors.base}
            strokeWidth={isMainPath ? 0.5 : 1}
            strokeLinecap="round"
          />
        );
      })}
    </G>
  );
}

/**
 * Combined Hair Component
 *
 * Convenience component that renders both back and front hair.
 * Note: In actual avatar rendering, you should use HairBackSvg and HairFrontSvg
 * separately to place them in the correct layers.
 */
interface CombinedHairProps extends HairSvgProps {
  /** Which parts to render */
  renderParts?: "both" | "back" | "front";
}

function HairSvgBase({ renderParts = "both", ...props }: CombinedHairProps) {
  const backGradientId = `${props.gradientId || "hair"}-back`;
  const frontGradientId = `${props.gradientId || "hair"}-front`;

  return (
    <>
      {(renderParts === "both" || renderParts === "back") && (
        <HairBackSvg {...props} gradientId={backGradientId} />
      )}
      {(renderParts === "both" || renderParts === "front") && (
        <HairFrontSvg {...props} gradientId={frontGradientId} />
      )}
    </>
  );
}

// Export memoized components
export const HairBackSvg = memo(HairBackSvgBase);
export const HairFrontSvg = memo(HairFrontSvgBase);
export const HairSvg = memo(HairSvgBase);

// Type exports
export type { CombinedHairProps, HairSvgProps };
