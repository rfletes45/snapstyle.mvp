/**
 * Games V4 — Level Rewards Definitions + Unlock/Claim Logic
 *
 * Server-authoritative level rewards system.
 *
 * Static definitions: LEVEL_REWARDS_V4 (levels 1–50).
 * Dynamic state: Users/{uid}/LevelRewardsV4/{level}
 *
 * Flow:
 *   1. Level increases → unlockLevelRewards() creates reward docs
 *   2. User taps "Claim" → claimLevelRewardV4 callable verifies & grants
 *
 * @module gamesV4/levelRewardsV4
 */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
export declare const MAX_LEVEL = 50;
export declare const SCHEMA_VERSION = 1;
export interface LevelRewardDefinition {
    level: number;
    tokenReward: number;
    cosmeticItemId: string | null;
    /** Display metadata */
    title: string;
    description: string;
    icon: string;
    isMilestone: boolean;
}
export interface LevelRewardDoc {
    level: number;
    unlockedAt: admin.firestore.Timestamp;
    claimedAt: admin.firestore.Timestamp | null;
    tokenReward: number;
    cosmeticItemId: string | null;
    schemaVersion: number;
}
export declare const LEVEL_REWARDS_V4: LevelRewardDefinition[];
export declare function getRewardDefinition(level: number): LevelRewardDefinition | undefined;
/**
 * Create LevelRewardsV4 docs for each newly reached level.
 * Idempotent: skips levels that already have docs.
 *
 * @param uid - User ID
 * @param previousLevel - Level before XP was applied
 * @param newLevel - Level after XP was applied (clamped to MAX_LEVEL)
 */
export declare function unlockLevelRewards(db: FirebaseFirestore.Firestore, uid: string, previousLevel: number, newLevel: number): Promise<number[]>;
export declare const claimLevelRewardV4: functions.HttpsFunction & functions.Runnable<any>;
