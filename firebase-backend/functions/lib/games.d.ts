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
import * as functions from "firebase-functions";
/**
 * Create a game from an accepted invite
 * Called via Firestore trigger or directly
 */
export declare const createGameFromInvite: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
/**
 * Trigger when a universal invite is updated
 *
 * Handles:
 * 1. Auto-creating game when all slots are filled (status -> 'ready')
 * 2. Syncing spectators to game document
 */
export declare const onUniversalInviteUpdate: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
/**
 * Process game completion
 * Updates stats, ratings, achievements, and invite status
 */
export declare const processGameCompletion: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
/**
 * Process realtime game completion (Sketch Party, Mini Golf, etc.)
 *
 * Fires when a Colyseus room persists a finished game to RealtimeGameSessions.
 * Mirrors processGameCompletion's v2 achievement logic:
 *   1. Determine per-player outcome (win / loss / draw)
 *   2. Call updatePerGameStatsV2 with score + gameSpecific
 *   3. Run evaluateAchievementsV2 for each player
 */
export declare const processRealtimeGameCompletion: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
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
export declare const onGameCompletedCreateHistory: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
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
export declare const onGameHistoryCreatedUpdateLeaderboard: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
/**
 * Scheduled function to process matchmaking queue
 * Runs every minute to find and create matches
 */
export declare const processMatchmakingQueue: functions.CloudFunction<unknown>;
/**
 * Expire old invites daily
 */
export declare const expireGameInvites: functions.CloudFunction<unknown>;
/**
 * Expire stale matchmaking entries
 */
export declare const expireMatchmakingEntries: functions.CloudFunction<unknown>;
/**
 * Clean up old completed games (keep for 90 days)
 *
 * Queries by `endedAt` first, then falls back to `updatedAt` to catch games
 * that were completed before the endedAt fix was deployed.
 * Also recursively deletes subcollections (Moves, Spectators, MatchChat).
 */
export declare const cleanupOldGames: functions.CloudFunction<unknown>;
/**
 * Clean up resolved game invites (accepted/declined/cancelled/expired)
 *
 * Once an invite reaches a terminal status it serves no purpose in Firestore.
 * We keep them for 30 days for debugging / audit, then delete.
 * Runs daily at 02:30 (offset from cleanupOldGames to avoid contention).
 */
export declare const cleanupResolvedInvites: functions.CloudFunction<unknown>;
/**
 * Clean up stale matchmaking queue entries.
 *
 * `expireMatchmakingEntries` marks entries as "expired" but never deletes them,
 * causing the MatchmakingQueue collection to grow unbounded. This function
 * deletes entries in terminal states (expired, matched, cancelled) older than
 * 7 days. Runs daily at 03:00.
 */
export declare const cleanupStaleMatchmakingEntries: functions.CloudFunction<unknown>;
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
export declare const cleanupVacantGames: functions.CloudFunction<unknown>;
/**
 * Clean up old single-player game sessions.
 *
 * Game sessions are stored under Users/{uid}/GameSessions. Over time these
 * accumulate and bloat per-user document counts. This function scans
 * the GameSessions collectionGroup and deletes sessions older than 180 days.
 * High scores are preserved in the separate GameHighScores subcollection.
 * Runs daily at 03:30.
 */
export declare const cleanupOldGameSessions: functions.CloudFunction<unknown>;
/**
 * Make a move in a turn-based game
 * Validates move and updates game state
 */
export declare const makeMove: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Resign from a game
 */
export declare const resignGame: functions.HttpsFunction & functions.Runnable<any>;
export declare const onGameResult: functions.HttpsFunction & functions.Runnable<any>;
export declare const claimLevelReward: functions.HttpsFunction & functions.Runnable<any>;
