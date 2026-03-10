/**
 * Realtime Framework — Game Registry
 *
 * Central registry for all realtime game definitions.
 * Each game registers its definition here. The server entry point
 * uses this to auto-register all room types.
 *
 * @module core/GameRegistry
 */

import type { RealtimeGameDefinition } from "./types";

const registry = new Map<string, RealtimeGameDefinition>();

/**
 * Register a realtime game definition.
 */
export function registerRealtimeGame(def: RealtimeGameDefinition): void {
  if (registry.has(def.gameId)) {
    throw new Error(`Realtime game "${def.gameId}" already registered.`);
  }
  registry.set(def.gameId, def);
  console.log(
    `[GameRegistry] Registered realtime game: ${def.gameId} (room: ${def.roomName})`,
  );
}

/**
 * Get a registered game definition.
 */
export function getRealtimeGame(
  gameId: string,
): RealtimeGameDefinition | undefined {
  return registry.get(gameId);
}

/**
 * Get all registered game definitions.
 */
export function getAllRealtimeGames(): RealtimeGameDefinition[] {
  return Array.from(registry.values());
}

/**
 * Get all registered room names for Colyseus server.define().
 */
export function getRegisteredRoomEntries(): Array<{
  roomName: string;
  gameId: string;
}> {
  return Array.from(registry.values()).map((def) => ({
    roomName: def.roomName,
    gameId: def.gameId,
  }));
}
