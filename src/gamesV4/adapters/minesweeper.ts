/**
 * Games V4 — Minesweeper (Solo) Adapter
 *
 * Deterministic game logic adapter for Minesweeper.
 * Solo game — no multiplayer turn order.
 *
 * Move types:
 *   - reveal   { action: "reveal", cell: number }
 *   - flag     { action: "flag", cell: number }
 *   - chord    { action: "chord", cell: number }
 *   - restart  { action: "restart", difficulty?: MinesweeperDifficulty }
 *
 * The board is generated deterministically from a seed on first reveal,
 * ensuring client/server parity.
 *
 * @module gamesV4/adapters/minesweeper
 */

import {
  chordReveal,
  createInitialState,
  revealCell,
  toggleFlag,
} from "../games/minesweeper/engine";
import type {
  MinesweeperDifficulty,
  MinesweeperMove,
  MinesweeperPublicState,
} from "../games/minesweeper/types";
import { encodeBestScore, formatBestScore } from "../games/minesweeper/types";
import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
} from "../types/adapter";
import { registerAdapter } from "./registry";

// =============================================================================
// Constants
// =============================================================================

const VALID_ACTIONS = new Set(["reveal", "flag", "chord", "restart"]);
const VALID_DIFFICULTIES = new Set(["easy", "intermediate", "expert"]);

// =============================================================================
// Adapter Implementation
// =============================================================================

