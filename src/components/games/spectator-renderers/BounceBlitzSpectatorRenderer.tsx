/**
 * BounceBlitzSpectatorRenderer
 *
 * Read-only spectator view of a Bounce Blitz 2.0 game.
 * Renders bricks (with HP numbers and color tiers), balls, and game status.
 *
 * Expected gameState shape (broadcast by the host game screen):
 * {
 *   score: number,
 *   level: number,
 *   status: string,
 *   ballCount: number,
 *   blocks: { id: number, row: number, col: number, health: number, color: string, type: string }[],
 *   balls: { x: number, y: number }[],
 * }
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

// Match the game's layout constants
const COLS = 7;
const ROWS = 10;
const BRICK_PADDING = 3;

interface SpectatorBlock {
  id: number;
  row: number;
  col: number;
  health: number;
  color: string;
  type: string;
}

interface SpectatorBall {
  x: number;
  y: number;
}

export function BounceBlitzSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  const balls = (gameState.balls ?? []) as SpectatorBall[];
  const blocks = (gameState.blocks ?? []) as SpectatorBlock[];
  const phase = (gameState.status as string) ?? "idle";
  const ballCount = (gameState.ballCount as number) ?? 1;
  const level = (gameState.level as number) ?? 0;
  const aimAngle = (gameState.aimAngle as number | null) ?? null;
  const launchX = (gameState.launchX as number) ?? 380 / 2;

  // Scale the spectator view to fit available width
  // The game uses GAME_WIDTH (up to 380px) and a grid-based layout
  const GAME_WIDTH_C = 380;
  const CELL_SIZE = GAME_WIDTH_C / COLS;
  const GAME_HEIGHT = CELL_SIZE * (ROWS + 1.5);
  const BRICK_SIZE = CELL_SIZE - BRICK_PADDING * 2;

  const scale = Math.min(1, width / GAME_WIDTH_C);
  const scaledW = GAME_WIDTH_C * scale;
  const scaledH = GAME_HEIGHT * scale;

  return (
    <View style={[styles.board, { width: scaledW, height: scaledH }]}>
      {/* HUD bar */}
      <View style={styles.hud}>
        <Text style={styles.hudText}>Round {level}</Text>
        <Text style={styles.hudText}>🔵 x{ballCount}</Text>
      </View>

      {/* Blocks (bricks + pickups) */}
      {blocks.map((block) => {
        const cx = block.col * CELL_SIZE + CELL_SIZE / 2;
        const cy = (block.row + 0.5) * CELL_SIZE;
        const left = (cx - BRICK_SIZE / 2) * scale;
        const top = (cy - BRICK_SIZE / 2) * scale;
        const w = BRICK_SIZE * scale;
        const h = BRICK_SIZE * scale;

        if (block.type === "extra_ball") {
          return (
            <View
              key={`p-${block.id}`}
              style={[
                styles.pickup,
                { left, top, width: w, height: h, borderRadius: w / 2 },
              ]}
            >
              <Text style={[styles.pickupText, { fontSize: 10 * scale }]}>
                +
              </Text>
            </View>
          );
        }

        return (
          <View
            key={`b-${block.id}`}
            style={[
              styles.block,
              {
                left,
                top,
                width: w,
                height: h,
                backgroundColor: block.color || "#4CAF50",
              },
            ]}
          >
            <Text style={[styles.blockHealth, { fontSize: 11 * scale }]}>
              {block.health}
            </Text>
          </View>
        );
      })}

      {/* Balls */}
      {balls.map((ball, idx) => {
        const BALL_R = 6 * scale;
        return (
          <View
            key={`ball-${idx}`}
            style={[
              styles.ball,
              {
                left: ball.x * scale - BALL_R,
                top: ball.y * scale - BALL_R,
                width: BALL_R * 2,
                height: BALL_R * 2,
                borderRadius: BALL_R,
              },
            ]}
          />
        );
      })}

      {/* Aim line (during aiming phase) */}
      {phase === "aiming" &&
        aimAngle !== null &&
        (() => {
          const AIM_LEN = 100 * scale;
          const startX = launchX * scale;
          const startY = scaledH - 12 * scale;
          const endX = startX + Math.cos(aimAngle) * AIM_LEN;
          const endY = startY + Math.sin(aimAngle) * AIM_LEN;
          // Draw aim line using a rotated thin View
          const dx = endX - startX;
          const dy = endY - startY;
          const len = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          return (
            <View
              style={{
                position: "absolute",
                left: startX,
                top: startY,
                width: len,
                height: 2,
                backgroundColor: "rgba(255, 252, 0, 0.6)",
                transform: [{ rotate: `${angle}rad` }],
                transformOrigin: "left center",
              }}
            />
          );
        })()}

      {/* Game over overlay */}
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
    backgroundColor: "#1A2744",
    borderRadius: 12,
    overflow: "hidden",
  },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hudText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "600",
  },
  block: {
    position: "absolute",
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  blockHealth: {
    color: "#FFF",
    fontWeight: "700",
  },
  pickup: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "#00E676",
    justifyContent: "center",
    alignItems: "center",
  },
  pickupText: {
    color: "#00E676",
    fontWeight: "bold",
  },
  ball: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFFC00",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  overlayText: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "700",
  },
});
