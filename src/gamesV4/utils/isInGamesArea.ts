/**
 * Games V4 — "Games Area" Route Gating
 *
 * Determines whether the user is currently viewing a Games-related screen.
 * Used by the in-app notification system to suppress game/achievement
 * banners while the user is already inside the Games area.
 *
 * @module gamesV4/utils/isInGamesArea
 */

/**
 * All route names that constitute the "Games area".
 * If the user is on any of these routes, game-related in-app banners
 * are suppressed (they're already looking at games content).
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
 * Returns true if the given route name is within the Games area.
 *
 * When true, game-related in-app notification banners (turn notifications,
 * achievement unlocks) should be suppressed — the user is already engaged
 * with games content.
 */
export function isInGamesArea(
  currentRouteName: string | null | undefined,
): boolean {
  if (!currentRouteName) return false;
  return GAMES_AREA_ROUTES.has(currentRouteName);
}

/**
 * Exported for testing / extension.
 */
export { GAMES_AREA_ROUTES };
