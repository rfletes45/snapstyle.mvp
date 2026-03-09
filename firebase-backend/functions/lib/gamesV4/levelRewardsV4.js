"use strict";
/**
 * Games V4 — Level Rewards Definitions + Unlock/Claim Logic
 *
 * Server-authoritative level rewards system.
 *
 * Static definitions: LEVEL_REWARDS_V4 (levels 1–50).
 * Dynamic state: Users/{uid}/LevelRewardsV4/{level}
 *
 * Flow:
 *   1. Level increases → unlockLevelRewards() creates reward docs
 *   2. User taps "Claim" → claimLevelRewardV4 callable verifies & grants
 *
 * @module gamesV4/levelRewardsV4
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
exports.claimLevelRewardV4 = exports.LEVEL_REWARDS_V4 = exports.SCHEMA_VERSION = exports.MAX_LEVEL = void 0;
exports.getRewardDefinition = getRewardDefinition;
exports.unlockLevelRewards = unlockLevelRewards;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
// =============================================================================
// Constants
// =============================================================================
exports.MAX_LEVEL = 50;
exports.SCHEMA_VERSION = 1;
// =============================================================================
// Static Definitions (levels 1–50)
// =============================================================================
const MILESTONE_COSMETICS = {
    5: { id: "bg_circling_waves", title: "Circling Waves Background" },
    10: { id: "bg_aurora_borealis", title: "Aurora Borealis Background" },
    15: { id: "badge_level_15", title: "Level 15 Badge" },
    20: { id: "bg_rune_circles", title: "Rune Circles Background" },
    25: { id: "badge_level_25", title: "Level 25 Badge" },
    30: { id: "bg_synthwave", title: "Synthwave Background" },
    35: { id: "badge_level_35", title: "Level 35 Badge" },
    40: { id: "dec_golden_crown", title: "Golden Crown Decoration" },
    45: { id: "badge_level_45", title: "Level 45 Badge" },
    50: { id: "bg_synthwave_videogame", title: "Synthwave Videogame Background" },
};
function buildDefinitions() {
    const defs = [];
    for (let lvl = 1; lvl <= exports.MAX_LEVEL; lvl++) {
        const isMilestone = lvl % 5 === 0;
        const milestone = MILESTONE_COSMETICS[lvl];
        if (isMilestone && milestone) {
            defs.push({
                level: lvl,
                tokenReward: lvl * 20, // 100 at L5, 200 at L10, ... 1000 at L50
                cosmeticItemId: milestone.id,
                title: milestone.title,
                description: `Milestone reward for reaching level ${lvl}!`,
                icon: "trophy-award",
                isMilestone: true,
            });
        }
        else {
            defs.push({
                level: lvl,
                tokenReward: 50, // standard token reward
                cosmeticItemId: null,
                title: `Level ${lvl} Reward`,
                description: `+50 tokens for reaching level ${lvl}.`,
                icon: "star-four-points",
                isMilestone: false,
            });
        }
    }
    return defs;
}
exports.LEVEL_REWARDS_V4 = buildDefinitions();
function getRewardDefinition(level) {
    return exports.LEVEL_REWARDS_V4.find((r) => r.level === level);
}
// =============================================================================
// Unlock Logic — called after XP/level write
// =============================================================================
/**
 * Create LevelRewardsV4 docs for each newly reached level.
 * Idempotent: skips levels that already have docs.
 *
 * @param uid - User ID
 * @param previousLevel - Level before XP was applied
 * @param newLevel - Level after XP was applied (clamped to MAX_LEVEL)
 */
