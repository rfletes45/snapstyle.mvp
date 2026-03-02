"use strict";
/**
 * sessionsV3.ts — Cloud Function Callables for v3 Game Sessions
 *
 * These callables manage the `GameSessions/{sessionId}` lifecycle:
 *   createSessionV3  — host creates a session (lobby phase)
 *   joinSessionV3    — player/spectator joins an existing session
 *   leaveSessionV3   — participant leaves (host leaving → abandons session)
 *   startSessionV3   — host starts the game (lobby → starting → active)
 *
 * Design:
 *   - All mutations run inside a Firestore transaction for consistency.
 *   - Phase transitions are validated via `canTransitionPhase()`.
 *   - The session doc is the single source of truth (not the invite).
 *   - Types are inlined here because the Cloud Functions tsconfig.rootDir
 *     is `src/` and cannot import from `../../shared/sessions/`.
 *
 * @module firebase-backend/functions/src/sessionsV3
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
exports.watchdogSessionsV3 = exports.inviteToSessionV3 = exports.resolveSessionV3 = exports.startSessionV3 = exports.leaveSessionV3 = exports.joinSessionV3 = exports.createSessionV3 = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const { HttpsError } = functions.https;
// Initialize if not already
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// =============================================================================
// Inlined v3 Types & Constants
// (Mirrors shared/sessions/constants.ts + shared/sessions/types.ts)
// =============================================================================
const SESSION_PHASES = [
    "lobby",
    "starting",
    "active",
    "finishing",
    "resolved",
    "abandoned",
    "expired",
];
const SESSION_PHASE_TRANSITIONS = {
    lobby: ["starting", "abandoned", "expired"],
    starting: ["active", "abandoned"],
    active: ["finishing", "abandoned"],
    finishing: ["resolved", "abandoned"],
    resolved: [],
    abandoned: [],
    expired: [],
};
const TERMINAL_PHASES = new Set([
    "resolved",
    "abandoned",
    "expired",
]);
function canTransitionPhase(from, to) {
    return SESSION_PHASE_TRANSITIONS[from].includes(to);
}
const SESSIONS_COLLECTION = "GameSessions";
const SESSION_LOBBY_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_PARTICIPANTS = 2;
const DEFAULT_MAX_SPECTATORS = 10;
// =============================================================================
// Helpers
// =============================================================================
/** Fetch a user profile doc and return display name + avatar. */
async function getUserProfile(uid) {
    const snap = await db.collection("Users").doc(uid).get();
    const data = snap.data();
    return {
        displayName: data?.displayName || data?.name || "Player",
        avatarUrl: data?.avatarUrl || data?.photoURL || "",
    };
}
/** Count active (non-spectator, non-left, non-invited) participants. */
function countActivePlayers(participants) {
    return participants.filter((p) => (p.role === "host" || p.role === "player") &&
        p.status !== "left" &&
        p.status !== "disconnected" &&
        p.status !== "invited").length;
}
/** Count active spectators. */
function countActiveSpectators(participants) {
    return participants.filter((p) => p.role === "spectator" && p.status !== "left").length;
}
// =============================================================================
// createSessionV3
// =============================================================================
exports.createSessionV3 = functions.https.onCall(async (data, context) => {
    // --- Auth ---
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    // --- Validate input ---
    const { gameType, runtimeType, visibility = "private", maxParticipants = DEFAULT_MAX_PARTICIPANTS, conversationId, entrySource, traceId, dualWriteInvite: rawDualWrite = false, createInvite: rawCreateInvite = false, recipientUids: rawRecipientUids, } = data;
    // Sanitise recipient list — dedupe & exclude the host
    const recipientUids = Array.isArray(rawRecipientUids)
        ? [...new Set(rawRecipientUids)].filter((id) => typeof id === "string" && id !== uid)
        : [];
    // Accept either flag name — client uses createInvite, internal uses dualWriteInvite
    const dualWriteInvite = rawDualWrite || rawCreateInvite;
    if (!gameType || typeof gameType !== "string") {
        throw new HttpsError("invalid-argument", "gameType is required");
    }
    if (!runtimeType ||
        !["solo", "turnBased", "realtime"].includes(runtimeType)) {
        throw new HttpsError("invalid-argument", "runtimeType must be solo, turnBased, or realtime");
    }
    if (maxParticipants < 1 || maxParticipants > 20) {
        throw new HttpsError("invalid-argument", "maxParticipants must be between 1 and 20");
    }
    // --- Fetch host profile ---
    const profile = await getUserProfile(uid);
    const now = Date.now();
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc();
    const sessionId = sessionRef.id;
    const hostParticipant = {
        uid,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        role: "host",
        status: "joined",
        joinedAt: now,
    };
    // Build invited-participant stubs so recipients' subscription queries
    // (which filter on `participantUids array-contains <uid>`) can discover
    // the session immediately — before they explicitly join.
    const invitedParticipants = recipientUids.map((rUid) => ({
        uid: rUid,
        displayName: "", // filled on join
        avatarUrl: "",
        role: "player",
        status: "invited",
        joinedAt: 0,
    }));
    // participantUids includes both host and invited recipients so Firestore
    // security rules + subscription queries work for everyone in the chat.
    const allParticipantUids = [uid, ...recipientUids];
    const session = {
        id: sessionId,
        gameType,
        runtimeType: runtimeType,
        visibility,
        phase: "lobby",
        createdAt: now,
        updatedAt: now,
        expiresAt: now + SESSION_LOBBY_TTL_MS,
        hostUid: uid,
        participants: [hostParticipant, ...invitedParticipants],
        maxParticipants,
        maxSpectators: DEFAULT_MAX_SPECTATORS,
        participantUids: allParticipantUids,
        ...(conversationId && conversationId.length > 0 ? { conversationId } : {}),
        ...(entrySource ? { entrySource } : {}),
        ...(traceId ? { traceId } : {}),
    };
    await sessionRef.set(session);
    // --- Dual-write: create a v2 GameInvites doc for backward compatibility ---
    let sourceInviteId;
    if (dualWriteInvite && conversationId) {
        try {
            const inviteRef = db.collection("GameInvites").doc();
            sourceInviteId = inviteRef.id;
            // eligibleUserIds must include ALL session participants so that
            // every player can read the invite doc via Firestore security rules.
            const inviteEligible = [...new Set([uid, ...recipientUids])];
            await inviteRef.set({
                id: sourceInviteId,
                gameType,
                senderId: uid,
                senderName: profile.displayName,
                senderAvatar: profile.avatarUrl || "",
                context: recipientUids.length === 1 ? "dm" : "group",
                conversationId,
                targetType: recipientUids.length === 1 ? "specific" : "universal",
                ...(recipientUids.length === 1
                    ? { recipientId: recipientUids[0] }
                    : {}),
                eligibleUserIds: inviteEligible,
                requiredPlayers: maxParticipants,
                maxPlayers: maxParticipants,
                claimedSlots: [
                    {
                        playerId: uid,
                        playerName: profile.displayName,
                        playerAvatar: profile.avatarUrl || "",
                        claimedAt: now,
                        isHost: true,
                    },
                ],
                status: "pending",
                inviteVersion: 3,
                createdAt: now,
                updatedAt: now,
                expiresAt: now + SESSION_LOBBY_TTL_MS,
                spectatingEnabled: true,
                spectatorOnly: false,
                spectators: [],
                showInPlayPage: false,
                // v3 link — lets v2 code discover the session
                v3SessionId: sessionId,
                traceId: traceId || "",
            });
            // Write sourceInviteId back to the session
            await sessionRef.update({ sourceInviteId });
            functions.logger.info("sessionsV3.createSessionV3.dualWrite", {
                sessionId,
                inviteId: sourceInviteId,
            });
        }
        catch (dualErr) {
            // Non-fatal: v3 session already created successfully
            functions.logger.warn("sessionsV3.createSessionV3.dualWrite.FAILED", {
                sessionId,
                error: dualErr instanceof Error ? dualErr.message : String(dualErr),
            });
        }
    }
    functions.logger.info("sessionsV3.createSessionV3.OK", {
        sessionId,
        gameType,
        runtimeType,
        hostUid: uid,
        conversationId,
        traceId,
        sourceInviteId,
    });
    return { success: true, sessionId, sourceInviteId };
});
// =============================================================================
// joinSessionV3
// =============================================================================
exports.joinSessionV3 = functions.https.onCall(async (data, context) => {
    // --- Auth ---
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    // --- Validate input ---
    const { sessionId, role = "player", entrySource, } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new HttpsError("invalid-argument", "sessionId is required");
    }
    if (!["player", "spectator"].includes(role)) {
        throw new HttpsError("invalid-argument", "role must be player or spectator");
    }
    // --- Transaction ---
    const result = await db.runTransaction(async (tx) => {
        const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
        const snap = await tx.get(sessionRef);
        if (!snap.exists) {
            throw new HttpsError("not-found", "Session not found");
        }
        const session = snap.data();
        // Must be in lobby phase
        if (session.phase !== "lobby") {
            throw new HttpsError("failed-precondition", `Cannot join session in "${session.phase}" phase`);
        }
        // Check if already a participant
        const existing = session.participants.find((p) => p.uid === uid);
        if (existing &&
            existing.status !== "left" &&
            existing.status !== "invited") {
            // Already actively in session — idempotent success
            return { success: true, alreadyJoined: true };
        }
        // Capacity check
        if (role === "spectator") {
            if (countActiveSpectators(session.participants) >= session.maxSpectators) {
                throw new HttpsError("resource-exhausted", "Session spectator slots are full");
            }
        }
        else {
            if (countActivePlayers(session.participants) >= session.maxParticipants) {
                throw new HttpsError("resource-exhausted", "Session player slots are full");
            }
        }
        // Fetch joiner profile
        const profile = await getUserProfile(uid);
        const now = Date.now();
        const participant = {
            uid,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            role,
            status: "joined",
            joinedAt: now,
        };
        // If the user previously left, replace their entry; otherwise append
        let updatedParticipants;
        if (existing) {
            updatedParticipants = session.participants.map((p) => p.uid === uid ? participant : p);
        }
        else {
            updatedParticipants = [...session.participants, participant];
        }
        // Merge: keep existing ACL UIDs (e.g. other invited users added by
        // inviteToSessionV3) AND add UIDs from updated participants array.
        const mergedUids = [
            ...new Set([
                ...(session.participantUids || []),
                ...updatedParticipants
                    .filter((p) => p.status !== "left")
                    .map((p) => p.uid),
            ]),
        ];
        tx.update(sessionRef, {
            participants: updatedParticipants,
            participantUids: mergedUids,
            updatedAt: now,
        });
        return { success: true };
    });
    functions.logger.info("sessionsV3.joinSessionV3.OK", {
        sessionId,
        uid,
        role,
        entrySource,
    });
    // --- Sync eligibleUserIds on the linked v2 invite (fire-and-forget) ---
    // The v2 invite doc's `eligibleUserIds` controls Firestore read access.
    // If this joiner isn't already in that array, they get "permission denied"
    // when the client tries to subscribe to the invite.
    try {
        const sessionSnap = await db
            .collection(SESSIONS_COLLECTION)
            .doc(sessionId)
            .get();
        const sourceInviteId = sessionSnap.data()?.sourceInviteId;
        if (sourceInviteId) {
            const inviteRef = db.collection("GameInvites").doc(sourceInviteId);
            const inviteSnap = await inviteRef.get();
            if (inviteSnap.exists) {
                const currentEligible = inviteSnap.data()?.eligibleUserIds ?? [];
                if (!currentEligible.includes(uid)) {
                    await inviteRef.update({
                        eligibleUserIds: [...currentEligible, uid],
                        updatedAt: Date.now(),
                    });
                    functions.logger.info("sessionsV3.joinSessionV3.eligibleSynced", {
                        sessionId,
                        inviteId: sourceInviteId,
                        addedUid: uid,
                    });
                }
            }
        }
    }
    catch (syncErr) {
        // Non-fatal — the join itself already succeeded
        functions.logger.warn("sessionsV3.joinSessionV3.eligibleSyncFailed", {
            sessionId,
            uid,
            error: String(syncErr),
        });
    }
    return result;
});
// =============================================================================
// leaveSessionV3
// =============================================================================
exports.leaveSessionV3 = functions.https.onCall(async (data, context) => {
    // --- Auth ---
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    // --- Validate input ---
    const { sessionId } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new HttpsError("invalid-argument", "sessionId is required");
    }
    // --- Transaction ---
    await db.runTransaction(async (tx) => {
        const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
        const snap = await tx.get(sessionRef);
        if (!snap.exists) {
            throw new HttpsError("not-found", "Session not found");
        }
        const session = snap.data();
        // Session already terminal → idempotent success.
        // This happens when the host leaves (→ abandoned) and then another
        // participant presses "Leave". They should be allowed to exit cleanly.
        if (TERMINAL_PHASES.has(session.phase)) {
            functions.logger.info("sessionsV3.leaveSessionV3.ALREADY_TERMINAL", {
                sessionId,
                uid,
                phase: session.phase,
            });
            return;
        }
        // Find participant
        const participantIndex = session.participants.findIndex((p) => p.uid === uid);
        if (participantIndex === -1) {
            throw new HttpsError("failed-precondition", "You are not a participant in this session");
        }
        const participant = session.participants[participantIndex];
        const now = Date.now();
        // If host leaves in lobby → abandon the session entirely
        if (participant.role === "host" && session.phase === "lobby") {
            if (!canTransitionPhase(session.phase, "abandoned")) {
                throw new HttpsError("failed-precondition", "Cannot abandon session from current phase");
            }
            const updatedParticipants = session.participants.map((p) => p.uid === uid ? { ...p, status: "left" } : p);
            // Keep all existing ACL UIDs so participants can see the abandoned notice
            tx.update(sessionRef, {
                phase: "abandoned",
                participants: updatedParticipants,
                participantUids: session.participantUids || [],
                updatedAt: now,
            });
            functions.logger.info("sessionsV3.leaveSessionV3.ABANDON", {
                sessionId,
                hostUid: uid,
            });
            return;
        }
        // If host leaves during active game → abandon
        if (participant.role === "host" && session.phase !== "lobby") {
            const updatedParticipants = session.participants.map((p) => p.uid === uid ? { ...p, status: "left" } : p);
            // Keep all existing ACL UIDs so participants can see the abandoned notice
            tx.update(sessionRef, {
                phase: "abandoned",
                participants: updatedParticipants,
                participantUids: session.participantUids || [],
                updatedAt: now,
            });
            functions.logger.info("sessionsV3.leaveSessionV3.HOST_ABANDON_ACTIVE", {
                sessionId,
                hostUid: uid,
                previousPhase: session.phase,
            });
            return;
        }
        // Non-host leaves: mark as "left"
        const updatedParticipants = session.participants.map((p) => p.uid === uid ? { ...p, status: "left" } : p);
        // Remove leaving user from ACL but preserve other invited users' UIDs
        const activeParticipantUids = updatedParticipants
            .filter((p) => p.status !== "left")
            .map((p) => p.uid);
        const mergedUids = [
            ...new Set([
                ...(session.participantUids || []).filter((u) => u !== uid),
                ...activeParticipantUids,
            ]),
        ];
        tx.update(sessionRef, {
            participants: updatedParticipants,
            participantUids: mergedUids,
            updatedAt: now,
        });
        functions.logger.info("sessionsV3.leaveSessionV3.LEFT", {
            sessionId,
            uid,
            role: participant.role,
        });
    });
    return { success: true };
});
// =============================================================================
// startSessionV3
// =============================================================================
exports.startSessionV3 = functions.https.onCall(async (data, context) => {
    // --- Auth ---
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    // --- Validate input ---
    const { sessionId } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new HttpsError("invalid-argument", "sessionId is required");
    }
    // --- Transaction ---
    const result = await db.runTransaction(async (tx) => {
        const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
        const snap = await tx.get(sessionRef);
        if (!snap.exists) {
            throw new HttpsError("not-found", "Session not found");
        }
        const session = snap.data();
        // Only host can start
        if (session.hostUid !== uid) {
            throw new HttpsError("permission-denied", "Only the host can start the session");
        }
        // Must be in lobby phase
        if (session.phase !== "lobby") {
            throw new HttpsError("failed-precondition", `Cannot start session in "${session.phase}" phase`);
        }
        // Validate transition
        if (!canTransitionPhase("lobby", "starting")) {
            throw new HttpsError("failed-precondition", "Invalid phase transition from lobby to starting");
        }
        // Need at least 2 active players for multiplayer
        const activePlayers = countActivePlayers(session.participants);
        if (session.runtimeType !== "solo" && activePlayers < 2) {
            throw new HttpsError("failed-precondition", `Need at least 2 players to start (have ${activePlayers})`);
        }
        const now = Date.now();
        // Mark all active players' status as "playing"
        const updatedParticipants = session.participants.map((p) => {
            if ((p.role === "host" || p.role === "player") && p.status === "joined") {
                return { ...p, status: "playing" };
            }
            return p;
        });
        // Transition: lobby → starting → active
        // We go straight to "active" since the server-side game creation
        // is synchronous within this callable. For realtime games, the
        // Colyseus room ID will be set by the Colyseus server on connect.
        const mergedUids = [
            ...new Set([
                ...(session.participantUids || []),
                ...updatedParticipants
                    .filter((p) => p.status !== "left")
                    .map((p) => p.uid),
            ]),
        ];
        const updates = {
            phase: "active",
            participants: updatedParticipants,
            participantUids: mergedUids,
            updatedAt: now,
        };
        // For turn-based games, create the Firestore game document
        if (session.runtimeType === "turnBased") {
            const gameRef = db.collection("TurnBasedGames").doc();
            const players = updatedParticipants
                .filter((p) => (p.role === "host" || p.role === "player") &&
                p.status === "playing")
                .map((p) => ({
                id: p.uid,
                name: p.displayName,
                avatar: p.avatarUrl || "",
            }));
            // Create a minimal turn-based game doc
            const gameDoc = {
                gameType: session.gameType,
                players,
                status: "active",
                currentTurnIndex: 0,
                currentTurnPlayerId: players[0]?.id || "",
                moves: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                sessionId, // back-link to v3 session
            };
            tx.set(gameRef, gameDoc);
            updates.firestoreGameId = gameRef.id;
            functions.logger.info("sessionsV3.startSessionV3.TURN_GAME_CREATED", {
                sessionId,
                firestoreGameId: gameRef.id,
                gameType: session.gameType,
            });
        }
        else {
            // For realtime games (Colyseus-based), use sessionId as the shared
            // matchmaking key so both players joinOrCreate the same room.
            updates.firestoreGameId = sessionId;
            functions.logger.info("sessionsV3.startSessionV3.REALTIME_GAME_KEY", {
                sessionId,
                firestoreGameId: sessionId,
                gameType: session.gameType,
            });
        }
        // Remove expiry since the game is now active
        updates.expiresAt =
            admin.firestore.FieldValue.delete();
        tx.update(sessionRef, updates);
        return {
            success: true,
            ...(updates.firestoreGameId
                ? { firestoreGameId: updates.firestoreGameId }
                : {}),
        };
    });
    functions.logger.info("sessionsV3.startSessionV3.OK", {
        sessionId,
        hostUid: uid,
    });
    return result;
});
// =============================================================================
// resolveSessionV3
// =============================================================================
/**
 * Transition a session to "resolved" (or "abandoned") with resolution data.
 *
 * Called by:
 *   - Colyseus persistence bridge (room onDispose)
 *   - processGameCompletion / processRealtimeGameCompletion triggers
 *   - Client-side completion paths (via callable)
 *
 * Idempotent: if the session is already terminal, returns success.
 */
