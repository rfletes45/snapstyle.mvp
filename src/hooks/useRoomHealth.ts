/**
 * useRoomHealth — Room Liveness Detector
 *
 * Tracks the time since the last Colyseus state patch and raises a
 * recoverable GameError when the room appears stale (no patches for
 * a configurable threshold).
 *
 * Usage:
 *   const health = useRoomHealth(room);
 *   if (health.stale) { show reconnecting banner }
 *
 * The hook does NOT automatically leave / reconnect — it only
 * signals staleness so the parent can decide what to do.
 */

import {
  GameErrorCode,
  createGameError,
  type GameError,
} from "@/types/gameErrors";
import type { Room } from "@colyseus/sdk";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// Config
// =============================================================================

/** Default time (ms) without a state patch before declaring the room stale. */
const DEFAULT_STALE_THRESHOLD_MS = 15_000;

/** How often (ms) we check the last-patch timestamp. */
const CHECK_INTERVAL_MS = 3_000;

// =============================================================================
// Types
// =============================================================================

export interface RoomHealthOptions {
  /** Override the stale threshold (ms). Default: 15 000 */
  staleThresholdMs?: number;
  /** Called when room transitions to stale. */
  onStale?: (error: GameError) => void;
  /** Called when room recovers (patch received after being stale). */
  onRecover?: () => void;
  /** Current room phase — used to pick more specific error codes. */
  roomPhase?: string | null;
}

export interface RoomHealthState {
  /** true when no patches received within the threshold window */
  stale: boolean;
  /** ms since last patch (0 before first patch) */
  msSinceLastPatch: number;
  /** Structured error if stale, null otherwise */
  error: GameError | null;
}

// =============================================================================
// Hook
// =============================================================================

export function useRoomHealth(
  room: Room | null | undefined,
  options: RoomHealthOptions = {},
): RoomHealthState {
  const {
    staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS,
    onStale,
    onRecover,
    roomPhase,
  } = options;

  const [stale, setStale] = useState(false);
  const [msSinceLastPatch, setMsSinceLastPatch] = useState(0);
  const [error, setError] = useState<GameError | null>(null);

  const lastPatchRef = useRef<number>(0);
  const wasStaleRef = useRef(false);
  const onStaleRef = useRef(onStale);
  const onRecoverRef = useRef(onRecover);

  // Keep callback refs current
  onStaleRef.current = onStale;
  onRecoverRef.current = onRecover;

  // Reset when room changes
  useEffect(() => {
    lastPatchRef.current = room ? Date.now() : 0;
    wasStaleRef.current = false;
    setStale(false);
    setMsSinceLastPatch(0);
    setError(null);
  }, [room]);

  // Listen for state changes → update last-patch timestamp
  useEffect(() => {
    if (!room) return;

    const onState = () => {
      lastPatchRef.current = Date.now();
    };

    room.onStateChange(onState);

    // Colyseus SDK doesn't expose a removeListener for onStateChange,
    // so we rely on leaving the room to clean up.
  }, [room]);

  // Periodic check
  useEffect(() => {
    if (!room) return;

    const timer = setInterval(() => {
      if (!lastPatchRef.current) return;

      const elapsed = Date.now() - lastPatchRef.current;
      setMsSinceLastPatch(elapsed);

      const isStale = elapsed >= staleThresholdMs;
      setStale(isStale);

      if (isStale && !wasStaleRef.current) {
        // Transition: healthy → stale
        wasStaleRef.current = true;
        // Use more specific error code when room is actively playing
        const errorCode =
          roomPhase === "playing"
            ? GameErrorCode.ROOM_STALE
            : GameErrorCode.NETWORK_DISCONNECTED;
        const err = createGameError(errorCode, {
          message: `No state patches for ${Math.round(elapsed / 1000)}s — room may be unresponsive`,
          context: { roomId: room.roomId, elapsed },
        });
        setError(err);
        onStaleRef.current?.(err);
      } else if (!isStale && wasStaleRef.current) {
        // Transition: stale → healthy
        wasStaleRef.current = false;
        setError(null);
        onRecoverRef.current?.();
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [room, staleThresholdMs]);

  return { stale, msSinceLastPatch, error };
}
