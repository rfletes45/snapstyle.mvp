/**
 * PlayerSummary Types
 *
 * Types for the enhanced Games Profile Header ("Player Summary Header").
 * Provides a unified shape for identity + progression + economy + tasks
 * that the header can render from a single payload.
 *
 * @module types/playerSummary
 * @see docs/06_GAMES.md — Player Summary Header section
 */

import type { LevelInfo } from "./profile";

// =============================================================================
// Equipped Decorations
// =============================================================================

/**
 * Decoration slots displayed on the Games Profile Header avatar stack.
 *
 * Each slot is optional — missing or invalid IDs fall back gracefully
 * (no crash, no broken layout).
 */
export interface EquippedDecor {
  /** Ring / border around the PFP */
  frameId?: string | null;
  /** Animated glow behind the PFP (can be disabled on low-perf devices) */
  auraId?: string | null;
  /** Small pin badge overlaid on the PFP */
  badgeId?: string | null;
  /** Sticker overlay on the PFP */
  overlayId?: string | null;
  /** Gradient plate rendered behind the entire avatar stack */
  backplateId?: string | null;
}

// =============================================================================
// Currency Balances
// =============================================================================

/**
 * Soft + premium currency snapshot for the header economy chips.
 *
 * All fields are optional — the UI renders only the chips that have data.
 */
export interface CurrencyBalances {
  /** Soft currency (primary) */
  coins: number;
  /** Premium currency */
  gems?: number;
  /** Game entry tickets */
  tickets?: number;
  /** Session energy (omit if economy doesn't use it) */
  energy?: number;
}

/** Default zero-state for balances */
export const DEFAULT_CURRENCY_BALANCES: CurrencyBalances = {
  coins: 0,
  gems: 0,
  tickets: 0,
};

// =============================================================================
// Tasks Progress Summary
// =============================================================================

/**
 * Lightweight summary of daily + monthly task progress for the header rails.
 */
export interface TasksProgressSummary {
  daily: {
    completed: number;
    total: number;
    claimableCount: number;
  };
  monthly: {
    completed: number;
    total: number;
    claimableCount: number;
    /** Level required to unlock monthly tasks (0 = always unlocked) */
    unlockLevel: number;
  };
}

/** Default zero-state for task summary */
export const DEFAULT_TASKS_SUMMARY: TasksProgressSummary = {
  daily: { completed: 0, total: 0, claimableCount: 0 },
  monthly: {
    completed: 0,
    total: 0,
    claimableCount: 0,
    unlockLevel: 0,
  },
};

// =============================================================================
// Mini Stats (Expanded Panel)
// =============================================================================

/**
 * Compact stats shown in the expanded panel.
 */
export interface MiniStats {
  matchesToday: number;
  winRate: number; // 0–1
  totalTimePlayed: number; // seconds
  currentStreak: number;
}

export const DEFAULT_MINI_STATS: MiniStats = {
  matchesToday: 0,
  winRate: 0,
  totalTimePlayed: 0,
  currentStreak: 0,
};

// =============================================================================
// Active Boost
// =============================================================================

/**
 * A currently active XP or currency boost.
 */
export interface ActiveBoost {
  id: string;
  label: string;
  /** e.g. "2x XP" */
  multiplierLabel: string;
  /** Timestamp (ms) when the boost expires */
  expiresAt: number;
  icon?: string;
}

// =============================================================================
// Player Summary (unified header payload)
// =============================================================================

/**
 * Single payload consumed by `EnhancedGamesProfileHeader`.
 *
 * Designed to be cheap — ideally computed client-side from data
 * already subscribed to by existing hooks (profile, wallet, tasks).
 */
export interface PlayerSummary {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  /** Secondary title (e.g. "Legend", "Rookie") */
  playerTitle?: string | null;

  /** Level + XP progression */
  level: LevelInfo;

  /** Economy snapshot */
  balances: CurrencyBalances;

  /** Task progress for daily & monthly rails */
  tasks: TasksProgressSummary;

  /** Decoration slots for AvatarStack */
  equippedDecor: EquippedDecor;

  /** Existing decoration id from profile system (frame overlay) */
  decorationId?: string | null;

  /** Online / away / offline */
  presence?: "online" | "away" | "offline";

  // ---- expanded panel data (lazy-loaded) ----
  miniStats?: MiniStats;
  activeBoosts?: ActiveBoost[];
}

/** Safe defaults so the UI can always render */
export const DEFAULT_PLAYER_SUMMARY: Omit<PlayerSummary, "uid"> = {
  displayName: "Player",
  level: { current: 1, xp: 0, xpToNextLevel: 100, totalXp: 0 },
  balances: DEFAULT_CURRENCY_BALANCES,
  tasks: DEFAULT_TASKS_SUMMARY,
  equippedDecor: {},
};
