/**
 * Trace ID (Correlation ID) Generator
 *
 * Produces short, URL-safe, collision-resistant identifiers used to
 * correlate logs across client → Colyseus server → Firestore.
 *
 * Format:  {prefix}-{timestamp36}-{random}
 * Example: gs-m5abc12-k7f9x2
 *
 * Usage:
 *   import { createTraceId } from "@/utils/trace";
 *   const traceId = createTraceId("gs");  // game-session
 *   const traceId = createTraceId("inv"); // invite
 */

/**
 * Create a trace/correlation ID.
 *
 * @param prefix  Short tag for the subsystem (default "t"). Keep it 1-4 chars.
 * @returns       A string like "gs-m5abc12-k7f9x2" (~20 chars).
 */
export function createTraceId(prefix: string = "t"): string {
  const ts = Date.now().toString(36); // ~8 chars, monotonic
  const rand = randomAlphanumeric(6);
  return `${prefix}-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ALPHANUM = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Generate a random alphanumeric string of length `n`.
 */
function randomAlphanumeric(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ALPHANUM[(Math.random() * ALPHANUM.length) | 0];
  }
  return out;
}
