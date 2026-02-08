/**
 * Play Screen Types
 *
 * Type definitions for the Play Screen UI/UX overhaul.
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md
 */

import { ExtendedGameType } from "./games";

// =============================================================================
// Search & Filter Types
// =============================================================================

/**
 * Game category type
 */
export type GameCategory = "quick_play" | "puzzle" | "multiplayer" | "daily";

/**
 * Search filter options for the Play screen
 */
export interface GameSearchFilters {
  /** Filter by game category */
  category?: GameCategory;
  /** Filter by player count type */
  playerCount?: "single" | "multi" | "all";
  /** Filter games that have leaderboards */
  hasLeaderboard?: boolean;
  /** Filter only new games */
  isNew?: boolean;
}

/**
 * Default search filters
 */
export const DEFAULT_SEARCH_FILTERS: GameSearchFilters = {
  category: undefined,
  playerCount: "all",
  hasLeaderboard: undefined,
  isNew: undefined,
};

// =============================================================================
// Featured Games Types
// =============================================================================

/**
 * Featured game configuration for promotional banners
 */
export interface FeaturedGame {
  /** The game being featured */
  gameType: ExtendedGameType;
  /** Main headline text */
  headline: string;
  /** Secondary description text */
  subheadline: string;
  /** Background color or gradient start */
  backgroundColor: string;
  /** Optional gradient end color */
  gradientEndColor?: string;
  /** When this feature expires (timestamp) */
  expiresAt?: number;
  /** Optional deep link or action */
  actionUrl?: string;
}

// =============================================================================
// Category Configuration Types
// =============================================================================

/**
 * Layout type for category sections
 */
export type CategoryLayout = "carousel" | "grid" | "single";

/**
 * Configuration for a game category section
 */
export interface GameCategoryConfig {
  /** Category identifier */
  id: GameCategory;
  /** Display title (with emoji) */
  title: string;
  /** Subtitle description */
  subtitle: string;
  /** Icon name for MaterialCommunityIcons */
  icon: string;
  /** Accent color for the category */
  accentColor: string;
  /** List of games in this category */
  games: ExtendedGameType[];
  /** How to display this category */
  layout: CategoryLayout;
}

/**
 * Default category configurations
 */
export const CATEGORY_CONFIGS: GameCategoryConfig[] = [
  {
    id: "quick_play",
    title: "⚡ Quick Play",
    subtitle: "Fast-paced action games",
    icon: "lightning-bolt",
    accentColor: "#FF6B6B",
    games: ["reaction_tap", "timed_tap", "bounce_blitz", "snake_master"],
    layout: "carousel",
  },
  {
    id: "puzzle",
    title: "🧩 Puzzle",
    subtitle: "Test your brain",
    icon: "puzzle",
    accentColor: "#4ECDC4",
    games: ["play_2048", "memory_master"],
    layout: "carousel",
  },
  {
    id: "multiplayer",
    title: "👥 Multiplayer",
    subtitle: "Challenge your friends",
    icon: "account-group",
    accentColor: "#6C5CE7",
    games: ["tic_tac_toe", "checkers", "chess", "crazy_eights"],
    layout: "carousel",
  },
  {
    id: "daily",
    title: "📅 Daily Challenge",
    subtitle: "New puzzle every day",
    icon: "calendar-today",
    accentColor: "#FFD700",
    games: ["word_master"],
    layout: "single",
  },
];

// =============================================================================
// Filter Chip Types
// =============================================================================

/**
 * Filter chip configuration
 */
export interface FilterChipConfig {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Filter to apply when selected */
  filter: Partial<GameSearchFilters>;
}

/**
 * Default filter chips for the search bar
 */
export const DEFAULT_FILTER_CHIPS: FilterChipConfig[] = [
  { id: "all", label: "All", filter: {} },
  { id: "single", label: "Single Player", filter: { playerCount: "single" } },
  { id: "multi", label: "Multiplayer", filter: { playerCount: "multi" } },
  { id: "puzzle", label: "Puzzle", filter: { category: "puzzle" } },
  { id: "quick", label: "Quick Play", filter: { category: "quick_play" } },
];

