/**
 * Body SVG Component
 *
 * Renders the body shape including torso, neck, and arms.
 * Used when avatar is displayed in full-body mode.
 */

import type { BodyShapeId, SkinToneId } from "@/types/avatar";
import React, { memo, useMemo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

import { getBodyShapeSafe } from "@/data/avatarAssets/bodyShapes";
import { getSkinToneColors } from "@/data/avatarAssets/skinTones";

export interface BodySvgProps {
  /** Body shape ID */
  shape: BodyShapeId;
  /** Skin tone ID for coloring */
  skinTone: SkinToneId;
  /** Height scale factor (0.8 - 1.2) */
  height?: number;
  /** Whether body is visible */
  visible?: boolean;
  /** Gradient ID prefix for unique gradients */
  gradientId?: string;
}

/**
 * Body SVG Component
 *
 * Renders the avatar body with proper skin tone shading.
 * Includes torso, neck connection, and arms.
 */
function BodySvgBase({
  shape,
  skinTone,
  height = 1.0,
  visible = true,
  gradientId = "body",
}: BodySvgProps) {
  // Get body shape data
  const bodyShape = useMemo(() => getBodyShapeSafe(shape), [shape]);

  // Get skin tone colors
  const skinColors = useMemo(() => getSkinToneColors(skinTone), [skinTone]);

  // Calculate height transformation
  const heightTransform = useMemo(() => {
    if (height === 1.0) return undefined;
    // Scale from the top of the body area (y=175)
    const scaleY = height;
    return `translate(0, ${175 * (1 - scaleY)}) scale(1, ${scaleY})`;
  }, [height]);

  if (!visible) {
    return null;
  }

  return (
    <G id="body-svg" transform={heightTransform}>
      {/* Gradient Definitions */}
      <Defs>
        {/* Torso gradient */}
        <LinearGradient
          id={`${gradientId}-torso`}
          x1="0"
          y1="0"
          x2="1"
          y2="0.5"
        >
          <Stop offset="0%" stopColor={skinColors.shadow} />
          <Stop offset="30%" stopColor={skinColors.base} />
          <Stop offset="70%" stopColor={skinColors.base} />
          <Stop offset="100%" stopColor={skinColors.shadow} />
        </LinearGradient>

        {/* Arm gradient (left) */}
        <LinearGradient
          id={`${gradientId}-arm-left`}
          x1="1"
          y1="0"
          x2="0"
          y2="0.5"
        >
          <Stop offset="0%" stopColor={skinColors.base} />
          <Stop offset="50%" stopColor={skinColors.shadow} />
          <Stop offset="100%" stopColor={skinColors.shadow} />
        </LinearGradient>

        {/* Arm gradient (right) */}
        <LinearGradient
          id={`${gradientId}-arm-right`}
          x1="0"
          y1="0"
          x2="1"
          y2="0.5"
        >
          <Stop offset="0%" stopColor={skinColors.base} />
          <Stop offset="50%" stopColor={skinColors.shadow} />
          <Stop offset="100%" stopColor={skinColors.shadow} />
        </LinearGradient>

        {/* Neck gradient */}
        <LinearGradient
          id={`${gradientId}-neck`}
          x1="0.5"
          y1="0"
          x2="0.5"
          y2="1"
        >
          <Stop offset="0%" stopColor={skinColors.base} />
          <Stop offset="100%" stopColor={skinColors.shadow} />
        </LinearGradient>
      </Defs>

      {/* Torso - rendered first as base layer */}
      <Path
        d={bodyShape.torsoPath}
        fill={`url(#${gradientId}-torso)`}
        stroke={skinColors.shadow}
        strokeWidth={0.5}
      />

      {/* Left Arm */}
      <Path
        d={bodyShape.leftArmPath}
        fill={`url(#${gradientId}-arm-left)`}
        stroke={skinColors.shadow}
        strokeWidth={0.5}
      />

      {/* Right Arm */}
      <Path
        d={bodyShape.rightArmPath}
        fill={`url(#${gradientId}-arm-right)`}
        stroke={skinColors.shadow}
        strokeWidth={0.5}
      />

      {/* Neck connection - rendered after torso */}
      <Path
        d={bodyShape.neckPath}
        fill={`url(#${gradientId}-neck)`}
        stroke={skinColors.shadow}
        strokeWidth={0.3}
      />
    </G>
  );
}

export const BodySvg = memo(BodySvgBase);

// =============================================================================
// NECK-ONLY COMPONENT (for head-only mode)
// =============================================================================

export interface NeckSvgProps {
  /** Skin tone ID for coloring */
  skinTone: SkinToneId;
  /** Whether neck is visible */
  visible?: boolean;
  /** Gradient ID prefix */
  gradientId?: string;
}

/**
 * Standalone neck component for head-only avatar mode
 */
function NeckSvgBase({
  skinTone,
  visible = true,
  gradientId = "neck",
}: NeckSvgProps) {
  const skinColors = useMemo(() => getSkinToneColors(skinTone), [skinTone]);

  if (!visible) {
    return null;
  }

  // Simple neck path for head-only mode
  const neckPath = `
    M85,175 
    L85,200 
    Q100,210 115,200 
    L115,175 
    Q100,180 85,175 
    Z
  `;

  return (
    <G id="neck-svg">
      <Defs>
        <LinearGradient
          id={`${gradientId}-fill`}
          x1="0.5"
          y1="0"
          x2="0.5"
          y2="1"
        >
          <Stop offset="0%" stopColor={skinColors.base} />
          <Stop offset="100%" stopColor={skinColors.shadow} />
        </LinearGradient>
      </Defs>

      <Path
        d={neckPath}
        fill={`url(#${gradientId}-fill)`}
        stroke={skinColors.shadow}
        strokeWidth={0.3}
      />
    </G>
  );
}

export const NeckSvg = memo(NeckSvgBase);
