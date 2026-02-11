/**
 * Game Search Utilities
 *
 * Search and filtering logic for the Play screen game discovery system.
 *
 * Features:
 * - Text-based search across game names and descriptions
 * - Category filtering
 * - Player count filtering
 * - Leaderboard filtering
 * - New game filtering
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 2
 */

import { ExtendedGameType, GAME_METADATA, GameMetadata } from "@/types/games";
import {
  DEFAULT_SEARCH_FILTERS,
  GameCategory,
  GameSearchFilters,
} from "@/types/playScreen";

// =============================================================================
// Search Types
// =============================================================================

/**
 * Search result with relevance scoring
 */
export interface GameSearchResult {
  gameType: ExtendedGameType;
  metadata: GameMetadata;
  relevanceScore: number;
  matchedFields: ("name" | "shortName" | "description")[];
}

/**
 * Options for customizing search behavior
 */
export interface SearchOptions {
  /** Minimum relevance score to include (0-1) */
  minRelevance?: number;
  /** Maximum results to return */
  maxResults?: number;
  /** Whether to include unavailable games */
  includeUnavailable?: boolean;
  /** Whether to sort by relevance */
  sortByRelevance?: boolean;
}

const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  minRelevance: 0.1,
  maxResults: 20,
  includeUnavailable: false,
  sortByRelevance: true,
};

// =============================================================================
// Core Search Functions
// =============================================================================

/**
 * Search games by text query and filters
 *
 * @param query - Text search query
 * @param filters - Active search filters
 * @param options - Search customization options
 * @returns Array of matching games sorted by relevance
 *
 * @example
 * ```ts
 * const results = searchGames("tap", { playerCount: "single" });
 * // Returns: ["reaction_tap", "timed_tap"]
 * ```
 */
export function searchGames(
  query: string,
  filters: GameSearchFilters = DEFAULT_SEARCH_FILTERS,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): ExtendedGameType[] {
  const mergedOptions = { ...DEFAULT_SEARCH_OPTIONS, ...options };
  const results = searchGamesWithScores(query, filters, mergedOptions);

  return results.map((r) => r.gameType);
}

/**
 * Search games with detailed scoring information
 *
 * @param query - Text search query
 * @param filters - Active search filters
 * @param options - Search customization options
 * @returns Array of search results with scores
 */
