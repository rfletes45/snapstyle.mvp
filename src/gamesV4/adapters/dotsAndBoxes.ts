/**
 * Games V4 — Dots & Boxes Adapter
 *
 * Pure, deterministic game logic for Dots & Boxes.
 * Shared between client (optimistic preview) and server (authoritative).
 *
 * Board: configurable grid of boxes (3×3, 4×4, 5×5).
 * Players: exactly 2. Player 0 goes first.
 *
 * Players take turns drawing one edge between adjacent dots.
 * Completing a box claims it and grants an extra turn.
 * A single edge can close 0, 1, or 2 boxes.
 * Game ends when all edges are filled; most boxes wins.
 *
 * State uses flat arrays for Firestore safety:
 *   horizontalEdges: length = (rows + 1) * cols
 *   verticalEdges:   length = rows * (cols + 1)
 *   boxOwners:       length = rows * cols
 *
 * @module gamesV4/adapters/dotsAndBoxes
 */

import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
  SettingsFieldDef,
} from "../types/adapter";
import { registerAdapter } from "./registry";

// =============================================================================
// Types
// =============================================================================

interface DotsAndBoxesPublicState {
  rows: number;
  cols: number;
  boardKey: string; // "3x3" | "4x4" | "5x5"
  horizontalEdges: boolean[];
  verticalEdges: boolean[];
  boxOwners: (string | null)[];
  scoresByUid: Record<string, number>;
  boxesClaimed: number;
  remainingEdges: number;
  moveNumber: number;
  lastMove: { edgeType: "h" | "v"; row: number; col: number } | null;
  turnRetained: boolean;
  lastCapturedBoxes: number[];
  // Tracking for metrics
  extraTurnsEarnedByUid: Record<string, number>;
  largestSingleTurnCaptureByUid: Record<string, number>;
  largestChainCapturedByUid: Record<string, number>;
  currentChainByUid: Record<string, number>;
  finalBoxOwnerUid: string | null;
}

// =============================================================================
// Constants
// =============================================================================

const BOARD_PRESETS: Record<string, { rows: number; cols: number }> = {
  quick: { rows: 3, cols: 3 },
  standard: { rows: 4, cols: 4 },
  expert: { rows: 5, cols: 5 },
};

// =============================================================================
// Index helpers
// =============================================================================

/** Horizontal edge at dot-row r, dot-col c → index in flat array.
 *  There are (rows+1) dot-rows and cols horizontal segments per dot-row. */
function hIdx(r: number, c: number, cols: number): number {
  return r * cols + c;
}

/** Vertical edge at dot-row r, dot-col c → index in flat array.
 *  There are rows dot-row-gaps and (cols+1) vertical segments per gap. */
function vIdx(r: number, c: number, cols: number): number {
  return r * (cols + 1) + c;
}

/** Box at grid row r, grid col c → index in flat array. */
function boxIdx(r: number, c: number, cols: number): number {
  return r * cols + c;
}

// =============================================================================
// Pure Logic Helpers
// =============================================================================

function getBoardDims(settings: Record<string, unknown>): {
  rows: number;
  cols: number;
  boardKey: string;
} {
  const preset = (settings.boardSize as string) ?? "standard";
  const dims = BOARD_PRESETS[preset] ?? BOARD_PRESETS.standard;
  return { ...dims, boardKey: `${dims.rows}x${dims.cols}` };
}

function totalHorizontalEdges(rows: number, cols: number): number {
  return (rows + 1) * cols;
}

function totalVerticalEdges(rows: number, cols: number): number {
  return rows * (cols + 1);
}

function totalEdges(rows: number, cols: number): number {
  return totalHorizontalEdges(rows, cols) + totalVerticalEdges(rows, cols);
}

function totalBoxes(rows: number, cols: number): number {
  return rows * cols;
}

/**
 * Given a newly placed edge, determine which boxes (0, 1, or 2) it completes.
 * Returns array of box indices that are now fully enclosed.
 */
