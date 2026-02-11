/**
 * Promotions Service
 *
 * Manages promotional campaigns, sales events, and discount codes.
 *
 * Features:
 * - Get active promotions
 * - Apply promo codes
 * - Track promotion usage
 * - Get promotion eligibility
 * - Real-time promotion updates
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.5
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Promotion } from "@/types/shop";
import { getAuthInstance, getFirestoreInstance } from "./firebase";

// =============================================================================
// Types
// =============================================================================

export interface PromoCode {
  id: string;
  code: string;
  type: "percentage" | "fixed" | "bonus_tokens" | "free_item";
  value: number; // percentage (0-100), fixed discount, or bonus token amount
  freeItemId?: string; // For free_item type
  minPurchase?: number; // Minimum purchase amount to use
  maxDiscount?: number; // Maximum discount cap for percentage codes
  usageLimit?: number; // Total uses allowed
  usageCount: number; // Current usage count
  perUserLimit?: number; // Uses per user
  validFrom: number;
  validTo: number;
  applicableCategories?: string[]; // Empty = all categories
  applicableItems?: string[]; // Empty = all items
  excludedItems?: string[];
  isActive: boolean;
  createdAt: number;
}

export interface UserPromoUsage {
  codeId: string;
  code: string;
  usageCount: number;
  lastUsedAt: number;
}

export interface ApplyPromoResult {
  success: boolean;
  discount?: number;
  bonusTokens?: number;
  freeItem?: {
    id: string;
    name: string;
  };
  message: string;
  code?: PromoCode;
}

// =============================================================================
// Constants
// =============================================================================

export const PROMO_ERROR_MESSAGES = {
  INVALID_CODE: "Invalid promo code",
  EXPIRED: "This promo code has expired",
  NOT_STARTED: "This promo code is not yet active",
  USAGE_LIMIT: "This promo code has reached its usage limit",
  USER_LIMIT: "You've already used this code the maximum number of times",
  MIN_PURCHASE: "Your purchase does not meet the minimum requirement",
  NOT_APPLICABLE: "This code cannot be applied to your current items",
  ALREADY_APPLIED: "A promo code is already applied",
};

// =============================================================================
// Promotion Queries
// =============================================================================

/**
 * Get all active promotions
 */
export async function getActivePromotions(): Promise<Promotion[]> {
  const db = getFirestoreInstance();
  const now = Date.now();

  const promotionsRef = collection(db, "Promotions");
  const q = query(
    promotionsRef,
    where("startsAt", "<=", now),
    where("endsAt", ">=", now),
    orderBy("startsAt", "desc"),
  );

  const snapshot = await getDocs(q);
  const promotions: Promotion[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    promotions.push({
      id: docSnap.id,
      name: data.name,
      description: data.description,
      type: data.type,
      targetType: data.targetType,
      targetIds: data.targetIds,
      targetCategory: data.targetCategory,
      discountType: data.discountType,
      discountValue: data.discountValue,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      bannerImage: data.bannerImage,
      badgeText: data.badgeText,
      usageLimit: data.usageLimit,
      perUserLimit: data.perUserLimit,
    });
  });

  return promotions;
}

/**
 * Get a specific promotion by ID
 */
export async function getPromotion(
  promotionId: string,
): Promise<Promotion | null> {
  const db = getFirestoreInstance();
  const promotionRef = doc(db, "Promotions", promotionId);
  const promotionDoc = await getDoc(promotionRef);

  if (!promotionDoc.exists()) {
    return null;
  }

  const data = promotionDoc.data();
  return {
    id: promotionDoc.id,
    name: data.name,
    description: data.description,
    type: data.type,
    targetType: data.targetType,
    targetIds: data.targetIds,
    targetCategory: data.targetCategory,
    discountType: data.discountType,
    discountValue: data.discountValue,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    bannerImage: data.bannerImage,
    badgeText: data.badgeText,
    usageLimit: data.usageLimit,
    perUserLimit: data.perUserLimit,
  };
}

/**
 * Get featured promotions (for homepage banner)
 */
