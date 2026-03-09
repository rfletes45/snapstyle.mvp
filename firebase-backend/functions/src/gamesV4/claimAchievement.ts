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

    // Pre-read to handle legacy backfill outside the transaction
    // (legacy backfill is a one-time write, not a contention risk)
    const preSnap = await achievementRef.get();

    if (!preSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        `Achievement "${achievementType}" not found for this user.`,
      );
    }

    const preData = preSnap.data()!;

    // Already claimed (fast-path, avoid transaction overhead)
    if (
      preData.status === "claimed" ||
      (preData.claimedAt != null && preData.status !== "earned_unclaimed")
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
    if (preData.status === undefined && preData.claimedAt === undefined) {
      // This is a legacy auto-awarded achievement. Backfill it as claimed.
      await achievementRef.update({
        status: "claimed",
        claimedAt: preData.earnedAt ?? admin.firestore.Timestamp.now(),
        schemaVersion: 2,
      });

      functions.logger.info(
        `[claimAchievementV4] ${uid} tried to claim legacy auto-awarded achievement "${achievementType}" — backfilled as claimed.`,
      );

      return {
        success: true,
        alreadyClaimed: true,
        achievementType,
        tokenRewardClaimed: 0,
      };
    }

    // Must be in earned_unclaimed state (pre-check, re-checked inside txn)
    if (preData.status !== "earned_unclaimed") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Achievement "${achievementType}" is not in a claimable state (status: ${preData.status}).`,
      );
    }

    // ─── Transactional claim ───────────────────────────────────────────
    const result = await db.runTransaction(async (txn) => {
      const snap = await txn.get(achievementRef);
      if (!snap.exists) {
        return {
          success: false as const,
          alreadyClaimed: false,
          achievementType,
          tokenRewardClaimed: 0,
          error: "not-found",
        };
      }

      const achievementData = snap.data()!;

      // Re-check inside transaction (handles concurrent double-tap)
      if (
        achievementData.status === "claimed" ||
        (achievementData.claimedAt != null &&
          achievementData.status !== "earned_unclaimed")
      ) {
        return {
          success: true as const,
          alreadyClaimed: true,
          achievementType,
          tokenRewardClaimed: 0,
        };
      }

      if (achievementData.status !== "earned_unclaimed") {
        return {
          success: false as const,
          alreadyClaimed: false,
          achievementType,
          tokenRewardClaimed: 0,
          error: "invalid-status",
        };
      }

      const tokenReward =
        typeof achievementData.tokenReward === "number"
          ? achievementData.tokenReward
          : 0;

      const now = admin.firestore.Timestamp.now();

      // 1. Update achievement doc → claimed
      txn.update(achievementRef, {
        status: "claimed",
        claimedAt: now,
        schemaVersion: 2,
      });

      // 2. Increment wallet
      if (tokenReward > 0) {
        const walletRef = db.collection("Wallets").doc(uid);
        txn.set(
          walletRef,
          {
            tokensBalance: admin.firestore.FieldValue.increment(tokenReward),
            totalEarned: admin.firestore.FieldValue.increment(tokenReward),
            updatedAt: Date.now(),
          },
          { merge: true },
        );
      }

      // 3. Write Transaction audit record
      if (tokenReward > 0) {
        const txnRef = db.collection("Transactions").doc();
        txn.set(txnRef, {
          uid,
          type: "earn",
          amount: tokenReward,
          reason: "achievement_reward",
          description: achievementData.name || achievementType,
          refId: achievementType,
          refType: "achievement",
          createdAt: now,
          transactionId: txnRef.id,
          sourceType: "achievement_claim",
          sourceId: achievementType,
          metadata: {
            achievementType,
            difficulty: achievementData.difficulty || null,
            sectionId: achievementData.sectionId || null,
            gameId: achievementData.gameId || null,
          },
        });
      }

      return {
        success: true as const,
        alreadyClaimed: false,
        achievementType,
        tokenRewardClaimed: tokenReward,
      };
    });

    if (result.error) {
      throw new functions.https.HttpsError(
        result.error === "not-found" ? "not-found" : "failed-precondition",
        `Achievement "${achievementType}" could not be claimed (${result.error}).`,
      );
    }

    if (!result.alreadyClaimed && result.tokenRewardClaimed > 0) {
      functions.logger.info(
        `[claimAchievementV4] ${uid} claimed "${achievementType}" (+${result.tokenRewardClaimed} tokens)`,
      );
    }

    return {
      success: result.success,
      alreadyClaimed: result.alreadyClaimed,
      achievementType: result.achievementType,
      tokenRewardClaimed: result.tokenRewardClaimed,
    };
  },
);
