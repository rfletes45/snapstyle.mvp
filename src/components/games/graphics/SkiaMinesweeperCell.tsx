/**
 * SkiaMinesweeperCell — 3D raised/revealed cell for Minesweeper
 *
 * Renders a realistic 3D raised button using Skia gradients instead of
 * the flat multi-color border hack. Revealed cells are flat with a
 * subtle inner shadow.
 */

import {
  Canvas,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View } from "react-native";

interface SkiaMinesweeperCellProps {
  /** Cell size (width === height) */
  size: number;
  /** Whether the cell is revealed */
  revealed: boolean;
  /** Background color for the unrevealed cell */
  unrevealedColor?: string;
  /** Background color for the revealed cell */
  revealedColor?: string;
  /** Whether this is a mine that was clicked */
  isMineExploded?: boolean;
  /** Children (number text, flag, mine icons) */
  children?: React.ReactNode;
}

export function SkiaMinesweeperCell({
  size,
  revealed,
  unrevealedColor = "#8A8AA0",
  revealedColor = "#E0E0E0",
  isMineExploded = false,
  children,
}: SkiaMinesweeperCellProps) {
  const inset = 1;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {revealed ? (
          <>
            {/* Flat revealed cell with subtle inner shadow */}
            <RoundedRect
              x={inset}
              y={inset}
              width={size - inset * 2}
              height={size - inset * 2}
              r={1}
              color={isMineExploded ? "#FF4444" : revealedColor}
            >
              <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.15)" inner />
            </RoundedRect>
            {/* Thin border */}
            <RoundedRect
              x={inset}
              y={inset}
              width={size - inset * 2}
              height={size - inset * 2}
              r={1}
              color="rgba(0,0,0,0.1)"
              style="stroke"
              strokeWidth={0.5}
            />
          </>
        ) : (
          <>
            {/* 3D raised cell — gradient from light top-left to dark bottom-right */}
            <RoundedRect
              x={inset}
              y={inset}
              width={size - inset * 2}
              height={size - inset * 2}
              r={2}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(size, size)}
                colors={[
                  lightenHex(unrevealedColor, 0.2),
                  unrevealedColor,
                  darkenHex(unrevealedColor, 0.15),
                ]}
              />
              <Shadow dx={-1} dy={-1} blur={1} color="rgba(255,255,255,0.3)" />
              <Shadow dx={1} dy={1} blur={2} color="rgba(0,0,0,0.3)" />
            </RoundedRect>
            {/* Top-left highlight edge */}
            <RoundedRect
              x={inset}
              y={inset}
              width={size - inset * 2}
              height={(size - inset * 2) * 0.45}
              r={2}
            >
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, size * 0.45)}
                colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
              />
            </RoundedRect>
          </>
        )}
      </Canvas>
      {/* Content (numbers, flags, mines) */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function lightenHex(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  return toHex(
    Math.min(255, Math.round(r + (255 - r) * amount)),
    Math.min(255, Math.round(g + (255 - g) * amount)),
    Math.min(255, Math.round(b + (255 - b) * amount)),
  );
}

function darkenHex(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  return toHex(
    Math.max(0, Math.round(r * (1 - amount))),
    Math.max(0, Math.round(g * (1 - amount))),
    Math.max(0, Math.round(b * (1 - amount))),
  );
}

function parseHex(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
