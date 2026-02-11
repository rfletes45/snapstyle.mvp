/**
 * useWordsGame — Multiplayer hook for the Words (Scrabble-lite) game
 *
 * Wraps useTurnBasedGame and adds:
 * - Private rack management (received via targeted "rack" messages)
 * - Bag remaining count
 * - Word submission action (passes tiles via move.extra)
 * - Pass and swap actions
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §8 Phase 3
 */

import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { useCallback, useEffect, useRef, useState } from "react";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useWordsGame");
// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WordsPhase =
  | "idle"
  | "connecting"
  | "waiting"
  | "countdown"
  | "playing"
  | "finished"
  | "reconnecting";

export interface WordsGameState {
  isAvailable: boolean;
  isMultiplayer: boolean;
  phase: WordsPhase;
  countdown: number;

  /** Board as flat array of letter codes (0=empty, 1-26=A-Z) */
  board: number[];
  boardWidth: number;
  boardHeight: number;

  /** Board owner IDs (parallel to board: "1" or "2" or "") */
  boardOwners: string[];

  /** Whether it's my turn */
  isMyTurn: boolean;
  myPlayerIndex: number;
  turnNumber: number;

  /** Player names and avatars */
  myName: string;
  opponentName: string;
  myAvatar: string;
  opponentAvatar: string;

  /** Scores */
  myScore: number;
  opponentScore: number;

  /** Private tile rack (received via targeted message) */
  rack: string[];

  /** Tiles remaining in the bag */
  bagRemaining: number;

  /** Last move notation */
  lastMoveNotation: string;

  /** Game over */
  isWinner: boolean | null;
  isDraw: boolean;
  winnerName: string;
  winReason: string;
  opponentDisconnected: boolean;
  reconnecting: boolean;
  rematchRequested: boolean;
  error: string | null;
}

export interface WordsGameActions {
  startMultiplayer: (
    options?: string | { roomId?: string; firestoreGameId?: string },
  ) => Promise<void>;
  findMatch: () => Promise<void>;
  cancelMultiplayer: () => void;
  sendReady: () => void;

  /** Submit placed tiles as a word */
  submitWord: (tiles: { row: number; col: number; letter: string }[]) => void;

  /** Pass turn */
  passTurn: () => void;

  /** Swap tiles from rack */
  swapTiles: (tiles: string[]) => void;

  /** Resign */
  resign: () => void;

  /** Request rematch */
  requestRematch: () => void;

