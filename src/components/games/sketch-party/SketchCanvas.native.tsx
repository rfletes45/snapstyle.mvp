/**
 * SketchCanvas — Skia-based drawing canvas for Sketch Party (Native)
 *
 * Virtual coordinate space: 1024×1024 (square).
 * All strokes are stored as virtual-point arrays and converted to screen
 * coordinates when building Skia Paths for rendering. This ensures:
 *  1) React detects path changes (fresh SkPath objects each render)
 *  2) Incoming draw ops (virtual coords) render correctly on any screen size
 *  3) Consistent square canvas across platforms
 *
 * Drawer: touch input → virtual points → send draw ops via hook actions.
 * Guesser/spectator: receive draw ops → store virtual points → render.
 *
 * @see colyseus-server/src/rooms/party/SketchPartyRoom.ts
 */

import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";

import type { DrawOp } from "@/hooks/useSketchPartyGame";

// =============================================================================
// Constants
// =============================================================================

/** Virtual canvas resolution (square) */
const VIRT = 1024;

const DEFAULT_COLOR = "#000000";
const DEFAULT_WIDTH = 4;

/** Min interval (ms) between draw_points sends */
const SEND_INTERVAL_MS = 25;

// =============================================================================
// Types
// =============================================================================

/** Stroke stored as virtual-coordinate points */
interface StrokeData {
  points: Array<[number, number]>; // [vx, vy] in 0..1023
  color: string;
  width: number; // virtual units
  isEraser: boolean;
}

export interface SketchCanvasProps {
  canDraw: boolean;
  brushColor?: string;
  brushWidth?: number;
  isEraser?: boolean;
  drawOps: DrawOp[];
  canvasSnapshot: DrawOp[] | null;
  onDrawBegin?: (payload: any) => void;
  onDrawPoints?: (payload: any) => void;
  onDrawEnd?: (payload: any) => void;
}

export interface SketchCanvasRef {
  undo: () => void;
  clear: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const SketchCanvas = forwardRef<SketchCanvasRef, SketchCanvasProps>(
  function SketchCanvas(
    {
      canDraw,
      brushColor = DEFAULT_COLOR,
      brushWidth = DEFAULT_WIDTH,
      isEraser = false,
      drawOps,
      canvasSnapshot,
      onDrawBegin,
      onDrawPoints,
      onDrawEnd,
    },
    ref,
  ) {
    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------
    const [strokes, setStrokes] = useState<StrokeData[]>([]);
    const activeStrokeRef = useRef<StrokeData | null>(null);
    const pendingPointsRef = useRef<number[]>([]);
    const lastSendRef = useRef(0);
    const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Canvas square size (min of container width/height)
    const containerSizeRef = useRef({ width: 0, height: 0 });
    const [canvasSize, setCanvasSize] = useState(0);

    // Processed ops tracking
    const processedOpsCountRef = useRef(0);
    const processedSnapshotRef = useRef<DrawOp[] | null>(null);

    // -----------------------------------------------------------------------
    // Apply snapshot
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (!canvasSnapshot || canvasSnapshot === processedSnapshotRef.current)
        return;
      processedSnapshotRef.current = canvasSnapshot;
      processedOpsCountRef.current = 0;
      setStrokes(rebuildStrokesFromOps(canvasSnapshot));
      activeStrokeRef.current = null;
    }, [canvasSnapshot]);

