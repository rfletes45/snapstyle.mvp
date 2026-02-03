/**
 * Bundle Purchase Service
 *
 * Handles purchasing cosmetic bundles with tokens or real money.
 * Bundles grant multiple items at once with a discount.
 *
 * @see src/data/cosmeticBundles.ts for bundle definitions
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 6
 */

import {
  calculateBundleSavings,
  getAllBundles,
  getAvailableBundles,
  getBundleById,
  getBundleStockRemaining,
  getBundleTimeRemaining,
  getFeaturedBundles,
  isBundleAvailable,
  type BundleType,
  type CosmeticBundle,
} from "@/data/cosmeticBundles";
import { addToInventory, hasItem } from "@/services/cosmetics";
import { getAppInstance, getFirestoreInstance } from "@/services/firebase";
import { purchaseProduct } from "@/services/iap";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// =============================================================================
// Types
// =============================================================================

/**
 * Bundle purchase status
 */
export type BundlePurchaseStatus =
  | "pending"
  | "completed"
  | "partial" // Some items granted, others failed
  | "failed"
  | "refunded";

/**
 * Bundle purchase record
 */
export interface BundlePurchase {
  id: string;
  uid: string;
  bundleId: string;
  bundleName: string;

  // Payment info
  paymentMethod: "tokens" | "iap";
  priceTokens?: number;
  priceUSD?: number;
  iapTransactionId?: string;

  // Status
  status: BundlePurchaseStatus;
  grantedItems: string[];
  failedItems: string[];

  // Timestamps
  createdAt: number;
  completedAt?: number;

  // Error info
  errorMessage?: string;
}

/**
 * Bundle purchase result
 */
export interface BundlePurchaseResult {
  success: boolean;
  purchaseId?: string;
  grantedItems?: string[];
  failedItems?: string[];
  newBalance?: number;
  error?: string;
}

/**
 * Bundle with user status (owned items, can afford, etc.)
 */
export interface BundleWithStatus extends CosmeticBundle {
  /** Items user already owns (won't be granted again) */
  ownedItems: string[];
  /** Items user doesn't own (will be granted) */
  newItems: string[];
  /** User can afford with tokens */
  canAffordTokens: boolean;
  /** All items already owned */
  fullyOwned: boolean;
  /** Effective discount after accounting for owned items */
  effectiveDiscount: number;
  /** Time remaining if limited-time */
  timeRemaining: number | null;
  /** Stock remaining if limited-quantity */
  stockRemaining: number | null;
  /** User meets unlock requirements */
  meetsRequirements: boolean;
}

// =============================================================================
// Bundle Fetching
// =============================================================================

/**
 * Get all bundle definitions
 */
export function getBundles(): CosmeticBundle[] {
  return getAllBundles();
}

/**
 * Get a specific bundle
 */
export function getBundle(bundleId: string): CosmeticBundle | undefined {
  return getBundleById(bundleId);
}

/**
 * Get featured bundles for shop display
 */
export function getShopFeaturedBundles(): CosmeticBundle[] {
  return getFeaturedBundles();
}

/**
 * Get available bundles (not expired/sold out)
 */
export function getShopAvailableBundles(): CosmeticBundle[] {
  return getAvailableBundles();
}

/**
 * Get bundles with user status (owned items, affordability, etc.)
 */
export async function getBundlesWithStatus(
  uid: string,
  tokenBalance: number,
  userAchievements?: string[],
  userStreak?: number,
): Promise<BundleWithStatus[]> {
  const bundles = getAllBundles();

  const bundlesWithStatus = await Promise.all(
    bundles.map(async (bundle) => {
      // Check which items user already owns
      const ownershipChecks = await Promise.all(
        bundle.items.map((item) => hasItem(uid, item.cosmeticId)),
      );

      const ownedItems: string[] = [];
      const newItems: string[] = [];

      bundle.items.forEach((item, index) => {
        if (ownershipChecks[index]) {
          ownedItems.push(item.cosmeticId);
        } else {
          newItems.push(item.cosmeticId);
        }
      });

      // Calculate effective discount
      const fullyOwned = newItems.length === 0;
      const newItemsValue = bundle.items
        .filter((item) => newItems.includes(item.cosmeticId))
        .reduce((sum, item) => sum + item.priceTokens, 0);

      const effectiveDiscount = fullyOwned
        ? 0
        : Math.round(
            ((newItemsValue - bundle.priceTokens) / newItemsValue) * 100,
          );

      // Check if user meets unlock requirements
      let meetsRequirements = true;
      if (bundle.unlockRequirement) {
        switch (bundle.unlockRequirement.type) {
          case "achievement":
            meetsRequirements =
              userAchievements?.includes(
                bundle.unlockRequirement.value as string,
              ) || false;
            break;
          case "streak":
            meetsRequirements =
              (userStreak || 0) >= (bundle.unlockRequirement.value as number);
            break;
          case "level":
            // TODO: Check user level
            meetsRequirements = false;
            break;
        }
      }

      return {
        ...bundle,
        ownedItems,
        newItems,
        canAffordTokens: tokenBalance >= bundle.priceTokens,
        fullyOwned,
        effectiveDiscount: effectiveDiscount > 0 ? effectiveDiscount : 0,
        timeRemaining: getBundleTimeRemaining(bundle),
        stockRemaining: getBundleStockRemaining(bundle),
        meetsRequirements,
      };
    }),
  );

  return bundlesWithStatus;
}

