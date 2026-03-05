/**
 * Games V4 — useGameStatsV4 Hook
 *
 * Provides personal best, global stats, and game history for the current user.
 * Used by the Game Stats screen and profile integration.
 *
 * @module gamesV4/hooks/useGameStatsV4
 */

import {
  AchievementEntryV4,
  fetchAchievements,
  fetchAllGamePBs,
  fetchGameHistory,
  fetchUserStatsCache,
  GamePBV4,
  subscribeToGamePB,
} from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types/common";
import type { GameResultV4 } from "@/gamesV4/types/result";
import { useAuth } from "@/store/AuthContext";
import { useCallback, useEffect, useState } from "react";

interface GlobalStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

interface UseGameStatsV4Result {
  /** All personal bests across games. */
  pbs: GamePBV4[];
  /** Global stats (games played, won, win rate). */
  globalStats: GlobalStats | null;
  /** Recent game history (last 20). */
  history: GameResultV4[];
  /** All earned achievements. */
  achievements: AchievementEntryV4[];
  /** Loading state. */
  loading: boolean;
  /** Error message. */
  error: string | null;
  /** Refresh all data. */
  refresh: () => void;
}

export function useGameStatsV4(): UseGameStatsV4Result {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [pbs, setPbs] = useState<GamePBV4[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [history, setHistory] = useState<GameResultV4[]>([]);
  const [achievements, setAchievements] = useState<AchievementEntryV4[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);

    try {
      const [pbsData, statsData, historyData, achievementsData] =
        await Promise.all([
          fetchAllGamePBs(uid),
          fetchUserStatsCache(uid),
          fetchGameHistory(uid),
          fetchAchievements(uid),
        ]);

      setPbs(pbsData);
      setGlobalStats(statsData);
      setHistory(historyData);
      setAchievements(achievementsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load game stats.",
      );
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return {
    pbs,
    globalStats,
    history,
    achievements,
    loading,
    error,
    refresh: loadAll,
  };
}

/**
 * Hook for subscribing to a single game's PB (live updates).
 */
export function useGamePBV4(gameId: GameId): {
  pb: GamePBV4 | null;
  loading: boolean;
} {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;
  const [pb, setPb] = useState<GamePBV4 | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsub = subscribeToGamePB(uid, gameId, (data) => {
      setPb(data);
      setLoading(false);
    });
    return unsub;
  }, [uid, gameId]);

  return { pb, loading };
}
