/**
 * useSnakeMultiplayer — Client hook for competitive multiplayer Snake
 *
 * Wraps useColyseus for the Snake game where the server runs the game loop
 * and clients send only direction inputs. Provides:
 *   - Both players' snake segments from server state
 *   - Food positions
 *   - Score tracking
 *   - Direction input sending
 *   - Phase management, reconnection, rematch
 *
 * Usage:
 *   const {
 *     phase, mySnake, opponentSnake, foods, myScore, opponentScore,
 *     sendDirection, sendReady, gridWidth, gridHeight,
 *   } = useSnakeMultiplayer();
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md — Phase 4
 */

import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useColyseus, UseColyseusOptions } from "./useColyseus";
import { useColyseusAppState } from "./useColyseusAppState";

// =============================================================================
// Types
// =============================================================================

export type SnakePhase =
  | "idle"
  | "connecting"
  | "waiting"
  | "countdown"
  | "playing"
  | "finished"
  | "reconnecting";

export interface Segment {
  x: number;
  y: number;
}

export interface SnakeInfo {
  segments: Segment[];
  direction: string;
  alive: boolean;
  length: number;
  score: number;
  displayName: string;
  playerIndex: number;
}

export interface FoodItem {
  x: number;
  y: number;
  value: number;
}

interface SnakeSegmentState {
  x?: number;
  y?: number;
}

interface SnakePlayerState {
  segments?: SnakeSegmentState[] | Record<string, SnakeSegmentState>;
  direction?: SnakeInfo["direction"];
  alive?: boolean;
  length?: number;
  score?: number;
  displayName?: string;
  playerIndex?: number;
}

interface SnakeFoodState {
  x?: number;
  y?: number;
  value?: number;
}

export interface UseSnakeMultiplayerReturn {
  isAvailable: boolean;
  isMultiplayer: boolean;
  phase: SnakePhase;
  countdown: number;

  /** My snake info */
  mySnake: SnakeInfo;
  /** Opponent's snake info */
  opponentSnake: SnakeInfo;
  /** Food items on the grid */
  foods: FoodItem[];

  /** Grid dimensions */
  gridWidth: number;
  gridHeight: number;

  /** Scores */
  myScore: number;
  opponentScore: number;
  myPlayerIndex: number;

  /** Win state */
  isWinner: boolean | null;
  isTie: boolean;
  winReason: string;

  /** Connection state */
  opponentDisconnected: boolean;
  reconnecting: boolean;
  error: string | null;
  connected: boolean;
  room: Room | null;
  rematchRequested: boolean;
  latency: number | null;

  // Actions
  sendDirection: (direction: "up" | "down" | "left" | "right") => void;
  sendReady: () => void;
  sendRematch: () => void;
  acceptRematch: () => void;
  leave: () => Promise<void>;
  startMultiplayer: (roomId?: string) => void;
  stopMultiplayer: () => void;
}

const EMPTY_SNAKE: SnakeInfo = {
  segments: [],
  direction: "right",
  alive: true,
  length: 3,
  score: 0,
  displayName: "",
  playerIndex: -1,
};

// =============================================================================
// Hook
// =============================================================================

export interface UseSnakeMultiplayerOptions {
  /** Firestore game ID from invite flow — used by filterBy to match both players */
  firestoreGameId?: string;
}

