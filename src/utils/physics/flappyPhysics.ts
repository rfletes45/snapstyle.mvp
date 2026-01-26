/**
 * Flappy Game Physics
 *
 * Pure functions for Flappy Snap physics calculations.
 * Designed for easy unit testing and deterministic behavior.
 *
 * @see __tests__/physics/flappyPhysics.test.ts
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Physics configuration - tune these for game feel
 */
export const FLAPPY_PHYSICS = {
  /** Gravity in pixels/second² */
  GRAVITY: 980,
  /** Upward velocity on flap in pixels/second */
  FLAP_VELOCITY: -350,
  /** Maximum downward velocity */
  TERMINAL_VELOCITY: 600,
  /** Bird hitbox width */
  BIRD_WIDTH: 40,
  /** Bird hitbox height */
  BIRD_HEIGHT: 30,
  /** Pipe width */
  PIPE_WIDTH: 60,
  /** Gap between top and bottom pipes */
  PIPE_GAP: 150,
  /** Horizontal distance between pipes */
  PIPE_SPACING: 200,
  /** Pipe scroll speed in pixels/second */
  PIPE_SPEED: 150,
  /** Ground Y position */
  GROUND_Y: 600,
  /** Ceiling Y position */
  CEILING_Y: 0,
} as const;

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
  gapTop: number;
  gapBottom: number;
  width: number;
  index: number;
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
// Bird Physics
// =============================================================================

/**
 * Apply gravity to bird velocity
 * @param bird - The bird object to modify
 * @param deltaTimeMs - Time elapsed in milliseconds
 * @returns The modified bird
 */
export function applyGravity(bird: Bird, deltaTimeMs: number): Bird {
  const dt = deltaTimeMs / 1000; // Convert to seconds
  const newVelocity = Math.min(
    bird.velocity + FLAPPY_PHYSICS.GRAVITY * dt,
    FLAPPY_PHYSICS.TERMINAL_VELOCITY,
  );

  return {
    ...bird,
    velocity: newVelocity,
  };
}

/**
 * Update bird position based on velocity
 * @param bird - The bird object to modify
 * @param deltaTimeMs - Time elapsed in milliseconds
 * @returns The modified bird
 */
export function updateBirdPosition(bird: Bird, deltaTimeMs: number): Bird {
  const dt = deltaTimeMs / 1000;
  const newY = bird.y + bird.velocity * dt;

  return {
    ...bird,
    y: newY,
  };
}

/**
 * Apply flap force to bird (sets upward velocity)
 * @param bird - The bird object to modify
 * @returns The modified bird with flap velocity
 */
export function flap(bird: Bird): Bird {
  return {
    ...bird,
    velocity: FLAPPY_PHYSICS.FLAP_VELOCITY,
  };
}

/**
 * Clamp bird position to screen bounds
 * @param bird - The bird object
 * @returns Bird with clamped Y position
 */
export function clampBirdPosition(bird: Bird): Bird {
  const minY = FLAPPY_PHYSICS.CEILING_Y;
  const maxY = FLAPPY_PHYSICS.GROUND_Y - bird.height;

  return {
    ...bird,
    y: Math.max(minY, Math.min(maxY, bird.y)),
  };
}

// =============================================================================
// Collision Detection
// =============================================================================

/**
 * Check if bird collides with a pipe
 * Uses AABB (Axis-Aligned Bounding Box) collision detection
 *
 * @param bird - Bird position and dimensions
 * @param pipe - Pipe position and gap
 * @returns true if collision detected
 */
export function checkPipeCollision(bird: Bird, pipe: Pipe): boolean {
  // Bird bounding box
  const birdLeft = bird.x;
  const birdRight = bird.x + bird.width;
  const birdTop = bird.y;
  const birdBottom = bird.y + bird.height;

  // Pipe bounding box
  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + pipe.width;

  // Check if bird is horizontally within pipe
  const horizontalOverlap = birdRight > pipeLeft && birdLeft < pipeRight;

  if (!horizontalOverlap) {
    return false;
  }

  // Check collision with top pipe (above gap)
  const hitsTopPipe = birdTop < pipe.gapTop;

  // Check collision with bottom pipe (below gap)
  const hitsBottomPipe = birdBottom > pipe.gapBottom;

  return hitsTopPipe || hitsBottomPipe;
}

/**
 * Check if bird hits the ground
 * @param bird - Bird position and dimensions
 * @param groundY - Y position of ground (default from constants)
 * @returns true if bird touches or passes ground
 */
export function checkGroundCollision(
  bird: Bird,
  groundY: number = FLAPPY_PHYSICS.GROUND_Y,
): boolean {
  return bird.y + bird.height >= groundY;
}

/**
 * Check if bird hits the ceiling
 * @param bird - Bird position
 * @param ceilingY - Y position of ceiling (default from constants)
 * @returns true if bird touches or passes ceiling
 */
export function checkCeilingCollision(
  bird: Bird,
  ceilingY: number = FLAPPY_PHYSICS.CEILING_Y,
): boolean {
  return bird.y <= ceilingY;
}

/**
 * Check all collisions for a bird against pipes and boundaries
 * @param bird - Bird state
 * @param pipes - Array of pipes
 * @returns true if any collision detected
 */
