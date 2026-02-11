/**
 * SnakeSpectatorRenderer
 *
 * Read-only spectator view of a Snake Master game.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

const COLORS = {
  snakeHead: "#4CAF50",
  snakeBody: "#66BB6A",
  food: "#FF5722",
  grid: "rgba(255,255,255,0.05)",
  bg: "#1A1A2E",
};

export function SnakeSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const snake = (gameState.snake ?? []) as { x: number; y: number }[];
  const food = gameState.food as { x: number; y: number } | undefined;
  const gridWidth = (gameState.gridWidth as number) ?? 20;
  const gridHeight = (gameState.gridHeight as number) ?? 28;
  const status = (gameState.status as string) ?? "playing";

  const cellSize = Math.floor(width / gridWidth);
  const boardW = cellSize * gridWidth;
  const boardH = cellSize * gridHeight;

  return (
    <View
      style={[
        styles.board,
        { width: boardW, height: boardH, backgroundColor: COLORS.bg },
      ]}
    >
      {/* Grid lines */}
      {Array.from({ length: gridWidth + 1 }).map((_, i) => (
        <View
          key={`vl-${i}`}
          style={[
            styles.gridLine,
            {
              left: i * cellSize,
              top: 0,
              width: 1,
              height: boardH,
              backgroundColor: COLORS.grid,
            },
          ]}
        />
      ))}
      {Array.from({ length: gridHeight + 1 }).map((_, i) => (
        <View
          key={`hl-${i}`}
          style={[
            styles.gridLine,
            {
              top: i * cellSize,
              left: 0,
              height: 1,
              width: boardW,
              backgroundColor: COLORS.grid,
            },
          ]}
        />
      ))}

      {/* Snake */}
      {snake.map((seg, idx) => (
        <View
          key={`s-${idx}`}
          style={[
            styles.cell,
            {
              left: seg.x * cellSize,
              top: seg.y * cellSize,
              width: cellSize - 1,
              height: cellSize - 1,
              backgroundColor: idx === 0 ? COLORS.snakeHead : COLORS.snakeBody,
              borderRadius: idx === 0 ? cellSize / 2 : 2,
            },
          ]}
        />
      ))}

      {/* Food */}
      {food && (
        <View
          style={[
            styles.cell,
            {
              left: food.x * cellSize,
              top: food.y * cellSize,
              width: cellSize - 1,
              height: cellSize - 1,
              backgroundColor: COLORS.food,
              borderRadius: cellSize / 2,
            },
          ]}
        />
      )}

      {/* Game Over overlay */}
      {status === "gameOver" && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>GAME OVER</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    alignSelf: "center",
    borderRadius: 8,
    overflow: "hidden",
  },
  gridLine: { position: "absolute" },
  cell: { position: "absolute" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  overlayText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
  },
});
