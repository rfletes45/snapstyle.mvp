/**
 * Sketch Party Schemas — State classes for the Sketch Party (skribbl-style) room
 *
 * SketchPartyPlayer extends Player with drawing/guessing state.
 * SketchPartyState extends BaseGameState with full game configuration + turn state.
 *
 * IMPORTANT: High-frequency drawing ops are NOT stored in schema state.
 * They are broadcast via messages and snapshot for late joiners.
 *
 * @see colyseus-server/src/rooms/party/SketchPartyRoom.ts
 */

import { ArraySchema, MapSchema, type } from "@colyseus/schema";
import { BaseGameState, Player } from "./common";

// =============================================================================
// SketchPartyPlayer — Per-player state for a Sketch Party game
// =============================================================================

export class SketchPartyPlayer extends Player {
  /** Whether this player has guessed the current word correctly */
  @type("boolean") hasGuessed: boolean = false;

  /** Epoch ms when the player guessed correctly (0 = hasn't guessed) */
  @type("float64") guessedAtMs: number = 0;

  /** Rank of correct guess within the current turn (1 = first, 0 = hasn't guessed) */
  @type("uint8") guessRank: number = 0;

  /** Whether this player is the current drawer */
  @type("boolean") isDrawer: boolean = false;
}

// =============================================================================
// SketchPartyState — Room state for a Sketch Party game
// =============================================================================

export class SketchPartyState extends BaseGameState {
  // =========================================================================
  // Room / Lobby Configuration
  // =========================================================================

  /** Firebase UID of the room host (first player to join) */
  @type("string") hostUid: string = "";

  /** Total number of rounds (each player draws once per round) */
  @type("uint8") rounds: number = 3;

  /** Seconds allowed for each drawing turn */
  @type("uint16") drawTimeSec: number = 80;

  /** Word mode: "normal" | "hidden" | "combination" */
  @type("string") wordMode: string = "normal";

  /** Number of word choices presented to the drawer */
  @type("uint8") wordChoiceCount: number = 3;

  /** Number of letter hints revealed during a turn */
  @type("uint8") hints: number = 2;

  /** Language for the word list */
  @type("string") language: string = "en";

  /** Whether custom words from the host are enabled */
  @type("boolean") customWordsEnabled: boolean = false;

  /** If true, use ONLY custom words (no default word list) */
  @type("boolean") useCustomWordsOnly: boolean = false;

  // =========================================================================
  // Turn Tracking
  // =========================================================================

  /** Ordered list of player UIDs defining draw order */
  @type(["string"]) playerOrder = new ArraySchema<string>();

  /** Index into playerOrder — whose turn it is to draw */
  @type("uint8") turnIndex: number = 0;

  /** Current round number (1-indexed) */
  @type("uint8") roundNumber: number = 0;

  /** Firebase UID of the current drawer */
  @type("string") currentDrawerUid: string = "";

  // =========================================================================
  // Turn Sub-Phase
  // =========================================================================

  /**
   * Turn sub-phase lifecycle:
   *   "lobby"    → waiting for host to start
   *   "choosing" → drawer is choosing a word
   *   "drawing"  → drawer is drawing, guessers are guessing
   *   "reveal"   → word is revealed, scores shown, before next turn
   */
  @type("string") turnSubphase: string = "lobby";

  /** Epoch ms when the current turn started */
  @type("float64") turnStartedAt: number = 0;

  /** Epoch ms when the choosing phase ends */
  @type("float64") chooseEndsAt: number = 0;

  /** Epoch ms when the drawing phase ends */
  @type("float64") turnEndsAt: number = 0;

  /** Epoch ms when the reveal phase ends */
  @type("float64") revealEndsAt: number = 0;

  // =========================================================================
  // Word / Hints
  // =========================================================================

  /** Length of the secret word (number of characters) */
  @type("uint8") wordLength: number = 0;

  /** Current word mask shown to guessers (e.g. "_ a _ _ e") */
  @type("string") wordMask: string = "";

  /** How many letters have been revealed so far */
  @type("uint8") revealedCount: number = 0;

  // =========================================================================
  // Guess Tracking
  // =========================================================================

  /** Number of players who have correctly guessed this turn */
  @type("uint8") correctGuessCount: number = 0;

  /** Countdown timer value (3-2-1 before game start) */
  @type("uint8") countdown: number = 0;

  // =========================================================================
  // Sketch Party Players (typed map)
  // =========================================================================

  /** Connected players (sessionId → SketchPartyPlayer) */
  @type({ map: SketchPartyPlayer })
  spPlayers = new MapSchema<SketchPartyPlayer>();
}
