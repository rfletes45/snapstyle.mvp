/**
 * Games V4 — Hex Adapter
 *
 * Pure, deterministic game logic for the classic connection game Hex.
 * Shared between client (optimistic preview) and server (authoritative).
 *
 * Board: 9×9 hex grid stored as a flat array of 81 cells.
 * Players: exactly 2 — Red (top↔bottom) vs Blue (left↔right).
 * Opening rule: Swap / Pie rule after the first move.
 *
 * @module gamesV4/adapters/hex
 */

import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
} from "../types/adapter";
import { registerAdapter } from "./registry";

// =============================================================================
// Types
// =============================================================================

export type HexCell = null | "red" | "blue";

export type HexPhase = "opening" | "swap_pending" | "main" | "resolved";

export interface HexPublicState {
  boardSize: 9;
  cells: HexCell[];
  phase: HexPhase;
  colorByUid: Record<string, "red" | "blue">;
  edgeGoalByColor: {
    red: "top_bottom";
    blue: "left_right";
  };
  openingMoveIndex: number | null;
  swapDecision: "pending" | "kept" | "swapped" | null;
  moveCount: number;
  lastMove: {
    uid: string;
    color: "red" | "blue";
    index: number;
  } | null;
  winnerUid: string | null;
  winningPath: number[] | null;
}

export type HexMovePayload =
  | { type: "place"; index: number }
  | { type: "swap_decision"; choice: "keep" | "swap" };

// =============================================================================
// Constants
// =============================================================================

const BOARD_SIZE = 9;
const TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE;

// =============================================================================
// Grid Helpers
// =============================================================================

export function rowFromIndex(index: number): number {
  return Math.floor(index / BOARD_SIZE);
}

export function colFromIndex(index: number): number {
  return index % BOARD_SIZE;
}

export function indexFromRowCol(row: number, col: number): number {
  return row * BOARD_SIZE + col;
}

/**
 * Six hex neighbors for an offset hex grid (row-offset "pointy-top" layout).
 * Directions: NW,NE,W,E,SW,SE
 */
const NEIGHBOR_OFFSETS: Array<[number, number]> = [
  [-1, 0], // NW (up-left)
  [-1, 1], // NE (up-right)
  [0, -1], // W (left)
  [0, 1], // E (right)
  [1, -1], // SW (down-left)
  [1, 0], // SE (down-right)
];

export function getNeighborIndices(index: number): number[] {
  const row = rowFromIndex(index);
  const col = colFromIndex(index);
  const neighbors: number[] = [];
  for (const [dr, dc] of NEIGHBOR_OFFSETS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      neighbors.push(indexFromRowCol(nr, nc));
    }
  }
  return neighbors;
}

// =============================================================================
// Win Detection (BFS)
// =============================================================================

/**
 * Check if the given color has connected its two target edges.
 * Red: top row (row 0) ↔ bottom row (row 8).
 * Blue: left col (col 0) ↔ right col (col 8).
 *
 * Returns the winning path as an array of cell indices, or null if no win.
 */
