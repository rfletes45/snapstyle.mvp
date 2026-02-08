/**
 * Achievement Type Definitions
 *
 * Comprehensive achievement system covering all games with clear triggers and rewards.
 * Supports general gaming, single-player games, multiplayer games, and social achievements.
 *
 * @see docs/PROMPT_GAMES_EXPANSION.md for full implementation plan
 */

import { ExtendedGameType } from "./games";

// =============================================================================
// Achievement Tiers & Categories
// =============================================================================

/**
 * Achievement tier determines the rarity and rewards
 */
export type AchievementTier =
  | "bronze" // Common achievements, easy to earn
  | "silver" // Moderate difficulty
  | "gold" // Challenging achievements
  | "platinum" // Very difficult achievements
  | "diamond"; // Elite achievements, exceptional skill

/**
 * Achievement category for filtering and organization
 */
export type AchievementCategory =
  // General
  | "general" // Cross-game achievements
  | "daily" // Daily challenges
  | "seasonal" // Time-limited events

  // Single-player games
  | "casual_games" // General single-player
  | "flappy_bird" // Flappy Bird specific
  | "bounce_blitz" // Bounce Blitz specific
  | "play_2048" // 2048 specific
  | "memory_master" // Memory game specific
  | "word_master" // Word game specific
  | "snake_master" // Snake game specific
  // New single-player games (Phase 1)
  | "brick_breaker" // Brick Breaker specific
  | "tile_slide" // Tile Slide specific

  // Multiplayer games
  | "multiplayer" // General multiplayer
  | "chess" // Chess specific
  | "checkers" // Checkers specific
  | "tic_tac_toe" // Tic-Tac-Toe specific
  | "crazy_eights" // Crazy Eights specific
  | "pool" // 8-Ball Pool specific

  // Social
  | "social" // Friend-related achievements
  | "streak"; // Streak achievements

/**
 * Achievement progress tracking type
 */
export type AchievementProgressType =
  | "instant" // Triggered by single event (no progress bar)
  | "count" // Cumulative count (e.g., play 100 games)
  | "threshold" // Reach a specific value (e.g., score 50 points)
  | "streak" // Maintain consecutive days/wins
  | "highscore"; // High score milestone

// =============================================================================
// Achievement Trigger System
// =============================================================================

/**
 * Trigger types for automatic achievement checking
 */
export type AchievementTriggerType =
  // General triggers
  | "game_played" // Any game played
  | "unique_games_played" // Different game types played
  | "game_streak" // Consecutive days playing

  // Score-based triggers
  | "flappy_score" // Flappy Bird score
  | "bounce_round" // Bounce Blitz round reached
  | "bounce_blocks_hit" // Blocks hit in single shot
  | "bounce_row_clear" // Rows cleared
  | "memory_time" // Memory game completion time
  | "memory_moves" // Memory game moves
  | "snake_score" // Snake score/length
  | "word_solved" // Word puzzle solved
  | "word_streak" // Word puzzle daily streak

  // 2048 triggers
  | "2048_tile" // Highest tile reached in 2048
  | "2048_score" // Score reached in 2048
  | "2048_moves" // Moves made in 2048

  // Snake triggers
  | "snake_length" // Snake length achieved
  | "snake_food" // Food eaten count
  | "snake_survival" // Time survived in Snake
  | "score_reached" // Generic score threshold

  // Multiplayer triggers
  | "multiplayer_game" // Any multiplayer game played
  | "multiplayer_win" // Multiplayer game won
  | "multiplayer_win_streak" // Consecutive wins

  // Game-specific multiplayer triggers
  | "chess_win" // Chess game won
  | "chess_rating" // Chess rating reached
  | "chess_en_passant" // Special move performed
  | "chess_castling" // Castling performed
  | "chess_promotion" // Pawn promoted
  | "checkers_win" // Checkers game won
  | "checkers_king" // Piece kinged
  | "checkers_multi_jump" // Multiple jumps in one turn
  | "tic_tac_toe_win" // Tic-Tac-Toe win
  | "tic_tac_toe_perfect" // Win without opponent scoring
  | "crazy_eights_win" // Crazy Eights win
  | "pool_win" // 8-Ball Pool win
  | "pool_run_out" // Clear table without missing
  | "pool_8ball_break" // Sink 8-ball on break

  // Time-based triggers
  | "time_played" // Total time in games
  | "night_owl" // Playing late at night
  | "early_bird" // Playing early morning

  // Meta triggers
  | "stat_reached" // Generic stat milestone
  | "special_event"; // Special/seasonal event trigger

/**
 * Achievement trigger conditions
 */
export interface AchievementTrigger {
  type: AchievementTriggerType;
  conditions: {
    // Count-based
    count?: number;
    min?: number;
    max?: number;

    // Game filter
    gameType?: ExtendedGameType;
    all?: boolean; // Must play all games

    // Time conditions
    days?: number; // Streak days
    maxMoves?: number;
    maxTime?: number; // In seconds
    timeRange?: { start: number; end: number }; // Hour range (0-23)

    // Custom conditions
    [key: string]: unknown;
  };
}

