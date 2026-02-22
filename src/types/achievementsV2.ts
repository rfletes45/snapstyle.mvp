/**
 * Achievements V2 — Type Definitions
 *
 * Canonical v2 achievement system types.
 * Achievements are evaluated server-side (Cloud Function) from trusted stats
 * and stored as individual Firestore docs per achievement per user.
 *
 * Firestore paths:
 *   /users/{uid}/achievements/{achievementId}   → UserAchievementDoc
 *   /users/{uid}/statsPerGame/{gameType}         → PerGameStatsDoc
 *   /users/{uid}/achievementSummary              → AchievementSummaryDoc (single doc)
 *   /users/{uid}/socialGameStats                 → SocialGameStatsDoc   (single doc)
 *
 * Legacy compatibility:
 *   /PlayerAchievements/{playerId}               → existing v1 game achievements
 *   /Users/{uid}/Achievements/{achievementType}  → existing legacy achievements
 *
 * @module types/achievementsV2
 */

import { ExtendedGameType } from "./games";

// =============================================================================
// Achievement Definition Types (for catalog)
// =============================================================================

/** Categories for v2 achievements */
export type AchievementV2Category =
  | "global"
  | "single_player"
  | "turn_based"
  | "real_time";

/** Tier determines rewards and rarity */
export type AchievementV2Tier =
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond";

/** How progress is tracked */
export type AchievementV2ProgressType =
  | "count" // count towards target (games played, wins)
  | "threshold" // reach a threshold value (score >= X)
  | "streak" // consecutive streak
  | "instant" // unlocked immediately on first trigger
  | "pct_of_max" // percentage of score limit max
  | "stat_threshold"; // reach a game-specific stat threshold (e.g. maxTile >= 2048)

/** Rewards granted when an achievement is unlocked */
export interface AchievementRewards {
  /** Tokens added to Wallets/{uid}.tokensBalance */
  tokens?: number;
  /** Cosmetic entitlement IDs to grant (e.g. "badge_2048_master") */
  entitlements?: string[];
}

/** Achievement definition — static catalog entry */
export interface AchievementDef {
  /** Unique ID, e.g. "achv.global.first_game" */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description shown to user */
  description: string;

  /** Emoji or icon name */
  icon: string;

  /** Broad category */
  category: AchievementV2Category;

  /** Rarity/reward tier */
  tier: AchievementV2Tier;

  /** Game type this achievement is specific to (null = global) */
  gameType?: ExtendedGameType;

  /** How progress is tracked */
  progressType: AchievementV2ProgressType;

  /** Target value to unlock (e.g. 10 for "play 10 games") */
  target: number;

  /** For pct_of_max: percentage threshold (e.g. 0.5 = 50% of max score) */
  pctThreshold?: number;

  /** XP reward on unlock */
  xpReward: number;

  /** Coin reward on unlock */
  coinReward: number;

  /** Structured rewards granted on unlock (tokens, entitlements) */
  rewards?: AchievementRewards;

  /** Key into PerGameStatsDoc.gameSpecific for stat_threshold progress */
  statKey?: string;

  /** Hidden/secret achievement */
  secret?: boolean;

  /** Achievement is active and should be evaluated */
  isEnabledByDefault: boolean;

  /** Catalog version — bump when definition changes */
  version: number;

  /** Group ID for tiered achievements (e.g. "achv.game.bounce_blitz.score") */
  group?: string;

  /** Display order within group/category */
  sortOrder?: number;
}

// =============================================================================
// Achievement Section Types (for collapsible UI grouping)
// =============================================================================

/** Defines a collapsible section that groups achievements on the UI */
export interface AchievementSection {
  /** Unique section key, e.g. "sp_bounce_blitz" */
  id: string;

  /** Display name, e.g. "Bounce Blitz" */
  name: string;

  /** Emoji icon for the section header */
  icon: string;

  /** Which category tab this section belongs to */
  category: AchievementV2Category;

  /** If game-specific, the game type (used to filter catalog items) */
  gameType?: ExtendedGameType;

  /** Badge awarded when ALL achievements in this section are unlocked */
  badge: SectionBadge;

  /** Sort order among sections in the same category */
  sortOrder: number;
}

/** Badge awarded for completing all achievements in a section */
export interface SectionBadge {
  /** Badge display name */
  name: string;

  /** Badge emoji / icon */
  icon: string;

  /** Tier color scheme for the badge */
  tier: AchievementV2Tier;
}

/** Runtime section data with progress info (computed client-side) */
export interface AchievementSectionWithProgress {
  /** Section definition */
  section: AchievementSection;

  /** Achievement display items in this section */
  items: import("@/services/achievementsV2").V2AchievementDisplayItem[];

  /** How many achievements are unlocked in this section */
  unlockedCount: number;

  /** Total achievements in this section */
  totalCount: number;

  /** Fraction 0..1 of completion */
  completionPct: number;

  /** Whether all achievements in this section are unlocked */
  isComplete: boolean;
}

// =============================================================================
// Firestore Document Types
// =============================================================================

/** State of a single achievement for a user */
export type AchievementState = "locked" | "progress" | "unlocked";

