/**
 * Premium Shop Service
 *
 * Handles all real-money (IAP) shop operations:
 * - Token packs
 * - Premium bundles
 * - Exclusive items
 * - Gifting
 *
 * NOTE: All purchases are validated server-side.
 * This service handles catalog fetching and initiating purchases.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 7-8
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Platform } from "react-native";

import {
  ShopErrorCode,
  type GiftableItem,
  type GiftPurchaseResult,
  type IAPPlatform,
  type IAPPurchaseResult,
  type PremiumBundle,
  type PremiumExclusiveItem,
  type PremiumShopCatalog,
  type RestoreResult,
  type TokenPack,
  type ValidateReceiptRequest,
  type ValidateReceiptResponse,
} from "@/types/shop";
import { getFirestoreInstance, getFunctionsInstance } from "./firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/premiumShop");
// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "PremiumProducts";
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Product ID prefixes by platform
const PRODUCT_ID_PREFIX = {
  ios: "com.snapstyle.",
  android: "snapstyle_",
} as const;

// In-memory cache
let catalogCache: {
  data: PremiumShopCatalog | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

// =============================================================================
// Types
// =============================================================================

interface PremiumProductDoc {
  id: string;
  productId: string;
  type: "token_pack" | "bundle" | "exclusive";
  name: string;
  description?: string;
  basePriceUSD: number;
  rewards?: {
    tokens?: number;
    bonusTokens?: number;
    itemIds?: string[];
  };
  featured?: boolean;
  popular?: boolean;
  sortOrder?: number;
  platforms?: IAPPlatform[];
  availableFrom?: unknown;
  availableTo?: unknown;
  totalSupply?: number;
  purchaseLimit?: number;
  limitedTime?: boolean;
  limitedEdition?: boolean;
  active?: boolean;
  imagePath?: string;
  theme?: string;
  valueUSD?: number;
  savingsPercent?: number;
  slot?: string;
  rarity?: "legendary" | "mythic";
  giftMessage?: string;
}

interface FirestoreTimestampLike {
  toMillis?: () => number;
}

function toMillis(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (value && typeof value === "object") {
    const ts = value as FirestoreTimestampLike;
    if (typeof ts.toMillis === "function") {
      return ts.toMillis();
    }
  }
  return undefined;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a product is currently available
 */
function isProductAvailable(product: PremiumProductDoc): boolean {
  const now = Date.now();

  if (product.active === false) {
    return false;
  }

  // Check availability window
  const availableFrom = toMillis(product.availableFrom);
  const availableTo = toMillis(product.availableTo);

  if (availableFrom && availableFrom > now) {
    return false;
  }
  if (availableTo && availableTo < now) {
    return false;
  }

  // Check platform
  if (product.platforms && product.platforms.length > 0) {
    const currentPlatform = Platform.OS as IAPPlatform;
    if (!product.platforms.includes(currentPlatform)) {
      return false;
    }
  }

  return true;
}

/**
 * Get platform-specific product ID
 */
function getPlatformProductId(baseProductId: string): string {
  const platform = Platform.OS as IAPPlatform;
  const prefix = PRODUCT_ID_PREFIX[platform] || PRODUCT_ID_PREFIX.android;

  // If already has prefix, return as-is
  if (baseProductId.startsWith(prefix) || baseProductId.startsWith("com.")) {
    return baseProductId;
  }

  return `${prefix}${baseProductId}`;
}

/**
 * Map document to TokenPack
 */
function mapToTokenPack(doc: PremiumProductDoc): TokenPack {
  const tokens = doc.rewards?.tokens || 0;
  const bonusTokens = doc.rewards?.bonusTokens || 0;

  return {
    id: doc.id,
    productId: getPlatformProductId(doc.productId),
    name: doc.name,
    tokens,
    bonusTokens,
    totalTokens: tokens + bonusTokens,
    basePriceUSD: doc.basePriceUSD,
    popular: doc.popular || false,
    featured: doc.featured || false,
    sortOrder: doc.sortOrder || 0,
    discountPercent: undefined,
    availableFrom: toMillis(doc.availableFrom),
    availableTo: toMillis(doc.availableTo),
  };
}

