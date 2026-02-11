/**
 * TimedTapSpectatorRenderer
 *
 * Read-only spectator view of a Timed Tap game.
 * Shows the tap count and countdown timer in a visual display.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

export function TimedTapSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const tapCount = (gameState.tapCount as number) ?? 0;
  const timeRemaining = (gameState.timeRemaining as number) ?? 10;
  const status = (gameState.gameState as string) ?? "playing";

  const size = Math.min(width, 280);
  const isFinished = status === "finished" || status === "gameOver";

  return (
    <View style={[styles.container, { width: size }]}>
      {/* Timer */}
      <View style={styles.timerContainer}>
        <Text style={styles.timerLabel}>TIME</Text>
        <Text
          style={[
            styles.timerValue,
            { color: timeRemaining <= 3 ? "#F44336" : "#64FFDA" },
          ]}
        >
          {Math.ceil(timeRemaining)}s
        </Text>
      </View>

      {/* Tap button visual */}
      <View
        style={[
          styles.tapCircle,
          { width: size * 0.6, height: size * 0.6, borderRadius: size * 0.3 },
        ]}
      >
        <Text style={styles.tapCount}>{tapCount}</Text>
        <Text style={styles.tapLabel}>TAPS</Text>
      </View>

      {isFinished && <Text style={styles.finishedText}>⏱️ Time's up!</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    alignItems: "center",
    paddingVertical: 24,
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  timerLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
  },
  timerValue: {
    fontSize: 48,
    fontWeight: "700",
  },
  tapCircle: {
    backgroundColor: "#3A3A5C",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#7C4DFF",
  },
  tapCount: {
    color: "#FFF",
    fontSize: 56,
    fontWeight: "700",
  },
  tapLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 2,
  },
  finishedText: {
    color: "#FFC107",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 20,
  },
});