export function searchGamesWithScores(
  query: string,
  filters: GameSearchFilters = DEFAULT_SEARCH_FILTERS,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): GameSearchResult[] {
  const mergedOptions = { ...DEFAULT_SEARCH_OPTIONS, ...options };
  const normalizedQuery = query.toLowerCase().trim();

  const results: GameSearchResult[] = [];

  // Iterate through all games
  for (const [gameType, metadata] of Object.entries(GAME_METADATA)) {
    // Skip unavailable games unless explicitly included
    if (!metadata.isAvailable && !mergedOptions.includeUnavailable) {
      continue;
    }

    // Apply filters first (quick rejection)
    if (!passesFilters(metadata, filters)) {
      continue;
    }

    // Calculate text match relevance
    const { score, matchedFields } = calculateRelevance(
      normalizedQuery,
      metadata,
    );

    // Skip if below minimum relevance (unless no query)
    if (normalizedQuery && score < (mergedOptions.minRelevance ?? 0.1)) {
      continue;
    }

    results.push({
      gameType: gameType as ExtendedGameType,
      metadata,
      relevanceScore: normalizedQuery ? score : 1,
      matchedFields,
    });
  }

  // Sort by relevance if enabled
  if (mergedOptions.sortByRelevance) {
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Limit results
  if (mergedOptions.maxResults) {
    return results.slice(0, mergedOptions.maxResults);
  }

  return results;
}

/**
 * Get all available games for a specific category
 *
 * @param category - Game category to filter by
 * @returns Array of game types in the category
 */
export function getGamesByCategory(category: GameCategory): ExtendedGameType[] {
  return Object.entries(GAME_METADATA)
    .filter(
      ([, metadata]) => metadata.isAvailable && metadata.category === category,
    )
    .map(([gameType]) => gameType as ExtendedGameType);
}

/**
 * Get all available games grouped by category
 *
 * @returns Map of category to game types
 */
export function getGamesGroupedByCategory(): Map<
  GameCategory,
  ExtendedGameType[]
> {
  const groups = new Map<GameCategory, ExtendedGameType[]>();

  for (const [gameType, metadata] of Object.entries(GAME_METADATA)) {
    if (!metadata.isAvailable) continue;

    const existing = groups.get(metadata.category) || [];
    existing.push(gameType as ExtendedGameType);
    groups.set(metadata.category, existing);
  }

  return groups;
}

/**
 * Get all single-player games
 */
export function getSinglePlayerGames(): ExtendedGameType[] {
  return Object.entries(GAME_METADATA)
    .filter(([, metadata]) => metadata.isAvailable && !metadata.isMultiplayer)
    .map(([gameType]) => gameType as ExtendedGameType);
}

/**
 * Get all multiplayer games
 */
export function getMultiplayerGames(): ExtendedGameType[] {
  return Object.entries(GAME_METADATA)
    .filter(([, metadata]) => metadata.isAvailable && metadata.isMultiplayer)
    .map(([gameType]) => gameType as ExtendedGameType);
}

// =============================================================================
// Filter Functions
// =============================================================================

/**
 * Check if a game passes all active filters
 */
function passesFilters(
  metadata: GameMetadata,
  filters: GameSearchFilters,
): boolean {
  // Category filter
  if (filters.category && metadata.category !== filters.category) {
    return false;
  }

  // Player count filter
  if (filters.playerCount === "single" && metadata.isMultiplayer) {
    return false;
  }
  if (filters.playerCount === "multi" && !metadata.isMultiplayer) {
    return false;
  }

  // Leaderboard filter
  if (
    filters.hasLeaderboard !== undefined &&
    metadata.hasLeaderboard !== filters.hasLeaderboard
  ) {
    return false;
  }

  return true;
}

/**
 * Apply filters to a list of games
 *
 * @param games - Array of game types to filter
 * @param filters - Filters to apply
 * @returns Filtered array of game types
 */
export function filterGames(
  games: ExtendedGameType[],
  filters: GameSearchFilters,
): ExtendedGameType[] {
  return games.filter((gameType) => {
    const metadata = GAME_METADATA[gameType];
    return metadata && passesFilters(metadata, filters);
  });
}

// =============================================================================
// Relevance Scoring
// =============================================================================

/**
 * Calculate relevance score for a search query against game metadata
 *
 * Scoring weights:
 * - Exact name match: 1.0
 * - Name starts with query: 0.9
 * - Name contains query: 0.7
 * - Short name match: 0.6
 * - Description contains query: 0.3
 */
function calculateRelevance(
  query: string,
  metadata: GameMetadata,
): { score: number; matchedFields: ("name" | "shortName" | "description")[] } {
  if (!query) {
    return { score: 1, matchedFields: [] };
  }

  let score = 0;
  const matchedFields: ("name" | "shortName" | "description")[] = [];

  const nameLower = metadata.name.toLowerCase();
  const shortNameLower = metadata.shortName.toLowerCase();
  const descLower = metadata.description.toLowerCase();

  // Name matching
  if (nameLower === query) {
    score = Math.max(score, 1.0);
    matchedFields.push("name");
  } else if (nameLower.startsWith(query)) {
    score = Math.max(score, 0.9);
    matchedFields.push("name");
  } else if (nameLower.includes(query)) {
    score = Math.max(score, 0.7);
    matchedFields.push("name");
  }

  // Short name matching
  if (shortNameLower === query) {
    score = Math.max(score, 0.8);
    if (!matchedFields.includes("shortName")) matchedFields.push("shortName");
  } else if (shortNameLower.startsWith(query)) {
    score = Math.max(score, 0.65);
    if (!matchedFields.includes("shortName")) matchedFields.push("shortName");
  } else if (shortNameLower.includes(query)) {
    score = Math.max(score, 0.6);
    if (!matchedFields.includes("shortName")) matchedFields.push("shortName");
  }

  // Description matching (lower weight)
  if (descLower.includes(query)) {
    score = Math.max(score, 0.3);
    matchedFields.push("description");
  }

  // Word boundary bonus - exact word matches score higher
  const queryWords = query.split(/\s+/);
  const nameWords = nameLower.split(/\s+/);
  const exactWordMatches = queryWords.filter((qw) =>
    nameWords.includes(qw),
  ).length;
  if (exactWordMatches > 0) {
    score = Math.min(1.0, score + exactWordMatches * 0.1);
  }

  return { score, matchedFields };
}

// =============================================================================
// Search Suggestions
// =============================================================================

/**
 * Get search suggestions based on partial query
 *
 * @param query - Partial search query
 * @param limit - Maximum suggestions to return
 * @returns Array of suggested game names
 */
export function getSearchSuggestions(
  query: string,
  limit: number = 5,
): string[] {
  if (!query || query.length < 2) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const suggestions: { name: string; score: number }[] = [];

  for (const metadata of Object.values(GAME_METADATA)) {
    if (!metadata.isAvailable) continue;

    const nameLower = metadata.name.toLowerCase();
    const shortNameLower = metadata.shortName.toLowerCase();

    if (nameLower.startsWith(normalizedQuery)) {
      suggestions.push({ name: metadata.name, score: 1.0 });
    } else if (shortNameLower.startsWith(normalizedQuery)) {
      suggestions.push({ name: metadata.name, score: 0.8 });
    } else if (nameLower.includes(normalizedQuery)) {
      suggestions.push({ name: metadata.name, score: 0.5 });
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.name);
}

// =============================================================================
// Recent & Popular Games
// =============================================================================

/**
 * Get recently played games (would integrate with game history service)
 * This is a placeholder that returns all available games
 *
 * @param limit - Maximum games to return
 * @returns Array of recent game types
 */
export function getRecentlyPlayedGames(limit: number = 5): ExtendedGameType[] {
  // NOTE: Integrate with game history service
  // For now, return first N available games
  return Object.entries(GAME_METADATA)
    .filter(([, metadata]) => metadata.isAvailable)
    .slice(0, limit)
    .map(([gameType]) => gameType as ExtendedGameType);
}

/**
 * Check if search results are empty
 */
export function hasNoResults(
  query: string,
  filters: GameSearchFilters,
): boolean {
  const results = searchGames(query, filters, { maxResults: 1 });
  return results.length === 0;
}

// =============================================================================
// Exports
// =============================================================================

export {
  DEFAULT_SEARCH_FILTERS,
  type GameCategory,
  type GameSearchFilters,
} from "@/types/playScreen";
