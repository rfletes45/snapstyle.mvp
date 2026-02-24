/**
 * CardFace — Single card renderer for Crazy Cards (UNO-inspired)
 *
 * Hybrid Skia Canvas + RN Views approach:
 * - Skia renders: rounded background, inner oval, gradient, shadow
 * - RN Views render: text (center number/symbol, corner glyphs)
 *
 * Memoized by { card.id, renderState, faceDown, width, height }
 *
 * Card states:
 * - playable: glow outline, full saturation
 * - not_playable: saturation 35%, opacity 0.55
 * - selected: lift translateY, glow
 * - pressed: scale 0.97
 */

import {
  Canvas,
  LinearGradient,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import {
  ACTION_SYMBOLS,
  CARD_BORDER,
  CARD_COLORS,
  CARD_HEIGHT,
  CARD_TEXT_COLORS,
  CARD_WIDTH,
  CENTER_ACTION_SIZE,
  CENTER_NUMBER_SIZE,
  CORNER_GLYPH_SIZE,
  CORNER_INSET,
  INNER_OVAL_LIGHT,
} from "@/games/crazyCards/CrazyCardsConfig";
import type { CrazyCard } from "@/types/turnBased";
import type { CardFaceProps, CardRenderState } from "./CrazyCardsTypes";

// =============================================================================
// Constants
// =============================================================================

const CARD_BACK_COLOR = "#1B1E2B";
const CARD_BACK_PATTERN = "#2A2E3D";
const GLOW_COLOR = "rgba(255, 215, 0, 0.6)";

// =============================================================================
// Helper: get display text for card center
// =============================================================================

function getCenterText(card: CrazyCard): string {
  if (card.type === "number" && card.value !== null) {
    return String(card.value);
  }
  return ACTION_SYMBOLS[card.type] ?? "?";
}

function getCornerText(card: CrazyCard): string {
  if (card.type === "number" && card.value !== null) {
    return String(card.value);
  }
  return ACTION_SYMBOLS[card.type] ?? "";
}

// =============================================================================
// CardBack — face-down rendering
// =============================================================================

const CardBack = React.memo(function CardBack({
  w,
  h,
  radius,
}: {
  w: number;
  h: number;
  radius: number;
}) {
  return (
    <View
      style={[
        styles.cardContainer,
        { width: w, height: h, borderRadius: radius },
      ]}
    >
      <Canvas style={{ width: w, height: h }}>
        {/* Background */}
        <RoundedRect x={0} y={0} width={w} height={h} r={radius}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(w, h)}
            colors={[CARD_BACK_COLOR, CARD_BACK_PATTERN]}
          />
          <Shadow dx={2} dy={3} blur={6} color="rgba(0,0,0,0.4)" />
        </RoundedRect>
        {/* Inner border */}
        <RoundedRect
          x={4}
          y={4}
          width={w - 8}
          height={h - 8}
          r={radius - 2}
          color="rgba(255,255,255,0.08)"
          style="stroke"
          strokeWidth={1}
        />
        {/* Center diamond pattern */}
        <RoundedRect
          x={w * 0.2}
          y={h * 0.15}
          width={w * 0.6}
          height={h * 0.7}
          r={radius * 0.5}
          color="rgba(255,255,255,0.05)"
        />
      </Canvas>
      {/* Center star */}
      <View style={[styles.centerOverlay, { width: w, height: h }]}>
        <Text style={[styles.backSymbol, { fontSize: w * 0.35 }]}>✦</Text>
      </View>
    </View>
  );
});

// =============================================================================
// CardFace — face-up rendering
// =============================================================================

