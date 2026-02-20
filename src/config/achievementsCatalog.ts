/**
 * Achievements V2 — Catalog
 *
 * Static definitions for all v2 achievements.
 * The evaluator reads this catalog to determine which achievements to check
 * and what criteria to apply.
 *
 * Naming convention: achv.<category>.<game_type?>.<achievement_name>
 *
 * Gating logic:
 *   An achievement is "active" only if:
 *     1. def.isEnabledByDefault === true
 *     2. If def.gameType exists: GAME_METADATA[def.gameType].isAvailable === true
 *        AND GAME_METADATA[def.gameType].comingSoon !== true
 *
 * @module config/achievementsCatalog
 */

import {
  AchievementDef,
  AchievementSection,
  AchievementV2Tier,
} from "@/types/achievementsV2";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";

// =============================================================================
// Global Achievements
// =============================================================================

const GLOBAL_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "achv.global.first_game",
    name: "First Steps",
    description: "Play your first game",
    icon: "🎮",
    category: "global",
    tier: "bronze",
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: 1,
  },
  {
    id: "achv.global.ten_games",
    name: "Getting Started",
    description: "Play 10 games",
    icon: "🎯",
    category: "global",
    tier: "silver",
    progressType: "count",
    target: 10,
    xpReward: 50,
    coinReward: 25,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: 2,
  },
  {
    id: "achv.global.hundred_games",
    name: "Veteran Player",
    description: "Play 100 games",
    icon: "🏅",
    category: "global",
    tier: "gold",
    progressType: "count",
    target: 100,
    xpReward: 100,
    coinReward: 50,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: 3,
  },
  {
    id: "achv.global.first_win",
    name: "First Victory",
    description: "Win your first game",
    icon: "🏆",
    category: "global",
    tier: "bronze",
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: 4,
  },
  {
    id: "achv.global.ten_wins",
    name: "Winner's Circle",
    description: "Win 10 games",
    icon: "🥇",
    category: "global",
    tier: "silver",
    progressType: "count",
    target: 10,
    xpReward: 50,
    coinReward: 25,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: 5,
  },
  {
    id: "achv.global.first_invite_sent",
    name: "Social Butterfly",
    description: "Send your first game invite",
    icon: "💌",
    category: "global",
    tier: "bronze",
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: 6,
  },
  {
    id: "achv.global.first_invite_accepted",
    name: "Challenge Accepted",
    description: "Have an invite you sent accepted by another player",
    icon: "🤝",
    category: "global",
    tier: "silver",
    progressType: "count",
    target: 1,
    xpReward: 50,
    coinReward: 25,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: 7,
  },
  {
    id: "achv.global.spectator_first_watch",
    name: "Spectator",
    description: "Watch your first game as a spectator",
    icon: "👀",
    category: "global",
    tier: "bronze",
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: 8,
  },
];

// =============================================================================
// Single-Player Achievement Helpers
// =============================================================================

/** Games that track "first play" + tiered score achievements */
const SP_SCORE_GAMES: Array<{
  gameType: ExtendedGameType;
  name: string;
  firstPlayName: string;
  firstPlayDesc: string;
  firstPlayIcon: string;
  scoreTierName: string;
  scoreTierGroup: string;
}> = [
  {
    gameType: "bounce_blitz",
    name: "Bounce Blitz",
    firstPlayName: "First Bounce",
    firstPlayDesc: "Play Bounce Blitz for the first time",
    firstPlayIcon: "⚪",
    scoreTierName: "Bounce Star",
    scoreTierGroup: "achv.game.bounce_blitz.score",
  },
  {
    gameType: "brick_breaker",
    name: "Brick Breaker",
    firstPlayName: "Breaking In",
    firstPlayDesc: "Play Brick Breaker for the first time",
    firstPlayIcon: "🧱",
    scoreTierName: "Brick Buster",
    scoreTierGroup: "achv.game.brick_breaker.score",
  },
  {
    gameType: "pong_game",
    name: "Pong",
    firstPlayName: "Classic Pong",
    firstPlayDesc: "Play Pong for the first time",
    firstPlayIcon: "🏓",
    scoreTierName: "Pong Champion",
    scoreTierGroup: "achv.game.pong_game.score",
  },
  {
    gameType: "play_2048",
    name: "2048",
    firstPlayName: "Tile Merger",
    firstPlayDesc: "Play 2048 for the first time",
    firstPlayIcon: "🔢",
    scoreTierName: "2048 Master",
    scoreTierGroup: "achv.game.play_2048.score",
  },
  {
    gameType: "minesweeper_classic",
    name: "Minesweeper",
    firstPlayName: "Mine Detector",
    firstPlayDesc: "Play Minesweeper for the first time",
    firstPlayIcon: "💣",
    scoreTierName: "Sweep Expert",
    scoreTierGroup: "achv.game.minesweeper_classic.score",
  },
  {
    gameType: "lights_out",
    name: "Lights Out",
    firstPlayName: "Light Switch",
    firstPlayDesc: "Play Lights Out for the first time",
    firstPlayIcon: "💡",
    scoreTierName: "Lights Wizard",
    scoreTierGroup: "achv.game.lights_out.score",
  },
];

