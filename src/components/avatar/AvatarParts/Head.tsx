/**
 * Head/Face SVG Component
 *
 * Renders the head/face shape with skin tone gradient.
 */

import { getFaceShape } from "@/data/avatarAssets/faceShapes";
import { getSkinToneColors } from "@/data/avatarAssets/skinTones";
import type { FaceShapeId, SkinToneId } from "@/types/avatar";
import React, { memo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

interface HeadSvgProps {
  /** Face shape ID */
  shape: FaceShapeId;
  /** Face width scale (0.8 - 1.2) */
  width?: number;
  /** Skin tone ID */
  skinTone: SkinToneId;
  /** Unique ID prefix for gradients (to avoid conflicts) */
  gradientId?: string;
}

/**
 * Head/Face Shape SVG Component
 *
 * Renders the face outline with skin tone gradient for 3D effect.
 */
function HeadSvgBase({
  shape,
  width = 1.0,
  skinTone,
  gradientId = "head",
}: HeadSvgProps) {
  const faceShape = getFaceShape(shape);
  const skinColors = getSkinToneColors(skinTone);

  // Calculate scale transform for width adjustment
  const scaleX = width;
  const centerX = 100; // Face is centered at x=100 in viewBox

  return (
    <G id="head-layer">
      {/* Gradient definition for this head */}
      <Defs>
        <LinearGradient
          id={`${gradientId}-skin-gradient`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <Stop offset="0%" stopColor={skinColors.highlight} />
          <Stop offset="40%" stopColor={skinColors.base} />
          <Stop offset="100%" stopColor={skinColors.shadow} />
        </LinearGradient>
      </Defs>

      {/* Face shape with gradient fill */}
      <G
        transform={`translate(${centerX}, 0) scale(${scaleX}, 1) translate(${-centerX}, 0)`}
      >
        {/* Main face shape */}
        <Path
          d={faceShape.svgPath}
          fill={`url(#${gradientId}-skin-gradient)`}
          stroke={skinColors.shadow}
          strokeWidth={0.5}
        />

        {/* Subtle cheek highlight (optional 3D effect) */}
        <Path
          d="M60,80 Q70,90 65,100"
          fill="none"
          stroke={skinColors.highlight}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.3}
        />
        <Path
          d="M140,80 Q130,90 135,100"
          fill="none"
          stroke={skinColors.highlight}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.3}
        />
      </G>
    </G>
  );
}

export const HeadSvg = memo(HeadSvgBase);
