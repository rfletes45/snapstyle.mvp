/**
 * Gifting Service
 *
 * Allows users to purchase items as gifts for friends.
 * Premium shop only (real money purchases).
 *
 * Firestore Collection: Gifts/{giftId}
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.2
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import type { Gift, GiftPurchaseResult, GiftStatus } from "@/types/shop";
import { getFirestoreInstance } from "./firebase";

// =============================================================================
// Constants
// =============================================================================

const COLLECTION_NAME = "Gifts";
const GIFT_EXPIRY_DAYS = 30;
const MAX_MESSAGE_LENGTH = 200;

// =============================================================================
// Types
// =============================================================================

/**
 * Gift creation data
 */
export interface CreateGiftData {
  senderUid: string;
  senderName: string;
  recipientUid: string;
  recipientName: string;
  itemId: string;
  itemType: "tokenPack" | "bundle" | "exclusive";
  itemName: string;
  itemImagePath: string;
  message?: string;
  purchaseId: string;
}

/**
 * Gift open result
 */
export interface GiftOpenResult {
  success: boolean;
  giftId?: string;
  itemsReceived?: string[];
  tokensReceived?: number;
  error?: string;
}

/**
 * Gift summary for user
 */
export interface GiftSummary {
  received: {
    total: number;
    pending: number;
    opened: number;
  };
  sent: {
    total: number;
    delivered: number;
    opened: number;
  };
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Create a gift record after successful purchase
 * Called by Cloud Function after purchase validation
 */
export async function createGiftRecord(
  data: CreateGiftData,
): Promise<GiftPurchaseResult> {
  const db = getFirestoreInstance();

  try {
    // Validate message
    const message =
      data.message?.trim().slice(0, MAX_MESSAGE_LENGTH) ||
      "Enjoy this gift! 🎁";

    // Calculate expiry (30 days from now)
    const now = Date.now();
    const expiresAt = now + GIFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    // Create gift document
    const giftData: Omit<Gift, "id"> = {
      senderUid: data.senderUid,
      senderName: data.senderName,
      recipientUid: data.recipientUid,
      recipientName: data.recipientName,
      itemId: data.itemId,
      itemType: data.itemType,
      itemName: data.itemName,
      itemImagePath: data.itemImagePath,
      message,
      purchaseId: data.purchaseId,
      status: "pending",
      sentAt: now,
      expiresAt,
    };

    const giftsRef = collection(db, COLLECTION_NAME);
    const docRef = await addDoc(giftsRef, {
      ...giftData,
      createdAt: serverTimestamp(),
    });

    console.log("[gifting] Created gift:", docRef.id);

    return {
      success: true,
      giftId: docRef.id,
    };
  } catch (error) {
    console.error("[gifting] Error creating gift:", error);
    return {
      success: false,
      error: "Failed to create gift",
    };
  }
}

/**
 * Mark gift as delivered (called when recipient sees notification)
 */
export async function markGiftDelivered(giftId: string): Promise<boolean> {
  const db = getFirestoreInstance();

  try {
    const giftRef = doc(db, COLLECTION_NAME, giftId);
    await updateDoc(giftRef, {
      status: "delivered",
      deliveredAt: Date.now(),
    });

    console.log("[gifting] Marked gift as delivered:", giftId);
    return true;
  } catch (error) {
    console.error("[gifting] Error marking delivered:", error);
    return false;
  }
}

/**
 * Open a gift and receive its contents
 * Called from Cloud Function for security
 */
export async function openGift(
  uid: string,
  giftId: string,
): Promise<GiftOpenResult> {
  const db = getFirestoreInstance();

  try {
    // Get gift
    const giftRef = doc(db, COLLECTION_NAME, giftId);
    const giftSnap = await getDoc(giftRef);

    if (!giftSnap.exists()) {
      return { success: false, error: "Gift not found" };
    }

    const gift = { id: giftSnap.id, ...giftSnap.data() } as Gift;

    // Verify recipient
    if (gift.recipientUid !== uid) {
      return { success: false, error: "This gift is not for you" };
    }

    // Check if already opened
    if (gift.status === "opened") {
      return { success: false, error: "Gift already opened" };
    }

    // Check if expired
    if (gift.status === "expired" || Date.now() > gift.expiresAt) {
      return { success: false, error: "Gift has expired" };
    }

    // Update gift status
    await updateDoc(giftRef, {
      status: "opened",
      openedAt: Date.now(),
    });

    console.log("[gifting] Opened gift:", giftId);

    // Note: Actual item/token granting happens in Cloud Function
    return {
      success: true,
      giftId,
    };
  } catch (error) {
    console.error("[gifting] Error opening gift:", error);
    return { success: false, error: "Failed to open gift" };
  }
}

/**
 * Get gifts received by user
 */
export async function getReceivedGifts(uid: string): Promise<Gift[]> {
  if (!uid) return [];

  const db = getFirestoreInstance();

  try {
    const giftsRef = collection(db, COLLECTION_NAME);
    const q = query(
      giftsRef,
      where("recipientUid", "==", uid),
      orderBy("sentAt", "desc"),
    );

    const snapshot = await getDocs(q);

    const gifts: Gift[] = [];
    snapshot.forEach((docSnap) => {
      gifts.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as Gift);
    });

    console.log("[gifting] Fetched", gifts.length, "received gifts");
    return gifts;
  } catch (error) {
    console.error("[gifting] Error fetching received gifts:", error);
    return [];
  }
}