const CardFaceInner = React.memo(
  function CardFaceInner({
    card,
    w,
    h,
    radius,
    renderState,
  }: {
    card: CrazyCard;
    w: number;
    h: number;
    radius: number;
    renderState: CardRenderState;
  }) {
    const bgColor = CARD_COLORS[card.color] ?? CARD_COLORS.wild;
    const textColor = CARD_TEXT_COLORS[card.color] ?? "#FFFFFF";
    const centerText = getCenterText(card);
    const cornerText = getCornerText(card);
    const isAction = card.type !== "number";
    const centerFontSize = isAction ? CENTER_ACTION_SIZE : CENTER_NUMBER_SIZE;

    const showGlow = renderState === "playable" || renderState === "selected";
    const dimmed = renderState === "not_playable";

    return (
      <View
        style={[
          styles.cardContainer,
          {
            width: w,
            height: h,
            borderRadius: radius,
            opacity: dimmed ? 0.55 : 1,
          },
        ]}
      >
        {/* Skia layer: background + oval + shadow */}
        <Canvas style={{ width: w, height: h }}>
          {/* Glow outline */}
          {showGlow && (
            <RoundedRect
              x={-2}
              y={-2}
              width={w + 4}
              height={h + 4}
              r={radius + 2}
              color={GLOW_COLOR}
            >
              <Shadow dx={0} dy={0} blur={8} color={GLOW_COLOR} />
            </RoundedRect>
          )}

          {/* Card background */}
          <RoundedRect x={0} y={0} width={w} height={h} r={radius}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(w, h)}
              colors={[lighten(bgColor, 15), bgColor]}
            />
            <Shadow dx={1} dy={2} blur={4} color="rgba(0,0,0,0.3)" />
          </RoundedRect>

          {/* Inner oval highlight */}
          <RoundedRect
            x={w * 0.12}
            y={h * 0.15}
            width={w * 0.76}
            height={h * 0.7}
            r={radius * 2}
            color={INNER_OVAL_LIGHT}
          />

          {/* Border */}
          <RoundedRect
            x={CARD_BORDER / 2}
            y={CARD_BORDER / 2}
            width={w - CARD_BORDER}
            height={h - CARD_BORDER}
            r={radius}
            color="rgba(255,255,255,0.2)"
            style="stroke"
            strokeWidth={CARD_BORDER}
          />
        </Canvas>

        {/* RN Views: text overlays */}
        <View style={[styles.centerOverlay, { width: w, height: h }]}>
          {/* Top-left corner */}
          <View
            style={[
              styles.cornerGlyph,
              styles.cornerTopLeft,
              { top: CORNER_INSET, left: CORNER_INSET },
            ]}
          >
            <Text
              style={[
                styles.cornerText,
                { color: textColor, fontSize: CORNER_GLYPH_SIZE },
              ]}
            >
              {cornerText}
            </Text>
          </View>

          {/* Center number / symbol */}
          <Text
            style={[
              styles.centerText,
              {
                color: textColor,
                fontSize: centerFontSize,
                textShadowColor: "rgba(0,0,0,0.25)",
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
              },
            ]}
          >
            {centerText}
          </Text>

          {/* Bottom-right corner (rotated 180°) */}
          <View
            style={[
              styles.cornerGlyph,
              styles.cornerBottomRight,
              { bottom: CORNER_INSET, right: CORNER_INSET },
            ]}
          >
            <Text
              style={[
                styles.cornerText,
                {
                  color: textColor,
                  fontSize: CORNER_GLYPH_SIZE,
                  transform: [{ rotate: "180deg" }],
                },
              ]}
            >
              {cornerText}
            </Text>
          </View>
        </View>
      </View>
    );
  },
  (prev, next) =>
    prev.card.id === next.card.id &&
    prev.renderState === next.renderState &&
    prev.w === next.w &&
    prev.h === next.h,
);

// =============================================================================
// Main CardFace Component
// =============================================================================

export const CardFace = React.memo(function CardFace({
  card,
  renderState = "playable",
  width = CARD_WIDTH,
  height = CARD_HEIGHT,
  faceDown = false,
  onPress,
}: CardFaceProps) {
  const radius = useMemo(() => height * 0.12, [height]);

  if (faceDown || !card) {
    return <CardBack w={width} h={height} radius={radius} />;
  }

  const handlePress = () => {
    if (onPress && card) {
      onPress(card);
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress}>
        <CardFaceInner
          card={card}
          w={width}
          h={height}
          radius={radius}
          renderState={renderState}
        />
      </TouchableOpacity>
    );
  }

  return (
    <CardFaceInner
      card={card}
      w={width}
      h={height}
      radius={radius}
      renderState={renderState}
    />
  );
});

// =============================================================================
// Color Utilities
// =============================================================================

/** Lighten a hex color by a percentage (0–100) */
function lighten(hex: string, pct: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(2.55 * pct));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(2.55 * pct));
  const b = Math.min(255, (num & 0xff) + Math.round(2.55 * pct));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  cardContainer: {
    position: "relative",
    overflow: "hidden",
  },
  centerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: {
    fontWeight: "900",
    textAlign: "center",
  },
  cornerGlyph: {
    position: "absolute",
  },
  cornerTopLeft: {},
  cornerBottomRight: {},
  cornerText: {
    fontWeight: "800",
    textAlign: "center",
  },
  backSymbol: {
    color: "rgba(255,255,255,0.15)",
    fontWeight: "900",
  },
});

export default CardFace;
