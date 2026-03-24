/**
 * useStreamCallHistory
 *
 * Provides real-time call history subscription with filtering.
 */

import {
  getStreamCallHistory,
  subscribeToStreamCallHistory,
} from "@/services/stream/streamCallHistoryService";
import type {
  CallHistoryFilterType,
  StreamCallHistoryEntry,
} from "@/types/streamCallHistory";
import { useCallback, useEffect, useState } from "react";

interface UseStreamCallHistoryResult {
  entries: StreamCallHistoryEntry[];
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

export function useStreamCallHistory(
  filterType: CallHistoryFilterType = "all",
  maxResults = 50,
): UseStreamCallHistoryResult {
  const [entries, setEntries] = useState<StreamCallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Initial fetch with filter (real-time sub doesn't support filters)
  const fetchFiltered = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getStreamCallHistory({ filterType, maxResults });
      setEntries(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filterType, maxResults]);

  // Clear stale entries immediately when filter changes to avoid flash
  useEffect(() => {
    setEntries([]);
    setError(false);

    if (filterType !== "all") {
      // For filtered views, just fetch once (no real-time sub for filtered queries)
      fetchFiltered();
      return;
    }

    // For "all" — use real-time subscription
    setLoading(true);
    const unsub = subscribeToStreamCallHistory((data) => {
      setEntries(data);
      setLoading(false);
    }, maxResults);

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, maxResults]);

  return { entries, loading, error, refresh: fetchFiltered };
}
