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

import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import * as functions from "firebase-functions";

// =============================================================================
// Types
// =============================================================================

interface ValidateReceiptRequest {
  platform: "ios" | "android";
  productId: string;
  purchaseToken: string; // Android purchase token
  receiptData?: string; // iOS receipt data (base64)
  transactionId?: string; // iOS transaction ID
}

interface ValidateReceiptResponse {
  success: boolean;
  purchaseId?: string;
  grantedItems?: string[];
  grantedTokens?: number;
  error?: string;
}

interface ProductConfig {
  id: string;
  productId: string;
  type: "token_pack" | "bundle" | "exclusive";
  rewards: {
    tokens?: number;
    bonusTokens?: number;
    itemIds?: string[];
  };
  basePriceUSD: number;
  limitedEdition?: boolean;
  totalSupply?: number;
  purchaseLimit?: number;
}

interface AppleReceiptResponse {
  status: number;
  receipt?: {
    in_app: Array<{
      product_id: string;
      transaction_id: string;
      purchase_date_ms: string;
      original_transaction_id: string;
    }>;
  };
}

interface GooglePurchaseResponse {
  purchaseState: number; // 0 = purchased, 1 = canceled, 2 = pending
  consumptionState: number;
  acknowledgementState: number;
  orderId: string;
  purchaseTimeMillis: string;
}

// =============================================================================
// Configuration
// =============================================================================

// Apple URLs
const APPLE_PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

// Status codes indicating sandbox receipt sent to production
const APPLE_SANDBOX_STATUS = 21007;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a transaction has already been processed
 */
async function checkDuplicateTransaction(
  transactionIdentifier: string,
  platform: "ios" | "android",
): Promise<admin.firestore.DocumentSnapshot | null> {
  const db = admin.firestore();
  const purchasesRef = db.collection("IAPPurchases");

  const field = platform === "ios" ? "transactionId" : "purchaseToken";
  const query = purchasesRef
    .where(field, "==", transactionIdentifier)
    .where("status", "in", ["verified", "delivered"])
    .limit(1);

  const snapshot = await query.get();

  if (!snapshot.empty) {
    return snapshot.docs[0];
  }

  return null;
}

/**
 * Get product configuration from database
 */
async function getProductConfig(
  productId: string,
): Promise<ProductConfig | null> {
  const db = admin.firestore();

  // Try PremiumProducts collection first
  const premiumQuery = db
    .collection("PremiumProducts")
    .where("productId", "==", productId)
    .where("active", "==", true)
    .limit(1);

  const premiumSnapshot = await premiumQuery.get();

  if (!premiumSnapshot.empty) {
    const doc = premiumSnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as ProductConfig;
  }

  // Fall back to StoreProducts collection
  const storeQuery = db
    .collection("StoreProducts")
    .where("productId", "==", productId)
    .where("active", "==", true)
    .limit(1);

  const storeSnapshot = await storeQuery.get();

  if (!storeSnapshot.empty) {
    const doc = storeSnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      productId: data.productId,
      type: data.type || "token_pack",
      rewards: data.rewards || {},
      basePriceUSD: data.basePriceUSD || 0,
    };
  }

  return null;
}

/**
 * Validate receipt with Apple servers
 */
async function validateAppleReceipt(
  receiptData: string,
  expectedProductId: string,
): Promise<{ valid: boolean; details: any; transactionId?: string }> {
  // Get shared secret from config
  const sharedSecret = functions.config().apple?.shared_secret || "";

  // Try production first
  let response = await fetch(APPLE_PRODUCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "receipt-data": receiptData,
      password: sharedSecret,
      "exclude-old-transactions": true,
    }),
  });

  let result: AppleReceiptResponse = await response.json();

  // If sandbox receipt sent to production, retry with sandbox
  if (result.status === APPLE_SANDBOX_STATUS) {
    console.log("[iap] Sandbox receipt detected, retrying with sandbox URL");
    response = await fetch(APPLE_SANDBOX_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "receipt-data": receiptData,
        password: sharedSecret,
        "exclude-old-transactions": true,
      }),
    });
    result = await response.json();
  }

  // Status 0 = valid
  if (result.status !== 0) {
    console.error("[iap] Apple receipt validation failed:", result.status);
    return { valid: false, details: null };
  }

  // Find the specific purchase
  const purchase = result.receipt?.in_app?.find(
    (p) => p.product_id === expectedProductId,
  );

  if (!purchase) {
    console.error("[iap] Product not found in receipt:", expectedProductId);
    return { valid: false, details: null };
  }

  return {
    valid: true,
    details: purchase,
    transactionId: purchase.transaction_id,
  };
}