exports.resolveSessionV3 = functions.https.onCall(async (data, context) => {
    // Auth is optional — server-side triggers call without user context
    // But if called from client, we verify the caller is a participant
    const callerUid = context.auth?.uid;
    const { sessionId, outcome, winnerUid, scores, firestoreGameId, resolvedBy = "server", } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new HttpsError("invalid-argument", "sessionId is required");
    }
    if (!outcome ||
        !["win", "draw", "forfeit", "timeout", "error"].includes(outcome)) {
        throw new HttpsError("invalid-argument", "outcome must be win, draw, forfeit, timeout, or error");
    }
    const result = await db.runTransaction(async (tx) => {
        const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
        const snap = await tx.get(sessionRef);
        if (!snap.exists) {
            // Already cleaned up — idempotent success
            return { success: true, alreadyCleaned: true };
        }
        const session = snap.data();
        // Already terminal — idempotent success
        if (TERMINAL_PHASES.has(session.phase)) {
            return { success: true, alreadyTerminal: true };
        }
        // If called from client, verify participant
        if (callerUid) {
            const isParticipant = session.participants.some((p) => p.uid === callerUid);
            if (!isParticipant) {
                throw new HttpsError("permission-denied", "You are not a participant in this session");
            }
        }
        const now = Date.now();
        // Mark all active players as "finished"
        const updatedParticipants = session.participants.map((p) => {
            if (p.status === "playing" || p.status === "joined") {
                const isWinner = winnerUid ? p.uid === winnerUid : undefined;
                const score = scores?.[p.uid];
                return {
                    ...p,
                    status: "finished",
                    ...(isWinner !== undefined ? { isWinner } : {}),
                    ...(score !== undefined ? { score } : {}),
                };
            }
            return p;
        });
        const resolution = {
            outcome: outcome,
            resolvedAt: now,
            ...(winnerUid ? { winnerUid } : {}),
            ...(scores ? { scores } : {}),
            ...(firestoreGameId ? { firestoreGameId } : {}),
            ...(session.sourceInviteId
                ? { sourceInviteId: session.sourceInviteId }
                : {}),
        };
        tx.update(sessionRef, {
            phase: "resolved",
            participants: updatedParticipants,
            // Preserve all ACL UIDs so everyone can read the resolved session
            participantUids: session.participantUids || [],
            resolution,
            updatedAt: now,
        });
        return { success: true };
    });
    // ── Finalize linked v2 invite (if dual-write created one) ────────
    // resolveSessionV3 is the canonical v3 completion path; we must also
    // hide the corresponding v2 GameInvites doc so it disappears from chat.
    // This is idempotent: if the invite was already finalized by
    // processGameCompletion / deleteGameAndInvite / the watchdog, the
    // second call is a no-op.
    if (!result.alreadyCleaned && !result.alreadyTerminal) {
        try {
            // Re-read session to get sourceInviteId (we're outside the tx now)
            const sessionSnap = await db
                .collection(SESSIONS_COLLECTION)
                .doc(sessionId)
                .get();
            const sessionData = sessionSnap.data();
            const sourceInviteId = sessionData?.sourceInviteId;
            if (sourceInviteId) {
                const inviteRef = db.collection("GameInvites").doc(sourceInviteId);
                const inviteSnap = await inviteRef.get();
                if (inviteSnap.exists) {
                    const inv = inviteSnap.data();
                    const invNow = Date.now();
                    const TERMINAL = new Set([
                        "completed",
                        "declined",
                        "expired",
                        "cancelled",
                    ]);
                    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
                    const patch = {};
                    if (!TERMINAL.has(inv.status)) {
                        patch.status = "completed";
                        patch.completedAt = invNow;
                    }
                    if (inv.chatVisibility !== "hidden") {
                        patch.chatVisibility = "hidden";
                        patch.chatHiddenAt = invNow;
                    }
                    if (!inv.resolvedAt)
                        patch.resolvedAt = invNow;
                    if (!inv.resolvedBy)
                        patch.resolvedBy = resolvedBy || "server";
                    if (!inv.deleteAt)
                        patch.deleteAt = invNow + SIX_HOURS_MS;
                    if ((!inv.chatHiddenInConversationIds ||
                        inv.chatHiddenInConversationIds.length === 0) &&
                        inv.conversationId) {
                        patch.chatHiddenInConversationIds = [inv.conversationId];
                    }
                    const resType = winnerUid
                        ? "win"
                        : outcome === "draw"
                            ? "draw"
                            : outcome === "forfeit"
                                ? "resign"
                                : outcome === "timeout"
                                    ? "timeout"
                                    : "disconnect";
                    if (!inv.resolutionType)
                        patch.resolutionType = resType;
                    if (winnerUid && !inv.winnerId)
                        patch.winnerId = winnerUid;
                    if (Object.keys(patch).length > 0) {
                        patch.updatedAt = invNow;
                        await inviteRef.update(patch);
                        functions.logger.info("sessionsV3.resolveSessionV3.INVITE_FINALIZED", { sessionId, sourceInviteId, patchKeys: Object.keys(patch) });
                    }
                }
            }
        }
        catch (invErr) {
            // Non-fatal — invite will be caught by watchdog
            functions.logger.warn("sessionsV3.resolveSessionV3.INVITE_FINALIZE_FAIL", {
                sessionId,
                error: invErr instanceof Error ? invErr.message : String(invErr),
            });
        }
    }
    functions.logger.info("sessionsV3.resolveSessionV3.OK", {
        sessionId,
        outcome,
        winnerUid,
        resolvedBy,
    });
    return result;
});
// =============================================================================
// inviteToSessionV3
// =============================================================================
/**
 * Send a game invite to a conversation (DM or group).
 *
 * Creates a `GameInvites` pointer doc so the chat's invite pill subscription
 * renders it immediately. Optionally stamps `conversationId` on the session
 * so `subscribeToConversationSessions` can discover it.
 *
 * INVARIANT: This function NEVER modifies `GameSessions.participants`.
 * Participants are only added by `joinSessionV3` (explicit Join action).
 */