// =============================================================================
// Purchase Operations
// =============================================================================

/**
 * Purchase a bundle with tokens
 * Handled via Cloud Function for atomic transaction
 */
export async function purchaseBundleWithTokens(
  bundleId: string,
): Promise<BundlePurchaseResult> {
  const app = getAppInstance();
  const functions = getFunctions(app);

  try {
    const callable = httpsCallable<{ bundleId: string }, BundlePurchaseResult>(
      functions,
      "purchaseBundleWithTokens",
    );

    const result = await callable({ bundleId });
    return result.data;
  } catch (error: any) {
    console.error("[bundles] Token purchase failed:", error);

    return {
      success: false,
      error:
        error?.message ||
        error?.details?.message ||
        "Purchase failed. Please try again.",
    };
  }
}

/**
 * Purchase a bundle with real money (IAP)
 * Initiates IAP flow and then grants items on success
 */
export async function purchaseBundleWithIAP(
  bundleId: string,
  uid: string,
): Promise<BundlePurchaseResult> {
  const bundle = getBundleById(bundleId);

  if (!bundle) {
    return { success: false, error: "Bundle not found" };
  }

  if (!bundle.priceUSD) {
    return {
      success: false,
      error: "Bundle not available for real money purchase",
    };
  }

  // Bundle product ID in the store
  const productId = `com.snapstyle.bundle.${bundleId}`;

  try {
    // Initiate IAP purchase
    const iapResult = await purchaseProduct(productId, uid);

    if (!iapResult.success) {
      return { success: false, error: iapResult.error };
    }

    // IAP purchase successful - Cloud Function handles item delivery
    // The verifyIAPPurchase function checks the bundle and grants items

    return {
      success: true,
      purchaseId: iapResult.purchaseId,
    };
  } catch (error: any) {
    console.error("[bundles] IAP purchase failed:", error);
    return {
      success: false,
      error: error.message || "Purchase failed",
    };
  }
}

/**
 * Grant bundle items to user (called by Cloud Function after payment)
 * This is exported for use in Cloud Functions, not direct client calls
 */
export async function grantBundleItems(
  uid: string,
  bundleId: string,
): Promise<{
  success: boolean;
  grantedItems: string[];
  failedItems: string[];
  error?: string;
}> {
  const bundle = getBundleById(bundleId);

  if (!bundle) {
    return {
      success: false,
      grantedItems: [],
      failedItems: [],
      error: "Bundle not found",
    };
  }

  const grantedItems: string[] = [];
  const failedItems: string[] = [];

  // Grant each item in the bundle
  for (const item of bundle.items) {
    try {
      // Check if user already has item
      const alreadyOwns = await hasItem(uid, item.cosmeticId);

      if (alreadyOwns) {
        // Already owned, count as granted (no duplicate)
        grantedItems.push(item.cosmeticId);
        continue;
      }

      // Grant the item using addToInventory
      const granted = await addToInventory(uid, item.cosmeticId);
      if (granted) {
        grantedItems.push(item.cosmeticId);
      } else {
        failedItems.push(item.cosmeticId);
      }
    } catch (error) {
      console.error(
        `[bundles] Failed to grant item ${item.cosmeticId}:`,
        error,
      );
      failedItems.push(item.cosmeticId);
    }
  }

  return {
    success: failedItems.length === 0,
    grantedItems,
    failedItems,
    error: failedItems.length > 0 ? "Some items failed to grant" : undefined,
  };
}

// =============================================================================
// Purchase History
// =============================================================================

/**
 * Get user's bundle purchase history
 */
export async function getBundlePurchaseHistory(
  uid: string,
  maxResults: number = 20,
): Promise<BundlePurchase[]> {
  const db = getFirestoreInstance();

  try {
    const purchasesRef = collection(db, "BundlePurchases");
    const q = query(
      purchasesRef,
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.slice(0, maxResults).map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        bundleId: data.bundleId,
        bundleName: data.bundleName,
        paymentMethod: data.paymentMethod,
        priceTokens: data.priceTokens,
        priceUSD: data.priceUSD,
        iapTransactionId: data.iapTransactionId,
        status: data.status,
        grantedItems: data.grantedItems || [],
        failedItems: data.failedItems || [],
        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        completedAt: data.completedAt?.toMillis?.() || data.completedAt,
        errorMessage: data.errorMessage,
      };
    });
  } catch (error) {
    console.error("[bundles] Error fetching purchase history:", error);
    return [];
  }
}

/**
 * Check if user has purchased a specific bundle
 */
export async function hasPurchasedBundle(
  uid: string,
  bundleId: string,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const purchasesRef = collection(db, "BundlePurchases");
    const q = query(
      purchasesRef,
      where("uid", "==", uid),
      where("bundleId", "==", bundleId),
      where("status", "==", "completed"),
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("[bundles] Error checking bundle purchase:", error);
    return false;
  }
}

// =============================================================================
// Helper Exports
// =============================================================================

export {
  calculateBundleSavings,
  getBundleStockRemaining,
  getBundleTimeRemaining,
  isBundleAvailable,
};

export type { BundleType, CosmeticBundle };
