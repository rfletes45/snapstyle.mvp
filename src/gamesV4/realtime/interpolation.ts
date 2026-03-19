/**
 * Games V4 — Realtime Interpolation & Presentation Layer
 *
 * Shared utilities for smoothly rendering server-authoritative entities
 * (balls, paddles, bodies) at display frame rate (60fps) from lower-frequency
 * server snapshots (15–20 Hz).
 *
 * Approach:
 * 1. **Snapshot buffer**: Stores recent server states with receive timestamps.
 * 2. **Interpolation**: Renders between two buffered snapshots with a small
 *    intentional render delay (one server-tick worth) so there's always a
 *    "next" snapshot to lerp toward.
 * 3. **Extrapolation**: When the next snapshot hasn't arrived yet, uses
 *    velocity to predict forward from the last known state (bounded to
 *    prevent drift).
 * 4. **Snap correction**: When prediction error exceeds a threshold, blends
 *    instead of teleporting.
 *
 * This approach preserves server authority while providing silky 60fps
 * visuals with minimal perceived latency.
 *
 * @module gamesV4/realtime/interpolation
 */

// =============================================================================
// Types
// =============================================================================

/** A positional entity snapshot received from the server. */
export interface EntitySnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Timestamped snapshot for the interpolation buffer. */
interface BufferedSnapshot<T extends EntitySnapshot> {
  data: T;
  receivedAt: number; // local Date.now() when received
}

// =============================================================================
// InterpolationBuffer
// =============================================================================

/**
 * Per-entity interpolation buffer.
 *
 * Call `push()` whenever a new server snapshot arrives.
 * Call `sample()` every frame to get the smoothed position.
 */
export class InterpolationBuffer<T extends EntitySnapshot = EntitySnapshot> {
  private buffer: BufferedSnapshot<T>[] = [];
  /** How far behind "now" to render, in ms. Gives headroom for interpolation. */
  private readonly renderDelayMs: number;
  /** Max extrapolation time beyond last snapshot, in ms. */
  private readonly maxExtrapolateMs: number;
  /** How many snapshots to keep in buffer (ring). */
  private readonly bufferSize: number;
  /** Correction blend speed (0–1 per frame). 1 = instant snap, 0.1 = smooth. */
  private readonly correctionAlpha: number;

  // Smoothed output (to avoid snapping)
  private smoothX = 0;
  private smoothY = 0;
  private initialized = false;

  constructor(opts?: {
    renderDelayMs?: number;
    maxExtrapolateMs?: number;
    bufferSize?: number;
    correctionAlpha?: number;
  }) {
    this.renderDelayMs = opts?.renderDelayMs ?? 80;
    this.maxExtrapolateMs = opts?.maxExtrapolateMs ?? 200;
    this.bufferSize = opts?.bufferSize ?? 10;
    this.correctionAlpha = opts?.correctionAlpha ?? 0.35;
  }

  /** Push a new snapshot from the server. */
  push(data: T): void {
    this.buffer.push({ data, receivedAt: Date.now() });
    // Keep buffer bounded
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    if (!this.initialized) {
      this.smoothX = data.x;
      this.smoothY = data.y;
      this.initialized = true;
    }
  }

