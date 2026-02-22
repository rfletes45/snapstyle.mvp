/**
 * Achievements V2 — Server-Side Evaluator
 *
 * Deterministic achievement evaluation engine for Cloud Functions.
 * Reads trusted stats, computes achievement progress, writes
 * canonical v2 achievement docs, and grants rewards atomically.
 *
 * v2 Changes:
 * - stat_threshold progress type for game-specific stat milestones
 * - gameSpecific field on PerGameStats for per-game metrics
 * - Reward granting: tokens → Wallets/{uid}, entitlements → Entitlements/{id}
 * - Secret achievement support
 * - processSinglePlayerCompletion callable for SP games
 *
 * Firestore paths written:
 *   /users/{uid}/achievements/{achievementId}
 *   /users/{uid}/achievementSummary
 *   /Wallets/{uid}                          (token rewards)
 *   /Users/{uid}/Entitlements/{cosmeticId}  (cosmetic rewards)
 *   /Users/{uid}/Transactions/{txnId}       (reward audit log)
 *
 * @module achievementsV2Evaluator
 */
import * as functions from "firebase-functions";
type AchievementState = "locked" | "progress" | "unlocked";
interface AchievementEvalResult {
    achievementId: string;
    previousState: AchievementState;
    newState: AchievementState;
    progress: number;
    target: number;
    justUnlocked: boolean;
}
interface EvaluationResult {
    userId: string;
    evaluated: number;
    newUnlocks: AchievementEvalResult[];
    errors: Array<{
        achievementId: string;
        error: string;
    }>;
    legacySynced: boolean;
    rewardsGranted: number;
    timestamp: number;
}
/**
 * Run the achievements v2 evaluator for a single user.
 *
 * 1. Reads all relevant stats
 * 2. Evaluates all active achievements
 * 3. Writes/updates v2 achievement docs
 * 4. Grants rewards for newly unlocked achievements
 * 5. Updates achievement summary
 * 6. Syncs legacy
 */
export declare function evaluateAchievementsV2(userId: string): Promise<EvaluationResult>;
export declare function migrateExistingAchievements(userId: string): Promise<number>;
/**
 * Update the v2 per-game stats subcollection.
 * Accepts optional gameSpecific stats for game-specific metrics
 * (e.g. maxTile for 2048, highestLevel for brick_breaker).
 */
export declare function updatePerGameStatsV2(userId: string, gameType: string, outcome: "win" | "loss" | "draw" | "completed" | "solved", score?: number, gameSpecific?: Record<string, number>): Promise<void>;
/**
 * Called by the client after recording a single-player session.
 * Bridges SP games into the server-authoritative achievement + stats system.
 */
export declare const processSinglePlayerCompletion: functions.HttpsFunction & functions.Runnable<any>;
export {};
