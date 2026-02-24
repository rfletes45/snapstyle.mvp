/**
 * BreakoutRenderer — Polished Skia Canvas renderer
 *
 * Renders the Atari Breakout game state from a BreakoutSnapshot:
 * gradient background, lit bricks with shadows, glowing ball,
 * paddle with visual states, wall boundaries, ceiling indicator,
 * and phase overlays. Pure presentational — no game logic.
 */

import {
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient,
  Rect,
  RoundedRect,
  Shadow,
  vec,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  BALL_RADIUS_PX,
  BRICK_HEIGHT,
  BRICK_PADDING,
  BRICK_ROWS,
  BRICK_TOP_OFFSET,
  BRICK_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_Y,
  ROW_DEFS,
} from "./BreakoutConfig";
import type { BreakoutBrick, BreakoutSnapshot } from "./BreakoutTypes";

// =============================================================================
// Props
// =============================================================================

export interface BreakoutRendererProps {
  snapshot: BreakoutSnapshot;
  /** Game canvas width in pixels (= GAME_WIDTH) */
  width: number;
  /** Game canvas height in pixels (= GAME_HEIGHT) */
  height: number;
  /** Show debug overlay? */
  showDebug?: boolean;
  /** Debug info */
  debug?: { ballSpeed: number; hitCount: number; speedTier: number };
  /** Debug collision points */
  debugCollisions?: { x: number; y: number; t: number }[];
}

// =============================================================================
// Color helpers
// =============================================================================

