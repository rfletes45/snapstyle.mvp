/**
 * Golf Duels — Matchplay Rules Engine
 *
 * Implements the exact match rules:
 * - Each hole is won by the player with fewer strokes (tie = halved)
 * - Minimum 5 holes must be played
 * - After 5 holes, a player wins if they lead by ≥ 2 holes
 * - If tied or lead < 2 after 5, continue with tier 6 overtime holes
 * - Max strokes per hole: 8 (stroke-cap → ball teleports to cup)
 * - Shot clock: 15 seconds per shot
 * - Safety cap: 15 total holes
 *
 * This module is pure logic — no side effects, no I/O.
 */

import type { HoleWinner, MatchEndReason, MatchWinner } from "./types";
import { MATCH_RULES } from "./types";

// =============================================================================
// Hole Result
// =============================================================================

/**
 * Determine who won a hole based on strokes.
 * Lower strokes wins. Equal = tie.
 */
export function resolveHole(p1Strokes: number, p2Strokes: number): HoleWinner {
  if (p1Strokes < p2Strokes) return "p1";
  if (p2Strokes < p1Strokes) return "p2";
  return "tie";
}

// =============================================================================
// Match State Evaluation
// =============================================================================

export interface MatchStatus {
  /** Is the match over? */
  finished: boolean;
  /** If finished, which player won? null = not finished or true draw */
  winner: MatchWinner;
  /** Current hole lead: positive = p1 leads, negative = p2 leads */
  holeLead: number;
  /** Number of holes completed */
  holesPlayed: number;
  /** Is the match in overtime (past hole 5)? */
  isOvertime: boolean;
  /** Reason match ended */
  winReason: MatchEndReason | "max_holes" | "";
}

/**
 * Evaluate match status after a hole is completed.
 *
 * @param p1HolesWon Number of holes won by player 1
 * @param p2HolesWon Number of holes won by player 2
 * @param holesPlayed Total holes completed
 */
export function evaluateMatch(
  p1HolesWon: number,
  p2HolesWon: number,
  holesPlayed: number,
): MatchStatus {
  const holeLead = p1HolesWon - p2HolesWon;
  const absLead = Math.abs(holeLead);
  const isOvertime = holesPlayed > MATCH_RULES.MIN_HOLES;

  // Safety cap reached
  if (holesPlayed >= MATCH_RULES.MAX_TOTAL_HOLES) {
    if (holeLead > 0) {
      return {
        finished: true,
        winner: "p1",
        holeLead,
        holesPlayed,
        isOvertime: true,
        winReason: "max_holes",
      };
    }
    if (holeLead < 0) {
      return {
        finished: true,
        winner: "p2",
        holeLead,
        holesPlayed,
        isOvertime: true,
        winReason: "max_holes",
      };
    }
    // True draw at safety cap — extremely rare
    return {
      finished: true,
      winner: null,
      holeLead: 0,
      holesPlayed,
      isOvertime: true,
      winReason: "max_holes",
    };
  }

  // Not enough holes played yet
  if (holesPlayed < MATCH_RULES.MIN_HOLES) {
    return {
      finished: false,
      winner: null,
      holeLead,
      holesPlayed,
      isOvertime: false,
      winReason: "",
    };
  }

  // After MIN_HOLES: check for win by lead >= WIN_LEAD
  if (absLead >= MATCH_RULES.WIN_LEAD) {
    const winner: MatchWinner = holeLead > 0 ? "p1" : "p2";
    return {
      finished: true,
      winner,
      holeLead,
      holesPlayed,
      isOvertime,
      winReason: "up_by_2",
    };
  }

  // Not finished yet — continue playing
  return {
    finished: false,
    winner: null,
    holeLead,
    holesPlayed,
    isOvertime,
    winReason: "",
  };
}

/**
 * Determine which tier the next hole should come from.
 * Holes 1-5 come from tiers 1-5 respectively.
 * Holes 6+ come from tier 6 (overtime).
 */
export function getNextHoleTier(holeIndex: number): number {
  if (holeIndex < 5) return holeIndex + 1;
  return MATCH_RULES.OVERTIME_TIER;
}

/**
 * Check if a player's strokes on the current hole have reached the cap.
 * If so, ball teleports to cup immediately.
 */
export function isStrokeCapped(strokes: number): boolean {
  return strokes >= MATCH_RULES.MAX_STROKES_PER_HOLE;
}

/**
 * Handle forfeit — the remaining player wins.
 */
export function resolveForfeit(
  forfeitingPlayer: "p1" | "p2",
  p1HolesWon: number,
  p2HolesWon: number,
  holesPlayed: number,
): MatchStatus {
  const winner: MatchWinner = forfeitingPlayer === "p1" ? "p2" : "p1";
  const holeLead = p1HolesWon - p2HolesWon;
  return {
    finished: true,
    winner,
    holeLead,
    holesPlayed,
    isOvertime: holesPlayed > MATCH_RULES.MIN_HOLES,
    winReason: "forfeit",
  };
}
