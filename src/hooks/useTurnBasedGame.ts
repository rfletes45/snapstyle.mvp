/**
 * useTurnBasedGame — Unified multiplayer hook for turn-based game screens
 *
 * Wraps Colyseus state sync with feature-flag checks and provides a clean
 * interface for turn-based game screens. Games only need to:
 *   1. Call useTurnBasedGame(gameType)
 *   2. Check `isMultiplayer` to decide which mode they're in
 *   3. Read `board`, `isMyTurn`, `currentPlayerIndex` for state
 *   4. Call `sendMove({ row, col })` when the player makes a move
 *   5. Render turn-based overlays from the returned component helpers
 *
 * The hook handles:
 *   - Feature flag checks
 *   - Connecting to Colyseus
 *   - Board state synchronization
 *   - Turn management
 *   - Draw offers / resignation
 *   - Reconnection (5 min window)
 *   - Rematch flow
 *   - Firestore game restoration
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §8
 */

import { shouldUseColyseus } from "@/config/colyseus";
import { COLYSEUS_FEATURES } from "@/constants/featureFlags";
import { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useTurnBasedGame");
// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TurnBasedPhase =
  | "idle" // Not in multiplayer
  | "connecting" // Joining room
  | "waiting" // Waiting for opponent
  | "countdown" // 3-2-1 countdown
  | "playing" // Active gameplay
  | "finished" // Game over
  | "reconnecting"; // Reconnecting to server

export interface BoardCell {
  value: number;
  ownerId: string;
}

export interface MoveRecord {
  playerId: string;
  x: number;
  y: number;
  notation: string;
  timestamp: number;
  playerIndex: number;
}

export interface TurnBasedState {
  /** Whether turn-based multiplayer is available for this game */
  isAvailable: boolean;

  /** Whether we're currently in a multiplayer session */
  isMultiplayer: boolean;

  /** Whether the local user is a spectator (not a player) */
  isSpectator: boolean;

  /** Number of spectators watching the game */
  spectatorCount: number;

  /** Current multiplayer phase */
  phase: TurnBasedPhase;

  /** Countdown value (3, 2, 1, 0) */
  countdown: number;

  /** Board as flat array — access via board[row * boardWidth + col] */
  board: number[];

  /** Board width */
  boardWidth: number;

  /** Board height */
  boardHeight: number;

  /** Whether it's the local player's turn */
  isMyTurn: boolean;

  /** Player index of the current turn (0 or 1) */
  currentPlayerIndex: number;

  /** Local player's player index (0 or 1) */
  myPlayerIndex: number;

  /** Current turn number */
  turnNumber: number;

  /** My display name */
  myName: string;

  /** Opponent's display name */
  opponentName: string;

  /** My avatar URL */
  myAvatar: string;

  /** Opponent's avatar URL */
  opponentAvatar: string;

  /** My score (for games that track score, e.g., Reversi piece count) */
  myScore: number;

  /** Opponent's score */
  opponentScore: number;

  /** Whether the local player won */
  isWinner: boolean | null;

  /** Whether the game was a draw */
  isDraw: boolean;

  /** Name of the winner */
  winnerName: string;

  /** Win reason (e.g., "three_in_a_row", "resignation", "draw_agreed") */
  winReason: string;

  /** Whether a draw offer is pending */
  drawPending: boolean;

  /** Whether the draw was offered by the local player */
  drawOfferedByMe: boolean;

  /** Whether opponent disconnected */
  opponentDisconnected: boolean;

  /** Whether we're reconnecting */
  reconnecting: boolean;

  /** Whether opponent requested a rematch */
  rematchRequested: boolean;

  /** Connection error message */
  error: string | null;

  /** Network latency in ms */
  latency: number;

  /** Move history */
  moveHistory: MoveRecord[];

  /** Last move notation */
  lastMoveNotation: string;

  /** Active Colyseus room for multiplayer spectator integration */
  room: Room | null;

  /** Latest raw room state snapshot for spectator/session consumers */
  rawState: unknown | null;
}

export interface TurnBasedActions {
  /** Start a multiplayer session */
  startMultiplayer: (
    options?:
      | string
      | {
          roomId?: string;
          firestoreGameId?: string;
          spectator?: boolean;
        },
  ) => Promise<void>;

  /** Start a multiplayer session (alias) */
  findMatch: () => Promise<void>;

  /** Restore a suspended game from Firestore */
  restoreGame: (firestoreGameId: string) => Promise<void>;

  /** Cancel / leave multiplayer */
  cancelMultiplayer: () => void;

  /** Send a move */
  sendMove: (move: {
    row: number;
    col: number;
    toRow?: number;
    toCol?: number;
    extra?: any;
  }) => void;

  /** Send ready signal */
  sendReady: () => void;

  /** Resign the game */
  resign: () => void;

  /** Offer a draw */
  offerDraw: () => void;

  /** Accept the opponent's draw offer */
  acceptDraw: () => void;

  /** Decline the opponent's draw offer */
  declineDraw: () => void;

  /** Request a rematch */
  requestRematch: () => void;

  /** Accept opponent's rematch request */
  acceptRematch: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useTurnBasedGame(
  gameType: string,
): TurnBasedState & TurnBasedActions {
  // Use the category-aware check: checkers_game → "complex" → COMPLEX_TURNBASED_ENABLED
  const isAvailable =
    COLYSEUS_FEATURES.COLYSEUS_ENABLED && shouldUseColyseus(gameType);

  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [phase, setPhase] = useState<TurnBasedPhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [board, setBoard] = useState<number[]>([]);
  const [boardWidth, setBoardWidth] = useState(0);
  const [boardHeight, setBoardHeight] = useState(0);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [myPlayerIndex, setMyPlayerIndex] = useState(0);
  const [turnNumber, setTurnNumber] = useState(0);
  const [myName, setMyName] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [myAvatar, setMyAvatar] = useState("");
  const [opponentAvatar, setOpponentAvatar] = useState("");
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [isWinner, setIsWinner] = useState<boolean | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [winnerName, setWinnerName] = useState("");
  const [winReason, setWinReason] = useState("");
  const [drawPending, setDrawPending] = useState(false);
  const [drawOfferedByMe, setDrawOfferedByMe] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [lastMoveNotation, setLastMoveNotation] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [rawState, setRawState] = useState<unknown | null>(null);

  const roomRef = useRef<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── State Sync Handler ──────────────────────────────────────────────

  const handleStateChange = useCallback((state: any) => {
    if (!mountedRef.current) return;
    setRawState(state ?? null);
    const room = roomRef.current;
    const mySessionId = room?.sessionId;

    // Phase
    const newPhase = state.phase || "waiting";
    setPhase(newPhase);
    setCountdown(state.countdown ?? 0);
    setTurnNumber(state.turnNumber ?? 0);
    setLastMoveNotation(state.lastMoveNotation ?? "");

    // Spectator count
    setSpectatorCount(state.spectatorCount ?? 0);

    // Board
    if (state.board) {
      const boardValues: number[] = [];
      // Colyseus ArraySchema — iterate
      if (typeof state.board.forEach === "function") {
        state.board.forEach((cell: any) => {
          boardValues.push(cell?.value ?? 0);
        });
      }
      setBoard(boardValues);
      setBoardWidth(state.boardWidth ?? 0);
      setBoardHeight(state.boardHeight ?? 0);
    }

    // Draw state
    setDrawPending(state.drawPending ?? false);
    if (state.drawOfferedBy && mySessionId) {
      setDrawOfferedByMe(state.drawOfferedBy === mySessionId);
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

      // Turn detection
      if (state.currentTurnPlayerId && mySessionId) {
        setIsMyTurn(state.currentTurnPlayerId === mySessionId);
        // Find current turn player index
        state.tbPlayers.forEach((player: any) => {
          if (player.sessionId === state.currentTurnPlayerId) {
            setCurrentPlayerIndex(player.playerIndex ?? 0);
          }
        });
      }
    }

    // Move history
    if (state.moveHistory) {
      const history: MoveRecord[] = [];
      state.moveHistory.forEach((m: any) => {
        history.push({
          playerId: m.playerId ?? "",
          x: m.x ?? 0,
          y: m.y ?? 0,
          notation: m.notation ?? "",
          timestamp: m.timestamp ?? 0,
          playerIndex: m.playerIndex ?? 0,
        });
      });
      setMoveHistory(history);
    }

    // Winner detection
    if (
      state.winnerId !== undefined &&
      state.winnerId !== "" &&
      state.phase === "finished"
    ) {
      // Find if winner is me
      let isMyWin = false;
      let winName = "";
      if (state.tbPlayers) {
        state.tbPlayers.forEach((player: any) => {
          if (player.uid === state.winnerId) {
            winName = player.displayName ?? "";
            if (player.sessionId === mySessionId) {
              isMyWin = true;
            }
          }
        });
      }
      setIsWinner(isMyWin);
      setWinnerName(winName);
      setIsDraw(false);
      setWinReason(state.winReason ?? "");
      setPhase("finished");
    } else if (
      state.phase === "finished" &&
      (state.winnerId === "" || !state.winnerId)
    ) {
      // Draw
      setIsWinner(null);
      setIsDraw(true);
      setWinnerName("");
      setWinReason(state.winReason ?? "draw");
      setPhase("finished");
    }
  }, []);

  // ─── Join / Connect ──────────────────────────────────────────────────

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
        setRoom(room as Room);

        if (mountedRef.current) {
          // Don't force "waiting" — the server's first state change will
          // set the correct phase (which may already be "playing" for a
          // restored async game). Use "connecting" as a safe intermediate.
          // The handleStateChange callback will update to the real phase.

          // Auto-send ready — turn-based games start as soon as both
          // players are in the room (no pre-game lobby UI).
          room?.send("ready", {});

          // Listen for additional messages
          room?.onMessage("rematch_request", () => {
            if (mountedRef.current) setRematchRequested(true);
          });
          room?.onMessage("error", (data: any) => {
            if (mountedRef.current) {
              logger.warn(`[TurnBased] Server error: ${data.message}`);
            }
          });
          room?.onMessage("turn_skipped", (data: any) => {
            if (mountedRef.current) {
              logger.info(
                `[TurnBased] Turn skipped for: ${data.skippedPlayer}`,
              );
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

  const startMultiplayer = useCallback(
    async (
      options?:
        | string
        | {
            roomId?: string;
            firestoreGameId?: string;
            spectator?: boolean;
          },
    ) => {
      if (!isAvailable) {
        setError("Turn-based multiplayer is not available");
        return;
      }
      // Support old signature: startMultiplayer(roomId?: string)
      // and new signature: startMultiplayer({ firestoreGameId })
      if (typeof options === "string") {
        await joinRoom({ roomId: options });
      } else if (options?.firestoreGameId) {
        if (options.spectator) {
          setIsSpectator(true);
        }
        await joinRoom({
          firestoreGameId: options.firestoreGameId,
          ...(options.spectator ? { spectator: true } : {}),
        });
      } else if (options?.roomId) {
        if (options.spectator) {
          setIsSpectator(true);
        }
        await joinRoom({
          roomId: options.roomId,
          ...(options.spectator ? { spectator: true } : {}),
        });
      } else {
        await joinRoom();
      }
    },
    [isAvailable, joinRoom],
  );

  const restoreGame = useCallback(
    async (firestoreGameId: string) => {
      if (!isAvailable) {
        setError("Turn-based multiplayer is not available");
        return;
      }
      await joinRoom({ firestoreGameId });
    },
    [isAvailable, joinRoom],
  );

  const cancelMultiplayer = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.leave?.();
      roomRef.current = null;
    }
    setIsMultiplayer(false);
    setIsSpectator(false);
    setSpectatorCount(0);
    setPhase("idle");
    setError(null);
    setRematchRequested(false);
    setOpponentDisconnected(false);
    setBoard([]);
    setMoveHistory([]);
    setRawState(null);
    setRoom(null);
  }, []);

  // ─── Game Actions ────────────────────────────────────────────────────

  const sendMove = useCallback(
    (move: {
      row: number;
      col: number;
      toRow?: number;
      toCol?: number;
      extra?: any;
    }) => {
      if (roomRef.current) {
        roomRef.current.send?.("move", move);
      }
    },
    [],
  );

  const sendReady = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send?.("ready", {});
    }
  }, []);

  const resign = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send?.("resign", {});
    }
  }, []);

  const offerDraw = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send?.("offer_draw", {});
    }
  }, []);

  const acceptDraw = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send?.("accept_draw", {});
    }
  }, []);

  const declineDraw = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send?.("decline_draw", {});
    }
  }, []);

  const requestRematch = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send?.("rematch", {});
    }
  }, []);

  const acceptRematch = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send?.("rematch_accept", {});
    }
    setRematchRequested(false);
    setPhase("waiting");
    setIsWinner(null);
    setIsDraw(false);
    setWinnerName("");
    setWinReason("");
    setBoard([]);
    setMoveHistory([]);
  }, []);

  // ─── Cleanup ─────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.leave?.();
        roomRef.current = null;
      }
      setRoom(null);
      setRawState(null);
    };
  }, []);

  // ─── Return ──────────────────────────────────────────────────────────

  return {
    // State
    isAvailable,
    isMultiplayer,
    isSpectator,
    spectatorCount,
    phase,
    countdown,
    board,
    boardWidth,
    boardHeight,
    isMyTurn,
    currentPlayerIndex,
    myPlayerIndex,
    turnNumber,
    myName,
    opponentName,
    myAvatar,
    opponentAvatar,
    myScore,
    opponentScore,
    isWinner,
    isDraw,
    winnerName,
    winReason,
    drawPending,
    drawOfferedByMe,
    opponentDisconnected,
    reconnecting,
    rematchRequested,
    error,
    latency,
    moveHistory,
    lastMoveNotation,
    room,
    rawState,
    // Actions
    startMultiplayer,
    findMatch: startMultiplayer,
    restoreGame,
    cancelMultiplayer,
    sendMove,
    sendReady,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    requestRematch,
    acceptRematch,
  };
}
