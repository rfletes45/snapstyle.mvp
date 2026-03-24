/**
 * useVoiceRoomOccupancy
 *
 * Tracks who is currently in a group's voice room without joining.
 * Uses Stream's call.get() to read participant state with configurable
 * refresh interval. Returns occupant list, active state, and whether
 * the current user is in the room.
 *
 * @module hooks/useVoiceRoomOccupancy
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { queryVoiceChannel } from "@/services/stream/voiceChannelService";
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
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOccupancy = useCallback(async () => {
    if (!groupId || !CALL_FEATURES.CALLS_ENABLED) return;

    try {
      const call = await queryVoiceChannel(groupId);
      if (!mountedRef.current) return;

      if (call) {
        const participants = call.state.participants ?? [];
        // Stable ordering: sort by join time (participant.joinedAt) then by userId
        const sorted = [...participants].sort((a, b) => {
          const aTime = (a as any).joinedAt?.getTime?.() ?? 0;
          const bTime = (b as any).joinedAt?.getTime?.() ?? 0;
          if (aTime !== bTime) return aTime - bTime;
          return a.userId.localeCompare(b.userId);
        });

        setOccupants(
          sorted.map((p) => ({
            userId: p.userId,
            name: p.name || p.userId,
            image: (p as any).image || undefined,
          })),
        );
      } else {
        setOccupants([]);
      }
    } catch {
      // Swallow errors — voice room may not exist yet
      if (mountedRef.current) setOccupants([]);
    }
  }, [groupId]);

  // Pause polling when app is backgrounded
  useEffect(() => {
    if (!groupId || !CALL_FEATURES.CALLS_ENABLED) return;

    mountedRef.current = true;

    // Initial fetch
    fetchOccupancy();

    // Start interval
    intervalRef.current = setInterval(fetchOccupancy, interval);

    // Pause/resume on app state changes
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        fetchOccupancy();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(fetchOccupancy, interval);
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

  return { occupants, isActive, isCurrentUserInRoom, refresh: fetchOccupancy };
}