// =============================================================================
// Play Screen State Types
// =============================================================================

/**
 * Full state interface for the Play screen
 */
export interface PlayScreenState {
  // Search
  searchQuery: string;
  searchFilters: GameSearchFilters;
  searchResults: ExtendedGameType[];

  // UI State
  isSearchFocused: boolean;
  selectedCategory: GameCategory | null;
  selectedFilterChip: string;

  // Data
  highScores: Map<string, number>;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

/**
 * Initial state for the Play screen
 */
export const INITIAL_PLAY_SCREEN_STATE: PlayScreenState = {
  searchQuery: "",
  searchFilters: DEFAULT_SEARCH_FILTERS,
  searchResults: [],
  isSearchFocused: false,
  selectedCategory: null,
  selectedFilterChip: "all",
  highScores: new Map(),
  loading: true,
  refreshing: false,
  error: null,
};

// =============================================================================
// Component Props Types
// =============================================================================

/**
 * Props for the PlayHeader component
 */
export interface PlayHeaderProps {
  /** Called when leaderboard button is pressed */
  onLeaderboardPress: () => void;
  /** Called when achievements button is pressed */
  onAchievementsPress: () => void;
  /** Called when history button is pressed */
  onHistoryPress: () => void;
  /** Number of pending game invites (for badge) */
  inviteCount?: number;
  /** Number of games where it's your turn (for badge) */
  yourTurnCount?: number;
  /** Whether to show notification badges */
  showBadges?: boolean;
}

/**
 * Props for the PlaySearchBar component
 */
export interface PlaySearchBarProps {
  /** Current search query value */
  value: string;
  /** Called when search text changes */
  onChangeText: (text: string) => void;
  /** Called when search input is focused */
  onFocus?: () => void;
  /** Called when search input loses focus */
  onBlur?: () => void;
  /** Current filter configuration */
  filters: GameSearchFilters;
  /** Called when filters change */
  onFiltersChange?: (filters: GameSearchFilters) => void;
  /** Whether the search is currently focused */
  isFocused?: boolean;
  /** Currently selected filter chip ID */
  selectedChip?: string;
  /** Called when a filter chip is selected */
  onChipSelect?: (chipId: string) => void;
  /** Whether to show filter chips */
  showChips?: boolean;
}

/**
 * Props for HeaderIconButton component
 */
export interface HeaderIconButtonProps {
  /** MaterialCommunityIcons name */
  icon: string;
  /** Icon/badge color */
  color?: string;
  /** Called when button is pressed */
  onPress: () => void;
  /** Show notification badge */
  showBadge?: boolean;
  /** Badge count (if > 0, shows number instead of dot) */
  badgeCount?: number;
  /** Size of the icon */
  size?: number;
  /** Accessibility label */
  accessibilityLabel?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Helper to get category color based on isDark
 */
export function getCategoryColor(
  category: GameCategory,
  isDark: boolean,
): string {
  const colors: Record<GameCategory, { light: string; dark: string }> = {
    quick_play: { light: "#FF6B6B", dark: "#FF8787" },
    puzzle: { light: "#4ECDC4", dark: "#5EDDD4" },
    multiplayer: { light: "#6C5CE7", dark: "#8B7CF7" },
    daily: { light: "#FFD700", dark: "#FFE44D" },
  };
  return isDark ? colors[category].dark : colors[category].light;
}

/**
 * Helper to get category display label
 */
export function getCategoryLabel(category: GameCategory): string {
  const labels: Record<GameCategory, string> = {
    quick_play: "Quick Play",
    puzzle: "Puzzle",
    multiplayer: "Multiplayer",
    daily: "Daily",
  };
  return labels[category];
}

