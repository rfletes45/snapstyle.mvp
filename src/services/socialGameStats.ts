/**
 * Social Game Stats — Client-side service
 *
 * Lightweight client helpers that increment social game stat counters
 * in Firestore. These are used for events that happen client-side
 * (spectator watching, rematch acceptance) where server-side triggers
 * are not available.
 *
 * Firestore path: /users/{uid}/socialGameStats/counters
 *
 * Note: These use FieldValue.increment() for safe concurrent updates.
 * The Firestore security rules restrict writes to server-only (Cloud Functions).
 * For client increments, we write to a separate pending path that a
 * Cloud Function can process, OR we use the admin SDK via a callable function.
 *
 * Current approach: Direct writes since rules are server-only, these
 * functions are designed to be called from server context or from
 * Cloud Functions. Client-side callers should use the callable wrapper.
 *
 * @module services/socialGameStats
 */

import { getFirestoreInstance } from "@/services/firebase";
import { createLogger } from "@/utils/log";
import { doc, increment, setDoc } from "firebase/firestore";

const logger = createLogger("services/socialGameStats");

/**
 * Get the Firestore reference for a user's social game stats doc.
 */
function getSocialStatsRef(userId: string) {
  const db = getFirestoreInstance();
  return doc(db, "users", userId, "socialGameStats", "counters");
}

/**
 * Record that the user watched a game as a spectator.
 * Should be called once per spectator session, with de-duplication
 * handled by the caller (e.g. useSpectator).
 */
export async function recordSpectatorWatch(userId: string): Promise<void> {
  try {
    const ref = getSocialStatsRef(userId);
    await setDoc(
      ref,
      {
        gamesWatched: increment(1),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    logger.info("[socialGameStats] Recorded spectator watch", { userId });
  } catch (err) {
    // Non-critical — don't break spectator experience
    logger.warn("[socialGameStats] Failed to record spectator watch", err);
  }
}

/**
 * Record that the user completed a turn-based rematch.
 * Should be called once per rematch acceptance.
 */
export async function recordRematchCompleted(userId: string): Promise<void> {
  try {
    const ref = getSocialStatsRef(userId);
    await setDoc(
      ref,
      {
        turnBasedRematchesCompleted: increment(1),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    logger.info("[socialGameStats] Recorded rematch completed", { userId });
  } catch (err) {
    logger.warn("[socialGameStats] Failed to record rematch", err);
  }
}
