"use strict";
/**
 * Games V4 — Lobby Management
 *
 * Callables:
 * - joinInviteLobbyV4: join as player or spectator
 * - leaveInviteLobbyV4: leave an invite lobby before game starts
 * - cancelGameInviteV4: host cancels an invite (resolves it)
 * - updateLobbySettingsV4: host-only settings patch
 * - startGameFromInviteV4: host starts the game, creating a GameSessionV4
 *
 * @module gamesV4/lobby
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
exports.cancelGameInviteV4 = exports.leaveInviteLobbyV4 = exports.startGameFromInviteV4 = exports.updateLobbySettingsV4 = exports.joinInviteLobbyV4 = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const adapters_1 = require("./adapters");
const helpers_1 = require("./helpers");
const notifications_1 = require("./notifications");
const types_1 = require("./types");
const validation_1 = require("./validation");
// =============================================================================
// Callable: joinInviteLobbyV4
// =============================================================================
exports.joinInviteLobbyV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { inviteId, asSpectator } = data;
    if (!inviteId || typeof inviteId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "inviteId is required.");
    }
    const db = (0, helpers_1.getDb)();
    // Rate-limit: 1 join per 2 seconds
    await (0, validation_1.enforceCooldown)(db, uid, "joinLobbyV4", validation_1.COOLDOWNS.JOIN_LOBBY);
    // Verify conversation membership BEFORE the transaction (R1 fix)
    const invitePreSnap = await db
        .collection(types_1.COLLECTIONS.GAME_INVITES)
        .doc(inviteId)
        .get();
    if (!invitePreSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Invite not found.");
    }
    const invitePre = invitePreSnap.data();
    await (0, helpers_1.assertConversationMember)(uid, invitePre.conversationId, invitePre.conversationScope);
    const inviteRef = db.collection(types_1.COLLECTIONS.GAME_INVITES).doc(inviteId);
    // Pre-fetch joiner profile outside transaction for lobby display
    const joinerProfile = await (0, helpers_1.getUserProfile)(uid);
    const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(inviteRef);
        if (!snap.exists) {
            throw new functions.https.HttpsError("not-found", "Invite not found.");
        }
        const invite = snap.data();
        // Must be sent or lobby status
        if (invite.status !== "sent" && invite.status !== "lobby") {
            throw new functions.https.HttpsError("failed-precondition", `Cannot join invite in status '${invite.status}'.`);
        }
        // Build compact summary for the joiner
        const joinerSummary = {
            uid,
            displayName: joinerProfile?.displayName ?? "Unknown",
            profilePictureUrl: joinerProfile?.profilePictureUrl ?? null,
        };
        if (asSpectator) {
            // Spectator join
            if (!invite.allowSpectators) {
                throw new functions.https.HttpsError("failed-precondition", "This game does not allow spectators.");
            }
            if (invite.spectatorIds.includes(uid)) {
                return { alreadyJoined: true, role: "spectator" };
            }
            const updatedSpectatorIds = [...invite.spectatorIds, uid];
            const updatedSpectatorSummaries = [
                ...(invite.spectatorSummaries ?? []),
                joinerSummary,
            ];
            const newStatus = invite.status === "sent" && (0, types_1.canTransitionInviteStatus)("sent", "lobby")
                ? "lobby"
                : invite.status;
            tx.update(inviteRef, {
                spectatorIds: updatedSpectatorIds,
                spectatorSummaries: updatedSpectatorSummaries,
                status: newStatus,
                updatedAt: admin.firestore.Timestamp.now(),
            });
            return { alreadyJoined: false, role: "spectator" };
        }
        else {
            // Player join
            if (invite.participantIds.includes(uid)) {
                return { alreadyJoined: true, role: "player" };
            }
            if (invite.participantIds.length >= invite.maxPlayers) {
                throw new functions.https.HttpsError("failed-precondition", "Lobby is full.");
            }
            if (invite.participantIds.length >= types_1.MAX_PLAYERS) {
                throw new functions.https.HttpsError("failed-precondition", "Maximum player limit reached.");
            }
            const updatedParticipantIds = [...invite.participantIds, uid];
            const updatedParticipantSummaries = [
                ...(invite.participantSummaries ?? []),
                joinerSummary,
            ];
            const newStatus = invite.status === "sent" && (0, types_1.canTransitionInviteStatus)("sent", "lobby")
                ? "lobby"
                : invite.status;
            tx.update(inviteRef, {
                participantIds: updatedParticipantIds,
                participantSummaries: updatedParticipantSummaries,
                status: newStatus,
                updatedAt: admin.firestore.Timestamp.now(),
            });
            return { alreadyJoined: false, role: "player" };
        }
    });
    // Notify host if a new player joined
    if (!result.alreadyJoined && result.role === "player") {
        try {
            const profile = joinerProfile;
            await (0, notifications_1.notifyPlayerJoinedLobby)(invitePre, profile?.displayName ?? "Someone");
        }
        catch (err) {
            console.error("[gamesV4] Failed to notify lobby join:", err);
        }
    }
    console.log(`[gamesV4] ${uid} joined invite ${inviteId} as ${result.role}`);
    return { success: true, role: result.role };
});
// =============================================================================
// Callable: updateLobbySettingsV4
// =============================================================================
exports.updateLobbySettingsV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { inviteId, settingsPatch } = data;
    if (!inviteId || typeof inviteId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "inviteId is required.");
    }
    if (!settingsPatch || typeof settingsPatch !== "object") {
        throw new functions.https.HttpsError("invalid-argument", "settingsPatch must be an object.");
    }
    // Sanitise user-provided settings to cap depth/size
    const sanitised = (0, validation_1.sanitisePayload)(settingsPatch);
    const db = (0, helpers_1.getDb)();
    const inviteRef = db.collection(types_1.COLLECTIONS.GAME_INVITES).doc(inviteId);
    const validatedSettings = await db.runTransaction(async (tx) => {
        const snap = await tx.get(inviteRef);
        if (!snap.exists) {
            throw new functions.https.HttpsError("not-found", "Invite not found.");
        }
        const invite = snap.data();
        // Host-only
        if (invite.hostId !== uid) {
            throw new functions.https.HttpsError("permission-denied", "Only the host can update lobby settings.");
        }
        // Must be in Lobby or Sent status
        if (invite.status !== "sent" && invite.status !== "lobby") {
            throw new functions.https.HttpsError("failed-precondition", `Cannot update settings in status '${invite.status}'.`);
        }
        // Validate against adapter's settingsSchema if available
        const adapter = (0, adapters_1.getAdapter)(invite.gameId);
        let finalSettings;
        if (adapter?.validateSettings) {
            try {
                finalSettings = adapter.validateSettings(sanitised);
            }
            catch (err) {
                throw new functions.https.HttpsError("invalid-argument", `Invalid settings: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        else if (adapter?.defaultSettings) {
            // No validateSettings but has defaults — merge with whitelisting
            const defaults = adapter.defaultSettings;
            finalSettings = { ...defaults };
            for (const key of Object.keys(defaults)) {
                if (key in sanitised) {
                    finalSettings[key] = sanitised[key];
                }
            }
        }
        else {
            // No adapter or no defaults — store sanitised patch as-is
            finalSettings = sanitised;
        }
        // Persist settings on the invite doc so all lobby participants
        // can see the current configuration in real-time.
        tx.update(inviteRef, {
            lobbySettings: finalSettings,
            updatedAt: admin.firestore.Timestamp.now(),
        });
        return finalSettings;
    });
    console.log(`[gamesV4] Host ${uid} updated settings for invite ${inviteId}:`, JSON.stringify(validatedSettings).slice(0, 200));
    return { success: true, settings: validatedSettings };
});
// =============================================================================
// Callable: startGameFromInviteV4
// =============================================================================
exports.startGameFromInviteV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    // Rate-limit: 1 start per 2 seconds
    const db0 = (0, helpers_1.getDb)();
    await (0, validation_1.enforceCooldown)(db0, uid, "startGameV4", validation_1.COOLDOWNS.START_GAME);
    console.log(`[gamesV4] startGameFromInviteV4 called by host ${uid}`);
    const raw = data;
    const { inviteId } = raw;
    // Sanitise user-provided settings to cap depth/size
    const settings = raw.settings
        ? (0, validation_1.sanitisePayload)(raw.settings)
        : undefined;
    if (!inviteId || typeof inviteId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "inviteId is required.");
    }
    const db = (0, helpers_1.getDb)();
    const inviteRef = db.collection(types_1.COLLECTIONS.GAME_INVITES).doc(inviteId);
    // ─── Pre-read: fetch invite + profiles before transaction ──────
    // Read the invite once outside the transaction for profile pre-fetch.
    const invitePreSnap = await inviteRef.get();
    if (!invitePreSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Invite not found.");
    }
    const invitePre = invitePreSnap.data();
    // ─── Implemented-game gating ──────────────────────────────────
    // Reject start for games without a server-side adapter/implementation.
    if (!(0, adapters_1.hasAdapter)(invitePre.gameId)) {
        throw new functions.https.HttpsError("failed-precondition", `"${invitePre.gameId}" is not yet playable. Coming soon!`);
    }
    // Batch-fetch profiles OUTSIDE the transaction to avoid holding the
    // transaction open for N external reads. Safe because profiles are
    // essentially immutable during the short start-game window.
    const profileMap = new Map();
    await Promise.all(invitePre.participantIds.map(async (pUid) => {
        const profile = await (0, helpers_1.getUserProfile)(pUid);
        if (profile) {
            profileMap.set(pUid, profile);
        }
    }));
    // Generate a traceId early so it's available in error handlers
    const startTraceId = (0, helpers_1.generateTraceId)();
    try {
        // ─── Transaction: validate + create session + update invite ──────
        const sessionId = await db.runTransaction(async (tx) => {
            const inviteSnap = await tx.get(inviteRef);
            if (!inviteSnap.exists) {
                throw new functions.https.HttpsError("not-found", "Invite not found.");
            }
            const invite = inviteSnap.data();
            // Host-only
            if (invite.hostId !== uid) {
                throw new functions.https.HttpsError("permission-denied", "Only the host can start the game.");
            }
            // Must be in sent or lobby status
            if (invite.status !== "sent" && invite.status !== "lobby") {
                throw new functions.https.HttpsError("failed-precondition", `Cannot start game from status '${invite.status}'.`);
            }
            // Check minimum players
            const minRequired = invitePre.runtimeType === "solo" ? 1 : 2;
            if (invite.participantIds.length < minRequired) {
                throw new functions.https.HttpsError("failed-precondition", `Need at least ${minRequired} player(s) to start.`);
            }
            // Generate session ID
            const sessionRef = db.collection(types_1.COLLECTIONS.GAME_SESSIONS).doc();
            const sId = sessionRef.id;
            const now = admin.firestore.Timestamp.now();
            const traceId = (0, helpers_1.generateTraceId)();
            const players = invite.participantIds.map((pUid, idx) => {
                const profile = profileMap.get(pUid);
                const slot = {
                    uid: pUid,
                    slotIndex: idx,
                    displayName: profile?.displayName ?? "Player",
                    profilePictureUrl: profile?.profilePictureUrl ?? null,
                };
                // Only include avatarConfig when defined — Firestore rejects `undefined`.
                if (profile?.avatarConfig)
                    slot.avatarConfig = profile.avatarConfig;
                return slot;
            });
            // Determine turn order (random shuffle for fairness)
            const turnOrder = shuffleArray([...invite.participantIds]);
            const firstPlayer = turnOrder[0];
            // Build initial scoreboard summary
            const scoreboardSummary = players.map((p) => ({
                uid: p.uid,
                displayName: p.displayName ?? "Player",
                score: 0,
            }));
            // Build spectator data
            const spectators = invite.spectatorIds.map((sUid) => ({
                uid: sUid,
                joinedAt: now,
            }));
            // Create session document
            const session = {
                sessionId: sId,
                inviteId: invite.inviteId,
                conversationId: invite.conversationId,
                conversationScope: invite.conversationScope,
                gameId: invite.gameId,
                runtimeType: invite.runtimeType,
                status: "active",
                hostId: invite.hostId,
                players,
                spectatorsAllowed: invite.allowSpectators,
                spectateMode: invite.spectateMode,
                spectators,
                settings: settings ??
                    invite.lobbySettings ??
                    {},
                turnOrder,
                currentTurnIndex: 0,
                currentTurnPlayerId: invite.runtimeType === "turnBased" ? firstPlayer : null,
                scoreboardSummary,
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
                participantUids: [...invite.participantIds],
                spectatorUids: [...invite.spectatorIds],
            };
            tx.set(sessionRef, session);
            // Create initial public state subcollection doc (adapter-driven)
            const publicStateRef = sessionRef
                .collection(types_1.COLLECTIONS.PUBLIC_STATE)
                .doc("state");
            let initialPublicState = {};
            if ((0, adapters_1.hasAdapter)(invite.gameId)) {
                // Use the resolved session settings (which already include
                // lobbySettings fallback) for adapter initialization.
                const effectiveSettings = session.settings;
                const initResult = (0, adapters_1.createInitialState)(invite.gameId, players.map((p) => ({ uid: p.uid, slotIndex: p.slotIndex })), effectiveSettings);
                initialPublicState = initResult.publicState;
                // Write per-player private state docs if produced
                for (const [pUid, privState] of Object.entries(initResult.privateStateByPlayer)) {
                    const privRef = sessionRef
                        .collection(types_1.COLLECTIONS.PRIVATE_STATE)
                        .doc(pUid);
                    tx.set(privRef, privState);
                }
            }
            tx.set(publicStateRef, {
                ...initialPublicState,
                _meta: {
                    gameId: invite.gameId,
                    version: 1,
                    updatedAt: now,
                },
            });
            // Transition invite → active
            tx.update(inviteRef, {
                status: "active",
                sessionId: sId,
                updatedAt: now,
                "summary.phase": "active",
                "summary.turnPlayerId": invite.runtimeType === "turnBased" ? firstPlayer : null,
            });
            return sId;
        });
        console.log(`[gamesV4] Game started: session ${sessionId} from invite ${inviteId} by host ${uid} (trace: ${startTraceId})`);
        return { sessionId };
    }
    catch (err) {
        // Re-throw typed HttpsErrors as-is (client can parse code/message)
        if (err instanceof functions.https.HttpsError)
            throw err;
        // Unexpected error — log full details, return a safe message + traceId
        console.error(`[gamesV4] startGameFromInviteV4 UNEXPECTED ERROR (trace: ${startTraceId}):`, err);
        throw new functions.https.HttpsError("internal", "Unexpected server error. Please try again.", { traceId: startTraceId });
    }
});
// =============================================================================
// Callable: leaveInviteLobbyV4
// =============================================================================
exports.leaveInviteLobbyV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { inviteId } = data;
    if (!inviteId || typeof inviteId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "inviteId is required.");
    }
    const db = (0, helpers_1.getDb)();
    // Rate-limit
    await (0, validation_1.enforceCooldown)(db, uid, "leaveLobbyV4", validation_1.COOLDOWNS.LEAVE_LOBBY);
    const inviteRef = db.collection(types_1.COLLECTIONS.GAME_INVITES).doc(inviteId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(inviteRef);
        if (!snap.exists) {
            throw new functions.https.HttpsError("not-found", "Invite not found.");
        }
        const invite = snap.data();
        // Can only leave from pre-game statuses
        if (invite.status !== "sent" && invite.status !== "lobby") {
            throw new functions.https.HttpsError("failed-precondition", "Cannot leave after the game has started.");
        }
        // Host cannot leave — they should cancel instead
        if (invite.hostId === uid) {
            throw new functions.https.HttpsError("failed-precondition", "The host cannot leave. Cancel the invite instead.");
        }
        const isPlayer = invite.participantIds.includes(uid);
        const isSpectator = invite.spectatorIds.includes(uid);
        if (!isPlayer && !isSpectator) {
            return; // Not in lobby — idempotent
        }
        const updates = {
            updatedAt: admin.firestore.Timestamp.now(),
        };
        if (isPlayer) {
            updates.participantIds = invite.participantIds.filter((id) => id !== uid);
            updates.participantSummaries = (invite.participantSummaries ?? []).filter((s) => s.uid !== uid);
        }
        if (isSpectator) {
            updates.spectatorIds = invite.spectatorIds.filter((id) => id !== uid);
            updates.spectatorSummaries = (invite.spectatorSummaries ?? []).filter((s) => s.uid !== uid);
        }
        tx.update(inviteRef, updates);
    });
    console.log(`[gamesV4] ${uid} left invite ${inviteId}`);
    return { success: true };
});
// =============================================================================
// Callable: cancelGameInviteV4
// =============================================================================
exports.cancelGameInviteV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { inviteId } = data;
    if (!inviteId || typeof inviteId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "inviteId is required.");
    }
    const db = (0, helpers_1.getDb)();
    // Rate-limit
    await (0, validation_1.enforceCooldown)(db, uid, "cancelInviteV4", validation_1.COOLDOWNS.CANCEL_INVITE);
    const inviteRef = db.collection(types_1.COLLECTIONS.GAME_INVITES).doc(inviteId);
    const invite = await db.runTransaction(async (tx) => {
        const snap = await tx.get(inviteRef);
        if (!snap.exists) {
            throw new functions.https.HttpsError("not-found", "Invite not found.");
        }
        const inv = snap.data();
        // Only host can cancel
        if (inv.hostId !== uid) {
            throw new functions.https.HttpsError("permission-denied", "Only the host can cancel an invite.");
        }
        // Can only cancel from pre-game statuses
        if (inv.status !== "sent" && inv.status !== "lobby") {
            throw new functions.https.HttpsError("failed-precondition", "Cannot cancel an invite that is already active or resolved.");
        }
        const now = admin.firestore.Timestamp.now();
        tx.update(inviteRef, {
            status: "resolved",
            updatedAt: now,
            "summary.phase": "resolved",
            deleteRequestedAt: now,
            deleteAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + types_1.RESOLVED_INVITE_TTL_MS),
        });
        return inv;
    });
    // Unpin from conversation (outside transaction — idempotent)
    try {
        await (0, helpers_1.unpinInviteFromConversation)(invite.conversationId, invite.conversationScope, inviteId);
    }
    catch (err) {
        console.error("[gamesV4] Failed to unpin cancelled invite:", err);
    }
    console.log(`[gamesV4] Host ${uid} cancelled invite ${inviteId}`);
    return { success: true };
});
// =============================================================================
// Utility: Shuffle array (Fisher-Yates)
// =============================================================================
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
//# sourceMappingURL=lobby.js.map