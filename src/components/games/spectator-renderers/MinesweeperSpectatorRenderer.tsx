/**
 * MinesweeperSpectatorRenderer
 *
 * Read-only spectator view of a Minesweeper game.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

const NUMBER_COLORS: Record<number, string> = {
  1: "#2196F3",
  2: "#4CAF50",
  3: "#F44336",
  4: "#9C27B0",
  5: "#FF5722",
  6: "#00BCD4",
  7: "#212121",
  8: "#9E9E9E",
};

export function MinesweeperSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const grid = (gameState.grid ?? []) as {
    revealed: boolean;
    flagged: boolean;
    mine: boolean;
    adjacentMines: number;
  }[][];
  const phase = (gameState.phase as string) ?? "playing";
  const won = gameState.won as boolean | undefined;

  const rows = grid.length || 9;
  const cols = grid[0]?.length || 9;
  const gap = 2;
  const maxBoard = Math.min(width, 380);
  const cellSize = Math.min((maxBoard - gap * (cols + 1)) / cols, 36);
  const boardW = cellSize * cols + gap * (cols + 1);
  const boardH = cellSize * rows + gap * (rows + 1);

  return (
    <View style={[styles.board, { width: boardW, height: boardH }]}>
      {grid.map((row, r) =>
        row.map((cell, c) => {
          let content = "";
          let textColor = "#FFF";
          let bgColor = "#3A3A5C"; // unrevealed

          if (cell.flagged) {
            content = "🚩";
            bgColor = "#3A3A5C";
          } else if (cell.revealed) {
            bgColor = "#1A1A2E";
            if (cell.mine) {
              content = "💣";
            } else if (cell.adjacentMines > 0) {
              content = cell.adjacentMines.toString();
              textColor = NUMBER_COLORS[cell.adjacentMines] ?? "#FFF";
            }
          }

          return (
            <View
              key={`${r}-${c}`}
              style={[
                styles.cell,
                {
                  left: gap + c * (cellSize + gap),
                  top: gap + r * (cellSize + gap),
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: bgColor,
                  borderRadius: 3,
                },
              ]}
            >
              <Text
                style={[
                  styles.cellText,
                  { color: textColor, fontSize: cellSize * 0.5 },
                ]}
              >
                {content}
              </Text>
            </View>
          );
        }),
      )}

      {phase === "finished" && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            {won ? "YOU WIN! 🎉" : "BOOM! 💥"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    alignSelf: "center",
    backgroundColor: "#0F0F22",
    borderRadius: 6,
    padding: 2,
    position: "relative",
  },
  cell: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  cellText: {
    fontWeight: "700",
    textAlign: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 6,
  },
  overlayText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
  },
});