/**
 * Map document to PremiumBundle
 */
function mapToBundle(doc: PremiumProductDoc): PremiumBundle {
  return {
    id: doc.id,
    productId: getPlatformProductId(doc.productId),
    name: doc.name,
    description: doc.description || "",
    items: (doc.rewards?.itemIds || []).map((itemId) => ({
      itemId,
      name: itemId, // Will be resolved later
      slot: "hat", // Will be resolved later
      rarity: "rare",
      imagePath: "",
    })),
    bonusTokens: doc.rewards?.bonusTokens || 0,
    basePriceUSD: doc.basePriceUSD,
    valueUSD: doc.valueUSD || doc.basePriceUSD * 1.5,
    savingsPercent: doc.savingsPercent || 0,
    imagePath: doc.imagePath || "",
    theme: doc.theme || "starter",
    featured: doc.featured || false,
    sortOrder: doc.sortOrder || 0,
    limitedTime: doc.limitedTime || false,
    availableFrom: toMillis(doc.availableFrom),
    availableTo: toMillis(doc.availableTo),
    purchaseLimit: doc.purchaseLimit,
  };
}

/**
 * Map document to PremiumExclusiveItem
 */
function mapToExclusive(doc: PremiumProductDoc): PremiumExclusiveItem {
  return {
    id: doc.id,
    productId: getPlatformProductId(doc.productId),
    name: doc.name,
    description: doc.description || "",
    slot: (doc.slot as PremiumExclusiveItem["slot"]) || "hat",
    rarity: doc.rarity || "legendary",
    imagePath: doc.imagePath || "",
    basePriceUSD: doc.basePriceUSD,
    premiumExclusive: true,
    limitedEdition: doc.limitedEdition || false,
    availableFrom: toMillis(doc.availableFrom),
    availableTo: toMillis(doc.availableTo),
    totalSupply: doc.totalSupply,
    featured: doc.featured || false,
    sortOrder: doc.sortOrder || 0,
  };
}

/**
 * Map document to GiftableItem
 */
function mapToGiftable(doc: PremiumProductDoc): GiftableItem {
  return {
    id: doc.id,
    productId: getPlatformProductId(doc.productId),
    name: doc.name,
    type:
      doc.type === "token_pack"
        ? "tokenPack"
        : doc.type === "bundle"
          ? "bundle"
          : "exclusive",
    basePriceUSD: doc.basePriceUSD,
    giftMessage: doc.giftMessage || `Here's a gift for you!`,
  };
}

// =============================================================================
// Catalog Fetching
// =============================================================================

/**
 * Get the full premium shop catalog
 */
