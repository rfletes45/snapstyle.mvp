/**
 * DotMatchRoom â€” Dots & Boxes competitive score race
 *
 * Both players complete patterns simultaneously, competing on score.
 * Shared RNG seed generates identical patterns.
 */

import { ScoreRaceRoom } from "../base/ScoreRaceRoom";

export class DotMatchRoom extends ScoreRaceRoom {
  protected readonly gameTypeKey = "dot_match_game";
  protected readonly defaultDuration = 60;
  protected readonly maxLives = -1;
  protected readonly lowerIsBetter = false;
}