export function checkAllCollisions(bird: Bird, pipes: Pipe[]): boolean {
  // Check ground/ceiling
  if (checkGroundCollision(bird) || checkCeilingCollision(bird)) {
    return true;
  }

  // Check each pipe
  for (const pipe of pipes) {
    if (checkPipeCollision(bird, pipe)) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// Score Calculation
// =============================================================================

/**
 * Update score based on pipes passed
 * Bird passes a pipe when its center goes past the pipe's right edge
 *
 * @param state - Current game state
 * @param pipes - Array of pipes to check
 * @returns Updated score and lastPipePassed index
 */
export function updateScore(
  state: FlappyGameState,
  pipes: Pipe[],
): { score: number; lastPipePassed: number } {
  let { score, lastPipePassed } = state;
  const birdCenterX = state.bird.x + state.bird.width / 2;

  for (const pipe of pipes) {
    // Check if bird has passed this pipe and hasn't scored it yet
    if (!pipe.passed && birdCenterX > pipe.x + pipe.width) {
      score += 1;
      lastPipePassed = pipe.index;
      pipe.passed = true;
    }
  }

  return { score, lastPipePassed };
}

// =============================================================================
// Pipe Management
// =============================================================================

/**
 * Generate a new pipe with random gap position
 * @param x - X position for the pipe
 * @param index - Pipe index for tracking
 * @param screenHeight - Height of game screen
 * @returns New pipe object
 */
export function generatePipe(
  x: number,
  index: number,
  screenHeight: number = FLAPPY_PHYSICS.GROUND_Y,
): Pipe {
  const minGapTop = 80;
  const maxGapTop = screenHeight - FLAPPY_PHYSICS.PIPE_GAP - 80;
  const gapTop = Math.random() * (maxGapTop - minGapTop) + minGapTop;

  return {
    x,
    gapTop,
    gapBottom: gapTop + FLAPPY_PHYSICS.PIPE_GAP,
    width: FLAPPY_PHYSICS.PIPE_WIDTH,
    index,
    passed: false,
  };
}

/**
 * Move pipes to the left
 * @param pipes - Array of pipes
 * @param deltaTimeMs - Time elapsed in milliseconds
 * @returns Updated pipes array
 */
export function movePipes(pipes: Pipe[], deltaTimeMs: number): Pipe[] {
  const dt = deltaTimeMs / 1000;
  const movement = FLAPPY_PHYSICS.PIPE_SPEED * dt;

  return pipes.map((pipe) => ({
    ...pipe,
    x: pipe.x - movement,
  }));
}

/**
 * Remove pipes that have gone off screen and add new ones
 * @param pipes - Current pipes array
 * @param screenWidth - Width of game screen
 * @param nextIndex - Index for next new pipe
 * @returns Updated pipes array and next index
 */
export function recyclePipes(
  pipes: Pipe[],
  screenWidth: number,
  nextIndex: number,
): { pipes: Pipe[]; nextIndex: number } {
  // Remove pipes that have gone off the left edge
  const activePipes = pipes.filter((pipe) => pipe.x + pipe.width > -50);

  // Find rightmost pipe
  const rightmostX =
    activePipes.length > 0
      ? Math.max(...activePipes.map((p) => p.x))
      : screenWidth;

  // Add new pipe if needed
  const newPipes = [...activePipes];
  let newNextIndex = nextIndex;

  if (rightmostX < screenWidth + FLAPPY_PHYSICS.PIPE_SPACING) {
    newPipes.push(
      generatePipe(rightmostX + FLAPPY_PHYSICS.PIPE_SPACING, newNextIndex),
    );
    newNextIndex++;
  }

  return { pipes: newPipes, nextIndex: newNextIndex };
}

// =============================================================================
// Game State Helpers
// =============================================================================

/**
 * Create initial game state
 * @param screenWidth - Width of game screen
 * @param screenHeight - Height of game screen
 * @returns Initial FlappyGameState
 */
export function createInitialState(
  screenWidth: number,
  screenHeight: number,
): FlappyGameState {
  const bird: Bird = {
    x: screenWidth * 0.2,
    y: screenHeight * 0.4,
    velocity: 0,
    width: FLAPPY_PHYSICS.BIRD_WIDTH,
    height: FLAPPY_PHYSICS.BIRD_HEIGHT,
  };

  // Start with one pipe off screen to the right
  const initialPipe = generatePipe(screenWidth + 100, 1, screenHeight);

  return {
    bird,
    pipes: [initialPipe],
    score: 0,
    lastPipePassed: 0,
    isGameOver: false,
  };
}

/**
 * Single physics tick - updates all game state for one frame
 * @param state - Current game state
 * @param deltaTimeMs - Time since last tick in milliseconds
 * @param screenWidth - Screen width for pipe recycling
 * @returns Updated game state
 */
export function physicsTick(
  state: FlappyGameState,
  deltaTimeMs: number,
  screenWidth: number,
): FlappyGameState {
  if (state.isGameOver) {
    return state;
  }

  // Update bird physics
  let bird = applyGravity(state.bird, deltaTimeMs);
  bird = updateBirdPosition(bird, deltaTimeMs);
  bird = clampBirdPosition(bird);

  // Update pipes
  let pipes = movePipes(state.pipes, deltaTimeMs);
  const recycled = recyclePipes(pipes, screenWidth, state.lastPipePassed + 2);
  pipes = recycled.pipes;

  // Check collisions
  const isGameOver = checkAllCollisions(bird, pipes);

  // Update score
  const { score, lastPipePassed } = updateScore(
    { ...state, bird, pipes },
    pipes,
  );

  return {
    bird,
    pipes,
    score,
    lastPipePassed,
    isGameOver,
  };
}
