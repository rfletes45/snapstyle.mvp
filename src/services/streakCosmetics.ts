/**
 * Streak Display Helpers (read-only).
 *
 * Streak state is managed exclusively by the server (Cloud Functions).
 * This module provides display/milestone utilities for the client UI.
 *
 * @module services/streakCosmetics
 */

import { MILESTONE_REWARDS } from "@/data/cosmetics";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Ordered list of streak milestones that unlock cosmetics. */
export const MILESTONES = [3, 7, 14, 30, 50, 100, 365] as const;

/** Human-readable milestone celebration messages. */
export const MILESTONE_MESSAGES: Record<number, string> = {
  3: "🔥 3-day streak! You're on fire!\n\nUnlocked: Flame Cap 🔥",
  7: "🔥 1 week streak! Amazing!\n\nUnlocked: Cool Shades 😎",
  14: "🔥 2 week streak! Incredible!\n\nUnlocked: Gradient Glow ✨",
  30: "🔥 30-day streak! One month!\n\nUnlocked: Golden Crown 👑",
  50: "🔥 50-day streak! Legendary!\n\nUnlocked: Star Glasses 🤩",
  100: "💯 100-day streak! Champion!\n\nUnlocked: Rainbow Burst 🌈",
  365: "🏆 365-day streak! One year!\n\nUnlocked: Legendary Halo 😇",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return the next milestone for a given streak count, or null if past max. */
export function nextMilestone(count: number): number | null {
  return MILESTONES.find((m) => m > count) ?? null;
}

/** Check whether a given count is an exact milestone. */
export function isMilestone(count: number): boolean {
  return (MILESTONES as readonly number[]).includes(count);
}

/** Return the cosmetic item ID unlocked at a milestone, or null. */
export function milestoneRewardId(milestone: number): string | null {
  return MILESTONE_REWARDS[milestone] ?? null;
}

// ─── Streak status helpers ────────────────────────────────────────────────────

export type StreakStatus = "active" | "at_risk" | "expired" | "none";

/**
 * Derive a display-friendly streak status from the raw friendship data.
 * This is purely derived — never writes to Firestore.
 *
 * @param streakCount       Current streak count from friendship doc.
 * @param streakUpdatedDay  YYYY-MM-DD (UTC) from friendship doc.
 * @param lastSentSelf      YYYY-MM-DD for current user's last sent day.
 * @param lastSentOther     YYYY-MM-DD for other user's last sent day.
 */
export function deriveStreakStatus(
  streakCount: number,
  streakUpdatedDay: string,
  lastSentSelf: string,
  lastSentOther: string,
): { status: StreakStatus; displayCount: number } {
  if (!streakCount || streakCount <= 0) {
    return { status: "none", displayCount: 0 };
  }

  const today = new Date().toISOString().slice(0, 10);

  // If the streak was already updated today, it's solidly active.
  if (streakUpdatedDay === today) {
    return { status: "active", displayCount: streakCount };
  }

  // Calculate gap from last streak update.
  const gap = daysBetween(streakUpdatedDay, today);

  if (gap <= 1) {
    // Yesterday — at risk if not both sent today yet.
    const bothSentToday = lastSentSelf === today && lastSentOther === today;
    return {
      status: bothSentToday ? "active" : "at_risk",
      displayCount: streakCount,
    };
  }

  // gap >= 2: streak is dead (or grace-saved server-side, but from client
  // perspective we show the canonical streakCount as-is until server cleans up).
  if (gap >= 3) {
    return { status: "expired", displayCount: 0 };
  }

  // gap === 2: might be grace-saved by server; show at_risk until server confirms.
  return { status: "at_risk", displayCount: streakCount };
}

// ─── Internal utility ─────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  const msA = Date.parse(a + "T00:00:00Z");
  const msB = Date.parse(b + "T00:00:00Z");
  return Math.round(Math.abs(msB - msA) / 86_400_000);
}
