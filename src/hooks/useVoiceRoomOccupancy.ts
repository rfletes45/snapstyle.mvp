/**
 * useVoiceRoomOccupancy
 *
 * Tracks who is currently in a group's voice room without joining.
 * Uses the read-only `queryVoiceChannel()` helper to read participant state with configurable
 * refresh interval. Returns occupant list, active state, and whether
 * the current user is in the room.
 *
 * @module hooks/useVoiceRoomOccupancy
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { useAuth } from "@/store/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export interface VoiceRoomOccupant {
  userId: string;
  name: string;
  image?: string;
}

interface UseVoiceRoomOccupancyResult {
  /** List of occupants currently in the voice room */
  occupants: VoiceRoomOccupant[];
  /** Whether the voice room has any participants */
  isActive: boolean;
  /** Whether the current user is in this voice room */
  isCurrentUserInRoom: boolean;
  /** Whether the first occupancy load is still running */
  loading: boolean;
  /** Whether the most recent refresh failed */
  error: boolean;
  /** Human-readable refresh error */
  errorMessage: string | null;
  /** Occupancy state for UI rendering */
  status: "loading" | "active" | "idle" | "error";
  /** Timestamp of the last successful refresh */
  lastUpdatedAt: number | null;
  /** Manual refresh trigger */
  refresh: () => void;
}

/**
 * Hook to observe voice room occupancy for a given group.
 *
 * @param groupId   The group whose voice room to observe
 * @param interval  Refresh interval in ms (default 8000)
 */
export function useVoiceRoomOccupancy(
  groupId: string | undefined,
  interval = 8_000,
): UseVoiceRoomOccupancyResult {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [occupants, setOccupants] = useState<VoiceRoomOccupant[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  const fetchOccupancy = useCallback(async () => {
    if (!groupId || !CALL_FEATURES.CALLS_ENABLED) {
      if (mountedRef.current) {
        setOccupants([]);
        setErrorMessage(null);
        setLastUpdatedAt(null);
        setLoading(false);
      }
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { queryVoiceChannel } =
        require("@/services/stream/voiceChannelService") as typeof import("@/services/stream/voiceChannelService");
      const result = await queryVoiceChannel(groupId);
      if (!mountedRef.current) return;

      if (result.status === "active") {
        const participants = result.state.participants ?? [];
        // Sort by userId for stable ordering
        const sorted = [...participants].sort((a, b) =>
          a.userId.localeCompare(b.userId),
        );

        setOccupants(
          sorted.map((p) => ({
            userId: p.userId,
            name: p.name || p.userId,
            image: p.image,
          })),
        );
        setErrorMessage(null);
        setLastUpdatedAt(Date.now());
      } else if (result.status === "error") {
        console.warn(
          `[useVoiceRoomOccupancy] Failed to refresh occupancy for ${groupId}:`,
          result.message,
        );
        setErrorMessage(result.message || "Voice room status unavailable.");
      } else {
        setOccupants([]);
        setErrorMessage(null);
        setLastUpdatedAt(Date.now());
      }
    } catch (err) {
      console.warn(
        `[useVoiceRoomOccupancy] Unexpected occupancy error for ${groupId}:`,
        err,
      );
      if (mountedRef.current) {
        setErrorMessage("Voice room status unavailable.");
      }
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [groupId]);

  // Pause polling when app is backgrounded
  useEffect(() => {
    if (!groupId || !CALL_FEATURES.CALLS_ENABLED) return;

    mountedRef.current = true;

    // Initial fetch
    fetchOccupancy();

    // Start interval with jitter (±20%) to prevent synchronized polling storms
    const jitter = interval * (0.8 + Math.random() * 0.4);
    intervalRef.current = setInterval(fetchOccupancy, jitter);

    // Pause/resume on app state changes
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        fetchOccupancy();
        if (!intervalRef.current) {
          const resumeJitter = interval * (0.8 + Math.random() * 0.4);
          intervalRef.current = setInterval(fetchOccupancy, resumeJitter);
        }
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    });

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription.remove();
    };
  }, [groupId, interval, fetchOccupancy]);

  const isActive = occupants.length > 0;
  const isCurrentUserInRoom = uid
    ? occupants.some((o) => o.userId === uid)
    : false;
  const status = loading
    ? "loading"
    : errorMessage
      ? "error"
      : isActive
        ? "active"
        : "idle";

  return {
    occupants,
    isActive,
    isCurrentUserInRoom,
    loading,
    error: errorMessage !== null,
    errorMessage,
    status,
    lastUpdatedAt,
    refresh: fetchOccupancy,
  };
}
