/**
 * Turn-Based Schemas — State definitions for Tier 2 turn-based games
 *
 * These games have players alternating turns with server-side move validation.
 * State is synchronized via Colyseus, and persisted to Firestore when all
 * players leave mid-game (cold storage for later restoration).
 *
 * Used by: TicTacToe, ConnectFour, Gomoku, Hex, Reversi (Phase 2)
 *          Chess, Checkers, Cards, Words (Phase 3)
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §6.3
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { BaseGameState, Player } from "./common";

// =============================================================================
// GridCell — Single cell on a game board
// =============================================================================

export class GridCell extends Schema {
  /** Cell value: 0 = empty, 1 = player1, 2 = player2, etc. */
  @type("int8") value: number = 0;

  /** Firebase UID of the cell's owner (empty string if unowned) */
  @type("string") ownerId: string = "";
}

// =============================================================================
// MoveRecord — A single move in the game history
// =============================================================================

export class MoveRecord extends Schema {
  /** Session ID of the player who made the move */
  @type("string") playerId: string = "";

  /** Move coordinates — for grid games (x, y); for column games (col only) */
  @type("uint16") x: number = 0;
  @type("uint16") y: number = 0;

  /** Optional target coordinates (for chess-style piece movement) */
  @type("uint16") toX: number = 0;
  @type("uint16") toY: number = 0;

  /** Human-readable notation (e.g., "e2e4" for chess, "B3" for Connect4) */
  @type("string") notation: string = "";

  /** When the move was made (ms since epoch) */
  @type("float64") timestamp: number = 0;

  /** Player index who made the move (0 or 1) */
  @type("uint8") playerIndex: number = 0;
}

// =============================================================================
// TurnBasedPlayer — Extended player for turn-based games
// =============================================================================

export class TurnBasedPlayer extends Player {
  /** Piece/stone color identifier (e.g., "X"/"O", "black"/"white") */
  @type("string") piece: string = "";

  /** Time remaining in ms (for timed games like chess) */
  @type("float32") timeRemainingMs: number = 0;

  /** Whether this player offered a draw */
  @type("boolean") offeredDraw: boolean = false;

  /** Number of pieces captured (for games like Reversi, Checkers) */
  @type("int32") capturedPieces: number = 0;
}

// =============================================================================
// TurnBasedState — Root state for turn-based game rooms
// =============================================================================

export class TurnBasedState extends BaseGameState {
  /** Players with turn-based extensions */
  @type({ map: TurnBasedPlayer })
  tbPlayers = new MapSchema<TurnBasedPlayer>();

  /** Board dimensions */
  @type("uint8") boardWidth: number = 8;
  @type("uint8") boardHeight: number = 8;

  /** Flat board array — row-major order: board[row * width + col] */
  @type([GridCell]) board = new ArraySchema<GridCell>();

  /** Complete move history for replay / undo */
  @type([MoveRecord]) moveHistory = new ArraySchema<MoveRecord>();

  /** Whether a draw offer is pending */
  @type("boolean") drawPending: boolean = false;

  /** Session ID of the player who offered the draw */
  @type("string") drawOfferedBy: string = "";

  /** Last move notation for display */
  @type("string") lastMoveNotation: string = "";

  /** Countdown seconds remaining (3, 2, 1, GO) */
  @type("uint8") countdown: number = 0;

  /** Whether this is a timed game */
  @type("boolean") timedMode: boolean = false;

  /** Per-player time remaining (for timed games) */
  @type("float32") player1TimeRemaining: number = 600;
  @type("float32") player2TimeRemaining: number = 600;

  // =========================================================================
  // Board Helpers (not synced — server-only convenience)
  // =========================================================================

  /**
   * Get cell value at (row, col).
   * Returns 0 if out of bounds.
   */
  getCell(row: number, col: number): number {
    if (row < 0 || row >= this.boardHeight || col < 0 || col >= this.boardWidth)
      return -1;
    const idx = row * this.boardWidth + col;
    return this.board[idx]?.value ?? -1;
  }

  /**
   * Set cell value at (row, col).
   */
  setCell(row: number, col: number, value: number, ownerId: string = ""): void {
    const idx = row * this.boardWidth + col;
    if (idx >= 0 && idx < this.board.length) {
      this.board[idx].value = value;
      this.board[idx].ownerId = ownerId;
    }
  }

  /**
   * Initialize an empty board with the given dimensions.
   */
  initBoard(width: number, height: number): void {
    this.boardWidth = width;
    this.boardHeight = height;
    this.board.clear();
    for (let i = 0; i < width * height; i++) {
      this.board.push(new GridCell());
    }
  }

  /**
   * Serialize board to a flat number array for persistence.
   */
  serializeBoard(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.board.length; i++) {
      result.push(this.board[i].value);
    }
    return result;
  }

  /**
   * Restore board from a flat number array.
   */
  restoreBoard(values: number[]): void {
    for (let i = 0; i < values.length && i < this.board.length; i++) {
      this.board[i].value = values[i];
    }
  }
}
