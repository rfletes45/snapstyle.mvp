/**
 * DRAWING CANVAS
 * Finger-drawing overlay for the photo editor using SVG paths.
 * Uses react-native-gesture-handler for smooth touch tracking and
 * react-native-svg for rendering paths.
 */

import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  GestureHandlerRootView,
  State as GestureState,
  PanGestureHandler,
  type PanGestureHandlerGestureEvent,
} from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";

export interface DrawnPath {
  /** SVG path data string (M x y L x y ...) */
  d: string;
  color: string;
  strokeWidth: number;
}

interface Props {
  /** Current brush colour (hex) */
  color: string;
  /** Current brush width in px */
  strokeWidth: number;
  /** Whether drawing is enabled (vs pass-through for other gestures) */
  enabled: boolean;
  /** Called whenever the path set changes (for undo tracking) */
  onPathsChange?: (paths: DrawnPath[]) => void;
  /** Externally-managed paths (for undo/redo) */
  paths?: DrawnPath[];
}

const DrawingCanvas: React.FC<Props> = ({
  color,
  strokeWidth,
  enabled,
  onPathsChange,
  paths: externalPaths,
}) => {
  const [internalPaths, setInternalPaths] = useState<DrawnPath[]>([]);
  const currentPathPoints = useRef<string>("");

  const paths = externalPaths ?? internalPaths;

  const updatePaths = useCallback(
    (newPaths: DrawnPath[]) => {
      if (externalPaths === undefined) {
        setInternalPaths(newPaths);
      }
      onPathsChange?.(newPaths);
    },
    [externalPaths, onPathsChange],
  );

  const onGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (!enabled) return;
      const { x, y } = event.nativeEvent;
      currentPathPoints.current += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    },
    [enabled],
  );

  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (!enabled) return;
      const { state, x, y } = event.nativeEvent;

      if (state === GestureState.BEGAN) {
        // Start a new path
        currentPathPoints.current = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else if (
        state === GestureState.END ||
        state === GestureState.CANCELLED
      ) {
        // Finish path and commit
        if (currentPathPoints.current) {
          const newPath: DrawnPath = {
            d: currentPathPoints.current,
            color,
            strokeWidth,
          };
          updatePaths([...paths, newPath]);
          currentPathPoints.current = "";
        }
      }
    },
    [enabled, color, strokeWidth, paths, updatePaths],
  );

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={enabled}
        minDist={0}
        avgTouches={false}
      >
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={enabled ? "auto" : "none"}
        >
          <Svg style={StyleSheet.absoluteFill}>
            {paths.map((p, i) => (
              <Path
                key={`path-${i}`}
                d={p.d}
                stroke={p.color}
                strokeWidth={p.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
};

export default React.memo(DrawingCanvas);
