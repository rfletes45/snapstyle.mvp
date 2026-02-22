import { createServerLogger } from "../utils/logger";
const log = createServerLogger("persistence");

/**
 * Persistence Service â€” Firestore save/restore for game state
 *
 * Handles three critical operations:
 * 1. saveGameState()   â€” Cold-store a room's state when all players leave mid-game
 * 2. loadGameState()   â€” Restore a suspended game into a new room
 * 3. persistGameResult() â€” Record a completed game for stats, history, and ELO
 *
 * Collections used:
 * - ColyseusGameState/   â€” Suspended game snapshots (new)
 * - RealtimeGameSessions/ â€” Completed real-time game records (new)
 * - TurnBasedGames/      â€” Existing collection, updated for Colyseus-sourced games
 */

import { FieldValue } from "firebase-admin/firestore";
import { BaseGameState, Player } from "../schemas/common";
import { getFirestoreDb } from "./firebase";

// =============================================================================
// Types
// =============================================================================

export interface SerializedPlayer {
  uid: string;
  displayName: string;
  score: number;
  playerIndex: number;
  eloRating: number;
}

export interface SerializedGameState {
  gameType: string;
  phase: string;
  turnNumber: number;
  currentTurnPlayerId: string;
  isRated: boolean;
  players: Record<string, SerializedPlayer>;
  savedAt: FieldValue;
  lastRoomId: string;
  status: "suspended" | "active" | "completed";
  [key: string]: any; // Game-specific fields
}

export interface GameResultPlayerEntry {
  uid: string;
  displayName: string;
  score: number;
  playerIndex: number;
  /** Per-player game-specific stats for achievement evaluation */
  gameSpecific?: Record<string, number>;
}

export interface GameResultRecord {
  gameType: string;
  players: GameResultPlayerEntry[];
  winnerId: string;
  winReason: string;
  turnCount: number;
  isRated: boolean;
  completedAt: FieldValue;
  source: "colyseus";
  gameDurationMs?: number;
}

// =============================================================================
// Save Game State
// =============================================================================

/**
 * Save a turn-based game's full state to Firestore for later restoration.
 * Called from TurnBasedRoom.onDispose() when all players have left mid-game.
 *
 * @param state - The room's current state
 * @param roomId - The Colyseus room ID
 * @param extraFields - Game-specific state to persist (board, cards, etc.)
 * @returns The Firestore document ID
 */
export async function saveGameState(
  state: BaseGameState,
  roomId: string,
  extraFields: Record<string, any> = {},
): Promise<string | null> {
  const db = getFirestoreDb();
  if (!db) {
    log.warn("[Persistence] No Firestore â€” cannot save game state");
    return null;
  }

  const gameId = state.firestoreGameId || roomId;

  const players: Record<string, SerializedPlayer> = {};
  state.players.forEach((player: Player, key: string) => {
    players[key] = {
      uid: player.uid,
      displayName: player.displayName,
      score: player.score,
      playerIndex: player.playerIndex,
      eloRating: player.eloRating,
    };
  });

  const serializedState: SerializedGameState = {
    gameType: state.gameType,
    phase: state.phase,
    turnNumber: state.turnNumber,
    currentTurnPlayerId: state.currentTurnPlayerId,
    isRated: state.isRated,
    players,
    savedAt: FieldValue.serverTimestamp(),
    lastRoomId: roomId,
    status: "suspended",
    ...extraFields,
  };

  try {
    await db
      .collection("ColyseusGameState")
      .doc(gameId)
      .set(serializedState, { merge: true });

    // Also update existing TurnBasedGames document if linked
    if (state.firestoreGameId) {
      await db
        .collection("TurnBasedGames")
        .doc(state.firestoreGameId)
        .update({
          status: "suspended",
          suspendedAt: FieldValue.serverTimestamp(),
          colyseusStateRef: `ColyseusGameState/${gameId}`,
        });
    }

    log.info(`[Persistence] Saved game state: ${gameId}`);
    return gameId;
  } catch (error) {
    log.error("[Persistence] Failed to save game state:", error);
    return null;
  }
}

// =============================================================================
// Load Game State
// =============================================================================

