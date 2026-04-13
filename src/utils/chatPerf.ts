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

import { InteractionManager } from "react-native";
import { createLogger } from "./log";

const log = createLogger("⏱ chatPerf");

const timers = new Map<string, number>();
const AUTO_EXPIRE_MS = 10_000;

/** Accumulated entry report — logged once when the entry sequence completes */
interface EntryReport {
  screen: string;
  conversationId: string;
  cold: boolean;
  checkpoints: { label: string; elapsed: number }[];
}

const pendingReports = new Map<string, EntryReport>();

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

  /**
   * Begin an entry trace — marks the start of a chat open sequence.
   * Call this at mount or focus. Subsequent `traceCheckpoint` calls
   * accumulate into a single structured report logged when the entry
   * sequence completes (after interactions finish).
   */
  beginEntryTrace(screen: string, conversationId: string, cold: boolean): void {
    const key = `${screen}:${conversationId}`;
    timers.set(key, performance.now());
    setTimeout(() => timers.delete(key), AUTO_EXPIRE_MS);
    pendingReports.set(key, {
      screen,
      conversationId,
      cold,
      checkpoints: [],
    });

    // Auto-flush after interactions complete
    InteractionManager.runAfterInteractions(() => {
      this.traceCheckpoint(screen, conversationId, "interactive");
      this.flushEntryTrace(screen, conversationId);
    });
  },

  /** Record a checkpoint in the current entry trace */
  traceCheckpoint(screen: string, conversationId: string, label: string): void {
    const key = `${screen}:${conversationId}`;
    const start = timers.get(key);
    if (start === undefined) return;
    const elapsed = Math.round(performance.now() - start);
    const report = pendingReports.get(key);
    if (report) {
      report.checkpoints.push({ label, elapsed });
    }
    log.info(`[${screen}] → ${label}: ${elapsed}ms`);
  },

  /** Flush and log the accumulated entry report */
  flushEntryTrace(screen: string, conversationId: string): void {
    const key = `${screen}:${conversationId}`;
    const report = pendingReports.get(key);
    if (!report || report.checkpoints.length === 0) return;

    const summary = report.checkpoints
      .map((c) => `${c.label}=${c.elapsed}ms`)
      .join(" | ");
    log.info(`[${screen}] ENTRY ${report.cold ? "COLD" : "WARM"} — ${summary}`);

    pendingReports.delete(key);
    timers.delete(key);
  },
};