// =============================================================================
// Achievement Unlock System
// =============================================================================

/**
 * Types of items that can be unlocked by achievements
 */
export type AchievementUnlockType =
  | "avatar_frame" // Profile frame cosmetic
  | "badge" // Profile badge
  | "title" // Display title
  | "theme" // App theme
  | "cosmetic"; // Other cosmetic item

/**
 * Achievement unlock reward
 */
export interface AchievementUnlock {
  type: AchievementUnlockType;
  itemId: string;
}

// =============================================================================
// Achievement Definition
// =============================================================================

/**
 * Full achievement definition with all properties
 */
export interface GameAchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or MaterialCommunityIcons name
  category: AchievementCategory;
  tier: AchievementTier;

  // Rewards
  xpReward: number;
  coinReward: number;

  // Visibility
  secret: boolean; // Hidden until unlocked

  // Repeatability
  repeatable: boolean; // Can earn multiple times
  maxRepeats?: number; // Limit on repeats (if repeatable)

  // Trigger conditions
  trigger: AchievementTrigger;

  // Progress tracking
  progressType: AchievementProgressType;
  progressTarget?: number; // Target value for progress bar

  // Cosmetic unlock (optional)
  unlocks?: AchievementUnlock;
}

// =============================================================================
// Achievement Tier Rewards
// =============================================================================

/**
 * Standard rewards for each achievement tier
 */
export const TIER_REWARDS: Record<
  AchievementTier,
  { xp: number; coins: number }
> = {
  bronze: { xp: 25, coins: 10 },
  silver: { xp: 50, coins: 25 },
  gold: { xp: 100, coins: 50 },
  platinum: { xp: 250, coins: 100 },
  diamond: { xp: 500, coins: 250 },
};

/**
 * Tier colors for UI display
 */
export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
  diamond: "#B9F2FF",
};

/**
 * Tier icon names for visual display
 */
export const TIER_ICONS: Record<AchievementTier, string> = {
  bronze: "medal",
  silver: "medal",
  gold: "medal",
  platinum: "star-circle",
  diamond: "diamond-stone",
};

// =============================================================================
// Achievement Progress Tracking
// =============================================================================

/**
 * User's progress toward an achievement
 */
export interface AchievementProgress {
  achievementId: string;
  currentValue: number;
  targetValue: number;
  percentage: number;
  isComplete: boolean;
  lastUpdated: number;
}

/**
 * User achievement record (earned achievement)
 */
export interface UserAchievement {
  id: string; // Achievement ID
  earnedAt: number; // Timestamp
  earnCount: number; // Times earned (for repeatable)
  meta?: {
    // Context about how it was earned
    score?: number;
    gameType?: ExtendedGameType;
    moveCount?: number;
    timeMs?: number;
  };
}

// =============================================================================
// Game Context for Achievement Checking
// =============================================================================

/**
 * Context passed to achievement checkers after a game
 */
export interface GameContext {
  userId: string;
  gameType: ExtendedGameType;

  // Score data
  score?: number;
  round?: number;
  blocksHit?: number;
  rowsCleared?: number;

  // Multiplayer data
  isMultiplayer: boolean;
  isWinner?: boolean;
  opponentId?: string;
  moveCount?: number;

  // Time data
  timeMs?: number;
  timestamp: number;

  // Game-specific data
  specialMoves?: string[]; // e.g., ["en_passant", "castling"]
  perfectGame?: boolean;
}

// =============================================================================
// Achievement Notification
// =============================================================================

/**
 * Data for achievement unlock notification
 */
export interface AchievementNotification {
  achievement: GameAchievementDefinition;
  earnedAt: number;
  isNew: boolean; // First time earning
  earnCount: number; // Total times earned
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get display color for achievement tier
 */
export function getTierColor(tier: AchievementTier): string {
  return TIER_COLORS[tier];
}

/**
 * Get rewards for achievement tier
 */
export function getTierRewards(tier: AchievementTier): {
  xp: number;
  coins: number;
} {
  return TIER_REWARDS[tier];
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, target: number): number {
  if (target <= 0) return 100;
  return Math.min(100, Math.round((current / target) * 100));
}

/**
 * Check if achievement is unlockable (has cosmetic reward)
 */
export function hasUnlock(achievement: GameAchievementDefinition): boolean {
  return !!achievement.unlocks;
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: AchievementCategory): string {
  const names: Record<AchievementCategory, string> = {
    general: "General",
    daily: "Daily Challenges",
    seasonal: "Seasonal",
    casual_games: "Casual Games",
    flappy_bird: "Flappy Bird",
    bounce_blitz: "Bounce Blitz",
    play_2048: "Play 2048",
    memory_master: "Memory",
    word_master: "Word",
    snake_master: "Snake",
    // New games (Phase 1)
    brick_breaker: "Brick Breaker",
    tile_slide: "Tile Slide",
    multiplayer: "Multiplayer",
    chess: "Chess",
    checkers: "Checkers",
    tic_tac_toe: "Tic-Tac-Toe",
    crazy_eights: "Crazy Eights",
    pool: "8-Ball Pool",
    social: "Social",
    streak: "Streaks",
  };
  return names[category];
}
