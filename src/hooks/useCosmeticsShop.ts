/**
 * useCosmeticsShop Hook
 *
 * State manager for the Cosmetics Shop screen (backgrounds, decorations,
 * badges, themes). Uses the local COSMETICS_CATALOG + purchaseCosmeticWithTokens
 * Cloud Function + Entitlements subcollection ownership system.
 *
 * @module hooks/useCosmeticsShop
 */

import { httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  COSMETICS_CATALOG,
  getCosmeticById,
  getShopCosmetics,
} from "@/cosmetics/catalog";
import {
  FEATURED_ITEMS,
  STORE_BUNDLES,
  getBundleDiscount,
  getBundleUnownedIds,
  isBundleFullyOwned,
} from "@/cosmetics/storeCurations";
import type {
  CosmeticBundle,
  CosmeticDefinition,
  CosmeticType,
  Entitlement,
  FeaturedItem,
} from "@/cosmetics/types";
import { formatTokenAmount, subscribeToWallet } from "@/services/economy";
import { subscribeEntitlements } from "@/services/entitlements";
import { getFunctionsInstance } from "@/services/firebase";

import { createLogger } from "@/utils/log";

const logger = createLogger("hooks/useCosmeticsShop");

// =============================================================================
// Types
// =============================================================================

export type CosmeticsShopTab = "all" | CosmeticType;

export interface PurchaseResult {
  success: boolean;
  error?: string;
}

export interface ResolvedFeatured {
  featured: FeaturedItem;
  cosmetic: CosmeticDefinition;
}

export interface BundleWithStatus {
  bundle: CosmeticBundle;
  fullyOwned: boolean;
  unownedCount: number;
  discount: number;
}

export interface UseCosmeticsShopReturn {
  // Tabs
  activeTab: CosmeticsShopTab;
  setActiveTab: (tab: CosmeticsShopTab) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Data
  shopItems: CosmeticDefinition[];
  featuredItems: ResolvedFeatured[];
  bundles: BundleWithStatus[];

  // Ownership
  ownedSet: ReadonlySet<string>;
  isOwned: (id: string) => boolean;

  // Wallet
  walletBalance: number;
  canAfford: (price: number) => boolean;

  // Purchase
  purchasing: boolean;
  purchaseItem: (cosmeticId: string) => Promise<PurchaseResult>;

  // Loading
  loading: boolean;
}

// =============================================================================
// Hook
// =============================================================================

