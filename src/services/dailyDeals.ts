/**
 * Daily Deals Service
 *
 * Rotating selection of discounted items that change daily.
 *
 * Firestore Collection: DailyDeals/{date}/items/{slot}
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.6
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";

import type { DailyDeal, PointsShopItem } from "@/types/shop";
import { getFirestoreInstance } from "./firebase";

// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "DailyDeals";
const DEALS_PER_DAY = 6;
const REFRESH_HOUR_UTC = 0; // Midnight UTC

// =============================================================================
// Types
// =============================================================================

/**
 * Daily deals response
 */
export interface DailyDealsData {
  deals: DailyDeal[];
  date: string;
  refreshTime: number;
  timeUntilRefresh: number;
}

/**
 * Weekly deals (different from daily)
 */
export interface WeeklyDealsData {
  deals: DailyDeal[];
  weekStart: string;
  refreshTime: number;
  timeUntilRefresh: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get today's date string in YYYY-MM-DD format (UTC)
 */
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

/**
 * Get next refresh timestamp (midnight UTC)
 */
function getNextRefreshTime(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(REFRESH_HOUR_UTC, 0, 0, 0);
  return tomorrow.getTime();
}

/**
 * Get time until next refresh in milliseconds
 */
export function getTimeUntilRefresh(): number {
  return Math.max(0, getNextRefreshTime() - Date.now());
}

/**
 * Format time remaining as string
 */
export function formatTimeUntilRefresh(): string {
  const ms = getTimeUntilRefresh();

  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
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

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get today's daily deals
 */
export async function getDailyDeals(): Promise<DailyDealsData> {
  const db = getFirestoreInstance();
  const dateString = getTodayDateString();

  try {
    const dealsRef = collection(db, COLLECTION_NAME, dateString, "items");
    const q = query(dealsRef, orderBy("slot", "asc"));
    const snapshot = await getDocs(q);

    const deals: DailyDeal[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      deals.push({
        id: docSnap.id,
        itemId: data.itemId,
        item: data.item as PointsShopItem,
        originalPrice: data.originalPrice,
        dealPrice: data.dealPrice,
        discountPercent: data.discountPercent,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        slot: data.slot,
      });
    });

    console.log("[dailyDeals] Fetched", deals.length, "deals for", dateString);

    return {
      deals,
      date: dateString,
      refreshTime: getNextRefreshTime(),
      timeUntilRefresh: getTimeUntilRefresh(),
    };
  } catch (error) {
    console.error("[dailyDeals] Error fetching deals:", error);
    return {
      deals: [],
      date: dateString,
      refreshTime: getNextRefreshTime(),
      timeUntilRefresh: getTimeUntilRefresh(),
    };
  }
}

/**
 * Get a specific deal by ID
 */
export async function getDealById(
  dealId: string,
  date?: string,
): Promise<DailyDeal | null> {
  const db = getFirestoreInstance();
  const dateString = date || getTodayDateString();

  try {
    const dealRef = doc(db, COLLECTION_NAME, dateString, "items", dealId);
    const snapshot = await getDoc(dealRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      id: snapshot.id,
      itemId: data.itemId,
      item: data.item as PointsShopItem,
      originalPrice: data.originalPrice,
      dealPrice: data.dealPrice,
      discountPercent: data.discountPercent,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      slot: data.slot,
    };
  } catch (error) {
    console.error("[dailyDeals] Error fetching deal:", error);
    return null;
  }
}

/**
 * Get weekly deals (longer-running deals)
 */
export async function getWeeklyDeals(): Promise<WeeklyDealsData> {
  const db = getFirestoreInstance();
  const weekStart = getWeekStartString();

  try {
    const dealsRef = collection(db, "WeeklyDeals", weekStart, "items");
    const q = query(dealsRef, orderBy("slot", "asc"));
    const snapshot = await getDocs(q);

    const deals: DailyDeal[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      deals.push({
        id: docSnap.id,
        itemId: data.itemId,
        item: data.item as PointsShopItem,
        originalPrice: data.originalPrice,
        dealPrice: data.dealPrice,
        discountPercent: data.discountPercent,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        slot: data.slot,
      });
    });

    // Calculate time until next Monday
    const now = new Date();
    const nextMonday = new Date(now);
    const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
    nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(0, 0, 0, 0);

    return {
      deals,
      weekStart,
      refreshTime: nextMonday.getTime(),
      timeUntilRefresh: Math.max(0, nextMonday.getTime() - Date.now()),
    };
  } catch (error) {
    console.error("[dailyDeals] Error fetching weekly deals:", error);
    return {
      deals: [],
      weekStart,
      refreshTime: 0,
      timeUntilRefresh: 0,
    };
  }
}

