/**
 * Cart Course Performance Utilities
 *
 * Utilities for monitoring and optimizing game performance:
 * - Frame rate monitoring
 * - Memory usage tracking
 * - Performance profiling
 * - Object pooling
 * - Render optimization helpers
 */

// ============================================
// Types
// ============================================

export interface PerformanceMetrics {
  fps: number;
  averageFps: number;
  minFps: number;
  maxFps: number;
  frameTime: number;
  averageFrameTime: number;
  droppedFrames: number;
  totalFrames: number;
  memoryUsage: number;
  gcEvents: number;
}

export interface FrameInfo {
  timestamp: number;
  deltaTime: number;
  frameNumber: number;
  wasDropped: boolean;
}

export interface PoolConfig {
  initialSize: number;
  maxSize: number;
  growthFactor: number;
}

// ============================================
// Performance Monitor
// ============================================

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private droppedFrameCount: number = 0;
  private gcEventCount: number = 0;
  private isActive: boolean = false;

  // Configuration
  private readonly targetFps: number = 60;
  private readonly targetFrameTime: number = 1000 / 60; // ~16.67ms
  private readonly dropThreshold: number = 1.5; // Frames taking 1.5x longer are "dropped"
  private readonly sampleWindow: number = 60; // Average over last 60 frames

  /**
   * Start monitoring
   */
  start(): void {
    this.isActive = true;
    this.lastFrameTime = performance.now();
    this.frameTimes = [];
    this.frameCount = 0;
    this.droppedFrameCount = 0;
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isActive = false;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.frameTimes = [];
    this.frameCount = 0;
    this.droppedFrameCount = 0;
    this.gcEventCount = 0;
    this.lastFrameTime = performance.now();
  }

  /**
   * Record a frame (call once per game loop iteration)
   */
  recordFrame(): FrameInfo {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Track frame time
    this.frameTimes.push(deltaTime);
    if (this.frameTimes.length > this.sampleWindow) {
      this.frameTimes.shift();
    }

    this.frameCount++;

    // Check for dropped frame
    const wasDropped = deltaTime > this.targetFrameTime * this.dropThreshold;
    if (wasDropped) {
      this.droppedFrameCount++;
    }

    return {
      timestamp: now,
      deltaTime,
      frameNumber: this.frameCount,
      wasDropped,
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    if (this.frameTimes.length === 0) {
      return {
        fps: 0,
        averageFps: 0,
        minFps: 0,
        maxFps: 0,
        frameTime: 0,
        averageFrameTime: 0,
        droppedFrames: this.droppedFrameCount,
        totalFrames: this.frameCount,
        memoryUsage: this.getMemoryUsage(),
        gcEvents: this.gcEventCount,
      };
    }

    const lastFrameTime = this.frameTimes[this.frameTimes.length - 1];
    const averageFrameTime =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const minFrameTime = Math.min(...this.frameTimes);
    const maxFrameTime = Math.max(...this.frameTimes);

    return {
      fps: 1000 / lastFrameTime,
      averageFps: 1000 / averageFrameTime,
      minFps: 1000 / maxFrameTime, // Min fps = max frame time
      maxFps: 1000 / minFrameTime, // Max fps = min frame time
      frameTime: lastFrameTime,
      averageFrameTime,
      droppedFrames: this.droppedFrameCount,
      totalFrames: this.frameCount,
      memoryUsage: this.getMemoryUsage(),
      gcEvents: this.gcEventCount,
    };
  }

  /**
   * Get memory usage (approximate, not available in all environments)
   */
  private getMemoryUsage(): number {
    // @ts-ignore - performance.memory is Chrome-specific
    if (typeof performance !== "undefined" && performance.memory) {
      // @ts-ignore
      return performance.memory.usedJSHeapSize / (1024 * 1024); // MB
    }
    return 0;
  }

  /**
   * Record a GC event (for manual tracking)
   */
  recordGCEvent(): void {
    this.gcEventCount++;
  }

  /**
   * Check if performance is healthy
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();
    return (
      metrics.averageFps >= 55 && // At least 55 average fps
      metrics.droppedFrames / Math.max(1, metrics.totalFrames) < 0.05 // Less than 5% dropped
    );
  }

  /**
   * Get performance warning level
   */
  getWarningLevel(): "none" | "low" | "medium" | "high" {
    const metrics = this.getMetrics();
    const dropRate = metrics.droppedFrames / Math.max(1, metrics.totalFrames);

    if (metrics.averageFps >= 55 && dropRate < 0.02) {
      return "none";
    } else if (metrics.averageFps >= 45 && dropRate < 0.05) {
      return "low";
    } else if (metrics.averageFps >= 30 && dropRate < 0.15) {
      return "medium";
    }
    return "high";
  }
}

// ============================================
// Object Pool
// ============================================

