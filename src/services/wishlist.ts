/**
 * Wishlist Service
 *
 * Allows users to save items they want to purchase later.
 * Sends notifications when wishlist items go on sale.
 *
 * Firestore Collection: Users/{uid}/wishlist/{itemId}
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.1
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import type {
  PointsShopItem,
  PremiumExclusiveItem,
  ShopType,
  WishlistItem,
} from "@/types/shop";
import { getFirestoreInstance } from "./firebase";

// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "wishlist";
const MAX_WISHLIST_SIZE = 50;

// =============================================================================
// Types
// =============================================================================

/**
 * Wishlist operation result
 */
export interface WishlistResult {
  success: boolean;
  error?: string;
}

/**
 * Wishlist with metadata
 */
export interface WishlistData {
  items: WishlistItem[];
  count: number;
  hasMore: boolean;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Add an item to the user's wishlist
 */
export async function addToWishlist(
  uid: string,
  itemId: string,
  shopType: ShopType,
  price: number,
): Promise<WishlistResult> {
  if (!uid || !itemId) {
    return { success: false, error: "Invalid parameters" };
  }

  const db = getFirestoreInstance();

  try {
    // Check wishlist size limit
    const wishlistRef = collection(db, "Users", uid, COLLECTION_NAME);
    const snapshot = await getDocs(wishlistRef);

    if (snapshot.size >= MAX_WISHLIST_SIZE) {
      return {
        success: false,
        error: `Wishlist is full (max ${MAX_WISHLIST_SIZE} items)`,
      };
    }

    // Check if already in wishlist
    const itemRef = doc(db, "Users", uid, COLLECTION_NAME, itemId);
    const existing = await getDoc(itemRef);

    if (existing.exists()) {
      return { success: false, error: "Item already in wishlist" };
    }

    // Add to wishlist
    const wishlistItem: Omit<
      WishlistItem,
      "item" | "currentPrice" | "priceChanged" | "onSale"
    > = {
      itemId,
      shopType,
      priceWhenAdded: price,
      notifyOnSale: true,
      addedAt: Date.now(),
    };

    await setDoc(itemRef, {
      ...wishlistItem,
      createdAt: serverTimestamp(),
    });

    console.log("[wishlist] Added item to wishlist:", itemId);
    return { success: true };
  } catch (error) {
    console.error("[wishlist] Error adding to wishlist:", error);
    return { success: false, error: "Failed to add to wishlist" };
  }
}

/**
 * Remove an item from the user's wishlist
 */
export async function removeFromWishlist(
  uid: string,
  itemId: string,
): Promise<WishlistResult> {
  if (!uid || !itemId) {
    return { success: false, error: "Invalid parameters" };
  }

  const db = getFirestoreInstance();

  try {
    const itemRef = doc(db, "Users", uid, COLLECTION_NAME, itemId);
    await deleteDoc(itemRef);

    console.log("[wishlist] Removed item from wishlist:", itemId);
    return { success: true };
  } catch (error) {
    console.error("[wishlist] Error removing from wishlist:", error);
    return { success: false, error: "Failed to remove from wishlist" };
  }
}

/**
 * Toggle wishlist status for an item
 */
export async function toggleWishlist(
  uid: string,
  itemId: string,
  shopType: ShopType,
  price: number,
): Promise<WishlistResult & { isWishlisted: boolean }> {
  if (!uid || !itemId) {
    return { success: false, error: "Invalid parameters", isWishlisted: false };
  }

  const db = getFirestoreInstance();

  try {
    const itemRef = doc(db, "Users", uid, COLLECTION_NAME, itemId);
    const existing = await getDoc(itemRef);

    if (existing.exists()) {
      // Remove from wishlist
      await deleteDoc(itemRef);
      console.log("[wishlist] Toggled off:", itemId);
      return { success: true, isWishlisted: false };
    } else {
      // Add to wishlist
      const result = await addToWishlist(uid, itemId, shopType, price);
      return { ...result, isWishlisted: result.success };
    }
  } catch (error) {
    console.error("[wishlist] Error toggling wishlist:", error);
    return {
      success: false,
      error: "Failed to update wishlist",
      isWishlisted: false,
    };
  }
}

/**
 * Check if an item is in the user's wishlist
 */
export async function isInWishlist(
  uid: string,
  itemId: string,
): Promise<boolean> {
  if (!uid || !itemId) {
    return false;
  }

  const db = getFirestoreInstance();

  try {
    const itemRef = doc(db, "Users", uid, COLLECTION_NAME, itemId);
    const snapshot = await getDoc(itemRef);
    return snapshot.exists();
  } catch (error) {
    console.error("[wishlist] Error checking wishlist:", error);
    return false;
  }
}

/**
 * Get the user's complete wishlist
 */
export async function getWishlist(uid: string): Promise<WishlistItem[]> {
  if (!uid) {
    return [];
  }

  const db = getFirestoreInstance();

  try {
    const wishlistRef = collection(db, "Users", uid, COLLECTION_NAME);
    const q = query(wishlistRef, orderBy("addedAt", "desc"));
    const snapshot = await getDocs(q);

    const items: WishlistItem[] = [];
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      items.push({
        itemId: data.itemId,
        shopType: data.shopType,
        priceWhenAdded: data.priceWhenAdded,
        notifyOnSale: data.notifyOnSale ?? true,
        addedAt: data.addedAt,
      });
    });