/**
 * /users/{uid}/achievements/{achievementId}
 *
 * One doc per achievement per user. Only created once progress starts
 * or the achievement is unlocked.
 */
export interface UserAchievementDoc {
  /** Achievement ID (matches AchievementDef.id and doc ID) */
  achievementId: string;

  /** Current state */
  state: AchievementState;

  /** Current progress toward target */
  progress: number;

  /** Target value (from catalog at evaluation time) */
  target: number;

  /** Timestamp when first unlocked (null if not unlocked) */
  unlockedAt: number | null;

  /** Catalog version at time of last evaluation */
  version: number;

  /** Where this was evaluated: "server" | "migration" | "client" */
  source: "server" | "migration" | "client";

  /** Whether rewards (tokens/entitlements) have been granted for this unlock */
  rewardsGranted?: boolean;

  /** Last evaluation timestamp */
  updatedAt: number;

  /** Creation timestamp */
  createdAt: number;
}

/**
 * /users/{uid}/statsPerGame/{gameType}
 *
 * Per-game stats used by the evaluator.
 * Written by Cloud Functions on game completion.
 */
export interface PerGameStatsDoc {
  /** Game type (also the doc ID) */
  gameType: ExtendedGameType;

  /** Total games played */
  played: number;

  /** Games won (multiplayer) */
  wins: number;

  /** Games completed successfully (single-player) */
  completed: number;

  /** Puzzles solved (word_master, crossword) */
  solved: number;

  /** Current consecutive streak (wins or solves) */
  streak: number;

  /** Best streak ever */
  bestStreak: number;

  /** High score for single-player games */
  highScore: number;

  /** Total matches played (turn-based) */
  matches: number;

  /** Last played timestamp */
  lastPlayedAt: number;

  /** First played timestamp */
  firstPlayedAt: number;

  /** Last updated */
  updatedAt: number;

  /** Game-specific stats (e.g. maxTile for 2048, highestLevel for brick_breaker) */
  gameSpecific?: Record<string, number>;
}

/**
 * /users/{uid}/achievementSummary
 *
 * Aggregated achievement totals — single doc per user.
 * Updated by the evaluator after each evaluation pass.
 */
export interface AchievementSummaryDoc {
  /** Total achievements unlocked */
  totalUnlocked: number;

  /** Total available (active) achievements */
  totalAvailable: number;

  /** Breakdown by tier */
  unlockedByTier: Record<AchievementV2Tier, number>;

  /** Total XP earned from achievements */
  totalXpEarned: number;

  /** Total coins earned from achievements */
  totalCoinsEarned: number;

  /** IDs of all unlocked achievements (for quick queries) */
  unlockedIds: string[];

  /** Last evaluation timestamp */
  lastEvaluatedAt: number;

  /** Last updated */
  updatedAt: number;
}

/**
 * /users/{uid}/socialGameStats
 *
 * Social/invite/spectator counters used by achievement evaluator.
 * Incremented by Cloud Functions or validated client writes.
 */
export interface SocialGameStatsDoc {
  /** Total invites sent by this user */
  invitesSent: number;

  /** Total invites sent by this user that were accepted by another player */
  invitesAcceptedByOthers: number;

  /** Total games watched as spectator */
  gamesWatched: number;

  /** Total turn-based rematches completed */
  turnBasedRematchesCompleted: number;

  /** Last updated */
  updatedAt: number;
}

// =============================================================================
// Helper Types
// =============================================================================

/** Result of a single achievement evaluation */
export interface AchievementEvalResult {
  achievementId: string;
  previousState: AchievementState;
  newState: AchievementState;
  progress: number;
  target: number;
  justUnlocked: boolean;
}

/** Result of a full evaluation pass */
export interface EvaluationResult {
  userId: string;
  evaluated: number;
  newUnlocks: AchievementEvalResult[];
  errors: Array<{ achievementId: string; error: string }>;
  legacySynced: boolean;
  timestamp: number;
}

// =============================================================================
// Firestore Path Helpers
// =============================================================================

/** Get Firestore path for a user's achievement doc */
export function getUserAchievementPath(
  uid: string,
  achievementId: string,
): string {
  return `users/${uid}/achievements/${achievementId}`;
}

/** Get Firestore path for a user's per-game stats doc */
export function getPerGameStatsPath(
  uid: string,
  gameType: ExtendedGameType,
): string {
  return `users/${uid}/statsPerGame/${gameType}`;
}

/** Get Firestore path for a user's achievement summary */
export function getAchievementSummaryPath(uid: string): string {
  return `users/${uid}/achievementSummary`;
}

/** Get Firestore path for a user's social game stats */
export function getSocialGameStatsPath(uid: string): string {
  return `users/${uid}/socialGameStats`;
}

// =============================================================================
// Constants
// =============================================================================

export const ACHIEVEMENT_V2_TIER_REWARDS: Record<
  AchievementV2Tier,
  { xp: number; coins: number }
> = {
  bronze: { xp: 25, coins: 10 },
  silver: { xp: 50, coins: 25 },
  gold: { xp: 100, coins: 50 },
  platinum: { xp: 250, coins: 100 },
  diamond: { xp: 500, coins: 250 },
};
