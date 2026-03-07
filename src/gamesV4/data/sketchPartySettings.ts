/**
 * Sketch Party — Settings Utilities
 *
 * Pure helpers for merging, validating, and deriving game configuration.
 * Shared by adapter, screen, and tests.
 *
 * @module gamesV4/data/sketchPartySettings
 */

// =============================================================================
// Types
// =============================================================================

export interface SketchPartySettings {
  maxPlayers: number;
  rounds: number;
  drawTimeSec: number;
  turnChooseTimeSec: number;
  wordChoices: number;
  hints: number;
  customWordsEnabled: boolean;
  customWordsList: string;
}

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_SKETCH_PARTY_SETTINGS: SketchPartySettings = {
  maxPlayers: 8,
  rounds: 3,
  drawTimeSec: 80,
  turnChooseTimeSec: 10,
  wordChoices: 3,
  hints: 2,
  customWordsEnabled: false,
  customWordsList: "",
};

// =============================================================================
// Merge
// =============================================================================

/**
 * Merge session/lobby settings on top of defaults.
 * Coerces string → number and clamps to valid ranges.
 */
export function mergeSettings(
  defaults: SketchPartySettings,
  session: Record<string, unknown> | undefined | null,
): SketchPartySettings {
  if (!session) return { ...defaults };

  return {
    maxPlayers: clampInt(session.maxPlayers, defaults.maxPlayers, 2, 8),
    rounds: clampInt(session.rounds, defaults.rounds, 1, 10),
    drawTimeSec: clampInt(session.drawTimeSec, defaults.drawTimeSec, 30, 180),
    turnChooseTimeSec: clampInt(
      session.turnChooseTimeSec,
      defaults.turnChooseTimeSec,
      5,
      15,
    ),
    wordChoices: clampInt(session.wordChoices, defaults.wordChoices, 1, 5),
    hints: clampInt(session.hints, defaults.hints, 0, 3),
    customWordsEnabled:
      typeof session.customWordsEnabled === "boolean"
        ? session.customWordsEnabled
        : defaults.customWordsEnabled,
    customWordsList:
      typeof session.customWordsList === "string"
        ? session.customWordsList.slice(0, 2000)
        : defaults.customWordsList,
  };
}

function clampInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// =============================================================================
// Derived helpers
// =============================================================================

/**
 * Total turns in a full match = rounds × playerCount.
 */
export function computeTurnCount(rounds: number, playerCount: number): number {
  return rounds * playerCount;
}

/**
 * Compute hint reveal timestamps (ms from draw start).
 * Hints are evenly distributed across the draw period.
 *
 * @returns Sorted array of timestamps. Empty if hints ≤ 0.
 */
export function computeHintSchedule(
  drawTimeSec: number,
  hints: number,
): number[] {
  if (hints <= 0) return [];
  const drawTimeMs = drawTimeSec * 1000;
  const schedule: number[] = [];
  for (let i = 1; i <= hints; i++) {
    schedule.push(Math.round((drawTimeMs / (hints + 1)) * i));
  }
  return schedule;
}
