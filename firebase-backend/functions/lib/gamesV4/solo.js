"use strict";
/**
 * Games V4 — Solo Session Callables
 *
 * Supports two solo modes:
 * - "standard" — current run-based behaviour (2048, Minesweeper, etc.)
 * - "persistent" — long-lived idle/incremental (no games currently use this)
 *
 * Persistent solo games:
 * - in-app shell exits attempt to suspend instead of resigning or resolving
 * - resume the same active session on re-entry
 * - support deterministic offline progression on resume
 * - finalize only via explicit archiveSoloSessionV4
 *
 * Callables:
 *   createSoloSessionV4
 *   resumeOrCreateSoloSessionV4
 *   restartSoloSessionV4
 *   suspendSoloSessionV4
 *   archiveSoloSessionV4  (NEW — persistent solo finalization)
 *
 * @module gamesV4/solo
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
exports.archiveSoloSessionV4 = exports.suspendSoloSessionV4 = exports.restartSoloSessionV4 = exports.resumeOrCreateSoloSessionV4 = exports.createSoloSessionV4 = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const adapters_1 = require("./adapters");
const helpers_1 = require("./helpers");
const resolve_1 = require("./resolve");
const types_1 = require("./types");
const validation_1 = require("./validation");
// Maximum offline time that can be claimed in a single resume (24 hours).
const MAX_OFFLINE_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * Look up the soloMode for a game from its adapter metadata.
 * Returns "standard" for all existing adapters that don't declare one.
 */
