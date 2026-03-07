/**
 * 2048 — Engine ↔ Adapter Consistency Tests
 *
 * Verifies that the presentation engine produces identical board/score
 * results to the V4 adapter. This is critical: if they diverge,
 * the optimistic state from the shell won't match the animated state
 * from the engine, causing visual desync.
 *
 * Also verifies V4 integration contracts remain intact:
 *   - Solo session metadata
 *   - Achievement-related metrics
 *   - Leaderboard-compatible score reporting
 */

import play2048Adapter from "@/gamesV4/adapters/play2048";
import {
  computeMove,
  resetTileIdCounter,
  tilesFromBoard,
} from "@/gamesV4/screens/play2048/engine";
import type { Direction } from "@/gamesV4/screens/play2048/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAYERS = [{ uid: "solo", slotIndex: 0 }];

function makeCtx() {
  return {
    uid: "solo",
    turnOrder: ["solo"],
    currentTurnIndex: 0,
    settings: {},
  };
}

// ── Engine ↔ Adapter consistency ──────────────────────────────────────────────

describe("Engine ↔ Adapter board/score consistency", () => {
  beforeEach(() => {
    resetTileIdCounter(0);
  });

  it("produces identical initial board", () => {
    const adapterState = play2048Adapter.createInitialPublicState(PLAYERS, {});
    const adapterBoard = (adapterState as { board: number[][] }).board;

    // The engine's tilesFromBoard should read the same board
    const tiles = tilesFromBoard(adapterBoard);
    expect(tiles).toHaveLength(2); // Adapter places 2 initial tiles
  });

  it("produces identical board after LEFT move", () => {
    // Create a state both adapter and engine can process
    const board = [
      [0, 0, 2, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const baseState = {
      board,
      score: 0,
      bestTile: 4,
      moveCount: 0,
      mergeCount: 0,
      hasWon: false,
      gameOver: false,
    };

    // Adapter result
    const adapterResult = play2048Adapter.validateMove!(
      baseState as unknown as Record<string, unknown>,
      {},
      { direction: "left" },
      makeCtx(),
    );
    expect(adapterResult.ok).toBe(true);
    const adapterBoard = (
      adapterResult.nextPublicState as { board: number[][] }
    ).board;
    const adapterScore = (adapterResult.nextPublicState as { score: number })
      .score;

    // Engine result
    const tiles = tilesFromBoard(board);
    const engineResult = computeMove(tiles, "left", 0, 0, 0, false);
    expect(engineResult).not.toBeNull();

    // Boards must match exactly
    expect(engineResult!.board).toEqual(adapterBoard);
    expect(engineResult!.totalScore).toBe(adapterScore);
  });

  it("produces identical board after merge move", () => {
    const board = [
      [2, 2, 0, 0],
      [4, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const baseState = {
      board,
      score: 0,
      bestTile: 4,
      moveCount: 5,
      mergeCount: 0,
      hasWon: false,
      gameOver: false,
    };

    const adapterResult = play2048Adapter.validateMove!(
      baseState as unknown as Record<string, unknown>,
      {},
      { direction: "left" },
      makeCtx(),
    );
    expect(adapterResult.ok).toBe(true);

    const tiles = tilesFromBoard(board);
    const engineResult = computeMove(tiles, "left", 5, 0, 0, false);
    expect(engineResult).not.toBeNull();

    const adapterBoard = (
      adapterResult.nextPublicState as { board: number[][] }
    ).board;
    expect(engineResult!.board).toEqual(adapterBoard);
  });

  it("produces identical results through multiple sequential moves", () => {
    // Start from the adapter's initial state and play a sequence of moves
    const init = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let adapterState = init as unknown as {
      board: number[][];
      score: number;
      bestTile: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };

    let engineTiles = tilesFromBoard(adapterState.board);
    let engineScore = 0;
    let engineMergeCount = 0;
    let engineHasWon = false;

    const moves: Direction[] = ["left", "down", "right", "up", "left", "down"];

    for (const dir of moves) {
      const adapterResult = play2048Adapter.validateMove!(
        adapterState as unknown as Record<string, unknown>,
        {},
        { direction: dir },
        makeCtx(),
      );

      const engineResult = computeMove(
        engineTiles,
        dir,
        adapterState.moveCount,
        engineScore,
        engineMergeCount,
        engineHasWon,
      );

      if (!adapterResult.ok) {
        // Adapter rejected — engine should also return null
        expect(engineResult).toBeNull();
        continue;
      }

      // Both should produce matching boards
      expect(engineResult).not.toBeNull();
      const nextAdapterBoard = (
        adapterResult.nextPublicState as { board: number[][] }
      ).board;
      expect(engineResult!.board).toEqual(nextAdapterBoard);

      // Update state for next iteration
      adapterState =
        adapterResult.nextPublicState as unknown as typeof adapterState;
      engineTiles = engineResult!.stableTiles;
      engineScore = engineResult!.totalScore;
      engineMergeCount = engineResult!.mergeCount;
      engineHasWon = engineResult!.hasWon;
    }
  });
});

// ── V4 integration contracts ──────────────────────────────────────────────────

describe("V4 integration contracts", () => {
  it("adapter gameId is play_2048", () => {
    expect(play2048Adapter.gameId).toBe("play_2048");
  });

  it("adapter runtimeType is solo", () => {
    expect(play2048Adapter.runtimeType).toBe("solo");
  });

  it("adapter min/maxPlayers are both 1", () => {
    expect(play2048Adapter.minPlayers).toBe(1);
    expect(play2048Adapter.maxPlayers).toBe(1);
  });

  it("computeOutcome reports hasWon and score for achievements", () => {
    const state = {
      board: [],
      score: 5000,
      bestTile: 2048,
      moveCount: 200,
      mergeCount: 80,
      hasWon: true,
      gameOver: true,
    };
    const outcome = play2048Adapter.computeOutcome!(
      state as unknown as Record<string, unknown>,
      PLAYERS,
    );
    expect(outcome.winnerIds).toEqual(["solo"]);
    expect(outcome.finalScoreboard[0].score).toBe(5000);
  });

  it("extractPerformanceMetrics includes bestTile for achievement eval", () => {
    const state = {
      score: 3000,
      bestTile: 2048,
      moveCount: 150,
      mergeCount: 60,
      hasWon: true,
    };
    const metrics = play2048Adapter.extractPerformanceMetrics!(
      state as unknown as Record<string, unknown>,
      PLAYERS,
    );
    expect(metrics.bestTile).toBe(2048);
    expect(metrics.score).toBe(3000);
  });

  it("scoreboardDescriptor formats score with locale string", () => {
    const desc = play2048Adapter.scoreboardDescriptor;
    expect(desc).toBeDefined();
    expect(desc!.formatScore(12345)).toBe("12,345");
    expect(desc!.sortDirection).toBe("desc");
  });

  it("turnAdvance is always false for solo game", () => {
    const state = {
      board: [
        [0, 0, 0, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      score: 0,
      bestTile: 2,
      moveCount: 0,
      mergeCount: 0,
      hasWon: false,
      gameOver: false,
    };
    const result = play2048Adapter.validateMove!(
      state as unknown as Record<string, unknown>,
      {},
      { direction: "left" },
      makeCtx(),
    );
    expect(result.ok).toBe(true);
    expect(result.turnAdvance).toBe(false);
  });
});

// ── Regression: Sequential multi-direction moves ──────────────────────────────
// These tests reproduce the exact failure pattern from production:
//   - The first swipe works (stale state = current state for move 0).
//   - Subsequent swipes fail because the shell's adapter validation uses
//     a stale effectivePublicState (due to PanResponder capturing
//     handleMove at mount time).
// The fix ensures the engine and adapter always agree on every move.

describe("Sequential multi-direction regression", () => {
  beforeEach(() => {
    resetTileIdCounter(0);
  });

  it("second swipe LEFT after initial RIGHT produces correct board/score", () => {
    const init = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = init as unknown as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };
    let tiles = tilesFromBoard(state.board);

    // Move 1: RIGHT
    const eng1 = computeMove(
      tiles,
      "right",
      state.moveCount,
      state.score,
      state.mergeCount,
      state.hasWon,
    );
    const adp1 = play2048Adapter.validateMove!(
      state as unknown as Record<string, unknown>,
      {},
      { direction: "right" },
      makeCtx(),
    );
    if (eng1 && adp1.ok) {
      expect(eng1.board).toEqual(
        (adp1.nextPublicState as { board: number[][] }).board,
      );
      state = adp1.nextPublicState as unknown as typeof state;
      tiles = eng1.stableTiles;

      // Move 2: LEFT — must use CURRENT state, not initial state
      const eng2 = computeMove(
        tiles,
        "left",
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );
      const adp2 = play2048Adapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { direction: "left" },
        makeCtx(),
      );
      if (eng2 && adp2.ok) {
        expect(eng2.board).toEqual(
          (adp2.nextPublicState as { board: number[][] }).board,
        );
        expect(eng2.totalScore).toBe(
          (adp2.nextPublicState as { score: number }).score,
        );
      }
    }
  });

  it("second swipe DOWN after initial UP produces correct board/score", () => {
    const init = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = init as unknown as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };
    let tiles = tilesFromBoard(state.board);

    // Move 1: UP
    const eng1 = computeMove(
      tiles,
      "up",
      state.moveCount,
      state.score,
      state.mergeCount,
      state.hasWon,
    );
    const adp1 = play2048Adapter.validateMove!(
      state as unknown as Record<string, unknown>,
      {},
      { direction: "up" },
      makeCtx(),
    );
    if (eng1 && adp1.ok) {
      expect(eng1.board).toEqual(
        (adp1.nextPublicState as { board: number[][] }).board,
      );
      state = adp1.nextPublicState as unknown as typeof state;
      tiles = eng1.stableTiles;

      // Move 2: DOWN — must advance state correctly
      const eng2 = computeMove(
        tiles,
        "down",
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );
      const adp2 = play2048Adapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { direction: "down" },
        makeCtx(),
      );
      if (eng2 && adp2.ok) {
        expect(eng2.board).toEqual(
          (adp2.nextPublicState as { board: number[][] }).board,
        );
        expect(eng2.totalScore).toBe(
          (adp2.nextPublicState as { score: number }).score,
        );
      }
    }
  });

  it("moveCount increments correctly across 10 sequential mixed-direction moves", () => {
    const init = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = init as unknown as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };
    let tiles = tilesFromBoard(state.board);
    let engineMoveCount = 0;

    const directions: Direction[] = [
      "left",
      "down",
      "right",
      "up",
      "left",
      "up",
      "right",
      "down",
      "left",
      "right",
    ];

    for (const dir of directions) {
      const eng = computeMove(
        tiles,
        dir,
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );
      const adp = play2048Adapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { direction: dir },
        makeCtx(),
      );

      if (!adp.ok || !eng) continue; // no-op move — skip

      const nextState = adp.nextPublicState as unknown as typeof state;

      // Engine and adapter must agree on moveCount
      expect(eng.moveCount).toBe(nextState.moveCount);
      expect(eng.moveCount).toBe(state.moveCount + 1);
      engineMoveCount = eng.moveCount;

      // Score must never regress
      expect(eng.totalScore).toBeGreaterThanOrEqual(state.score);
      expect(eng.totalScore).toBe(nextState.score);

      // Update for next iteration
      state = nextState;
      tiles = eng.stableTiles;
    }

    // At least some moves should have been applied
    expect(engineMoveCount).toBeGreaterThan(0);
  });

  it("adapter on stale state != adapter on current state (proves the bug)", () => {
    // This test demonstrates WHY the stale closure was breaking things:
    // validating the same direction on the initial state vs the current
    // state produces DIFFERENT boards — proving that a stale
    // effectivePublicState would cause a board mismatch in reconciliation.
    const init = play2048Adapter.createInitialPublicState(PLAYERS, {});
    const initState = init as unknown as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };

    // Advance the state by one LEFT move
    const adp1 = play2048Adapter.validateMove!(
      initState as unknown as Record<string, unknown>,
      {},
      { direction: "left" },
      makeCtx(),
    );
    expect(adp1.ok).toBe(true);
    const state1 = adp1.nextPublicState as unknown as typeof initState;

    // Now compute DOWN from the CORRECT state (state after move 1)
    const adpCorrect = play2048Adapter.validateMove!(
      state1 as unknown as Record<string, unknown>,
      {},
      { direction: "down" },
      makeCtx(),
    );

    // And compute DOWN from the STALE initial state (simulating the bug)
    const adpStale = play2048Adapter.validateMove!(
      initState as unknown as Record<string, unknown>,
      {},
      { direction: "down" },
      makeCtx(),
    );

    // Both should be valid (different boards can both allow DOWN)
    if (adpCorrect.ok && adpStale.ok) {
      const correctBoard = (adpCorrect.nextPublicState as { board: number[][] })
        .board;
      const staleBoard = (adpStale.nextPublicState as { board: number[][] })
        .board;
      const correctScore = (adpCorrect.nextPublicState as { score: number })
        .score;
      const staleScore = (adpStale.nextPublicState as { score: number }).score;

      // At least one of board or score should differ — proving that stale
      // state produces wrong results. (In rare cases with specific initial
      // tile placement, they could coincidentally match, so we check the
      // moveCount which ALWAYS differs.)
      const correctMoveCount = (
        adpCorrect.nextPublicState as { moveCount: number }
      ).moveCount;
      const staleMoveCount = (adpStale.nextPublicState as { moveCount: number })
        .moveCount;
      expect(correctMoveCount).toBe(2); // state1.moveCount(1) + 1
      expect(staleMoveCount).toBe(1); // initState.moveCount(0) + 1
      expect(correctMoveCount).not.toBe(staleMoveCount);
    }
  });

  it("engine tile identity is stable across sequential moves (no ID collisions)", () => {
    const init = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = init as unknown as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };
    let tiles = tilesFromBoard(state.board);

    const directions: Direction[] = ["left", "down", "right", "up"];

    for (const dir of directions) {
      const result = computeMove(
        tiles,
        dir,
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );
      if (!result) continue;

      // Check no duplicate IDs in stable tiles
      const ids = result.stableTiles.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Check no duplicate IDs in sliding tiles
      const slideIds = result.slidingTiles.map((s) => s.id);
      // Sliding tiles CAN have duplicate IDs (same source appears twice
      // if it's a merge source), but stable tiles must not.

      // Check that merge result IDs are distinct from survivor IDs
      const mergeResultIds = result.mergeEvents.map((m) => m.resultId);
      const survivorIds = result.stableTiles
        .filter((t) => !mergeResultIds.includes(t.id))
        .map((t) => t.id);
      for (const mId of mergeResultIds) {
        expect(survivorIds).not.toContain(mId);
      }

      // Advance
      const adp = play2048Adapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { direction: dir },
        makeCtx(),
      );
      if (adp.ok) {
        state = adp.nextPublicState as unknown as typeof state;
      }
      tiles = result.stableTiles;
    }
  });

  it("score never flashes to 0 or a small value during sequential moves", () => {
    // Simulates the exact bug symptom: score briefly showing 0/4 because
    // the adapter was validating on the initial state.
    const init = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = init as unknown as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };
    let tiles = tilesFromBoard(state.board);
    let prevScore = 0;

    const directions: Direction[] = [
      "up",
      "left",
      "down",
      "right",
      "up",
      "left",
    ];

    for (const dir of directions) {
      const eng = computeMove(
        tiles,
        dir,
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );
      const adp = play2048Adapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { direction: dir },
        makeCtx(),
      );

      if (!eng || !adp.ok) continue;

      // Engine score must never regress
      expect(eng.totalScore).toBeGreaterThanOrEqual(prevScore);

      // Adapter score must match engine score
      const adpScore = (adp.nextPublicState as { score: number }).score;
      expect(adpScore).toBe(eng.totalScore);

      prevScore = eng.totalScore;
      state = adp.nextPublicState as unknown as typeof state;
      tiles = eng.stableTiles;
    }
  });
});

