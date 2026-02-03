/**
 * usePointsShop Hook
 *
 * Provides state management and actions for the Points Shop.
 *
 * Features:
 * - Catalog data with real-time updates
 * - Wallet balance subscription
 * - Purchase flow with error handling
 * - Filtering and search
 * - Ownership tracking
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 6.2
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { subscribeToWallet } from "@/services/economy";
import {
  getPointsShopCatalog,
  purchaseWithTokens,
} from "@/services/pointsShop";
import type {
  ExtendedCosmeticRarity,
  ExtendedCosmeticSlot,
} from "@/types/profile";
import type {
  PointsPurchaseResult,
  PointsShopCatalogFlat,
  PointsShopItem,
  ShopError,
} from "@/types/shop";
import { SHOP_ERROR_MESSAGES, ShopErrorCode } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

interface Wallet {
  tokens: number;
  premiumTokens: number;
  lastUpdated: number;
}

export interface UsePointsShopReturn {
  // Catalog data
  catalog: PointsShopCatalogFlat | null;
  featuredItems: PointsShopItem[];
  allItems: PointsShopItem[];

  // Wallet
  wallet: Wallet | null;
  balance: number;

  // Loading states
  loading: boolean;
  catalogLoading: boolean;
  purchaseLoading: boolean;

  // Error states
  error: ShopError | null;
  purchaseError: ShopError | null;

  // Actions
  purchase: (itemId: string) => Promise<PointsPurchaseResult>;
  refresh: () => Promise<void>;
  canAfford: (price: number) => boolean;

  // Filtering
  filterByCategory: (slot: ExtendedCosmeticSlot) => PointsShopItem[];
  filterByRarity: (rarity: ExtendedCosmeticRarity) => PointsShopItem[];
  filterByPriceRange: (min: number, max: number) => PointsShopItem[];
  searchItems: (query: string) => PointsShopItem[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a ShopError from error code
 */
function createShopError(
  code: ShopErrorCode,
  customMessage?: string,
): ShopError {
  return {
    code,
    message: customMessage || SHOP_ERROR_MESSAGES[code],
  };
}

/**
 * Map slot to category key in catalog
 */
function slotToCategoryKey(slot: ExtendedCosmeticSlot): string {
  const mapping: Record<ExtendedCosmeticSlot, string> = {
    hat: "hats",
    glasses: "glasses",
    background: "backgrounds",
    clothing_top: "clothingTops",
    clothing_bottom: "clothingBottoms",
    accessory_neck: "neckAccessories",
    accessory_ear: "earAccessories",
    accessory_hand: "handAccessories",
    profile_frame: "frames",
    profile_banner: "banners",
    profile_theme: "themes",
    chat_bubble: "bubbles",
    name_effect: "nameEffects",
  };
  return mapping[slot] || "other";
}

// =============================================================================
// Hook
// =============================================================================