function getAdapterSoloMode(gameId) {
    try {
        const adapter = (0, adapters_1.requireAdapter)(gameId);
        // The adapter's supportsOfflineProgression field is the most reliable
        // indicator on the backend. For an explicit soloMode field, we'd need
        // a metadata registry mirroring the client constants — for now we
        // treat supportsOfflineProgression as the proxy for "persistent".
        return adapter.supportsOfflineProgression ? "persistent" : "standard";
    }
    catch {
        return "standard";
    }
}
// =============================================================================
// Callable: createSoloSessionV4
// =============================================================================
exports.createSoloSessionV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { gameId } = data;
    if (!gameId || typeof gameId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "gameId is required.");
    }
    const db = (0, helpers_1.getDb)();
    // Rate-limit: reuse START_SOLO cooldown
    await (0, validation_1.enforceCooldown)(db, uid, "startSoloV4", validation_1.COOLDOWNS.START_SOLO);
    // Verify the game has a server-side adapter
    if (!(0, adapters_1.hasAdapter)(gameId)) {
        throw new functions.https.HttpsError("failed-precondition", `"${gameId}" is not yet playable. Coming soon!`);
    }
    const adapter = (0, adapters_1.requireAdapter)(gameId);
    // Must be a solo game
    if (adapter.runtimeType !== "solo") {
        throw new functions.https.HttpsError("invalid-argument", `"${gameId}" is not a solo game. Use createGameInviteV4 instead.`);
    }
    // Generate traceId early for error reporting
    const traceId = (0, helpers_1.generateTraceId)();
    console.log(`[gamesV4] createSoloSessionV4 called by ${uid} for ${gameId} (trace: ${traceId})`);
    try {
        // Fetch creator profile for display data
        const profile = await (0, helpers_1.getUserProfile)(uid);
        const displayName = profile?.displayName ?? "Player";
        // Generate IDs
        const sessionRef = db.collection(types_1.COLLECTIONS.GAME_SESSIONS).doc();
        const sessionId = sessionRef.id;
        const now = admin.firestore.Timestamp.now();
        // Build player slot — omit optional fields to avoid undefined writes
        const player = {
            uid,
            slotIndex: 0,
            displayName,
            profilePictureUrl: profile?.profilePictureUrl ?? null,
        };
        // Create initial state from adapter
        const initResult = (0, adapters_1.createInitialState)(gameId, [{ uid, slotIndex: 0 }], {});
        // Build session document
        const session = {
            sessionId,
            inviteId: "", // No invite for solo games
            conversationId: "", // No conversation context
            conversationScope: "dm", // Required by type; unused for solo
            gameId: gameId,
            runtimeType: "solo",
            status: "active",
            hostId: uid,
            players: [player],
            spectatorsAllowed: false,
            spectateMode: "public_only",
            spectators: [],
            settings: {},
            turnOrder: [uid],
            currentTurnIndex: 0,
            currentTurnPlayerId: uid,
            scoreboardSummary: [{ uid, displayName, score: 0 }],
            createdAt: now,
            startedAt: now,
            resolvedAt: null,
            resolution: null,
            integrity: {
                version: 1,
                schemaVersion: 1,
                traceId,
            },
            rewardsProcessed: false,
            participantUids: [uid],
            spectatorUids: [],
        };
        // Write session + public state atomically
        const publicStateRef = sessionRef
            .collection(types_1.COLLECTIONS.PUBLIC_STATE)
            .doc("state");
        const batch = db.batch();
        batch.set(sessionRef, session);
        batch.set(publicStateRef, {
            ...initResult.publicState,
            _meta: {
                gameId,
                version: 1,
                updatedAt: now,
            },
        });
        // Write per-player private state if adapter produced any
        for (const [pUid, privState] of Object.entries(initResult.privateStateByPlayer)) {
            const privRef = sessionRef
                .collection(types_1.COLLECTIONS.PRIVATE_STATE)
                .doc(pUid);
            batch.set(privRef, privState);
        }
        await batch.commit();
        console.log(`[gamesV4] Solo session ${sessionId} created by ${uid} for ${gameId} (trace: ${traceId})`);
        return { sessionId };
    }
    catch (err) {
        // Re-throw typed HttpsErrors as-is
        if (err instanceof functions.https.HttpsError)
            throw err;
        // Unexpected error — log full details, return a safe message + traceId
        console.error(`[gamesV4] createSoloSessionV4 UNEXPECTED ERROR (trace: ${traceId}):`, err);
        throw new functions.https.HttpsError("internal", "Unexpected server error. Please try again.", { traceId });
    }
});
// =============================================================================
// Callable: resumeOrCreateSoloSessionV4
// =============================================================================
/**
 * Looks for an existing active (unresolved) solo session for the given
 * user + gameId.  If found, clears `soloSuspendedAt` (marks it as resumed)
 * and returns it.  Otherwise creates a brand-new solo session.
 *
 * This is the **primary entry point** for launching solo games from the hub.
 */