/** Score tiers as pct of maxScore */
const SCORE_TIERS: Array<{
  suffix: string;
  pct: number;
  tier: AchievementV2Tier;
  label: string;
}> = [
  { suffix: "bronze", pct: 0.25, tier: "bronze", label: "25%" },
  { suffix: "silver", pct: 0.5, tier: "silver", label: "50%" },
  { suffix: "gold", pct: 0.75, tier: "gold", label: "75%" },
  { suffix: "platinum", pct: 0.9, tier: "platinum", label: "90%" },
];

function buildSinglePlayerAchievements(): AchievementDef[] {
  const result: AchievementDef[] = [];
  let sortOrder = 100;

  for (const game of SP_SCORE_GAMES) {
    // First play
    result.push({
      id: `achv.game.${game.gameType}.first_play`,
      name: game.firstPlayName,
      description: game.firstPlayDesc,
      icon: game.firstPlayIcon,
      category: "single_player",
      tier: "bronze",
      gameType: game.gameType,
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
      sortOrder: sortOrder++,
    });

    // Score tiers
    for (const scoreTier of SCORE_TIERS) {
      result.push({
        id: `achv.game.${game.gameType}.score_${scoreTier.suffix}`,
        name: `${game.scoreTierName} (${scoreTier.label})`,
        description: `Reach ${scoreTier.label} of the max score in ${game.name}`,
        icon: game.firstPlayIcon,
        category: "single_player",
        tier: scoreTier.tier,
        gameType: game.gameType,
        progressType: "pct_of_max",
        target: 1, // target is 1 (binary: reached or not)
        pctThreshold: scoreTier.pct,
        xpReward:
          scoreTier.tier === "bronze"
            ? 25
            : scoreTier.tier === "silver"
              ? 50
              : scoreTier.tier === "gold"
                ? 100
                : 250,
        coinReward:
          scoreTier.tier === "bronze"
            ? 10
            : scoreTier.tier === "silver"
              ? 25
              : scoreTier.tier === "gold"
                ? 50
                : 100,
        isEnabledByDefault: true,
        version: 1,
        group: game.scoreTierGroup,
        sortOrder: sortOrder++,
      });
    }
  }

  // Word Master special achievements
  result.push({
    id: "achv.game.word_master.first_solve",
    name: "Word Solver",
    description: "Solve the daily word for the first time",
    icon: "📝",
    category: "single_player",
    tier: "bronze",
    gameType: "word_master",
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.game.word_master.streak_7",
    name: "Word Streak",
    description: "Solve the daily word 7 days in a row",
    icon: "🔥",
    category: "single_player",
    tier: "gold",
    gameType: "word_master",
    progressType: "streak",
    target: 7,
    xpReward: 100,
    coinReward: 50,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: sortOrder++,
  });

  return result;
}

// =============================================================================
// Turn-Based Achievements
// =============================================================================

const TB_GAMES: Array<{
  gameType: ExtendedGameType;
  name: string;
  icon: string;
}> = [
  { gameType: "tic_tac_toe", name: "Tic-Tac-Toe", icon: "❌" },
  { gameType: "chess", name: "Chess", icon: "♟️" },
  { gameType: "checkers", name: "Checkers", icon: "⬛" },
  { gameType: "crazy_eights", name: "Crazy Eights", icon: "🎴" },
  { gameType: "connect_four", name: "Connect Four", icon: "🔴" },
  { gameType: "gomoku_master", name: "Gomoku", icon: "⚫" },
  { gameType: "reversi_game", name: "Reversi", icon: "⚪" },
  { gameType: "dot_match", name: "Dots & Boxes", icon: "⬜" },
];

