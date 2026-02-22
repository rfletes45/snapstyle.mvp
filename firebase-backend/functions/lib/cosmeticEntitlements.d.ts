/**
 * Cosmetic Entitlements — Cloud Functions
 *
 * Server-authoritative grant and purchase paths for the unified
 * cosmetics entitlement system.
 *
 * Canonical write path:
 *   Users/{uid}/Entitlements/{cosmeticId}
 *
 * These functions also write back-compat records to legacy paths
 * until cutover is complete.
 *
 * @module functions/cosmeticEntitlements
 */
import * as functions from "firebase-functions";
export declare const purchaseCosmeticWithTokens: functions.HttpsFunction & functions.Runnable<any>;
export declare const grantCosmeticEntitlement: functions.HttpsFunction & functions.Runnable<any>;