exports.resumeOrCreateSoloSessionV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { gameId } = data;
    if (!gameId || typeof gameId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "gameId is required.");
    }
    const db = (0, helpers_1.getDb)();
    // Check for an existing active solo session for this user + game.
    // Uses the existing composite index {participantUids, status, createdAt}
    // and filters by gameId + runtimeType in-memory to avoid requiring a
    // 5-field composite index (which Firestore would need to build first).
    const candidateSnap = await db
        .collection(types_1.COLLECTIONS.GAME_SESSIONS)
        .where("participantUids", "array-contains", uid)
        .where("status", "==", "active")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();
    const existing = candidateSnap.docs.find((d) => {
        const data = d.data();
        return data.gameId === gameId && data.runtimeType === "solo";
    });
    if (existing) {
        const sessionDoc = existing;
        const sessionId = sessionDoc.id;
        const sessionData = sessionDoc.data();
        const resumeNow = admin.firestore.Timestamp.now();
        const updatePayload = {
            soloSuspendedAt: null,
        };
        // ── Offline progression (persistent solo only) ────────────────
        // Compute deterministic offline gains if the adapter supports it.
        let offlineSummary;
        const soloMode = getAdapterSoloMode(gameId);
        if (soloMode === "persistent") {
            try {
                const adapter = (0, adapters_1.requireAdapter)(gameId);
                if (adapter.supportsOfflineProgression &&
                    adapter.applyOfflineProgression) {
                    // Read current public state
                    const pubSnap = await sessionDoc.ref
                        .collection(types_1.COLLECTIONS.PUBLIC_STATE)
                        .doc("state")
                        .get();
                    const rawPubState = pubSnap.exists ? (pubSnap.data() ?? {}) : {};
                    const pubState = (0, adapters_1.deserializeStateFromFirestore)(rawPubState);
                    // Compute elapsed offline time
                    const lastSim = sessionData.lastSimulatedAt ??
                        sessionData.soloSuspendedAt ??
                        rawPubState._meta?.updatedAt?.toMillis?.() ??
                        resumeNow.toMillis();
                    const lastSimMs = typeof lastSim === "number"
                        ? lastSim
                        : (lastSim.toMillis?.() ??
                            resumeNow.toMillis());
                    const elapsedMs = Math.min(Math.max(0, resumeNow.toMillis() - lastSimMs), MAX_OFFLINE_WINDOW_MS);
                    if (elapsedMs > 60_000) {
                        // Only apply if >1 minute elapsed to avoid trivial calls
                        const result = adapter.applyOfflineProgression(pubState, elapsedMs, { uid, settings: sessionData.settings ?? {} });
                        offlineSummary = result.offlineSummary;
                        // Write updated state
                        const serialized = (0, adapters_1.serializeStateForFirestore)(result.nextPublicState);
                        await sessionDoc.ref
                            .collection(types_1.COLLECTIONS.PUBLIC_STATE)
                            .doc("state")
                            .update({
                            ...serialized,
                            "_meta.updatedAt": resumeNow,
                        });
                        updatePayload.lastSimulatedAt = resumeNow.toMillis();
                        updatePayload.lastServerSaveAt = resumeNow.toMillis();
                        console.log(`[gamesV4] resumeOrCreate: applied ${Math.round(elapsedMs / 1000)}s offline progress for ${sessionId}`);
                    }
                }
            }
            catch (offlineErr) {
                // Non-fatal — log and continue (session resumes without offline gains)
                console.error(`[gamesV4] resumeOrCreate: offline progression error for ${sessionId}:`, offlineErr);
            }
        }
        await sessionDoc.ref.update(updatePayload);
        console.log(`[gamesV4] resumeOrCreateSoloSessionV4: resuming existing session ${sessionId} for ${uid}/${gameId}`);
        return {
            sessionId,
            resumed: true,
            offlineSummary: offlineSummary ?? null,
        };
    }
    // No existing session — delegate to createSoloSessionV4 logic inline
    // (we duplicate the core logic to keep it in one callable round-trip)
    await (0, validation_1.enforceCooldown)(db, uid, "startSoloV4", validation_1.COOLDOWNS.START_SOLO);
    if (!(0, adapters_1.hasAdapter)(gameId)) {
        throw new functions.https.HttpsError("failed-precondition", `"${gameId}" is not yet playable. Coming soon!`);
    }
    const adapter = (0, adapters_1.requireAdapter)(gameId);
    if (adapter.runtimeType !== "solo") {
        throw new functions.https.HttpsError("invalid-argument", `"${gameId}" is not a solo game. Use createGameInviteV4 instead.`);
    }
    const traceId = (0, helpers_1.generateTraceId)();
    const soloMode = getAdapterSoloMode(gameId);
    try {
        const profile = await (0, helpers_1.getUserProfile)(uid);
        const displayName = profile?.displayName ?? "Player";
        const sessionRef = db.collection(types_1.COLLECTIONS.GAME_SESSIONS).doc();
        const sessionId = sessionRef.id;
        const now = admin.firestore.Timestamp.now();
        const nowMs = now.toMillis();
        const player = {
            uid,
            slotIndex: 0,
            displayName,
            profilePictureUrl: profile?.profilePictureUrl ?? null,
        };
        const initResult = (0, adapters_1.createInitialState)(gameId, [{ uid, slotIndex: 0 }], {});
        const session = {
            sessionId,
            inviteId: "",
            conversationId: "",
            conversationScope: "dm",
            gameId: gameId,
            runtimeType: "solo",
            status: "active",
            hostId: uid,
            players: [player],
            spectatorsAllowed: false,
            spectateMode: "public_only",
            spectators: [],
            settings: {},
            turnOrder: [uid],
            currentTurnIndex: 0,
            currentTurnPlayerId: uid,
            scoreboardSummary: [{ uid, displayName, score: 0 }],
            createdAt: now,
            startedAt: now,
            resolvedAt: null,
            resolution: null,
            integrity: {
                version: 1,
                schemaVersion: 1,
                traceId,
            },
            rewardsProcessed: false,
            participantUids: [uid],
            spectatorUids: [],
            soloSuspendedAt: null,
            // ── Persistent solo fields ──────────────────────────────────
            soloMode,
            ...(soloMode === "persistent"
                ? {
                    lastSimulatedAt: nowMs,
                    runStartedAt: nowMs,
                    lastServerSaveAt: nowMs,
                }
                : {}),
        };
        const publicStateRef = sessionRef
            .collection(types_1.COLLECTIONS.PUBLIC_STATE)
            .doc("state");
        const batch = db.batch();
        batch.set(sessionRef, session);
        batch.set(publicStateRef, {
            ...initResult.publicState,
            _meta: {
                gameId,
                version: 1,
                updatedAt: now,
            },
        });
        for (const [pUid, privState] of Object.entries(initResult.privateStateByPlayer)) {
            const privRef = sessionRef
                .collection(types_1.COLLECTIONS.PRIVATE_STATE)
                .doc(pUid);
            batch.set(privRef, privState);
        }
        await batch.commit();
        console.log(`[gamesV4] resumeOrCreateSoloSessionV4: new session ${sessionId} for ${uid}/${gameId} (trace: ${traceId})`);
        return { sessionId, resumed: false };
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        console.error(`[gamesV4] resumeOrCreateSoloSessionV4 UNEXPECTED ERROR (trace: ${traceId}):`, err);
        throw new functions.https.HttpsError("internal", "Unexpected server error. Please try again.", { traceId });
    }
});
// =============================================================================
// Callable: restartSoloSessionV4
// =============================================================================
/**
 * Restart a solo game: resign/resolve the current session, then create a
 * fresh solo session for the same game.  This uses the existing resolve
 * pipeline (Option A from the spec) to avoid orphaned sessions.
 */
