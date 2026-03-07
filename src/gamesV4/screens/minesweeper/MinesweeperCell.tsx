/**
 * Minesweeper — Cell Component
 *
 * Renders a single Minesweeper cell with classic XP-style visuals.
 * Memoized for performance on large boards.
 *
 * Visual states:
 * - Hidden (raised 3D border)
 * - Flagged (raised + flag icon)
 * - Revealed empty (flat, sunken)
 * - Revealed number 1-8 (flat + colored number)
 * - Revealed mine (dark bg + mine)
 * - Exploded mine (red bg + mine)
 * - Incorrect flag on loss (flagged cell that wasn't a mine)
 *
 * @module gamesV4/screens/minesweeper/MinesweeperCell
 */

import type { CellState, CellValue } from "@/gamesV4/games/minesweeper/types";
import { NUMBER_COLORS } from "@/gamesV4/games/minesweeper/types";
import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

// =============================================================================
// Props
// =============================================================================

interface MinesweeperCellProps {
  cellSize: number;
  cellState: CellState;
  cellValue: CellValue;
  isExploded: boolean;
  isIncorrectFlag: boolean;
  isGameOver: boolean;
  pressed: boolean;
}

// =============================================================================
// Cell Colors — Classic XP Style
// =============================================================================

const COLORS = {
  // Hidden cell (raised)
  hiddenBg: "#C0C0C0",
  hiddenBorderLight: "#FFFFFF",
  hiddenBorderDark: "#808080",
  hiddenBorderDarker: "#404040",

  // Revealed cell (sunken)
  revealedBg: "#BDBDBD",
  revealedBorder: "#7B7B7B",

  // Special states
  explodedBg: "#FF0000",
  mineBg: "#C0C0C0",

  // Flag
  flagPole: "#222222",
  flagBody: "#FF0000",

  // Mine
  mineBody: "#000000",
  mineSpike: "#000000",
  mineGlint: "#FFFFFF",

  // Incorrect cross
  incorrectX: "#FF0000",
};

// =============================================================================
// Component
// =============================================================================

function MinesweeperCellInner({
  cellSize,
  cellState,
  cellValue,
  isExploded,
  isIncorrectFlag,
  pressed,
}: MinesweeperCellProps) {
  const borderWidth = Math.max(1, Math.floor(cellSize * 0.1));
  const fontSize = Math.max(8, Math.floor(cellSize * 0.55));
  const innerSize = cellSize - 1; // 1px gap

  // ── Hidden cell (3D raised look) ──
  if (cellState === "hidden" || (cellState === "flagged" && !isIncorrectFlag)) {
    const isPressed = pressed && cellState === "hidden";

    return (
      <View
        style={[
          styles.cell,
          {
            width: innerSize,
            height: innerSize,
          },
          isPressed
            ? {
                backgroundColor: COLORS.revealedBg,
                borderWidth: 1,
                borderColor: COLORS.revealedBorder,
              }
            : {
                backgroundColor: COLORS.hiddenBg,
                borderTopWidth: borderWidth,
                borderLeftWidth: borderWidth,
                borderBottomWidth: borderWidth,
                borderRightWidth: borderWidth,
                borderTopColor: COLORS.hiddenBorderLight,
                borderLeftColor: COLORS.hiddenBorderLight,
                borderBottomColor: COLORS.hiddenBorderDarker,
                borderRightColor: COLORS.hiddenBorderDarker,
              },
        ]}
      >
        {cellState === "flagged" && (
          <View style={styles.flagContainer}>
            {/* Flag pole */}
            <View
              style={[
                styles.flagPole,
                {
                  height: fontSize * 0.7,
                  left: innerSize * 0.52,
                  top: innerSize * 0.15,
                },
              ]}
            />
            {/* Flag body (triangle approximated as small rectangle) */}
            <Text style={[styles.flagEmoji, { fontSize: fontSize * 0.75 }]}>
              🚩
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── Incorrect flag (shown on loss) ──
  if (isIncorrectFlag) {
    return (
      <View
        style={[
          styles.cell,
          styles.revealedCell,
          {
            width: innerSize,
            height: innerSize,
            borderWidth: 1,
            borderColor: COLORS.revealedBorder,
            backgroundColor: COLORS.revealedBg,
          },
        ]}
      >
        <Text style={[styles.flagEmoji, { fontSize: fontSize * 0.65 }]}>
          🚩
        </Text>
        {/* Red X overlay */}
        <View style={[StyleSheet.absoluteFill, styles.incorrectOverlay]}>
          <Text
            style={[
              styles.incorrectX,
              { fontSize: fontSize * 0.85, color: COLORS.incorrectX },
            ]}
          >
            ✕
          </Text>
        </View>
      </View>
    );
  }

  // ── Revealed cell ──
  const bgColor = isExploded ? COLORS.explodedBg : COLORS.revealedBg;

  return (
    <View
      style={[
        styles.cell,
        styles.revealedCell,
        {
          width: innerSize,
          height: innerSize,
          backgroundColor: bgColor,
          borderWidth: 1,
          borderColor: COLORS.revealedBorder,
        },
      ]}
    >
      {cellValue === -1 ? (
        // Mine
        <Text style={[styles.mineEmoji, { fontSize: fontSize * 0.65 }]}>
          💣
        </Text>
      ) : cellValue > 0 ? (
        // Number
        <Text
          style={[
            styles.numberText,
            {
              fontSize,
              color: NUMBER_COLORS[cellValue] || "#000",
            },
          ]}
        >
          {cellValue}
        </Text>
      ) : null}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  cell: {
    justifyContent: "center",
    alignItems: "center",
  },
  revealedCell: {
    // Flat, sunken look
  },
  numberText: {
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  flagContainer: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  flagPole: {
    position: "absolute",
    width: 1.5,
    backgroundColor: "#222",
  },
  flagEmoji: {
    textAlign: "center",
    includeFontPadding: false,
  },
  mineEmoji: {
    textAlign: "center",
    includeFontPadding: false,
  },
  incorrectOverlay: {
    justifyContent: "center",
    alignItems: "center",
  },
  incorrectX: {
    fontWeight: "900",
    textAlign: "center",
  },
});

// =============================================================================
// Memoized Export
// =============================================================================

export const MinesweeperCell = memo(MinesweeperCellInner);
