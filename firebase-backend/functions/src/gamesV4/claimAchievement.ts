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
 * 4. Atomically sets claimedAt + status to "claimed" and increments wallet
 * 5. Returns structured result
 *
 * Mirrors the safety patterns of claimLevelRewardV4 and claimSectionBadgeV4.
 *
 * @module gamesV4/claimAchievement
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { assertAuth, getDb } from "./helpers";

// =============================================================================
// Callable: claimAchievementV4
// =============================================================================

export const claimAchievementV4 = functions.https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);

    const { achievementType } = data as { achievementType: string };

    if (!achievementType || typeof achievementType !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "achievementType is required.",
      );
    }

    const db = getDb();
    const achievementRef = db
      .collection("Users")
      .doc(uid)
      .collection("Achievements")
      .doc(achievementType);

    const snap = await achievementRef.get();

    if (!snap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        `Achievement "${achievementType}" not found for this user.`,
      );
    }

    const achievementData = snap.data()!;

    // Check if already claimed (idempotent)
    if (
      achievementData.status === "claimed" ||
      (achievementData.claimedAt != null &&
        achievementData.status !== "earned_unclaimed")
    ) {
      return {
        success: true,
        alreadyClaimed: true,
        achievementType,
        tokenRewardClaimed: 0,
      };
    }

    // Legacy migration: if the doc has no status field and was earned under the
    // old auto-award model, treat it as already claimed.
    // Legacy docs lack `status` and `claimedAt` fields entirely.
    if (
      achievementData.status === undefined &&
      achievementData.claimedAt === undefined
    ) {
      // This is a legacy auto-awarded achievement. Backfill it as claimed.
      await achievementRef.update({
        status: "claimed",
        claimedAt: achievementData.earnedAt ?? admin.firestore.Timestamp.now(),
        schemaVersion: 2,
      });

      console.log(
        `[claimAchievementV4] ${uid} tried to claim legacy auto-awarded achievement "${achievementType}" — backfilled as claimed.`,
      );

      return {
        success: true,
        alreadyClaimed: true,
        achievementType,
        tokenRewardClaimed: 0,
      };
    }

    // Must be in earned_unclaimed state
    if (achievementData.status !== "earned_unclaimed") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Achievement "${achievementType}" is not in a claimable state (status: ${achievementData.status}).`,
      );
    }

    const tokenReward =
      typeof achievementData.tokenReward === "number"
        ? achievementData.tokenReward
        : 0;

    // Atomic: update achievement + wallet
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    // Update achievement doc
    batch.update(achievementRef, {
      status: "claimed",
      claimedAt: now,
      schemaVersion: 2,
    });

    // Increment wallet
    if (tokenReward > 0) {
      const walletRef = db.collection("Wallets").doc(uid);
      batch.set(
        walletRef,
        {
          tokensBalance: admin.firestore.FieldValue.increment(tokenReward),
          totalEarned: admin.firestore.FieldValue.increment(tokenReward),
        },
        { merge: true },
      );
    }

    await batch.commit();

    console.log(
      `[claimAchievementV4] ${uid} claimed "${achievementType}" (+${tokenReward} tokens)`,
    );

    return {
      success: true,
      alreadyClaimed: false,
      achievementType,
      tokenRewardClaimed: tokenReward,
    };
  },
);
