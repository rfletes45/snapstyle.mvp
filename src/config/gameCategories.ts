/**
 * Game Categories Configuration
 *
 * SINGLE SOURCE OF TRUTH for game organization.
 * Used by: GamePickerModal, GamesHubScreen, analytics
 *
 * @file src/config/gameCategories.ts
 */

import { ExtendedGameType, GAME_METADATA, GameMetadata } from "@/types/games";

// =============================================================================
// Types
// =============================================================================

export type PickerCategory = "action" | "puzzle" | "multiplayer" | "daily";

export interface CategoryConfig {
  id: PickerCategory;
  label: string;
  icon: string;
  emoji: string;
  subtitle: string;
  /** Filter function to determine which games belong to this category */
  filter: (game: GameMetadata) => boolean;
  /** Sort priority (lower = first) */
  sortOrder: number;
}

// =============================================================================
// Category Definitions
// =============================================================================

export const CATEGORY_CONFIG: Record<PickerCategory, CategoryConfig> = {
  action: {
    id: "action",
    label: "Action",
    icon: "lightning-bolt",
    emoji: "⚡",
    subtitle: "Fast-paced games",
    filter: (game) => game.category === "quick_play" && !game.isMultiplayer,
    sortOrder: 1,
  },
  puzzle: {
    id: "puzzle",
    label: "Puzzle",
    icon: "puzzle",
    emoji: "🧩",
    subtitle: "Brain teasers",
    filter: (game) => game.category === "puzzle" && !game.isMultiplayer,
    sortOrder: 2,
  },
  multiplayer: {
    id: "multiplayer",
    label: "Multiplayer",
    icon: "account-group",
    emoji: "👥",
    subtitle: "Play with friends",
    filter: (game) => game.isMultiplayer,
    sortOrder: 3,
  },
  daily: {
    id: "daily",
    label: "Daily",
    icon: "calendar-today",
    emoji: "📅",
    subtitle: "New challenge daily",
    filter: (game) => game.category === "daily",
    sortOrder: 4,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all games for a specific category
 */
export function getGamesForCategory(
  categoryId: PickerCategory,
  availableOnly: boolean = false,
): GameMetadata[] {
  const config = CATEGORY_CONFIG[categoryId];
  if (!config) return [];

  return Object.values(GAME_METADATA)
    .filter(config.filter)
    .filter((game) => !availableOnly || game.isAvailable)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all categories with their games
 */
export function getAllCategoriesWithGames(
  availableOnly: boolean = false,
): Array<CategoryConfig & { games: GameMetadata[] }> {
  return Object.values(CATEGORY_CONFIG)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((config) => ({
      ...config,
      games: getGamesForCategory(config.id, availableOnly),
    }))
    .filter((cat) => cat.games.length > 0);
}

/**
 * Get category for a specific game
 */
export function getCategoryForGame(
  gameType: ExtendedGameType,
): PickerCategory | null {
  const game = GAME_METADATA[gameType];
  if (!game) return null;

  for (const [categoryId, config] of Object.entries(CATEGORY_CONFIG)) {
    if (config.filter(game)) {
      return categoryId as PickerCategory;
    }
  }
  return null;
}

/**
 * Format player count for display
 */
export function formatPlayerCount(game: GameMetadata): string {
  if (!game.isMultiplayer) return "Solo";
  if (game.minPlayers === game.maxPlayers) {
    return `${game.minPlayers} players`;
  }
  return `${game.minPlayers}-${game.maxPlayers} players`;
}

// =============================================================================
// Navigation Map
// =============================================================================

export const GAME_SCREEN_MAP: Record<ExtendedGameType, string> = {
  // Action/Quick Play
  reaction_tap: "ReactionTapGame",
  timed_tap: "TimedTapGame",
  bounce_blitz: "BounceBlitzGame",
  snake_master: "SnapSnakeGame",
  flappy_bird: "FlappySnapGame",
  brick_breaker: "BrickBreakerGame",
  stack_puzzle: "SnapStackGame",
  target_master: "SnapAimGame",
  // Phase 3 Action/Quick Play
  pong_game: "SnapPongGame",
  tap_tap_game: "TapTapSnapGame",
  slice_game: "SnapSliceGame",
  // Puzzle
  snap_2048: "Snap2048Game",
  memory_master: "MemorySnapGame",
  cart_course: "CartCourseGame",
  tile_slide: "TileSlideGame",
  minesweeper_classic: "SnapMinesweeperGame",
  number_master: "SnapNumberGame",
  lights_out: "SnapLightsGame",
  // Phase 3 Puzzle
  match_game: "SnapMatchGame",
  pipes_game: "SnapPipesGame",
  nonogram_puzzle: "SnapNonogramGame",
  // Daily
  word_master: "WordSnapGame",
  // Phase 3 Daily
  crossword_puzzle: "SnapCrosswordGame",
  // Multiplayer
  tic_tac_toe: "TicTacToeGame",
  checkers: "CheckersGame",
  chess: "ChessGame",
  crazy_eights: "CrazyEightsGame",
  connect_four: "SnapFourGame",
  dot_match: "SnapDotsGame",
  gomoku_master: "SnapGomokuGame",
  // Phase 3 Multiplayer
  reversi_game: "SnapReversiGame",
  words_game: "SnapWordsGame",
  war_game: "SnapWarGame",
  hex_game: "SnapHexGame",
  draw_game: "SnapDrawGame",
  race_game: "SnapRaceGame",
  // Coming Soon
  "8ball_pool": "PoolGame",
  air_hockey: "AirHockeyGame",
};

