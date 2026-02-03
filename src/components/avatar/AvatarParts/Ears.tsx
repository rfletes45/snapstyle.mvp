/**
 * Ears SVG Component
 *
 * Renders ears with customizable style and size.
 * Ears are mirrored for left and right sides.
 */

import { getEarStyle } from "@/data/avatarAssets/earStyles";
import { getSkinToneColors } from "@/data/avatarAssets/skinTones";
import type { EarStyleId, SkinToneId } from "@/types/avatar";
import React, { memo } from "react";
import { G, Path } from "react-native-svg";

interface EarsSvgProps {
  /** Ear style ID */
  style: EarStyleId;
  /** Size scale factor (0.8 - 1.2) */
  size?: number;
  /** Skin tone for coloring */
  skinTone: SkinToneId;
  /** Whether ears are visible (may be hidden by hair) */
  visible?: boolean;
}

// Ear positions (in 200x300 viewBox)
const LEFT_EAR = { x: 28, y: 90 };
const RIGHT_EAR = { x: 172, y: 90 };

/**
 * Ears SVG Component
 */
function EarsSvgBase({
  style,
  size = 1.0,
  skinTone,
  visible = true,
}: EarsSvgProps) {
  if (!visible) {
    return null;
  }

  const earStyle = getEarStyle(style);
  const skinColors = getSkinToneColors(skinTone);

  const renderEar = (position: { x: number; y: number }, isLeft: boolean) => {
    // Mirror the ear path for right side
    const scaleX = isLeft ? 1 : -1;
    const rotation = isLeft ? -earStyle.angle : earStyle.angle;

    return (
      <G
        key={isLeft ? "left-ear" : "right-ear"}
        transform={`translate(${position.x}, ${position.y}) rotate(${rotation}) scale(${scaleX * size}, ${size})`}
      >
        {/* Main ear shape */}
        <Path
          d={earStyle.svgPath}
          fill={skinColors.base}
          stroke={skinColors.shadow}
          strokeWidth={0.5}
        />

        {/* Inner ear detail/shadow */}
        <Path
          d="M4,4 C6,0 8,4 8,10 C8,14 6,16 4,14 C2,12 2,8 4,4 Z"
          fill={skinColors.shadow}
          opacity={0.4}
        />

        {/* Ear highlight */}
        <Path
          d="M2,-2 Q4,2 2,6"
          fill="none"
          stroke={skinColors.highlight}
          strokeWidth={1}
          strokeLinecap="round"
          opacity={0.3}
        />
      </G>
    );
  };

  return (
    <G id="ears-layer">
      {renderEar(LEFT_EAR, true)}
      {renderEar(RIGHT_EAR, false)}
    </G>
  );
}

export const EarsSvg = memo(EarsSvgBase);
