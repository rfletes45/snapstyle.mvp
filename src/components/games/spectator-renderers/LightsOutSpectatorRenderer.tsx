/**
 * LightsOutSpectatorRenderer
 *
 * Read-only spectator view of a Lights Out game.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

export function LightsOutSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const grid = (gameState.grid ?? []) as boolean[][];
  const phase = (gameState.phase as string) ?? "playing";
  const moves = (gameState.moves as number) ?? 0;

  const gridSize = grid.length || 5;
  const gap = 6;
  const boardSize = Math.min(width, 320);
  const cellSize = (boardSize - gap * (gridSize + 1)) / gridSize;

  return (
    <View style={[styles.board, { width: boardSize, height: boardSize }]}>
      {grid.map((row, r) =>
        row.map((isOn, c) => (
          <View
            key={`${r}-${c}`}
            style={[
              styles.cell,
              {
                left: gap + c * (cellSize + gap),
                top: gap + r * (cellSize + gap),
                width: cellSize,
                height: cellSize,
                backgroundColor: isOn ? "#FDD835" : "#2A2A3E",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isOn ? "#F9A825" : "#3A3A5C",
              },
            ]}
          >
            <Text style={{ fontSize: cellSize * 0.4 }}>{isOn ? "💡" : ""}</Text>
          </View>
        )),
      )}

      {phase === "won" && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>ALL OFF! 🎉</Text>
          <Text style={styles.overlaySubtext}>{moves} moves</Text>
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
    padding: 6,
    position: "relative",
  },
  cell: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
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
