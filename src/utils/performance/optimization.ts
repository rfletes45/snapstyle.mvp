/**
 * Performance Optimization Utilities
 *
 * Tools for measuring and optimizing game performance:
 * - Frame rate monitoring
 * - Memory tracking
 * - Render optimization
 * - Performance reporting
 */

import { useCallback, useEffect, useRef, useState } from "react";


import { createLogger } from "@/utils/log";
const logger = createLogger("utils/performance/optimization");
// ============================================================================
// Types
// ============================================================================

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage?: number;
  droppedFrames: number;
  jankScore: number;
}

export interface FrameTimingStats {
  current: number;
  average: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export interface PerformanceReport {
  sessionId: string;
  gameType: string;
  duration: number;
  metrics: {
    avgFps: number;
    minFps: number;
    maxFps: number;
    avgFrameTime: number;
    droppedFrames: number;
    totalFrames: number;
    jankPercentage: number;
  };
  deviceInfo: {
    platform: string;
    osVersion: string;
    deviceModel?: string;
  };
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

export const PERFORMANCE_THRESHOLDS = {
  TARGET_FPS: 60,
  TARGET_FRAME_TIME: 16.67, // ms
  JANK_THRESHOLD: 33.33, // ms (2 frames)
  CRITICAL_FRAME_TIME: 100, // ms
  MIN_ACCEPTABLE_FPS: 30,
  MEMORY_WARNING_MB: 150,
  MEMORY_CRITICAL_MB: 250,
} as const;

// ============================================================================
// Frame Rate Monitor
// ============================================================================

export class FrameRateMonitor {
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private droppedFrames: number = 0;
  private startTime: number = 0;
  private maxSamples: number;
  private isRunning: boolean = false;

  constructor(maxSamples: number = 300) {
    this.maxSamples = maxSamples;
  }

  start(): void {
    this.reset();
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
  }

  stop(): void {
    this.isRunning = false;
  }

  reset(): void {
    this.frameTimes = [];
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.startTime = 0;
    this.lastFrameTime = 0;
  }

  recordFrame(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Skip first frame (no delta)
    if (this.frameCount === 0) {
      this.frameCount++;
      return;
    }

    this.frameTimes.push(frameTime);
    this.frameCount++;

    // Detect dropped frames
    if (frameTime > PERFORMANCE_THRESHOLDS.JANK_THRESHOLD) {
      this.droppedFrames +=
        Math.floor(frameTime / PERFORMANCE_THRESHOLDS.TARGET_FRAME_TIME) - 1;
    }

    // Keep buffer bounded
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }
  }

  getMetrics(): PerformanceMetrics {
    if (this.frameTimes.length === 0) {
      return {
        fps: 0,
        frameTime: 0,
        droppedFrames: 0,
        jankScore: 0,
      };
    }

    const avgFrameTime =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / avgFrameTime;

    // Calculate jank score (percentage of frames over threshold)
    const jankFrames = this.frameTimes.filter(
      (t) => t > PERFORMANCE_THRESHOLDS.JANK_THRESHOLD,
    ).length;
    const jankScore = (jankFrames / this.frameTimes.length) * 100;

    return {
      fps: Math.round(fps * 10) / 10,
      frameTime: Math.round(avgFrameTime * 100) / 100,
      droppedFrames: this.droppedFrames,
      jankScore: Math.round(jankScore * 10) / 10,
    };
  }

  getFrameTimingStats(): FrameTimingStats {
    if (this.frameTimes.length === 0) {
      return { current: 0, average: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const current = this.frameTimes[this.frameTimes.length - 1] || 0;
    const average =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      current: Math.round(current * 100) / 100,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100,
    };
  }

  getDuration(): number {
    if (!this.isRunning || this.startTime === 0) return 0;
    return performance.now() - this.startTime;
  }

  getReport(gameType: string): PerformanceReport {
    const stats = this.getFrameTimingStats();

    return {
      sessionId: `${gameType}-${Date.now()}`,
      gameType,
      duration: this.getDuration(),
      metrics: {
        avgFps: Math.round((1000 / stats.average) * 10) / 10,
        minFps: Math.round((1000 / stats.max) * 10) / 10,
        maxFps: Math.round((1000 / stats.min) * 10) / 10,
        avgFrameTime: stats.average,
        droppedFrames: this.droppedFrames,
        totalFrames: this.frameCount,
        jankPercentage: this.getMetrics().jankScore,
      },
      deviceInfo: {
        platform: "react-native", // Would be Platform.OS in real app
        osVersion: "unknown",
      },
      timestamp: Date.now(),
    };
  }
}

// ============================================================================
// React Hook: usePerformanceMonitor
// ============================================================================

export interface UsePerformanceMonitorOptions {
  enabled?: boolean;
  sampleSize?: number;
  onPerformanceDrop?: (metrics: PerformanceMetrics) => void;
}

export function usePerformanceMonitor(
  options: UsePerformanceMonitorOptions = {},
) {
  const { enabled = true, sampleSize = 300, onPerformanceDrop } = options;

  const monitorRef = useRef<FrameRateMonitor | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    droppedFrames: 0,
    jankScore: 0,
  });

