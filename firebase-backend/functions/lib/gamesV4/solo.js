"use strict";
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
exports.createSoloSessionV4 = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const adapters_1 = require("./adapters");
const helpers_1 = require("./helpers");
const types_1 = require("./types");
const validation_1 = require("./validation");
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
//# sourceMappingURL=solo.js.map