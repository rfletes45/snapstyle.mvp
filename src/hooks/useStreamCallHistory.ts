/**
 * useStreamCallHistory
 *
 * Provides real-time call history subscription with filtering.
 * Handles auth timing, empty data, and error states robustly.
 */

import {
  getStreamCallHistory,
  subscribeToStreamCallHistory,
} from "@/services/stream/streamCallHistoryService";
import type {
  CallHistoryFilterType,
  StreamCallHistoryEntry,
} from "@/types/streamCallHistory";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseStreamCallHistoryResult {
  entries: StreamCallHistoryEntry[];
  loading: boolean;
  error: boolean;
  errorMessage: string | null;
  refresh: () => void;
}

export function useStreamCallHistory(
  filterType: CallHistoryFilterType = "all",
  maxResults = 50,
): UseStreamCallHistoryResult {
  const [entries, setEntries] = useState<StreamCallHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch with filter (for non-"all" filters or manual refresh)
  const fetchFiltered = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(false);
    setErrorMessage(null);
    try {
      const data = await getStreamCallHistory({ filterType, maxResults });
      if (mountedRef.current) {
        setEntries(data);
      }
    } catch (err: any) {
      console.error("[useStreamCallHistory] fetch error:", err);
      if (mountedRef.current) {
        setError(true);
        setErrorMessage(err?.message ?? "Failed to load call history");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [filterType, maxResults]);

  // Clear stale entries immediately when filter changes to avoid flash
  useEffect(() => {
    setEntries([]);
    setError(false);
    setErrorMessage(null);

    if (filterType !== "all") {
      // For filtered views, just fetch once (no real-time sub for filtered queries)
      fetchFiltered();
      return;
    }

    // For "all" — use real-time subscription
    setLoading(true);
    const unsub = subscribeToStreamCallHistory(
      (data) => {
        if (mountedRef.current) {
          setEntries(data);
          setLoading(false);
          setError(false);
          setErrorMessage(null);
        }
      },
      maxResults,
      (err) => {
        // Subscription error callback — ensures loading state resolves
        if (mountedRef.current) {
          setLoading(false);
          setError(true);
          setErrorMessage(err?.message ?? "History subscription failed");
        }
      },
    );

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, maxResults]);

  return { entries, loading, error, errorMessage, refresh: fetchFiltered };
}
