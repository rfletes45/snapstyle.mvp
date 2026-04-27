/**
 * Games V4 — Game Result Types
 *
 * GameResults/{sessionId} — server-written only.
 * Contains the final scoreboard, XP awards, achievement unlocks, etc.
 * Created by resolveSessionInternal as an idempotent set-if-absent.
 *
 * @module gamesV4/types/result
 */

import type { GameId, TimestampLike } from "./common";
import type { ResolutionType } from "./session";

// =============================================================================
// Final Scoreboard Entry
// =============================================================================

/** Final scoreboard entry with placement and stats. */
export interface FinalScoreboardEntry {
  uid: string;
  displayName: string;
  avatarConfig?: Record<string, unknown>;
  profilePictureUrl?: string | null;
  /** Equipped avatar decoration ID at resolution time. */
  decorationId?: string | null;
  score: number;
  /** 1-indexed placement (1 = first place). Ties share same placement. */
  placement: number;
  /** Per-player stats (game-specific). */
  stats: Record<string, unknown>;
}

// =============================================================================
// XP Award
// =============================================================================

/** XP awarded to a single player. */
export interface XPAward {
  uid: string;
  /** Base XP for participation. */
  baseXP: number;
  /** Bonus XP for win/performance. */
  bonusXP: number;
  /** Total XP (base + bonus). */
  totalXP: number;
  /** What triggered the bonus (e.g., "win", "perfect_game"). */
  bonusReason?: string;
  /** New level info after applying XP. Null if no level-up. */
  levelUp?: {
    oldLevel: number;
    newLevel: number;
    newXpToNextLevel: number;
  };
}

// =============================================================================
// Achievement Unlock
// =============================================================================

/** An achievement unlocked during this session. */
export interface AchievementUnlock {
  uid: string;
  achievementType: string;
  name?: string;
  description?: string;
  sectionId?: string;
  tokenReward?: number;
  rewardTransactionId?: string;
  badgeId?: string;
  earnedAt: TimestampLike;
}

// =============================================================================
// Leaderboard Update
// =============================================================================

/** A leaderboard entry that was created or updated. */
export interface LeaderboardUpdate {
  uid: string;
  gameId: GameId;
  weekKey: string;
  newScore: number;
  previousScore: number | null;
  newRank?: number;
}

// =============================================================================
// Game Result Document
// =============================================================================

/**
 * Full document shape for GameResults/{sessionId}.
 *
 * Server-written only. Created by resolveSessionInternal.
 * Clients read for end-screen display.
 */
export interface GameResultV4 {
  /** Session ID (same as Firestore doc ID). */
  sessionId: string;

  /** Linked invite ID. */
  inviteId: string;

  /** Conversation ID. */
  conversationId: string;

  /** Canonical game identifier. */
  gameId: GameId;

  /** How the game ended. */
  resolutionType: ResolutionType;

  /** UIDs of the winner(s). */
  winnerIds: string[];

  /** Ordered final scoreboard. */
  scoreboard: FinalScoreboardEntry[];

  /** Per-player XP awards. */
  xpAwards: XPAward[];

  /** Achievement unlocks during this session. */
  achievementUnlocks: AchievementUnlock[];

  /** Leaderboard updates. */
  leaderboardUpdates: LeaderboardUpdate[];

  /** Game duration in milliseconds. */
  durationMs: number;

  /** Total number of moves/actions. */
  totalMoves: number;

  /** When the result was created (server timestamp). */
  createdAt: TimestampLike;

  /** Participant UIDs (for querying). */
  participantIds: string[];

  /** Server-calculated performance metrics (game-specific). */
  performanceMetrics: Record<string, unknown>;
}
