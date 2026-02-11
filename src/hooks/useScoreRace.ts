/**
 * useScoreRace — Specialized hook for Tier 4 quick-play competitive games
 *
 * Wraps useColyseus with score-race-specific logic:
 * - Opponent score tracking
 * - Score submission
 * - Life tracking
 * - Game phase management (waiting, countdown, playing, finished)
 * - Rematch flow
 *
 * Usage:
 *   const {
 *     phase, countdown, myScore, opponentScore, opponentName,
 *     isWinner, sendScore, sendFinished, sendReady, sendRematch,
 *     reconnecting, error,
 *   } = useScoreRace({ gameType: "timed_tap_game" });
 */

import { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useColyseus, UseColyseusOptions } from "./useColyseus";
import { useColyseusAppState } from "./useColyseusAppState";

// =============================================================================
// Types
// =============================================================================

export interface ScoreRaceResult {
  uid: string;
  displayName: string;
  score: number;
  playerIndex: number;
}

interface ScoreRacePlayerState {
  currentScore?: number;
  score?: number;
  playerIndex?: number;
  lives?: number;
  displayName?: string;
  avatarUrl?: string;
  connected?: boolean;
}

export interface UseScoreRaceReturn {
  /** Current game phase */
  phase:
    | "connecting"
    | "waiting"
    | "countdown"
    | "playing"
    | "finished"
    | "error";

  /** Countdown value (3, 2, 1, 0) */
  countdown: number;

  /** My current score */
  myScore: number;

  /** Opponent's current score */
  opponentScore: number;

  /** Opponent's display name */
  opponentName: string;

  /** Opponent's avatar URL */
  opponentAvatar: string;

  /** My player index (0 or 1) */
  myPlayerIndex: number;

  /** Whether I am the winner */
  isWinner: boolean | null;

  /** Whether it's a tie */
  isTie: boolean;

  /** Winner's display name */
  winnerName: string;

  /** Shared RNG seed for identical challenges */
  seed: number;

  /** Time remaining in ms */
  timeRemaining: number;

  /** Time elapsed in ms */
  timeElapsed: number;

  /** My lives remaining (-1 = unlimited) */
  myLives: number;

  /** Opponent's lives remaining */
  opponentLives: number;

  /** Whether opponent is disconnected/reconnecting */
  opponentDisconnected: boolean;

  /** Whether I'm reconnecting */
  reconnecting: boolean;

  /** Connection error message */
  error: string | null;

  /** Whether the room is connected */
  connected: boolean;

  /** Final results (available when phase === "finished") */
  results: ScoreRaceResult[];

  /** The raw Colyseus room (for advanced usage) */
  room: Room | null;

  /** Rematch requested by opponent */
  rematchRequested: boolean;

  /** Server latency in ms */
  latency: number | null;

  // --- Actions ---

  /** Send a score update to the server */
  sendScore: (score: number) => void;

  /** Signal that I've finished (died, completed, etc.) */
  sendFinished: (finalScore: number) => void;

  /** Signal I'm ready to start */
  sendReady: () => void;

  /** Request a rematch */
  sendRematch: () => void;

  /** Accept a rematch */
  acceptRematch: () => void;

  /** Send a life lost */
  sendLifeLost: () => void;

  /** Send combo update */
  sendCombo: (combo: number) => void;

  /** Leave the room */
  leave: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useScoreRace(options: UseColyseusOptions): UseScoreRaceReturn {
  const {
    room,
    state,
    connected,
    reconnecting,
    error,
    sendMessage,
    leaveRoom,
    latency,
  } = useColyseus(options);

  // Handle app state for reconnection
  useColyseusAppState(room);

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const [phase, setPhase] = useState<UseScoreRaceReturn["phase"]>("connecting");
  const [countdown, setCountdown] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentName, setOpponentName] = useState("");
  const [opponentAvatar, setOpponentAvatar] = useState("");
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [isTie, setIsTie] = useState(false);
  const [winnerName, setWinnerName] = useState("");
  const [seed, setSeed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [myLives, setMyLives] = useState(-1);
  const [opponentLives, setOpponentLives] = useState(-1);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [results, setResults] = useState<ScoreRaceResult[]>([]);
  const [rematchRequested, setRematchRequested] = useState(false);

  const mySessionIdRef = useRef<string>("");
  const myUidRef = useRef<string>("");

  // ---------------------------------------------------------------------------
  // State Sync — Parse Colyseus state into React state
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!state) {
      if (error) {
        setPhase("error");
      } else if (!connected) {
        setPhase("connecting");
      }
      return;
    }