    console.log("[wishlist] Fetched", items.length, "wishlist items");
    return items;
  } catch (error) {
    console.error("[wishlist] Error fetching wishlist:", error);
    return [];
  }
}

/**
 * Update notification preference for a wishlist item
 */
export async function updateWishlistNotification(
  uid: string,
  itemId: string,
  notifyOnSale: boolean,
): Promise<WishlistResult> {
  if (!uid || !itemId) {
    return { success: false, error: "Invalid parameters" };
  }

  const db = getFirestoreInstance();

  try {
    const itemRef = doc(db, "Users", uid, COLLECTION_NAME, itemId);
    await updateDoc(itemRef, { notifyOnSale });

    console.log("[wishlist] Updated notification for:", itemId, notifyOnSale);
    return { success: true };
  } catch (error) {
    console.error("[wishlist] Error updating notification:", error);
    return { success: false, error: "Failed to update notification" };
  }
}

/**
 * Get wishlist item IDs as a Set (for quick lookup)
 */
export async function getWishlistIds(uid: string): Promise<Set<string>> {
  if (!uid) {
    return new Set();
  }

  const db = getFirestoreInstance();

  try {
    const wishlistRef = collection(db, "Users", uid, COLLECTION_NAME);
    const snapshot = await getDocs(wishlistRef);

    const ids = new Set<string>();
    snapshot.forEach((docSnapshot) => {
      ids.add(docSnapshot.id);
    });

    return ids;
  } catch (error) {
    console.error("[wishlist] Error fetching wishlist IDs:", error);
    return new Set();
  }
}

/**
 * Get wishlist count
 */
export async function getWishlistCount(uid: string): Promise<number> {
  if (!uid) {
    return 0;
  }

  const db = getFirestoreInstance();

  try {
    const wishlistRef = collection(db, "Users", uid, COLLECTION_NAME);
    const snapshot = await getDocs(wishlistRef);
    return snapshot.size;
  } catch (error) {
    console.error("[wishlist] Error getting wishlist count:", error);
    return 0;
  }
}

/**
 * Clear entire wishlist
 */
export async function clearWishlist(uid: string): Promise<WishlistResult> {
  if (!uid) {
    return { success: false, error: "Invalid parameters" };
  }

  const db = getFirestoreInstance();

  try {
    const wishlistRef = collection(db, "Users", uid, COLLECTION_NAME);
    const snapshot = await getDocs(wishlistRef);

    const deletePromises = snapshot.docs.map((docSnapshot) =>
      deleteDoc(docSnapshot.ref),
    );

    await Promise.all(deletePromises);

    console.log("[wishlist] Cleared wishlist");
    return { success: true };
  } catch (error) {
    console.error("[wishlist] Error clearing wishlist:", error);
    return { success: false, error: "Failed to clear wishlist" };
  }
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to wishlist updates
 */
export function subscribeToWishlist(
  uid: string,
  onUpdate: (items: WishlistItem[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!uid) {
    console.warn("[wishlist] Cannot subscribe without uid");
    return () => {};
  }

  const db = getFirestoreInstance();
  const wishlistRef = collection(db, "Users", uid, COLLECTION_NAME);
  const q = query(wishlistRef, orderBy("addedAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: WishlistItem[] = [];
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        items.push({
          itemId: data.itemId,
          shopType: data.shopType,
          priceWhenAdded: data.priceWhenAdded,
          notifyOnSale: data.notifyOnSale ?? true,
          addedAt: data.addedAt,
        });
      });

      onUpdate(items);
    },
    (error) => {
      console.error("[wishlist] Subscription error:", error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to wishlist IDs only (lighter weight)
 */
export function subscribeToWishlistIds(
  uid: string,
  onUpdate: (ids: Set<string>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!uid) {
    console.warn("[wishlist] Cannot subscribe without uid");
    return () => {};
  }

  const db = getFirestoreInstance();
  const wishlistRef = collection(db, "Users", uid, COLLECTION_NAME);

  return onSnapshot(
    wishlistRef,
    (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((docSnapshot) => {
        ids.add(docSnapshot.id);
      });
      onUpdate(ids);
    },
    (error) => {
      console.error("[wishlist] IDs subscription error:", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Enrich wishlist items with full item data
 * Called by hooks to merge with shop catalog
 */
export function enrichWishlistItems(
  wishlistItems: WishlistItem[],
  pointsItems: PointsShopItem[],
  premiumItems: PremiumExclusiveItem[],
): WishlistItem[] {
  const pointsMap = new Map(pointsItems.map((item) => [item.id, item]));
  const premiumMap = new Map(premiumItems.map((item) => [item.id, item]));

  return wishlistItems.map((wishlistItem) => {
    if (wishlistItem.shopType === "points") {
      const item = pointsMap.get(wishlistItem.itemId);
      if (item) {
        return {
          ...wishlistItem,
          item,
          currentPrice: item.priceTokens,
          priceChanged: item.priceTokens !== wishlistItem.priceWhenAdded,
          onSale: !!item.discountPercent && item.discountPercent > 0,
        };
      }
    } else {
      const item = premiumMap.get(wishlistItem.itemId);
      if (item) {
        return {
          ...wishlistItem,
          item,
          currentPrice: item.basePriceUSD,
          priceChanged: item.basePriceUSD !== wishlistItem.priceWhenAdded,
          onSale: false, // Premium items don't have token discounts
        };
      }
    }
    return wishlistItem;
  });
}
