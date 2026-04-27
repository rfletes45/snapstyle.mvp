/**
 * Games V4 — Achievement Reward Backfill
 *
 * Converts old earned-but-unclaimed achievement docs into the automatic reward
 * model. This is a background repair path, not a user-facing claim flow.
 *
 * @module gamesV4/backfillAchievementRewards
 */
import * as functions from "firebase-functions";
export declare const backfillUnclaimedAchievementRewardsV4: functions.HttpsFunction & functions.Runnable<any>;
