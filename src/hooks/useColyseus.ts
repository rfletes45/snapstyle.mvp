/**
 * useColyseus — Core hook for connecting to a Colyseus game room
 *
 * Manages the full lifecycle of a Colyseus room connection:
 * - Joining/creating rooms with Firebase auth
 * - State synchronization with React state
 * - Reconnection handling with UI state
 * - Cleanup on unmount
 *
 * Usage:
 *   const { room, state, connected, reconnecting, sendMessage } = useColyseus({
 *     gameType: "timed_tap_game",
 *     autoJoin: true,
 *   });
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §8.3
 */

import { colyseusService, JoinOptions } from "@/services/colyseus";
import { clearActiveSession, saveActiveSession } from "@/services/gameRecovery";
import type { Room } from "@colyseus/sdk";
import { getAuth } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useColyseus");

// =============================================================================
// Terminal error detection
// =============================================================================

/** Server close codes / error messages that should NOT be retried. */
const TERMINAL_ERROR_PATTERNS = [
  "room is full",
  "already has 2 players",
  "already seated",
  "cannot spectate",
  "game already started",
  "invalid seat",
  "not authorized",
  "authentication failed",
  "protocol rejected",
];

function isTerminalJoinError(err: any): boolean {
  const msg = (err?.message || String(err)).toLowerCase();
  return TERMINAL_ERROR_PATTERNS.some((p) => msg.includes(p));
}

/**
 * Close codes that indicate the room was disposed / game ended server-side.
 * When these fire after a reconnection failure, the user should see a
 * "Game no longer available" message instead of a generic "Connection lost".
 */
const ROOM_DISPOSED_CODES = new Set([
  4001, // Colyseus default "room disposed"
  4010, // Custom: game finished while disconnected
  4100, // Custom: server shutdown
]);

function getDisconnectMessage(code: number): string {
  if (ROOM_DISPOSED_CODES.has(code)) {
    return "Game no longer available";
  }
  return "Connection lost";
}
// =============================================================================
// Types
// =============================================================================

export interface UseColyseusOptions {
  /** Client-side game type key (e.g., "timed_tap_game") */
  gameType: string;

  /** Additional join options (duration, difficulty, etc.) */
  options?: JoinOptions;

  /** Firestore game ID for restoring suspended turn-based games */
  firestoreGameId?: string;

  /** Whether to auto-join on mount (default: true) */
  autoJoin?: boolean;

  /** Colyseus room ID to join directly (for invites) */
  roomId?: string;

  /** Invite ID — used for recovery bookmark (optional) */
  inviteId?: string;

  /** Conversation ID — used for recovery bookmark (optional) */
  conversationId?: string;

  /** Whether this is a turn-based game (for recovery bookmark) */
  isTurnBased?: boolean;
}

export interface UseColyseusReturn {
  /** The Colyseus Room instance (null until connected) */
  room: Room | null;

  /** The latest state snapshot from the server */
  state: any;

  /** Whether currently connected to the room */
  connected: boolean;

  /** Whether currently attempting to reconnect */
  reconnecting: boolean;

  /** Error message if connection failed */
  error: string | null;

  /** Send a message to the server */
  sendMessage: (type: string, payload?: any) => void;

  /** Manually join/rejoin the room */
  joinRoom: () => Promise<void>;

  /** Leave the room gracefully */
  leaveRoom: () => Promise<void>;

  /** Server latency in ms (null if not measured) */
  latency: number | null;
}

// =============================================================================
// Hook
// =============================================================================

