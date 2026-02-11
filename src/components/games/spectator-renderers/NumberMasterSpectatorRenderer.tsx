/**
 * NumberMasterSpectatorRenderer
 *
 * Read-only spectator view of a Number Master (mental math) game.
 * Shows the target number, current expression, and round progress.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

export function NumberMasterSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const round = (gameState.round as number) ?? 1;
  const targetNumber = (gameState.targetNumber as number) ?? 0;
  const expression = (gameState.expression as string) ?? "";
  const elapsed = (gameState.elapsed as number) ?? 0;
  const totalRounds = (gameState.totalRounds as number) ?? 10;
  const status = (gameState.gameState as string) ?? "playing";

  const containerWidth = Math.min(width, 360);

  return (
    <View style={[styles.container, { width: containerWidth }]}>
      {/* Round progress */}
      <View style={styles.progressRow}>
        {Array.from({ length: totalRounds }, (_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              {
                backgroundColor:
                  i < round - 1
                    ? "#4CAF50"
                    : i === round - 1
                      ? "#FFC107"
                      : "#3A3A5C",
              },
            ]}
          />
        ))}
      </View>

      {/* Round label */}
      <Text style={styles.roundLabel}>
        Round {round}/{totalRounds}
      </Text>

      {/* Target */}
      <View style={styles.targetContainer}>
        <Text style={styles.targetLabel}>MAKE</Text>
        <Text style={styles.targetNumber}>{targetNumber}</Text>
      </View>

      {/* Expression */}
      {expression ? (
        <View style={styles.expressionContainer}>
          <Text style={styles.expressionText}>{expression}</Text>
        </View>
      ) : (
        <View style={styles.expressionContainer}>
          <Text style={styles.expressionPlaceholder}>
            Building expression...
          </Text>
        </View>
      )}

      {/* Timer */}
      <Text style={styles.timer}>⏱ {Math.floor(elapsed)}s</Text>

      {status === "finished" && (
        <Text style={styles.finishedText}>✅ Complete!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roundLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
  },
  targetContainer: {
    backgroundColor: "#3A3A5C",
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  targetLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 2,
  },
  targetNumber: {
    color: "#FFC107",
    fontSize: 56,
    fontWeight: "700",
  },
  expressionContainer: {
    backgroundColor: "#2A2A3E",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 200,
    alignItems: "center",
  },
  expressionText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  expressionPlaceholder: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 16,
  },
  timer: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    marginTop: 16,
  },
  finishedText: {
    color: "#4CAF50",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
  },
});
