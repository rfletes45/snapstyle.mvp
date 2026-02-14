/**
 * Physics Schemas â€” State types for all Tier 1 real-time physics games
 *
 * Used by PhysicsRoom base and its subclasses:
 *   PongRoom, AirHockeyRoom, BounceBlitzRoom, BrickBreakerRoom
 *
 * IMPORTANT: @colyseus/schema has a 64-property-per-class limit.
 * Complex games (BrickBreaker) use sub-schemas.
 */

import { MapSchema, Schema, type } from "@colyseus/schema";
import { Player } from "./common";
import { SpectatorEntry } from "./spectator";

// =============================================================================
// Shared Physics Sub-schemas
// =============================================================================

/** Ball / puck for Pong and Air Hockey */
export class Ball extends Schema {
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") vx: number = 0;
  @type("float32") vy: number = 0;
  @type("float32") radius: number = 10;
  @type("float32") speed: number = 5;
}

/** Paddle for Pong / Air Hockey / Brick Breaker */
export class Paddle extends Schema {
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") width: number = 80;
  @type("float32") height: number = 14;
  @type("string") ownerId: string = "";
}

/** Physics player â€” extends Player with physics-specific fields */
export class PhysicsPlayer extends Player {
  /** Paddle X position (normalised 0-1 of field width) */
  @type("float32") paddleX: number = 0.5;
  /** Paddle Y position (normalised 0-1 of field height) */
  @type("float32") paddleY: number = 0;
  /** Whether this player has finished (died, completed, etc.) */
  @type("boolean") finished: boolean = false;
  /** Lives remaining */
  @type("int8") lives: number = 3;
  /** Current combo streak */
  @type("uint16") combo: number = 0;
}

// =============================================================================
// PhysicsState â€” Base state for Pong / Air Hockey
// =============================================================================

export class PhysicsState extends Schema {
  // --- Game lifecycle (mirrors BaseGameState) ---
  @type("string") phase: string = "waiting";
  @type("string") gameId: string = "";
  @type("string") gameType: string = "";
  @type({ map: PhysicsPlayer }) players = new MapSchema<PhysicsPlayer>();
  @type("uint8") maxPlayers: number = 2;
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";

  // --- Timer ---
  @type("float32") elapsed: number = 0;
  @type("float32") remaining: number = 0;
  @type("boolean") timerRunning: boolean = false;
  @type("uint8") countdown: number = 0;

  // --- Ball ---
  @type(Ball) ball = new Ball();

  // --- Paddles (keyed by sessionId) ---
  @type({ map: Paddle }) paddles = new MapSchema<Paddle>();

  // --- Field dimensions (logical units) ---
  @type("uint16") fieldWidth: number = 400;
  @type("uint16") fieldHeight: number = 600;
  @type("uint8") scoreToWin: number = 7;

  // --- Shared RNG seed ---
  @type("uint32") seed: number = 0;

  // --- Spectator Support ---
  @type({ map: SpectatorEntry }) spectators = new MapSchema<SpectatorEntry>();
  @type("uint8") spectatorCount: number = 0;
  @type("uint8") maxSpectators: number = 10;
}

// =============================================================================
// Brick Breaker Schemas (Competitive: parallel boards, shared levels)
// =============================================================================

export class BrickState extends Schema {
  @type("uint8") col: number = 0;
  @type("uint8") row: number = 0;
  /** 0=destroyed, 1=normal, 2=silver(2hp), 3=gold(3hp), 4=indestructible */
  @type("uint8") hp: number = 1;
  @type("uint8") brickType: number = 1;
}

export class BrickBreakerPlayerState extends Player {
  @type("boolean") finished: boolean = false;
  @type("int8") lives: number = 3;
  @type("uint8") level: number = 1;
  @type("uint16") bricksDestroyed: number = 0;
}

export class BrickBreakerState extends Schema {
  // --- Game lifecycle ---
  @type("string") phase: string = "waiting";
  @type("string") gameId: string = "";
  @type("string") gameType: string = "";
  @type("uint8") maxPlayers: number = 2;
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";

  // --- Timer ---
  @type("float32") elapsed: number = 0;
  @type("float32") remaining: number = 0;
  @type("uint8") countdown: number = 0;

  // --- Players ---
  @type({ map: BrickBreakerPlayerState }) bbPlayers =
    new MapSchema<BrickBreakerPlayerState>();

  // --- Shared ---
  @type("uint32") seed: number = 0;
  @type("uint8") currentLevel: number = 1;
  @type("uint8") maxLevel: number = 10;
}

// =============================================================================
// Bounce Blitz Schemas (Competitive: parallel boards, score race)
// =============================================================================

export class BounceBlitzPlayerState extends Player {
  @type("boolean") finished: boolean = false;
  @type("uint16") round: number = 1;
  @type("uint16") blocksDestroyed: number = 0;
}

export class BounceBlitzState extends Schema {
  @type("string") phase: string = "waiting";
  @type("string") gameId: string = "";
  @type("string") gameType: string = "";
  @type("uint8") maxPlayers: number = 2;
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";

  @type("float32") elapsed: number = 0;
  @type("float32") remaining: number = 0;
  @type("uint8") countdown: number = 0;

  @type({ map: BounceBlitzPlayerState }) blitzPlayers =
    new MapSchema<BounceBlitzPlayerState>();
  @type("uint32") seed: number = 0;
  @type("float32") gameDuration: number = 120;
}
