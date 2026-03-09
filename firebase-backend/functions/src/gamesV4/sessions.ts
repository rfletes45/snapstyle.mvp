/**
 * Games V4 — Session Callables (Turn Submission + Resign)
 *
 * Callables:
 * - submitTurnMoveV4: submit a turn move (turn-based games)
 * - resignSessionV4: resign from an active session
 *
 * Both funnel terminal conditions through resolveSessionV4Internal.
 *
 * @module gamesV4/sessions
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { hasAdapter, runMove } from "./adapters";
import { assertAuth, generateTraceId, getDb, getUserProfile } from "./helpers";
import { notifyTurn } from "./notifications";
import { resolveSessionV4Internal } from "./resolve";
import type { GameSessionV4, MoveDoc } from "./types";
import { COLLECTIONS } from "./types";
import {
  COOLDOWNS,
  enforceCooldown,
  sanitisePayload,
  type SanitiseOptions,
} from "./validation";

// =============================================================================
// Callable: submitTurnMoveV4
// =============================================================================

export const submitTurnMoveV4 = functions.https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const { sessionId, movePayload, isTerminal, winnerIds } = data as {
      sessionId: string;
      movePayload: Record<string, unknown>;
      /** Client hint that the game is over (adapter authoritative in STOP 4). */
      isTerminal?: boolean;
      /** Winner UIDs if terminal. */
      winnerIds?: string[];
    };

    if (!sessionId || typeof sessionId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "sessionId is required.",
      );
    }
    if (!movePayload || typeof movePayload !== "object") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "movePayload is required.",
      );
    }

    const traceId = generateTraceId();
    console.log(
      `[gamesV4] submitTurnMoveV4 called by ${uid} for session ${sessionId} (trace: ${traceId})`,
    );

    try {
      // Sanitise move payload to prevent payload bombs.
      // Game replay data (e.g. brick breaker input samples) can contain
      // thousands of entries, so use higher limits than the defaults.
      const GAME_MOVE_LIMITS: SanitiseOptions = {
        maxArrayLength: 30_000,
        maxTotalKeys: 100_000,
      };
      const safeMovePayload = sanitisePayload(
        movePayload,
        GAME_MOVE_LIMITS,
      ) as Record<string, unknown>;

      const db = getDb();

      // Rate-limit: 500ms between moves
      await enforceCooldown(db, uid, "submitMoveV4", COOLDOWNS.SUBMIT_MOVE);
      const sessionRef = db
        .collection(COLLECTIONS.GAME_SESSIONS)
        .doc(sessionId);
      const movesCol = sessionRef.collection(COLLECTIONS.MOVES);
      const publicStateRef = sessionRef
        .collection(COLLECTIONS.PUBLIC_STATE)
        .doc("state");
      const privateStateCol = sessionRef.collection(COLLECTIONS.PRIVATE_STATE);

      // ─── Transaction: validate + write move + advance turn ───────────
      const result = await db.runTransaction(async (tx) => {
        const sessionSnap = await tx.get(sessionRef);
        if (!sessionSnap.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "Session not found.",
          );
        }

        const session = sessionSnap.data() as GameSessionV4;

        // Must be active
        if (session.status !== "active") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            `Session is not active (current: ${session.status}).`,
          );
        }

        // Must be a participant
        if (!session.participantUids.includes(uid)) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "You are not a participant in this session.",
          );
        }

        // For turn-based: must be caller's turn
        console.log(
          `[gamesV4][DEBUG] Turn guard: uid=${uid}, currentTurnPlayerId=${session.currentTurnPlayerId}, currentTurnIndex=${session.currentTurnIndex}, turnOrder=${JSON.stringify(session.turnOrder)}, runtimeType=${session.runtimeType}, action=${(safeMovePayload as Record<string, unknown>).action}`,
        );
        if (session.runtimeType === "turnBased") {
          if (session.currentTurnPlayerId !== uid) {
            console.warn(
              `[gamesV4][DEBUG] BLOCKED: ${uid} tried to move but it's ${session.currentTurnPlayerId}'s turn`,
            );
            throw new functions.https.HttpsError(
              "failed-precondition",
              "It is not your turn.",
            );
          }
        }

        // ── Adapter-driven validation (STOP 4) ──────────────────────────
        let adapterTerminal: { type: string; winnerIds?: string[] } | undefined;
        let adapterTurnAdvance = true;
        let adapterNextPublicState: Record<string, unknown> | null = null;
        let adapterNextPrivateState: Record<
          string,
          Record<string, unknown>
        > | null = null;
        let adapterScoreDelta: Array<{ uid: string; delta: number }> = [];
        let adapterNextTurnPlayerId: string | null = null;

        if (hasAdapter(session.gameId)) {
          // Read current public state
          const pubSnap = await tx.get(publicStateRef);
          const currentPublicState = pubSnap.exists
            ? (pubSnap.data() as Record<string, unknown>)
            : {};

          // Read per-player private state docs so adapters can resolve
          // shots against ship layouts, etc.
          const privateStateByPlayer: Record<
            string,
            Record<string, unknown>
          > = {};
          for (const pUid of session.participantUids) {
            const privSnap = await tx.get(privateStateCol.doc(pUid));
            if (privSnap.exists) {
              privateStateByPlayer[pUid] = privSnap.data() as Record<
                string,
                unknown
              >;
            }
          }

          const moveResult = runMove({
            gameId: session.gameId,
            publicState: currentPublicState,
            privateStateByPlayer,
            movePayload: safeMovePayload,
            uid,
            turnOrder: session.turnOrder,
            currentTurnIndex: session.currentTurnIndex,
            settings: session.settings,
          });

          if (!moveResult.valid) {
            throw new functions.https.HttpsError(
              "invalid-argument",
              moveResult.error ?? "Invalid move.",
            );
          }

          adapterTerminal = moveResult.terminal;
          adapterTurnAdvance = moveResult.turnAdvance;
          adapterNextPublicState = moveResult.nextPublicState;
          adapterNextPrivateState = moveResult.nextPrivateState;
          adapterScoreDelta = moveResult.scoreDelta;

          // If adapter specifies the next turn player (e.g., skip, reverse),
          // use that instead of simple round-robin advancement.
          if (moveResult.nextTurnPlayerId) {
            adapterNextTurnPlayerId = moveResult.nextTurnPlayerId;
          }

          console.log(
            `[gamesV4][DEBUG] Adapter result: valid=${moveResult.valid}, turnAdvance=${adapterTurnAdvance}, terminal=${JSON.stringify(adapterTerminal)}, nextPublicState.phase=${adapterNextPublicState?.phase}, nextPublicState.currentTurnUid=${adapterNextPublicState?.currentTurnUid}, nextPublicState.moveCount=${adapterNextPublicState?.moveCount}, adapterNextTurnPlayerId=${adapterNextTurnPlayerId}`,
          );
        }

        // Determine terminal from adapter or client hint (fallback)
        const effectiveTerminal = adapterTerminal
          ? true
          : (isTerminal ?? false);
        const effectiveWinnerIds =
          adapterTerminal?.winnerIds ?? (isTerminal ? (winnerIds ?? []) : []);

        // Create move document
        const moveRef = movesCol.doc();
        const now = admin.firestore.Timestamp.now();

        // Advance turn (round-robin for turn-based, or adapter-specified)
        let nextTurnIndex = session.currentTurnIndex;
        let nextTurnPlayerId = session.currentTurnPlayerId;

        if (session.runtimeType === "turnBased" && !effectiveTerminal) {
          if (adapterNextTurnPlayerId) {
            // Adapter specifies exactly who goes next (e.g., skip, reverse, draws)
            nextTurnPlayerId = adapterNextTurnPlayerId;
            nextTurnIndex = session.turnOrder.indexOf(adapterNextTurnPlayerId);
            if (nextTurnIndex === -1) nextTurnIndex = session.currentTurnIndex;
          } else if (adapterTurnAdvance) {
            // Default round-robin
            nextTurnIndex =
              (session.currentTurnIndex + 1) % session.turnOrder.length;
            nextTurnPlayerId = session.turnOrder[nextTurnIndex];
          }
        }

        console.log(
          `[gamesV4][DEBUG] Turn advance: prevIndex=${session.currentTurnIndex}, prevPlayerId=${session.currentTurnPlayerId}, nextIndex=${nextTurnIndex}, nextPlayerId=${nextTurnPlayerId}, adapterTurnAdvance=${adapterTurnAdvance}, effectiveTerminal=${effectiveTerminal}`,
        );

        const move: MoveDoc = {
          uid,
          movePayload: safeMovePayload,
          createdAt: now,
          appliedAt: now,
          status: "committed",
          serverVersion: session.integrity.version + 1,
          resultingTurnPlayerId: effectiveTerminal ? null : nextTurnPlayerId,
          scoreDeltaSummary:
            adapterScoreDelta.length > 0
              ? adapterScoreDelta.map((d) => {
                  const slot = session.players.find((p) => p.uid === d.uid);
                  return {
                    uid: d.uid,
                    displayName: slot?.displayName ?? d.uid,
                    score: d.delta,
                  };
                })
              : null,
        };

        tx.set(moveRef, move);

        // Write updated public state if adapter produced one
        if (adapterNextPublicState) {
          tx.set(publicStateRef, adapterNextPublicState);
        }

        // Write updated per-player private state if adapter produced any
        // (e.g. ship placements from place_fleet, damage from fire)
        if (adapterNextPrivateState) {
          for (const [pUid, privState] of Object.entries(
            adapterNextPrivateState,
          )) {
            tx.set(privateStateCol.doc(pUid), privState, { merge: true });
          }
        }

        // Update session state
        const sessionUpdate: Record<string, unknown> = {
          currentTurnIndex: effectiveTerminal
            ? session.currentTurnIndex
            : nextTurnIndex,
          currentTurnPlayerId: effectiveTerminal ? null : nextTurnPlayerId,
          "integrity.version": session.integrity.version + 1,
        };

        // Update scoreboardSummary with score deltas so the resolve fallback
        // (buildDefaultScoreboard) has the right scores. Without this, solo
        // game scores stay at the initial value of 0.
        if (adapterScoreDelta.length > 0) {
          const updatedSummary = (session.scoreboardSummary ?? []).map(
            (entry) => {
              const delta = adapterScoreDelta.find((d) => d.uid === entry.uid);
              if (delta) {
                return { ...entry, score: delta.delta };
              }
              return entry;
            },
          );
          sessionUpdate.scoreboardSummary = updatedSummary;
        }

        // Update invite summary (skip for solo sessions with no invite)
        if (session.inviteId) {
          const inviteRef = db
            .collection(COLLECTIONS.GAME_INVITES)
            .doc(session.inviteId);
          tx.update(inviteRef, {
            "summary.lastMoveAt": now,
            "summary.lastActorId": uid,
            "summary.turnPlayerId": effectiveTerminal ? null : nextTurnPlayerId,
            updatedAt: now,
          });
        }

        tx.update(sessionRef, sessionUpdate);

        return {
          moveId: moveRef.id,
          nextTurnPlayerId: effectiveTerminal ? null : nextTurnPlayerId,
          session,
          effectiveTerminal,
          effectiveWinnerIds,
        };
      });

      // ─── Post-transaction: terminal check ─────────────────────────────
      if (result.effectiveTerminal) {
        await resolveSessionV4Internal({
          sessionId,
          resolutionType: result.effectiveWinnerIds.length > 0 ? "win" : "draw",
          winnerIds: result.effectiveWinnerIds,
          resolverUid: uid,
        });
      } else if (
        result.nextTurnPlayerId &&
        result.session.runtimeType === "turnBased"
      ) {
        // Notify next turn player — only for turn-based games.
        // Solo and realtime sessions must NOT send turn notifications
        // (the same player is always the "turn player" and seeing
        // "Your turn!" after every move is wrong).
        try {
          const profile = await getUserProfile(uid);
          await notifyTurn(
            result.session,
            result.nextTurnPlayerId,
            profile?.displayName ?? "Opponent",
          );
        } catch (err) {
          console.error("[gamesV4] Failed to send turn notification:", err);
        }
      }

      console.log(
        `[gamesV4] Move ${result.moveId} submitted by ${uid} in session ${sessionId}` +
          (result.effectiveTerminal ? " (TERMINAL)" : ""),
      );

      return {
        moveId: result.moveId,
        committed: true,
        isTerminal: result.effectiveTerminal,
      };
    } catch (err) {
      // Re-throw typed HttpsErrors as-is
      if (err instanceof functions.https.HttpsError) throw err;

      console.error(
        `[gamesV4] submitTurnMoveV4 UNEXPECTED ERROR (trace: ${traceId}):`,
        err,
      );
      throw new functions.https.HttpsError(
        "internal",
        "Unexpected server error. Please try again.",
        { traceId },
      );
    }
  },
);

