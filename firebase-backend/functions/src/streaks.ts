/**
 * Streak Engine — Server-authoritative streak management.
 *
 * This is the SOLE authority for streak state. Clients must never write streak
 * fields; they only read the canonical values emitted here.
 *
 * PRODUCT DEFINITION
 * ──────────────────
 * - Streak type     : Friend-to-friend DM streak (per friendship).
 * - Qualifying act  : Both friends must each send ≥ 1 DM within a UTC calendar day.
 * - Day boundary    : UTC midnight (00:00 UTC).
 * - Streak count    : Number of consecutive UTC days where both friends sent a message.
 * - Streak start    : Begins at 1 on the first day both friends send.
 * - Streak continue : Increments by 1 for each consecutive day both friends send.
 * - Streak break    : If a full UTC day passes without both friends sending,
 *                     the streak resets on the next qualifying event. A 1-day
 *                     grace period auto-protects once every 30 days.
 * - Grace / protect : If the gap is exactly 2 days AND no grace was used in the
 *                     last 30 days, the streak survives (grace consumed).
 * - Offline / sync  : Because only the server writes streak state inside a
 *                     Firestore transaction, client timing is irrelevant.
 *
 * DATA MODEL (on `Friends/{id}` document)
 * ────────────────────────────────────────
 *   streakCount         : number   — current streak
 *   streakBestCount     : number   — all-time best for this pair
 *   streakUpdatedDay    : string   — YYYY-MM-DD (UTC) of last increment
 *   lastSentDay_uid1    : string   — YYYY-MM-DD (UTC), first UID in `users` array
 *   lastSentDay_uid2    : string   — YYYY-MM-DD (UTC), second UID in `users` array
 *   streakGraceUsedAt   : string   — YYYY-MM-DD (UTC), last date grace was consumed
 *
 * @module functions/streaks
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { notifyUser } from "./notificationCenter";

const db = admin.firestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** UTC YYYY-MM-DD for right now. */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** UTC YYYY-MM-DD for an arbitrary timestamp (ms). */
function utcDayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Number of whole calendar days between two YYYY-MM-DD strings. */
function daysBetween(a: string, b: string): number {
  const msA = Date.parse(a + "T00:00:00Z");
  const msB = Date.parse(b + "T00:00:00Z");
  return Math.round(Math.abs(msB - msA) / 86_400_000);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MILESTONES = [3, 7, 14, 30, 50, 100, 365] as const;

const MILESTONE_MESSAGES: Record<number, string> = {
  3: "🔥 3-day streak! You're on fire!",
  7: "🔥 1 week streak! Amazing!",
  14: "🔥 2 week streak! Incredible!",
  30: "🔥 30-day streak! One month strong!",
  50: "🔥 50-day streak! Legendary!",
  100: "💯 100-day streak! Champion!",
  365: "🏆 365-day streak! One whole year!",
};

const MILESTONE_COSMETICS: Record<number, string> = {
  3: "hat_flame",
  7: "glasses_cool",
  14: "bg_gradient",
  30: "hat_crown",
  50: "glasses_star",
  100: "bg_rainbow",
  365: "hat_legendary",
};

const COSMETIC_NAMES: Record<string, string> = {
  hat_flame: "Flame Cap 🔥",
  glasses_cool: "Cool Shades 😎",
  bg_gradient: "Gradient Glow ✨",
  hat_crown: "Golden Crown 👑",
  glasses_star: "Star Glasses 🤩",
  bg_rainbow: "Rainbow Burst 🌈",
  hat_legendary: "Legendary Halo 😇",
};

/** Grace cooldown in days. A new grace can only be consumed 30+ days after the last one. */
const GRACE_COOLDOWN_DAYS = 30;

// ─── Core streak update (transaction-safe) ────────────────────────────────────

/**
 * Update streak state after a DM is sent.
 *
 * MUST be called from a trusted server context (Cloud Function / Admin SDK).
 * Runs inside a Firestore transaction so concurrent sends cannot corrupt state.
 */
export async function updateStreakOnMessage(
  senderId: string,
  recipientId: string,
): Promise<void> {
  const friendsRef = db.collection("Friends");

  // Find friendship doc
  const snap = await friendsRef
    .where("users", "array-contains", senderId)
    .get();
  const friendDoc = snap.docs.find((d) => {
    const users = d.data().users as string[];
    return users.includes(recipientId);
  });

  if (!friendDoc) {
    console.log("[streaks] No friendship found:", senderId, recipientId);
    return;
  }

  const today = utcToday();

  // Run inside a transaction to prevent TOCTOU races.
  const result = await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(friendDoc.ref);
    if (!freshSnap.exists) return null;

    const data = freshSnap.data()!;
    const [uid1, uid2] = data.users as [string, string];
    const isUser1 = senderId === uid1;

    const lastSentField = isUser1 ? "lastSentDay_uid1" : "lastSentDay_uid2";
    const otherSentField = isUser1 ? "lastSentDay_uid2" : "lastSentDay_uid1";

    const currentLastSent: string = data[lastSentField] || "";
    const otherLastSent: string = data[otherSentField] || "";
    const streakUpdatedDay: string = data.streakUpdatedDay || "";
    let streakCount: number = data.streakCount || 0;
    let bestCount: number = data.streakBestCount || streakCount;
    const graceUsedAt: string = data.streakGraceUsedAt || "";

    // Idempotent: if sender already marked for today, nothing to do.
    if (currentLastSent === today) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {
      [lastSentField]: today,
    };

    let milestoneReached: number | null = null;

    const otherSentToday = otherLastSent === today;

    if (otherSentToday && streakUpdatedDay !== today) {
      // ── Both users have sent today → advance the streak ──────────────

      if (!streakUpdatedDay) {
        // Very first streak day for this pair.
        streakCount = 1;
      } else {
        const gap = daysBetween(streakUpdatedDay, today);

        if (gap <= 1) {
          // Consecutive day — streak continues.
          streakCount += 1;
        } else if (gap === 2 && canUseGrace(graceUsedAt, today)) {
          // Missed exactly 1 day — grace save.
          streakCount += 1;
          updates.streakGraceUsedAt = today;
          console.log(
            `[streaks] Grace save used for friendship ${friendDoc.id}`,
          );
        } else {
          // Streak broken — restart.
          streakCount = 1;
        }
      }

      updates.streakCount = streakCount;
      updates.streakUpdatedDay = today;

      if (streakCount > bestCount) {
        bestCount = streakCount;
        updates.streakBestCount = bestCount;
      }

      // Check milestone.
      if ((MILESTONES as readonly number[]).includes(streakCount)) {
        milestoneReached = streakCount;
      }
    }
    // Note: We do NOT reset streakCount when only one user has sent.
    // Resets are handled by the scheduled cleanup job to avoid punishing
    // the first sender of the day.

    tx.update(friendDoc.ref, updates);

    return {
      friendshipId: friendDoc.id,
      streakCount,
      milestoneReached,
      uid1,
      uid2,
    };
  });

  // ── Post-transaction side effects (notifications & cosmetics) ───────────
  if (result && result.milestoneReached) {
    const ms = result.milestoneReached;
    await Promise.all([
      sendStreakMilestoneNotification(
        result.uid1,
        result.uid2,
        ms,
        result.friendshipId,
      ),
      grantMilestoneCosmetic(result.uid1, ms),
      grantMilestoneCosmetic(result.uid2, ms),
    ]);
    console.log(
      `[streaks] Milestone ${ms} reached for friendship ${result.friendshipId}`,
    );
  }
}

