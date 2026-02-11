/**
 * Schema Barrel Export — All Colyseus state schemas
 */

// Common / base schemas
export { BaseGameState, GameTimer, Player, Vec2 } from "./common";

// Quick-play score-race schemas
export { ScoreRacePlayer, ScoreRaceState } from "./quickplay";

// Physics game schemas (Phase 4)
export {
  Ball,
  BounceBlitzPlayerState,
  BounceBlitzState,
  BrickBreakerPlayerState,
  BrickBreakerState,
  BrickState,
  Food,
  Paddle,
  PhysicsPlayer,
  PhysicsState,
  RacePlayerState,
  RaceState,
  SnakePlayerState,
  SnakeSegment,
  SnakeState,
} from "./physics";

// Turn-based game schemas (Phase 2–3)
export {
  GridCell,
  MoveRecord,
  TurnBasedPlayer,
  TurnBasedState,
} from "./turnbased";

// Card game schemas (Phase 3)
export { CardGameState, CardPlayer, SyncCard } from "./cards";

// Cooperative / Creative game schemas (Phase 5)
export {
  CrosswordCell,
  CrosswordClue,
  CrosswordPlayer,
  CrosswordState,
  WordMasterGuess,
  WordMasterPlayer,
  WordMasterState,
} from "./draw";
