/**
 * Social Game Stats — Counter increment helpers
 *
 * Server-side helpers for incrementing social game stats counters
 * used by the Achievements V2 evaluator.
 *
 * Firestore path: /users/{uid}/socialGameStats/counters
 *
 * @module socialGameStatsHelpers
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Get the Firestore reference for a user's social game stats doc.
 */
function getSocialStatsRef(userId: string) {
  return db
    .collection("users")
    .doc(userId)
    .collection("socialGameStats")
    .doc("counters");
}

/**
 * Increment the invitesSent counter for a user.
 */
export async function incrementInvitesSent(userId: string): Promise<void> {
  try {
    await getSocialStatsRef(userId).set(
      {
        invitesSent: FieldValue.increment(1),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } catch (err) {
    functions.logger.warn("[SocialGameStats] Failed to increment invitesSent", {
      userId,
      error: err,
    });
  }
}

/**
 * Increment the invitesAcceptedByOthers counter for the invite sender.
 */
export async function incrementInvitesAccepted(
  senderUserId: string,
): Promise<void> {
  try {
    await getSocialStatsRef(senderUserId).set(
      {
        invitesAcceptedByOthers: FieldValue.increment(1),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } catch (err) {
    functions.logger.warn(
      "[SocialGameStats] Failed to increment invitesAccepted",
      { userId: senderUserId, error: err },
    );
  }
}

/**
 * Increment the gamesWatched counter for a user.
 */
export async function incrementGamesWatched(userId: string): Promise<void> {
  try {
    await getSocialStatsRef(userId).set(
      {
        gamesWatched: FieldValue.increment(1),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } catch (err) {
    functions.logger.warn(
      "[SocialGameStats] Failed to increment gamesWatched",
      { userId, error: err },
    );
  }
}

/**
 * Increment the turnBasedRematchesCompleted counter for a user.
 */
export async function incrementRematchesCompleted(
  userId: string,
): Promise<void> {
  try {
    await getSocialStatsRef(userId).set(
      {
        turnBasedRematchesCompleted: FieldValue.increment(1),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  } catch (err) {
    functions.logger.warn(
      "[SocialGameStats] Failed to increment rematchesCompleted",
      { userId, error: err },
    );
  }
}