    // -----------------------------------------------------------------------
    // Detect turn reset: parent cleared drawOps + canvasSnapshot
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (
        drawOps.length === 0 &&
        !canvasSnapshot &&
        processedOpsCountRef.current > 0
      ) {
        processedOpsCountRef.current = 0;
        setStrokes([]);
        activeStrokeRef.current = null;
      }
    }, [drawOps, canvasSnapshot]);

    // -----------------------------------------------------------------------
    // Apply incoming draw ops (incremental)
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (drawOps.length <= processedOpsCountRef.current) return;
      const newOps = drawOps.slice(processedOpsCountRef.current);
      processedOpsCountRef.current = drawOps.length;

      setStrokes((prev) => {
        let next = [...prev];
        for (const op of newOps) {
          next = applyOp(next, op);
        }
        return next;
      });
    }, [drawOps]);

    // -----------------------------------------------------------------------
    // Imperative handle
    // -----------------------------------------------------------------------
    useImperativeHandle(ref, () => ({
      undo: () => {
        setStrokes((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
      },
      clear: () => {
        setStrokes([]);
        activeStrokeRef.current = null;
      },
    }));

    // -----------------------------------------------------------------------
    // Coordinate helpers — use containerSizeRef (always current via ref)
    // -----------------------------------------------------------------------
    const toVirt = useCallback((x: number, y: number): [number, number] => {
      const { width, height } = containerSizeRef.current;
      const size = Math.min(width, height);
      if (size <= 0) return [0, 0];
      const ox = (width - size) / 2;
      const oy = (height - size) / 2;
      return [
        Math.round(Math.max(0, Math.min(1023, ((x - ox) / size) * 1023))),
        Math.round(Math.max(0, Math.min(1023, ((y - oy) / size) * 1023))),
      ];
    }, []);

    // -----------------------------------------------------------------------
    // Flush pending points
    // -----------------------------------------------------------------------
    const flushPoints = useCallback(() => {
      if (pendingPointsRef.current.length > 0 && onDrawPoints) {
        onDrawPoints({ points: [...pendingPointsRef.current] });
        pendingPointsRef.current = [];
      }
      lastSendRef.current = Date.now();
      sendTimerRef.current = null;
    }, [onDrawPoints]);

    // -----------------------------------------------------------------------
    // Touch handlers (drawer only)
    // -----------------------------------------------------------------------
    const handleTouchStart = useCallback(
      (e: any) => {
        if (!canDraw) return;
        const touch = e.nativeEvent.touches?.[0] ?? e.nativeEvent;
        const [vx, vy] = toVirt(touch.locationX, touch.locationY);

        const stroke: StrokeData = {
          points: [[vx, vy]],
          color: isEraser ? "#FFFFFF" : brushColor,
          width: brushWidth,
          isEraser,
        };
        activeStrokeRef.current = stroke;
        setStrokes((prev) => [...prev, stroke]);

        pendingPointsRef.current = [];
        onDrawBegin?.({
          color: stroke.color,
          width: brushWidth,
          eraser: isEraser,
          x: vx,
          y: vy,
        });
      },
      [canDraw, brushColor, brushWidth, isEraser, toVirt, onDrawBegin],
    );

    const handleTouchMove = useCallback(
      (e: any) => {
        if (!canDraw || !activeStrokeRef.current) return;
        const touch = e.nativeEvent.touches?.[0] ?? e.nativeEvent;
        const [vx, vy] = toVirt(touch.locationX, touch.locationY);

        activeStrokeRef.current.points.push([vx, vy]);
        // New array ref → triggers useMemo recompute → fresh SkPaths
        setStrokes((prev) => [...prev]);

        pendingPointsRef.current.push(vx, vy);

        const now = Date.now();
        if (now - lastSendRef.current >= SEND_INTERVAL_MS) {
          flushPoints();
        } else if (!sendTimerRef.current) {
          sendTimerRef.current = setTimeout(
            flushPoints,
            SEND_INTERVAL_MS - (now - lastSendRef.current),
          );
        }
      },
      [canDraw, toVirt, flushPoints],
    );

    const handleTouchEnd = useCallback(() => {
      if (!canDraw || !activeStrokeRef.current) return;
      flushPoints();
      activeStrokeRef.current = null;
      onDrawEnd?.({});
    }, [canDraw, flushPoints, onDrawEnd]);

    // -----------------------------------------------------------------------
    // Build Skia elements — FRESH SkPath objects from virtual points each
    // render so React/Skia always detects changes.
    // -----------------------------------------------------------------------
    const skiaStrokes = useMemo(() => {
      if (canvasSize <= 0) return null;

      const scale = canvasSize / 1023;

      return strokes.map((s, i) => {
        const path = Skia.Path.Make();
        if (s.points.length > 0) {
          path.moveTo(s.points[0][0] * scale, s.points[0][1] * scale);
          for (let j = 1; j < s.points.length; j++) {
            path.lineTo(s.points[j][0] * scale, s.points[j][1] * scale);
          }
        }
        const strokeWidth = (s.width / VIRT) * canvasSize;
        return (
          <Path
            key={i}
            path={path}
            color={s.color}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            strokeJoin="round"
            blendMode={s.isEraser ? "clear" : "srcOver"}
          />
        );
      });
    }, [strokes, canvasSize]);

    // -----------------------------------------------------------------------
    // Render — Skia Canvas at canvasSize × canvasSize (largest inscribed
    // square), centered. Touch responders stay on the outer View so
    // coordinates include the offset which toVirt accounts for.
    // -----------------------------------------------------------------------
    return (
      <View
        style={styles.outerContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          containerSizeRef.current = { width, height };
          setCanvasSize(Math.floor(Math.min(width, height)));
        }}
        onStartShouldSetResponder={() => canDraw}
        onMoveShouldSetResponder={() => canDraw}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
        onResponderTerminate={handleTouchEnd}
      >
        {canvasSize > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.canvasWrapper,
              { width: canvasSize, height: canvasSize },
            ]}
          >
            <Canvas style={{ width: canvasSize, height: canvasSize }}>
              {skiaStrokes}
            </Canvas>
          </View>
        )}
      </View>
    );
  },
);

