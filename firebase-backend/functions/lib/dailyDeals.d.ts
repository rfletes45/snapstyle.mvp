/**
 * Daily Deals Cloud Functions
 *
 * Scheduled functions to generate daily and weekly deals.
 *
 * Functions:
 * - generateDailyDeals: Runs at midnight UTC
 * - generateWeeklyDeals: Runs Monday at midnight UTC
 * - cleanupOldDeals: Cleans up expired deals
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.6
 */
import * as functions from "firebase-functions";
/**
 * Generate daily deals
 * Runs at midnight UTC every day
 */
export declare const generateDailyDeals: functions.CloudFunction<unknown>;
/**
 * Generate weekly deals
 * Runs Monday at midnight UTC
 */
export declare const generateWeeklyDeals: functions.CloudFunction<unknown>;
/**
 * Cleanup old daily deals (older than 7 days)
 * Runs daily at 1am UTC
 */
export declare const cleanupOldDeals: functions.CloudFunction<unknown>;
/**
 * Manually trigger deal generation (for testing)
 * Requires admin authentication
 */
export declare const triggerDailyDeals: functions.HttpsFunction & functions.Runnable<any>;
