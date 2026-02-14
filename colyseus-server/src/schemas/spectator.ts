/**
 * Spectator Schemas — Types for spectator tracking in Colyseus rooms
 *
 * SpectatorEntry tracks individual spectators connected to a room.
 * Added to BaseGameState so ALL rooms automatically support spectating.
 *
 * SpectatorRoomState is the dedicated state for the SpectatorRoom,
 * which allows spectating single-player games.
 */

import { MapSchema, Schema, type } from "@colyseus/schema";

// =============================================================================
// SpectatorEntry — A single spectator connected to a room
// =============================================================================

export class SpectatorEntry extends Schema {
  /** Firebase UID */
  @type("string") uid: string = "";

  /** Colyseus session ID */
  @type("string") sessionId: string = "";

  /** Display name from Firebase profile */
  @type("string") displayName: string = "";

  /** Avatar URL from Firebase profile */
  @type("string") avatarUrl: string = "";

  /** When this spectator joined (epoch ms) */
  @type("float64") joinedAt: number = 0;
}

// =============================================================================
// SpectatorRoomState — Dedicated room state for single-player spectating
// =============================================================================

export class SpectatorRoomState extends Schema {
  /** The game type being played (e.g., "brick_breaker", "bounce_blitz") */
  @type("string") gameType: string = "";

  /** Firebase UID of the host (player being watched) */
  @type("string") hostId: string = "";

  /** Display name of the host */
  @type("string") hostName: string = "";

  /**
   * Room phase:
   * "waiting"  → host created room but hasn't started yet
   * "active"   → host is playing, spectators can see live updates
   * "finished" → game over
   */
  @type("string") phase: string = "waiting";

  /** Host's current score */
  @type("int32") currentScore: number = 0;

  /** Active spectator interaction mode: spectate | boost | expedition */
  @type("string") sessionMode: string = "spectate";

  /** Host's current level (for level-based games) */
  @type("int32") currentLevel: number = 1;

  /** Host's remaining lives (for games with lives) */
  @type("int32") lives: number = 3;

  /** Active mine id for Clicker Mine V2 overlays */
  @type("string") activeMineId: string = "";

  /** Coarse boss vein hp for spectator overlay */
  @type("int32") bossHp: number = 0;
  @type("int32") bossMaxHp: number = 0;

  /** Coarse expedition boss hp for spectator overlay */
  @type("int32") expeditionBossHp: number = 0;
  @type("int32") expeditionBossMaxHp: number = 0;

  /** Serialized crew contribution summary for expedition overlays */
  @type("string") crewSummaryJson: string = "[]";

  /**
   * Serialized game-specific state as JSON string.
   * The host pushes game state snapshots; spectators parse and render.
   * Kept compact — only the data needed for rendering.
   */
  @type("string") gameStateJson: string = "{}";

  /** Connected spectators */
  @type({ map: SpectatorEntry }) spectators = new MapSchema<SpectatorEntry>();

  /** Number of connected spectators */
  @type("uint8") spectatorCount: number = 0;

  /** Maximum spectators allowed */
  @type("uint8") maxSpectators: number = 10;

  /**
   * Epoch ms when the current helper/boost session ends.
   * 0 means no active helper session.
   */
  @type("float64") boostSessionEndsAt: number = 0;
}
