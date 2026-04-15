/**
 * useActiveVoiceRooms
 *
 * Discovers currently active voice rooms across all of the user's groups.
 * Queries each group's voice channel via Stream to check for participants.
 * Polls every `interval` ms with AppState-aware pausing.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { getUserGroups } from "@/services/groups";
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
  error: boolean;
  errorMessage: string | null;
  hasPartialFailures: boolean;
  lastUpdatedAt: number | null;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPartialFailures, setHasPartialFailures] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchingRef = useRef(false);

  const fetchRooms = useCallback(
    async (force = false) => {
      if (!uid || !CALL_FEATURES.CALLS_ENABLED) {
        if (mountedRef.current) {
          setRooms([]);
          setErrorMessage(null);
          setHasPartialFailures(false);
          setLastUpdatedAt(null);
          setLoading(false);
        }
        return;
      }
      if (!force && fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        const groups = await getUserGroups(uid);
        if (!mountedRef.current) return;

        const { queryVoiceChannel } =
          require("@/services/stream/voiceChannelService") as typeof import("@/services/stream/voiceChannelService");

        // Check the most recent groups for active voice rooms
        const groupsToCheck = groups.slice(0, MAX_GROUPS_TO_CHECK);

        const results = await Promise.allSettled(
          groupsToCheck.map(async (group) => {
            return {
              group,
              result: await queryVoiceChannel(group.id),
            };
          }),
        );

        if (!mountedRef.current) return;

        const active: ActiveVoiceRoom[] = [];
        let queryErrorCount = 0;
        for (const r of results) {
          if (r.status !== "fulfilled") {
            queryErrorCount += 1;
            continue;
          }

          const { group, result } = r.value;
          if (result.status === "error") {
            queryErrorCount += 1;
            continue;
          }
          if (result.status !== "active") {
            continue;
          }

          const participants = result.state.participants ?? [];
          if (participants.length === 0) continue;

          active.push({
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
          });
        }

        setRooms(active);
        if (queryErrorCount > 0 && __DEV__) {
          console.warn(
            `[useActiveVoiceRooms] ${queryErrorCount} room discovery request(s) failed during refresh`,
          );
        }
        setErrorMessage(
          queryErrorCount > 0
            ? active.length > 0
              ? "Some active room statuses could not be refreshed."
              : "Active rooms are temporarily unavailable."
            : null,
        );
        setHasPartialFailures(queryErrorCount > 0 && active.length > 0);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        console.warn("[useActiveVoiceRooms] Failed to refresh active rooms:", err);
        if (mountedRef.current) {
          setErrorMessage("Active rooms are temporarily unavailable.");
          setHasPartialFailures(false);
        }
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

    // Add jitter (±20%) to prevent synchronized polling storms
    const jitter = interval * (0.8 + Math.random() * 0.4);
    intervalRef.current = setInterval(fetchRooms, jitter);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        fetchRooms();
        if (!intervalRef.current) {
          const resumeJitter = interval * (0.8 + Math.random() * 0.4);
          intervalRef.current = setInterval(fetchRooms, resumeJitter);
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

  return {
    rooms,
    loading,
    error: errorMessage !== null,
    errorMessage,
    hasPartialFailures,
    lastUpdatedAt,
    refresh,
  };
}
