/**
 * Daily Game Persistence Service
 *
 * Saves and restores in-progress daily game state using AsyncStorage.
 * Each day's state is keyed by the date string (YYYY-MM-DD).
 *
 * When the user leaves a daily game mid-session, the state is saved.
 * On return, if the date matches and the game wasn't completed, the
 * state is restored so the user can continue.
 *
 * Completed games (won or lost) are also stored so the app can prevent
 * replaying until the daily word resets.
 *
 * @module services/dailyGamePersistence
 */

import AsyncStorage from "@react-native-async-storage/async-storage";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/dailyGamePersistence");
// =============================================================================
// Types
// =============================================================================

/** Serialisable representation of a WordMaster daily game. */
export interface DailyWordMasterState {
  /** Date string YYYY-MM-DD — used to detect stale state */
  dateString: string;
  /** The target word for this day */
  targetWord: string;
  /** Current game status */
  status: "playing" | "won" | "lost";
  /** Grid of guesses (letter + state per cell) */
  guessRows: { letter: string; state: string }[][];
  /** Index of the next row to fill */
  currentRow: number;
  /** Keyboard colour states */
  keyStates: Record<string, string>;
  /** Current (uncommitted) guess string */
  currentGuess: string;
  /** Player streak count at time of save */
  streak: number;
  /** Final score (set on win/loss, 0 if still playing) */
  finalScore: number;
}

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_KEY_PREFIX = "daily_game_state_";

function storageKey(gameType: string): string {
  return `${STORAGE_KEY_PREFIX}${gameType}`;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Save a daily game's in-progress (or completed) state.
 */
export async function saveDailyGameState(
  gameType: string,
  state: DailyWordMasterState,
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(gameType), JSON.stringify(state));
  } catch (err) {
    logger.error("[dailyGamePersistence] Failed to save state:", err);
  }
}

/**
 * Load a daily game's saved state.
 *
 * Returns `null` if:
 *  - No state was saved
 *  - The saved state is for a different day (stale)
 */
export async function loadDailyGameState(
  gameType: string,
  todayDateString: string,
): Promise<DailyWordMasterState | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(gameType));
    if (!raw) return null;

    const parsed: DailyWordMasterState = JSON.parse(raw);

    // If the saved state is for a different day, discard it.
    if (parsed.dateString !== todayDateString) {
      await clearDailyGameState(gameType);
      return null;
    }

    return parsed;
  } catch (err) {
    logger.error("[dailyGamePersistence] Failed to load state:", err);
    return null;
  }
}

/**
 * Check whether today's daily game has already been completed (won or lost).
 */
export async function isDailyGameCompleted(
  gameType: string,
  todayDateString: string,
): Promise<boolean> {
  const state = await loadDailyGameState(gameType, todayDateString);
  if (!state) return false;
  return state.status === "won" || state.status === "lost";
}

/**
 * Clear saved state for a daily game.
 */
export async function clearDailyGameState(gameType: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(gameType));
  } catch (err) {
    logger.error("[dailyGamePersistence] Failed to clear state:", err);
  }
}
