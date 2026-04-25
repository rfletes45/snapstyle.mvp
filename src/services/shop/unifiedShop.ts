/**
 * Unified Shop Service
 *
 * Single, token-only purchase + purchase-history layer for the unified Shop screen.
 *
 * - Purchase: thin wrapper over the existing atomic Cloud Function
 *   `purchaseCosmeticWithTokens` which performs wallet debit + entitlement
 *   write + transaction record + purchase-history write inside a single
 *   Firestore transaction.
 * - History: real-time + one-shot reads of `Users/{uid}/PurchaseHistory`,
 *   the canonical write path produced by the Cloud Function.
 *
 * No real-money / IAP paths are exposed here.
 *
 * @module services/shop/unifiedShop
 */

import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

import { getAppInstance, getFirestoreInstance } from "@/services/firebase";
import { createLogger } from "@/utils/log";

const logger = createLogger("services/shop/unifiedShop");

// =============================================================================
// Types
// =============================================================================

export interface UnifiedPurchaseResult {
  success: boolean;
  transactionId?: string;
  newBalance?: number;
  error?: string;
  errorCode?:
    | "NOT_AUTHENTICATED"
    | "INVALID_INPUT"
    | "ITEM_NOT_FOUND"
    | "ALREADY_OWNED"
    | "INSUFFICIENT_FUNDS"
    | "SERVER_ERROR";
}

/**
 * Canonical purchase-history record.
 * Matches the shape written by `purchaseCosmeticWithTokens` at
 * `Users/{uid}/PurchaseHistory/{transactionId}`.
 *
 * `itemSnapshot` is normalized client-side from the available record fields
 * so the modal renders correctly even if the source catalog item later
 * changes or is removed.
 */
export interface PurchaseRecord {
  id: string;
  transactionId: string;
  itemId: string;
  itemName: string;
  itemType: string;
  category: string;
  priceTokens: number;
  currency: "tokens";
  purchasedAt: number;
  source: string;
  status: "completed";
  itemSnapshot: {
    id: string;
    name: string;
    type: string;
    priceTokens: number;
  };
}

// =============================================================================
// Purchase
// =============================================================================

/**
 * Purchase a cosmetic with tokens.
 *
 * Delegates to the atomic Cloud Function. Never deducts tokens or grants
 * inventory client-side.
 */
export async function purchaseShopItem(
  cosmeticId: string,
): Promise<UnifiedPurchaseResult> {
  if (!cosmeticId || typeof cosmeticId !== "string") {
    return {
      success: false,
      error: "Invalid item",
      errorCode: "INVALID_INPUT",
    };
  }

  try {
    const functions = getFunctions(getAppInstance());
    const callable = httpsCallable<
      { cosmeticId: string },
      UnifiedPurchaseResult
    >(functions, "purchaseCosmeticWithTokens");

    const result = await callable({ cosmeticId });
    return result.data;
  } catch (error: any) {
    logger.error("Purchase failed:", error);
    return {
      success: false,
      error:
        error?.message ||
        error?.details?.message ||
        "Purchase failed. Please try again.",
      errorCode: "SERVER_ERROR",
    };
  }
}

// =============================================================================
// Purchase History
// =============================================================================

/** Default page size for the history modal. */
export const PURCHASE_HISTORY_PAGE_SIZE = 50;

function parseTimestamp(value: unknown): number {
  if (value == null) return Date.now();
  if (typeof value === "number") return value;
  // Firestore Timestamp
  const anyVal = value as { toMillis?: () => number; seconds?: number };
  if (typeof anyVal.toMillis === "function") {
    try {
      return anyVal.toMillis();
    } catch {
      // fall through
    }
  }
  if (typeof anyVal.seconds === "number") {
    return anyVal.seconds * 1000;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : Date.now();
}

/** Normalize a raw PurchaseHistory doc into a `PurchaseRecord`. */
export function normalizePurchaseRecord(
  id: string,
  data: Record<string, any>,
): PurchaseRecord {
  const itemId = String(data.itemId ?? data.cosmeticId ?? id);
  const itemName = String(data.itemName ?? data.name ?? itemId);
  const itemType = String(data.itemType ?? data.type ?? "item");
  const priceTokens = Number(data.priceTokens ?? 0);
  return {
    id,
    transactionId: String(data.transactionId ?? id),
    itemId,
    itemName,
    itemType,
    category: itemType,
    priceTokens,
    currency: "tokens",
    purchasedAt: parseTimestamp(data.purchasedAt ?? data.createdAt),
    source: String(data.source ?? "shop"),
    status: "completed",
    itemSnapshot: {
      id: itemId,
      name: itemName,
      type: itemType,
      priceTokens,
    },
  };
}

function purchaseHistoryCol(uid: string) {
  return collection(getFirestoreInstance(), "Users", uid, "PurchaseHistory");
}

/**
 * One-shot read of a user's purchase history, newest first.
 */
export async function getPurchaseHistory(
  uid: string,
  max: number = PURCHASE_HISTORY_PAGE_SIZE,
): Promise<PurchaseRecord[]> {
  if (!uid) return [];
  try {
    const q = query(
      purchaseHistoryCol(uid),
      orderBy("purchasedAt", "desc"),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => normalizePurchaseRecord(d.id, d.data()));
  } catch (error) {
    logger.error("getPurchaseHistory error:", error);
    throw error;
  }
}

/**
 * Subscribe to a user's purchase history in real-time (newest first).
 * Returns an unsubscribe function.
 */
export function subscribePurchaseHistory(
  uid: string,
  onUpdate: (records: PurchaseRecord[]) => void,
  onError?: (error: Error) => void,
  max: number = PURCHASE_HISTORY_PAGE_SIZE,
): () => void {
  if (!uid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    purchaseHistoryCol(uid),
    orderBy("purchasedAt", "desc"),
    limit(max),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) =>
        normalizePurchaseRecord(d.id, d.data()),
      );
      onUpdate(items);
    },
    (error) => {
      logger.error("subscribePurchaseHistory error:", error);
      onError?.(error as Error);
    },
  );
}
