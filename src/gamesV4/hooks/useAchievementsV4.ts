/**
 * Games V4 — useAchievementsV4 Hook
 *
 * Live subscription to user's earned achievements.
 *
 * @module gamesV4/hooks/useAchievementsV4
 */

import {
  AchievementEntryV4,
  subscribeToAchievements,
} from "@/gamesV4/services/gameServiceV4";
import { useAuth } from "@/store/AuthContext";
import { useEffect, useState } from "react";

interface UseAchievementsV4Result {
  achievements: AchievementEntryV4[];
  loading: boolean;
  error: string | null;
}

export function useAchievementsV4(): UseAchievementsV4Result {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [achievements, setAchievements] = useState<AchievementEntryV4[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToAchievements(
      uid,
      (data) => {
        setAchievements(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  return { achievements, loading, error };
}
