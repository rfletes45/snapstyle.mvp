"use strict";
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
exports.grantItem = exports.purchaseWithTokens = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
/** Read canonical token balance with legacy fallback */
function getTokenBalance(wallet) {
    return wallet.tokensBalance ?? wallet.tokens ?? 0;
}
// =============================================================================
// Error Codes
// =============================================================================
const ShopErrorCode = {
    INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
    ITEM_NOT_FOUND: "ITEM_NOT_FOUND",
    ALREADY_OWNED: "ALREADY_OWNED",
    OUT_OF_STOCK: "OUT_OF_STOCK",
    PURCHASE_LIMIT_REACHED: "PURCHASE_LIMIT_REACHED",
    ITEM_NOT_AVAILABLE: "ITEM_NOT_AVAILABLE",
    NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
    SERVER_ERROR: "SERVER_ERROR",
    INVALID_INPUT: "INVALID_INPUT",
};
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Check if an item is currently available
 */
function isItemAvailable(item) {
    const now = admin.firestore.Timestamp.now();
    // Check if item is active
    if (item.active === false) {
        return false;
    }
    // Check availability window
    if (item.availableFrom && item.availableFrom.toMillis() > now.toMillis()) {
        return false;
    }
    if (item.availableTo && item.availableTo.toMillis() < now.toMillis()) {
        return false;
    }
    // Check stock
    if (item.stock !== undefined && item.stock !== null && item.stock <= 0) {
        return false;
    }
    return true;
}
/**
 * Generate a unique transaction ID
 */
function generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `txn_${timestamp}_${randomPart}`;
}
// =============================================================================
// Cloud Functions
// =============================================================================
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
exports.purchaseWithTokens = functions.https.onCall(async (data, context) => {
    const db = admin.firestore();
    // -------------------------------------------------------------------------
    // Authentication Check
    // -------------------------------------------------------------------------
    if (!context.auth) {
        functions.logger.warn("[shop] Unauthenticated purchase attempt");
        return {
            success: false,
            error: "Please log in to make purchases",
            errorCode: ShopErrorCode.NOT_AUTHENTICATED,
        };
    }
    const uid = context.auth.uid;
    // -------------------------------------------------------------------------
    // Input Validation
    // -------------------------------------------------------------------------
    const { itemId } = data;
    if (!itemId || typeof itemId !== "string" || itemId.length > 100) {
        functions.logger.warn("[shop] Invalid itemId:", { itemId, uid });
        return {
            success: false,
            error: "Invalid item ID",
            errorCode: ShopErrorCode.INVALID_INPUT,
        };
    }
    functions.logger.info("[shop] Purchase initiated", { uid, itemId });
    // -------------------------------------------------------------------------
    // Transaction
    // -------------------------------------------------------------------------
    try {
        const result = await db.runTransaction(async (transaction) => {
            // ---------------------------------------------------------------------
            // 1. Fetch item data
            // ---------------------------------------------------------------------
            const itemRef = db.collection("PointsShopCatalog").doc(itemId);
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists) {
                functions.logger.warn("[shop] Item not found:", { itemId });
                return {
                    success: false,
                    error: "Item not found",
                    errorCode: ShopErrorCode.ITEM_NOT_FOUND,
                };
            }
            const item = itemDoc.data();
            // ---------------------------------------------------------------------
            // 2. Validate availability
            // ---------------------------------------------------------------------
            if (!isItemAvailable(item)) {
                functions.logger.warn("[shop] Item not available:", {
                    itemId,
                    active: item.active,
                    stock: item.stock,
                });
                return {
                    success: false,
                    error: "This item is no longer available",
                    errorCode: ShopErrorCode.ITEM_NOT_AVAILABLE,
                };
            }
            // ---------------------------------------------------------------------
            // 3. Fetch user's wallet
            // ---------------------------------------------------------------------
            const walletRef = db.collection("Wallets").doc(uid);
            const walletDoc = await transaction.get(walletRef);
            if (!walletDoc.exists) {
                functions.logger.warn("[shop] Wallet not found:", { uid });
                return {
                    success: false,
                    error: "Wallet not found. Please try again.",
                    errorCode: ShopErrorCode.SERVER_ERROR,
                };
            }
            const wallet = walletDoc.data();
            // ---------------------------------------------------------------------
            // 4. Check balance
            // ---------------------------------------------------------------------
            const balance = getTokenBalance(wallet);
            if (balance < item.priceTokens) {
                functions.logger.info("[shop] Insufficient funds:", {
                    uid,
                    balance,
                    price: item.priceTokens,
                });
                return {
                    success: false,
                    error: `You need ${item.priceTokens - balance} more tokens`,
                    errorCode: ShopErrorCode.INSUFFICIENT_FUNDS,
                };
            }
            // ---------------------------------------------------------------------
            // 5. Check ownership
            // ---------------------------------------------------------------------
            const inventoryRef = db
                .collection("Users")
                .doc(uid)
                .collection("inventory")
                .doc(item.itemId);
            const inventoryDoc = await transaction.get(inventoryRef);
            if (inventoryDoc.exists) {
                functions.logger.info("[shop] Already owned:", {
                    uid,
                    itemId: item.itemId,
                });
                return {
                    success: false,
                    error: "You already own this item",
                    errorCode: ShopErrorCode.ALREADY_OWNED,
                };
            }
            // ---------------------------------------------------------------------
            // 6. Check purchase limit
            // ---------------------------------------------------------------------
            if (item.purchaseLimit) {
                const purchasesRef = db
                    .collection("Users")
                    .doc(uid)
                    .collection("purchases");
                const purchasesQuery = purchasesRef.where("itemId", "==", itemId);
                const purchasesSnapshot = await transaction.get(purchasesQuery);
                if (purchasesSnapshot.size >= item.purchaseLimit) {
                    functions.logger.info("[shop] Purchase limit reached:", {
                        uid,
                        itemId,
                        limit: item.purchaseLimit,
                    });
                    return {
                        success: false,
                        error: "You've reached the purchase limit for this item",
                        errorCode: ShopErrorCode.PURCHASE_LIMIT_REACHED,
                    };
                }
            }
            // ---------------------------------------------------------------------
            // 7. Check stock
            // ---------------------------------------------------------------------
            if (item.stock !== undefined &&
                item.stock !== null &&
                item.stock <= 0) {
                functions.logger.info("[shop] Out of stock:", { itemId });
                return {
                    success: false,
                    error: "This item is sold out",
                    errorCode: ShopErrorCode.OUT_OF_STOCK,
                };
            }
            // ---------------------------------------------------------------------
            // 8. Execute purchase
            // ---------------------------------------------------------------------
            const transactionId = generateTransactionId();
            const now = admin.firestore.Timestamp.now();
            const newBalance = balance - item.priceTokens;
            // Deduct tokens from wallet (write both canonical + legacy fields)
            transaction.update(walletRef, {
                tokensBalance: newBalance,
                tokens: newBalance, // back-compat
                totalSpent: admin.firestore.FieldValue.increment(item.priceTokens),
                lastUpdated: now,
            });
            // Add item to inventory
            transaction.set(inventoryRef, {
                itemId: item.itemId,
                name: item.name,
                slot: item.slot,
                rarity: item.rarity,
                imagePath: item.imagePath,
                source: "points_shop",
                transactionId,
                acquiredAt: now,
            });
            // Record the purchase
            const purchaseRef = db
                .collection("Users")
                .doc(uid)
                .collection("purchases")
                .doc(transactionId);
            transaction.set(purchaseRef, {
                transactionId,
                itemId: itemId,
                itemName: item.name,
                slot: item.slot,
                rarity: item.rarity,
                priceTokens: item.priceTokens,
                originalPrice: item.originalPrice || item.priceTokens,
                discountPercent: item.discountPercent || 0,
                purchasedAt: now,
                source: "points_shop",
            });
            // Update stock if applicable
            if (item.stock !== undefined && item.stock !== null) {
                transaction.update(itemRef, {
                    stock: admin.firestore.FieldValue.increment(-1),
                });
            }
            functions.logger.info("[shop] Purchase successful:", {
                uid,
                itemId,
                transactionId,
                price: item.priceTokens,
                newBalance,
            });
            return {
                success: true,
                transactionId,
                item: {
                    id: item.itemId,
                    name: item.name,
                    slot: item.slot,
                },
                newBalance,
            };
        });
        return result;
    }
    catch (error) {
        functions.logger.error("[shop] Purchase error:", {
            uid,
            itemId,
            error: error.message,
            stack: error.stack,
        });
        return {
            success: false,
            error: "Purchase failed. Please try again.",
            errorCode: ShopErrorCode.SERVER_ERROR,
        };
    }
});
/**
 * Grant free item to user (admin or system use)
 *
 * Used for:
 * - Promotional giveaways
 * - Achievement rewards
 * - Compensation for issues
 */