exports.restartSoloSessionV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { sessionId } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "sessionId is required.");
    }
    const db = (0, helpers_1.getDb)();
    const traceId = (0, helpers_1.generateTraceId)();
    // Fetch the current session
    const sessionRef = db.collection(types_1.COLLECTIONS.GAME_SESSIONS).doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Session not found.");
    }
    const session = snap.data();
    if (session.runtimeType !== "solo") {
        throw new functions.https.HttpsError("invalid-argument", "Restart is only supported for solo games.");
    }
    if (!session.participantUids.includes(uid)) {
        throw new functions.https.HttpsError("permission-denied", "You are not a participant in this session.");
    }
    // Resolve/archive the old session.
    // Persistent solo: archive (so rewards/PB/leaderboard are processed).
    // Standard solo: resign (existing behaviour).
    const isPersistent = (session.soloMode ?? getAdapterSoloMode(session.gameId)) === "persistent";
    if (session.status === "active") {
        await (0, resolve_1.resolveSessionV4Internal)({
            sessionId,
            resolutionType: isPersistent ? "win" : "resign",
            winnerIds: isPersistent ? [uid] : [],
            reason: isPersistent
                ? `Player ${uid} archived persistent solo run (restart).`
                : `Player ${uid} restarted solo game.`,
            resolverUid: uid,
        });
    }
    // Create a new solo session for the same game
    const gameId = session.gameId;
    if (!(0, adapters_1.hasAdapter)(gameId)) {
        throw new functions.https.HttpsError("failed-precondition", `"${gameId}" adapter not found.`);
    }
    try {
        const profile = await (0, helpers_1.getUserProfile)(uid);
        const displayName = profile?.displayName ?? "Player";
        const newRef = db.collection(types_1.COLLECTIONS.GAME_SESSIONS).doc();
        const newSessionId = newRef.id;
        const now = admin.firestore.Timestamp.now();
        const restartNowMs = now.toMillis();
        const restartSoloMode = getAdapterSoloMode(gameId);
        const player = {
            uid,
            slotIndex: 0,
            displayName,
            profilePictureUrl: profile?.profilePictureUrl ?? null,
        };
        const initResult = (0, adapters_1.createInitialState)(gameId, [{ uid, slotIndex: 0 }], {});
        const newSession = {
            sessionId: newSessionId,
            inviteId: "",
            conversationId: "",
            conversationScope: "dm",
            gameId,
            runtimeType: "solo",
            status: "active",
            hostId: uid,
            players: [player],
            spectatorsAllowed: false,
            spectateMode: "public_only",
            spectators: [],
            settings: {},
            turnOrder: [uid],
            currentTurnIndex: 0,
            currentTurnPlayerId: uid,
            scoreboardSummary: [{ uid, displayName, score: 0 }],
            createdAt: now,
            startedAt: now,
            resolvedAt: null,
            resolution: null,
            integrity: {
                version: 1,
                schemaVersion: 1,
                traceId,
            },
            rewardsProcessed: false,
            participantUids: [uid],
            spectatorUids: [],
            soloSuspendedAt: null,
            // ── Persistent solo fields ──────────────────────────────────
            soloMode: restartSoloMode,
            ...(restartSoloMode === "persistent"
                ? {
                    lastSimulatedAt: restartNowMs,
                    runStartedAt: restartNowMs,
                    lastServerSaveAt: restartNowMs,
                }
                : {}),
        };
        const publicStateRef = newRef
            .collection(types_1.COLLECTIONS.PUBLIC_STATE)
            .doc("state");
        const batch = db.batch();
        batch.set(newRef, newSession);
        batch.set(publicStateRef, {
            ...initResult.publicState,
            _meta: {
                gameId,
                version: 1,
                updatedAt: now,
            },
        });
        for (const [pUid, privState] of Object.entries(initResult.privateStateByPlayer)) {
            const privRef = newRef.collection(types_1.COLLECTIONS.PRIVATE_STATE).doc(pUid);
            batch.set(privRef, privState);
        }
        await batch.commit();
        console.log(`[gamesV4] restartSoloSessionV4: old=${sessionId} resolved, new=${newSessionId} for ${uid}/${gameId} (trace: ${traceId})`);
        return { sessionId: newSessionId };
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        console.error(`[gamesV4] restartSoloSessionV4 UNEXPECTED ERROR (trace: ${traceId}):`, err);
        throw new functions.https.HttpsError("internal", "Unexpected server error. Please try again.", { traceId });
    }
});
// =============================================================================
// Callable: suspendSoloSessionV4
// =============================================================================
/**
 * Mark a solo session as suspended (player leaving via back arrow).
 * Sets `soloSuspendedAt` timestamp. Does NOT resolve the session.
 */