/**
 * Validate purchase with Google Play servers
 */
async function validateGooglePurchase(
  productId: string,
  purchaseToken: string,
): Promise<{ valid: boolean; details: any; orderId?: string }> {
  // In production, you would use the Google Play Developer API
  // This requires setting up a service account and OAuth
  const packageName =
    functions.config().android?.package_name || "com.snapstyle.app";

  // For now, we'll implement a simplified validation
  // In production, use googleapis library:
  // const { google } = require('googleapis');
  // const androidpublisher = google.androidpublisher('v3');

  try {
    // Mock validation for development - REPLACE IN PRODUCTION
    if (process.env.FUNCTIONS_EMULATOR) {
      console.log("[iap] Emulator detected, mock validating Google purchase");
      return {
        valid: true,
        details: {
          purchaseState: 0,
          orderId: `mock_order_${Date.now()}`,
        },
        orderId: `mock_order_${Date.now()}`,
      };
    }

    // Production implementation would be:
    // const auth = new google.auth.GoogleAuth({
    //   scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    // });
    // const authClient = await auth.getClient();
    // const response = await androidpublisher.purchases.products.get({
    //   auth: authClient,
    //   packageName,
    //   productId,
    //   token: purchaseToken,
    // });

    console.warn("[iap] Google Play validation not fully implemented");
    return { valid: false, details: null };
  } catch (error) {
    console.error("[iap] Google purchase validation error:", error);
    return { valid: false, details: null };
  }
}

/**
 * Grant rewards to user
 */
async function grantRewards(
  uid: string,
  product: ProductConfig,
): Promise<{ tokens: number; items: string[] }> {
  const db = admin.firestore();
  const batch = db.batch();

  let tokensGranted = 0;
  const itemsGranted: string[] = [];

  // Grant tokens
  if (product.rewards.tokens || product.rewards.bonusTokens) {
    const totalTokens =
      (product.rewards.tokens || 0) + (product.rewards.bonusTokens || 0);

    const walletRef = db.collection("Wallets").doc(uid);
    batch.set(
      walletRef,
      {
        tokensBalance: FieldValue.increment(totalTokens),
        lifetimeTokensEarned: FieldValue.increment(totalTokens),
        lastUpdated: Timestamp.now(),
      },
      { merge: true },
    );

    tokensGranted = totalTokens;
  }

  // Grant items
  if (product.rewards.itemIds && product.rewards.itemIds.length > 0) {
    const inventoryRef = db.collection("Inventory").doc(uid);

    for (const itemId of product.rewards.itemIds) {
      // Add to inventory
      batch.set(
        inventoryRef,
        {
          items: {
            [itemId]: {
              unlockedAt: Timestamp.now(),
              source: "premium_purchase",
              productId: product.productId,
            },
          },
          lastUpdated: Timestamp.now(),
        },
        { merge: true },
      );

      itemsGranted.push(itemId);
    }
  }

  // Update product supply for limited editions
  if (product.limitedEdition && product.totalSupply) {
    const productRef = db.collection("PremiumProducts").doc(product.id);
    batch.update(productRef, {
      remaining: FieldValue.increment(-1),
    });
  }

  await batch.commit();

  return { tokens: tokensGranted, items: itemsGranted };
}

/**
 * Record purchase in database
 */
