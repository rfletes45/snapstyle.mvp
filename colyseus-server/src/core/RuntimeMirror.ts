/**
 * Realtime Framework — Runtime Summary Mirror
 *
 * Writes low-frequency summary data to Firestore for debugging,
 * operational visibility, reconnect UX, and stale room cleanup.
 *
 * This is intentionally NOT tick-authoritative. It mirrors only
 * summary-level data at controlled intervals.
 *
 * @module core/RuntimeMirror
 */

import * as admin from "firebase-admin";
import { getFirebaseDb, isDevBypass } from "../bridge/firebaseBridge";
import type { RuntimeSummary } from "./types";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000; // 15 seconds
const MIN_HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Manages periodic Firestore summary writes for a room.
 */
export class RuntimeMirror {
  private sessionId: string;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastSummary: RuntimeSummary | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Start periodic heartbeat writes.
   */
  start(
    getSummary: () => RuntimeSummary,
    intervalMs: number = DEFAULT_HEARTBEAT_INTERVAL_MS,
  ): void {
    const safeInterval = Math.max(intervalMs, MIN_HEARTBEAT_INTERVAL_MS);
    this.stop(); // Clear any existing interval

    // Write immediately on start
    this.writeSummary(getSummary());

    this.intervalHandle = setInterval(() => {
      this.writeSummary(getSummary());
    }, safeInterval);
  }

  /**
   * Stop periodic writes.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Write a final summary (e.g., on room disposal).
   */
  async writeFinal(summary: RuntimeSummary): Promise<void> {
    this.stop();
    await this.writeSummary(summary);
  }

  /**
   * Write summary to Firestore. Silently catches errors to avoid
   * disrupting gameplay if Firestore is temporarily unavailable.
   */
  private async writeSummary(summary: RuntimeSummary): Promise<void> {
    this.lastSummary = summary;

    if (isDevBypass()) return; // Skip Firestore writes in dev mode

    try {
      const db = getFirebaseDb();
      await db
        .collection("GameSessionsV4")
        .doc(this.sessionId)
        .collection("internal")
        .doc("runtimeSummary")
        .set(
          {
            ...summary,
            lastHeartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    } catch (err) {
      console.warn(
        `[RuntimeMirror] Failed to write summary for session ${this.sessionId}:`,
        err,
      );
    }
  }

  getLastSummary(): RuntimeSummary | null {
    return this.lastSummary;
  }
}
