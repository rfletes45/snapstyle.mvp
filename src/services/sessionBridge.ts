/**
 * Session Bridge — Synchronises v3 GameSession lifecycle with game events.
 *
 * Games call these helpers instead of interacting with the session document
 * directly.  Every function is fire-and-forget safe — failures are logged but
 * never thrown, so game UX is never blocked by session bookkeeping.
 *
 * @module services/sessionBridge
 */

import { GAME_SESSIONS_V3 } from "@/constants/featureFlags";
import type {
  ResolveSessionParams,
  SessionOutcome,
} from "@/types/gameSessionV3";
import { createLogger } from "@/utils/log";
import { resolveSession } from "./gameSessions";

const logger = createLogger("services/sessionBridge");

// =============================================================================
// Public API
// =============================================================================

export interface ResolveGameParams {
  /** v3 session document ID. */
  sessionId: string;
  /** Game outcome. */
  outcome: SessionOutcome;
  /** UID of the winning player (omit for draw / error). */
  winnerUid?: string;
  /** Per-participant scores keyed by UID. */
  scores?: Record<string, number>;
  /** Firestore turn-based game doc ID, if applicable. */
  firestoreGameId?: string;
}

/**
 * Resolve (close) a v3 game session after the game ends.
 *
 * Safe to call multiple times — the Cloud Function is idempotent.
 * Returns `true` if the resolution succeeded (or was already terminal).
 *
 * @example
 * ```ts
 * // In a game screen or hook when the game finishes:
 * await resolveGameSession({
 *   sessionId,
 *   outcome: "win",
 *   winnerUid: myUid,
 *   scores: { [myUid]: 7, [opponentUid]: 3 },
 * });
 * ```
 */
export async function resolveGameSession(
  params: ResolveGameParams,
): Promise<boolean> {
  if (!GAME_SESSIONS_V3.ENABLED) {
    return true; // v3 disabled — nothing to resolve
  }

  if (!params.sessionId) {
    logger.warn("[SessionBridge] resolveGameSession called without sessionId");
    return false;
  }

  try {
    const resolveParams: ResolveSessionParams = {
      sessionId: params.sessionId,
      outcome: params.outcome,
      winnerUid: params.winnerUid,
      scores: params.scores,
      firestoreGameId: params.firestoreGameId,
      resolvedBy: "client",
    };

    const result = await resolveSession(resolveParams);

    if (result.success) {
      logger.info("[SessionBridge] Session resolved", {
        sessionId: params.sessionId,
        outcome: params.outcome,
        alreadyTerminal: result.alreadyTerminal,
      });
      return true;
    }

    logger.warn("[SessionBridge] resolveSession returned failure", {
      sessionId: params.sessionId,
      error: result.error,
    });
    return false;
  } catch (err) {
    // Never throw — game UX must not be blocked by session bookkeeping
    logger.error("[SessionBridge] resolveGameSession threw", err);
    return false;
  }
}
