/**
 * useFullProfileData - Hook for fetching complete user profile data
 *
 * Fetches UserProfileData from profileService which includes:
 * - Bio
 * - Status
 * - Profile picture
 * - Avatar decoration
 * - Theme configuration
 * - Privacy settings
 * - And all other profile fields
 *
 * @module hooks/useFullProfileData
 */

import {
  getFullProfileData,
  subscribeToProfile,
} from "@/services/profileService";
import type { UserProfileData } from "@/types/userProfile";
import { useCallback, useEffect, useState } from "react";

export interface UseFullProfileDataOptions {
  /** User ID to fetch profile for */
  userId: string;
  /** Whether to subscribe to real-time updates */
  realtime?: boolean;
}

export interface UseFullProfileDataReturn {
  /** Full profile data */
  profile: UserProfileData | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refresh data */
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching complete user profile data including bio and status
 */
export function useFullProfileData({
  userId,
  realtime = false,
}: UseFullProfileDataOptions): UseFullProfileDataReturn {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await getFullProfileData(userId);
      setProfile(data);
    } catch (err) {
      console.error("[useFullProfileData] Error fetching profile:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch profile"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchData();

    // Set up realtime subscription if requested
    if (realtime) {
      const unsubscribe = subscribeToProfile(userId, (data) => {
        if (data) {
          setProfile(data);
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [userId, realtime, fetchData]);

  // Refresh function
  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    profile,
    isLoading,
    error,
    refresh,
  };
}

export default useFullProfileData;
