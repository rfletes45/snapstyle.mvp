/**
 * Purchase History Service
 *
 * Manages purchase history records and provides filtering, searching,
 * and analytics for user purchases.
 *
 * Features:
 * - Get all purchases with pagination
 * - Filter by type (cosmetic, bundle, currency, premium)
 * - Filter by date range
 * - Get purchase statistics
 * - Get refund history
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.4
 */

import {
  collection,
  doc,
  DocumentSnapshot,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { getAuthInstance, getFirestoreInstance } from "./firebase";

// =============================================================================
// Types
// =============================================================================

export interface PurchaseRecord {
  id: string;
  userId: string;
  type:
    | "cosmetic"
    | "bundle"
    | "currency"
    | "premium"
    | "gift_received"
    | "gift_sent";
  itemId: string;
  itemName: string;
  itemDescription?: string;
  itemRarity?: string;
  itemImagePath?: string;
  quantity: number;
  priceTokens?: number;
  priceUSD?: number;
  originalPrice?: number;
  discountPercent?: number;
  paymentMethod: "tokens" | "iap" | "gift" | "promo";
  transactionId?: string;
  purchasedAt: number;
  refundedAt?: number;
  refundReason?: string;
  giftInfo?: {
    senderId?: string;
    senderName?: string;
    recipientId?: string;
    recipientName?: string;
    message?: string;
  };
  metadata?: Record<string, any>;
}

export interface PurchaseStats {
  totalPurchases: number;
  totalSpentTokens: number;
  totalSpentUSD: number;
  cosmeticsPurchased: number;
  bundlesPurchased: number;
  currencyPurchased: number;
  premiumPurchased: number;
  giftsSent: number;
  giftsReceived: number;
  averagePurchaseTokens: number;
  mostPurchasedCategory?: string;
  firstPurchaseDate?: number;
  lastPurchaseDate?: number;
}

export interface PurchaseFilter {
  type?: PurchaseRecord["type"] | "all";
  paymentMethod?: PurchaseRecord["paymentMethod"] | "all";
  startDate?: number;
  endDate?: number;
  minPrice?: number;
  maxPrice?: number;
  includeRefunds?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// =============================================================================
// Purchase History Queries
// =============================================================================

/**
 * Get all purchases with pagination
 */
export async function getPurchases(
  filter?: PurchaseFilter,
  pageSize: number = DEFAULT_PAGE_SIZE,
  lastDoc?: DocumentSnapshot,
): Promise<{
  purchases: PurchaseRecord[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}> {
  const db = getFirestoreInstance();
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be authenticated");
  }

  const purchasesRef = collection(db, "Users", user.uid, "PurchaseHistory");
  const constraints: any[] = [];

  // Base ordering
  constraints.push(orderBy("purchasedAt", "desc"));

  // Build query based on filters
  if (filter) {
    // Type filter
    if (filter.type && filter.type !== "all") {
      constraints.unshift(where("type", "==", filter.type));
    }

    // Payment method filter
    if (filter.paymentMethod && filter.paymentMethod !== "all") {
      constraints.unshift(where("paymentMethod", "==", filter.paymentMethod));
    }

    // Date range filters
    if (filter.startDate) {
      constraints.push(where("purchasedAt", ">=", filter.startDate));
    }
    if (filter.endDate) {
      constraints.push(where("purchasedAt", "<=", filter.endDate));
    }

    // Exclude refunds by default
    if (!filter.includeRefunds) {
      constraints.push(where("refundedAt", "==", null));
    }
  }

  // Pagination
  constraints.push(limit(Math.min(pageSize, MAX_PAGE_SIZE) + 1));
  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(purchasesRef, ...constraints);
  const snapshot = await getDocs(q);

  const purchases: PurchaseRecord[] = [];
  let lastDocument: DocumentSnapshot | null = null;
  let hasMore = false;

  const docs = snapshot.docs;
  if (docs.length > pageSize) {
    hasMore = true;
    docs.pop(); // Remove the extra doc we fetched to check for more
  }

  docs.forEach((doc) => {
    const data = doc.data();
    purchases.push({
      id: doc.id,
      userId: user.uid,
      type: data.type,
      itemId: data.itemId,
      itemName: data.itemName,
      itemDescription: data.itemDescription,
      itemRarity: data.itemRarity,
      itemImagePath: data.itemImagePath,
      quantity: data.quantity || 1,
      priceTokens: data.priceTokens,
      priceUSD: data.priceUSD,
      originalPrice: data.originalPrice,
      discountPercent: data.discountPercent,
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId,
      purchasedAt: data.purchasedAt?.toMillis?.() || data.purchasedAt,
      refundedAt: data.refundedAt?.toMillis?.() || data.refundedAt,
      refundReason: data.refundReason,
      giftInfo: data.giftInfo,
      metadata: data.metadata,
    });
    lastDocument = doc;
  });

  return {
    purchases,
    lastDoc: lastDocument,
    hasMore,
  };
}

/**
 * Get a single purchase by ID
 */
export async function getPurchaseById(
  purchaseId: string,
): Promise<PurchaseRecord | null> {
  const db = getFirestoreInstance();
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be authenticated");
  }

  const purchaseRef = doc(db, "Users", user.uid, "PurchaseHistory", purchaseId);
  const purchaseDoc = await getDoc(purchaseRef);

  if (!purchaseDoc.exists()) {
    return null;
  }

  const data = purchaseDoc.data();
  return {
    id: purchaseDoc.id,
    userId: user.uid,
    type: data.type,
    itemId: data.itemId,
    itemName: data.itemName,
    itemDescription: data.itemDescription,
    itemRarity: data.itemRarity,
    itemImagePath: data.itemImagePath,
    quantity: data.quantity || 1,
    priceTokens: data.priceTokens,
    priceUSD: data.priceUSD,
    originalPrice: data.originalPrice,
    discountPercent: data.discountPercent,
    paymentMethod: data.paymentMethod,
    transactionId: data.transactionId,
    purchasedAt: data.purchasedAt?.toMillis?.() || data.purchasedAt,
    refundedAt: data.refundedAt?.toMillis?.() || data.refundedAt,
    refundReason: data.refundReason,
    giftInfo: data.giftInfo,
    metadata: data.metadata,
  };
}

/**
 * Get recent purchases (last N)
 */
export async function getRecentPurchases(
  count: number = 5,
): Promise<PurchaseRecord[]> {
  const { purchases } = await getPurchases(undefined, count);
  return purchases;
}

/**
 * Get purchases by type
 */
export async function getPurchasesByType(
  type: PurchaseRecord["type"],
): Promise<PurchaseRecord[]> {
  const { purchases } = await getPurchases({ type }, 100);
  return purchases;
}

/**
 * Get purchases within date range
 */
export async function getPurchasesInRange(
  startDate: Date,
  endDate: Date,
): Promise<PurchaseRecord[]> {
  const { purchases } = await getPurchases(
    {
      startDate: startDate.getTime(),
      endDate: endDate.getTime(),
    },
    100,
  );
  return purchases;
}

// =============================================================================
// Purchase Statistics
// =============================================================================

/**
 * Get purchase statistics
 */
export async function getPurchaseStats(): Promise<PurchaseStats> {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User must be authenticated");
  }

  // Fetch all purchases to calculate stats
  const allPurchases: PurchaseRecord[] = [];
  let lastDoc: DocumentSnapshot | null = null;
  let hasMore = true;

  while (hasMore) {
    const result = await getPurchases(
      { includeRefunds: false },
      50,
      lastDoc || undefined,
    );
    allPurchases.push(...result.purchases);
    lastDoc = result.lastDoc;
    hasMore = result.hasMore;
  }

  // Calculate statistics
  let totalSpentTokens = 0;
  let totalSpentUSD = 0;
  let cosmeticsPurchased = 0;
  let bundlesPurchased = 0;
  let currencyPurchased = 0;
  let premiumPurchased = 0;
  let giftsSent = 0;
  let giftsReceived = 0;
  const categoryCount: Record<string, number> = {};

  allPurchases.forEach((purchase) => {
    // Sum spending
    totalSpentTokens += purchase.priceTokens || 0;
    totalSpentUSD += purchase.priceUSD || 0;

    // Count by type
    switch (purchase.type) {
      case "cosmetic":
        cosmeticsPurchased++;
        break;
      case "bundle":
        bundlesPurchased++;
        break;
      case "currency":
        currencyPurchased++;
        break;
      case "premium":
        premiumPurchased++;
        break;
      case "gift_sent":
        giftsSent++;
        break;
      case "gift_received":
        giftsReceived++;
        break;
    }

    // Track category
    if (purchase.type) {
      categoryCount[purchase.type] = (categoryCount[purchase.type] || 0) + 1;
    }
  });

  // Find most purchased category
  let mostPurchasedCategory: string | undefined;
  let maxCount = 0;
  Object.entries(categoryCount).forEach(([category, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostPurchasedCategory = category;
    }
  });

  // Get first and last purchase dates
  const sortedByDate = [...allPurchases].sort(
    (a, b) => a.purchasedAt - b.purchasedAt,
  );
  const firstPurchaseDate = sortedByDate[0]?.purchasedAt;
  const lastPurchaseDate = sortedByDate[sortedByDate.length - 1]?.purchasedAt;

  // Calculate average
  const averagePurchaseTokens =
    allPurchases.length > 0
      ? Math.round(totalSpentTokens / allPurchases.length)
      : 0;

  return {
    totalPurchases: allPurchases.length,
    totalSpentTokens,
    totalSpentUSD: Math.round(totalSpentUSD * 100) / 100,
    cosmeticsPurchased,
    bundlesPurchased,
    currencyPurchased,
    premiumPurchased,
    giftsSent,
    giftsReceived,
    averagePurchaseTokens,
    mostPurchasedCategory,
    firstPurchaseDate,
    lastPurchaseDate,
  };
}