  /**
   * Sample the interpolated position at the current time.
   *
   * Returns smoothed (x, y) and the latest known velocity.
   */
  sample(): { x: number; y: number; vx: number; vy: number } {
    if (this.buffer.length === 0) {
      return { x: this.smoothX, y: this.smoothY, vx: 0, vy: 0 };
    }

    const now = Date.now();
    const renderTime = now - this.renderDelayMs;

    // Find the two snapshots that straddle renderTime
    let before: BufferedSnapshot<T> | null = null;
    let after: BufferedSnapshot<T> | null = null;

    for (let i = 0; i < this.buffer.length; i++) {
      if (this.buffer[i].receivedAt <= renderTime) {
        before = this.buffer[i];
      } else {
        after = this.buffer[i];
        break;
      }
    }

    let targetX: number;
    let targetY: number;
    let vx: number;
    let vy: number;

    if (before && after) {
      // INTERPOLATION: lerp between the two bracketing snapshots
      const span = after.receivedAt - before.receivedAt;
      const t = span > 0 ? (renderTime - before.receivedAt) / span : 0;
      const ct = Math.max(0, Math.min(1, t));
      targetX = before.data.x + (after.data.x - before.data.x) * ct;
      targetY = before.data.y + (after.data.y - before.data.y) * ct;
      vx = after.data.vx;
      vy = after.data.vy;
    } else if (before) {
      // EXTRAPOLATION: past the last snapshot, use velocity to predict
      const elapsed = Math.min(
        (renderTime - before.receivedAt) / 1000,
        this.maxExtrapolateMs / 1000,
      );
      targetX = before.data.x + before.data.vx * elapsed;
      targetY = before.data.y + before.data.vy * elapsed;
      vx = before.data.vx;
      vy = before.data.vy;
    } else if (after) {
      // Before any buffered data — use the first snapshot
      targetX = after.data.x;
      targetY = after.data.y;
      vx = after.data.vx;
      vy = after.data.vy;
    } else {
      return { x: this.smoothX, y: this.smoothY, vx: 0, vy: 0 };
    }

    // Smooth correction — blend toward target to avoid snapping
    this.smoothX += (targetX - this.smoothX) * this.correctionAlpha;
    this.smoothY += (targetY - this.smoothY) * this.correctionAlpha;

    return { x: this.smoothX, y: this.smoothY, vx, vy };
  }

  /** Force-set the position (e.g., on phase change or teleport). */
  reset(x: number, y: number): void {
    this.smoothX = x;
    this.smoothY = y;
    this.buffer = [];
    this.initialized = true;
  }

  /** Get the latest raw snapshot data (uninterpolated). */
  getLatest(): T | null {
    return this.buffer.length > 0
      ? this.buffer[this.buffer.length - 1].data
      : null;
  }

  /** Clear the buffer. */
  clear(): void {
    this.buffer = [];
  }
}

// =============================================================================
// Scalar Interpolation (for 1D values like paddle Y)
// =============================================================================

/**
 * Smoothly tracks a scalar value updated at a lower rate than display.
 * Uses velocity-aware extrapolation and exponential smoothing.
 */
export class ScalarInterpolator {
  private target = 0;
  private current = 0;
  private velocity = 0;
  private lastUpdateTime = 0;
  private initialized = false;
  private readonly smoothingFactor: number;

  constructor(smoothingFactor = 0.4) {
    this.smoothingFactor = smoothingFactor;
  }

  /** Push a new target value from the server. */
  push(value: number, velocity = 0): void {
    this.target = value;
    this.velocity = velocity;
    this.lastUpdateTime = Date.now();
    if (!this.initialized) {
      this.current = value;
      this.initialized = true;
    }
  }

  /** Sample the smoothed value at the current time. */
  sample(): number {
    if (!this.initialized) return this.target;

    // Extrapolate the target based on velocity
    const elapsed = (Date.now() - this.lastUpdateTime) / 1000;
    const extrapolatedTarget =
      this.target + this.velocity * Math.min(elapsed, 0.15);

    // Exponential smoothing toward extrapolated target
    this.current += (extrapolatedTarget - this.current) * this.smoothingFactor;
    return this.current;
  }

  /** Force-set the value. */
  reset(value: number): void {
    this.current = value;
    this.target = value;
    this.velocity = 0;
    this.initialized = true;
  }
}

// =============================================================================
// useFrameLoop — RAF loop for smooth 60fps rendering
// =============================================================================

/**
 * Runs a callback every animation frame. Cleans up on unmount.
 * The callback receives the current timestamp.
 *
 * Returns a ref to control pausing.
 */
export function createFrameLoop(callback: (now: number) => void): {
  start: () => void;
  stop: () => void;
} {
  let rafId: number | null = null;
  let running = false;

  const tick = () => {
    if (!running) return;
    callback(Date.now());
    rafId = requestAnimationFrame(tick);
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    },
    stop: () => {
      running = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
}