export async function getFeaturedPromotions(
  count: number = 3,
): Promise<Promotion[]> {
  const db = getFirestoreInstance();
  const now = Date.now();

  const promotionsRef = collection(db, "Promotions");
  const q = query(
    promotionsRef,
    where("startsAt", "<=", now),
    where("endsAt", ">=", now),
    orderBy("startsAt", "desc"),
    limit(count),
  );

  const snapshot = await getDocs(q);
  const promotions: Promotion[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    promotions.push({
      id: docSnap.id,
      name: data.name,
      description: data.description,
      type: data.type,
      targetType: data.targetType,
      targetIds: data.targetIds,
      targetCategory: data.targetCategory,
      discountType: data.discountType,
      discountValue: data.discountValue,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      bannerImage: data.bannerImage,
      badgeText: data.badgeText,
      usageLimit: data.usageLimit,
      perUserLimit: data.perUserLimit,
    });
  });

  return promotions;
}

/**
 * Subscribe to active promotions
 */
export function subscribeToPromotions(
  callback: (promotions: Promotion[]) => void,
): () => void {
  const db = getFirestoreInstance();
  const now = Date.now();

  const promotionsRef = collection(db, "Promotions");
  const q = query(
    promotionsRef,
    where("startsAt", "<=", now),
    orderBy("startsAt", "desc"),
  );

  return onSnapshot(q, (snapshot) => {
    const currentTime = Date.now();
    const promotions: Promotion[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Filter out expired ones client-side (can't do two range queries)
      if (data.endsAt >= currentTime) {
        promotions.push({
          id: docSnap.id,
          name: data.name,
          description: data.description,
          type: data.type,
          targetType: data.targetType,
          targetIds: data.targetIds,
          targetCategory: data.targetCategory,
          discountType: data.discountType,
          discountValue: data.discountValue,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          bannerImage: data.bannerImage,
          badgeText: data.badgeText,
          usageLimit: data.usageLimit,
          perUserLimit: data.perUserLimit,
        });
      }
    });

    callback(promotions);
  });
}

// =============================================================================
// Promo Code Management
// =============================================================================

/**
 * Validate and get promo code details
 */
export async function getPromoCode(code: string): Promise<PromoCode | null> {
  const db = getFirestoreInstance();
  const normalizedCode = code.toUpperCase().trim();

  const codesRef = collection(db, "PromoCodes");
  const q = query(codesRef, where("code", "==", normalizedCode), limit(1));

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();

  return {
    id: docSnap.id,
    code: data.code,
    type: data.type,
    value: data.value,
    freeItemId: data.freeItemId,
    minPurchase: data.minPurchase,
    maxDiscount: data.maxDiscount,
    usageLimit: data.usageLimit,
    usageCount: data.usageCount || 0,
    perUserLimit: data.perUserLimit,
    validFrom: data.validFrom,
    validTo: data.validTo,
    applicableCategories: data.applicableCategories,
    applicableItems: data.applicableItems,
    excludedItems: data.excludedItems,
    isActive: data.isActive,
    createdAt: data.createdAt,
  };
}

/**
 * Get user's usage of a promo code
 */
export async function getUserPromoUsage(
  codeId: string,
): Promise<UserPromoUsage | null> {
  const db = getFirestoreInstance();
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) return null;

  const usageRef = doc(db, "Users", user.uid, "PromoUsage", codeId);
  const usageDoc = await getDoc(usageRef);

  if (!usageDoc.exists()) {
    return null;
  }

  const data = usageDoc.data();
  return {
    codeId: usageDoc.id,
    code: data.code,
    usageCount: data.usageCount || 0,
    lastUsedAt: data.lastUsedAt,
  };
}

/**
 * Apply a promo code to cart/purchase
 */