// =============================================================================
// Search & Filter Helpers
// =============================================================================

/**
 * Search purchases by item name
 */
export function searchPurchases(
  purchases: PurchaseRecord[],
  searchTerm: string,
): PurchaseRecord[] {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return purchases;

  return purchases.filter(
    (purchase) =>
      purchase.itemName.toLowerCase().includes(term) ||
      purchase.itemDescription?.toLowerCase().includes(term) ||
      purchase.type.toLowerCase().includes(term),
  );
}

/**
 * Filter purchases client-side
 */
export function filterPurchases(
  purchases: PurchaseRecord[],
  filter: PurchaseFilter,
): PurchaseRecord[] {
  return purchases.filter((purchase) => {
    // Type filter
    if (filter.type && filter.type !== "all" && purchase.type !== filter.type) {
      return false;
    }

    // Payment method filter
    if (
      filter.paymentMethod &&
      filter.paymentMethod !== "all" &&
      purchase.paymentMethod !== filter.paymentMethod
    ) {
      return false;
    }

    // Date range
    if (filter.startDate && purchase.purchasedAt < filter.startDate) {
      return false;
    }
    if (filter.endDate && purchase.purchasedAt > filter.endDate) {
      return false;
    }

    // Price range (tokens)
    if (filter.minPrice && (purchase.priceTokens || 0) < filter.minPrice) {
      return false;
    }
    if (filter.maxPrice && (purchase.priceTokens || 0) > filter.maxPrice) {
      return false;
    }

    // Refunds
    if (!filter.includeRefunds && purchase.refundedAt) {
      return false;
    }

    return true;
  });
}

