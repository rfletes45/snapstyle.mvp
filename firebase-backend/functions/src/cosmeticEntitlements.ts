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

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import pricingTable from "./shopPricingTable.json";

// =============================================================================
// Types
// =============================================================================

type CosmeticType =
  | "badge"
  | "background"
  | "decoration"
  | "theme"
  | "chat_bubble_color"
  | "chat_font"
  | "chat_animal_theme";
type CosmeticSourceType =
  | "free"
  | "starter"
  | "shop"
  | "achievement"
  | "milestone"
  | "event"
  | "exclusive"
  | "grant";

interface EntitlementDoc {
  cosmeticId: string;
  type: CosmeticType;
  grantedAt: admin.firestore.Timestamp;
  source: CosmeticSourceType;
  metadata?: Record<string, unknown>;
}

interface PurchaseCosmeticRequest {
  cosmeticId: string;
}

interface PurchaseCosmeticResult {
  success: boolean;
  transactionId?: string;
  newBalance?: number;
  error?: string;
  errorCode?: string;
}

interface GrantCosmeticRequest {
  userId: string;
  cosmeticId: string;
  type: CosmeticType;
  source: CosmeticSourceType;
  metadata?: Record<string, unknown>;
}

interface GrantCosmeticResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// Built-in shop catalog (server-authoritative pricing)
//
// Generated from the SHARED pricing table at:
//   shared/cosmetics/shopPricingTable.json
// This file is copied into src/ by scripts/syncPricingTable.js at build time.
//
// ⚠️  DO NOT hardcode items here. Edit shopPricingTable.json instead.
//     Both client and server derive their catalogs from that single file.
// =============================================================================

interface PricingEntry {
  id: string;
  type: string;
  name: string;
  priceTokens: number;
}

const BUILTIN_SHOP_CATALOG: Record<
  string,
  { type: CosmeticType; priceTokens: number; name: string }
> = Object.fromEntries(
  (pricingTable.items as PricingEntry[]).map((entry) => [
    entry.id,
    {
      type: entry.type as CosmeticType,
      priceTokens: entry.priceTokens,
      name: entry.name,
    },
  ]),
);

// =============================================================================
// Helpers
// =============================================================================

function generateTransactionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `txn_${ts}_${rand}`;
}

/**
 * Write back-compat records to legacy paths.
 * TODO: Remove after full cutover to Entitlements-only model.
 */
async function writeLegacyOwnership(
  db: admin.firestore.Firestore,
  uid: string,
  cosmeticId: string,
  type: CosmeticType,
  source: string,
  transaction?: admin.firestore.Transaction,
): Promise<void> {
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
    } else {
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
    } else {
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
    } else {
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
    } else {
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

export const purchaseCosmeticWithTokens = functions.https.onCall(
  async (
    data: PurchaseCosmeticRequest,
    context,
  ): Promise<PurchaseCosmeticResult> => {
    if (!context.auth) {
      return {
        success: false,
        error: "Not authenticated",
        errorCode: "NOT_AUTHENTICATED",
      };
    }

    const uid = context.auth.uid;
    const { cosmeticId } = data;

    if (
      !cosmeticId ||
      typeof cosmeticId !== "string" ||
      cosmeticId.length > 120
    ) {
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
        let priceTokens: number | null = null;
        let itemType: CosmeticType = "decoration";
        let itemName = cosmeticId;

        // Tier 1: CosmeticsCatalog (Firestore — admin-managed overrides)
        const catalogRef = db.collection("CosmeticsCatalog").doc(cosmeticId);
        const catalogDoc = await tx.get(catalogRef);
        if (catalogDoc.exists) {
          const catalogData = catalogDoc.data()!;
          priceTokens = catalogData.priceTokens ?? null;
          itemType = catalogData.type ?? "decoration";
          itemName = catalogData.name ?? cosmeticId;
        } else {
          // Tier 2: PointsShopCatalog (legacy items)
          const legacyRef = db.collection("PointsShopCatalog").doc(cosmeticId);
          const legacyDoc = await tx.get(legacyRef);
          if (legacyDoc.exists) {
            const legacyData = legacyDoc.data()!;
            priceTokens = legacyData.priceTokens ?? null;
            itemType = (legacyData.type as CosmeticType) ?? "decoration";
            itemName = legacyData.name ?? cosmeticId;
          } else {
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
          functions.logger.warn(
            "[cosmeticEntitlements] Item not found or not purchasable",
            {
              cosmeticId,
              inBuiltinCatalog: cosmeticId in BUILTIN_SHOP_CATALOG,
              builtinKeys: Object.keys(BUILTIN_SHOP_CATALOG).filter((k) =>
                k.startsWith(cosmeticId.split("_")[0]),
              ),
            },
          );
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
        const walletData = walletDoc.data()!;
        const currentBalance: number =
          walletData.tokensBalance ?? walletData.tokens ?? 0;

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
        const entitlementData: EntitlementDoc = {
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
        } as PurchaseCosmeticResult;
      });

      return result;
    } catch (error: unknown) {
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
  },
);

// =============================================================================
// grantCosmeticEntitlement
//
// Server-only: grants an entitlement without payment.
// Used by achievement triggers, event rewards, admin grants.
// =============================================================================

export const grantCosmeticEntitlement = functions.https.onCall(
  async (data: GrantCosmeticRequest, context): Promise<GrantCosmeticResult> => {
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
        functions.logger.info(
          "[cosmeticEntitlements] Already entitled, skipping",
          { userId, cosmeticId },
        );
        return { success: true };
      }

      const now = admin.firestore.Timestamp.now();
      const entDoc: EntitlementDoc = {
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      functions.logger.error("[cosmeticEntitlements] Grant error", {
        userId,
        cosmeticId,
        error: msg,
      });
      return { success: false, error: "Grant failed" };
    }
  },
);
