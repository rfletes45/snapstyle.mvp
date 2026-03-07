/**
 * Mini Golf — Aim Input Overlay (Cross-Platform)
 *
 * Captures all touch/pointer input for aiming and shooting.
 * The aim bar ALWAYS originates from the ball position (converted to
 * screen-local coordinates via the SVG viewBox transform).
 *
 * Platform strategy:
 *   - Native (iOS/Android): PanResponder with capture-phase claiming
 *   - Web: raw onPointer* events + touch-action CSS
 *
 * Two separate layers:
 *   1. Input capture layer: zIndex 20, hit-testable
 *   2. Viz layer: zIndex 30, pointerEvents="none", never blocked
 *
 * @module gamesV4/games/miniGolf/ui/AimInputOverlay
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import type { Vec2 } from "../types";
import { quantizeAngle, quantizePower } from "../utils/quantize";

// =============================================================================
// Props
// =============================================================================

export interface AimInputOverlayProps {
  /** Whether the user can currently interact (aim + shoot). */
  canInteract: boolean;
  /** Called when a valid shot is released. */
  onShot: (angleQ: number, powerQ: number) => void;
  /** Show ghost aim line? */
  showAssist?: boolean;
  /** Size of the overlay (matches course container). */
  width: number;
  height: number;
  /** Current ball position in WORLD coords for the active player. */
  ballWorldPos: Vec2 | null;
  /** SVG viewBox params so we can convert world → local screen coords */
  viewBox: { minX: number; minY: number; width: number; height: number };
}

// =============================================================================
// Constants
// =============================================================================

const MAX_DRAG_DISTANCE = 150; // px — full power at this drag length
const MIN_DRAG_DISTANCE = 12; // px — below this, cancel aim
const POWER_BAR_COLORS = [
  "#4CAF50",
  "#8BC34A",
  "#FFEB3B",
  "#FF9800",
  "#F44336",
];

// =============================================================================
// Debug state (exported for the debug overlay widget)
// =============================================================================

export interface AimDebugState {
  canInteract: boolean;
  aiming: boolean;
  lastEventType: string;
  lastEventTime: number;
  handlerFireCount: number;
  power: number;
  angleDeg: number;
  aimRenderCount: number;
}

// =============================================================================
// Component
// =============================================================================