/**
 * Group purchases by date
 */
export function groupPurchasesByDate(
  purchases: PurchaseRecord[],
): Record<string, PurchaseRecord[]> {
  const grouped: Record<string, PurchaseRecord[]> = {};

  purchases.forEach((purchase) => {
    const date = new Date(purchase.purchasedAt).toISOString().split("T")[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(purchase);
  });

  return grouped;
}

/**
 * Group purchases by month
 */
export function groupPurchasesByMonth(
  purchases: PurchaseRecord[],
): Record<string, PurchaseRecord[]> {
  const grouped: Record<string, PurchaseRecord[]> = {};

  purchases.forEach((purchase) => {
    const date = new Date(purchase.purchasedAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!grouped[monthKey]) {
      grouped[monthKey] = [];
    }
    grouped[monthKey].push(purchase);
  });

  return grouped;
}

// =============================================================================
// Format Helpers
// =============================================================================

/**
 * Format purchase date
 */
export function formatPurchaseDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

/**
 * Format purchase price
 */
export function formatPurchasePrice(purchase: PurchaseRecord): string {
  if (purchase.priceUSD) {
    return `$${purchase.priceUSD.toFixed(2)}`;
  }
  if (purchase.priceTokens) {
    return `${purchase.priceTokens.toLocaleString()} tokens`;
  }
  return "Free";
}

/**
 * Get purchase type display name
 */
export function getPurchaseTypeName(type: PurchaseRecord["type"]): string {
  switch (type) {
    case "cosmetic":
      return "Cosmetic";
    case "bundle":
      return "Bundle";
    case "currency":
      return "Currency";
    case "premium":
      return "Premium";
    case "gift_sent":
      return "Gift Sent";
    case "gift_received":
      return "Gift Received";
    default:
      return type;
  }
}

/**
 * Get purchase type icon
 */
export function getPurchaseTypeIcon(type: PurchaseRecord["type"]): string {
  switch (type) {
    case "cosmetic":
      return "shirt-outline";
    case "bundle":
      return "gift-outline";
    case "currency":
      return "logo-bitcoin";
    case "premium":
      return "diamond-outline";
    case "gift_sent":
      return "paper-plane-outline";
    case "gift_received":
      return "gift-outline";
    default:
      return "receipt-outline";
  }
}

/**
 * Get purchase type color
 */
export function getPurchaseTypeColor(type: PurchaseRecord["type"]): string {
  switch (type) {
    case "cosmetic":
      return "#9333EA"; // Purple
    case "bundle":
      return "#F97316"; // Orange
    case "currency":
      return "#EAB308"; // Yellow
    case "premium":
      return "#3B82F6"; // Blue
    case "gift_sent":
      return "#EC4899"; // Pink
    case "gift_received":
      return "#10B981"; // Green
    default:
      return "#6B7280"; // Gray
  }
}

/**
 * Get rarity color
 */
export function getRarityColor(rarity?: string): string {
  switch (rarity?.toLowerCase()) {
    case "legendary":
      return "#F97316";
    case "epic":
      return "#9333EA";
    case "rare":
      return "#3B82F6";
    case "common":
    default:
      return "#6B7280";
  }
}
