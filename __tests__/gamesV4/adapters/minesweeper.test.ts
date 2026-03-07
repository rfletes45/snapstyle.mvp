/**
 * Games V4 — Minesweeper Adapter + Engine Unit Tests
 *
 * Tests the pure game engine and adapter logic:
 * - Seeded PRNG determinism
 * - Board generation (mine count, adjacency, first-click safety)
 * - Reveal mechanics (single, flood-fill, mine hit)
 * - Flag toggling
 * - Chord reveal (correct + incorrect flags)
 * - Win / loss detection
 * - PB encoding / decoding round-trip
 * - Adapter validateMove for all action types
 * - Adapter computeOutcome + extractPerformanceMetrics
 */

import minesweeperAdapter from "@/gamesV4/adapters/minesweeper";
import {
  chordReveal,
  createInitialState,
  createRNG,
  fromIndex,
  generateBoard,
  getIncorrectFlags,
  getNeighbors,
  getRemainingMines,
  revealCell,
  toIndex,
  toggleFlag,
} from "@/gamesV4/games/minesweeper/engine";
import type { MinesweeperPublicState } from "@/gamesV4/games/minesweeper/types";
import {
  DIFFICULTY_PRESETS,
  decodeBestScore,
  encodeBestScore,
  formatBestScore,
  formatTime,
} from "@/gamesV4/games/minesweeper/types";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS = [{ uid: "solo", slotIndex: 0 }];
const NOW = 1_700_000_000_000;

function makeCtx() {
  return {
    uid: "solo",
    turnOrder: ["solo"],
    currentTurnIndex: 0,
    settings: { difficulty: "easy" },
  };
}

// =============================================================================
// Engine Tests: PRNG
// =============================================================================

