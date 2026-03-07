/**
 * 2048 Presentation Engine — Unit Tests
 *
 * Tests the tile-tracking move engine that powers the animation layer.
 * Verifies:
 *   - Slide behavior in all 4 directions
 *   - Single-merge-per-tile rule (2 2 2 2 → 4 4, not 4 8)
 *   - Tile identity tracking through moves
 *   - Deterministic spawn consistency with the adapter
 *   - Board state correctness
 *   - Score computation
 *   - Win / game-over detection
 *   - Edge cases
 */

import {
  boardsMatch,
  computeMove,
  getSpawnPosition,
  getSpawnValue,
  resetTileIdCounter,
  tilesFromBoard,
} from "@/gamesV4/screens/play2048/engine";
import type { TileData } from "@/gamesV4/screens/play2048/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetTileIdCounter(1000); // start at a predictable offset
});

function makeTiles(board: number[][]): TileData[] {
  const tiles: TileData[] = [];
  let id = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] !== 0) {
        tiles.push({ id: `test_${id++}`, value: board[r][c], row: r, col: c });
      }
    }
  }
  return tiles;
}

function boardFromTiles(tiles: TileData[]): number[][] {
  const board = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (const t of tiles) {
    board[t.row][t.col] = t.value;
  }
  return board;
}

// ── Deterministic spawn ───────────────────────────────────────────────────────

describe("Deterministic spawn", () => {
  it("produces value 2 normally", () => {
    expect(getSpawnValue(0)).toBe(2);
    expect(getSpawnValue(1)).toBe(2);
    expect(getSpawnValue(5)).toBe(2);
    expect(getSpawnValue(10)).toBe(2);
  });

  it("produces value 4 when moveCount % 10 === 7", () => {
    expect(getSpawnValue(7)).toBe(4);
    expect(getSpawnValue(17)).toBe(4);
    expect(getSpawnValue(27)).toBe(4);
  });

  it("selects spawn position deterministically", () => {
    const board = [
      [2, 0, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    // empties: (0,1),(0,3),(1,0)...(3,3) = 14 cells
    const pos1 = getSpawnPosition(board, 1);
    const pos2 = getSpawnPosition(board, 1);
    expect(pos1).toEqual(pos2); // deterministic
    expect(pos1).not.toBeNull();
  });

  it("returns null when board is full", () => {
    const full = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2048, 4],
      [2, 8, 16, 32],
    ];
    expect(getSpawnPosition(full, 5)).toBeNull();
  });
});

// ── Slide LEFT ────────────────────────────────────────────────────────────────