export function useSnakeMultiplayer(
  options?: UseSnakeMultiplayerOptions,
): UseSnakeMultiplayerReturn {
  const gameType = "snake_game";
  const firestoreGameId = options?.firestoreGameId;
  const isAvailable =
    !!COLYSEUS_FEATURES.COLYSEUS_ENABLED && !!COLYSEUS_FEATURES.PHYSICS_ENABLED;

  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState<string | undefined>();

  const colyseusOptions: UseColyseusOptions = {
    gameType,
    autoJoin: false,
    roomId: joinRoomId,
    firestoreGameId,
  };

  const {
    room,
    state,
    connected,
    reconnecting,
    error,
    sendMessage,
    joinRoom,
    leaveRoom,
    latency,
  } = useColyseus(colyseusOptions);

  useColyseusAppState(room);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [phase, setPhase] = useState<SnakePhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [mySnake, setMySnake] = useState<SnakeInfo>(EMPTY_SNAKE);
  const [opponentSnake, setOpponentSnake] = useState<SnakeInfo>(EMPTY_SNAKE);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [gridWidth, setGridWidth] = useState(20);
  const [gridHeight, setGridHeight] = useState(20);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [isTie, setIsTie] = useState(false);
  const [winReason, setWinReason] = useState("");
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);

  const mySessionIdRef = useRef<string>("");
  const myUidRef = useRef<string>("");

  // ---------------------------------------------------------------------------
  // State Sync
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!state || !isMultiplayer) return;

    setPhase(state.phase || "waiting");
    setCountdown(state.countdown || 0);
    setGridWidth(state.gridWidth || 20);
    setGridHeight(state.gridHeight || 20);

    // Parse snakes (server schema uses 'snakePlayers')
    const snakeMap = state.snakePlayers || state.snakes;
    if (snakeMap) {
      const entries = Object.entries(snakeMap || {});
      for (const [sessionId, snake] of entries) {
        const s = snake as SnakePlayerState;
        const segments: Segment[] = [];
        if (s.segments) {
          const segs = Array.isArray(s.segments)
            ? s.segments
            : Object.values(s.segments);
          for (const seg of segs) {
            segments.push({ x: seg.x ?? 0, y: seg.y ?? 0 });
          }
        }
        const info: SnakeInfo = {
          segments,
          direction: s.direction || "right",
          alive: s.alive !== false,
          length: s.length || segments.length,
          score: s.score || 0,
          displayName: s.displayName || "Player",
          playerIndex: s.playerIndex ?? -1,
        };

        if (sessionId === mySessionIdRef.current) {
          setMySnake(info);
        } else {
          setOpponentSnake(info);
        }
      }
    }

    // Parse food (server schema uses 'food', fallback to 'foods')
    const foodSource = state.food || state.foods;
    if (foodSource) {
      const foodArr: FoodItem[] = [];
      const rawFoods = Array.isArray(foodSource)
        ? foodSource
        : Object.values(foodSource);
      for (const f of rawFoods) {
        const food = f as SnakeFoodState;
        foodArr.push({
          x: food.x ?? 0,
          y: food.y ?? 0,
          value: food.value || 1,
        });
      }
      setFoods(foodArr);
    }
  }, [state, isMultiplayer]);

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!room || !isMultiplayer) return;

    room.onMessage("welcome", (data: any) => {
      mySessionIdRef.current = data.sessionId;
    });

    room.onMessage("game_over", (data: any) => {
      setPhase("finished");
      setWinReason(data.winReason || "");
      if (data.winReason === "draw") {
        setIsTie(true);
        setIsWinner(null);
      } else {
        setIsTie(false);
        setIsWinner(data.winnerId === myUidRef.current);
      }
    });

    room.onMessage("rematch_request", (data: any) => {
      if (data.fromSessionId !== mySessionIdRef.current) {
        setRematchRequested(true);
      }
    });

    room.onMessage("opponent_reconnecting", () => {
      setOpponentDisconnected(true);
    });

    room.onMessage("opponent_reconnected", () => {
      setOpponentDisconnected(false);
    });
  }, [room, isMultiplayer]);

  // Get UID
  useEffect(() => {
    try {
      const { getAuth } = require("firebase/auth");
      const user = getAuth().currentUser;
      if (user) myUidRef.current = user.uid;
    } catch {}
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const sendDirection = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      sendMessage("input", { direction });
    },
    [sendMessage],
  );

  const sendReady = useCallback(() => sendMessage("ready"), [sendMessage]);

  const sendRematch = useCallback(() => {
    sendMessage("rematch");
    setRematchRequested(false);
  }, [sendMessage]);

  const acceptRematch = useCallback(() => {
    sendMessage("rematch_accept");
    setRematchRequested(false);
    setPhase("waiting");
    setMySnake(EMPTY_SNAKE);
    setOpponentSnake(EMPTY_SNAKE);
    setFoods([]);
    setIsWinner(null);
    setIsTie(false);
  }, [sendMessage]);

  const startMultiplayer = useCallback(
    (roomId?: string) => {
      if (!isAvailable) return;
      setIsMultiplayer(true);
      setPhase("connecting");
      if (roomId) setJoinRoomId(roomId);
      setTimeout(() => joinRoom(), 0);
    },
    [isAvailable, joinRoom],
  );

  const stopMultiplayer = useCallback(async () => {
    await leaveRoom();
    setIsMultiplayer(false);
    setPhase("idle");
    setMySnake(EMPTY_SNAKE);
    setOpponentSnake(EMPTY_SNAKE);
    setFoods([]);
    setIsWinner(null);
    setIsTie(false);
    setRematchRequested(false);
  }, [leaveRoom]);

  useEffect(() => {
    if (!isMultiplayer) return;
    if (reconnecting) setPhase("reconnecting");
    else if (error) setPhase("idle");
  }, [reconnecting, error, isMultiplayer]);

  return {
    isAvailable,
    isMultiplayer,
    phase,
    countdown,
    mySnake,
    opponentSnake,
    foods,
    gridWidth,
    gridHeight,
    myScore: mySnake.score,
    opponentScore: opponentSnake.score,
    myPlayerIndex: mySnake.playerIndex,
    isWinner,
    isTie,
    winReason,
    opponentDisconnected,
    reconnecting,
    error,
    connected,
    room,
    rematchRequested,
    latency,
    sendDirection,
    sendReady,
    sendRematch,
    acceptRematch,
    leave: leaveRoom,
    startMultiplayer,
    stopMultiplayer,
  };
}
