/**
 * Games V4 — Hex Adapter Tests
 *
 * Comprehensive test suite for the Hex game adapter covering:
 * - Metadata correctness
 * - Initial state creation
 * - Opening phase placement
 * - Swap decision flows (keep & swap)
 * - Main phase placement validation
 * - Turn alternation
 * - Invalid move rejection
 * - Red win detection (top ↔ bottom)
 * - Blue win detection (left ↔ right)
 * - Win path reconstruction
 * - computeOutcome correctness
 * - extractPerformanceMetrics
 * - No draw condition
 *
 * @module __tests__/gamesV4/adapters/hex
 */

import hexAdapter, {
  checkWin,
  colFromIndex,
  getNeighborIndices,
  indexFromRowCol,
  rowFromIndex,
  type HexCell,
  type HexPublicState,
} from "@/gamesV4/adapters/hex";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS = [
  { uid: "p1", slotIndex: 0 },
  { uid: "p2", slotIndex: 1 },
];

const TURN_ORDER = ["p1", "p2"];

function makeCtx(currentTurnIndex: number, uid?: string) {
  return {
    uid: uid ?? TURN_ORDER[currentTurnIndex % 2],
    turnOrder: TURN_ORDER,
    currentTurnIndex,
    settings: {},
  };
}

function getInitialState(): HexPublicState {
  return hexAdapter.createInitialPublicState(
    PLAYERS,
    {},
  ) as unknown as HexPublicState;
}

function applyMove(
  state: HexPublicState,
  turnIndex: number,
  payload: Record<string, unknown>,
) {
  const ctx = makeCtx(turnIndex);
  const result = hexAdapter.validateMove!(
    state as unknown as Record<string, unknown>,
    {},
    payload,
    ctx,
  );
  return result;
}

// =============================================================================
// Tests
// =============================================================================