/**
 * Check if there are active deals for today
 */
export async function hasActiveDeals(): Promise<boolean> {
  const data = await getDailyDeals();
  return data.deals.length > 0;
}

/**
 * Get deals count for badge
 */
export async function getDealsCount(): Promise<number> {
  const data = await getDailyDeals();
  return data.deals.length;
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to daily deals updates
 */
export function subscribeToDailyDeals(
  onUpdate: (data: DailyDealsData) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const db = getFirestoreInstance();
  const dateString = getTodayDateString();

  const dealsRef = collection(db, COLLECTION_NAME, dateString, "items");
  const q = query(dealsRef, orderBy("slot", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const deals: DailyDeal[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        deals.push({
          id: docSnap.id,
          itemId: data.itemId,
          item: data.item as PointsShopItem,
          originalPrice: data.originalPrice,
          dealPrice: data.dealPrice,
          discountPercent: data.discountPercent,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          slot: data.slot,
        });
      });

      onUpdate({
        deals,
        date: dateString,
        refreshTime: getNextRefreshTime(),
        timeUntilRefresh: getTimeUntilRefresh(),
      });
    },
    (error) => {
      console.error("[dailyDeals] Subscription error:", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Deal Calculations
// =============================================================================

/**
 * Calculate discounted price
 */
export function calculateDealPrice(
  originalPrice: number,
  discountPercent: number,
): number {
  return Math.round(originalPrice * (1 - discountPercent / 100));
}

/**
 * Calculate discount percentage from prices
 */
export function calculateDiscountPercent(
  originalPrice: number,
  dealPrice: number,
): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - dealPrice) / originalPrice) * 100);
}

/**
 * Check if a deal is still active
 */
export function isDealActive(deal: DailyDeal): boolean {
  const now = Date.now();
  return now >= deal.startsAt && now < deal.endsAt;
}

/**
 * Get deal time remaining
 */
export function getDealTimeRemaining(deal: DailyDeal): number {
  return Math.max(0, deal.endsAt - Date.now());
}

/**
 * Format deal time remaining
 */
export function formatDealTimeRemaining(deal: DailyDeal): string {
  const ms = getDealTimeRemaining(deal);

  if (ms <= 0) {
    return "Expired";
  }

  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
}

// =============================================================================
// Sorting and Filtering
// =============================================================================

/**
 * Sort deals by discount (highest first)
 */
export function sortDealsByDiscount(deals: DailyDeal[]): DailyDeal[] {
  return [...deals].sort((a, b) => b.discountPercent - a.discountPercent);
}

/**
 * Sort deals by price (lowest first)
 */
export function sortDealsByPrice(deals: DailyDeal[]): DailyDeal[] {
  return [...deals].sort((a, b) => a.dealPrice - b.dealPrice);
}

/**
 * Filter deals by minimum discount
 */
export function filterDealsByDiscount(
  deals: DailyDeal[],
  minDiscount: number,
): DailyDeal[] {
  return deals.filter((deal) => deal.discountPercent >= minDiscount);
}

/**
 * Filter deals by price range
 */
export function filterDealsByPrice(
  deals: DailyDeal[],
  minPrice: number,
  maxPrice: number,
): DailyDeal[] {
  return deals.filter(
    (deal) => deal.dealPrice >= minPrice && deal.dealPrice <= maxPrice,
  );
}

/**
 * Get best deal (highest discount)
 */
export function getBestDeal(deals: DailyDeal[]): DailyDeal | null {
  if (deals.length === 0) return null;
  return deals.reduce((best, current) =>
    current.discountPercent > best.discountPercent ? current : best,
  );
}
