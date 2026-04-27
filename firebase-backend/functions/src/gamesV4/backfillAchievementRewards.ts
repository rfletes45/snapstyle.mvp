/**
 * Games V4 — Achievement Reward Backfill
 *
 * Converts old earned-but-unclaimed achievement docs into the automatic reward
 * model. This is a background repair path, not a user-facing claim flow.
 *
 * @module gamesV4/backfillAchievementRewards
 */

import * as functions from "firebase-functions";
import { awardExistingUnclaimedAchievementReward } from "./achievements";
import { assertAuth, getDb } from "./helpers";

export const backfillUnclaimedAchievementRewardsV4 = functions.https.onCall(
  async (_data, context) => {
    const uid = assertAuth(context);
    const db = getDb();

    const snap = await db
      .collection("Users")
      .doc(uid)
      .collection("Achievements")
      .where("status", "==", "earned_unclaimed")
      .get();

    let awardedCount = 0;
    let repairedCount = 0;
    let totalTokensAwarded = 0;
    const processed: Array<{
      achievementType: string;
      tokensAwarded: number;
      transactionId: string | null;
      repaired: boolean;
    }> = [];

    for (const doc of snap.docs) {
      const result = await awardExistingUnclaimedAchievementReward({
        db,
        uid,
        achievementType: doc.id,
      });

      if (result.awarded) {
        awardedCount += 1;
        totalTokensAwarded += result.tokensAwarded;
      }
      if (result.repaired) repairedCount += 1;

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
  },
);
