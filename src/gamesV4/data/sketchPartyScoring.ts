/**
 * Sketch Party — Scoring Logic (Shared)
 *
 * Pure scoring functions shared between client (display) and
 * Colyseus server (authoritative).
 *
 * @module gamesV4/data/sketchPartyScoring
 */

// =============================================================================
// Guesser Points
// =============================================================================

/**
 * Compute guesser points for a correct guess.
 *
 * @param wordLength   Length of the secret word
 * @param elapsedSec   Seconds elapsed since drawing started
 * @param drawTimeSec  Total draw time in seconds
 * @param hintsUsed    Number of hints that were revealed before this guess
 * @returns Points awarded to the guesser (≥ 0)
 */
export function computeGuesserPoints(
  wordLength: number,
  elapsedSec: number,
  drawTimeSec: number,
  hintsUsed: number,
): number {
  const base = 100 + 10 * wordLength;
  const timeBonus = Math.max(0, 120 * (1 - elapsedSec / drawTimeSec));
  const hintPenalty = 10 * hintsUsed;
  return Math.max(0, Math.round(base + timeBonus - hintPenalty));
}

/**
 * Compute the raw time bonus for a guesser.
 * Used for drawer point calculation.
 */
export function computeTimeBonus(
  elapsedSec: number,
  drawTimeSec: number,
): number {
  return Math.max(0, 120 * (1 - elapsedSec / drawTimeSec));
}

// =============================================================================
// Drawer Points
// =============================================================================

/**
 * Compute drawer points gained from a single correct guesser.
 *
 * @param guesserTimeBonus The time bonus component the guesser received
 * @returns Points awarded to the drawer for this guesser
 */
export function computeDrawerGainPerGuesser(guesserTimeBonus: number): number {
  return Math.round(30 + 0.25 * guesserTimeBonus);
}

// =============================================================================
// Placements
// =============================================================================

export interface PlayerScore {
  uid: string;
  score: number;
  firstCorrectCount: number;
  avgCorrectTimeSec: number;
}

/**
 * Compute placements from final scores with tiebreakers:
 * 1) total score desc
 * 2) most "first correct" guesses
 * 3) lowest average correct guess time
 */
export function computePlacements(
  players: PlayerScore[],
): Array<PlayerScore & { placement: number }> {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.firstCorrectCount !== a.firstCorrectCount)
      return b.firstCorrectCount - a.firstCorrectCount;
    return a.avgCorrectTimeSec - b.avgCorrectTimeSec;
  });

  return sorted.map((p, i) => ({ ...p, placement: i + 1 }));
}
