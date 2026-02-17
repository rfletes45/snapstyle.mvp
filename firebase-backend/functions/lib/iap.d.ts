/**
 * IAP Receipt Validation Cloud Functions
 *
 * Securely validates purchase receipts from App Store / Play Store
 * and grants purchased items/tokens to users.
 *
 * Security:
 * - Never trust client-side purchase claims
 * - All receipts validated with store servers
 * - Duplicate transaction prevention
 * - Atomic operations for granting rewards
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 8
 */
import * as functions from "firebase-functions";
/**
 * Validate IAP receipt and grant rewards
 *
 * This is the main entry point for processing purchases.
 * Called by the client after a successful store purchase.
 */
export declare const validateReceipt: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Restore previous purchases
 *
 * Called when user reinstalls app or switches devices.
 * Re-validates all previous non-consumable purchases.
 */
export declare const restorePurchases: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Get purchase history for a user
 */
export declare const getPurchaseHistory: functions.HttpsFunction & functions.Runnable<any>;
