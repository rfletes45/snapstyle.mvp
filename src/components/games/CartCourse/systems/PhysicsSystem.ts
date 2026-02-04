/**
 * Physics System
 * Updates Matter.js engine each frame
 */

import Matter from "matter-js";
import { updateCartStateFromPhysics } from "../entities/CartEntity";
import { GameEngineUpdateProps, GameEntities } from "../types/cartCourse.types";

// ============================================
// Physics System
// ============================================

export const PhysicsSystem = (
  entities: GameEntities,
  { time }: GameEngineUpdateProps,
): GameEntities => {
  const { engine } = entities.physics;

  // Clamp delta time to prevent spiral of death
  // If frame takes too long, physics can explode
  const maxDelta = 50; // Max 50ms (20fps minimum)
  const delta = Math.min(time.delta, maxDelta);

  // Update Matter.js engine
  // Using fixed timestep with accumulator would be better for production
  Matter.Engine.update(engine, delta);

  // Update cart state from physics bodies
  if (entities.cart) {
    updateCartStateFromPhysics(entities.cart);
  }

  // Return a new object reference to trigger React re-render
  // This is necessary because Matter.js mutates body positions in place
  return { ...entities };
};

// ============================================
// Fixed Timestep Physics (Alternative)
// ============================================

const FIXED_TIMESTEP = 1000 / 60; // 60 FPS
let accumulator = 0;

export const FixedTimestepPhysicsSystem = (
  entities: GameEntities,
  { time }: GameEngineUpdateProps,
): GameEntities => {
  const { engine } = entities.physics;

  // Accumulate time
  accumulator += time.delta;

  // Cap accumulator to prevent spiral of death
  const maxAccumulator = FIXED_TIMESTEP * 5;
  if (accumulator > maxAccumulator) {
    accumulator = maxAccumulator;
  }

  // Run physics in fixed timesteps
  while (accumulator >= FIXED_TIMESTEP) {
    Matter.Engine.update(engine, FIXED_TIMESTEP);
    accumulator -= FIXED_TIMESTEP;
  }

  // Update cart state from physics bodies
  if (entities.cart) {
    updateCartStateFromPhysics(entities.cart);
  }

  return entities;
};

// ============================================
// Reset Physics Accumulator
// ============================================

export function resetPhysicsAccumulator(): void {
  accumulator = 0;
}
