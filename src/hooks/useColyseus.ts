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

import { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { colyseusService, JoinOptions } from "@/services/colyseus";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useColyseus");
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
  options = {},
  firestoreGameId,
  autoJoin = true,
  roomId,
}: UseColyseusOptions): UseColyseusReturn {
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const roomRef = useRef<Room | null>(null);
  const mountedRef = useRef(true);

  // ===========================================================================
  // Join Room
  // ===========================================================================

  const joinRoom = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      setError(null);
      setReconnecting(false);

      let newRoom: Room;

      if (firestoreGameId) {
        // Invite flow: both players joinOrCreate with same firestoreGameId.
        // Server rooms use filterBy(["firestoreGameId"]) so Colyseus
        // matches them into the same room instance.
        newRoom = await colyseusService.restoreGame(gameType, firestoreGameId, {
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
            }
          },
          onError: (code, message) => {
            if (mountedRef.current) {
              setError(`Error ${code}: ${message}`);
            }
          },
        });
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

        // Measure initial latency
        colyseusService.getLatency().then((ms) => {
          if (mountedRef.current) setLatency(ms);
        });
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || "Failed to join room");
        logger.error("[useColyseus] Join failed:", err);
      }
    }
  }, [gameType, options, firestoreGameId, roomId]);

  // ===========================================================================
  // Leave Room
  // ===========================================================================

  const leaveRoom = useCallback(async () => {
    await colyseusService.leaveRoom();
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
