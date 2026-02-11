/**
 * TimedTapRoom â€” Speed Tapping competitive race
 *
 * Both players tap as fast as possible for 10 seconds.
 * Server syncs tap counts in real-time. Highest taps wins.
 */

import { ScoreRaceRoom } from "../base/ScoreRaceRoom";

export class TimedTapRoom extends ScoreRaceRoom {
  protected readonly gameTypeKey = "timed_tap_game";
  protected readonly defaultDuration = 10;
  protected readonly maxLives = -1; // Unlimited lives
  protected readonly lowerIsBetter = false;
}

