/**
 * Cooperative / Creative Game Schemas — Phase 5
 *
 * Two games with different multiplayer patterns:
 *
 * 1. **Word Master (Wordle)** — Parallel competitive: both players get the
 *    same target word and race to solve it first. Guesses are private until
 *    the round ends.
 *
 * 2. **Crossword** — Cooperative: shared 5×5 grid with real-time cursor
 *    tracking. Both players place letters collaboratively.
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §6.5 (Phase 5)
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { Player } from "./common";

// ═══════════════════════════════════════════════════════════════════════════════
//  Word Master (Competitive Wordle)
// ═══════════════════════════════════════════════════════════════════════════════

// =============================================================================
// WordMasterGuess — A single submitted guess row
// =============================================================================

export class WordMasterGuess extends Schema {
  /** The 5-letter word guessed */
  @type("string") word: string = "";

  /**
   * Letter results encoded as a 5-char string:
   * "c" = correct, "p" = present, "a" = absent
   * e.g. "cpaca" means [correct, present, absent, correct, absent]
   */
  @type("string") result: string = "";
}

// =============================================================================
// WordMasterPlayer — Extended player for Word Master rooms
// =============================================================================

export class WordMasterPlayer extends Player {
  /** This player's guesses */
  @type([WordMasterGuess]) guesses = new ArraySchema<WordMasterGuess>();

  /** Current row (0-5) */
  @type("uint8") currentRow: number = 0;

  /** "playing" | "won" | "lost" */
  @type("string") status: string = "playing";

  /** Whether this player has finished guessing */
  @type("boolean") finished: boolean = false;
}

// =============================================================================
// WordMasterState — Root state for Word Master rooms
// =============================================================================

export class WordMasterState extends Schema {
  // --- Game lifecycle ---
  @type("string") phase: string = "waiting";
  @type("string") gameId: string = "";
  @type("string") gameType: string = "word_master_game";
  @type("uint8") maxPlayers: number = 2;
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";

  // --- Players ---
  @type({ map: WordMasterPlayer })
  wmPlayers = new MapSchema<WordMasterPlayer>();

  // --- Word ---
  /** Word length (always 5) */
  @type("uint8") wordLength: number = 5;
  /** Max guesses allowed */
  @type("uint8") maxGuesses: number = 6;
  /** The target word (revealed only when phase === "finished") */
  @type("string") revealedWord: string = "";

  // --- Timer ---
  @type("uint8") countdown: number = 0;
  @type("float32") elapsed: number = 0;

  // --- RNG ---
  @type("uint32") seed: number = 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  Crossword (Cooperative)
// ═══════════════════════════════════════════════════════════════════════════════

// =============================================================================
// CrosswordCell — A single cell in the shared 5×5 grid
// =============================================================================

export class CrosswordCell extends Schema {
  /** Player-entered letter ("" if empty) */
  @type("string") letter: string = "";

  /** Whether this cell is a black/blocked cell */
  @type("boolean") blocked: boolean = false;

  /** Whether this cell's letter is correct (set on completion check) */
  @type("boolean") correct: boolean = false;

  /** Session ID of the player who placed this letter ("" if none) */
  @type("string") placedBy: string = "";
}

// =============================================================================
// CrosswordPlayer — Extended player for Crossword rooms
// =============================================================================

export class CrosswordPlayer extends Player {
  /** Cursor row (-1 if no cell selected) */
  @type("int8") cursorRow: number = -1;

  /** Cursor col (-1 if no cell selected) */
  @type("int8") cursorCol: number = -1;

  /** Cursor direction: "across" or "down" */
  @type("string") cursorDirection: string = "across";

  /** Number of letters this player has placed */
  @type("uint16") lettersPlaced: number = 0;
}

// =============================================================================
// CrosswordClue — An across or down clue
// =============================================================================

export class CrosswordClue extends Schema {
  @type("uint8") num: number = 0;
  @type("string") clue: string = "";
  @type("uint8") row: number = 0;
  @type("uint8") col: number = 0;
  @type("string") direction: string = "across"; // "across" | "down"
}

// =============================================================================
// CrosswordState — Root state for Crossword rooms
// =============================================================================

export class CrosswordState extends Schema {
  // --- Game lifecycle ---
  @type("string") phase: string = "waiting";
  @type("string") gameId: string = "";
  @type("string") gameType: string = "crossword_puzzle_game";
  @type("uint8") maxPlayers: number = 2;
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";

  // --- Players ---
  @type({ map: CrosswordPlayer })
  cwPlayers = new MapSchema<CrosswordPlayer>();

  // --- Grid (flat 5×5 = 25 cells, row-major) ---
  @type([CrosswordCell]) grid = new ArraySchema<CrosswordCell>();
  @type("uint8") gridSize: number = 5;

  // --- Clues ---
  @type([CrosswordClue]) clues = new ArraySchema<CrosswordClue>();

  // --- Timer (counts up) ---
  @type("float32") elapsed: number = 0;
  @type("uint8") countdown: number = 0;

  // --- Completion ---
  @type("boolean") completed: boolean = false;
  /** Puzzle index (for deterministic selection) */
  @type("uint8") puzzleIndex: number = 0;

  // --- RNG ---
  @type("uint32") seed: number = 0;

  // =========================================================================
  // Grid Helpers (server-only convenience, not synced)
  // =========================================================================

  /** Get cell at (row, col). Returns undefined if out of bounds. */
  getCell(row: number, col: number): CrosswordCell | undefined {
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize)
      return undefined;
    return this.grid[row * this.gridSize + col];
  }

  /** Initialise an empty grid with blocked cells matching the puzzle layout */
  initGrid(solution: (string | null)[][]): void {
    this.grid.clear();
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const cell = new CrosswordCell();
        cell.blocked = solution[r][c] === null;
        this.grid.push(cell);
      }
    }
  }
}