// =============================================================================
// Helpers — virtual-point based StrokeData
// =============================================================================

function rebuildStrokesFromOps(ops: DrawOp[]): StrokeData[] {
  const strokes: StrokeData[] = [];
  let current: StrokeData | null = null;

  for (const op of ops) {
    switch (op.type) {
      case "begin": {
        current = {
          points:
            typeof op.x === "number" && typeof op.y === "number"
              ? [[op.x, op.y]]
              : [],
          color: op.eraser ? "#FFFFFF" : (op.color ?? DEFAULT_COLOR),
          width: op.width ?? DEFAULT_WIDTH,
          isEraser: !!op.eraser,
        };
        strokes.push(current);
        break;
      }
      case "points": {
        if (current && Array.isArray(op.points)) {
          for (let i = 0; i < op.points.length - 1; i += 2) {
            current.points.push([op.points[i], op.points[i + 1]]);
          }
        }
        break;
      }
      case "end":
        current = null;
        break;
      case "undo":
        strokes.pop();
        current = null;
        break;
      case "clear":
        strokes.length = 0;
        current = null;
        break;
    }
  }
  return strokes;
}

function applyOp(strokes: StrokeData[], op: DrawOp): StrokeData[] {
  switch (op.type) {
    case "begin":
      return [
        ...strokes,
        {
          points:
            typeof op.x === "number" && typeof op.y === "number"
              ? [[op.x, op.y]]
              : [],
          color: op.eraser ? "#FFFFFF" : (op.color ?? DEFAULT_COLOR),
          width: op.width ?? DEFAULT_WIDTH,
          isEraser: !!op.eraser,
        },
      ];
    case "points": {
      if (strokes.length === 0) return strokes;
      const last = strokes[strokes.length - 1];
      if (Array.isArray(op.points)) {
        for (let i = 0; i < op.points.length - 1; i += 2) {
          last.points.push([op.points[i], op.points[i + 1]]);
        }
      }
      return [...strokes]; // new array ref to trigger re-render
    }
    case "end":
      return strokes;
    case "undo":
      return strokes.length > 0 ? strokes.slice(0, -1) : strokes;
    case "clear":
      return [];
    default:
      return strokes;
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8E8E8",
    borderRadius: 8,
    overflow: "hidden",
  },
  canvasWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    overflow: "hidden",
  },
});
