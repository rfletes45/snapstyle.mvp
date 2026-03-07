"use strict";
/**
 * Games V4 — Create Game Invite
 *
 * Callable: createGameInviteV4
 *
 * Creates a new GameInviteV4 doc, pins it to the conversation,
 * and fans out notifications to conversation members.
 *
 * @module gamesV4/invites
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
exports.createGameInviteV4 = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const helpers_1 = require("./helpers");
const notifications_1 = require("./notifications");
const types_1 = require("./types");
const validation_1 = require("./validation");
const GAME_META = {
    bounce_blitz: {
        runtimeType: "solo",
        minPlayers: 1,
        maxPlayers: 1,
        supportsSpectate: false,
    },
    play_2048: {
        runtimeType: "solo",
        minPlayers: 1,
        maxPlayers: 1,
        supportsSpectate: false,
    },
    brick_breaker: {
        runtimeType: "solo",
        minPlayers: 1,
        maxPlayers: 1,
        supportsSpectate: false,
    },
    word_master: {
        runtimeType: "solo",
        minPlayers: 1,
        maxPlayers: 1,
        supportsSpectate: false,
    },
    minesweeper: {
        runtimeType: "solo",
        minPlayers: 1,
        maxPlayers: 1,
        supportsSpectate: false,
    },
    lights_out: {
        runtimeType: "solo",
        minPlayers: 1,
        maxPlayers: 1,
        supportsSpectate: false,
    },
    tic_tac_toe: {
        runtimeType: "turnBased",
        minPlayers: 2,
        maxPlayers: 2,
        supportsSpectate: true,
    },
    chess: {
        runtimeType: "turnBased",
        minPlayers: 2,
        maxPlayers: 2,
        supportsSpectate: true,
    },
    checkers: {
        runtimeType: "turnBased",
        minPlayers: 2,
        maxPlayers: 2,
        supportsSpectate: true,
    },
    connect_four: {
        runtimeType: "turnBased",
        minPlayers: 2,
        maxPlayers: 2,
        supportsSpectate: true,
    },
    gomoku: {
        runtimeType: "turnBased",
        minPlayers: 2,
        maxPlayers: 2,
        supportsSpectate: true,
    },
    reversi: {
        runtimeType: "turnBased",
        minPlayers: 2,
        maxPlayers: 2,
        supportsSpectate: true,
    },
    dots_and_boxes: {
        runtimeType: "turnBased",
        minPlayers: 2,
        maxPlayers: 4,
        supportsSpectate: true,
    },
    pong_game: {
        runtimeType: "realtime",
        minPlayers: 2,
        maxPlayers: 2,
        supportsSpectate: false,
    },
    battleship: {
        runtimeType: "realtime",
        minPlayers: 2,
        maxPlayers: 2,
        supportsSpectate: false,
    },
    sketch_party_game: {
        runtimeType: "realtime",
        minPlayers: 2,
        maxPlayers: 8,
        supportsSpectate: false,
    },
    starforge_game: {
        runtimeType: "realtime",
        minPlayers: 2,
        maxPlayers: 4,
        supportsSpectate: false,
    },
    crossword_puzzle: {
        runtimeType: "realtime",
        minPlayers: 2,
        maxPlayers: 4,
        supportsSpectate: false,
    },
    minigolf_duels: {
        runtimeType: "turnBased",
        minPlayers: 2,
        maxPlayers: 3,
        supportsSpectate: false,
    },
    dot_match: {
        runtimeType: "realtime",
        minPlayers: 2,
        maxPlayers: 2,
        supportsSpectate: false,
    },
    crazy_eights: {
        runtimeType: "turnBased",
        minPlayers: 2,
        maxPlayers: 6,
        supportsSpectate: true,
    },
    solitaire_klondike: {
        runtimeType: "solo",
        minPlayers: 1,
        maxPlayers: 1,
        supportsSpectate: false,
    },
};
function validateInput(data) {
    const d = data;
    if (!d.conversationId || typeof d.conversationId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "conversationId is required.");
    }
    const scope = d.conversationScope;
    if (scope !== "dm" && scope !== "group") {
        throw new functions.https.HttpsError("invalid-argument", "conversationScope must be 'dm' or 'group'.");
    }
    const gameId = d.gameId;
    if (!gameId || !GAME_META[gameId]) {
        throw new functions.https.HttpsError("invalid-argument", `Invalid gameId: ${d.gameId}`);
    }
    const meta = GAME_META[gameId];
    // Solo games shouldn't use the invite system
    if (meta.runtimeType === "solo") {
        throw new functions.https.HttpsError("invalid-argument", "Solo games do not use the invite system.");
    }
    const maxPlayers = typeof d.maxPlayers === "number"
        ? Math.min(Math.max(d.maxPlayers, meta.minPlayers), meta.maxPlayers, types_1.MAX_PLAYERS)
        : meta.maxPlayers;
    const allowSpectators = typeof d.allowSpectators === "boolean"
        ? d.allowSpectators && meta.supportsSpectate
        : meta.supportsSpectate;
    const spectateMode = allowSpectators && typeof d.spectateMode === "string"
        ? d.spectateMode
        : "public_only";
    return {
        conversationId: d.conversationId,
        conversationScope: scope,
        gameId,
        maxPlayers,
        allowSpectators,
        spectateMode,
    };
}
// =============================================================================
// Callable: createGameInviteV4
// =============================================================================
exports.createGameInviteV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    // Rate-limit: 1 invite per 3 seconds
    const db = (0, helpers_1.getDb)();
    await (0, validation_1.enforceCooldown)(db, uid, "createInviteV4", validation_1.COOLDOWNS.CREATE_INVITE);
    const input = validateInput(data);
    // Verify membership
    await (0, helpers_1.assertConversationMember)(uid, input.conversationId, input.conversationScope);
    // Fetch creator profile
    const profile = await (0, helpers_1.getUserProfile)(uid);
    const displayName = profile?.displayName ?? "Unknown";
    // Generate IDs
    const inviteRef = db.collection(types_1.COLLECTIONS.GAME_INVITES).doc();
    const inviteId = inviteRef.id;
    const now = admin.firestore.Timestamp.now();
    const meta = GAME_META[input.gameId];
    // Build invite document
    const invite = {
        inviteId,
        conversationId: input.conversationId,
        conversationScope: input.conversationScope,
        gameId: input.gameId,
        runtimeType: meta.runtimeType,
        createdBy: uid,
        status: "sent",
        createdAt: now,
        updatedAt: now,
        hostId: uid,
        participantIds: [uid], // Creator is first participant
        spectatorIds: [],
        maxPlayers: input.maxPlayers ?? meta.maxPlayers,
        allowSpectators: input.allowSpectators ?? false,
        spectateMode: input.spectateMode ?? "public_only",
        sessionId: null,
        summary: {
            phase: "lobby",
            turnPlayerId: null,
            scoreSummary: [],
            lastMoveAt: null,
            lastActorId: null,
        },
        participantSummaries: [
            {
                uid,
                displayName,
                profilePictureUrl: profile?.profilePictureUrl ?? null,
            },
        ],
        spectatorSummaries: [],
        hiddenInChat: false,
        hiddenAt: null,
        deleteRequestedAt: null,
        deleteAt: null,
    };
    // Write invite doc AND pin to conversation atomically (R3 fix)
    const convCollection = input.conversationScope === "dm" ? "Chats" : "Groups";
    const convRef = db.collection(convCollection).doc(input.conversationId);
    await db.runTransaction(async (tx) => {
        const convSnap = await tx.get(convRef);
        const current = convSnap.data()?.[types_1.PINNED_INVITE_IDS_FIELD] || [];
        // Evict oldest if at capacity
        const updated = current.includes(inviteId)
            ? current
            : [...current, inviteId];
        while (updated.length > types_1.MAX_PINNED_INVITES) {
            updated.shift();
        }
        tx.set(inviteRef, invite);
        tx.update(convRef, { [types_1.PINNED_INVITE_IDS_FIELD]: updated });
    });
    // Fan-out notifications to conversation members
    try {
        const memberIds = await (0, helpers_1.getConversationMemberIds)(input.conversationId, input.conversationScope);
        await (0, notifications_1.notifyInviteCreated)(invite, displayName, memberIds);
    }
    catch (err) {
        console.error("[gamesV4] Failed to send invite notifications:", err);
    }
    console.log(`[gamesV4] Invite ${inviteId} created by ${uid} for ${input.gameId} ` +
        `in ${input.conversationScope}:${input.conversationId}`);
    return { inviteId };
});
//# sourceMappingURL=invites.js.map