/**
 * Generic object pool for reusing objects and reducing garbage collection
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private activeCount: number = 0;
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private config: PoolConfig;

  // Stats
  private totalCreated: number = 0;
  private totalReused: number = 0;
  private peakActive: number = 0;

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void = () => {},
    config: Partial<PoolConfig> = {},
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.config = {
      initialSize: config.initialSize ?? 10,
      maxSize: config.maxSize ?? 100,
      growthFactor: config.growthFactor ?? 2,
    };

    // Pre-populate pool
    for (let i = 0; i < this.config.initialSize; i++) {
      this.pool.push(this.createFn());
      this.totalCreated++;
    }
  }

  /**
   * Get an object from the pool (or create a new one)
   */
  acquire(): T {
    let obj: T;

    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
      this.totalReused++;
    } else if (this.totalCreated < this.config.maxSize) {
      obj = this.createFn();
      this.totalCreated++;
    } else {
      // Pool exhausted, create anyway (will be discarded on release)
      console.warn("[ObjectPool] Pool exhausted, creating temporary object");
      obj = this.createFn();
    }

    this.activeCount++;
    this.peakActive = Math.max(this.peakActive, this.activeCount);
    this.resetFn(obj);

    return obj;
  }

  /**
   * Return an object to the pool
   */
  release(obj: T): void {
    if (this.activeCount > 0) {
      this.activeCount--;
    }

    if (this.pool.length < this.config.maxSize) {
      this.pool.push(obj);
    }
    // If pool is full, the object is discarded
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    poolSize: number;
    activeCount: number;
    totalCreated: number;
    totalReused: number;
    peakActive: number;
    reuseRate: number;
  } {
    const totalAcquisitions = this.totalReused + this.totalCreated;
    return {
      poolSize: this.pool.length,
      activeCount: this.activeCount,
      totalCreated: this.totalCreated,
      totalReused: this.totalReused,
      peakActive: this.peakActive,
      reuseRate:
        totalAcquisitions > 0 ? this.totalReused / totalAcquisitions : 0,
    };
  }

  /**
   * Clear the pool (release all objects)
   */
  clear(): void {
    this.pool = [];
    this.activeCount = 0;
  }

  /**
   * Pre-warm the pool to a certain size
   */
  prewarm(count: number): void {
    const toCreate = Math.min(
      count - this.pool.length,
      this.config.maxSize - this.totalCreated,
    );

    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.createFn());
      this.totalCreated++;
    }
  }
}

// ============================================
// Vector2D Pool (commonly used object)
// ============================================

export interface Vector2D {
  x: number;
  y: number;
}

const vector2DPool = new ObjectPool<Vector2D>(
  () => ({ x: 0, y: 0 }),
  (v) => {
    v.x = 0;
    v.y = 0;
  },
  { initialSize: 50, maxSize: 200 },
);

/**
 * Get a pooled Vector2D
 */
export function getPooledVector(x: number = 0, y: number = 0): Vector2D {
  const v = vector2DPool.acquire();
  v.x = x;
  v.y = y;
  return v;
}

/**
 * Return a Vector2D to the pool
 */
export function releasePooledVector(v: Vector2D): void {
  vector2DPool.release(v);
}

/**
 * Get Vector2D pool stats
 */
export function getVectorPoolStats() {
  return vector2DPool.getStats();
}

// ============================================
// Render Optimization Helpers
// ============================================

/**
 * Check if a point is within screen bounds (with margin)
 */
export function isOnScreen(
  x: number,
  y: number,
  cameraX: number,
  cameraY: number,
  screenWidth: number,
  screenHeight: number,
  margin: number = 50,
): boolean {
  const screenX = x - cameraX + screenWidth / 2;
  const screenY = y - cameraY + screenHeight / 2;

  return (
    screenX >= -margin &&
    screenX <= screenWidth + margin &&
    screenY >= -margin &&
    screenY <= screenHeight + margin
  );
}

/**
 * Check if a rectangle is visible on screen
 */
export function isRectOnScreen(
  x: number,
  y: number,
  width: number,
  height: number,
  cameraX: number,
  cameraY: number,
  screenWidth: number,
  screenHeight: number,
): boolean {
  const screenX = x - cameraX + screenWidth / 2;
  const screenY = y - cameraY + screenHeight / 2;

  return (
    screenX + width >= 0 &&
    screenX <= screenWidth &&
    screenY + height >= 0 &&
    screenY <= screenHeight
  );
}

/**
 * Calculate level of detail based on distance from camera center
 */
export function calculateLOD(
  x: number,
  y: number,
  cameraX: number,
  cameraY: number,
  maxDistance: number = 500,
): number {
  const dx = x - cameraX;
  const dy = y - cameraY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= maxDistance * 0.5) return 1.0; // Full detail
  if (distance <= maxDistance * 0.75) return 0.75; // 75% detail
  if (distance <= maxDistance) return 0.5; // 50% detail
  return 0.25; // Minimal detail
}

// ============================================
// Frame Budget Helpers
// ============================================

const FRAME_BUDGET_MS = 16.67; // ~60fps

