/**
 * Games V4 — useLeaderboardV4 Hook
 *
 * Provides live weekly leaderboard data for a specific game.
 * Computes current week key and subscribes to leaderboard entries.
 *
 * @module gamesV4/hooks/useLeaderboardV4
 */

import {
  LeaderboardEntryV4,
  subscribeToLeaderboard,
} from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types/common";
import { useEffect, useState } from "react";

/** Compute ISO week key: "2026-W09" */
function currentWeekKey(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const daysSinceJan4 =
    Math.floor((now.getTime() - jan4.getTime()) / 86400000) + jan4.getDay() - 1;
  const weekNum = Math.ceil(daysSinceJan4 / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

interface UseLeaderboardV4Result {
  entries: LeaderboardEntryV4[];
  weekKey: string;
  loading: boolean;
  error: string | null;
}

export function useLeaderboardV4(
  gameId: GameId,
  weekKeyOverride?: string,
): UseLeaderboardV4Result {
  const weekKey = weekKeyOverride ?? currentWeekKey();
  const [entries, setEntries] = useState<LeaderboardEntryV4[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = subscribeToLeaderboard(
      gameId,
      weekKey,
      (data) => {
        setEntries(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [gameId, weekKey]);

  return { entries, weekKey, loading, error };
}
