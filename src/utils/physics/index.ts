/**
 * Physics Utilities Index
 *
 * Central export for all game physics modules.
 */

// Pool Physics
export {
  // Types
  Ball,
  CollisionResult,
  // Constants
  POOL_PHYSICS,
  Pocket,
  PoolTable,
  Shot,
  applyFriction,
  applyShot,
  areAllBallsStopped,
  // Collision detection
  checkBallCollision,
  checkPocket,
  checkStop,
  checkWallCollision,
  createBall,
  // Helpers
  createStandardTable,
  getBallSpeed,
  // Collision resolution
  resolveBallCollision,
  resolveWallCollision,
  simulateShot,
  // Simulation
  simulateTick,
  // Ball movement
  updateBallPosition as updatePoolBallPosition,
} from "./poolPhysics";

// Flappy Physics
export {
  // Types
  Bird,
  // Constants
  FLAPPY_PHYSICS,
  FlappyGameState,
  Pipe,
  // Functions
  generatePipe,
  physicsTick,
} from "./flappyPhysics";