const minesweeperAdapter: GameAdapterV4 = {
  gameId: "minesweeper",
  runtimeType: "solo",
  maxPlayers: 1,
  minPlayers: 1,
  supportsSpectate: false,
  spectateMode: "public_only",

  scoreboardDescriptor: {
    title: "CLEAR TIME",
    formatScore: (s) => formatBestScore(s),
    sortDirection: "desc",
  },

  settingsSchema: [
    {
      key: "difficulty",
      label: "Difficulty",
      type: "select",
      default: "easy",
      options: [
        { label: "Easy (9×9, 10 mines)", value: "easy" },
        { label: "Intermediate (16×16, 40 mines)", value: "intermediate" },
        { label: "Expert (30×16, 99 mines)", value: "expert" },
      ],
    },
  ],
  defaultSettings: { difficulty: "easy" },

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    _players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const difficulty = (settings.difficulty as MinesweeperDifficulty) || "easy";
    const state = createInitialState(difficulty);
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
    const state = publicState as unknown as MinesweeperPublicState;
    const move = movePayload as unknown as MinesweeperMove;

    // Validate action
    if (!move.action || !VALID_ACTIONS.has(move.action)) {
      return { ok: false, error: "Invalid action." };
    }

    const nowMs = Date.now();

    // ── Restart ──
    if (move.action === "restart") {
      const diff =
        move.difficulty && VALID_DIFFICULTIES.has(move.difficulty)
          ? move.difficulty
          : state.difficulty;
      const newState = createInitialState(diff as MinesweeperDifficulty);
      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        scoreDelta: [],
        turnAdvance: false,
      };
    }

    // Validate cell index for reveal/flag/chord
    if (move.cell === undefined || move.cell === null) {
      return { ok: false, error: "Cell index required." };
    }

    const cellIdx = move.cell;
    if (cellIdx < 0 || cellIdx >= state.rows * state.cols) {
      return { ok: false, error: "Cell index out of bounds." };
    }

    // ── Flag ──
    if (move.action === "flag") {
      const newState = toggleFlag(state, cellIdx);
      if (newState === state) {
        return { ok: false, error: "Cannot flag this cell." };
      }
      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        scoreDelta: [],
        turnAdvance: false,
      };
    }

    // ── Reveal ──
    if (move.action === "reveal") {
      // Can't reveal if game is over
      if (state.status === "won" || state.status === "lost") {
        return { ok: false, error: "Game is already over." };
      }

      const result = revealCell(state, cellIdx, nowMs);
      if (result.cellsRevealed === 0 && !result.hitMine) {
        return { ok: false, error: "Cannot reveal this cell." };
      }

      const newState = result.state;
      const isTerminal =
        newState.status === "won" || newState.status === "lost";

      if (isTerminal) {
        const isWin = newState.status === "won";
        const score = isWin
          ? encodeBestScore(newState.difficulty, newState.elapsedMs)
          : 0;

        return {
          ok: true,
          nextPublicState: newState as unknown as Record<string, unknown>,
          scoreDelta: [{ uid: ctx.uid, delta: score }],
          turnAdvance: false,
          terminal: {
            type: isWin ? "win" : "timeout",
            winnerIds: isWin ? [ctx.uid] : [],
            reason: isWin
              ? `Cleared ${newState.difficulty} in ${formatTimeShort(newState.elapsedMs)}!`
              : "Hit a mine!",
          },
        };
      }

      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        scoreDelta: [],
        turnAdvance: false,
      };
    }

    // ── Chord ──
    if (move.action === "chord") {
      if (state.status !== "active") {
        return { ok: false, error: "Game is not active." };
      }

      const result = chordReveal(state, cellIdx, nowMs);
      if (result.cellsRevealed === 0 && !result.hitMine) {
        return { ok: false, error: "Cannot chord this cell." };
      }

      const newState = result.state;
      const isTerminal =
        newState.status === "won" || newState.status === "lost";

      if (isTerminal) {
        const isWin = newState.status === "won";
        const score = isWin
          ? encodeBestScore(newState.difficulty, newState.elapsedMs)
          : 0;

        return {
          ok: true,
          nextPublicState: newState as unknown as Record<string, unknown>,
          scoreDelta: [{ uid: ctx.uid, delta: score }],
          turnAdvance: false,
          terminal: {
            type: isWin ? "win" : "timeout",
            winnerIds: isWin ? [ctx.uid] : [],
            reason: isWin
              ? `Cleared ${newState.difficulty} in ${formatTimeShort(newState.elapsedMs)}!`
              : "Hit a mine!",
          },
        };
      }

      return {
        ok: true,
        nextPublicState: newState as unknown as Record<string, unknown>,
        scoreDelta: [],
        turnAdvance: false,
      };
    }

    return { ok: false, error: "Unknown action." };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(
    publicState: Record<string, unknown>,
    players: Array<{ uid: string; slotIndex: number }>,
  ): GameOutcome {
    const state = publicState as unknown as MinesweeperPublicState;
    const uid = players[0]?.uid ?? "";
    const isWin = state.status === "won";
    const score = isWin
      ? encodeBestScore(state.difficulty, state.elapsedMs)
      : 0;

    return {
      winnerIds: isWin ? [uid] : [],
      finalScoreboard: [
        {
          uid,
          score,
          placement: 1,
          stats: {
            difficulty: state.difficulty,
            elapsedMs: state.elapsedMs,
            revealedCount: state.revealedCount,
            totalSafeCells: state.totalSafeCells,
            flagCount: state.flagCount,
            moveCount: state.moveCount,
            chordCount: state.chordCount,
            floodCount: state.floodCount,
            won: isWin,
          },
        },
      ],
    };
  },

  // ── Performance Metrics ─────────────────────────────────────────────

  extractPerformanceMetrics(
    publicState: Record<string, unknown>,
    _players: Array<{ uid: string }>,
  ): Record<string, unknown> {
    const state = publicState as unknown as MinesweeperPublicState;
    return {
      difficulty: state.difficulty,
      cols: state.cols,
      rows: state.rows,
      mineCount: state.mineCount,
      elapsedMs: state.elapsedMs,
      revealedCount: state.revealedCount,
      totalSafeCells: state.totalSafeCells,
      flagCount: state.flagCount,
      moveCount: state.moveCount,
      chordCount: state.chordCount,
      floodCount: state.floodCount,
      won: state.status === "won",
      lost: state.status === "lost",
    };
  },
};

// =============================================================================
// Helpers
// =============================================================================

function formatTimeShort(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Auto-register on import
registerAdapter(minesweeperAdapter);

export default minesweeperAdapter;
