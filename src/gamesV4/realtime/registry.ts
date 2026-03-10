/**
 * Games V4 — Realtime Client Registry
 *
 * Central registry for game-specific RealtimeClientDefinition instances.
 * Game modules register their definitions at import time.
 *
 * @module gamesV4/realtime/registry
 */

import type { GameId } from "../types/common";
import type { RealtimeClientDefinition } from "./types";

const definitions = new Map<GameId, RealtimeClientDefinition>();

/**
 * Register a realtime game's client-side definition.
 * Called once per game module (typically at module import time).
 */
export function registerRealtimeClientDef<TState = Record<string, unknown>>(
  def: RealtimeClientDefinition<TState>,
): void {
  if (definitions.has(def.gameId)) {
    console.warn(
      `[RealtimeRegistry] Overwriting existing definition for "${def.gameId}".`,
    );
  }
  definitions.set(def.gameId, def as RealtimeClientDefinition);
}

/**
 * Retrieve a registered client definition by gameId.
 * Returns undefined if the game is not registered.
 */
export function getRealtimeClientDef<TState = Record<string, unknown>>(
  gameId: GameId,
): RealtimeClientDefinition<TState> | undefined {
  return definitions.get(gameId) as
    | RealtimeClientDefinition<TState>
    | undefined;
}

/**
 * Get all registered definitions.
 */
export function getAllRealtimeClientDefs(): RealtimeClientDefinition[] {
  return Array.from(definitions.values());
}

/**
 * Check if a game has a registered realtime client definition.
 */
export function isRealtimeGame(gameId: GameId): boolean {
  return definitions.has(gameId);
}
