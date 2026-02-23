/**
 * Game Result Events — Lightweight pub/sub for XP & achievement notifications.
 *
 * When `submitGameResult` succeeds, it publishes a GameResultNotification
 * through this emitter. Any UI component (e.g. GameResultToastManager) can
 * subscribe and react — showing XP toasts, achievement unlocks, etc.
 *
 * @module services/gameResultEvents
 */

import type { GameResultResponse } from "@/types/gameResult";

export interface GameResultNotification {
  /** XP earned this session */
  xpEarned: number;
  /** Whether the player leveled up */
  didLevelUp: boolean;
  /** New level (if leveled up) */
  newLevel: number;
  /** Previous level */
  previousLevel: number;
  /** Achievement IDs unlocked this session */
  achievementsUnlocked: string[];
  /** The game that was completed */
  gameId: string;
}

type Listener = (notification: GameResultNotification) => void;

const listeners = new Set<Listener>();

/** Subscribe to game result notifications. Returns unsubscribe function. */
export function onGameResultNotification(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Publish a game result notification (called from submitGameResult). */
export function emitGameResultNotification(
  gameId: string,
  response: GameResultResponse,
): void {
  const notification: GameResultNotification = {
    xpEarned: response.xpEarned,
    didLevelUp: response.didLevelUp,
    newLevel: response.level,
    previousLevel: response.previousLevel,
    achievementsUnlocked: response.achievementsUnlocked,
    gameId,
  };

  for (const fn of listeners) {
    try {
      fn(notification);
    } catch {
      // Don't let a failing listener break others
    }
  }
}
