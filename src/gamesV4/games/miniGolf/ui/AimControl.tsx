/**
 * Mini Golf — Aim Control Component
 *
 * Touch-drag interface for aiming and setting power.
 * Pull back from ball to set direction + power (slingshot style).
 *
 * Uses refs for PanResponder callback values to avoid stale closures.
 *
 * @module gamesV4/games/miniGolf/ui/AimControl
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import type { Vec2 } from "../types";
import { quantizeAngle, quantizePower } from "../utils/quantize";

// =============================================================================
// Props
// =============================================================================

interface AimControlProps {
  onShot: (angleQ: number, powerQ: number) => void;
  disabled?: boolean;
  showAssist?: boolean;
  width: number;
  height: number;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_DRAG_DISTANCE = 150; // pixels
const MIN_DRAG_DISTANCE = 10; // pixels
const POWER_BAR_COLORS = [
  "#4CAF50",
  "#8BC34A",
  "#FFEB3B",
  "#FF9800",
  "#F44336",
];

// =============================================================================
// Component
// =============================================================================

const AimControl: React.FC<AimControlProps> = ({
  onShot,
  disabled = false,
  showAssist = false,
  width,
  height,
}) => {
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<Vec2 | null>(null);
  const startPosRef = useRef<Vec2>({ x: 0, y: 0 });

  // ── Refs for mutable values so PanResponder never goes stale ──────
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onShotRef = useRef(onShot);
  onShotRef.current = onShot;

  if (__DEV__) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      console.log("[AimControl] disabled:", disabled);
    }, [disabled]);
  }

  // Stable PanResponder — reads current values through refs
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          const ok = !disabledRef.current;
          if (__DEV__) console.log("[AimControl] onStartShouldSet:", ok);
          return ok;
        },
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        // Capture phase — claim the gesture BEFORE children/siblings can
        onStartShouldSetPanResponderCapture: () => !disabledRef.current,
        onMoveShouldSetPanResponderCapture: () => !disabledRef.current,
        onPanResponderGrant: (_, gestureState) => {
          if (disabledRef.current) return;
          if (__DEV__) {
            console.log(
              "[AimControl] grant at",
              gestureState.x0,
              gestureState.y0,
            );
          }
          startPosRef.current = {
            x: gestureState.x0,
            y: gestureState.y0,
          };
          setDragging(true);
        },
        onPanResponderMove: (_, gestureState) => {
          setDragPos({
            x: gestureState.moveX,
            y: gestureState.moveY,
          });
        },
        onPanResponderRelease: (_, gestureState) => {
          const dx = gestureState.dx;
          const dy = gestureState.dy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist >= MIN_DRAG_DISTANCE && !disabledRef.current) {
            // Aim direction is OPPOSITE of drag (slingshot)
            const angle = Math.atan2(-dy, -dx);
            const power = Math.min(dist / MAX_DRAG_DISTANCE, 1.0);

            const angleQ = quantizeAngle(angle);
            const powerQ = quantizePower(power);

            if (__DEV__) {
              console.log("[AimControl] shot:", { angleQ, powerQ, dist });
            }

            if (powerQ > 0) {
              onShotRef.current(angleQ, powerQ);
            }
          }

          setDragging(false);
          setDragPos(null);
        },
        onPanResponderTerminate: () => {
          setDragging(false);
          setDragPos(null);
        },
      }),
    [], // stable — all mutable values read via refs
  );

  // Compute display values
  let power = 0;
  let aimAngleDeg = 0;
  if (dragging && dragPos) {
    const dx = dragPos.x - startPosRef.current.x;
    const dy = dragPos.y - startPosRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    power = Math.min(dist / MAX_DRAG_DISTANCE, 1.0);
    aimAngleDeg = (Math.atan2(-dy, -dx) * 180) / Math.PI;
  }

  const powerPercent = Math.round(power * 100);
  const powerColorIdx = Math.min(
    Math.floor(power * POWER_BAR_COLORS.length),
    POWER_BAR_COLORS.length - 1,
  );

  return (
    <View
      style={[styles.container, { width, height }]}
      pointerEvents={disabled ? "none" : "auto"}
      collapsable={false}
      {...panResponder.panHandlers}
    >
      {dragging && dragPos && (
        <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
          {/* Drag line (pull-back indicator) */}
          <Line
            x1={startPosRef.current.x}
            y1={startPosRef.current.y}
            x2={dragPos.x}
            y2={dragPos.y}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={2}
            strokeDasharray="6,4"
          />
          {/* Aim direction indicator (opposite of drag) */}
          {showAssist && power > 0.05 && (
            <Line
              x1={startPosRef.current.x}
              y1={startPosRef.current.y}
              x2={
                startPosRef.current.x +
                Math.cos((aimAngleDeg * Math.PI) / 180) * power * 120
              }
              y2={
                startPosRef.current.y -
                Math.sin((aimAngleDeg * Math.PI) / 180) * power * 120
              }
              stroke="rgba(255,215,0,0.7)"
              strokeWidth={2.5}
              strokeDasharray="4,3"
            />
          )}
          {/* Drag endpoint circle */}
          <Circle
            cx={dragPos.x}
            cy={dragPos.y}
            r={14}
            fill={`rgba(255,255,255,${0.15 + power * 0.2})`}
            stroke="white"
            strokeWidth={2}
          />
          {/* Origin circle */}
          <Circle
            cx={startPosRef.current.x}
            cy={startPosRef.current.y}
            r={6}
            fill="rgba(255,255,255,0.4)"
          />
        </Svg>
      )}

      {/* Power indicator bar */}
      {dragging && (
        <View style={styles.powerIndicator}>
          <View style={styles.powerBarBg}>
            <View
              style={[
                styles.powerBarFill,
                {
                  width: `${powerPercent}%`,
                  backgroundColor: POWER_BAR_COLORS[powerColorIdx],
                },
              ]}
            />
          </View>
          <Text style={styles.powerText}>{powerPercent}%</Text>
        </View>
      )}

      {!dragging && !disabled && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>Drag to aim & shoot</Text>
        </View>
      )}
    </View>
  );
};

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 10,
    // backgroundColor MUST be set for the View to be hit-testable on web.
    // "transparent" is invisible but still registers as a touch target.
    backgroundColor: "transparent",
  },
  powerIndicator: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  powerBarBg: {
    width: "80%",
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  powerBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  powerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  hintContainer: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default React.memo(AimControl);
