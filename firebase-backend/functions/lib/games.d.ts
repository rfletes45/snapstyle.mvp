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
 * Updates stats, ratings, achievements
 */
export declare const processGameCompletion: functions.CloudFunction<functions.Change<functions.firestore.QueryDocumentSnapshot>>;
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
 */
export declare const cleanupOldGames: functions.CloudFunction<unknown>;
/**
 * Make a move in a turn-based game
 * Validates move and updates game state
 */
export declare const makeMove: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Resign from a game
 */
export declare const resignGame: functions.HttpsFunction & functions.Runnable<any>;
