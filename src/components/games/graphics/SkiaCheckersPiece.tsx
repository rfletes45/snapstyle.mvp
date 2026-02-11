/**
 * SkiaCheckersPiece — Glossy 3D checker disc with Skia
 *
 * Renders a realistic checker piece with:
 * - Radial gradient for glossy 3D appearance
 * - Specular highlight on top
 * - Soft drop shadow
 * - Optional king crown SVG
 *
 * On web, falls back to CSS-styled View since Skia Canvas is not available.
 */

import {
  Canvas,
  Circle,
  RadialGradient,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";

interface SkiaCheckersPieceProps {
  /** Diameter of the piece */
  size: number;
  /** "red" | "black" */
  color: "red" | "black";
  /** Whether this piece is a king */
  isKing?: boolean;
  /** Whether this piece is selected (adds glow) */
  isSelected?: boolean;
}

const RED_COLORS = {
  outer: "#CC2233",
  center: "#EE4455",
  highlight: "#FF8899",
  ring: "#AA1122",
};

const BLACK_COLORS = {
  outer: "#1A1A2E",
  center: "#3A3A4E",
  highlight: "#6A6A7E",
  ring: "#0A0A1E",
};

export function SkiaCheckersPiece({
  size,
  color,
  isKing = false,
  isSelected = false,
}: SkiaCheckersPieceProps) {
  // On web, Skia Canvas is shimmed to a plain View that renders nothing
  // visible, so use a CSS-based fallback instead.
  if (Platform.OS === "web") {
    return (
      <WebCheckersPiece
        size={size}
        color={color}
        isKing={isKing}
        isSelected={isSelected}
      />
    );
  }

  const colors = color === "red" ? RED_COLORS : BLACK_COLORS;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.44;
  const innerRadius = radius * 0.75;
  const highlightRadius = radius * 0.35;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Drop shadow */}
        <Circle cx={cx} cy={cy + 2} r={radius} color="rgba(0,0,0,0.4)">
          <Shadow dx={0} dy={3} blur={6} color="rgba(0,0,0,0.5)" />
        </Circle>

        {/* Main disc — radial gradient for 3D curvature */}
        <Circle cx={cx} cy={cy} r={radius}>
          <RadialGradient
            c={vec(cx - radius * 0.2, cy - radius * 0.2)}
            r={radius * 1.2}
            colors={[colors.center, colors.outer]}
          />
        </Circle>

        {/* Inner ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={innerRadius}
          color="transparent"
          style="stroke"
          strokeWidth={1.5}
        >
          <RadialGradient
            c={vec(cx, cy)}
            r={innerRadius}
            colors={[colors.ring + "60", colors.ring + "20"]}
          />
        </Circle>

        {/* Specular highlight — top-left */}
        <Circle
          cx={cx - radius * 0.15}
          cy={cy - radius * 0.2}
          r={highlightRadius}
        >
          <RadialGradient
            c={vec(cx - radius * 0.15, cy - radius * 0.25)}
            r={highlightRadius}
            colors={[colors.highlight + "50", colors.highlight + "00"]}
          />
        </Circle>

        {/* Selection glow */}
        {isSelected && (
          <Circle
            cx={cx}
            cy={cy}
            r={radius + 3}
            color="transparent"
            style="stroke"
            strokeWidth={3}
          >
            <RadialGradient
              c={vec(cx, cy)}
              r={radius + 4}
              colors={["#FFD700AA", "#FFD70044"]}
            />
          </Circle>
        )}
      </Canvas>

      {/* King crown — SVG overlay */}
      {isKing && <KingCrown size={size} cx={cx} cy={cy} />}
    </View>
  );
}

// =============================================================================
// King Crown (shared between native & web)
// =============================================================================

function KingCrown({ size, cx, cy }: { size: number; cx: number; cy: number }) {
  return (
    <View
      style={[
        styles.crownContainer,
        { top: cy - size * 0.2, left: cx - size * 0.18 },
      ]}
    >
      <Svg width={size * 0.36} height={size * 0.28} viewBox="0 0 36 28">
        <Defs>
          <SvgLinearGradient id="crownGold" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFD700" />
            <Stop offset="100%" stopColor="#FFA500" />
          </SvgLinearGradient>
        </Defs>
        <Path
          d="M2 24L6 8L12 16L18 4L24 16L30 8L34 24Z"
          fill="url(#crownGold)"
          stroke="#CC8800"
          strokeWidth={1}
          strokeLinejoin="round"
        />
        {/* Crown jewels */}
        <Path d="M6 24h24v2H6z" fill="#CC8800" />
      </Svg>
    </View>
  );
}

// =============================================================================
// Web Fallback — CSS-based checker piece
// =============================================================================

function WebCheckersPiece({
  size,
  color,
  isKing,
  isSelected,
}: SkiaCheckersPieceProps) {
  const colors = color === "red" ? RED_COLORS : BLACK_COLORS;
  const radius = size * 0.44;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Selection glow ring */}
      {isSelected && (
        <View
          style={[
            webStyles.selectionGlow,
            {
              width: radius * 2 + 8,
              height: radius * 2 + 8,
              borderRadius: radius + 4,
            },
          ]}
        />
      )}
      {/* Main disc with gradient-like effect using layered views */}
      <View
        style={[
          webStyles.shadow,
          {
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
          },
        ]}
      />
      <View
        style={[
          webStyles.disc,
          {
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
            backgroundColor: colors.outer,
            borderColor: colors.ring,
          },
        ]}
      >
        {/* Inner lighter circle for 3D effect */}
        <View
          style={[
            webStyles.innerDisc,
            {
              width: radius * 1.5,
              height: radius * 1.5,
              borderRadius: radius * 0.75,
              backgroundColor: colors.center,
            },
          ]}
        />
        {/* Specular highlight */}
        <View
          style={[
            webStyles.highlight,
            {
              width: radius * 0.7,
              height: radius * 0.5,
              borderRadius: radius * 0.35,
              top: radius * 0.2,
              left: radius * 0.35,
            },
          ]}
        />
      </View>
      {/* King crown */}
      {isKing && <KingCrown size={size} cx={cx} cy={cy} />}
    </View>
  );
}

const webStyles = StyleSheet.create({
  selectionGlow: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  shadow: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.3)",
    top: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  disc: {
    position: "absolute",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  innerDisc: {
    position: "absolute",
  },
  highlight: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
});

const styles = StyleSheet.create({
  crownContainer: {
    position: "absolute",
  },
});
