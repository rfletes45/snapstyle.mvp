"use strict";
/**
 * Games Cloud Functions
 *
 * Handles:
 * - Game creation from invites/matchmaking
 * - Move validation and processing
 * - Game completion and stats updates
 * - Achievement checking
 * - Matchmaking background processing
 * - Daily cleanup tasks
 *
 * @see docs/GAMES_SYSTEM.md
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
exports.claimLevelReward = exports.onGameResult = exports.resignGame = exports.makeMove = exports.cleanupOldGameSessions = exports.reconcileActiveInvites = exports.cleanupVacantGames = exports.cleanupStaleMatchmakingEntries = exports.cleanupResolvedInvites = exports.cleanupOldGames = exports.expireMatchmakingEntries = exports.expireGameInvites = exports.processMatchmakingQueue = exports.onGameHistoryCreatedUpdateLeaderboard = exports.onGameCompletedCreateHistory = exports.processRealtimeGameCompletion = exports.processGameCompletion = exports.onUniversalInviteUpdate = exports.createGameFromInvite = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions"));
const achievementsV2Evaluator_1 = require("./achievementsV2Evaluator");
const socialGameStatsHelpers_1 = require("./socialGameStatsHelpers");
// Initialize if not already
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// =============================================================================
// Removed Games — reject any invites/results for these IDs
// =============================================================================
const REMOVED_GAME_IDS = new Set([]);
// =============================================================================
// ELO Calculation
// =============================================================================
const DEFAULT_RATING = 1200;
/**
 * Calculate expected score for ELO
 */
function calculateExpectedScore(playerRating, opponentRating) {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}
/**
 * Calculate new rating after a game
 */
function calculateNewRating(currentRating, expectedScore, actualScore, kFactor = 32) {
    return Math.round(currentRating + kFactor * (actualScore - expectedScore));
}
/**
 * Get K-factor based on rating and games played
 */
function getKFactor(rating, gamesPlayed) {
    if (gamesPlayed < 30)
        return 40;
    if (rating >= 2400)
        return 16;
    return 32;
}
// =============================================================================
// Initial Game States
// =============================================================================
/**
 * Get initial game state for a game type
 */
function getInitialGameState(gameType) {
    switch (gameType) {
        case "chess":
            return {
                board: getInitialChessBoard(),
                castlingRights: {
                    whiteKingSide: true,
                    whiteQueenSide: true,
                    blackKingSide: true,
                    blackQueenSide: true,
                },
                enPassantTarget: null,
                halfMoveClock: 0,
                fullMoveNumber: 1,
                capturedPieces: { white: [], black: [] },
            };
        case "checkers":
            return {
                board: getInitialCheckersBoard(),
                mustJump: null,
            };
        case "tic_tac_toe":
            return {
                board: Array(9).fill(null),
            };
        case "crazy_eights":
            return {
                currentSuit: null,
                direction: 1,
                drawPile: [],
                discardPile: [],
                player1Hand: [],
                player2Hand: [],
            };
        case "connect_four":
            return {
                board: Array.from({ length: 6 }, () => Array(7).fill(null)),
                columnHeights: Array(7).fill(0),
            };
        case "dot_match":
            return {
                hLines: Array.from({ length: 5 }, () => Array(4).fill(false)),
                vLines: Array.from({ length: 4 }, () => Array(5).fill(false)),
                boxes: Array.from({ length: 4 }, () => Array(4).fill(0)),
                scores: { player1: 0, player2: 0 },
            };
        case "gomoku_master":
            return {
                board: Array.from({ length: 15 }, () => Array(15).fill(null)),
                lastMove: null,
            };
        case "reversi_game":
            return {
                board: createInitialReversiBoard(),
                consecutivePasses: 0,
                scores: { player1: 2, player2: 2 },
            };
        default:
            return {};
    }
}
function createInitialReversiBoard() {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[3][3] = 2;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = 2;
    return board;
}
function getInitialChessBoard() {
    return [
        ["r", "n", "b", "q", "k", "b", "n", "r"],
        ["p", "p", "p", "p", "p", "p", "p", "p"],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        [" ", " ", " ", " ", " ", " ", " ", " "],
        ["P", "P", "P", "P", "P", "P", "P", "P"],
        ["R", "N", "B", "Q", "K", "B", "N", "R"],
    ];
}
function getInitialCheckersBoard() {
    const board = Array(8)
        .fill(null)
        .map(() => Array(8).fill(null));
    // Black pieces (top, rows 0-2)
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
                board[row][col] = "b";
            }
        }
    }
    // Red pieces (bottom, rows 5-7)
    for (let row = 5; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
                board[row][col] = "r";
            }
        }
    }
    return board;
}
// =============================================================================
// Game Creation Functions
// =============================================================================
/**
 * Create a game from an accepted invite
 * Called via Firestore trigger or directly
 */