export function useCosmeticsShop(
  uid: string | undefined,
): UseCosmeticsShopReturn {
  // ── State ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<CosmeticsShopTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // ── Subscriptions ──────────────────────────────────────────────────────

  // Entitlements subscription
  useEffect(() => {
    if (!uid) return;
    setEntitlementsLoading(true);
    const unsub = subscribeEntitlements(
      uid,
      (items) => {
        setEntitlements(items);
        setEntitlementsLoading(false);
      },
      (error) => {
        logger.error("Entitlements subscription error:", error);
        setEntitlementsLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  // Wallet subscription
  useEffect(() => {
    if (!uid) return;
    setWalletLoading(true);
    const unsub = subscribeToWallet(
      uid,
      (wallet) => {
        setWalletBalance(wallet?.tokensBalance ?? 0);
        setWalletLoading(false);
      },
      (error) => {
        logger.error("Wallet subscription error:", error);
        setWalletLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  // ── Derived state ──────────────────────────────────────────────────────

  const ownedSet = useMemo(() => {
    const set = new Set<string>();
    for (const e of entitlements) {
      set.add(e.cosmeticId);
    }
    return set as ReadonlySet<string>;
  }, [entitlements]);

  const isOwned = useCallback((id: string) => ownedSet.has(id), [ownedSet]);

  const canAfford = useCallback(
    (price: number) => walletBalance >= price,
    [walletBalance],
  );

  // ── Shop items (filtered by tab + search) ──────────────────────────────

  const shopItems = useMemo(() => {
    // Get all shop cosmetics (source === "shop" && has asset)
    let items = getShopCosmetics();

    // Include free/starter items too (they can be claimed)
    const allItems = items;

    // Filter by tab
    if (activeTab !== "all") {
      items = allItems.filter((item) => item.type === activeTab);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.tags?.some((t) => t.toLowerCase().includes(query)),
      );
    }

    return items;
  }, [activeTab, searchQuery]);

  // ── Featured items ─────────────────────────────────────────────────────

  const featuredItems = useMemo((): ResolvedFeatured[] => {
    return FEATURED_ITEMS.map((f) => ({
      featured: f,
      cosmetic: getCosmeticById(f.cosmeticId),
    })).filter((entry): entry is ResolvedFeatured => entry.cosmetic != null);
  }, []);

  // ── Bundles with status ────────────────────────────────────────────────

  const bundles = useMemo((): BundleWithStatus[] => {
    return STORE_BUNDLES.map((bundle) => ({
      bundle,
      fullyOwned: isBundleFullyOwned(bundle, ownedSet),
      unownedCount: getBundleUnownedIds(bundle, ownedSet).length,
      discount: getBundleDiscount(bundle),
    }));
  }, [ownedSet]);

  // ── Purchase ───────────────────────────────────────────────────────────

  const purchaseItem = useCallback(
    async (cosmeticId: string): Promise<PurchaseResult> => {
      if (!uid) return { success: false, error: "Not signed in" };
      if (purchasing) return { success: false, error: "Purchase in progress" };
      if (isOwned(cosmeticId))
        return { success: false, error: "Already owned" };

      const item = getCosmeticById(cosmeticId);
      if (!item) {
        if (__DEV__) {
          // Fuzzy-match: find nearest catalog IDs to help debug typos
          const allIds = COSMETICS_CATALOG.map((c) => c.id);
          const prefix = cosmeticId.split("_")[0];
          const nearMatches = allIds.filter(
            (id) =>
              id.startsWith(prefix) || id.includes(cosmeticId.slice(0, 6)),
          );
          logger.error(
            `[purchaseItem] Item "${cosmeticId}" not found in catalog.`,
            {
              nearestIds: nearMatches.slice(0, 10),
              totalCatalog: allIds.length,
            },
          );
        }
        return {
          success: false,
          error: "Item unavailable \u2014 please update the app.",
        };
      }

      // Guard: item exists but isn't for sale
      if (
        item.source !== "shop" ||
        !item.priceTokens ||
        item.priceTokens <= 0
      ) {
        if (__DEV__) {
          logger.warn(
            `[purchaseItem] Item "${cosmeticId}" is not for sale (source=${item.source}, price=${item.priceTokens}).`,
          );
        }
        return { success: false, error: "Item not for sale." };
      }

      if (!canAfford(item.priceTokens)) {
        return {
          success: false,
          error: `Need ${formatTokenAmount(item.priceTokens)} tokens`,
        };
      }

      setPurchasing(true);
      try {
        const functions = getFunctionsInstance();
        const callable = httpsCallable<
          { cosmeticId: string },
          {
            success: boolean;
            error?: string;
            errorCode?: string;
            newBalance?: number;
          }
        >(functions, "purchaseCosmeticWithTokens");

        const result = await callable({ cosmeticId });

        if (result.data.success) {
          logger.info("Purchase successful:", cosmeticId);
          return { success: true };
        } else {
          // Map server error codes to user-friendly messages
          const code = result.data.errorCode;
          let userMessage: string;
          switch (code) {
            case "ITEM_NOT_FOUND":
              userMessage = "Item unavailable \u2014 please update the app.";
              break;
            case "ALREADY_OWNED":
              userMessage = "You already own this item.";
              break;
            case "INSUFFICIENT_FUNDS":
              userMessage = result.data.error || "Not enough tokens.";
              break;
            default:
              userMessage = result.data.error || "Purchase failed.";
          }
          if (__DEV__) {
            logger.warn("[purchaseItem] Server rejected purchase", {
              cosmeticId,
              errorCode: code,
              serverError: result.data.error,
            });
          }
          return { success: false, error: userMessage };
        }
      } catch (error: any) {
        logger.error("Purchase error:", error);
        // Network / Firebase errors → show the real message
        const message = error?.message || error?.code || "Something went wrong";
        return { success: false, error: message };
      } finally {
        setPurchasing(false);
      }
    },
    [uid, purchasing, isOwned, canAfford],
  );

  // ── Loading state ──────────────────────────────────────────────────────

  const loading = entitlementsLoading || walletLoading;

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    shopItems,
    featuredItems,
    bundles,
    ownedSet,
    isOwned,
    walletBalance,
    canAfford,
    purchasing,
    purchaseItem,
    loading,
  };
}
