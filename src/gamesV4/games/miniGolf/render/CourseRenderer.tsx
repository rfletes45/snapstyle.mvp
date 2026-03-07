/**
 * Mini Golf — Course Renderer
 *
 * SVG-based top-down rendering of a hole definition.
 * GamePigeon-inspired visual quality: thick 3D rails, lush turf,
 * shaded bumpers, rippled water, gradient cup, large glossy ball.
 *
 * ViewBox is hole-based (not screen-based) for automatic fit.
 *
 * @module gamesV4/games/miniGolf/render/CourseRenderer
 */

import React, { useMemo } from "react";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
  Polygon as SvgPolygon,
  Text as SvgText,
} from "react-native-svg";
import type { HoleDef, Vec2 } from "../types";

// =============================================================================
// Color Palette (GamePigeon-inspired)
// =============================================================================

const C = {
  // Turf
  turf: "#2E8B57",
  turfEdge: "#24704A",
  turfStripe: "#33996B", // alternating stripe (subtle)

  // Rails / Walls
  railOuter: "#2C1810",
  railInner: "#5C3A20",
  railHighlight: "#7A5438",

  // Bumpers
  bumperFill: "#FF6B35",
  bumperHighlight: "#FFAA77",
  bumperStroke: "#CC4400",

  // Surfaces
  sand: "#D4B36A",
  sandDot: "#C4A35A",
  sandStroke: "#B89840",
  ice: "#B3E5FC",
  iceStroke: "#81D4FA",
  iceShine: "#E1F5FE",
  rough: "#1B5E20",
  roughStroke: "#0D3D12",

  // Hazards
  water: "#1E88E5",
  waterWave: "#42A5F5",
  waterStroke: "#1565C0",
  oob: "#B71C1C",
  oobStroke: "#7F0000",

  // Cup
  cupOuter: "#2A2A2A",
  cupInner: "#0A0A0A",
  cupRing: "rgba(255,255,255,0.8)",

  // Flag
  flag: "#F44336",
  flagHighlight: "#FF7043",
  flagPole: "#9E9E9E",

  // Interactive elements
  portal: "#AA00FF",
  portalGlow: "#D580FF",
  conveyor: "#FFC107",
  conveyorStripe: "#FFD54F",
  slope: "#66BB6A",
  slopeArrow: "#43A047",
  boost: "#FF4081",
  boostGlow: "#FF80AB",
  gate: "#607D8B",
  gateHighlight: "#90A4AE",

  // Ball
  ball: "#FFFFFF",
  ballShadow: "rgba(0,0,0,0.35)",
  ballStroke: "#CCCCCC",

  // Tee
  tee: "rgba(255,255,255,0.5)",
  teeStroke: "rgba(255,255,255,0.2)",
};

// Visual ball radius (larger than physics for visibility)
const VISUAL_BALL_R = 0.11;
const VISUAL_BALL_SHADOW_R = 0.12;

// =============================================================================
// Props
// =============================================================================

interface CourseRendererProps {
  hole: HoleDef;
  ballPositions: Record<string, Vec2>;
  ballColors?: Record<string, string>;
  currentPlayerUid?: string;
  sunkenUids?: Set<string>;
  scale?: number;
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  showDebug?: boolean;
}

// =============================================================================
// Helpers
// =============================================================================

function pointsToStr(pts: Vec2[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

/** Generate arrow markers along a polygon for force-indicating regions */
function forceArrows(vertices: Vec2[], force: Vec2, count = 3): Vec2[] {
  if (vertices.length < 2) return [];
  const cx = vertices.reduce((s, v) => s + v.x, 0) / vertices.length;
  const cy = vertices.reduce((s, v) => s + v.y, 0) / vertices.length;
  const angle = Math.atan2(force.y, force.x);
  const pts: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i - (count - 1) / 2) * 0.4;
    const px = cx + Math.cos(angle + Math.PI / 2) * t;
    const py = cy + Math.sin(angle + Math.PI / 2) * t;
    pts.push({ x: px, y: py });
  }
  return pts;
}

