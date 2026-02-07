/**
 * Snap Snake Game Logic
 *
 * Core mechanics:
 * - Snake moves continuously in current direction
 * - Swipe to change direction (no 180° turns allowed)
 * - Eating food grows snake by 1 segment
 * - Collision with wall or self ends game
 * - Speed increases as snake grows
 *
 * @see docs/GAMES_IMPLEMENTATION_PLAN.md
 */

import {
  SnakeDirection,
  snake_master_CONFIG,
  SnapSnakeState,
} from "@/types/singlePlayerGames";

// =============================================================================
// Types
// =============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface SnakeConfig {
  gridWidth: number;
  gridHeight: number;
  initialSpeed: number;
}

// =============================================================================
// Initialization
// =============================================================================

/**
 * Create initial snake state
 */
export function createInitialSnakeState(
  playerId: string,
  sessionId: string,
  config?: Partial<SnakeConfig>,
): SnapSnakeState {
  const gridWidth = config?.gridWidth ?? snake_master_CONFIG.defaultGridWidth;
  const gridHeight = config?.gridHeight ?? snake_master_CONFIG.defaultGridHeight;
  const initialSpeed = config?.initialSpeed ?? snake_master_CONFIG.initialSpeed;

  // Start snake in the center, moving right
  const centerX = Math.floor(gridWidth / 2);
  const centerY = Math.floor(gridHeight / 2);

  // Create initial snake (head + body segments)
  const snake: Position[] = [];
  for (let i = 0; i < snake_master_CONFIG.initialLength; i++) {
    snake.push({ x: centerX - i, y: centerY });
  }

  // Generate initial food position
  const food = generateFood(snake, gridWidth, gridHeight);

  return {
    gameType: "snake_master",
    category: "quick_play",
    playerId,
    sessionId,
    score: 0,
    highScore: 0,
    status: "playing",
    startedAt: Date.now(),
    totalPauseDuration: 0,
    snake,
    food,
    direction: "right",
    nextDirection: "right",
    gridWidth,
    gridHeight,
    speed: initialSpeed,
    foodEaten: 0,
    maxLength: snake_master_CONFIG.initialLength,
  };
}

// =============================================================================
// Food Generation
// =============================================================================

/**
 * Generate a random food position that doesn't overlap with the snake
 */
export function generateFood(
  snake: Position[],
  gridWidth: number,
  gridHeight: number,
): Position {
  const snakeSet = new Set(snake.map((p) => `${p.x},${p.y}`));

  // Get all empty positions
  const emptyPositions: Position[] = [];
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      if (!snakeSet.has(`${x},${y}`)) {
        emptyPositions.push({ x, y });
      }
    }
  }

  if (emptyPositions.length === 0) {
    // Board is full (this shouldn't happen in normal gameplay)
    return { x: 0, y: 0 };
  }

  // Pick a random empty position
  return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
}

// =============================================================================
// Direction Management
// =============================================================================

/**
 * Get the opposite direction
 */
function getOppositeDirection(direction: SnakeDirection): SnakeDirection {
  const opposites: Record<SnakeDirection, SnakeDirection> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };
  return opposites[direction];
}

/**
 * Check if a direction change is valid (not 180° turn)
 */
export function isValidDirectionChange(
  current: SnakeDirection,
  next: SnakeDirection,
): boolean {
  return next !== getOppositeDirection(current);
}

/**
 * Buffer a direction change
 */
export function changeDirection(
  state: SnapSnakeState,
  newDirection: SnakeDirection,
): SnapSnakeState {
  // Don't allow 180° turns
  if (!isValidDirectionChange(state.direction, newDirection)) {
    return state;
  }

  return {
    ...state,
    nextDirection: newDirection,
  };
}

/**
 * Get direction from swipe delta
 */
export function getDirectionFromSwipe(
  dx: number,
  dy: number,
  minSwipeDistance: number = 10,
): SnakeDirection | null {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Check if swipe is significant enough
  if (absDx < minSwipeDistance && absDy < minSwipeDistance) {
    return null;
  }

  // Determine primary direction
  if (absDx > absDy) {
    return dx > 0 ? "right" : "left";
  } else {
    return dy > 0 ? "down" : "up";
  }
}

// =============================================================================
// Movement & Collision
// =============================================================================

/**
 * Get the next head position based on direction
 */
function getNextHeadPosition(
  head: Position,
  direction: SnakeDirection,
): Position {
  const moves: Record<SnakeDirection, Position> = {
    up: { x: head.x, y: head.y - 1 },
    down: { x: head.x, y: head.y + 1 },
    left: { x: head.x - 1, y: head.y },
    right: { x: head.x + 1, y: head.y },
  };
  return moves[direction];
}

/**
 * Check if position is out of bounds
 */
function isOutOfBounds(
  pos: Position,
  gridWidth: number,
  gridHeight: number,
): boolean {
  return pos.x < 0 || pos.x >= gridWidth || pos.y < 0 || pos.y >= gridHeight;
}

/**
 * Check if position collides with snake body
 */
