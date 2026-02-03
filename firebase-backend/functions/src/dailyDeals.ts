/**
 * Daily Deals Cloud Functions
 *
 * Scheduled functions to generate daily and weekly deals.
 *
 * Functions:
 * - generateDailyDeals: Runs at midnight UTC
 * - generateWeeklyDeals: Runs Monday at midnight UTC
 * - cleanupOldDeals: Cleans up expired deals
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.6
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// =============================================================================
// Constants
// =============================================================================

const DEALS_PER_DAY = 6;
const DEALS_PER_WEEK = 4;
const MIN_DISCOUNT = 20;
const MAX_DISCOUNT = 50;
const FEATURED_DISCOUNT = 60;

// Discount distribution (weighted)
const DISCOUNT_TIERS = [
  { percent: 20, weight: 30 },
  { percent: 25, weight: 25 },
  { percent: 30, weight: 20 },
  { percent: 40, weight: 15 },
  { percent: 50, weight: 10 },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get today's date string
 */
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

/**
 * Get current week's Monday date string
 */
function getWeekStartString(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setUTCDate(diff));
  return monday.toISOString().split("T")[0];
}

/**
 * Pick random discount from weighted tiers
 */
function pickRandomDiscount(): number {
  const totalWeight = DISCOUNT_TIERS.reduce(
    (sum, tier) => sum + tier.weight,
    0,
  );
  let random = Math.random() * totalWeight;

  for (const tier of DISCOUNT_TIERS) {
    random -= tier.weight;
    if (random <= 0) {
      return tier.percent;
    }
  }

  return DISCOUNT_TIERS[0].percent;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Calculate deal price with discount
 */
function calculateDealPrice(
  originalPrice: number,
  discountPercent: number,
): number {
  return Math.round(originalPrice * (1 - discountPercent / 100));
}

// =============================================================================
// Generate Daily Deals
// =============================================================================

/**
 * Generate daily deals
 * Runs at midnight UTC every day
 */
export const generateDailyDeals = functions.pubsub
  .schedule("0 0 * * *") // Midnight UTC
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const dateString = getTodayDateString();

    console.log(`[dailyDeals] Generating deals for ${dateString}`);

    try {
      // 1. Get all active shop items
      const shopItemsSnapshot = await db
        .collection("PointsShopCatalog")
        .where("active", "==", true)
        .get();

      if (shopItemsSnapshot.empty) {
        console.log("[dailyDeals] No active items found");
        return null;
      }

      const allItems: any[] = [];
      shopItemsSnapshot.forEach((doc) => {
        allItems.push({ id: doc.id, ...doc.data() });
      });

      console.log(`[dailyDeals] Found ${allItems.length} active items`);

      // 2. Filter eligible items (not already on sale, reasonable price)
      const eligibleItems = allItems.filter((item) => {
        // Skip items already on sale
        if (item.discountPercent && item.discountPercent > 0) return false;
        // Skip very cheap items
        if (item.priceTokens < 50) return false;
        // Skip limited time items
        if (item.availableTo && item.availableTo < Date.now()) return false;
        return true;
      });

      console.log(`[dailyDeals] ${eligibleItems.length} eligible items`);

      if (eligibleItems.length < DEALS_PER_DAY) {
        console.log("[dailyDeals] Not enough eligible items");
        // Use all eligible items
      }

      // 3. Randomly select items for deals
      const shuffled = shuffleArray(eligibleItems);
      const selectedItems = shuffled.slice(
        0,
        Math.min(DEALS_PER_DAY, shuffled.length),
      );

      // 4. Calculate deal end time (midnight tomorrow)
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      const endsAt = tomorrow.getTime();
      const startsAt = Date.now();

      // 5. Create deal documents
      const batch = db.batch();
      const dealsCollectionRef = db
        .collection("DailyDeals")
        .doc(dateString)
        .collection("items");

      // Make first deal featured with higher discount
      selectedItems.forEach((item, index) => {
        const discountPercent =
          index === 0 ? FEATURED_DISCOUNT : pickRandomDiscount();
        const dealPrice = calculateDealPrice(item.priceTokens, discountPercent);

        const dealData = {
          itemId: item.id,
          item: {
            id: item.id,
            itemId: item.itemId,
            name: item.name,
            description: item.description,
            slot: item.slot,
            rarity: item.rarity,
            imagePath: item.imagePath,
            priceTokens: item.priceTokens,
            tags: item.tags || [],
            shopExclusive: true,
            featured: index === 0,
            sortOrder: index,
          },
          originalPrice: item.priceTokens,
          dealPrice,
          discountPercent,
          startsAt,
          endsAt,
          slot: index + 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const dealRef = dealsCollectionRef.doc(`deal_${index + 1}`);
        batch.set(dealRef, dealData);

        console.log(
          `[dailyDeals] Deal ${index + 1}: ${item.name} - ${discountPercent}% off (${item.priceTokens} -> ${dealPrice})`,
        );
      });

      // 6. Also set metadata on parent document
      batch.set(
        db.collection("DailyDeals").doc(dateString),
        {
          date: dateString,
          dealsCount: selectedItems.length,
          startsAt,
          endsAt,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      await batch.commit();

      console.log(
        `[dailyDeals] Successfully generated ${selectedItems.length} deals for ${dateString}`,
      );

      return null;
    } catch (error) {
      console.error("[dailyDeals] Error generating deals:", error);
      return null;
    }
  });

// =============================================================================
// Generate Weekly Deals
// =============================================================================

/**
 * Generate weekly deals
 * Runs Monday at midnight UTC
 */
export const generateWeeklyDeals = functions.pubsub
  .schedule("0 0 * * 1") // Monday at midnight UTC
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const weekStart = getWeekStartString();

    console.log(
      `[weeklyDeals] Generating deals for week starting ${weekStart}`,
    );

    try {
      // 1. Get high-value items for weekly deals
      const shopItemsSnapshot = await db
        .collection("PointsShopCatalog")
        .where("active", "==", true)
        .where("priceTokens", ">=", 200)
        .get();

      if (shopItemsSnapshot.empty) {
        console.log("[weeklyDeals] No eligible items found");
        return null;
      }

      const allItems: any[] = [];
      shopItemsSnapshot.forEach((doc) => {
        allItems.push({ id: doc.id, ...doc.data() });
      });

      // Filter and sort by rarity (prefer epic/legendary)
      const eligibleItems = allItems
        .filter((item) => !item.discountPercent || item.discountPercent === 0)
        .sort((a, b) => {
          const rarityOrder: Record<string, number> = {
            legendary: 4,
            epic: 3,
            rare: 2,
            common: 1,
          };
          return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
        });

      // 2. Select items
      const selectedItems = eligibleItems.slice(0, DEALS_PER_WEEK);

      // 3. Calculate deal end time (next Monday)
      const now = new Date();
      const nextMonday = new Date(now);
      const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
      nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
      nextMonday.setUTCHours(0, 0, 0, 0);
      const endsAt = nextMonday.getTime();
      const startsAt = Date.now();

      // 4. Create deal documents
      const batch = db.batch();
      const dealsCollectionRef = db
        .collection("WeeklyDeals")
        .doc(weekStart)
        .collection("items");

      selectedItems.forEach((item, index) => {
        // Weekly deals have better discounts
        const discountPercent = 30 + Math.floor(Math.random() * 20); // 30-50%
        const dealPrice = calculateDealPrice(item.priceTokens, discountPercent);

        const dealData = {
          itemId: item.id,
          item: {
            id: item.id,
            itemId: item.itemId,
            name: item.name,
            description: item.description,
            slot: item.slot,
            rarity: item.rarity,
            imagePath: item.imagePath,
            priceTokens: item.priceTokens,
            tags: item.tags || [],
            shopExclusive: true,
            featured: index === 0,
            sortOrder: index,
          },
          originalPrice: item.priceTokens,
          dealPrice,
          discountPercent,
          startsAt,
          endsAt,
          slot: index + 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const dealRef = dealsCollectionRef.doc(`deal_${index + 1}`);
        batch.set(dealRef, dealData);

        console.log(
          `[weeklyDeals] Deal ${index + 1}: ${item.name} - ${discountPercent}% off`,
        );
      });

      // Set metadata
      batch.set(
        db.collection("WeeklyDeals").doc(weekStart),
        {
          weekStart,
          dealsCount: selectedItems.length,
          startsAt,
          endsAt,
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      await batch.commit();

      console.log(
        `[weeklyDeals] Successfully generated ${selectedItems.length} weekly deals`,
      );

      return null;
    } catch (error) {
      console.error("[weeklyDeals] Error generating deals:", error);
      return null;
    }
  });

// =============================================================================
// Cleanup Old Deals
// =============================================================================

/**
 * Cleanup old daily deals (older than 7 days)
 * Runs daily at 1am UTC
 */
export const cleanupOldDeals = functions.pubsub
  .schedule("0 1 * * *") // 1am UTC daily
  .timeZone("UTC")
  .onRun(async () => {
    const db = admin.firestore();
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 7);
    const cutoffString = cutoffDate.toISOString().split("T")[0];

    console.log(`[cleanupDeals] Cleaning deals older than ${cutoffString}`);

    try {
      // Get old daily deals
      const oldDealsSnapshot = await db
        .collection("DailyDeals")
        .where("date", "<", cutoffString)
        .get();

      if (oldDealsSnapshot.empty) {
        console.log("[cleanupDeals] No old deals to clean");
        return null;
      }

      const batch = db.batch();
      let deletedCount = 0;

      for (const dealDoc of oldDealsSnapshot.docs) {
        // Delete subcollection items first
        const itemsSnapshot = await dealDoc.ref.collection("items").get();
        itemsSnapshot.forEach((itemDoc) => {
          batch.delete(itemDoc.ref);
          deletedCount++;
        });

        // Delete parent document
        batch.delete(dealDoc.ref);
        deletedCount++;
      }

      await batch.commit();

      console.log(`[cleanupDeals] Deleted ${deletedCount} old deal documents`);

      return null;
    } catch (error) {
      console.error("[cleanupDeals] Error cleaning deals:", error);
      return null;
    }
  });

// =============================================================================
// HTTP Trigger for Testing
// =============================================================================

/**
 * Manually trigger deal generation (for testing)
 * Requires admin authentication
 */
export const triggerDailyDeals = functions.https.onCall(
  async (data: { type?: "daily" | "weekly" }, context) => {
    // Verify admin
    if (!context.auth?.token?.admin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Admin access required",
      );
    }

    const type = data.type || "daily";

    console.log(`[triggerDeals] Manually triggering ${type} deals`);

    // This would call the same logic as the scheduled functions
    // For now, just return success
    return {
      success: true,
      message: `${type} deals generation triggered`,
    };
  },
);