export function useColyseus({
  gameType,
  options: rawOptions,
  firestoreGameId,
  autoJoin = true,
  roomId,
  inviteId,
  conversationId,
  isTurnBased = false,
}: UseColyseusOptions): UseColyseusReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const roomRef = useRef<Room | null>(null);
  const mountedRef = useRef(true);
  const joiningRef = useRef(false);
  /** True after a terminal error — blocks all future join attempts. */
  const terminalErrorRef = useRef(false);

  // Stabilize options reference: only change when the JSON representation
  // changes, NOT on every render (default `= {}` creates a new ref).
  const optionsJson = JSON.stringify(rawOptions ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const options: JoinOptions = useMemo(
    () => JSON.parse(optionsJson),
    [optionsJson],
  );

  // ===========================================================================
  // Join Room
  // ===========================================================================

  const joinAttemptRef = useRef(0);

  const joinRoom = useCallback(async () => {
    joinAttemptRef.current++;
    const attempt = joinAttemptRef.current;

    // Block if we already have a connected room
    if (roomRef.current) {
      logger.info(
        `[joinRoom #${attempt}] BLOCKED — room already connected (${roomRef.current.roomId})`,
      );
      return;
    }

    // Block on terminal error — no point retrying "room full" etc.
    if (terminalErrorRef.current) {
      logger.warn(
        `[joinRoom #${attempt}] BLOCKED — terminal error previously hit`,
      );
      return;
    }

    if (!mountedRef.current) {
      logger.warn(`[joinRoom #${attempt}] BLOCKED — unmounted`);
      return;
    }
    // Guard against concurrent joins (React Strict Mode double-mount)
    if (joiningRef.current) {
      logger.warn(`[joinRoom #${attempt}] BLOCKED — already joining`);
      return;
    }
    joiningRef.current = true;

    logger.info(
      `[joinRoom #${attempt}] gameType=${gameType}, firestoreGameId=${firestoreGameId ?? "none"}`,
    );

    try {
      setError(null);
      setReconnecting(false);

      let newRoom: Room;

      if (firestoreGameId) {
        // Invite flow: both players joinOrCreate with same firestoreGameId.
        // Server rooms use filterBy(["firestoreGameId"]) so Colyseus
        // matches them into the same room instance.
        // Pass `options` so extra flags (e.g. spectator) are forwarded.
        newRoom = await colyseusService.restoreGame(
          gameType,
          firestoreGameId,
          {
            onStateChange: (newState) => {
              if (mountedRef.current) setState({ ...newState });
            },
            onDrop: () => {
              if (mountedRef.current) setReconnecting(true);
            },
            onLeave: (code) => {
              if (!mountedRef.current) return;
              const consented = code >= 4000 || code === 1000;
              if (consented) {
                setConnected(false);
                setReconnecting(false);
                roomRef.current = null;
                setRoom(null);
              } else {
                // Non-consented leave — reconnection timed out
                setConnected(false);
                setReconnecting(false);
                setError(getDisconnectMessage(code));
                roomRef.current = null;
                setRoom(null);
              }
            },
            onError: (code, message) => {
              if (mountedRef.current) {
                setError(`Error ${code}: ${message}`);
              }
            },
          },
          options,
        );
      } else if (roomId) {
        // Join existing room by ID (legacy/direct room join)
        newRoom = await colyseusService.joinById(roomId, options, {
          onStateChange: (newState) => {
            if (mountedRef.current) setState({ ...newState });
          },
          onDrop: () => {
            if (mountedRef.current) setReconnecting(true);
          },
          onLeave: (code) => {
            if (!mountedRef.current) return;
            const consented = code >= 4000 || code === 1000;
            if (consented) {
              setConnected(false);
              setReconnecting(false);
              roomRef.current = null;
              setRoom(null);
            } else {
              // Non-consented leave — reconnection timed out
              setConnected(false);
              setReconnecting(false);
              setError(getDisconnectMessage(code));
              roomRef.current = null;
              setRoom(null);
            }
          },
          onError: (code, message) => {
            if (mountedRef.current) setError(`Error ${code}: ${message}`);
          },
        });
      } else {
        // Standard join or create
        newRoom = await colyseusService.joinOrCreate(gameType, options, {
          onStateChange: (newState) => {
            if (mountedRef.current) setState({ ...newState });
          },
          onDrop: () => {
            if (mountedRef.current) setReconnecting(true);
          },
          onLeave: (code) => {
            if (!mountedRef.current) return;
            const consented = code >= 4000 || code === 1000;
            if (consented) {
              setConnected(false);
              setReconnecting(false);
              roomRef.current = null;
              setRoom(null);
            } else {
              // Non-consented leave — reconnection timed out
              setConnected(false);
              setReconnecting(false);
              setError(getDisconnectMessage(code));
              roomRef.current = null;
              setRoom(null);
            }
          },
          onError: (code, message) => {
            if (mountedRef.current) setError(`Error ${code}: ${message}`);
          },
        });
      }

      if (mountedRef.current) {
        roomRef.current = newRoom;
        setRoom(newRoom);
        setConnected(true);

        // Persist recovery bookmark for crash/kill recovery
        if (inviteId) {
          const uid = getAuth().currentUser?.uid;
          if (uid) {
            saveActiveSession({
              inviteId,
              gameType,
              firestoreGameId: firestoreGameId || undefined,
              reconnectionToken: newRoom.reconnectionToken || undefined,
              conversationId: conversationId || undefined,
              isTurnBased,
              userId: uid,
            }).catch(() => {}); // best-effort
          }
        }

        // Measure initial latency
        colyseusService.getLatency().then((ms) => {
          if (mountedRef.current) setLatency(ms);
        });
      }
    } catch (err: any) {
      if (mountedRef.current) {
        const msg = err.message || "Failed to join room";
        setError(msg);
        logger.error(
          `[useColyseus] Join failed (attempt #${joinAttemptRef.current}):`,
          msg,
        );

        // Mark terminal so the retry-effect won't re-fire
        if (isTerminalJoinError(err)) {
          terminalErrorRef.current = true;
          logger.warn("[useColyseus] Terminal join error — no further retries");
        }
      }
    } finally {
      joiningRef.current = false;
    }
  }, [
    gameType,
    options,
    firestoreGameId,
    roomId,
    inviteId,
    conversationId,
    isTurnBased,
  ]);

  // ===========================================================================
  // Leave Room
  // ===========================================================================

  const leaveRoom = useCallback(async () => {
    await colyseusService.leaveRoom();
    // Clear recovery bookmark — user is intentionally leaving.
    // MUST be awaited so callers (e.g. navigateToOrigin) don't race
    // the hub's recovery check against the AsyncStorage removal.
    await clearActiveSession();
    logger.info("[useColyseus] leaveRoom — room left + active session cleared");
    if (mountedRef.current) {
      setRoom(null);
      setConnected(false);
      setState(null);
      roomRef.current = null;
    }
  }, []);

  // ===========================================================================
  // Send Message
  // ===========================================================================

  const sendMessage = useCallback((type: string, payload?: any) => {
    if (roomRef.current) {
      roomRef.current.send(type, payload);
    }
  }, []);

  // ===========================================================================
  // Auto-Join & Cleanup
  // ===========================================================================

  useEffect(() => {
    mountedRef.current = true;

    if (autoJoin) {
      joinRoom();
    }

    return () => {
      mountedRef.current = false;
      // Leave room on unmount
      if (roomRef.current) {
        roomRef.current.leave().catch(() => {});
        roomRef.current = null;
      }
      // Clear the recovery bookmark on unmount.
      // Normal unmount (user navigating away) means the game screen is
      // being torn down — the bookmark should be cleared to prevent a
      // stale "Resume" banner on the hub.  Crash/kill scenarios don't
      // trigger this cleanup, so the bookmark correctly persists for
      // those cases.
      clearActiveSession().catch(() => {
        logger.warn("[useColyseus] unmount — clearActiveSession failed");
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    room,
    state,
    connected,
    reconnecting,
    error,
    sendMessage,
    joinRoom,
    leaveRoom,
    latency,
  };
}