    // Update phase
    setPhase(state.phase || "waiting");
    setCountdown(state.countdown || 0);
    setSeed(state.seed || 0);
    setTimeRemaining(state.timer?.remaining ?? state.remaining ?? 0);
    setTimeElapsed(state.timer?.elapsed ?? state.elapsed ?? 0);

    // Find my player and opponent.
    // Support multiple player map names: ScoreRaceState uses racePlayers,
    // BrickBreakerState uses bbPlayers, BounceBlitzState uses blitzPlayers.
    const playerMap =
      state.racePlayers || state.bbPlayers || state.blitzPlayers;
    if (playerMap) {
      const entries = Object.entries(playerMap || {});
      for (const [sessionId, player] of entries) {
        const p = player as ScoreRacePlayerState;
        if (sessionId === mySessionIdRef.current) {
          setMyScore(p.currentScore ?? p.score ?? 0);
          setMyPlayerIndex(p.playerIndex || 0);
          setMyLives(p.lives ?? -1);
        } else {
          setOpponentScore(p.currentScore ?? p.score ?? 0);
          setOpponentName(p.displayName || "Opponent");
          setOpponentAvatar(p.avatarUrl || "");
          setOpponentLives(p.lives ?? -1);
          setOpponentDisconnected(p.connected === false);
        }
      }
    }
  }, [state, connected, error]);

  // ---------------------------------------------------------------------------
  // Message Handlers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!room) return;

    // Welcome message — gives us our session ID and seed
    const welcomeHandler = room.onMessage("welcome", (data: any) => {
      mySessionIdRef.current = data.sessionId;
      setMyPlayerIndex(data.playerIndex);
      setSeed(data.seed);
    });

    // Game over — final results
    const gameOverHandler = room.onMessage("game_over", (data: any) => {
      setResults(data.results || []);
      setPhase("finished");

      if (data.winReason === "tie") {
        setIsTie(true);
        setIsWinner(null);
        setWinnerName("");
      } else {
        setIsTie(false);
        const winner = data.results?.find((r: any) => r.uid === data.winnerId);
        setWinnerName(winner?.displayName || "");
        // Determine if I won
        if (myUidRef.current) {
          setIsWinner(data.winnerId === myUidRef.current);
        }
      }
    });

    // Rematch request from opponent
    const rematchHandler = room.onMessage("rematch_request", (data: any) => {
      if (data.fromSessionId !== mySessionIdRef.current) {
        setRematchRequested(true);
      }
    });

    // Opponent reconnection states
    const reconnectingHandler = room.onMessage("opponent_reconnecting", () => {
      setOpponentDisconnected(true);
    });

    const reconnectedHandler = room.onMessage("opponent_reconnected", () => {
      setOpponentDisconnected(false);
    });

    return () => {
      // Colyseus SDK cleans up handlers when room is left
    };
  }, [room]);

  // Get my UID from auth
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

  const sendScore = useCallback(
    (score: number) => sendMessage("score_update", { score }),
    [sendMessage],
  );

  const sendFinished = useCallback(
    (finalScore: number) => sendMessage("finished", { finalScore }),
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
    setResults([]);
  }, [sendMessage]);

  const sendLifeLost = useCallback(
    () => sendMessage("lose_life"),
    [sendMessage],
  );

  const sendCombo = useCallback(
    (combo: number) => sendMessage("combo_update", { combo }),
    [sendMessage],
  );

  return {
    phase,
    countdown,
    myScore,
    opponentScore,
    opponentName,
    opponentAvatar,
    myPlayerIndex,
    isWinner,
    isTie,
    winnerName,
    seed,
    timeRemaining,
    timeElapsed,
    myLives,
    opponentLives,
    opponentDisconnected,
    reconnecting,
    error,
    connected,
    results,
    room,
    rematchRequested,
    latency,
    sendScore,
    sendFinished,
    sendReady,
    sendRematch,
    acceptRematch,
    sendLifeLost,
    sendCombo,
    leave: leaveRoom,
  };
}