/**
 * Load a suspended game state from Firestore.
 * Called from TurnBasedRoom.onCreate() when firestoreGameId is provided.
 *
 * @param gameId - The Firestore document ID
 * @returns The saved state data, or null if not found
 */
export async function loadGameState(
  gameId: string,
): Promise<Record<string, any> | null> {
  const db = getFirestoreDb();
  if (!db) {
    log.warn("[Persistence] No Firestore â€” cannot load game state");
    return null;
  }

  try {
    const doc = await db.collection("ColyseusGameState").doc(gameId).get();
    if (!doc.exists) {
      log.warn(`[Persistence] No saved state found for: ${gameId}`);
      return null;
    }

    const data = doc.data()!;
    if (data.status === "completed") {
      log.warn(
        `[Persistence] Game ${gameId} is already completed â€” not restoring`,
      );
      return null;
    }

    // Mark as resumed
    await db.collection("ColyseusGameState").doc(gameId).update({
      status: "active",
      resumedAt: FieldValue.serverTimestamp(),
    });

    log.info(`[Persistence] Loaded game state: ${gameId}`);
    return data;
  } catch (error) {
    log.error("[Persistence] Failed to load game state:", error);
    return null;
  }
}

// =============================================================================
// Persist Game Result
// =============================================================================

/**
 * Persist a completed game's result to Firestore.
 * Records to RealtimeGameSessions (new) or updates TurnBasedGames (existing).
 * Triggers existing Cloud Functions for stats, achievements, and leaderboards.
 *
 * @param state - The room's final state
 * @param gameDurationMs - How long the game lasted in milliseconds
 */
export async function persistGameResult(
  state: BaseGameState,
  gameDurationMs?: number,
  perPlayerStats?: Record<string, Record<string, number>>,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    log.warn("[Persistence] No Firestore - cannot persist game result");
    return;
  }

  const players: GameResultRecord["players"] = [];
  state.players.forEach((player: Player) => {
    players.push({
      uid: player.uid,
      displayName: player.displayName,
      score: player.score,
      playerIndex: player.playerIndex,
      ...(perPlayerStats?.[player.uid]
        ? { gameSpecific: perPlayerStats[player.uid] }
        : {}),
    });
  });

  const gameRecord: GameResultRecord = {
    gameType: state.gameType,
    players,
    winnerId: state.winnerId,
    winReason: state.winReason,
    turnCount: state.turnNumber,
    isRated: state.isRated,
    completedAt: FieldValue.serverTimestamp(),
    source: "colyseus",
    gameDurationMs,
  };

  try {
    if (state.firestoreGameId) {
      // Update existing TurnBasedGames document
      await db
        .collection("TurnBasedGames")
        .doc(state.firestoreGameId)
        .update({
          ...gameRecord,
          status: "completed",
        });
    } else {
      // Create new real-time game session record
      await db.collection("RealtimeGameSessions").add(gameRecord);
    }

    // Clean up suspended state if any
    const gameId = state.gameId || state.firestoreGameId;
    if (gameId) {
      const stateRef = db.collection("ColyseusGameState").doc(gameId);
      const stateDoc = await stateRef.get();
      if (stateDoc.exists) {
        await stateRef.delete();
      }
    }

    log.info(
      `[Persistence] Persisted game result: ${state.gameType} â€” winner: ${state.winnerId || "draw"}`,
    );
  } catch (error) {
    log.error("[Persistence] Failed to persist game result:", error);
  }
}

// =============================================================================
// Cleanup â€” Expired Suspended Games
// =============================================================================

/**
 * Delete suspended game states older than the specified age.
 * Should be called by a scheduled job (e.g., daily via Cloud Scheduler).
 *
 * @param maxAgeMs - Maximum age in milliseconds (default: 30 days)
 */
export async function cleanupExpiredGameStates(
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000,
): Promise<number> {
  const db = getFirestoreDb();
  if (!db) return 0;

  const cutoff = new Date(Date.now() - maxAgeMs);

  try {
    const snapshot = await db
      .collection("ColyseusGameState")
      .where("status", "==", "suspended")
      .where("savedAt", "<", cutoff)
      .limit(100)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    log.info(`[Persistence] Cleaned up ${snapshot.size} expired game states`);
    return snapshot.size;
  } catch (error) {
    log.error("[Persistence] Cleanup failed:", error);
    return 0;
  }
}

