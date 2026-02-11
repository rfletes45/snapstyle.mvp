import { createServerLogger } from "../utils/logger";
const log = createServerLogger("validation");

/**
 * Score Validation Service
 *
 * Anti-cheat layer for quick-play games.
 * Validates that score updates are within physically possible bounds.
 */

// =============================================================================
// Per-Game Score Bounds
// =============================================================================

/**
 * Maximum score increase per second, per game type.
 * If a player's score increases faster than this, it's flagged as suspicious.
 */
const SCORE_BOUNDS: Record<string, { maxPerSecond: number; maxTotal: number }> =
  {
    reaction: { maxPerSecond: 1, maxTotal: 10 },
    timed_tap: { maxPerSecond: 20, maxTotal: 999 },
    dot_match: { maxPerSecond: 5, maxTotal: 999 },
  };

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a score update from a client.
 *
 * @param gameType - The game type key
 * @param newScore - The score the client is reporting
 * @param currentScore - The player's current score on the server
 * @param elapsedMs - Time elapsed since game started (ms)
 * @returns true if the score is within acceptable bounds
 */
export function validateScoreUpdate(
  gameType: string,
  newScore: number,
  currentScore: number,
  elapsedMs: number,
): boolean {
  // Basic sanity checks
  if (newScore < 0) return false;
  if (newScore < currentScore) return false; // Score shouldn't decrease
  if (!Number.isFinite(newScore)) return false;
  if (newScore !== Math.floor(newScore)) return false; // Must be integer

  const bounds = SCORE_BOUNDS[gameType];
  if (!bounds) return true; // Unknown game â€” allow

  // Check absolute max
  if (newScore > bounds.maxTotal) return false;

  // Check rate: score increase vs elapsed time
  const elapsedSeconds = Math.max(elapsedMs / 1000, 0.1); // Avoid division by zero
  const scoreRate = newScore / elapsedSeconds;
  if (scoreRate > bounds.maxPerSecond * 1.5) {
    // 1.5x buffer for burst scoring
    log.warn(
      `[Validation] Suspicious score rate: ${gameType} â€” ${scoreRate.toFixed(1)}/s (max ${bounds.maxPerSecond}/s)`,
    );
    return false;
  }

  return true;
}

/**
 * Get the score bounds for a specific game type.
 */
export function getScoreBounds(
  gameType: string,
): { maxPerSecond: number; maxTotal: number } | null {
  return SCORE_BOUNDS[gameType] || null;
}


