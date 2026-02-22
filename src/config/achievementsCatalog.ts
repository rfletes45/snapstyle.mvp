/**
 * Achievements V2 — Client-Side Catalog
 *
 * Canonical achievement definitions for the v2 system.
 * The server evaluator mirrors these definitions independently.
 *
 * Changes from v1:
 * - stat_threshold progress type for game-specific milestones
 * - isSecret support for hidden achievements
 * - rewards field (tokens + entitlement grants)
 * - Meaningful per-game achievements (tile milestones, level milestones)
 *
 * @module config/achievementsCatalog
 */

import type {
  AchievementDef,
  AchievementSection,
  AchievementV2Tier,
} from "@/types/achievementsV2";
import { GAME_METADATA, type ExtendedGameType } from "@/types/games";

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
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
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
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
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
    rewards: { tokens: 75 },
    isEnabledByDefault: true,
    version: 2,
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
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
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
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
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
    version: 2,
  },
  {
    id: "achv.global.first_invite_accepted",
    name: "Challenge Accepted",
    description: "Have an invite accepted",
    icon: "🤝",
    category: "global",
    tier: "silver",
    progressType: "count",
    target: 1,
    xpReward: 50,
    coinReward: 25,
    isEnabledByDefault: true,
    version: 2,
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
    version: 2,
  },
];

// =============================================================================
// 2048 Achievements — Meaningful Tile Milestones
// =============================================================================

const PLAY_2048_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "achv.game.play_2048.first_play",
    name: "Number Cruncher",
    description: "Play 2048 for the first time",
    icon: "🔢",
    category: "single_player",
    tier: "bronze",
    gameType: "play_2048",
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: 100,
  },
  {
    id: "achv.game.play_2048.tile_256",
    name: "Getting Warmer",
    description: "Reach the 256 tile",
    icon: "🔢",
    category: "single_player",
    tier: "bronze",
    gameType: "play_2048",
    progressType: "stat_threshold",
    statKey: "maxTile",
    target: 256,
    xpReward: 25,
    coinReward: 15,
    rewards: { tokens: 15 },
    isEnabledByDefault: true,
    version: 2,
    group: "achv.game.play_2048.tiles",
    sortOrder: 101,
  },
  {
    id: "achv.game.play_2048.tile_512",
    name: "Halfway There",
    description: "Reach the 512 tile",
    icon: "🔢",
    category: "single_player",
    tier: "silver",
    gameType: "play_2048",
    progressType: "stat_threshold",
    statKey: "maxTile",
    target: 512,
    xpReward: 50,
    coinReward: 25,
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
    group: "achv.game.play_2048.tiles",
    sortOrder: 102,
  },
  {
    id: "achv.game.play_2048.tile_1024",
    name: "Power of Two",
    description: "Reach the 1024 tile",
    icon: "🔢",
    category: "single_player",
    tier: "gold",
    gameType: "play_2048",
    progressType: "stat_threshold",
    statKey: "maxTile",
    target: 1024,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50, entitlements: ["badge_2048_gold"] },
    isEnabledByDefault: true,
    version: 2,
    group: "achv.game.play_2048.tiles",
    sortOrder: 103,
  },
  {
    id: "achv.game.play_2048.tile_2048",
    name: "2048 Champion",
    description: "Reach the legendary 2048 tile",
    icon: "🔢",
    category: "single_player",
    tier: "platinum",
    gameType: "play_2048",
    progressType: "stat_threshold",
    statKey: "maxTile",
    target: 2048,
    xpReward: 250,
    coinReward: 100,
    rewards: { tokens: 150, entitlements: ["badge_2048_master"] },
    isEnabledByDefault: true,
    version: 2,
    group: "achv.game.play_2048.tiles",
    sortOrder: 104,
  },
  {
    id: "achv.game.play_2048.tile_4096",
    name: "Beyond Infinity",
    description: "???",
    icon: "✨",
    category: "single_player",
    tier: "diamond",
    gameType: "play_2048",
    progressType: "stat_threshold",
    statKey: "maxTile",
    target: 4096,
    xpReward: 500,
    coinReward: 250,
    rewards: { tokens: 300, entitlements: ["badge_2048_legend"] },
    secret: true,
    isEnabledByDefault: true,
    version: 2,
    group: "achv.game.play_2048.tiles",
    sortOrder: 105,
  },
  {
    id: "achv.game.play_2048.games_10",
    name: "2048 Regular",
    description: "Play 10 games of 2048",
    icon: "🔢",
    category: "single_player",
    tier: "silver",
    gameType: "play_2048",
    progressType: "count",
    target: 10,
    xpReward: 50,
    coinReward: 25,
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: 106,
  },
  {
    id: "achv.game.play_2048.under_500_moves",
    name: "Efficient Slider",
    description: "Reach 2048 in under 500 moves",
    icon: "⚡",
    category: "single_player",
    tier: "platinum",
    gameType: "play_2048",
    progressType: "stat_threshold",
    statKey: "bestWinMoveCount",
    target: 1, // binary: 1 means achieved (server sets to 1 when condition met)
    xpReward: 250,
    coinReward: 100,
    rewards: { tokens: 100 },
    secret: true,
    isEnabledByDefault: true,
    version: 2,
    sortOrder: 107,
  },
];

