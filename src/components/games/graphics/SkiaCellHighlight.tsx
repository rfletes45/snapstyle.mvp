/**
 * SkiaCellHighlight — Skia-powered cell highlight for board games
 *
 * Renders soft glowing highlights for selected cells, valid moves,
 * last moves, and check indicators. Used by Chess, Checkers, etc.
 *
 * On web, falls back to a simple semi-transparent View overlay.
 */

import {
  Canvas,
  RadialGradient,
  RoundedRect,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

interface SkiaCellHighlightProps {
  /** Cell width */
  width: number;
  /** Cell height */
  height: number;
  /** Highlight type */
  type: "selected" | "validMove" | "lastMove" | "check" | "capture" | "winning";
}

const HIGHLIGHT_CONFIGS: Record<
  SkiaCellHighlightProps["type"],
  { center: string; edge: string }
> = {
  selected: {
    center: "rgba(255, 215, 0, 0.55)",
    edge: "rgba(255, 215, 0, 0.15)",
  },
  validMove: {
    center: "rgba(76, 175, 80, 0.5)",
    edge: "rgba(76, 175, 80, 0.1)",
  },
  lastMove: {
    center: "rgba(155, 199, 0, 0.45)",
    edge: "rgba(155, 199, 0, 0.1)",
  },
  check: {
    center: "rgba(244, 67, 54, 0.65)",
    edge: "rgba(244, 67, 54, 0.15)",
  },
  capture: {
    center: "rgba(255, 107, 107, 0.5)",
    edge: "rgba(255, 107, 107, 0.1)",
  },
  winning: {
    center: "rgba(255, 215, 0, 0.6)",
    edge: "rgba(255, 215, 0, 0.15)",
  },
};

export function SkiaCellHighlight({
  width,
  height,
  type,
}: SkiaCellHighlightProps) {
  const config = HIGHLIGHT_CONFIGS[type];

  // On web, Skia Canvas is shimmed out — use a plain colored View overlay
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { width, height, backgroundColor: config.center },
        ]}
        pointerEvents="none"
      />
    );
  }

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.max(width, height) * 0.7;

  return (
    <Canvas
      style={[StyleSheet.absoluteFill, { width, height }]}
      pointerEvents="none"
    >
      <RoundedRect x={0} y={0} width={width} height={height} r={0}>
        <RadialGradient
          c={vec(cx, cy)}
          r={r}
          colors={[config.center, config.edge]}
        />
      </RoundedRect>
    </Canvas>
  );
}