async function unlockLevelRewards(db, uid, previousLevel, newLevel) {
    // Clamp both ends
    const from = Math.max(1, Math.min(previousLevel + 1, exports.MAX_LEVEL + 1));
    const to = Math.min(newLevel, exports.MAX_LEVEL);
    if (from > to)
        return [];
    const unlockedLevels = [];
    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();
    for (let lvl = from; lvl <= to; lvl++) {
        const def = getRewardDefinition(lvl);
        if (!def)
            continue;
        const rewardRef = db
            .collection("Users")
            .doc(uid)
            .collection("LevelRewardsV4")
            .doc(String(lvl));
        // Idempotent: only create if not exists (checked in batch via set+merge
        // with conditional — we use get to check first for full idempotency)
        const existing = await rewardRef.get();
        if (existing.exists)
            continue;
        const rewardDoc = {
            level: lvl,
            unlockedAt: now,
            claimedAt: null,
            tokenReward: def.tokenReward,
            cosmeticItemId: def.cosmeticItemId,
            schemaVersion: exports.SCHEMA_VERSION,
        };
        batch.set(rewardRef, rewardDoc);
        unlockedLevels.push(lvl);
    }
    if (unlockedLevels.length > 0) {
        await batch.commit();
        functions.logger.info("[levelRewardsV4] Unlocked rewards", {
            uid,
            levels: unlockedLevels,
        });
    }
    return unlockedLevels;
}
exports.claimLevelRewardV4 = functions.https.onCall(async (data, context) => {
    // Auth check
    if (!context.auth) {
        return { success: false, error: "Not authenticated" };
    }
    const uid = context.auth.uid;
    const { level } = data;
    // Validate level
    if (typeof level !== "number" ||
        !Number.isInteger(level) ||
        level < 1 ||
        level > exports.MAX_LEVEL) {
        return { success: false, error: `Invalid level: ${level}` };
    }
    const db = admin.firestore();
    // Verify user's current level >= requested level
    const userDoc = await db.collection("Users").doc(uid).get();
    if (!userDoc.exists) {
        return { success: false, error: "User not found" };
    }
    const currentLevel = userDoc.data()?.level?.current ?? 1;
    if (currentLevel < level) {
        return {
            success: false,
            error: `Current level (${currentLevel}) is below ${level}`,
        };
    }
    // Check reward doc exists and is unclaimed
    const rewardRef = db
        .collection("Users")
        .doc(uid)
        .collection("LevelRewardsV4")
        .doc(String(level));
    let rewardSnap = await rewardRef.get();
    // Auto-create reward doc if user qualifies but doc doesn't exist yet.
    // This handles level 1 (never "leveled up" to it) and retroactive rollouts.
    if (!rewardSnap.exists) {
        const def = getRewardDefinition(level);
        if (!def) {
            return {
                success: false,
                error: `No reward definition for level ${level}`,
            };
        }
        const rewardDoc = {
            level,
            unlockedAt: admin.firestore.Timestamp.now(),
            claimedAt: null,
            tokenReward: def.tokenReward,
            cosmeticItemId: def.cosmeticItemId,
            schemaVersion: exports.SCHEMA_VERSION,
        };
        await rewardRef.set(rewardDoc);
        rewardSnap = await rewardRef.get();
        functions.logger.info("[levelRewardsV4] Auto-created missing reward doc", {
            uid,
            level,
        });
    }
    const rewardData = rewardSnap.data();
    // Idempotent: already claimed (fast-path)
    if (rewardData.claimedAt !== null) {
        return { success: true, alreadyClaimed: true };
    }
    // ─── Transactional claim: tokens + cosmetic + claimedAt + audit ────
    const claimResult = await db.runTransaction(async (txn) => {
        // Re-read inside transaction to prevent double-claim race
        const txnSnap = await txn.get(rewardRef);
        if (!txnSnap.exists) {
            return { success: false, error: "reward-missing" };
        }
        const txnData = txnSnap.data();
        // Re-check claimed state inside transaction
        if (txnData.claimedAt !== null) {
            return { success: true, alreadyClaimed: true };
        }
        const now = admin.firestore.Timestamp.now();
        const walletRef = db.collection("Wallets").doc(uid);
        // 1. Grant tokens
        if (txnData.tokenReward > 0) {
            txn.set(walletRef, {
                tokensBalance: admin.firestore.FieldValue.increment(txnData.tokenReward),
                totalEarned: admin.firestore.FieldValue.increment(txnData.tokenReward),
                updatedAt: Date.now(),
            }, { merge: true });
        }
        // 2. Grant cosmetic entitlement (if milestone)
        if (txnData.cosmeticItemId) {
            const entRef = db
                .collection("Users")
                .doc(uid)
                .collection("Entitlements")
                .doc(txnData.cosmeticItemId);
            const entSnap = await txn.get(entRef);
            if (!entSnap.exists) {
                txn.set(entRef, {
                    cosmeticId: txnData.cosmeticItemId,
                    type: inferCosmeticType(txnData.cosmeticItemId),
                    grantedAt: now,
                    source: "milestone",
                    metadata: { levelReward: level },
                });
            }
        }
        // 3. Mark as claimed
        txn.update(rewardRef, { claimedAt: now });
        // 4. Write Transaction audit record
        if (txnData.tokenReward > 0) {
            const def = getRewardDefinition(level);
            const txnDocRef = db.collection("Transactions").doc();
            txn.set(txnDocRef, {
                uid,
                type: "earn",
                amount: txnData.tokenReward,
                reason: "level_reward",
                description: def?.isMilestone
                    ? `Level ${level} Milestone Reward`
                    : `Level ${level} Reward`,
                refId: String(level),
                refType: "level_reward",
                createdAt: now,
                transactionId: txnDocRef.id,
                sourceType: "level_reward_claim",
                sourceId: String(level),
                metadata: {
                    level,
                    isMilestone: def?.isMilestone ?? false,
                    cosmeticItemId: txnData.cosmeticItemId,
                },
            });
        }
        return {
            success: true,
            alreadyClaimed: false,
            tokensGranted: txnData.tokenReward,
            cosmeticGranted: txnData.cosmeticItemId,
        };
    });
    if (claimResult.error) {
        return { success: false, error: claimResult.error };
    }
    if (!claimResult.alreadyClaimed && (claimResult.tokensGranted ?? 0) > 0) {
        functions.logger.info("[levelRewardsV4] Reward claimed", {
            uid,
            level,
            tokens: claimResult.tokensGranted,
            cosmetic: claimResult.cosmeticGranted,
        });
    }
    return {
        success: claimResult.success,
        alreadyClaimed: claimResult.alreadyClaimed,
        tokensGranted: claimResult.tokensGranted,
        cosmeticGranted: claimResult.cosmeticGranted,
    };
});
// =============================================================================
// Helpers
// =============================================================================
/**
 * Infer CosmeticType from the item ID prefix.
 */
function inferCosmeticType(cosmeticId) {
    if (cosmeticId.startsWith("bg_"))
        return "background";
    if (cosmeticId.startsWith("dec_"))
        return "decoration";
    return "badge";
}
//# sourceMappingURL=levelRewardsV4.js.map