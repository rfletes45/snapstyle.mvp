/**
 * useSpectator — Unified hook for Colyseus-based spectating
 *
 * Replaces the old useSpectatorMode (Firestore multiplayer) and
 * useLiveSpectatorSession (Firestore single-player) hooks with a
 * single, Colyseus-native implementation.
 *
 * Two modes:
 *
 * 1. **Multiplayer spectating** (mode: "multiplayer-spectator")
 *    The spectator joins the same Colyseus room as the players with
 *    `{ spectator: true }`. The room's base class tracks them in
 *    `state.spectators` and blocks game actions. The spectator receives
 *    the same state patches as players.
 *
 * 2. **Single-player spectating** (mode: "sp-spectator" or "sp-host")
 *    Uses the dedicated `SpectatorRoom`. The host creates the room and
 *    pushes game state via `state_update` messages. Spectators join the
 *    SpectatorRoom and receive gameStateJson updates.
 *
 * Usage (multiplayer — in a game screen):
 * ```ts
 * const { isSpectator, spectatorCount, leaveSpectator } = useSpectator({
 *   mode: "multiplayer-spectator",
 *   room, // from useColyseus
 *   state, // from useColyseus
 * });
 * ```
 *
 * Usage (single-player host — in a single-player game screen):
 * ```ts
 * const { startHosting, updateGameState, endHosting } = useSpectator({
 *   mode: "sp-host",
 *   gameType: "brick_breaker_game",
 * });
 * ```
 *
 * Usage (single-player spectator — in SpectatorViewScreen):
 * ```ts
 * const { connected, gameState, currentScore } = useSpectator({
 *   mode: "sp-spectator",
 *   roomId: route.params.roomId,
 * });
 * ```
 *
 * @see docs/SPECTATOR_SYSTEM_PLAN.md §4.1
 */

import { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { SentInviteRef, updateAllSpectatorInvites } from "@/services/games";

// =============================================================================
// Types
// =============================================================================

export interface SpectatorInfo {
  uid: string;
  sessionId: string;
  displayName: string;
  avatarUrl: string;
  joinedAt: number;
}

/**
 * Multiplayer spectating — spectator joins existing game room.
 * The game screen handles the Colyseus connection; this hook just
 * reads spectator info from the room state.
 */
interface MultiplayerSpectatorParams {
  mode: "multiplayer-spectator";
  /** The Colyseus Room instance (from useColyseus) */
  room: Room | null;
  /** The latest state snapshot (from useColyseus) */
  state: any;
}

/**
 * Single-player host — creates a SpectatorRoom and pushes state.
 */
interface SpHostParams {
  mode: "sp-host";
  /** Game type key for the SpectatorRoom */
  gameType: string;
}

/**
 * Single-player spectator — joins an existing SpectatorRoom.
 */
interface SpSpectatorParams {
  mode: "sp-spectator";
  /** The Colyseus room ID of the SpectatorRoom */
  roomId: string;
}

export type UseSpectatorParams =
  | MultiplayerSpectatorParams
  | SpHostParams
  | SpSpectatorParams;

export interface UseSpectatorReturn {
  /** Whether the current user is spectating (not playing) */
  isSpectator: boolean;

  /** Number of spectators currently watching */
  spectatorCount: number;

  /** List of current spectators */
  spectators: SpectatorInfo[];

  /** Whether connected to the spectator room/session */
  connected: boolean;

  /** Whether currently loading/connecting */
  loading: boolean;

  /** Error message if something went wrong */
  error: string | null;

  // ─── SP Spectator ─────────────────────────────────────────────────────

  /** Parsed game state JSON (SP spectator mode only) */
  gameState: Record<string, unknown> | null;

  /** Host's current score (SP spectator mode only) */
  currentScore: number;

  /** Host's current level (SP spectator mode only) */
  currentLevel: number;

  /** Host's remaining lives (SP spectator mode only) */
  lives: number;

  /** Host's display name (SP spectator mode only) */
  hostName: string;

  /** Game type (SP spectator mode only) */
  gameType: string;

  /** Room phase (SP spectator mode only) */
  phase: string;

  // ─── Actions ──────────────────────────────────────────────────────────

  /** Leave spectator mode (cleans up room connection) */
  leaveSpectator: () => Promise<void>;

  // ─── SP Host Actions ──────────────────────────────────────────────────

  /** Create a SpectatorRoom and start hosting (SP host mode) */
  startHosting: () => Promise<string | null>;

  /** Push game state to spectators (SP host mode) */
  updateGameState: (
    gameStateJson: string,
    score: number,
    level?: number,
    remainingLives?: number,
  ) => void;

  /** Signal game over to spectators (SP host mode) */
  endHosting: (finalScore?: number) => Promise<void>;

  /** The SpectatorRoom ID (SP host mode, for sharing) */
  spectatorRoomId: string | null;

  /** Register a sent spectator invite so it can be updated when the game ends */
  registerInviteMessage: (ref: SentInviteRef) => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useSpectator(params: UseSpectatorParams): UseSpectatorReturn {
  switch (params.mode) {
    case "multiplayer-spectator":
      return useMultiplayerSpectator(params);
    case "sp-host":
      return useSpHost(params);
    case "sp-spectator":
      return useSpSpectator(params);
  }
}

// =============================================================================
// Mode 1: Multiplayer Spectator
// =============================================================================

function useMultiplayerSpectator(
  params: MultiplayerSpectatorParams,
): UseSpectatorReturn {
  const { room, state } = params;

  const spectators: SpectatorInfo[] = (() => {
    if (!state?.spectators) return [];
    try {
      // Colyseus state may be a MapSchema or plain object
      const entries = Object.entries(state.spectators);
      return entries.map(([, v]: [string, any]) => ({
        uid: v.uid || "",
        sessionId: v.sessionId || "",
        displayName: v.displayName || "",
        avatarUrl: v.avatarUrl || "",
        joinedAt: v.joinedAt || 0,
      }));
    } catch {
      return [];
    }
  })();

  const leaveSpectator = useCallback(async () => {
    if (room) {
      try {
        await room.leave();
      } catch {
        // Already left
      }
    }
  }, [room]);

  return {
    isSpectator: true,
    spectatorCount: state?.spectatorCount ?? spectators.length,
    spectators,
    connected: !!room,
    loading: false,
    error: null,
    gameState: null,
    currentScore: 0,
    currentLevel: 1,
    lives: 3,
    hostName: "",
    gameType: state?.gameType ?? "",
    phase: state?.phase ?? "",
    leaveSpectator,
    startHosting: async () => null,
    updateGameState: () => {},
    endHosting: async () => {},
    spectatorRoomId: null,
    registerInviteMessage: () => {},
  };
}

// =============================================================================
// Mode 2: SP Host
// =============================================================================

function useSpHost(params: SpHostParams): UseSpectatorReturn {
  const { gameType } = params;
  const [room, setRoom] = useState<Room | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [spectators, setSpectators] = useState<SpectatorInfo[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const mountedRef = useRef(true);

  // Track sent invite message refs so we can update them when the game ends
  const sentInviteRefs = useRef<SentInviteRef[]>([]);

  const registerInviteMessage = useCallback((ref: SentInviteRef) => {
    sentInviteRefs.current.push(ref);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (roomRef.current) {
        roomRef.current.leave().catch(() => {});
        roomRef.current = null;
      }
    };
  }, []);

  const startHosting = useCallback(async (): Promise<string | null> => {
    if (roomRef.current) return roomRef.current.roomId;

    setLoading(true);
    setError(null);
    try {
      const token = await getFirebaseToken();
      const client = getColyseusClient();
      const newRoom = await client.joinOrCreate("spectator", {
        gameType,
        token,
      });

      if (!mountedRef.current) {
        newRoom.leave().catch(() => {});
        return null;
      }

      roomRef.current = newRoom;
      setRoom(newRoom);
      setRoomId(newRoom.roomId);
      setConnected(true);
      setLoading(false);

      // Listen for state changes (spectator count)
      newRoom.onStateChange((newState: any) => {
        if (!mountedRef.current) return;
        setSpectatorCount(newState.spectatorCount ?? 0);
        const specs = extractSpectators(newState);
        setSpectators(specs);
      });

      newRoom.onLeave(() => {
        if (!mountedRef.current) return;
        setConnected(false);
        roomRef.current = null;
        setRoom(null);
      });

      // Tell the room we're starting
      newRoom.send("start_hosting");

      return newRoom.roomId;
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || "Failed to create spectator room");
        setLoading(false);
      }
      return null;
    }
  }, [gameType]);

  const updateGameState = useCallback(
    (
      gameStateJson: string,
      score: number,
      level?: number,
      remainingLives?: number,
    ) => {
      if (!roomRef.current) return;
      const payload: any = { gameStateJson, currentScore: score };
      if (level !== undefined) payload.currentLevel = level;
      if (remainingLives !== undefined) payload.lives = remainingLives;
      roomRef.current.send("state_update", payload);
    },
    [],
  );

  const endHosting = useCallback(
    async (finalScore?: number) => {
      // Update all sent spectator invite messages to show "finished" state
      // Do this BEFORE checking room — invite updates are Firestore ops and
      // should succeed even if the Colyseus room has already disconnected.
      if (sentInviteRefs.current.length > 0) {
        try {
          await updateAllSpectatorInvites(
            sentInviteRefs.current,
            finalScore ?? 0,
            gameType,
          );
        } catch (err) {
          logger.warn("[useSpectator] Failed to update invite messages:", err);
        }
        sentInviteRefs.current = [];
      }

      if (!roomRef.current) return;
      roomRef.current.send("game_end", { finalScore });

      // Brief delay to let the message propagate before leaving
      await new Promise((r) => setTimeout(r, 500));
      try {
        await roomRef.current.leave();
      } catch {
        // Already left
      }
      if (mountedRef.current) {
        setConnected(false);
        roomRef.current = null;
        setRoom(null);
      }
    },
    [gameType],
  );

  const leaveSpectator = useCallback(async () => {
    await endHosting();
  }, [endHosting]);

  return {
    isSpectator: false,
    spectatorCount,
    spectators,
    connected,
    loading,
    error,
    gameState: null,
    currentScore: 0,
    currentLevel: 1,
    lives: 3,
    hostName: "",
    gameType,
    phase: "",
    leaveSpectator,
    startHosting,
    updateGameState,
    endHosting,
    spectatorRoomId: roomId,
    registerInviteMessage,
  };
}

