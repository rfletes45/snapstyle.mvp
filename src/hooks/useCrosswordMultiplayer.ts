/**
 * useCrosswordMultiplayer — Hook for cooperative crossword multiplayer
 *
 * Manages:
 * - Room connection lifecycle
 * - Shared grid state syncing
 * - Letter placement / clearing
 * - Partner cursor position tracking
 * - Completion detection
 * - Clue data
 *
 * Usage:
 *   const {
 *     phase, grid, clues, partnerCursor, placeLetter, moveCursor, sendReady, ...
 *   } = useCrosswordMultiplayer({ gameType: "crossword_puzzle_game" });
 */

import { Room } from "@colyseus/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { useColyseus, UseColyseusOptions } from "./useColyseus";
import { useColyseusAppState } from "./useColyseusAppState";

// =============================================================================
// Types
// =============================================================================

export interface GridCellState {
  letter: string;
  blocked: boolean;
  correct: boolean;
  placedBy: string;
}

interface CrosswordGridCellState {
  letter?: string;
  blocked?: boolean;
  correct?: boolean;
  placedBy?: string;
}

interface CrosswordPlayerState {
  lettersPlaced?: number;
  displayName?: string;
  avatarUrl?: string;
  connected?: boolean;
  cursorRow?: number;
  cursorCol?: number;
  cursorDirection?: "across" | "down";
}

export interface ClueState {
  num: number;
  clue: string;
  row: number;
  col: number;
  direction: "across" | "down";
}

export interface PartnerCursor {
  row: number;
  col: number;
  direction: string;
}

export interface CrosswordResult {
  uid: string;
  displayName: string;
  lettersPlaced: number;
  score: number;
}

export interface UseCrosswordMultiplayerReturn {
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
  rawState: unknown | null;

  // --- Game ---
  countdown: number;
  elapsed: number;
  completed: boolean;
  puzzleIndex: number;
  gridSize: number;

  // --- Grid ---
  grid: GridCellState[][];

  // --- Clues ---
  clues: ClueState[];

  // --- Partner ---
  partnerName: string;
  partnerAvatar: string;
  partnerCursor: PartnerCursor | null;
  partnerDisconnected: boolean;
  partnerLettersPlaced: number;
  myLettersPlaced: number;

  // --- Results ---
  results: CrosswordResult[];
  rematchRequested: boolean;

