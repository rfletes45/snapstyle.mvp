/**
 * useGameConnection — Smart switch for multiplayer transport.
 *
 * Determines whether a game opened from an invite should use Colyseus (real-time
 * WebSocket) or Firestore (polling/onSnapshot) based on the game type and
 * feature flags.
 *
 * Usage:
 *   const { resolvedMode, firestoreGameId } = useGameConnection(GAME_TYPE, route.params?.matchId);
 *
 *   useEffect(() => {
 *     if (resolvedMode === "colyseus" && firestoreGameId) {
 *       setGameMode("colyseus");
 *       mp.startMultiplayer();  // hook uses firestoreGameId internally
 *     } else if (resolvedMode === "online" && firestoreGameId) {
 *       setGameMode("online");
 *       setMatchId(firestoreGameId);
 *     }
 *   }, [resolvedMode, firestoreGameId]);
 */

import { shouldUseColyseus } from "@/config/colyseus";
import { useMemo } from "react";

export type ResolvedGameMode = "colyseus" | "online" | null;

export interface GameConnectionResult {
  /** The transport to use: "colyseus" for WebSocket, "online" for Firestore, null if no invite */
  resolvedMode: ResolvedGameMode;
  /** The Firestore match ID from the invite (used by both transport paths) */
  firestoreGameId: string | null;
}

/**
 * Determines the multiplayer transport for a game opened from an invite.
 *
 * @param gameType - The game type key (e.g. "pong_game", "checkers_game")
 * @param matchId  - The Firestore match ID from route params (from invite flow)
 * @returns The resolved mode and Firestore game ID
 */
export function useGameConnection(
  gameType: string,
  matchId?: string,
): GameConnectionResult {
  const resolvedMode = useMemo<ResolvedGameMode>(() => {
    if (!matchId) return null; // No invite — stay in menu
    if (shouldUseColyseus(gameType)) return "colyseus";
    return "online"; // Firestore fallback
  }, [gameType, matchId]);

  return {
    resolvedMode,
    firestoreGameId: matchId ?? null,
  };
}
