/**
 * Game Performance Monitor Component
 *
 * Overlay component for debugging game performance in development.
 * Shows FPS, frame time, and other metrics in real-time.
 */

import {
  FrameRateMonitor,
  PERFORMANCE_THRESHOLDS,
  usePerformanceMonitor,
  type FrameTimingStats,
} from "@/utils/performance/optimization";
import React, { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

// ============================================================================
// Types
// ============================================================================

export interface GamePerformanceMonitorProps {
  /** Whether to show the monitor */
  visible?: boolean;
  /** Position on screen */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Whether to start expanded or collapsed */
  expanded?: boolean;
  /** Game type for reporting */
  gameType?: string;
  /** Callback when performance report is generated */
  onReport?: (report: unknown) => void;
  /** Whether to show in production (default: only __DEV__) */
  showInProduction?: boolean;
}

interface FpsIndicatorProps {
  fps: number;
}

interface MetricRowProps {
  label: string;
  value: string;
  warning?: boolean;
  critical?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

const FpsIndicator = memo(function FpsIndicator({ fps }: FpsIndicatorProps) {
  const getColor = () => {
    if (fps >= 55) return "#4CAF50"; // Green
    if (fps >= 45) return "#FFC107"; // Yellow
    if (fps >= 30) return "#FF9800"; // Orange
    return "#F44336"; // Red
  };

  return (
    <View style={[styles.fpsIndicator, { backgroundColor: getColor() }]}>
      <Text style={styles.fpsText}>{Math.round(fps)}</Text>
      <Text style={styles.fpsLabel}>FPS</Text>
    </View>
  );
});

const MetricRow = memo(function MetricRow({
  label,
  value,
  warning,
  critical,
}: MetricRowProps) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          warning && styles.metricWarning,
          critical && styles.metricCritical,
        ]}
      >
        {value}
      </Text>
    </View>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export const GamePerformanceMonitor: React.FC<GamePerformanceMonitorProps> =
  memo(function GamePerformanceMonitor({
    visible = true,
    position = "top-right",
    expanded: initialExpanded = false,
    gameType = "unknown",
    onReport,
    showInProduction = false,
  }) {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);
    const [frameStats, setFrameStats] = useState<FrameTimingStats | null>(null);
    const monitorRef = React.useRef<FrameRateMonitor | null>(null);

    // Only show in development unless explicitly enabled
    if (!__DEV__ && !showInProduction) {
      return null;
    }

    if (!visible) {
      return null;
    }

    const { metrics, recordFrame, getReport, reset } = usePerformanceMonitor({
      enabled: true,
      onPerformanceDrop: (m) => {
        console.warn("[Performance] FPS dropped:", m.fps);
      },
    });

    // Initialize frame monitor
    useEffect(() => {
      monitorRef.current = new FrameRateMonitor(300);
      monitorRef.current.start();

      // Update stats periodically
      const interval = setInterval(() => {
        if (monitorRef.current) {
          setFrameStats(monitorRef.current.getFrameTimingStats());
        }
      }, 500);

      return () => {
        clearInterval(interval);
        monitorRef.current?.stop();
      };
    }, []);

    // Record frame on each render (for external game loop integration)
    useEffect(() => {
      monitorRef.current?.recordFrame();
    });

    const handleToggle = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    const handleReset = useCallback(() => {
      reset();
      monitorRef.current?.reset();
      monitorRef.current?.start();
    }, [reset]);

    const handleGenerateReport = useCallback(() => {
      const report = getReport(gameType);
      if (report && onReport) {
        onReport(report);
      }
      console.log("[Performance Report]", JSON.stringify(report, null, 2));
    }, [getReport, gameType, onReport]);

    const positionStyles = getPositionStyles(position);

    return (
      <View style={[styles.container, positionStyles]}>
        <TouchableOpacity onPress={handleToggle} activeOpacity={0.8}>
          <FpsIndicator fps={metrics.fps} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedPanel}>
            <Text style={styles.title}>Performance</Text>

            <MetricRow
              label="Frame Time"
              value={`${metrics.frameTime.toFixed(2)}ms`}
              warning={
                metrics.frameTime > PERFORMANCE_THRESHOLDS.TARGET_FRAME_TIME
              }
              critical={
                metrics.frameTime > PERFORMANCE_THRESHOLDS.JANK_THRESHOLD
              }
            />

            <MetricRow
              label="Dropped"
              value={`${metrics.droppedFrames}`}
              warning={metrics.droppedFrames > 10}
              critical={metrics.droppedFrames > 50}
            />

            <MetricRow
              label="Jank"
              value={`${metrics.jankScore.toFixed(1)}%`}
              warning={metrics.jankScore > 5}
              critical={metrics.jankScore > 10}
            />

            {frameStats && (
              <>
                <View style={styles.separator} />
                <Text style={styles.subtitle}>Frame Timing</Text>

                <MetricRow
                  label="Min"
                  value={`${frameStats.min.toFixed(2)}ms`}
                />
                <MetricRow
                  label="Max"
                  value={`${frameStats.max.toFixed(2)}ms`}
                  warning={
                    frameStats.max > PERFORMANCE_THRESHOLDS.JANK_THRESHOLD
                  }
                  critical={
                    frameStats.max > PERFORMANCE_THRESHOLDS.CRITICAL_FRAME_TIME
                  }
                />
                <MetricRow
                  label="P95"
                  value={`${frameStats.p95.toFixed(2)}ms`}
                  warning={
                    frameStats.p95 > PERFORMANCE_THRESHOLDS.TARGET_FRAME_TIME
                  }
                />
                <MetricRow
                  label="P99"
                  value={`${frameStats.p99.toFixed(2)}ms`}
                  warning={
                    frameStats.p99 > PERFORMANCE_THRESHOLDS.JANK_THRESHOLD
                  }
                />
              </>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.button} onPress={handleReset}>
                <Text style={styles.buttonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.reportButton]}
                onPress={handleGenerateReport}
              >
                <Text style={styles.buttonText}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  });

// ============================================================================
// Position Helpers
// ============================================================================

function getPositionStyles(
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right",
) {
  switch (position) {
    case "top-left":
      return { top: 50, left: 10 };
    case "top-right":
      return { top: 50, right: 10 };
    case "bottom-left":
      return { bottom: 100, left: 10 };
    case "bottom-right":
      return { bottom: 100, right: 10 };
  }
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 9999,
  },
  fpsIndicator: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fpsText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  fpsLabel: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "600",
  },
  expandedPanel: {
    marginTop: 8,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 8,
    padding: 12,
    minWidth: 150,
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 4,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  metricLabel: {
    color: "#aaa",
    fontSize: 11,
  },
  metricValue: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
  },
  metricWarning: {
    color: "#FFC107",
  },
  metricCritical: {
    color: "#F44336",
  },
  separator: {
    height: 1,
    backgroundColor: "#333",
    marginVertical: 8,
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  button: {
    flex: 1,
    backgroundColor: "#333",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: "center",
  },
  reportButton: {
    backgroundColor: "#1976D2",
  },
  buttonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});

// ============================================================================
// Export
// ============================================================================

export default GamePerformanceMonitor;