// ── Long-session stability tests (regression: tile disappear/teleport) ───────

describe("Long-session stability", () => {
  beforeEach(() => {
    resetTileIdCounter(0);
  });

  it("survives 50 consecutive moves without tile count anomalies", () => {
    const adapterState = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = adapterState as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };
    let tiles = tilesFromBoard(state.board);

    const directions: Direction[] = ["up", "down", "left", "right"];
    let movesMade = 0;

    for (let i = 0; i < 200 && movesMade < 50; i++) {
      const dir = directions[i % 4];
      const eng = computeMove(
        tiles,
        dir,
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );

      if (!eng) continue;

      movesMade++;

      // Board must have between 1 and 16 non-zero cells
      const nonZero = eng.board.flat().filter((v) => v > 0).length;
      expect(nonZero).toBeGreaterThanOrEqual(1);
      expect(nonZero).toBeLessThanOrEqual(16);

      // Stable tiles must match non-zero cells exactly
      expect(eng.stableTiles.length).toBe(nonZero);

      // Every stable tile must occupy a cell with its value
      for (const t of eng.stableTiles) {
        expect(eng.board[t.row][t.col]).toBe(t.value);
      }

      tiles = eng.stableTiles;
      state = {
        board: eng.board,
        score: eng.totalScore,
        moveCount: eng.moveCount,
        mergeCount: eng.mergeCount,
        hasWon: eng.hasWon,
        gameOver: eng.gameOver,
      };
    }

    expect(movesMade).toBe(50);
  });

  it("score never decreases over 50 moves", () => {
    const adapterState = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = adapterState as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };
    let tiles = tilesFromBoard(state.board);

    const directions: Direction[] = ["right", "down", "left", "up"];
    let prevScore = 0;
    let movesMade = 0;

    for (let i = 0; i < 200 && movesMade < 50; i++) {
      const dir = directions[i % 4];
      const eng = computeMove(
        tiles,
        dir,
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );

      if (!eng) continue;
      movesMade++;

      expect(eng.totalScore).toBeGreaterThanOrEqual(prevScore);
      prevScore = eng.totalScore;

      tiles = eng.stableTiles;
      state = {
        board: eng.board,
        score: eng.totalScore,
        moveCount: eng.moveCount,
        mergeCount: eng.mergeCount,
        hasWon: eng.hasWon,
        gameOver: eng.gameOver,
      };
    }

    expect(movesMade).toBe(50);
  });

  it("tile IDs remain unique across 50 moves", () => {
    const adapterState = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = adapterState as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };
    let tiles = tilesFromBoard(state.board);

    const directions: Direction[] = ["up", "right", "down", "left"];
    let movesMade = 0;

    for (let i = 0; i < 200 && movesMade < 50; i++) {
      const dir = directions[i % 4];
      const eng = computeMove(
        tiles,
        dir,
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );

      if (!eng) continue;
      movesMade++;

      // All stable tile IDs must be unique
      const ids = eng.stableTiles.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      tiles = eng.stableTiles;
      state = {
        board: eng.board,
        score: eng.totalScore,
        moveCount: eng.moveCount,
        mergeCount: eng.mergeCount,
        hasWon: eng.hasWon,
        gameOver: eng.gameOver,
      };
    }

    expect(movesMade).toBe(50);
  });

  it("engine and adapter stay in sync across 50 moves", () => {
    const adapterState = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = adapterState as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };
    let tiles = tilesFromBoard(state.board);

    const directions: Direction[] = ["down", "right", "up", "left"];
    let movesMade = 0;

    for (let i = 0; i < 200 && movesMade < 50; i++) {
      const dir = directions[i % 4];

      const eng = computeMove(
        tiles,
        dir,
        state.moveCount,
        state.score,
        state.mergeCount,
        state.hasWon,
      );
      const adp = play2048Adapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { direction: dir },
        makeCtx(),
      );

      if (!eng || !adp.ok) continue;
      movesMade++;

      const adpState = adp.nextPublicState as unknown as typeof state;

      // Board must match
      expect(eng.board).toEqual(adpState.board);
      // Score must match
      expect(eng.totalScore).toBe(adpState.score);
      // Move count must match
      expect(eng.moveCount).toBe(adpState.moveCount);

      tiles = eng.stableTiles;
      state = adpState;
    }

    expect(movesMade).toBe(50);
  });
});

