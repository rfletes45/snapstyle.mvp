/**
 * Checkpoint System
 *
 * Manages checkpoint activation, tracking, and respawn functionality.
 * Checkpoints are created as sensor bodies that detect cart collision.
 */

import Matter from "matter-js";
import {
  Checkpoint,
  CheckpointEntity,
  COLLISION_CATEGORIES,
  GameEngineUpdateProps,
  GameEntities,
  GameEvent,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Checkpoint Configuration
// ============================================

export interface CheckpointConfig {
  width: number;
  height: number;
  activationDelay: number; // MS before checkpoint becomes active after spawn
  visualPulseDuration: number; // MS for activation visual effect
  showTransitionOverlay: boolean;
}

export const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
  width: 60,
  height: 80,
  activationDelay: 1000, // 1 second delay after spawn
  visualPulseDuration: 500,
  showTransitionOverlay: true,
};

// ============================================
// Checkpoint State
// ============================================

export interface CheckpointState {
  activeCheckpointIndex: number;
  lastActivatedCheckpointId: string | null;
  checkpointActivationTimes: Map<string, number>;
  totalCheckpoints: number;
  respawnPosition: Vector2D;
  respawnRotation: number;
  isRespawning: boolean;
  respawnStartTime: number;
}

/**
 * Create initial checkpoint state
 */
export function createCheckpointState(
  initialCheckpoint: Checkpoint | null,
  totalCheckpoints: number,
): CheckpointState {
  return {
    activeCheckpointIndex: 0,
    lastActivatedCheckpointId: initialCheckpoint?.id ?? null,
    checkpointActivationTimes: new Map(),
    totalCheckpoints,
    respawnPosition: initialCheckpoint?.position ?? { x: 100, y: 7880 },
    respawnRotation: initialCheckpoint?.rotation ?? 0,
    isRespawning: false,
    respawnStartTime: 0,
  };
}

// ============================================
// Checkpoint Body Creation
// ============================================

/**
 * Create a checkpoint sensor body
 */
export function createCheckpointBody(
  checkpoint: Checkpoint,
  config: CheckpointConfig = DEFAULT_CHECKPOINT_CONFIG,
): Matter.Body {
  const body = Matter.Bodies.rectangle(
    checkpoint.position.x,
    checkpoint.position.y,
    config.width,
    config.height,
    {
      isStatic: true,
      isSensor: true, // Doesn't cause physical collision
      label: `checkpoint_${checkpoint.id}`,
      collisionFilter: {
        category: COLLISION_CATEGORIES.CHECKPOINT,
        mask: COLLISION_CATEGORIES.CART,
      },
      // Store checkpoint data in plugin
      plugin: {
        checkpointId: checkpoint.id,
        areaIndex: checkpoint.areaIndex,
        checkpoint: checkpoint,
      },
    },
  );

  return body;
}

/**
 * Create checkpoint entity from checkpoint definition
 */
export function createCheckpointEntity(
  checkpoint: Checkpoint,
  world: Matter.World,
  config: CheckpointConfig = DEFAULT_CHECKPOINT_CONFIG,
): CheckpointEntity {
  const body = createCheckpointBody(checkpoint, config);
  Matter.World.add(world, body);

  return {
    body,
    checkpoint,
    isActivated: false,
    activationTime: undefined,
    renderer: "checkpoint",
  };
}

/**
 * Create all checkpoint entities for a course
 */
export function createAllCheckpointEntities(
  checkpoints: Checkpoint[],
  world: Matter.World,
  config: CheckpointConfig = DEFAULT_CHECKPOINT_CONFIG,
): Map<string, CheckpointEntity> {
  const entities = new Map<string, CheckpointEntity>();

  checkpoints.forEach((checkpoint) => {
    const entity = createCheckpointEntity(checkpoint, world, config);
    entities.set(checkpoint.id, entity);
  });

  return entities;
}

// ============================================
// Checkpoint Detection
// ============================================

/**
 * Check if cart has collided with a checkpoint
 */
