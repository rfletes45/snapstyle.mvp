/**
 * Performance Utilities Index
 *
 * Central export for all performance-related utilities.
 */

export {
  BatchUpdater,
  // Classes
  FrameRateMonitor,
  ObjectPool,
  // Constants
  PERFORMANCE_THRESHOLDS,
  PerformanceLogger,
  // Factory & helpers
  createFrameMonitor,
  debounce,
  formatFps,
  formatFrameTime,
  isPerformanceCritical,
  // Decorator
  measurePerformance,
  memoizeWithLimit,

  // Singleton
  perfLogger,
  // Utilities
  throttle,
  // Hooks
  usePerformanceMonitor,
  type FrameTimingStats,
  // Types
  type PerformanceMetrics,
  type PerformanceReport,
  type UsePerformanceMonitorOptions,
} from "./optimization";