  useEffect(() => {
    if (!enabled) return;

    monitorRef.current = new FrameRateMonitor(sampleSize);
    monitorRef.current.start();

    return () => {
      monitorRef.current?.stop();
    };
  }, [enabled, sampleSize]);

  const recordFrame = useCallback(() => {
    if (!monitorRef.current) return;

    monitorRef.current.recordFrame();
    const newMetrics = monitorRef.current.getMetrics();
    setMetrics(newMetrics);

    // Check for performance issues
    if (
      newMetrics.fps < PERFORMANCE_THRESHOLDS.MIN_ACCEPTABLE_FPS &&
      onPerformanceDrop
    ) {
      onPerformanceDrop(newMetrics);
    }
  }, [onPerformanceDrop]);

  const getReport = useCallback(
    (gameType: string): PerformanceReport | null => {
      return monitorRef.current?.getReport(gameType) || null;
    },
    [],
  );

  const reset = useCallback(() => {
    monitorRef.current?.reset();
    monitorRef.current?.start();
  }, []);

  return {
    metrics,
    recordFrame,
    getReport,
    reset,
  };
}

// ============================================================================
// Render Optimization Utilities
// ============================================================================

/**
 * Throttle function calls to a maximum rate
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
): T {
  let lastCall = 0;

  return ((...args: Parameters<T>) => {
    const now = performance.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      return fn(...args);
    }
  }) as T;
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T;
}

/**
 * Memoize expensive calculations with LRU cache
 */
export function memoizeWithLimit<K, V>(
  fn: (key: K) => V,
  maxSize: number = 100,
): (key: K) => V {
  const cache = new Map<K, V>();
  const order: K[] = [];

  return (key: K): V => {
    if (cache.has(key)) {
      // Move to end of order (most recently used)
      const idx = order.indexOf(key);
      if (idx > -1) {
        order.splice(idx, 1);
        order.push(key);
      }
      return cache.get(key)!;
    }

    const result = fn(key);

    // Evict oldest if at capacity
    if (order.length >= maxSize) {
      const oldest = order.shift();
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }

    cache.set(key, result);
    order.push(key);

    return result;
  };
}

// ============================================================================
// Object Pooling for Game Objects
// ============================================================================

export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 10,
    maxSize: number = 100,
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  preWarm(count: number): void {
    const needed = Math.min(count, this.maxSize) - this.pool.length;
    for (let i = 0; i < needed; i++) {
      this.pool.push(this.factory());
    }
  }

  get size(): number {
    return this.pool.length;
  }
}

// ============================================================================
// Batch Updates for Game State
// ============================================================================

export class BatchUpdater<T> {
  private pendingUpdates: Array<(state: T) => T> = [];
  private state: T;
  private onUpdate: (state: T) => void;
  private frameId: number | null = null;