export function checkCheckpointCollision(
  cartBody: Matter.Body,
  checkpointBody: Matter.Body,
): boolean {
  // Use Matter.js collision detection
  const collision = Matter.SAT.collides(cartBody, checkpointBody);
  return collision?.collided ?? false;
}

/**
 * Get checkpoint entity from collision body
 */
export function getCheckpointFromBody(
  body: Matter.Body,
  checkpoints: Map<string, CheckpointEntity>,
): CheckpointEntity | null {
  const checkpointId = body.plugin?.checkpointId;
  if (!checkpointId) return null;
  return checkpoints.get(checkpointId) ?? null;
}

// ============================================
// Checkpoint System
// ============================================

/**
 * Checkpoint System - handles checkpoint activation and tracking
 */
export function CheckpointSystem(
  entities: GameEntities & {
    checkpointState?: CheckpointState;
    checkpointEntities?: Map<string, CheckpointEntity>;
  },
  { time, dispatch }: GameEngineUpdateProps,
): GameEntities {
  const { cart, checkpointState, checkpointEntities } = entities;

  if (
    !checkpointState ||
    !checkpointEntities ||
    checkpointEntities.size === 0
  ) {
    return entities;
  }

  // Get cart body
  const cartBody = cart.composite.bodies.find((b) => b.label === "cart_body");
  if (!cartBody) {
    return entities;
  }

  // Check each checkpoint for collision
  checkpointEntities.forEach((checkpointEntity, checkpointId) => {
    // Skip already activated checkpoints
    if (checkpointEntity.isActivated) {
      return;
    }

    // Check collision
    const isColliding = checkCheckpointCollision(
      cartBody,
      checkpointEntity.body,
    );

    if (isColliding) {
      // Activate checkpoint
      activateCheckpoint(
        checkpointEntity,
        checkpointState,
        time.current,
        dispatch,
      );
    }
  });

  return entities;
}

/**
 * Activate a checkpoint
 */
function activateCheckpoint(
  checkpointEntity: CheckpointEntity,
  state: CheckpointState,
  currentTime: number,
  dispatch: (event: GameEvent) => void,
): void {
  const { checkpoint } = checkpointEntity;

  // Mark as activated
  checkpointEntity.isActivated = true;
  checkpointEntity.activationTime = currentTime;

  // Update state
  state.activeCheckpointIndex = checkpoint.areaIndex;
  state.lastActivatedCheckpointId = checkpoint.id;
  state.checkpointActivationTimes.set(checkpoint.id, currentTime);
  state.respawnPosition = { ...checkpoint.position };
  state.respawnRotation = checkpoint.rotation;

  // Dispatch event
  dispatch({
    type: "checkpoint",
    index: checkpoint.areaIndex,
    checkpointId: checkpoint.id,
  });

  // Play checkpoint sound (handled by audio system)
}

// ============================================
// Respawn Functions
// ============================================

/**
 * Get the current respawn point
 */
export function getRespawnPoint(state: CheckpointState): {
  position: Vector2D;
  rotation: number;
} {
  return {
    position: state.respawnPosition,
    rotation: state.respawnRotation,
  };
}

/**
 * Respawn cart at last checkpoint
 */
