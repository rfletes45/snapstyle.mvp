/**
 * Sketch Party — Scoring Logic (Server)
 *
 * Authoritative scoring functions used by the Colyseus room.
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

export function computeTimeBonus(
  elapsedSec: number,
  drawTimeSec: number,
): number {
  return Math.max(0, 120 * (1 - elapsedSec / drawTimeSec));
}

export function computeDrawerGainPerGuesser(guesserTimeBonus: number): number {
  return Math.round(30 + 0.25 * guesserTimeBonus);
}