export async function getPremiumShopCatalog(
  forceRefresh = false,
): Promise<PremiumShopCatalog> {
  const db = getFirestoreInstance();

  // Check cache
  const now = Date.now();
  if (
    !forceRefresh &&
    catalogCache.data &&
    now - catalogCache.timestamp < CACHE_DURATION_MS
  ) {
    logger.info("[premiumShop] Returning cached catalog");
    return catalogCache.data;
  }

  try {
    logger.info("[premiumShop] Fetching catalog from Firestore");

    const catalogRef = collection(db, COLLECTION_NAME);
    const q = query(catalogRef, orderBy("sortOrder", "asc"));

    const snapshot = await getDocs(q);

    const tokenPacks: TokenPack[] = [];
    const bundles: PremiumBundle[] = [];
    const exclusives: PremiumExclusiveItem[] = [];
    const giftable: GiftableItem[] = [];

    let featuredBundle: PremiumBundle | undefined;
    let featuredExclusive: PremiumExclusiveItem | undefined;

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as PremiumProductDoc;
      const product: PremiumProductDoc = { ...data, id: docSnapshot.id };

      // Skip unavailable products
      if (!isProductAvailable(product)) {
        return;
      }

      switch (product.type) {
        case "token_pack":
          const pack = mapToTokenPack(product);
          tokenPacks.push(pack);
          // Token packs are always giftable
          giftable.push(mapToGiftable(product));
          break;

        case "bundle":
          const bundle = mapToBundle(product);
          bundles.push(bundle);
          if (product.featured && !featuredBundle) {
            featuredBundle = bundle;
          }
          // Bundles can be gifted
          giftable.push(mapToGiftable(product));
          break;

        case "exclusive":
          const exclusive = mapToExclusive(product);
          exclusives.push(exclusive);
          if (product.featured && !featuredExclusive) {
            featuredExclusive = exclusive;
          }
          // Exclusives can be gifted
          giftable.push(mapToGiftable(product));
          break;
      }
    });

    // Sort by sort order
    tokenPacks.sort((a, b) => a.sortOrder - b.sortOrder);
    bundles.sort((a, b) => a.sortOrder - b.sortOrder);
    exclusives.sort((a, b) => a.sortOrder - b.sortOrder);

    const catalog: PremiumShopCatalog = {
      tokenPacks,
      bundles,
      exclusives,
      giftable,
      featuredBundle,
      featuredExclusive,
      lastUpdated: now,
    };

    // Update cache
    catalogCache = {
      data: catalog,
      timestamp: now,
    };

    logger.info(
      `[premiumShop] Catalog loaded: ${tokenPacks.length} packs, ${bundles.length} bundles, ${exclusives.length} exclusives`,
    );
    return catalog;
  } catch (error) {
    logger.error("[premiumShop] Error fetching catalog:", error);
    throw error;
  }
}

/**
 * Get token packs only
 */
export async function getTokenPacks(): Promise<TokenPack[]> {
  const catalog = await getPremiumShopCatalog();
  return catalog.tokenPacks;
}

/**
 * Get premium bundles only
 */
export async function getPremiumBundles(): Promise<PremiumBundle[]> {
  const catalog = await getPremiumShopCatalog();
  return catalog.bundles;
}

/**
 * Get premium exclusives only
 */
export async function getPremiumExclusives(): Promise<PremiumExclusiveItem[]> {
  const catalog = await getPremiumShopCatalog();
  return catalog.exclusives;
}

/**
 * Get a single product by ID
 */
export async function getPremiumProduct(
  productId: string,
): Promise<TokenPack | PremiumBundle | PremiumExclusiveItem | null> {
  const db = getFirestoreInstance();

  try {
    const productRef = doc(db, COLLECTION_NAME, productId);
    const productDoc = await getDoc(productRef);

    if (!productDoc.exists()) {
      return null;
    }

    const data = productDoc.data() as PremiumProductDoc;
    const product: PremiumProductDoc = { ...data, id: productDoc.id };

    if (!isProductAvailable(product)) {
      return null;
    }

    switch (product.type) {
      case "token_pack":
        return mapToTokenPack(product);
      case "bundle":
        return mapToBundle(product);
      case "exclusive":
        return mapToExclusive(product);
      default:
        return null;
    }
  } catch (error) {
    logger.error("[premiumShop] Error fetching product:", error);
    return null;
  }
}

// =============================================================================
// Purchase Operations
// =============================================================================

/**
 * Purchase a token pack
 *
 * This initiates the IAP flow and validates the receipt server-side.
 */
export async function purchaseTokenPack(
  packId: string,
): Promise<IAPPurchaseResult> {
  logger.info("[premiumShop] Initiating token pack purchase:", packId);

  // Get the product details
  const catalog = await getPremiumShopCatalog();
  const pack = catalog.tokenPacks.find((p) => p.id === packId);

  if (!pack) {
    return {
      success: false,
      error: "Token pack not found",
      errorCode: ShopErrorCode.IAP_PRODUCT_NOT_FOUND,
    };
  }

  // In development, use mock purchase
  if (__DEV__) {
    return mockPurchase(pack.productId, pack.totalTokens);
  }

  // Production: Use real IAP
  return initiateIAPPurchase(pack.productId, "token_pack");
}

/**
 * Purchase a premium bundle
 */
