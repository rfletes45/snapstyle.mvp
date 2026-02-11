/**
 * Play2048SpectatorRenderer
 *
 * Read-only spectator view of a 2048 game.
 */

import { PLAY_2048_CONFIG } from "@/types/singlePlayerGames";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

const TILE_COLORS = PLAY_2048_CONFIG.tileColors;
const TEXT_COLORS = PLAY_2048_CONFIG.tileTextColors;
const GAP = 6;

export function Play2048SpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const board = (gameState.board ?? []) as number[][];
  const isOver = gameState.isOver as boolean | undefined;

  const gridSize = board.length || 4;
  const boardSize = Math.min(width, 380);
  const cellSize = (boardSize - GAP * (gridSize + 1)) / gridSize;

  return (
    <View
      style={[
        styles.board,
        {
          width: boardSize,
          height: boardSize,
          backgroundColor: "#BBADA0",
          borderRadius: 8,
          padding: GAP,
        },
      ]}
    >
      {board.map((row, r) =>
        row.map((value, c) => {
          const bgColor = TILE_COLORS[value] ?? "#3C3A32";
          const textColor = TEXT_COLORS[value] ?? "#F9F6F2";
          const fontSize =
            value >= 1024 ? 20 : value >= 128 ? 24 : value >= 16 ? 28 : 32;

          return (
            <View
              key={`${r}-${c}`}
              style={[
                styles.tile,
                {
                  left: GAP + c * (cellSize + GAP),
                  top: GAP + r * (cellSize + GAP),
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: bgColor,
                  borderRadius: 4,
                },
              ]}
            >
              {value > 0 && (
                <Text style={[styles.tileText, { color: textColor, fontSize }]}>
                  {value}
                </Text>
              )}
            </View>
          );
        }),
      )}

      {isOver && (
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
    backgroundColor: "rgba(238,228,218,0.5)",
    borderRadius: 8,
  },
  overlayText: {
    color: "#776E65",
    fontSize: 28,
    fontWeight: "700",
  },
});