// =============================================================================
// Callable: resignSessionV4
// =============================================================================

export const resignSessionV4 = functions.https.onCall(async (data, context) => {
  const uid = assertAuth(context);
  const { sessionId } = data as { sessionId: string };

  if (!sessionId || typeof sessionId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "sessionId is required.",
    );
  }

  const db = getDb();
  const sessionRef = db.collection(COLLECTIONS.GAME_SESSIONS).doc(sessionId);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Session not found.");
  }

  const session = sessionSnap.data() as GameSessionV4;

  // Must be active
  if (session.status !== "active") {
    // Idempotent: if already resolved, just return success
    if (
      session.status === "resolved" ||
      session.status === "abandoned" ||
      session.status === "expired"
    ) {
      return { success: true, alreadyResolved: true };
    }
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Cannot resign from session in status '${session.status}'.`,
    );
  }

  // Must be a participant
  if (!session.participantUids.includes(uid)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You are not a participant in this session.",
    );
  }

  // Determine winner(s) — everyone except the resigner
  const winnerIds = session.participantUids.filter((p) => p !== uid);

  // Route through THE CHOKEPOINT
  await resolveSessionV4Internal({
    sessionId,
    resolutionType: "resign",
    winnerIds,
    reason: `Player ${uid} resigned.`,
    resolverUid: uid,
  });

  console.log(`[gamesV4] Player ${uid} resigned from session ${sessionId}`);

  return { success: true, alreadyResolved: false };
});

// =============================================================================
// Internal: resolveRealtimeSession (called by Colyseus persistence bridge)
// =============================================================================

/**
 * Resolve a realtime session from the Colyseus persistence bridge.
 * This is NOT a callable — it's exported for use by the Colyseus bridge.
 */
export async function resolveRealtimeSessionV4(
  sessionId: string,
  resolutionType: "win" | "draw" | "disconnect" | "timeout" | "error",
  winnerIds: string[],
  scoreboard?: Array<{
    uid: string;
    displayName: string;
    score: number;
    placement: number;
    stats: Record<string, unknown>;
  }>,
): Promise<void> {
  // If a pre-built scoreboard is provided, enrich with profilePictureUrl from
  // the session's player slots so the result doc carries avatar data.
  let enrichedScoreboard = scoreboard?.map((e) => ({
    ...e,
    profilePictureUrl: null as string | null,
  }));

  if (enrichedScoreboard) {
    try {
      const db = getDb();
      const sessionSnap = await db
        .collection(COLLECTIONS.GAME_SESSIONS)
        .doc(sessionId)
        .get();
      if (sessionSnap.exists) {
        const sessionData = sessionSnap.data() as GameSessionV4;
        const playerMap = new Map(
          (sessionData.players ?? []).map((p) => [p.uid, p]),
        );
        enrichedScoreboard = enrichedScoreboard.map((e) => ({
          ...e,
          profilePictureUrl: playerMap.get(e.uid)?.profilePictureUrl ?? null,
        }));
      }
    } catch (err) {
      console.warn(
        "[gamesV4] Failed to enrich realtime scoreboard with profile pics:",
        err,
      );
    }
  }

  await resolveSessionV4Internal({
    sessionId,
    resolutionType,
    winnerIds,
    scoreboard: enrichedScoreboard,
  });
}
