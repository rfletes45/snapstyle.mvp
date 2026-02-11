/**
 * ReactionTapSpectatorRenderer
 *
 * Read-only spectator view of a Reaction Tap game.
 * Shows the phase (waiting/go/tapped) and reaction time.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

const PHASE_COLORS: Record<string, string> = {
  waiting: "#1A1A2E",
  ready: "#C62828",
  go: "#2E7D32",
  tapped: "#1565C0",
  too_early: "#E65100",
  result: "#1A1A2E",
};

const PHASE_TEXT: Record<string, string> = {
  waiting: "Waiting...",
  ready: "Wait for green...",
  go: "TAP NOW!",
  tapped: "Tapped!",
  too_early: "Too early!",
  result: "Result",
};

export function ReactionTapSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const phase = (gameState.gameState as string) ?? "waiting";
  const reactionTime = (gameState.reactionTime as number) ?? 0;

  const size = Math.min(width, 320);
  const bgColor = PHASE_COLORS[phase] ?? PHASE_COLORS.waiting;
  const label = PHASE_TEXT[phase] ?? phase;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, backgroundColor: bgColor },
      ]}
    >
      <Text style={styles.phaseText}>{label}</Text>

      {reactionTime > 0 && (
        <View style={styles.resultContainer}>
          <Text style={styles.reactionTime}>{reactionTime}ms</Text>
          <Text style={styles.reactionLabel}>Reaction Time</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  phaseText: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 1,
  },
  resultContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  reactionTime: {
    color: "#64FFDA",
    fontSize: 48,
    fontWeight: "700",
  },
  reactionLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginTop: 4,
  },
});
