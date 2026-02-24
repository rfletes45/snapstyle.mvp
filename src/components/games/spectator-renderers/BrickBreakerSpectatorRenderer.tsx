/**
 * BrickBreakerSpectatorRenderer — Atari Breakout Spectator View
 *
 * Read-only spectator view of a Brick Breaker (Atari Breakout) game.
 * Renders bricks, ball, and paddle from the JSON snapshot pushed by the host.
 * Uses the same Skia rendering approach as BreakoutRenderer but scales to fit.
 */

import {
  BALL_RADIUS_PX,
  BRICK_HEIGHT,
  BRICK_PADDING,
  BRICK_ROWS,
  BRICK_TOP_OFFSET,
  BRICK_WIDTH,
  GAME_HEIGHT,
  GAME_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  ROW_DEFS,
} from "@/games/brickBreaker/BreakoutConfig";
import type { BreakoutBrick } from "@/games/brickBreaker/BreakoutTypes";
import {
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient,
  RadialGradient,
  Rect,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────

function lightenHex(hex: string, amount: number): string {
  const c = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((c >> 16) & 0xff) + amount);
  const g = Math.min(255, ((c >> 8) & 0xff) + amount);
  const b = Math.min(255, (c & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function darkenHex(hex: string, amount: number): string {
  const c = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((c >> 16) & 0xff) - amount);
  const g = Math.max(0, ((c >> 8) & 0xff) - amount);
  const b = Math.max(0, (c & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function brickFill(row: number): string {
  if (row >= 0 && row < ROW_DEFS.length) {
    return ROW_DEFS[row].fill;
  }
  return "#888";
}

// ─── Main Renderer ──────────────────────────────────────────────────────

export function BrickBreakerSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  // Parse the Breakout snapshot from spectator JSON
  const ball = gameState.ball as { x: number; y: number } | undefined;
  const paddle = gameState.paddle as { x: number; width: number } | undefined;
  const bricks = (gameState.bricks ?? []) as BreakoutBrick[];
  const phase = (gameState.phase as string) ?? "playing";
  const paddleShrunk = (gameState.paddleShrunk as boolean) ?? false;

  // Scale to fit available width
  const scale = Math.min(1, width / GAME_WIDTH);
  const scaledW = GAME_WIDTH * scale;
  const scaledH = GAME_HEIGHT * scale;

  // Filter alive bricks
  const aliveBricks = useMemo(() => bricks.filter((b) => b.alive), [bricks]);

  const showBall = phase === "playing" || phase === "serving";

  return (
    <View style={[styles.canvas, { width: scaledW, height: scaledH }]}>
      <Canvas style={{ width: scaledW, height: scaledH }}>
        {/* Background */}
        <RoundedRect x={0} y={0} width={scaledW} height={scaledH} r={8}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, scaledH)}
            colors={["#1A2744", "#16213E", "#0F1A2E"]}
          />
          <Shadow dx={0} dy={2} blur={8} color="rgba(0,0,0,0.5)" inner />
        </RoundedRect>

        {/* Ceiling line */}
        <Line
          p1={vec(0, (BRICK_TOP_OFFSET - 6) * scale)}
          p2={vec(scaledW, (BRICK_TOP_OFFSET - 6) * scale)}
          color="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />

        {/* Bricks */}
        <Group>
          {aliveBricks.map((brick) => {
            const visualRow = BRICK_ROWS - 1 - brick.row;
            const bx = (brick.col * BRICK_WIDTH + BRICK_PADDING) * scale;
            const by =
              (BRICK_TOP_OFFSET + visualRow * BRICK_HEIGHT + BRICK_PADDING) *
              scale;
            const bw = (BRICK_WIDTH - BRICK_PADDING * 2) * scale;
            const bh = (BRICK_HEIGHT - BRICK_PADDING * 2) * scale;
            const fill = brickFill(brick.row);

            return (
              <Group key={brick.id}>
                <RoundedRect x={bx} y={by} width={bw} height={bh} r={2 * scale}>
                  <LinearGradient
                    start={vec(bx, by)}
                    end={vec(bx, by + bh)}
                    colors={[lightenHex(fill, 40), fill, darkenHex(fill, 35)]}
                  />
                  <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.35)" />
                </RoundedRect>
              </Group>
            );
          })}
        </Group>

        {/* Paddle */}
        {paddle && (
          <RoundedRect
            x={(paddle.x - paddle.width / 2) * scale}
            y={(PADDLE_Y - PADDLE_HEIGHT / 2) * scale}
            width={paddle.width * scale}
            height={PADDLE_HEIGHT * scale}
            r={4 * scale}
          >
            <LinearGradient
              start={vec(0, (PADDLE_Y - PADDLE_HEIGHT / 2) * scale)}
              end={vec(0, (PADDLE_Y + PADDLE_HEIGHT / 2) * scale)}
              colors={
                paddleShrunk
                  ? ["#FF8A80", "#FF5252", "#D32F2F"]
                  : ["#FFFFFF", "#E0E0E0", "#BDBDBD"]
              }
            />
          </RoundedRect>
        )}

        {/* Ball */}
        {showBall && ball && (
          <Group>
            <Circle
              cx={ball.x * scale}
              cy={ball.y * scale}
              r={BALL_RADIUS_PX * scale + 3}
            >
              <RadialGradient
                c={vec(ball.x * scale, ball.y * scale)}
                r={BALL_RADIUS_PX * scale + 3}
                colors={["rgba(255,255,200,0.3)", "rgba(255,255,200,0.0)"]}
              />
            </Circle>
            <Circle
              cx={ball.x * scale}
              cy={ball.y * scale}
              r={BALL_RADIUS_PX * scale}
              color="#FFFFFF"
            />
          </Group>
        )}

        {/* Drain zone */}
        <Rect
          x={0}
          y={scaledH - 3}
          width={scaledW}
          height={3}
          color="rgba(255,0,0,0.25)"
        />
      </Canvas>

      {/* Phase overlays */}
      {phase === "serving" && (
        <View style={styles.phaseOverlay}>
          <Text style={styles.phaseText}>WAITING TO LAUNCH</Text>
        </View>
      )}
      {phase === "wallCleared" && (
        <View style={styles.phaseOverlay}>
          <Text style={[styles.phaseText, { color: "#4CAF50" }]}>
            WALL CLEARED!
          </Text>
        </View>
      )}
      {phase === "lifeLost" && (
        <View style={[styles.phaseOverlay, styles.flashOverlay]} />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  canvas: {
    alignSelf: "center",
    borderRadius: 8,
    overflow: "hidden",
  },
  phaseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  phaseText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
  },
  flashOverlay: {
    backgroundColor: "rgba(255,60,60,0.15)",
  },
});
