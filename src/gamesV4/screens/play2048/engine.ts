/**
 * 2048 Presentation Engine — Tile-Tracking Move Logic
 *
 * Pure functions that compute moves while tracking individual tile
 * identities. This enables the animated presentation layer to
 * smoothly slide tiles from old → new positions.
 *
 * IMPORTANT: The deterministic spawn logic here MUST match the
 * adapter (`play2048.ts`) and the server adapter exactly:
 *   - Spawn position: `moveCount % emptyCells.length`
 *   - Spawn value:    `moveCount % 10 === 7 ? 4 : 2`
 *
 * @module gamesV4/screens/play2048/engine
 */

import type {
  Direction,
  MergeEvent,
  MoveResult,
  SlidingTile,
  SpawnedTile,
  TileData,
} from "./types";

const GRID_SIZE = 4;
const WIN_TILE = 2048;

// ── Tile ID generator ─────────────────────────────────────────────────────────

let _tileIdSeq = 0;

/** Generate a unique tile ID. */
export function nextTileId(): string {
  return `t${++_tileIdSeq}`;
}

/** Reset the ID counter (for tests). */
export function resetTileIdCounter(value = 0): void {
  _tileIdSeq = value;
}

// ── Deterministic spawn — must match adapter exactly ──────────────────────────

export function getSpawnValue(moveCount: number): number {
  return moveCount % 10 === 7 ? 4 : 2;
}

export function getSpawnPosition(
  board: number[][],
  moveCount: number,
): [number, number] | null {
  const empty: Array<[number, number]> = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return null;
  return empty[moveCount % empty.length];
}

// ── Board helpers ─────────────────────────────────────────────────────────────