export async function purchasePremiumBundle(
  bundleId: string,
): Promise<IAPPurchaseResult> {
  logger.info("[premiumShop] Initiating bundle purchase:", bundleId);

  const catalog = await getPremiumShopCatalog();
  const bundle = catalog.bundles.find((b) => b.id === bundleId);

  if (!bundle) {
    return {
      success: false,
      error: "Bundle not found",
      errorCode: ShopErrorCode.IAP_PRODUCT_NOT_FOUND,
    };
  }

  if (__DEV__) {
    return mockPurchase(
      bundle.productId,
      bundle.bonusTokens,
      bundle.items.map((i) => i.itemId),
    );
  }

  return initiateIAPPurchase(bundle.productId, "bundle");
}

/**
 * Purchase a premium exclusive item
 */
export async function purchasePremiumExclusive(
  itemId: string,
): Promise<IAPPurchaseResult> {
  logger.info("[premiumShop] Initiating exclusive purchase:", itemId);

  const catalog = await getPremiumShopCatalog();
  const exclusive = catalog.exclusives.find((e) => e.id === itemId);

  if (!exclusive) {
    return {
      success: false,
      error: "Exclusive item not found",
      errorCode: ShopErrorCode.IAP_PRODUCT_NOT_FOUND,
    };
  }

  if (__DEV__) {
    return mockPurchase(exclusive.productId, 0, [exclusive.id]);
  }

  return initiateIAPPurchase(exclusive.productId, "exclusive");
}

/**
 * Gift an item to another user
 */
export async function giftItem(
  itemId: string,
  recipientUid: string,
  message?: string,
): Promise<GiftPurchaseResult> {
  logger.info(
    "[premiumShop] Initiating gift purchase:",
    itemId,
    "to",
    recipientUid,
  );

  try {
    const functions = getFunctionsInstance();
    const sendGiftFunction = httpsCallable<
      { itemId: string; recipientUid: string; message?: string },
      GiftPurchaseResult
    >(functions, "sendGift");

    // Note: This would need to be combined with IAP flow in production
    // For now, this is a placeholder for the Cloud Function call

    const result = await sendGiftFunction({
      itemId,
      recipientUid,
      message,
    });

    return result.data;
  } catch (error: any) {
    logger.error("[premiumShop] Gift error:", error);
    return {
      success: false,
      error: error.message || "Failed to send gift",
      errorCode: ShopErrorCode.SERVER_ERROR,
    };
  }
}

/**
 * Restore previous purchases
 */
export async function restorePurchases(): Promise<RestoreResult> {
  logger.info("[premiumShop] Restoring purchases");

  if (__DEV__) {
    logger.info("[premiumShop] Mock restore in development");
    return { success: true, restored: [] };
  }

  try {
    const functions = getFunctionsInstance();
    const restoreFunction = httpsCallable<void, RestoreResult>(
      functions,
      "restorePurchases",
    );

    const result = await restoreFunction();
    return result.data;
  } catch (error: any) {
    logger.error("[premiumShop] Restore error:", error);
    return {
      success: false,
      error: error.message || "Failed to restore purchases",
      restored: [],
    };
  }
}

// =============================================================================
// IAP Integration (Placeholder)
// =============================================================================

/**
 * Initiate IAP purchase flow
 *
 * This is a placeholder that will be fully implemented in Phase 3
 * when react-native-iap is integrated.
 */
async function initiateIAPPurchase(
  productId: string,
  productType: "token_pack" | "bundle" | "exclusive",
): Promise<IAPPurchaseResult> {
  logger.info("[premiumShop] IAP purchase:", productId, productType);

  // NOTE: Phase 3 - Implement real IAP flow
  // 1. Get product from store
  // 2. Request purchase
  // 3. Get receipt/token
  // 4. Validate with server
  // 5. Grant rewards
  // 6. Finish transaction

  return {
    success: false,
    error: "IAP not yet implemented - coming in Phase 3",
    errorCode: ShopErrorCode.IAP_NOT_INITIALIZED,
  };
}

/**
 * Validate receipt with server
 */
