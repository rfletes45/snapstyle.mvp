/**
 * BrickBreakerSpectatorRenderer
 *
 * Read-only spectator view of a Brick Breaker game.
 * Renders bricks, balls, paddle, power-ups, and lasers from
 * the JSON state pushed by the host.
 */

import {
  CONFIG,
  getBrickColor,
  getBrickPosition,
} from "@/services/games/brickBreakerLogic";
import type {
  BrickBallState,
  BrickPaddleState,
  BrickState,
  FallingPowerUp,
  LaserState,
} from "@/types/singlePlayerGames";
import {
  Canvas,
  RoundedRect,
  Circle as SkiaCircle,
  LinearGradient as SkiaLinearGradient,
  Shadow as SkiaShadow,
  vec,
} from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

// ─── Helpers ────────────────────────────────────────────────────────────

function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function darkenHex(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ─── Sub-components ─────────────────────────────────────────────────────

const SpectatorBrick = React.memo(
  ({ brick, scale }: { brick: BrickState; scale: number }) => {
    const pos = getBrickPosition(brick);
    const color = getBrickColor(brick);
    const brickW = pos.width * scale;
    const brickH = pos.height * scale;

    return (
      <View
        style={[
          styles.brick,
          {
            left: pos.x * scale,
            top: pos.y * scale,
            width: brickW,
            height: brickH,
          },
        ]}
      >
        <Canvas style={{ width: brickW, height: brickH }}>
          <RoundedRect x={0} y={0} width={brickW} height={brickH} r={4}>
            <SkiaLinearGradient
              start={vec(0, 0)}
              end={vec(0, brickH)}
              colors={[lightenHex(color, 40), color, darkenHex(color, 40)]}
            />
            <SkiaShadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.3)" />
          </RoundedRect>
        </Canvas>
        {brick.type === "explosive" && <Text style={styles.brickIcon}>💥</Text>}
        {brick.type === "mystery" && <Text style={styles.brickIcon}>?</Text>}
        {brick.type === "gold" && brick.hitsRemaining === 3 && (
          <Text style={styles.brickIcon}>✨</Text>
        )}
      </View>
    );
  },
);

const SpectatorBall = React.memo(
  ({ ball, scale }: { ball: BrickBallState; scale: number }) => {
    const r = ball.radius * scale;
    const d = (r + 2) * 2;
    return (
      <View
        style={[
          styles.ball,
          {
            left: (ball.x - ball.radius) * scale - 2,
            top: (ball.y - ball.radius) * scale - 2,
            width: d,
            height: d,
          },
        ]}
      >
        <Canvas style={{ width: d, height: d }}>
          <SkiaCircle cx={r + 2} cy={r + 2} r={r}>
            <SkiaLinearGradient
              start={vec(r, 0)}
              end={vec(r, r * 2)}
              colors={["#FFFFFF", "#E0E0E0", "#BBBBBB"]}
            />
            <SkiaShadow dx={0} dy={1} blur={3} color="rgba(255,255,255,0.6)" />
          </SkiaCircle>
        </Canvas>
      </View>
    );
  },
);

const SpectatorPaddle = React.memo(
  ({ paddle, scale }: { paddle: BrickPaddleState; scale: number }) => {
    return (
      <View
        style={[
          styles.paddle,
          {
            left: paddle.x * scale,
            top: CONFIG.paddleY * scale,
            width: paddle.width * scale,
            height: CONFIG.paddleHeight * scale,
            backgroundColor: paddle.hasSticky
              ? "#FFEB3B"
              : paddle.hasLaser
                ? "#E91E63"
                : "#FFFFFF",
          },
        ]}
      />
    );
  },
);

const SpectatorPowerUp = React.memo(
  ({ powerUp, scale }: { powerUp: FallingPowerUp; scale: number }) => {
    const size = CONFIG.powerUpSize * scale;
    return (
      <View
        style={[
          styles.powerUp,
          {
            left: (powerUp.x - CONFIG.powerUpSize / 2) * scale,
            top: (powerUp.y - CONFIG.powerUpSize / 2) * scale,
            width: size,
            height: size,
            backgroundColor: "#7C4DFF",
          },
        ]}
      />
    );
  },
);

const SpectatorLaser = React.memo(
  ({ laser, scale }: { laser: LaserState; scale: number }) => {
    return (
      <View
        style={[
          styles.laser,
          {
            left: (laser.x - 2) * scale,
            top: laser.y * scale,
            width: 4 * scale,
            height: 12 * scale,
          },
        ]}
      />
    );
  },
);

// ─── Main Renderer ──────────────────────────────────────────────────────

export function BrickBreakerSpectatorRenderer({
  gameState,
  width,
}: SpectatorRendererProps) {
  // Parse sub-objects from the JSON state
  const paddle = gameState.paddle as BrickPaddleState | undefined;
  const balls = (gameState.balls ?? []) as BrickBallState[];
  const bricks = (gameState.bricks ?? []) as BrickState[];
  const powerUps = (gameState.powerUps ?? []) as FallingPowerUp[];
  const lasers = (gameState.lasers ?? []) as LaserState[];
  const phase = (gameState.phase as string) ?? "playing";

  const scale = Math.min(1, width / CONFIG.canvasWidth);
  const scaledW = CONFIG.canvasWidth * scale;
  const scaledH = CONFIG.canvasHeight * scale;

  return (
    <View style={[styles.canvas, { width: scaledW, height: scaledH }]}>
      {/* Background */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <RoundedRect x={0} y={0} width={scaledW} height={scaledH} r={12}>
          <SkiaLinearGradient
            start={vec(0, 0)}
            end={vec(0, scaledH)}
            colors={["#1A1A3E", "#16162E", "#0F0F22"]}
          />
          <SkiaShadow dx={0} dy={2} blur={8} color="rgba(0,0,0,0.5)" inner />
        </RoundedRect>
      </Canvas>

      {/* Bricks */}
      {bricks.map((brick) => (
        <SpectatorBrick key={brick.id} brick={brick} scale={scale} />
      ))}

      {/* Power-ups */}
      {powerUps.map((pu) => (
        <SpectatorPowerUp key={pu.id} powerUp={pu} scale={scale} />
      ))}

      {/* Lasers */}
      {lasers.map((l) => (
        <SpectatorLaser key={l.id} laser={l} scale={scale} />
      ))}

      {/* Paddle */}
      {paddle && <SpectatorPaddle paddle={paddle} scale={scale} />}

      {/* Balls */}
      {balls.map((ball) => (
        <SpectatorBall key={ball.id} ball={ball} scale={scale} />
      ))}

      {/* Phase overlay */}
      {phase === "ready" && (
        <View style={styles.phaseOverlay}>
          <Text style={styles.phaseText}>WAITING TO LAUNCH</Text>
        </View>
      )}
      {phase === "levelComplete" && (
        <View style={styles.phaseOverlay}>
          <Text style={styles.phaseText}>LEVEL COMPLETE!</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  canvas: {
    alignSelf: "center",
    borderRadius: 12,
    overflow: "hidden",
  },
  brick: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  brickIcon: {
    position: "absolute",
    fontSize: 10,
    textAlign: "center",
  },
  ball: {
    position: "absolute",
  },
  paddle: {
    position: "absolute",
    borderRadius: 6,
  },
  powerUp: {
    position: "absolute",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  laser: {
    position: "absolute",
    backgroundColor: "#E91E63",
    borderRadius: 2,
  },
  phaseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  phaseText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
