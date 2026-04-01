/**
 * useStreamCallHistory
 *
 * Provides real-time call history subscription with filtering.
 * Enriches entries with resolved user names and profile pictures
 * from Firestore when the stored values are missing or "Unknown".
 */

import { getCachedProfile } from "@/services/cache/profileCache";
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

/**
 * Enrich call history entries with resolved profile data.
 * For direct calls with "Unknown" names or missing avatars, looks up
 * the user profile from the profile cache (which falls back to Firestore).
 */
async function enrichEntries(
  entries: StreamCallHistoryEntry[],
): Promise<StreamCallHistoryEntry[]> {
  const needsEnrichment = entries.filter(
    (e) =>
      e.otherUserId &&
      (!e.otherUserName || e.otherUserName === "Unknown" || !e.otherUserAvatar),
  );

  if (needsEnrichment.length === 0) return entries;

  // Deduplicate user IDs
  const userIds = [...new Set(needsEnrichment.map((e) => e.otherUserId!))];

  // Resolve profiles in parallel
  const profiles = await Promise.allSettled(
    userIds.map(async (uid) => {
      const profile = await getCachedProfile(uid);
      return { uid, profile };
    }),
  );

  // Build lookup map
  const profileMap = new Map<
    string,
    { name?: string; avatar?: string | null }
  >();
  for (const result of profiles) {
    if (result.status === "fulfilled" && result.value.profile) {
      const p = result.value.profile;
      profileMap.set(result.value.uid, {
        name: p.displayName || p.username || undefined,
        avatar: p.avatar ?? null,
      });
    }
  }

  // Merge resolved data into entries
  return entries.map((entry) => {
    if (!entry.otherUserId || !profileMap.has(entry.otherUserId)) return entry;
    const resolved = profileMap.get(entry.otherUserId)!;
    return {
      ...entry,
      otherUserName:
        entry.otherUserName && entry.otherUserName !== "Unknown"
          ? entry.otherUserName
          : (resolved.name ?? entry.otherUserName),
      otherUserAvatar: entry.otherUserAvatar ?? resolved.avatar ?? null,
    };
  });
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
      const enriched = await enrichEntries(data);
      if (mountedRef.current) {
        setEntries(enriched);
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
      async (data) => {
        if (mountedRef.current) {
          // Enrich with profile data before setting state
          const enriched = await enrichEntries(data).catch(() => data);
          if (mountedRef.current) {
            setEntries(enriched);
            setLoading(false);
            setError(false);
            setErrorMessage(null);
          }
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