// =============================================================================
// Mode 3: SP Spectator
// =============================================================================

function useSpSpectator(params: SpSpectatorParams): UseSpectatorReturn {
  const { roomId: targetRoomId } = params;

  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [spectators, setSpectators] = useState<SpectatorInfo[]>([]);
  const [gameState, setGameState] = useState<Record<string, unknown> | null>(
    null,
  );
  const [currentScore, setCurrentScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [hostName, setHostName] = useState("");
  const [gameType, setGameType] = useState("");
  const [phase, setPhase] = useState("waiting");

  const roomRef = useRef<Room | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const connect = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getFirebaseToken();
        const client = getColyseusClient();
        const newRoom = await client.joinById(targetRoomId, {
          spectator: true,
          token,
        });

        if (!mountedRef.current) {
          newRoom.leave().catch(() => {});
          return;
        }

        roomRef.current = newRoom;
        setRoom(newRoom);
        setConnected(true);
        setLoading(false);

        newRoom.onStateChange((newState: any) => {
          if (!mountedRef.current) return;
          setSpectatorCount(newState.spectatorCount ?? 0);
          setSpectators(extractSpectators(newState));
          setHostName(newState.hostName ?? "");
          setGameType(newState.gameType ?? "");
          setPhase(newState.phase ?? "");
          setCurrentScore(newState.currentScore ?? 0);
          setCurrentLevel(newState.currentLevel ?? 1);
          setLives(newState.lives ?? 3);
          if (newState.gameStateJson) {
            try {
              setGameState(JSON.parse(newState.gameStateJson));
            } catch {
              // Invalid JSON — keep previous state
            }
          }
        });

        newRoom.onMessage("host_left", () => {
          if (!mountedRef.current) return;
          setPhase("finished");
          setError("Host left the game");
        });

        newRoom.onLeave(() => {
          if (!mountedRef.current) return;
          setConnected(false);
          roomRef.current = null;
          setRoom(null);
        });
      } catch (err: any) {
        if (mountedRef.current) {
          setError(err.message || "Failed to join spectator room");
          setLoading(false);
        }
      }
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (roomRef.current) {
        roomRef.current.leave().catch(() => {});
        roomRef.current = null;
      }
    };
  }, [targetRoomId]);

  const leaveSpectator = useCallback(async () => {
    if (roomRef.current) {
      try {
        await roomRef.current.leave();
      } catch {
        // Already left
      }
    }
    if (mountedRef.current) {
      setConnected(false);
      roomRef.current = null;
      setRoom(null);
    }
  }, []);

  return {
    isSpectator: true,
    spectatorCount,
    spectators,
    connected,
    loading,
    error,
    gameState,
    currentScore,
    currentLevel,
    lives,
    hostName,
    gameType,
    phase,
    leaveSpectator,
    startHosting: async () => null,
    updateGameState: () => {},
    endHosting: async () => {},
    spectatorRoomId: null,
    registerInviteMessage: () => {},
  };
}

// =============================================================================
// Helpers
// =============================================================================

function extractSpectators(state: any): SpectatorInfo[] {
  if (!state?.spectators) return [];
  try {
    const entries = Object.entries(state.spectators);
    return entries.map(([, v]: [string, any]) => ({
      uid: v.uid || "",
      sessionId: v.sessionId || "",
      displayName: v.displayName || "",
      avatarUrl: v.avatarUrl || "",
      joinedAt: v.joinedAt || 0,
    }));
  } catch {
    return [];
  }
}

import { Client } from "@colyseus/sdk";
import { getAuth } from "firebase/auth";
import { COLYSEUS_SERVER_URL } from "@/config/colyseus";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useSpectator");
async function getFirebaseToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

function getColyseusClient(): Client {
  return new Client(COLYSEUS_SERVER_URL);
}
