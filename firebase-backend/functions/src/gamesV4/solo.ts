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