  // --- Actions ---
  sendReady: () => void;
  placeLetter: (row: number, col: number, letter: string) => void;
  clearCell: (row: number, col: number) => void;
  moveCursor: (row: number, col: number, direction: string) => void;
  sendRematch: () => void;
  acceptRematch: () => void;
  leave: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useCrosswordMultiplayer(
  options: UseColyseusOptions,
): UseCrosswordMultiplayerReturn {
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
    useState<UseCrosswordMultiplayerReturn["phase"]>("connecting");
  const [countdown, setCountdown] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [gridSize, setGridSize] = useState(5);
  const [grid, setGrid] = useState<GridCellState[][]>([]);
  const [clues, setClues] = useState<ClueState[]>([]);

  const [partnerName, setPartnerName] = useState("");
  const [partnerAvatar, setPartnerAvatar] = useState("");
  const [partnerCursor, setPartnerCursor] = useState<PartnerCursor | null>(
    null,
  );
  const [partnerDisconnected, setPartnerDisconnected] = useState(false);
  const [partnerLettersPlaced, setPartnerLettersPlaced] = useState(0);
  const [myLettersPlaced, setMyLettersPlaced] = useState(0);

  const [results, setResults] = useState<CrosswordResult[]>([]);
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
    setElapsed(state.elapsed || 0);
    setCompleted(state.completed || false);
    setPuzzleIndex(state.puzzleIndex || 0);

    const sz = state.gridSize || 5;
    setGridSize(sz);

    // Parse grid (flat array → 2D)
    if (state.grid) {
      const flatGrid = Array.isArray(state.grid)
        ? state.grid
        : Object.values(state.grid || {});

        const newGrid: GridCellState[][] = [];
        for (let r = 0; r < sz; r++) {
          const row: GridCellState[] = [];
          for (let c = 0; c < sz; c++) {
            const cell = flatGrid[r * sz + c] as CrosswordGridCellState;
            row.push({
              letter: cell?.letter || "",
              blocked: cell?.blocked || false,
            correct: cell?.correct || false,
            placedBy: cell?.placedBy || "",
          });
        }
        newGrid.push(row);
      }
      setGrid(newGrid);
    }

    // Parse clues
    if (state.clues) {
      const clueArr = Array.isArray(state.clues)
        ? state.clues
        : Object.values(state.clues || {});

      setClues(
        clueArr.map((c: any) => ({
          num: c.num || 0,
          clue: c.clue || "",
          row: c.row || 0,
          col: c.col || 0,
          direction: c.direction === "down" ? "down" : "across",
        })),
      );
    }

    // Parse players
    if (state.cwPlayers) {
      const entries = Object.entries(state.cwPlayers || {});
      for (const [sessionId, player] of entries) {
        const p = player as CrosswordPlayerState;
        if (sessionId === mySessionIdRef.current) {
          setMyLettersPlaced(p.lettersPlaced || 0);
        } else {
          setPartnerName(p.displayName || "Partner");
          setPartnerAvatar(p.avatarUrl || "");
          setPartnerDisconnected(p.connected === false);
          setPartnerLettersPlaced(p.lettersPlaced || 0);
          setPartnerCursor({
            row: p.cursorRow ?? -1,
            col: p.cursorCol ?? -1,
            direction: p.cursorDirection || "across",
          });
        }
      }
    }
  }, [state, connected, error]);

  // --- Message handlers ---
  useEffect(() => {
    if (!room) return;

    room.onMessage("welcome", (data: any) => {
      mySessionIdRef.current = data.sessionId;
      setPuzzleIndex(data.puzzleIndex || 0);
    });

    room.onMessage("letter_placed", (data: any) => {
      // Partner placed a letter — update local grid immediately for responsiveness
      setGrid((prev) => {
        const newGrid = prev.map((row) => [...row]);
        if (newGrid[data.row] && newGrid[data.row][data.col]) {
          newGrid[data.row][data.col] = {
            ...newGrid[data.row][data.col],
            letter: data.letter,
            placedBy: data.placedBy,
            correct: data.correct,
          };
        }
        return newGrid;
      });
    });

    room.onMessage("cell_cleared", (data: any) => {
      setGrid((prev) => {
        const newGrid = prev.map((row) => [...row]);
        if (newGrid[data.row] && newGrid[data.row][data.col]) {
          newGrid[data.row][data.col] = {
            ...newGrid[data.row][data.col],
            letter: "",
            placedBy: "",
            correct: false,
          };
        }
        return newGrid;
      });
    });

    room.onMessage("game_over", (data: any) => {
      setResults(data.results || []);
      setPhase("finished");
      setCompleted(true);
    });

    room.onMessage("rematch_request", (data: any) => {
      if (data.fromSessionId !== mySessionIdRef.current) {
        setRematchRequested(true);
      }
    });

    room.onMessage("opponent_reconnecting", () => setPartnerDisconnected(true));
    room.onMessage("opponent_reconnected", () => setPartnerDisconnected(false));

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

  const placeLetter = useCallback(
    (row: number, col: number, letter: string) => {
      sendMessage("place_letter", { row, col, letter });
      // Optimistic update
      setGrid((prev) => {
        const newGrid = prev.map((r) => [...r]);
        if (newGrid[row] && newGrid[row][col] && !newGrid[row][col].blocked) {
          newGrid[row][col] = {
            ...newGrid[row][col],
            letter: letter.toUpperCase(),
            placedBy: mySessionIdRef.current,
          };
        }
        return newGrid;
      });
    },
    [sendMessage],
  );

  const clearCell = useCallback(
    (row: number, col: number) => {
      sendMessage("clear_cell", { row, col });
      // Optimistic update
      setGrid((prev) => {
        const newGrid = prev.map((r) => [...r]);
        if (newGrid[row] && newGrid[row][col]) {
          newGrid[row][col] = {
            ...newGrid[row][col],
            letter: "",
            placedBy: "",
            correct: false,
          };
        }
        return newGrid;
      });
    },
    [sendMessage],
  );

  const moveCursor = useCallback(
    (row: number, col: number, direction: string) => {
      sendMessage("cursor_move", { row, col, direction });
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
    setCompleted(false);
    setResults([]);
    setGrid([]);
    setClues([]);
    setMyLettersPlaced(0);
    setPartnerLettersPlaced(0);
  }, [sendMessage]);

  return {
    phase,
    connected,
    reconnecting,
    error,
    room,
    rawState: state ?? null,
    countdown,
    elapsed,
    completed,
    puzzleIndex,
    gridSize,
    grid,
    clues,
    partnerName,
    partnerAvatar,
    partnerCursor,
    partnerDisconnected,
    partnerLettersPlaced,
    myLettersPlaced,
    results,
    rematchRequested,
    sendReady,
    placeLetter,
    clearCell,
    moveCursor,
    sendRematch,
    acceptRematch,
    leave: leaveRoom,
  };
}
