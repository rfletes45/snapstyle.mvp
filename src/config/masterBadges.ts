/**
 * Master Badge Registry
 *
 * Maps achievement section IDs to master badge cosmetic IDs.
 * When a user completes ALL achievements in a section (game), they
 * can claim the corresponding master badge as an entitlement.
 *
 * Badge IDs must match entries in:
 *   - src/cosmetics/catalog.ts (CosmeticDefinition)
 *   - src/cosmetics/assetRegistry.ts (badgeAssets)
 *   - src/data/badges.ts (BADGE_DEFINITIONS)
 *
 * @module config/masterBadges
 */

import type { CosmeticRarity } from "@/cosmetics/types";
import type { AchievementV2Tier } from "@/types/achievementsV2";
import type { ExtendedGameType } from "@/types/games";

// =============================================================================
// Types
// =============================================================================

export interface MasterBadgeDefinition {
  /** Achievement section ID (e.g. "sp_play_2048") */
  sectionId: string;

  /** Cosmetic badge ID â€” must exist in catalog + asset registry */
  badgeId: string;

  /** Human-readable display name */
  displayName: string;

  /** The game type this master badge is for */
  gameType: ExtendedGameType;

  /** Emoji icon (matches section badge icon) */
  icon: string;

  /** Rarity in the cosmetics system */
  rarity: CosmeticRarity;

  /** Tier for visual styling */
  tier: AchievementV2Tier;
}

// =============================================================================
// Registry
// =============================================================================

/**
 * Master badge definitions keyed by achievement section ID.
 *
 * Every section with achievements should have a corresponding entry here.
 * When all achievements in the section are unlocked, the user can claim this badge.
 */
export const MASTER_BADGES: Record<string, MasterBadgeDefinition> = {
  // â”€â”€ Single Player â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  sp_play_2048: {
    sectionId: "sp_play_2048",
    badgeId: "badge_2048_master",
    displayName: "2048 Master",
    gameType: "play_2048",
    icon: "ðŸ”¢",
    rarity: "epic",
    tier: "diamond",
  },
  sp_brick_breaker: {
    sectionId: "sp_brick_breaker",
    badgeId: "badge_brick_breaker_master",
    displayName: "Brick Breaker Master",
    gameType: "brick_breaker",
    icon: "ðŸ§±",
    rarity: "epic",
    tier: "diamond",
  },
  sp_bounce_blitz: {
    sectionId: "sp_bounce_blitz",
    badgeId: "badge_bounce_blitz_master",
    displayName: "Bounce Blitz Master",
    gameType: "bounce_blitz",
    icon: "âšª",
    rarity: "epic",
    tier: "platinum",
  },
  sp_pong_game: {
    sectionId: "sp_pong_game",
    badgeId: "badge_pong_master",
    displayName: "Pong Master",
    gameType: "pong_game",
    icon: "ðŸ“",
    rarity: "epic",
    tier: "platinum",
  },
  sp_minesweeper_classic: {
    sectionId: "sp_minesweeper_classic",
    badgeId: "badge_minesweeper_master",
    displayName: "Minesweeper Master",
    gameType: "minesweeper_classic",
    icon: "ðŸ’£",
    rarity: "epic",
    tier: "platinum",
  },
  sp_word_master: {
    sectionId: "sp_word_master",
    badgeId: "badge_word_master",
    displayName: "Word Master Champion",
    gameType: "word_master",
    icon: "ðŸ“",
    rarity: "epic",
    tier: "gold",
  },

  // â”€â”€ Turn-Based â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  tb_tic_tac_toe: {
    sectionId: "tb_tic_tac_toe",
    badgeId: "badge_ttt_master",
    displayName: "Tic-Tac-Toe Master",
    gameType: "tic_tac_toe",
    icon: "âŒ",
    rarity: "epic",
    tier: "platinum",
  },
  tb_chess: {
    sectionId: "tb_chess",
    badgeId: "badge_chess_master",
    displayName: "Chess Master",
    gameType: "chess",
    icon: "â™Ÿï¸",
    rarity: "legendary",
    tier: "platinum",
  },
  tb_checkers: {
    sectionId: "tb_checkers",
    badgeId: "badge_checkers_master",
    displayName: "Checkers Master",
    gameType: "checkers",
    icon: "â¬›",
    rarity: "epic",
    tier: "platinum",
  },
  tb_crazy_eights: {
    sectionId: "tb_crazy_eights",
    badgeId: "badge_crazy_eights_master",
    displayName: "Crazy Cards Master",
    gameType: "crazy_eights",
    icon: "🃏",
    rarity: "epic",
    tier: "platinum",
  },
  tb_connect_four: {
    sectionId: "tb_connect_four",
    badgeId: "badge_four_master",
    displayName: "Connect Four Master",
    gameType: "connect_four",
    icon: "ðŸ”´",
    rarity: "epic",
    tier: "platinum",
  },
  tb_gomoku_master: {
    sectionId: "tb_gomoku_master",
    badgeId: "badge_gomoku_master",
    displayName: "Gomoku Master",
    gameType: "gomoku_master",
    icon: "âš«",
    rarity: "epic",
    tier: "platinum",
  },
  tb_reversi_game: {
    sectionId: "tb_reversi_game",
    badgeId: "badge_reversi_master",
    displayName: "Reversi Master",
    gameType: "reversi_game",
    icon: "âšª",
    rarity: "epic",
    tier: "platinum",
  },
  tb_dot_match: {
    sectionId: "tb_dot_match",
    badgeId: "badge_dots_and_boxes_master",
    displayName: "Dots & Boxes Master",
    gameType: "dot_match",
    icon: "â¬œ",
    rarity: "epic",
    tier: "platinum",
  },

  // â”€â”€ Real-Time â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  rt_crossword_puzzle: {
    sectionId: "rt_crossword_puzzle",
    badgeId: "badge_crossword_master",
    displayName: "Crossword Master",
    gameType: "crossword_puzzle",
    icon: "ðŸ“°",
    rarity: "epic",
    tier: "gold",
  },
  rt_sketch_party_game: {
    sectionId: "rt_sketch_party_game",
    badgeId: "badge_sketch_master",
    displayName: "Sketch Party Master",
    gameType: "sketch_party_game",
    icon: "ðŸŽ¨",
    rarity: "epic",
    tier: "diamond",
  },

  // â”€â”€ Global â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  global_general: {
    sectionId: "global_general",
    badgeId: "badge_all_rounder",
    displayName: "All-Rounder",
    gameType: "bounce_blitz", // placeholder â€” global section has no single game
    icon: "ðŸŒŸ",
    rarity: "legendary",
    tier: "gold",
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get the master badge definition for a given section ID.
 */
export function getMasterBadgeForSection(
  sectionId: string,
): MasterBadgeDefinition | undefined {
  return MASTER_BADGES[sectionId];
}

/**
 * Get the master badge definition for a given game type.
 * Searches all sections to find a match.
 */
export function getMasterBadgeForGame(
  gameType: ExtendedGameType,
): MasterBadgeDefinition | undefined {
  return Object.values(MASTER_BADGES).find((mb) => mb.gameType === gameType);
}

/**
 * Get all master badge IDs for quick lookup.
 */
export function getAllMasterBadgeIds(): string[] {
  return Object.values(MASTER_BADGES).map((mb) => mb.badgeId);
}