async function recordPurchase(params: {
  uid: string;
  platform: "ios" | "android";
  productId: string;
  product: ProductConfig;
  transactionId?: string;
  purchaseToken?: string;
  orderId?: string;
  rewards: { tokens: number; items: string[] };
}): Promise<string> {
  const db = admin.firestore();

  const purchaseData = {
    uid: params.uid,
    platform: params.platform,
    productId: params.productId,
    type: params.product.type,
    status: "delivered",
    transactionId: params.transactionId || null,
    purchaseToken: params.purchaseToken || null,
    orderId: params.orderId || null,
    grantedTokens: params.rewards.tokens,
    grantedItems: params.rewards.items,
    priceUSD: params.product.basePriceUSD,
    purchasedAt: Timestamp.now(),
    verifiedAt: Timestamp.now(),
    deliveredAt: Timestamp.now(),
  };

  const docRef = await db.collection("IAPPurchases").add(purchaseData);

  // Also record in user's purchase history
  await db.collection(`Users/${params.uid}/purchases`).add({
    ...purchaseData,
    purchaseId: docRef.id,
  });

  return docRef.id;
}

/**
 * Acknowledge Google Play purchase
 */
async function acknowledgeGooglePurchase(
  productId: string,
  purchaseToken: string,
): Promise<void> {
  // In production, call the acknowledgement API
  // const packageName = functions.config().android?.package_name;
  // await androidpublisher.purchases.products.acknowledge({
  //   packageName,
  //   productId,
  //   token: purchaseToken,
  // });
  console.log("[iap] Acknowledging Google purchase:", productId);
}

// =============================================================================
// Cloud Functions
// =============================================================================

/**
 * Validate IAP receipt and grant rewards
 *
 * This is the main entry point for processing purchases.
 * Called by the client after a successful store purchase.
 */
export const validateReceipt = functions.https.onCall(
  async (
    data: ValidateReceiptRequest,
    context,
  ): Promise<ValidateReceiptResponse> => {
    // 1. Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in to validate purchases",
      );
    }

    const uid = context.auth.uid;
    const { platform, productId, purchaseToken, receiptData, transactionId } =
      data;

    // 2. Validate input
    if (!platform || !productId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: platform, productId",
      );
    }

    if (platform === "ios" && !receiptData) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "iOS purchases require receiptData",
      );
    }

    if (platform === "android" && !purchaseToken) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Android purchases require purchaseToken",
      );
    }

    console.log(`[iap] Validating ${platform} receipt for product:`, productId);

    try {
      // 3. Check for duplicate transaction
      const transactionIdentifier =
        platform === "ios" ? transactionId! : purchaseToken!;
      const existingPurchase = await checkDuplicateTransaction(
        transactionIdentifier,
        platform,
      );

      if (existingPurchase) {
        const data = existingPurchase.data();
        console.log("[iap] Duplicate transaction found:", existingPurchase.id);
        return {
          success: true,
          purchaseId: existingPurchase.id,
          grantedItems: data?.grantedItems || [],
          grantedTokens: data?.grantedTokens || 0,
        };
      }

      // 4. Get product configuration
      const product = await getProductConfig(productId);

      if (!product) {
        console.error("[iap] Product not found:", productId);
        return { success: false, error: "Product not found" };
      }

      // 5. Validate with store
      let isValid = false;
      let purchaseDetails: any = null;
      let verifiedTransactionId: string | undefined;
      let orderId: string | undefined;

      if (platform === "ios") {
        const result = await validateAppleReceipt(receiptData!, productId);
        isValid = result.valid;
        purchaseDetails = result.details;
        verifiedTransactionId = result.transactionId;
      } else {
        const result = await validateGooglePurchase(productId, purchaseToken!);
        isValid = result.valid;
        purchaseDetails = result.details;
        orderId = result.orderId;
      }

      if (!isValid) {
        console.error("[iap] Receipt validation failed for:", productId);
        return { success: false, error: "Invalid receipt" };
      }

      console.log("[iap] Receipt validated successfully for:", productId);

      // 6. Grant rewards
      const rewards = await grantRewards(uid, product);

      console.log(
        `[iap] Granted ${rewards.tokens} tokens and ${rewards.items.length} items to ${uid}`,
      );

      // 7. Record purchase
      const purchaseId = await recordPurchase({
        uid,
        platform,
        productId,
        product,
        transactionId: verifiedTransactionId || transactionId,
        purchaseToken: platform === "android" ? purchaseToken : undefined,
        orderId,
        rewards,
      });

      // 8. Acknowledge Android purchase
      if (platform === "android") {
        await acknowledgeGooglePurchase(productId, purchaseToken!);
      }

      console.log("[iap] Purchase completed:", purchaseId);

      return {
        success: true,
        purchaseId,
        grantedItems: rewards.items,
        grantedTokens: rewards.tokens,
      };
    } catch (error: any) {
      console.error("[iap] Receipt validation error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to process purchase",
      );
    }
  },
);

