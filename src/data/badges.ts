/**
 * Badge Definitions
 *
 * Static data for all badges that can be earned.
 * Badges are earned via achievements, milestones, or special events.
 *
 * @see src/types/profile.ts for Badge interface
 * @see src/data/gameAchievements.ts for achievement definitions
 */

import type { AchievementTier } from "@/types/achievements";
import type { Badge, BadgeCategory } from "@/types/profile";

// =============================================================================
// Badge Definitions
// =============================================================================

export const BADGE_DEFINITIONS: Badge[] = [
  // -------------------------
  // GAMES CATEGORY
  // -------------------------
  {
    id: "first_steps",
    name: "First Steps",
    description: "Play your first game",
    icon: "🎮",
    tier: "bronze",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "first_game" },
    hidden: false,
  },
  {
    id: "game_master",
    name: "Game Master",
    description: "Play all available game types",
    icon: "👑",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "game_master" },
    frameColor: "#FFD700",
    hidden: false,
  },
  {
    id: "dedicated_player",
    name: "Dedicated Player",
    description: "Play 100 total games",
    icon: "🔥",
    tier: "silver",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "games_100" },
    hidden: false,
  },
  {
    id: "gaming_legend",
    name: "Gaming Legend",
    description: "Play 500 total games",
    icon: "🏆",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "games_500" },
    hidden: false,
  },
  {
    id: "bounce_legend",
    name: "Bounce Legend",
    description: "Reach round 50 in Bounce Blitz",
    icon: "🎯",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "bounce_round_50" },
    hidden: false,
  },
  {
    id: "2048_champion",
    name: "2048 Champion",
    description: "Reach the 2048 tile",
    icon: "🔢",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "tile_2048" },
    hidden: false,
  },

  // -------------------------
  // MULTIPLAYER CATEGORY
  // -------------------------
  {
    id: "first_victory",
    name: "First Victory",
    description: "Win your first multiplayer game",
    icon: "🥇",
    tier: "bronze",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "first_win" },
    hidden: false,
  },
  {
    id: "champion",
    name: "Champion",
    description: "Win 50 multiplayer games",
    icon: "🏆",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "wins_50" },
    hidden: false,
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    description: "Win 5 games in a row",
    icon: "⚡",
    tier: "silver",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "win_streak_5" },
    hidden: false,
  },
  {
    id: "chess_master",
    name: "Chess Master",
    description: "Win 50 chess games",
    icon: "♔",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "chess_wins_50" },
    frameColor: "#8B4513",
    hidden: false,
  },

  // -------------------------
  // STREAK CATEGORY
  // -------------------------
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Maintain a 7-day streak",
    icon: "🔥",
    tier: "bronze",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 7,
    },
    hidden: false,
  },
  {
    id: "streak_30",
    name: "Monthly Champion",
    description: "Maintain a 30-day streak",
    icon: "💪",
    tier: "silver",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 30,
    },
    hidden: false,
  },
  {
    id: "streak_100",
    name: "Centurion",
    description: "Maintain a 100-day streak",
    icon: "🏅",
    tier: "gold",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 100,
    },
    frameColor: "#FFD700",
    animated: true,
    hidden: false,
  },
  {
    id: "streak_365",
    name: "Year Master",
    description: "Maintain a 365-day streak",
    icon: "👑",
    tier: "platinum",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 365,
    },
    frameColor: "#E5E4E2",
    animated: true,
    hidden: false,
  },

  // -------------------------
  // SOCIAL CATEGORY
  // -------------------------
  {
    id: "first_friend",
    name: "First Friend",
    description: "Add your first friend",
    icon: "🤝",
    tier: "bronze",
    category: "social",
    earnedVia: { type: "achievement", achievementId: "social_first_friend" },
    hidden: false,
  },
  {
    id: "social_butterfly",
    name: "Social Butterfly",
    description: "Add 10 friends",
    icon: "🦋",
    tier: "silver",
    category: "social",
    earnedVia: { type: "achievement", achievementId: "social_10_friends" },
    hidden: false,
  },
  {
    id: "popular",
    name: "Popular",
    description: "Add 50 friends",
    icon: "⭐",
    tier: "gold",
    category: "social",
    earnedVia: { type: "achievement", achievementId: "social_50_friends" },
    hidden: false,
  },

  // -------------------------
  // COLLECTION CATEGORY
  // -------------------------
  {
    id: "collector_10",
    name: "Collector",
    description: "Own 10 cosmetic items",
    icon: "📦",
    tier: "bronze",
    category: "collection",
    earnedVia: { type: "achievement", achievementId: "collection_10" },
    hidden: false,
  },
  {
    id: "collector_25",
    name: "Hoarder",
    description: "Own 25 cosmetic items",
    icon: "🎁",
    tier: "silver",
    category: "collection",
    earnedVia: { type: "achievement", achievementId: "collection_25" },
    hidden: false,
  },
  {
    id: "collector_50",
    name: "Fashionista",
    description: "Own 50 cosmetic items",
    icon: "💎",
    tier: "gold",
    category: "collection",
    earnedVia: { type: "achievement", achievementId: "collection_50" },
    hidden: false,
  },

  // -------------------------
  // SPECIAL CATEGORY
  // -------------------------
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Play a game between midnight and 4am",
    icon: "🦉",
    tier: "bronze",
    category: "special",
    earnedVia: { type: "achievement", achievementId: "night_owl" },
    hidden: true, // Secret badge
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Play a game between 5am and 7am",
    icon: "🐦",
    tier: "bronze",
    category: "special",
    earnedVia: { type: "achievement", achievementId: "early_bird" },
    hidden: true, // Secret badge
  },
  {
    id: "beta_tester",
    name: "Beta Tester",
    description: "Participated in the beta",
    icon: "🧪",
    tier: "gold",
    category: "special",
    earnedVia: { type: "event", eventId: "beta_2026" },
    frameColor: "#9C27B0",
    hidden: false,
    limitedTime: true,
  },

  // -------------------------
  // MASTER BADGES (section completion)
  // -------------------------
  {
    id: "badge_2048_master",
    name: "2048 Master",
    description: "Complete all 2048 achievements",
    icon: "🔢",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_sp_play_2048" },
    frameColor: "#B9F2FF",
    hidden: false,
  },
  {
    id: "badge_brick_breaker_master",
    name: "Brick Breaker Master",
    description: "Complete all Brick Breaker achievements",
    icon: "🧱",
    tier: "gold",
    category: "games",
    earnedVia: {
      type: "achievement",
      achievementId: "master_sp_brick_breaker",
    },
    frameColor: "#B9F2FF",
    hidden: false,
  },
  {
    id: "badge_bounce_blitz_master",
    name: "Bounce Blitz Master",
    description: "Complete all Bounce Blitz achievements",
    icon: "⚪",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_sp_bounce_blitz" },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_pong_master",
    name: "Pong Master",
    description: "Complete all Pong achievements",
    icon: "🏓",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_sp_pong_game" },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_minesweeper_master",
    name: "Minesweeper Master",
    description: "Complete all Minesweeper achievements",
    icon: "💣",
    tier: "gold",
    category: "games",
    earnedVia: {
      type: "achievement",
      achievementId: "master_sp_minesweeper_classic",
    },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_word_master",
    name: "Word Master Champion",
    description: "Complete all Word Master achievements",
    icon: "📝",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_sp_word_master" },
    frameColor: "#FFD700",
    hidden: false,
  },
  {
    id: "badge_ttt_master",
    name: "Tic-Tac-Toe Master",
    description: "Complete all Tic-Tac-Toe achievements",
    icon: "❌",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_tb_tic_tac_toe" },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_chess_master",
    name: "Chess Master",
    description: "Complete all Chess achievements",
    icon: "♟️",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_tb_chess" },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_checkers_master",
    name: "Checkers Master",
    description: "Complete all Checkers achievements",
    icon: "⬛",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_tb_checkers" },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_crazy_eights_master",
    name: "Crazy Eights Master",
    description: "Complete all Crazy Eights achievements",
    icon: "🎴",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_tb_crazy_eights" },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_four_master",
    name: "Connect Four Master",
    description: "Complete all Connect Four achievements",
    icon: "🔴",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_tb_connect_four" },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_gomoku_master",
    name: "Gomoku Master",
    description: "Complete all Gomoku achievements",
    icon: "⚫",
    tier: "gold",
    category: "games",
    earnedVia: {
      type: "achievement",
      achievementId: "master_tb_gomoku_master",
    },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_reversi_master",
    name: "Reversi Master",
    description: "Complete all Reversi achievements",
    icon: "⚪",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_tb_reversi_game" },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_dots_and_boxes_master",
    name: "Dots & Boxes Master",
    description: "Complete all Dots & Boxes achievements",
    icon: "⬜",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_tb_dot_match" },
    frameColor: "#E5E4E2",
    hidden: false,
  },
  {
    id: "badge_crossword_master",
    name: "Crossword Master",
    description: "Complete all Crossword Puzzle achievements",
    icon: "📰",
    tier: "gold",
    category: "games",
    earnedVia: {
      type: "achievement",
      achievementId: "master_rt_crossword_puzzle",
    },
    frameColor: "#FFD700",
    hidden: false,
  },
  {
    id: "badge_sketch_master",
    name: "Sketch Party Master",
    description: "Complete all Sketch Party achievements",
    icon: "🎨",
    tier: "gold",
    category: "games",
    earnedVia: {
      type: "achievement",
      achievementId: "master_rt_sketch_party_game",
    },
    frameColor: "#B9F2FF",
    hidden: false,
  },
  {
    id: "badge_all_rounder",
    name: "All-Rounder",
    description: "Complete all global achievements",
    icon: "🌟",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "master_global_general" },
    frameColor: "#FFD700",
    hidden: false,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get badge by ID
 */
