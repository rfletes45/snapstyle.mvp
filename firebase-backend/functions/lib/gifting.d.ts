/**
 * Gifting Cloud Functions
 *
 * Handles secure gift sending and receiving.
 *
 * Functions:
 * - sendGift: Validate purchase and create gift record
 * - openGift: Grant gift items to recipient
 * - expireGifts: Scheduled function to expire old gifts
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.2
 */
import * as functions from "firebase-functions";
/**
 * Send a gift to another user
 *
 * Flow:
 * 1. Validate authentication
 * 2. Verify recipient exists and is not sender
 * 3. Validate purchase receipt
 * 4. Create gift record
 * 5. Send push notification to recipient
 */
export declare const sendGift: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Open a received gift and claim the items
 *
 * Flow:
 * 1. Validate authentication
 * 2. Verify gift belongs to user
 * 3. Check gift not expired/already opened
 * 4. Grant items/tokens to user
 * 5. Update gift status
 */
export declare const openGift: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Scheduled function to expire old gifts
 * Runs hourly
 */
export declare const expireGifts: functions.CloudFunction<unknown>;
/**
 * Get user's gift history (sent and received)
 */
export declare const getGiftHistory: functions.HttpsFunction & functions.Runnable<any>;
