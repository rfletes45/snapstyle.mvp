/**
 * Game Filters Type Definitions
 *
 * Types for filtering and grouping active games on the Play screen.
 * Used by GameFilterBar and ActiveGamesSection components.
 *
 * @see Phase 2 of GAME_SYSTEM_OVERHAUL_PLAN
 */

import { AnyMatch, TurnBasedGameType } from "./turnBased";

// =============================================================================
// Filter Tab Types
// =============================================================================

/**
 * Filter tabs for the active games section
 */
export type GameFilterTab = "all" | "your-turn" | "their-turn" | "invites";

/**
 * Game filter configuration
 */
export interface GameFilters {
  /** Currently selected tab */
  tab: GameFilterTab;
  /** Filter by specific game types (empty = all) */
  gameTypes: TurnBasedGameType[];
  /** Filter by conversation (optional) */
  conversationId?: string;
  /** Show archived games */
  showArchived: boolean;
}

/**
 * Default filter state
 */
export const DEFAULT_GAME_FILTERS: GameFilters = {
  tab: "all",
  gameTypes: [],
  showArchived: false,
};

// =============================================================================
// Game Grouping Types
// =============================================================================

/**
 * Group type for organizing active games
 */
export type ActiveGameGroupType = "your-turn" | "their-turn" | "completed";

/**
 * A group of active games with a label
 */
export interface ActiveGameGroup {
  /** Type of the group */
  type: ActiveGameGroupType;
  /** Display label for the group */
  label: string;
  /** Games in this group */
  games: AnyMatch[];
  /** Whether the group is expanded */
  isExpanded: boolean;
}

// =============================================================================
// Filter Tab Configuration
// =============================================================================

/**
 * Configuration for each filter tab
 */
export interface FilterTabConfig {
  /** Tab identifier */
  id: GameFilterTab;
  /** Display label */
  label: string;
  /** Icon name (MaterialCommunityIcons) */
  icon: string;
  /** Badge count (optional) */
  count?: number;
}

/**
 * Get filter tab configurations with counts
 */
export function getFilterTabConfigs(
  yourTurnCount: number,
  theirTurnCount: number,
  invitesCount: number,
): FilterTabConfig[] {
  return [
    {
      id: "all",
      label: "All",
      icon: "gamepad-variant",
      count: yourTurnCount + theirTurnCount,
    },
    {
      id: "your-turn",
      label: "Your Turn",
      icon: "arrow-right-circle",
      count: yourTurnCount,
    },
    {
      id: "their-turn",
      label: "Waiting",
      icon: "clock-outline",
      count: theirTurnCount,
    },
    {
      id: "invites",
      label: "Invites",
      icon: "email-outline",
      count: invitesCount,
    },
  ];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Filter games based on current filter configuration
 */
export function filterGames(
  games: AnyMatch[],
  filters: GameFilters,
  currentUserId: string,
): AnyMatch[] {
  return games.filter((game) => {
    // Filter by game type
    if (
      filters.gameTypes.length > 0 &&
      !filters.gameTypes.includes(game.gameType)
    ) {
      return false;
    }

    // Filter by conversation
    if (
      filters.conversationId &&
      game.conversationId !== filters.conversationId
    ) {
      return false;
    }

    // Filter by archived status
    const isArchived = game.playerArchivedAt?.[currentUserId] !== undefined;
    if (!filters.showArchived && isArchived) {
      return false;
    }

    // Filter by tab
    if (filters.tab === "your-turn") {
      return game.currentTurn === currentUserId;
    }
    if (filters.tab === "their-turn") {
      return game.currentTurn !== currentUserId && game.currentTurn !== null;
    }

    return true;
  });
}

/**
 * Group games by turn status
 */
export function groupGamesByTurn(
  games: AnyMatch[],
  currentUserId: string,
): { yourTurn: AnyMatch[]; theirTurn: AnyMatch[] } {
  const yourTurn: AnyMatch[] = [];
  const theirTurn: AnyMatch[] = [];

  for (const game of games) {
    if (game.status !== "active") continue;

    if (game.currentTurn === currentUserId) {
      yourTurn.push(game);
    } else {
      theirTurn.push(game);
    }
  }

  // Sort by last update (most recent first)
  const sortByUpdate = (a: AnyMatch, b: AnyMatch) => b.updatedAt - a.updatedAt;

  yourTurn.sort(sortByUpdate);
  theirTurn.sort(sortByUpdate);

  return { yourTurn, theirTurn };
}

/**
 * Count games by turn status
 */
export function countGamesByTurn(
  games: AnyMatch[],
  currentUserId: string,
): { yourTurn: number; theirTurn: number; total: number } {
  let yourTurn = 0;
  let theirTurn = 0;

  for (const game of games) {
    if (game.status !== "active") continue;

    if (game.currentTurn === currentUserId) {
      yourTurn++;
    } else {
      theirTurn++;
    }
  }

  return { yourTurn, theirTurn, total: yourTurn + theirTurn };
}