// =============================================================================
// Brick Breaker Achievements — Level & Score Milestones
// =============================================================================

const BRICK_BREAKER_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "achv.game.brick_breaker.first_play",
    name: "Brick Layer",
    description: "Play Brick Breaker for the first time",
    icon: "🧱",
    category: "single_player",
    tier: "bronze",
    gameType: "brick_breaker",
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: 110,
  },
  {
    id: "achv.game.brick_breaker.level_5",
    name: "Breaking Through",
    description: "Reach level 5",
    icon: "🧱",
    category: "single_player",
    tier: "bronze",
    gameType: "brick_breaker",
    progressType: "stat_threshold",
    statKey: "highestLevel",
    target: 5,
    xpReward: 25,
    coinReward: 15,
    rewards: { tokens: 15 },
    isEnabledByDefault: true,
    version: 2,
    group: "achv.game.brick_breaker.levels",
    sortOrder: 111,
  },
  {
    id: "achv.game.brick_breaker.level_10",
    name: "Demolition Expert",
    description: "Reach level 10",
    icon: "🧱",
    category: "single_player",
    tier: "silver",
    gameType: "brick_breaker",
    progressType: "stat_threshold",
    statKey: "highestLevel",
    target: 10,
    xpReward: 50,
    coinReward: 25,
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
    group: "achv.game.brick_breaker.levels",
    sortOrder: 112,
  },
  {
    id: "achv.game.brick_breaker.level_20",
    name: "Wrecking Ball",
    description: "Reach level 20",
    icon: "🧱",
    category: "single_player",
    tier: "gold",
    gameType: "brick_breaker",
    progressType: "stat_threshold",
    statKey: "highestLevel",
    target: 20,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50, entitlements: ["badge_breaker_gold"] },
    isEnabledByDefault: true,
    version: 2,
    group: "achv.game.brick_breaker.levels",
    sortOrder: 113,
  },
  {
    id: "achv.game.brick_breaker.level_30",
    name: "Brick Breaker Master",
    description: "Reach level 30",
    icon: "🧱",
    category: "single_player",
    tier: "platinum",
    gameType: "brick_breaker",
    progressType: "stat_threshold",
    statKey: "highestLevel",
    target: 30,
    xpReward: 250,
    coinReward: 100,
    rewards: { tokens: 150, entitlements: ["badge_breaker_master"] },
    isEnabledByDefault: true,
    version: 2,
    group: "achv.game.brick_breaker.levels",
    sortOrder: 114,
  },
  {
    id: "achv.game.brick_breaker.perfect_level",
    name: "Not a Scratch",
    description: "???",
    icon: "💎",
    category: "single_player",
    tier: "diamond",
    gameType: "brick_breaker",
    progressType: "stat_threshold",
    statKey: "perfectLevels",
    target: 1,
    xpReward: 500,
    coinReward: 250,
    rewards: { tokens: 300, entitlements: ["badge_breaker_perfect"] },
    secret: true,
    isEnabledByDefault: true,
    version: 2,
    sortOrder: 115,
  },
  {
    id: "achv.game.brick_breaker.games_10",
    name: "Brick Enthusiast",
    description: "Play 10 games of Brick Breaker",
    icon: "🧱",
    category: "single_player",
    tier: "silver",
    gameType: "brick_breaker",
    progressType: "count",
    target: 10,
    xpReward: 50,
    coinReward: 25,
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: 116,
  },
  {
    id: "achv.game.brick_breaker.score_50000",
    name: "High Scorer",
    description: "Score 50,000 points in a single game",
    icon: "🧱",
    category: "single_player",
    tier: "gold",
    gameType: "brick_breaker",
    progressType: "stat_threshold",
    statKey: "bestScore",
    target: 50000,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: 117,
  },
];

