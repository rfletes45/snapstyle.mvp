/**
 * 2048 — Animated Tile Component
 *
 * Self-animating tile that uses React Native's Animated API.
 *
 * Positioning model:
 *   • `left` / `top` are set to the TARGET pixel position (always correct).
 *   • `translateX` / `translateY` are used as OFFSETS from the target for
 *     slide animation.  They start at (startX − targetX, startY − targetY)
 *     and animate to (0, 0).  This means:
 *       – At rest the tile sits exactly at (left, top) = target.
 *       – If animation fails or is interrupted, the tile is still at target.
 *       – Scale / spring animations compose cleanly on top.
 *
 * On mount, it:
 *   1. Starts at (prevRow, prevCol) if provided, then slides to (row, col).
 *   2. For new tiles (isNew): scales from 0 → 1 after the slide delay.
 *   3. For merge results (isMergeResult): pops 0 → 1.2 → 1 after slide delay.
 *
 * The key-based remount strategy in Board ensures fresh Animated values
 * for each animation cycle — no need to manage animation re-triggers.
 *
 * @module gamesV4/screens/play2048/AnimatedTile
 */

import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text } from "react-native";
import {
  SLIDE_MS,
  cellPosition,
  getTileFontSize,
  getTileStyle,
} from "./constants";

export interface AnimatedTileProps {
  value: number;
  row: number;
  col: number;
  prevRow?: number;
  prevCol?: number;
  isNew?: boolean;
  isMergeResult?: boolean;
  cellSize: number;
  cellGap: number;
  boardPadding: number;
  zIndex?: number;
}

function AnimatedTileInner({
  value,
  row,
  col,
  prevRow,
  prevCol,
  isNew,
  isMergeResult,
  cellSize,
  cellGap,
  boardPadding,
  zIndex = 1,
}: AnimatedTileProps) {
  // ── Pixel positions ──
  const targetX = cellPosition(col, cellSize, cellGap, boardPadding);
  const targetY = cellPosition(row, cellSize, cellGap, boardPadding);

  const startX = cellPosition(prevCol ?? col, cellSize, cellGap, boardPadding);
  const startY = cellPosition(prevRow ?? row, cellSize, cellGap, boardPadding);

  // Offsets: how far from the TARGET the tile begins (animates → 0)
  const offsetX = startX - targetX;
  const offsetY = startY - targetY;
  const hasSlide = offsetX !== 0 || offsetY !== 0;

  const animOffsetX = useRef(new Animated.Value(offsetX)).current;
  const animOffsetY = useRef(new Animated.Value(offsetY)).current;
  const animScale = useRef(new Animated.Value(isNew ? 0 : 1)).current;

  useEffect(() => {
    const anims: Animated.CompositeAnimation[] = [];

    // ── Slide: animate offset from (dx, dy) → (0, 0) ──
    if (hasSlide) {
      anims.push(
        Animated.parallel([
          Animated.timing(animOffsetX, {
            toValue: 0,
            duration: SLIDE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animOffsetY, {
            toValue: 0,
            duration: SLIDE_MS,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    }

    // ── New tile: appear with spring after slides finish ──
    if (isNew && !isMergeResult) {
      anims.push(
        Animated.sequence([
          Animated.delay(SLIDE_MS),
          Animated.spring(animScale, {
            toValue: 1,
            friction: 5,
            tension: 100,
            useNativeDriver: true,
          }),
        ]),
      );
    }

    // ── Merge result: pop 0 → 1.2 → 1 ──
    if (isMergeResult) {
      anims.push(
        Animated.sequence([
          Animated.delay(SLIDE_MS * 0.75),
          Animated.timing(animScale, {
            toValue: 1.2,
            duration: 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animScale, {
            toValue: 1.0,
            duration: 100,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    }

    if (anims.length > 0) {
      Animated.parallel(anims).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tileStyle = getTileStyle(value);
  const fontSize = getTileFontSize(value, cellSize);
  const borderRadius = Math.max(cellSize * 0.08, 4);

  // Add a subtle inner shadow / glow for the 2048 tile
  const is2048 = value === 2048;

  return (
    <Animated.View
      style={[
        styles.tile,
        {
          left: targetX,
          top: targetY,
          width: cellSize,
          height: cellSize,
          borderRadius,
          backgroundColor: tileStyle.bg,
          zIndex,
          transform: [
            { translateX: animOffsetX },
            { translateY: animOffsetY },
            { scale: animScale },
          ],
        },
        is2048 && styles.tile2048,
      ]}
    >
      <Text
        style={[
          styles.tileText,
          {
            color: tileStyle.text,
            fontSize,
            lineHeight: fontSize * 1.15,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {value}
      </Text>
    </Animated.View>
  );
}

export const AnimatedTile = React.memo(AnimatedTileInner);

const styles = StyleSheet.create({
  tile: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  tileText: {
    fontWeight: "800",
    textAlign: "center",
  },
  tile2048: {
    // Subtle golden glow for the winning tile
    shadowColor: "#EDC22E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
});
