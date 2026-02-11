/**
 * Quick-Play Schemas — State definitions for Tier 4 score-race games
 *
 * These games have both players playing simultaneously and competing on score.
 * The server manages the timer and syncs scores; game logic runs client-side
 * with server-side score-bounds validation for anti-cheat.
 */

import { MapSchema, type } from "@colyseus/schema";
import { BaseGameState, Player } from "./common";

// =============================================================================
// ScoreRacePlayer — Extended player with score-racing fields
// =============================================================================

export class ScoreRacePlayer extends Player {
  /** Current score during gameplay (updated live) */
  @type("int32") currentScore: number = 0;

  /** Whether this player has finished (time ran out or they completed) */
  @type("boolean") finished: boolean = false;

  /** Timestamp (in ms from game start) when this player finished */
  @type("float32") finishTime: number = 0;

  /** Combo/streak counter (for games that use combos) */
  @type("int32") combo: number = 0;

  /** Lives remaining (for games with lives) */
  @type("int8") lives: number = -1; // -1 = unlimited
}

// =============================================================================
// ScoreRaceState — Root state for quick-play score-racing rooms
// =============================================================================

export class ScoreRaceState extends BaseGameState {
  /** Players with score-race extensions */
  @type({ map: ScoreRacePlayer }) racePlayers =
    new MapSchema<ScoreRacePlayer>();

  /** Game duration in seconds (30s default) */
  @type("float32") gameDuration: number = 30;

  /** Shared RNG seed so both players get identical challenges */
  @type("uint32") seed: number = 0;

  /** Countdown seconds remaining (3, 2, 1, GO) */
  @type("uint8") countdown: number = 0;

  /** Game-specific difficulty level */
  @type("uint8") difficulty: number = 1;
}
