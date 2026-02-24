/**
 * Level Rewards Claim Service
 *
 * Client-side service to claim level rewards via server-side validation.
 * Fetches already-claimed levels and calls the `claimLevelReward` callable.
 *
 * @module services/levelRewardsService
 */

import { createLogger } from "@/utils/log";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirestoreInstance, getFunctionsInstance } from "./firebase";

const log = createLogger("services/levelRewardsService");

// =============================================================================
// Types
// =============================================================================

export interface ClaimLevelRewardRequest {
  level: number;
}

export interface ClaimLevelRewardResponse {
  success: boolean;
  level: number;
  rewardType: string;
  amount: number;
  message: string;
  cosmeticId?: string;
}

// =============================================================================
// Fetch claimed levels
// =============================================================================

/**
 * Fetch the set of levels this user has already claimed rewards for.
 * Stored as an array field `claimedLevels` on the user doc.
 */
export async function getClaimedLevels(uid: string): Promise<number[]> {
  try {
    const db = getFirestoreInstance();
    const userDoc = await getDoc(doc(db, "Users", uid));
    if (!userDoc.exists()) return [];
    const data = userDoc.data();
    return (data?.claimedLevels as number[]) ?? [];
  } catch (err) {
    log.error("Failed to fetch claimed levels", { data: { uid, error: err } });
    return [];
  }
}

// =============================================================================
// Claim a level reward
// =============================================================================

/**
 * Claim the reward for a specific level.
 * Server validates that the user has reached that level and hasn't already claimed.
 */
export async function claimLevelReward(
  level: number,
): Promise<ClaimLevelRewardResponse> {
  const functions = getFunctionsInstance();
  const callable = httpsCallable<
    ClaimLevelRewardRequest,
    ClaimLevelRewardResponse
  >(functions, "claimLevelReward");

  log.info("Claiming level reward", { data: { level } });

  const result = await callable({ level });
  return result.data;
}
