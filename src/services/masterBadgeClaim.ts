/**
 * Master Badge Claim Service
 *
 * Handles claiming master badges when a user completes all achievements
 * in an achievement section (game). The claim flow:
 *
 * 1. Verify section is fully complete (all achievements unlocked)
 * 2. Check the user hasn't already claimed the master badge
 * 3. Grant the cosmetic entitlement (badge)
 * 4. Grant the legacy badge record (for profile display)
 *
 * This is client-authoritative for now (reads confirmation from local
 * achievement state). A server-authoritative Cloud Function version
 * should validate independently in production.
 *
 * @module services/masterBadgeClaim
 */

import { getMasterBadgeForSection } from "@/config/masterBadges";
import type { EntitlementDoc } from "@/cosmetics/types";
import { createLogger } from "@/utils/log";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { grantBadge } from "./badges";
import { getFirestoreInstance } from "./firebase";

const logger = createLogger("services/masterBadgeClaim");

// =============================================================================
// Types
// =============================================================================

export interface MasterBadgeClaimResult {
  success: boolean;
  alreadyClaimed: boolean;
  badgeId: string;
  error?: string;
}

export type MasterBadgeStatus = "locked" | "claimable" | "claimed";

// =============================================================================
// Status Check
// =============================================================================

/**
 * Check the claim status of a master badge for a given section.
 *
 * @param uid - User ID
 * @param sectionId - Achievement section ID
 * @param isComplete - Whether all achievements in the section are unlocked
 * @returns The current claim status
 */
export async function getMasterBadgeStatus(
  uid: string,
  sectionId: string,
  isComplete: boolean,
): Promise<MasterBadgeStatus> {
  if (!isComplete) return "locked";

  const masterBadge = getMasterBadgeForSection(sectionId);
  if (!masterBadge) return "locked";

  try {
    // Check entitlement
    const db = getFirestoreInstance();
    const entRef = doc(db, "Users", uid, "Entitlements", masterBadge.badgeId);
    const entSnap = await getDoc(entRef);

    if (entSnap.exists()) return "claimed";
    return "claimable";
  } catch (error) {
    logger.error("Error checking master badge status:", error);
    // Default to claimable if we can't check — the claim will validate
    return isComplete ? "claimable" : "locked";
  }
}

/**
 * Batch check claim statuses for multiple sections.
 * More efficient than calling getMasterBadgeStatus repeatedly.
 *
 * @param uid - User ID
 * @param sections - Array of { sectionId, isComplete } pairs
 * @returns Map of sectionId → MasterBadgeStatus
 */
export async function batchGetMasterBadgeStatuses(
  uid: string,
  sections: Array<{ sectionId: string; isComplete: boolean }>,
): Promise<Record<string, MasterBadgeStatus>> {
  const result: Record<string, MasterBadgeStatus> = {};
  const db = getFirestoreInstance();

  // First pass: set locked for incomplete, collect claimable candidates
  const candidates: Array<{ sectionId: string; badgeId: string }> = [];

  for (const { sectionId, isComplete } of sections) {
    if (!isComplete) {
      result[sectionId] = "locked";
      continue;
    }

    const masterBadge = getMasterBadgeForSection(sectionId);
    if (!masterBadge) {
      result[sectionId] = "locked";
      continue;
    }

    candidates.push({ sectionId, badgeId: masterBadge.badgeId });
  }

  // Batch read entitlements for candidates
  try {
    const checks = await Promise.all(
      candidates.map(async ({ sectionId, badgeId }) => {
        const entRef = doc(db, "Users", uid, "Entitlements", badgeId);
        const entSnap = await getDoc(entRef);
        return { sectionId, exists: entSnap.exists() };
      }),
    );

    for (const { sectionId, exists } of checks) {
      result[sectionId] = exists ? "claimed" : "claimable";
    }
  } catch (error) {
    logger.error("Error batch checking master badge statuses:", error);
    // Default all candidates to claimable on error
    for (const { sectionId } of candidates) {
      result[sectionId] = result[sectionId] ?? "claimable";
    }
  }

  return result;
}

// =============================================================================
// Claim
// =============================================================================

/**
 * Claim a master badge for completing all achievements in a section.
 *
 * Idempotent: calling twice returns { success: true, alreadyClaimed: true }.
 *
 * @param uid - User ID
 * @param sectionId - Achievement section ID
 * @param isComplete - Client-verified completion state (all achievements unlocked)
 * @returns Claim result
 */
export async function claimMasterBadge(
  uid: string,
  sectionId: string,
  isComplete: boolean,
): Promise<MasterBadgeClaimResult> {
  const masterBadge = getMasterBadgeForSection(sectionId);
  if (!masterBadge) {
    return {
      success: false,
      alreadyClaimed: false,
      badgeId: "",
      error: `No master badge defined for section: ${sectionId}`,
    };
  }

  if (!isComplete) {
    return {
      success: false,
      alreadyClaimed: false,
      badgeId: masterBadge.badgeId,
      error: "Section is not complete — cannot claim master badge",
    };
  }

  try {
    const db = getFirestoreInstance();

    // 1. Check if already claimed (entitlement exists)
    const entRef = doc(db, "Users", uid, "Entitlements", masterBadge.badgeId);
    const entSnap = await getDoc(entRef);

    if (entSnap.exists()) {
      logger.info("Master badge already claimed:", masterBadge.badgeId);
      return {
        success: true,
        alreadyClaimed: true,
        badgeId: masterBadge.badgeId,
      };
    }

    // 2. Grant the cosmetic entitlement
    const entDoc: EntitlementDoc = {
      cosmeticId: masterBadge.badgeId,
      type: "badge",
      grantedAt: Date.now(),
      source: "achievement",
      metadata: {
        masterBadge: true,
        sectionId,
        gameType: masterBadge.gameType,
      },
    };
    await setDoc(entRef, entDoc);

    // 3. Grant the legacy badge record (for profile badges system)
    await grantBadge(uid, masterBadge.badgeId, {
      type: "achievement",
      achievementId: `master_${sectionId}`,
    } as any);

    logger.info(
      "Master badge claimed successfully:",
      masterBadge.badgeId,
      "for section:",
      sectionId,
    );

    return {
      success: true,
      alreadyClaimed: false,
      badgeId: masterBadge.badgeId,
    };
  } catch (error) {
    logger.error("Error claiming master badge:", error);
    return {
      success: false,
      alreadyClaimed: false,
      badgeId: masterBadge.badgeId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