/**
 * Get gifts sent by user
 */
export async function getSentGifts(uid: string): Promise<Gift[]> {
  if (!uid) return [];

  const db = getFirestoreInstance();

  try {
    const giftsRef = collection(db, COLLECTION_NAME);
    const q = query(
      giftsRef,
      where("senderUid", "==", uid),
      orderBy("sentAt", "desc"),
    );

    const snapshot = await getDocs(q);

    const gifts: Gift[] = [];
    snapshot.forEach((docSnap) => {
      gifts.push({
        id: docSnap.id,
        ...docSnap.data(),
      } as Gift);
    });

    console.log("[gifting] Fetched", gifts.length, "sent gifts");
    return gifts;
  } catch (error) {
    console.error("[gifting] Error fetching sent gifts:", error);
    return [];
  }
}

/**
 * Get pending (unopened) gifts for user
 */
export async function getPendingGifts(uid: string): Promise<Gift[]> {
  if (!uid) return [];

  const db = getFirestoreInstance();

  try {
    const giftsRef = collection(db, COLLECTION_NAME);
    const q = query(
      giftsRef,
      where("recipientUid", "==", uid),
      where("status", "in", ["pending", "delivered"]),
      orderBy("sentAt", "desc"),
    );

    const snapshot = await getDocs(q);

    const gifts: Gift[] = [];
    const now = Date.now();

    snapshot.forEach((docSnap) => {
      const gift = { id: docSnap.id, ...docSnap.data() } as Gift;
      // Filter out expired gifts
      if (gift.expiresAt > now) {
        gifts.push(gift);
      }
    });

    console.log("[gifting] Fetched", gifts.length, "pending gifts");
    return gifts;
  } catch (error) {
    console.error("[gifting] Error fetching pending gifts:", error);
    return [];
  }
}

/**
 * Get gift by ID
 */