const AimInputOverlay: React.FC<AimInputOverlayProps> = ({
  canInteract,
  onShot,
  showAssist = false,
  width,
  height,
  ballWorldPos,
  viewBox,
}) => {
  // ── Aim state ───────────────────────────────────────────────────────
  const [aiming, setAiming] = useState(false);
  // fingerLocal: the current finger position in LOCAL overlay coords (0,0 = top-left)
  const [fingerLocal, setFingerLocal] = useState<Vec2 | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Layout offset: the overlay's position on screen (for converting page coords → local)
  const layoutRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Debug counters ──────────────────────────────────────────────────
  const handlerFireCountRef = useRef(0);
  const aimRenderCountRef = useRef(0);
  const [debugState, setDebugState] = useState<AimDebugState>({
    canInteract: false,
    aiming: false,
    lastEventType: "none",
    lastEventTime: 0,
    handlerFireCount: 0,
    power: 0,
    angleDeg: 0,
    aimRenderCount: 0,
  });

  // ── Refs for PanResponder (avoid stale closures) ────────────────────
  const canInteractRef = useRef(canInteract);
  canInteractRef.current = canInteract;
  const onShotRef = useRef(onShot);
  onShotRef.current = onShot;
  // Refs for endAim closure
  const ballLocalRef = useRef<Vec2 | null>(null);
  const fingerLocalRef = useRef<Vec2 | null>(null);

  // ── Convert world coords → local screen coords ────────────────────
  const worldToLocal = useCallback(
    (wx: number, wy: number): Vec2 => {
      // SVG "xMidYMid meet" mapping
      const scaleX = width / viewBox.width;
      const scaleY = height / viewBox.height;
      const scale = Math.min(scaleX, scaleY);
      // Centering offsets for "meet"
      const renderedW = viewBox.width * scale;
      const renderedH = viewBox.height * scale;
      const offsetX = (width - renderedW) / 2;
      const offsetY = (height - renderedH) / 2;
      return {
        x: offsetX + (wx - viewBox.minX) * scale,
        y: offsetY + (wy - viewBox.minY) * scale,
      };
    },
    [width, height, viewBox],
  );

  // Ball position in LOCAL coords
  const ballLocal = useMemo(() => {
    if (!ballWorldPos) return null;
    return worldToLocal(ballWorldPos.x, ballWorldPos.y);
  }, [ballWorldPos, worldToLocal]);

  // Keep refs in sync
  useEffect(() => {
    ballLocalRef.current = ballLocal;
  }, [ballLocal]);
  useEffect(() => {
    fingerLocalRef.current = fingerLocal;
  }, [fingerLocal]);

  // ── Derived aim values (ball-anchored) ──────────────────────────────
  let power = 0;
  let angleDeg = 0;
  let aimLineEnd: Vec2 | null = null;

  if (aiming && ballLocal && fingerLocal) {
    const dx = fingerLocal.x - ballLocal.x;
    const dy = fingerLocal.y - ballLocal.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    power = Math.min(dist / MAX_DRAG_DISTANCE, 1.0);
    // Slingshot: aim direction is OPPOSITE of drag direction from ball
    angleDeg = (Math.atan2(-dy, -dx) * 180) / Math.PI;
    // The aim line extends from ball in the SHOT direction
    const shotLen = power * 120; // visual length
    aimLineEnd = {
      x: ballLocal.x + Math.cos((angleDeg * Math.PI) / 180) * shotLen,
      y: ballLocal.y - Math.sin((angleDeg * Math.PI) / 180) * shotLen,
    };
    aimRenderCountRef.current += 1;
  }

  const powerPercent = Math.round(power * 100);
  const powerColorIdx = Math.min(
    Math.floor(power * POWER_BAR_COLORS.length),
    POWER_BAR_COLORS.length - 1,
  );

  // ── Convert page coords → local overlay coords ─────────────────────
  const pageToLocal = useCallback((pageX: number, pageY: number): Vec2 => {
    return {
      x: pageX - layoutRef.current.x,
      y: pageY - layoutRef.current.y,
    };
  }, []);

  // ── Unified aim handlers ────────────────────────────────────────────
  const beginAim = useCallback(
    (pageX: number, pageY: number) => {
      if (!canInteractRef.current) return;
      handlerFireCountRef.current += 1;
      const local = pageToLocal(pageX, pageY);
      if (__DEV__) {
        console.log(
          `[AimOverlay] beginAim local=(${local.x.toFixed(0)}, ${local.y.toFixed(0)}) count=${handlerFireCountRef.current}`,
        );
      }
      setAiming(true);
      setFingerLocal(local);
    },
    [pageToLocal],
  );

  const updateAim = useCallback(
    (pageX: number, pageY: number) => {
      setFingerLocal(pageToLocal(pageX, pageY));
    },
    [pageToLocal],
  );

  const endAim = useCallback(() => {
    // Use refs to get latest values and avoid stale closures in PanResponder
    const bl = ballLocalRef.current;
    const fl = fingerLocalRef.current;

    if (__DEV__) {
      console.log(
        `[AimOverlay] endAim canInteract=${canInteractRef.current} ball=${!!bl} finger=${!!fl}`,
      );
    }

    if (bl && fl && canInteractRef.current) {
      const dx = fl.x - bl.x;
      const dy = fl.y - bl.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= MIN_DRAG_DISTANCE) {
        const angle = Math.atan2(-dy, -dx); // slingshot opposite
        const pwr = Math.min(dist / MAX_DRAG_DISTANCE, 1.0);
        const angleQ = quantizeAngle(angle);
        const powerQ = quantizePower(pwr);

        if (__DEV__) {
          console.log(
            `[AimOverlay] SHOT submitted: angleQ=${angleQ} powerQ=${powerQ} power=${pwr.toFixed(2)}`,
          );
        }

        if (powerQ > 0) {
          onShotRef.current(angleQ, powerQ);
        }
      } else if (__DEV__) {
        console.log(
          `[AimOverlay] aim cancelled (dist=${dist.toFixed(1)} < min=${MIN_DRAG_DISTANCE})`,
        );
      }
    }

    setAiming(false);
    setFingerLocal(null);
    activePointerIdRef.current = null;
  }, []);

  const cancelAim = useCallback(() => {
    setAiming(false);
    setFingerLocal(null);
    activePointerIdRef.current = null;
  }, []);

  // ── Capture overlay layout offset ───────────────────────────────────
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    e.target?.measure?.(
      (
        x: number,
        y: number,
        w: number,
        h: number,
        pageX: number,
        pageY: number,
      ) => {
        if (typeof pageX === "number" && typeof pageY === "number") {
          layoutRef.current = { x: pageX, y: pageY };
          if (__DEV__) {
            console.log(
              `[AimOverlay] layout measured: pageX=${pageX.toFixed(0)} pageY=${pageY.toFixed(0)}`,
            );
          }
        }
      },
    );
  }, []);

  // Web fallback: getBoundingClientRect
  const overlayViewRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS === "web" && overlayViewRef.current) {
      const measure = () => {
        try {
          const node = overlayViewRef.current as unknown as {
            getBoundingClientRect?: () => DOMRect;
          };
          if (node?.getBoundingClientRect) {
            const rect = node.getBoundingClientRect();
            layoutRef.current = { x: rect.left, y: rect.top };
          }
        } catch {
          // ignore
        }
      };
      measure();
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
  }, []);

  // ── Update debug state ──────────────────────────────────────────────
  useEffect(() => {
    if (__DEV__) {
      setDebugState({
        canInteract,
        aiming,
        lastEventType: aiming ? "aiming" : "idle",
        lastEventTime: Date.now(),
        handlerFireCount: handlerFireCountRef.current,
        power,
        angleDeg,
        aimRenderCount: aimRenderCountRef.current,
      });
    }
  }, [canInteract, aiming, power, angleDeg]);

  // ══════════════════════════════════════════════════════════════════════
  // NATIVE (iOS/Android) — PanResponder
  // ══════════════════════════════════════════════════════════════════════
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          if (__DEV__)
            console.log(
              "[AimOverlay/PR] onStartShouldSet:",
              canInteractRef.current,
            );
          return canInteractRef.current;
        },
        onMoveShouldSetPanResponder: () => canInteractRef.current,
        onStartShouldSetPanResponderCapture: () => canInteractRef.current,
        onMoveShouldSetPanResponderCapture: () => canInteractRef.current,

        onPanResponderGrant: (
          evt: GestureResponderEvent,
          _gs: PanResponderGestureState,
        ) => {
          const { pageX, pageY } = evt.nativeEvent;
          beginAim(pageX, pageY);
        },
        onPanResponderMove: (
          evt: GestureResponderEvent,
          _gs: PanResponderGestureState,
        ) => {
          const { pageX, pageY } = evt.nativeEvent;
          updateAim(pageX, pageY);
        },
        onPanResponderRelease: () => {
          endAim();
        },
        onPanResponderTerminate: () => {
          if (__DEV__) console.log("[AimOverlay/PR] terminated");
          cancelAim();
        },
      }),
    [beginAim, updateAim, endAim, cancelAim],
  );

  // ══════════════════════════════════════════════════════════════════════
  // WEB — raw pointer events
  // ══════════════════════════════════════════════════════════════════════
  const onPointerDown = useCallback(
    (e: React.PointerEvent<View> | PointerEvent) => {
      if (!canInteractRef.current) return;
      if (activePointerIdRef.current !== null) return;

      const pe = e as unknown as PointerEvent;
      activePointerIdRef.current = pe.pointerId;
      beginAim(pe.pageX, pe.pageY);

      if (typeof pe.preventDefault === "function") pe.preventDefault();
    },
    [beginAim],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<View> | PointerEvent) => {
      const pe = e as unknown as PointerEvent;
      if (pe.pointerId !== activePointerIdRef.current) return;
      updateAim(pe.pageX, pe.pageY);
    },
    [updateAim],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<View> | PointerEvent) => {
      const pe = e as unknown as PointerEvent;
      if (pe.pointerId !== activePointerIdRef.current) return;
      endAim();
    },
    [endAim],
  );

  const onPointerCancel = useCallback(() => {
    cancelAim();
  }, [cancelAim]);

  // ── Log canInteract changes ─────────────────────────────────────────
  useEffect(() => {
    if (__DEV__) {
      console.log(`[AimOverlay] canInteract changed: ${canInteract}`);
    }
    if (!canInteract) {
      cancelAim();
    }
  }, [canInteract, cancelAim]);

  // ══════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════

  const isWeb = Platform.OS === "web";

  // Build the props for the INPUT capture view
  const inputProps: Record<string, unknown> = {
    style: [
      styles.inputLayer,
      { width, height },
      isWeb && canInteract
        ? { touchAction: "none", cursor: "crosshair" }
        : undefined,
    ],
    pointerEvents: canInteract ? ("auto" as const) : ("none" as const),
    collapsable: false,
    onLayout,
    ref: overlayViewRef,
  };

  if (isWeb) {
    inputProps.onPointerDown = onPointerDown;
    inputProps.onPointerMove = onPointerMove;
    inputProps.onPointerUp = onPointerUp;
    inputProps.onPointerCancel = onPointerCancel;
  } else {
    Object.assign(inputProps, panResponder.panHandlers);
  }

  return (
    <>
      {/* ── Input capture layer (hit-testable, no visuals) ────────── */}
      <View {...(inputProps as React.ComponentProps<typeof View>)} />

      {/* ── SVG visualization layer (ABOVE input, pointerEvents=none) */}
      <View style={[styles.vizLayer, { width, height }]} pointerEvents="none">
        {aiming && ballLocal && fingerLocal && (
          <Svg
            style={StyleSheet.absoluteFill}
            width={width}
            height={height}
            pointerEvents="none"
          >
            {/* Pull-back line: ball → finger */}
            <Line
              x1={ballLocal.x}
              y1={ballLocal.y}
              x2={fingerLocal.x}
              y2={fingerLocal.y}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={2}
              strokeDasharray="6,4"
            />
            {/* Shot direction line: ball → opposite of drag */}
            {aimLineEnd && power > 0.05 && (
              <Line
                x1={ballLocal.x}
                y1={ballLocal.y}
                x2={aimLineEnd.x}
                y2={aimLineEnd.y}
                stroke={POWER_BAR_COLORS[powerColorIdx]}
                strokeWidth={3}
                strokeDasharray="4,3"
              />
            )}
            {/* Assist ghost line (longer) */}
            {showAssist && aimLineEnd && power > 0.05 && (
              <Line
                x1={ballLocal.x}
                y1={ballLocal.y}
                x2={
                  ballLocal.x +
                  Math.cos((angleDeg * Math.PI) / 180) * power * 200
                }
                y2={
                  ballLocal.y -
                  Math.sin((angleDeg * Math.PI) / 180) * power * 200
                }
                stroke="rgba(255,215,0,0.4)"
                strokeWidth={1.5}
                strokeDasharray="3,5"
              />
            )}
            {/* Finger endpoint circle */}
            <Circle
              cx={fingerLocal.x}
              cy={fingerLocal.y}
              r={14}
              fill={`rgba(255,255,255,${0.15 + power * 0.25})`}
              stroke="white"
              strokeWidth={2}
            />
            {/* Ball origin ring */}
            <Circle
              cx={ballLocal.x}
              cy={ballLocal.y}
              r={8}
              fill="rgba(255,255,255,0.0)"
              stroke={POWER_BAR_COLORS[powerColorIdx]}
              strokeWidth={2.5}
            />
          </Svg>
        )}

        {/* ── Power bar ─────────────────────────────────────────── */}
        {aiming && (
          <View style={styles.powerBar} pointerEvents="none">
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

        {/* ── Hint when idle ────────────────────────────────────── */}
        {!aiming && canInteract && (
          <View style={styles.hintContainer} pointerEvents="none">
            <Text style={styles.hintText}>↕ Drag anywhere to aim & shoot</Text>
          </View>
        )}
      </View>

      {/* ── DEV debug overlay widget ──────────────────────────────── */}
      {__DEV__ && (
        <View style={styles.debugWidget} pointerEvents="none">
          <Text
            style={[styles.debugText, { color: canInteract ? "#0F0" : "#F00" }]}
          >
            {canInteract ? "● CAN AIM" : "○ BLOCKED"}
          </Text>
          <Text style={styles.debugText}>
            {aiming
              ? `Aiming ${powerPercent}% @ ${angleDeg.toFixed(0)}°`
              : "Idle"}
          </Text>
          <Text style={styles.debugText}>
            events: {handlerFireCountRef.current} | renders:{" "}
            {aimRenderCountRef.current}
          </Text>
          {aiming && (
            <Text style={styles.debugText}>
              ball: {ballLocal?.x.toFixed(0)},{ballLocal?.y.toFixed(0)} finger:{" "}
              {fingerLocal?.x.toFixed(0)},{fingerLocal?.y.toFixed(0)}
            </Text>
          )}
        </View>
      )}
    </>
  );
};

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  inputLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 20,
    backgroundColor: "rgba(0,0,0,0.001)", // hit-testable everywhere
  },
  vizLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 30, // ABOVE input layer and course renderer
  },
  powerBar: {
    position: "absolute",
    bottom: 24,
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
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  hintContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  debugWidget: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 50,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  debugText: {
    color: "#0F0",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontWeight: "600",
  },
});

export default React.memo(AimInputOverlay);
