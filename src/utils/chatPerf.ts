/**
 * Chat Performance Instrumentation
 *
 * Lightweight timing helpers to measure chat entry and return-to-chat latency.
 * All timers auto-expire after 10s to prevent stale data from leaking.
 *
 * Usage:
 *   chatPerf.mark("chat-entry");           // start timer
 *   chatPerf.measure("chat-entry", "first render");  // log elapsed
 *   chatPerf.measure("chat-entry", "interactive");   // log elapsed again
 *
 * @module utils/chatPerf
 */

import { createLogger } from "./log";

const log = createLogger("⏱ chatPerf");

const timers = new Map<string, number>();
const AUTO_EXPIRE_MS = 10_000;

export const chatPerf = {
  /** Start / restart a named timer */
  mark(name: string): void {
    timers.set(name, performance.now());
    // Auto-expire to prevent stale data
    setTimeout(() => timers.delete(name), AUTO_EXPIRE_MS);
  },

  /** Log elapsed ms from a named timer to a checkpoint label */
  measure(name: string, checkpoint: string): number {
    const start = timers.get(name);
    if (start === undefined) return -1;
    const elapsed = Math.round(performance.now() - start);
    log.info(`[${name}] → ${checkpoint}: ${elapsed}ms`);
    return elapsed;
  },

  /** End a named timer (logs and removes) */
  end(name: string, checkpoint: string): number {
    const elapsed = this.measure(name, checkpoint);
    timers.delete(name);
    return elapsed;
  },

  /** Log a one-shot timing for a block */
  time<T>(label: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const elapsed = Math.round(performance.now() - start);
    if (elapsed > 2) {
      log.info(`[${label}] ${elapsed}ms`);
    }
    return result;
  },

  /** Track whether a screen was remounted vs resumed */
  trackMount(screenName: string, conversationId: string): void {
    log.info(
      `[${screenName}] MOUNTED (new instance) conversation=${conversationId}`,
    );
  },

  trackFocus(
    screenName: string,
    conversationId: string,
    wasAlreadyMounted: boolean,
  ): void {
    log.info(
      `[${screenName}] FOCUSED conversation=${conversationId} resumed=${wasAlreadyMounted}`,
    );
  },
};