export function usePointsShop(uid: string | undefined): UsePointsShopReturn {
  // State
  const [catalog, setCatalog] = useState<PointsShopCatalogFlat | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState<ShopError | null>(null);
  const [purchaseError, setPurchaseError] = useState<ShopError | null>(null);

  // Computed: balance
  const balance = useMemo(() => wallet?.tokens || 0, [wallet]);

  // Computed: featured items
  const featuredItems = useMemo(() => catalog?.featured || [], [catalog]);

  // Computed: all items flattened
  const allItems = useMemo(() => {
    if (!catalog) return [];

    const items: PointsShopItem[] = [];
    Object.values(catalog.categories).forEach((categoryItems) => {
      items.push(...categoryItems);
    });

    // Add canAfford flag
    return items.map((item) => ({
      ...item,
      canAfford: balance >= item.priceTokens,
    }));
  }, [catalog, balance]);

  // ---------------------------------------------------------------------------
  // Catalog Loading
  // ---------------------------------------------------------------------------

  const loadCatalog = useCallback(
    async (forceRefresh = false) => {
      if (!uid) {
        setError(createShopError(ShopErrorCode.NOT_AUTHENTICATED));
        setLoading(false);
        return;
      }

      try {
        setCatalogLoading(true);
        setError(null);

        const catalogData = await getPointsShopCatalog(uid, forceRefresh);
        setCatalog(catalogData);
      } catch (err: any) {
        console.error("[usePointsShop] Error loading catalog:", err);
        setError(
          createShopError(
            ShopErrorCode.SERVER_ERROR,
            err.message || "Failed to load shop",
          ),
        );
      } finally {
        setCatalogLoading(false);
        setLoading(false);
      }
    },
    [uid],
  );

  // ---------------------------------------------------------------------------
  // Initial Load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // ---------------------------------------------------------------------------
  // Wallet Subscription
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!uid) return;

    const unsubscribe = subscribeToWallet(uid, (walletData) => {
      if (walletData) {
        setWallet({
          tokens: walletData.tokensBalance || 0,
          premiumTokens: 0, // Premium tokens tracked separately if needed
          lastUpdated: walletData.updatedAt || Date.now(),
        });
      } else {
        setWallet(null);
      }
    });

    return unsubscribe;
  }, [uid]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Purchase an item
   */
  const purchase = useCallback(
    async (itemId: string): Promise<PointsPurchaseResult> => {
      if (!uid) {
        const error = createShopError(ShopErrorCode.NOT_AUTHENTICATED);
        setPurchaseError(error);
        return {
          success: false,
          error: error.message,
          errorCode: ShopErrorCode.NOT_AUTHENTICATED,
        };
      }

      try {
        setPurchaseLoading(true);
        setPurchaseError(null);

        const result = await purchaseWithTokens(itemId);

        if (result.success) {
          // Refresh catalog to update ownership status
          await loadCatalog(true);
        } else {
          const errorCode = result.errorCode || ShopErrorCode.SERVER_ERROR;
          setPurchaseError(createShopError(errorCode, result.error));
        }

        return result;
      } catch (err: any) {
        console.error("[usePointsShop] Purchase error:", err);
        const shopError = createShopError(
          ShopErrorCode.SERVER_ERROR,
          err.message || "Purchase failed",
        );
        setPurchaseError(shopError);
        return {
          success: false,
          error: shopError.message,
          errorCode: ShopErrorCode.SERVER_ERROR,
        };
      } finally {
        setPurchaseLoading(false);
      }
    },
    [uid, loadCatalog],
  );

  /**
   * Refresh catalog
   */
  const refresh = useCallback(async () => {
    await loadCatalog(true);
  }, [loadCatalog]);

  /**
   * Check if user can afford a price
   */
  const canAfford = useCallback(
    (price: number): boolean => {
      return balance >= price;
    },
    [balance],
  );

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  /**
   * Filter items by slot/category
   */
  const filterByCategory = useCallback(
    (slot: ExtendedCosmeticSlot): PointsShopItem[] => {
      if (!catalog) return [];

      const categoryKey = slotToCategoryKey(slot);
      const items = catalog.categories[categoryKey] || [];

      // Add canAfford flag
      return items.map((item) => ({
        ...item,
        canAfford: balance >= item.priceTokens,
      }));
    },
    [catalog, balance],
  );

  /**
   * Filter items by rarity
   */
  const filterByRarity = useCallback(
    (rarity: ExtendedCosmeticRarity): PointsShopItem[] => {
      return allItems.filter((item) => item.rarity === rarity);
    },
    [allItems],
  );

  /**
   * Filter items by price range
   */
  const filterByPriceRange = useCallback(
    (min: number, max: number): PointsShopItem[] => {
      return allItems.filter(
        (item) => item.priceTokens >= min && item.priceTokens <= max,
      );
    },
    [allItems],
  );

  /**
   * Search items by name, description, or tags
   */
  const searchItems = useCallback(
    (query: string): PointsShopItem[] => {
      if (!query.trim() || !catalog) return [];

      const searchQuery = query.toLowerCase().trim();
      const results: PointsShopItem[] = [];

      // Search through all categories
      Object.values(catalog.categories).forEach((items) => {
        items.forEach((item) => {
          // Match name
          if (item.name.toLowerCase().includes(searchQuery)) {
            results.push({ ...item, canAfford: balance >= item.priceTokens });
            return;
          }

          // Match tags
          if (
            item.tags.some((tag) => tag.toLowerCase().includes(searchQuery))
          ) {
            results.push({ ...item, canAfford: balance >= item.priceTokens });
            return;
          }

          // Match description
          if (item.description.toLowerCase().includes(searchQuery)) {
            results.push({ ...item, canAfford: balance >= item.priceTokens });
          }
        });
      });

      // Sort by relevance (name matches first)
      results.sort((a, b) => {
        const aNameMatch = a.name.toLowerCase().includes(searchQuery);
        const bNameMatch = b.name.toLowerCase().includes(searchQuery);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        return a.sortOrder - b.sortOrder;
      });

      return results;
    },
    [catalog, balance],
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Catalog data
    catalog,
    featuredItems,
    allItems,

    // Wallet
    wallet,
    balance,

    // Loading states
    loading,
    catalogLoading,
    purchaseLoading,

    // Error states
    error,
    purchaseError,

    // Actions
    purchase,
    refresh,
    canAfford,

    // Filtering
    filterByCategory,
    filterByRarity,
    filterByPriceRange,
    searchItems,
  };
}
