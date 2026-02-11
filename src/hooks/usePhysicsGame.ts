/**
 * usePhysicsGame — Client hook for server-authoritative physics games
 *
 * Wraps useColyseus for games where the server runs the physics simulation
 * and clients send input (Pong, Air Hockey). Provides:
 *   - Ball position from server state
 *   - Paddle positions (self and opponent)
 *   - Score tracking
 *   - Input sending (normalised 0-1 coordinates)
 *   - Game phase management
 *   - Reconnection / rematch flow
 *
 * Usage:
 *   const {
 *     phase, ball, myPaddle, opponentPaddle,
 *     myScore, opponentScore, sendInput, sendReady,
 *   } = usePhysicsGame({ gameType: "pong_game" });
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

export type PhysicsPhase =
  | "idle"
  | "connecting"
  | "waiting"
  | "countdown"
  | "playing"
  | "finished"
  | "reconnecting";

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
}

export interface PaddleState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhysicsPlayerInfo {
  uid: string;
  displayName: string;
  score: number;
  playerIndex: number;
  connected: boolean;
}

interface PhysicsPaddleState {
  ownerId?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface PhysicsRoomPlayerState {
  score?: number;
  playerIndex?: number;
  displayName?: string;
  connected?: boolean;
}

export interface UsePhysicsGameReturn {
  /** Whether physics multiplayer is available for this game */
  isAvailable: boolean;

  /** Whether we're currently in a multiplayer session */
  isMultiplayer: boolean;

  /** Current game phase */
  phase: PhysicsPhase;

  /** Countdown value (3, 2, 1) */
  countdown: number;

  /** Ball state from server */
  ball: BallState;

  /** My paddle state */
  myPaddle: PaddleState;

  /** Opponent's paddle state */
  opponentPaddle: PaddleState;

  /** My current score */
  myScore: number;

  /** Opponent's current score */
  opponentScore: number;

  /** My player index (0 or 1) */
  myPlayerIndex: number;

  /** Score needed to win */
  scoreToWin: number;

  /** My display name */
  myName: string;

  /** Opponent's name */
  opponentName: string;

  /** Field width (server units) */
  fieldWidth: number;

  /** Field height (server units) */
  fieldHeight: number;

  /** Whether I won (null during play) */
  isWinner: boolean | null;

  /** Whether it's a tie */
  isTie: boolean;

  /** Win reason */
  winReason: string;

  /** Opponent disconnected */
  opponentDisconnected: boolean;

  /** Reconnecting to server */
  reconnecting: boolean;

  /** Connection error */
  error: string | null;

  /** Room connected */
  connected: boolean;

  /** Raw room */
  room: Room | null;
  /** Latest raw room state snapshot */
  rawState: unknown | null;

  /** Rematch requested by opponent */
  rematchRequested: boolean;

  /** Server latency */
  latency: number | null;

  // --- Actions ---

  /** Send input to server (normalised 0-1 x, optional y for Air Hockey) */
  sendInput: (x: number, y?: number, action?: string) => void;

  /** Signal ready */
  sendReady: () => void;

  /** Request rematch */
  sendRematch: () => void;

  /** Accept rematch */
  acceptRematch: () => void;

  /** Leave room */
  leave: () => Promise<void>;

  /** Start multiplayer mode */
  startMultiplayer: (roomId?: string) => void;

  /** Stop multiplayer and return to solo */
  stopMultiplayer: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export interface UsePhysicsGameOptions {
  gameType: string;
  /** Firestore game ID from invite flow — used by filterBy to match both players */
  firestoreGameId?: string;
  spectator?: boolean;
}