export async function applyPromoCode(
  code: string,
  cartTotal: number,
  itemIds: string[],
  itemCategories: string[],
): Promise<ApplyPromoResult> {
  const db = getFirestoreInstance();
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) {
    return { success: false, message: "User must be authenticated" };
  }

  // 1. Get the promo code
  const promoCode = await getPromoCode(code);
  if (!promoCode) {
    return { success: false, message: PROMO_ERROR_MESSAGES.INVALID_CODE };
  }

  // 2. Check if active
  if (!promoCode.isActive) {
    return { success: false, message: PROMO_ERROR_MESSAGES.INVALID_CODE };
  }

  // 3. Check validity period
  const now = Date.now();
  if (now < promoCode.validFrom) {
    return { success: false, message: PROMO_ERROR_MESSAGES.NOT_STARTED };
  }
  if (now > promoCode.validTo) {
    return { success: false, message: PROMO_ERROR_MESSAGES.EXPIRED };
  }

  // 4. Check global usage limit
  if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
    return { success: false, message: PROMO_ERROR_MESSAGES.USAGE_LIMIT };
  }

  // 5. Check per-user limit
  if (promoCode.perUserLimit) {
    const userUsage = await getUserPromoUsage(promoCode.id);
    if (userUsage && userUsage.usageCount >= promoCode.perUserLimit) {
      return { success: false, message: PROMO_ERROR_MESSAGES.USER_LIMIT };
    }
  }

  // 6. Check minimum purchase
  if (promoCode.minPurchase && cartTotal < promoCode.minPurchase) {
    return {
      success: false,
      message: `Minimum purchase of ${promoCode.minPurchase} tokens required`,
    };
  }

  // 7. Check applicable items/categories
  if (promoCode.applicableItems && promoCode.applicableItems.length > 0) {
    const hasApplicableItem = itemIds.some((id) =>
      promoCode.applicableItems!.includes(id),
    );
    if (!hasApplicableItem) {
      return { success: false, message: PROMO_ERROR_MESSAGES.NOT_APPLICABLE };
    }
  }

  if (
    promoCode.applicableCategories &&
    promoCode.applicableCategories.length > 0
  ) {
    const hasApplicableCategory = itemCategories.some((cat) =>
      promoCode.applicableCategories!.includes(cat),
    );
    if (!hasApplicableCategory) {
      return { success: false, message: PROMO_ERROR_MESSAGES.NOT_APPLICABLE };
    }
  }

  // 8. Check excluded items
  if (promoCode.excludedItems && promoCode.excludedItems.length > 0) {
    const allExcluded = itemIds.every((id) =>
      promoCode.excludedItems!.includes(id),
    );
    if (allExcluded) {
      return { success: false, message: PROMO_ERROR_MESSAGES.NOT_APPLICABLE };
    }
  }

  // 9. Calculate discount based on type
  let discount = 0;
  let bonusTokens = 0;
  let freeItem: { id: string; name: string } | undefined;

  switch (promoCode.type) {
    case "percentage":
      discount = Math.round(cartTotal * (promoCode.value / 100));
      // Apply max discount cap
      if (promoCode.maxDiscount && discount > promoCode.maxDiscount) {
        discount = promoCode.maxDiscount;
      }
      break;

    case "fixed":
      discount = Math.min(promoCode.value, cartTotal);
      break;

    case "bonus_tokens":
      bonusTokens = promoCode.value;
      break;

    case "free_item":
      if (promoCode.freeItemId) {
        // Get item details
        const itemRef = doc(db, "PointsShopCatalog", promoCode.freeItemId);
        const itemDoc = await getDoc(itemRef);
        if (itemDoc.exists()) {
          freeItem = {
            id: promoCode.freeItemId,
            name: itemDoc.data().name,
          };
        }
      }
      break;
  }

  // Success!
  return {
    success: true,
    discount: discount > 0 ? discount : undefined,
    bonusTokens: bonusTokens > 0 ? bonusTokens : undefined,
    freeItem,
    message: getSuccessMessage(promoCode, discount, bonusTokens),
    code: promoCode,
  };
}

/**
 * Record promo code usage after successful purchase
 */