exports.suspendSoloSessionV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { sessionId } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "sessionId is required.");
    }
    const db = (0, helpers_1.getDb)();
    const sessionRef = db.collection(types_1.COLLECTIONS.GAME_SESSIONS).doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Session not found.");
    }
    const session = snap.data();
    if (session.runtimeType !== "solo") {
        throw new functions.https.HttpsError("invalid-argument", "Suspend is only supported for solo games.");
    }
    if (!session.participantUids.includes(uid)) {
        throw new functions.https.HttpsError("permission-denied", "You are not a participant in this session.");
    }
    if (session.status !== "active") {
        return { success: true, alreadyResolved: true };
    }
    const suspendNow = admin.firestore.Timestamp.now();
    const isPersistentSession = (session.soloMode ?? getAdapterSoloMode(session.gameId)) === "persistent";
    const suspendUpdate = {
        soloSuspendedAt: suspendNow,
    };
    // For persistent solo, stamp server-save time and simulation time
    // so the next resume can compute correct offline gains.
    if (isPersistentSession) {
        suspendUpdate.lastSimulatedAt = suspendNow.toMillis();
        suspendUpdate.lastServerSaveAt = suspendNow.toMillis();
    }
    await sessionRef.update(suspendUpdate);
    console.log(`[gamesV4] suspendSoloSessionV4: session ${sessionId} suspended by ${uid}` +
        (isPersistentSession ? " (persistent)" : ""));
    return { success: true, alreadyResolved: false };
});
// =============================================================================
// Callable: archiveSoloSessionV4
// =============================================================================
/**
 * Explicitly archive/finalize a persistent solo run.
 *
 * This is the ONLY path that creates a terminal result for persistent solo.
 * Exiting the game, suspending, or being idle does NOT resolve the session.
 *
 * Steps:
 *  1. Validate ownership and session state.
 *  2. Optionally run adapter.archiveRun() for custom summary/scoreboard.
 *  3. Delegate to resolveSessionV4Internal (the single chokepoint) to:
 *     - Mark session resolved
 *     - Create GameResultV4
 *     - Compute XP, achievements, leaderboards, PBs
 *  4. Return success + sessionId for the client to navigate to Game Over.
 *
 * Only valid for persistent solo sessions (soloMode === "persistent").
 */