/**
 * Restore previous purchases
 *
 * Called when user reinstalls app or switches devices.
 * Re-validates all previous non-consumable purchases.
 */
export const restorePurchases = functions.https.onCall(
  async (
    data: { platform: "ios" | "android"; receiptData?: string },
    context,
  ): Promise<{
    success: boolean;
    restored: string[];
    error?: string;
  }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const uid = context.auth.uid;
    const { platform, receiptData } = data;

    console.log(`[iap] Restoring purchases for ${uid} on ${platform}`);

    try {
      const db = admin.firestore();
      const restored: string[] = [];

      // Get all delivered purchases for this user
      const purchasesQuery = db
        .collection("IAPPurchases")
        .where("uid", "==", uid)
        .where("status", "==", "delivered");

      const purchasesSnapshot = await purchasesQuery.get();

      // For non-consumables, ensure items are still in inventory
      for (const doc of purchasesSnapshot.docs) {
        const purchase = doc.data();

        if (purchase.grantedItems && purchase.grantedItems.length > 0) {
          // Check if items are in inventory
          const inventoryRef = db.collection("Inventory").doc(uid);
          const inventoryDoc = await inventoryRef.get();
          const inventory = inventoryDoc.data() || {};

          for (const itemId of purchase.grantedItems) {
            if (!inventory.items?.[itemId]) {
              // Re-grant the item
              await inventoryRef.set(
                {
                  items: {
                    [itemId]: {
                      unlockedAt: Timestamp.now(),
                      source: "restored",
                      originalPurchaseId: doc.id,
                    },
                  },
                  lastUpdated: Timestamp.now(),
                },
                { merge: true },
              );
              restored.push(itemId);
            }
          }
        }
      }

      console.log(`[iap] Restored ${restored.length} items for ${uid}`);

      return { success: true, restored };
    } catch (error: any) {
      console.error("[iap] Restore error:", error);
      return { success: false, restored: [], error: error.message };
    }
  },
);

/**
 * Get purchase history for a user
 */
export const getPurchaseHistory = functions.https.onCall(
  async (
    data: { limit?: number },
    context,
  ): Promise<{
    purchases: any[];
    error?: string;
  }> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const uid = context.auth.uid;
    const limit = data.limit || 50;

    try {
      const db = admin.firestore();

      const purchasesQuery = db
        .collection("IAPPurchases")
        .where("uid", "==", uid)
        .orderBy("purchasedAt", "desc")
        .limit(limit);

      const snapshot = await purchasesQuery.get();

      const purchases = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        purchasedAt: doc.data().purchasedAt?.toMillis?.() || null,
        verifiedAt: doc.data().verifiedAt?.toMillis?.() || null,
        deliveredAt: doc.data().deliveredAt?.toMillis?.() || null,
      }));

      return { purchases };
    } catch (error: any) {
      console.error("[iap] Error fetching purchase history:", error);
      return { purchases: [], error: error.message };
    }
  },
);
