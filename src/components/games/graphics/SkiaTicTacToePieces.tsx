/**
 * SkiaTicTacToePieces — SVG X and O pieces for Tic-Tac-Toe
 *
 * Renders crisp vector X and O marks using react-native-svg.
 * X: Two crossed lines with rounded caps and a subtle glow.
 * O: A smooth circle ring with gradient stroke.
 */

import React from "react";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";

interface PieceProps {
  /** Size of the piece bounding box */
  size: number;
  /** Opacity for animation (0-1) */
  opacity?: number;
}

/**
 * SVG X mark — two diagonal lines with rounded caps.
 * Uses a blue-purple gradient.
 */
export function SvgXMark({ size, opacity = 1 }: PieceProps) {
  const padding = size * 0.2;
  const strokeWidth = size * 0.12;

  return (
    <Svg width={size} height={size} style={{ opacity }}>
      <Defs>
        <SvgLinearGradient id="xGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#6C5CE7" />
          <Stop offset="100%" stopColor="#A29BFE" />
        </SvgLinearGradient>
      </Defs>
      {/* Top-left to bottom-right */}
      <Line
        x1={padding}
        y1={padding}
        x2={size - padding}
        y2={size - padding}
        stroke="url(#xGrad)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Top-right to bottom-left */}
      <Line
        x1={size - padding}
        y1={padding}
        x2={padding}
        y2={size - padding}
        stroke="url(#xGrad)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * SVG O mark — smooth circle ring with gradient stroke.
 * Uses a warm coral-pink gradient.
 */
export function SvgOMark({ size, opacity = 1 }: PieceProps) {
  const center = size / 2;
  const radius = size * 0.32;
  const strokeWidth = size * 0.1;

  return (
    <Svg width={size} height={size} style={{ opacity }}>
      <Defs>
        <SvgLinearGradient id="oGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FF6B6B" />
          <Stop offset="100%" stopColor="#FF8E8E" />
        </SvgLinearGradient>
      </Defs>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke="url(#oGrad)"
        strokeWidth={strokeWidth}
        fill="none"
      />
    </Svg>
  );
}

/**
 * Combined piece renderer.
 */
export function SkiaTicTacToePieces({
  value,
  size,
  opacity,
}: {
  value: "X" | "O";
  size: number;
  opacity?: number;
}) {
  if (value === "X") {
    return <SvgXMark size={size} opacity={opacity} />;
  }
  return <SvgOMark size={size} opacity={opacity} />;
}