// ─── Grace logic ──────────────────────────────────────────────────────────────

function canUseGrace(lastGrace: string, today: string): boolean {
  if (!lastGrace) return true;
  return daysBetween(lastGrace, today) >= GRACE_COOLDOWN_DAYS;
}

// ─── Milestone notifications ──────────────────────────────────────────────────

async function sendStreakMilestoneNotification(
  user1Id: string,
  user2Id: string,
  milestone: number,
  friendshipId: string,
): Promise<void> {
  const body = MILESTONE_MESSAGES[milestone] || `${milestone}-day streak!`;

  for (const userId of [user1Id, user2Id]) {
    try {
      await notifyUser({
        recipientUid: userId,
        type: "streak_milestone",
        category: "progression",
        dedupeKey: `streak_milestone:${friendshipId}:${milestone}:${userId}`,
        collapseKey: `streak:${friendshipId}`,
        title: `${milestone}-Day Streak!`,
        body,
        friendshipId,
        route: {
          screen: "Friends",
        },
        data: {
          friendshipId,
          milestone,
        },
        badgeEligible: false,
      });
    } catch (err) {
      console.error(`[streaks] notify error for ${userId}:`, err);
    }
  }
}

// ─── Milestone cosmetic grants ────────────────────────────────────────────────

async function grantMilestoneCosmetic(
  userId: string,
  milestone: number,
): Promise<void> {
  const itemId = MILESTONE_COSMETICS[milestone];
  if (!itemId) return;

  try {
    const invRef = db
      .collection("Users")
      .doc(userId)
      .collection("inventory")
      .doc(itemId);
    const existing = await invRef.get();
    if (existing.exists) return;

    await invRef.set({
      itemId,
      source: "milestone",
      milestoneValue: milestone,
      acquiredAt: Date.now(),
    });

    console.log(`[streaks] Granted ${itemId} to ${userId} (${milestone}d)`);

    const itemName = COSMETIC_NAMES[itemId] || itemId;
    await notifyUser({
      recipientUid: userId,
      type: "cosmetic_unlock",
      category: "progression",
      dedupeKey: `cosmetic_unlock:${userId}:${itemId}`,
      collapseKey: `cosmetic_unlock:${userId}`,
      title: "New Cosmetic Unlocked!",
      body: `You earned ${itemName} for your ${milestone}-day streak!`,
      route: {
        screen: "Friends",
      },
      data: {
        itemId,
        itemName,
        milestone,
      },
      badgeEligible: false,
    });
  } catch (err) {
    console.error(`[streaks] cosmetic grant error for ${userId}:`, err);
  }
}

