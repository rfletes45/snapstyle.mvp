/**
 * Shop Cloud Functions
 *
 * Handles secure server-side shop operations:
 * - purchaseWithTokens: Purchase items with virtual currency
 * - validatePurchase: Validate purchase eligibility
 * - grantItem: Add item to user inventory
 *
 * Security:
 * - All operations are authenticated
 * - Purchases are atomic (transaction-based)
 * - Validation runs server-side to prevent client manipulation
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */
import * as functions from "firebase-functions";
/**
 * Purchase an item with tokens
 *
 * This function atomically:
 * 1. Validates the purchase (item exists, available, user can afford, not owned)
 * 2. Deducts tokens from user's wallet
 * 3. Adds item to user's inventory
 * 4. Records the transaction
 * 5. Updates stock if applicable
 */
export declare const purchaseWithTokens: functions.HttpsFunction & functions.Runnable<any>;
/**
 * Grant free item to user (admin or system use)
 *
 * Used for:
 * - Promotional giveaways
 * - Achievement rewards
 * - Compensation for issues
 */
export declare const grantItem: functions.HttpsFunction & functions.Runnable<any>;
