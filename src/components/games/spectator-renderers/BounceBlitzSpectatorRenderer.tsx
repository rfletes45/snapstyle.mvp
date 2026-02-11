/**
 * BounceBlitzSpectatorRenderer
 *
 * Read-only spectator view of a Bounce Blitz game.
 * Shows the ball, blocks, and aim line.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

const BLOCK_HEALTH_COLORS: Record<number, string> = {
  1: "#4CAF50",
  2: "#8BC34A",
  3: "#FFC107",
  4: "#FF9800",
  5: "#FF5722",
};

export function BounceBlitzSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const balls = (gameState.balls ?? []) as {
    x: number;
    y: number;
    radius: number;
  }[];
  const blocks = (gameState.blocks ?? []) as {
    x: number;
    y: number;
    width: number;
    height: number;
    health: number;
  }[];
  const phase = (gameState.phase as string) ?? "playing";
  const boardWidth = (gameState.boardWidth as number) ?? 380;
  const boardHeight = (gameState.boardHeight as number) ?? 640;

  const scale = Math.min(1, width / boardWidth);
  const scaledW = boardWidth * scale;
  const scaledH = boardHeight * scale;

  return (
    <View style={[styles.board, { width: scaledW, height: scaledH }]}>
      {/* Blocks */}
      {blocks.map((block, idx) => {
        const color =
          BLOCK_HEALTH_COLORS[Math.min(block.health, 5)] ?? "#F44336";
        return (
          <View
            key={`b-${idx}`}
            style={[
              styles.block,
              {
                left: block.x * scale,
                top: block.y * scale,
                width: block.width * scale,
                height: block.height * scale,
                backgroundColor: color,
              },
            ]}
          >
            <Text style={styles.blockHealth}>{block.health}</Text>
          </View>
        );
      })}

      {/* Balls */}
      {balls.map((ball, idx) => (
        <View
          key={`ball-${idx}`}
          style={[
            styles.ball,
            {
              left: (ball.x - ball.radius) * scale,
              top: (ball.y - ball.radius) * scale,
              width: ball.radius * 2 * scale,
              height: ball.radius * 2 * scale,
              borderRadius: ball.radius * scale,
            },
          ]}
        />
      ))}

      {phase === "gameOver" && (
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
    backgroundColor: "#1A1A2E",
    borderRadius: 12,
    overflow: "hidden",
  },
  block: {
    position: "absolute",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  blockHealth: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  ball: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  overlayText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "700",
  },
});
