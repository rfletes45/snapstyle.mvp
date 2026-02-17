/**
 * Message Rate Limiter for Colyseus Rooms
 *
 * Prevents clients from spamming messages (input, score_update, etc.).
 * Configurable per-message-type limits with a simple sliding-window counter.
 *
 * Usage:
 *   const limiter = new MessageRateLimiter({ input: { max: 30, windowMs: 1000 } });
 *   // In message handler:
 *   if (limiter.isRateLimited(client.sessionId, "input")) return;
 *
 * @see docs/GAME_SYSTEM_REFERENCE.md §3 (Server Architecture)
 */

import { createServerLogger } from "./logger";

const log = createServerLogger("RateLimiter");

// =============================================================================
// Types
// =============================================================================

export interface RateLimitRule {
  /** Maximum messages allowed within the window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface BucketEntry {
  count: number;
  windowStart: number;
}

// =============================================================================
// Rate Limiter
// =============================================================================

export class MessageRateLimiter {
  /** Rules keyed by message type */
  private rules: Map<string, RateLimitRule>;

  /** Buckets keyed by `${sessionId}:${messageType}` */
  private buckets = new Map<string, BucketEntry>();

  /** Cleanup interval handle */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(rules: Record<string, RateLimitRule>) {
    this.rules = new Map(Object.entries(rules));

    // Periodically purge expired buckets to prevent memory leaks
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Check if a message from a session should be rate-limited.
   *
   * @returns true if the message should be DROPPED (rate limited)
   */
  isRateLimited(sessionId: string, messageType: string): boolean {
    const rule = this.rules.get(messageType);
    if (!rule) return false; // No rule → allow

    const key = `${sessionId}:${messageType}`;
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart >= rule.windowMs) {
      // New window
      this.buckets.set(key, { count: 1, windowStart: now });
      return false;
    }

    bucket.count++;
    if (bucket.count > rule.max) {
      log.warn(`Rate limited: ${messageType}`, { sessionId });
      return true;
    }

    return false;
  }

  /**
   * Remove tracking for a session (call on onLeave / onDispose).
   */
  removeSession(sessionId: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Clean up expired buckets.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      // Find the max window for this message type
      const msgType = key.split(":")[1];
      const rule = this.rules.get(msgType);
      if (rule && now - bucket.windowStart >= rule.windowMs * 2) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Dispose the limiter (clear interval). Call in room onDispose.
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buckets.clear();
  }
}

// =============================================================================
// Default Rate Limit Presets
// =============================================================================

/**
 * Recommended rate limits for physics rooms (input messages at ~60fps).
 * Allow 120/sec to accommodate burst + jitter.
 */
export const PHYSICS_RATE_LIMITS: Record<string, RateLimitRule> = {
  input: { max: 120, windowMs: 1000 },
};

/**
 * Recommended rate limits for score-race rooms.
 * score_update should be at most ~10/sec.
 */
export const SCORE_RACE_RATE_LIMITS: Record<string, RateLimitRule> = {
  score_update: { max: 15, windowMs: 1000 },
  combo_update: { max: 15, windowMs: 1000 },
};

/**
 * Recommended rate limits for turn-based rooms.
 * Moves shouldn't come faster than 2/sec (even speed chess).
 */
export const TURN_BASED_RATE_LIMITS: Record<string, RateLimitRule> = {
  move: { max: 5, windowMs: 1000 },
};
