/**
 * Games V4 — Claim Individual Achievement Reward
 *
 * Callable: claimAchievementV4
 *
 * After the achievement schema change, individual achievements are earned
 * but unclaimed. This callable lets the user claim the token reward for
 * a single achievement.
 *
 * 1. Validates the achievement exists and belongs to the caller
 * 2. Ensures it is earned
 * 3. If already claimed, returns success with alreadyClaimed=true (idempotent)
 * 4. Inside a Firestore transaction:
 *    - Re-reads achievement to prevent race conditions
 *    - Updates achievement to "claimed"
 *    - Increments wallet balance
 *    - Creates an immutable Transaction record for audit
 * 5. Returns structured result
 *
 * @module gamesV4/claimAchievement
 */
import * as functions from "firebase-functions";
export declare const claimAchievementV4: functions.HttpsFunction & functions.Runnable<any>;
