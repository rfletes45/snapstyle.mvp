/**
 * Chess UI — Single Square Component
 *
 * Memoized square with layered overlays:
 * 1. Base square color (from board theme)
 * 2. Last-move highlight (animated fade-in)
 * 3. Selected piece highlight
 * 4. Check highlight (animated pulse)
 * 5. Legal move dot or capture ring
 * 6. Coordinate labels
 * 7. Queued-move ghost overlay
 *
 * @module gamesV4/screens/chess/ChessSquare
 */

import type { Square } from "@/gamesV4/adapters/chess/chessTypes";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ChessBoardTheme } from "./chessThemes";
import { SQUARE_SIZE } from "./constants";

// =============================================================================
// Props
// =============================================================================

interface ChessSquareProps {
  /** Algebraic square name */
  square: Square;
  /** Visual row index (0 = top of screen) */
  visualRow: number;
  /** Visual col index (0 = left of screen) */
  visualCol: number;
  /** Whether this is a light square */
  isLight: boolean;
  /** Board theme */
  boardTheme: ChessBoardTheme;

  // Highlight states
  isSelected: boolean;
  isLastMoveFrom: boolean;
  isLastMoveTo: boolean;
  isKingCheck: boolean;
  isLegalTarget: boolean;
  isLegalCapture: boolean;
  isQueuedFrom: boolean;
  isQueuedTo: boolean;

  // Display settings
  showLegalMoves: boolean;
  highlightLastMove: boolean;
  highlightCheck: boolean;
  showCoordinates: boolean;
  reducedMotion: boolean;

  // Coordinate info
  /** Rank label to show (only for leftmost col) */
  rankLabel?: string;
  /** File label to show (only for bottom row) */
  fileLabel?: string;

  /** Tap handler */
  onPress: () => void;
  /** Long-press handler (for drag initiation) */
  onLongPress?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const ChessSquare = React.memo(function ChessSquare({
  square,
  visualRow,
  visualCol,
  isLight,
  boardTheme,
  isSelected,
  isLastMoveFrom,
  isLastMoveTo,
  isKingCheck,
  isLegalTarget,
  isLegalCapture,
  isQueuedFrom,
  isQueuedTo,
  showLegalMoves,
  highlightLastMove,
  highlightCheck,
  showCoordinates,
  reducedMotion,
  rankLabel,
  fileLabel,
  onPress,
  onLongPress,
}: ChessSquareProps) {
  const bgColor = isLight ? boardTheme.lightSquare : boardTheme.darkSquare;

  // Check pulse animation (core RN Animated)
  const checkPulse = useRef(new Animated.Value(1)).current;
  const checkPulseAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isKingCheck && highlightCheck && !reducedMotion) {
      checkPulseAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(checkPulse, {
            toValue: 0.5,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(checkPulse, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      checkPulseAnim.current.start();
    } else {
      if (checkPulseAnim.current) {
        checkPulseAnim.current.stop();
        checkPulseAnim.current = null;
      }
      checkPulse.setValue(1);
    }
    return () => {
      if (checkPulseAnim.current) {
        checkPulseAnim.current.stop();
        checkPulseAnim.current = null;
      }
    };
  }, [isKingCheck, highlightCheck, reducedMotion, checkPulse]);

  const checkAnimStyle = { opacity: checkPulse };

  const showLastMove = highlightLastMove && (isLastMoveFrom || isLastMoveTo);
  const showCheck = highlightCheck && isKingCheck;
  const showDot = showLegalMoves && isLegalTarget && !isLegalCapture;
  const showRing = showLegalMoves && isLegalTarget && isLegalCapture;

  return (
    <Pressable
      style={[
        styles.square,
        {
          width: SQUARE_SIZE,
          height: SQUARE_SIZE,
          backgroundColor: bgColor,
          left: visualCol * SQUARE_SIZE,
          top: visualRow * SQUARE_SIZE,
        },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* Last move highlight */}
      {showLastMove && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: boardTheme.lastMoveOverlay },
          ]}
        />
      )}

      {/* Selected highlight */}
      {isSelected && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: boardTheme.selectedOverlay },
          ]}
        />
      )}

      {/* Check highlight with pulse */}
      {showCheck && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: boardTheme.checkOverlay },
            checkAnimStyle,
          ]}
        />
      )}

      {/* Queued move ghost overlay */}
      {(isQueuedFrom || isQueuedTo) && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(100, 180, 255, 0.3)" },
          ]}
        />
      )}

      {/* Legal move dot */}
      {showDot && (
        <View
          style={[
            styles.legalDot,
            { backgroundColor: boardTheme.legalMoveDot },
          ]}
        />
      )}

      {/* Legal capture ring */}
      {showRing && (
        <View
          style={[
            styles.captureRing,
            { borderColor: boardTheme.legalCaptureRing },
          ]}
        />
      )}

      {/* Coordinate labels */}
      {showCoordinates && rankLabel && (
        <Text
          style={[
            styles.coordLabel,
            styles.rankLabel,
            {
              color: isLight ? boardTheme.coordOnLight : boardTheme.coordOnDark,
            },
          ]}
        >
          {rankLabel}
        </Text>
      )}
      {showCoordinates && fileLabel && (
        <Text
          style={[
            styles.coordLabel,
            styles.fileLabel,
            {
              color: isLight ? boardTheme.coordOnLight : boardTheme.coordOnDark,
            },
          ]}
        >
          {fileLabel}
        </Text>
      )}
    </Pressable>
  );
});

// =============================================================================
// Styles
// =============================================================================

const DOT_SIZE = SQUARE_SIZE * 0.26;
const RING_BORDER = SQUARE_SIZE * 0.08;

const styles = StyleSheet.create({
  square: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  legalDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  captureRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: RING_BORDER,
    borderRadius: SQUARE_SIZE / 2,
  },
  coordLabel: {
    position: "absolute",
    fontSize: 9,
    fontWeight: "700",
    opacity: 0.8,
  },
  rankLabel: {
    top: 1,
    left: 2,
  },
  fileLabel: {
    bottom: 1,
    right: 2,
  },
});
