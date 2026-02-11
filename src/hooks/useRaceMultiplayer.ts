/**
 * useRaceMultiplayer — Client hook for competitive typing Race
 *
 * Wraps useColyseus for the typing race game. Provides:
 *   - Shared sentence from server
 *   - Both players' progress (0-1), WPM, accuracy
 *   - Progress submission
 *   - Phase management, reconnection, rematch
 *
 * Usage:
 *   const {
 *     phase, sentence, myProgress, opponentProgress, myWpm,
 *     opponentWpm, sendProgress, sendReady,
 *   } = useRaceMultiplayer();
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

export type RacePhase =
  | "idle"
  | "connecting"
  | "waiting"
  | "countdown"
  | "playing"
  | "finished"
  | "reconnecting";

export interface RacePlayerInfo {
  displayName: string;
  progress: number;
  wpm: number;
  accuracy: number;
  finished: boolean;
  finishTime: number;
}

interface RacePlayerState {
  progress?: number;
  wpm?: number;
  accuracy?: number;
  displayName?: string;
  connected?: boolean;
}

export interface UseRaceMultiplayerReturn {
  isAvailable: boolean;
  isMultiplayer: boolean;
  phase: RacePhase;
  countdown: number;

  /** The sentence both players type */
  sentence: string;
  /** Shared seed */
  seed: number;

  /** My info */
  myProgress: number;
  myWpm: number;
  myAccuracy: number;
  myName: string;

  /** Opponent info */
  opponentProgress: number;
  opponentWpm: number;
  opponentAccuracy: number;
  opponentName: string;

  /** Win state */
  isWinner: boolean | null;
  isTie: boolean;
  winReason: string;
  elapsed: number;

  /** Connection */
  opponentDisconnected: boolean;
  reconnecting: boolean;
  error: string | null;
  connected: boolean;
  room: Room | null;
  rawState: unknown | null;
  rematchRequested: boolean;
  latency: number | null;

  // Actions
  sendProgress: (progress: number, wpm: number, accuracy: number) => void;
  sendFinished: (wpm: number, accuracy: number) => void;
  sendReady: () => void;
  sendRematch: () => void;
  acceptRematch: () => void;
  leave: () => Promise<void>;
  startMultiplayer: (roomId?: string) => void;
  stopMultiplayer: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export interface UseRaceMultiplayerOptions {
  /** Firestore game ID from invite flow — used by filterBy to match both players */
  firestoreGameId?: string;
  spectator?: boolean;
}

export function useRaceMultiplayer(
  options?: UseRaceMultiplayerOptions,
): UseRaceMultiplayerReturn {
  const gameType = "race_game";
  const firestoreGameId = options?.firestoreGameId;
  const spectator = options?.spectator ?? false;
  const isAvailable =
    !!COLYSEUS_FEATURES.COLYSEUS_ENABLED && !!COLYSEUS_FEATURES.PHYSICS_ENABLED;

  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState<string | undefined>();

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

  const [phase, setPhase] = useState<RacePhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [sentence, setSentence] = useState("");
  const [seed, setSeed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [myProgress, setMyProgress] = useState(0);
  const [myWpm, setMyWpm] = useState(0);
  const [myAccuracy, setMyAccuracy] = useState(100);
  const [myName, setMyName] = useState("You");
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [opponentWpm, setOpponentWpm] = useState(0);
  const [opponentAccuracy, setOpponentAccuracy] = useState(100);
  const [opponentName, setOpponentName] = useState("Opponent");
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
    if (state.sentence) setSentence(state.sentence);
    if (state.seed) setSeed(state.seed);
    setElapsed(state.elapsed || 0);

    // Parse race players
    if (state.racePlayers) {
      const entries = Object.entries(state.racePlayers || {});
      for (const [sessionId, player] of entries) {
        const p = player as RacePlayerState;
        if (sessionId === mySessionIdRef.current) {
          setMyProgress(p.progress ?? 0);
          setMyWpm(p.wpm ?? 0);
          setMyAccuracy(p.accuracy ?? 100);
          setMyName(p.displayName || "You");
        } else {
          setOpponentProgress(p.progress ?? 0);
          setOpponentWpm(p.wpm ?? 0);
          setOpponentAccuracy(p.accuracy ?? 100);
          setOpponentName(p.displayName || "Opponent");
          setOpponentDisconnected(p.connected === false);
        }
      }
    }
  }, [state, isMultiplayer]);

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!room || !isMultiplayer) return;

    room.onMessage("welcome", (data: any) => {
      mySessionIdRef.current = data.sessionId;
      if (data.sentence) setSentence(data.sentence);
      if (data.seed) setSeed(data.seed);
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

  const sendProgress = useCallback(
    (progress: number, wpm: number, accuracy: number) => {
      sendMessage("progress", { progress, wpm, accuracy });
    },
    [sendMessage],
  );

  const sendFinished = useCallback(
    (wpm: number, accuracy: number) => {
      sendMessage("finished", { wpm, accuracy });
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
    setMyProgress(0);
    setMyWpm(0);
    setOpponentProgress(0);
    setOpponentWpm(0);
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
    setMyProgress(0);
    setOpponentProgress(0);
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
    sentence,
    seed,
    myProgress,
    myWpm,
    myAccuracy,
    myName,
    opponentProgress,
    opponentWpm,
    opponentAccuracy,
    opponentName,
    isWinner,
    isTie,
    winReason,
    elapsed,
    opponentDisconnected,
    reconnecting,
    error,
    connected,
    room,
    rawState: state ?? null,
    rematchRequested,
    latency,
    sendProgress,
    sendFinished,
    sendReady,
    sendRematch,
    acceptRematch,
    leave: leaveRoom,
    startMultiplayer,
    stopMultiplayer,
  };
}