exports.grantItem = functions.https.onCall(async (data, context) => {
    const db = admin.firestore();
    // Check for admin privileges
    if (!context.auth || !context.auth.token.admin) {
        functions.logger.warn("[shop] Unauthorized grant attempt:", {
            uid: context.auth?.uid,
        });
        return {
            success: false,
            error: "Unauthorized",
        };
    }
    const { userId, itemId, reason } = data;
    try {
        // Fetch item data
        const itemRef = db.collection("PointsShopCatalog").doc(itemId);
        const itemDoc = await itemRef.get();
        if (!itemDoc.exists) {
            return {
                success: false,
                error: "Item not found",
            };
        }
        const item = itemDoc.data();
        // Add to inventory
        const inventoryRef = db
            .collection("Users")
            .doc(userId)
            .collection("inventory")
            .doc(item.itemId);
        await inventoryRef.set({
            itemId: item.itemId,
            name: item.name,
            slot: item.slot,
            rarity: item.rarity,
            imagePath: item.imagePath,
            source: "granted",
            reason,
            grantedBy: context.auth.uid,
            acquiredAt: admin.firestore.Timestamp.now(),
        });
        functions.logger.info("[shop] Item granted:", {
            userId,
            itemId,
            reason,
            grantedBy: context.auth.uid,
        });
        return { success: true };
    }
    catch (error) {
        functions.logger.error("[shop] Grant error:", {
            userId,
            itemId,
            error: error.message,
        });
        return {
            success: false,
            error: "Failed to grant item",
        };
    }
});
//# sourceMappingURL=shop.js.map