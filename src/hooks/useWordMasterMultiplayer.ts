/**
 * useWordMasterMultiplayer — Hook for competitive Wordle multiplayer
 *
 * Manages:
 * - Room connection lifecycle
 * - Guess submission and evaluation
 * - Opponent progress tracking (colour results only, no letter leaking)
 * - Game end / winner detection
 * - Rematch flow
 *
 * Usage:
 *   const {
 *     phase, myGuesses, opponentProgress, sendGuess, sendReady, ...
 *   } = useWordMasterMultiplayer({ gameType: "word_master_game" });
 */

import { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useColyseus, UseColyseusOptions } from "./useColyseus";
import { useColyseusAppState } from "./useColyseusAppState";

// =============================================================================
// Types
// =============================================================================

export interface GuessRow {
  word: string;
  result: string; // "cpcaa" etc — c=correct, p=present, a=absent
}

export interface OpponentProgress {
  row: number;
  result: string;
  finished: boolean;
  status: string;
}

export interface WordMasterResult {
  uid: string;
  displayName: string;
  score: number;
  status: string;
  guessCount: number;
}

interface WordMasterGuessState {
  word?: string;
  result?: string;
}

interface WordMasterPlayerState {
  score?: number;
  status?: "playing" | "won" | "lost";
  guesses?: WordMasterGuessState[] | Record<string, WordMasterGuessState>;
  displayName?: string;
  avatarUrl?: string;
  connected?: boolean;
  finished?: boolean;
}

export interface UseWordMasterMultiplayerReturn {
  // --- Connection ---
  phase:
    | "connecting"
    | "waiting"
    | "countdown"
    | "playing"
    | "finished"
    | "error";
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  room: Room | null;

  // --- Game ---
  countdown: number;
  myGuesses: GuessRow[];
  opponentGuesses: OpponentProgress[];
  opponentName: string;
  opponentAvatar: string;
  opponentFinished: boolean;
  opponentStatus: string;
  myStatus: "playing" | "won" | "lost";
  myScore: number;
  opponentScore: number;
  targetWord: string; // revealed only when game ends
  isWinner: boolean | null;
  isTie: boolean;
  results: WordMasterResult[];
  invalidGuessReason: string | null;

  // --- Opponent state ---
  opponentDisconnected: boolean;
  rematchRequested: boolean;

  // --- Actions ---
  sendReady: () => void;
  sendGuess: (word: string) => void;
  sendRematch: () => void;
  acceptRematch: () => void;
  leave: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useWordMasterMultiplayer(
  options: UseColyseusOptions,
): UseWordMasterMultiplayerReturn {
  const {
    room,
    state,
    connected,
    reconnecting,
    error,
    sendMessage,
    leaveRoom,
  } = useColyseus(options);

  useColyseusAppState(room);

  // --- State ---
  const [phase, setPhase] =
    useState<UseWordMasterMultiplayerReturn["phase"]>("connecting");
  const [countdown, setCountdown] = useState(0);
  const [myGuesses, setMyGuesses] = useState<GuessRow[]>([]);
  const [opponentGuesses, setOpponentGuesses] = useState<OpponentProgress[]>(
    [],
  );
  const [opponentName, setOpponentName] = useState("");
  const [opponentAvatar, setOpponentAvatar] = useState("");
  const [opponentFinished, setOpponentFinished] = useState(false);
  const [opponentStatus, setOpponentStatus] = useState("");
  const [myStatus, setMyStatus] = useState<"playing" | "won" | "lost">(
    "playing",
  );
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [targetWord, setTargetWord] = useState("");
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [isTie, setIsTie] = useState(false);
  const [results, setResults] = useState<WordMasterResult[]>([]);
  const [invalidGuessReason, setInvalidGuessReason] = useState<string | null>(
    null,
  );
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);

  const mySessionIdRef = useRef<string>("");
  const myUidRef = useRef<string>("");