export function usePhysicsGame(
  optionsOrGameType: string | UsePhysicsGameOptions,
): UsePhysicsGameReturn {
  // Support both old string signature and new options object
  const { gameType, firestoreGameId, spectator = false } =
    typeof optionsOrGameType === "string"
      ? { gameType: optionsOrGameType, firestoreGameId: undefined, spectator: false }
      : optionsOrGameType;

  // Feature flag check
  const isAvailable =
    !!COLYSEUS_FEATURES.COLYSEUS_ENABLED && !!COLYSEUS_FEATURES.PHYSICS_ENABLED;

  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState<string | undefined>();

  // Only connect when explicitly starting multiplayer
  const colyseusOptions: UseColyseusOptions = {
    gameType,
    autoJoin: false,
    roomId: joinRoomId,
    firestoreGameId,
    options: spectator ? { spectator: true } : undefined,
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

  const [phase, setPhase] = useState<PhysicsPhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [ball, setBall] = useState<BallState>({
    x: 200,
    y: 300,
    vx: 0,
    vy: 0,
    radius: 10,
    speed: 0,
  });
  const [myPaddle, setMyPaddle] = useState<PaddleState>({
    x: 200,
    y: 560,
    width: 80,
    height: 14,
  });
  const [opponentPaddle, setOpponentPaddle] = useState<PaddleState>({
    x: 200,
    y: 40,
    width: 80,
    height: 14,
  });
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [scoreToWin, setScoreToWin] = useState(7);
  const [myName, setMyName] = useState("You");
  const [opponentName, setOpponentName] = useState("Opponent");
  const [fieldWidth, setFieldWidth] = useState(400);
  const [fieldHeight, setFieldHeight] = useState(600);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [isTie, setIsTie] = useState(false);
  const [winReason, setWinReason] = useState("");
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);

  const mySessionIdRef = useRef<string>("");
  const myUidRef = useRef<string>("");

  // ---------------------------------------------------------------------------
  // State Sync from Colyseus
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!state || !isMultiplayer) return;

    setPhase(state.phase || "waiting");
    setCountdown(state.countdown || 0);
    setFieldWidth(state.fieldWidth || 400);
    setFieldHeight(state.fieldHeight || 600);
    setScoreToWin(state.scoreToWin || 7);

    // Ball
    if (state.ball) {
      setBall({
        x: state.ball.x ?? 200,
        y: state.ball.y ?? 300,
        vx: state.ball.vx ?? 0,
        vy: state.ball.vy ?? 0,
        radius: state.ball.radius ?? 10,
        speed: state.ball.speed ?? 0,
      });
    }

    // Paddles — find mine vs opponent's
    if (state.paddles) {
      const entries = Object.entries(state.paddles || {});
      for (const [_key, paddle] of entries) {
        const p = paddle as PhysicsPaddleState;
        if (p.ownerId === mySessionIdRef.current) {
          setMyPaddle({
            x: p.x ?? 200,
            y: p.y ?? 560,
            width: p.width ?? 80,
            height: p.height ?? 14,
          });
        } else {
          setOpponentPaddle({
            x: p.x ?? 200,
            y: p.y ?? 40,
            width: p.width ?? 80,
            height: p.height ?? 14,
          });
        }
      }
    }

    // Players — find my score vs opponent score
    if (state.players) {
      const entries = Object.entries(state.players || {});
      for (const [sessionId, player] of entries) {
        const pl = player as PhysicsRoomPlayerState;
        if (sessionId === mySessionIdRef.current) {
          setMyScore(pl.score ?? 0);
          setMyPlayerIndex(pl.playerIndex ?? 0);
          setMyName(pl.displayName || "You");
        } else {
          setOpponentScore(pl.score ?? 0);
          setOpponentName(pl.displayName || "Opponent");
          setOpponentDisconnected(pl.connected === false);
        }
      }
    }
  }, [state, isMultiplayer]);

  // ---------------------------------------------------------------------------
  // Message Handlers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!room || !isMultiplayer) return;

    room.onMessage("welcome", (data: any) => {
      mySessionIdRef.current = data.sessionId;
      setMyPlayerIndex(data.playerIndex);
    });

    room.onMessage("game_over", (data: any) => {
      setPhase("finished");
      setWinReason(data.winReason || "");
      if (data.winReason === "tie") {
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

  const sendInput = useCallback(
    (x: number, y?: number, action?: string) => {
      const payload: Record<string, any> = { x };
      if (y !== undefined) payload.y = y;
      if (action) payload.action = action;
      sendMessage("input", payload);
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
    setMyScore(0);
    setOpponentScore(0);
    setIsWinner(null);
    setIsTie(false);
  }, [sendMessage]);

  const startMultiplayer = useCallback(
    (roomId?: string) => {
      if (!isAvailable) return;
      setIsMultiplayer(true);
      setPhase("connecting");
      if (roomId) setJoinRoomId(roomId);
      // Trigger join on next effect cycle
      setTimeout(() => joinRoom(), 0);
    },
    [isAvailable, joinRoom],
  );

  const stopMultiplayer = useCallback(async () => {
    await leaveRoom();
    setIsMultiplayer(false);
    setPhase("idle");
    setMyScore(0);
    setOpponentScore(0);
    setIsWinner(null);
    setIsTie(false);
    setRematchRequested(false);
  }, [leaveRoom]);

  // Update phase based on connection state
  useEffect(() => {
    if (!isMultiplayer) return;
    if (reconnecting) setPhase("reconnecting");
    else if (error) setPhase("idle");
    else if (!connected && phase === "connecting") {
      // Still connecting
    }
  }, [reconnecting, error, connected, isMultiplayer, phase]);

  return {
    isAvailable,
    isMultiplayer,
    phase,
    countdown,
    ball,
    myPaddle,
    opponentPaddle,
    myScore,
    opponentScore,
    myPlayerIndex,
    scoreToWin,
    myName,
    opponentName,
    fieldWidth,
    fieldHeight,
    isWinner,
    isTie,
    winReason,
    opponentDisconnected,
    reconnecting,
    error,
    connected,
    room,
    rawState: state ?? null,
    rematchRequested,
    latency,
    sendInput,
    sendReady,
    sendRematch,
    acceptRematch,
    leave: leaveRoom,
    startMultiplayer,
    stopMultiplayer,
  };
}