export function respawnAtCheckpoint(
  cart: Matter.Composite,
  state: CheckpointState,
): void {
  const cartBody = cart.bodies.find((b) => b.label === "cart_body");
  const leftWheel = cart.bodies.find((b) => b.label === "cart_wheel_left");
  const rightWheel = cart.bodies.find((b) => b.label === "cart_wheel_right");

  if (!cartBody || !leftWheel || !rightWheel) {
    return;
  }

  const { position, rotation } = getRespawnPoint(state);
  const angleRad = (rotation * Math.PI) / 180;

  // Reset cart body
  Matter.Body.setPosition(cartBody, position);
  Matter.Body.setAngle(cartBody, angleRad);
  Matter.Body.setVelocity(cartBody, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(cartBody, 0);

  // Reset wheels relative to cart body
  const wheelOffsetX = 12; // Half of wheelbase
  const wheelOffsetY = 10; // Below cart body center

  const leftWheelPos = {
    x:
      position.x -
      wheelOffsetX * Math.cos(angleRad) -
      wheelOffsetY * Math.sin(angleRad),
    y:
      position.y -
      wheelOffsetX * Math.sin(angleRad) +
      wheelOffsetY * Math.cos(angleRad),
  };

  const rightWheelPos = {
    x:
      position.x +
      wheelOffsetX * Math.cos(angleRad) -
      wheelOffsetY * Math.sin(angleRad),
    y:
      position.y +
      wheelOffsetX * Math.sin(angleRad) +
      wheelOffsetY * Math.cos(angleRad),
  };

  Matter.Body.setPosition(leftWheel, leftWheelPos);
  Matter.Body.setAngle(leftWheel, angleRad);
  Matter.Body.setVelocity(leftWheel, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(leftWheel, 0);

  Matter.Body.setPosition(rightWheel, rightWheelPos);
  Matter.Body.setAngle(rightWheel, angleRad);
  Matter.Body.setVelocity(rightWheel, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(rightWheel, 0);
}

/**
 * Start respawn animation
 */
export function startRespawn(
  state: CheckpointState,
  currentTime: number,
): void {
  state.isRespawning = true;
  state.respawnStartTime = currentTime;
}

/**
 * Check if respawn is complete
 */
export function isRespawnComplete(
  state: CheckpointState,
  currentTime: number,
  respawnDuration: number = 1000,
): boolean {
  if (!state.isRespawning) {
    return true;
  }

  const elapsed = currentTime - state.respawnStartTime;
  return elapsed >= respawnDuration;
}

/**
 * Complete respawn
 */
export function completeRespawn(state: CheckpointState): void {
  state.isRespawning = false;
  state.respawnStartTime = 0;
}

// ============================================
// Checkpoint Progress
// ============================================

/**
 * Get checkpoint completion percentage
 */
export function getCheckpointProgress(state: CheckpointState): number {
  if (state.totalCheckpoints === 0) return 0;
  return (state.checkpointActivationTimes.size / state.totalCheckpoints) * 100;
}

/**
 * Check if all checkpoints have been reached
 */
export function areAllCheckpointsReached(state: CheckpointState): boolean {
  return state.checkpointActivationTimes.size >= state.totalCheckpoints;
}

/**
 * Get list of unreached checkpoint indices
 */
export function getUnreachedCheckpoints(
  state: CheckpointState,
  checkpoints: Checkpoint[],
): number[] {
  const unreached: number[] = [];

  checkpoints.forEach((checkpoint, index) => {
    if (!state.checkpointActivationTimes.has(checkpoint.id)) {
      unreached.push(index);
    }
  });

  return unreached;
}

// ============================================
// Reset Functions
// ============================================

/**
 * Reset all checkpoints (for course restart)
 */
export function resetAllCheckpoints(
  checkpointEntities: Map<string, CheckpointEntity>,
  state: CheckpointState,
  initialCheckpoint: Checkpoint | null,
): void {
  // Reset all checkpoint entities
  checkpointEntities.forEach((entity) => {
    entity.isActivated = false;
    entity.activationTime = undefined;
  });

  // Reset state
  state.activeCheckpointIndex = 0;
  state.lastActivatedCheckpointId = initialCheckpoint?.id ?? null;
  state.checkpointActivationTimes.clear();
  state.respawnPosition = initialCheckpoint?.position ?? { x: 100, y: 7880 };
  state.respawnRotation = initialCheckpoint?.rotation ?? 0;
  state.isRespawning = false;
  state.respawnStartTime = 0;

  // Activate first checkpoint immediately
  if (initialCheckpoint) {
    const firstCheckpoint = checkpointEntities.get(initialCheckpoint.id);
    if (firstCheckpoint) {
      firstCheckpoint.isActivated = true;
      state.checkpointActivationTimes.set(initialCheckpoint.id, Date.now());
    }
  }
}
