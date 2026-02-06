/**
 * Economy Service
 *
 * Handles:
 * - Reading wallet balance
 * - Transaction history
 * - Real-time balance updates
 *
 * Note: All writes (earning/spending tokens) are handled server-side
 * via Cloud Functions for security and atomicity.
 */

import { Transaction, TransactionType, Wallet } from "@/types/models";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

// =============================================================================
// Constants
// =============================================================================

/** Default starting balance for new users */
const DEFAULT_STARTING_TOKENS = 100;

/** Maximum transactions to fetch in history */
const MAX_TRANSACTION_HISTORY = 50;

// =============================================================================
// Wallet Operations
// =============================================================================

/**
 * Get user's wallet
 * @returns Wallet or null if not found
 */
async function getWallet(uid: string): Promise<Wallet | null> {
  const db = getFirestoreInstance();

  try {
    const walletRef = doc(db, "Wallets", uid);
    const walletDoc = await getDoc(walletRef);

    if (!walletDoc.exists()) {
      console.log("[economy] Wallet not found for user:", uid);
      return null;
    }

    const data = walletDoc.data();
    return {
      uid: walletDoc.id,
      tokensBalance: data.tokensBalance || 0,
      updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
      totalEarned: data.totalEarned || 0,
      totalSpent: data.totalSpent || 0,
    };
  } catch (error) {
    console.error("[economy] Error fetching wallet:", error);
    throw error;
  }
}

/**
 * Subscribe to wallet balance updates in real-time
 * @returns Unsubscribe function
 */
export function subscribeToWallet(
  uid: string,
  onUpdate: (wallet: Wallet | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirestoreInstance();
  const walletRef = doc(db, "Wallets", uid);

  const unsubscribe = onSnapshot(
    walletRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }

      const data = snapshot.data();
      const wallet: Wallet = {
        uid: snapshot.id,
        tokensBalance: data.tokensBalance || 0,
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
        totalEarned: data.totalEarned || 0,
        totalSpent: data.totalSpent || 0,
      };

      onUpdate(wallet);
    },
    (error) => {
      console.error("[economy] Wallet subscription error:", error);
      if (onError) {
        onError(error as Error);
      }
    },
  );

  return unsubscribe;
}

/**
 * Get user's token balance (convenience function)
 * @returns Token balance or 0 if wallet not found
 */
async function getTokenBalance(uid: string): Promise<number> {
  const wallet = await getWallet(uid);
  return wallet?.tokensBalance || 0;
}

// =============================================================================
// Transaction History
// =============================================================================

/**
 * Get user's transaction history
 * @param uid User ID
 * @param type Optional filter by transaction type
 * @param maxResults Maximum results to return
 */
async function getTransactionHistory(
  uid: string,
  type?: TransactionType,
  maxResults: number = MAX_TRANSACTION_HISTORY,
): Promise<Transaction[]> {
  const db = getFirestoreInstance();

  try {
    const transactionsRef = collection(db, "Transactions");
    let q;

    if (type) {
      q = query(
        transactionsRef,
        where("uid", "==", uid),
        where("type", "==", type),
        orderBy("createdAt", "desc"),
        limit(maxResults),
      );
    } else {
      q = query(
        transactionsRef,
        where("uid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(maxResults),
      );
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        type: data.type,
        amount: data.amount,
        reason: data.reason,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
        refId: data.refId,
        refType: data.refType,
        description: data.description,
      } as Transaction;
    });
  } catch (error) {
    console.error("[economy] Error fetching transactions:", error);
    throw error;
  }
}

/**
 * Subscribe to transaction history updates
 * @returns Unsubscribe function
 */
export function subscribeToTransactions(
  uid: string,
  onUpdate: (transactions: Transaction[]) => void,
  maxResults: number = MAX_TRANSACTION_HISTORY,
): () => void {
  const db = getFirestoreInstance();
  const transactionsRef = collection(db, "Transactions");

  const q = query(
    transactionsRef,
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(maxResults),
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const transactions: Transaction[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: data.uid,
          type: data.type,
          amount: data.amount,
          reason: data.reason,
          createdAt: data.createdAt?.toMillis?.() || data.createdAt,
          refId: data.refId,
          refType: data.refType,
          description: data.description,
        } as Transaction;
      });

      onUpdate(transactions);
    },
    (error) => {
      console.error("[economy] Transaction subscription error:", error);
    },
  );

  return unsubscribe;
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Format token amount for display
 */
export function formatTokenAmount(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toLocaleString();
}

/**
 * Get display name for transaction reason
 */
export function getTransactionReasonDisplay(reason: string): string {
  const reasonMap: Record<string, string> = {
    task_reward: "Task Completed",
    achievement_reward: "Achievement Earned",
    daily_bonus: "Daily Bonus",
    streak_bonus: "Streak Bonus",
    shop_purchase: "Shop Purchase",
    admin_grant: "Bonus Tokens",
    refund: "Refund",
  };

  return reasonMap[reason] || reason;
}

/**
 * Get icon for transaction reason
 */
export function getTransactionIcon(reason: string): string {
  const iconMap: Record<string, string> = {
    task_reward: "checkbox-marked-circle",
    achievement_reward: "trophy",
    daily_bonus: "calendar-check",
    streak_bonus: "fire",
    shop_purchase: "shopping",
    admin_grant: "gift",
    refund: "cash-refund",
  };

  return iconMap[reason] || "currency-usd";
}

/**
 * Get color for transaction type
 */
export function getTransactionColor(type: TransactionType): string {
  return type === "earn" ? "#4CAF50" : "#F44336";
}

/**
 * Format transaction amount with sign
 */
export function formatTransactionAmount(
  type: TransactionType,
  amount: number,
): string {
  const sign = type === "earn" ? "+" : "-";
  return `${sign}${formatTokenAmount(amount)}`;
}
