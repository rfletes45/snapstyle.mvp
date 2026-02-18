"use strict";
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
exports.getRateLimitStatus = void 0;
exports.checkGlobalRateLimit = checkGlobalRateLimit;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
function getDb() {
    return admin.firestore();
}
// =============================================================================
// Configuration
// =============================================================================
/** Maximum messages per user across ALL conversations per window. */
const GLOBAL_MAX_MESSAGES_PER_WINDOW = 60;
/** Window size in milliseconds (1 minute). */
const WINDOW_MS = 60_000;
/** How many past buckets to keep for smoothing (sliding window depth). */
const MAX_BUCKETS = 3;
/** Prune buckets older than this (3 windows). */
const PRUNE_AGE_MS = MAX_BUCKETS * WINDOW_MS;
// =============================================================================
// Helpers
// =============================================================================
/**
 * Get the bucket key for a given timestamp. Format: floor(ts / WINDOW_MS).
 */
function bucketKey(ts) {
    return String(Math.floor(ts / WINDOW_MS));
}
/**
 * Sum up counts across all non-expired buckets.
 */
function sumBuckets(buckets, now) {
    const cutoff = Math.floor((now - PRUNE_AGE_MS) / WINDOW_MS);
    let total = 0;
    for (const [key, count] of Object.entries(buckets)) {
        if (Number(key) >= cutoff) {
            total += count;
        }
    }
    return total;
}
/**
 * Remove buckets older than the prune window.
 */
function pruneBuckets(buckets, now) {
    const cutoff = Math.floor((now - PRUNE_AGE_MS) / WINDOW_MS);
    const pruned = {};
    for (const [key, count] of Object.entries(buckets)) {
        if (Number(key) >= cutoff) {
            pruned[key] = count;
        }
    }
    return pruned;
}
/**
 * Check and update the global per-user rate limit.
 *
 * Uses a Firestore transaction for atomic read-check-write.
 *
 * @returns result with `allowed`, `remaining`, and optional `retryAfterSeconds`
 */
async function checkGlobalRateLimit(uid) {
    const db = getDb();
    const docRef = db.collection("RateLimits").doc(`globalChat_${uid}`);
    const now = Date.now();
    const currentBucket = bucketKey(now);
    try {
        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            let buckets = {};
            if (snap.exists) {
                buckets = snap.data()?.buckets || {};
            }
            // Prune old buckets
            buckets = pruneBuckets(buckets, now);
            // Sum current window counts
            const currentTotal = sumBuckets(buckets, now);
            if (currentTotal >= GLOBAL_MAX_MESSAGES_PER_WINDOW) {
                // Rate limited — compute retry-after
                const currentBucketStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
                const windowEnd = currentBucketStart + WINDOW_MS;
                const retryAfterMs = Math.max(0, windowEnd - now);
                return {
                    allowed: false,
                    remaining: 0,
                    windowSeconds: WINDOW_MS / 1000,
                    retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
                };
            }
            // Increment current bucket
            buckets[currentBucket] = (buckets[currentBucket] || 0) + 1;
            const update = {
                buckets,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (snap.exists) {
                tx.update(docRef, update);
            }
            else {
                tx.set(docRef, update);
            }
            return {
                allowed: true,
                remaining: GLOBAL_MAX_MESSAGES_PER_WINDOW - (currentTotal + 1),
                windowSeconds: WINDOW_MS / 1000,
            };
        });
        return result;
    }
    catch (error) {
        console.error("[checkGlobalRateLimit] Error:", error);
        // Allow on error to prevent blocking legitimate users
        return {
            allowed: true,
            remaining: GLOBAL_MAX_MESSAGES_PER_WINDOW,
            windowSeconds: WINDOW_MS / 1000,
        };
    }
}
// =============================================================================
// B) getRateLimitStatus callable (optional diagnostic)
// =============================================================================
/**
 * Callable that lets the client query remaining budget without consuming it.
 * Useful for showing a "slow down" indicator before the user is actually blocked.
 */
exports.getRateLimitStatus = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    const db = getDb();
    const docRef = db.collection("RateLimits").doc(`globalChat_${uid}`);
    const now = Date.now();
    const snap = await docRef.get();
    let buckets = {};
    if (snap.exists) {
        buckets = snap.data()?.buckets || {};
    }
    buckets = pruneBuckets(buckets, now);
    const currentTotal = sumBuckets(buckets, now);
    const remaining = Math.max(0, GLOBAL_MAX_MESSAGES_PER_WINDOW - currentTotal);
    return {
        allowed: remaining > 0,
        remaining,
        windowSeconds: WINDOW_MS / 1000,
        ...(remaining <= 0
            ? {
                retryAfterSeconds: Math.ceil((Math.floor(now / WINDOW_MS) * WINDOW_MS + WINDOW_MS - now) /
                    1000),
            }
            : {}),
    };
});
//# sourceMappingURL=rateLimiter.js.map