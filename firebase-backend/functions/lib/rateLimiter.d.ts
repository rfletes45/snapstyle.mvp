/**
 * Global Bucketed Rate Limiter (Segment 6)
 *
 * Replaces the single-doc per-conversation rate limiter with a
 * fixed-window bucket approach that limits messages at the *global
 * user* level rather than per-conversation.
 *
 * Collection: `RateLimits/globalChat_{uid}`
 *
 * Design:
 *  - Each user has ONE rate-limit document.
 *  - The document tracks a sliding set of fixed-size time buckets
 *    (1-minute windows).
 *  - A Firestore transaction reads the doc, prunes expired buckets,
 *    checks the aggregate count, and increments the current bucket.
 *
 * Feature-flagged by `CHAT_GLOBAL_RATE_LIMIT`. When the flag is
 * OFF, the caller should fall back to the existing per-conversation
 * `checkRateLimit()`.
 *
 * @module functions/rateLimiter
 */
import * as functions from "firebase-functions";
export interface GlobalRateLimitResult {
    allowed: boolean;
    remaining: number;
    windowSeconds: number;
    retryAfterSeconds?: number;
}
/**
 * Check and update the global per-user rate limit.
 *
 * Uses a Firestore transaction for atomic read-check-write.
 *
 * @returns result with `allowed`, `remaining`, and optional `retryAfterSeconds`
 */
export declare function checkGlobalRateLimit(uid: string): Promise<GlobalRateLimitResult>;
/**
 * Callable that lets the client query remaining budget without consuming it.
 * Useful for showing a "slow down" indicator before the user is actually blocked.
 */
export declare const getRateLimitStatus: functions.HttpsFunction & functions.Runnable<any>;
