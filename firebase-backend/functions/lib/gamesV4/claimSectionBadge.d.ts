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
import * as functions from "firebase-functions";
export declare const claimAchievementSectionBadgeV4: functions.HttpsFunction & functions.Runnable<any>;