describe("Minesweeper Engine — PRNG", () => {
  it("produces deterministic output from the same seed", () => {
    const rng1 = createRNG(42);
    const rng2 = createRNG(42);
    const vals1 = Array.from({ length: 20 }, () => rng1());
    const vals2 = Array.from({ length: 20 }, () => rng2());
    expect(vals1).toEqual(vals2);
  });

  it("produces different output from different seeds", () => {
    const rng1 = createRNG(42);
    const rng2 = createRNG(99);
    const v1 = rng1();
    const v2 = rng2();
    expect(v1).not.toBe(v2);
  });

  it("produces values in [0, 1)", () => {
    const rng = createRNG(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// =============================================================================
// Engine Tests: Board Helpers
// =============================================================================

describe("Minesweeper Engine — Board Helpers", () => {
  it("toIndex / fromIndex are inverse", () => {
    const cols = 9;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const idx = toIndex(r, c, cols);
        expect(fromIndex(idx, cols)).toEqual([r, c]);
      }
    }
  });

  it("getNeighbors returns correct count for corners, edges, and center", () => {
    const rows = 9,
      cols = 9;
    // Corner (0,0) → 3 neighbors
    expect(getNeighbors(toIndex(0, 0, cols), rows, cols)).toHaveLength(3);
    // Edge (0,4) → 5 neighbors
    expect(getNeighbors(toIndex(0, 4, cols), rows, cols)).toHaveLength(5);
    // Center (4,4) → 8 neighbors
    expect(getNeighbors(toIndex(4, 4, cols), rows, cols)).toHaveLength(8);
  });
});

// =============================================================================
// Engine Tests: Board Generation
// =============================================================================

describe("Minesweeper Engine — Board Generation", () => {
  it("places the correct number of mines", () => {
    const board = generateBoard(9, 9, 10, 42, toIndex(4, 4, 9));
    const mineCount = board.filter((v) => v === -1).length;
    expect(mineCount).toBe(10);
  });

  it("is deterministic for the same seed + firstClick", () => {
    const b1 = generateBoard(9, 9, 10, 42, 0);
    const b2 = generateBoard(9, 9, 10, 42, 0);
    expect(b1).toEqual(b2);
  });

  it("first-click cell and its neighbors are guaranteed safe", () => {
    const rows = 9,
      cols = 9;
    const firstClick = toIndex(4, 4, cols);
    const board = generateBoard(rows, cols, 10, 42, firstClick);

    expect(board[firstClick]).not.toBe(-1);
    for (const n of getNeighbors(firstClick, rows, cols)) {
      expect(board[n]).not.toBe(-1);
    }
  });

  it("adjacency counts are correct for all non-mine cells", () => {
    const rows = 9,
      cols = 9;
    const board = generateBoard(rows, cols, 10, 42, 0);

    for (let i = 0; i < rows * cols; i++) {
      if (board[i] === -1) continue;
      const neighbors = getNeighbors(i, rows, cols);
      const expectedCount = neighbors.filter((n) => board[n] === -1).length;
      expect(board[i]).toBe(expectedCount);
    }
  });

  it("works for all difficulty presets", () => {
    for (const [key, preset] of Object.entries(DIFFICULTY_PRESETS)) {
      const board = generateBoard(
        preset.rows,
        preset.cols,
        preset.mineCount,
        42,
        0,
      );
      const mineCount = board.filter((v) => v === -1).length;
      expect(mineCount).toBe(preset.mineCount);
      expect(board).toHaveLength(preset.rows * preset.cols);
    }
  });
});

// =============================================================================
// Engine Tests: State Creation
// =============================================================================

describe("Minesweeper Engine — State Creation", () => {
  it("creates a valid initial state", () => {
    const state = createInitialState("easy");
    expect(state.difficulty).toBe("easy");
    expect(state.cols).toBe(9);
    expect(state.rows).toBe(9);
    expect(state.mineCount).toBe(10);
    expect(state.boardGenerated).toBe(false);
    expect(state.status).toBe("idle");
    expect(state.revealedCount).toBe(0);
    expect(state.totalSafeCells).toBe(71); // 81 - 10
    expect(state.flagCount).toBe(0);
    expect(state.board).toHaveLength(81);
    expect(state.cellStates).toHaveLength(81);
    expect(state.cellStates.every((s) => s === "hidden")).toBe(true);
  });

  it("uses provided seed", () => {
    const state = createInitialState("easy", 42);
    expect(state.seed).toBe(42);
  });

  it("creates intermediate with correct dimensions", () => {
    const state = createInitialState("intermediate");
    expect(state.cols).toBe(16);
    expect(state.rows).toBe(16);
    expect(state.mineCount).toBe(40);
    expect(state.totalSafeCells).toBe(216);
  });

  it("creates expert with correct dimensions", () => {
    const state = createInitialState("expert");
    expect(state.cols).toBe(30);
    expect(state.rows).toBe(16);
    expect(state.mineCount).toBe(99);
    expect(state.totalSafeCells).toBe(381);
  });
});

// =============================================================================
// Engine Tests: Reveal
// =============================================================================

describe("Minesweeper Engine — Reveal", () => {
  it("generates board on first reveal and starts timer", () => {
    const state = createInitialState("easy", 42);
    const result = revealCell(state, 40, NOW); // center cell
    expect(result.state.boardGenerated).toBe(true);
    expect(result.state.status).toBe("active");
    expect(result.state.startedAtMs).toBe(NOW);
    expect(result.cellsRevealed).toBeGreaterThan(0);
    expect(result.hitMine).toBe(false);
  });

  it("flood-fills from a zero cell", () => {
    const state = createInitialState("easy", 42);
    // First click on center is guaranteed safe; if it's a 0, will flood fill
    const result = revealCell(state, 40, NOW);
    // Should have revealed multiple cells
    expect(result.cellsRevealed).toBeGreaterThanOrEqual(1);
  });

  it("does not reveal flagged cells", () => {
    let state = createInitialState("easy", 42);
    // First reveal to generate board
    state = revealCell(state, 40, NOW).state;
    // Flag a hidden cell
    const hiddenIdx = state.cellStates.findIndex((s) => s === "hidden");
    if (hiddenIdx >= 0) {
      state = toggleFlag(state, hiddenIdx);
      const result = revealCell(state, hiddenIdx, NOW + 1000);
      expect(result.cellsRevealed).toBe(0);
    }
  });

  it("does not reveal already-revealed cells", () => {
    let state = createInitialState("easy", 42);
    state = revealCell(state, 40, NOW).state;
    const revealedIdx = state.cellStates.findIndex((s) => s === "revealed");
    if (revealedIdx >= 0) {
      const result = revealCell(state, revealedIdx, NOW + 1000);
      expect(result.cellsRevealed).toBe(0);
    }
  });

  it("rejects out-of-bounds cell index", () => {
    const state = createInitialState("easy", 42);
    const result = revealCell(state, -1, NOW);
    expect(result.cellsRevealed).toBe(0);

    const result2 = revealCell(state, 999, NOW);
    expect(result2.cellsRevealed).toBe(0);
  });

  it("detects game loss when hitting a mine", () => {
    let state = createInitialState("easy", 42);
    // Reveal to generate board
    state = revealCell(state, 40, NOW).state;

    // Find a mine cell
    const mineIdx = state.board.findIndex(
      (v, i) => v === -1 && state.cellStates[i] === "hidden",
    );
    if (mineIdx >= 0) {
      const result = revealCell(state, mineIdx, NOW + 5000);
      expect(result.hitMine).toBe(true);
      expect(result.state.status).toBe("lost");
      expect(result.state.explodedCell).toBe(mineIdx);
      expect(result.state.elapsedMs).toBe(5000);
      // All mines should be revealed
      for (let i = 0; i < result.state.board.length; i++) {
        if (result.state.board[i] === -1) {
          expect(result.state.cellStates[i]).toBe("revealed");
        }
      }
    }
  });
});

// =============================================================================
// Engine Tests: Flag
// =============================================================================

describe("Minesweeper Engine — Flag", () => {
  it("toggles flag on hidden cell", () => {
    let state = createInitialState("easy", 42);
    state = revealCell(state, 40, NOW).state;

    const hiddenIdx = state.cellStates.findIndex((s) => s === "hidden");
    expect(hiddenIdx).toBeGreaterThanOrEqual(0);

    const flaggedState = toggleFlag(state, hiddenIdx);
    expect(flaggedState.cellStates[hiddenIdx]).toBe("flagged");
    expect(flaggedState.flagCount).toBe(state.flagCount + 1);

    // Toggle back
    const unflaggedState = toggleFlag(flaggedState, hiddenIdx);
    expect(unflaggedState.cellStates[hiddenIdx]).toBe("hidden");
    expect(unflaggedState.flagCount).toBe(state.flagCount);
  });

  it("does not flag revealed cells", () => {
    let state = createInitialState("easy", 42);
    state = revealCell(state, 40, NOW).state;

    const revealedIdx = state.cellStates.findIndex((s) => s === "revealed");
    if (revealedIdx >= 0) {
      const result = toggleFlag(state, revealedIdx);
      expect(result).toBe(state); // Same reference — no change
    }
  });

  it("increments moveCount on flag", () => {
    let state = createInitialState("easy", 42);
    state = revealCell(state, 40, NOW).state;

    const hiddenIdx = state.cellStates.findIndex((s) => s === "hidden");
    const mc = state.moveCount;
    state = toggleFlag(state, hiddenIdx);
    expect(state.moveCount).toBe(mc + 1);
  });

  it("getRemainingMines returns correct count", () => {
    let state = createInitialState("easy", 42);
    expect(getRemainingMines(state)).toBe(10);

    state = revealCell(state, 40, NOW).state;
    const hiddenIdx = state.cellStates.findIndex((s) => s === "hidden");
    state = toggleFlag(state, hiddenIdx);
    expect(getRemainingMines(state)).toBe(9);
  });
});

// =============================================================================
// Engine Tests: Chord Reveal
// =============================================================================

describe("Minesweeper Engine — Chord Reveal", () => {
  it("does nothing on unrevealed cell", () => {
    let state = createInitialState("easy", 42);
    state = revealCell(state, 40, NOW).state;

    const hiddenIdx = state.cellStates.findIndex((s) => s === "hidden");
    if (hiddenIdx >= 0) {
      const result = chordReveal(state, hiddenIdx, NOW + 1000);
      expect(result.cellsRevealed).toBe(0);
    }
  });

  it("does nothing when adjacent flag count doesn't match cell number", () => {
    let state = createInitialState("easy", 42);
    state = revealCell(state, 40, NOW).state;

    // Find a revealed numbered cell
    const numIdx = state.cellStates.findIndex(
      (s, i) => s === "revealed" && state.board[i] > 0,
    );
    if (numIdx >= 0) {
      // No flags placed yet, so chord should do nothing
      const result = chordReveal(state, numIdx, NOW + 1000);
      expect(result.cellsRevealed).toBe(0);
    }
  });

  it("does nothing on idle game", () => {
    const state = createInitialState("easy", 42);
    const result = chordReveal(state, 0, NOW);
    expect(result.cellsRevealed).toBe(0);
  });
});

// =============================================================================
// Engine Tests: Incorrect Flags
// =============================================================================

describe("Minesweeper Engine — Incorrect Flags", () => {
  it("detects flags placed on non-mine cells", () => {
    let state = createInitialState("easy", 42);
    state = revealCell(state, 40, NOW).state;

    // Find a hidden non-mine cell and flag it
    const safeCellIdx = state.board.findIndex(
      (v, i) => v !== -1 && state.cellStates[i] === "hidden",
    );
    if (safeCellIdx >= 0) {
      state = toggleFlag(state, safeCellIdx);
      const incorrect = getIncorrectFlags(state);
      expect(incorrect).toContain(safeCellIdx);
    }
  });

  it("correct flags are not reported", () => {
    let state = createInitialState("easy", 42);
    state = revealCell(state, 40, NOW).state;

    // Find a mine cell and flag it
    const mineIdx = state.board.findIndex(
      (v, i) => v === -1 && state.cellStates[i] === "hidden",
    );
    if (mineIdx >= 0) {
      state = toggleFlag(state, mineIdx);
      const incorrect = getIncorrectFlags(state);
      expect(incorrect).not.toContain(mineIdx);
    }
  });
});

// =============================================================================
// PB Encoding Tests
// =============================================================================

describe("Minesweeper — PB Encoding", () => {
  it("round-trips encodeBestScore ↔ decodeBestScore", () => {
    for (const diff of ["easy", "intermediate", "expert"] as const) {
      for (const ms of [0, 5000, 30000, 120000, 500000, 999999]) {
        const encoded = encodeBestScore(diff, ms);
        const decoded = decodeBestScore(encoded);
        expect(decoded.difficulty).toBe(diff);
        expect(decoded.elapsedMs).toBe(ms);
      }
    }
  });

  it("expert always outranks intermediate, intermediate outranks easy", () => {
    const easyFast = encodeBestScore("easy", 1000);
    const intermediateSlow = encodeBestScore("intermediate", 999000);
    const expertSlow = encodeBestScore("expert", 999000);

    expect(expertSlow).toBeGreaterThan(intermediateSlow);
    expect(intermediateSlow).toBeGreaterThan(easyFast);
  });

  it("faster times produce higher scores within same tier", () => {
    const fast = encodeBestScore("easy", 10000);
    const slow = encodeBestScore("easy", 60000);
    expect(fast).toBeGreaterThan(slow);
  });

  it("formatTime formats correctly", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5000)).toBe("0:05");
    expect(formatTime(65000)).toBe("1:05");
    expect(formatTime(3600000)).toBe("60:00");
  });

  it("formatBestScore produces readable output", () => {
    const score = encodeBestScore("expert", 161000);
    const formatted = formatBestScore(score);
    expect(formatted).toContain("Expert");
    expect(formatted).toContain("2:41");
  });
});

