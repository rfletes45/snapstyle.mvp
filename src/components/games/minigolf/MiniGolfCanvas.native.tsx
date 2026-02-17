/**
 * MiniGolfCanvas — @shopify/react-native-skia renderer for Mini-Golf Duels
 *
 * Renders:
 *   1. Background (green fairway)
 *   2. Surfaces (sand/ice polygons)
 *   3. Hazards (water polygons)
 *   4. Walls (stroke outlines)
 *   5. Cup (hole target)
 *   6. Obstacles (bumper circles, spinner/gate rects — animated via state)
 *   7. Balls (per-player golf balls)
 *   8. Aim overlay (arrow + power meter + predicted path)
 *
 * Coordinate transform: world bounds → screen rect with padding.
 *
 * @see colyseus-server/src/games/minigolf/types.ts for HoleConfig shape
 */

import type { HoleConfig, Point, Polygon } from "@/games/minigolf/courseLoader";
import type { BallState, ObstacleState } from "@/hooks/useMiniGolfDuels";
import {
  Canvas,
  Circle,
  Group,
  Line,
  Path,
  Skia,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
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
const WATER_COLOR = "#2196F340";
const WALL_COLOR = "#5D4037";
const WALL_STROKE_WIDTH = 3;
const BALL_COLORS = ["#FF5252", "#448AFF"];
const BUMPER_COLOR = "#FF9800";
const SPINNER_COLOR = "#9C27B0";
const GATE_COLOR = "#607D8B";
const AIM_ARROW_COLOR = "#FFFFFFCC";
const PREDICTED_DOT_COLOR = "#FFFFFF80";
const DEFAULT_FRICTION = 0.02;
const PREDICTION_DT = 1 / 60;
const PREDICTION_STEPS = 90; // ~1.5s at 60fps

// =============================================================================
// Props
// =============================================================================

export interface MiniGolfCanvasProps {
  /** Current hole geometry from JSON */
  holeConfig: HoleConfig | null;
  /** Ball positions keyed by uid */
  balls: Record<string, BallState>;
  /** Kinematic obstacle transforms from server state */
  obstacles: ObstacleState[];
  /** Whether the local player is currently aiming */
  isAiming: boolean;
  /** Current aim angle (radians, 0 = right, π/2 = up in world) */
  aimAngle: number;
  /** Current aim power (0–20) */
  aimPower: number;
  /** UID of the local player's ball (for aim overlay) */
  myUid: string;
  /** Player index for ball colour (0 or 1) */
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
  // Container dimensions
  const [layout, setLayout] = React.useState({ width: 0, height: 0 });

  // Compute transform from world → screen
  const transform = useMemo(() => {
    if (!holeConfig || layout.width === 0 || layout.height === 0) return null;
    const { width: wW, height: wH } = holeConfig.bounds;
    const availW = layout.width - PADDING * 2;
    const availH = layout.height - PADDING * 2;
    const scale = Math.min(availW / wW, availH / wH);
    const offX = PADDING + (availW - wW * scale) / 2;
    const offY = PADDING + (availH - wH * scale) / 2;
    return { scale, offX, offY, wW, wH };
  }, [holeConfig, layout]);

  const toScreen = useMemo(() => {
    if (!transform) return (p: Point) => ({ x: 0, y: 0 });
    const { scale, offX, offY } = transform;
    return (p: Point) => ({
      x: offX + p.x * scale,
      y: offY + p.y * scale,
    });
  }, [transform]);

  // ── Build Skia paths for static geometry ──────────────────────────
  const wallPaths = useMemo(() => {
    if (!holeConfig || !transform) return [];
    return holeConfig.walls.map((poly) => buildPolyPath(poly, toScreen));
  }, [holeConfig, transform, toScreen]);

  const surfacePaths = useMemo(() => {
    if (!holeConfig || !transform) return [];
    return holeConfig.surfaces.map((s) => ({
      path: buildPolyPath(s.poly, toScreen),
      color: s.type === "sand" ? SAND_COLOR : ICE_COLOR,
    }));
  }, [holeConfig, transform, toScreen]);

  const hazardPaths = useMemo(() => {
    if (!holeConfig || !transform) return [];
    return holeConfig.hazards.map((h) => ({
      path: buildPolyPath(h.poly, toScreen),
      color: WATER_COLOR,
    }));
  }, [holeConfig, transform, toScreen]);

  // ── Predicted path (lightweight preview sim) ──────────────────────
  const predictedDots = useMemo(() => {
    if (!isAiming || !transform || !holeConfig || !balls[myUid]) return [];
    const ball = balls[myUid];
    const maxPower = 20;
    const clampedPower = Math.min(aimPower, maxPower);
    let vx = Math.cos(aimAngle) * clampedPower;
    let vy = Math.sin(aimAngle) * clampedPower;
    let px = ball.x;
    let py = ball.y;
    const dots: { x: number; y: number }[] = [];
    const { wW, wH } = transform;

    // Simple sim: friction + wall bounces
    for (let i = 0; i < PREDICTION_STEPS; i++) {
      px += vx * PREDICTION_DT * 60;
      py += vy * PREDICTION_DT * 60;
      vx *= 1 - DEFAULT_FRICTION;
      vy *= 1 - DEFAULT_FRICTION;

      // Bounce off hole bounds (simplified)
      const minX = holeConfig.walls[0]?.[0]?.x ?? 0;
      const maxX = holeConfig.walls[0]?.[1]?.x ?? wW;
      const minY = holeConfig.walls[0]?.[0]?.y ?? 0;
      const maxY = holeConfig.walls[0]?.[2]?.y ?? wH;
      if (px < minX + BALL_RADIUS_WORLD) {
        px = minX + BALL_RADIUS_WORLD;
        vx = Math.abs(vx) * 0.8;
      }
      if (px > maxX - BALL_RADIUS_WORLD) {
        px = maxX - BALL_RADIUS_WORLD;
        vx = -Math.abs(vx) * 0.8;
      }
      if (py < minY + BALL_RADIUS_WORLD) {
        py = minY + BALL_RADIUS_WORLD;
        vy = Math.abs(vy) * 0.8;
      }
      if (py > maxY - BALL_RADIUS_WORLD) {
        py = maxY - BALL_RADIUS_WORLD;
        vy = -Math.abs(vy) * 0.8;
      }

      // Sample every 3rd step
      if (i % 3 === 0) {
        const sp = toScreen({ x: px, y: py });
        dots.push(sp);
      }

      // Stop if nearly still
      if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) break;
    }
    return dots;
  }, [
    isAiming,
    aimAngle,
    aimPower,
    balls,
    myUid,
    transform,
    holeConfig,
    toScreen,
  ]);

  if (!holeConfig || !transform) {
    return (
      <View
        style={styles.container}
        onLayout={(e) =>
          setLayout({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })
        }
      />
    );
  }

  const { scale } = transform;
  const cup = toScreen(holeConfig.cup);
  const cupR = holeConfig.cupRadius * scale;
  const ballR = BALL_RADIUS_WORLD * scale;

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
      <Canvas
        style={{ width: layout.width, height: layout.height }}
        pointerEvents="none"
      >
        {/* 1. Fairway background */}
        <Group>
          {wallPaths.map((wp, i) => (
            <Path
              key={`fairway-${i}`}
              path={wp}
              color={FAIRWAY_COLOR}
              style="fill"
            />
          ))}
        </Group>

        {/* 2. Surfaces */}
        <Group>
          {surfacePaths.map((s, i) => (
            <Path
              key={`surf-${i}`}
              path={s.path}
              color={s.color}
              style="fill"
            />
          ))}
        </Group>

        {/* 3. Hazards */}
        <Group>
          {hazardPaths.map((h, i) => (
            <Path key={`haz-${i}`} path={h.path} color={h.color} style="fill" />
          ))}
        </Group>

        {/* 4. Walls (outlines) */}
        <Group>
          {wallPaths.map((wp, i) => (
            <Path
              key={`wall-${i}`}
              path={wp}
              color={WALL_COLOR}
              style="stroke"
              strokeWidth={WALL_STROKE_WIDTH}
              strokeJoin="round"
            />
          ))}
        </Group>

        {/* 5. Cup */}
        <Circle cx={cup.x} cy={cup.y} r={cupR} color={CUP_COLOR} />
        <Circle cx={cup.x} cy={cup.y} r={cupR * 0.5} color="#FFFFFF40" />

        {/* 6. Obstacles */}
        <Group>
          {obstacles.map((o) => {
            const sp = toScreen({ x: o.x, y: o.y });
            if (o.obstacleType === "bumper") {
              // Find radius from hole config
              const def = holeConfig.obstacles.find((d) => d.id === o.id);
              const r = (def?.radius ?? 20) * scale;
              return (
                <Circle
                  key={o.id}
                  cx={sp.x}
                  cy={sp.y}
                  r={r}
                  color={BUMPER_COLOR}
                />
              );
            }
            if (
              o.obstacleType === "spinner" ||
              o.obstacleType === "moving_gate"
            ) {
              const def = holeConfig.obstacles.find((d) => d.id === o.id);
              const w = (def?.size?.width ?? 80) * scale;
              const h = (def?.size?.height ?? 12) * scale;
              const color =
                o.obstacleType === "spinner" ? SPINNER_COLOR : GATE_COLOR;
              // Rotated rect as a path
              const path = buildRotatedRect(sp.x, sp.y, w, h, o.angle);
              return <Path key={o.id} path={path} color={color} style="fill" />;
            }
            return null;
          })}
        </Group>

        {/* 7. Predicted path dots */}
        {isAiming && (
          <Group>
            {predictedDots.map((d, i) => (
              <Circle
                key={`pred-${i}`}
                cx={d.x}
                cy={d.y}
                r={2}
                color={PREDICTED_DOT_COLOR}
              />
            ))}
          </Group>
        )}

        {/* 8. Aim arrow */}
        {isAiming && balls[myUid] && (
          <Group>
            {(() => {
              const myBall = balls[myUid];
              const sp = toScreen({ x: myBall.x, y: myBall.y });
              const arrowLen = Math.min(aimPower, 20) * scale * 2;
              const endX = sp.x + Math.cos(aimAngle) * arrowLen;
              const endY = sp.y + Math.sin(aimAngle) * arrowLen;
              return (
                <Line
                  p1={{ x: sp.x, y: sp.y }}
                  p2={{ x: endX, y: endY }}
                  color={AIM_ARROW_COLOR}
                  strokeWidth={3}
                  style="stroke"
                />
              );
            })()}
          </Group>
        )}

        {/* 9. Balls */}
        <Group>
          {Object.values(balls).map((b) => {
            const sp = toScreen({ x: b.x, y: b.y });
            const colorIdx = playerColors[b.uid] ?? 0;
            return (
              <React.Fragment key={b.uid}>
                <Circle
                  cx={sp.x}
                  cy={sp.y}
                  r={ballR}
                  color={BALL_COLORS[colorIdx % BALL_COLORS.length]}
                />
                <Circle
                  cx={sp.x - ballR * 0.25}
                  cy={sp.y - ballR * 0.25}
                  r={ballR * 0.3}
                  color="#FFFFFF50"
                />
              </React.Fragment>
            );
          })}
        </Group>
      </Canvas>
    </View>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function buildPolyPath(
  poly: Polygon,
  toScreen: (p: Point) => { x: number; y: number },
) {
  const path = Skia.Path.Make();
  if (poly.length === 0) return path;
  const first = toScreen(poly[0]);
  path.moveTo(first.x, first.y);
  for (let i = 1; i < poly.length; i++) {
    const p = toScreen(poly[i]);
    path.lineTo(p.x, p.y);
  }
  path.close();
  return path;
}

function buildRotatedRect(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
) {
  const hw = w / 2;
  const hh = h / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const corners = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];

  const path = Skia.Path.Make();
  const first = corners[0];
  path.moveTo(
    cx + first.x * cos - first.y * sin,
    cy + first.x * sin + first.y * cos,
  );
  for (let i = 1; i < corners.length; i++) {
    const c = corners[i];
    path.lineTo(cx + c.x * cos - c.y * sin, cy + c.x * sin + c.y * cos);
  }
  path.close();
  return path;
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