export async function getGiftById(giftId: string): Promise<Gift | null> {
  const db = getFirestoreInstance();

  try {
    const giftRef = doc(db, COLLECTION_NAME, giftId);
    const snapshot = await getDoc(giftRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as Gift;
  } catch (error) {
    console.error("[gifting] Error fetching gift:", error);
    return null;
  }
}

/**
 * Get gift summary for user
 */
export async function getGiftSummary(uid: string): Promise<GiftSummary> {
  const summary: GiftSummary = {
    received: { total: 0, pending: 0, opened: 0 },
    sent: { total: 0, delivered: 0, opened: 0 },
  };

  if (!uid) return summary;

  const db = getFirestoreInstance();

  try {
    // Get received gifts
    const received = await getReceivedGifts(uid);
    summary.received.total = received.length;
    summary.received.pending = received.filter(
      (g) => g.status === "pending" || g.status === "delivered",
    ).length;
    summary.received.opened = received.filter(
      (g) => g.status === "opened",
    ).length;

    // Get sent gifts
    const sent = await getSentGifts(uid);
    summary.sent.total = sent.length;
    summary.sent.delivered = sent.filter(
      (g) => g.status === "delivered" || g.status === "opened",
    ).length;
    summary.sent.opened = sent.filter((g) => g.status === "opened").length;

    return summary;
  } catch (error) {
    console.error("[gifting] Error getting summary:", error);
    return summary;
  }
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to received gifts
 */
export function subscribeToReceivedGifts(
  uid: string,
  onUpdate: (gifts: Gift[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!uid) {
    console.warn("[gifting] Cannot subscribe without uid");
    return () => {};
  }

  const db = getFirestoreInstance();
  const giftsRef = collection(db, COLLECTION_NAME);
  const q = query(
    giftsRef,
    where("recipientUid", "==", uid),
    orderBy("sentAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const gifts: Gift[] = [];
      snapshot.forEach((docSnap) => {
        gifts.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as Gift);
      });
      onUpdate(gifts);
    },
    (error) => {
      console.error("[gifting] Subscription error:", error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to pending gifts (for badge count)
 */
export function subscribeToPendingGifts(
  uid: string,
  onUpdate: (count: number, gifts: Gift[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!uid) {
    console.warn("[gifting] Cannot subscribe without uid");
    return () => {};
  }

  const db = getFirestoreInstance();
  const giftsRef = collection(db, COLLECTION_NAME);
  const q = query(
    giftsRef,
    where("recipientUid", "==", uid),
    where("status", "in", ["pending", "delivered"]),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const gifts: Gift[] = [];

      snapshot.forEach((docSnap) => {
        const gift = { id: docSnap.id, ...docSnap.data() } as Gift;
        if (gift.expiresAt > now) {
          gifts.push(gift);
        }
      });

      onUpdate(gifts.length, gifts);
    },
    (error) => {
      console.error("[gifting] Pending subscription error:", error);
      onError?.(error);
    },
  );
}

/**
 * Subscribe to sent gifts
 */
export function subscribeToSentGifts(
  uid: string,
  onUpdate: (gifts: Gift[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!uid) {
    console.warn("[gifting] Cannot subscribe without uid");
    return () => {};
  }

  const db = getFirestoreInstance();
  const giftsRef = collection(db, COLLECTION_NAME);
  const q = query(
    giftsRef,
    where("senderUid", "==", uid),
    orderBy("sentAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const gifts: Gift[] = [];
      snapshot.forEach((docSnap) => {
        gifts.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as Gift);
      });
      onUpdate(gifts);
    },
    (error) => {
      console.error("[gifting] Sent subscription error:", error);
      onError?.(error);
    },
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a gift has expired
 */
export function isGiftExpired(gift: Gift): boolean {
  return gift.status === "expired" || Date.now() > gift.expiresAt;
}

/**
 * Get time remaining until gift expires
 */
export function getGiftTimeRemaining(gift: Gift): number {
  const remaining = gift.expiresAt - Date.now();
  return Math.max(0, remaining);
}

/**
 * Format time remaining as string
 */
export function formatGiftTimeRemaining(gift: Gift): string {
  const remaining = getGiftTimeRemaining(gift);

  if (remaining <= 0) {
    return "Expired";
  }

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor(
    (remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
  );

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
}

/**
 * Get gift status display text
 */
export function getGiftStatusText(status: GiftStatus): string {
  switch (status) {
    case "pending":
      return "On the way";
    case "delivered":
      return "Waiting to be opened";
    case "opened":
      return "Opened";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

/**
 * Get gift status color
 */
export function getGiftStatusColor(status: GiftStatus): string {
  switch (status) {
    case "pending":
      return "#FFC107"; // Amber
    case "delivered":
      return "#2196F3"; // Blue
    case "opened":
      return "#4CAF50"; // Green
    case "expired":
      return "#9E9E9E"; // Gray
    default:
      return "#9E9E9E";
  }
}
