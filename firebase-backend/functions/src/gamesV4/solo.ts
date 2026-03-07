/**
 * Games V4 — Solo Session Creation
 *
 * Callable: createSoloSessionV4
 *
 * Creates a GameSessionV4 directly for a solo game (e.g. 2048),
 * bypassing the invite system entirely. Solo games don't need
 * lobbies, invites, or conversation pinning — the player taps
 * "Play" from the Games Hub and immediately enters the game.
 *
 * @module gamesV4/solo
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { createInitialState, hasAdapter, requireAdapter } from "./adapters";
import { assertAuth, generateTraceId, getDb, getUserProfile } from "./helpers";
import { resolveSessionV4Internal } from "./resolve";
import type { GameId, GameSessionV4, PlayerSlot } from "./types";
import { COLLECTIONS } from "./types";
import { COOLDOWNS, enforceCooldown } from "./validation";

// =============================================================================
// Callable: createSoloSessionV4
// =============================================================================

export const createSoloSessionV4 = functions.https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);

    const { gameId } = data as { gameId: string };

    if (!gameId || typeof gameId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "gameId is required.",
      );
    }

    const db = getDb();

    // Rate-limit: reuse START_SOLO cooldown
    await enforceCooldown(db, uid, "startSoloV4", COOLDOWNS.START_SOLO);

    // Verify the game has a server-side adapter
    if (!hasAdapter(gameId as GameId)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `"${gameId}" is not yet playable. Coming soon!`,
      );
    }

    const adapter = requireAdapter(gameId as GameId);

    // Must be a solo game
    if (adapter.runtimeType !== "solo") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `"${gameId}" is not a solo game. Use createGameInviteV4 instead.`,
      );
    }

    // Generate traceId early for error reporting
    const traceId = generateTraceId();

    console.log(
      `[gamesV4] createSoloSessionV4 called by ${uid} for ${gameId} (trace: ${traceId})`,
    );

    try {
      // Fetch creator profile for display data
      const profile = await getUserProfile(uid);
      const displayName = profile?.displayName ?? "Player";

      // Generate IDs
      const sessionRef = db.collection(COLLECTIONS.GAME_SESSIONS).doc();
      const sessionId = sessionRef.id;
      const now = admin.firestore.Timestamp.now();

      // Build player slot — omit optional fields to avoid undefined writes
      const player: PlayerSlot = {
        uid,
        slotIndex: 0,
        displayName,
        profilePictureUrl: profile?.profilePictureUrl ?? null,
      };

      // Create initial state from adapter
      const initResult = createInitialState(
        gameId as GameId,
        [{ uid, slotIndex: 0 }],
        {},
      );

      // Build session document
      const session: GameSessionV4 = {
        sessionId,
        inviteId: "", // No invite for solo games
        conversationId: "", // No conversation context
        conversationScope: "dm", // Required by type; unused for solo
        gameId: gameId as GameId,
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
        .collection(COLLECTIONS.PUBLIC_STATE)
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
      for (const [pUid, privState] of Object.entries(
        initResult.privateStateByPlayer,
      )) {
        const privRef = sessionRef
          .collection(COLLECTIONS.PRIVATE_STATE)
          .doc(pUid);
        batch.set(privRef, privState);
      }

      await batch.commit();

      console.log(
        `[gamesV4] Solo session ${sessionId} created by ${uid} for ${gameId} (trace: ${traceId})`,
      );

      return { sessionId };
    } catch (err) {
      // Re-throw typed HttpsErrors as-is
      if (err instanceof functions.https.HttpsError) throw err;

      // Unexpected error — log full details, return a safe message + traceId
      console.error(
        `[gamesV4] createSoloSessionV4 UNEXPECTED ERROR (trace: ${traceId}):`,
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
// Callable: resumeOrCreateSoloSessionV4
// =============================================================================
/**
 * Looks for an existing active (unresolved) solo session for the given
 * user + gameId.  If found, clears `soloSuspendedAt` (marks it as resumed)
 * and returns it.  Otherwise creates a brand-new solo session.
 *
 * This is the **primary entry point** for launching solo games from the hub.
 */