function buildTurnBasedAchievements(): AchievementDef[] {
  const result: AchievementDef[] = [];
  let sortOrder = 300;

  for (const game of TB_GAMES) {
    // First match
    result.push({
      id: `achv.tb.${game.gameType}.first_match`,
      name: `${game.name} Debut`,
      description: `Play your first ${game.name} match`,
      icon: game.icon,
      category: "turn_based",
      tier: "bronze",
      gameType: game.gameType,
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
      sortOrder: sortOrder++,
    });

    // First win
    result.push({
      id: `achv.tb.${game.gameType}.first_win`,
      name: `${game.name} Victor`,
      description: `Win your first ${game.name} match`,
      icon: game.icon,
      category: "turn_based",
      tier: "bronze",
      gameType: game.gameType,
      progressType: "count",
      target: 1,
      xpReward: 25,
      coinReward: 10,
      isEnabledByDefault: true,
      version: 1,
      sortOrder: sortOrder++,
    });

    // 10 wins
    result.push({
      id: `achv.tb.${game.gameType}.wins_10`,
      name: `${game.name} Expert`,
      description: `Win 10 ${game.name} matches`,
      icon: game.icon,
      category: "turn_based",
      tier: "silver",
      gameType: game.gameType,
      progressType: "count",
      target: 10,
      xpReward: 50,
      coinReward: 25,
      isEnabledByDefault: true,
      version: 1,
      sortOrder: sortOrder++,
    });

    // 25 matches
    result.push({
      id: `achv.tb.${game.gameType}.matches_25`,
      name: `${game.name} Enthusiast`,
      description: `Play 25 ${game.name} matches`,
      icon: game.icon,
      category: "turn_based",
      tier: "gold",
      gameType: game.gameType,
      progressType: "count",
      target: 25,
      xpReward: 100,
      coinReward: 50,
      isEnabledByDefault: true,
      version: 1,
      sortOrder: sortOrder++,
    });
  }

  // Global turn-based rematch achievement
  result.push({
    id: "achv.tb.rematch_accepted_5",
    name: "Rematch Warrior",
    description: "Complete 5 turn-based rematches",
    icon: "🔄",
    category: "turn_based",
    tier: "silver",
    progressType: "count",
    target: 5,
    xpReward: 50,
    coinReward: 25,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: sortOrder++,
  });

  return result;
}

// =============================================================================
// Real-Time Achievements
// =============================================================================

function buildRealTimeAchievements(): AchievementDef[] {
  const result: AchievementDef[] = [];
  let sortOrder = 500;

  // Crossword puzzle
  result.push({
    id: "achv.rt.crossword_puzzle.first_complete",
    name: "Crossword Beginner",
    description: "Complete your first crossword puzzle",
    icon: "📰",
    category: "real_time",
    tier: "bronze",
    gameType: "crossword_puzzle",
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.crossword_puzzle.streak_7",
    name: "Crossword Streak",
    description: "Complete 7 crossword puzzles in a row",
    icon: "🔥",
    category: "real_time",
    tier: "gold",
    gameType: "crossword_puzzle",
    progressType: "streak",
    target: 7,
    xpReward: 100,
    coinReward: 50,
    isEnabledByDefault: true,
    version: 1,
    sortOrder: sortOrder++,
  });

  // 8ball_pool placeholder — DISABLED (no game type in system yet)
  // These would be enabled when 8ball_pool is added to GAME_METADATA
  // and isAvailable is set to true.

  // air_hockey placeholder — DISABLED (no game type in system yet)
  // These would be enabled when air_hockey is added to GAME_METADATA
  // and isAvailable is set to true.

  return result;
}

// =============================================================================
// Combined Catalog
// =============================================================================

/** All v2 achievement definitions */
export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  ...GLOBAL_ACHIEVEMENTS,
  ...buildSinglePlayerAchievements(),
  ...buildTurnBasedAchievements(),
  ...buildRealTimeAchievements(),
];

/** Map of achievement ID → definition for O(1) lookups */
export const ACHIEVEMENTS_BY_ID: Map<string, AchievementDef> = new Map(
  ACHIEVEMENTS_CATALOG.map((def) => [def.id, def]),
);

// =============================================================================
// Gating Logic
// =============================================================================

/**
 * Determine if an achievement is currently active.
 *
 * An achievement is "active" when:
 *   1. def.isEnabledByDefault === true
 *   2. If def.gameType exists: that game must be available and not coming-soon
 *
 * This ensures coming-soon games don't show broken achievements.
 */
export function isAchievementActive(def: AchievementDef): boolean {
  if (!def.isEnabledByDefault) return false;

  if (def.gameType) {
    const meta = GAME_METADATA[def.gameType];
    if (!meta) return false;
    if (!meta.isAvailable) return false;
    if (meta.comingSoon === true) return false;
  }

  return true;
}

