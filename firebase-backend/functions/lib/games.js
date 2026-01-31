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
 * @see docs/07_GAMES_ARCHITECTURE.md Section 5
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
exports.resignGame = exports.makeMove = exports.cleanupOldGames = exports.expireMatchmakingEntries = exports.expireGameInvites = exports.processMatchmakingQueue = exports.onGameHistoryCreatedUpdateLeaderboard = exports.onGameCompletedCreateHistory = exports.processGameCompletion = exports.onUniversalInviteUpdate = exports.createGameFromInvite = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions"));
// Initialize if not already
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
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
        case "8ball_pool":
            return {
                balls: getInitialPoolBalls(),
                phase: "break",
                player1Assignment: null,
                cueBallInHand: false,
                consecutiveFouls: { player1: 0, player2: 0 },
            };
        default:
            return {};
    }
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
function getInitialPoolBalls() {
    // Simplified initial state
    const balls = [];
    // Cue ball
    balls.push({ id: 0, x: 80, y: 80, pocketed: false });
    // Numbered balls (1-15)
    for (let i = 1; i <= 15; i++) {
        balls.push({
            id: i,
            x: 240 + (i % 5) * 12,
            y: 80 + Math.floor(i / 5) * 12,
            pocketed: false,
        });
    }
    return balls;
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
    // Skip if not a universal invite (no claimedSlots means legacy invite)
    if (!after.claimedSlots || after.claimedSlots.length === 0) {
        return;
    }
    const beforeSlotCount = before?.claimedSlots?.length ?? 0;
    const afterSlotCount = after.claimedSlots.length;
    const beforeStatus = before?.status;
    const afterStatus = after.status;
    functions.logger.info("Universal invite updated", {
        inviteId,
        beforeSlotCount,
        afterSlotCount,
        beforeStatus,
        afterStatus,
    });
    // CASE 1: Status changed to ready - create the game
    if (afterStatus === "ready" && beforeStatus !== "ready") {
        await createGameFromUniversalInvite(change.after.ref, after);
        return;
    }
    // CASE 2: New spectator joined - sync to game document
    if (after.gameId &&
        after.spectators.length > (before?.spectators?.length ?? 0)) {
        const newSpectator = after.spectators[after.spectators.length - 1];
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
    if (after.gameId &&
        before?.spectators &&
        after.spectators.length < before.spectators.length) {
        // Find who left by comparing spectator arrays
        const beforeIds = new Set(before.spectators.map((s) => s.userId));
        const afterIds = new Set(after.spectators.map((s) => s.userId));
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
/**
 * Create a game from a universal invite when all slots are filled
 *
 * This is called when the invite status changes to 'ready'.
 * It builds the game document from the claimed slots and starts the game.
 */
async function createGameFromUniversalInvite(inviteRef, invite) {
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
                rating: DEFAULT_RATING, // TODO: Could look up actual rating
            };
            playerIds.push(slot.playerId);
        });
        // Determine who goes first (host/sender goes first)
        const firstPlayerId = invite.claimedSlots[0].playerId;
        // Build turn order for multi-player games
        const turnOrder = playerIds.slice(); // Copy of player IDs in join order
        // Get initial game state
        const gameState = getInitialGameState(invite.gameType);
        // For multi-player card games, add player order to state
        if (invite.gameType === "crazy_eights" && gameState) {
            gameState.playerOrder = turnOrder;
            gameState.playerCount = playerIds.length;
            // Initialize hands for each player
            for (let i = 0; i < playerIds.length; i++) {
                gameState[`player${i + 1}Hand`] = [];
            }
        }
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
            spectatorIds: invite.spectators.map((s) => s.userId),
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
            spectators: invite.spectators.map((s) => s.userId),
        });
        // TODO: Send push notifications to all players
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
            // Update player stats and check achievements
            await updatePlayerStats(after);
            await checkAchievements(after);
            // Update invite status to "completed" if game was created from an invite
            if (after.inviteId) {
                await updateInviteStatusOnGameCompletion(after.inviteId, after.status);
            }
            else {
                // Fallback: Try to find invite by gameId
                await updateInviteStatusByGameId(context.params.gameId, after.status);
            }
            functions.logger.info("Game completion processed", {
                gameId: context.params.gameId,
                gameType: after.gameType,
                winner: after.winner?.playerId,
                inviteId: after.inviteId,
            });
        }
        catch (error) {
            functions.logger.error("Failed to process game completion", {
                gameId: context.params.gameId,
                error,
            });
        }
    }
});
/**
 * Update invite status when the associated game completes
 */
async function updateInviteStatusOnGameCompletion(inviteId, gameStatus) {
    try {
        const inviteRef = db.collection("GameInvites").doc(inviteId);
        const inviteSnap = await inviteRef.get();
        if (!inviteSnap.exists) {
            functions.logger.warn("Invite not found for game completion update", {
                inviteId,
            });
            return;
        }
        const invite = inviteSnap.data();
        // Only update if invite is still in "active" status
        if (invite?.status === "active") {
            await inviteRef.update({
                status: "completed",
                completedAt: firestore_1.Timestamp.now().toMillis(),
                gameEndStatus: gameStatus,
                updatedAt: firestore_1.Timestamp.now().toMillis(),
            });
            functions.logger.info("Invite status updated to completed", {
                inviteId,
                gameStatus,
            });
        }
    }
    catch (error) {
        functions.logger.error("Failed to update invite status on game completion", {
            inviteId,
            error,
        });
    }
}
/**
 * Update invite status by searching for the gameId
 * Fallback when inviteId is not stored on the game
 */
async function updateInviteStatusByGameId(gameId, gameStatus) {
    try {
        // Search for invites with this gameId
        const invitesSnapshot = await db
            .collection("GameInvites")
            .where("gameId", "==", gameId)
            .get();
        if (invitesSnapshot.empty) {
            // No invite found - game may have been created without an invite
            return;
        }
        const batch = db.batch();
        for (const inviteDoc of invitesSnapshot.docs) {
            const invite = inviteDoc.data();
            // Only update if invite is in an active state
            if (invite.status === "active" || invite.status === "ready") {
                batch.update(inviteDoc.ref, {
                    status: "completed",
                    completedAt: firestore_1.Timestamp.now().toMillis(),
                    gameEndStatus: gameStatus,
                    updatedAt: firestore_1.Timestamp.now().toMillis(),
                });
            }
        }
        await batch.commit();
        functions.logger.info("Invite(s) status updated to completed via gameId", {
            gameId,
            gameStatus,
            inviteCount: invitesSnapshot.size,
        });
    }
    catch (error) {
        functions.logger.error("Failed to update invite status by gameId", {
            gameId,
            error,
        });
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
        "8ball_pool",
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
 * Expire old invites daily
 */
exports.expireGameInvites = functions.pubsub
    .schedule("every day 00:00")
    .onRun(async () => {
    const now = firestore_1.Timestamp.now();
    const snapshot = await db
        .collection("GameInvites")
        .where("status", "==", "pending")
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
    functions.logger.info("Expired game invites", { count: snapshot.size });
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
 */
exports.cleanupOldGames = functions.pubsub
    .schedule("every day 02:00")
    .onRun(async () => {
    const cutoff = firestore_1.Timestamp.fromMillis(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const snapshot = await db
        .collection("TurnBasedGames")
        .where("status", "in", ["completed", "abandoned"])
        .where("endedAt", "<", cutoff)
        .limit(500)
        .get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    if (snapshot.size > 0) {
        functions.logger.info("Cleaned up old games", { count: snapshot.size });
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
            // TODO: Validate move based on game type
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
//# sourceMappingURL=games.js.map