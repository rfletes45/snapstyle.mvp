/**
 * Tilt Gravity System
 * Modifies Matter.js gravity based on device tilt
 */

import { TILT_CONFIG } from "../data/constants";
import { GameEngineUpdateProps, GameEntities } from "../types/cartCourse.types";

// ============================================
// Tilt Gravity System
// ============================================

export const TiltGravitySystem = (
  entities: GameEntities,
  { input }: GameEngineUpdateProps,
): GameEntities => {
  const { engine } = entities.physics;
  const { tilt } = input;

  if (!tilt) {
    return entities;
  }

  // Base gravity (always pulling down)
  const baseGravityY = 1; // Normalized value for Matter.js

  // Apply device tilt to horizontal gravity
  // tilt.x is normalized to -1 to 1 based on device roll
  // Tilting device left (negative roll) should make cart roll left (negative x gravity)
  const tiltMultiplier = TILT_CONFIG.tiltMultiplier;

  // Calculate horizontal gravity from tilt
  const gravityX = tilt.x * baseGravityY * tiltMultiplier;

  // Update engine gravity
  engine.gravity.x = gravityX;
  engine.gravity.y = baseGravityY;

  return entities;
};

// ============================================
// Alternative: Direct Tilt to Force
// ============================================

// This alternative applies force directly to the cart
// instead of modifying global gravity
export const TiltForceSystem = (
  entities: GameEntities,
  { input }: GameEngineUpdateProps,
): GameEntities => {
  const { cart } = entities;
  const { tilt } = input;

  if (!tilt || !cart) {
    return entities;
  }

  // Calculate force based on tilt
  const forceMagnitude = 0.0001; // Tune this value
  const forceX = tilt.x * forceMagnitude;

  // Apply force to cart body
  const cartBody = cart.body;
  if (cartBody) {
    // Apply force at center of mass
    const force = { x: forceX, y: 0 };
    // Note: Matter.Body.applyForce would need to be imported from matter-js
    // Matter.Body.applyForce(cartBody, cartBody.position, force);
  }

  return entities;
};