export function checkWin(
  cells: HexCell[],
  color: "red" | "blue",
): number[] | null {
  // Determine start/end edges
  const startCells: number[] = [];
  const isEndEdge = (index: number): boolean => {
    if (color === "red") {
      return rowFromIndex(index) === BOARD_SIZE - 1;
    } else {
      return colFromIndex(index) === BOARD_SIZE - 1;
    }
  };

  // Collect starting edge cells of the given color
  for (let i = 0; i < BOARD_SIZE; i++) {
    let idx: number;
    if (color === "red") {
      idx = indexFromRowCol(0, i); // top row
    } else {
      idx = indexFromRowCol(i, 0); // left column
    }
    if (cells[idx] === color) {
      startCells.push(idx);
    }
  }

  if (startCells.length === 0) return null;

  // BFS from start edge cells
  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const queue: number[] = [];

  for (const s of startCells) {
    visited.add(s);
    parent.set(s, -1);
    queue.push(s);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (isEndEdge(current)) {
      // Reconstruct path
      const path: number[] = [];
      let node: number | undefined = current;
      while (node !== undefined && node !== -1) {
        path.push(node);
        node = parent.get(node);
      }
      return path.reverse();
    }

    for (const neighbor of getNeighborIndices(current)) {
      if (!visited.has(neighbor) && cells[neighbor] === color) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return null;
}

// =============================================================================
// Turn Order Helpers
// =============================================================================

function getCurrentTurnUid(
  state: HexPublicState,
  turnOrder: string[],
  currentTurnIndex: number,
): string {
  return turnOrder[currentTurnIndex % turnOrder.length];
}

function getUidColor(
  state: HexPublicState,
  uid: string,
): "red" | "blue" | null {
  return state.colorByUid[uid] ?? null;
}

// =============================================================================
// Adapter Implementation
// =============================================================================

const hexAdapter: GameAdapterV4 = {
  gameId: "hex",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "full_state",

  scoreboardDescriptor: {
    title: "MATCH RESULT",
    formatScore: (s) => (s === 1 ? "Win" : s === 0 ? "Loss" : `${s}`),
    sortDirection: "desc",
  },

  settingsSchema: [],
  defaultSettings: {},

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
    const colorByUid: Record<string, "red" | "blue"> = {};
    colorByUid[sorted[0].uid] = "red";
    colorByUid[sorted[1].uid] = "blue";

    const state: HexPublicState = {
      boardSize: 9,
      cells: Array(TOTAL_CELLS).fill(null),
      phase: "opening",
      colorByUid,
      edgeGoalByColor: {
        red: "top_bottom",
        blue: "left_right",
      },
      openingMoveIndex: null,
      swapDecision: null,
      moveCount: 0,
      lastMove: null,
      winnerUid: null,
      winningPath: null,
    };
    return state as unknown as Record<string, unknown>;
  },

  // ── Move Validation ─────────────────────────────────────────────────

  validateMove(
    publicState: Record<string, unknown>,
    _privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = publicState as unknown as HexPublicState;
    const move = movePayload as unknown as HexMovePayload;

    // Verify it's the right player's turn
    const expectedUid = getCurrentTurnUid(
      state,
      ctx.turnOrder,
      ctx.currentTurnIndex,
    );
    if (ctx.uid !== expectedUid) {
      return { ok: false, error: "Not your turn." };
    }

    if (state.phase === "resolved") {
      return { ok: false, error: "Game is already resolved." };
    }

    // ── SWAP DECISION ───────────────────────────────────────────────
    if (move.type === "swap_decision") {
      if (state.phase !== "swap_pending") {
        return {
          ok: false,
          error: "Swap decision is not available right now.",
        };
      }

      if (move.choice !== "keep" && move.choice !== "swap") {
        return { ok: false, error: "Invalid swap choice." };
      }

      // The second player (blue at this point) makes the swap decision
      const playerColor = getUidColor(state, ctx.uid);
      if (playerColor !== "blue") {
        return { ok: false, error: "Only the second player can decide swap." };
      }

      const newState: HexPublicState = { ...state, cells: [...state.cells] };

      if (move.choice === "keep") {
        newState.swapDecision = "kept";
        newState.phase = "main";
        // Second player (blue) moves next — stay on current turn
        return {
          ok: true,
          nextPublicState: newState as unknown as Record<string, unknown>,
          turnAdvance: false,
          // Blue (current player) keeps their turn for the next normal move
        };
      } else {
        // Swap: flip color assignments
        const newColorByUid: Record<string, "red" | "blue"> = {};
        for (const [uid, color] of Object.entries(state.colorByUid)) {
          newColorByUid[uid] = color === "red" ? "blue" : "red";
        }
        newState.colorByUid = newColorByUid;
        newState.swapDecision = "swapped";
        newState.phase = "main";

        // Update lastMove to reflect the new color ownership of the opening stone
        if (newState.lastMove) {
          const openingPlacerNewColor =
            newColorByUid[newState.lastMove.uid] ?? "red";
          // The stone on the board now belongs to the swapper's new color
          // Actually: the stone stays where it is but now belongs to the player
          // who originally placed it (who is now "blue" after swap)
          // The opening stone color in cells needs to flip
          if (newState.openingMoveIndex !== null) {
            const oldColor = state.cells[newState.openingMoveIndex];
            newState.cells[newState.openingMoveIndex] =
              oldColor === "red" ? "blue" : "red";
          }
          newState.lastMove = {
            ...newState.lastMove,
            color: openingPlacerNewColor,
          };
        }

        // After swap, the original first player (now blue) gets the next turn
        return {
          ok: true,
          nextPublicState: newState as unknown as Record<string, unknown>,
          turnAdvance: true,
        };
      }
    }

    // ── PLACEMENT ───────────────────────────────────────────────────
    if (move.type !== "place") {
      return { ok: false, error: "Invalid move type." };
    }

    if (state.phase !== "opening" && state.phase !== "main") {
      return {
        ok: false,
        error:
          state.phase === "swap_pending"
            ? "Waiting for swap decision."
            : "Cannot place stones now.",
      };
    }

    const { index } = move;
    if (typeof index !== "number" || !Number.isInteger(index)) {
      return { ok: false, error: "Invalid cell index." };
    }
    if (index < 0 || index >= TOTAL_CELLS) {
      return { ok: false, error: "Cell index out of bounds." };
    }
    if (state.cells[index] !== null) {
      return { ok: false, error: "Cell is already occupied." };
    }

    const color = getUidColor(state, ctx.uid);
    if (!color) {
      return { ok: false, error: "Player has no assigned color." };
    }

    // Apply placement
    const newCells = [...state.cells];
    newCells[index] = color;

    const newState: HexPublicState = {
      ...state,
      cells: newCells,
      moveCount: state.moveCount + 1,
      lastMove: { uid: ctx.uid, color, index },
    };

    // Opening phase: first move transitions to swap_pending
    if (state.phase === "opening") {
      newState.openingMoveIndex = index;
      newState.phase = "swap_pending";
      newState.swapDecision = "pending";

      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: true,
      };
    }

    // Main phase: check for win
    const winPath = checkWin(newCells, color);
    if (winPath) {
      newState.winnerUid = ctx.uid;
      newState.winningPath = winPath;
      newState.phase = "resolved";

      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: {
          type: "win",
          winnerIds: [ctx.uid],
        },
      };
    }

    // Game continues — advance turn
    return {
      ok: true,
      nextPublicState: newState as unknown as Record<string, unknown>,
      turnAdvance: true,
    };
  },

  // ── Summary ─────────────────────────────────────────────────────────

  computeSummary(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    currentTurnPlayerId: string | null,
  ) {
    const state = publicState as unknown as HexPublicState;
    return {
      turnPlayerId: currentTurnPlayerId,
      scoreSummary: players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: state.winnerUid === p.uid ? 1 : 0,
      })),
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as HexPublicState;

    if (state.winnerUid) {
      const winnerId = state.winnerUid;
      const loserId = players.find((p) => p.uid !== winnerId)?.uid ?? "";
      const winnerColor = state.colorByUid[winnerId] ?? "red";
      const loserColor = winnerColor === "red" ? "blue" : "red";

      return {
        winnerIds: [winnerId],
        finalScoreboard: [
          {
            uid: winnerId,
            score: 1,
            placement: 1,
            stats: {
              color: winnerColor,
              totalMoves: state.moveCount,
              swapDecision: state.swapDecision,
            },
          },
          {
            uid: loserId,
            score: 0,
            placement: 2,
            stats: {
              color: loserColor,
              totalMoves: state.moveCount,
              swapDecision: state.swapDecision,
            },
          },
        ],
      };
    }

    // Fallback (resign/disconnect before win — system still calls computeOutcome)
    return {
      winnerIds: [],
      finalScoreboard: players.map((p) => ({
        uid: p.uid,
        score: 0,
        placement: 1,
        stats: {
          color: state.colorByUid[p.uid] ?? null,
          totalMoves: state.moveCount,
          swapDecision: state.swapDecision,
        },
      })),
    };
  },

  // ── Performance ─────────────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    _players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as HexPublicState;
    return {
      boardSize: state.boardSize,
      swapUsed: state.swapDecision === "swapped",
      swapDeclinedByWinner:
        state.swapDecision === "kept" && state.winnerUid !== null,
      totalMoves: state.moveCount,
      winningPathLength: state.winningPath?.length ?? 0,
      winnerColor: state.winnerUid
        ? (state.colorByUid[state.winnerUid] ?? null)
        : null,
    };
  },
};

// Auto-register on import
registerAdapter(hexAdapter);

export default hexAdapter;
