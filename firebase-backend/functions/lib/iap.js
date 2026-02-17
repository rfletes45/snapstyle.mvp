"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPurchaseHistory = exports.restorePurchases = exports.validateReceipt = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions"));
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
async function checkDuplicateTransaction(transactionIdentifier, platform) {
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
async function getProductConfig(productId) {
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
        return { id: doc.id, ...doc.data() };
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
async function validateAppleReceipt(receiptData, expectedProductId) {
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
    let result = await response.json();
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
    const purchase = result.receipt?.in_app?.find((p) => p.product_id === expectedProductId);
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
async function validateGooglePurchase(productId, purchaseToken) {
    // In production, you would use the Google Play Developer API
    // This requires setting up a service account and OAuth
    const packageName = functions.config().android?.package_name || "com.snapstyle.app";
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
    }
    catch (error) {
        console.error("[iap] Google purchase validation error:", error);
        return { valid: false, details: null };
    }
}
/**
 * Grant rewards to user
 */
async function grantRewards(uid, product) {
    const db = admin.firestore();
    const batch = db.batch();
    let tokensGranted = 0;
    const itemsGranted = [];
    // Grant tokens
    if (product.rewards.tokens || product.rewards.bonusTokens) {
        const totalTokens = (product.rewards.tokens || 0) + (product.rewards.bonusTokens || 0);
        const walletRef = db.collection("Wallets").doc(uid);
        batch.set(walletRef, {
            tokensBalance: firestore_1.FieldValue.increment(totalTokens),
            lifetimeTokensEarned: firestore_1.FieldValue.increment(totalTokens),
            lastUpdated: firestore_1.Timestamp.now(),
        }, { merge: true });
        tokensGranted = totalTokens;
    }
    // Grant items
    if (product.rewards.itemIds && product.rewards.itemIds.length > 0) {
        const inventoryRef = db.collection("Inventory").doc(uid);
        for (const itemId of product.rewards.itemIds) {
            // Add to inventory
            batch.set(inventoryRef, {
                items: {
                    [itemId]: {
                        unlockedAt: firestore_1.Timestamp.now(),
                        source: "premium_purchase",
                        productId: product.productId,
                    },
                },
                lastUpdated: firestore_1.Timestamp.now(),
            }, { merge: true });
            itemsGranted.push(itemId);
        }
    }
    // Update product supply for limited editions
    if (product.limitedEdition && product.totalSupply) {
        const productRef = db.collection("PremiumProducts").doc(product.id);
        batch.update(productRef, {
            remaining: firestore_1.FieldValue.increment(-1),
        });
    }
    await batch.commit();
    return { tokens: tokensGranted, items: itemsGranted };
}
/**
 * Record purchase in database
 */
async function recordPurchase(params) {
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
        purchasedAt: firestore_1.Timestamp.now(),
        verifiedAt: firestore_1.Timestamp.now(),
        deliveredAt: firestore_1.Timestamp.now(),
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
async function acknowledgeGooglePurchase(productId, purchaseToken) {
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
exports.validateReceipt = functions.https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in to validate purchases");
    }
    const uid = context.auth.uid;
    const { platform, productId, purchaseToken, receiptData, transactionId } = data;
    // 2. Validate input
    if (!platform || !productId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields: platform, productId");
    }
    if (platform === "ios" && !receiptData) {
        throw new functions.https.HttpsError("invalid-argument", "iOS purchases require receiptData");
    }
    if (platform === "android" && !purchaseToken) {
        throw new functions.https.HttpsError("invalid-argument", "Android purchases require purchaseToken");
    }
    console.log(`[iap] Validating ${platform} receipt for product:`, productId);
    try {
        // 3. Check for duplicate transaction
        const transactionIdentifier = platform === "ios" ? transactionId : purchaseToken;
        const existingPurchase = await checkDuplicateTransaction(transactionIdentifier, platform);
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
        let purchaseDetails = null;
        let verifiedTransactionId;
        let orderId;
        if (platform === "ios") {
            const result = await validateAppleReceipt(receiptData, productId);
            isValid = result.valid;
            purchaseDetails = result.details;
            verifiedTransactionId = result.transactionId;
        }
        else {
            const result = await validateGooglePurchase(productId, purchaseToken);
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
        console.log(`[iap] Granted ${rewards.tokens} tokens and ${rewards.items.length} items to ${uid}`);
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
            await acknowledgeGooglePurchase(productId, purchaseToken);
        }
        console.log("[iap] Purchase completed:", purchaseId);
        return {
            success: true,
            purchaseId,
            grantedItems: rewards.items,
            grantedTokens: rewards.tokens,
        };
    }
    catch (error) {
        console.error("[iap] Receipt validation error:", error);
        throw new functions.https.HttpsError("internal", "Failed to process purchase");
    }
});
/**
 * Restore previous purchases
 *
 * Called when user reinstalls app or switches devices.
 * Re-validates all previous non-consumable purchases.
 */
exports.restorePurchases = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    const uid = context.auth.uid;
    const { platform, receiptData } = data;
    console.log(`[iap] Restoring purchases for ${uid} on ${platform}`);
    try {
        const db = admin.firestore();
        const restored = [];
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
                        await inventoryRef.set({
                            items: {
                                [itemId]: {
                                    unlockedAt: firestore_1.Timestamp.now(),
                                    source: "restored",
                                    originalPurchaseId: doc.id,
                                },
                            },
                            lastUpdated: firestore_1.Timestamp.now(),
                        }, { merge: true });
                        restored.push(itemId);
                    }
                }
            }
        }
        console.log(`[iap] Restored ${restored.length} items for ${uid}`);
        return { success: true, restored };
    }
    catch (error) {
        console.error("[iap] Restore error:", error);
        return { success: false, restored: [], error: error.message };
    }
});
/**
 * Get purchase history for a user
 */
exports.getPurchaseHistory = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
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
    }
    catch (error) {
        console.error("[iap] Error fetching purchase history:", error);
        return { purchases: [], error: error.message };
    }
});
//# sourceMappingURL=iap.js.map