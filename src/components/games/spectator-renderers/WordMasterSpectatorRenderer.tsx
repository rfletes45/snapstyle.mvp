/**
 * WordMasterSpectatorRenderer
 *
 * Read-only spectator view of a Word Master (Wordle-style) game.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

const STATE_COLORS: Record<string, string> = {
  correct: "#538D4E",
  present: "#B59F3B",
  absent: "#3A3A3C",
  empty: "#2A2A3E",
  pending: "#565656",
};

export function WordMasterSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const guesses = (gameState.guessRows ?? []) as {
    letter: string;
    state: string;
  }[][];
  const maxGuesses = (gameState.maxGuesses as number) ?? 6;
  const wordLength = (gameState.wordLength as number) ?? 5;
  const status = (gameState.status as string) ?? "playing";
  const currentGuess = (gameState.currentGuess as string) ?? "";

  const gap = 4;
  const boardWidth = Math.min(width, 340);
  const cellSize = (boardWidth - gap * (wordLength + 1)) / wordLength;

  const rows = Array.from({ length: maxGuesses }, (_, i) => guesses[i] ?? null);
  const currentRow = guesses.length; // The active row index

  return (
    <View style={[styles.board, { width: boardWidth }]}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.row, { gap }]}>
          {Array.from({ length: wordLength }, (_, c) => {
            const cell = row?.[c];
            // For the active row, show currently typed letters
            const isActiveRow = r === currentRow && !row;
            const letter =
              cell?.letter ?? (isActiveRow ? (currentGuess[c] ?? "") : "");
            const state =
              cell?.state ??
              (isActiveRow && currentGuess[c] ? "pending" : "empty");
            const bgColor = STATE_COLORS[state] ?? STATE_COLORS.empty;

            return (
              <View
                key={c}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: bgColor,
                    borderColor: letter ? "#565656" : "#3A3A3C",
                  },
                ]}
              >
                <Text style={[styles.letter, { fontSize: cellSize * 0.55 }]}>
                  {letter.toUpperCase()}
                </Text>
              </View>
            );
          })}
        </View>
      ))}

      {status === "won" && (
        <Text style={[styles.statusText, { color: "#538D4E" }]}>
          ✅ Solved!
        </Text>
      )}
      {status === "lost" && (
        <Text style={[styles.statusText, { color: "#F44336" }]}>
          ❌ Not solved
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    alignSelf: "center",
    gap: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
  },
  cell: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 4,
  },
  letter: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  statusText: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },
});