exports.createGameFromInvite = functions.firestore
    .document("GameInvites/{inviteId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Only process when status changes to 'accepted'
    if (before.status === "pending" && after.status === "accepted") {
        const invite = after;
        // Reject invites for removed games
        if (REMOVED_GAME_IDS.has(invite.gameType)) {
            console.warn(`Rejecting invite for removed game: ${invite.gameType}`);
            await finalizeUniversalInvite({
                inviteId: context.params.inviteId,
                terminalStatus: "declined",
                resolvedBy: "server",
                resolutionType: "game_removed",
            });
            return;
        }
        try {
            // Get player ratings
            const [senderStats, receiverStats] = await Promise.all([
                getPlayerStats(invite.senderId),
                getPlayerStats(invite.receiverId),
            ]);
            const senderRating = senderStats?.gameStats[invite.gameType]?.rating ?? DEFAULT_RATING;
            const receiverRating = receiverStats?.gameStats[invite.gameType]?.rating ?? DEFAULT_RATING;
            // Create game document
            const gameId = `game_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
            const now = firestore_1.Timestamp.now();
            // Randomly decide who goes first
            const senderFirst = Math.random() < 0.5;
            const game = {
                id: gameId,
                gameType: invite.gameType,
                status: "active",
                playerIds: [invite.senderId, invite.receiverId],
                players: {
                    player1: {
                        id: senderFirst ? invite.senderId : invite.receiverId,
                        name: senderFirst ? invite.senderName : invite.receiverName,
                        rating: senderFirst ? senderRating : receiverRating,
                    },
                    player2: {
                        id: senderFirst ? invite.receiverId : invite.senderId,
                        name: senderFirst ? invite.receiverName : invite.senderName,
                        rating: senderFirst ? receiverRating : senderRating,
                    },
                },
                currentTurn: senderFirst ? invite.senderId : invite.receiverId,
                gameState: getInitialGameState(invite.gameType),
                settings: {
                    isRated: invite.settings.isRated,
                    chatEnabled: invite.settings.chatEnabled,
                },
                createdAt: now,
                updatedAt: now,
                startedAt: now,
                inviteId: context.params.inviteId,
            };
            // Add turn timeout if time control exists
            if (invite.settings.timeControl?.seconds) {
                game.turnExpiresAt = firestore_1.Timestamp.fromMillis(now.toMillis() + invite.settings.timeControl.seconds * 1000);
            }
            // Save game and update invite
            const batch = db.batch();
            batch.set(db.collection("TurnBasedGames").doc(gameId), game);
            batch.update(change.after.ref, { gameId });
            await batch.commit();
            functions.logger.info("Game created from invite", {
                gameId,
                gameType: invite.gameType,
                players: [invite.senderId, invite.receiverId],
            });
        }
        catch (error) {
            functions.logger.error("Failed to create game from invite", {
                inviteId: context.params.inviteId,
                error,
            });
        }
    }
});
/**
 * Get player stats document
 */
async function getPlayerStats(playerId) {
    const doc = await db.collection("PlayerGameStats").doc(playerId).get();
    return doc.exists ? doc.data() : null;
}
// =============================================================================
// Universal Invite Triggers (NEW)
// =============================================================================
/**
 * Trigger when a universal invite is updated
 *
 * Handles:
 * 1. Auto-creating game when all slots are filled (status -> 'ready')
 * 2. Syncing spectators to game document
 */
exports.onUniversalInviteUpdate = functions.firestore
    .document("GameInvites/{inviteId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const inviteId = context.params.inviteId;
    functions.logger.info("FN.onUniversalInviteUpdate.ENTER", {
        inviteId,
        beforeStatus: before?.status,
        afterStatus: after.status,
        gameType: after.gameType,
        gameId: after.gameId,
        traceId: after.traceId,
        claimedSlotsCount: after.claimedSlots?.length,
    });
    // Skip if not a universal invite (no claimedSlots means legacy invite)
    if (!after.claimedSlots || after.claimedSlots.length === 0) {
        functions.logger.info("FN.onUniversalInviteUpdate.EXIT", {
            inviteId,
            reason: "no_claimed_slots",
        });
        return;
    }
    const beforeSlotCount = before?.claimedSlots?.length ?? 0;
    const afterSlotCount = after.claimedSlots.length;
    const beforeSpectators = before?.spectators ?? [];
    const afterSpectators = after.spectators ?? [];
    const beforeStatus = before?.status;
    const afterStatus = after.status;
    functions.logger.info("Universal invite updated", {
        inviteId,
        beforeSlotCount,
        afterSlotCount,
        beforeStatus,
        afterStatus,
    });
    // ── Achievements V2: Social counters ────────────────────────────
    // Track invites sent (first slot = host creating invite)
    if (beforeSlotCount === 0 && afterSlotCount >= 1 && after.senderId) {
        await (0, socialGameStatsHelpers_1.incrementInvitesSent)(after.senderId).catch(() => { });
    }
    // Track invites accepted (new non-host slot claimed)
    if (afterSlotCount > beforeSlotCount &&
        afterSlotCount > 1 &&
        after.senderId) {
        await (0, socialGameStatsHelpers_1.incrementInvitesAccepted)(after.senderId).catch(() => { });
    }
    // CASE 1: Status changed to ready - create the game
    if (afterStatus === "ready" && beforeStatus !== "ready") {
        await createGameFromUniversalInvite(change.after.ref, after);
        return;
    }
    // CASE 2: New spectator joined - sync to game document
    if (after.gameId && afterSpectators.length > beforeSpectators.length) {
        const newSpectator = afterSpectators[afterSpectators.length - 1];
        if (!newSpectator) {
            return;
        }
        try {
            await db
                .collection("TurnBasedGames")
                .doc(after.gameId)
                .update({
                spectatorIds: firestore_1.FieldValue.arrayUnion(newSpectator.userId),
                updatedAt: firestore_1.Timestamp.now(),
            });
            functions.logger.info("Spectator synced to game", {
                gameId: after.gameId,
                spectatorId: newSpectator.userId,
            });
        }
        catch (error) {
            functions.logger.error("Failed to sync spectator to game", {
                gameId: after.gameId,
                error,
            });
        }
        return;
    }
    // CASE 3: Spectator left - sync removal to game document
    if (after.gameId && afterSpectators.length < beforeSpectators.length) {
        // Find who left by comparing spectator arrays
        const beforeIds = new Set(beforeSpectators.map((s) => s.userId));
        const afterIds = new Set(afterSpectators.map((s) => s.userId));
        const leftIds = [...beforeIds].filter((id) => !afterIds.has(id));
        try {
            for (const leftId of leftIds) {
                await db
                    .collection("TurnBasedGames")
                    .doc(after.gameId)
                    .update({
                    spectatorIds: firestore_1.FieldValue.arrayRemove(leftId),
                    updatedAt: firestore_1.Timestamp.now(),
                });
            }
            functions.logger.info("Spectator(s) removed from game", {
                gameId: after.gameId,
                leftIds,
            });
        }
        catch (error) {
            functions.logger.error("Failed to remove spectator from game", {
                gameId: after.gameId,
                error,
            });
        }
        return;
    }
});
const EXTERNAL_COLYSEUS_INVITE_GAMES = new Set([
    "crazy_eights",
    "starforge_game",
    "sketch_party_game",
    "crossword_puzzle",
    "pong_game",
    "minigolf_duels",
    "battleship",
]);
function isExternalColyseusInviteGame(gameType) {
    return EXTERNAL_COLYSEUS_INVITE_GAMES.has(gameType);
}
async function createGameFromUniversalInvite(inviteRef, invite) {
    // ── Real-time Colyseus games: skip TurnBasedGames creation ──────────
    // These games use Colyseus rooms; the session ID is derived from the
    // invite ID so both players independently resolve the same room key.
    if (isExternalColyseusInviteGame(invite.gameType)) {
        const externalId = `ext_${invite.gameType}_${invite.id}`;
        const now = firestore_1.Timestamp.now();
        functions.logger.info("Skipping TurnBasedGames creation for real-time Colyseus game", {
            inviteId: invite.id,
            gameType: invite.gameType,
            externalId,
        });
        await inviteRef.update({
            status: "active",
            gameId: externalId,
            updatedAt: now.toMillis(),
        });
        return;
    }
    const gameId = `game_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const now = firestore_1.Timestamp.now();
    functions.logger.info("Creating game from universal invite", {
        inviteId: invite.id,
        gameId,
        gameType: invite.gameType,
        playerCount: invite.claimedSlots.length,
    });
    try {
        // Build players object from claimed slots
        // For 2-player games, use player1/player2 format for compatibility
        // For 3+ player games, use playerN format
        const playerIds = [];
        const players = {};
        invite.claimedSlots.forEach((slot, index) => {
            const playerKey = `player${index + 1}`;
            players[playerKey] = {
                id: slot.playerId,
                name: slot.playerName,
                avatar: slot.playerAvatar,
                rating: DEFAULT_RATING, // NOTE: Could look up actual rating
            };
            playerIds.push(slot.playerId);
        });
        // Determine who goes first (host/sender goes first)
        const firstPlayerId = invite.claimedSlots[0].playerId;
        // Build turn order for multi-player games
        const turnOrder = playerIds.slice(); // Copy of player IDs in join order
        // Get initial game state
        const gameState = getInitialGameState(invite.gameType);
        // Build the game document
        // Use type assertion since we're extending the interface
        const game = {
            id: gameId,
            gameType: invite.gameType,
            status: "active",
            playerIds,
            players: players, // Allow dynamic player keys
            currentTurn: firstPlayerId,
            gameState,
            settings: {
                isRated: invite.settings.isRated,
                chatEnabled: invite.settings.chatEnabled,
            },
            createdAt: now,
            updatedAt: now,
            startedAt: now,
            // Extended fields for universal invites
            inviteId: invite.id,
            spectatorIds: (invite.spectators ?? []).map((s) => s.userId),
            turnOrder,
            playerCount: playerIds.length,
        };
        // Add turn timeout if time control exists
        if (invite.settings.timeControl?.seconds) {
            game.turnExpiresAt = firestore_1.Timestamp.fromMillis(now.toMillis() + invite.settings.timeControl.seconds * 1000);
        }
        // Write game and update invite in a batch
        const batch = db.batch();
        // Create the game document
        batch.set(db.collection("TurnBasedGames").doc(gameId), game);
        // Update invite with game ID and active status
        batch.update(inviteRef, {
            status: "active",
            gameId,
            updatedAt: now.toMillis(),
        });
        await batch.commit();
        functions.logger.info("Game created from universal invite", {
            gameId,
            inviteId: invite.id,
            players: playerIds,
            spectators: (invite.spectators ?? []).map((s) => s.userId),
        });
        // NOTE: Send push notifications to all players
        // await sendGameStartNotifications(playerIds, gameId, invite.gameType);
    }
    catch (error) {
        functions.logger.error("Failed to create game from universal invite", {
            inviteId: invite.id,
            error,
        });
        throw error;
    }
}
// =============================================================================
// Game Completion & Stats Update
// =============================================================================
/**
 * Process game completion
 * Updates stats, ratings, achievements, and invite status
 */
exports.processGameCompletion = functions.firestore
    .document("TurnBasedGames/{gameId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    functions.logger.info("FN.processGameCompletion.ENTER", {
        gameId: context.params.gameId,
        beforeStatus: before.status,
        afterStatus: after.status,
        gameType: after.gameType,
        inviteId: after.inviteId,
        winnerId: after.winner?.playerId,
    });
    // Only process when game ends (any terminal state)
    const terminalStates = [
        "completed",
        "resigned",
        "draw",
        "timeout",
        "abandoned",
    ];
    const wasActive = before.status === "active";
    const isTerminal = terminalStates.includes(after.status);
    if (wasActive && isTerminal) {
        try {
            // Update player stats (shared)
            await updatePlayerStats(after);
            // V1 achievements disabled — V2 evaluator handles all achievement logic
            // await checkAchievements(after);
            // ── Achievements V2 ──────────────────────────────────
            // Update per-game stats and run v2 evaluator for each player
            const playerIds = [after.players.player1.id, after.players.player2.id];
            const winnerId = after.winner?.playerId;
            for (const pid of playerIds) {
                try {
                    const outcome = !winnerId
                        ? "draw"
                        : winnerId === pid
                            ? "win"
                            : "loss";
                    await (0, achievementsV2Evaluator_1.updatePerGameStatsV2)(pid, after.gameType, outcome);
                    await (0, achievementsV2Evaluator_1.evaluateAchievementsV2)(pid);
                    // Award XP via universal pipeline
                    const xpOutcome = outcome === "loss"
                        ? "lose"
                        : outcome;
                    await awardGameXp(pid, after.gameType, xpOutcome, undefined, "turnBased");
                }
                catch (v2Err) {
                    // Non-critical — don't fail the whole completion
                    functions.logger.warn("[AchievementsV2] Player eval failed", {
                        playerId: pid,
                        error: v2Err,
                    });
                }
            }
            // Update invite status to "completed" if game was created from an invite
            // Uses canonical finalizeUniversalInvite for chat-hide + TTL
            const gameEndStatus = after.status;
            const resolutionType = gameEndStatus === "draw"
                ? "draw"
                : gameEndStatus === "resigned"
                    ? "resign"
                    : gameEndStatus === "timeout"
                        ? "timeout"
                        : "win";
            if (after.inviteId) {
                await finalizeUniversalInvite({
                    inviteId: after.inviteId,
                    terminalStatus: "completed",
                    resolutionType,
                    winnerId: after.winner?.playerId ?? null,
                    winReason: after.winner?.reason ?? null,
                    resolvedBy: "server",
                });
            }
            else {
                // Fallback: Try to find invite by gameId and finalize
                await finalizeInviteByGameId(context.params.gameId, resolutionType, after.winner?.playerId);
            }
            functions.logger.info("FN.processGameCompletion.EXIT", {
                gameId: context.params.gameId,
                gameType: after.gameType,
                winnerId: after.winner?.playerId,
                inviteId: after.inviteId,
                result: "ok",
            });
        }
        catch (error) {
            functions.logger.error("FN.processGameCompletion.EXIT", {
                gameId: context.params.gameId,
                result: "error",
                error,
            });
        }
    }
});
// =============================================================================
// Realtime Game Completion & Stats Update
// =============================================================================
/**
 * Process realtime game completion (Sketch Party, Mini Golf, etc.)
 *
 * Fires when a Colyseus room persists a finished game to RealtimeGameSessions.
 * Mirrors processGameCompletion's v2 achievement logic:
 *   1. Determine per-player outcome (win / loss / draw)
 *   2. Call updatePerGameStatsV2 with score + gameSpecific
 *   3. Run evaluateAchievementsV2 for each player
 */
