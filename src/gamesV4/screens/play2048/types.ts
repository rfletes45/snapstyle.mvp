/**
 * 2048 Presentation Layer — Types
 *
 * Type definitions for the tile-tracking move engine and animated
 * presentation pipeline. These types are LOCAL to the 2048 UI —
 * they are not written to Firestore or shared with the server.
 *
 * @module gamesV4/screens/play2048/types
 */

// ── Directions ────────────────────────────────────────────────────────────────

export type Direction = "up" | "down" | "left" | "right";

// ── Tile Data (stable between moves) ──────────────────────────────────────────

/** A tile's authoritative identity and position. */
export interface TileData {
  id: string;
  value: number;
  row: number;
  col: number;
}

// ── Render Tile (for the animated presentation layer) ─────────────────────────

/**
 * A tile as it should be rendered during an animation frame.
 * Includes animation metadata used by AnimatedTile.
 */
export interface RenderTile {
  id: string;
  value: number;
  /** Target row (final position after animation). */
  row: number;
  /** Target col (final position after animation). */
  col: number;
  /** Previous row (starting position for slide animation). */
  prevRow?: number;
  /** Previous col (starting position for slide animation). */
  prevCol?: number;
  /** This tile just appeared (spawn or merge result). */
  isNew?: boolean;
  /** This tile is the result of a merge (gets pop animation). */
  isMergeResult?: boolean;
  /** z-index for render ordering (merge results on top). */
  zIndex?: number;
}

// ── Engine Output Types ───────────────────────────────────────────────────────

/** A tile's movement during a slide. */
export interface SlidingTile {
  id: string;
  value: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

/** A merge event that occurs after tiles slide to the same cell. */
export interface MergeEvent {
  /** New tile ID for the merged result. */
  resultId: string;
  /** Doubled value. */
  value: number;
  /** Row of the merge cell. */
  row: number;
  /** Col of the merge cell. */
  col: number;
  /** IDs of the two source tiles that merged. */
  sourceIds: [string, string];
}

/** A newly spawned tile. */
export interface SpawnedTile {
  id: string;
  value: number;
  row: number;
  col: number;
}

/** Complete result of a move computation with tile tracking. */
export interface MoveResult {
  /** All tiles that are sliding (including merge sources). */
  slidingTiles: SlidingTile[];
  /** Merge events that occur after slides complete. */
  mergeEvents: MergeEvent[];
  /** The spawned tile (appears after merges). */
  spawnedTile: SpawnedTile | null;
  /** Final stable tile list after everything resolves. */
  stableTiles: TileData[];
  /** Resulting board as a number grid (for validation). */
  board: number[][];
  /** Score gained from merges in this move. */
  scoreDelta: number;
  /** Cumulative score after this move. */
  totalScore: number;
  /** Current highest tile value. */
  bestTile: number;
  /** Move count after this move. */
  moveCount: number;
  /** Cumulative merge count after this move. */
  mergeCount: number;
  /** Whether the 2048 tile has been reached (ever). */
  hasWon: boolean;
  /** Whether the game is over (no valid moves). */
  gameOver: boolean;
}

/** Internal game state maintained by the controller. */
export interface GameState {
  board: number[][];
  tiles: TileData[];
  score: number;
  bestTile: number;
  moveCount: number;
  mergeCount: number;
  hasWon: boolean;
  gameOver: boolean;
}
