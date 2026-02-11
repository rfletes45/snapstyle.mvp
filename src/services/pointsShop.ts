/**
 * Points Shop Service
 *
 * Handles all token-based shop operations:
 * - Fetching shop catalog
 * - Purchase validation
 * - Real-time updates
 *
 * NOTE: All purchase operations are validated server-side via Cloud Functions.
 * This service only handles reading catalog data and initiating purchases.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 6
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import type { ExtendedCosmeticSlot } from "@/types/profile";
import {
  ShopErrorCode,
  type PointsPurchaseResult,
  type PointsShopCatalogFlat,
  type PointsShopItem,
} from "@/types/shop";
import { getFirestoreInstance, getFunctionsInstance } from "./firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/pointsShop");
// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "PointsShopCatalog";
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache for catalog
let catalogCache: {
  data: PointsShopCatalogFlat | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an item is currently available based on timestamps
 */
function isItemAvailable(item: PointsShopItem): boolean {
  const now = Date.now();

  // Check if item is active
  if (item.active === false) {
    return false;
  }

  // Check availability window
  if (item.availableFrom && item.availableFrom > now) {
    return false;
  }
  if (item.availableTo && item.availableTo < now) {
    return false;
  }

  // Check stock
  if (item.stock !== undefined && item.stock !== null && item.stock <= 0) {
    return false;
  }

  return true;
}

/**
 * Map Firestore document to PointsShopItem
 */
function mapDocToItem(
  docId: string,
  data: Record<string, any>,
): PointsShopItem {
  return {
    id: docId,
    itemId: data.itemId || docId,
    name: data.name || "Unknown Item",
    description: data.description || "",
    slot: data.slot as ExtendedCosmeticSlot,
    rarity: data.rarity || "common",
    imagePath: data.imagePath || "",
    priceTokens: data.priceTokens || 0,
    originalPrice: data.originalPrice,
    discountPercent: data.discountPercent,
    availableFrom: data.availableFrom?.toMillis?.() || data.availableFrom,
    availableTo: data.availableTo?.toMillis?.() || data.availableTo,
    stock: data.stock,
    purchaseLimit: data.purchaseLimit,
    featured: data.featured || false,
    newUntil: data.newUntil?.toMillis?.() || data.newUntil,
    sortOrder: data.sortOrder || 0,
    tags: data.tags || [],
    shopExclusive: true,
    active: data.active !== false,
  };
}

/**
 * Get category key from slot type
 */
function getCategoryFromSlot(slot: ExtendedCosmeticSlot): string {
  switch (slot) {
    case "hat":
      return "hats";
    case "glasses":
      return "glasses";
    case "background":
      return "backgrounds";
    case "clothing_top":
      return "clothingTops";
    case "clothing_bottom":
      return "clothingBottoms";
    case "accessory_neck":
      return "neckAccessories";
    case "accessory_ear":
      return "earAccessories";
    case "accessory_hand":
      return "handAccessories";
    case "profile_frame":
      return "frames";
    case "profile_banner":
      return "banners";
    case "profile_theme":
      return "themes";
    case "chat_bubble":
      return "bubbles";
    case "name_effect":
      return "nameEffects";
    default:
      return "other";
  }
}

// =============================================================================
// Catalog Fetching
// =============================================================================

/**
 * Get the full points shop catalog
 *
 * @param uid - User ID for ownership checking
 * @param forceRefresh - Skip cache and fetch fresh data
 * @returns Flat catalog with items organized by category
 */
