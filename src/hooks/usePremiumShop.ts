/**
 * usePremiumShop Hook
 *
 * Provides state management and actions for the Premium Shop.
 *
 * Features:
 * - Premium catalog data with real-time updates
 * - IAP initialization and product loading
 * - Token pack purchases
 * - Bundle purchases
 * - Exclusive item purchases
 * - Purchase restoration
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 7
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { disconnectIAP, initializeIAP } from "@/services/iap";
import {
  getPremiumCatalog,
  purchasePremiumBundle as purchaseBundleService,
  purchasePremiumExclusive as purchaseExclusiveService,
  purchaseTokenPack as purchaseTokenPackService,
  restorePurchases as restorePurchasesService,
  subscribeToPremiumCatalog,
} from "@/services/premiumShop";
import type {
  IAPPurchaseResult,
  PremiumBundle,
  PremiumExclusiveItem,
  PremiumShopCatalog,
  RestoreResult,
  ShopError,
  TokenPack,
} from "@/types/shop";
import { SHOP_ERROR_MESSAGES, ShopErrorCode } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

export interface UsePremiumShopReturn {
  // Catalog data
  catalog: PremiumShopCatalog | null;
  tokenPacks: TokenPack[];
  bundles: PremiumBundle[];
  exclusives: PremiumExclusiveItem[];

  // Featured
  featuredBundle: PremiumBundle | undefined;
  featuredExclusive: PremiumExclusiveItem | undefined;

  // Loading states
  loading: boolean;
  catalogLoading: boolean;
  purchaseLoading: boolean;

  // Error states
  error: ShopError | null;
  purchaseError: string | null;

  // IAP state
  iapReady: boolean;

  // Actions
  purchaseTokenPack: (packId: string) => Promise<IAPPurchaseResult>;
  purchaseBundle: (bundleId: string) => Promise<IAPPurchaseResult>;
  purchaseExclusive: (itemId: string) => Promise<IAPPurchaseResult>;
  restorePurchases: () => Promise<RestoreResult>;
  refresh: () => Promise<void>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a ShopError from error code
 */
function createShopError(code: ShopErrorCode, message?: string): ShopError {
  return {
    code,
    message: message || SHOP_ERROR_MESSAGES[code] || "An error occurred",
  };
}

// =============================================================================
// Hook
// =============================================================================