  // --- State sync ---
  useEffect(() => {
    if (!state) {
      if (error) setPhase("error");
      else if (!connected) setPhase("connecting");
      return;
    }

    setPhase(state.phase || "waiting");
    setCountdown(state.countdown || 0);

    if (state.revealedWord) {
      setTargetWord(state.revealedWord);
    }

    // Parse player data
    if (state.wmPlayers) {
      const entries = Object.entries(state.wmPlayers || {});
      for (const [sessionId, player] of entries) {
        const p = player as WordMasterPlayerState;
        if (sessionId === mySessionIdRef.current) {
          setMyScore(p.score || 0);
          setMyStatus(p.status || "playing");

          // Sync guesses
          if (p.guesses) {
            const guesses: GuessRow[] = [];
            const guessEntries = Array.isArray(p.guesses)
              ? p.guesses
              : Object.values(p.guesses || {});
            for (const g of guessEntries) {
              guesses.push({
                word: g.word || "",
                result: g.result || "",
              });
            }
            setMyGuesses(guesses);
          }
        } else {
          setOpponentScore(p.score || 0);
          setOpponentName(p.displayName || "Opponent");
          setOpponentAvatar(p.avatarUrl || "");
          setOpponentDisconnected(p.connected === false);
          setOpponentFinished(p.finished || false);
          setOpponentStatus(p.status || "playing");
        }
      }
    }
  }, [state, connected, error]);

  // --- Message handlers ---
  useEffect(() => {
    if (!room) return;

    room.onMessage("welcome", (data: any) => {
      mySessionIdRef.current = data.sessionId;
    });

    room.onMessage("invalid_guess", (data: any) => {
      setInvalidGuessReason(data.reason || "Invalid guess");
      // Auto-clear after 2 seconds
      setTimeout(() => setInvalidGuessReason(null), 2000);
    });

    room.onMessage("opponent_guess", (data: any) => {
      setOpponentGuesses((prev) => [
        ...prev,
        {
          row: data.row,
          result: data.result,
          finished: data.finished,
          status: data.status,
        },
      ]);
      if (data.finished) {
        setOpponentFinished(true);
        setOpponentStatus(data.status);
      }
    });

    room.onMessage("player_finished", (_data: any) => {
      // Updated via state sync
    });

    room.onMessage("game_over", (data: any) => {
      setResults(data.results || []);
      setTargetWord(data.targetWord || "");
      setPhase("finished");

      if (data.winReason === "tie" || data.winReason === "both_lost") {
        setIsTie(data.winReason === "tie");
        setIsWinner(null);
      } else {
        setIsTie(false);
        if (myUidRef.current) {
          setIsWinner(data.winnerId === myUidRef.current);
        }
      }
    });

    room.onMessage("rematch_request", (data: any) => {
      if (data.fromSessionId !== mySessionIdRef.current) {
        setRematchRequested(true);
      }
    });

    room.onMessage("opponent_reconnecting", () =>
      setOpponentDisconnected(true),
    );
    room.onMessage("opponent_reconnected", () =>
      setOpponentDisconnected(false),
    );

    return () => {};
  }, [room]);

  // Get UID
  useEffect(() => {
    try {
      const { getAuth } = require("firebase/auth");
      const user = getAuth().currentUser;
      if (user) myUidRef.current = user.uid;
    } catch {}
  }, []);

  // --- Actions ---
  const sendReady = useCallback(() => sendMessage("ready"), [sendMessage]);

  const sendGuess = useCallback(
    (word: string) => {
      setInvalidGuessReason(null);
      sendMessage("guess", { word: word.toUpperCase() });
    },
    [sendMessage],
  );

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
    setMyGuesses([]);
    setOpponentGuesses([]);
    setMyStatus("playing");
    setOpponentFinished(false);
    setOpponentStatus("");
    setTargetWord("");
    setIsWinner(null);
    setIsTie(false);
    setResults([]);
  }, [sendMessage]);

  return {
    phase,
    connected,
    reconnecting,
    error,
    room,
    countdown,
    myGuesses,
    opponentGuesses,
    opponentName,
    opponentAvatar,
    opponentFinished,
    opponentStatus,
    myStatus,
    myScore,
    opponentScore,
    targetWord,
    isWinner,
    isTie,
    results,
    invalidGuessReason,
    opponentDisconnected,
    rematchRequested,
    sendReady,
    sendGuess,
    sendRematch,
    acceptRematch,
    leave: leaveRoom,
  };
}