function collidesWithSnake(pos: Position, snake: Position[]): boolean {
  return snake.some((segment) => segment.x === pos.x && segment.y === pos.y);
}

/**
 * Check if position is at food
 */
function isAtFood(pos: Position, food: Position): boolean {
  return pos.x === food.x && pos.y === food.y;
}

// =============================================================================
// Game Tick
// =============================================================================

/**
 * Process one game tick - move snake, check collisions, eat food
 */
export function tick(state: SnapSnakeState): SnapSnakeState {
  if (state.status !== "playing") {
    return state;
  }

  // Apply buffered direction
  const direction = state.nextDirection;

  // Get next head position
  const head = state.snake[0];
  const nextHead = getNextHeadPosition(head, direction);

  // Check wall collision
  if (isOutOfBounds(nextHead, state.gridWidth, state.gridHeight)) {
    return {
      ...state,
      status: "gameOver",
      endedAt: Date.now(),
      direction,
    };
  }

  // Check self collision (check against body excluding tail since it will move)
  const bodyWithoutTail = state.snake.slice(0, -1);
  if (collidesWithSnake(nextHead, bodyWithoutTail)) {
    return {
      ...state,
      status: "gameOver",
      endedAt: Date.now(),
      direction,
    };
  }

  // Check food collision
  const ateFood = isAtFood(nextHead, state.food);

  // Build new snake
  const newSnake = [nextHead, ...state.snake];
  if (!ateFood) {
    // Remove tail if no food eaten
    newSnake.pop();
  }

  // Calculate new state
  let newState: SnapSnakeState = {
    ...state,
    snake: newSnake,
    direction,
    maxLength: Math.max(state.maxLength, newSnake.length),
  };

  if (ateFood) {
    // Calculate score
    const scoreGain =
      snake_master_CONFIG.baseScorePerFood +
      newSnake.length * snake_master_CONFIG.lengthBonusMultiplier;

    // Calculate new speed
    const newSpeed = Math.max(
      snake_master_CONFIG.minSpeed,
      state.speed - snake_master_CONFIG.speedDecreasePerFood,
    );

    // Generate new food
    const newFood = generateFood(newSnake, state.gridWidth, state.gridHeight);

    newState = {
      ...newState,
      food: newFood,
      score: state.score + scoreGain,
      foodEaten: state.foodEaten + 1,
      speed: newSpeed,
    };
  }

  return newState;
}

// =============================================================================
// Game State Helpers
// =============================================================================

/**
 * Pause the game
 */
export function pauseGame(state: SnapSnakeState): SnapSnakeState {
  if (state.status !== "playing") {
    return state;
  }

  return {
    ...state,
    status: "paused",
    pausedAt: Date.now(),
  };
}

/**
 * Resume the game
 */
export function resumeGame(state: SnapSnakeState): SnapSnakeState {
  if (state.status !== "paused" || !state.pausedAt) {
    return state;
  }

  const pauseDuration = Date.now() - state.pausedAt;

  return {
    ...state,
    status: "playing",
    pausedAt: undefined,
    totalPauseDuration: state.totalPauseDuration + pauseDuration,
  };
}

/**
 * Reset the game
 */
export function resetGame(state: SnapSnakeState): SnapSnakeState {
  return createInitialSnakeState(state.playerId, state.sessionId, {
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
  });
}

// =============================================================================
// Rendering Helpers
// =============================================================================

/**
 * Get cell size based on screen dimensions and grid size
 */
export function calculateCellSize(
  screenWidth: number,
  screenHeight: number,
  gridWidth: number,
  gridHeight: number,
  padding: number = 0,
): number {
  const availableWidth = screenWidth - padding * 2;
  const availableHeight = screenHeight - padding * 2;

  const cellFromWidth = availableWidth / gridWidth;
  const cellFromHeight = availableHeight / gridHeight;

  return Math.floor(Math.min(cellFromWidth, cellFromHeight));
}

/**
 * Get game board dimensions
 */
export function calculateBoardDimensions(
  cellSize: number,
  gridWidth: number,
  gridHeight: number,
): { width: number; height: number } {
  return {
    width: cellSize * gridWidth,
    height: cellSize * gridHeight,
  };
}

/**
 * Check if a segment is the head
 */
export function isHead(index: number): boolean {
  return index === 0;
}

/**
 * Check if a segment is the tail
 */
export function isTail(index: number, snakeLength: number): boolean {
  return index === snakeLength - 1;
}

/**
 * Get segment color based on position
 */
export function getSegmentColor(index: number, snakeLength: number): string {
  if (isHead(index)) {
    return snake_master_CONFIG.snakeHeadColor;
  }
  if (isTail(index, snakeLength)) {
    return snake_master_CONFIG.snakeTailColor;
  }
  return snake_master_CONFIG.snakeBodyColor;
}

/**
 * Calculate game duration in seconds
 */
export function getGameDuration(state: SnapSnakeState): number {
  const endTime = state.endedAt ?? Date.now();
  return Math.floor(
    (endTime - state.startedAt - state.totalPauseDuration) / 1000,
  );
}

