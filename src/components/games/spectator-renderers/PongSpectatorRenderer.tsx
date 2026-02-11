/**
 * PongSpectatorRenderer
 *
 * Read-only spectator view of a Pong game.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

export function PongSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const playerPaddleX = (gameState.playerPaddleX as number) ?? 0;
  const aiPaddleX = (gameState.aiPaddleX as number) ?? 0;
  const ballX = (gameState.ballX as number) ?? 0;
  const ballY = (gameState.ballY as number) ?? 0;
  const playerScore = (gameState.playerScore as number) ?? 0;
  const aiScore = (gameState.aiScore as number) ?? 0;
  const courtWidth = (gameState.courtWidth as number) ?? width;
  const courtHeight = (gameState.courtHeight as number) ?? width * 1.3;

  const scale = Math.min(1, width / courtWidth);
  const scaledW = courtWidth * scale;
  const scaledH = courtHeight * scale;

  const paddleW = 80 * scale;
  const paddleH = 12 * scale;
  const ballR = 8 * scale;

  return (
    <View style={[styles.court, { width: scaledW, height: scaledH }]}>
      {/* Score */}
      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>AI: {aiScore}</Text>
        <Text style={styles.scoreText}>You: {playerScore}</Text>
      </View>

      {/* Center line */}
      <View style={[styles.centerLine, { top: scaledH / 2, width: scaledW }]} />

      {/* AI Paddle (top) */}
      <View
        style={[
          styles.paddle,
          {
            left: aiPaddleX * scale - paddleW / 2,
            top: 20 * scale,
            width: paddleW,
            height: paddleH,
            backgroundColor: "#FF5252",
          },
        ]}
      />

      {/* Player Paddle (bottom) */}
      <View
        style={[
          styles.paddle,
          {
            left: playerPaddleX * scale - paddleW / 2,
            top: scaledH - 32 * scale,
            width: paddleW,
            height: paddleH,
            backgroundColor: "#448AFF",
          },
        ]}
      />

      {/* Ball */}
      <View
        style={[
          styles.ball,
          {
            left: ballX * scale - ballR,
            top: ballY * scale - ballR,
            width: ballR * 2,
            height: ballR * 2,
            borderRadius: ballR,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  court: {
    alignSelf: "center",
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    overflow: "hidden",
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scoreText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "600",
  },
  centerLine: {
    position: "absolute",
    height: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  paddle: {
    position: "absolute",
    borderRadius: 6,
  },
  ball: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
  },
});
