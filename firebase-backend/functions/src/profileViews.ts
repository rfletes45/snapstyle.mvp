/**
 * profileViews — Server-authoritative profile view counter.
 *
 * Instead of letting clients write directly to another user's profile doc,
 * this callable increments `profileViews` via the admin SDK and deduplicates
 * per viewer/target pair within a 24-hour window.
 *
 * @module functions/profileViews
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions";

const db = admin.firestore();

// 24-hour dedup window (in milliseconds)
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

interface IncrementProfileViewsRequest {
  targetUid: string;
}

interface IncrementProfileViewsResponse {
  ok: boolean;
}

/**
 * Callable: incrementProfileViews
 *
 * Input: { targetUid: string }
 * - Auth required
 * - Cannot view own profile
 * - Deduplicates per viewer per target within 24h
 * - Increments Users/{targetUid}.profileViews via admin SDK
 */
export const incrementProfileViews = functions.https.onCall(
  async (
    data: IncrementProfileViewsRequest,
    context,
  ): Promise<IncrementProfileViewsResponse> => {
    // 1. Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const viewerUid = context.auth.uid;
    const { targetUid } = data;

    // 2. Validate input
    if (!targetUid || typeof targetUid !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "targetUid is required",
      );
    }

    // 3. Cannot view own profile
    if (viewerUid === targetUid) {
      return { ok: true };
    }

    try {
      // 4. Dedup check — Users/{targetUid}/ProfileViews/{viewerUid}
      const dedupRef = db
        .collection("Users")
        .doc(targetUid)
        .collection("ProfileViews")
        .doc(viewerUid);

      const dedupSnap = await dedupRef.get();

      if (dedupSnap.exists) {
        const lastViewedAt = dedupSnap.data()?.lastViewedAt;
        if (
          lastViewedAt &&
          typeof lastViewedAt === "number" &&
          Date.now() - lastViewedAt < DEDUP_WINDOW_MS
        ) {
          // Within dedup window — skip increment
          return { ok: true };
        }
      }

      // 5. Increment + update dedup atomically via batch
      const batch = db.batch();

      // Increment counter on the user doc
      const userRef = db.collection("Users").doc(targetUid);
      batch.update(userRef, { profileViews: FieldValue.increment(1) });

      // Upsert dedup doc
      batch.set(dedupRef, { lastViewedAt: Date.now() }, { merge: true });

      await batch.commit();

      return { ok: true };
    } catch (error) {
      // Non-critical — do not throw to client
      functions.logger.warn("incrementProfileViews failed:", error);
      return { ok: true };
    }
  },
);
