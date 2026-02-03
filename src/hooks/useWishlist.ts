/**
 * useWishlist Hook
 *
 * Provides wishlist functionality for shop screens.
 *
 * Features:
 * - Real-time wishlist subscription
 * - Toggle wishlist status
 * - Check if item is wishlisted
 * - Price change tracking
 * - Sale notifications
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.1
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addToWishlist,
  clearWishlist,
  enrichWishlistItems,
  getWishlist,
  removeFromWishlist,
  subscribeToWishlistIds,
  toggleWishlist,
  updateWishlistNotification,
} from "@/services/wishlist";
import type {
  PointsShopItem,
  PremiumExclusiveItem,
  ShopType,
  WishlistItem,
} from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

export interface UseWishlistReturn {
  // Data
  wishlistItems: WishlistItem[];
  wishlistIds: Set<string>;
  wishlistCount: number;

  // Loading states
  loading: boolean;
  actionLoading: boolean;

  // Error state
  error: string | null;

  // Actions
  addItem: (
    itemId: string,
    shopType: ShopType,
    price: number,
  ) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  toggleItem: (
    itemId: string,
    shopType: ShopType,
    price: number,
  ) => Promise<boolean>;
  isWishlisted: (itemId: string) => boolean;
  updateNotification: (itemId: string, notify: boolean) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  refresh: () => Promise<void>;

  // Enriched data (with full item info)
  getEnrichedItems: (
    pointsItems: PointsShopItem[],
    premiumItems: PremiumExclusiveItem[],
  ) => WishlistItem[];
}

// =============================================================================
// Hook
// =============================================================================

export function useWishlist(uid: string | undefined): UseWishlistReturn {
  // State
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to wishlist IDs for quick lookup
  useEffect(() => {
    if (!uid) {
      setWishlistIds(new Set());
      setWishlistItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Initial load
    const loadWishlist = async () => {
      try {
        const items = await getWishlist(uid);
        setWishlistItems(items);
        setWishlistIds(new Set(items.map((item) => item.itemId)));
        setError(null);
      } catch (err) {
        console.error("[useWishlist] Error loading wishlist:", err);
        setError("Failed to load wishlist");
      } finally {
        setLoading(false);
      }
    };

    loadWishlist();

    // Subscribe to real-time updates (IDs only for performance)
    const unsubscribe = subscribeToWishlistIds(
      uid,
      (ids) => {
        setWishlistIds(ids);
      },
      (err) => {
        console.error("[useWishlist] Subscription error:", err);
        setError("Connection error");
      },
    );

    return () => {
      unsubscribe();
    };
  }, [uid]);

  // Wishlist count
  const wishlistCount = useMemo(() => wishlistIds.size, [wishlistIds]);

  // Check if item is wishlisted
  const isWishlisted = useCallback(
    (itemId: string): boolean => {
      return wishlistIds.has(itemId);
    },
    [wishlistIds],
  );

  // Add item to wishlist
  const addItem = useCallback(
    async (
      itemId: string,
      shopType: ShopType,
      price: number,
    ): Promise<boolean> => {
      if (!uid) {
        setError("Please log in to use wishlist");
        return false;
      }

      setActionLoading(true);
      setError(null);

      try {
        const result = await addToWishlist(uid, itemId, shopType, price);

        if (result.success) {
          // Optimistically update local state
          setWishlistIds((prev) => new Set([...prev, itemId]));
          setWishlistItems((prev) => [
            {
              itemId,
              shopType,
              priceWhenAdded: price,
              notifyOnSale: true,
              addedAt: Date.now(),
            },
            ...prev,
          ]);
          return true;
        } else {
          setError(result.error || "Failed to add to wishlist");
          return false;
        }
      } catch (err) {
        console.error("[useWishlist] Error adding item:", err);
        setError("Failed to add to wishlist");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [uid],
  );

  // Remove item from wishlist
  const removeItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      if (!uid) {
        setError("Please log in to use wishlist");
        return false;
      }

      setActionLoading(true);
      setError(null);

      try {
        const result = await removeFromWishlist(uid, itemId);

        if (result.success) {
          // Optimistically update local state
          setWishlistIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          setWishlistItems((prev) =>
            prev.filter((item) => item.itemId !== itemId),
          );
          return true;
        } else {
          setError(result.error || "Failed to remove from wishlist");
          return false;
        }
      } catch (err) {
        console.error("[useWishlist] Error removing item:", err);
        setError("Failed to remove from wishlist");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [uid],
  );

  // Toggle wishlist status
  const toggleItem = useCallback(
    async (
      itemId: string,
      shopType: ShopType,
      price: number,
    ): Promise<boolean> => {
      if (!uid) {
        setError("Please log in to use wishlist");
        return false;
      }

      setActionLoading(true);
      setError(null);

      try {
        const result = await toggleWishlist(uid, itemId, shopType, price);

        if (result.success) {
          if (result.isWishlisted) {
            // Added to wishlist
            setWishlistIds((prev) => new Set([...prev, itemId]));
            setWishlistItems((prev) => [
              {
                itemId,
                shopType,
                priceWhenAdded: price,
                notifyOnSale: true,
                addedAt: Date.now(),
              },
              ...prev,
            ]);
          } else {
            // Removed from wishlist
            setWishlistIds((prev) => {
              const next = new Set(prev);
              next.delete(itemId);
              return next;
            });
            setWishlistItems((prev) =>
              prev.filter((item) => item.itemId !== itemId),
            );
          }
          return true;
        } else {
          setError(result.error || "Failed to update wishlist");
          return false;
        }
      } catch (err) {
        console.error("[useWishlist] Error toggling item:", err);
        setError("Failed to update wishlist");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [uid],
  );

  // Update notification preference
  const updateNotification = useCallback(
    async (itemId: string, notify: boolean): Promise<boolean> => {
      if (!uid) {
        setError("Please log in");
        return false;
      }

      setActionLoading(true);
      setError(null);

      try {
        const result = await updateWishlistNotification(uid, itemId, notify);

        if (result.success) {
          setWishlistItems((prev) =>
            prev.map((item) =>
              item.itemId === itemId ? { ...item, notifyOnSale: notify } : item,
            ),
          );
          return true;
        } else {
          setError(result.error || "Failed to update notification");
          return false;
        }
      } catch (err) {
        console.error("[useWishlist] Error updating notification:", err);
        setError("Failed to update notification");
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [uid],
  );

  // Clear entire wishlist
  const clearAll = useCallback(async (): Promise<boolean> => {
    if (!uid) {
      setError("Please log in");
      return false;
    }

    setActionLoading(true);
    setError(null);

    try {
      const result = await clearWishlist(uid);

      if (result.success) {
        setWishlistIds(new Set());
        setWishlistItems([]);
        return true;
      } else {
        setError(result.error || "Failed to clear wishlist");
        return false;
      }
    } catch (err) {
      console.error("[useWishlist] Error clearing wishlist:", err);
      setError("Failed to clear wishlist");
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [uid]);

  // Refresh wishlist
  const refresh = useCallback(async (): Promise<void> => {
    if (!uid) return;

    setLoading(true);
    setError(null);

    try {
      const items = await getWishlist(uid);
      setWishlistItems(items);
      setWishlistIds(new Set(items.map((item) => item.itemId)));
    } catch (err) {
      console.error("[useWishlist] Error refreshing:", err);
      setError("Failed to refresh wishlist");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // Get enriched items with full item data
  const getEnrichedItems = useCallback(
    (
      pointsItems: PointsShopItem[],
      premiumItems: PremiumExclusiveItem[],
    ): WishlistItem[] => {
      return enrichWishlistItems(wishlistItems, pointsItems, premiumItems);
    },
    [wishlistItems],
  );

  return {
    wishlistItems,
    wishlistIds,
    wishlistCount,
    loading,
    actionLoading,
    error,
    addItem,
    removeItem,
    toggleItem,
    isWishlisted,
    updateNotification,
    clearAll,
    refresh,
    getEnrichedItems,
  };
}

export default useWishlist;