export async function validateReceipt(
  request: ValidateReceiptRequest,
): Promise<ValidateReceiptResponse> {
  try {
    const functions = getFunctionsInstance();
    const validateFunction = httpsCallable<
      ValidateReceiptRequest,
      ValidateReceiptResponse
    >(functions, "validateReceipt");

    const result = await validateFunction(request);
    return result.data;
  } catch (error: any) {
    logger.error("[premiumShop] Receipt validation error:", error);
    return {
      success: false,
      error: error.message || "Validation failed",
    };
  }
}

/**
 * Mock purchase for development
 */
async function mockPurchase(
  productId: string,
  tokens: number,
  items?: string[],
): Promise<IAPPurchaseResult> {
  logger.info("[premiumShop] Mock purchase:", productId);

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // In dev mode, simulate successful purchase
  // The actual granting should happen server-side
  // This is just for UI testing

  return {
    success: true,
    purchaseId: `mock_${Date.now()}`,
    grantedTokens: tokens,
    grantedItems: items || [],
  };
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to premium catalog updates
 */
export function subscribeToPremiumCatalog(
  onUpdate: (catalog: PremiumShopCatalog) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirestoreInstance();
  const catalogRef = collection(db, COLLECTION_NAME);
  const q = query(catalogRef, orderBy("sortOrder", "asc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      try {
        const tokenPacks: TokenPack[] = [];
        const bundles: PremiumBundle[] = [];
        const exclusives: PremiumExclusiveItem[] = [];
        const giftable: GiftableItem[] = [];

        let featuredBundle: PremiumBundle | undefined;
        let featuredExclusive: PremiumExclusiveItem | undefined;

        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data() as PremiumProductDoc;
          const product: PremiumProductDoc = { ...data, id: docSnapshot.id };

          if (!isProductAvailable(product)) {
            return;
          }

          switch (product.type) {
            case "token_pack":
              const pack = mapToTokenPack(product);
              tokenPacks.push(pack);
              giftable.push(mapToGiftable(product));
              break;

            case "bundle":
              const bundle = mapToBundle(product);
              bundles.push(bundle);
              if (product.featured && !featuredBundle) {
                featuredBundle = bundle;
              }
              giftable.push(mapToGiftable(product));
              break;

            case "exclusive":
              const exclusive = mapToExclusive(product);
              exclusives.push(exclusive);
              if (product.featured && !featuredExclusive) {
                featuredExclusive = exclusive;
              }
              giftable.push(mapToGiftable(product));
              break;
          }
        });

        const catalog: PremiumShopCatalog = {
          tokenPacks,
          bundles,
          exclusives,
          giftable,
          featuredBundle,
          featuredExclusive,
          lastUpdated: Date.now(),
        };

        // Update cache
        catalogCache = {
          data: catalog,
          timestamp: Date.now(),
        };

        onUpdate(catalog);
      } catch (error) {
        logger.error("[premiumShop] Error processing snapshot:", error);
        onError?.(error as Error);
      }
    },
    (error) => {
      logger.error("[premiumShop] Subscription error:", error);
      onError?.(error);
    },
  );

  return unsubscribe;
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear the premium catalog cache
 */
export function clearPremiumShopCache(): void {
  catalogCache = {
    data: null,
    timestamp: 0,
  };
  logger.info("[premiumShop] Cache cleared");
}

/**
 * Invalidate cache
 */
export function invalidatePremiumShopCache(): void {
  catalogCache.timestamp = 0;
  logger.info("[premiumShop] Cache invalidated");
}

// =============================================================================
// Export Aliases (for consistency with hook imports)
// =============================================================================

/**
 * Alias for getPremiumShopCatalog - used by hooks
 */
export const getPremiumCatalog = getPremiumShopCatalog;

/**
 * Alias for purchasePremiumBundle - used by hooks
 */
export const purchaseBundle = purchasePremiumBundle;

/**
 * Alias for purchasePremiumExclusive - used by hooks
 */
export const purchaseExclusive = purchasePremiumExclusive;

/**
 * Alias for restorePurchases with uid parameter - used by hooks
 */
export async function restorePurchasesForUser(
  uid: string,
): Promise<RestoreResult> {
  // In production, you might want to include uid in the request
  return restorePurchases();
}
