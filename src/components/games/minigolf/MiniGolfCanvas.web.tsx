/**
 * MiniGolfCanvas — HTML Canvas 2D fallback for web
 *
 * Renders the same mini-golf course using the standard browser Canvas 2D API
 * since @shopify/react-native-skia is not available on web.
 *
 * Same props interface as the native Skia version.
 */

import type { HoleConfig, Point, Polygon } from "@/games/minigolf/courseLoader";
import type { BallState, ObstacleState } from "@/hooks/useMiniGolfDuels";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

// =============================================================================
// Constants
// =============================================================================

const PADDING = 16;
const BALL_RADIUS_WORLD = 8;
const CUP_COLOR = "#111111";
const FAIRWAY_COLOR = "#4CAF50";
const SAND_COLOR = "#E8D68E";
const ICE_COLOR = "#B3E5FC";
const WATER_COLOR = "rgba(33, 150, 243, 0.25)";
const WALL_COLOR = "#5D4037";
const WALL_STROKE_WIDTH = 3;
const BALL_COLORS = ["#FF5252", "#448AFF"];
const BUMPER_COLOR = "#FF9800";
const SPINNER_COLOR = "#9C27B0";
const GATE_COLOR = "#607D8B";
const AIM_ARROW_COLOR = "rgba(255, 255, 255, 0.8)";
const PREDICTED_DOT_COLOR = "rgba(255, 255, 255, 0.5)";
const DEFAULT_FRICTION = 0.02;
const PREDICTION_DT = 1 / 60;
const PREDICTION_STEPS = 90;

// =============================================================================
// Props (must match native version)
// =============================================================================

export interface MiniGolfCanvasProps {
  holeConfig: HoleConfig | null;
  balls: Record<string, BallState>;
  obstacles: ObstacleState[];
  isAiming: boolean;
  aimAngle: number;
  aimPower: number;
  myUid: string;
  playerColors: Record<string, number>;
}

// =============================================================================
// Component
// =============================================================================

