import React from "react";
import {
  Canvas,
  Circle,
  LinearGradient,
  RoundedRect,
  vec,
} from "@shopify/react-native-skia";

import { getBallColor } from "@/types/pool";

import { SimpleSpectatorCard } from "./SimpleSpectatorCard";
import type { SpectatorRendererProps } from "./types";

type SnapshotBall = {
  id: number;
  x: number;
  y: number;
  pocketed?: boolean;
};

const TABLE_W = 220;
const TABLE_H = 420;
const BALL_R = 5.8;

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseBalls(gameState: Record<string, unknown>): SnapshotBall[] {
  const raw = gameState.balls;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((ball) => {
      const b = ball as Partial<SnapshotBall>;
      return {
        id: toNumber(b.id, 0),
        x: toNumber(b.x, 0),
        y: toNumber(b.y, 0),
        pocketed: !!b.pocketed,
      };
    })
    .filter((ball) => !ball.pocketed);
}

export function PoolSpectatorRenderer({
  gameState,
  width,
  score,
  level,
  lives,
}: SpectatorRendererProps) {
  const balls = parseBalls(gameState);
  if (!balls.length) {
    const phase =
      typeof gameState.phase === "string" ? gameState.phase : "live";
    return (
      <SimpleSpectatorCard
        width={width}
        title="8-Ball Pool"
        subtitle={`Phase: ${phase}`}
        score={score}
        level={level}
        lives={lives}
      />
    );
  }

  const canvasWidth = Math.max(220, Math.min(width, 360));
  const canvasHeight = canvasWidth * (TABLE_H / TABLE_W);
  const sx = canvasWidth / TABLE_W;
  const sy = canvasHeight / TABLE_H;

  return (
    <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
      <RoundedRect x={0} y={0} width={canvasWidth} height={canvasHeight} r={16}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(canvasWidth, canvasHeight)}
          colors={["#6D4221", "#4A2B13"]}
        />
      </RoundedRect>

      <RoundedRect
        x={12}
        y={12}
        width={canvasWidth - 24}
        height={canvasHeight - 24}
        r={12}
      >
        <LinearGradient
          start={vec(12, 12)}
          end={vec(canvasWidth - 12, canvasHeight - 12)}
          colors={["#1E7A46", "#155934"]}
        />
      </RoundedRect>

      {balls.map((ball) => {
        const x = ball.x * sx;
        const y = ball.y * sy;
        const r = BALL_R * sx;
        return (
          <React.Fragment key={`pool-ball-${ball.id}`}>
            <Circle cx={x + r * 0.1} cy={y + r * 0.12} r={r} color="rgba(0,0,0,0.3)" />
            <Circle cx={x} cy={y} r={r} color={getBallColor(ball.id)} />
            {ball.id > 0 ? <Circle cx={x} cy={y} r={r * 0.34} color="#FFFFFF" /> : null}
          </React.Fragment>
        );
      })}
    </Canvas>
  );
}