export function usePremiumShop(uid: string | undefined): UsePremiumShopReturn {
  // State
  const [catalog, setCatalog] = useState<PremiumShopCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [error, setError] = useState<ShopError | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [iapReady, setIapReady] = useState(false);

  // Initialize IAP on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const ready = await initializeIAP();
        if (mounted) {
          setIapReady(ready);
        }
      } catch (err) {
        console.error("[usePremiumShop] IAP initialization failed:", err);
        if (mounted) {
          setIapReady(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      disconnectIAP();
    };
  }, []);

  // Load catalog
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setCatalogLoading(false);
      return;
    }

    let mounted = true;
    setCatalogLoading(true);

    // Initial load
    const loadCatalog = async () => {
      try {
        const data = await getPremiumCatalog();
        if (mounted) {
          setCatalog(data);
          setError(null);
        }
      } catch (err: any) {
        console.error("[usePremiumShop] Error loading catalog:", err);
        if (mounted) {
          setError(createShopError(ShopErrorCode.SERVER_ERROR, err.message));
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setCatalogLoading(false);
        }
      }
    };

    loadCatalog();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToPremiumCatalog(
      (updatedCatalog) => {
        if (mounted) {
          setCatalog(updatedCatalog);
          setError(null);
        }
      },
      (err: Error) => {
        console.error("[usePremiumShop] Catalog subscription error:", err);
        if (mounted) {
          setError(createShopError(ShopErrorCode.SERVER_ERROR, err.message));
        }
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [uid]);

  // Memoized values
  const tokenPacks = useMemo(() => {
    if (!catalog?.tokenPacks) return [];
    return [...catalog.tokenPacks].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [catalog]);

  const bundles = useMemo(() => {
    if (!catalog?.bundles) return [];
    return [...catalog.bundles].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [catalog]);

  const exclusives = useMemo(() => {
    if (!catalog?.exclusives) return [];
    return [...catalog.exclusives].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [catalog]);

  const featuredBundle = useMemo(
    () => catalog?.featuredBundle || bundles.find((b) => b.featured),
    [catalog, bundles],
  );

  const featuredExclusive = useMemo(
    () => catalog?.featuredExclusive || exclusives.find((e) => e.featured),
    [catalog, exclusives],
  );

  // Purchase token pack
  const purchaseTokenPack = useCallback(
    async (packId: string): Promise<IAPPurchaseResult> => {
      if (!uid) {
        return {
          success: false,
          error: "Not authenticated",
          errorCode: ShopErrorCode.NOT_AUTHENTICATED,
        };
      }

      if (!iapReady) {
        return {
          success: false,
          error: "Store not available",
          errorCode: ShopErrorCode.IAP_NOT_INITIALIZED,
        };
      }

      setPurchaseLoading(true);
      setPurchaseError(null);

      try {
        const result = await purchaseTokenPackService(packId);

        if (!result.success && result.error) {
          setPurchaseError(result.error);
        }

        return result;
      } catch (err: any) {
        const errorMessage = err.message || "Purchase failed";
        setPurchaseError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          errorCode: ShopErrorCode.IAP_PURCHASE_FAILED,
        };
      } finally {
        setPurchaseLoading(false);
      }
    },
    [uid, iapReady],
  );

  // Purchase bundle
  const purchaseBundle = useCallback(
    async (bundleId: string): Promise<IAPPurchaseResult> => {
      if (!uid) {
        return {
          success: false,
          error: "Not authenticated",
          errorCode: ShopErrorCode.NOT_AUTHENTICATED,
        };
      }

      if (!iapReady) {
        return {
          success: false,
          error: "Store not available",
          errorCode: ShopErrorCode.IAP_NOT_INITIALIZED,
        };
      }

      setPurchaseLoading(true);
      setPurchaseError(null);

      try {
        const result = await purchaseBundleService(bundleId);

        if (!result.success && result.error) {
          setPurchaseError(result.error);
        }

        return result;
      } catch (err: any) {
        const errorMessage = err.message || "Purchase failed";
        setPurchaseError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          errorCode: ShopErrorCode.IAP_PURCHASE_FAILED,
        };
      } finally {
        setPurchaseLoading(false);
      }
    },
    [uid, iapReady],
  );

  // Purchase exclusive
  const purchaseExclusive = useCallback(
    async (itemId: string): Promise<IAPPurchaseResult> => {
      if (!uid) {
        return {
          success: false,
          error: "Not authenticated",
          errorCode: ShopErrorCode.NOT_AUTHENTICATED,
        };
      }

      if (!iapReady) {
        return {
          success: false,
          error: "Store not available",
          errorCode: ShopErrorCode.IAP_NOT_INITIALIZED,
        };
      }

      setPurchaseLoading(true);
      setPurchaseError(null);

      try {
        const result = await purchaseExclusiveService(itemId);

        if (!result.success && result.error) {
          setPurchaseError(result.error);
        }

        return result;
      } catch (err: any) {
        const errorMessage = err.message || "Purchase failed";
        setPurchaseError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          errorCode: ShopErrorCode.IAP_PURCHASE_FAILED,
        };
      } finally {
        setPurchaseLoading(false);
      }
    },
    [uid, iapReady],
  );

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<RestoreResult> => {
    if (!uid) {
      return {
        success: false,
        restored: [],
        error: "Not authenticated",
      };
    }

    if (!iapReady) {
      return {
        success: false,
        restored: [],
        error: "Store not available",
      };
    }

    setPurchaseLoading(true);
    setPurchaseError(null);

    try {
      const result = await restorePurchasesService();

      if (!result.success && result.error) {
        setPurchaseError(result.error);
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || "Restore failed";
      setPurchaseError(errorMessage);
      return {
        success: false,
        restored: [],
        error: errorMessage,
      };
    } finally {
      setPurchaseLoading(false);
    }
  }, [uid, iapReady]);

  // Refresh catalog
  const refresh = useCallback(async () => {
    if (!uid) return;

    setCatalogLoading(true);
    setError(null);

    try {
      const data = await getPremiumCatalog();
      setCatalog(data);
    } catch (err: any) {
      console.error("[usePremiumShop] Error refreshing catalog:", err);
      setError(createShopError(ShopErrorCode.SERVER_ERROR, err.message));
    } finally {
      setCatalogLoading(false);
    }
  }, [uid]);

  return {
    catalog,
    tokenPacks,
    bundles,
    exclusives,
    featuredBundle,
    featuredExclusive,
    loading,
    catalogLoading,
    purchaseLoading,
    error,
    purchaseError,
    iapReady,
    purchaseTokenPack,
    purchaseBundle,
    purchaseExclusive,
    restorePurchases,
    refresh,
  };
}

export default usePremiumShop;