// =============================================================================
// Adapter Tests
// =============================================================================

describe("Minesweeper Adapter V4", () => {
  describe("metadata", () => {
    it("has correct classification", () => {
      expect(minesweeperAdapter.gameId).toBe("minesweeper");
      expect(minesweeperAdapter.runtimeType).toBe("solo");
      expect(minesweeperAdapter.maxPlayers).toBe(1);
      expect(minesweeperAdapter.minPlayers).toBe(1);
    });

    it("has a scoreboardDescriptor", () => {
      expect(minesweeperAdapter.scoreboardDescriptor).toBeDefined();
      expect(minesweeperAdapter.scoreboardDescriptor!.title).toBe("CLEAR TIME");
    });
  });

  describe("createInitialPublicState", () => {
    it("creates easy board by default", () => {
      const state = minesweeperAdapter.createInitialPublicState(PLAYERS, {
        difficulty: "easy",
      }) as unknown as MinesweeperPublicState;
      expect(state.difficulty).toBe("easy");
      expect(state.cols).toBe(9);
      expect(state.rows).toBe(9);
      expect(state.mineCount).toBe(10);
      expect(state.status).toBe("idle");
    });

    it("creates expert board when specified", () => {
      const state = minesweeperAdapter.createInitialPublicState(PLAYERS, {
        difficulty: "expert",
      }) as unknown as MinesweeperPublicState;
      expect(state.difficulty).toBe("expert");
      expect(state.cols).toBe(30);
      expect(state.rows).toBe(16);
      expect(state.mineCount).toBe(99);
    });
  });

  describe("validateMove — reveal", () => {
    it("accepts a valid reveal on a hidden cell", () => {
      const state = minesweeperAdapter.createInitialPublicState(PLAYERS, {
        difficulty: "easy",
      });
      const result = minesweeperAdapter.validateMove!(
        state,
        {},
        { action: "reveal", cell: 40 },
        makeCtx(),
      );
      expect(result.ok).toBe(true);
      expect(result.nextPublicState).toBeDefined();
      expect(result.turnAdvance).toBe(false);
    });

    it("rejects reveal on out-of-bounds cell", () => {
      const state = minesweeperAdapter.createInitialPublicState(PLAYERS, {
        difficulty: "easy",
      });
      const result = minesweeperAdapter.validateMove!(
        state,
        {},
        { action: "reveal", cell: 999 },
        makeCtx(),
      );
      expect(result.ok).toBe(false);
    });

    it("rejects reveal without cell index", () => {
      const state = minesweeperAdapter.createInitialPublicState(PLAYERS, {
        difficulty: "easy",
      });
      const result = minesweeperAdapter.validateMove!(
        state,
        {},
        { action: "reveal" },
        makeCtx(),
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("validateMove — flag", () => {
    it("toggles flag on hidden cell", () => {
      // First generate a board
      let state = minesweeperAdapter.createInitialPublicState(PLAYERS, {
        difficulty: "easy",
      });
      const revealResult = minesweeperAdapter.validateMove!(
        state,
        {},
        { action: "reveal", cell: 40 },
        makeCtx(),
      );
      state = revealResult.nextPublicState!;

      // Find a hidden cell
      const st = state as unknown as MinesweeperPublicState;
      const hiddenIdx = st.cellStates.findIndex((s) => s === "hidden");
      if (hiddenIdx >= 0) {
        const flagResult = minesweeperAdapter.validateMove!(
          state,
          {},
          { action: "flag", cell: hiddenIdx },
          makeCtx(),
        );
        expect(flagResult.ok).toBe(true);
        const ns =
          flagResult.nextPublicState as unknown as MinesweeperPublicState;
        expect(ns.cellStates[hiddenIdx]).toBe("flagged");
      }
    });
  });

  describe("validateMove — restart", () => {
    it("creates a fresh state", () => {
      const state = minesweeperAdapter.createInitialPublicState(PLAYERS, {
        difficulty: "easy",
      });
      // Make a move to change state
      const revealed = minesweeperAdapter.validateMove!(
        state,
        {},
        { action: "reveal", cell: 40 },
        makeCtx(),
      );
      // Restart
      const result = minesweeperAdapter.validateMove!(
        revealed.nextPublicState!,
        {},
        { action: "restart", difficulty: "intermediate" },
        makeCtx(),
      );
      expect(result.ok).toBe(true);
      const ns = result.nextPublicState as unknown as MinesweeperPublicState;
      expect(ns.difficulty).toBe("intermediate");
      expect(ns.status).toBe("idle");
      expect(ns.boardGenerated).toBe(false);
    });
  });

  describe("validateMove — invalid action", () => {
    it("rejects unknown action", () => {
      const state = minesweeperAdapter.createInitialPublicState(PLAYERS, {
        difficulty: "easy",
      });
      const result = minesweeperAdapter.validateMove!(
        state,
        {},
        { action: "nuke" },
        makeCtx(),
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("computeOutcome", () => {
    it("returns loss outcome for lost game", () => {
      const state = {
        difficulty: "easy",
        status: "lost",
        elapsedMs: 5000,
        revealedCount: 10,
        totalSafeCells: 71,
        flagCount: 0,
        moveCount: 5,
        chordCount: 0,
        floodCount: 0,
      } as unknown as Record<string, unknown>;

      const outcome = minesweeperAdapter.computeOutcome!(state, PLAYERS);
      expect(outcome.winnerIds).toEqual([]);
      expect(outcome.finalScoreboard[0].score).toBe(0);
    });

    it("returns win outcome with encoded score", () => {
      const state = {
        difficulty: "expert",
        status: "won",
        elapsedMs: 120000,
        revealedCount: 381,
        totalSafeCells: 381,
        flagCount: 99,
        moveCount: 200,
        chordCount: 15,
        floodCount: 100,
      } as unknown as Record<string, unknown>;

      const outcome = minesweeperAdapter.computeOutcome!(state, PLAYERS);
      expect(outcome.winnerIds).toEqual(["solo"]);
      expect(outcome.finalScoreboard[0].score).toBeGreaterThan(0);
      const decoded = decodeBestScore(outcome.finalScoreboard[0].score);
      expect(decoded.difficulty).toBe("expert");
      expect(decoded.elapsedMs).toBe(120000);
    });
  });

  describe("extractPerformanceMetrics", () => {
    it("extracts all relevant metrics", () => {
      const state = {
        difficulty: "easy",
        cols: 9,
        rows: 9,
        mineCount: 10,
        elapsedMs: 5000,
        revealedCount: 71,
        totalSafeCells: 71,
        flagCount: 10,
        moveCount: 50,
        chordCount: 3,
        floodCount: 20,
        status: "won",
      } as unknown as Record<string, unknown>;

      const metrics = minesweeperAdapter.extractPerformanceMetrics!(
        state,
        PLAYERS,
      );
      expect(metrics.difficulty).toBe("easy");
      expect(metrics.won).toBe(true);
      expect(metrics.lost).toBe(false);
      expect(metrics.chordCount).toBe(3);
      expect(metrics.mineCount).toBe(10);
    });
  });
});

// =============================================================================
// Layout / Safe-Area Positioning Tests
// =============================================================================
// These tests verify the layout logic extracted from MinesweeperGame.tsx:
// - topPad / bottomPad positioning formulas
// - board sizing accounts for safe area offsets
// - controls never sit inside the unsafe display region
// - dropdown positions adjust with insets

describe("Minesweeper Layout — Safe Area Positioning", () => {
  // Replicate the layout formulas from MinesweeperGame.tsx
  const SHELL_OVERLAY_CLEARANCE = 52;

  function computeLayout(insets: { top: number; bottom: number }) {
    const topPad = insets.top + SHELL_OVERLAY_CLEARANCE;
    const bottomPad = Math.max(insets.bottom, 8) + 8;
    return { topPad, bottomPad };
  }

  function computeMaxBoardHeight(
    screenHeight: number,
    topPad: number,
    bottomPad: number,
  ) {
    return screenHeight - topPad - bottomPad - 140;
  }

  // ── Device profiles ──
  const DEVICES = {
    "iPhone 15 Pro (dynamic island)": {
      insets: { top: 59, bottom: 34 },
      screenHeight: 852,
      screenWidth: 393,
    },
    "iPhone 14 (notch)": {
      insets: { top: 47, bottom: 34 },
      screenHeight: 844,
      screenWidth: 390,
    },
    "iPhone SE (no notch)": {
      insets: { top: 20, bottom: 0 },
      screenHeight: 667,
      screenWidth: 375,
    },
    "Android (status bar only)": {
      insets: { top: 24, bottom: 0 },
      screenHeight: 800,
      screenWidth: 360,
    },
    "Android (gesture nav)": {
      insets: { top: 30, bottom: 48 },
      screenHeight: 915,
      screenWidth: 412,
    },
  };

  describe("top controls respect safe area", () => {
    it.each(Object.entries(DEVICES))(
      "%s: topPad pushes controls below the unsafe top region",
      (_name, device) => {
        const { topPad } = computeLayout(device.insets);
        // topPad must be at least insets.top (below the notch/island)
        expect(topPad).toBeGreaterThanOrEqual(device.insets.top);
        // Must also clear the shell overlay buttons (40px below insets.top + 8)
        const shellButtonsEnd = device.insets.top + 48;
        expect(topPad).toBeGreaterThanOrEqual(shellButtonsEnd);
      },
    );

    it("difficulty selector is NOT rendered into the unsafe top region", () => {
      // iPhone 15 Pro: dynamic island ends at insets.top = 59px
      const { topPad } = computeLayout({ top: 59, bottom: 34 });
      // The menuBar starts at topPad (via container paddingTop).
      // It must be strictly below the unsafe area.
      expect(topPad).toBeGreaterThan(59);
    });

    it("reset button (smiley) is NOT rendered into the dynamic island region", () => {
      // The smiley is in the statusBar, which is ~30px below the menuBar start.
      // So the smiley's top edge ≈ topPad + 30.
      const { topPad } = computeLayout({ top: 59, bottom: 34 });
      const smileyTop = topPad + 30; // menuBar height + statusBar position
      expect(smileyTop).toBeGreaterThan(59); // well below the dynamic island
    });

    it("help button is NOT rendered into the unsafe top region", () => {
      // Help button is in the menuBar row, at the same vertical position as difficulty selector
      const { topPad } = computeLayout({ top: 59, bottom: 34 });
      expect(topPad).toBeGreaterThan(59);
    });
  });

  describe("bottom controls respect safe area", () => {
    it.each(Object.entries(DEVICES))(
      "%s: bottomPad accounts for bottom safe area",
      (_name, device) => {
        const { bottomPad } = computeLayout(device.insets);
        // bottomPad must be at least the device's bottom inset
        expect(bottomPad).toBeGreaterThanOrEqual(device.insets.bottom);
        // Must also add some breathing room beyond the bare inset
        expect(bottomPad).toBeGreaterThan(device.insets.bottom);
      },
    );

    it("bottom controls are lifted above the home indicator", () => {
      // iPhone 15 Pro has a 34px home indicator zone
      const { bottomPad } = computeLayout({ top: 59, bottom: 34 });
      expect(bottomPad).toBeGreaterThanOrEqual(34 + 4); // at least 4px above indicator
    });

    it("bottom controls are lifted even on devices with no home indicator", () => {
      // iPhone SE / basic Android: insets.bottom = 0
      const { bottomPad } = computeLayout({ top: 20, bottom: 0 });
      expect(bottomPad).toBeGreaterThan(0); // still lifted above the edge
    });
  });

  describe("board sizing accounts for safe area", () => {
    it.each(Object.entries(DEVICES))(
      "%s: Easy 9×9 board has positive cell size without zoom",
      (_name, device) => {
        const { topPad, bottomPad } = computeLayout(device.insets);
        const maxBoardHeight = computeMaxBoardHeight(
          device.screenHeight,
          topPad,
          bottomPad,
        );
        const cellFromHeight = Math.floor(maxBoardHeight / 9);
        const cellFromWidth = Math.floor((device.screenWidth - 24) / 9);
        const cellSize = Math.min(cellFromHeight, cellFromWidth);
        expect(cellSize).toBeGreaterThanOrEqual(24); // no zoom needed
      },
    );

    it.each(Object.entries(DEVICES))(
      "%s: board height is positive",
      (_name, device) => {
        const { topPad, bottomPad } = computeLayout(device.insets);
        const maxBoardHeight = computeMaxBoardHeight(
          device.screenHeight,
          topPad,
          bottomPad,
        );
        expect(maxBoardHeight).toBeGreaterThan(100);
      },
    );

    it("Intermediate 16×16 fits without zoom on standard phones", () => {
      // iPhone 14 (844px)
      const { topPad, bottomPad } = computeLayout({ top: 47, bottom: 34 });
      const maxBoardHeight = computeMaxBoardHeight(844, topPad, bottomPad);
      const cellSize = Math.floor(maxBoardHeight / 16);
      expect(cellSize).toBeGreaterThanOrEqual(24);
    });
  });

  describe("dropdown positioning tracks safe area", () => {
    it("dropdown top clears the menuBar on all devices", () => {
      for (const device of Object.values(DEVICES)) {
        const { topPad } = computeLayout(device.insets);
        const dropdownTop = topPad + 32;
        // The menuBar occupies roughly topPad..topPad+29.
        // The dropdown must be below that.
        expect(dropdownTop).toBeGreaterThan(topPad + 24); // below menuBar
      }
    });
  });

  describe("classic styling preserved", () => {
    it("shell overlay clearance is a fixed constant (not device-variable)", () => {
      // Ensures the clearance is deterministic, not accidentally inset-dependent
      expect(SHELL_OVERLAY_CLEARANCE).toBe(52);
    });

    it("topPad scales linearly with top inset, bottomPad respects minimum floor", () => {
      const small = computeLayout({ top: 20, bottom: 0 });
      const large = computeLayout({ top: 59, bottom: 34 });
      // topPad increases by exactly the inset difference
      expect(large.topPad - small.topPad).toBe(59 - 20);
      // bottomPad uses Math.max(insets.bottom, 8) + 8, so:
      // small: max(0,8)+8 = 16, large: max(34,8)+8 = 42
      expect(small.bottomPad).toBe(16);
      expect(large.bottomPad).toBe(42);
    });
  });
});
