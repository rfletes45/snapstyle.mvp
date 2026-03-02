/**
 * Invite Trace Envelope — Colyseus Server
 *
 * Server-side equivalent of the client `inviteTrace.ts`.
 * Re-uses createServerLogger from the existing logger utility and
 * produces the same canonical envelope keys for cross-layer correlation.
 *
 * Usage:
 *   import { createInviteTrace } from "../utils/inviteTrace";
 *   const trace = createInviteTrace({ inviteId, gameType, uid, role: "system" });
 *   trace.info("ROOM.CREATE", { roomName });
 *   trace.error("PERSIST.RESULT.WRITE_FAIL", err);
 *
 * @see docs/GAMES_SYSTEM.md §4 (Colyseus instrumentation)
 */

import { createServerLogger } from "./logger";

// =============================================================================
// Types
// =============================================================================

export type InviteRole = "host" | "joiner" | "spectator" | "system";
export type RuntimeType = "solo" | "turnBased" | "realtime";

export interface TraceEnvelope {
  traceId: string;
  inviteId?: string;
  gameType?: string;
  runtimeType?: RuntimeType;
  conversationId?: string;
  uid?: string;
  role?: InviteRole;
  status?: string;
  gameId?: string;
  firestoreGameId?: string;
}

export interface InviteTracer {
  readonly envelope: Readonly<TraceEnvelope>;
  info(step: string, data?: Record<string, unknown>): void;
  warn(step: string, data?: Record<string, unknown>): void;
  error(step: string, err: unknown, data?: Record<string, unknown>): void;
  snapshot(step: string, obj: unknown): void;
  update(patch: Partial<TraceEnvelope>): InviteTracer;
}

// =============================================================================
// Helpers
// =============================================================================

const traceLogger = createServerLogger("inviteTrace");

function generateTraceId(prefix = "inv"): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

// =============================================================================
// Factory
// =============================================================================

export function createInviteTrace(
  initial: Partial<TraceEnvelope> = {},
): InviteTracer {
  const envelope: TraceEnvelope = {
    traceId: initial.traceId || generateTraceId("inv"),
    ...initial,
  };

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

  const tracer: InviteTracer = {
    get envelope() {
      return envelope;
    },

    info(step, data) {
      traceLogger.info(step, build(step, data));
    },

    warn(step, data) {
      traceLogger.warn(step, build(step, data));
    },

    error(step, err, data) {
      traceLogger.error(step, {
        ...build(step, data),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    },

    snapshot(step, obj) {
      if (process.env.NODE_ENV !== "production") {
        try {
          const sanitised = JSON.parse(JSON.stringify(obj));
          traceLogger.debug(`[SNAPSHOT] ${step}`, {
            ...envelope,
            step,
            snapshot: sanitised,
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
  };

  return tracer;
}
