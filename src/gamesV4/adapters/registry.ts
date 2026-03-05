/**
 * Games V4 — Adapter Registry
 *
 * Central registry mapping GameId → GameAdapterV4 instance.
 * Shared between client (optimistic) and server (authoritative).
 *
 * Adapters register themselves by calling `registerAdapter()`.
 * The registry is queried by `getAdapter()`.
 *
 * @module gamesV4/adapters/registry
 */

import type { GameAdapterV4 } from "../types/adapter";
import type { GameId } from "../types/common";

const adapters = new Map<GameId, GameAdapterV4>();

/**
 * Register a game adapter. Throws if duplicate registration.
 */
export function registerAdapter(adapter: GameAdapterV4): void {
  if (adapters.has(adapter.gameId)) {
    throw new Error(
      `[gamesV4] Adapter already registered for "${adapter.gameId}".`,
    );
  }
  adapters.set(adapter.gameId, adapter);
}

/**
 * Get a registered adapter by game ID.
 * Returns null if no adapter is registered (game not yet ported to V4).
 */
export function getAdapter(gameId: GameId): GameAdapterV4 | null {
  return adapters.get(gameId) ?? null;
}

/**
 * Get a registered adapter or throw. Use in server code where
 * the adapter MUST exist for a valid session.
 */
export function requireAdapter(gameId: GameId): GameAdapterV4 {
  const adapter = adapters.get(gameId);
  if (!adapter) {
    throw new Error(`[gamesV4] No adapter registered for "${gameId}".`);
  }
  return adapter;
}

/**
 * Returns all registered game IDs.
 */
export function getRegisteredGameIds(): GameId[] {
  return Array.from(adapters.keys());
}

/**
 * Check if an adapter is registered for a game ID.
 */
export function hasAdapter(gameId: GameId): boolean {
  return adapters.has(gameId);
}
