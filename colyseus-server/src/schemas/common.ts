/**
 * Common Schemas — Shared base types for all Colyseus rooms
 *
 * These schemas are the foundation for all game state synchronization.
 * Used by every room type (physics, turn-based, quick-play, coop).
 *
 * IMPORTANT: @colyseus/schema has a 64-property-per-class limit.
 * Split complex state into sub-schemas when needed.
 */

import { MapSchema, Schema, type } from "@colyseus/schema";
import { SpectatorEntry } from "./spectator";

// =============================================================================
// Vec2 — 2D coordinate / velocity
// =============================================================================

export class Vec2 extends Schema {
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
}

// =============================================================================
// Player — Represents a connected player in any room
// =============================================================================

export class Player extends Schema {
  /** Firebase UID */
  @type("string") uid: string = "";

  /** Colyseus session ID (changes on reconnect) */
  @type("string") sessionId: string = "";

  /** Display name from Firebase profile */
  @type("string") displayName: string = "";

  /** Avatar URL from Firebase profile */
  @type("string") avatarUrl: string = "";

  /** Whether the player is currently connected */
  @type("boolean") connected: boolean = true;

  /** Whether the player has signaled "ready" */
  @type("boolean") ready: boolean = false;

  /** Player's current score (meaning varies by game) */
  @type("int32") score: number = 0;

  /** Player index: 0 = player1, 1 = player2, etc. */
  @type("uint8") playerIndex: number = 0;

  /** ELO rating (for ranked matches) */
  @type("int32") eloRating: number = 1200;
}

// =============================================================================
// GameTimer — Shared timer state for countdown / game clock
// =============================================================================

export class GameTimer extends Schema {
  /** Time elapsed since game started (ms) */
  @type("float32") elapsed: number = 0;

  /** Time remaining until game ends (ms), 0 if untimed */
  @type("float32") remaining: number = 0;

  /** Whether the timer is currently running */
  @type("boolean") running: boolean = false;
}

// =============================================================================
// BaseGameState — Root state for every game room
// =============================================================================

export class BaseGameState extends Schema {
  /**
   * Game phase lifecycle:
   * "waiting"   → lobby, waiting for players
   * "countdown" → all ready, 3-2-1 countdown
   * "playing"   → game in progress
   * "finished"  → game over, showing results
   */
  @type("string") phase: string = "waiting";

  /** Unique game identifier */
  @type("string") gameId: string = "";

  /** Game type key (matches GAME_REGISTRY on client) */
  @type("string") gameType: string = "";

  /** Connected players */
  @type({ map: Player }) players = new MapSchema<Player>();

  /** Maximum players allowed */
  @type("uint8") maxPlayers: number = 2;

  /** Firebase UID of the winner ("" if no winner yet, or draw) */
  @type("string") winnerId: string = "";

  /** Why the game ended: "score", "opponent_left", "timeout", "draw_agreed", etc. */
  @type("string") winReason: string = "";

  /** Shared game timer */
  @type(GameTimer) timer = new GameTimer();

  /** Current turn number (0-indexed, incremented each turn) */
  @type("uint32") turnNumber: number = 0;

  /** Session ID of the player whose turn it is (turn-based only) */
  @type("string") currentTurnPlayerId: string = "";

  /** Whether this is a ranked/rated match */
  @type("boolean") isRated: boolean = true;

  /** Firestore document ID for persistence linkage */
  @type("string") firestoreGameId: string = "";

  // =========================================================================
  // Spectator Support
  // =========================================================================

  /** Connected spectators (sessionId → SpectatorEntry) */
  @type({ map: SpectatorEntry }) spectators = new MapSchema<SpectatorEntry>();

  /** Number of connected spectators */
  @type("uint8") spectatorCount: number = 0;

  /** Maximum spectators allowed */
  @type("uint8") maxSpectators: number = 10;
}
