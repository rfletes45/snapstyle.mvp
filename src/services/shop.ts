/**
 * Shop Service
 *
 * Handles:
 * - Fetching shop catalog
 * - Featured items and limited-time drops
 * - Purchase operations via Cloud Function
 * - Real-time catalog updates
 *
 * Note: All purchases are handled server-side via Cloud Functions
 * for security and atomic transactions (token deduction + inventory grant).
 */

import {
  getShopItemTimeRemaining,
  isShopItemAvailable,
  Purchase,
  PurchaseStatus,
  ShopItem,
  ShopItemWithStatus,
} from "@/types/models";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { hasItem } from "./cosmetics";
import { getAppInstance, getFirestoreInstance } from "./firebase";

// =============================================================================
// Constants
// =============================================================================

/** Maximum items to fetch from catalog */
const MAX_CATALOG_ITEMS = 50;

/** Maximum featured items to show */
const MAX_FEATURED_ITEMS = 5;

// =============================================================================
// Catalog Operations
// =============================================================================

/**
 * Get all active shop items
 * @returns Array of shop items sorted by sortOrder
 */
export async function getShopCatalog(): Promise<ShopItem[]> {
  const db = getFirestoreInstance();

  try {
    const catalogRef = collection(db, "ShopCatalog");
    const q = query(
      catalogRef,
      where("active", "==", true),
      orderBy("sortOrder", "asc"),
      limit(MAX_CATALOG_ITEMS),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => convertDocToShopItem(doc.id, doc.data()));
  } catch (error) {
    console.error("[shop] Error fetching catalog:", error);
    throw error;
  }
}

/**
 * Get featured items for the shop carousel
 * @returns Array of featured shop items
 */
export async function getFeaturedItems(): Promise<ShopItem[]> {
  const db = getFirestoreInstance();

  try {
    const catalogRef = collection(db, "ShopCatalog");
    const q = query(
      catalogRef,
      where("active", "==", true),
      where("featured", "==", true),
      orderBy("sortOrder", "asc"),
      limit(MAX_FEATURED_ITEMS),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => convertDocToShopItem(doc.id, doc.data()));
  } catch (error) {
    console.error("[shop] Error fetching featured items:", error);
    throw error;
  }
}

/**
 * Get shop items by category
 * @param category - Category to filter by
 * @returns Array of shop items in that category
 */
export async function getShopItemsByCategory(
  category: ShopItem["category"],
): Promise<ShopItem[]> {
  const db = getFirestoreInstance();

  try {
    const catalogRef = collection(db, "ShopCatalog");
    const q = query(
      catalogRef,
      where("active", "==", true),
      where("category", "==", category),
      orderBy("sortOrder", "asc"),
      limit(MAX_CATALOG_ITEMS),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => convertDocToShopItem(doc.id, doc.data()));
  } catch (error) {
    console.error("[shop] Error fetching items by category:", error);
    throw error;
  }
}

/**
 * Get a single shop item by ID
 * @param itemId - The shop item ID
 * @returns Shop item or null if not found
 */
export async function getShopItem(itemId: string): Promise<ShopItem | null> {
  const db = getFirestoreInstance();

  try {
    const itemRef = doc(db, "ShopCatalog", itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) {
      return null;
    }

    return convertDocToShopItem(itemDoc.id, itemDoc.data());
  } catch (error) {
    console.error("[shop] Error fetching shop item:", error);
    throw error;
  }
}

/**
 * Get currently available limited-time items (have availableTo set)
 * @returns Array of limited-time items that are currently available
 */