// =============================================================================
// Component
// =============================================================================

const CourseRenderer: React.FC<CourseRendererProps> = ({
  hole,
  ballPositions,
  ballColors = {},
  currentPlayerUid,
  sunkenUids = new Set(),
  width,
  height,
  offsetX = 0,
  offsetY = 0,
  showDebug = false,
}) => {
  const vbW = hole.bounds.width;
  const vbH = hole.bounds.height;
  const pad = 0.25; // padding around hole in world units

  const ballEntries = useMemo(() => {
    return Object.entries(ballPositions).filter(
      ([uid]) => !sunkenUids.has(uid),
    );
  }, [ballPositions, sunkenUids]);

  // Wall stroke widths
  const railW = 0.24;
  const railInnerW = 0.15;

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`${-pad + offsetX / 50} ${-pad + offsetY / 50} ${vbW + 2 * pad} ${vbH + 2 * pad}`}
      preserveAspectRatio="xMidYMid meet"
      pointerEvents="none"
    >
      <Defs>
        {/* Cup gradient — dark hole with subtle ring */}
        <RadialGradient id="cupGrad" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={C.cupInner} stopOpacity="1" />
          <Stop offset="70%" stopColor={C.cupOuter} stopOpacity="1" />
          <Stop offset="100%" stopColor="#444" stopOpacity="0.6" />
        </RadialGradient>

        {/* Ball shine gradient */}
        <RadialGradient id="ballShine" cx="35%" cy="30%" r="65%">
          <Stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <Stop offset="50%" stopColor="#f0f0f0" stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#ccc" stopOpacity="0.85" />
        </RadialGradient>

        {/* Turf background gradient */}
        <LinearGradient id="turfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={C.turf} />
          <Stop offset="50%" stopColor={C.turfEdge} />
          <Stop offset="100%" stopColor={C.turf} />
        </LinearGradient>

        {/* Water gradient */}
        <LinearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={C.water} />
          <Stop offset="50%" stopColor={C.waterWave} />
          <Stop offset="100%" stopColor={C.water} />
        </LinearGradient>

        {/* Sand fill pattern-like gradient */}
        <RadialGradient id="sandGrad" cx="50%" cy="50%" r="70%">
          <Stop offset="0%" stopColor={C.sand} />
          <Stop offset="100%" stopColor={C.sandDot} />
        </RadialGradient>

        {/* Bumper gradient */}
        <RadialGradient id="bumperGrad" cx="40%" cy="35%" r="60%">
          <Stop offset="0%" stopColor={C.bumperHighlight} />
          <Stop offset="100%" stopColor={C.bumperFill} />
        </RadialGradient>

        {/* Portal glow */}
        <RadialGradient id="portalGrad" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={C.portalGlow} stopOpacity="0.9" />
          <Stop offset="60%" stopColor={C.portal} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={C.portal} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* ── Background (turf) ──────────────────────────────────────── */}
      <Rect
        x={-pad}
        y={-pad}
        width={vbW + 2 * pad}
        height={vbH + 2 * pad}
        fill={C.turfEdge}
        rx={0.2}
      />
      <Rect
        x={0}
        y={0}
        width={vbW}
        height={vbH}
        fill="url(#turfGrad)"
        rx={0.08}
      />

      {/* Turf stripes (subtle mowing pattern) */}
      {Array.from({ length: Math.ceil(vbH / 0.8) }, (_, i) =>
        i % 2 === 0 ? (
          <Rect
            key={`stripe-${i}`}
            x={0}
            y={i * 0.8}
            width={vbW}
            height={0.8}
            fill={C.turfStripe}
            opacity={0.12}
          />
        ) : null,
      )}

      {/* ── Surface regions ────────────────────────────────────────── */}
      {(hole.surfaces ?? []).map((s, i) => {
        let fill: string;
        let stroke: string;
        let opacity = 0.85;
        if (s.type === "sand") {
          fill = "url(#sandGrad)";
          stroke = C.sandStroke;
        } else if (s.type === "ice") {
          fill = C.ice;
          stroke = C.iceStroke;
          opacity = 0.7;
        } else if (s.type === "rough") {
          fill = C.rough;
          stroke = C.roughStroke;
        } else {
          fill = C.turf;
          stroke = C.turfEdge;
        }
        return (
          <G key={`surface-${i}`}>
            <SvgPolygon
              points={pointsToStr(s.vertices)}
              fill={fill}
              opacity={opacity}
              stroke={stroke}
              strokeWidth={0.04}
            />
            {/* Sand dots for texture */}
            {s.type === "sand" &&
              s.vertices.length >= 3 &&
              (() => {
                const cx =
                  s.vertices.reduce((a, v) => a + v.x, 0) / s.vertices.length;
                const cy =
                  s.vertices.reduce((a, v) => a + v.y, 0) / s.vertices.length;
                return (
                  <>
                    <Circle
                      cx={cx - 0.2}
                      cy={cy - 0.15}
                      r={0.04}
                      fill={C.sandStroke}
                      opacity={0.4}
                    />
                    <Circle
                      cx={cx + 0.15}
                      cy={cy + 0.1}
                      r={0.03}
                      fill={C.sandStroke}
                      opacity={0.4}
                    />
                    <Circle
                      cx={cx}
                      cy={cy + 0.2}
                      r={0.035}
                      fill={C.sandStroke}
                      opacity={0.35}
                    />
                    <Circle
                      cx={cx - 0.1}
                      cy={cy + 0.05}
                      r={0.03}
                      fill={C.sandStroke}
                      opacity={0.3}
                    />
                  </>
                );
              })()}
            {/* Ice shine */}
            {s.type === "ice" &&
              s.vertices.length >= 3 &&
              (() => {
                const cx =
                  s.vertices.reduce((a, v) => a + v.x, 0) / s.vertices.length;
                const cy =
                  s.vertices.reduce((a, v) => a + v.y, 0) / s.vertices.length;
                return (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={0.3}
                    fill={C.iceShine}
                    opacity={0.25}
                  />
                );
              })()}
          </G>
        );
      })}

      {/* ── Hazard regions ─────────────────────────────────────────── */}
      {(hole.hazards ?? []).map((h, i) => (
        <G key={`hazard-${i}`}>
          {h.type === "water" ? (
            <>
              <SvgPolygon
                points={pointsToStr(h.vertices)}
                fill="url(#waterGrad)"
                opacity={0.8}
                stroke={C.waterStroke}
                strokeWidth={0.05}
              />
              {/* Wave lines */}
              {h.vertices.length >= 4 &&
                (() => {
                  const cx =
                    h.vertices.reduce((a, v) => a + v.x, 0) / h.vertices.length;
                  const cy =
                    h.vertices.reduce((a, v) => a + v.y, 0) / h.vertices.length;
                  return (
                    <>
                      <Line
                        x1={cx - 0.3}
                        y1={cy - 0.08}
                        x2={cx + 0.3}
                        y2={cy - 0.08}
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth={0.03}
                        strokeDasharray="0.15,0.1"
                      />
                      <Line
                        x1={cx - 0.2}
                        y1={cy + 0.08}
                        x2={cx + 0.4}
                        y2={cy + 0.08}
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth={0.03}
                        strokeDasharray="0.12,0.08"
                      />
                    </>
                  );
                })()}
            </>
          ) : (
            <SvgPolygon
              points={pointsToStr(h.vertices)}
              fill={C.oob}
              opacity={0.5}
              stroke={C.oobStroke}
              strokeWidth={0.04}
              strokeDasharray="0.15,0.08"
            />
          )}
        </G>
      ))}

      {/* ── Conveyor regions ───────────────────────────────────────── */}
      {(hole.conveyors ?? []).map((c, i) => {
        const arrows = forceArrows(c.vertices, c.force, 3);
        const angle = (Math.atan2(c.force.y, c.force.x) * 180) / Math.PI;
        return (
          <G key={`conveyor-${i}`}>
            <SvgPolygon
              points={pointsToStr(c.vertices)}
              fill={C.conveyor}
              opacity={0.35}
              stroke={C.conveyorStripe}
              strokeWidth={0.04}
              strokeDasharray="0.2,0.1"
            />
            {arrows.map((a, j) => (
              <SvgText
                key={`ca-${j}`}
                x={a.x}
                y={a.y}
                fontSize={0.35}
                fill={C.conveyor}
                opacity={0.6}
                textAnchor="middle"
                rotation={angle}
                originX={a.x}
                originY={a.y}
              >
                ›
              </SvgText>
            ))}
          </G>
        );
      })}

      {/* ── Slope regions ──────────────────────────────────────────── */}
      {(hole.slopes ?? []).map((s, i) => {
        const arrows = forceArrows(s.vertices, s.force, 2);
        const angle = (Math.atan2(s.force.y, s.force.x) * 180) / Math.PI;
        return (
          <G key={`slope-${i}`}>
            <SvgPolygon
              points={pointsToStr(s.vertices)}
              fill={C.slope}
              opacity={0.2}
              stroke={C.slopeArrow}
              strokeWidth={0.03}
            />
            {arrows.map((a, j) => (
              <SvgText
                key={`sa-${j}`}
                x={a.x}
                y={a.y}
                fontSize={0.3}
                fill={C.slopeArrow}
                opacity={0.5}
                textAnchor="middle"
                rotation={angle}
                originX={a.x}
                originY={a.y}
              >
                ▸
              </SvgText>
            ))}
          </G>
        );
      })}

      {/* ── Boost regions ──────────────────────────────────────────── */}
      {(hole.boosts ?? []).map((b, i) => (
        <G key={`boost-${i}`}>
          <SvgPolygon
            points={pointsToStr(b.vertices)}
            fill={C.boost}
            opacity={0.25}
            stroke={C.boostGlow}
            strokeWidth={0.04}
          />
          {(() => {
            const cx =
              b.vertices.reduce((a, v) => a + v.x, 0) / b.vertices.length;
            const cy =
              b.vertices.reduce((a, v) => a + v.y, 0) / b.vertices.length;
            return (
              <SvgText
                x={cx}
                y={cy + 0.12}
                fontSize={0.35}
                fill={C.boost}
                opacity={0.6}
                textAnchor="middle"
              >
                ⚡
              </SvgText>
            );
          })()}
        </G>
      ))}

      {/* ── Portals ────────────────────────────────────────────────── */}
      {(hole.portals ?? []).map((p) => (
        <G key={`portal-${p.id}`}>
          <Circle
            cx={p.pos.x}
            cy={p.pos.y}
            r={p.radius * 1.4}
            fill="url(#portalGrad)"
          />
          <Circle
            cx={p.pos.x}
            cy={p.pos.y}
            r={p.radius}
            fill={C.portal}
            opacity={0.7}
            stroke={C.portalGlow}
            strokeWidth={0.05}
          />
          <Circle
            cx={p.pos.x}
            cy={p.pos.y}
            r={p.radius * 0.4}
            fill="white"
            opacity={0.3}
          />
        </G>
      ))}

      {/* ── Walls (thick 3D rails) ─────────────────────────────────── */}
      {hole.walls.map((w, i) => {
        const pts = pointsToStr(w.points);
        const El = w.loop ? SvgPolygon : Polyline;
        return (
          <G key={`wall-${i}`}>
            {/* Shadow layer */}
            <El
              points={pts}
              fill="none"
              stroke="rgba(0,0,0,0.3)"
              strokeWidth={railW + 0.06}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Outer rail (dark edge) */}
            <El
              points={pts}
              fill="none"
              stroke={C.railOuter}
              strokeWidth={railW}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Inner rail (lighter wood tone) */}
            <El
              points={pts}
              fill="none"
              stroke={C.railInner}
              strokeWidth={railInnerW}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Highlight (top-lit effect) */}
            <El
              points={pts}
              fill="none"
              stroke={C.railHighlight}
              strokeWidth={0.05}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.5}
            />
          </G>
        );
      })}

      {/* ── Bumpers (3D shaded circles) ────────────────────────────── */}
      {(hole.bumpers ?? []).map((b, i) => (
        <G key={`bumper-${i}`}>
          {/* Shadow */}
          <Circle
            cx={b.pos.x + 0.03}
            cy={b.pos.y + 0.04}
            r={b.radius + 0.02}
            fill="rgba(0,0,0,0.25)"
          />
          {/* Main bumper */}
          <Circle
            cx={b.pos.x}
            cy={b.pos.y}
            r={b.radius}
            fill="url(#bumperGrad)"
            stroke={C.bumperStroke}
            strokeWidth={0.04}
          />
          {/* Top highlight */}
          <Circle
            cx={b.pos.x - b.radius * 0.25}
            cy={b.pos.y - b.radius * 0.25}
            r={b.radius * 0.3}
            fill="white"
            opacity={0.25}
          />
        </G>
      ))}

      {/* ── Rotating gates ─────────────────────────────────────────── */}
      {(hole.rotatingGates ?? []).map((g, i) => (
        <G key={`gate-${i}`}>
          <Line
            x1={g.pivot.x - g.length / 2}
            y1={g.pivot.y}
            x2={g.pivot.x + g.length / 2}
            y2={g.pivot.y}
            stroke={C.gate}
            strokeWidth={g.thickness + 0.04}
            strokeLinecap="round"
          />
          <Line
            x1={g.pivot.x - g.length / 2}
            y1={g.pivot.y}
            x2={g.pivot.x + g.length / 2}
            y2={g.pivot.y}
            stroke={C.gateHighlight}
            strokeWidth={g.thickness}
            strokeLinecap="round"
          />
          {/* Pivot dot */}
          <Circle
            cx={g.pivot.x}
            cy={g.pivot.y}
            r={0.06}
            fill={C.gate}
            stroke={C.gateHighlight}
            strokeWidth={0.02}
          />
        </G>
      ))}

      {/* ── Cup ────────────────────────────────────────────────────── */}
      <G>
        {/* Cup shadow */}
        <Circle
          cx={hole.cup.x + 0.03}
          cy={hole.cup.y + 0.04}
          r={hole.cupRadius + 0.06}
          fill="rgba(0,0,0,0.25)"
        />
        {/* Outer ring */}
        <Circle
          cx={hole.cup.x}
          cy={hole.cup.y}
          r={hole.cupRadius + 0.06}
          fill="none"
          stroke={C.cupRing}
          strokeWidth={0.04}
        />
        {/* Cup body */}
        <Circle
          cx={hole.cup.x}
          cy={hole.cup.y}
          r={hole.cupRadius}
          fill="url(#cupGrad)"
        />
        {/* Inner highlight ring */}
        <Circle
          cx={hole.cup.x}
          cy={hole.cup.y}
          r={hole.cupRadius * 0.5}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={0.02}
        />
      </G>

      {/* ── Flag ───────────────────────────────────────────────────── */}
      <G>
        {/* Pole shadow */}
        <Line
          x1={hole.cup.x + 0.02}
          y1={hole.cup.y + 0.02}
          x2={hole.cup.x + 0.02}
          y2={hole.cup.y - 0.6}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth={0.04}
        />
        {/* Pole */}
        <Line
          x1={hole.cup.x}
          y1={hole.cup.y}
          x2={hole.cup.x}
          y2={hole.cup.y - 0.65}
          stroke={C.flagPole}
          strokeWidth={0.025}
          strokeLinecap="round"
        />
        {/* Flag triangle */}
        <SvgPolygon
          points={`${hole.cup.x},${hole.cup.y - 0.65} ${hole.cup.x + 0.28},${hole.cup.y - 0.52} ${hole.cup.x},${hole.cup.y - 0.4}`}
          fill={C.flag}
        />
        {/* Flag highlight */}
        <SvgPolygon
          points={`${hole.cup.x},${hole.cup.y - 0.65} ${hole.cup.x + 0.14},${hole.cup.y - 0.58} ${hole.cup.x},${hole.cup.y - 0.52}`}
          fill={C.flagHighlight}
          opacity={0.6}
        />
      </G>

      {/* ── Tee marker ─────────────────────────────────────────────── */}
      <G>
        <Circle
          cx={hole.tee.x}
          cy={hole.tee.y}
          r={0.12}
          fill={C.tee}
          stroke={C.teeStroke}
          strokeWidth={0.02}
        />
        {/* Tee cross */}
        <Line
          x1={hole.tee.x - 0.06}
          y1={hole.tee.y}
          x2={hole.tee.x + 0.06}
          y2={hole.tee.y}
          stroke={C.teeStroke}
          strokeWidth={0.015}
        />
        <Line
          x1={hole.tee.x}
          y1={hole.tee.y - 0.06}
          x2={hole.tee.x}
          y2={hole.tee.y + 0.06}
          stroke={C.teeStroke}
          strokeWidth={0.015}
        />
      </G>

      {/* ── Balls ──────────────────────────────────────────────────── */}
      {ballEntries.map(([uid, pos]) => {
        const isActive = uid === currentPlayerUid;
        const color = ballColors[uid] || C.ball;
        return (
          <G key={`ball-${uid}`}>
            {/* Drop shadow */}
            <Circle
              cx={pos.x + 0.03}
              cy={pos.y + 0.04}
              r={VISUAL_BALL_SHADOW_R}
              fill={C.ballShadow}
            />
            {/* Ball body */}
            <Circle
              cx={pos.x}
              cy={pos.y}
              r={VISUAL_BALL_R}
              fill={color}
              stroke={isActive ? "#FFD700" : C.ballStroke}
              strokeWidth={isActive ? 0.035 : 0.015}
            />
            {/* Shine highlight */}
            <Circle
              cx={pos.x - 0.03}
              cy={pos.y - 0.03}
              r={VISUAL_BALL_R * 0.35}
              fill="white"
              opacity={0.55}
            />
            {/* Active player pulse ring */}
            {isActive && (
              <Circle
                cx={pos.x}
                cy={pos.y}
                r={VISUAL_BALL_R + 0.08}
                fill="none"
                stroke="rgba(255,215,0,0.4)"
                strokeWidth={0.025}
              />
            )}
          </G>
        );
      })}

      {/* ── Debug overlay ──────────────────────────────────────────── */}
      {showDebug && (
        <G opacity={0.4}>
          {(hole.surfaces ?? []).map((s, i) => (
            <SvgPolygon
              key={`dbg-surface-${i}`}
              points={pointsToStr(s.vertices)}
              fill="none"
              stroke="cyan"
              strokeWidth={0.02}
              strokeDasharray="0.1,0.05"
            />
          ))}
          {(hole.hazards ?? []).map((h, i) => (
            <SvgPolygon
              key={`dbg-hazard-${i}`}
              points={pointsToStr(h.vertices)}
              fill="none"
              stroke="red"
              strokeWidth={0.02}
              strokeDasharray="0.1,0.05"
            />
          ))}
          {/* Grid lines */}
          {Array.from({ length: Math.ceil(vbW) + 1 }, (_, x) => (
            <Line
              key={`gx-${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={vbH}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={0.01}
            />
          ))}
          {Array.from({ length: Math.ceil(vbH) + 1 }, (_, y) => (
            <Line
              key={`gy-${y}`}
              x1={0}
              y1={y}
              x2={vbW}
              y2={y}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={0.01}
            />
          ))}
        </G>
      )}
    </Svg>
  );
};

export default React.memo(CourseRenderer);
