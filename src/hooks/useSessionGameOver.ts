/**
 * useSessionGameOver — subscribes to a v3 session's resolution and
 * derives game-over display state.
 *
 * Returns null while loading or if the session hasn't resolved yet.
 * When the session reaches a terminal phase with a resolution object,
 * returns a `SessionGameOverState` that maps directly into the
 * GameOverSheet UI.
 *
 * @module src/hooks/useSessionGameOver
 */

import { useEffect, useState } from "react";

import { GAME_SESSIONS_V3 } from "@/constants/featureFlags";
import { subscribeToSession } from "@/services/gameSessions";
import type { GameSessionV3 } from "@/types/gameSessionV3";
import { isSessionTerminal } from "@/types/gameSessionV3";
import { createLogger } from "@/utils/log";

const log = createLogger("useSessionGameOver");

// =============================================================================
// Types
// =============================================================================

export type GameOverResult = "win" | "loss" | "draw" | "forfeit" | "abandoned";

export interface SessionGameOverParticipant {
  uid: string;
  displayName: string;
  avatarUrl?: string;
  score?: number;
  isWinner?: boolean;
  role: string;
}

export interface SessionGameOverState {
  /** The result for the *current* user */
  result: GameOverResult;
  /** Session game type */
  gameType: string;
  /** All participants at end of game */
  participants: SessionGameOverParticipant[];
  /** Winner display name (if any) */
  winnerName?: string;
  /** Winner UID (if any) */
  winnerUid?: string;
  /** Final scores map (uid → score) */
  scores?: Record<string, number>;
  /** XP awarded map (uid → xp) */
  xpAwarded?: Record<string, number>;
  /** When the game resolved (epoch ms) */
  resolvedAt?: number;
  /** Session phase (for abandoned/expired display) */
  phase: string;
  /** Session ID */
  sessionId: string;
  /** Raw session data for advanced rendering */
  session: GameSessionV3;
}

// =============================================================================
// Hook
// =============================================================================

export function useSessionGameOver(
  sessionId: string | undefined,
  currentUid: string | undefined,
): SessionGameOverState | null {
  const [session, setSession] = useState<GameSessionV3 | null>(null);

  useEffect(() => {
    if (!sessionId || !GAME_SESSIONS_V3.ENABLED) return;

    const unsub = subscribeToSession(
      sessionId,
      (s) => setSession(s),
      (err) => log.error("subscription error", { sessionId, error: err }),
    );

    return unsub;
  }, [sessionId]);

  // Derive game-over state
  if (!session || !currentUid || !isSessionTerminal(session.phase)) {
    return null;
  }

  const resolution = session.resolution;
  const phase = session.phase;

  // Determine result for current user
  let result: GameOverResult;
  if (phase === "abandoned") {
    result = "abandoned";
  } else if (phase === "expired") {
    result = "abandoned";
  } else if (!resolution) {
    // Terminal but no resolution — treat as abandoned
    result = "abandoned";
  } else if (resolution.outcome === "forfeit") {
    result = "forfeit";
  } else if (resolution.outcome === "draw") {
    result = "draw";
  } else if (resolution.winnerUid === currentUid) {
    result = "win";
  } else {
    result = "loss";
  }

  // Map participants
  const participants: SessionGameOverParticipant[] = session.participants.map(
    (p) => ({
      uid: p.uid,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      score: p.score ?? resolution?.scores?.[p.uid],
      isWinner: p.isWinner ?? resolution?.winnerUid === p.uid,
      role: p.role,
    }),
  );

  // Winner name
  const winner = participants.find((p) => p.isWinner);

  return {
    result,
    gameType: session.gameType,
    participants,
    winnerName: winner?.displayName,
    winnerUid: resolution?.winnerUid,
    scores: resolution?.scores,
    xpAwarded: resolution?.xpAwarded,
    resolvedAt: resolution?.resolvedAt,
    phase,
    sessionId: session.id,
    session,
  };
}
