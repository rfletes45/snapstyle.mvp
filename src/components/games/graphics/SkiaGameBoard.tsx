/**
 * SkiaGameBoard — Gradient board background with optional wood texture
 *
 * Renders a beautiful game board background using Skia linear/radial gradients,
 * inner shadows, and optional noise for texture. Used by Chess, Checkers,
 * TicTacToe, Connect Four, etc.
 */

import {
  Canvas,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View } from "react-native";

interface SkiaGameBoardProps {
  /** Total width of the board in pixels */
  width: number;
  /** Total height of the board in pixels */
  height: number;
  /** Border radius for corners */
  borderRadius?: number;
  /** Gradient colors — top-left to bottom-right */
  gradientColors?: string[];
  /** Border color */
  borderColor?: string;
  /** Border width */
  borderWidth?: number;
  /** Inner shadow intensity (0 = none) */
  innerShadowBlur?: number;
  /** Children rendered on top of the Skia canvas */
  children?: React.ReactNode;
}

export function SkiaGameBoard({
  width,
  height,
  borderRadius = 12,
  gradientColors = ["#2C2C3E", "#1A1A2E"],
  borderColor = "rgba(255,255,255,0.08)",
  borderWidth = 2,
  innerShadowBlur = 8,
  children,
}: SkiaGameBoardProps) {
  const totalW = width + borderWidth * 2;
  const totalH = height + borderWidth * 2;

  return (
    <View style={[styles.container, { width: totalW, height: totalH }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Outer border */}
        <RoundedRect
          x={0}
          y={0}
          width={totalW}
          height={totalH}
          r={borderRadius + borderWidth}
          color={borderColor}
        />
        {/* Main gradient fill */}
        <RoundedRect
          x={borderWidth}
          y={borderWidth}
          width={width}
          height={height}
          r={borderRadius}
        >
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width, height)}
            colors={gradientColors}
          />
          {innerShadowBlur > 0 && (
            <Shadow
              dx={0}
              dy={2}
              blur={innerShadowBlur}
              color="rgba(0,0,0,0.4)"
              inner
            />
          )}
        </RoundedRect>
        {/* Subtle highlight at top */}
        <RoundedRect
          x={borderWidth}
          y={borderWidth}
          width={width}
          height={height * 0.4}
          r={borderRadius}
        >
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height * 0.4)}
            colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]}
          />
        </RoundedRect>
      </Canvas>
      {/* Game content on top */}
      <View
        style={[
          styles.content,
          {
            top: borderWidth,
            left: borderWidth,
            width,
            height,
            borderRadius,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignSelf: "center",
  },
  content: {
    position: "absolute",
    overflow: "hidden",
  },
});