exports.archiveSoloSessionV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { sessionId } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "sessionId is required.");
    }
    const db = (0, helpers_1.getDb)();
    const sessionRef = db.collection(types_1.COLLECTIONS.GAME_SESSIONS).doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Session not found.");
    }
    const session = snap.data();
    // ── Permission checks ───────────────────────────────────────────
    if (session.runtimeType !== "solo") {
        throw new functions.https.HttpsError("invalid-argument", "Archive is only supported for solo games.");
    }
    if (!session.participantUids.includes(uid)) {
        throw new functions.https.HttpsError("permission-denied", "You are not a participant in this session.");
    }
    // Prevent archiving already-resolved sessions (idempotency guard)
    if (session.status === "resolved" || session.status === "abandoned") {
        console.log(`[gamesV4] archiveSoloSessionV4: session ${sessionId} already resolved, no-op.`);
        return { success: true, resultSessionId: sessionId };
    }
    if (session.status !== "active") {
        throw new functions.https.HttpsError("failed-precondition", `Cannot archive session in status "${session.status}".`);
    }
    // ── Resolve via the single chokepoint ───────────────────────────
    // For persistent solo archives, we use resolutionType "win" (the player
    // completed their run). This flows through the standard reward pipeline.
    try {
        await (0, resolve_1.resolveSessionV4Internal)({
            sessionId,
            resolutionType: "win",
            winnerIds: [uid],
            reason: `Player ${uid} archived persistent solo run.`,
            resolverUid: uid,
        });
        console.log(`[gamesV4] archiveSoloSessionV4: session ${sessionId} archived by ${uid}`);
        return { success: true, resultSessionId: sessionId };
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        console.error(`[gamesV4] archiveSoloSessionV4 UNEXPECTED ERROR for ${sessionId}:`, err);
        throw new functions.https.HttpsError("internal", "Unexpected server error. Please try again.");
    }
});
//# sourceMappingURL=solo.js.map