/**
 * Get all currently active achievement definitions.
 */
export function getActiveAchievements(): AchievementDef[] {
  return ACHIEVEMENTS_CATALOG.filter(isAchievementActive);
}

/**
 * Get active achievements for a specific game type.
 */
export function getActiveAchievementsForGame(
  gameType: ExtendedGameType,
): AchievementDef[] {
  return getActiveAchievements().filter((def) => def.gameType === gameType);
}

/**
 * Get active achievements by category.
 */
export function getActiveAchievementsByCategory(
  category: AchievementDef["category"],
): AchievementDef[] {
  return getActiveAchievements().filter((def) => def.category === category);
}

/**
 * Get achievement definition by ID (returns undefined if not found).
 */
export function getAchievementDefById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS_BY_ID.get(id);
}

/**
 * Get total count of active achievements.
 */
export function getActiveAchievementCount(): number {
  return getActiveAchievements().length;
}

// =============================================================================
// Achievement Sections — Collapsible UI Grouping
// =============================================================================

/** Section definitions for the Global tab */
const GLOBAL_SECTIONS: AchievementSection[] = [
  {
    id: "global_general",
    name: "General",
    icon: "🌟",
    category: "global",
    badge: { name: "All-Rounder", icon: "🏅", tier: "gold" },
    sortOrder: 0,
  },
];

/** Section definitions for the Single Player tab (one per game) */
const SP_SECTIONS: AchievementSection[] = [
  ...SP_SCORE_GAMES.map<AchievementSection>((game, i) => ({
    id: `sp_${game.gameType}`,
    name: game.name,
    icon: game.firstPlayIcon,
    category: "single_player" as const,
    gameType: game.gameType,
    badge: {
      name: `${game.name} Master`,
      icon: game.firstPlayIcon,
      tier: "platinum" as const,
    },
    sortOrder: i,
  })),
  {
    id: "sp_word_master",
    name: "Word Master",
    icon: "📝",
    category: "single_player" as const,
    gameType: "word_master" as ExtendedGameType,
    badge: {
      name: "Word Master Champion",
      icon: "📝",
      tier: "gold" as const,
    },
    sortOrder: SP_SCORE_GAMES.length,
  },
];

/** Section definitions for the Turn-Based tab (one per game + general) */
const TB_SECTIONS: AchievementSection[] = [
  ...TB_GAMES.map<AchievementSection>((game, i) => ({
    id: `tb_${game.gameType}`,
    name: game.name,
    icon: game.icon,
    category: "turn_based" as const,
    gameType: game.gameType,
    badge: {
      name: `${game.name} Champion`,
      icon: game.icon,
      tier: "platinum" as const,
    },
    sortOrder: i,
  })),
  {
    id: "tb_general",
    name: "General",
    icon: "🔄",
    category: "turn_based" as const,
    // no gameType — catches turn_based achievements without a specific game
    badge: {
      name: "Turn-Based Devotee",
      icon: "🔄",
      tier: "gold" as const,
    },
    sortOrder: TB_GAMES.length,
  },
];

/** Section definitions for the Real-Time tab */
const RT_SECTIONS: AchievementSection[] = [
  {
    id: "rt_crossword_puzzle",
    name: "Crossword Puzzle",
    icon: "📰",
    category: "real_time",
    gameType: "crossword_puzzle" as ExtendedGameType,
    badge: {
      name: "Crossword Master",
      icon: "📰",
      tier: "gold",
    },
    sortOrder: 0,
  },
];

/** All section definitions */
export const ACHIEVEMENT_SECTIONS: AchievementSection[] = [
  ...GLOBAL_SECTIONS,
  ...SP_SECTIONS,
  ...TB_SECTIONS,
  ...RT_SECTIONS,
];

/**
 * Get sections for a specific category tab.
 */
export function getSectionsForCategory(
  category: AchievementDef["category"],
): AchievementSection[] {
  return ACHIEVEMENT_SECTIONS.filter((s) => s.category === category).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

/**
 * Determine which section an achievement belongs to.
 */
export function getSectionForAchievement(
  def: AchievementDef,
): AchievementSection | undefined {
  const categorySections = getSectionsForCategory(def.category);

  // Try matching by gameType first
  if (def.gameType) {
    const match = categorySections.find((s) => s.gameType === def.gameType);
    if (match) return match;
  }

  // Fall back to "general" section (no gameType) in that category
  return categorySections.find((s) => !s.gameType);
}