exports.inviteToSessionV3 = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    const { sessionId, conversationId, recipientUid, eligibleUserIds: rawEligible, } = data;
    if (!sessionId || typeof sessionId !== "string") {
        throw new HttpsError("invalid-argument", "sessionId is required");
    }
    if (!conversationId || typeof conversationId !== "string") {
        throw new HttpsError("invalid-argument", "conversationId is required");
    }
    // Must supply either recipientUid (DM) or eligibleUserIds (group)
    if ((!recipientUid || typeof recipientUid !== "string") &&
        (!Array.isArray(rawEligible) || rawEligible.length === 0)) {
        throw new HttpsError("invalid-argument", "recipientUid or eligibleUserIds is required");
    }
    // --- Validate session (read-only — NO participant mutation) ---
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
        throw new HttpsError("not-found", "Session not found");
    }
    const session = snap.data();
    if (session.phase !== "lobby") {
        throw new HttpsError("failed-precondition", `Cannot invite to session in "${session.phase}" phase`);
    }
    // Caller must be an active participant (host or player)
    const caller = session.participants.find((p) => p.uid === uid && p.status !== "left");
    if (!caller) {
        throw new HttpsError("permission-denied", "Only session participants can invite others");
    }
    // --- Build eligibleUserIds for the GameInvites doc ---
    // For DM: [sender, recipient]
    // For group: rawEligible (all group members) + ensure sender is included
    let eligible;
    if (Array.isArray(rawEligible) && rawEligible.length > 0) {
        // Group invite — use provided member UIDs, ensure sender is included
        const set = new Set(rawEligible.filter((id) => typeof id === "string"));
        set.add(uid);
        eligible = [...set];
    }
    else {
        // DM invite — sender + recipient
        eligible = [uid, recipientUid];
    }
    // --- Update session: stamp conversationId + grant read access ---
    //
    // `participantUids` is the Firestore-rules access-control list.
    // We add all eligible UIDs so invited users can read the session
    // doc when they navigate to the lobby. This does NOT touch the
    // `participants` array — only joinSessionV3 adds real participants.
    //
    // INVARIANT: participants array is NEVER modified here.
    const existingUids = session.participantUids ?? [];
    const mergedUids = [...new Set([...existingUids, ...eligible])];
    const needsUidsUpdate = mergedUids.length > existingUids.length;
    const needsConvoUpdate = !session.conversationId && conversationId;
    if (needsUidsUpdate || needsConvoUpdate) {
        const updatePayload = {
            updatedAt: Date.now(),
        };
        if (needsUidsUpdate) {
            updatePayload.participantUids = mergedUids;
        }
        if (needsConvoUpdate) {
            updatePayload.conversationId = conversationId;
        }
        await sessionRef.update(updatePayload);
        functions.logger.info("sessionsV3.inviteToSessionV3.sessionUpdate", {
            sessionId,
            addedUids: mergedUids.length - existingUids.length,
            conversationIdStamped: !!needsConvoUpdate,
        });
    }
    // --- Create GameInvites doc (the chat pointer pill) ---
    const senderProfile = await getUserProfile(uid);
    const now = Date.now();
    const inviteRef = db.collection("GameInvites").doc();
    const inviteId = inviteRef.id;
    const isDm = conversationId.includes("_");
    await inviteRef.set({
        id: inviteId,
        gameType: session.gameType,
        senderId: uid,
        senderName: senderProfile.displayName,
        senderAvatar: senderProfile.avatarUrl || "",
        context: isDm ? "dm" : "group",
        conversationId,
        targetType: isDm ? "specific" : "universal",
        eligibleUserIds: eligible,
        requiredPlayers: session.maxParticipants,
        maxPlayers: session.maxParticipants,
        claimedSlots: [
            {
                playerId: uid,
                playerName: senderProfile.displayName,
                playerAvatar: senderProfile.avatarUrl || "",
                claimedAt: now,
                isHost: session.hostUid === uid,
            },
        ],
        status: "pending",
        inviteVersion: 3,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + SESSION_LOBBY_TTL_MS,
        spectatingEnabled: true,
        spectatorOnly: false,
        spectators: [],
        showInPlayPage: false,
        v3SessionId: sessionId,
        traceId: session.traceId || "",
    });
    functions.logger.info("sessionsV3.inviteToSessionV3.OK", {
        sessionId,
        invitedBy: uid,
        conversationId,
        inviteId,
        eligibleCount: eligible.length,
        isDm,
    });
    return {
        success: true,
        inviteId,
        alreadyInvited: false,
    };
});
// =============================================================================
// watchdogSessionsV3 — Scheduled cleanup of stale sessions
// =============================================================================
const SESSION_ACTIVE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const INVITE_DELETE_DELAY_MS = 6 * 60 * 60 * 1000; // 6 hours — matches games.ts
/**
 * Helper: finalize the linked v2 GameInvites doc for a session.
 * Non-fatal — if the invite is already terminal or missing, this is a no-op.
 */
