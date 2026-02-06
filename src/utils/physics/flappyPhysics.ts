/**
 * Flappy Snap Physics Engine
 *
 * Pure physics functions for the Flappy Snap game.
 * All functions are deterministic and side-effect free.
 */

// =============================================================================
// Types
// =============================================================================

export interface Bird {
  x: number;
  y: number;
  velocity: number;
  width: number;
  height: number;
}

export interface Pipe {
  x: number;
  id: number;
  topHeight: number;
  gapSize: number;
  passed: boolean;
}

export interface FlappyGameState {
  bird: Bird;
  pipes: Pipe[];
  score: number;
  lastPipePassed: number;
  isGameOver: boolean;
}

// =============================================================================
// Constants
// =============================================================================

export const FLAPPY_PHYSICS = {
  GRAVITY: 0.6,
  JUMP_VELOCITY: -10,
  FLAP_VELOCITY: -10,
  BIRD_WIDTH: 34,
  BIRD_HEIGHT: 24,
  PIPE_WIDTH: 52,
  PIPE_GAP: 150,
  PIPE_SPEED: 3,
  GROUND_Y: 600,
  CEILING_Y: 0,
} as const;

// =============================================================================
// Functions
// =============================================================================

/**
 * Generate a new pipe obstacle at the given x position.
 */
export function generatePipe(
  x: number,
  id: number,
  screenHeight: number = 600,
): Pipe {
  const minTop = 80;
  const maxTop = screenHeight - FLAPPY_PHYSICS.PIPE_GAP - 80;
  const topHeight = minTop + Math.random() * (maxTop - minTop);

  return {
    x,
    id,
    topHeight,
    gapSize: FLAPPY_PHYSICS.PIPE_GAP,
    passed: false,
  };
}

/**
 * Advance the physics simulation by one tick.
 * Returns a new game state (immutable).
 */
export function physicsTick(
  state: FlappyGameState,
  deltaTime: number,
  screenWidth: number,
): FlappyGameState {
  if (state.isGameOver) return state;

  const dt = deltaTime / 16.67; // Normalize to 60fps

  // Update bird
  const newVelocity = state.bird.velocity + FLAPPY_PHYSICS.GRAVITY * dt;
  const newY = state.bird.y + newVelocity * dt;

  const bird: Bird = {
    ...state.bird,
    velocity: newVelocity,
    y: newY,
  };

  // Check ground/ceiling collision
  if (
    bird.y + bird.height >= FLAPPY_PHYSICS.GROUND_Y ||
    bird.y <= FLAPPY_PHYSICS.CEILING_Y
  ) {
    return { ...state, bird, isGameOver: true };
  }

  // Move pipes
  const pipes = state.pipes.map((pipe) => ({
    ...pipe,
    x: pipe.x - FLAPPY_PHYSICS.PIPE_SPEED * dt,
  }));

  // Check pipe collisions
  let isGameOver = false;
  let score = state.score;
  let lastPipePassed = state.lastPipePassed;

  for (const pipe of pipes) {
    // Check if bird passed the pipe
    if (!pipe.passed && pipe.x + FLAPPY_PHYSICS.PIPE_WIDTH < bird.x) {
      pipe.passed = true;
      score++;
      lastPipePassed = pipe.id;
    }

    // Check collision with pipe
    if (
      bird.x + bird.width > pipe.x &&
      bird.x < pipe.x + FLAPPY_PHYSICS.PIPE_WIDTH
    ) {
      if (
        bird.y < pipe.topHeight ||
        bird.y + bird.height > pipe.topHeight + pipe.gapSize
      ) {
        isGameOver = true;
      }
    }
  }

  return { bird, pipes, score, lastPipePassed, isGameOver };
}
