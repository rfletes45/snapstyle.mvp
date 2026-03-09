/**
 * useWallet — Shared wallet subscription hook.
 *
 * Provides a single source of truth for wallet balance and transaction history
 * that can be consumed by any screen (WalletScreen, AchievementsHub, etc.).
 *
 * Uses real-time Firestore subscriptions so all consumers stay in sync.
 *
 * @module hooks/useWallet
 */

import { subscribeToTransactions, subscribeToWallet } from "@/services/economy";
import { useAuth } from "@/store/AuthContext";
import type { Transaction, Wallet } from "@/types/models";
import { useEffect, useState } from "react";

export interface UseWalletResult {
  /** Current wallet data (null if not loaded yet) */
  wallet: Wallet | null;
  /** Recent transaction history */
  transactions: Transaction[];
  /** True while initial wallet load is in progress */
  loading: boolean;
  /** Error message if subscription failed */
  error: string | null;
}

/**
 * Subscribe to the current user's wallet balance and transaction history.
 *
 * @param includeTransactions - Whether to also subscribe to transaction history (default: false)
 */
export function useWallet(includeTransactions = false): UseWalletResult {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubWallet = subscribeToWallet(
      uid,
      (updatedWallet) => {
        setWallet(updatedWallet);
        setLoading(false);
      },
      (err) => {
        setError("Failed to load wallet");
        setLoading(false);
      },
    );

    let unsubTx: (() => void) | undefined;
    if (includeTransactions) {
      unsubTx = subscribeToTransactions(uid, (updatedTx) => {
        setTransactions(updatedTx);
      });
    }

    return () => {
      unsubWallet();
      unsubTx?.();
    };
  }, [uid, includeTransactions]);

  return { wallet, transactions, loading, error };
}