export async function getPointsShopCatalog(
  uid: string,
  forceRefresh = false,
): Promise<PointsShopCatalogFlat> {
  const db = getFirestoreInstance();

  // Check cache
  const now = Date.now();
  if (
    !forceRefresh &&
    catalogCache.data &&
    now - catalogCache.timestamp < CACHE_DURATION_MS
  ) {
    logger.info("[pointsShop] Returning cached catalog");
    return catalogCache.data;
  }

  try {
    logger.info("[pointsShop] Fetching catalog from Firestore");

    // Fetch all active items
    const catalogRef = collection(db, COLLECTION_NAME);
    const q = query(
      catalogRef,
      where("active", "!=", false),
      orderBy("active"),
      orderBy("sortOrder", "asc"),
    );

    const snapshot = await getDocs(q);

    // Initialize categories
    const categories: Record<string, PointsShopItem[]> = {
      hats: [],
      glasses: [],
      backgrounds: [],
      clothingTops: [],
      clothingBottoms: [],
      neckAccessories: [],
      earAccessories: [],
      handAccessories: [],
      frames: [],
      banners: [],
      themes: [],
      bubbles: [],
      nameEffects: [],
    };
    const featured: PointsShopItem[] = [];

    // Get user's owned items for ownership checking
    const ownedItems = await getUserOwnedItems(uid);

    // Process each item
    snapshot.forEach((doc) => {
      const item = mapDocToItem(doc.id, doc.data());

      // Skip unavailable items
      if (!isItemAvailable(item)) {
        return;
      }

      // Add ownership flag
      item.owned = ownedItems.has(item.itemId);

      // Add to featured if applicable
      if (item.featured) {
        featured.push(item);
      }

      // Add to appropriate category
      const category = getCategoryFromSlot(item.slot);
      if (categories[category]) {
        categories[category].push(item);
      }
    });

    // Sort featured by sort order
    featured.sort((a, b) => a.sortOrder - b.sortOrder);

    const catalog: PointsShopCatalogFlat = {
      featured,
      categories,
      lastUpdated: now,
    };

    // Update cache
    catalogCache = {
      data: catalog,
      timestamp: now,
    };

    logger.info(
      `[pointsShop] Catalog loaded: ${snapshot.size} items, ${featured.length} featured`,
    );
    return catalog;
  } catch (error) {
    logger.error("[pointsShop] Error fetching catalog:", error);
    throw error;
  }
}

/**
 * Get items for a specific category
 */
export async function getPointsShopCategory(
  uid: string,
  category: string,
): Promise<PointsShopItem[]> {
  const catalog = await getPointsShopCatalog(uid);
  return catalog.categories[category] || [];
}

/**
 * Get featured items only
 */
export async function getFeaturedPointsItems(
  uid: string,
): Promise<PointsShopItem[]> {
  const catalog = await getPointsShopCatalog(uid);
  return catalog.featured;
}

/**
 * Get a single item by ID
 */
export async function getPointsShopItem(
  itemId: string,
): Promise<PointsShopItem | null> {
  const db = getFirestoreInstance();

  try {
    const itemRef = doc(db, COLLECTION_NAME, itemId);
    const itemDoc = await getDoc(itemRef);

    if (!itemDoc.exists()) {
      return null;
    }

    return mapDocToItem(itemDoc.id, itemDoc.data());
  } catch (error) {
    logger.error("[pointsShop] Error fetching item:", error);
    return null;
  }
}

/**
 * Search items by name or tag
 */
export async function searchPointsShop(
  uid: string,
  searchQuery: string,
): Promise<PointsShopItem[]> {
  const catalog = await getPointsShopCatalog(uid);
  const query = searchQuery.toLowerCase().trim();

  if (!query) {
    return [];
  }

  const results: PointsShopItem[] = [];

  // Search through all categories
  Object.values(catalog.categories).forEach((items) => {
    items.forEach((item) => {
      // Match name
      if (item.name.toLowerCase().includes(query)) {
        results.push(item);
        return;
      }

      // Match tags
      if (item.tags.some((tag) => tag.toLowerCase().includes(query))) {
        results.push(item);
        return;
      }

      // Match description
      if (item.description.toLowerCase().includes(query)) {
        results.push(item);
      }
    });
  });

  // Sort by relevance (name matches first)
  results.sort((a, b) => {
    const aNameMatch = a.name.toLowerCase().includes(query);
    const bNameMatch = b.name.toLowerCase().includes(query);
    if (aNameMatch && !bNameMatch) return -1;
    if (!aNameMatch && bNameMatch) return 1;
    return a.sortOrder - b.sortOrder;
  });

  return results;
}

