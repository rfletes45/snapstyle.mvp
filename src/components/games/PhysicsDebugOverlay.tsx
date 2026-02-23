/**
 * PhysicsDebugOverlay
 *
 * Dev-only overlay for physics-based games (Brick Breaker, Bounce Blitz).
 * Provides:
 *   • Collision count per second
 *   • Ball speed readout
 *   • Slow-motion toggle (0.25× velocity)
 *   • Collision-point trail visualization
 *
 * Wrap this around a game canvas and supply collision events via the
 * exported `usePhysicsDebug` hook.  The overlay and all its tracking
 * are completely tree-shaken in production builds.
 *
 * Usage:
 *   const debug = usePhysicsDebug();
 *   // in your physics loop:
 *   debug.recordCollision(x, y);
 *   debug.setBallSpeed(speed);
 *   // in JSX:
 *   {__DEV__ && <PhysicsDebugOverlay debug={debug} width={W} height={H} />}
 */

import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface CollisionPoint {
  x: number;
  y: number;
  t: number; // Date.now()
}

export interface PhysicsDebugState {
  /** Whether the debug overlay is shown */
  enabled: boolean;
  /** Toggle overlay visibility */
  toggle: () => void;
  /** Whether slow-motion is active (0.25×) */
  slowMo: boolean;
  /** Toggle slow-motion */
  toggleSlowMo: () => void;
  /** Call from your physics loop each time a collision occurs */
  recordCollision: (x: number, y: number) => void;
  /** Set the current ball speed readout */
  setBallSpeed: (s: number) => void;
  /** Current collision-per-second count */
  collisionsPerSecond: number;
  /** Current ball speed */
  ballSpeed: number;
  /** Recent collision points (for trail rendering) */
  collisionTrail: CollisionPoint[];
  /** Velocity multiplier to apply in the game loop (1 or 0.25) */
  speedMultiplier: number;
}

const TRAIL_LIFETIME_MS = 2000; // how long dots stay visible
const MAX_TRAIL_POINTS = 80;

/**
 * Hook that provides all physics-debug state.
 * In production builds the hook returns a no-op stub so it has zero cost.
 */
export function usePhysicsDebug(): PhysicsDebugState {
  const [enabled, setEnabled] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const [ballSpeed, setBallSpeedState] = useState(0);
  const [collisionsPerSecond, setCps] = useState(0);
  const [collisionTrail, setTrail] = useState<CollisionPoint[]>([]);

  // Rolling window for CPS calculation
  const collisionTimes = useRef<number[]>([]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);
  const toggleSlowMo = useCallback(() => setSlowMo((v) => !v), []);

  const setBallSpeed = useCallback(
    (s: number) => {
      if (enabled) setBallSpeedState(Math.round(s * 10) / 10);
    },
    [enabled],
  );

  const recordCollision = useCallback(
    (x: number, y: number) => {
      if (!enabled) return;
      const now = Date.now();
      collisionTimes.current.push(now);
      // Trim to last second
      collisionTimes.current = collisionTimes.current.filter(
        (t) => now - t < 1000,
      );
      setCps(collisionTimes.current.length);

      setTrail((prev) => {
        const updated = [...prev, { x, y, t: now }]
          .filter((p) => now - p.t < TRAIL_LIFETIME_MS)
          .slice(-MAX_TRAIL_POINTS);
        return updated;
      });
    },
    [enabled],
  );

  return {
    enabled,
    toggle,
    slowMo,
    toggleSlowMo,
    recordCollision,
    setBallSpeed,
    collisionsPerSecond,
    ballSpeed,
    collisionTrail,
    speedMultiplier: slowMo ? 0.25 : 1,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  debug: PhysicsDebugState;
  width: number;
  height: number;
}

export function PhysicsDebugOverlay({ debug, width, height }: Props) {
  if (!debug.enabled) {
    // Just render the toggle button
    return (
      <TouchableOpacity style={styles.toggleBtn} onPress={debug.toggle}>
        <Text style={styles.toggleText}>🔧</Text>
      </TouchableOpacity>
    );
  }

  const now = Date.now();

  return (
    <>
      {/* Collision trail dots */}
      {debug.collisionTrail.map((pt, i) => {
        const age = now - pt.t;
        const opacity = Math.max(0, 1 - age / TRAIL_LIFETIME_MS);
        return (
          <View
            key={`${pt.t}-${i}`}
            style={[
              styles.trailDot,
              {
                left: pt.x - 3,
                top: pt.y - 3,
                opacity,
              },
            ]}
          />
        );
      })}

      {/* Stats panel */}
      <View style={styles.panel}>
        <Text style={styles.stat}>CPS: {debug.collisionsPerSecond}</Text>
        <Text style={styles.stat}>Speed: {debug.ballSpeed} px/f</Text>
        <TouchableOpacity
          style={[styles.slowMoBtn, debug.slowMo && styles.slowMoActive]}
          onPress={debug.toggleSlowMo}
        >
          <Text style={styles.slowMoText}>{debug.slowMo ? "0.25×" : "1×"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={debug.toggle}>
          <Text style={styles.toggleText}>✕</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toggleBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  toggleText: {
    fontSize: 14,
    color: "#fff",
  },
  panel: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    padding: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 999,
  },
  stat: {
    color: "#0f0",
    fontSize: 11,
    fontFamily: "monospace",
  },
  slowMoBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  slowMoActive: {
    backgroundColor: "#FF9800",
  },
  slowMoText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  closeBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  trailDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ff0",
    zIndex: 998,
  },
});
