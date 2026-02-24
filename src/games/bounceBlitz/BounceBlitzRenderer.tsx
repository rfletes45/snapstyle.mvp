/**
 * BounceBlitzRenderer — Single Skia Canvas game renderer
 *
 * All in-game drawing (bricks, balls, aim line, pickups, grid, warning,
 * launch indicator) is done in ONE Skia Canvas for maximum performance.
 * ~60 FPS even with 50+ balls on screen.
 *
 * The parent screen provides the snapshot + aimAngle; this component
 * is purely presentational — no game logic, no side effects.
 */

import {
  Canvas,
  Circle,
  Group,
  Line,
  LinearGradient,
  Paint,
  RadialGradient,
  Rect,
  RoundedRect,
  Shadow,
  Text as SkiaText,
  useFont,
  vec,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import {
  BALL_RADIUS_PX,
  BRICK_PADDING,
  BRICK_SIZE,
  CELL_SIZE,
  COLS,
  GAME_HEIGHT,
  GAME_WIDTH,
  PICKUP_COLOR,
  ROWS,
  getBrickColor,
} from "./BounceBlitzConfig";
import type { BallState, Brick, TurnPhase } from "./BounceBlitzTypes";

// =============================================================================
// Props
// =============================================================================

export interface BounceBlitzRendererProps {
  /** All bricks currently on the board */
  bricks: Brick[];
  /** All balls currently in play */
  balls: BallState[];
  /** Current aim angle (radians), null if not aiming */
  aimAngle: number | null;
  /** X position of the ball launcher (px) */
  launchX: number;
  /** Number of balls available */
  ballCount: number;
  /** Current game phase */
  phase: TurnPhase;
  /** Whether bricks are nearing the bottom row */
  showWarning: boolean;
  /** Speed multiplier label */
  speedMultiplier: number;
}

// =============================================================================
// Color helpers
// =============================================================================

function lightenHex(hex: string, amt: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function darkenHex(hex: string, amt: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// =============================================================================
// Constants
// =============================================================================

const AIM_DOT_RADIUS = 3;
const AIM_DOT_SPACING = 14;
const AIM_COLLISION_DOT_RADIUS = 5;
const LAUNCH_BALL_RADIUS = BALL_RADIUS_PX;
const BALL_GLOW_EXTRA = 3;

// Font path for brick HP numbers — use system font via null (Skia default)
const BRICK_FONT_SIZE = 13;
const BALL_COUNT_FONT_SIZE = 11;

// =============================================================================
// Aim Line Calculator
// =============================================================================

interface AimResult {
  dots: { x: number; y: number; opacity: number }[];
  endX: number;
  endY: number;
  /** Reflected dots (showing first bounce trajectory) */
  reflectedDots: { x: number; y: number; opacity: number }[];
}

function computeAimLine(
  aimAngle: number,
  launchX: number,
  bricks: Brick[],
): AimResult {
  const startX = launchX;
  const startY = GAME_HEIGHT - BALL_RADIUS_PX - 2;
  const dirX = Math.cos(aimAngle);
  const dirY = Math.sin(aimAngle);

  let endX = startX;
  let endY = startY;
  let hitNormalX = 0;
  let hitNormalY = 0;
  let hitSomething = false;
  const step = 1.5;
  const maxDist = GAME_HEIGHT + GAME_WIDTH;

  for (let dist = 0; dist < maxDist; dist += step) {
    const testX = startX + dirX * dist;
    const testY = startY + dirY * dist;

    // Wall collisions
    if (testX - BALL_RADIUS_PX <= 0) {
      endX = BALL_RADIUS_PX;
      endY = testY;
      hitNormalX = 1;
      hitNormalY = 0;
      hitSomething = true;
      break;
    }
    if (testX + BALL_RADIUS_PX >= GAME_WIDTH) {
      endX = GAME_WIDTH - BALL_RADIUS_PX;
      endY = testY;
      hitNormalX = -1;
      hitNormalY = 0;
      hitSomething = true;
      break;
    }
    // Ceiling
    if (testY - BALL_RADIUS_PX <= 0) {
      endX = testX;
      endY = BALL_RADIUS_PX;
      hitNormalX = 0;
      hitNormalY = 1;
      hitSomething = true;
      break;
    }
    // Brick collisions (skip pickups)
    let hitBrick = false;
    for (const brick of bricks) {
      if (brick.type === "extra_ball") continue;
      const bLeft = brick.col * CELL_SIZE + BRICK_PADDING;
      const bRight = bLeft + BRICK_SIZE;
      const bTop = (brick.row + 0.5) * CELL_SIZE - BRICK_SIZE / 2;
      const bBottom = bTop + BRICK_SIZE;

      if (
        testX + BALL_RADIUS_PX > bLeft &&
        testX - BALL_RADIUS_PX < bRight &&
        testY + BALL_RADIUS_PX > bTop &&
        testY - BALL_RADIUS_PX < bBottom
      ) {
        endX = testX;
        endY = testY;
        // Approximate normal based on penetration direction
        const overlapLeft = testX + BALL_RADIUS_PX - bLeft;
        const overlapRight = bRight - (testX - BALL_RADIUS_PX);
        const overlapTop = testY + BALL_RADIUS_PX - bTop;
        const overlapBottom = bBottom - (testY - BALL_RADIUS_PX);
        const minOverlap = Math.min(
          overlapLeft,
          overlapRight,
          overlapTop,
          overlapBottom,
        );
        if (minOverlap === overlapLeft) {
          hitNormalX = -1;
          hitNormalY = 0;
        } else if (minOverlap === overlapRight) {
          hitNormalX = 1;
          hitNormalY = 0;
        } else if (minOverlap === overlapTop) {
          hitNormalX = 0;
          hitNormalY = -1;
        } else {
          hitNormalX = 0;
          hitNormalY = 1;
        }
        hitBrick = true;
        hitSomething = true;
        break;
      }
    }
    if (hitBrick) break;
    endX = testX;
    endY = testY;
  }

  // Build primary aim dots
  const lineLen = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const numDots = Math.floor(lineLen / AIM_DOT_SPACING);
  const dots: AimResult["dots"] = [];
  for (let i = 0; i <= numDots; i++) {
    const t = i / Math.max(numDots, 1);
    dots.push({
      x: startX + (endX - startX) * t,
      y: startY + (endY - startY) * t,
      opacity: 1.0 - t * 0.4,
    });
  }

  // Build reflected trajectory dots (first bounce preview)
  const reflectedDots: AimResult["reflectedDots"] = [];
  if (hitSomething) {
    // Reflect direction
    const dot = dirX * hitNormalX + dirY * hitNormalY;
    const refDirX = dirX - 2 * dot * hitNormalX;
    const refDirY = dirY - 2 * dot * hitNormalY;
    const refLen = 80; // show ~80px of reflected path
    const refDotCount = Math.floor(refLen / AIM_DOT_SPACING);
    for (let i = 1; i <= refDotCount; i++) {
      const t = i / refDotCount;
      reflectedDots.push({
        x: endX + refDirX * i * AIM_DOT_SPACING,
        y: endY + refDirY * i * AIM_DOT_SPACING,
        opacity: 0.5 - t * 0.3,
      });
    }
  }

  return { dots, endX, endY, reflectedDots };
}

// =============================================================================
// Renderer Component
// =============================================================================

export const BounceBlitzRenderer = React.memo(function BounceBlitzRenderer(
  props: BounceBlitzRendererProps,
) {
  const { bricks, balls, aimAngle, launchX, ballCount, phase, showWarning } =
    props;

  // Load font for brick HP text — use a bundled font
  const font = useFont(
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("../../../assets/fonts/AgencyFB-Regular.ttf"),
    BRICK_FONT_SIZE,
  );
  const smallFont = useFont(
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("../../../assets/fonts/AgencyFB-Regular.ttf"),
    BALL_COUNT_FONT_SIZE,
  );

  // Pre-compute aim line
  const aimData = useMemo(() => {
    if (aimAngle === null) return null;
    return computeAimLine(aimAngle, launchX, bricks);
  }, [aimAngle, launchX, bricks]);

  return (
    <View
      style={[styles.container, { width: GAME_WIDTH, height: GAME_HEIGHT }]}
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* ── Background gradient ── */}
        <RoundedRect x={0} y={0} width={GAME_WIDTH} height={GAME_HEIGHT} r={16}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, GAME_HEIGHT)}
            colors={["#1A2744", "#16213E", "#0F1A2E"]}
          />
          <Shadow dx={0} dy={2} blur={10} color="rgba(0,0,0,0.5)" inner />
        </RoundedRect>

        {/* ── Subtle grid lines ── */}
        {Array.from({ length: COLS - 1 }).map((_, i) => {
          const x = (i + 1) * CELL_SIZE;
          return (
            <Line
              key={`g-${i}`}
              p1={vec(x, 0)}
              p2={vec(x, GAME_HEIGHT)}
              color="rgba(255,255,255,0.03)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* ── Warning line ── */}
        {showWarning && (
          <Group>
            <Rect
              x={0}
              y={(ROWS - 1) * CELL_SIZE - 1}
              width={GAME_WIDTH}
              height={2}
              color="rgba(255,60,60,0.5)"
            />
            {/* Subtle warning zone glow */}
            <Rect
              x={0}
              y={(ROWS - 1) * CELL_SIZE - 1}
              width={GAME_WIDTH}
              height={CELL_SIZE}
              color="rgba(255,0,0,0.04)"
            />
          </Group>
        )}

        {/* ── Bricks ── */}
        {bricks.map((brick) => {
          const cx = brick.col * CELL_SIZE + CELL_SIZE / 2;
          const cy = (brick.row + 0.5) * CELL_SIZE;
          const left = cx - BRICK_SIZE / 2;
          const top = cy - BRICK_SIZE / 2;

          if (brick.type === "extra_ball") {
            // Pickup: circle with "+" symbol
            return (
              <Group key={brick.id}>
                {/* Outer glow ring */}
                <Circle cx={cx} cy={cy} r={BRICK_SIZE / 2 - 2}>
                  <Paint color={PICKUP_COLOR} style="stroke" strokeWidth={2} />
                </Circle>
                {/* Inner pulsing circle */}
                <Circle
                  cx={cx}
                  cy={cy}
                  r={BRICK_SIZE / 2 - 6}
                  color={PICKUP_COLOR}
                  opacity={0.25}
                />
                {/* Plus sign (horizontal bar) */}
                <Line
                  p1={vec(cx - 6, cy)}
                  p2={vec(cx + 6, cy)}
                  color={PICKUP_COLOR}
                  strokeWidth={2.5}
                  strokeCap="round"
                />
                {/* Plus sign (vertical bar) */}
                <Line
                  p1={vec(cx, cy - 6)}
                  p2={vec(cx, cy + 6)}
                  color={PICKUP_COLOR}
                  strokeWidth={2.5}
                  strokeCap="round"
                />
              </Group>
            );
          }

          // Normal brick
          const color = getBrickColor(brick.hp);
          const light = lightenHex(color, 35);
          const dark = darkenHex(color, 35);
          const hpStr = String(brick.hp);
          const textWidth = font
            ? font.measureText(hpStr).width
            : hpStr.length * 7;

          return (
            <Group key={brick.id}>
              {/* Main brick body */}
              <RoundedRect
                x={left}
                y={top}
                width={BRICK_SIZE}
                height={BRICK_SIZE}
                r={4}
              >
                <LinearGradient
                  start={vec(left, top)}
                  end={vec(left, top + BRICK_SIZE)}
                  colors={[light, color, dark]}
                />
                <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.3)" />
              </RoundedRect>
              {/* Top shine */}
              <RoundedRect
                x={left + 2}
                y={top + 1}
                width={BRICK_SIZE - 4}
                height={5}
                r={2}
              >
                <LinearGradient
                  start={vec(left, top + 1)}
                  end={vec(left, top + 6)}
                  colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
                />
              </RoundedRect>
              {/* HP text */}
              {font && (
                <SkiaText
                  x={cx - textWidth / 2}
                  y={cy + BRICK_FONT_SIZE / 3}
                  text={hpStr}
                  font={font}
                  color="white"
                />
              )}
            </Group>
          );
        })}

        {/* ── Balls ── */}
        {balls.map((ball) =>
          ball.active ? (
            <Group key={ball.id}>
              {/* Outer glow */}
              <Circle
                cx={ball.x}
                cy={ball.y}
                r={BALL_RADIUS_PX + BALL_GLOW_EXTRA}
              >
                <RadialGradient
                  c={vec(ball.x, ball.y)}
                  r={BALL_RADIUS_PX + BALL_GLOW_EXTRA}
                  colors={["rgba(255,252,0,0.35)", "rgba(255,252,0,0)"]}
                />
              </Circle>
              {/* Ball body */}
              <Circle cx={ball.x} cy={ball.y} r={BALL_RADIUS_PX}>
                <RadialGradient
                  c={vec(ball.x - 1, ball.y - 1)}
                  r={BALL_RADIUS_PX}
                  colors={["#FFFFFF", "#E0E0E0", "#BBBBBB"]}
                />
                <Shadow dx={0} dy={1} blur={3} color="rgba(255,252,0,0.6)" />
              </Circle>
            </Group>
          ) : null,
        )}

        {/* ── Launch indicator (aiming phase) ── */}
        {phase === "aiming" && (
          <Group>
            {/* Launch ball */}
            <Circle
              cx={launchX}
              cy={GAME_HEIGHT - BALL_RADIUS_PX - 4}
              r={LAUNCH_BALL_RADIUS}
            >
              <RadialGradient
                c={vec(launchX - 1, GAME_HEIGHT - BALL_RADIUS_PX - 5)}
                r={LAUNCH_BALL_RADIUS}
                colors={["#FFFFFF", "#E0E0E0"]}
              />
            </Circle>
            {/* Ball count text */}
            {smallFont && ballCount > 1 && (
              <SkiaText
                x={launchX - smallFont.measureText(`x${ballCount}`).width / 2}
                y={GAME_HEIGHT - 2}
                text={`x${ballCount}`}
                font={smallFont}
                color="rgba(255,255,255,0.7)"
              />
            )}
          </Group>
        )}

        {/* ── Aim line (dotted + bounce preview) ── */}
        {aimData && (
          <Group>
            {/* Primary trajectory dots */}
            {aimData.dots.map((dot, i) => (
              <Circle
                key={`ad-${i}`}
                cx={dot.x}
                cy={dot.y}
                r={AIM_DOT_RADIUS}
                color="white"
                opacity={dot.opacity}
              />
            ))}
            {/* Collision endpoint */}
            <Circle
              cx={aimData.endX}
              cy={aimData.endY}
              r={AIM_COLLISION_DOT_RADIUS}
              color="#FF5722"
              opacity={0.8}
            />
            {/* Reflected trajectory dots (fainter) */}
            {aimData.reflectedDots.map((dot, i) => (
              <Circle
                key={`rd-${i}`}
                cx={dot.x}
                cy={dot.y}
                r={AIM_DOT_RADIUS - 0.5}
                color="rgba(255,255,255,0.4)"
                opacity={dot.opacity}
              />
            ))}
          </Group>
        )}
      </Canvas>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#16213e",
    borderRadius: 16,
    overflow: "hidden",
  },
});