// =============================================================================
// Other Single-Player Achievements (score-tier pattern for remaining games)
// =============================================================================

/** Games that still use pct_of_max score tiers (non-2048, non-brick_breaker) */
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
    firstPlayName: "Bouncing Baby",
    firstPlayDesc: "Play Bounce Blitz for the first time",
    firstPlayIcon: "⚪",
    scoreTierName: "Bounce Master",
    scoreTierGroup: "achv.game.bounce_blitz.score",
  },
  {
    gameType: "pong_game",
    name: "Pong",
    firstPlayName: "Paddle Pusher",
    firstPlayDesc: "Play Pong for the first time",
    firstPlayIcon: "🏓",
    scoreTierName: "Pong Master",
    scoreTierGroup: "achv.game.pong_game.score",
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
  tokenReward: number;
}> = [
  {
    suffix: "bronze",
    pct: 0.25,
    tier: "bronze",
    label: "25%",
    tokenReward: 10,
  },
  { suffix: "silver", pct: 0.5, tier: "silver", label: "50%", tokenReward: 25 },
  { suffix: "gold", pct: 0.75, tier: "gold", label: "75%", tokenReward: 50 },
  {
    suffix: "platinum",
    pct: 0.9,
    tier: "platinum",
    label: "90%",
    tokenReward: 100,
  },
];

