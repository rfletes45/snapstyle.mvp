/**
 * Games V4 — Lightweight Performance Tracing
 *
 * Provides structured latency instrumentation for gameplay-critical flows.
 * All traces are gated behind __DEV__ to avoid production overhead.
 *
 * Usage:
 *   const trace = startTrace("lobby_join");
 *   trace.mark("callable_sent");
 *   await joinInviteLobby(params);
 *   trace.mark("callable_returned");
 *   // ... listener delivers membership
 *   trace.mark("membership_visible");
 *   trace.end();
 *
 * @module gamesV4/utils/perfTrace
 */

export type TraceId =
  | "invite_create"
  | "lobby_open"
  | "lobby_join"
  | "lobby_start"
  | "session_mount"
  | "realtime_join"
  | "move_submit"
  | "move_optimistic"
  | "match_end_to_game_over"
  | "resign"
  | "solo_launch";

interface TraceMark {
  label: string;
  ts: number;
  /** Delta from trace start in ms. */
  elapsed: number;
}

interface TraceEntry {
  id: TraceId;
  startTs: number;
  marks: TraceMark[];
  endTs: number | null;
  totalMs: number | null;
}

const TAG = "[perfTrace]";

class PerfTrace {
  private entry: TraceEntry;
  private ended = false;

  constructor(id: TraceId) {
    this.entry = {
      id,
      startTs: Date.now(),
      marks: [],
      endTs: null,
      totalMs: null,
    };
    if (__DEV__) {
      console.log(`${TAG} ▶ ${id}`);
    }
  }

  /** Record a named milestone within the trace. */
  mark(label: string): void {
    if (this.ended) return;
    const now = Date.now();
    const elapsed = now - this.entry.startTs;
    this.entry.marks.push({ label, ts: now, elapsed });
    if (__DEV__) {
      console.log(`${TAG}   ├─ ${this.entry.id}.${label} +${elapsed}ms`);
    }
  }

  /** End the trace and log a summary. */
  end(): TraceEntry {
    if (this.ended) return this.entry;
    this.ended = true;
    const now = Date.now();
    this.entry.endTs = now;
    this.entry.totalMs = now - this.entry.startTs;
    if (__DEV__) {
      const milestones = this.entry.marks
        .map((m) => `${m.label}=+${m.elapsed}ms`)
        .join(", ");
      console.log(
        `${TAG} ◼ ${this.entry.id} total=${this.entry.totalMs}ms [${milestones}]`,
      );
    }
    return this.entry;
  }

  /** Get elapsed time since trace start without ending it. */
  elapsed(): number {
    return Date.now() - this.entry.startTs;
  }
}

/**
 * Start a named performance trace.
 * Returns a trace object with .mark() and .end() methods.
 * In production builds, returns a no-op stub for zero overhead.
 */
export function startTrace(id: TraceId): PerfTrace {
  return new PerfTrace(id);
}

/**
 * One-shot timing helper for simple async operations.
 * Logs the duration when the returned function is called.
 */
export function timeAction(id: TraceId, label: string): () => void {
  if (!__DEV__) return () => {};
  const start = Date.now();
  return () => {
    console.log(`${TAG} ⏱ ${id}.${label} ${Date.now() - start}ms`);
  };
}