exports.processRealtimeGameCompletion = functions.firestore
    .document("RealtimeGameSessions/{sessionId}")
    .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data)
        return;
    const gameType = data.gameType;
    const winnerId = data.winnerId || "";
    const players = data.players || [];
    functions.logger.info("FN.processRealtimeGameCompletion.ENTER", {
        sessionId: context.params.sessionId,
        gameType,
        winnerId,
        playerCount: players.length,
        inviteId: data.inviteId,
        firestoreGameId: data.firestoreGameId,
    });
    if (players.length === 0) {
        functions.logger.warn("[RealtimeCompletion] No players in record", {
            sessionId: context.params.sessionId,
        });
        return;
    }
    functions.logger.info("[RealtimeCompletion] Processing", {
        sessionId: context.params.sessionId,
        gameType,
        winnerId,
        playerCount: players.length,
    });
    for (const player of players) {
        try {
            // Determine outcome
            let outcome;
            if (!winnerId) {
                outcome = "draw";
            }
            else {
                outcome = winnerId === player.uid ? "win" : "loss";
            }
            await (0, achievementsV2Evaluator_1.updatePerGameStatsV2)(player.uid, gameType, outcome, player.score, player.gameSpecific);
            await (0, achievementsV2Evaluator_1.evaluateAchievementsV2)(player.uid);
            // Award XP via universal pipeline
            try {
                const xpOutcome = outcome === "loss"
                    ? "lose"
                    : outcome;
                await awardGameXp(player.uid, gameType, xpOutcome, player.score, "realtime");
            }
            catch (xpErr) {
                functions.logger.warn("[RealtimeCompletion] XP award failed", {
                    playerId: player.uid,
                    error: xpErr instanceof Error ? xpErr.message : String(xpErr),
                });
            }
        }
        catch (err) {
            // Non-critical — don't fail the whole batch
            functions.logger.warn("[RealtimeCompletion] Player eval failed", {
                playerId: player.uid,
                gameType,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    // ── Create GameHistory record for leaderboard / game-history UI ──
    try {
        const completedAt = data.completedAt?.toMillis?.()
            ? data.completedAt.toMillis()
            : Date.now();
        const gameDurationMs = data.gameDurationMs || 0;
        const startedAt = gameDurationMs
            ? completedAt - gameDurationMs
            : completedAt;
        const historyPlayers = players.map((p) => ({
            userId: p.uid,
            displayName: p.displayName,
            avatarUrl: "",
            isWinner: winnerId === p.uid,
            finalScore: p.score,
            movesPlayed: 0,
        }));
        const historyRecord = {
            gameType,
            matchId: context.params.sessionId,
            players: historyPlayers,
            playerIds: players.map((p) => p.uid),
            winnerId: winnerId || null,
            status: winnerId ? "completed" : "draw",
            endReason: data.winReason || "completion",
            startedAt,
            completedAt,
            duration: gameDurationMs,
            totalMoves: data.turnCount || 0,
            isRated: data.isRated || false,
            createdAt: Date.now(),
        };
        const historyRef = db.collection("GameHistory").doc();
        await historyRef.set({ ...historyRecord, id: historyRef.id });
        functions.logger.info(`[RealtimeCompletion] GameHistory created: ${historyRef.id}`, { gameType, winnerId });
    }
    catch (histErr) {
        functions.logger.warn("[RealtimeCompletion] GameHistory creation failed", {
            error: histErr instanceof Error ? histErr.message : String(histErr),
        });
    }
    // ── Finalize associated invite (chat-hide + TTL) ────────────────────
    // RealtimeGameSessions may carry an inviteId. If not, try parsing it
    // from the ext_<gameType>_<inviteId> format, then fall back to a
    // gameId-based search.
    try {
        let sessionInviteId = data.inviteId;
        const sessionGameId = data.firestoreGameId || context.params.sessionId;
        const resolutionType = winnerId ? "win" : "draw";
        // Parse inviteId from ext_<gameType>_<inviteId> format if not explicit.
        // IMPORTANT: invite IDs may contain underscores (e.g. uinv_mm2myqz0_ijltf8),
        // so we MUST strip the known prefix rather than splitting on last underscore.
        if (!sessionInviteId && data.firestoreGameId) {
            const fgid = data.firestoreGameId;
            if (fgid.startsWith("ext_") && gameType) {
                const prefix = `ext_${gameType}_`;
                if (fgid.startsWith(prefix) && fgid.length > prefix.length) {
                    sessionInviteId = fgid.slice(prefix.length);
                    functions.logger.info("[RealtimeCompletion] Extracted inviteId from ext_ format", { inviteId: sessionInviteId, firestoreGameId: fgid, gameType });
                }
                else {
                    functions.logger.warn("[RealtimeCompletion] ext_ prefix mismatch — cannot extract inviteId", { firestoreGameId: fgid, gameType });
                }
            }
        }
        if (sessionInviteId) {
            await finalizeUniversalInvite({
                inviteId: sessionInviteId,
                terminalStatus: "completed",
                resolutionType,
                winnerId: winnerId || null,
                winReason: data.winReason || null,
                resolvedBy: "server",
            });
        }
        else if (sessionGameId) {
            await finalizeInviteByGameId(sessionGameId, resolutionType, winnerId);
        }
    }
    catch (invErr) {
        // Non-critical — don't fail the whole pipeline
        functions.logger.warn("[RealtimeCompletion] Invite finalization failed", {
            error: invErr instanceof Error ? invErr.message : String(invErr),
        });
    }
    functions.logger.info("FN.processRealtimeGameCompletion.EXIT", {
        sessionId: context.params.sessionId,
        gameType,
        result: "ok",
    });
});
/**
 * Find invite(s) by gameId and finalize them via the canonical helper.
 * Fallback path when inviteId is not stored on the game doc.
 */
async function finalizeInviteByGameId(gameId, resolutionType, winnerId) {
    try {
        const invitesSnapshot = await db
            .collection("GameInvites")
            .where("gameId", "==", gameId)
            .limit(5)
            .get();
        if (invitesSnapshot.empty)
            return;
        for (const inviteDoc of invitesSnapshot.docs) {
            await finalizeUniversalInvite({
                inviteId: inviteDoc.id,
                terminalStatus: "completed",
                resolutionType,
                winnerId: winnerId ?? null,
                resolvedBy: "server",
            });
        }
    }
    catch (error) {
        functions.logger.error("[finalizeInviteByGameId] Failed", {
            gameId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
// =============================================================================
// Canonical Invite Finalization (Phase 1 — Server-Authoritative + Idempotent)
// =============================================================================
/** Terminal invite statuses — once reached, no further transitions are allowed. */
const INVITE_TERMINAL_STATUSES = new Set([
    "completed",
    "declined",
    "expired",
    "cancelled",
]);
/** How long (ms) to keep terminal invites before hard-delete. Default: 6 h. */
const INVITE_DELETE_DELAY_MS = 6 * 60 * 60 * 1000;
/**
 * Canonical, idempotent invite finalisation.
 *
 * Every completion path (turn-based, realtime, room, client, watchdog) MUST
 * funnel through this helper so that:
 *   1. Status is moved to a terminal value (guarded by transition rules).
 *   2. `chatVisibility` is set to `"hidden"` so chat subscriptions drop it.
 *   3. `deleteAt` is set for deferred hard-delete.
 *   4. Repeated calls are safe (idempotent).
 *
 * Uses a Firestore transaction to prevent races.
 */
async function finalizeUniversalInvite(params) {
    const { inviteId, terminalStatus, resolutionType, winnerId, winReason, resolvedBy, traceId, now = Date.now(), } = params;
    const inviteRef = db.collection("GameInvites").doc(inviteId);
    // ── Guardrail: warn if inviteId looks suspiciously short or misformatted ──
    if (inviteId.length < 10 ||
        (!inviteId.startsWith("uinv_") && !inviteId.match(/^[A-Za-z0-9]{15,}$/))) {
        functions.logger.warn("INVITE_FINALIZE_SUSPICIOUS_ID", {
            inviteId,
            length: inviteId.length,
            resolvedBy,
            traceId,
            hint: "inviteId may be truncated — expected format uinv_* or 20+ char Firestore ID",
        });
    }
    try {
        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(inviteRef);
            // ── Invite missing → treat as success (already cleaned up / deleted)
            if (!snap.exists) {
                functions.logger.warn("INVITE_FINALIZE_MISSING_DOC", {
                    inviteId,
                    resolvedBy,
                    traceId,
                });
                return { success: true, alreadyTerminal: true };
            }
            const invite = snap.data();
            // ── Already terminal → ensure chat-hide + deleteAt are set, then return
            if (INVITE_TERMINAL_STATUSES.has(invite.status)) {
                const patch = {};
                if (invite.chatVisibility !== "hidden") {
                    patch.chatVisibility = "hidden";
                    patch.chatHiddenAt = now;
                }
                if (!invite.deleteAt) {
                    patch.deleteAt = now + INVITE_DELETE_DELAY_MS;
                }
                if (!invite.resolvedAt) {
                    patch.resolvedAt = now;
                }
                // Backfill chatHiddenInConversationIds if missing
                if ((!invite.chatHiddenInConversationIds ||
                    invite.chatHiddenInConversationIds.length === 0) &&
                    invite.conversationId) {
                    patch.chatHiddenInConversationIds = [invite.conversationId];
                }
                if (Object.keys(patch).length > 0) {
                    patch.updatedAt = now;
                    tx.update(inviteRef, patch);
                }
                return { success: true, alreadyTerminal: true };
            }
            // ── Build the update payload ──────────────────────────────────────
            const updates = {
                status: terminalStatus,
                resolvedAt: now,
                resolvedBy,
                chatVisibility: "hidden",
                chatHiddenAt: now,
                deleteAt: now + INVITE_DELETE_DELAY_MS,
                completedAt: now,
                updatedAt: now,
            };
            if (resolutionType)
                updates.resolutionType = resolutionType;
            if (winnerId !== undefined)
                updates.winnerId = winnerId ?? null;
            if (winReason !== undefined)
                updates.winReason = winReason ?? null;
            // Populate chatHiddenInConversationIds from conversationId
            if (invite.conversationId) {
                updates.chatHiddenInConversationIds = [invite.conversationId];
            }
            tx.update(inviteRef, updates);
            return { success: true, alreadyTerminal: false };
        });
        if (result.success && !result.alreadyTerminal) {
            functions.logger.info("FN.finalizeUniversalInvite.RESULT", {
                inviteId,
                terminalStatus,
                resolutionType,
                resolvedBy,
                traceId,
                alreadyTerminal: false,
                fieldsWritten: {
                    chatVisibility: "hidden",
                    deleteAt: `${now} + 6h`,
                    resolvedAt: now,
                    completedAt: now,
                },
            });
        }
        else if (result.success && result.alreadyTerminal) {
            functions.logger.info("FN.finalizeUniversalInvite.RESULT", {
                inviteId,
                terminalStatus,
                resolvedBy,
                traceId,
                alreadyTerminal: true,
            });
        }
        return result;
    }
    catch (error) {
        functions.logger.error("FN.finalizeUniversalInvite.RESULT", {
            inviteId,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            traceId,
        });
        return { success: false };
    }
}
/**
 * Create GameHistory record when a game completes
 *
 * Triggers when a TurnBasedGame document's status changes to a terminal state.
 * Creates a permanent record in the GameHistory collection for:
 * - Player history and statistics
 * - Head-to-head records
 * - Achievement tracking
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 1
 */
exports.onGameCompletedCreateHistory = functions.firestore
    .document("TurnBasedGames/{gameId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Terminal states that should create history records
    const terminalStates = [
        "completed",
        "resigned",
        "draw",
        "timeout",
        "abandoned",
    ];
    const wasTerminal = terminalStates.includes(before.status);
    const isTerminal = terminalStates.includes(after.status);
    // Only process when transitioning TO a terminal state
    if (wasTerminal || !isTerminal)
        return;
    const gameId = context.params.gameId;
    functions.logger.info(`Creating GameHistory for game ${gameId}`, {
        status: after.status,
        gameType: after.gameType,
    });
    try {
        // Determine end reason from status and game state
        let endReason = "completion";
        if (after.status === "abandoned") {
            endReason = "abandonment";
        }
        else if (after.winner?.reason === "resignation") {
            endReason = "resignation";
        }
        else if (after.winner?.reason === "timeout") {
            endReason = "timeout";
        }
        else if (after.status === "draw") {
            // Note: 'draw' status may be added in future, using 'any' for forward compatibility
            endReason = "draw_agreement";
        }
        else if (after.gameType === "chess") {
            // Chess-specific end reasons
            if (after.gameState?.isCheckmate) {
                endReason = "checkmate";
            }
            else if (after.gameState?.isStalemate) {
                endReason = "stalemate";
            }
        }
        else if (after.gameType === "checkers" && !after.winner) {
            endReason = "no_moves";
        }
        const { player1, player2 } = after.players;
        const winnerId = after.winner?.playerId;
        // Calculate move counts per player
        const moves = after.gameState?.moveHistory || [];
        const player1Moves = moves.filter((m) => m.playerId === player1.id).length;
        const player2Moves = moves.filter((m) => m.playerId === player2.id).length;
        // Build player records for history
        const players = [
            {
                userId: player1.id,
                displayName: player1.name,
                avatarUrl: player1.avatar,
                isWinner: winnerId === player1.id,
                finalScore: undefined, // Could be populated for scored games
                movesPlayed: player1Moves,
                ratingBefore: player1.rating,
                ratingAfter: undefined, // Set by updatePlayerStats
            },
            {
                userId: player2.id,
                displayName: player2.name,
                avatarUrl: player2.avatar,
                isWinner: winnerId === player2.id,
                finalScore: undefined,
                movesPlayed: player2Moves,
                ratingBefore: player2.rating,
                ratingAfter: undefined,
            },
        ];
        // Calculate timestamps and duration
        const createdAtValue = after.createdAt;
        const startedAt = typeof createdAtValue === "number"
            ? createdAtValue
            : createdAtValue?.toMillis?.() || Date.now();
        const endedAtValue = after.endedAt;
        const completedAt = typeof endedAtValue === "number"
            ? endedAtValue
            : endedAtValue?.toMillis?.() || Date.now();
        const duration = completedAt - startedAt;
        // Create history record
        const historyRecord = {
            gameType: after.gameType,
            matchId: gameId,
            players,
            playerIds: [player1.id, player2.id], // For array-contains queries
            winnerId: winnerId || null,
            status: after.status,
            endReason,
            conversationId: after.inviteId
                ? undefined
                : after.conversationId, // Will be set when context tracking is added
            conversationType: after.conversationType,
            startedAt,
            completedAt,
            duration,
            totalMoves: moves.length,
            isRated: after.settings?.isRated || false,
            createdAt: Date.now(),
        };
        // Write to GameHistory collection
        const historyRef = db.collection("GameHistory").doc();
        await historyRef.set({
            ...historyRecord,
            id: historyRef.id,
        });
        // Strip heavy fields from the original match document now that
        // a lightweight GameHistory record has been created.  This reduces
        // Firestore storage costs and the bandwidth of any future reads
        // against the TurnBasedGames collection (e.g. cleanupOldGames).
        try {
            const gameRef = db.collection("TurnBasedGames").doc(gameId);
            await gameRef.update({
                gameState: admin.firestore.FieldValue.delete(),
                moveHistory: admin.firestore.FieldValue.delete(),
            });
            functions.logger.info(`Stripped gameState/moveHistory from game ${gameId}`);
        }
        catch (stripError) {
            // Non-critical — the data will still be cleaned up by cleanupOldGames
            functions.logger.warn(`Failed to strip heavy fields from game ${gameId}`, { error: stripError });
        }
        functions.logger.info(`GameHistory created: ${historyRef.id}`, {
            gameId,
            gameType: after.gameType,
            winnerId,
            duration,
        });
    }
    catch (error) {
        functions.logger.error(`Failed to create GameHistory for ${gameId}`, {
            error,
            gameType: after.gameType,
        });
        // Don't throw - this is a non-critical operation
    }
});
// =============================================================================
// Phase 8: Leaderboard Stats Update
// =============================================================================
/**
 * Update LeaderboardStats when a GameHistory record is created
 *
 * This function maintains the LeaderboardStats collection which powers
 * the multiplayer leaderboards. It updates stats for both players and
 * for both game-specific and "all" categories.
 *
 * Triggered when a new GameHistory document is created.
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 8
 */
exports.onGameHistoryCreatedUpdateLeaderboard = functions.firestore
    .document("GameHistory/{historyId}")
    .onCreate(async (snapshot, context) => {
    const history = snapshot.data();
    if (!history)
        return;
    const historyId = context.params.historyId;
    functions.logger.info(`Updating LeaderboardStats for history ${historyId}`, {
        gameType: history.gameType,
        playerCount: history.players?.length,
    });
    try {
        const batch = db.batch();
        const now = firestore_1.Timestamp.now();
        const gameType = history.gameType;
        // Process each player
        for (const player of history.players || []) {
            const userId = player.userId;
            const displayName = player.displayName;
            const avatarUrl = player.avatarUrl;
            const isWinner = player.isWinner;
            const isDraw = !history.winnerId;
            // Update stats for: game-specific + "all" combined
            const gameTypes = [gameType, "all"];
            // Update for all timeframes
            const timeframes = ["all-time", "monthly", "weekly"];
            for (const gt of gameTypes) {
                for (const timeframe of timeframes) {
                    const docId = `${userId}_${gt}_${timeframe}`;
                    const statsRef = db.collection("LeaderboardStats").doc(docId);
                    // Get current stats
                    const currentDoc = await statsRef.get();
                    const current = currentDoc.exists
                        ? currentDoc.data()
                        : {
                            userId,
                            displayName,
                            avatarUrl,
                            gameType: gt,
                            timeframe,
                            rating: DEFAULT_RATING,
                            wins: 0,
                            losses: 0,
                            draws: 0,
                            gamesPlayed: 0,
                            winRate: 0,
                            currentStreak: 0,
                            longestStreak: 0,
                            lastGameAt: now.toMillis(),
                            createdAt: now.toMillis(),
                            updatedAt: now.toMillis(),
                        };
                    // Calculate new stats
                    const newGamesPlayed = (current.gamesPlayed || 0) + 1;
                    let newWins = current.wins || 0;
                    let newLosses = current.losses || 0;
                    let newDraws = current.draws || 0;
                    let newCurrentStreak = current.currentStreak || 0;
                    let newLongestStreak = current.longestStreak || 0;
                    if (isDraw) {
                        newDraws++;
                        newCurrentStreak = 0; // Streak resets on draw
                    }
                    else if (isWinner) {
                        newWins++;
                        newCurrentStreak = Math.max(1, newCurrentStreak + 1);
                        newLongestStreak = Math.max(newLongestStreak, newCurrentStreak);
                    }
                    else {
                        newLosses++;
                        newCurrentStreak = Math.min(-1, newCurrentStreak - 1);
                    }
                    const newWinRate = newGamesPlayed > 0 ? (newWins / newGamesPlayed) * 100 : 0;
                    // Calculate new rating (only for game-specific, not "all")
                    let newRating = current.rating || DEFAULT_RATING;
                    if (gt !== "all" && player.ratingAfter) {
                        newRating = player.ratingAfter;
                    }
                    // Prepare update
                    const update = {
                        userId,
                        displayName,
                        avatarUrl,
                        gameType: gt,
                        timeframe,
                        rating: newRating,
                        wins: newWins,
                        losses: newLosses,
                        draws: newDraws,
                        gamesPlayed: newGamesPlayed,
                        winRate: Math.round(newWinRate * 100) / 100,
                        currentStreak: newCurrentStreak,
                        longestStreak: newLongestStreak,
                        lastGameAt: now.toMillis(),
                        updatedAt: now.toMillis(),
                        createdAt: current.createdAt || now.toMillis(),
                    };
                    batch.set(statsRef, update);
                }
            }
        }
        await batch.commit();
        functions.logger.info(`LeaderboardStats updated for history ${historyId}`, {
            gameType: history.gameType,
            players: history.players?.map((p) => p.userId),
        });
    }
    catch (error) {
        functions.logger.error(`Failed to update LeaderboardStats for ${historyId}`, {
            error,
            gameType: history.gameType,
        });
        // Don't throw - this is a non-critical operation
    }
});
/**
 * Update player statistics after a game
 */
async function updatePlayerStats(game) {
    const { player1, player2 } = game.players;
    const winnerId = game.winner?.playerId;
    // Determine outcomes
    let player1Outcome;
    let player2Outcome;
    if (!winnerId) {
        player1Outcome = "draw";
        player2Outcome = "draw";
    }
    else if (winnerId === player1.id) {
        player1Outcome = "win";
        player2Outcome = "loss";
    }
    else {
        player1Outcome = "loss";
        player2Outcome = "win";
    }
    // Calculate new ratings if rated game
    let player1NewRating = player1.rating ?? DEFAULT_RATING;
    let player2NewRating = player2.rating ?? DEFAULT_RATING;
    if (game.settings.isRated) {
        const player1Expected = calculateExpectedScore(player1.rating ?? DEFAULT_RATING, player2.rating ?? DEFAULT_RATING);
        const player2Expected = 1 - player1Expected;
        const player1Score = player1Outcome === "win" ? 1 : player1Outcome === "draw" ? 0.5 : 0;
        const player2Score = 1 - player1Score;
        player1NewRating = calculateNewRating(player1.rating ?? DEFAULT_RATING, player1Expected, player1Score, 32);
        player2NewRating = calculateNewRating(player2.rating ?? DEFAULT_RATING, player2Expected, player2Score, 32);
    }
    // Calculate duration
    const durationSeconds = game.endedAt
        ? Math.round((game.endedAt.toMillis() - game.startedAt.toMillis()) / 1000)
        : 0;
    // Update both players
    await Promise.all([
        updateSinglePlayerStats(player1.id, game.gameType, player1Outcome, player1NewRating, durationSeconds),
        updateSinglePlayerStats(player2.id, game.gameType, player2Outcome, player2NewRating, durationSeconds),
    ]);
}
/**
 * Update a single player's stats
 */
async function updateSinglePlayerStats(playerId, gameType, outcome, newRating, durationSeconds) {
    const docRef = db.collection("PlayerGameStats").doc(playerId);
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        const now = firestore_1.Timestamp.now();
        let data;
        if (doc.exists) {
            data = doc.data();
        }
        else {
            data = {
                playerId,
                gameStats: {},
                overall: {
                    totalGamesPlayed: 0,
                    totalGamesCompleted: 0,
                    totalPlayTime: 0,
                    totalWins: 0,
                    totalLosses: 0,
                    totalDraws: 0,
                    lastGameAt: now,
                },
                createdAt: now,
                updatedAt: now,
            };
        }
        // Initialize game stats if needed
        if (!data.gameStats[gameType]) {
            data.gameStats[gameType] = {
                gameType,
                gamesPlayed: 0,
                gamesCompleted: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                rating: DEFAULT_RATING,
                peakRating: DEFAULT_RATING,
                winStreak: 0,
                bestWinStreak: 0,
                currentStreak: 0,
                totalPlayTime: 0,
                firstPlayedAt: now,
                lastPlayedAt: now,
            };
        }
        const stats = data.gameStats[gameType];
        // Update game stats
        stats.gamesPlayed++;
        stats.gamesCompleted++;
        stats.totalPlayTime += durationSeconds;
        stats.lastPlayedAt = now;
        stats.rating = newRating;
        stats.peakRating = Math.max(stats.peakRating ?? 0, newRating);
        if (outcome === "win") {
            stats.wins = (stats.wins ?? 0) + 1;
            stats.currentStreak = Math.max(1, (stats.currentStreak ?? 0) + 1);
            stats.winStreak = (stats.winStreak ?? 0) + 1;
            stats.bestWinStreak = Math.max(stats.bestWinStreak ?? 0, stats.winStreak ?? 0);
        }
        else if (outcome === "loss") {
            stats.losses = (stats.losses ?? 0) + 1;
            stats.currentStreak = Math.min(-1, (stats.currentStreak ?? 0) - 1);
            stats.winStreak = 0;
        }
        else {
            stats.draws = (stats.draws ?? 0) + 1;
            stats.currentStreak = 0;
            stats.winStreak = 0;
        }
        // Update overall stats
        data.overall.totalGamesPlayed++;
        data.overall.totalGamesCompleted++;
        data.overall.totalPlayTime += durationSeconds;
        data.overall.lastGameAt = now;
        if (outcome === "win") {
            data.overall.totalWins++;
        }
        else if (outcome === "loss") {
            data.overall.totalLosses++;
        }
        else {
            data.overall.totalDraws++;
        }
        data.updatedAt = now;
        transaction.set(docRef, data);
    });
}
// =============================================================================
// Achievements
// =============================================================================
/**
 * Check and award achievements after a game
 */
async function checkAchievements(game) {
    const playerIds = [game.players.player1.id, game.players.player2.id];
    for (const playerId of playerIds) {
        await checkPlayerAchievements(playerId, game);
    }
}
/**
 * Check achievements for a specific player
 */
async function checkPlayerAchievements(playerId, game) {
    const statsDoc = await getPlayerStats(playerId);
    if (!statsDoc)
        return;
    const achievementsRef = db.collection("PlayerAchievements").doc(playerId);
    const achievementsDoc = await achievementsRef.get();
    const achievements = achievementsDoc.exists
        ? achievementsDoc.data()
        : {
            playerId,
            progress: {},
            totalUnlocked: 0,
            totalAvailable: 50,
            unlockedByTier: {
                bronze: 0,
                silver: 0,
                gold: 0,
                platinum: 0,
                diamond: 0,
            },
            totalCoinsEarned: 0,
            totalXpEarned: 0,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        };
    const gameStats = statsDoc.gameStats[game.gameType];
    if (!gameStats)
        return;
    // Check game count achievements
    const gameCountChecks = [
        { id: "first_game", threshold: 1 },
        { id: "games_10", threshold: 10 },
        { id: "games_50", threshold: 50 },
        { id: "games_100", threshold: 100 },
    ];
    for (const check of gameCountChecks) {
        await updateAchievementProgress(achievements, check.id, statsDoc.overall.totalGamesPlayed, check.threshold);
    }
    // Check win count achievements
    const winCountChecks = [
        { id: "first_win", threshold: 1 },
        { id: "wins_10", threshold: 10 },
        { id: "wins_50", threshold: 50 },
    ];
    for (const check of winCountChecks) {
        await updateAchievementProgress(achievements, check.id, statsDoc.overall.totalWins, check.threshold);
    }
    // Check win streak achievements
    const streakChecks = [
        { id: "win_streak_3", threshold: 3 },
        { id: "win_streak_5", threshold: 5 },
        { id: "win_streak_10", threshold: 10 },
    ];
    for (const check of streakChecks) {
        await updateAchievementProgress(achievements, check.id, gameStats.bestWinStreak ?? 0, check.threshold);
    }
    // Check rating achievements
    const ratingChecks = [
        { id: "rating_1300", threshold: 1300 },
        { id: "rating_1500", threshold: 1500 },
        { id: "rating_1800", threshold: 1800 },
        { id: "rating_2000", threshold: 2000 },
    ];
    for (const check of ratingChecks) {
        await updateAchievementProgress(achievements, check.id, gameStats.peakRating ?? DEFAULT_RATING, check.threshold);
    }
    // Save achievements
    achievements.updatedAt = firestore_1.Timestamp.now();
    await achievementsRef.set(achievements);
}
/**
 * Update achievement progress
 */
function updateAchievementProgress(achievements, achievementId, currentValue, threshold) {
    if (!achievements.progress[achievementId]) {
        achievements.progress[achievementId] = {
            achievementId,
            currentValue: 0,
            threshold,
            percentComplete: 0,
            unlocked: false,
            rewardsClaimed: false,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        };
    }
    const progress = achievements.progress[achievementId];
    const wasUnlocked = progress.unlocked;
    progress.currentValue = Math.max(progress.currentValue, currentValue);
    progress.percentComplete = Math.min(100, (progress.currentValue / threshold) * 100);
    progress.updatedAt = firestore_1.Timestamp.now();
    if (!wasUnlocked && progress.currentValue >= threshold) {
        progress.unlocked = true;
        progress.unlockedAt = firestore_1.Timestamp.now();
        achievements.totalUnlocked++;
        functions.logger.info("Achievement unlocked", {
            achievementId,
            playerId: achievements.playerId,
        });
    }
}
// =============================================================================
// Matchmaking Background Processing
// =============================================================================
/**
 * Scheduled function to process matchmaking queue
 * Runs every minute to find and create matches
 */
exports.processMatchmakingQueue = functions.pubsub
    .schedule("every 1 minutes")
    .onRun(async () => {
    const gameTypes = [
        "chess",
        "checkers",
        "tic_tac_toe",
        "crazy_eights",
    ];
    for (const gameType of gameTypes) {
        await processGameTypeQueue(gameType);
    }
    return null;
});
/**
 * Process queue for a specific game type
 */
async function processGameTypeQueue(gameType) {
    const now = firestore_1.Timestamp.now();
    // Get all searching entries for this game type
    const snapshot = await db
        .collection("MatchmakingQueue")
        .where("gameType", "==", gameType)
        .where("status", "==", "searching")
        .orderBy("createdAt", "asc")
        .get();
    if (snapshot.empty || snapshot.size < 2) {
        return;
    }
    const entries = snapshot.docs.map((doc) => ({
        ref: doc.ref,
        data: doc.data(),
    }));
    // Try to match players
    const matched = new Set();
    for (let i = 0; i < entries.length; i++) {
        if (matched.has(entries[i].data.id))
            continue;
        const player1 = entries[i];
        const player1Seconds = (now.toMillis() - player1.data.createdAt.toMillis()) / 1000;
        const player1Range = calculateCurrentRange(player1.data.initialRatingRange, player1.data.maxRatingRange, player1.data.rangeExpansionRate, player1Seconds);
        // Find best match for player1
        let bestMatch = null;
        let bestScore = Infinity;
        for (let j = i + 1; j < entries.length; j++) {
            if (matched.has(entries[j].data.id))
                continue;
            const player2 = entries[j];
            const player2Seconds = (now.toMillis() - player2.data.createdAt.toMillis()) / 1000;
            const player2Range = calculateCurrentRange(player2.data.initialRatingRange, player2.data.maxRatingRange, player2.data.rangeExpansionRate, player2Seconds);
            // Check if rated preference matches
            if (player1.data.isRated !== player2.data.isRated)
                continue;
            // Check if within range
            const ratingDiff = Math.abs(player1.data.rating - player2.data.rating);
            if (ratingDiff > player1Range || ratingDiff > player2Range)
                continue;
            // Score match (lower is better)
            const score = ratingDiff;
            if (score < bestScore) {
                bestScore = score;
                bestMatch = player2;
            }
        }
        if (bestMatch) {
            // Create match
            await createMatchFromQueue(player1, bestMatch, gameType);
            matched.add(player1.data.id);
            matched.add(bestMatch.data.id);
        }
    }
}
/**
 * Calculate current rating range based on time in queue
 */
function calculateCurrentRange(initialRange, maxRange, expansionRate, secondsInQueue) {
    return Math.min(initialRange + expansionRate * secondsInQueue, maxRange);
}
/**
 * Create a game match from queue entries
 */
async function createMatchFromQueue(player1Entry, player2Entry, gameType) {
    const now = firestore_1.Timestamp.now();
    const gameId = `game_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    // Randomly decide who goes first
    const player1First = Math.random() < 0.5;
    const game = {
        id: gameId,
        gameType,
        status: "active",
        playerIds: [player1Entry.data.playerId, player2Entry.data.playerId],
        players: {
            player1: {
                id: player1First
                    ? player1Entry.data.playerId
                    : player2Entry.data.playerId,
                name: player1First
                    ? player1Entry.data.playerName
                    : player2Entry.data.playerName,
                avatar: player1First
                    ? player1Entry.data.playerAvatar
                    : player2Entry.data.playerAvatar,
                rating: player1First
                    ? player1Entry.data.rating
                    : player2Entry.data.rating,
            },
            player2: {
                id: player1First
                    ? player2Entry.data.playerId
                    : player1Entry.data.playerId,
                name: player1First
                    ? player2Entry.data.playerName
                    : player1Entry.data.playerName,
                avatar: player1First
                    ? player2Entry.data.playerAvatar
                    : player1Entry.data.playerAvatar,
                rating: player1First
                    ? player2Entry.data.rating
                    : player1Entry.data.rating,
            },
        },
        currentTurn: player1First
            ? player1Entry.data.playerId
            : player2Entry.data.playerId,
        gameState: getInitialGameState(gameType),
        settings: {
            isRated: player1Entry.data.isRated,
            chatEnabled: true,
        },
        createdAt: now,
        updatedAt: now,
        startedAt: now,
    };
    // Use batch write
    const batch = db.batch();
    batch.set(db.collection("TurnBasedGames").doc(gameId), game);
    batch.update(player1Entry.ref, {
        status: "matched",
        matchedWith: player2Entry.data.playerId,
        gameId,
        matchedAt: now,
        updatedAt: now,
    });
    batch.update(player2Entry.ref, {
        status: "matched",
        matchedWith: player1Entry.data.playerId,
        gameId,
        matchedAt: now,
        updatedAt: now,
    });
    await batch.commit();
    functions.logger.info("Match created from queue", {
        gameId,
        gameType,
        players: [player1Entry.data.playerId, player2Entry.data.playerId],
    });
}
// =============================================================================
// Cleanup Functions
// =============================================================================
/**
 * Expire old invites daily.
 *
 * Uses finalizeUniversalInvite per-invite to guarantee chat-hide + deleteAt
 * fields are set atomically. Falls back to batch update if finalize fails.
 */
exports.expireGameInvites = functions.pubsub
    .schedule("every day 00:00")
    .onRun(async () => {
    const now = firestore_1.Timestamp.now();
    const nowMs = now.toMillis();
    // Expire any invite still waiting for players, not just "pending"
    const EXPIRABLE_STATUSES = ["pending", "filling", "ready"];
    let totalExpired = 0;
    for (const status of EXPIRABLE_STATUSES) {
        const snapshot = await db
            .collection("GameInvites")
            .where("status", "==", status)
            .where("expiresAt", "<", now)
            .limit(500)
            .get();
        for (const inviteDoc of snapshot.docs) {
            try {
                await finalizeUniversalInvite({
                    inviteId: inviteDoc.id,
                    terminalStatus: "expired",
                    resolutionType: "expire",
                    resolvedBy: "server",
                    now: nowMs,
                });
                totalExpired++;
            }
            catch (err) {
                functions.logger.warn("[expireGameInvites] Finalize failed for invite", {
                    inviteId: inviteDoc.id,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
    }
    if (totalExpired > 0) {
        functions.logger.info("Expired game invites", { count: totalExpired });
    }
    return null;
});
/**
 * Expire stale matchmaking entries
 */
exports.expireMatchmakingEntries = functions.pubsub
    .schedule("every 5 minutes")
    .onRun(async () => {
    const now = firestore_1.Timestamp.now();
    const snapshot = await db
        .collection("MatchmakingQueue")
        .where("status", "==", "searching")
        .where("expiresAt", "<", now)
        .get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
            status: "expired",
            updatedAt: now,
        });
    });
    await batch.commit();
    if (snapshot.size > 0) {
        functions.logger.info("Expired matchmaking entries", {
            count: snapshot.size,
        });
    }
    return null;
});
/**
 * Clean up old completed games (keep for 90 days)
 *
 * Queries by `endedAt` first, then falls back to `updatedAt` to catch games
 * that were completed before the endedAt fix was deployed.
 * Also recursively deletes subcollections (Moves, Spectators, MatchChat).
 */
exports.cleanupOldGames = functions.pubsub
    .schedule("every day 02:00")
    .onRun(async () => {
    const cutoff = firestore_1.Timestamp.fromMillis(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const SUBCOLLECTIONS = ["Moves", "Spectators", "MatchChat"];
    let totalDeleted = 0;
    // Helper: delete a document and its known subcollections
    async function deleteGameDoc(docRef) {
        for (const sub of SUBCOLLECTIONS) {
            const subSnap = await docRef.collection(sub).limit(500).get();
            if (!subSnap.empty) {
                const subBatch = db.batch();
                subSnap.docs.forEach((d) => subBatch.delete(d.ref));
                await subBatch.commit();
            }
        }
        await docRef.delete();
    }
    // 1️⃣ Primary query: games with endedAt set
    const endedAtSnap = await db
        .collection("TurnBasedGames")
        .where("status", "in", ["completed", "abandoned"])
        .where("endedAt", "<", cutoff)
        .limit(500)
        .get();
    for (const gameDoc of endedAtSnap.docs) {
        await deleteGameDoc(gameDoc.ref);
        totalDeleted++;
    }
    // 2️⃣ Fallback query: legacy games that never received an endedAt field.
    //    Use updatedAt instead so they aren't stranded forever.
    const remaining = 500 - totalDeleted;
    if (remaining > 0) {
        const fallbackSnap = await db
            .collection("TurnBasedGames")
            .where("status", "in", ["completed", "abandoned"])
            .where("updatedAt", "<", cutoff)
            .limit(remaining)
            .get();
        // Filter out any docs that DO have an endedAt (already handled above)
        for (const gameDoc of fallbackSnap.docs) {
            const data = gameDoc.data();
            if (!data.endedAt) {
                await deleteGameDoc(gameDoc.ref);
                totalDeleted++;
            }
        }
    }
    if (totalDeleted > 0) {
        functions.logger.info("Cleaned up old games", {
            count: totalDeleted,
        });
    }
    return null;
});
/**
 * Clean up resolved game invites (accepted/declined/cancelled/expired)
 *
 * Three-pass strategy:
 *   1. Hard-delete invites whose `deleteAt` has passed (new field).
 *   2. Self-heal legacy terminal invites missing `chatVisibility` → set "hidden".
 *   3. Fall back to deleting terminal invites older than 30 days by createdAt.
 *
 * Runs daily at 02:30 (offset from cleanupOldGames to avoid contention).
 */
exports.cleanupResolvedInvites = functions.pubsub
    .schedule("every day 02:30")
    .onRun(async () => {
    const now = Date.now();
    const cutoff30d = firestore_1.Timestamp.fromMillis(now - 30 * 24 * 60 * 60 * 1000);
    const TERMINAL_STATUSES = [
        "accepted",
        "declined",
        "cancelled",
        "expired",
        "completed",
    ];
    let totalDeleted = 0;
    let totalHealed = 0;
    // ── Pass 1: delete invites whose deleteAt has passed ─────────────
    try {
        const ttlSnap = await db
            .collection("GameInvites")
            .where("deleteAt", "<", now)
            .limit(500)
            .get();
        if (!ttlSnap.empty) {
            const batch = db.batch();
            ttlSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            totalDeleted += ttlSnap.size;
        }
    }
    catch (err) {
        functions.logger.warn("[cleanupResolvedInvites] TTL pass failed", {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    // ── Pass 2: self-heal terminal invites still visible ──────────────
    // Use "!=" to catch BOTH chatVisibility: "visible" AND invites
    // where chatVisibility is missing/unset (Firestore "==" doesn't
    // match missing fields, so "== visible" missed undefined values).
    for (const status of TERMINAL_STATUSES) {
        try {
            const visibleSnap = await db
                .collection("GameInvites")
                .where("status", "==", status)
                .where("chatVisibility", "!=", "hidden")
                .limit(200)
                .get();
            if (!visibleSnap.empty) {
                const batch = db.batch();
                visibleSnap.docs.forEach((d) => {
                    const data = d.data();
                    batch.update(d.ref, {
                        chatVisibility: "hidden",
                        chatHiddenAt: now,
                        chatHiddenInConversationIds: data.conversationId
                            ? [data.conversationId]
                            : [],
                        deleteAt: data.deleteAt || now + 6 * 60 * 60 * 1000,
                        updatedAt: now,
                    });
                });
                await batch.commit();
                totalHealed += visibleSnap.size;
            }
        }
        catch (err) {
            functions.logger.warn("[cleanupResolvedInvites] Heal pass failed", {
                status,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    // ── Pass 3: legacy fallback — delete old terminal invites by createdAt
    try {
        const legacySnap = await db
            .collection("GameInvites")
            .where("status", "in", TERMINAL_STATUSES)
            .where("createdAt", "<", cutoff30d)
            .limit(500)
            .get();
        if (!legacySnap.empty) {
            const batch = db.batch();
            legacySnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            totalDeleted += legacySnap.size;
        }
    }
    catch (err) {
        functions.logger.warn("[cleanupResolvedInvites] Legacy pass failed", {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    if (totalDeleted > 0 || totalHealed > 0) {
        functions.logger.info("Cleaned up resolved invites", {
            deleted: totalDeleted,
            healed: totalHealed,
        });
    }
    return null;
});
/**
 * Clean up stale matchmaking queue entries.
 *
 * `expireMatchmakingEntries` marks entries as "expired" but never deletes them,
 * causing the MatchmakingQueue collection to grow unbounded. This function
 * deletes entries in terminal states (expired, matched, cancelled) older than
 * 7 days. Runs daily at 03:00.
 */
exports.cleanupStaleMatchmakingEntries = functions.pubsub
    .schedule("every day 03:00")
    .onRun(async () => {
    const cutoff = firestore_1.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const TERMINAL_STATUSES = ["expired", "matched", "cancelled"];
    let totalDeleted = 0;
    for (const status of TERMINAL_STATUSES) {
        const snapshot = await db
            .collection("MatchmakingQueue")
            .where("status", "==", status)
            .where("updatedAt", "<", cutoff)
            .limit(500)
            .get();
        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            totalDeleted += snapshot.size;
        }
    }
    if (totalDeleted > 0) {
        functions.logger.info("Cleaned up stale matchmaking entries", {
            count: totalDeleted,
        });
    }
    return null;
});
/**
 * Clean up vacant multiplayer games after their grace period expires.
 *
 * When all players disconnect from a Colyseus room, the server marks the
 * corresponding Firestore doc as "vacant" with a vacantSince timestamp.
 *
 * Deletion windows:
 *   - Non-turn-based (physics/score-race): 10 minutes
 *   - Turn-based: 2 days
 *
 * Runs every 5 minutes. Deletes from ColyseusGameState, TurnBasedGames,
 * RealtimeGameSessions, and the associated GameInvite (if linked).
 */
exports.cleanupVacantGames = functions.pubsub
    .schedule("every 5 minutes")
    .onRun(async () => {
    const now = Date.now();
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
    let totalDeleted = 0;
    const snapshot = await db
        .collection("ColyseusGameState")
        .where("status", "==", "vacant")
        .limit(500)
        .get();
    if (snapshot.empty) {
        return null;
    }
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const vacantSince = data.vacantSince?.toMillis?.() ?? 0;
        if (!vacantSince)
            continue;
        const elapsed = now - vacantSince;
        const isTurnBased = data.isTurnBased === true;
        const threshold = isTurnBased ? TWO_DAYS_MS : TEN_MINUTES_MS;
        if (elapsed < threshold)
            continue;
        // Grace period expired — delete across all related collections
        const gameId = doc.id;
        const batch = db.batch();
        batch.delete(doc.ref);
        const tbDoc = await db.collection("TurnBasedGames").doc(gameId).get();
        if (tbDoc.exists)
            batch.delete(tbDoc.ref);
        const rtDoc = await db
            .collection("RealtimeGameSessions")
            .doc(gameId)
            .get();
        if (rtDoc.exists)
            batch.delete(rtDoc.ref);
        // Find and finalize the linked invite (if any) — then delete game docs
        if (data.inviteId) {
            await finalizeUniversalInvite({
                inviteId: data.inviteId,
                terminalStatus: "cancelled",
                resolutionType: "disconnect",
                resolvedBy: "watchdog",
            });
        }
        await batch.commit();
        totalDeleted++;
    }
    if (totalDeleted > 0) {
        functions.logger.info("Cleaned up vacant games", {
            count: totalDeleted,
        });
    }
    return null;
});
// =============================================================================
// Watchdog: Reconcile Active Invites
// =============================================================================
/**
 * Safely extract a millisecond timestamp from a value that may be a Firestore
 * Timestamp or a plain number.  Returns 0 if the value is falsy.
 */
function extractMillis(value) {
    if (!value)
        return 0;
    if (typeof value === "number")
        return value;
    // Firestore Timestamp has a toMillis() method
    if (typeof value.toMillis === "function") {
        return value.toMillis();
    }
    // Fallback for serialized Timestamp objects (e.g. from JSON)
    if (typeof value._seconds === "number") {
        return value._seconds * 1000;
    }
    return 0;
}
/**
 * Watchdog reconciliation — catches "stuck" invites that escaped all other
 * finalization paths.
 *
 * Runs every 15 minutes and checks for:
 *
 * 1. **Stuck `active` invites** — if the invite has been `active` longer than
 *    the threshold (2 h for realtime, 7 d for turn-based) AND the backing
 *    game doc is missing/completed, finalize the invite.
 *
 * 2. **Stuck `starting` invites** — if the invite has been in `starting`
 *    status for > 10 minutes, the match-creation likely failed.  Finalize
 *    as cancelled.
 *
 * 3. **Self-heal pass** — any terminal invite still showing
 *    `chatVisibility: "visible"` is patched (same as cleanupResolvedInvites
 *    Pass 2 but at higher frequency).
 *
 * All finalization goes through `finalizeUniversalInvite` for idempotency.
 */
exports.reconcileActiveInvites = functions.pubsub
    .schedule("every 15 minutes")
    .onRun(async () => {
    const now = Date.now();
    // Thresholds
    const REALTIME_STUCK_MS = 2 * 60 * 60 * 1000; // 2 hours
    const TURN_BASED_STUCK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const STARTING_STUCK_MS = 10 * 60 * 1000; // 10 minutes
    let reconciledActive = 0;
    let reconciledStarting = 0;
    let selfHealed = 0;
    // ── Pass 1: Stuck "active" invites ─────────────────────────────────
    try {
        const ACTIVE_LIMIT = 200;
        const activeSnap = await db
            .collection("GameInvites")
            .where("status", "==", "active")
            .limit(ACTIVE_LIMIT)
            .get();
        if (activeSnap.size === ACTIVE_LIMIT) {
            functions.logger.warn("[reconcileActiveInvites] Active query hit limit — more stuck invites may exist", { limit: ACTIVE_LIMIT });
        }
        for (const inviteDoc of activeSnap.docs) {
            const invite = inviteDoc.data();
            // Determine age — use updatedAt or createdAt
            // Runtime values may be Firestore Timestamps despite the TS type saying number.
            const updatedAt = extractMillis(invite.updatedAt);
            const createdAt = extractMillis(invite.createdAt);
            // Safety: if both timestamps are missing/corrupt, treat invite as
            // maximally aged so the watchdog can reconcile it rather than
            // silently skipping it forever.
            if (!updatedAt && !createdAt) {
                functions.logger.warn("[reconcileActiveInvites] Invite has no valid timestamps — treating as stuck", { inviteId: inviteDoc.id });
            }
            const effectiveTs = updatedAt || createdAt;
            const activeAge = effectiveTs ? now - effectiveTs : Infinity;
            // Determine threshold based on game type
            const gameType = invite.gameType;
            const isRealtime = EXTERNAL_COLYSEUS_INVITE_GAMES.has(gameType);
            const threshold = isRealtime ? REALTIME_STUCK_MS : TURN_BASED_STUCK_MS;
            if (activeAge < threshold)
                continue;
            // ── Cross-check: does the backing game doc still exist + active?
            let gameAlive = false;
            if (invite.gameId) {
                const gameIdStr = invite.gameId;
                if (isRealtime) {
                    // Realtime games may have ColyseusGameState or RealtimeGameSessions
                    const colySnap = await db
                        .collection("ColyseusGameState")
                        .doc(gameIdStr)
                        .get();
                    if (colySnap.exists) {
                        const colyData = colySnap.data();
                        // If status is NOT vacant/completed, game is alive
                        if (colyData &&
                            colyData.status !== "vacant" &&
                            colyData.status !== "completed") {
                            gameAlive = true;
                        }
                    }
                }
                else {
                    // Turn-based games live in TurnBasedGames
                    const tbSnap = await db
                        .collection("TurnBasedGames")
                        .doc(gameIdStr)
                        .get();
                    if (tbSnap.exists) {
                        const tbData = tbSnap.data();
                        // If game is still active/invited, it's alive
                        if (tbData &&
                            tbData.status !== "completed" &&
                            tbData.status !== "abandoned") {
                            gameAlive = true;
                        }
                    }
                }
            }
            if (gameAlive)
                continue; // game is still running — don't touch
            // Game is gone or completed but invite is stuck active → finalize
            functions.logger.warn("[reconcileActiveInvites] Finalizing stuck active invite", {
                inviteId: inviteDoc.id,
                gameType,
                gameId: invite.gameId,
                activeAge: Math.round(activeAge / 60000),
            });
            const result = await finalizeUniversalInvite({
                inviteId: inviteDoc.id,
                terminalStatus: "completed",
                resolutionType: "disconnect",
                resolvedBy: "watchdog",
                now,
            });
            if (result.success)
                reconciledActive++;
        }
    }
    catch (err) {
        functions.logger.error("[reconcileActiveInvites] Active pass failed", {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    // ── Pass 2: Stuck "starting" invites ───────────────────────────────
    try {
        const STARTING_LIMIT = 100;
        const startingSnap = await db
            .collection("GameInvites")
            .where("status", "==", "starting")
            .limit(STARTING_LIMIT)
            .get();
        if (startingSnap.size === STARTING_LIMIT) {
            functions.logger.warn("[reconcileActiveInvites] Starting query hit limit — more stuck invites may exist", { limit: STARTING_LIMIT });
        }
        for (const inviteDoc of startingSnap.docs) {
            const invite = inviteDoc.data();
            const updatedAt = extractMillis(invite.updatedAt);
            const createdAt = extractMillis(invite.createdAt);
            const effectiveTs = updatedAt || createdAt;
            const startingAge = effectiveTs ? now - effectiveTs : Infinity;
            if (startingAge < STARTING_STUCK_MS)
                continue;
            functions.logger.warn("[reconcileActiveInvites] Cancelling stuck starting invite", {
                inviteId: inviteDoc.id,
                gameType: invite.gameType,
                startingAge: Math.round(startingAge / 60000),
            });
            const result = await finalizeUniversalInvite({
                inviteId: inviteDoc.id,
                terminalStatus: "cancelled",
                resolutionType: "error",
                resolvedBy: "watchdog",
                now,
            });
            if (result.success)
                reconciledStarting++;
        }
    }
    catch (err) {
        functions.logger.error("[reconcileActiveInvites] Starting pass failed", {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    // ── Pass 3: Self-heal terminal invites still visible ───────────────
    // Route through finalizeUniversalInvite for consistent field backfill
    // (resolvedAt, resolvedBy, deleteAt, chatHiddenInConversationIds, etc.)
    try {
        for (const status of INVITE_TERMINAL_STATUSES) {
            // Use "!=" to catch BOTH chatVisibility: "visible" AND invites
            // where chatVisibility is missing/unset (Firestore "==" doesn't
            // match missing fields).
            const visibleSnap = await db
                .collection("GameInvites")
                .where("status", "==", status)
                .where("chatVisibility", "!=", "hidden")
                .limit(100)
                .get();
            if (visibleSnap.size >= 100) {
                functions.logger.warn("[reconcileActiveInvites] Pass 3 hit limit for status", { status, count: visibleSnap.size });
            }
            for (const inviteDoc of visibleSnap.docs) {
                try {
                    const result = await finalizeUniversalInvite({
                        inviteId: inviteDoc.id,
                        terminalStatus: status,
                        resolutionType: "error",
                        resolvedBy: "watchdog",
                        now,
                    });
                    if (result.success)
                        selfHealed++;
                }
                catch (docErr) {
                    functions.logger.warn("[reconcileActiveInvites] Self-heal doc update failed", {
                        inviteId: inviteDoc.id,
                        error: docErr instanceof Error ? docErr.message : String(docErr),
                    });
                }
            }
        }
    }
    catch (err) {
        functions.logger.error("[reconcileActiveInvites] Self-heal pass failed", {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    // ── Logging ────────────────────────────────────────────────────────
    functions.logger.info("FN.reconcileActiveInvites.SUMMARY", {
        pass1_reconciledActive: reconciledActive,
        pass2_reconciledStarting: reconciledStarting,
        pass3_selfHealed: selfHealed,
    });
    return null;
});
/**
 * Clean up old single-player game sessions.
 *
 * Game sessions are stored under Users/{uid}/GameSessions. Over time these
 * accumulate and bloat per-user document counts. This function scans
 * the GameSessions collectionGroup and deletes sessions older than 180 days.
 * High scores are preserved in the separate GameHighScores subcollection.
 * Runs daily at 03:30.
 */
exports.cleanupOldGameSessions = functions.pubsub
    .schedule("every day 03:30")
    .onRun(async () => {
    const cutoff = firestore_1.Timestamp.fromMillis(Date.now() - 180 * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;
    const snapshot = await db
        .collectionGroup("GameSessions")
        .where("createdAt", "<", cutoff)
        .limit(500)
        .get();
    if (!snapshot.empty) {
        // Firestore batches are limited to 500 writes
        const batch = db.batch();
        snapshot.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        totalDeleted = snapshot.size;
    }
    if (totalDeleted > 0) {
        functions.logger.info("Cleaned up old game sessions", {
            count: totalDeleted,
        });
    }
    return null;
});
// =============================================================================
// Callable Functions
// =============================================================================
/**
 * Make a move in a turn-based game
 * Validates move and updates game state
 */
exports.makeMove = functions.https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const { gameId, move } = data;
    if (!gameId || !move) {
        throw new functions.https.HttpsError("invalid-argument", "gameId and move are required");
    }
    const gameRef = db.collection("TurnBasedGames").doc(gameId);
    try {
        const result = await db.runTransaction(async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Game not found");
            }
            const game = gameDoc.data();
            // Validate it's the player's turn
            if (game.currentTurn !== context.auth.uid) {
                throw new functions.https.HttpsError("failed-precondition", "Not your turn");
            }
            // Validate game is active
            if (game.status !== "active") {
                throw new functions.https.HttpsError("failed-precondition", "Game is not active");
            }
            // NOTE: Validate move based on game type
            // This would involve game-specific logic for chess, checkers, etc.
            // For now, we trust the client's move validation
            // Update game state
            const now = firestore_1.Timestamp.now();
            const nextTurn = game.currentTurn === game.players.player1.id
                ? game.players.player2.id
                : game.players.player1.id;
            const updates = {
                gameState: move.newState,
                currentTurn: nextTurn,
                updatedAt: now,
            };
            // Check for game end
            if (move.gameEnd) {
                updates.status = "completed";
                updates.endedAt = now;
                if (move.winnerId) {
                    updates.winner = {
                        playerId: move.winnerId,
                        reason: move.endReason || "normal",
                    };
                }
            }
            transaction.update(gameRef, updates);
            // Store move in history
            transaction.set(gameRef.collection("Moves").doc(), {
                playerId: context.auth.uid,
                move: move.notation || JSON.stringify(move),
                createdAt: now,
            });
            return {
                success: true,
                gameEnded: !!move.gameEnd,
                winner: move.winnerId,
            };
        });
        return result;
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        functions.logger.error("makeMove error", { gameId, error });
        throw new functions.https.HttpsError("internal", "Failed to make move");
    }
});
/**
 * Resign from a game
 */
exports.resignGame = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const { gameId } = data;
    if (!gameId) {
        throw new functions.https.HttpsError("invalid-argument", "gameId is required");
    }
    const gameRef = db.collection("TurnBasedGames").doc(gameId);
    try {
        await db.runTransaction(async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Game not found");
            }
            const game = gameDoc.data();
            // Validate player is in game
            if (!game.playerIds.includes(context.auth.uid)) {
                throw new functions.https.HttpsError("permission-denied", "Not a player in this game");
            }
            if (game.status !== "active") {
                throw new functions.https.HttpsError("failed-precondition", "Game is not active");
            }
            const winnerId = game.players.player1.id === context.auth.uid
                ? game.players.player2.id
                : game.players.player1.id;
            const now = firestore_1.Timestamp.now();
            transaction.update(gameRef, {
                status: "completed",
                endedAt: now,
                updatedAt: now,
                winner: {
                    playerId: winnerId,
                    reason: "resignation",
                },
            });
        });
        return { success: true };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        functions.logger.error("resignGame error", { gameId, error });
        throw new functions.https.HttpsError("internal", "Failed to resign");
    }
});
const XP_BASE = {
    arcade: 15,
    puzzle: 20,
    board: 25,
    card: 20,
    party: 15,
    daily: 25,
};
const XP_OUTCOME_MULTIPLIER = {
    win: 2.0,
    completed: 1.5,
    draw: 1.2,
    lose: 0.5,
};
const XP_BONUSES = {
    firstWinOfDay: 25,
    newHighScore: 15,
    multiplayerBonus: 10,
};
const XP_CAP_PER_MATCH = 100;
const GAME_XP_CATEGORY = {
    bounce_blitz: "arcade",
    play_2048: "puzzle",
    word_master: "daily",
    brick_breaker: "arcade",
    minesweeper_classic: "puzzle",
    pong_game: "arcade",
    chess: "board",
    checkers: "board",
    crazy_eights: "card",
    tic_tac_toe: "board",
    connect_four: "board",
    dot_match: "board",
    gomoku_master: "board",
    reversi_game: "board",
    crossword_puzzle: "daily",
    starforge_game: "arcade",
    sketch_party_game: "party",
    lights_out: "puzzle",
    minigolf_duels: "arcade",
    battleship: "board",
};
/**
 * Level calculation — mirrors src/types/profile.ts calculateLevelFromXp
 */
function calculateLevelFromXp(totalXp) {
    let level = 1;
    let xpUsed = 0;
    while (true) {
        const xpForNextLevel = level * 100;
        if (xpUsed + xpForNextLevel > totalXp)
            break;
        xpUsed += xpForNextLevel;
        level++;
    }
    return {
        level,
        levelXp: totalXp - xpUsed,
        xpToNextLevel: level * 100,
        totalXp,
    };
}
/**
 * Universal callable — single entry-point for every game completion.
 *
 * Pipeline:
 *   1. Validate + dedup
 *   2. Compute XP
 *   3. Write XP/level to Firestore (atomic increment)
 *   4. Evaluate achievements (via existing V2 evaluator)
 *   5. Update per-game stats
 *   6. Return XP/level/achievements
 */
/**
 * Shared helper: award XP and update level for a single player.
 * Called from onGameResult (callable), processGameCompletion, and
 * processRealtimeGameCompletion triggers.
 */
async function awardGameXp(uid, gameId, outcome, score, mode) {
    const category = GAME_XP_CATEGORY[gameId];
    if (!category) {
        return {
            xpEarned: 0,
            totalXp: 0,
            level: 1,
            previousLevel: 1,
            didLevelUp: false,
        };
    }
    const baseXp = XP_BASE[category];
    const multiplier = XP_OUTCOME_MULTIPLIER[outcome];
    let xpEarned = Math.round(baseXp * multiplier);
    // Multiplayer bonus
    if (mode && mode !== "solo") {
        xpEarned += XP_BONUSES.multiplayerBonus;
    }
    // High score bonus
    if (score !== null && score !== undefined) {
        const statsRef = db
            .collection("Users")
            .doc(uid)
            .collection("perGameStatsV2")
            .doc(gameId);
        const statsSnap = await statsRef.get();
        const prevHighScore = statsSnap.exists
            ? (statsSnap.data()?.highScore ?? 0)
            : 0;
        if (score > prevHighScore) {
            xpEarned += XP_BONUSES.newHighScore;
        }
    }
    // First win of day bonus
    if (outcome === "win" || outcome === "completed") {
        const todayStr = new Date().toISOString().slice(0, 10);
        const metaRef = db
            .collection("Users")
            .doc(uid)
            .collection("gameResultMeta")
            .doc("daily");
        const metaSnap = await metaRef.get();
        const lastWinDate = metaSnap.exists ? metaSnap.data()?.lastWinDate : null;
        if (lastWinDate !== todayStr) {
            xpEarned += XP_BONUSES.firstWinOfDay;
            await metaRef.set({ lastWinDate: todayStr }, { merge: true });
        }
    }
    // Cap
    xpEarned = Math.min(xpEarned, XP_CAP_PER_MATCH);
    // Atomic XP + level write
    const profileRef = db.collection("Users").doc(uid);
    let totalXp = 0;
    let previousLevel = 1;
    let newLevelInfo;
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(profileRef);
        const data = snap.data() || {};
        const currentXp = data.gameXp ?? 0;
        previousLevel = data.gameLevel ?? calculateLevelFromXp(currentXp).level;
        totalXp = currentXp + xpEarned;
        newLevelInfo = calculateLevelFromXp(totalXp);
        // Use set+merge so it works even if the user doc doesn't have gameXp yet
        tx.set(profileRef, {
            gameXp: totalXp,
            gameLevel: newLevelInfo.level,
            gameLevelXp: newLevelInfo.levelXp,
            gameXpToNextLevel: newLevelInfo.xpToNextLevel,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    newLevelInfo = newLevelInfo;
    const didLevelUp = newLevelInfo.level > previousLevel;
    functions.logger.info("[awardGameXp]", {
        uid,
        gameId,
        outcome,
        xpEarned,
        totalXp,
        level: newLevelInfo.level,
        didLevelUp,
    });
    return {
        xpEarned,
        totalXp,
        level: newLevelInfo.level,
        previousLevel,
        didLevelUp,
    };
}
exports.onGameResult = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    const { gameId, mode, outcome, score, durationMs, participants, meta, idempotencyKey, } = data;
    // ── Validate ──────────────────────────────────────────────────
    if (!gameId || typeof gameId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "gameId required");
    }
    if (REMOVED_GAME_IDS.has(gameId)) {
        throw new functions.https.HttpsError("failed-precondition", `Game "${gameId}" has been removed`);
    }
    const category = GAME_XP_CATEGORY[gameId];
    if (!category) {
        throw new functions.https.HttpsError("invalid-argument", `Unknown gameId: ${gameId}`);
    }
    if (!["solo", "turnBased", "realtime"].includes(mode)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid mode");
    }
    if (!["win", "lose", "draw", "completed"].includes(outcome)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid outcome");
    }
    if (!participants ||
        !Array.isArray(participants) ||
        participants.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "At least one participant required");
    }
    // Verify caller is a participant
    const callerParticipant = participants.find((p) => p.userId === uid);
    if (!callerParticipant) {
        throw new functions.https.HttpsError("permission-denied", "Caller must be a participant");
    }
    // ── Idempotency ──────────────────────────────────────────────
    if (idempotencyKey) {
        const dedupRef = db
            .collection("Users")
            .doc(uid)
            .collection("gameResultDedup")
            .doc(idempotencyKey);
        const dedupSnap = await dedupRef.get();
        if (dedupSnap.exists) {
            // Already processed — return cached response
            functions.logger.info("[onGameResult] Duplicate skipped", {
                uid,
                idempotencyKey,
            });
            return dedupSnap.data();
        }
    }
    // ── Compute & Award XP ────────────────────────────────────
    const xpResult = await awardGameXp(uid, gameId, outcome, score ?? undefined, mode);
    const { xpEarned, totalXp, level: newLevel, previousLevel, didLevelUp, } = xpResult;
    // ── Achievements + Stats ────────────────────────────────────
    let achievementsUnlocked = [];
    try {
        // Map outcome to V2 evaluator format
        const v2Outcome = outcome === "lose"
            ? "loss"
            : outcome === "completed"
                ? "completed"
                : outcome;
        // Build gameSpecific with score for stat_threshold achievements
        const gameSpecific = {
            ...(meta || {}),
        };
        if (score !== null && score !== undefined) {
            gameSpecific.bestScore = score;
        }
        await (0, achievementsV2Evaluator_1.updatePerGameStatsV2)(uid, gameId, v2Outcome, score ?? undefined, gameSpecific);
        const evalResult = await (0, achievementsV2Evaluator_1.evaluateAchievementsV2)(uid);
        achievementsUnlocked = evalResult.newUnlocks.map((u) => u.achievementId);
    }
    catch (err) {
        // Non-critical — XP was already written
        functions.logger.warn("[onGameResult] Achievement eval failed", {
            uid,
            gameId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
    // ── Build Response ──────────────────────────────────────────
    const levelInfo = calculateLevelFromXp(totalXp);
    const response = {
        success: true,
        xpEarned,
        totalXp,
        level: newLevel,
        levelXp: levelInfo.levelXp,
        xpToNextLevel: levelInfo.xpToNextLevel,
        didLevelUp,
        previousLevel,
        achievementsUnlocked,
        leaderboardUpdated: false, // Leaderboards updated via existing triggers
    };
    // ── Cache for idempotency ───────────────────────────────────
    if (idempotencyKey) {
        const dedupRef = db
            .collection("Users")
            .doc(uid)
            .collection("gameResultDedup")
            .doc(idempotencyKey);
        await dedupRef.set({
            ...response,
            processedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    functions.logger.info("[onGameResult] Processed", {
        uid,
        gameId,
        mode,
        outcome,
        xpEarned,
        totalXp,
        level: newLevel,
        didLevelUp,
        achievementsUnlocked: achievementsUnlocked.length,
    });
    return response;
});
// =============================================================================
// claimLevelReward — server-validated level reward claiming
// =============================================================================
const MAX_REWARD_LEVEL = 50;
/** Milestone levels that grant real background entitlements. */
const MILESTONE_BACKGROUND_BY_LEVEL = {
    5: "bg_circling_waves",
    10: "bg_aurora_borealis",
    20: "bg_rune_circles",
    30: "bg_synthwave",
    50: "bg_synthwave_videogame",
};
/** Milestone levels give larger token rewards. */
function getRewardAmountForLevel(level) {
    const milestones = {
        5: 200,
        10: 400,
        15: 600,
        20: 800,
        25: 1000,
        30: 1200,
        35: 1400,
        40: 1600,
        45: 1800,
        50: 2000,
    };
    return milestones[level] ?? 50; // non-milestone: 50 cosmetic points
}
exports.claimLevelReward = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    const { level } = data;
    // ── Validate input ─────────────────────────────────────────────
    if (typeof level !== "number" ||
        !Number.isInteger(level) ||
        level < 1 ||
        level > MAX_REWARD_LEVEL) {
        throw new functions.https.HttpsError("invalid-argument", `level must be an integer between 1 and ${MAX_REWARD_LEVEL}`);
    }
    const userRef = db.collection("Users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "User not found");
    }
    const userData = userSnap.data();
    // ── Check user has reached this level ──────────────────────────
    const totalXp = userData.gameXp ?? 0;
    const levelInfo = calculateLevelFromXp(totalXp);
    if (levelInfo.level < level) {
        throw new functions.https.HttpsError("failed-precondition", `You are level ${levelInfo.level}; level ${level} not yet reached`);
    }
    // ── Check not already claimed ──────────────────────────────────
    const claimedLevels = userData.claimedLevels ?? [];
    if (claimedLevels.includes(level)) {
        throw new functions.https.HttpsError("already-exists", `Level ${level} reward already claimed`);
    }
    // ── Award reward ───────────────────────────────────────────────
    const amount = getRewardAmountForLevel(level);
    const isMilestone = level % 5 === 0;
    const milestoneBackgroundId = isMilestone
        ? (MILESTONE_BACKGROUND_BY_LEVEL[level] ?? null)
        : null;
    // Credit both the User doc (legacy cosmeticPoints) and the Wallet doc
    const walletRef = db.collection("Wallets").doc(uid);
    const batch = db.batch();
    batch.update(userRef, {
        claimedLevels: firestore_1.FieldValue.arrayUnion(level),
        cosmeticPoints: firestore_1.FieldValue.increment(amount),
    });
    // Upsert wallet — use set with merge to create if missing
    batch.set(walletRef, { tokensBalance: firestore_1.FieldValue.increment(amount) }, { merge: true });
    if (milestoneBackgroundId) {
        const entitlementRef = userRef
            .collection("Entitlements")
            .doc(milestoneBackgroundId);
        batch.set(entitlementRef, {
            cosmeticId: milestoneBackgroundId,
            type: "background",
            grantedAt: firestore_1.Timestamp.now(),
            source: "milestone",
            metadata: { level },
        }, { merge: true });
    }
    await batch.commit();
    functions.logger.info("[claimLevelReward] Claimed", {
        uid,
        level,
        amount,
        isMilestone,
        milestoneBackgroundId,
    });
    return {
        success: true,
        level,
        rewardType: milestoneBackgroundId
            ? "background_entitlement"
            : isMilestone
                ? "milestone"
                : "small",
        amount,
        message: isMilestone
            ? `Milestone! +${amount} Tokens`
            : `+${amount} Tokens`,
        ...(milestoneBackgroundId ? { cosmeticId: milestoneBackgroundId } : {}),
    };
});
//# sourceMappingURL=games.js.map