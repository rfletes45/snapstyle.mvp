/**
 * Session Trace Envelope
 *
 * Structured tracing helper for v3 game-session lifecycle instrumentation.
 * Every log line carries a canonical envelope so you can filter/correlate
 * across client, Cloud Functions, and Colyseus server logs.
 *
 * Mirrors the `inviteTrace.ts` pattern but keyed on `sessionId` instead of
 * `inviteId`, with additional v3-specific fields.
 *
 * Usage:
 *   import { createSessionTrace } from "@/utils/sessionTrace";
 *   const trace = createSessionTrace({ sessionId, gameType, uid, role: "host" });
 *   trace.info("SESSION.CREATE.OK", { participantCount: 2 });
 *   trace.warn("SESSION.JOIN.DENIED", { reason: "full" });
 *   trace.snapshot("SESSION.DOC", sessionDoc);
 *
 * @see docs/GAMES_SYSTEM.md §v3-sessions (trace envelope)
 */

import { createLogger } from "@/utils/log";
import { createTraceId } from "@/utils/trace";

// =============================================================================
// Types
// =============================================================================

export type SessionRole = "host" | "joiner" | "spectator" | "system";

export type SessionRuntimeType = "solo" | "turnBased" | "realtime";

export type SessionPhase =
  | "lobby"
  | "starting"
  | "active"
  | "finishing"
  | "resolved"
  | "abandoned";

export interface SessionTraceEnvelope {
  traceId: string;
  sessionId?: string;
  inviteId?: string;
  gameType?: string;
  runtimeType?: SessionRuntimeType;
  conversationId?: string;
  uid?: string;
  role?: SessionRole;
  phase?: SessionPhase;
  colyseusRoomId?: string;
  firestoreGameId?: string;
}

export interface SessionTracer {
  /** The current envelope — read-only snapshot of context fields */
  readonly envelope: Readonly<SessionTraceEnvelope>;

  /** Informational log with step tag + optional extra data */
  info(step: string, data?: Record<string, unknown>): void;

  /** Warning-level log */
  warn(step: string, data?: Record<string, unknown>): void;

  /** Error-level log */
  error(step: string, err: unknown, data?: Record<string, unknown>): void;

  /** DEV-only: dump sanitised JSON snapshot of an object (no-op in prod) */
  snapshot(step: string, obj: unknown): void;

  /** Merge additional context into the envelope (returns same tracer) */
  update(patch: Partial<SessionTraceEnvelope>): SessionTracer;

  /** Fork a child tracer with inherited envelope + override fields */
  child(patch: Partial<SessionTraceEnvelope>): SessionTracer;
}

// =============================================================================
// Logger
// =============================================================================

const traceLogger = createLogger("sessionTrace");

// =============================================================================
// Health helpers
// =============================================================================

/**
 * Compute derived session-health fields from a raw session doc.
 * Useful for diagnosing stuck/stale sessions.
 */
export function computeSessionHealth(
  session: Record<string, unknown>,
): Record<string, unknown> {
  const now = Date.now();
  const createdAt =
    typeof session.createdAt === "number" ? session.createdAt : now;
  const updatedAt =
    typeof session.updatedAt === "number" ? session.updatedAt : createdAt;

  const TERMINAL = new Set(["resolved", "abandoned", "expired"]);
  const phase = String(session.phase ?? "unknown");

  return {
    ageMs: now - createdAt,
    sinceUpdateMs: now - updatedAt,
    isTerminal: TERMINAL.has(phase),
    participantCount: Array.isArray(session.participants)
      ? session.participants.length
      : 0,
    hasColyseusRoom: !!session.colyseusRoomId,
    hasFirestoreGame: !!session.firestoreGameId,
  };
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a structured session tracer.
 *
 * @param initial — Partial envelope; `traceId` auto-generated if missing.
 */
export function createSessionTrace(
  initial: Partial<SessionTraceEnvelope> = {},
): SessionTracer {
  return _buildTracer({
    traceId: initial.traceId || createTraceId("ses"),
    ...initial,
  });
}

// =============================================================================
// Internal builder
// =============================================================================

function _buildTracer(envelope: SessionTraceEnvelope): SessionTracer {
  function build(
    step: string,
    data?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...envelope,
      step,
      ts: Date.now(),
      ...data,
    };
  }

  const tracer: SessionTracer = {
    get envelope() {
      return envelope;
    },

    info(step, data) {
      traceLogger.info(step, { data: build(step, data) });
    },

    warn(step, data) {
      traceLogger.warn(step, { data: build(step, data) });
    },

    error(step, err, data) {
      traceLogger.error(step, err, {
        data: build(step, {
          ...data,
          errorMessage: err instanceof Error ? err.message : String(err),
        }),
      });
    },

    snapshot(step, obj) {
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        try {
          const sanitised = JSON.parse(JSON.stringify(obj));
          traceLogger.debug(`[SNAPSHOT] ${step}`, {
            data: { ...envelope, step, snapshot: sanitised },
          });
        } catch {
          traceLogger.debug(`[SNAPSHOT] ${step} (unserializable)`);
        }
      }
    },

    update(patch) {
      Object.assign(envelope, patch);
      return tracer;
    },

    child(patch) {
      return _buildTracer({ ...envelope, ...patch });
    },
  };

  return tracer;
}