function buildSinglePlayerAchievements(): AchievementDef[] {
  const result: AchievementDef[] = [];
  let sortOrder = 120;

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
      rewards: { tokens: 10 },
      isEnabledByDefault: true,
      version: 2,
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
        target: 1,
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
        rewards: { tokens: scoreTier.tokenReward },
        isEnabledByDefault: true,
        version: 2,
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
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
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
    rewards: { tokens: 50 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  // ── Word Master stat-based achievements ───────────────────────────
  result.push({
    id: "achv.game.word_master.no_hints",
    name: "No Peeking",
    description: "???",
    icon: "🧠",
    category: "single_player",
    tier: "gold",
    gameType: "word_master",
    progressType: "stat_threshold",
    statKey: "bestAttempts",
    target: 1,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50 },
    secret: true,
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.game.word_master.streak_30",
    name: "Monthly Wordsmiths",
    description: "Solve the daily word 30 days in a row",
    icon: "🔥",
    category: "single_player",
    tier: "platinum",
    gameType: "word_master",
    progressType: "stat_threshold",
    statKey: "streakDay",
    target: 30,
    xpReward: 250,
    coinReward: 100,
    rewards: { tokens: 150, entitlements: ["badge_wordsmith_platinum"] },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.game.word_master.games_50",
    name: "Word Enthusiast",
    description: "Play 50 games of Word Master",
    icon: "📝",
    category: "single_player",
    tier: "gold",
    gameType: "word_master",
    progressType: "count",
    target: 50,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  // ── Bounce Blitz stat-based achievements ──────────────────────────
  result.push(
    {
      id: "achv.game.bounce_blitz.level_10",
      name: "Rising Bouncer",
      description: "Reach level 10 in Bounce Blitz",
      icon: "⚪",
      category: "single_player",
      tier: "silver",
      gameType: "bounce_blitz",
      progressType: "stat_threshold",
      statKey: "highestLevel",
      target: 10,
      xpReward: 50,
      coinReward: 25,
      rewards: { tokens: 25 },
      isEnabledByDefault: true,
      version: 2,
      group: "achv.game.bounce_blitz.levels",
      sortOrder: sortOrder++,
    },
    {
      id: "achv.game.bounce_blitz.level_25",
      name: "Bounce Master",
      description: "Reach level 25 in Bounce Blitz",
      icon: "⚪",
      category: "single_player",
      tier: "gold",
      gameType: "bounce_blitz",
      progressType: "stat_threshold",
      statKey: "highestLevel",
      target: 25,
      xpReward: 100,
      coinReward: 50,
      rewards: { tokens: 50, entitlements: ["badge_bounce_gold"] },
      isEnabledByDefault: true,
      version: 2,
      group: "achv.game.bounce_blitz.levels",
      sortOrder: sortOrder++,
    },
    {
      id: "achv.game.bounce_blitz.blocks_500",
      name: "Block Buster",
      description: "Destroy 500 blocks total",
      icon: "💥",
      category: "single_player",
      tier: "gold",
      gameType: "bounce_blitz",
      progressType: "stat_threshold",
      statKey: "totalBlocksDestroyed",
      target: 500,
      xpReward: 100,
      coinReward: 50,
      rewards: { tokens: 50 },
      isEnabledByDefault: true,
      version: 2,
      sortOrder: sortOrder++,
    },
  );

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
      rewards: { tokens: 10 },
      isEnabledByDefault: true,
      version: 2,
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
      rewards: { tokens: 10 },
      isEnabledByDefault: true,
      version: 2,
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
      rewards: { tokens: 25 },
      isEnabledByDefault: true,
      version: 2,
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
      rewards: { tokens: 50 },
      isEnabledByDefault: true,
      version: 2,
      sortOrder: sortOrder++,
    });

    // 5-win streak
    result.push({
      id: `achv.tb.${game.gameType}.win_streak_5`,
      name: `${game.name} Streak`,
      description: `Win 5 ${game.name} matches in a row`,
      icon: "🔥",
      category: "turn_based",
      tier: "gold",
      gameType: game.gameType,
      progressType: "streak",
      target: 5,
      xpReward: 100,
      coinReward: 50,
      rewards: { tokens: 50 },
      isEnabledByDefault: true,
      version: 2,
      sortOrder: sortOrder++,
    });

    // 50 wins
    result.push({
      id: `achv.tb.${game.gameType}.wins_50`,
      name: `${game.name} Legend`,
      description: `Win 50 ${game.name} matches`,
      icon: "👑",
      category: "turn_based",
      tier: "diamond",
      gameType: game.gameType,
      progressType: "count",
      target: 50,
      xpReward: 200,
      coinReward: 100,
      rewards: { tokens: 100 },
      isEnabledByDefault: true,
      version: 2,
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
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
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
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
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
    rewards: { tokens: 50 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  // Crossword expansions
  result.push({
    id: "achv.rt.crossword_puzzle.puzzles_10",
    name: "Puzzle Enthusiast",
    description: "Complete 10 crossword puzzles",
    icon: "📰",
    category: "real_time",
    tier: "silver",
    gameType: "crossword_puzzle",
    progressType: "count",
    target: 10,
    xpReward: 50,
    coinReward: 25,
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.crossword_puzzle.puzzles_50",
    name: "Crossword Connoisseur",
    description: "Complete 50 crossword puzzles",
    icon: "🏆",
    category: "real_time",
    tier: "diamond",
    gameType: "crossword_puzzle",
    progressType: "count",
    target: 50,
    xpReward: 200,
    coinReward: 100,
    rewards: { tokens: 100, entitlements: ["badge_crossword_master"] },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  // ---------------------------------------------------------------------------
  // Sketch Party
  // ---------------------------------------------------------------------------
  result.push({
    id: "achv.rt.sketch_party_game.first_match",
    name: "Party Starter",
    description: "Play your first Sketch Party match",
    icon: "🎨",
    category: "real_time",
    tier: "bronze",
    gameType: "sketch_party_game" as ExtendedGameType,
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.sketch_party_game.first_win",
    name: "Sketch Victor",
    description: "Win your first Sketch Party match",
    icon: "🎨",
    category: "real_time",
    tier: "bronze",
    gameType: "sketch_party_game" as ExtendedGameType,
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.sketch_party_game.wins_10",
    name: "Sketch Expert",
    description: "Win 10 Sketch Party matches",
    icon: "🎨",
    category: "real_time",
    tier: "silver",
    gameType: "sketch_party_game" as ExtendedGameType,
    progressType: "count",
    target: 10,
    xpReward: 50,
    coinReward: 25,
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.sketch_party_game.matches_25",
    name: "Sketch Enthusiast",
    description: "Play 25 Sketch Party matches",
    icon: "🎨",
    category: "real_time",
    tier: "gold",
    gameType: "sketch_party_game" as ExtendedGameType,
    progressType: "count",
    target: 25,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.sketch_party_game.correct_100",
    name: "Sharp Eye",
    description: "Guess 100 drawings correctly",
    icon: "👁️",
    category: "real_time",
    tier: "gold",
    gameType: "sketch_party_game" as ExtendedGameType,
    progressType: "stat_threshold",
    statKey: "correctGuesses",
    target: 100,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50, entitlements: ["badge_sketch_guesser"] },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.sketch_party_game.perfect_drawer_5",
    name: "Perfect Artist",
    description: "Have all players guess correctly in 5 drawing turns",
    icon: "🖌️",
    category: "real_time",
    tier: "gold",
    gameType: "sketch_party_game" as ExtendedGameType,
    progressType: "stat_threshold",
    statKey: "perfectDrawerTurns",
    target: 5,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50, entitlements: ["badge_sketch_artist"] },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.sketch_party_game.first_guess_10",
    name: "Quick Draw",
    description: "Be the first to guess correctly 10 times",
    icon: "⚡",
    category: "real_time",
    tier: "silver",
    gameType: "sketch_party_game" as ExtendedGameType,
    progressType: "stat_threshold",
    statKey: "firstGuessCount",
    target: 10,
    xpReward: 50,
    coinReward: 25,
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.sketch_party_game.score_5000",
    name: "Sketch Legend",
    description: "Score 5000 total points in Sketch Party",
    icon: "🌟",
    category: "real_time",
    tier: "diamond",
    gameType: "sketch_party_game" as ExtendedGameType,
    progressType: "stat_threshold",
    statKey: "bestScore",
    target: 5000,
    xpReward: 200,
    coinReward: 100,
    rewards: { tokens: 100, entitlements: ["badge_sketch_legend"] },
    isEnabledByDefault: true,
    secret: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  // ---------------------------------------------------------------------------
  // MiniGolf Duels
  // ---------------------------------------------------------------------------
  result.push({
    id: "achv.rt.minigolf_duels.first_match",
    name: "Tee Time",
    description: "Play your first MiniGolf Duels match",
    icon: "⛳",
    category: "real_time",
    tier: "bronze",
    gameType: "minigolf_duels" as ExtendedGameType,
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.minigolf_duels.first_win",
    name: "MiniGolf Victor",
    description: "Win your first MiniGolf Duels match",
    icon: "⛳",
    category: "real_time",
    tier: "bronze",
    gameType: "minigolf_duels" as ExtendedGameType,
    progressType: "count",
    target: 1,
    xpReward: 25,
    coinReward: 10,
    rewards: { tokens: 10 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.minigolf_duels.wins_10",
    name: "MiniGolf Expert",
    description: "Win 10 MiniGolf Duels matches",
    icon: "⛳",
    category: "real_time",
    tier: "silver",
    gameType: "minigolf_duels" as ExtendedGameType,
    progressType: "count",
    target: 10,
    xpReward: 50,
    coinReward: 25,
    rewards: { tokens: 25 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.minigolf_duels.matches_25",
    name: "MiniGolf Enthusiast",
    description: "Play 25 MiniGolf Duels matches",
    icon: "⛳",
    category: "real_time",
    tier: "gold",
    gameType: "minigolf_duels" as ExtendedGameType,
    progressType: "count",
    target: 25,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.minigolf_duels.hole_in_one",
    name: "Ace!",
    description: "Score a hole-in-one",
    icon: "🏌️",
    category: "real_time",
    tier: "silver",
    gameType: "minigolf_duels" as ExtendedGameType,
    progressType: "stat_threshold",
    statKey: "holesInOne",
    target: 1,
    xpReward: 50,
    coinReward: 25,
    rewards: { tokens: 25, entitlements: ["badge_golf_ace"] },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.minigolf_duels.holes_in_one_5",
    name: "Hole-in-One Master",
    description: "Score 5 holes-in-one",
    icon: "🏌️",
    category: "real_time",
    tier: "gold",
    gameType: "minigolf_duels" as ExtendedGameType,
    progressType: "stat_threshold",
    statKey: "holesInOne",
    target: 5,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50, entitlements: ["badge_golf_master"] },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.minigolf_duels.under_par_9",
    name: "Under Par Perfection",
    description: "Finish 9 holes under par in a single match",
    icon: "🎯",
    category: "real_time",
    tier: "diamond",
    gameType: "minigolf_duels" as ExtendedGameType,
    progressType: "stat_threshold",
    statKey: "underParHoles",
    target: 9,
    xpReward: 200,
    coinReward: 100,
    rewards: { tokens: 100 },
    isEnabledByDefault: true,
    secret: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  result.push({
    id: "achv.rt.minigolf_duels.win_streak_5",
    name: "MiniGolf Streak",
    description: "Win 5 MiniGolf Duels matches in a row",
    icon: "🔥",
    category: "real_time",
    tier: "gold",
    gameType: "minigolf_duels" as ExtendedGameType,
    progressType: "streak",
    target: 5,
    xpReward: 100,
    coinReward: 50,
    rewards: { tokens: 50 },
    isEnabledByDefault: true,
    version: 2,
    sortOrder: sortOrder++,
  });

  return result;
}

// =============================================================================
// Combined Catalog
// =============================================================================

/** All v2 achievement definitions */
export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  ...GLOBAL_ACHIEVEMENTS,
  ...PLAY_2048_ACHIEVEMENTS,
  ...BRICK_BREAKER_ACHIEVEMENTS,
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
  {
    id: "sp_play_2048",
    name: "2048",
    icon: "🔢",
    category: "single_player",
    gameType: "play_2048",
    badge: { name: "2048 Legend", icon: "🔢", tier: "diamond" },
    sortOrder: 0,
  },
  {
    id: "sp_brick_breaker",
    name: "Brick Breaker",
    icon: "🧱",
    category: "single_player",
    gameType: "brick_breaker",
    badge: { name: "Brick Breaker Legend", icon: "🧱", tier: "diamond" },
    sortOrder: 1,
  },
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
    sortOrder: i + 2,
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
    sortOrder: SP_SCORE_GAMES.length + 2,
  },
  // NOTE: Bounce Blitz section is already auto-generated from SP_SCORE_GAMES.map() above.
  // A duplicate manual entry was removed here to prevent doubled sections in the UI.
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
  {
    id: "rt_sketch_party_game",
    name: "Sketch Party",
    icon: "🎨",
    category: "real_time",
    gameType: "sketch_party_game" as ExtendedGameType,
    badge: {
      name: "Sketch Party Legend",
      icon: "🎨",
      tier: "diamond",
    },
    sortOrder: 1,
  },
  {
    id: "rt_minigolf_duels",
    name: "MiniGolf Duels",
    icon: "⛳",
    category: "real_time",
    gameType: "minigolf_duels" as ExtendedGameType,
    badge: {
      name: "MiniGolf Champion",
      icon: "⛳",
      tier: "diamond",
    },
    sortOrder: 2,
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

  if (def.gameType) {
    const match = categorySections.find((s) => s.gameType === def.gameType);
    if (match) return match;
  }

  return categorySections.find((s) => !s.gameType);
}
