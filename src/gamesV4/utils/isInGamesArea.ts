/**
 * Games V4 — "Games Area" Route Gating
 *
 * Determines whether the user is currently viewing a Games-related screen.
 * Used by the in-app notification system for context-aware suppression.
 *
 * Suppression rules:
 *   - game_turn: always suppressed in Games area (user is already engaged)
 *   - achievement_unlocked:
 *       - Suppressed on hub/detail/achievement/leaderboard screens (redundant)
 *       - Suppressed during realtime gameplay (disruptive)
 *       - ALLOWED during solo and turn-based gameplay (non-disruptive reward feedback)
 *
 * @module gamesV4/utils/isInGamesArea
 */

import type { GameRuntimeType } from "@/gamesV4/types/common";

/**
 * All route names that constitute the "Games area".
 */
const GAMES_AREA_ROUTES: ReadonlySet<string> = new Set([
  // Tab root
  "Games",
  // Game flow screens
  "GameLobbyV4",
  "GamePlayV4",
  "GameOverV4",
  // Detail / stats / leaderboard
  "GameDetailV4",
  "GameLeaderboardV4",
  "GameStatsV4",
  // Achievements
  "AchievementsHub",
  "AchievementSection",
  // Level rewards (inside games area)
  "LevelRewards",
]);

/**
 * Routes where achievement_unlocked banners are allowed even though
 * the user is in the Games area. Specifically the gameplay screen
 * (for solo/turn-based games — realtime is excluded via runtime type check).
 */
const GAMEPLAY_ROUTES: ReadonlySet<string> = new Set([
  "GamePlayV4",
  "GameOverV4",
]);

/**
 * Returns true if the given route name is within the Games area.
 */
export function isInGamesArea(
  currentRouteName: string | null | undefined,
): boolean {
  if (!currentRouteName) return false;
  return GAMES_AREA_ROUTES.has(currentRouteName);
}

/**
 * Determines whether an achievement_unlocked notification should be
 * suppressed on the current screen.
 *
 * Returns true (suppress) when:
 *  - On a non-gameplay Games screen (hub, detail, achievements, etc.)
 *  - On a gameplay screen during a realtime game
 *
 * Returns false (allow) when:
 *  - On a gameplay screen during a solo or turn-based game
 *  - Not in the Games area at all
 */
export function shouldSuppressAchievementBanner(
  currentRouteName: string | null | undefined,
  activeGameRuntimeType: GameRuntimeType | null,
): boolean {
  if (!currentRouteName || !isInGamesArea(currentRouteName)) return false;

  // On a gameplay screen: allow achievements for solo/turn-based, suppress for realtime
  if (GAMEPLAY_ROUTES.has(currentRouteName)) {
    if (!activeGameRuntimeType) return true; // Unknown runtime — be safe, suppress
    return activeGameRuntimeType === "realtime";
  }

  // All other Games-area screens: suppress (hub, detail, achievements, leaderboard, etc.)
  return true;
}

/**
 * Exported for testing / extension.
 */
export { GAMES_AREA_ROUTES };
