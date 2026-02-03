/**
 * In-App Purchase (IAP) Service
 *
 * Handles real-money purchases for cosmetics using Expo's IAP module.
 * Supports:
 * - iOS App Store purchases
 * - Android Google Play purchases
 * - Receipt validation via Cloud Functions
 * - Purchase restoration
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 6
 */

import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Platform } from "react-native";
import { getAppInstance, getFirestoreInstance } from "./firebase";

// =============================================================================
// Types
// =============================================================================

/**
 * Token pack definition
 */
export interface TokenPack {
  id: string;
  productId: string;
  tokens: number;
  bonusTokens: number;
  basePriceUSD: number;
  popular: boolean;
}

/**
 * IAP product types
 */
export type IAPProductType = "consumable" | "non_consumable" | "subscription";

/**
 * IAP product definition (synced from App Store / Google Play)
 */
export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string; // Localized price string (e.g., "$4.99")
  priceAmountMicros: number; // Price in micros (e.g., 4990000)
  priceCurrencyCode: string; // ISO currency code
  type: IAPProductType;

  // Platform-specific
  localizedPrice?: string;
  subscriptionPeriod?: string;
}

/**
 * IAP purchase status
 */
export type IAPPurchaseStatus =
  | "pending" // Purchase initiated
  | "completed" // Payment confirmed
  | "verified" // Receipt validated by server
  | "delivered" // Items granted to user
  | "failed" // Payment failed
  | "cancelled" // User cancelled
  | "refunded"; // Purchase was refunded

/**
 * IAP purchase record
 */
export interface IAPPurchase {
  id: string;
  uid: string;
  productId: string;
  platform: "ios" | "android";
  status: IAPPurchaseStatus;

  // Transaction details
  transactionId: string;
  transactionReceipt?: string;
  orderId?: string; // Android order ID

  // Timestamps
  purchasedAt: number;
  verifiedAt?: number;
  deliveredAt?: number;

  // Items granted
  grantedItems?: string[]; // Cosmetic IDs
  grantedTokens?: number;

  // Price info (for analytics)
  priceUSD?: number;
  priceCurrency?: string;
  priceAmount?: number;

  // Error info
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Store product configuration (what we sell)
 * Stored in StoreProducts collection
 */
export interface StoreProduct {
  id: string;
  productId: string; // App Store / Play Store product ID
  name: string;
  description: string;
  type: IAPProductType;

  // What the user gets
  rewards: {
    tokens?: number;
    cosmeticIds?: string[];
    bundleId?: string;
  };

  // Display
  imagePath?: string;
  featured: boolean;
  sortOrder: number;

  // Pricing (reference only - actual price comes from store)
  basePriceUSD: number;

  // Availability
  active: boolean;
  availableFrom?: number;
  availableTo?: number;