// ─── Scheduled: streak expiration & reminders ─────────────────────────────────

/**
 * Runs daily at 8 PM UTC.
 *   1. Sends "at risk" reminders to users who haven't sent today.
 *   2. Resets streaks where BOTH users missed a full day (gap > 1 from streakUpdatedDay).
 *      This prevents "zombie" streaks that display a stale count.
 */
export const streakReminder = functions.pubsub
  .schedule("0 20 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    const today = utcToday();

    try {
      const friendsRef = db.collection("Friends");
      const activeSnap = await friendsRef.where("streakCount", ">", 0).get();

      console.log(
        `[streaks] Checking ${activeSnap.docs.length} active streaks`,
      );

      for (const doc of activeSnap.docs) {
        try {
          const data = doc.data();
          const streakUpdatedDay: string = data.streakUpdatedDay || "";
          const gap = streakUpdatedDay
            ? daysBetween(streakUpdatedDay, today)
            : 999;

          // ── Zombie check: streak expired silently ─────────────────────
          if (gap > 2) {
            // Streak is definitely dead — clean it up.
            await doc.ref.update({ streakCount: 0, streakUpdatedDay: "" });
            console.log(
              `[streaks] Reset zombie streak on ${doc.id} (gap=${gap})`,
            );
            continue;
          }

          // ── At-risk reminder (gap is 1, i.e. last update was yesterday) ─
          if (gap >= 1) {
            const [uid1, uid2] = data.users as [string, string];
            const lastSent1: string = data.lastSentDay_uid1 || "";
            const lastSent2: string = data.lastSentDay_uid2 || "";

            const u1Sent = lastSent1 === today;
            const u2Sent = lastSent2 === today;

            const sendReminder = async (userToNotify: string) => {
              await notifyUser({
                recipientUid: userToNotify,
                type: "streak_at_risk",
                category: "social",
                dedupeKey: `streak_at_risk:${doc.id}:${userToNotify}:${today}`,
                collapseKey: `streak:${doc.id}`,
                title: `Your ${data.streakCount}-Day Streak Is at Risk`,
                body: "Send a message before midnight to keep it alive!",
                friendshipId: doc.id,
                route: {
                  screen: "Friends",
                },
                data: {
                  friendshipId: doc.id,
                  streakCount: data.streakCount,
                },
                badgeEligible: false,
              });
              console.log(`[streaks] Reminder sent to ${userToNotify}`);
            };

            // Only remind the user who hasn't sent yet today.
            if (u1Sent !== u2Sent) {
              const userToNotify = u1Sent ? uid2 : uid1;
              await sendReminder(userToNotify);
            }

            // Neither user sent today — both need reminding.
            if (!u1Sent && !u2Sent) {
              for (const uid of [uid1, uid2]) {
                await sendReminder(uid);
              }
            }
          }
        } catch (docErr) {
          console.error(`[streaks] Error processing ${doc.id}:`, docErr);
        }
      }

      console.log("[streaks] Reminder/cleanup pass complete");
    } catch (error) {
      console.error("[streaks] Error in streakReminder:", error);
      throw error;
    }
  });
