/**
 * SkiaDisc — Glossy Connect Four disc with Skia radial gradient
 *
 * Renders a realistic plastic disc with specular highlight,
 * radial gradient for 3D curvature, and a soft shadow.
 */

import {
  Canvas,
  Circle,
  RadialGradient,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";

interface SkiaDiscProps {
  /** Diameter of the disc */
  size: number;
  /** Fill color — null for empty slot */
  color: string | null;
  /** Background color for empty slots */
  emptyColor?: string;
  /** Whether this disc is part of the winning four */
  isWinning?: boolean;
}

const EMPTY_COLORS = {
  outer: "rgba(0,0,0,0.15)",
  inner: "rgba(0,0,0,0.08)",
};

export function SkiaDisc({
  size,
  color,
  emptyColor = "#1a1a2e",
  isWinning = false,
}: SkiaDiscProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;

  if (!color) {
    // Empty slot — dark hole effect
    return (
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={cx} cy={cy} r={radius}>
          <RadialGradient
            c={vec(cx, cy)}
            r={radius}
            colors={[EMPTY_COLORS.inner, EMPTY_COLORS.outer]}
          />
          <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.3)" inner />
        </Circle>
      </Canvas>
    );
  }

  // Derive gradient colors from the base color
  const lighterColor = lighten(color, 0.3);
  const darkerColor = darken(color, 0.25);
  const highlightColor = lighten(color, 0.6);

  return (
    <Canvas style={{ width: size, height: size }}>
      {/* Shadow under disc */}
      <Circle cx={cx} cy={cy + 1} r={radius} color={darkerColor}>
        <Shadow dx={0} dy={2} blur={4} color="rgba(0,0,0,0.35)" />
      </Circle>

      {/* Main disc body — radial gradient for 3D sphere look */}
      <Circle cx={cx} cy={cy} r={radius}>
        <RadialGradient
          c={vec(cx - radius * 0.2, cy - radius * 0.25)}
          r={radius * 1.4}
          colors={[lighterColor, color, darkerColor]}
        />
      </Circle>

      {/* Specular highlight */}
      <Circle cx={cx - radius * 0.15} cy={cy - radius * 0.2} r={radius * 0.3}>
        <RadialGradient
          c={vec(cx - radius * 0.15, cy - radius * 0.25)}
          r={radius * 0.3}
          colors={[highlightColor + "70", highlightColor + "00"]}
        />
      </Circle>

      {/* Winning glow ring */}
      {isWinning && (
        <Circle
          cx={cx}
          cy={cy}
          r={radius + 2}
          color="transparent"
          style="stroke"
          strokeWidth={3}
        >
          <RadialGradient
            c={vec(cx, cy)}
            r={radius + 3}
            colors={["#FFD700CC", "#FFD70033"]}
          />
        </Circle>
      )}
    </Canvas>
  );
}

// ── Color utilities ──────────────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, Math.round(r + (255 - r) * amount)),
    Math.min(255, Math.round(g + (255 - g) * amount)),
    Math.min(255, Math.round(b + (255 - b) * amount)),
  );
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.max(0, Math.round(r * (1 - amount))),
    Math.max(0, Math.round(g * (1 - amount))),
    Math.max(0, Math.round(b * (1 - amount))),
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}