/**
 * Time budget tracker for frame work
 */
export class FrameBudget {
  private startTime: number = 0;
  private allocations: Map<string, number> = new Map();

  /**
   * Start tracking a frame
   */
  startFrame(): void {
    this.startTime = performance.now();
    this.allocations.clear();
  }

  /**
   * Get remaining budget in ms
   */
  getRemainingBudget(): number {
    return Math.max(0, FRAME_BUDGET_MS - (performance.now() - this.startTime));
  }

  /**
   * Check if there's enough budget for a task
   */
  hasBudget(requiredMs: number): boolean {
    return this.getRemainingBudget() >= requiredMs;
  }

  /**
   * Record time spent on a task
   */
  recordTask(taskName: string, startTime: number): void {
    const duration = performance.now() - startTime;
    const existing = this.allocations.get(taskName) ?? 0;
    this.allocations.set(taskName, existing + duration);
  }

  /**
   * Get frame timing breakdown
   */
  getBreakdown(): Map<string, number> {
    return new Map(this.allocations);
  }

  /**
   * Check if frame exceeded budget
   */
  didExceedBudget(): boolean {
    return performance.now() - this.startTime > FRAME_BUDGET_MS;
  }

  /**
   * Get total frame time
   */
  getFrameTime(): number {
    return performance.now() - this.startTime;
  }
}

// ============================================
// Batch Processing Helpers
// ============================================

/**
 * Process items in batches across frames
 */
export class BatchProcessor<T> {
  private items: T[] = [];
  private processFn: (item: T) => void;
  private batchSize: number;
  private currentIndex: number = 0;

  constructor(processFn: (item: T) => void, batchSize: number = 10) {
    this.processFn = processFn;
    this.batchSize = batchSize;
  }

  /**
   * Add items to process
   */
  addItems(items: T[]): void {
    this.items.push(...items);
  }

  /**
   * Process one batch (call once per frame)
   * Returns true if there's more work to do
   */
  processBatch(): boolean {
    const endIndex = Math.min(
      this.currentIndex + this.batchSize,
      this.items.length,
    );

    for (let i = this.currentIndex; i < endIndex; i++) {
      this.processFn(this.items[i]);
    }

    this.currentIndex = endIndex;

    if (this.currentIndex >= this.items.length) {
      // Reset for next batch
      this.items = [];
      this.currentIndex = 0;
      return false;
    }

    return true;
  }

  /**
   * Get progress (0-1)
   */
  getProgress(): number {
    if (this.items.length === 0) return 1;
    return this.currentIndex / this.items.length;
  }

  /**
   * Clear all pending items
   */
  clear(): void {
    this.items = [];
    this.currentIndex = 0;
  }
}

// ============================================
// Singleton Monitor Instance
// ============================================

export const gamePerformanceMonitor = new PerformanceMonitor();
export const frameBudget = new FrameBudget();

// ============================================
// Quality Settings
// ============================================

export type QualityLevel = "low" | "medium" | "high" | "ultra";

export interface QualitySettings {
  particleCount: number;
  particleLifetime: number;
  trailEnabled: boolean;
  trailLength: number;
  glowEnabled: boolean;
  shadowsEnabled: boolean;
  antialiasingEnabled: boolean;
  targetFps: number;
}

export function getQualitySettings(level: QualityLevel): QualitySettings {
  switch (level) {
    case "low":
      return {
        particleCount: 25,
        particleLifetime: 0.5,
        trailEnabled: false,
        trailLength: 0,
        glowEnabled: false,
        shadowsEnabled: false,
        antialiasingEnabled: false,
        targetFps: 30,
      };
    case "medium":
      return {
        particleCount: 50,
        particleLifetime: 0.75,
        trailEnabled: true,
        trailLength: 5,
        glowEnabled: false,
        shadowsEnabled: false,
        antialiasingEnabled: true,
        targetFps: 45,
      };
    case "high":
      return {
        particleCount: 75,
        particleLifetime: 1.0,
        trailEnabled: true,
        trailLength: 10,
        glowEnabled: true,
        shadowsEnabled: true,
        antialiasingEnabled: true,
        targetFps: 60,
      };
    case "ultra":
      return {
        particleCount: 100,
        particleLifetime: 1.5,
        trailEnabled: true,
        trailLength: 20,
        glowEnabled: true,
        shadowsEnabled: true,
        antialiasingEnabled: true,
        targetFps: 60,
      };
  }
}

/**
 * Auto-detect quality level based on device performance
 */
export function detectOptimalQuality(
  monitor: PerformanceMonitor,
): QualityLevel {
  const metrics = monitor.getMetrics();
  const warningLevel = monitor.getWarningLevel();

  if (warningLevel === "high" || metrics.averageFps < 30) {
    return "low";
  } else if (warningLevel === "medium" || metrics.averageFps < 45) {
    return "medium";
  } else if (warningLevel === "low" || metrics.averageFps < 55) {
    return "high";
  }
  return "ultra";
}