// =============================================================================
// Game + Invite Deletion (Vacancy / Pre-Start Abandonment / Resolution)
// =============================================================================

/**
 * Delete a game session and its associated invite from Firestore.
 *
 * Used when:
 * - All players leave before the game officially starts (pre-start abandonment)
 * - A vacancy timer expires (non-turn-based: 10min, turn-based: 2 days)
 * - A game resolves (win/loss/resign) — after results are persisted
 *
 * @param firestoreGameId - The game ID (used in TurnBasedGames, ColyseusGameState)
 * @param inviteId - The invite ID in GameInvites collection (optional)
 */
export async function deleteGameAndInvite(
  firestoreGameId: string,
  inviteId?: string,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const batch = db.batch();

  try {
    // Delete ColyseusGameState snapshot (if exists)
    const colyseusRef = db.collection("ColyseusGameState").doc(firestoreGameId);
    const colyseusDoc = await colyseusRef.get();
    if (colyseusDoc.exists) {
      batch.delete(colyseusRef);
    }

    // Delete TurnBasedGames record (if exists); auto-discover inviteId
    const tbRef = db.collection("TurnBasedGames").doc(firestoreGameId);
    const tbDoc = await tbRef.get();
    if (tbDoc.exists) {
      // Auto-discover inviteId from the game doc if not explicitly provided
      if (!inviteId) {
        inviteId = tbDoc.data()?.inviteId;
      }
      batch.delete(tbRef);
    }

    // Delete RealtimeGameSessions record (if exists)
    const rtRef = db.collection("RealtimeGameSessions").doc(firestoreGameId);
    const rtDoc = await rtRef.get();
    if (rtDoc.exists) {
      batch.delete(rtRef);
    }

    // Mark the associated invite as completed so it disappears from chat
    if (inviteId) {
      const inviteRef = db.collection("GameInvites").doc(inviteId);
      const inviteDoc = await inviteRef.get();
      if (inviteDoc.exists) {
        batch.update(inviteRef, {
          status: "completed",
          completedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();
    log.info(
      `[Persistence] Deleted game ${firestoreGameId}${inviteId ? ` + completed invite ${inviteId}` : ""}`,
    );
  } catch (error) {
    log.error("[Persistence] deleteGameAndInvite failed:", error);
  }
}

/**
 * Mark a game as vacant in Firestore (for vacancy timer tracking).
 *
 * Sets `vacantSince` to the current server timestamp so the scheduled
 * Cloud Function can pick it up for deletion after the appropriate window.
 *
 * @param firestoreGameId - The game ID
 * @param gameType - The game type key
 * @param isTurnBased - Whether the game is turn-based (2-day window vs 10-min)
 */
export async function markGameVacant(
  firestoreGameId: string,
  gameType: string,
  isTurnBased: boolean,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  try {
    const ref = db.collection("ColyseusGameState").doc(firestoreGameId);
    await ref.set(
      {
        vacantSince: FieldValue.serverTimestamp(),
        gameType,
        isTurnBased,
        status: "vacant",
        lastActiveAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    log.info(`[Persistence] Marked game ${firestoreGameId} as vacant`);
  } catch (error) {
    log.error("[Persistence] markGameVacant failed:", error);
  }
}

/**
 * Clear the vacancy marker when a player rejoins a game.
 *
 * @param firestoreGameId - The game ID
 */
export async function clearGameVacancy(firestoreGameId: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  try {
    const ref = db.collection("ColyseusGameState").doc(firestoreGameId);
    const doc = await ref.get();
    if (doc.exists && doc.data()?.status === "vacant") {
      await ref.update({
        vacantSince: FieldValue.delete(),
        status: "active",
        lastActiveAt: FieldValue.serverTimestamp(),
      });
      log.info(`[Persistence] Cleared vacancy for game ${firestoreGameId}`);
    }
  } catch (error) {
    log.error("[Persistence] clearGameVacancy failed:", error);
  }
}