function findCompletedBoxes(
  edgeType: "h" | "v",
  row: number,
  col: number,
  hEdges: boolean[],
  vEdges: boolean[],
  rows: number,
  cols: number,
): number[] {
  const completed: number[] = [];

  if (edgeType === "h") {
    // Horizontal edge at dot-row=row, segment=col
    // Could complete box above (row-1, col) and box below (row, col)
    // Box above exists if row > 0
    if (row > 0) {
      const bRow = row - 1;
      const bCol = col;
      if (isBoxComplete(bRow, bCol, hEdges, vEdges, cols)) {
        completed.push(boxIdx(bRow, bCol, cols));
      }
    }
    // Box below exists if row < rows
    if (row < rows) {
      const bRow = row;
      const bCol = col;
      if (isBoxComplete(bRow, bCol, hEdges, vEdges, cols)) {
        completed.push(boxIdx(bRow, bCol, cols));
      }
    }
  } else {
    // Vertical edge at dot-row=row, dot-col=col
    // Could complete box to the left (row, col-1) and box to the right (row, col)
    if (col > 0) {
      const bRow = row;
      const bCol = col - 1;
      if (isBoxComplete(bRow, bCol, hEdges, vEdges, cols)) {
        completed.push(boxIdx(bRow, bCol, cols));
      }
    }
    if (col < cols) {
      const bRow = row;
      const bCol = col;
      if (isBoxComplete(bRow, bCol, hEdges, vEdges, cols)) {
        completed.push(boxIdx(bRow, bCol, cols));
      }
    }
  }

  return completed;
}

/**
 * Check if box at (bRow, bCol) has all 4 edges filled.
 * A box needs:
 *   top:    horizontal edge at (bRow, bCol)
 *   bottom: horizontal edge at (bRow+1, bCol)
 *   left:   vertical edge at (bRow, bCol)
 *   right:  vertical edge at (bRow, bCol+1)
 */
function isBoxComplete(
  bRow: number,
  bCol: number,
  hEdges: boolean[],
  vEdges: boolean[],
  cols: number,
): boolean {
  const top = hEdges[hIdx(bRow, bCol, cols)];
  const bottom = hEdges[hIdx(bRow + 1, bCol, cols)];
  const left = vEdges[vIdx(bRow, bCol, cols)];
  const right = vEdges[vIdx(bRow, bCol + 1, cols)];
  return top && bottom && left && right;
}

// =============================================================================
// Adapter Implementation
// =============================================================================