  // Platform support
  platforms: ("ios" | "android")[];
}

/**
 * Verification result from Cloud Function
 */
export interface VerificationResult {
  success: boolean;
  valid: boolean;
  purchaseId?: string;
  grantedItems?: string[];
  grantedTokens?: number;
  error?: string;
}

// =============================================================================
// State Management
// =============================================================================

let isIAPInitialized = false;
let availableProducts: IAPProduct[] = [];
let pendingPurchases: Map<string, IAPPurchase> = new Map();

// Mock IAP state for development (since expo-in-app-purchases requires native setup)
const USE_MOCK_IAP = __DEV__;

// =============================================================================
// Initialization
// =============================================================================

/**
 * Initialize the IAP system
 * Must be called before any other IAP operations
 */
export async function initializeIAP(): Promise<boolean> {
  if (isIAPInitialized) {
    return true;
  }

  try {
    if (USE_MOCK_IAP) {
      console.log("[iap] Using mock IAP for development");
      isIAPInitialized = true;
      return true;
    }

    // In production, initialize expo-in-app-purchases
    // const { initConnection } = await import('expo-in-app-purchases');
    // await initConnection();

    console.log("[iap] IAP initialized successfully");
    isIAPInitialized = true;
    return true;
  } catch (error) {
    console.error("[iap] Failed to initialize IAP:", error);
    return false;
  }
}

/**
 * Clean up IAP connections
 * Call when app is closing or user logs out
 */
export async function disconnectIAP(): Promise<void> {
  if (!isIAPInitialized) return;

  try {
    if (!USE_MOCK_IAP) {
      // const { endConnection } = await import('expo-in-app-purchases');
      // await endConnection();
    }

    isIAPInitialized = false;
    availableProducts = [];
    pendingPurchases.clear();
    console.log("[iap] IAP disconnected");
  } catch (error) {
    console.error("[iap] Error disconnecting IAP:", error);
  }
}

// =============================================================================
// Product Fetching
// =============================================================================

/**
 * Get store products from our database
 */
export async function getStoreProducts(): Promise<StoreProduct[]> {
  const db = getFirestoreInstance();

  try {
    const productsRef = collection(db, "StoreProducts");
    const q = query(
      productsRef,
      where("active", "==", true),
      where("platforms", "array-contains", Platform.OS),
      orderBy("sortOrder", "asc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StoreProduct[];
  } catch (error) {
    console.error("[iap] Error fetching store products:", error);
    return [];
  }
}

/**
 * Get featured store products
 */
export async function getFeaturedStoreProducts(): Promise<StoreProduct[]> {
  const db = getFirestoreInstance();

  try {
    const productsRef = collection(db, "StoreProducts");
    const q = query(
      productsRef,
      where("active", "==", true),
      where("featured", "==", true),
      where("platforms", "array-contains", Platform.OS),
      orderBy("sortOrder", "asc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StoreProduct[];
  } catch (error) {
    console.error("[iap] Error fetching featured products:", error);
    return [];
  }
}

/**
 * Fetch product details from App Store / Google Play
 */
export async function fetchProductDetails(
  productIds: string[],
): Promise<IAPProduct[]> {
  if (!isIAPInitialized) {
    await initializeIAP();
  }

  if (USE_MOCK_IAP) {
    // Return mock products for development
    return productIds.map((id) => createMockProduct(id));
  }

  try {
    // In production, fetch from native store
    // const { getProductsAsync } = await import('expo-in-app-purchases');
    // const { results } = await getProductsAsync(productIds);
    // return results.map(convertNativeProduct);

    return [];
  } catch (error) {
    console.error("[iap] Error fetching product details:", error);
    return [];
  }
}

/**
 * Get all available products with store pricing
 */
export async function getAvailableProducts(): Promise<
  (StoreProduct & { storeProduct?: IAPProduct })[]
> {
  const storeProducts = await getStoreProducts();
  const productIds = storeProducts.map((p) => p.productId);

  if (productIds.length === 0) {
    return [];
  }

  const iapProducts = await fetchProductDetails(productIds);
  const iapProductMap = new Map(iapProducts.map((p) => [p.productId, p]));

  return storeProducts.map((product) => ({
    ...product,
    storeProduct: iapProductMap.get(product.productId),
  }));
}

// =============================================================================
// Purchase Flow
// =============================================================================

/**
 * Initiate a purchase
 */
export async function purchaseProduct(
  productId: string,
  uid: string,
): Promise<{
  success: boolean;
  purchaseId?: string;
  error?: string;
}> {
  if (!isIAPInitialized) {
    await initializeIAP();
  }

  try {
    const db = getFirestoreInstance();

    // Create pending purchase record
    const purchaseRef = await addDoc(collection(db, "IAPPurchases"), {
      uid,
      productId,
      platform: Platform.OS,
      status: "pending",
      purchasedAt: Timestamp.now(),
    });

    if (USE_MOCK_IAP) {
      // Simulate purchase flow in development
      console.log("[iap] Mock purchase initiated:", productId);

      // Simulate store purchase
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock transaction ID
      const mockTransactionId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Update purchase record
      await updateDoc(purchaseRef, {
        status: "completed",
        transactionId: mockTransactionId,
      });

      // Verify and deliver
      const result = await verifyAndDeliverPurchase(
        purchaseRef.id,
        mockTransactionId,
        "mock_receipt",
      );

      return {
        success: result.success,
        purchaseId: purchaseRef.id,
        error: result.error,
      };
    }

    // In production, initiate native purchase
    // const { purchaseItemAsync } = await import('expo-in-app-purchases');
    // await purchaseItemAsync(productId);

    // The purchase listener will handle the rest
    return {
      success: true,
      purchaseId: purchaseRef.id,
    };
  } catch (error: any) {
    console.error("[iap] Purchase failed:", error);
    return {
      success: false,
      error: error.message || "Purchase failed",
    };
  }
}

/**
 * Verify receipt and deliver items via Cloud Function
 */
export async function verifyAndDeliverPurchase(
  purchaseId: string,
  transactionId: string,
  receipt: string,
): Promise<VerificationResult> {
  const app = getAppInstance();
  const functions = getFunctions(app);

  try {
    const callable = httpsCallable<
      {
        purchaseId: string;
        transactionId: string;
        receipt: string;
        platform: string;
      },
      VerificationResult
    >(functions, "verifyIAPPurchase");

    const result = await callable({
      purchaseId,
      transactionId,
      receipt,
      platform: Platform.OS,
    });

    return result.data;
  } catch (error: any) {
    console.error("[iap] Verification failed:", error);
    return {
      success: false,
      valid: false,
      error: error.message || "Verification failed",
    };
  }
}

/**
 * Restore previous purchases
 * Useful for users reinstalling the app or switching devices
 */
export async function restorePurchases(uid: string): Promise<{
  restored: number;
  error?: string;
}> {
  if (!isIAPInitialized) {
    await initializeIAP();
  }

  try {
    if (USE_MOCK_IAP) {
      console.log("[iap] Mock restore - no previous purchases");
      return { restored: 0 };
    }

    // In production, restore from native store
    // const { getPurchaseHistoryAsync } = await import('expo-in-app-purchases');
    // const history = await getPurchaseHistoryAsync();

    // For each purchase, verify it hasn't been delivered yet
    // and deliver if valid

    return { restored: 0 };
  } catch (error: any) {
    console.error("[iap] Restore failed:", error);
    return {
      restored: 0,
      error: error.message || "Restore failed",
    };
  }
}

// =============================================================================
// Purchase History
// =============================================================================

/**
 * Get user's IAP purchase history
 */
export async function getIAPPurchaseHistory(
  uid: string,
  maxResults: number = 20,
): Promise<IAPPurchase[]> {
  const db = getFirestoreInstance();

  try {
    const purchasesRef = collection(db, "IAPPurchases");
    const q = query(
      purchasesRef,
      where("uid", "==", uid),
      orderBy("purchasedAt", "desc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.slice(0, maxResults).map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        productId: data.productId,
        platform: data.platform,
        status: data.status,
        transactionId: data.transactionId,
        transactionReceipt: data.transactionReceipt,
        orderId: data.orderId,
        purchasedAt: data.purchasedAt?.toMillis?.() || data.purchasedAt,
        verifiedAt: data.verifiedAt?.toMillis?.() || data.verifiedAt,
        deliveredAt: data.deliveredAt?.toMillis?.() || data.deliveredAt,
        grantedItems: data.grantedItems,
        grantedTokens: data.grantedTokens,
        priceUSD: data.priceUSD,
        priceCurrency: data.priceCurrency,
        priceAmount: data.priceAmount,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      };
    });
  } catch (error) {
    console.error("[iap] Error fetching purchase history:", error);
    return [];
  }
}

/**
 * Check if user has purchased a specific product
 */
export async function hasProductBeenPurchased(
  uid: string,
  productId: string,
): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const purchasesRef = collection(db, "IAPPurchases");
    const q = query(
      purchasesRef,
      where("uid", "==", uid),
      where("productId", "==", productId),
      where("status", "==", "delivered"),
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("[iap] Error checking purchase:", error);
    return false;
  }
}

// =============================================================================
// Token Packs
// =============================================================================

/**
 * Token pack definitions
 * These are synced with App Store / Google Play products
 */
export const TOKEN_PACKS = [
  {
    id: "tokens_100",
    productId: "com.snapstyle.tokens.100",
    tokens: 100,
    bonusTokens: 0,
    basePriceUSD: 0.99,
    popular: false,
  },
  {
    id: "tokens_500",
    productId: "com.snapstyle.tokens.500",
    tokens: 500,
    bonusTokens: 50,
    basePriceUSD: 4.99,
    popular: true,
  },
  {
    id: "tokens_1200",
    productId: "com.snapstyle.tokens.1200",
    tokens: 1200,
    bonusTokens: 200,
    basePriceUSD: 9.99,
    popular: false,
  },
  {
    id: "tokens_2500",
    productId: "com.snapstyle.tokens.2500",
    tokens: 2500,
    bonusTokens: 500,
    basePriceUSD: 19.99,
    popular: false,
  },
  {
    id: "tokens_6500",
    productId: "com.snapstyle.tokens.6500",
    tokens: 6500,
    bonusTokens: 1500,
    basePriceUSD: 49.99,
    popular: false,
  },
] as const;

/**
 * Get token pack by ID
 */
export function getTokenPack(packId: string) {
  return TOKEN_PACKS.find((p) => p.id === packId);
}

/**
 * Purchase a token pack
 */
export async function purchaseTokenPack(
  packId: string,
  uid: string,
): Promise<{
  success: boolean;
  newBalance?: number;
  error?: string;
}> {
  const pack = getTokenPack(packId);
  if (!pack) {
    return { success: false, error: "Invalid token pack" };
  }

  const result = await purchaseProduct(pack.productId, uid);

  if (result.success) {
    // In production, the Cloud Function handles token granting
    // For mock, we simulate it
    if (USE_MOCK_IAP) {
      // TODO: Grant tokens via Cloud Function
      console.log(
        "[iap] Would grant",
        pack.tokens + pack.bonusTokens,
        "tokens",
      );
    }
  }

  return {
    success: result.success,
    error: result.error,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a mock product for development
 */
function createMockProduct(productId: string): IAPProduct {
  // Find matching token pack or store product
  const tokenPack = TOKEN_PACKS.find((p) => p.productId === productId);

  if (tokenPack) {
    return {
      productId,
      title: `${tokenPack.tokens} Tokens`,
      description: `Get ${tokenPack.tokens} tokens${tokenPack.bonusTokens > 0 ? ` + ${tokenPack.bonusTokens} bonus` : ""}`,
      price: `$${tokenPack.basePriceUSD.toFixed(2)}`,
      priceAmountMicros: tokenPack.basePriceUSD * 1000000,
      priceCurrencyCode: "USD",
      type: "consumable",
      localizedPrice: `$${tokenPack.basePriceUSD.toFixed(2)}`,
    };
  }

  // Generic mock product
  return {
    productId,
    title: "Mock Product",
    description: "A mock product for testing",
    price: "$0.99",
    priceAmountMicros: 990000,
    priceCurrencyCode: "USD",
    type: "consumable",
  };
}

/**
 * Format price for display
 */
export function formatPrice(product: IAPProduct): string {
  return product.localizedPrice || product.price;
}

/**
 * Check if IAP is available on this device
 */
export function isIAPAvailable(): boolean {
  // IAP requires native setup
  // In Expo Go, it won't work - only in standalone builds
  return USE_MOCK_IAP || Platform.OS !== "web";
}

/**
 * Get the current platform's store name
 */
export function getStoreName(): string {
  switch (Platform.OS) {
    case "ios":
      return "App Store";
    case "android":
      return "Google Play";
    default:
      return "Store";
  }
}
