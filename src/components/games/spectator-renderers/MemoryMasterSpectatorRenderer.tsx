/**
 * MemoryMasterSpectatorRenderer
 *
 * Read-only spectator view of a Memory Master game.
 * Shows the tile grid with matched/selected/hidden state.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

export function MemoryMasterSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const flatGrid = (gameState.grid ?? []) as {
    id: number;
    color: string;
    selected: boolean;
    matched: boolean;
  }[];
  const rows = (gameState.gridRows as number) ?? 4;
  const cols = (gameState.gridCols as number) ?? 4;
  const status = (gameState.status as string) ?? "playing";
  const comboCount = (gameState.comboCount as number) ?? 0;

  const gap = 6;
  const boardSize = Math.min(width, 380);
  const cellSize = Math.min(
    (boardSize - gap * (cols + 1)) / cols,
    (boardSize - gap * (rows + 1)) / rows,
  );

  return (
    <View style={[styles.board, { width: boardSize }]}>
      {/* Combo indicator */}
      {comboCount > 1 && (
        <Text style={styles.combo}>🔥 Combo x{comboCount}</Text>
      )}

      {/* Grid */}
      <View
        style={[
          styles.gridContainer,
          { height: cellSize * rows + gap * (rows + 1), padding: gap },
        ]}
      >
        {flatGrid.map((tile, idx) => {
          const r = Math.floor(idx / cols);
          const c = idx % cols;
          const isSelected = tile?.selected ?? false;
          const isMatched = tile?.matched ?? false;

          // Color fallback — cards use emoji as identifier
          const bgColor = isMatched
            ? "#4CAF5080"
            : isSelected
              ? "#7C4DFF"
              : "#3A3A5C";

          return (
            <View
              key={tile?.id ?? idx}
              style={[
                styles.tile,
                {
                  left: gap + c * (cellSize + gap),
                  top: gap + r * (cellSize + gap),
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: bgColor,
                  borderRadius: 6,
                  opacity: isMatched ? 0.5 : 1,
                },
              ]}
            >
              {(isSelected || isMatched) && tile?.color ? (
                <Text style={{ fontSize: cellSize * 0.45 }}>{tile.color}</Text>
              ) : null}
              {isMatched && <Text style={styles.matchIcon}>✓</Text>}
            </View>
          );
        })}
      </View>

      {status === "gameOver" && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>FINISHED</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    alignSelf: "center",
  },
  combo: {
    color: "#FFC107",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  gridContainer: {
    backgroundColor: "#1A1A2E",
    borderRadius: 8,
    position: "relative",
  },
  tile: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  matchIcon: {
    color: "#4CAF50",
    fontSize: 20,
    fontWeight: "700",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
  },
  overlayText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
  },
});