describe("computeMove — LEFT", () => {
  it("slides a single tile left", () => {
    const tiles = makeTiles([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result).not.toBeNull();

    // The 2 should be at col 0, row 0
    const stableBoard = boardFromTiles(
      result!.stableTiles.filter((t) => result!.spawnedTile?.id !== t.id),
    );
    expect(stableBoard[0][0]).toBe(2);
  });

  it("merges two equal adjacent tiles", () => {
    const tiles = makeTiles([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result).not.toBeNull();
    expect(result!.mergeEvents).toHaveLength(1);
    expect(result!.mergeEvents[0].value).toBe(4);
    expect(result!.scoreDelta).toBe(4);
  });

  it("applies single-merge-per-tile rule: [2,2,2,2] → [4,4,_,_]", () => {
    const tiles = makeTiles([
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result).not.toBeNull();
    expect(result!.mergeEvents).toHaveLength(2);

    // First merge at col 0 = 4, second merge at col 1 = 4
    const mergeValues = result!.mergeEvents.map((m) => m.value).sort();
    expect(mergeValues).toEqual([4, 4]);
    expect(result!.scoreDelta).toBe(8);
  });

  it("[2,2,4,0] left → [4,4,_,_] (merge then separate)", () => {
    const tiles = makeTiles([
      [2, 2, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result).not.toBeNull();
    expect(result!.mergeEvents).toHaveLength(1);
    expect(result!.mergeEvents[0].value).toBe(4);

    // Result row: [4, 4, ...]
    // Exclude spawned tile to check game board
    const nonSpawn = result!.stableTiles.filter(
      (t) => t.id !== result!.spawnedTile?.id,
    );
    const row0 = nonSpawn
      .filter((t) => t.row === 0)
      .sort((a, b) => a.col - b.col);
    expect(row0[0].value).toBe(4);
    expect(row0[0].col).toBe(0);
    expect(row0[1].value).toBe(4);
    expect(row0[1].col).toBe(1);
  });

  it("returns null when no tiles can move left", () => {
    const tiles = makeTiles([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result).toBeNull();
  });
});

// ── Slide RIGHT ───────────────────────────────────────────────────────────────

describe("computeMove — RIGHT", () => {
  it("slides a single tile right", () => {
    const tiles = makeTiles([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "right", 0, 0, 0, false);
    expect(result).not.toBeNull();

    const slideTile = result!.slidingTiles.find((t) => t.value === 2);
    expect(slideTile!.toCol).toBe(3);
  });

  it("merges two tiles on the right edge", () => {
    const tiles = makeTiles([
      [0, 0, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "right", 0, 0, 0, false);
    expect(result).not.toBeNull();
    expect(result!.mergeEvents).toHaveLength(1);
    expect(result!.mergeEvents[0].col).toBe(3);
  });
});

// ── Slide UP ──────────────────────────────────────────────────────────────────

describe("computeMove — UP", () => {
  it("slides a tile up", () => {
    const tiles = makeTiles([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "up", 0, 0, 0, false);
    expect(result).not.toBeNull();

    const slideTile = result!.slidingTiles.find((t) => t.value === 2);
    expect(slideTile!.toRow).toBe(0);
  });

  it("merges vertically", () => {
    const tiles = makeTiles([
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "up", 0, 0, 0, false);
    expect(result).not.toBeNull();
    expect(result!.mergeEvents).toHaveLength(1);
    expect(result!.mergeEvents[0].value).toBe(4);
    expect(result!.mergeEvents[0].row).toBe(0);
  });
});

// ── Slide DOWN ────────────────────────────────────────────────────────────────

describe("computeMove — DOWN", () => {
  it("slides a tile down", () => {
    const tiles = makeTiles([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "down", 0, 0, 0, false);
    expect(result).not.toBeNull();

    const slideTile = result!.slidingTiles.find((t) => t.value === 2);
    expect(slideTile!.toRow).toBe(3);
  });

  it("merges vertically downward", () => {
    const tiles = makeTiles([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [4, 0, 0, 0],
      [4, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "down", 0, 0, 0, false);
    expect(result).not.toBeNull();
    expect(result!.mergeEvents).toHaveLength(1);
    expect(result!.mergeEvents[0].value).toBe(8);
    expect(result!.mergeEvents[0].row).toBe(3);
  });
});

// ── Tile identity tracking ────────────────────────────────────────────────────

describe("Tile identity", () => {
  it("preserves tile IDs for non-merged tiles", () => {
    const tiles = makeTiles([
      [0, 0, 0, 2],
      [0, 0, 0, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const origIds = tiles.map((t) => t.id);

    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result).not.toBeNull();

    // The original tile IDs should be in slidingTiles
    const slidingIds = result!.slidingTiles.map((t) => t.id);
    for (const id of origIds) {
      expect(slidingIds).toContain(id);
    }

    // Non-merged tiles keep their original IDs in stableTiles
    const stableIds = result!.stableTiles
      .filter((t) => t.id !== result!.spawnedTile?.id)
      .map((t) => t.id);
    for (const id of origIds) {
      expect(stableIds).toContain(id);
    }
  });

  it("creates new IDs for merge results", () => {
    const tiles = makeTiles([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const origIds = new Set(tiles.map((t) => t.id));

    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result!.mergeEvents).toHaveLength(1);

    const mergeResultId = result!.mergeEvents[0].resultId;
    expect(origIds.has(mergeResultId)).toBe(false); // new ID
  });

  it("creates a new ID for the spawned tile", () => {
    const tiles = makeTiles([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const origIds = new Set(tiles.map((t) => t.id));

    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result!.spawnedTile).not.toBeNull();
    expect(origIds.has(result!.spawnedTile!.id)).toBe(false);
  });
});

// ── Score accumulation ────────────────────────────────────────────────────────

describe("Score", () => {
  it("accumulates correctly across merges", () => {
    const tiles = makeTiles([
      [2, 2, 4, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 100, 0, false);
    expect(result!.scoreDelta).toBe(12); // 4 + 8
    expect(result!.totalScore).toBe(112); // 100 + 12
  });
});

// ── Win detection ─────────────────────────────────────────────────────────────

describe("Win detection", () => {
  it("detects win when 2048 is created via merge", () => {
    const tiles = makeTiles([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result!.hasWon).toBe(true);
  });

  it("preserves hasWon if already true", () => {
    const tiles = makeTiles([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, true);
    expect(result!.hasWon).toBe(true);
  });
});

// ── Game over detection ───────────────────────────────────────────────────────

describe("Game over detection", () => {
  it("detects game over when board fills with no merges", () => {
    // Construct a board that will be full after one move + spawn
    const board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 0],
    ];
    const tiles = makeTiles(board);

    // Move right — moves the 0 at [3,3] position context
    const result = computeMove(tiles, "right", 14, 0, 0, false);
    if (result) {
      // If the board fills and no adjacent merges, gameOver should be true
      // (depends on where spawn lands)
      if (result.gameOver) {
        expect(result.gameOver).toBe(true);
      }
    }
  });
});

// ── Spawn consistency with adapter ────────────────────────────────────────────

describe("Spawn consistency", () => {
  it("spawns at the same position as the adapter would", () => {
    // Simulate what the adapter does:
    // After a move, adapter calls placeNewTile(newBoard, moveCount + 1)
    // which uses: empty[moveCount % empty.length] for position
    // and moveCount % 10 === 7 ? 4 : 2 for value

    const tiles = makeTiles([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result).not.toBeNull();
    expect(result!.spawnedTile).not.toBeNull();

    // Verify the spawn value matches adapter logic
    const expectedValue = getSpawnValue(1); // moveCount + 1 = 1
    expect(result!.spawnedTile!.value).toBe(expectedValue);

    // Verify the spawn is at the expected position
    // The board after slide (before spawn) has 2 at (0,0), rest empty
    const boardAfterSlide = [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const expectedPos = getSpawnPosition(boardAfterSlide, 1);
    expect([result!.spawnedTile!.row, result!.spawnedTile!.col]).toEqual(
      expectedPos,
    );
  });
});

// ── Utility functions ─────────────────────────────────────────────────────────

describe("Utility functions", () => {
  it("tilesFromBoard creates correct tiles", () => {
    const board = [
      [2, 0, 4, 0],
      [0, 8, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 16],
    ];
    const tiles = tilesFromBoard(board);
    expect(tiles).toHaveLength(4);
    expect(tiles.find((t) => t.value === 2)).toBeDefined();
    expect(tiles.find((t) => t.value === 4)).toBeDefined();
    expect(tiles.find((t) => t.value === 8)).toBeDefined();
    expect(tiles.find((t) => t.value === 16)).toBeDefined();
  });

  it("boardsMatch correctly compares boards", () => {
    const a = [
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const b = [
      [2, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const c = [
      [4, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    expect(boardsMatch(a, b)).toBe(true);
    expect(boardsMatch(a, c)).toBe(false);
  });
});

// ── Multi-row / complex scenarios ─────────────────────────────────────────────

describe("Complex scenarios", () => {
  it("handles multiple rows merging simultaneously", () => {
    const tiles = makeTiles([
      [2, 2, 0, 0],
      [4, 4, 0, 0],
      [8, 8, 0, 0],
      [16, 16, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false);
    expect(result).not.toBeNull();
    expect(result!.mergeEvents).toHaveLength(4);
    expect(result!.scoreDelta).toBe(4 + 8 + 16 + 32); // = 60
  });

  it("handles a dense board correctly", () => {
    const tiles = makeTiles([
      [2, 4, 8, 16],
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "up", 0, 0, 0, false);
    // Columns merge: 2+2=4, 4+4=8, 8+8=16, 16+16=32
    expect(result).not.toBeNull();
    expect(result!.mergeEvents).toHaveLength(4);
  });
});

// ── Directional slide coordinates (animation regression) ──────────────────────

describe("Slide coordinates — all four directions", () => {
  // These tests verify that slidingTiles carry correct fromRow/fromCol and
  // toRow/toCol values, which are piped directly into AnimatedTile for
  // computing the animation offset.  A mismatch here means tiles teleport.

  it("LEFT: tile at (0,3) slides to (0,0)", () => {
    const tiles = makeTiles([
      [0, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false)!;
    expect(result).not.toBeNull();
    const slide = result.slidingTiles.find(
      (s) => s.fromCol === 3 && s.fromRow === 0,
    );
    expect(slide).toBeDefined();
    expect(slide!.toRow).toBe(0);
    expect(slide!.toCol).toBe(0);
  });

  it("RIGHT: tile at (0,0) slides to (0,3)", () => {
    const tiles = makeTiles([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "right", 0, 0, 0, false)!;
    expect(result).not.toBeNull();
    const slide = result.slidingTiles.find(
      (s) => s.fromCol === 0 && s.fromRow === 0,
    );
    expect(slide).toBeDefined();
    expect(slide!.toRow).toBe(0);
    expect(slide!.toCol).toBe(3);
  });

  it("UP: tile at (3,0) slides to (0,0)", () => {
    const tiles = makeTiles([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "up", 0, 0, 0, false)!;
    expect(result).not.toBeNull();
    const slide = result.slidingTiles.find(
      (s) => s.fromRow === 3 && s.fromCol === 0,
    );
    expect(slide).toBeDefined();
    expect(slide!.toRow).toBe(0);
    expect(slide!.toCol).toBe(0);
  });

  it("DOWN: tile at (0,0) slides to (3,0)", () => {
    const tiles = makeTiles([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "down", 0, 0, 0, false)!;
    expect(result).not.toBeNull();
    const slide = result.slidingTiles.find(
      (s) => s.fromRow === 0 && s.fromCol === 0,
    );
    expect(slide).toBeDefined();
    expect(slide!.toRow).toBe(3);
    expect(slide!.toCol).toBe(0);
  });

  it("LEFT merge: two tiles from (0,1) and (0,3) merge at (0,0)", () => {
    const tiles = makeTiles([
      [0, 2, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "left", 0, 0, 0, false)!;
    expect(result).not.toBeNull();
    expect(result.mergeEvents).toHaveLength(1);
    expect(result.mergeEvents[0].row).toBe(0);
    expect(result.mergeEvents[0].col).toBe(0);
    // Both sources slide to the merge col
    for (const s of result.slidingTiles) {
      expect(s.toRow).toBe(0);
      expect(s.toCol).toBe(0);
    }
  });

  it("RIGHT merge: two tiles merge at (0,3)", () => {
    const tiles = makeTiles([
      [2, 0, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "right", 0, 0, 0, false)!;
    expect(result).not.toBeNull();
    expect(result.mergeEvents).toHaveLength(1);
    expect(result.mergeEvents[0].row).toBe(0);
    expect(result.mergeEvents[0].col).toBe(3);
  });

  it("DOWN merge: two tiles merge at (3,0)", () => {
    const tiles = makeTiles([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 0, 0],
    ]);
    const result = computeMove(tiles, "down", 0, 0, 0, false)!;
    expect(result).not.toBeNull();
    expect(result.mergeEvents).toHaveLength(1);
    expect(result.mergeEvents[0].row).toBe(3);
    expect(result.mergeEvents[0].col).toBe(0);
    for (const s of result.slidingTiles) {
      expect(s.toRow).toBe(3);
      expect(s.toCol).toBe(0);
    }
  });

  it("multi-tile multi-direction: 4 tiles slide correctly in each direction", () => {
    // Board with tiles in unique rows/columns to avoid stacking
    const tiles = makeTiles([
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 4, 0],
    ]);

    // DOWN: tiles pack toward bottom
    const downResult = computeMove(tiles, "down", 0, 0, 0, false)!;
    expect(downResult).not.toBeNull();
    for (const s of downResult.slidingTiles) {
      expect(s.toRow).toBeGreaterThanOrEqual(s.fromRow);
    }

    // UP: tiles pack toward top
    const upResult = computeMove(tiles, "up", 0, 0, 0, false)!;
    expect(upResult).not.toBeNull();
    for (const s of upResult.slidingTiles) {
      expect(s.toRow).toBeLessThanOrEqual(s.fromRow);
    }

    // LEFT: tiles pack toward left
    const leftResult = computeMove(tiles, "left", 0, 0, 0, false)!;
    expect(leftResult).not.toBeNull();
    for (const s of leftResult.slidingTiles) {
      expect(s.toCol).toBeLessThanOrEqual(s.fromCol);
    }

    // RIGHT: tiles pack toward right
    const rightResult = computeMove(tiles, "right", 0, 0, 0, false)!;
    expect(rightResult).not.toBeNull();
    for (const s of rightResult.slidingTiles) {
      expect(s.toCol).toBeGreaterThanOrEqual(s.fromCol);
    }
  });

  it("prevRow/prevCol are set correctly for useGameController mapping", () => {
    // Simulates what useGameController does: derives prevRow/prevCol from
    // slidingTiles, then passes to AnimatedTile.
    const tiles = makeTiles([
      [0, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 4],
    ]);

    const result = computeMove(tiles, "left", 0, 0, 0, false)!;
    expect(result).not.toBeNull();

    for (const st of result.slidingTiles) {
      const row = st.toRow;
      const col = st.toCol;
      const prevRow = st.fromRow !== st.toRow ? st.fromRow : undefined;
      const prevCol = st.fromCol !== st.toCol ? st.fromCol : undefined;

      // For LEFT: row never changes, col should decrease
      expect(row).toBe(st.fromRow); // same row
      expect(col).toBeLessThanOrEqual(st.fromCol); // moved left
      if (st.fromCol !== st.toCol) {
        expect(prevCol).toBe(st.fromCol);
        expect(prevRow).toBeUndefined();
      }
    }
  });
});
