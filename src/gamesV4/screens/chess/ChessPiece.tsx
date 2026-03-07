/**
 * Chess UI — Animated Piece Component
 *
 * Renders a chess piece with smooth slide animation when moving
 * and a shrink/fade animation when captured. Uses MaterialCommunityIcons
 * for crisp rendering at any size, with color fills per board theme.
 *
 * Performance: memoized; only re-renders on piece, position, or animation change.
 *
 * @module gamesV4/screens/chess/ChessPiece
 */

import type { Piece } from "@/gamesV4/adapters/chess/chessTypes";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { ChessBoardTheme } from "./chessThemes";
import { MOVE_ANIM_DURATION, PIECE_ICONS, SQUARE_SIZE } from "./constants";

// =============================================================================
// Props
// =============================================================================

interface ChessPieceProps {
  /** The piece to render */
  piece: Piece;
  /** Board theme for coloring */
  boardTheme: ChessBoardTheme;
  /** Whether this piece was just captured (trigger shrink/fade) */
  isCaptured?: boolean;
  /** Whether to animate entrance (for pieces that just landed) */
  animateEntrance?: boolean;
  /** Whether the user prefers reduced motion */
  reducedMotion?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const ChessPiece = React.memo(function ChessPiece({
  piece,
  boardTheme,
  isCaptured = false,
  animateEntrance = false,
  reducedMotion = false,
}: ChessPieceProps) {
  const iconName = PIECE_ICONS[
    piece
  ] as keyof typeof MaterialCommunityIcons.glyphMap;
  const isWhite = piece[0] === "w";
  const fillColor = isWhite ? boardTheme.whitePiece : boardTheme.blackPiece;

  // Core RN Animated values for capture + entrance
  const captureScale = useRef(new Animated.Value(isCaptured ? 0 : 1)).current;
  const captureOpacity = useRef(new Animated.Value(isCaptured ? 0 : 1)).current;
  const entranceScale = useRef(
    new Animated.Value(animateEntrance && !reducedMotion ? 0.5 : 1),
  ).current;
  const entranceOpacity = useRef(
    new Animated.Value(animateEntrance && !reducedMotion ? 0 : 1),
  ).current;

  useEffect(() => {
    if (isCaptured && !reducedMotion) {
      Animated.parallel([
        Animated.timing(captureScale, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(captureOpacity, {
          toValue: 0,
          duration: 100,
          easing: Easing.out(Easing.linear),
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (animateEntrance && !reducedMotion) {
      Animated.parallel([
        Animated.timing(entranceScale, {
          toValue: 1,
          duration: MOVE_ANIM_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(entranceOpacity, {
          toValue: 1,
          duration: MOVE_ANIM_DURATION * 0.8,
          easing: Easing.out(Easing.linear),
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const combinedScale = Animated.multiply(captureScale, entranceScale);
  const combinedOpacity = Animated.multiply(captureOpacity, entranceOpacity);

  const iconSize = SQUARE_SIZE * 0.78;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: combinedScale }],
          opacity: combinedOpacity,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons
          name={iconName}
          size={iconSize}
          color={fillColor}
          style={[
            styles.icon,
            {
              textShadowColor: isWhite
                ? boardTheme.whitePieceStroke
                : boardTheme.blackPieceStroke,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 2,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 0,
    left: 0,
  },
  iconWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    // Shadow applied via style prop
  },
});