async function finalizeLinkedInvite(session, terminalStatus, resolutionType, resolvedBy) {
    const sourceInviteId = session.sourceInviteId;
    if (!sourceInviteId)
        return;
    try {
        const inviteRef = db.collection("GameInvites").doc(sourceInviteId);
        const inviteSnap = await inviteRef.get();
        if (!inviteSnap.exists)
            return;
        const inv = inviteSnap.data();
        const now = Date.now();
        const TERMINAL = new Set(["completed", "declined", "expired", "cancelled"]);
        const patch = {};
        if (!TERMINAL.has(inv.status)) {
            patch.status = terminalStatus;
            patch.completedAt = now;
        }
        if (inv.chatVisibility !== "hidden") {
            patch.chatVisibility = "hidden";
            patch.chatHiddenAt = now;
        }
        if (!inv.resolvedAt)
            patch.resolvedAt = now;
        if (!inv.resolvedBy)
            patch.resolvedBy = resolvedBy;
        if (!inv.deleteAt)
            patch.deleteAt = now + INVITE_DELETE_DELAY_MS;
        if (!inv.resolutionType)
            patch.resolutionType = resolutionType;
        if ((!inv.chatHiddenInConversationIds ||
            inv.chatHiddenInConversationIds.length === 0) &&
            inv.conversationId) {
            patch.chatHiddenInConversationIds = [inv.conversationId];
        }
        if (Object.keys(patch).length > 0) {
            patch.updatedAt = now;
            await inviteRef.update(patch);
        }
    }
    catch (err) {
        // Non-fatal — the games.ts watchdog will catch it
        functions.logger.warn("watchdogSessionsV3.INVITE_FINALIZE_FAIL", {
            sourceInviteId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
/**
 * Scheduled function that runs every 15 minutes to:
 *
 * Pass 1: Expire lobby sessions past their TTL (expiresAt < now)
 * Pass 2: Abandon active sessions with no updates for 4 hours
 *
 * Both passes also finalize the linked v2 GameInvites doc so it
 * disappears from chat. This is belt-and-suspenders — the primary
 * finalization happens in resolveSessionV3 / room disposal, but the
 * watchdog catches anything that slipped through.
 *
 * Idempotent — safe to run concurrently or with overlapping windows.
 */
exports.watchdogSessionsV3 = functions.pubsub
    .schedule("every 15 minutes")
    .onRun(async () => {
    const now = Date.now();
    let expiredCount = 0;
    let abandonedCount = 0;
    // ── Pass 1: Expire stale lobby sessions ───────────────────────────────
    try {
        const lobbySnap = await db
            .collection(SESSIONS_COLLECTION)
            .where("phase", "==", "lobby")
            .where("expiresAt", "<", now)
            .limit(200)
            .get();
        for (const doc of lobbySnap.docs) {
            try {
                const session = doc.data();
                if (session.phase !== "lobby")
                    continue; // double-check
                await doc.ref.update({
                    phase: "expired",
                    updatedAt: now,
                });
                // Also finalize the linked v2 invite
                await finalizeLinkedInvite(session, "expired", "expire", "watchdog");
                expiredCount++;
            }
            catch (err) {
                functions.logger.error("watchdogSessionsV3.EXPIRE_FAIL", {
                    sessionId: doc.id,
                    error: err,
                });
            }
        }
    }
    catch (err) {
        functions.logger.error("watchdogSessionsV3.PASS1_FAIL", { error: err });
    }
    // ── Pass 2: Abandon stuck active sessions ─────────────────────────────
    try {
        const cutoff = now - SESSION_ACTIVE_TTL_MS;
        const activeSnap = await db
            .collection(SESSIONS_COLLECTION)
            .where("phase", "==", "active")
            .where("updatedAt", "<", cutoff)
            .limit(200)
            .get();
        for (const doc of activeSnap.docs) {
            try {
                const session = doc.data();
                if (session.phase !== "active")
                    continue;
                await doc.ref.update({
                    phase: "abandoned",
                    updatedAt: now,
                });
                // Also finalize the linked v2 invite
                await finalizeLinkedInvite(session, "cancelled", "disconnect", "watchdog");
                abandonedCount++;
            }
            catch (err) {
                functions.logger.error("watchdogSessionsV3.ABANDON_FAIL", {
                    sessionId: doc.id,
                    error: err,
                });
            }
        }
    }
    catch (err) {
        functions.logger.error("watchdogSessionsV3.PASS2_FAIL", { error: err });
    }
    // ── Pass 3: Catch orphaned invites for recently-terminal sessions ──────
    // resolveSessionV3 finalizes invites post-transaction, but if that
    // non-fatal step failed (network blip, cold-start timeout, etc.) the
    // invite lingers in chat.  This pass catches them.
    let orphanCount = 0;
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    for (const termPhase of ["resolved", "abandoned"]) {
        try {
            const snap = await db
                .collection(SESSIONS_COLLECTION)
                .where("phase", "==", termPhase)
                .limit(200)
                .get();
            for (const doc of snap.docs) {
                try {
                    const session = doc.data();
                    if (!session.sourceInviteId)
                        continue;
                    // Skip sessions terminal for >24 h — already scanned
                    if (session.updatedAt &&
                        session.updatedAt < now - TWENTY_FOUR_HOURS)
                        continue;
                    await finalizeLinkedInvite(session, termPhase === "resolved" ? "completed" : "cancelled", termPhase === "resolved" ? "system" : "disconnect", "watchdog");
                    orphanCount++;
                }
                catch (err) {
                    functions.logger.error("watchdogSessionsV3.PASS3_ITEM_FAIL", {
                        sessionId: doc.id,
                        error: err,
                    });
                }
            }
        }
        catch (err) {
            functions.logger.warn(`watchdogSessionsV3.PASS3_${termPhase}_FAIL`, {
                error: String(err),
            });
        }
    }
    functions.logger.info("watchdogSessionsV3.DONE", {
        expiredCount,
        abandonedCount,
        orphanCount,
    });
});
//# sourceMappingURL=sessionsV3.js.map