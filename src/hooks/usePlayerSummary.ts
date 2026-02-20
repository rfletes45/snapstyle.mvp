/**
 * usePlayerSummary Hook
 *
 * Composes existing hooks/services to provide a single `PlayerSummary` payload
 * for the Enhanced Games Profile Header.
 *
 * Data sources (all already subscribed by the app):
 * - useProfileData → level, stats, displayName
 * - useProfilePicture → photo URL, decoration
 * - subscribeToWallet → token balance
 * - getTasksWithProgress → daily/monthly summary
 *
 * No new Firestore docs or listeners are introduced — this is a pure
 * client-side composition of existing data.
 *
 * @module hooks/usePlayerSummary
 */

import { subscribeToWallet } from "@/services/economy";
import { getTasksWithProgress } from "@/services/tasks";
import { useAuth } from "@/store/AuthContext";
import type { Wallet } from "@/types/models";
import type {
  CurrencyBalances,
  MiniStats,
  PlayerSummary,
  TasksProgressSummary,
} from "@/types/playerSummary";
import {
  DEFAULT_CURRENCY_BALANCES,
  DEFAULT_MINI_STATS,
  DEFAULT_PLAYER_SUMMARY,
  DEFAULT_TASKS_SUMMARY,
} from "@/types/playerSummary";
import type { LevelInfo } from "@/types/profile";
import { calculateLevelFromXp } from "@/types/profile";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useProfileData } from "./useProfileData";
import { useProfilePicture } from "./useProfilePicture";

import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/usePlayerSummary");

// =============================================================================
// Types
// =============================================================================

export interface UsePlayerSummaryReturn {
  /** The composed summary (always defined — safe defaults) */
  summary: PlayerSummary;
  /** True while initial data is loading */
  loading: boolean;
  /** True if any data source errored */
  error: boolean;
  /** Force refresh all data */
  refresh: () => Promise<void>;
  /** Whether expanded-panel data has been loaded */
  expandedLoaded: boolean;
  /** Trigger loading expanded-panel data (lazy) */
  loadExpanded: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function usePlayerSummary(): UsePlayerSummaryReturn {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  // --- existing hooks ---
  const { levelInfo, stats, loading: profileLoading } = useProfileData(uid);
  const { picture, decoration } = useProfilePicture({
    userId: uid || "",
  });

  // --- wallet (subscribe once) ---
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const unsubWalletRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!uid) {
      setWallet(null);
      setWalletLoading(false);
      return;
    }
    setWalletLoading(true);
    unsubWalletRef.current = subscribeToWallet(
      uid,
      (w) => {
        setWallet(w);
        setWalletLoading(false);
      },
      (err) => {
        logger.warn("[usePlayerSummary] wallet subscription error", err);
        setWalletLoading(false);
      },
    );
    return () => {
      unsubWalletRef.current?.();
      unsubWalletRef.current = null;
    };
  }, [uid]);

  // --- tasks summary (one-shot fetch, refreshable) ---
  const [tasksSummary, setTasksSummary] = useState<TasksProgressSummary>(
    DEFAULT_TASKS_SUMMARY,
  );
  const [tasksLoading, setTasksLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!uid) return;
    try {
      setTasksLoading(true);
      const [dailyTasks, monthlyTasks] = await Promise.all([
        getTasksWithProgress(uid, "daily"),
        getTasksWithProgress(uid, "monthly"),
      ]);

      const dailyCompleted = dailyTasks.filter((t) => t.isCompleted).length;
      const dailyClaimable = dailyTasks.filter((t) => t.canClaim).length;
      const monthlyCompleted = monthlyTasks.filter((t) => t.isCompleted).length;
      const monthlyClaimable = monthlyTasks.filter((t) => t.canClaim).length;

      setTasksSummary({
        daily: {
          completed: dailyCompleted,
          total: dailyTasks.length,
          claimableCount: dailyClaimable,
        },
        monthly: {
          completed: monthlyCompleted,
          total: monthlyTasks.length,
          claimableCount: monthlyClaimable,
          unlockLevel: 0, // no level gate currently
        },
      });
    } catch (err) {
      logger.warn("[usePlayerSummary] task fetch error", err);
    } finally {
      setTasksLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // --- expanded panel data (lazy) ---
  const [expandedLoaded, setExpandedLoaded] = useState(false);
  const [miniStats, setMiniStats] = useState<MiniStats>(DEFAULT_MINI_STATS);

  const loadExpanded = useCallback(() => {
    if (expandedLoaded || !uid) return;
    // Derive mini stats from already-loaded profile stats
    if (stats) {
      setMiniStats({
        matchesToday: 0, // would need a daily counter — safe 0 for now
        winRate: stats.winRate,
        totalTimePlayed: 0, // not tracked in current schema
        currentStreak: stats.currentStreak,
      });
    }
    setExpandedLoaded(true);
  }, [expandedLoaded, uid, stats]);

  // --- compose summary (memoised) ---
  const summary = useMemo<PlayerSummary>(() => {
    if (!uid) {
      return { uid: "", ...DEFAULT_PLAYER_SUMMARY };
    }

    const level: LevelInfo = levelInfo ?? calculateLevelFromXp(0);

    const balances: CurrencyBalances = wallet
      ? {
          coins: wallet.tokensBalance ?? 0,
          gems: 0,
          tickets: 0,
        }
      : DEFAULT_CURRENCY_BALANCES;

    return {
      uid,
      displayName:
        currentFirebaseUser?.displayName ?? DEFAULT_PLAYER_SUMMARY.displayName,
      photoURL: picture?.url ?? null,
      playerTitle: null, // not in current schema
      level,
      balances,
      tasks: tasksSummary,
      equippedDecor: {
        frameId: null,
        auraId: null,
        badgeId: null,
        overlayId: null,
        backplateId: null,
      },
      decorationId: decoration?.decorationId ?? null,
      presence: undefined,
      miniStats: expandedLoaded ? miniStats : undefined,
      activeBoosts: [],
    };
  }, [
    uid,
    currentFirebaseUser?.displayName,
    levelInfo,
    picture?.url,
    decoration?.decorationId,
    wallet,
    tasksSummary,
    expandedLoaded,
    miniStats,
  ]);

  // --- loading ---
  const loading = profileLoading || walletLoading || tasksLoading;

  // --- refresh ---
  const refresh = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  return {
    summary,
    loading,
    error: false,
    refresh,
    expandedLoaded,
    loadExpanded,
  };
}

export default usePlayerSummary;