// =============================================================================
// User Data
// =============================================================================

/**
 * Get set of item IDs the user owns
 */
async function getUserOwnedItems(uid: string): Promise<Set<string>> {
  const db = getFirestoreInstance();
  const ownedItems = new Set<string>();

  try {
    const inventoryRef = collection(db, "Users", uid, "inventory");
    const snapshot = await getDocs(inventoryRef);

    snapshot.forEach((doc) => {
      ownedItems.add(doc.id);
    });

    return ownedItems;
  } catch (error) {
    logger.error("[pointsShop] Error fetching inventory:", error);
    return ownedItems;
  }
}

/**
 * Get user's purchase count for an item
 */
async function getUserPurchaseCount(
  uid: string,
  itemId: string,
): Promise<number> {
  const db = getFirestoreInstance();

  try {
    const purchasesRef = collection(db, "Users", uid, "purchases");
    const q = query(purchasesRef, where("itemId", "==", itemId));
    const snapshot = await getDocs(q);

    return snapshot.size;
  } catch (error) {
    logger.error("[pointsShop] Error fetching purchase count:", error);
    return 0;
  }
}

// =============================================================================
// Purchase Operations
// =============================================================================

/**
 * Check if user can purchase an item
 */
export async function canPurchaseItem(
  uid: string,
  itemId: string,
  balance: number,
): Promise<{
  canPurchase: boolean;
  reason?: string;
  errorCode?: ShopErrorCode;
}> {
  const item = await getPointsShopItem(itemId);

  if (!item) {
    return {
      canPurchase: false,
      reason: "Item not found",
      errorCode: ShopErrorCode.ITEM_NOT_FOUND,
    };
  }

  // Check if available
  if (!isItemAvailable(item)) {
    return {
      canPurchase: false,
      reason: "Item is not available",
      errorCode: ShopErrorCode.ITEM_NOT_AVAILABLE,
    };
  }

  // Check ownership
  const ownedItems = await getUserOwnedItems(uid);
  if (ownedItems.has(item.itemId)) {
    return {
      canPurchase: false,
      reason: "You already own this item",
      errorCode: ShopErrorCode.ALREADY_OWNED,
    };
  }

  // Check balance
  if (balance < item.priceTokens) {
    return {
      canPurchase: false,
      reason: `Insufficient tokens (need ${item.priceTokens}, have ${balance})`,
      errorCode: ShopErrorCode.INSUFFICIENT_FUNDS,
    };
  }

  // Check purchase limit
  if (item.purchaseLimit) {
    const purchaseCount = await getUserPurchaseCount(uid, itemId);
    if (purchaseCount >= item.purchaseLimit) {
      return {
        canPurchase: false,
        reason: "Purchase limit reached",
        errorCode: ShopErrorCode.PURCHASE_LIMIT_REACHED,
      };
    }
  }

  // Check stock
  if (item.stock !== undefined && item.stock !== null && item.stock <= 0) {
    return {
      canPurchase: false,
      reason: "Out of stock",
      errorCode: ShopErrorCode.OUT_OF_STOCK,
    };
  }

  return { canPurchase: true };
}

/**
 * Purchase an item with tokens
 *
 * This calls a Cloud Function to securely process the purchase.
 * The function validates the purchase and atomically:
 * 1. Deducts tokens from wallet
 * 2. Adds item to inventory
 * 3. Records the transaction
 */