export function MiniGolfCanvas({
  holeConfig,
  balls,
  obstacles,
  isAiming,
  aimAngle,
  aimPower,
  myUid,
  playerColors,
}: MiniGolfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<View>(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !holeConfig || layout.width === 0 || layout.height === 0)
      return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = layout.width * dpr;
    canvas.height = layout.height * dpr;
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    ctx.scale(dpr, dpr);

    // Compute transform
    const { width: wW, height: wH } = holeConfig.bounds;
    const availW = layout.width - PADDING * 2;
    const availH = layout.height - PADDING * 2;
    const scale = Math.min(availW / wW, availH / wH);
    const offX = PADDING + (availW - wW * scale) / 2;
    const offY = PADDING + (availH - wH * scale) / 2;

    const toScreen = (p: Point) => ({
      x: offX + p.x * scale,
      y: offY + p.y * scale,
    });

    // Clear
    ctx.clearRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = "#2E7D32";
    ctx.fillRect(0, 0, layout.width, layout.height);

    // 1. Fairway fills (wall polygons)
    for (const wall of holeConfig.walls) {
      drawPolygon(ctx, wall, toScreen, FAIRWAY_COLOR, "fill");
    }

    // 2. Surfaces (sand / ice)
    for (const s of holeConfig.surfaces) {
      const color = s.type === "sand" ? SAND_COLOR : ICE_COLOR;
      drawPolygon(ctx, s.poly, toScreen, color, "fill");
    }

    // 3. Hazards (water)
    for (const h of holeConfig.hazards) {
      drawPolygon(ctx, h.poly, toScreen, WATER_COLOR, "fill");
    }

    // 4. Wall outlines
    for (const wall of holeConfig.walls) {
      drawPolygon(ctx, wall, toScreen, WALL_COLOR, "stroke", WALL_STROKE_WIDTH);
    }

    // 5. Cup
    const cup = toScreen(holeConfig.cup);
    const cupR = holeConfig.cupRadius * scale;
    ctx.beginPath();
    ctx.arc(cup.x, cup.y, cupR, 0, Math.PI * 2);
    ctx.fillStyle = CUP_COLOR;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cup.x, cup.y, cupR * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();

    // 6. Obstacles
    for (const o of obstacles) {
      const sp = toScreen({ x: o.x, y: o.y });
      if (o.obstacleType === "bumper") {
        const def = holeConfig.obstacles.find((d) => d.id === o.id);
        const r = (def?.radius ?? 20) * scale;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.fillStyle = BUMPER_COLOR;
        ctx.fill();
      } else if (
        o.obstacleType === "spinner" ||
        o.obstacleType === "moving_gate"
      ) {
        const def = holeConfig.obstacles.find((d) => d.id === o.id);
        const w = (def?.size?.width ?? 80) * scale;
        const h = (def?.size?.height ?? 12) * scale;
        const color = o.obstacleType === "spinner" ? SPINNER_COLOR : GATE_COLOR;
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(o.angle);
        ctx.fillStyle = color;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }

    // 7. Predicted path dots
    if (isAiming && balls[myUid]) {
      const ball = balls[myUid];
      let vx = Math.cos(aimAngle) * Math.min(aimPower, 20);
      let vy = Math.sin(aimAngle) * Math.min(aimPower, 20);
      let px = ball.x;
      let py = ball.y;

      ctx.fillStyle = PREDICTED_DOT_COLOR;
      for (let i = 0; i < PREDICTION_STEPS; i++) {
        px += vx * PREDICTION_DT * 60;
        py += vy * PREDICTION_DT * 60;
        vx *= 1 - DEFAULT_FRICTION;
        vy *= 1 - DEFAULT_FRICTION;

        // Simple bounds bounce
        if (px < BALL_RADIUS_WORLD) {
          px = BALL_RADIUS_WORLD;
          vx = Math.abs(vx) * 0.8;
        }
        if (px > wW - BALL_RADIUS_WORLD) {
          px = wW - BALL_RADIUS_WORLD;
          vx = -Math.abs(vx) * 0.8;
        }
        if (py < BALL_RADIUS_WORLD) {
          py = BALL_RADIUS_WORLD;
          vy = Math.abs(vy) * 0.8;
        }
        if (py > wH - BALL_RADIUS_WORLD) {
          py = wH - BALL_RADIUS_WORLD;
          vy = -Math.abs(vy) * 0.8;
        }

        if (i % 3 === 0) {
          const sp = toScreen({ x: px, y: py });
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) break;
      }
    }

    // 8. Aim arrow
    if (isAiming && balls[myUid]) {
      const ball = balls[myUid];
      const sp = toScreen({ x: ball.x, y: ball.y });
      const arrowLen = Math.min(aimPower, 20) * scale * 2;
      const endX = sp.x + Math.cos(aimAngle) * arrowLen;
      const endY = sp.y + Math.sin(aimAngle) * arrowLen;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = AIM_ARROW_COLOR;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 9. Balls
    const ballR = BALL_RADIUS_WORLD * scale;
    for (const b of Object.values(balls)) {
      const sp = toScreen({ x: b.x, y: b.y });
      const colorIdx = playerColors[b.uid] ?? 0;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, ballR, 0, Math.PI * 2);
      ctx.fillStyle = BALL_COLORS[colorIdx % BALL_COLORS.length];
      ctx.fill();
      // Highlight
      ctx.beginPath();
      ctx.arc(
        sp.x - ballR * 0.25,
        sp.y - ballR * 0.25,
        ballR * 0.3,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fill();
    }
  }, [
    holeConfig,
    layout,
    balls,
    obstacles,
    isAiming,
    aimAngle,
    aimPower,
    myUid,
    playerColors,
  ]);

  // Re-draw on every relevant change
  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <View
      style={styles.container}
      onLayout={(e) =>
        setLayout({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
    >
      {layout.width > 0 && layout.height > 0 && (
        <canvas
          ref={canvasRef as any}
          style={{
            width: layout.width,
            height: layout.height,
            borderRadius: 8,
          }}
        />
      )}
    </View>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  poly: Polygon,
  toScreen: (p: Point) => { x: number; y: number },
  color: string,
  mode: "fill" | "stroke",
  lineWidth?: number,
) {
  if (poly.length === 0) return;
  ctx.beginPath();
  const first = toScreen(poly[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < poly.length; i++) {
    const p = toScreen(poly[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  if (mode === "fill") {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth ?? 1;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2E7D32",
    borderRadius: 8,
    overflow: "hidden",
  },
});
