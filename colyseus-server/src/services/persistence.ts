import { EXTERNAL_COLYSEUS_GAME_TYPES } from "../../../shared/sessions/constants";
import { createInviteTrace } from "../utils/inviteTrace";
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
  metadata?: {
    inviteId?: string;
    firestoreGameId?: string;
    v3SessionId?: string;
  },
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    log.warn("[Persistence] No Firestore - cannot persist game result");
    return;
  }

  const players: GameResultRecord["players"] = [];
  // Use state.players if populated; fall back to cardPlayers for card games
  // (card games extend BaseGameState but use cardPlayers instead of players).
  const playerMap =
    state.players?.size > 0
      ? state.players
      : ((state as any).cardPlayers ?? null);
  if (playerMap) {
    playerMap.forEach((player: Player) => {
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
  }

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
      // Create new real-time game session record.
      // Include inviteId / firestoreGameId / v3SessionId so the
      // processRealtimeGameCompletion Cloud Function can reliably discover
      // and finalize the associated invite, and skip rewards for v3 sessions.
      const sessionDoc: Record<string, any> = { ...gameRecord };
      if (metadata?.inviteId) sessionDoc.inviteId = metadata.inviteId;
      if (metadata?.firestoreGameId)
        sessionDoc.firestoreGameId = metadata.firestoreGameId;
      if (metadata?.v3SessionId) sessionDoc.v3SessionId = metadata.v3SessionId;
      await db.collection("RealtimeGameSessions").add(sessionDoc);
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

    const trace = createInviteTrace({
      gameType: state.gameType,
      inviteId: metadata?.inviteId,
      firestoreGameId:
        metadata?.firestoreGameId || state.firestoreGameId || undefined,
      role: "system",
    });
    trace.info("PERSIST.RESULT.WRITE_OK", {
      winnerId: state.winnerId || "draw",
      playerCount: players.length,
      gameDurationMs,
      collection: state.firestoreGameId
        ? "TurnBasedGames"
        : "RealtimeGameSessions",
    });
  } catch (error) {
    const trace = createInviteTrace({
      gameType: state.gameType,
      inviteId: metadata?.inviteId,
      firestoreGameId:
        metadata?.firestoreGameId || state.firestoreGameId || undefined,
      role: "system",
    });
    trace.error("PERSIST.RESULT.WRITE_FAIL", error, {
      winnerId: state.winnerId || "draw",
    });
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
// Helpers — External Colyseus Game ID Parsing
// =============================================================================

/**
 * Known external Colyseus game types, sorted longest-first for unambiguous
 * prefix matching.  Derived from the shared canonical list.
 */
const KNOWN_EXT_GAME_TYPES: readonly string[] = [
  ...EXTERNAL_COLYSEUS_GAME_TYPES,
].sort((a, b) => b.length - a.length);

/**
 * Extract the invite ID from an external Colyseus game ID.
 *
 * Format: `ext_<gameType>_<inviteId>`
 *
 * **IMPORTANT**: invite IDs may contain underscores (e.g. `uinv_mm2myqz0_ijltf8`).
 * We therefore CANNOT use `lastIndexOf("_")`.  Instead we strip the known prefix
 * `ext_<gameType>_` and treat the rest as the invite ID.
 *
 * When `gameType` is provided the prefix is computed directly.
 * When omitted we try every entry in `KNOWN_EXT_GAME_TYPES` (longest first).
 *
 * @param firestoreGameId - e.g. `ext_battleship_uinv_mm2myqz0_ijltf8`
 * @param gameType        - optional, e.g. `"battleship"`
 * @returns The full invite ID, or `null` if the format doesn't match
 */
export function extractInviteIdFromExtGameId(
  firestoreGameId: string,
  gameType?: string,
): string | null {
  if (!firestoreGameId || !firestoreGameId.startsWith("ext_")) return null;

  // ── When caller provides the gameType, strip the exact prefix ──────────
  if (gameType) {
    const prefix = `ext_${gameType}_`;
    if (
      firestoreGameId.startsWith(prefix) &&
      firestoreGameId.length > prefix.length
    ) {
      return firestoreGameId.slice(prefix.length);
    }
    log.warn(
      `[extractInviteIdFromExtGameId] prefix mismatch: expected "${prefix}..." but got "${firestoreGameId}"`,
    );
    return null;
  }

  // ── No gameType provided — try known types (longest prefix first) ──────
  for (const knownType of KNOWN_EXT_GAME_TYPES) {
    const prefix = `ext_${knownType}_`;
    if (
      firestoreGameId.startsWith(prefix) &&
      firestoreGameId.length > prefix.length
    ) {
      return firestoreGameId.slice(prefix.length);
    }
  }

  log.warn(
    `[extractInviteIdFromExtGameId] cannot parse inviteId — unknown game type in "${firestoreGameId}"`,
  );
  return null;
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

    // Fallback: parse inviteId from ext_<gameType>_<inviteId> format.
    // External Colyseus games have no TurnBasedGames doc, so auto-discovery
    // above will miss them. The inviteId is embedded in the firestoreGameId.
    if (!inviteId) {
      const parsed = extractInviteIdFromExtGameId(firestoreGameId);
      if (parsed) {
        inviteId = parsed;
        log.info(
          `[Persistence] Extracted inviteId from ext_ format: ${inviteId}`,
        );
      }
    }

    // Delete RealtimeGameSessions record (if exists)
    const rtRef = db.collection("RealtimeGameSessions").doc(firestoreGameId);
    const rtDoc = await rtRef.get();
    if (rtDoc.exists) {
      batch.delete(rtRef);
    }

    // Mark the associated invite as completed + hidden so it disappears
    // from chat immediately (Phase 1 hardening).
    if (inviteId) {
      const inviteRef = db.collection("GameInvites").doc(inviteId);
      const inviteDoc = await inviteRef.get();
      if (inviteDoc.exists) {
        const inviteData = inviteDoc.data() || {};
        const now = Date.now();
        const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
        batch.update(inviteRef, {
          status: "completed",
          completedAt: now,
          resolvedAt: now,
          resolvedBy: "room",
          chatVisibility: "hidden",
          chatHiddenAt: now,
          chatHiddenInConversationIds: inviteData.conversationId
            ? [inviteData.conversationId]
            : [],
          deleteAt: now + SIX_HOURS_MS,
          updatedAt: now,
        });
      } else {
        // Invite doc not found — likely a truncated/wrong inviteId
        log.warn(
          `[deleteGameAndInvite] INVITE_DOC_MISSING — GameInvites/${inviteId} does not exist. ` +
            `firestoreGameId=${firestoreGameId}. Invite may have been truncated from ext_ parsing.`,
        );
      }
    }

    await batch.commit();
    const trace = createInviteTrace({
      inviteId,
      firestoreGameId,
      role: "system",
    });
    trace.info("INVITE.DELETE_AND_FINALIZE.OK", {
      deletedGame: firestoreGameId,
      inviteFinalized: !!inviteId,
    });
  } catch (error) {
    const trace = createInviteTrace({
      inviteId,
      firestoreGameId,
      role: "system",
    });
    trace.error("INVITE.DELETE_AND_FINALIZE.FAIL", error);
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

// =============================================================================
// V3 Session Bridge
// =============================================================================

/**
 * Outcome types for v3 session resolution.
 * Must match the `SessionResolution.outcome` type in sessionsV3.ts.
 */
type V3Outcome = "win" | "draw" | "forfeit" | "timeout" | "error";

/** Terminal phases that should not be overwritten. */
const V3_TERMINAL_PHASES = new Set([
  "resolved",
  "abandoned",
  "expired",
  "cancelled",
]);

/**
 * Link a Colyseus room to a v3 GameSession by writing the
 * `colyseusRoomId` back to the session document.
 *
 * Called from room `onCreate` when `options.v3SessionId` is present.
 *
 * @param v3SessionId - The v3 GameSession document ID
 * @param colyseusRoomId - The Colyseus room ID to record
 */
export async function linkColyseusRoom(
  v3SessionId: string,
  colyseusRoomId: string,
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  try {
    const ref = db.collection("GameSessions").doc(v3SessionId);
    await ref.update({
      colyseusRoomId,
      updatedAt: Date.now(),
    });
    log.info(
      `[V3Bridge] Linked room ${colyseusRoomId} → session ${v3SessionId}`,
    );
  } catch (error) {
    log.error("[V3Bridge] linkColyseusRoom failed:", error);
  }
}

/**
 * Resolve a v3 GameSession when a Colyseus game finishes.
 *
 * This mirrors the `resolveSessionV3` Cloud Function callable but
 * runs directly via admin SDK from the Colyseus server, avoiding
 * an extra network hop.
 *
 * Behaviour:
 *   - If no `v3SessionId` was provided, returns silently (v2 flow).
 *   - If the session is already in a terminal phase, returns (idempotent).
 *   - Transitions to "resolved" and writes resolution data.
 *
 * @param v3SessionId - The v3 GameSession document ID (may be undefined)
 * @param outcome - The game result: win, draw, forfeit, timeout, or error
 * @param opts - Optional winner/scores/firestoreGameId
 */
export async function resolveV3Session(
  v3SessionId: string | undefined,
  outcome: V3Outcome,
  opts?: {
    winnerUid?: string;
    scores?: Record<string, number>;
    firestoreGameId?: string;
    turnCount?: number;
    movesPerPlayer?: Record<string, number>;
    gameDurationMs?: number;
  },
): Promise<void> {
  if (!v3SessionId) return; // v2 flow — nothing to do

  const db = getFirestoreDb();
  if (!db) return;

  try {
    const ref = db.collection("GameSessions").doc(v3SessionId);

    // ── Transactional read-then-write (prevents TOCTOU race D4-1) ────
    const txResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        log.warn(`[V3Bridge] Session ${v3SessionId} not found — skipping`);
        return {
          written: false,
          sourceInviteId: undefined as string | undefined,
        };
      }

      const session = snap.data() as Record<string, any>;

      // Already terminal — idempotent
      if (V3_TERMINAL_PHASES.has(session.phase)) {
        log.info(
          `[V3Bridge] Session ${v3SessionId} already ${session.phase} — skipping`,
        );
        return { written: false, sourceInviteId: session.sourceInviteId };
      }

      const now = Date.now();

      // Update each participant's status
      const updatedParticipants = (session.participants ?? []).map(
        (p: Record<string, any>) => {
          if (p.status === "playing" || p.status === "joined") {
            const isWinner = opts?.winnerUid
              ? p.uid === opts.winnerUid
              : undefined;
            const score = opts?.scores?.[p.uid];
            return {
              ...p,
              status: "finished",
              ...(isWinner !== undefined ? { isWinner } : {}),
              ...(score !== undefined ? { score } : {}),
            };
          }
          return p;
        },
      );

      const resolution: Record<string, any> = {
        outcome,
        resolvedAt: now,
        resolvedBy: "colyseus",
      };
      if (opts?.winnerUid) resolution.winnerUid = opts.winnerUid;
      if (opts?.scores) resolution.scores = opts.scores;
      if (opts?.firestoreGameId)
        resolution.firestoreGameId = opts.firestoreGameId;
      if (session.sourceInviteId)
        resolution.sourceInviteId = session.sourceInviteId;
      if (opts?.turnCount !== undefined) resolution.turnCount = opts.turnCount;
      if (opts?.movesPerPlayer) resolution.movesPerPlayer = opts.movesPerPlayer;
      if (opts?.gameDurationMs !== undefined)
        resolution.gameDurationMs = opts.gameDurationMs;

      tx.update(ref, {
        phase: "resolved",
        participants: updatedParticipants,
        participantUids: updatedParticipants
          .filter((p: Record<string, any>) => p.status !== "left")
          .map((p: Record<string, any>) => p.uid),
        resolution,
        updatedAt: now,
      });

      return { written: true, sourceInviteId: session.sourceInviteId };
    });

    log.info(
      `[V3Bridge] Session ${v3SessionId} resolved: outcome=${outcome}, winner=${opts?.winnerUid ?? "none"}`,
    );

    // ── Trigger reward processing immediately ─────────────────────────
    // Previously rewards depended entirely on the watchdog (15-min cycle).
    // Now we call the resolveSessionV3 Cloud Function directly so rewards
    // are processed within seconds. Watchdog remains as safety net.
    try {
      const { getFunctions } = await import("firebase-admin/functions");
      const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
      const functionUrl = projectId
        ? `https://us-central1-${projectId}.cloudfunctions.net/resolveSessionV3`
        : null;

      if (functionUrl) {
        await fetch(functionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              sessionId: v3SessionId,
              outcome,
              winnerUid: opts?.winnerUid,
              scores: opts?.scores,
              firestoreGameId: opts?.firestoreGameId,
            },
          }),
          signal: AbortSignal.timeout(10000), // 10s timeout
        }).catch((fetchErr: Error) => {
          log.warn(
            `[V3Bridge] resolveSessionV3 HTTP call failed (watchdog will retry): ${fetchErr.message}`,
          );
        });
        log.info(`[V3Bridge] Triggered resolveSessionV3 for ${v3SessionId}`);
      }
    } catch (triggerErr) {
      // Non-fatal — watchdog Pass 4 will catch unprocessed rewards
      log.warn(
        `[V3Bridge] Failed to trigger resolveSessionV3: ${triggerErr instanceof Error ? triggerErr.message : String(triggerErr)}`,
      );
    }

    // ── Also finalize the linked v2 invite (belt-and-suspenders) ──────
    // The primary finalization path is deleteGameAndInvite, but if this
    // room uses v3 sessions the invite may not get finalized otherwise.
    // This is idempotent: if the invite is already terminal, the update
    // only self-heals missing fields.
    const sourceInviteId = txResult.sourceInviteId;
    if (sourceInviteId && db) {
      try {
        const inviteRef = db.collection("GameInvites").doc(sourceInviteId);
        const inviteSnap = await inviteRef.get();
        if (inviteSnap.exists) {
          const inv = inviteSnap.data() as Record<string, any>;
          const TERMINAL = new Set([
            "completed",
            "declined",
            "expired",
            "cancelled",
          ]);
          const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
          const now = Date.now();
          const patch: Record<string, any> = {};

          if (!TERMINAL.has(inv.status)) {
            patch.status = "completed";
            patch.completedAt = now;
          }
          if (inv.chatVisibility !== "hidden") {
            patch.chatVisibility = "hidden";
            patch.chatHiddenAt = now;
          }
          if (!inv.resolvedAt) patch.resolvedAt = now;
          if (!inv.resolvedBy) patch.resolvedBy = "room";
          if (!inv.deleteAt) patch.deleteAt = now + SIX_HOURS_MS;
          if (!inv.resolutionType) {
            patch.resolutionType = opts?.winnerUid
              ? "win"
              : outcome === "draw"
                ? "draw"
                : "disconnect";
          }
          if (opts?.winnerUid && !inv.winnerId) patch.winnerId = opts.winnerUid;
          if (
            (!inv.chatHiddenInConversationIds ||
              inv.chatHiddenInConversationIds.length === 0) &&
            inv.conversationId
          ) {
            patch.chatHiddenInConversationIds = [inv.conversationId];
          }

          if (Object.keys(patch).length > 0) {
            patch.updatedAt = now;
            await inviteRef.update(patch);
            log.info(
              `[V3Bridge] Finalized linked invite ${sourceInviteId} for session ${v3SessionId}`,
            );
          }
        }
      } catch (invErr) {
        // Non-fatal — the watchdog or Cloud Function will catch it
        log.warn(
          `[V3Bridge] Failed to finalize linked invite ${sourceInviteId}:`,
          invErr,
        );
      }
    }
  } catch (error) {
    // Non-fatal — the v2 flow handles persistence;
    // v3 resolution will be picked up by the watchdog if this fails.
    log.error("[V3Bridge] resolveV3Session failed:", error);
  }
}

/**
 * Abandon a v3 GameSession when a room is disposed while still in progress
 * (save-and-suspend path). The session moves to "abandoned" so the watchdog
 * can clean it up later.
 *
 * @param v3SessionId - The v3 GameSession document ID (may be undefined)
 */
export async function abandonV3Session(
  v3SessionId: string | undefined,
): Promise<void> {
  if (!v3SessionId) return;

  const db = getFirestoreDb();
  if (!db) return;

  try {
    const ref = db.collection("GameSessions").doc(v3SessionId);
    const snap = await ref.get();

    if (!snap.exists) return;

    const session = snap.data() as Record<string, any>;
    if (V3_TERMINAL_PHASES.has(session.phase)) return;

    await ref.update({
      phase: "abandoned",
      updatedAt: Date.now(),
    });

    log.info(`[V3Bridge] Session ${v3SessionId} abandoned (game suspended)`);
  } catch (error) {
    log.error("[V3Bridge] abandonV3Session failed:", error);
  }
}