describe("Hex Adapter", () => {
  // ── Metadata ────────────────────────────────────────────────────────

  describe("metadata", () => {
    it("has correct game identity", () => {
      expect(hexAdapter.gameId).toBe("hex");
      expect(hexAdapter.runtimeType).toBe("turnBased");
      expect(hexAdapter.minPlayers).toBe(2);
      expect(hexAdapter.maxPlayers).toBe(2);
      expect(hexAdapter.supportsSpectate).toBe(true);
      expect(hexAdapter.spectateMode).toBe("full_state");
    });

    it("has empty settings", () => {
      expect(hexAdapter.settingsSchema).toEqual([]);
      expect(hexAdapter.defaultSettings).toEqual({});
    });
  });

  // ── Grid Helpers ────────────────────────────────────────────────────

  describe("grid helpers", () => {
    it("converts between index and row/col", () => {
      expect(rowFromIndex(0)).toBe(0);
      expect(colFromIndex(0)).toBe(0);
      expect(indexFromRowCol(0, 0)).toBe(0);
      expect(indexFromRowCol(4, 4)).toBe(40); // center
      expect(indexFromRowCol(8, 8)).toBe(80); // bottom-right
      expect(rowFromIndex(80)).toBe(8);
      expect(colFromIndex(80)).toBe(8);
    });

    it("returns valid neighbors for corner cells", () => {
      // Top-left corner (0,0): offsets (-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0)
      // Valid: (0,1) and (1,0) → 2 neighbors
      const topLeft = getNeighborIndices(0);
      expect(topLeft.length).toBe(2);
      expect(topLeft).toContain(indexFromRowCol(0, 1)); // E
      expect(topLeft).toContain(indexFromRowCol(1, 0)); // SE

      // Bottom-right corner (8,8): offsets produce (7,8),(8,7) → 2 neighbors
      const bottomRight = getNeighborIndices(80);
      expect(bottomRight.length).toBe(2);
    });

    it("returns 6 neighbors for center cell", () => {
      const center = getNeighborIndices(indexFromRowCol(4, 4));
      expect(center.length).toBe(6);
    });
  });

  // ── Initial State ───────────────────────────────────────────────────

  describe("createInitialPublicState", () => {
    it("creates correct initial state", () => {
      const state = getInitialState();
      expect(state.boardSize).toBe(9);
      expect(state.cells).toHaveLength(81);
      expect(state.cells.every((c: HexCell) => c === null)).toBe(true);
      expect(state.phase).toBe("opening");
      expect(state.colorByUid.p1).toBe("red");
      expect(state.colorByUid.p2).toBe("blue");
      expect(state.openingMoveIndex).toBeNull();
      expect(state.swapDecision).toBeNull();
      expect(state.moveCount).toBe(0);
      expect(state.lastMove).toBeNull();
      expect(state.winnerUid).toBeNull();
      expect(state.winningPath).toBeNull();
    });
  });

  // ── Opening Phase ───────────────────────────────────────────────────

  describe("opening phase", () => {
    it("first placement transitions to swap_pending", () => {
      const state = getInitialState();
      const result = applyMove(state, 0, { type: "place", index: 40 });

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(true);
      expect(result.terminal).toBeUndefined();

      const next = result.nextPublicState as unknown as HexPublicState;
      expect(next.phase).toBe("swap_pending");
      expect(next.cells[40]).toBe("red");
      expect(next.openingMoveIndex).toBe(40);
      expect(next.swapDecision).toBe("pending");
      expect(next.moveCount).toBe(1);
      expect(next.lastMove).toEqual({
        uid: "p1",
        color: "red",
        index: 40,
      });
    });

    it("rejects placement on occupied cell", () => {
      const state = getInitialState();
      state.cells[40] = "red";
      state.phase = "main";
      state.swapDecision = "kept";
      const result = applyMove(state, 0, { type: "place", index: 40 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("occupied");
    });

    it("rejects out-of-bounds placement", () => {
      const state = getInitialState();
      const result = applyMove(state, 0, { type: "place", index: 81 });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("out of bounds");
    });

    it("rejects wrong player", () => {
      const state = getInitialState();
      // p2 tries to move on p1's turn
      const ctx = makeCtx(0, "p2");
      const result = hexAdapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { type: "place", index: 0 },
        ctx,
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Not your turn");
    });
  });

  // ── Swap Decision ───────────────────────────────────────────────────

  describe("swap decision - keep", () => {
    let swapState: HexPublicState;

    beforeEach(() => {
      const state = getInitialState();
      const openingResult = applyMove(state, 0, {
        type: "place",
        index: 40,
      });
      swapState = openingResult.nextPublicState as unknown as HexPublicState;
    });

    it("second player can keep colors", () => {
      const result = applyMove(swapState, 1, {
        type: "swap_decision",
        choice: "keep",
      });

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(false); // blue keeps turn

      const next = result.nextPublicState as unknown as HexPublicState;
      expect(next.phase).toBe("main");
      expect(next.swapDecision).toBe("kept");
      expect(next.colorByUid.p1).toBe("red");
      expect(next.colorByUid.p2).toBe("blue");
      // Opening stone stays red
      expect(next.cells[40]).toBe("red");
    });
  });

  describe("swap decision - swap", () => {
    let swapState: HexPublicState;

    beforeEach(() => {
      const state = getInitialState();
      const openingResult = applyMove(state, 0, {
        type: "place",
        index: 40,
      });
      swapState = openingResult.nextPublicState as unknown as HexPublicState;
    });

    it("second player can swap sides", () => {
      const result = applyMove(swapState, 1, {
        type: "swap_decision",
        choice: "swap",
      });

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(true); // turn advances back to p1 (now blue)

      const next = result.nextPublicState as unknown as HexPublicState;
      expect(next.phase).toBe("main");
      expect(next.swapDecision).toBe("swapped");
      // Colors are flipped
      expect(next.colorByUid.p1).toBe("blue");
      expect(next.colorByUid.p2).toBe("red");
      // Opening stone flips from red to blue
      expect(next.cells[40]).toBe("blue");
    });

    it("rejects swap when not swap_pending phase", () => {
      const state = getInitialState();
      const result = applyMove(state, 0, {
        type: "swap_decision",
        choice: "keep",
      });
      expect(result.ok).toBe(false);
    });

    it("rejects swap from first player", () => {
      // p1 (red) cannot make swap decision
      const ctx = {
        uid: "p1",
        turnOrder: TURN_ORDER,
        currentTurnIndex: 1, // it's "p2"'s turn but we force uid=p1
        settings: {},
      };
      // Actually, if it's p2's turn and uid is p1, it should fail on "not your turn"
      const result = hexAdapter.validateMove!(
        swapState as unknown as Record<string, unknown>,
        {},
        { type: "swap_decision", choice: "keep" },
        ctx,
      );
      expect(result.ok).toBe(false);
    });
  });

  // ── Main Phase / Alternation ────────────────────────────────────────

  describe("main phase", () => {
    let mainState: HexPublicState;
    let turnIdx: number;

    beforeEach(() => {
      const state = getInitialState();
      // p1 opening
      const r1 = applyMove(state, 0, { type: "place", index: 40 });
      const swapState = r1.nextPublicState as unknown as HexPublicState;

      // p2 keeps
      const r2 = applyMove(swapState, 1, {
        type: "swap_decision",
        choice: "keep",
      });
      mainState = r2.nextPublicState as unknown as HexPublicState;
      // After keep, turnAdvance=false, so p2 still has the turn
      turnIdx = 1; // p2's turn (blue)
    });

    it("blue can place in main phase", () => {
      const result = applyMove(mainState, turnIdx, {
        type: "place",
        index: 0,
      });
      expect(result.ok).toBe(true);
      const next = result.nextPublicState as unknown as HexPublicState;
      expect(next.cells[0]).toBe("blue");
      expect(next.moveCount).toBe(2);
      expect(result.turnAdvance).toBe(true);
    });

    it("rejects placement during main phase on occupied cell", () => {
      const result = applyMove(mainState, turnIdx, {
        type: "place",
        index: 40,
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("occupied");
    });

    it("rejects swap decision during main phase", () => {
      const result = applyMove(mainState, turnIdx, {
        type: "swap_decision",
        choice: "keep",
      });
      expect(result.ok).toBe(false);
    });
  });

  // ── Win Detection ───────────────────────────────────────────────────

  describe("win detection", () => {
    it("detects red win (top to bottom)", () => {
      // Create a column of red cells from row 0 to row 8 in col 0
      const cells: HexCell[] = Array(81).fill(null);
      for (let row = 0; row < 9; row++) {
        cells[indexFromRowCol(row, 0)] = "red";
      }
      const path = checkWin(cells, "red");
      expect(path).not.toBeNull();
      expect(path!.length).toBe(9);
      expect(rowFromIndex(path![0])).toBe(0);
      expect(rowFromIndex(path![path!.length - 1])).toBe(8);
    });

    it("detects blue win (left to right)", () => {
      // Create a row of blue cells from col 0 to col 8 in row 0
      const cells: HexCell[] = Array(81).fill(null);
      for (let col = 0; col < 9; col++) {
        cells[indexFromRowCol(0, col)] = "blue";
      }
      const path = checkWin(cells, "blue");
      expect(path).not.toBeNull();
      expect(path!.length).toBe(9);
      expect(colFromIndex(path![0])).toBe(0);
      expect(colFromIndex(path![path!.length - 1])).toBe(8);
    });

    it("returns null when no connection", () => {
      const cells: HexCell[] = Array(81).fill(null);
      cells[0] = "red";
      cells[80] = "red";
      expect(checkWin(cells, "red")).toBeNull();
    });

    it("detects zigzag win path", () => {
      // Red zigzag: (0,4) -> (1,3) -> (2,3) -> (3,2) -> (4,2) -> (5,1) -> (6,1) -> (7,0) -> (8,0)
      const cells: HexCell[] = Array(81).fill(null);
      const path = [
        [0, 4],
        [1, 3],
        [2, 3],
        [3, 2],
        [4, 2],
        [5, 1],
        [6, 1],
        [7, 0],
        [8, 0],
      ];
      for (const [r, c] of path) {
        cells[indexFromRowCol(r, c)] = "red";
      }
      const winPath = checkWin(cells, "red");
      expect(winPath).not.toBeNull();
      expect(winPath!.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe("terminal win via validateMove", () => {
    it("returns terminal win when red connects", () => {
      // Setup a state where red needs one more stone to connect
      const state = getInitialState();
      state.phase = "main";
      state.swapDecision = "kept";
      state.moveCount = 16;

      // Red already has col 4, rows 0-7
      for (let row = 0; row < 8; row++) {
        state.cells[indexFromRowCol(row, 4)] = "red";
      }
      // Add some blue stones
      for (let row = 0; row < 8; row++) {
        state.cells[indexFromRowCol(row, 3)] = "blue";
      }

      // Red places at (8, 4) to complete the connection
      const ctx = makeCtx(0); // p1 = red
      const result = hexAdapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { type: "place", index: indexFromRowCol(8, 4) },
        ctx,
      );

      expect(result.ok).toBe(true);
      expect(result.terminal).toBeDefined();
      expect(result.terminal!.type).toBe("win");
      expect(result.terminal!.winnerIds).toEqual(["p1"]);

      const next = result.nextPublicState as unknown as HexPublicState;
      expect(next.winnerUid).toBe("p1");
      expect(next.winningPath).not.toBeNull();
      expect(next.phase).toBe("resolved");
    });
  });

  // ── Outcome ─────────────────────────────────────────────────────────

  describe("computeOutcome", () => {
    it("produces correct outcome for a win", () => {
      const state = getInitialState();
      state.winnerUid = "p1";
      state.moveCount = 17;
      state.swapDecision = "kept";
      state.winningPath = [0, 9, 18, 27, 36, 45, 54, 63, 72];

      const outcome = hexAdapter.computeOutcome!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      );

      expect(outcome.winnerIds).toEqual(["p1"]);
      expect(outcome.finalScoreboard).toHaveLength(2);
      expect(outcome.finalScoreboard[0].uid).toBe("p1");
      expect(outcome.finalScoreboard[0].score).toBe(1);
      expect(outcome.finalScoreboard[0].placement).toBe(1);
      expect(outcome.finalScoreboard[1].uid).toBe("p2");
      expect(outcome.finalScoreboard[1].score).toBe(0);
      expect(outcome.finalScoreboard[1].placement).toBe(2);
    });

    it("produces fallback outcome for resignation (no winner)", () => {
      const state = getInitialState();
      state.moveCount = 5;

      const outcome = hexAdapter.computeOutcome!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      );

      expect(outcome.winnerIds).toEqual([]);
      expect(outcome.finalScoreboard).toHaveLength(2);
      expect(outcome.finalScoreboard[0].score).toBe(0);
    });
  });

  // ── Performance Metrics ─────────────────────────────────────────────

  describe("extractPerformanceMetrics", () => {
    it("extracts correct metrics", () => {
      const state = getInitialState();
      state.winnerUid = "p1";
      state.swapDecision = "swapped";
      state.moveCount = 20;
      state.winningPath = [0, 9, 18, 27, 36, 45, 54, 63, 72];

      const metrics = hexAdapter.extractPerformanceMetrics!(
        state as unknown as Record<string, unknown>,
        [{ uid: "p1" }, { uid: "p2" }],
      );

      expect(metrics.boardSize).toBe(9);
      expect(metrics.swapUsed).toBe(true);
      expect(metrics.totalMoves).toBe(20);
      expect(metrics.winningPathLength).toBe(9);
      expect(metrics.winnerColor).toBe("red"); // p1 is red in initial state
    });

    it("reports swapDeclinedByWinner correctly", () => {
      const state = getInitialState();
      state.winnerUid = "p1";
      state.swapDecision = "kept";
      state.moveCount = 15;
      state.winningPath = [0, 9, 18];

      const metrics = hexAdapter.extractPerformanceMetrics!(
        state as unknown as Record<string, unknown>,
        [{ uid: "p1" }],
      );

      expect(metrics.swapDeclinedByWinner).toBe(true);
      expect(metrics.swapUsed).toBe(false);
    });
  });

  // ── Summary ─────────────────────────────────────────────────────────

  describe("computeSummary", () => {
    it("returns correct summary", () => {
      const state = getInitialState();
      const playersWithNames = [
        { uid: "p1", displayName: "Alice" },
        { uid: "p2", displayName: "Bob" },
      ];
      const summary = hexAdapter.computeSummary!(
        state as unknown as Record<string, unknown>,
        playersWithNames,
        "p1",
      );

      expect(summary.turnPlayerId).toBe("p1");
      expect(summary.scoreSummary).toHaveLength(2);
      expect(summary.scoreSummary[0].score).toBe(0);
    });
  });

  // ── No draw ─────────────────────────────────────────────────────────

  describe("no draw", () => {
    it("does not produce a draw terminal", () => {
      // Hex has no draw — fill board partially and verify no draw terminal
      const state = getInitialState();
      state.phase = "main";
      state.swapDecision = "kept";
      state.moveCount = 80;

      // Fill all but one cell
      for (let i = 0; i < 80; i++) {
        state.cells[i] = i % 2 === 0 ? "red" : "blue";
      }
      // Ensure no win exists (clear the top edge of red)
      state.cells[0] = "blue"; // break red top

      const ctx = makeCtx(0);
      const result = hexAdapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { type: "place", index: 80 },
        ctx,
      );

      // Should either be a win or continue (no draw terminal)
      if (result.terminal) {
        expect(result.terminal.type).toBe("win");
      } else {
        expect(result.ok).toBe(true);
        // No draw terminal
      }
    });
  });
});
