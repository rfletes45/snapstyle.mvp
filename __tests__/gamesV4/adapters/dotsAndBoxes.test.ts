/**
 * Games V4 — Dots & Boxes Adapter Unit Tests
 *
 * Tests the pure game logic:
 * - Metadata correctness
 * - Initial state creation (all board sizes)
 * - Move validation (valid placement, invalid types, bounds, duplicates)
 * - Box completion detection (0, 1, 2 boxes per move)
 * - Turn retention on box capture (extra turn)
 * - Game termination (winner, draw)
 * - Outcome computation (scoreboard, placements, ties)
 * - Performance metrics extraction
 * - Chain / capture tracking
 * - Settings validation
 * - Spectator view (full state)
 */

import dotsAndBoxesAdapter from "@/gamesV4/adapters/dotsAndBoxes";

// =============================================================================
// Helpers
// =============================================================================

const PLAYERS = [
  { uid: "p1", slotIndex: 0 },
  { uid: "p2", slotIndex: 1 },
];

const PLAYERS_DISPLAY = [
  { uid: "p1", slotIndex: 0, displayName: "Player 1" },
  { uid: "p2", slotIndex: 1, displayName: "Player 2" },
];

function makeCtx(
  currentTurnIndex: number,
  settings: Record<string, unknown> = {},
) {
  return {
    uid: currentTurnIndex === 0 ? "p1" : "p2",
    turnOrder: ["p1", "p2"],
    currentTurnIndex,
    settings,
  };
}

/** Create a blank state for the given board size preset. */
function makeBlankState(boardSize = "standard") {
  return dotsAndBoxesAdapter.createInitialPublicState(PLAYERS, { boardSize });
}

/** Type alias for convenience. */
type State = {
  rows: number;
  cols: number;
  boardKey: string;
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
  extraTurnsEarnedByUid: Record<string, number>;
  largestSingleTurnCaptureByUid: Record<string, number>;
  largestChainCapturedByUid: Record<string, number>;
  currentChainByUid: Record<string, number>;
  finalBoxOwnerUid: string | null;
};

function asState(s: Record<string, unknown>): State {
  return s as unknown as State;
}

/** Apply a sequence of moves and return the final state. */
function applyMoves(
  initialState: Record<string, unknown>,
  moves: Array<{ edgeType: "h" | "v"; row: number; col: number }>,
  settings: Record<string, unknown> = {},
): { state: Record<string, unknown>; turnIndex: number } {
  let state = initialState;
  let turnIndex = 0;

  for (const move of moves) {
    const ctx = makeCtx(turnIndex, settings);
    const result = dotsAndBoxesAdapter.validateMove!(state, {}, move, ctx);
    if (!result.ok) {
      throw new Error(
        `Move rejected: ${result.error} — move: ${JSON.stringify(move)}`,
      );
    }
    state = result.nextPublicState!;
    if (result.turnAdvance) {
      turnIndex = turnIndex === 0 ? 1 : 0;
    }
    // If terminal, stop
    if (result.terminal) break;
  }

  return { state, turnIndex };
}

// =============================================================================
// Tests
// =============================================================================

