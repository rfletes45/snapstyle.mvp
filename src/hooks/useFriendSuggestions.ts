/**
 * useFriendSuggestions — Hook for friend suggestion/recommendation cards
 *
 * @module hooks/useFriendSuggestions
 */

import {
  dismissSuggestion,
  FriendSuggestion,
  getFriendSuggestions,
} from "@/services/suggestions";
import { useAuth } from "@/store/AuthContext";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useState } from "react";

const logger = createLogger("hooks/useFriendSuggestions");

export interface FriendSuggestionsState {
  suggestions: FriendSuggestion[];
  loading: boolean;
  error: string | null;
  dismiss: (targetUid: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFriendSuggestions(): FriendSuggestionsState {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);

    try {
      const result = await getFriendSuggestions(uid);
      setSuggestions(result);
    } catch (err) {
      logger.error("Failed to load suggestions:", err);
      setError("Couldn't load suggestions");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const dismiss = useCallback(
    async (targetUid: string) => {
      if (!uid) return;
      // Optimistic removal
      setSuggestions((prev) => prev.filter((s) => s.uid !== targetUid));
      try {
        await dismissSuggestion(uid, targetUid);
      } catch (err) {
        logger.error("Failed to dismiss suggestion:", err);
        // Refetch to restore state
        loadSuggestions();
      }
    },
    [uid, loadSuggestions],
  );

  return {
    suggestions,
    loading,
    error,
    dismiss,
    refresh: loadSuggestions,
  };
}
