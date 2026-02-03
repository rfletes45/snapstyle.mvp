/**
 * Mouth SVG Component
 *
 * Renders the mouth with customizable style, size, lip color, and thickness.
 */

import { getLipColor, getMouthStyle } from "@/data/avatarAssets/mouthStyles";
import type { LipColorId, MouthStyleId } from "@/types/avatar";
import React, { memo } from "react";
import { Defs, G, LinearGradient, Path, Stop } from "react-native-svg";

interface MouthSvgProps {
  /** Mouth style ID */
  style: MouthStyleId;
  /** Size scale factor (0.8 - 1.2) */
  size?: number;
  /** Lip color ID */
  lipColor: LipColorId;
  /** Lip thickness scale (0.8 - 1.2) */
  lipThickness?: number;
  /** Unique ID prefix for gradients */
  gradientId?: string;
}

// Mouth center position (in 200x300 viewBox)
const MOUTH_CENTER = { x: 100, y: 155 };

/**
 * Mouth SVG Component
 */
function MouthSvgBase({
  style,
  size = 1.0,
  lipColor,
  lipThickness = 1.0,
  gradientId = "mouth",
}: MouthSvgProps) {
  const mouthStyle = getMouthStyle(style);
  const lipColorData = getLipColor(lipColor);

  // Combine size and thickness for overall scale
  const scaleX = size;
  const scaleY = size * lipThickness;

  // Darker shade for lip outline/shadow
  const lipShadow = adjustColorBrightness(lipColorData.color, -30);

  return (
    <G id="mouth-layer">
      {/* Gradient definitions */}
      <Defs>
        <LinearGradient id={`${gradientId}-lip`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={lipColorData.color} />
          <Stop offset="100%" stopColor={lipShadow} />
        </LinearGradient>
      </Defs>

      <G
        transform={`translate(${MOUTH_CENTER.x}, ${MOUTH_CENTER.y}) scale(${scaleX}, ${scaleY})`}
      >
        {/* Teeth (if mouth is open) */}
        {mouthStyle.teethPath && (
          <Path
            d={mouthStyle.teethPath}
            fill="#FFFFFF"
            stroke="#E8E8E8"
            strokeWidth={0.3}
          />
        )}

        {/* Lower lip (rendered first, behind upper) */}
        <Path
          d={mouthStyle.lowerLipPath}
          fill={`url(#${gradientId}-lip)`}
          stroke={lipShadow}
          strokeWidth={0.3}
        />

        {/* Upper lip */}
        <Path
          d={mouthStyle.upperLipPath}
          fill={`url(#${gradientId}-lip)`}
          stroke={lipShadow}
          strokeWidth={0.3}
        />

        {/* Lip highlight (glossy effect) */}
        {lipColorData.glossy && (
          <Path
            d="M-8,-2 Q0,-4 8,-2"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1}
            strokeLinecap="round"
            opacity={0.3}
          />
        )}

        {/* Mouth line/separation */}
        <Path
          d="M-12,0 Q0,2 12,0"
          fill="none"
          stroke={lipShadow}
          strokeWidth={0.5}
          opacity={0.5}
        />
      </G>
    </G>
  );
}

/**
 * Adjust color brightness
 * @param hex - Hex color string
 * @param amount - Amount to adjust (-255 to 255)
 */
function adjustColorBrightness(hex: string, amount: number): string {
  // Remove # if present
  const color = hex.replace("#", "");

  // Parse RGB
  const r = Math.max(
    0,
    Math.min(255, parseInt(color.substring(0, 2), 16) + amount),
  );
  const g = Math.max(
    0,
    Math.min(255, parseInt(color.substring(2, 4), 16) + amount),
  );
  const b = Math.max(
    0,
    Math.min(255, parseInt(color.substring(4, 6), 16) + amount),
  );

  // Convert back to hex
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export const MouthSvg = memo(MouthSvgBase);
