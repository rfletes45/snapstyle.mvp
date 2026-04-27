"use strict";
/**
 * Games V4 — Achievement Reward Backfill
 *
 * Converts old earned-but-unclaimed achievement docs into the automatic reward
 * model. This is a background repair path, not a user-facing claim flow.
 *
 * @module gamesV4/backfillAchievementRewards
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
exports.backfillUnclaimedAchievementRewardsV4 = void 0;
const functions = __importStar(require("firebase-functions"));
const achievements_1 = require("./achievements");
const helpers_1 = require("./helpers");
exports.backfillUnclaimedAchievementRewardsV4 = functions.https.onCall(async (_data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const db = (0, helpers_1.getDb)();
    const snap = await db
        .collection("Users")
        .doc(uid)
        .collection("Achievements")
        .where("status", "==", "earned_unclaimed")
        .get();
    let awardedCount = 0;
    let repairedCount = 0;
    let totalTokensAwarded = 0;
    const processed = [];
    for (const doc of snap.docs) {
        const result = await (0, achievements_1.awardExistingUnclaimedAchievementReward)({
            db,
            uid,
            achievementType: doc.id,
        });
        if (result.awarded) {
            awardedCount += 1;
            totalTokensAwarded += result.tokensAwarded;
        }
        if (result.repaired)
            repairedCount += 1;
        processed.push({
            achievementType: result.achievementType,
            tokensAwarded: result.tokensAwarded,
            transactionId: result.transactionId,
            repaired: result.repaired,
        });
    }
    functions.logger.info("[achievementBackfillV4] Completed user backfill", {
        uid,
        scanned: snap.size,
        awardedCount,
        repairedCount,
        totalTokensAwarded,
    });
    return {
        success: true,
        scanned: snap.size,
        awardedCount,
        repairedCount,
        totalTokensAwarded,
        processed,
    };
});
//# sourceMappingURL=backfillAchievementRewards.js.map