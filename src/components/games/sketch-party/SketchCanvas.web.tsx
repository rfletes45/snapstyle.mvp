/**
 * SketchCanvas (Web) — HTML Canvas fallback for Sketch Party on web
 *
 * Same virtual coordinate space (1024×1024 square) and identical
 * props/ref interface as the native Skia version, but uses an
 * HTML <canvas> element rendered via a React ref.
 *
 * The canvas is always square (largest inscribed square in its
 * container) and centred, matching the native version so drawings
 * appear identically across platforms.
 *
 * @see ./SketchCanvas.native.tsx for the Skia-based mobile version
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";

import type { DrawOp } from "@/hooks/useSketchPartyGame";

// =============================================================================
// Constants
// =============================================================================

const VIRT = 1024;
const DEFAULT_COLOR = "#000000";
const DEFAULT_WIDTH = 4;
const SEND_INTERVAL_MS = 25;

// =============================================================================
// Types
// =============================================================================

interface StrokeData {
  points: Array<{ x: number; y: number }>; // virtual coords 0..1023
  color: string;
  width: number;
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
    const canvasElRef = useRef<HTMLCanvasElement | null>(null);
    const strokesRef = useRef<StrokeData[]>([]);
    const activeStrokeRef = useRef<StrokeData | null>(null);
    const pendingPointsRef = useRef<number[]>([]);
    const lastSendRef = useRef(0);
    const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** CSS-pixel side-length of the square canvas */
    const squareSizeRef = useRef(0);
    const processedOpsCountRef = useRef(0);
    const processedSnapshotRef = useRef<DrawOp[] | null>(null);
    const [squareSize, setSquareSize] = useState(0);

    // -----------------------------------------------------------------------
    // Coordinate helpers — canvas is always square so no offset needed
    // -----------------------------------------------------------------------
    const toVirt = useCallback(
      (clientX: number, clientY: number): [number, number] => {
        const canvas = canvasElRef.current;
        if (!canvas) return [0, 0];
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return [0, 0];
        const nx = Math.round(
          Math.max(
            0,
            Math.min(1023, ((clientX - rect.left) / rect.width) * 1023),
          ),
        );
        const ny = Math.round(
          Math.max(
            0,
            Math.min(1023, ((clientY - rect.top) / rect.height) * 1023),
          ),
        );
        return [nx, ny];
      },
      [],
    );

    const fromVirt = useCallback((vx: number, vy: number): [number, number] => {
      const size = squareSizeRef.current;
      if (size <= 0) return [0, 0];
      return [(vx / 1023) * size, (vy / 1023) * size];
    }, []);

    const virtWidth = useCallback((vw: number): number => {
      const size = squareSizeRef.current;
      return (vw / VIRT) * size;
    }, []);

    // -----------------------------------------------------------------------
    // Full re-draw
    // -----------------------------------------------------------------------
    const redraw = useCallback(() => {
      const canvas = canvasElRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const size = squareSizeRef.current;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, size, size);

      for (const stroke of strokesRef.current) {
        if (stroke.points.length === 0) continue;
        ctx.save();
        ctx.lineWidth = virtWidth(stroke.width);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (stroke.isEraser) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = stroke.color;
        }

        ctx.beginPath();
        const [sx, sy] = fromVirt(stroke.points[0].x, stroke.points[0].y);
        ctx.moveTo(sx, sy);
        for (let i = 1; i < stroke.points.length; i++) {
          const [px, py] = fromVirt(stroke.points[i].x, stroke.points[i].y);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }
    }, [fromVirt, virtWidth]);

    // -----------------------------------------------------------------------
    // Apply snapshot
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (!canvasSnapshot || canvasSnapshot === processedSnapshotRef.current)
        return;
      processedSnapshotRef.current = canvasSnapshot;
      processedOpsCountRef.current = 0;
      strokesRef.current = rebuildStrokesFromOps(canvasSnapshot);
      activeStrokeRef.current = null;
      redraw();
    }, [canvasSnapshot, redraw]);

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
        strokesRef.current = [];
        activeStrokeRef.current = null;
        redraw();
      }
    }, [drawOps, canvasSnapshot, redraw]);

    // -----------------------------------------------------------------------
    // Apply incoming draw ops
    // -----------------------------------------------------------------------
    useEffect(() => {
      if (drawOps.length <= processedOpsCountRef.current) return;
      const newOps = drawOps.slice(processedOpsCountRef.current);
      processedOpsCountRef.current = drawOps.length;

      for (const op of newOps) {
        applyOp(strokesRef.current, op);
      }
      redraw();
    }, [drawOps, redraw]);

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
    // Imperative handle
    // -----------------------------------------------------------------------
    useImperativeHandle(ref, () => ({
      undo: () => {
        if (strokesRef.current.length > 0) {
          strokesRef.current.pop();
          redraw();
        }
      },
      clear: () => {
        strokesRef.current = [];
        activeStrokeRef.current = null;
        redraw();
      },
    }));

    // -----------------------------------------------------------------------
    // Pointer handlers for web
    // -----------------------------------------------------------------------
    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!canDraw) return;
        e.preventDefault();
        const [vx, vy] = toVirt(e.clientX, e.clientY);

        const stroke: StrokeData = {
          points: [{ x: vx, y: vy }],
          color: isEraser ? "#FFFFFF" : brushColor,
          width: brushWidth,
          isEraser,
        };
        strokesRef.current.push(stroke);
        activeStrokeRef.current = stroke;
        redraw();

        pendingPointsRef.current = [];
        onDrawBegin?.({
          color: stroke.color,
          width: brushWidth,
          eraser: isEraser,
          x: vx,
          y: vy,
        });

        // Capture pointer so moves outside canvas still tracked
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      },
      [canDraw, brushColor, brushWidth, isEraser, toVirt, redraw, onDrawBegin],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!canDraw || !activeStrokeRef.current) return;
        e.preventDefault();
        const [vx, vy] = toVirt(e.clientX, e.clientY);

        activeStrokeRef.current.points.push({ x: vx, y: vy });
        redraw();

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
      [canDraw, toVirt, redraw, flushPoints],
    );

    const handlePointerUp = useCallback(
      (_e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!canDraw || !activeStrokeRef.current) return;
        flushPoints();
        activeStrokeRef.current = null;
        onDrawEnd?.({});
      },
      [canDraw, flushPoints, onDrawEnd],
    );

    // -----------------------------------------------------------------------
    // Canvas setup & resize — enforce square, retina-safe DPR via setTransform
    // -----------------------------------------------------------------------
    const handleLayout = useCallback(
      (e: any) => {
        const { width, height } = e.nativeEvent.layout;
        const sq = Math.floor(Math.min(width, height));
        squareSizeRef.current = sq;
        setSquareSize(sq);

        const canvas = canvasElRef.current;
        if (canvas && sq > 0) {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = sq * dpr;
          canvas.height = sq * dpr;
          canvas.style.width = `${sq}px`;
          canvas.style.height = `${sq}px`;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // setTransform is non-cumulative (safe across layout events)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          }
          redraw();
        }
      },
      [redraw],
    );

    // Mount canvas element into RN View
    const canvasRefCallback = useCallback((el: HTMLCanvasElement | null) => {
      canvasElRef.current = el;
    }, []);

    // -----------------------------------------------------------------------
    // Render — square canvas centred in container
    // -----------------------------------------------------------------------
    return (
      <View style={styles.outerContainer} onLayout={handleLayout}>
        {squareSize > 0 && (
          <canvas
            ref={canvasRefCallback}
            style={{
              width: squareSize,
              height: squareSize,
              touchAction: "none",
              cursor: canDraw ? "crosshair" : "default",
              borderRadius: 4,
              display: "block",
            }}
            onPointerDown={handlePointerDown as any}
            onPointerMove={handlePointerMove as any}
            onPointerUp={handlePointerUp as any}
            onPointerCancel={handlePointerUp as any}
          />
        )}
      </View>
    );
  },
);

// =============================================================================
// Helpers — rebuild strokes from ops
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
              ? [{ x: op.x, y: op.y }]
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
            current.points.push({ x: op.points[i], y: op.points[i + 1] });
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

/** Apply a single op to the strokes array (mutating). */
function applyOp(strokes: StrokeData[], op: DrawOp): void {
  switch (op.type) {
    case "begin":
      strokes.push({
        points:
          typeof op.x === "number" && typeof op.y === "number"
            ? [{ x: op.x, y: op.y }]
            : [],
        color: op.eraser ? "#FFFFFF" : (op.color ?? DEFAULT_COLOR),
        width: op.width ?? DEFAULT_WIDTH,
        isEraser: !!op.eraser,
      });
      break;
    case "points": {
      if (strokes.length === 0) return;
      const last = strokes[strokes.length - 1];
      if (Array.isArray(op.points)) {
        for (let i = 0; i < op.points.length - 1; i += 2) {
          last.points.push({ x: op.points[i], y: op.points[i + 1] });
        }
      }
      break;
    }
    case "end":
      break;
    case "undo":
      if (strokes.length > 0) strokes.pop();
      break;
    case "clear":
      strokes.length = 0;
      break;
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
});
