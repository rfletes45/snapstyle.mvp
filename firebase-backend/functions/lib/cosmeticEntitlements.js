"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantCosmeticEntitlement = exports.purchaseCosmeticWithTokens = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const shopPricingTable_json_1 = __importDefault(require("./shopPricingTable.json"));
const BUILTIN_SHOP_CATALOG = Object.fromEntries(shopPricingTable_json_1.default.items.map((entry) => [
    entry.id,
    {
        type: entry.type,
        priceTokens: entry.priceTokens,
        name: entry.name,
    },
]));
// =============================================================================
// Helpers
// =============================================================================
function generateTransactionId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 10);
    return `txn_${ts}_${rand}`;
}
/**
 * Write back-compat records to legacy paths.
 * TODO: Remove after full cutover to Entitlements-only model.
 */
async function writeLegacyOwnership(db, uid, cosmeticId, type, source, transaction) {
    const now = admin.firestore.Timestamp.now();
    const userRef = db.collection("Users").doc(uid);
    if (type === "decoration") {
        // Legacy array on user doc
        const updateData = {
            ownedDecorations: admin.firestore.FieldValue.arrayUnion(cosmeticId),
        };
        // Legacy OwnedDecorations subcollection
        const ownedDecRef = userRef.collection("OwnedDecorations").doc(cosmeticId);
        const ownedDecData = {
            decorationId: cosmeticId,
            obtainedAt: Date.now(),
            obtainedVia: source === "shop" ? "purchase" : source,
        };
        if (transaction) {
            transaction.update(userRef, updateData);
            transaction.set(ownedDecRef, ownedDecData, { merge: true });
        }
        else {
            await userRef.update(updateData);
            await ownedDecRef.set(ownedDecData, { merge: true });
        }
    }
    if (type === "theme") {
        // Legacy ownedThemes array
        const updateData = {
            ownedThemes: admin.firestore.FieldValue.arrayUnion(cosmeticId),
        };
        if (transaction) {
            transaction.update(userRef, updateData);
        }
        else {
            await userRef.update(updateData);
        }
    }
    if (type === "badge") {
        // Legacy Badges subcollection
        const badgeRef = userRef.collection("Badges").doc(cosmeticId);
        const badgeData = {
            badgeId: cosmeticId,
            earnedAt: now.toMillis(),
            featured: false,
        };
        if (transaction) {
            transaction.set(badgeRef, badgeData, { merge: true });
        }
        else {
            await badgeRef.set(badgeData, { merge: true });
        }
    }
    // Also write to legacy inventory subcollection for shop items
    if (source === "shop" || source === "grant") {
        const inventoryRef = userRef.collection("inventory").doc(cosmeticId);
        const inventoryData = {
            itemId: cosmeticId,
            acquiredAt: now,
            source,
        };
        if (transaction) {
            transaction.set(inventoryRef, inventoryData, { merge: true });
        }
        else {
            await inventoryRef.set(inventoryData, { merge: true });
        }
    }
}
// =============================================================================
// purchaseCosmeticWithTokens
//
// Atomic purchase: wallet debit + entitlement write + purchase record.
// Uses Wallets/{uid}.tokensBalance (canonical wallet field).
// =============================================================================
exports.purchaseCosmeticWithTokens = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        return {
            success: false,
            error: "Not authenticated",
            errorCode: "NOT_AUTHENTICATED",
        };
    }
    const uid = context.auth.uid;
    const { cosmeticId } = data;
    if (!cosmeticId ||
        typeof cosmeticId !== "string" ||
        cosmeticId.length > 120) {
        return {
            success: false,
            error: "Invalid cosmetic ID",
            errorCode: "INVALID_INPUT",
        };
    }
    const db = admin.firestore();
    functions.logger.info("[cosmeticEntitlements] Purchase initiated", {
        uid,
        cosmeticId,
    });
    try {
        const result = await db.runTransaction(async (tx) => {
            // 1. Read catalog item from CosmeticsCatalog (Firestore) or
            //    fall back to PointsShopCatalog for legacy items.
            let priceTokens = null;
            let itemType = "decoration";
            let itemName = cosmeticId;
            // Tier 1: CosmeticsCatalog (Firestore — admin-managed overrides)
            const catalogRef = db.collection("CosmeticsCatalog").doc(cosmeticId);
            const catalogDoc = await tx.get(catalogRef);
            if (catalogDoc.exists) {
                const catalogData = catalogDoc.data();
                priceTokens = catalogData.priceTokens ?? null;
                itemType = catalogData.type ?? "decoration";
                itemName = catalogData.name ?? cosmeticId;
            }
            else {
                // Tier 2: PointsShopCatalog (legacy items)
                const legacyRef = db.collection("PointsShopCatalog").doc(cosmeticId);
                const legacyDoc = await tx.get(legacyRef);
                if (legacyDoc.exists) {
                    const legacyData = legacyDoc.data();
                    priceTokens = legacyData.priceTokens ?? null;
                    itemType = legacyData.type ?? "decoration";
                    itemName = legacyData.name ?? cosmeticId;
                }
                else {
                    // Tier 3: Built-in static catalog (standard cosmetics)
                    const builtIn = BUILTIN_SHOP_CATALOG[cosmeticId];
                    if (builtIn) {
                        priceTokens = builtIn.priceTokens;
                        itemType = builtIn.type;
                        itemName = builtIn.name;
                    }
                }
            }
            if (priceTokens == null || priceTokens <= 0) {
                functions.logger.warn("[cosmeticEntitlements] Item not found or not purchasable", {
                    cosmeticId,
                    inBuiltinCatalog: cosmeticId in BUILTIN_SHOP_CATALOG,
                    builtinKeys: Object.keys(BUILTIN_SHOP_CATALOG).filter((k) => k.startsWith(cosmeticId.split("_")[0])),
                });
                return {
                    success: false,
                    error: "Item not found or not purchasable",
                    errorCode: "ITEM_NOT_FOUND",
                };
            }
            // 2. Check existing entitlement
            const entRef = db
                .collection("Users")
                .doc(uid)
                .collection("Entitlements")
                .doc(cosmeticId);
            const entDoc = await tx.get(entRef);
            if (entDoc.exists) {
                return {
                    success: false,
                    error: "You already own this item",
                    errorCode: "ALREADY_OWNED",
                };
            }
            // 3. Read wallet (canonical field: tokensBalance)
            const walletRef = db.collection("Wallets").doc(uid);
            const walletDoc = await tx.get(walletRef);
            if (!walletDoc.exists) {
                return {
                    success: false,
                    error: "Wallet not found",
                    errorCode: "SERVER_ERROR",
                };
            }
            const walletData = walletDoc.data();
            const currentBalance = walletData.tokensBalance ?? walletData.tokens ?? 0;
            if (currentBalance < priceTokens) {
                return {
                    success: false,
                    error: `You need ${priceTokens - currentBalance} more tokens`,
                    errorCode: "INSUFFICIENT_FUNDS",
                };
            }
            // 4. Execute atomic writes
            const transactionId = generateTransactionId();
            const now = admin.firestore.Timestamp.now();
            const newBalance = currentBalance - priceTokens;
            // Debit wallet (write both fields for back-compat)
            tx.update(walletRef, {
                tokensBalance: newBalance,
                tokens: newBalance, // back-compat: shop.ts reads `tokens`
                totalSpent: admin.firestore.FieldValue.increment(priceTokens),
                updatedAt: now.toMillis(),
                lastUpdated: now,
            });
            // Write entitlement (canonical)
            const entitlementData = {
                cosmeticId,
                type: itemType,
                grantedAt: now,
                source: "shop",
                metadata: { transactionId, priceTokens },
            };
            tx.set(entRef, entitlementData);
            // Write transaction record
            const txRef = db.collection("Transactions").doc(transactionId);
            tx.set(txRef, {
                uid,
                type: "cosmetic_purchase",
                cosmeticId,
                cosmeticType: itemType,
                amount: -priceTokens,
                balanceAfter: newBalance,
                createdAt: now,
                transactionId,
            });
            // Write purchase history (canonical: Users/{uid}/PurchaseHistory)
            const phRef = db
                .collection("Users")
                .doc(uid)
                .collection("PurchaseHistory")
                .doc(transactionId);
            tx.set(phRef, {
                transactionId,
                itemId: cosmeticId,
                itemName,
                itemType,
                priceTokens,
                purchasedAt: now,
                source: "cosmetics_shop",
            });
            // Back-compat legacy writes
            await writeLegacyOwnership(db, uid, cosmeticId, itemType, "shop", tx);
            functions.logger.info("[cosmeticEntitlements] Purchase complete", {
                uid,
                cosmeticId,
                transactionId,
                priceTokens,
                newBalance,
            });
            return {
                success: true,
                transactionId,
                newBalance,
            };
        });
        return result;
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        functions.logger.error("[cosmeticEntitlements] Purchase error", {
            uid,
            cosmeticId,
            error: msg,
        });
        return {
            success: false,
            error: "Purchase failed. Please try again.",
            errorCode: "SERVER_ERROR",
        };
    }
});
// =============================================================================
// grantCosmeticEntitlement
//
// Server-only: grants an entitlement without payment.
// Used by achievement triggers, event rewards, admin grants.
// =============================================================================
exports.grantCosmeticEntitlement = functions.https.onCall(async (data, context) => {
    // Admin-only OR internal service account
    if (!context.auth) {
        return { success: false, error: "Not authenticated" };
    }
    const { userId, cosmeticId, type, source, metadata } = data;
    if (!userId || !cosmeticId || !type) {
        return { success: false, error: "Missing required fields" };
    }
    // For admin grants, require admin claim
    if (source === "grant" && !context.auth.token.admin) {
        return { success: false, error: "Admin required for direct grants" };
    }
    const db = admin.firestore();
    try {
        const entRef = db
            .collection("Users")
            .doc(userId)
            .collection("Entitlements")
            .doc(cosmeticId);
        const existing = await entRef.get();
        if (existing.exists) {
            functions.logger.info("[cosmeticEntitlements] Already entitled, skipping", { userId, cosmeticId });
            return { success: true };
        }
        const now = admin.firestore.Timestamp.now();
        const entDoc = {
            cosmeticId,
            type,
            grantedAt: now,
            source,
            metadata: {
                ...metadata,
                grantedBy: context.auth.uid,
            },
        };
        await entRef.set(entDoc);
        // Back-compat legacy writes
        await writeLegacyOwnership(db, userId, cosmeticId, type, source);
        functions.logger.info("[cosmeticEntitlements] Entitlement granted", {
            userId,
            cosmeticId,
            type,
            source,
        });
        return { success: true };
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        functions.logger.error("[cosmeticEntitlements] Grant error", {
            userId,
            cosmeticId,
            error: msg,
        });
        return { success: false, error: "Grant failed" };
    }
});
//# sourceMappingURL=cosmeticEntitlements.js.map