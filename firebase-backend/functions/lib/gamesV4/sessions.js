"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resignSessionV4 = exports.submitTurnMoveV4 = void 0;
exports.resolveRealtimeSessionV4 = resolveRealtimeSessionV4;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const adapters_1 = require("./adapters");
const helpers_1 = require("./helpers");
const notifications_1 = require("./notifications");
const perfTrace_1 = require("./perfTrace");
const resolve_1 = require("./resolve");
const types_1 = require("./types");
const validation_1 = require("./validation");
// =============================================================================
// Callable: submitTurnMoveV4
// =============================================================================
exports.submitTurnMoveV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { sessionId, movePayload, isTerminal, winnerIds } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "sessionId is required.");
    }
    if (!movePayload || typeof movePayload !== "object") {
        throw new functions.https.HttpsError("invalid-argument", "movePayload is required.");
    }
    const traceId = (0, helpers_1.generateTraceId)();
    console.log(`[gamesV4] submitTurnMoveV4 called by ${uid} for session ${sessionId} (trace: ${traceId})`);
    try {
        // Sanitise move payload to prevent payload bombs.
        // Game replay data (e.g. brick breaker input samples) can contain
        // thousands of entries, so use higher limits than the defaults.
        const GAME_MOVE_LIMITS = {
            maxArrayLength: 30_000,
            maxTotalKeys: 100_000,
        };
        const safeMovePayload = (0, validation_1.sanitisePayload)(movePayload, GAME_MOVE_LIMITS);
        const db = (0, helpers_1.getDb)();
        const trace = (0, perfTrace_1.startServerTrace)("submitTurnMoveV4");
        // Rate-limit: 500ms between moves
        await (0, validation_1.enforceCooldown)(db, uid, "submitMoveV4", validation_1.COOLDOWNS.SUBMIT_MOVE);
        trace.mark("cooldown_done");
        const sessionRef = db
            .collection(types_1.COLLECTIONS.GAME_SESSIONS)
            .doc(sessionId);
        const movesCol = sessionRef.collection(types_1.COLLECTIONS.MOVES);
        const publicStateRef = sessionRef
            .collection(types_1.COLLECTIONS.PUBLIC_STATE)
            .doc("state");
        const privateStateCol = sessionRef.collection(types_1.COLLECTIONS.PRIVATE_STATE);
        // ─── Transaction: validate + write move + advance turn ───────────
        trace.mark("tx_start");
        const result = await db.runTransaction(async (tx) => {
            const sessionSnap = await tx.get(sessionRef);
            if (!sessionSnap.exists) {
                throw new functions.https.HttpsError("not-found", "Session not found.");
            }
            const session = sessionSnap.data();
            // Must be active
            if (session.status !== "active") {
                throw new functions.https.HttpsError("failed-precondition", `Session is not active (current: ${session.status}).`);
            }
            // Must be a participant
            if (!session.participantUids.includes(uid)) {
                throw new functions.https.HttpsError("permission-denied", "You are not a participant in this session.");
            }
            // For turn-based: must be caller's turn
            console.log(`[gamesV4][DEBUG] Turn guard: uid=${uid}, currentTurnPlayerId=${session.currentTurnPlayerId}, currentTurnIndex=${session.currentTurnIndex}, turnOrder=${JSON.stringify(session.turnOrder)}, runtimeType=${session.runtimeType}, action=${safeMovePayload.action}`);
            if (session.runtimeType === "turnBased") {
                if (session.currentTurnPlayerId !== uid) {
                    console.warn(`[gamesV4][DEBUG] BLOCKED: ${uid} tried to move but it's ${session.currentTurnPlayerId}'s turn`);
                    throw new functions.https.HttpsError("failed-precondition", "It is not your turn.");
                }
            }
            // ── Adapter-driven validation (STOP 4) ──────────────────────────
            let adapterTerminal;
            let adapterTurnAdvance = true;
            let adapterNextPublicState = null;
            let adapterNextPrivateState = null;
            let adapterScoreDelta = [];
            let adapterNextTurnPlayerId = null;
            if ((0, adapters_1.hasAdapter)(session.gameId)) {
                // Read current public state
                const pubSnap = await tx.get(publicStateRef);
                const currentPublicState = pubSnap.exists
                    ? pubSnap.data()
                    : {};
                // Read per-player private state docs so adapters can resolve
                // shots against ship layouts, etc.
                // PERF: Batch all private state reads in parallel within the
                // transaction to avoid sequential round-trips.
                const privateStateByPlayer = {};
                const privSnapPromises = session.participantUids.map((pUid) => tx.get(privateStateCol.doc(pUid)).then((snap) => ({ pUid, snap })));
                const privSnapResults = await Promise.all(privSnapPromises);
                for (const { pUid, snap } of privSnapResults) {
                    if (snap.exists) {
                        privateStateByPlayer[pUid] = snap.data();
                    }
                }
                const moveResult = (0, adapters_1.runMove)({
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
                    throw new functions.https.HttpsError("invalid-argument", moveResult.error ?? "Invalid move.");
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
                console.log(`[gamesV4][DEBUG] Adapter result: valid=${moveResult.valid}, turnAdvance=${adapterTurnAdvance}, terminal=${JSON.stringify(adapterTerminal)}, nextPublicState.phase=${adapterNextPublicState?.phase}, nextPublicState.currentTurnUid=${adapterNextPublicState?.currentTurnUid}, nextPublicState.moveCount=${adapterNextPublicState?.moveCount}, adapterNextTurnPlayerId=${adapterNextTurnPlayerId}`);
            }
            // Determine terminal from adapter or client hint (fallback)
            const effectiveTerminal = adapterTerminal
                ? true
                : (isTerminal ?? false);
            const effectiveWinnerIds = adapterTerminal?.winnerIds ?? (isTerminal ? (winnerIds ?? []) : []);
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
                    if (nextTurnIndex === -1)
                        nextTurnIndex = session.currentTurnIndex;
                }
                else if (adapterTurnAdvance) {
                    // Default round-robin
                    nextTurnIndex =
                        (session.currentTurnIndex + 1) % session.turnOrder.length;
                    nextTurnPlayerId = session.turnOrder[nextTurnIndex];
                }
            }
            console.log(`[gamesV4][DEBUG] Turn advance: prevIndex=${session.currentTurnIndex}, prevPlayerId=${session.currentTurnPlayerId}, nextIndex=${nextTurnIndex}, nextPlayerId=${nextTurnPlayerId}, adapterTurnAdvance=${adapterTurnAdvance}, effectiveTerminal=${effectiveTerminal}`);
            const move = {
                uid,
                movePayload: safeMovePayload,
                createdAt: now,
                appliedAt: now,
                status: "committed",
                serverVersion: session.integrity.version + 1,
                resultingTurnPlayerId: effectiveTerminal ? null : nextTurnPlayerId,
                scoreDeltaSummary: adapterScoreDelta.length > 0
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
                for (const [pUid, privState] of Object.entries(adapterNextPrivateState)) {
                    tx.set(privateStateCol.doc(pUid), privState, { merge: true });
                }
            }
            // Update session state
            const sessionUpdate = {
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
                const updatedSummary = (session.scoreboardSummary ?? []).map((entry) => {
                    const delta = adapterScoreDelta.find((d) => d.uid === entry.uid);
                    if (delta) {
                        return { ...entry, score: delta.delta };
                    }
                    return entry;
                });
                sessionUpdate.scoreboardSummary = updatedSummary;
            }
            // PERF: Invite summary update moved out of the transaction to
            // narrow the critical transaction scope. The invite summary is a
            // cosmetic display field (shows "last move by X" in the pinned chip),
            // not an authority field. Safe to update outside the transaction.
            tx.update(sessionRef, sessionUpdate);
            return {
                moveId: moveRef.id,
                nextTurnPlayerId: effectiveTerminal ? null : nextTurnPlayerId,
                session,
                effectiveTerminal,
                effectiveWinnerIds,
                inviteId: session.inviteId,
            };
        });
        trace.mark("tx_committed");
        // ─── Post-transaction: fire-and-forget tail work ─────────────────
        // PERF: Invite summary update — cosmetic, outside transaction.
        if (result.inviteId) {
            db.collection(types_1.COLLECTIONS.GAME_INVITES)
                .doc(result.inviteId)
                .update({
                "summary.lastMoveAt": admin.firestore.Timestamp.now(),
                "summary.lastActorId": uid,
                "summary.turnPlayerId": result.effectiveTerminal
                    ? null
                    : result.nextTurnPlayerId,
                updatedAt: admin.firestore.Timestamp.now(),
            })
                .catch((err) => console.warn("[gamesV4] Failed to update invite summary:", err));
        }
        // PERF: Resolution and notifications are NOT awaited. The move
        // response returns immediately so the client gets sub-second
        // feedback. Resolution writes the result doc async; the client
        // detects terminal state via its session listener.
        if (result.effectiveTerminal) {
            // Fire resolution async — don't block the move response.
            // The session status is already being set to resolved inside
            // resolveSessionV4Internal's own transaction, and the client
            // detects terminal via its session snapshot listener.
            (0, resolve_1.resolveSessionV4Internal)({
                sessionId,
                resolutionType: result.effectiveWinnerIds.length > 0 ? "win" : "draw",
                winnerIds: result.effectiveWinnerIds,
                resolverUid: uid,
            }).catch((err) => console.error(`[gamesV4] Async resolution failed for session ${sessionId}:`, err));
        }
        else if (result.nextTurnPlayerId &&
            result.session.runtimeType === "turnBased") {
            // Notify next turn player async — don't block the move response.
            (0, helpers_1.getUserProfile)(uid)
                .then((profile) => (0, notifications_1.notifyTurn)(result.session, result.nextTurnPlayerId, profile?.displayName ?? "Opponent", result.session.integrity.version + 1))
                .catch((err) => console.error("[gamesV4] Failed to send turn notification:", err));
        }
        console.log(`[gamesV4] Move ${result.moveId} submitted by ${uid} in session ${sessionId}` +
            (result.effectiveTerminal ? " (TERMINAL)" : ""));
        trace.mark("end");
        trace.end();
        return {
            moveId: result.moveId,
            committed: true,
            isTerminal: result.effectiveTerminal,
        };
    }
    catch (err) {
        // Re-throw typed HttpsErrors as-is
        if (err instanceof functions.https.HttpsError)
            throw err;
        console.error(`[gamesV4] submitTurnMoveV4 UNEXPECTED ERROR (trace: ${traceId}):`, err);
        throw new functions.https.HttpsError("internal", "Unexpected server error. Please try again.", { traceId });
    }
});
// =============================================================================
// Callable: resignSessionV4
// =============================================================================
exports.resignSessionV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { sessionId } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "sessionId is required.");
    }
    const db = (0, helpers_1.getDb)();
    const sessionRef = db.collection(types_1.COLLECTIONS.GAME_SESSIONS).doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Session not found.");
    }
    const session = sessionSnap.data();
    // Must be active
    if (session.status !== "active") {
        // Idempotent: if already resolved, just return success
        if (session.status === "resolved" ||
            session.status === "abandoned" ||
            session.status === "expired") {
            return { success: true, alreadyResolved: true };
        }
        throw new functions.https.HttpsError("failed-precondition", `Cannot resign from session in status '${session.status}'.`);
    }
    // Must be a participant
    if (!session.participantUids.includes(uid)) {
        throw new functions.https.HttpsError("permission-denied", "You are not a participant in this session.");
    }
    // Determine winner(s) — everyone except the resigner
    const winnerIds = session.participantUids.filter((p) => p !== uid);
    // Route through THE CHOKEPOINT
    await (0, resolve_1.resolveSessionV4Internal)({
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
 *
 * @param sessionId - The session to resolve
 * @param resolutionType - How the session ended
 * @param winnerIds - UIDs of the winner(s)
 * @param scoreboard - Pre-built scoreboard entries
 * @param enrichment - Additional metadata from the generalized realtime framework (optional)
 */
async function resolveRealtimeSessionV4(sessionId, resolutionType, winnerIds, scoreboard, enrichment) {
    if (enrichment?.requestId) {
        console.log(`[gamesV4] Resolving realtime session ${sessionId} (requestId=${enrichment.requestId}, ` +
            `reason=${enrichment.reason ?? resolutionType}, durationMs=${enrichment.durationMs ?? "unknown"})`);
    }
    // If a pre-built scoreboard is provided, enrich with profilePictureUrl from
    // the session's player slots so the result doc carries avatar data.
    let enrichedScoreboard = scoreboard?.map((e) => ({
        ...e,
        profilePictureUrl: null,
    }));
    if (enrichedScoreboard) {
        try {
            const db = (0, helpers_1.getDb)();
            const sessionSnap = await db
                .collection(types_1.COLLECTIONS.GAME_SESSIONS)
                .doc(sessionId)
                .get();
            if (sessionSnap.exists) {
                const sessionData = sessionSnap.data();
                const playerMap = new Map((sessionData.players ?? []).map((p) => [p.uid, p]));
                enrichedScoreboard = enrichedScoreboard.map((e) => ({
                    ...e,
                    profilePictureUrl: playerMap.get(e.uid)?.profilePictureUrl ?? null,
                }));
            }
        }
        catch (err) {
            console.warn("[gamesV4] Failed to enrich realtime scoreboard with profile pics:", err);
        }
    }
    await (0, resolve_1.resolveSessionV4Internal)({
        sessionId,
        resolutionType,
        winnerIds,
        scoreboard: enrichedScoreboard,
    });
}
//# sourceMappingURL=sessions.js.map