export const resumeOrCreateSoloSessionV4 = functions.https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const { gameId } = data as { gameId: string };

    if (!gameId || typeof gameId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "gameId is required.",
      );
    }

    const db = getDb();

    // Check for an existing active solo session for this user + game.
    // Uses the existing composite index {participantUids, status, createdAt}
    // and filters by gameId + runtimeType in-memory to avoid requiring a
    // 5-field composite index (which Firestore would need to build first).
    const candidateSnap = await db
      .collection(COLLECTIONS.GAME_SESSIONS)
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

      // Clear soloSuspendedAt to mark as resumed
      await sessionDoc.ref.update({
        soloSuspendedAt: null,
      });

      console.log(
        `[gamesV4] resumeOrCreateSoloSessionV4: resuming existing session ${sessionId} for ${uid}/${gameId}`,
      );
      return { sessionId, resumed: true };
    }

    // No existing session — delegate to createSoloSessionV4 logic inline
    // (we duplicate the core logic to keep it in one callable round-trip)
    await enforceCooldown(db, uid, "startSoloV4", COOLDOWNS.START_SOLO);

    if (!hasAdapter(gameId as GameId)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `"${gameId}" is not yet playable. Coming soon!`,
      );
    }

    const adapter = requireAdapter(gameId as GameId);
    if (adapter.runtimeType !== "solo") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `"${gameId}" is not a solo game. Use createGameInviteV4 instead.`,
      );
    }

    const traceId = generateTraceId();

    try {
      const profile = await getUserProfile(uid);
      const displayName = profile?.displayName ?? "Player";

      const sessionRef = db.collection(COLLECTIONS.GAME_SESSIONS).doc();
      const sessionId = sessionRef.id;
      const now = admin.firestore.Timestamp.now();

      const player: PlayerSlot = {
        uid,
        slotIndex: 0,
        displayName,
        profilePictureUrl: profile?.profilePictureUrl ?? null,
      };

      const initResult = createInitialState(
        gameId as GameId,
        [{ uid, slotIndex: 0 }],
        {},
      );

      const session: GameSessionV4 = {
        sessionId,
        inviteId: "",
        conversationId: "",
        conversationScope: "dm",
        gameId: gameId as GameId,
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
      };

      const publicStateRef = sessionRef
        .collection(COLLECTIONS.PUBLIC_STATE)
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

      for (const [pUid, privState] of Object.entries(
        initResult.privateStateByPlayer,
      )) {
        const privRef = sessionRef
          .collection(COLLECTIONS.PRIVATE_STATE)
          .doc(pUid);
        batch.set(privRef, privState);
      }

      await batch.commit();

      console.log(
        `[gamesV4] resumeOrCreateSoloSessionV4: new session ${sessionId} for ${uid}/${gameId} (trace: ${traceId})`,
      );

      return { sessionId, resumed: false };
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error(
        `[gamesV4] resumeOrCreateSoloSessionV4 UNEXPECTED ERROR (trace: ${traceId}):`,
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
// Callable: restartSoloSessionV4
// =============================================================================
/**
 * Restart a solo game: resign/resolve the current session, then create a
 * fresh solo session for the same game.  This uses the existing resolve
 * pipeline (Option A from the spec) to avoid orphaned sessions.
 */
export const restartSoloSessionV4 = functions.https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);
    const { sessionId } = data as { sessionId: string };

    if (!sessionId || typeof sessionId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "sessionId is required.",
      );
    }

    const db = getDb();
    const traceId = generateTraceId();

    // Fetch the current session
    const sessionRef = db.collection(COLLECTIONS.GAME_SESSIONS).doc(sessionId);
    const snap = await sessionRef.get();

    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "Session not found.");
    }

    const session = snap.data() as GameSessionV4;

    if (session.runtimeType !== "solo") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Restart is only supported for solo games.",
      );
    }

    if (!session.participantUids.includes(uid)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You are not a participant in this session.",
      );
    }

    // Resolve the old session (resign)
    if (session.status === "active") {
      await resolveSessionV4Internal({
        sessionId,
        resolutionType: "resign",
        winnerIds: [],
        reason: `Player ${uid} restarted solo game.`,
        resolverUid: uid,
      });
    }

    // Create a new solo session for the same game
    const gameId = session.gameId;
    if (!hasAdapter(gameId)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `"${gameId}" adapter not found.`,
      );
    }

    try {
      const profile = await getUserProfile(uid);
      const displayName = profile?.displayName ?? "Player";

      const newRef = db.collection(COLLECTIONS.GAME_SESSIONS).doc();
      const newSessionId = newRef.id;
      const now = admin.firestore.Timestamp.now();

      const player: PlayerSlot = {
        uid,
        slotIndex: 0,
        displayName,
        profilePictureUrl: profile?.profilePictureUrl ?? null,
      };

      const initResult = createInitialState(
        gameId,
        [{ uid, slotIndex: 0 }],
        {},
      );

      const newSession: GameSessionV4 = {
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
      };

      const publicStateRef = newRef
        .collection(COLLECTIONS.PUBLIC_STATE)
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

      for (const [pUid, privState] of Object.entries(
        initResult.privateStateByPlayer,
      )) {
        const privRef = newRef.collection(COLLECTIONS.PRIVATE_STATE).doc(pUid);
        batch.set(privRef, privState);
      }

      await batch.commit();

      console.log(
        `[gamesV4] restartSoloSessionV4: old=${sessionId} resolved, new=${newSessionId} for ${uid}/${gameId} (trace: ${traceId})`,
      );

      return { sessionId: newSessionId };
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error(
        `[gamesV4] restartSoloSessionV4 UNEXPECTED ERROR (trace: ${traceId}):`,
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
// Callable: suspendSoloSessionV4
// =============================================================================
/**
 * Mark a solo session as suspended (player leaving via back arrow).
 * Sets `soloSuspendedAt` timestamp. Does NOT resolve the session.
 */
export const suspendSoloSessionV4 = functions.https.onCall(
  async (data, context) => {
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
    const snap = await sessionRef.get();

    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "Session not found.");
    }

    const session = snap.data() as GameSessionV4;

    if (session.runtimeType !== "solo") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Suspend is only supported for solo games.",
      );
    }

    if (!session.participantUids.includes(uid)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You are not a participant in this session.",
      );
    }

    if (session.status !== "active") {
      return { success: true, alreadyResolved: true };
    }

    await sessionRef.update({
      soloSuspendedAt: admin.firestore.Timestamp.now(),
    });

    console.log(
      `[gamesV4] suspendSoloSessionV4: session ${sessionId} suspended by ${uid}`,
    );

    return { success: true, alreadyResolved: false };
  },
);