export async function purchaseWithTokens(
  itemId: string,
): Promise<PointsPurchaseResult> {
  try {
    logger.info("[pointsShop] Initiating purchase for item:", itemId);

    const functions = getFunctionsInstance();
    const purchaseFunction = httpsCallable<
      { itemId: string },
      PointsPurchaseResult
    >(functions, "purchaseWithTokens");

    const result = await purchaseFunction({ itemId });

    if (result.data.success) {
      // Invalidate cache to reflect ownership change
      catalogCache.timestamp = 0;
      logger.info(
        "[pointsShop] Purchase successful:",
        result.data.transactionId,
      );
    } else {
      logger.warn("[pointsShop] Purchase failed:", result.data.error);
    }

    return result.data;
  } catch (error: any) {
    logger.error("[pointsShop] Purchase error:", error);

    // Handle Firebase function errors
    if (error.code === "functions/unauthenticated") {
      return {
        success: false,
        error: "Please log in to make purchases",
        errorCode: ShopErrorCode.NOT_AUTHENTICATED,
      };
    }

    return {
      success: false,
      error: error.message || "Purchase failed",
      errorCode: ShopErrorCode.SERVER_ERROR,
    };
  }
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to catalog updates for a category
 *
 * @param uid - User ID for ownership checking
 * @param category - Category to subscribe to (or "featured")
 * @param onUpdate - Callback when items change
 * @param onError - Error callback
 * @returns Unsubscribe function
 */
export function subscribeToPointsCatalog(
  uid: string,
  category: string,
  onUpdate: (items: PointsShopItem[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirestoreInstance();
  const catalogRef = collection(db, COLLECTION_NAME);

  // Build query based on category
  let q;
  if (category === "featured") {
    q = query(
      catalogRef,
      where("featured", "==", true),
      where("active", "!=", false),
      orderBy("active"),
      orderBy("sortOrder", "asc"),
    );
  } else {
    // Map category back to slot(s)
    const slots = getCategorySlots(category);
    if (slots.length === 0) {
      logger.warn("[pointsShop] Unknown category:", category);
      onUpdate([]);
      return () => {};
    }

    q = query(
      catalogRef,
      where("slot", "in", slots),
      where("active", "!=", false),
      orderBy("active"),
      orderBy("sortOrder", "asc"),
    );
  }

  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      try {
        const ownedItems = await getUserOwnedItems(uid);
        const items: PointsShopItem[] = [];

        snapshot.forEach((doc) => {
          const item = mapDocToItem(doc.id, doc.data());
          if (isItemAvailable(item)) {
            item.owned = ownedItems.has(item.itemId);
            items.push(item);
          }
        });

        onUpdate(items);
      } catch (error) {
        logger.error("[pointsShop] Error processing snapshot:", error);
        onError?.(error as Error);
      }
    },
    (error) => {
      logger.error("[pointsShop] Subscription error:", error);
      onError?.(error);
    },
  );

  return unsubscribe;
}

/**
 * Subscribe to featured items
 */
export function subscribeToFeaturedItems(
  uid: string,
  onUpdate: (items: PointsShopItem[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return subscribeToPointsCatalog(uid, "featured", onUpdate, onError);
}

/**
 * Get slot types for a category
 */
function getCategorySlots(category: string): ExtendedCosmeticSlot[] {
  switch (category) {
    case "hats":
      return ["hat"];
    case "glasses":
      return ["glasses"];
    case "backgrounds":
      return ["background"];
    case "clothingTops":
      return ["clothing_top"];
    case "clothingBottoms":
      return ["clothing_bottom"];
    case "neckAccessories":
      return ["accessory_neck"];
    case "earAccessories":
      return ["accessory_ear"];
    case "handAccessories":
      return ["accessory_hand"];
    case "frames":
      return ["profile_frame"];
    case "banners":
      return ["profile_banner"];
    case "themes":
      return ["profile_theme"];
    case "bubbles":
      return ["chat_bubble"];
    case "nameEffects":
      return ["name_effect"];
    case "accessories":
      return ["accessory_neck", "accessory_ear", "accessory_hand"];
    default:
      return [];
  }
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear the catalog cache
 */
export function clearPointsShopCache(): void {
  catalogCache = {
    data: null,
    timestamp: 0,
  };
  logger.info("[pointsShop] Cache cleared");
}

/**
 * Invalidate cache (forces refresh on next fetch)
 */
export function invalidatePointsShopCache(): void {
  catalogCache.timestamp = 0;
  logger.info("[pointsShop] Cache invalidated");
}
