/**
 * Invite Trace Envelope
 *
 * A thin, structured tracing helper for invite lifecycle instrumentation.
 * Every log line emitted through this helper carries the same canonical
 * envelope keys so you can filter/correlate across client, Cloud Functions,
 * and Colyseus server logs.
 *
 * Usage:
 *   import { createInviteTrace } from "@/utils/inviteTrace";
 *   const trace = createInviteTrace({ inviteId, gameType, uid, role: "host" });
 *   trace.info("INVITE.CREATE.WRITE_OK", { claimedSlotsCount: 1 });
 *   trace.warn("INVITE.SLOT.CLAIM.TXN_FAIL", { error: "Game is full" });
 *   trace.snapshot("INVITE.DOC", inviteDoc); // DEV-only full dump
 *
 * @see docs/GAMES_SYSTEM.md §1 (trace envelope)
 */

import { createLogger } from "@/utils/log";
import { createTraceId } from "@/utils/trace";

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
  /** The current envelope — read-only snapshot of context fields */
  readonly envelope: Readonly<TraceEnvelope>;

  /** Informational log with step tag + optional extra data */
  info(step: string, data?: Record<string, unknown>): void;

  /** Warning-level log */
  warn(step: string, data?: Record<string, unknown>): void;

  /** Error-level log */
  error(step: string, err: unknown, data?: Record<string, unknown>): void;

  /** DEV-only: dump sanitised JSON snapshot of an object (no-op in prod) */
  snapshot(step: string, obj: unknown): void;

  /** Merge additional context into the envelope (returns same tracer) */
  update(patch: Partial<TraceEnvelope>): InviteTracer;
}

// =============================================================================
// Helpers
// =============================================================================

const traceLogger = createLogger("inviteTrace");

/**
 * Compute derived invite-health fields from a raw invite doc.
 * Useful for diagnosing stuck/stale invites.
 */
export function computeInviteHealth(
  invite: Record<string, unknown>,
): Record<string, unknown> {
  const now = Date.now();
  const createdAt =
    typeof invite.createdAt === "number" ? invite.createdAt : now;
  const updatedAt =
    typeof invite.updatedAt === "number" ? invite.updatedAt : createdAt;

  const TERMINAL = new Set(["completed", "declined", "expired", "cancelled"]);
  const status = String(invite.status ?? "unknown");

  return {
    ageMs: now - createdAt,
    sinceUpdateMs: now - updatedAt,
    isTerminal: TERMINAL.has(status),
    isChatHidden: invite.chatVisibility === "hidden",
    hasChatFields: {
      chatVisibility: invite.chatVisibility !== undefined,
      chatHiddenAt: invite.chatHiddenAt !== undefined,
      chatHiddenInConversationIds: Array.isArray(
        invite.chatHiddenInConversationIds,
      ),
      deleteAt: invite.deleteAt !== undefined,
    },
  };
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a structured invite tracer.
 *
 * @param initial — Partial envelope; `traceId` auto-generated if missing.
 */
export function createInviteTrace(
  initial: Partial<TraceEnvelope> = {},
): InviteTracer {
  const envelope: TraceEnvelope = {
    traceId: initial.traceId || createTraceId("inv"),
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
  };

  return tracer;
}
