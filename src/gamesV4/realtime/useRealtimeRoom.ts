/**
 * Games V4 — useRealtimeRoom Hook
 *
 * Primary React hook for connecting to and interacting with a
 * Colyseus-backed realtime game room. Wraps RealtimeRoomClient
 * with lifecycle management, auto-cleanup, and reactive state.
 *
 * Usage:
 *   const { room, gameState, send, connectionStatus, latencyMs } =
 *     useRealtimeRoom<SketchPartyState>(SKETCH_PARTY_CLIENT_DEF, {
 *       sessionId, uid, displayName, token,
 *     });
 *
 * @module gamesV4/realtime/useRealtimeRoom
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Room } from "colyseus.js";
import { RealtimeRoomClient } from "./realtimeClient";
import type {
    ConnectionStatus,
    JoinOptions,
    RealtimeClientDefinition,
    RealtimeRoomContext,
    RoomEventCallback,
} from "./types";

/**
 * Options for the useRealtimeRoom hook.
 */
export interface UseRealtimeRoomOptions extends JoinOptions {
  /** If false, the hook won't auto-connect on mount. Default: true. */
  autoConnect?: boolean;
  /** Callback for lifecycle events. */
  onLifecycle?: RoomEventCallback;
}

/**
 * React hook that manages a RealtimeRoomClient lifecycle.
 *
 * - Auto-connects on mount (unless autoConnect=false)
 * - Auto-disconnects on unmount
 * - Provides reactive state for gameState, connectionStatus, latency
 * - Exposes send() and leave() helpers
 *
 * @param definition Game-specific client definition
 * @param options Join options + hook configuration
 * @returns RealtimeRoomContext for use in the component tree
 */
export function useRealtimeRoom<TState = Record<string, unknown>>(
  definition: RealtimeClientDefinition<TState>,
  options: UseRealtimeRoomOptions,
): RealtimeRoomContext<TState> {
  const {
    sessionId,
    uid,
    displayName,
    token,
    spectator,
    roomName,
    autoConnect = true,
    onLifecycle,
  } = options;

  // ── Reactive state ──
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [gameState, setGameState] = useState<TState>(definition.initialState);
  const [latencyMs, setLatencyMs] = useState(0);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // ── Stable reference to the client instance ──
  const clientRef = useRef<RealtimeRoomClient<TState> | null>(null);
  const mountedRef = useRef(true);
  const connectSeqRef = useRef(0);

  // Memoize join options to avoid unnecessary reconnects
  const joinOptions = useMemo<JoinOptions>(
    () => ({
      sessionId,
      uid,
      displayName,
      token,
      spectator,
      roomName,
    }),
    [sessionId, uid, displayName, token, spectator, roomName],
  );

  // ── Client creation (once per definition) ──
  useEffect(() => {
    mountedRef.current = true;
    const client = new RealtimeRoomClient<TState>(definition);
    clientRef.current = client;

    // Wire subscriptions
    const unsubState = client.onStateChange((state) => {
      if (mountedRef.current) setGameState(state);
    });

    const unsubStatus = client.onStatusChange((status) => {
      if (mountedRef.current) {
        setConnectionStatus(status);
        setReconnectAttempt(client.getReconnectAttempt());
        if (status === "error") {
          setError("Connection error");
        } else if (status === "connected") {
          setError(null);
        }
      }
    });

    const unsubLatency = client.onLatencyChange((ms) => {
      if (mountedRef.current) setLatencyMs(ms);
    });

    const unsubLifecycle = client.onLifecycle((event) => {
      if (mountedRef.current) {
        if (event.type === "connected") {
          setRoom(client.getRoom());
          setError(null);
        } else if (event.type === "disconnected") {
          setRoom(null);
        } else if (event.type === "error") {
          setError(event.reason ?? "Unknown error");
        } else if (event.type === "reconnected") {
          setRoom(client.getRoom());
          setError(null);
        } else if (event.type === "left") {
          setRoom(null);
        }
        onLifecycle?.(event);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubState();
      unsubStatus();
      unsubLatency();
      unsubLifecycle();
      client.destroy();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.gameId]); // Only recreate when game changes

  // ── Auto-connect on mount or when options change ──
  useEffect(() => {
    if (!autoConnect || !clientRef.current) return;

    const client = clientRef.current;
    const seq = ++connectSeqRef.current;
    let cancelled = false;

    // Don't re-join if already connected to the same session
    if (client.isConnected() && client.getRoom()?.sessionId === sessionId) {
      return;
    }

    // Leave existing connection first
    const doConnect = async () => {
      try {
        if (client.getRoom()) {
          await client.leave();
        }
        if (cancelled || seq !== connectSeqRef.current) return;
        await client.join(joinOptions);
        if (cancelled || seq !== connectSeqRef.current) {
          await client.leave();
        }
      } catch (err) {
        if (mountedRef.current && seq === connectSeqRef.current) {
          setError(err instanceof Error ? err.message : String(err));
          setConnectionStatus("error");
        }
      }
    };

    doConnect();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, joinOptions]);

  // ── Action callbacks ──
  const send = useCallback((type: string, payload?: unknown) => {
    clientRef.current?.send(type, payload);
  }, []);

  const doReconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.reconnect();
    }
  }, []);

  const leave = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.leave();
    }
  }, []);

  // Game-specific screens register room message handlers directly
  // from the `room` instance returned by this hook.

  return {
    room,
    connectionStatus,
    phase: mapStatusToPhase(connectionStatus, gameState),
    gameState,
    isSpectator: spectator ?? false,
    reconnectAttempt,
    error,
    latencyMs,
    send,
    reconnect: doReconnect,
    leave,
  };
}

function mapStatusToPhase<TState>(
  status: ConnectionStatus,
  _state: TState,
): RealtimeRoomContext<TState>["phase"] {
  switch (status) {
    case "idle":
    case "connecting":
      return "connecting";
    case "connected":
      return "playing"; // The game screen should refine this based on actual server state
    case "reconnecting":
      return "disconnected";
    case "disconnected":
      return "disconnected";
    case "error":
      return "error";
    default:
      return "connecting";
  }
}