  constructor(initialState: T, onUpdate: (state: T) => void) {
    this.state = initialState;
    this.onUpdate = onUpdate;
  }

  queueUpdate(updater: (state: T) => T): void {
    this.pendingUpdates.push(updater);

    if (this.frameId === null) {
      this.frameId = requestAnimationFrame(() => this.flush());
    }
  }

  flush(): void {
    if (this.pendingUpdates.length === 0) {
      this.frameId = null;
      return;
    }

    // Apply all updates in one batch
    let newState = this.state;
    for (const update of this.pendingUpdates) {
      newState = update(newState);
    }

    this.state = newState;
    this.pendingUpdates = [];
    this.frameId = null;

    this.onUpdate(this.state);
  }

  getState(): T {
    return this.state;
  }
}

// ============================================================================
// Performance Logger
// ============================================================================

export class PerformanceLogger {
  private logs: Array<{
    event: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }> = [];
  private markers: Map<string, number> = new Map();
  private maxLogs: number;

  constructor(maxLogs: number = 1000) {
    this.maxLogs = maxLogs;
  }

  mark(name: string): void {
    this.markers.set(name, performance.now());
  }

  measure(
    name: string,
    startMark: string,
    metadata?: Record<string, unknown>,
  ): number {
    const start = this.markers.get(startMark);
    if (start === undefined) {
      logger.warn(`Performance mark "${startMark}" not found`);
      return 0;
    }

    const duration = performance.now() - start;

    this.logs.push({
      event: name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    // Keep logs bounded
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    return duration;
  }

  time<T>(name: string, fn: () => T, metadata?: Record<string, unknown>): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.logs.push({
      event: name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    return result;
  }

  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.logs.push({
      event: name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    return result;
  }

  getAverageTime(eventName: string): number {
    const matching = this.logs.filter((l) => l.event === eventName);
    if (matching.length === 0) return 0;
    return matching.reduce((sum, l) => sum + l.duration, 0) / matching.length;
  }

  getSummary(): Record<
    string,
    { count: number; avg: number; max: number; min: number }
  > {
    const summary: Record<
      string,
      { count: number; avg: number; max: number; min: number; total: number }
    > = {};

    for (const log of this.logs) {
      if (!summary[log.event]) {
        summary[log.event] = {
          count: 0,
          avg: 0,
          max: -Infinity,
          min: Infinity,
          total: 0,
        };
      }

      summary[log.event].count++;
      summary[log.event].total += log.duration;
      summary[log.event].max = Math.max(summary[log.event].max, log.duration);
      summary[log.event].min = Math.min(summary[log.event].min, log.duration);
    }

    // Calculate averages
    for (const key of Object.keys(summary)) {
      summary[key].avg = summary[key].total / summary[key].count;
    }

    return summary;
  }

  clear(): void {
    this.logs = [];
    this.markers.clear();
  }
}

// ============================================================================
// Singleton Performance Logger Instance
// ============================================================================

export const perfLogger = new PerformanceLogger();

// ============================================================================
// Performance Decorator (for class methods)
// ============================================================================

export function measurePerformance(name?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const measureName = name || propertyKey;

    descriptor.value = function (...args: unknown[]) {
      return perfLogger.time(measureName, () =>
        originalMethod.apply(this, args),
      );
    };

    return descriptor;
  };
}

// ============================================================================
// Export convenience functions
// ============================================================================

export const createFrameMonitor = (sampleSize?: number) =>
  new FrameRateMonitor(sampleSize);

export const isPerformanceCritical = (metrics: PerformanceMetrics): boolean =>
  metrics.fps < PERFORMANCE_THRESHOLDS.MIN_ACCEPTABLE_FPS ||
  metrics.jankScore > 10;

export const formatFps = (fps: number): string => `${Math.round(fps)} FPS`;

export const formatFrameTime = (ms: number): string => `${ms.toFixed(2)}ms`;