export async function recordPromoUsage(
  codeId: string,
  code: string,
): Promise<void> {
  const db = getFirestoreInstance();
  const auth = getAuthInstance();
  const user = auth.currentUser;
  if (!user) return;

  // Update global usage count
  const codeRef = doc(db, "PromoCodes", codeId);
  await updateDoc(codeRef, {
    usageCount: increment(1),
    lastUsedAt: Timestamp.now(),
  });

  // Record user's usage
  const usageRef = doc(db, "Users", user.uid, "PromoUsage", codeId);
  const existing = await getDoc(usageRef);

  if (existing.exists()) {
    await updateDoc(usageRef, {
      usageCount: increment(1),
      lastUsedAt: Timestamp.now(),
    });
  } else {
    await setDoc(usageRef, {
      codeId,
      code,
      usageCount: 1,
      lastUsedAt: Timestamp.now(),
    });
  }
}

// =============================================================================
// Promotion Helpers
// =============================================================================

/**
 * Check if a promotion applies to an item
 */
export function promotionApplies(
  promotion: Promotion,
  itemId: string,
  itemCategory?: string,
): boolean {
  // Check target type
  switch (promotion.targetType) {
    case "all":
      return true;

    case "item":
      return promotion.targetIds?.includes(itemId) ?? false;

    case "category":
      return itemCategory === promotion.targetCategory;

    default:
      return false;
  }
}

/**
 * Get the best applicable promotion for an item
 */
export async function getBestPromotion(
  itemId: string,
  itemCategory?: string,
): Promise<Promotion | null> {
  const promotions = await getActivePromotions();

  // Filter applicable promotions
  const applicable = promotions.filter((p) =>
    promotionApplies(p, itemId, itemCategory),
  );

  if (applicable.length === 0) {
    return null;
  }

  // Sort by discount value and return best
  applicable.sort((a, b) => b.discountValue - a.discountValue);

  return applicable[0];
}

/**
 * Calculate discounted price with promotion
 */
export function calculatePromotionPrice(
  originalPrice: number,
  promotion: Promotion,
): number {
  if (promotion.discountType === "percent") {
    return Math.round(originalPrice * (1 - promotion.discountValue / 100));
  }

  // Fixed discount
  return Math.max(0, originalPrice - promotion.discountValue);
}

/**
 * Get time remaining for a promotion
 */
export function getPromotionTimeRemaining(promotion: Promotion): number {
  return Math.max(0, promotion.endsAt - Date.now());
}

/**
 * Format time remaining for display
 */
export function formatPromotionTimeRemaining(promotion: Promotion): string {
  const remaining = getPromotionTimeRemaining(promotion);

  if (remaining <= 0) {
    return "Ended";
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""} left`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
}

/**
 * Check if promotion is ending soon (< 24 hours)
 */
export function isPromotionEndingSoon(promotion: Promotion): boolean {
  const remaining = getPromotionTimeRemaining(promotion);
  return remaining > 0 && remaining < 24 * 60 * 60 * 1000;
}

/**
 * Get promotion badge text
 */
export function getPromotionBadgeText(promotion: Promotion): string {
  // Use the promotion's own badgeText if available
  if (promotion.badgeText) {
    return promotion.badgeText;
  }

  // Generate based on type and discount
  if (promotion.discountType === "percent") {
    return `${promotion.discountValue}% OFF`;
  }

  if (promotion.discountType === "fixed") {
    return `${promotion.discountValue} OFF`;
  }

  // Default by type
  switch (promotion.type) {
    case "flash_sale":
      return "FLASH SALE";
    case "seasonal":
      return "SEASONAL";
    case "bundle_deal":
      return "BUNDLE";
    case "discount":
    default:
      return "PROMO";
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

function getSuccessMessage(
  promoCode: PromoCode,
  discount: number,
  bonusTokens: number,
): string {
  switch (promoCode.type) {
    case "percentage":
      return `${promoCode.value}% discount applied! You save ${discount} tokens`;

    case "fixed":
      return `${discount} tokens discount applied!`;

    case "bonus_tokens":
      return `You'll receive ${bonusTokens} bonus tokens with this purchase!`;

    case "free_item":
      return "Free item will be added to your purchase!";

    default:
      return "Promo code applied successfully!";
  }
}