export async function getLimitedTimeItems(): Promise<ShopItem[]> {
  const db = getFirestoreInstance();
  const now = Date.now();

  try {
    const catalogRef = collection(db, "ShopCatalog");
    // Query for items that have availableTo set and are still active
    // Note: We'll filter for current availability client-side
    const q = query(
      catalogRef,
      where("active", "==", true),
      orderBy("availableTo", "asc"),
      limit(MAX_CATALOG_ITEMS),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((doc) => convertDocToShopItem(doc.id, doc.data()))
      .filter((item) => {
        // Only include items that are currently available
        if (!item.availableTo) return false;
        if (item.availableFrom && now < item.availableFrom) return false;
        if (now > item.availableTo) return false;
        return true;
      });
  } catch (error) {
    console.error("[shop] Error fetching limited-time items:", error);
    throw error;
  }
}

// =============================================================================
// Shop Items with Status (for UI)
// =============================================================================

/**
 * Get shop catalog with availability status for a user
 * Checks ownership and calculates time remaining
 */
export async function getShopCatalogWithStatus(
  uid: string,
): Promise<ShopItemWithStatus[]> {
  const items = await getShopCatalog();
  return enrichItemsWithStatus(items, uid);
}

/**
 * Get featured items with status for a user
 */
export async function getFeaturedItemsWithStatus(
  uid: string,
): Promise<ShopItemWithStatus[]> {
  const items = await getFeaturedItems();
  return enrichItemsWithStatus(items, uid);
}

/**
 * Enrich shop items with availability status and ownership
 */
async function enrichItemsWithStatus(
  items: ShopItem[],
  uid: string,
): Promise<ShopItemWithStatus[]> {
  // Check ownership for all items in parallel
  const ownershipChecks = await Promise.all(
    items.map((item) => hasItem(uid, item.cosmeticId)),
  );

  return items.map((item, index) => ({
    ...item,
    isAvailable: isShopItemAvailable(item),
    timeRemaining: getShopItemTimeRemaining(item),
    alreadyOwned: ownershipChecks[index],
  }));
}

// =============================================================================
// Real-time Updates
// =============================================================================

/**
 * Subscribe to shop catalog updates in real-time
 * @returns Unsubscribe function
 */
export function subscribeToShopCatalog(
  onUpdate: (items: ShopItem[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirestoreInstance();

  const catalogRef = collection(db, "ShopCatalog");
  const q = query(
    catalogRef,
    where("active", "==", true),
    orderBy("sortOrder", "asc"),
    limit(MAX_CATALOG_ITEMS),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((doc) =>
        convertDocToShopItem(doc.id, doc.data()),
      );
      onUpdate(items);
    },
    (error) => {
      console.error("[shop] Error in catalog subscription:", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Purchase Operations
// =============================================================================

/**
 * Purchase result from Cloud Function
 */
export interface PurchaseResult {
  success: boolean;
  purchaseId?: string;
  transactionId?: string;
  newBalance?: number;
  error?: string;
}

/**
 * Purchase an item with tokens via Cloud Function
 * This is an atomic operation that:
 * 1. Validates the item is available
 * 2. Validates the user has enough tokens
 * 3. Validates the user doesn't already own the item
 * 4. Deducts tokens from wallet
 * 5. Adds item to user's inventory
 * 6. Records the purchase
 * 7. Creates transaction record
 *
 * @param itemId - The shop item ID to purchase
 * @returns Purchase result with new balance
 */
export async function purchaseWithTokens(
  itemId: string,
): Promise<PurchaseResult> {
  const app = getAppInstance();
  const functions = getFunctions(app);

  try {
    const callable = httpsCallable<{ itemId: string }, PurchaseResult>(
      functions,
      "purchaseWithTokens",
    );

    const result = await callable({ itemId });
    return result.data;
  } catch (error: any) {
    console.error("[shop] Purchase failed:", error);

    // Extract error message from Firebase callable error
    const message =
      error?.message ||
      error?.details?.message ||
      "Purchase failed. Please try again.";

    return {
      success: false,
      error: message,
    };
  }
}

// =============================================================================
// Purchase History
// =============================================================================

/**
 * Get user's purchase history
 * @param uid - User ID
 * @param maxResults - Maximum number of purchases to return
 * @returns Array of purchases, newest first
 */
export async function getPurchaseHistory(
  uid: string,
  maxResults: number = 20,
): Promise<Purchase[]> {
  const db = getFirestoreInstance();

  try {
    const purchasesRef = collection(db, "Purchases");
    const q = query(
      purchasesRef,
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(maxResults),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        itemId: data.itemId,
        cosmeticId: data.cosmeticId,
        priceTokens: data.priceTokens,
        status: data.status as PurchaseStatus,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
        transactionId: data.transactionId,
      };
    });
  } catch (error) {
    console.error("[shop] Error fetching purchase history:", error);
    throw error;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert Firestore document to ShopItem
 */
function convertDocToShopItem(id: string, data: any): ShopItem {
  return {
    id,
    cosmeticId: data.cosmeticId || "",
    name: data.name || "",
    description: data.description,
    category: data.category || "featured",
    slot: data.slot || "hat",
    priceTokens: data.priceTokens || 0,
    rarity: data.rarity || "common",
    imagePath: data.imagePath || "",
    featured: data.featured || false,
    availableFrom: data.availableFrom?.toMillis?.() || data.availableFrom,
    availableTo: data.availableTo?.toMillis?.() || data.availableTo,
    limitedQuantity: data.limitedQuantity,
    purchaseCount: data.purchaseCount || 0,
    active: data.active !== false,
    sortOrder: data.sortOrder || 0,
    createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
  };
}

/**
 * Format time remaining for display
 * @param ms - Milliseconds remaining
 * @returns Formatted string like "2h 30m" or "1d 5h"
 */
export function formatTimeRemaining(ms: number | null): string {
  if (ms === null || ms <= 0) return "Expired";

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Get rarity color for shop item
 */
export function getRarityColor(rarity: ShopItem["rarity"]): string {
  switch (rarity) {
    case "legendary":
      return "#FFD700"; // Gold
    case "epic":
      return "#9B59B6"; // Purple
    case "rare":
      return "#3498DB"; // Blue
    case "common":
    default:
      return "#95A5A6"; // Gray
  }
}

/**
 * Get rarity label for shop item
 */
export function getRarityLabel(rarity: ShopItem["rarity"]): string {
  switch (rarity) {
    case "legendary":
      return "Legendary";
    case "epic":
      return "Epic";
    case "rare":
      return "Rare";
    case "common":
    default:
      return "Common";
  }
}