function canMoveBoard(board: number[][]): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) return true;
      if (c + 1 < GRID_SIZE && board[r][c] === board[r][c + 1]) return true;
      if (r + 1 < GRID_SIZE && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

function bestTileOnBoard(board: number[][]): number {
  let best = 0;
  for (const row of board) {
    for (const v of row) {
      if (v > best) best = v;
    }
  }
  return best;
}

// ── Direction-aware line extraction ───────────────────────────────────────────

interface LineExtractor {
  /** Which line (row or column) does this tile belong to? */
  getLineKey: (tile: TileData) => number;
  /** Virtual position within the line (0 = toward the wall). */
  getVirtualPos: (tile: TileData) => number;
  /** Convert (lineKey, virtualPos) → [row, col] in real coordinates. */
  toCoords: (lineKey: number, vPos: number) => [number, number];
}

const EXTRACTORS: Record<Direction, LineExtractor> = {
  left: {
    getLineKey: (t) => t.row,
    getVirtualPos: (t) => t.col,
    toCoords: (lineKey, vPos) => [lineKey, vPos],
  },
  right: {
    getLineKey: (t) => t.row,
    getVirtualPos: (t) => GRID_SIZE - 1 - t.col,
    toCoords: (lineKey, vPos) => [lineKey, GRID_SIZE - 1 - vPos],
  },
  up: {
    getLineKey: (t) => t.col,
    getVirtualPos: (t) => t.row,
    toCoords: (lineKey, vPos) => [vPos, lineKey],
  },
  down: {
    getLineKey: (t) => t.col,
    getVirtualPos: (t) => GRID_SIZE - 1 - t.row,
    toCoords: (lineKey, vPos) => [GRID_SIZE - 1 - vPos, lineKey],
  },
};

// ── Core move computation ─────────────────────────────────────────────────────

/**
 * Compute a move with full tile tracking.
 *
 * Returns `null` if the move has no effect (no tiles moved or merged).
 *
 * The resulting board/score will be identical to what the adapter produces,
 * but this function additionally tracks per-tile movements and merges
 * so the UI can animate smoothly.
 */
export function computeMove(
  currentTiles: TileData[],
  direction: Direction,
  moveCount: number,
  currentScore: number,
  currentMergeCount: number,
  currentHasWon: boolean,
): MoveResult | null {
  const ext = EXTRACTORS[direction];

  // Build tile lookup
  const tileById = new Map<string, TileData>();
  for (const t of currentTiles) tileById.set(t.id, t);

  // Group tiles by line
  const lineGroups: Array<Array<{ id: string; value: number; vPos: number }>> =
    Array.from({ length: GRID_SIZE }, () => []);

  for (const tile of currentTiles) {
    const line = ext.getLineKey(tile);
    const vPos = ext.getVirtualPos(tile);
    lineGroups[line].push({ id: tile.id, value: tile.value, vPos });
  }

  // Sort each line toward the wall (ascending vPos)
  for (const group of lineGroups) {
    group.sort((a, b) => a.vPos - b.vPos);
  }

  const slidingTiles: SlidingTile[] = [];
  const mergeEvents: MergeEvent[] = [];
  const resultTiles: TileData[] = [];
  let scoreDelta = 0;

  for (let lineKey = 0; lineKey < GRID_SIZE; lineKey++) {
    const tiles = lineGroups[lineKey];
    let targetVPos = 0;
    let i = 0;

    while (i < tiles.length) {
      const curr = tiles[i];
      const next = i + 1 < tiles.length ? tiles[i + 1] : null;
      const origTile = tileById.get(curr.id)!;

      if (next && curr.value === next.value) {
        // ── Merge ──
        const mergedValue = curr.value * 2;
        const mergeId = nextTileId();
        const [toRow, toCol] = ext.toCoords(lineKey, targetVPos);
        const origNext = tileById.get(next.id)!;

        // Both sources slide to the merge position
        slidingTiles.push({
          id: curr.id,
          value: curr.value,
          fromRow: origTile.row,
          fromCol: origTile.col,
          toRow,
          toCol,
        });
        slidingTiles.push({
          id: next.id,
          value: next.value,
          fromRow: origNext.row,
          fromCol: origNext.col,
          toRow,
          toCol,
        });

        mergeEvents.push({
          resultId: mergeId,
          value: mergedValue,
          row: toRow,
          col: toCol,
          sourceIds: [curr.id, next.id],
        });

        resultTiles.push({
          id: mergeId,
          value: mergedValue,
          row: toRow,
          col: toCol,
        });
        scoreDelta += mergedValue;
        targetVPos++;
        i += 2;
      } else {
        // ── Slide (no merge) ──
        const [toRow, toCol] = ext.toCoords(lineKey, targetVPos);

        slidingTiles.push({
          id: curr.id,
          value: curr.value,
          fromRow: origTile.row,
          fromCol: origTile.col,
          toRow,
          toCol,
        });

        resultTiles.push({
          id: curr.id,
          value: curr.value,
          row: toRow,
          col: toCol,
        });
        targetVPos++;
        i++;
      }
    }
  }

  // ── Check if anything actually changed ──
  let changed = false;
  for (const s of slidingTiles) {
    if (s.fromRow !== s.toRow || s.fromCol !== s.toCol) {
      changed = true;
      break;
    }
  }
  if (mergeEvents.length > 0) changed = true;
  if (!changed) return null;

  // ── Build resulting board ──
  const board: number[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(0),
  );
  for (const t of resultTiles) {
    board[t.row][t.col] = t.value;
  }

  // ── Deterministic spawn ──
  const newMoveCount = moveCount + 1;
  const spawnPos = getSpawnPosition(board, newMoveCount);
  let spawnedTile: SpawnedTile | null = null;

  if (spawnPos) {
    const [sr, sc] = spawnPos;
    const sv = getSpawnValue(newMoveCount);
    const sid = nextTileId();
    board[sr][sc] = sv;
    spawnedTile = { id: sid, value: sv, row: sr, col: sc };
    resultTiles.push({ id: sid, value: sv, row: sr, col: sc });
  }

  // ── Compute stats ──
  const newBest = bestTileOnBoard(board);
  const newScore = currentScore + scoreDelta;
  const hasWon = currentHasWon || newBest >= WIN_TILE;
  const gameOver = !canMoveBoard(board);

  return {
    slidingTiles,
    mergeEvents,
    spawnedTile,
    stableTiles: resultTiles,
    board,
    scoreDelta,
    totalScore: newScore,
    bestTile: newBest,
    moveCount: newMoveCount,
    mergeCount: currentMergeCount + mergeEvents.length,
    hasWon,
    gameOver,
  };
}

// ── Initialization helpers ────────────────────────────────────────────────────

/** Create TileData entries from a raw number board. */
export function tilesFromBoard(board: number[][]): TileData[] {
  const tiles: TileData[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] !== 0) {
        tiles.push({
          id: nextTileId(),
          value: board[r][c],
          row: r,
          col: c,
        });
      }
    }
  }
  return tiles;
}

/** Check if two boards are identical. */
export function boardsMatch(a: number[][], b: number[][]): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}
