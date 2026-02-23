/**
 * Game Result Service — Client-Side
 *
 * Single entry-point for every game to report completion.
 * Calls the `onGameResult` Cloud Function which handles:
 *   - Leaderboard updates
 *   - Achievement evaluation
 *   - XP award + level recalculation
 *
 * @module services/gameResultService
 */

import type { GameResultEvent, GameResultResponse } from "@/types/gameResult";
import { isValidGameType } from "@/types/games";
import { generateId } from "@/utils/ids";
import { createLogger } from "@/utils/log";
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "./firebase";
import { emitGameResultNotification } from "./gameResultEvents";

const log = createLogger("services/gameResultService");

// Track submitted results to prevent double-submission
const submittedKeys = new Set<string>();

/**
 * Submit a game result to the server.
 *
 * Idempotent: if the same idempotencyKey is submitted twice,
 * the second call is a no-op and returns null.
 *
 * @returns GameResultResponse on success, null on skip/error
 */
export async function submitGameResult(
  event: GameResultEvent,
): Promise<GameResultResponse | null> {
  // Assign idempotency key if not provided
  const key = event.idempotencyKey || generateId();
  event.idempotencyKey = key;

  // Client-side dedup
  if (submittedKeys.has(key)) {
    log.debug("Skipping duplicate game result submission", { data: { key } });
    return null;
  }

  // Validate gameId
  if (!isValidGameType(event.gameId)) {
    log.error("Invalid gameId in game result", {
      data: { gameId: event.gameId },
    });
    return null;
  }

  // Validate participants
  if (!event.participants || event.participants.length === 0) {
    log.error("No participants in game result");
    return null;
  }

  submittedKeys.add(key);

  try {
    const functions = getFunctionsInstance();
    const callable = httpsCallable<GameResultEvent, GameResultResponse>(
      functions,
      "onGameResult",
    );

    log.info("Submitting game result", {
      data: {
        gameId: event.gameId,
        mode: event.mode,
        outcome: event.outcome,
        score: event.score,
        participants: event.participants.length,
      },
    });

    const response = await callable(event);

    log.info("Game result processed", {
      data: {
        xpEarned: response.data.xpEarned,
        level: response.data.level,
        didLevelUp: response.data.didLevelUp,
        achievementsUnlocked: response.data.achievementsUnlocked.length,
      },
    });

    // Notify listeners (toast manager, game screens, etc.)
    emitGameResultNotification(event.gameId, response.data);

    return response.data;
  } catch (error) {
    log.error("Failed to submit game result", error);
    // Remove from dedup set so caller can retry
    submittedKeys.delete(key);
    return null;
  }
}

/**
 * Build a GameResultEvent from common game completion data.
 * Convenience helper to reduce boilerplate in game screens.
 */
export function buildGameResultEvent(params: {
  gameId: GameResultEvent["gameId"];
  mode: GameResultEvent["mode"];
  outcome: GameResultEvent["outcome"];
  score?: number | null;
  durationMs: number;
  userId: string;
  displayName: string;
  meta?: Record<string, unknown>;
  inviteId?: string;
  conversationId?: string;
  opponents?: Array<{
    userId: string;
    displayName: string;
    outcome: GameResultEvent["outcome"];
    score?: number;
  }>;
}): GameResultEvent {
  const participants: GameResultEvent["participants"] = [
    {
      userId: params.userId,
      displayName: params.displayName,
      outcome: params.outcome,
      score: params.score ?? undefined,
    },
  ];

  if (params.opponents) {
    for (const opp of params.opponents) {
      participants.push({
        userId: opp.userId,
        displayName: opp.displayName,
        outcome: opp.outcome,
        score: opp.score,
      });
    }
  }

  return {
    gameId: params.gameId,
    mode: params.mode,
    outcome: params.outcome,
    score: params.score ?? null,
    durationMs: params.durationMs,
    participants,
    meta: params.meta,
    inviteId: params.inviteId,
    conversationId: params.conversationId,
    idempotencyKey: generateId(),
  };
}
