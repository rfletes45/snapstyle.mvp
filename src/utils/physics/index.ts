/**
 * Physics Utilities Index
 *
 * Central export for all game physics modules.
 */

// Flappy Snap Physics
export {
  // Types
  Bird,
  // Constants
  FLAPPY_PHYSICS,
  FlappyGameState,
  Pipe,
  // Bird physics
  applyGravity,
  checkAllCollisions,
  checkCeilingCollision,
  checkGroundCollision,
  // Collision detection
  checkPipeCollision,
  clampBirdPosition,
  // Game state
  createInitialState,
  flap,
  // Pipe management
  generatePipe,
  movePipes,
  physicsTick,
  recyclePipes,
  updateBirdPosition,
  // Score
  updateScore,
} from "./flappyPhysics";

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