const dotsAndBoxesAdapter: GameAdapterV4 = {
  gameId: "dots_and_boxes",
  runtimeType: "turnBased",
  maxPlayers: 2,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "full_state",

  scoreboardDescriptor: {
    title: "BOXES CLAIMED",
    sortDirection: "desc",
  },

  settingsSchema: [
    {
      key: "boardSize",
      label: "Board Size",
      type: "select",
      default: "standard",
      options: [
        { label: "Quick (3×3)", value: "quick" },
        { label: "Standard (4×4)", value: "standard" },
        { label: "Expert (5×5)", value: "expert" },
      ],
    } as SettingsFieldDef,
  ],

  defaultSettings: { boardSize: "standard" },

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const { rows, cols, boardKey } = getBoardDims(settings);
    const hCount = totalHorizontalEdges(rows, cols);
    const vCount = totalVerticalEdges(rows, cols);
    const bCount = totalBoxes(rows, cols);
    const edgeCount = hCount + vCount;

    const scoresByUid: Record<string, number> = {};
    const extraTurnsEarnedByUid: Record<string, number> = {};
    const largestSingleTurnCaptureByUid: Record<string, number> = {};
    const largestChainCapturedByUid: Record<string, number> = {};
    const currentChainByUid: Record<string, number> = {};
    for (const p of players) {
      scoresByUid[p.uid] = 0;
      extraTurnsEarnedByUid[p.uid] = 0;
      largestSingleTurnCaptureByUid[p.uid] = 0;
      largestChainCapturedByUid[p.uid] = 0;
      currentChainByUid[p.uid] = 0;
    }

    const state: DotsAndBoxesPublicState = {
      rows,
      cols,
      boardKey,
      horizontalEdges: new Array(hCount).fill(false),
      verticalEdges: new Array(vCount).fill(false),
      boxOwners: new Array(bCount).fill(null),
      scoresByUid,
      boxesClaimed: 0,
      remainingEdges: edgeCount,
      moveNumber: 0,
      lastMove: null,
      turnRetained: false,
      lastCapturedBoxes: [],
      extraTurnsEarnedByUid,
      largestSingleTurnCaptureByUid,
      largestChainCapturedByUid,
      currentChainByUid,
      finalBoxOwnerUid: null,
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
    const state = publicState as unknown as DotsAndBoxesPublicState;
    const { edgeType, row, col } = movePayload as {
      edgeType: string;
      row: number;
      col: number;
    };

    // Validate edge type
    if (edgeType !== "h" && edgeType !== "v") {
      return { ok: false, error: "Invalid edge type." };
    }

    // Validate coordinates
    if (typeof row !== "number" || typeof col !== "number") {
      return { ok: false, error: "Invalid coordinates." };
    }

    const { rows, cols } = state;

    // Bounds check
    if (edgeType === "h") {
      // Horizontal: dot-rows 0..rows, segments 0..cols-1
      if (row < 0 || row > rows || col < 0 || col >= cols) {
        return { ok: false, error: "Edge out of bounds." };
      }
      const idx = hIdx(row, col, cols);
      if (state.horizontalEdges[idx]) {
        return { ok: false, error: "Edge already taken." };
      }
    } else {
      // Vertical: dot-rows 0..rows-1, dot-cols 0..cols
      if (row < 0 || row >= rows || col < 0 || col > cols) {
        return { ok: false, error: "Edge out of bounds." };
      }
      const idx = vIdx(row, col, cols);
      if (state.verticalEdges[idx]) {
        return { ok: false, error: "Edge already taken." };
      }
    }

    // Apply move — clone arrays
    const newHEdges = [...state.horizontalEdges];
    const newVEdges = [...state.verticalEdges];
    const newBoxOwners = [...state.boxOwners];

    if (edgeType === "h") {
      newHEdges[hIdx(row, col, cols)] = true;
    } else {
      newVEdges[vIdx(row, col, cols)] = true;
    }

    // Detect completed boxes
    const completedBoxIndices = findCompletedBoxes(
      edgeType as "h" | "v",
      row,
      col,
      newHEdges,
      newVEdges,
      rows,
      cols,
    );

    // Assign ownership of completed boxes
    for (const bi of completedBoxIndices) {
      newBoxOwners[bi] = ctx.uid;
    }

    const boxesScored = completedBoxIndices.length;
    const newScores = { ...state.scoresByUid };
    newScores[ctx.uid] = (newScores[ctx.uid] ?? 0) + boxesScored;

    const newBoxesClaimed = state.boxesClaimed + boxesScored;
    const newRemainingEdges = state.remainingEdges - 1;
    const turnRetained = boxesScored > 0;

    // Update tracking metrics
    const newExtraTurns = { ...state.extraTurnsEarnedByUid };
    const newLargestSingle = { ...state.largestSingleTurnCaptureByUid };
    const newLargestChain = { ...state.largestChainCapturedByUid };
    const newCurrentChain = { ...state.currentChainByUid };

    if (boxesScored > 0) {
      newExtraTurns[ctx.uid] = (newExtraTurns[ctx.uid] ?? 0) + 1;
      if (boxesScored > (newLargestSingle[ctx.uid] ?? 0)) {
        newLargestSingle[ctx.uid] = boxesScored;
      }
      // Continue the chain: add boxes scored this turn to running chain
      newCurrentChain[ctx.uid] = (newCurrentChain[ctx.uid] ?? 0) + boxesScored;
      if (newCurrentChain[ctx.uid] > (newLargestChain[ctx.uid] ?? 0)) {
        newLargestChain[ctx.uid] = newCurrentChain[ctx.uid];
      }
    } else {
      // Chain broken — reset for this player
      newCurrentChain[ctx.uid] = 0;
    }

    // Track who claimed the final box
    const newFinalBoxOwner =
      newRemainingEdges === 0 && boxesScored > 0
        ? ctx.uid
        : newRemainingEdges === 0
          ? state.finalBoxOwnerUid
          : boxesScored > 0
            ? ctx.uid
            : state.finalBoxOwnerUid;

    const newState: DotsAndBoxesPublicState = {
      rows,
      cols,
      boardKey: state.boardKey,
      horizontalEdges: newHEdges,
      verticalEdges: newVEdges,
      boxOwners: newBoxOwners,
      scoresByUid: newScores,
      boxesClaimed: newBoxesClaimed,
      remainingEdges: newRemainingEdges,
      moveNumber: state.moveNumber + 1,
      lastMove: { edgeType: edgeType as "h" | "v", row, col },
      turnRetained,
      lastCapturedBoxes: completedBoxIndices,
      extraTurnsEarnedByUid: newExtraTurns,
      largestSingleTurnCaptureByUid: newLargestSingle,
      largestChainCapturedByUid: newLargestChain,
      currentChainByUid: newCurrentChain,
      finalBoxOwnerUid: newFinalBoxOwner,
    };

    // Check if game is over
    if (newRemainingEdges === 0) {
      const p0 = ctx.turnOrder[0];
      const p1 = ctx.turnOrder[1];
      const s0 = newScores[p0] ?? 0;
      const s1 = newScores[p1] ?? 0;

      if (s0 === s1) {
        return {
          ok: true,
          nextPublicState: newState as unknown as Record<string, unknown>,
          turnAdvance: false,
          terminal: { type: "draw" },
        };
      }

      const winnerId = s0 > s1 ? p0 : p1;
      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        turnAdvance: false,
        terminal: { type: "win", winnerIds: [winnerId] },
      };
    }

    // Game continues
    return {
      ok: true,
      nextPublicState: newState as unknown as Record<string, unknown>,
      turnAdvance: !turnRetained,
    };
  },

  // ── Summary ─────────────────────────────────────────────────────────

  computeSummary(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; displayName: string }>,
    currentTurnPlayerId: string | null,
  ) {
    const state = publicState as unknown as DotsAndBoxesPublicState;
    return {
      turnPlayerId: currentTurnPlayerId,
      scoreSummary: players.map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: state.scoresByUid[p.uid] ?? 0,
      })),
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as DotsAndBoxesPublicState;
    const total = totalBoxes(state.rows, state.cols);

    const entries = players
      .map((p) => ({
        uid: p.uid,
        score: state.scoresByUid[p.uid] ?? 0,
        slotIndex: p.slotIndex,
      }))
      .sort((a, b) => b.score - a.score);

    const topScore = entries[0]?.score ?? 0;
    const isTie = entries.length > 1 && entries[0].score === entries[1].score;

    if (isTie) {
      return {
        winnerIds: [],
        finalScoreboard: entries.map((e) => ({
          uid: e.uid,
          score: e.score,
          placement: 1,
          stats: {
            boxesClaimed: e.score,
            boardKey: state.boardKey,
            winMargin: 0,
          },
        })),
      };
    }

    const winnerId = entries[0].uid;
    const winMargin = entries[0].score - (entries[1]?.score ?? 0);

    return {
      winnerIds: [winnerId],
      finalScoreboard: entries.map((e, i) => ({
        uid: e.uid,
        score: e.score,
        placement: i + 1,
        stats: {
          boxesClaimed: e.score,
          boardKey: state.boardKey,
          winMargin: e.uid === winnerId ? winMargin : -winMargin,
        },
      })),
    };
  },

  // ── Spectator ──────────────────────────────────────────────────────

  getSpectatorView(
    publicState: Record<string, unknown>,
  ): Record<string, unknown> {
    return publicState; // Full state — no hidden information
  },

  // ── Performance Metrics ────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as DotsAndBoxesPublicState;
    const { rows, cols } = state;
    const tb = totalBoxes(rows, cols);
    const te = totalEdges(rows, cols);

    const scores = state.scoresByUid;
    const uids = players.map((p) => p.uid);
    const p0 = uids[0];
    const p1 = uids[1];
    const s0 = scores[p0] ?? 0;
    const s1 = scores[p1] ?? 0;
    const winMargin = Math.abs(s0 - s1);

    // Determine opponent boxes per uid
    const opponentBoxesByUid: Record<string, number> = {};
    if (p0 && p1) {
      opponentBoxesByUid[p0] = s1;
      opponentBoxesByUid[p1] = s0;
    }

    // Shutout detection
    const shutoutByUid: Record<string, boolean> = {};
    for (const uid of uids) {
      const oppScore = opponentBoxesByUid[uid] ?? 0;
      shutoutByUid[uid] = oppScore === 0 && (scores[uid] ?? 0) > 0;
    }

    return {
      boardKey: state.boardKey,
      boardRows: rows,
      boardCols: cols,
      totalBoxes: tb,
      totalEdges: te,
      totalMoves: state.moveNumber,
      scoresByUid: scores,
      winMargin,
      opponentBoxesByUid,
      finalBoxOwnerUid: state.finalBoxOwnerUid,
      largestSingleTurnCaptureByUid: state.largestSingleTurnCaptureByUid,
      largestChainCapturedByUid: state.largestChainCapturedByUid,
      extraTurnsEarnedByUid: state.extraTurnsEarnedByUid,
      shutoutByUid,
    };
  },

  // ── Settings Validation ────────────────────────────────────────────

  validateSettings(patch: Record<string, unknown>): Record<string, unknown> {
    const boardSize = patch.boardSize;
    if (
      typeof boardSize === "string" &&
      Object.prototype.hasOwnProperty.call(BOARD_PRESETS, boardSize)
    ) {
      return { boardSize };
    }
    return { boardSize: "standard" };
  },
};

// Auto-register on import
registerAdapter(dotsAndBoxesAdapter);

export default dotsAndBoxesAdapter;
