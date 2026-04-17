/**
 * useActiveVoiceRooms
 *
 * Discovers currently active voice rooms across all of the user's groups.
 * Queries each group's voice channel via Stream to check for participants.
 * Polls every `interval` ms with AppState-aware pausing.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { useStreamCall } from "@/contexts/StreamCallContext";
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
const DISCOVERY_RETRY_DELAYS_MS = [500, 1000, 2000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getErrorCode(error: unknown): string {
  return String((error as { code?: unknown } | undefined)?.code ?? "")
    .trim()
    .toLowerCase();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error ?? "");
}

function isRetryableDiscoveryError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    code === "permission-denied" ||
    code === "unauthenticated" ||
    code === "unavailable" ||
    code === "network-request-failed" ||
    message.includes("missing or insufficient permissions") ||
    message.includes("permission-denied") ||
    message.includes("unauthenticated") ||
    message.includes("unauthorized") ||
    message.includes("not initialized") ||
    message.includes("network request failed") ||
    message.includes("token")
  );
}

export function useActiveVoiceRooms(
  interval = DEFAULT_INTERVAL,
): UseActiveVoiceRoomsResult {
  const { currentFirebaseUser } = useAuth();
  const { isReady: isStreamReady } = useStreamCall();
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
      if (!isStreamReady) {
        if (mountedRef.current) {
          setLoading(true);
          setErrorMessage(null);
          setHasPartialFailures(false);
        }
        return;
      }
      if (!force && fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        let groups = [] as Awaited<ReturnType<typeof getUserGroups>>;
        for (let attempt = 0; ; attempt += 1) {
          try {
            groups = await getUserGroups(uid);
            break;
          } catch (err) {
            const delayMs = DISCOVERY_RETRY_DELAYS_MS[attempt];
            if (delayMs === undefined || !isRetryableDiscoveryError(err)) {
              throw err;
            }

            if (__DEV__) {
              console.warn(
                `[useActiveVoiceRooms] Group lookup failed during startup, retrying in ${delayMs}ms`,
                err,
              );
            }
            await delay(delayMs);
            if (!mountedRef.current) return;
          }
        }
        if (!mountedRef.current) return;

        const { queryVoiceChannel } =
          require("@/services/stream/voiceChannelService") as typeof import("@/services/stream/voiceChannelService");

        // Check the most recent groups for active voice rooms
        const groupsToCheck = groups.slice(0, MAX_GROUPS_TO_CHECK);

        let results = [] as Array<
          PromiseSettledResult<{
            group: (typeof groupsToCheck)[number];
            result: Awaited<ReturnType<typeof queryVoiceChannel>>;
          }>
        >;

        for (let attempt = 0; ; attempt += 1) {
          results = await Promise.allSettled(
            groupsToCheck.map(async (group) => {
              return {
                group,
                result: await queryVoiceChannel(group.id),
              };
            }),
          );

          if (!mountedRef.current) return;

          const queryErrorCount = results.reduce((count, result) => {
            if (result.status !== "fulfilled") return count + 1;
            return result.value.result.status === "error" ? count + 1 : count;
          }, 0);
          const retryableErrorCount = results.reduce((count, result) => {
            if (result.status !== "fulfilled") {
              return count + (isRetryableDiscoveryError(result.reason) ? 1 : 0);
            }
            if (result.value.result.status !== "error") return count;
            return (
              count +
              (isRetryableDiscoveryError(result.value.result.message) ? 1 : 0)
            );
          }, 0);

          const isFullRetryableFailure =
            groupsToCheck.length > 0 &&
            queryErrorCount === groupsToCheck.length &&
            retryableErrorCount === queryErrorCount;

          const delayMs = DISCOVERY_RETRY_DELAYS_MS[attempt];
          if (!isFullRetryableFailure || delayMs === undefined) {
            break;
          }

          if (__DEV__) {
            console.warn(
              `[useActiveVoiceRooms] Voice room discovery failed during startup, retrying in ${delayMs}ms`,
            );
          }
          await delay(delayMs);
          if (!mountedRef.current) return;
        }

        if (!mountedRef.current) return;

        const active: ActiveVoiceRoom[] = [];
        let queryErrorCount = 0;
        let querySuccessCount = 0;
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

          querySuccessCount += 1;
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

        const isFullyUnavailable =
          queryErrorCount > 0 && querySuccessCount === 0;
        setErrorMessage(
          isFullyUnavailable
            ? "Active rooms are temporarily unavailable."
            : queryErrorCount > 0 && active.length > 0
              ? "Some active room statuses could not be refreshed."
              : null,
        );
        setHasPartialFailures(queryErrorCount > 0 && active.length > 0);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        console.warn(
          "[useActiveVoiceRooms] Failed to refresh active rooms:",
          err,
        );
        if (mountedRef.current) {
          setErrorMessage("Active rooms are temporarily unavailable.");
          setHasPartialFailures(false);
        }
      } finally {
        fetchingRef.current = false;
        if (mountedRef.current) setLoading(false);
      }
    },
    [isStreamReady, uid],
  );

  // Manual refresh always forces a fetch, bypassing the debounce guard
  const refresh = useCallback(() => fetchRooms(true), [fetchRooms]);

  useEffect(() => {
    if (!uid || !CALL_FEATURES.CALLS_ENABLED) {
      setLoading(false);
      return;
    }

    mountedRef.current = true;

    if (!isStreamReady) {
      setLoading(true);
      setErrorMessage(null);
      setHasPartialFailures(false);

      return () => {
        mountedRef.current = false;
      };
    }

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
  }, [uid, interval, fetchRooms, isStreamReady]);

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