/** Lighten a hex color by `amount` (0–255) */
function lightenHex(hex: string, amount: number): string {
  const c = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((c >> 16) & 0xff) + amount);
  const g = Math.min(255, ((c >> 8) & 0xff) + amount);
  const b = Math.min(255, (c & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Darken a hex color by `amount` (0–255) */
function darkenHex(hex: string, amount: number): string {
  const c = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((c >> 16) & 0xff) - amount);
  const g = Math.max(0, ((c >> 8) & 0xff) - amount);
  const b = Math.max(0, (c & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function brickFill(brick: BreakoutBrick): string {
  if (brick.row >= 0 && brick.row < ROW_DEFS.length) {
    return ROW_DEFS[brick.row].fill;
  }
  return "#888";
}

// =============================================================================
// Brick sub-component (memoised per-brick for perf)
// =============================================================================

interface BrickItemProps {
  brick: BreakoutBrick;
  bx: number;
  by: number;
  bw: number;
  bh: number;
}

const BrickItem: React.FC<BrickItemProps> = React.memo(
  ({ brick, bx, by, bw, bh }) => {
    const fill = brickFill(brick);
    const light = lightenHex(fill, 40);
    const dark = darkenHex(fill, 35);

    return (
      <RoundedRect x={bx} y={by} width={bw} height={bh} r={2}>
        <LinearGradient
          start={vec(bx, by)}
          end={vec(bx, by + bh)}
          colors={[light, fill, dark]}
        />
      </RoundedRect>
    );
  },
);
BrickItem.displayName = "BrickItem";

// =============================================================================
// Main renderer component
// =============================================================================

export const BreakoutRenderer: React.FC<BreakoutRendererProps> = React.memo(
  ({ snapshot, width, height, showDebug, debug, debugCollisions }) => {
    const { ball, paddle, bricks, phase } = snapshot;

    // Filter to alive bricks
    const aliveBricks = useMemo(() => bricks.filter((b) => b.alive), [bricks]);

    // Brick area bottom edge (for reference line)
    const brickAreaBottom = BRICK_TOP_OFFSET + BRICK_ROWS * BRICK_HEIGHT + 4;

    // Paddle visual coords
    const px = paddle.x - paddle.width / 2;
    const py = PADDLE_Y - PADDLE_HEIGHT / 2;

    const showBall = phase === "playing" || phase === "serving";

    return (
      <View style={[styles.container, { width, height }]}>
        <Canvas style={{ width, height }}>
          {/* ── Background gradient ── */}
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, height)}
              colors={["#1A2744", "#16213E", "#0F1A2E"]}
            />
          </Rect>

          {/* ── Side wall indicators ── */}
          <Rect
            x={0}
            y={0}
            width={2}
            height={height}
            color="rgba(100,140,255,0.15)"
          />
          <Rect
            x={width - 2}
            y={0}
            width={2}
            height={height}
            color="rgba(100,140,255,0.15)"
          />

          {/* ── Ceiling line ── */}
          <Line
            p1={vec(0, BRICK_TOP_OFFSET - 6)}
            p2={vec(width, BRICK_TOP_OFFSET - 6)}
            color="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />

          {/* ── Brick area bottom divider ── */}
          <Line
            p1={vec(0, brickAreaBottom)}
            p2={vec(width, brickAreaBottom)}
            color="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />

          {/* ── Bricks ── */}
          <Group>
            {aliveBricks.map((brick) => {
              const visualRow = BRICK_ROWS - 1 - brick.row;
              const bx = brick.col * BRICK_WIDTH + BRICK_PADDING;
              const by =
                BRICK_TOP_OFFSET + visualRow * BRICK_HEIGHT + BRICK_PADDING;
              const bw = BRICK_WIDTH - BRICK_PADDING * 2;
              const bh = BRICK_HEIGHT - BRICK_PADDING * 2;

              return (
                <BrickItem
                  key={brick.id}
                  brick={brick}
                  bx={bx}
                  by={by}
                  bw={bw}
                  bh={bh}
                />
              );
            })}
          </Group>

          {/* ── Paddle ── */}
          <Group>
            <RoundedRect
              x={px}
              y={py}
              width={paddle.width}
              height={PADDLE_HEIGHT}
              r={4}
            >
              <LinearGradient
                start={vec(px, py)}
                end={vec(px, py + PADDLE_HEIGHT)}
                colors={
                  snapshot.paddleShrunk
                    ? ["#FF8A80", "#FF5252", "#D32F2F"]
                    : ["#FFFFFF", "#E0E0E0", "#BDBDBD"]
                }
              />
              <Shadow
                dx={0}
                dy={2}
                blur={6}
                color={
                  snapshot.paddleShrunk
                    ? "rgba(255,82,82,0.5)"
                    : "rgba(255,255,255,0.3)"
                }
              />
            </RoundedRect>
          </Group>

          {/* ── Ball ── */}
          {showBall && (
            <Circle
              cx={ball.x}
              cy={ball.y}
              r={BALL_RADIUS_PX}
              color="#FFFFFF"
            />
          )}

          {/* ── Drain warning zone ── */}
          <Rect
            x={0}
            y={height - 4}
            width={width}
            height={4}
            color="rgba(255,0,0,0.25)"
          />

          {/* ── Debug collision markers ── */}
          {showDebug &&
            debugCollisions?.map((pt, i) => (
              <Circle
                key={`dc-${i}`}
                cx={pt.x}
                cy={pt.y}
                r={3}
                color="rgba(255, 0, 0, 0.6)"
              />
            ))}
        </Canvas>

        {/* ── Phase overlays (native RN views above canvas) ── */}
        {phase === "serving" && (
          <View style={styles.servingOverlay} pointerEvents="none">
            <Text style={styles.servingText}>TAP TO LAUNCH</Text>
          </View>
        )}

        {phase === "lifeLost" && (
          <View style={styles.flashOverlay} pointerEvents="none" />
        )}

        {phase === "wallCleared" && (
          <View style={styles.wallClearedOverlay} pointerEvents="none">
            <Text style={styles.wallClearedText}>WALL CLEARED!</Text>
          </View>
        )}

        {/* ── Debug overlay ── */}
        {showDebug && debug && (
          <View style={styles.debugOverlay}>
            <Text style={styles.debugText}>
              Speed {debug.ballSpeed.toFixed(1)} | Hits {debug.hitCount} | Tier{" "}
              {debug.speedTier}
            </Text>
          </View>
        )}
      </View>
    );
  },
);

BreakoutRenderer.displayName = "BreakoutRenderer";

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 8,
  },
  servingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  servingText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "monospace",
    letterSpacing: 3,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,60,60,0.18)",
  },
  wallClearedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  wallClearedText: {
    color: "#4CAF50",
    fontSize: 28,
    fontWeight: "900",
    fontFamily: "monospace",
    letterSpacing: 4,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  debugOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  debugText: {
    color: "#0F0",
    fontSize: 10,
    fontFamily: "monospace",
  },
});
