/**
 * Games V4 — Claim Achievement Section Badge
 *
 * Callable: claimAchievementSectionBadgeV4
 *
 * When a player has completed ALL achievements in a section,
 * they can claim the section's badge. This callable:
 * 1. Validates the player has earned all achievements in the section
 * 2. Writes the section badge to Users/{uid}/Badges/{badgeId}
 * 3. Writes the section completion to Users/{uid}/AchievementSections/{sectionId}
 *
 * Idempotent: re-claiming an already-claimed section is a no-op success.
 *
 * @module gamesV4/claimSectionBadge
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  getAchievementTypesForSection,
  getSectionDef,
  resolveSection,
} from "./achievements";
import { assertAuth, getDb } from "./helpers";

// =============================================================================
// Callable: claimAchievementSectionBadgeV4
// =============================================================================

export const claimAchievementSectionBadgeV4 = functions.https.onCall(
  async (data, context) => {
    const uid = assertAuth(context);

    const { sectionId: rawSectionId } = data as { sectionId: string };

    if (!rawSectionId || typeof rawSectionId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "sectionId is required.",
      );
    }

    // Resolve legacy section IDs (e.g. "speedster" → "tic_tac_toe")
    const sectionId = resolveSection(rawSectionId);

    // Validate section exists
    const sectionDef = getSectionDef(sectionId);
    if (!sectionDef) {
      throw new functions.https.HttpsError(
        "not-found",
        `Achievement section "${sectionId}" does not exist.`,
      );
    }

    const db = getDb();

    // Check if already claimed
    const sectionDocRef = db
      .collection("Users")
      .doc(uid)
      .collection("AchievementSections")
      .doc(sectionId);
    const existingSnap = await sectionDocRef.get();
    if (existingSnap.exists && existingSnap.data()?.claimed) {
      // Idempotent: already claimed
      return { success: true, alreadyClaimed: true };
    }

    // Get all required achievement types for this section
    const requiredTypes = getAchievementTypesForSection(sectionId);
    if (requiredTypes.length === 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Section "${sectionId}" has no achievements defined.`,
      );
    }

    // Fetch user's earned achievements
    const achievementsSnap = await db
      .collection("Users")
      .doc(uid)
      .collection("Achievements")
      .get();
    const earnedSet = new Set(achievementsSnap.docs.map((d) => d.id));

    // Check all required are earned
    const missing = requiredTypes.filter((t) => !earnedSet.has(t));
    if (missing.length > 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Missing ${missing.length} achievement(s) in section "${sectionDef.name}": ${missing.join(", ")}`,
      );
    }

    // All achievements earned — grant section badge
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    // Write section completion doc
    batch.set(sectionDocRef, {
      sectionId,
      sectionName: sectionDef.name,
      badgeId: sectionDef.sectionBadgeId,
      claimed: true,
      claimedAt: now,
      achievementCount: requiredTypes.length,
    });

    // Write badge to user's Badges subcollection
    const badgeRef = db
      .collection("Users")
      .doc(uid)
      .collection("Badges")
      .doc(sectionDef.sectionBadgeId);
    batch.set(badgeRef, {
      badgeId: sectionDef.sectionBadgeId,
      name: `${sectionDef.name} Complete`,
      description: `Completed all achievements in ${sectionDef.name}`,
      icon: sectionDef.icon,
      tier: "gold",
      category: "achievement",
      earnedVia: "achievement",
      earnedAt: now,
    });

    await batch.commit();

    console.log(
      `[claimSectionBadge] ${uid} claimed section badge "${sectionDef.sectionBadgeId}" for section "${sectionId}"`,
    );

    return {
      success: true,
      alreadyClaimed: false,
      badgeId: sectionDef.sectionBadgeId,
    };
  },
);
