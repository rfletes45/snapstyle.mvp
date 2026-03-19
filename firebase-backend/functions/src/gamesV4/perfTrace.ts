/**
 * Games V4 — Server-Side Performance Tracing
 *
 * Lightweight structured logging for latency-sensitive backend paths.
 * Always active (server logs are not user-facing) but minimal overhead.
 *
 * @module gamesV4/perfTrace
 */

const TAG = "[perfTrace]";

interface ServerTrace {
  mark(label: string): void;
  end(): { totalMs: number; marks: Record<string, number> };
}

export function startServerTrace(id: string, context?: string): ServerTrace {
  const startTs = Date.now();
  const marks: Array<{ label: string; elapsed: number }> = [];

  return {
    mark(label: string) {
      marks.push({ label, elapsed: Date.now() - startTs });
    },
    end() {
      const totalMs = Date.now() - startTs;
      const markMap: Record<string, number> = {};
      for (const m of marks) markMap[m.label] = m.elapsed;

      const milestones = marks
        .map((m) => `${m.label}=+${m.elapsed}ms`)
        .join(", ");
      console.log(
        `${TAG} ${id}${context ? ` (${context})` : ""} total=${totalMs}ms [${milestones}]`,
      );
      return { totalMs, marks: markMap };
    },
  };
}
