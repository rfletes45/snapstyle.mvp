/**
 * useActiveVoiceRooms
 *
 * Discovers currently active voice rooms across all of the user's groups.
 * Queries each group's voice channel via Stream to check for participants.
 * Polls every `interval` ms with AppState-aware pausing.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { getUserGroups } from "@/services/groups";
import { queryVoiceChannel } from "@/services/stream/voiceChannelService";
import { useAuth } from "@/store/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export interface ActiveVoiceRoom {
  groupId: string;
  groupName: string;
  groupAvatar?: string;
  channelId: string;
  occupants: { userId: string; name: string; image?: string }[];
  occupantCount: number;
}

interface UseActiveVoiceRoomsResult {
  rooms: ActiveVoiceRoom[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const MAX_GROUPS_TO_CHECK = 25;
const DEFAULT_INTERVAL = 15_000;

export function useActiveVoiceRooms(
  interval = DEFAULT_INTERVAL,
): UseActiveVoiceRoomsResult {
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [rooms, setRooms] = useState<ActiveVoiceRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  const fetchRooms = useCallback(
    async (force = false) => {
      if (!uid || !CALL_FEATURES.CALLS_ENABLED) return;
      if (!force && fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        const groups = await getUserGroups(uid);
        if (!mountedRef.current) return;

        // Check the most recent groups for active voice rooms
        const groupsToCheck = groups.slice(0, MAX_GROUPS_TO_CHECK);

        const results = await Promise.allSettled(
          groupsToCheck.map(async (group) => {
            const result = await queryVoiceChannel(group.id);
            if (!result) return null;

            const participants = result.state.participants ?? [];
            if (participants.length === 0) return null;

            return {
              groupId: group.id,
              groupName: group.name,
              groupAvatar: group.avatarUrl,
              channelId: `voice_channel_${group.id}`,
              occupants: participants.map((p) => ({
                userId: p.userId,
                name: p.name || p.userId,
                image: p.image || undefined,
              })),
              occupantCount: participants.length,
            } as ActiveVoiceRoom;
          }),
        );

        if (!mountedRef.current) return;

        const active: ActiveVoiceRoom[] = [];
        for (const r of results) {
          if (r.status === "fulfilled" && r.value !== null) {
            active.push(r.value);
          }
        }

        setRooms(active);
      } catch {
        // Swallow — groups or Stream may not be ready
      } finally {
        fetchingRef.current = false;
        if (mountedRef.current) setLoading(false);
      }
    },
    [uid],
  );

  // Manual refresh always forces a fetch, bypassing the debounce guard
  const refresh = useCallback(() => fetchRooms(true), [fetchRooms]);

  useEffect(() => {
    if (!uid || !CALL_FEATURES.CALLS_ENABLED) {
      setLoading(false);
      return;
    }

    mountedRef.current = true;
    fetchRooms();

    intervalRef.current = setInterval(fetchRooms, interval);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        fetchRooms();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(fetchRooms, interval);
        }
      } else if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
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
  }, [uid, interval, fetchRooms]);

  return { rooms, loading, refresh };
}
