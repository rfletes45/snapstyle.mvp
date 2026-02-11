/**
 * TileSlideSpectatorRenderer
 *
 * Read-only spectator view of a Tile Slide (15-puzzle) game.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

export function TileSlideSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const tiles = (gameState.tiles ?? []) as (number | null)[];
  const gridSize = (gameState.gridSize as number) ?? 4;
  const status = (gameState.status as string) ?? "playing";
  const moveCount = (gameState.moveCount as number) ?? 0;

  const gap = 4;
  const boardSize = Math.min(width, 360);
  const cellSize = (boardSize - gap * (gridSize + 1)) / gridSize;

  return (
    <View style={[styles.board, { width: boardSize, height: boardSize }]}>
      {tiles.map((value, idx) => {
        const row = Math.floor(idx / gridSize);
        const col = idx % gridSize;

        if (value === null || value === 0) {
          return (
            <View
              key={`empty-${idx}`}
              style={[
                styles.tile,
                {
                  left: gap + col * (cellSize + gap),
                  top: gap + row * (cellSize + gap),
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: 6,
                },
              ]}
            />
          );
        }

        // Check if tile is in correct position
        const isCorrect = value === idx + 1;

        return (
          <View
            key={`tile-${value}`}
            style={[
              styles.tile,
              {
                left: gap + col * (cellSize + gap),
                top: gap + row * (cellSize + gap),
                width: cellSize,
                height: cellSize,
                backgroundColor: isCorrect ? "#388E3C" : "#3A3A5C",
                borderRadius: 6,
              },
            ]}
          >
            <Text
              style={[
                styles.tileText,
                {
                  fontSize: cellSize * 0.4,
                  color: isCorrect ? "#C8E6C9" : "#FFF",
                },
              ]}
            >
              {value}
            </Text>
          </View>
        );
      })}

      {status === "gameOver" && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>SOLVED! 🎉</Text>
          <Text style={styles.overlaySubtext}>{moveCount} moves</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    alignSelf: "center",
    backgroundColor: "#1A1A2E",
    borderRadius: 8,
    padding: 4,
    position: "relative",
  },
  tile: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  tileText: {
    fontWeight: "700",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
  },
  overlayText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "700",
  },
  overlaySubtext: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginTop: 4,
  },
});