export function getBadgeById(badgeId: string): Badge | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === badgeId);
}

/**
 * Get badges by category
 */
export function getBadgesByCategory(category: BadgeCategory): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => b.category === category);
}

/**
 * Get badges by tier
 */
export function getBadgesByTier(tier: AchievementTier): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => b.tier === tier);
}

/**
 * Get visible (non-hidden) badges
 */
export function getVisibleBadges(): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => !b.hidden);
}

/**
 * Get badge for a specific achievement
 */
export function getBadgeForAchievement(
  achievementId: string,
): Badge | undefined {
  return BADGE_DEFINITIONS.find(
    (b) =>
      b.earnedVia.type === "achievement" &&
      b.earnedVia.achievementId === achievementId,
  );
}

/**
 * Get badge for a milestone
 */
export function getBadgeForMilestone(
  milestoneType: string,
  milestoneValue: number,
): Badge | undefined {
  return BADGE_DEFINITIONS.find(
    (b) =>
      b.earnedVia.type === "milestone" &&
      b.earnedVia.milestoneType === milestoneType &&
      b.earnedVia.milestoneValue === milestoneValue,
  );
}

/**
 * Get total badge count
 */
export function getTotalBadgeCount(): number {
  return BADGE_DEFINITIONS.length;
}

/**
 * Get count of visible badges
 */
export function getVisibleBadgeCount(): number {
  return getVisibleBadges().length;
}