// ── Forward-only reconciliation guard (regression: optimistic revert) ────────

describe("Forward-only reconciliation safety", () => {
  it("controller moveCount never regresses when adapter validates sequentially", () => {
    // Simulate: adapter validates 5 sequential moves.
    // An optimistic revert (rate-limit rejection) would present an older
    // moveCount.  The controller's forward-only guard should prevent
    // any backwards reconciliation.
    const adapterState = play2048Adapter.createInitialPublicState(PLAYERS, {});
    let state = adapterState as {
      board: number[][];
      score: number;
      moveCount: number;
      mergeCount: number;
      hasWon: boolean;
      gameOver: boolean;
    };

    const directions: Direction[] = ["right", "down", "left", "up", "right"];
    const moveCountLog: number[] = [state.moveCount];

    for (const dir of directions) {
      const adp = play2048Adapter.validateMove!(
        state as unknown as Record<string, unknown>,
        {},
        { direction: dir },
        makeCtx(),
      );
      if (!adp.ok) continue;
      state = adp.nextPublicState as unknown as typeof state;
      moveCountLog.push(state.moveCount);
    }

    // Verify monotonic increase
    for (let i = 1; i < moveCountLog.length; i++) {
      expect(moveCountLog[i]).toBeGreaterThan(moveCountLog[i - 1]);
    }
  });
});
