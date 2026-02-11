/**
 * SkiaWinLine — Animated SVG line drawn across winning cells
 *
 * For Tic-Tac-Toe: draws an animated line through the three winning cells.
 * Uses react-native-svg with an animated dashOffset for a "drawing" effect.
 */

import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import Svg, {
  Defs,
  Line,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";

const AnimatedLine = Animated.createAnimatedComponent(Line);

interface SkiaWinLineProps {
  /** Width of the SVG canvas */
  width: number;
  /** Height of the SVG canvas */
  height: number;
  /** Start X coordinate */
  x1: number;
  /** Start Y coordinate */
  y1: number;
  /** End X coordinate */
  x2: number;
  /** End Y coordinate */
  y2: number;
  /** Line color or gradient */
  color?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Animation duration in ms */
  duration?: number;
}

export function SkiaWinLine({
  width,
  height,
  x1,
  y1,
  x2,
  y2,
  color = "#FFD700",
  strokeWidth = 6,
  duration = 400,
}: SkiaWinLineProps) {
  const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const dashOffset = useRef(new Animated.Value(lineLength)).current;

  useEffect(() => {
    Animated.timing(dashOffset, {
      toValue: 0,
      duration,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Svg
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <SvgLinearGradient id="winLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFD700" />
          <Stop offset="50%" stopColor="#FFA500" />
          <Stop offset="100%" stopColor="#FFD700" />
        </SvgLinearGradient>
      </Defs>
      {/* Glow layer */}
      <Line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="rgba(255, 215, 0, 0.3)"
        strokeWidth={strokeWidth * 3}
        strokeLinecap="round"
      />
      {/* Main line */}
      <AnimatedLine
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="url(#winLineGrad)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${lineLength}`}
        strokeDashoffset={dashOffset}
      />
    </Svg>
  );
}
