"use strict";
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
exports.claimAchievementSectionBadgeV4 = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const achievements_1 = require("./achievements");
const helpers_1 = require("./helpers");
// =============================================================================
// Callable: claimAchievementSectionBadgeV4
// =============================================================================
exports.claimAchievementSectionBadgeV4 = functions.https.onCall(async (data, context) => {
    const uid = (0, helpers_1.assertAuth)(context);
    const { sectionId } = data;
    if (!sectionId || typeof sectionId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "sectionId is required.");
    }
    // Validate section exists
    const sectionDef = (0, achievements_1.getSectionDef)(sectionId);
    if (!sectionDef) {
        throw new functions.https.HttpsError("not-found", `Achievement section "${sectionId}" does not exist.`);
    }
    const db = (0, helpers_1.getDb)();
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
    const requiredTypes = (0, achievements_1.getAchievementTypesForSection)(sectionId);
    if (requiredTypes.length === 0) {
        throw new functions.https.HttpsError("failed-precondition", `Section "${sectionId}" has no achievements defined.`);
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
        throw new functions.https.HttpsError("failed-precondition", `Missing ${missing.length} achievement(s) in section "${sectionDef.name}": ${missing.join(", ")}`);
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
    console.log(`[claimSectionBadge] ${uid} claimed section badge "${sectionDef.sectionBadgeId}" for section "${sectionId}"`);
    return {
        success: true,
        alreadyClaimed: false,
        badgeId: sectionDef.sectionBadgeId,
    };
});
//# sourceMappingURL=claimSectionBadge.js.map