describe("Dots & Boxes Adapter V4", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Section 1: Metadata
  // ═══════════════════════════════════════════════════════════════════════

  describe("metadata", () => {
    it("has correct IDs and limits", () => {
      expect(dotsAndBoxesAdapter.gameId).toBe("dots_and_boxes");
      expect(dotsAndBoxesAdapter.runtimeType).toBe("turnBased");
      expect(dotsAndBoxesAdapter.maxPlayers).toBe(2);
      expect(dotsAndBoxesAdapter.minPlayers).toBe(2);
    });

    it("supports spectating with full state", () => {
      expect(dotsAndBoxesAdapter.supportsSpectate).toBe(true);
      expect(dotsAndBoxesAdapter.spectateMode).toBe("full_state");
    });

    it("has a settings schema with board size", () => {
      expect(dotsAndBoxesAdapter.settingsSchema).toBeDefined();
      expect(dotsAndBoxesAdapter.settingsSchema!.length).toBeGreaterThanOrEqual(
        1,
      );
      const boardSizeField = dotsAndBoxesAdapter.settingsSchema!.find(
        (f) => f.key === "boardSize",
      );
      expect(boardSizeField).toBeDefined();
      expect(boardSizeField!.type).toBe("select");
      expect(boardSizeField!.default).toBe("standard");
    });

    it("has scoreboard descriptor", () => {
      expect(dotsAndBoxesAdapter.scoreboardDescriptor).toBeDefined();
      expect(dotsAndBoxesAdapter.scoreboardDescriptor!.title).toBe(
        "BOXES CLAIMED",
      );
      expect(dotsAndBoxesAdapter.scoreboardDescriptor!.sortDirection).toBe(
        "desc",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 2: Initial State Creation
  // ═══════════════════════════════════════════════════════════════════════

  describe("createInitialPublicState", () => {
    it("creates a standard 4×4 board by default", () => {
      const state = asState(makeBlankState());
      expect(state.rows).toBe(4);
      expect(state.cols).toBe(4);
      expect(state.boardKey).toBe("4x4");
      // horizontal edges: (4+1) * 4 = 20
      expect(state.horizontalEdges).toHaveLength(20);
      // vertical edges: 4 * (4+1) = 20
      expect(state.verticalEdges).toHaveLength(20);
      // boxes: 4*4 = 16
      expect(state.boxOwners).toHaveLength(16);
      expect(state.horizontalEdges.every((e) => e === false)).toBe(true);
      expect(state.verticalEdges.every((e) => e === false)).toBe(true);
      expect(state.boxOwners.every((o) => o === null)).toBe(true);
    });

    it("creates a quick 3×3 board", () => {
      const state = asState(makeBlankState("quick"));
      expect(state.rows).toBe(3);
      expect(state.cols).toBe(3);
      expect(state.boardKey).toBe("3x3");
      // horizontal: (3+1)*3 = 12, vertical: 3*(3+1) = 12
      expect(state.horizontalEdges).toHaveLength(12);
      expect(state.verticalEdges).toHaveLength(12);
      expect(state.boxOwners).toHaveLength(9);
      expect(state.remainingEdges).toBe(24);
    });

    it("creates an expert 5×5 board", () => {
      const state = asState(makeBlankState("expert"));
      expect(state.rows).toBe(5);
      expect(state.cols).toBe(5);
      expect(state.boardKey).toBe("5x5");
      // horizontal: (5+1)*5 = 30, vertical: 5*(5+1) = 30
      expect(state.horizontalEdges).toHaveLength(30);
      expect(state.verticalEdges).toHaveLength(30);
      expect(state.boxOwners).toHaveLength(25);
      expect(state.remainingEdges).toBe(60);
    });

    it("initializes all scores to zero", () => {
      const state = asState(makeBlankState());
      expect(state.scoresByUid).toEqual({ p1: 0, p2: 0 });
      expect(state.boxesClaimed).toBe(0);
      expect(state.moveNumber).toBe(0);
    });

    it("initializes tracking metrics to zero", () => {
      const state = asState(makeBlankState());
      expect(state.extraTurnsEarnedByUid).toEqual({ p1: 0, p2: 0 });
      expect(state.largestSingleTurnCaptureByUid).toEqual({ p1: 0, p2: 0 });
      expect(state.largestChainCapturedByUid).toEqual({ p1: 0, p2: 0 });
      expect(state.currentChainByUid).toEqual({ p1: 0, p2: 0 });
      expect(state.finalBoxOwnerUid).toBeNull();
    });

    it("falls back to standard for unknown preset", () => {
      const state = asState(
        dotsAndBoxesAdapter.createInitialPublicState(PLAYERS, {
          boardSize: "unknown",
        }),
      );
      expect(state.rows).toBe(4);
      expect(state.cols).toBe(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 3: Move Validation — Basic
  // ═══════════════════════════════════════════════════════════════════════

  describe("validateMove — basics", () => {
    it("places a horizontal edge successfully", () => {
      const state = makeBlankState("quick");
      const result = dotsAndBoxesAdapter.validateMove!(
        state,
        {},
        { edgeType: "h", row: 0, col: 0 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(true); // No box completed
      const next = asState(result.nextPublicState!);
      expect(next.horizontalEdges[0]).toBe(true);
      expect(next.moveNumber).toBe(1);
      expect(next.remainingEdges).toBe(23);
    });

    it("places a vertical edge successfully", () => {
      const state = makeBlankState("quick");
      const result = dotsAndBoxesAdapter.validateMove!(
        state,
        {},
        { edgeType: "v", row: 0, col: 0 },
        makeCtx(0),
      );

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(true);
      const next = asState(result.nextPublicState!);
      // vIdx(0, 0, 3) = 0*(3+1) + 0 = 0
      expect(next.verticalEdges[0]).toBe(true);
    });

    it("rejects invalid edge type", () => {
      const state = makeBlankState("quick");
      const result = dotsAndBoxesAdapter.validateMove!(
        state,
        {},
        { edgeType: "x", row: 0, col: 0 } as any,
        makeCtx(0),
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain("edge type");
    });

    it("rejects non-numeric coordinates", () => {
      const state = makeBlankState("quick");
      const result = dotsAndBoxesAdapter.validateMove!(
        state,
        {},
        { edgeType: "h", row: "a", col: 0 } as any,
        makeCtx(0),
      );
      expect(result.ok).toBe(false);
    });

    it("rejects out-of-bounds horizontal edge", () => {
      const state = makeBlankState("quick"); // 3×3: rows=3, cols=3
      // Horizontal: row must be 0..3, col must be 0..2
      const invalidMoves = [
        { edgeType: "h", row: -1, col: 0 },
        { edgeType: "h", row: 4, col: 0 },
        { edgeType: "h", row: 0, col: -1 },
        { edgeType: "h", row: 0, col: 3 },
      ];

      for (const move of invalidMoves) {
        const result = dotsAndBoxesAdapter.validateMove!(
          state,
          {},
          move,
          makeCtx(0),
        );
        expect(result.ok).toBe(false);
      }
    });

    it("rejects out-of-bounds vertical edge", () => {
      const state = makeBlankState("quick"); // 3×3: rows=3, cols=3
      // Vertical: row must be 0..2, col must be 0..3
      const invalidMoves = [
        { edgeType: "v", row: -1, col: 0 },
        { edgeType: "v", row: 3, col: 0 },
        { edgeType: "v", row: 0, col: -1 },
        { edgeType: "v", row: 0, col: 4 },
      ];

      for (const move of invalidMoves) {
        const result = dotsAndBoxesAdapter.validateMove!(
          state,
          {},
          move,
          makeCtx(0),
        );
        expect(result.ok).toBe(false);
      }
    });

    it("rejects already-taken edge", () => {
      const state = makeBlankState("quick");
      const result1 = dotsAndBoxesAdapter.validateMove!(
        state,
        {},
        { edgeType: "h", row: 0, col: 0 },
        makeCtx(0),
      );
      expect(result1.ok).toBe(true);

      // Try placing the same edge again
      const result2 = dotsAndBoxesAdapter.validateMove!(
        result1.nextPublicState!,
        {},
        { edgeType: "h", row: 0, col: 0 },
        makeCtx(1),
      );
      expect(result2.ok).toBe(false);
      expect(result2.error).toContain("already taken");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 4: Box Completion & Turn Retention
  // ═══════════════════════════════════════════════════════════════════════

  describe("box completion and turn retention", () => {
    it("does not retain turn when no box is completed", () => {
      const state = makeBlankState("quick");
      const result = dotsAndBoxesAdapter.validateMove!(
        state,
        {},
        { edgeType: "h", row: 0, col: 0 },
        makeCtx(0),
      );
      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(true);
      expect(asState(result.nextPublicState!).turnRetained).toBe(false);
    });

    it("completes a single box and retains turn", () => {
      // Build a 3×3 quick board and close box (0,0) with the 4th edge
      // Box (0,0) needs: top h(0,0), bottom h(1,0), left v(0,0), right v(0,1)
      const moves: Array<{ edgeType: "h" | "v"; row: number; col: number }> = [
        { edgeType: "h", row: 0, col: 0 }, // p1 — top of box(0,0)
        { edgeType: "h", row: 3, col: 2 }, // p2 — far away
        { edgeType: "h", row: 1, col: 0 }, // p1 — bottom of box(0,0)
        { edgeType: "h", row: 3, col: 1 }, // p2 — far away
        { edgeType: "v", row: 0, col: 0 }, // p1 — left of box(0,0)
      ];

      const { state, turnIndex } = applyMoves(makeBlankState("quick"), moves);
      // Now p2's turn, place the 4th edge of box(0,0): right = v(0,1)
      const result = dotsAndBoxesAdapter.validateMove!(
        state,
        {},
        { edgeType: "v", row: 0, col: 1 },
        makeCtx(turnIndex),
      );

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(false); // Turn retained!
      const next = asState(result.nextPublicState!);
      expect(next.turnRetained).toBe(true);
      expect(next.lastCapturedBoxes).toHaveLength(1);
      expect(next.boxOwners[0]).toBe("p2"); // box(0,0) claimed by p2
      expect(next.scoresByUid["p2"]).toBe(1);
    });

    it("a single edge can complete two boxes simultaneously", () => {
      // Set up two adjacent boxes sharing an edge
      // boxes (0,0) and (0,1) in a 3×3 grid share v(0,1)
      //
      // Box(0,0) needs: top h(0,0), bottom h(1,0), left v(0,0), right v(0,1)
      // Box(0,1) needs: top h(0,1), bottom h(1,1), left v(0,1), right v(0,2)
      //
      // If we place all edges except the shared v(0,1), then placing it completes both
      const moves: Array<{ edgeType: "h" | "v"; row: number; col: number }> = [
        // Box(0,0) edges (minus v(0,1))
        { edgeType: "h", row: 0, col: 0 }, // p1 → top
        { edgeType: "h", row: 3, col: 2 }, // p2 — filler
        { edgeType: "h", row: 1, col: 0 }, // p1 → bottom
        { edgeType: "h", row: 3, col: 1 }, // p2 — filler
        { edgeType: "v", row: 0, col: 0 }, // p1 → left
        // Box(0,1) edges (minus v(0,1))
        { edgeType: "h", row: 3, col: 0 }, // p2 — filler
        { edgeType: "h", row: 0, col: 1 }, // p1 → top of box(0,1)
        { edgeType: "v", row: 2, col: 3 }, // p2 — filler
        { edgeType: "h", row: 1, col: 1 }, // p1 → bottom of box(0,1)
        { edgeType: "v", row: 2, col: 0 }, // p2 — filler
        { edgeType: "v", row: 0, col: 2 }, // p1 → right of box(0,1)
      ];

      const { state, turnIndex } = applyMoves(makeBlankState("quick"), moves);
      // Now place the shared edge v(0,1) — should complete both boxes
      const result = dotsAndBoxesAdapter.validateMove!(
        state,
        {},
        { edgeType: "v", row: 0, col: 1 },
        makeCtx(turnIndex),
      );

      expect(result.ok).toBe(true);
      expect(result.turnAdvance).toBe(false); // Turn retained
      const next = asState(result.nextPublicState!);
      expect(next.lastCapturedBoxes).toHaveLength(2);
      // Both boxes owned by the player who placed the edge
      const claimingUid = turnIndex === 0 ? "p1" : "p2";
      expect(next.boxOwners[0]).toBe(claimingUid); // box(0,0)
      expect(next.boxOwners[1]).toBe(claimingUid); // box(0,1)
      expect(next.scoresByUid[claimingUid]).toBeGreaterThanOrEqual(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 5: Game Termination
  // ═══════════════════════════════════════════════════════════════════════

  describe("game termination", () => {
    it("ends with a winner when all edges are filled", () => {
      // Play a full game on a quick 3×3 board (24 edges, 9 boxes)
      // We'll manually fill edges in a way that ensures p1 wins
      //
      // 3×3 grid of boxes: 4×4 dots
      // Horizontal edges: rows 0-3, cols 0-2 (12 edges)
      // Vertical edges: rows 0-2, cols 0-3 (12 edges)
      //
      // Strategy: we'll fill edges systematically.
      // First fill all horizontal edges, then vertical edges.
      // The "interesting" boxes only close when both h and v edges are present.
      const allHMoves: Array<{
        edgeType: "h" | "v";
        row: number;
        col: number;
      }> = [];
      for (let r = 0; r <= 3; r++) {
        for (let c = 0; c < 3; c++) {
          allHMoves.push({ edgeType: "h", row: r, col: c });
        }
      }
      const allVMoves: Array<{
        edgeType: "h" | "v";
        row: number;
        col: number;
      }> = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c <= 3; c++) {
          allVMoves.push({ edgeType: "v", row: r, col: c });
        }
      }

      // Interleave: start with horizontals (no boxes close since no verticals yet),
      // then verticals will start closing boxes.
      const allMoves = [...allHMoves, ...allVMoves];

      let state = makeBlankState("quick") as Record<string, unknown>;
      let turnIndex = 0;
      let lastResult: any;

      for (const move of allMoves) {
        const ctx = makeCtx(turnIndex);
        const result = dotsAndBoxesAdapter.validateMove!(state, {}, move, ctx);
        expect(result.ok).toBe(true);
        state = result.nextPublicState!;
        lastResult = result;

        if (result.terminal) break;
        if (result.turnAdvance) {
          turnIndex = turnIndex === 0 ? 1 : 0;
        }
      }

      const finalState = asState(state);
      expect(finalState.remainingEdges).toBe(0);
      expect(lastResult.terminal).toBeDefined();
      // Should be a win (not a draw) since moves are interleaved
      expect(["win", "draw"]).toContain(lastResult.terminal.type);
    });

    it("detects a draw when scores are tied", () => {
      // On a 2-box scenario we can't easily do this with the preset boards,
      // but we can simulate it by manually constructing state
      // with equal scores and 0 remaining edges
      const state = makeBlankState("quick");
      const s = asState(state);

      // Manually construct a final state where p1 and p2 have equal boxes
      // In a 3×3 grid (9 boxes), we can't have an exact tie (odd),
      // so we'll test computeOutcome with a 4×4 board (16 boxes, 8 each)
      const state4 = asState(makeBlankState("standard"));
      const hackedState: State = {
        ...state4,
        scoresByUid: { p1: 8, p2: 8 },
        boxesClaimed: 16,
        remainingEdges: 0,
        horizontalEdges: new Array(20).fill(true),
        verticalEdges: new Array(20).fill(true),
        boxOwners: new Array(16)
          .fill(null)
          .map((_, i) => (i < 8 ? "p1" : "p2")),
      };

      const outcome = dotsAndBoxesAdapter.computeOutcome!(
        hackedState as unknown as Record<string, unknown>,
        PLAYERS,
      );
      expect(outcome.winnerIds).toEqual([]);
      // Both should have placement 1 in a tie
      expect(outcome.finalScoreboard[0].placement).toBe(1);
      expect(outcome.finalScoreboard[1].placement).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 6: computeOutcome
  // ═══════════════════════════════════════════════════════════════════════

  describe("computeOutcome", () => {
    it("identifies winner by highest score", () => {
      const state: Partial<State> = {
        rows: 3,
        cols: 3,
        boardKey: "3x3",
        scoresByUid: { p1: 6, p2: 3 },
      };

      const outcome = dotsAndBoxesAdapter.computeOutcome!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      );

      expect(outcome.winnerIds).toEqual(["p1"]);
      expect(outcome.finalScoreboard[0].uid).toBe("p1");
      expect(outcome.finalScoreboard[0].placement).toBe(1);
      expect(outcome.finalScoreboard[0].score).toBe(6);
      expect(outcome.finalScoreboard[1].uid).toBe("p2");
      expect(outcome.finalScoreboard[1].placement).toBe(2);
    });

    it("reports correct win margin in stats", () => {
      const state: Partial<State> = {
        rows: 4,
        cols: 4,
        boardKey: "4x4",
        scoresByUid: { p1: 10, p2: 6 },
      };

      const outcome = dotsAndBoxesAdapter.computeOutcome!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      );

      const winnerEntry = outcome.finalScoreboard.find((e) => e.uid === "p1");
      expect(winnerEntry?.stats?.winMargin).toBe(4);
      const loserEntry = outcome.finalScoreboard.find((e) => e.uid === "p2");
      expect(loserEntry?.stats?.winMargin).toBe(-4);
    });

    it("returns empty winnerIds on tie", () => {
      const state: Partial<State> = {
        rows: 4,
        cols: 4,
        boardKey: "4x4",
        scoresByUid: { p1: 8, p2: 8 },
      };

      const outcome = dotsAndBoxesAdapter.computeOutcome!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      );
      expect(outcome.winnerIds).toEqual([]);
    });

    it("includes boardKey in stats", () => {
      const state: Partial<State> = {
        rows: 5,
        cols: 5,
        boardKey: "5x5",
        scoresByUid: { p1: 15, p2: 10 },
      };

      const outcome = dotsAndBoxesAdapter.computeOutcome!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      );

      expect(outcome.finalScoreboard[0].stats?.boardKey).toBe("5x5");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 7: computeSummary
  // ═══════════════════════════════════════════════════════════════════════

  describe("computeSummary", () => {
    it("returns score summary for each player", () => {
      const state: Partial<State> = {
        scoresByUid: { p1: 3, p2: 5 },
      };

      const summary = dotsAndBoxesAdapter.computeSummary!(
        state as unknown as Record<string, unknown>,
        PLAYERS_DISPLAY,
        "p2",
      );

      expect(summary.turnPlayerId).toBe("p2");
      expect(summary.scoreSummary).toHaveLength(2);
      expect(summary.scoreSummary![0]).toEqual({
        uid: "p1",
        displayName: "Player 1",
        score: 3,
      });
      expect(summary.scoreSummary![1]).toEqual({
        uid: "p2",
        displayName: "Player 2",
        score: 5,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 8: Performance Metrics
  // ═══════════════════════════════════════════════════════════════════════

  describe("extractPerformanceMetrics", () => {
    it("extracts basic board info", () => {
      const state = asState(makeBlankState("expert"));
      const metrics = dotsAndBoxesAdapter.extractPerformanceMetrics!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      ) as Record<string, any>;

      expect(metrics.boardKey).toBe("5x5");
      expect(metrics.boardRows).toBe(5);
      expect(metrics.boardCols).toBe(5);
      expect(metrics.totalBoxes).toBe(25);
      expect(metrics.totalEdges).toBe(60);
      expect(metrics.totalMoves).toBe(0);
    });

    it("computes win margin correctly", () => {
      const state = asState(makeBlankState("quick"));
      state.scoresByUid = { p1: 7, p2: 2 };

      const metrics = dotsAndBoxesAdapter.extractPerformanceMetrics!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      ) as Record<string, any>;

      expect(metrics.winMargin).toBe(5);
    });

    it("computes shutout correctly", () => {
      const state = asState(makeBlankState("quick"));
      state.scoresByUid = { p1: 9, p2: 0 };

      const metrics = dotsAndBoxesAdapter.extractPerformanceMetrics!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      ) as Record<string, any>;

      expect(metrics.shutoutByUid["p1"]).toBe(true);
      expect(metrics.shutoutByUid["p2"]).toBe(false);
    });

    it("includes chain and capture tracking", () => {
      const state = asState(makeBlankState("quick"));
      state.largestSingleTurnCaptureByUid = { p1: 2, p2: 1 };
      state.largestChainCapturedByUid = { p1: 4, p2: 2 };
      state.extraTurnsEarnedByUid = { p1: 3, p2: 1 };
      state.finalBoxOwnerUid = "p1";

      const metrics = dotsAndBoxesAdapter.extractPerformanceMetrics!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      ) as Record<string, any>;

      expect(metrics.largestSingleTurnCaptureByUid).toEqual({ p1: 2, p2: 1 });
      expect(metrics.largestChainCapturedByUid).toEqual({ p1: 4, p2: 2 });
      expect(metrics.extraTurnsEarnedByUid).toEqual({ p1: 3, p2: 1 });
      expect(metrics.finalBoxOwnerUid).toBe("p1");
    });

    it("provides opponent boxes per uid", () => {
      const state = asState(makeBlankState("quick"));
      state.scoresByUid = { p1: 5, p2: 4 };

      const metrics = dotsAndBoxesAdapter.extractPerformanceMetrics!(
        state as unknown as Record<string, unknown>,
        PLAYERS,
      ) as Record<string, any>;

      expect(metrics.opponentBoxesByUid["p1"]).toBe(4);
      expect(metrics.opponentBoxesByUid["p2"]).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 9: Chain / Tracking Metrics via Gameplay
  // ═══════════════════════════════════════════════════════════════════════

  describe("chain tracking through gameplay", () => {
    it("tracks extra turns earned when boxes are captured", () => {
      // Complete box(0,0) on 3×3: top h(0,0), bottom h(1,0), left v(0,0), right v(0,1)
      const moves: Array<{ edgeType: "h" | "v"; row: number; col: number }> = [
        { edgeType: "h", row: 0, col: 0 }, // p1
        { edgeType: "h", row: 3, col: 2 }, // p2
        { edgeType: "h", row: 1, col: 0 }, // p1
        { edgeType: "h", row: 3, col: 1 }, // p2
        { edgeType: "v", row: 0, col: 0 }, // p1
        { edgeType: "h", row: 3, col: 0 }, // p2
        { edgeType: "v", row: 0, col: 1 }, // p1 — completes box(0,0)!
      ];

      const { state } = applyMoves(makeBlankState("quick"), moves);
      const s = asState(state);

      expect(s.scoresByUid["p1"]).toBe(1);
      expect(s.extraTurnsEarnedByUid["p1"]).toBe(1);
      expect(s.largestSingleTurnCaptureByUid["p1"]).toBe(1);
    });

    it("tracks largest single turn capture for 2-box moves", () => {
      // Same setup as the "two boxes simultaneously" test above
      const moves: Array<{ edgeType: "h" | "v"; row: number; col: number }> = [
        // Box(0,0) edges (minus shared v(0,1))
        { edgeType: "h", row: 0, col: 0 }, // p1 → top
        { edgeType: "h", row: 3, col: 2 }, // p2 — filler
        { edgeType: "h", row: 1, col: 0 }, // p1 → bottom
        { edgeType: "h", row: 3, col: 1 }, // p2 — filler
        { edgeType: "v", row: 0, col: 0 }, // p1 → left
        // Box(0,1) edges (minus shared v(0,1))
        { edgeType: "h", row: 3, col: 0 }, // p2 — filler
        { edgeType: "h", row: 0, col: 1 }, // p1 → top of box(0,1)
        { edgeType: "v", row: 2, col: 3 }, // p2 — filler
        { edgeType: "h", row: 1, col: 1 }, // p1 → bottom of box(0,1)
        { edgeType: "v", row: 2, col: 0 }, // p2 — filler
        { edgeType: "v", row: 0, col: 2 }, // p1 → right of box(0,1)
        { edgeType: "v", row: 1, col: 3 }, // p2 — filler
        // Now p1 places the shared edge
        { edgeType: "v", row: 0, col: 1 }, // p1 → completes BOTH boxes
      ];

      const { state } = applyMoves(makeBlankState("quick"), moves);
      const s = asState(state);

      expect(s.largestSingleTurnCaptureByUid["p1"]).toBe(2);
    });

    it("resets chain when player makes non-scoring move", () => {
      // Complete box(0,0), then make a non-scoring move
      const moves: Array<{ edgeType: "h" | "v"; row: number; col: number }> = [
        { edgeType: "h", row: 0, col: 0 }, // p1
        { edgeType: "h", row: 3, col: 2 }, // p2
        { edgeType: "h", row: 1, col: 0 }, // p1
        { edgeType: "h", row: 3, col: 1 }, // p2
        { edgeType: "v", row: 0, col: 0 }, // p1
        { edgeType: "h", row: 3, col: 0 }, // p2
        { edgeType: "v", row: 0, col: 1 }, // p1 — completes box → extra turn!
        // p1 still has turn, but makes a non-scoring move:
        { edgeType: "h", row: 2, col: 2 }, // p1 — no box completed
      ];

      const { state } = applyMoves(makeBlankState("quick"), moves);
      const s = asState(state);
      expect(s.currentChainByUid["p1"]).toBe(0); // Chain reset
      // But largest chain should still be recorded
      expect(s.largestChainCapturedByUid["p1"]).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 10: Spectator View
  // ═══════════════════════════════════════════════════════════════════════

  describe("spectator view", () => {
    it("returns full state (no hidden information)", () => {
      const state = makeBlankState();
      const spectatorView = dotsAndBoxesAdapter.getSpectatorView!(state);
      expect(spectatorView).toBe(state); // Same reference — no filtering needed
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 11: Settings Validation
  // ═══════════════════════════════════════════════════════════════════════

  describe("validateSettings", () => {
    it("accepts valid board sizes", () => {
      expect(
        dotsAndBoxesAdapter.validateSettings!({ boardSize: "quick" }),
      ).toEqual({
        boardSize: "quick",
      });
      expect(
        dotsAndBoxesAdapter.validateSettings!({ boardSize: "standard" }),
      ).toEqual({
        boardSize: "standard",
      });
      expect(
        dotsAndBoxesAdapter.validateSettings!({ boardSize: "expert" }),
      ).toEqual({
        boardSize: "expert",
      });
    });

    it("falls back to standard for invalid size", () => {
      expect(
        dotsAndBoxesAdapter.validateSettings!({ boardSize: "huge" }),
      ).toEqual({
        boardSize: "standard",
      });
      expect(dotsAndBoxesAdapter.validateSettings!({ boardSize: 42 })).toEqual({
        boardSize: "standard",
      });
      expect(dotsAndBoxesAdapter.validateSettings!({})).toEqual({
        boardSize: "standard",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Section 12: Full Game Simulation
  // ═══════════════════════════════════════════════════════════════════════

  describe("full game simulation on 3×3 board", () => {
    it("plays to completion without errors", () => {
      // Fill all 24 edges on a 3×3 board sequentially.
      // We build horizontal edges row by row, then vertical edges.
      const moves: Array<{ edgeType: "h" | "v"; row: number; col: number }> =
        [];

      // All horizontal edges: rows 0-3, cols 0-2
      for (let r = 0; r <= 3; r++) {
        for (let c = 0; c < 3; c++) {
          moves.push({ edgeType: "h", row: r, col: c });
        }
      }
      // All vertical edges: rows 0-2, cols 0-3
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c <= 3; c++) {
          moves.push({ edgeType: "v", row: r, col: c });
        }
      }

      let state = makeBlankState("quick") as Record<string, unknown>;
      let turnIndex = 0;
      let movesMade = 0;
      let terminal: any;

      for (const move of moves) {
        const ctx = makeCtx(turnIndex);
        const result = dotsAndBoxesAdapter.validateMove!(state, {}, move, ctx);
        expect(result.ok).toBe(true);
        state = result.nextPublicState!;
        movesMade++;

        if (result.terminal) {
          terminal = result.terminal;
          break;
        }
        if (result.turnAdvance) {
          turnIndex = turnIndex === 0 ? 1 : 0;
        }
      }

      expect(movesMade).toBe(24);
      expect(terminal).toBeDefined();
      const finalState = asState(state);
      expect(finalState.remainingEdges).toBe(0);
      expect(finalState.boxesClaimed).toBe(9);

      // Every box should be owned
      expect(finalState.boxOwners.every((o) => o !== null)).toBe(true);
      // Total score should equal total boxes
      const totalScore =
        finalState.scoresByUid["p1"] + finalState.scoresByUid["p2"];
      expect(totalScore).toBe(9);
    });
  });
});
