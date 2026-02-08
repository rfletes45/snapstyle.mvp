/**
 * Skia2048Tile — Gradient-filled 2048 tile with Skia
 *
 * Renders tiles with subtle radial gradients for depth,
 * inner glow for high-value tiles, and crisp text rendering.
 */

import {
  Canvas,
  LinearGradient,
  RadialGradient,
  RoundedRect,
  Shadow,
  Text as SkiaText,
  useFont,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View, Text, Platform } from "react-native";

interface Skia2048TileProps {
  /** Tile value (2, 4, 8, 16, ...) */
  value: number;
  /** Tile size */
  size: number;
}

// Color palette matching classic 2048 but with gradient pairs
const TILE_GRADIENT_COLORS: Record<number, [string, string]> = {
  2: ["#EEE4DA", "#E4D8CC"],
  4: ["#EDE0C8", "#E0D0B4"],
  8: ["#F2B179", "#E8A060"],
  16: ["#F59563", "#E08050"],
  32: ["#F67C5F", "#E06848"],
  64: ["#F65E3B", "#E04828"],
  128: ["#EDCF72", "#DDBC58"],
  256: ["#EDCC61", "#DDBA48"],
  512: ["#EDC850", "#DDC038"],
  1024: ["#EDC53F", "#DDC028"],
  2048: ["#EDC22E", "#DDBA18"],
};

const DEFAULT_GRADIENT: [string, string] = ["#3C3A32", "#2C2A22"];

export function Skia2048Tile({ value, size }: Skia2048TileProps) {
  const [fromColor, toColor] = TILE_GRADIENT_COLORS[value] || DEFAULT_GRADIENT;
  const textColor = value <= 4 ? "#776E65" : "#F9F6F2";
  const isHighValue = value >= 128;
  const borderRadius = 6;

  const digits = value.toString().length;
  let fontSize = size * 0.45;
  if (digits === 3) fontSize = size * 0.38;
  else if (digits === 4) fontSize = size * 0.3;
  else if (digits >= 5) fontSize = size * 0.25;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Tile background with gradient */}
        <RoundedRect x={0} y={0} width={size} height={size} r={borderRadius}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(size, size)}
            colors={[fromColor, toColor]}
          />
          {/* Subtle inner shadow for depth */}
          <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.12)" inner />
        </RoundedRect>

        {/* Top highlight strip */}
        <RoundedRect
          x={1}
          y={1}
          width={size - 2}
          height={size * 0.4}
          r={borderRadius}
        >
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, size * 0.4)}
            colors={["rgba(255,255,255,0.15)", "rgba(255,255,255,0)"]}
          />
        </RoundedRect>

        {/* Glow for high-value tiles */}
        {isHighValue && (
          <RoundedRect
            x={0}
            y={0}
            width={size}
            height={size}
            r={borderRadius}
          >
            <RadialGradient
              c={vec(size / 2, size / 2)}
              r={size * 0.6}
              colors={[
                "rgba(237, 197, 63, 0.25)",
                "rgba(237, 197, 63, 0)",
              ]}
            />
          </RoundedRect>
        )}
      </Canvas>

      {/* Text value — using RN Text for reliable cross-platform rendering */}
      <View style={styles.textContainer}>
        <Text
          style={[
            styles.tileText,
            { color: textColor, fontSize, lineHeight: fontSize * 1.2 },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  textContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  tileText: {
    fontWeight: "800",
    textAlign: "center",
  },
});
