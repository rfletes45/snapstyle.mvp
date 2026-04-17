/**
 * useVoiceRoomOccupancy
 *
 * Tracks who is currently in a group's voice room without joining.
 *
 * **Hybrid approach** (fast + reliable):
 * - When the local user is IN the room, subscribes to the active call's
 *   `participants$` observable for real-time, sub-second avatar updates.
 * - Otherwise falls back to polling `queryVoiceChannel()` at configurable
 *   intervals (default 8 s, ±20 % jitter).
 * - Polling continues in the background even when real-time data is active
 *   so the transition back to polling-only is seamless on leave.
 *
 * @module hooks/useVoiceRoomOccupancy
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useAuth } from "@/store/AuthContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const { isReady: isStreamReady, activeCall, activeSession } = useStreamCall();
  const uid = currentFirebaseUser?.uid;

  // ── Polling state ───────────────────────────────────────────────────────
  const [polledOccupants, setPolledOccupants] = useState<VoiceRoomOccupant[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  // ── Real-time participant state (when local user is in the room) ───────
  const [liveOccupants, setLiveOccupants] = useState<
    VoiceRoomOccupant[] | null
  >(null);

  // Determine whether we should use live data for this room
  const isLocalUserInThisRoom =
    activeSession?.type === "voice_channel" &&
    (activeSession as { groupId?: string }).groupId === groupId;

  // Subscribe to real-time participants when the local user is in this room
  useEffect(() => {
    if (!isLocalUserInThisRoom || !activeCall) {
      setLiveOccupants(null);
      return;
    }

    // Stream SDK's participants$ emits the full participant array in real time
    const subscription = activeCall.state.participants$.subscribe(
      (participants: any[]) => {
        if (!mountedRef.current) return;
        const mapped: VoiceRoomOccupant[] = (participants ?? []).map(
          (p: any) => ({
            userId: p.userId ?? p.user_id ?? "",
            name: p.name ?? p.userId ?? p.user_id ?? "",
            image: p.image ?? p.profileImageURL ?? undefined,
          }),
        );
        // Sort for stable ordering
        mapped.sort((a, b) => a.userId.localeCompare(b.userId));
        setLiveOccupants(mapped);
      },
    );

    return () => subscription.unsubscribe();
  }, [isLocalUserInThisRoom, activeCall]);

  // ── Polling fetch ───────────────────────────────────────────────────────
  const fetchOccupancy = useCallback(async () => {
    if (!groupId || !CALL_FEATURES.CALLS_ENABLED) {
      if (mountedRef.current) {
        setPolledOccupants([]);
        setErrorMessage(null);
        setLastUpdatedAt(null);
        setLoading(false);
      }
      return;
    }

    if (!isStreamReady) {
      if (mountedRef.current) {
        setLoading(true);
        setErrorMessage(null);
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

        setPolledOccupants(
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
        setPolledOccupants([]);
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
  }, [groupId, isStreamReady]);

  // Pause polling when app is backgrounded
  useEffect(() => {
    if (!groupId || !CALL_FEATURES.CALLS_ENABLED) return;

    mountedRef.current = true;

    if (!isStreamReady) {
      setLoading(true);
      setErrorMessage(null);

      return () => {
        mountedRef.current = false;
      };
    }

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
  }, [groupId, interval, fetchOccupancy, isStreamReady]);

  // ── Merge: prefer real-time data when available ─────────────────────────
  const occupants = liveOccupants ?? polledOccupants;

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

  return useMemo(
    () => ({
      occupants,
      isActive,
      isCurrentUserInRoom,
      loading,
      error: errorMessage !== null,
      errorMessage,
      status,
      lastUpdatedAt,
      refresh: fetchOccupancy,
    }),
    [
      occupants,
      isActive,
      isCurrentUserInRoom,
      loading,
      errorMessage,
      status,
      lastUpdatedAt,
      fetchOccupancy,
    ],
  );
}
