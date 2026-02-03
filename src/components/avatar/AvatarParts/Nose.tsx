/**
 * Nose SVG Component
 *
 * Renders the nose with customizable style and size.
 */

import { getNoseStyle } from "@/data/avatarAssets/noseStyles";
import { getSkinToneColors } from "@/data/avatarAssets/skinTones";
import type { NoseStyleId, SkinToneId } from "@/types/avatar";
import React, { memo } from "react";
import { G, Path } from "react-native-svg";

interface NoseSvgProps {
  /** Nose style ID */
  style: NoseStyleId;
  /** Size scale factor (0.8 - 1.2) */
  size?: number;
  /** Skin tone for shading */
  skinTone: SkinToneId;
}

// Nose center position (in 200x300 viewBox)
const NOSE_CENTER = { x: 100, y: 115 };

/**
 * Nose SVG Component
 */
function NoseSvgBase({ style, size = 1.0, skinTone }: NoseSvgProps) {
  const noseStyle = getNoseStyle(style);
  const skinColors = getSkinToneColors(skinTone);

  // Adjust size by nose style length
  const effectiveScale = size * noseStyle.length;

  return (
    <G id="nose-layer">
      <G
        transform={`translate(${NOSE_CENTER.x}, ${NOSE_CENTER.y}) scale(${effectiveScale})`}
      >
        {/* Main nose shape - shadow/outline */}
        <Path
          d={noseStyle.svgPath}
          fill={skinColors.base}
          stroke={skinColors.shadow}
          strokeWidth={0.5}
          opacity={0.9}
        />

        {/* Nostril shadows */}
        <Path
          d="M-4,4 Q-2,6 -4,6 Q-6,6 -4,4 Z"
          fill={skinColors.shadow}
          opacity={0.5}
        />
        <Path
          d="M4,4 Q6,6 4,6 Q2,6 4,4 Z"
          fill={skinColors.shadow}
          opacity={0.5}
        />

        {/* Nose bridge highlight */}
        <Path
          d="M-1,-8 L1,-8 L1,0 L-1,0 Z"
          fill={skinColors.highlight}
          opacity={0.3}
        />
      </G>
    </G>
  );
}

export const NoseSvg = memo(NoseSvgBase);