  /** Accept rematch */
  acceptRematch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useWordsGame(
  gameType: string = "words_game",
): WordsGameState & WordsGameActions {
  const isAvailable =
    COLYSEUS_FEATURES.COLYSEUS_ENABLED && COLYSEUS_FEATURES.TURNBASED_ENABLED;

  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [phase, setPhase] = useState<WordsPhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [board, setBoard] = useState<number[]>([]);
  const [boardWidth, setBoardWidth] = useState(0);
  const [boardHeight, setBoardHeight] = useState(0);
  const [boardOwners, setBoardOwners] = useState<string[]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [turnNumber, setTurnNumber] = useState(0);
  const [myName, setMyName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [myAvatar, setMyAvatar] = useState("");
  const [opponentAvatar, setOpponentAvatar] = useState("");
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [rack, setRack] = useState<string[]>([]);
  const [bagRemaining, setBagRemaining] = useState(0);
  const [lastMoveNotation, setLastMoveNotation] = useState("");

  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [winnerName, setWinnerName] = useState("");
  const [winReason, setWinReason] = useState("");
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── State Sync ──────────────────────────────────────────────────────

  const handleStateChange = useCallback((state: any) => {
    if (!mountedRef.current) return;
    const room = roomRef.current;
    const mySessionId = room?.sessionId;

    setPhase(state.phase || "waiting");
    setCountdown(state.countdown ?? 0);
    setTurnNumber(state.turnNumber ?? 0);
    setLastMoveNotation(state.lastMoveNotation ?? "");

    // Board
    if (state.board) {
      const values: number[] = [];
      const owners: string[] = [];
      if (typeof state.board.forEach === "function") {
        state.board.forEach((cell: any) => {
          values.push(cell?.value ?? 0);
          owners.push(cell?.ownerId ?? "");
        });
      }
      setBoard(values);
      setBoardOwners(owners);
      setBoardWidth(state.boardWidth ?? 0);
      setBoardHeight(state.boardHeight ?? 0);
    }

    // Players
    if (state.tbPlayers) {
      let me: any = null;
      let opponent: any = null;

      state.tbPlayers.forEach((player: any) => {
        if (player.sessionId === mySessionId) {
          me = player;
        } else {
          opponent = player;
        }
      });

      if (me) {
        setMyPlayerIndex(me.playerIndex ?? 0);
        setMyName(me.displayName ?? "You");
        setMyAvatar(me.avatarUrl ?? "");
        setMyScore(me.score ?? 0);
      }
      if (opponent) {
        setOpponentName(opponent.displayName ?? "Opponent");
        setOpponentAvatar(opponent.avatarUrl ?? "");
        setOpponentScore(opponent.score ?? 0);
        setOpponentDisconnected(!opponent.connected);
      }

      if (state.currentTurnPlayerId && mySessionId) {
        setIsMyTurn(state.currentTurnPlayerId === mySessionId);
      }
    }

    // Winner
    if (
      state.winnerId !== undefined &&
      state.winnerId !== "" &&
      state.phase === "finished"
    ) {
      let isMyWin = false;
      let wName = "";
      if (state.tbPlayers) {
        state.tbPlayers.forEach((player: any) => {
          if (player.uid === state.winnerId) {
            wName = player.displayName ?? "";
            if (player.sessionId === mySessionId) {
              isMyWin = true;
            }
          }
        });
      }
      setIsWinner(isMyWin);
      setWinnerName(wName);
      setIsDraw(false);
      setWinReason(state.winReason ?? "");
      setPhase("finished");
    } else if (
      state.phase === "finished" &&
      (state.winnerId === "" || !state.winnerId)
    ) {
      setIsWinner(null);
      setIsDraw(true);
      setWinnerName("");
      setWinReason(state.winReason ?? "draw");
      setPhase("finished");
    }
  }, []);

  // ─── Join Room ──────────────────────────────────────────────────────

  const joinRoom = useCallback(
    async (options: Record<string, any> = {}) => {
      setIsMultiplayer(true);
      setPhase("connecting");
      setError(null);

      try {
        const { colyseusService } = await import("@/services/colyseus");
        const { getColyseusRoomName } = await import("@/config/colyseus");

        const roomName = getColyseusRoomName(gameType);
        if (!roomName) {
          throw new Error(`No Colyseus room configured for ${gameType}`);
        }

        // If a roomId is provided (invite flow), join by ID instead of matchmaking
        const { roomId, ...joinOptions } = options;
        let room;
        if (roomId) {
          room = await colyseusService.joinById(roomId, joinOptions, {
            onStateChange: handleStateChange,
            onError: (code: number, message?: string) => {
              if (!mountedRef.current) return;
              setError(`Connection error: ${message ?? "Unknown error"}`);
              setPhase("idle");
            },
            onLeave: (code: number) => {
              if (!mountedRef.current) return;
              if (code > 1000) {
                setError("Disconnected from server");
              }
            },
          });
        } else {
          room = await colyseusService.joinOrCreate(gameType, joinOptions, {
            onStateChange: handleStateChange,
            onError: (code: number, message?: string) => {
              if (!mountedRef.current) return;
              setError(`Connection error: ${message ?? "Unknown error"}`);
              setPhase("idle");
            },
            onLeave: (code: number) => {
              if (!mountedRef.current) return;
              if (code > 1000) {
                setError("Disconnected from server");
              }
            },
          });
        }

        roomRef.current = room;

        if (mountedRef.current) {
          setPhase("waiting");

          // ── Private rack messages ──
          room?.onMessage("rack", (data: any) => {
            if (!mountedRef.current) return;
            if (data?.tiles && Array.isArray(data.tiles)) {
              setRack(data.tiles);
            }
            if (data?.bagRemaining !== undefined) {
              setBagRemaining(data.bagRemaining);
            }
          });

          // ── Bag update ──
          room?.onMessage("bag_update", (data: any) => {
            if (!mountedRef.current) return;
            if (data?.bagRemaining !== undefined) {
              setBagRemaining(data.bagRemaining);
            }
          });

          // ── Rematch ──
          room?.onMessage("rematch_request", () => {
            if (mountedRef.current) setRematchRequested(true);
          });

          // ── Errors ──
          room?.onMessage("error", (data: any) => {
            if (mountedRef.current) {
              logger.warn(`[Words] Server error: ${data.message}`);
            }
          });
        }
      } catch (err: any) {
        if (mountedRef.current) {
          setError(err.message || "Failed to connect");
          setPhase("idle");
          setIsMultiplayer(false);
        }
      }
    },
    [gameType, handleStateChange],
  );

  // ─── Actions ──────────────────────────────────────────────────────

  const startMultiplayer = useCallback(
    async (
      options?: string | { roomId?: string; firestoreGameId?: string },
    ) => {
      if (!isAvailable) {
        setError("Words multiplayer is not available");
        return;
      }
      // Support old signature: startMultiplayer(roomId?: string)
      // and new signature: startMultiplayer({ firestoreGameId })
      if (typeof options === "string") {
        await joinRoom({ roomId: options });
      } else if (options?.firestoreGameId) {
        await joinRoom({ firestoreGameId: options.firestoreGameId });
      } else if (options?.roomId) {
        await joinRoom({ roomId: options.roomId });
      } else {
        await joinRoom();
      }
    },
    [isAvailable, joinRoom],
  );

  const cancelMultiplayer = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.leave?.();
      roomRef.current = null;
    }
    setIsMultiplayer(false);
    setPhase("idle");
    setError(null);
    setRack([]);
    setRematchRequested(false);
    setOpponentDisconnected(false);
    setBoard([]);
  }, []);

  const sendReady = useCallback(() => {
    roomRef.current?.send?.("ready", {});
  }, []);

  const submitWord = useCallback(
    (tiles: { row: number; col: number; letter: string }[]) => {
      if (roomRef.current && tiles.length > 0) {
        roomRef.current.send?.("move", {
          row: tiles[0].row,
          col: tiles[0].col,
          extra: { tiles },
        });
      }
    },
    [],
  );

  const passTurn = useCallback(() => {
    roomRef.current?.send?.("pass", {});
  }, []);

  const swapTiles = useCallback((tiles: string[]) => {
    roomRef.current?.send?.("swap", { tiles });
  }, []);

  const resign = useCallback(() => {
    roomRef.current?.send?.("resign", {});
  }, []);

  const requestRematch = useCallback(() => {
    roomRef.current?.send?.("rematch", {});
  }, []);

  const acceptRematch = useCallback(() => {
    roomRef.current?.send?.("rematch_accept", {});
    setRematchRequested(false);
    setPhase("waiting");
    setIsWinner(null);
    setIsDraw(false);
    setWinnerName("");
    setWinReason("");
    setRack([]);
    setBoard([]);
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.leave?.();
        roomRef.current = null;
      }
    };
  }, []);

  return {
    isAvailable,
    isMultiplayer,
    phase,
    countdown,
    board,
    boardWidth,
    boardHeight,
    boardOwners,
    isMyTurn,
    myPlayerIndex,
    turnNumber,
    myName,
    opponentName,
    myAvatar,
    opponentAvatar,
    myScore,
    opponentScore,
    rack,
    bagRemaining,
    lastMoveNotation,
    isWinner,
    isDraw,
    winnerName,
    winReason,
    opponentDisconnected,
    reconnecting,
    rematchRequested,
    error,
    startMultiplayer,
    findMatch: startMultiplayer,
    cancelMultiplayer,
    sendReady,
    submitWord,
    passTurn,
    swapTiles,
    resign,
    requestRematch,
    acceptRematch,
  };
}
