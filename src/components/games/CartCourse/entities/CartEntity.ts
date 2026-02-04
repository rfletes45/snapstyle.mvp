/**
 * Cart Entity Factory
 * Creates the cart composite with body and two wheels connected by constraints
 */

import Matter from "matter-js";
import {
  CART_COLLISION_FILTER,
  CART_HEIGHT,
  CART_WIDTH,
  DEFAULT_CART_CONFIG,
  MATERIALS,
  WHEEL_RADIUS,
} from "../data/constants";
import { CartEntity, CartState, Vector2D } from "../types/cartCourse.types";

// ============================================
// Initial Cart State
// ============================================

function createInitialCartState(position: Vector2D): CartState {
  return {
    position,
    rotation: 0,
    linearVelocity: { x: 0, y: 0 },
    angularVelocity: 0,
    isGrounded: false,
    isOnRamp: false,
    surfaceNormal: null,
    currentMechanism: null,
    leftWheelContact: false,
    rightWheelContact: false,
  };
}

// ============================================
// Cart Body Creation
// ============================================

export function createCartEntity(
  x: number,
  y: number,
  world: Matter.World,
): CartEntity {
  // Cart body (main chassis)
  const cartBody = Matter.Bodies.rectangle(
    x,
    y - WHEEL_RADIUS, // Offset so wheels touch ground
    CART_WIDTH,
    CART_HEIGHT,
    {
      label: "cart_body",
      friction: MATERIALS.cart.friction,
      frictionStatic: MATERIALS.cart.frictionStatic,
      frictionAir: MATERIALS.cart.frictionAir,
      restitution: MATERIALS.cart.restitution,
      density: MATERIALS.cart.density,
      collisionFilter: CART_COLLISION_FILTER,
    },
  );

  // Left wheel
  const leftWheelX = x - CART_WIDTH / 2 + WHEEL_RADIUS;
  const leftWheelY = y;
  const leftWheel = Matter.Bodies.circle(leftWheelX, leftWheelY, WHEEL_RADIUS, {
    label: "cart_wheel_left",
    friction: MATERIALS.wheel.friction,
    frictionStatic: MATERIALS.wheel.frictionStatic,
    frictionAir: MATERIALS.wheel.frictionAir,
    restitution: MATERIALS.wheel.restitution,
    density: MATERIALS.wheel.density,
    collisionFilter: CART_COLLISION_FILTER,
  });

  // Right wheel
  const rightWheelX = x + CART_WIDTH / 2 - WHEEL_RADIUS;
  const rightWheelY = y;
  const rightWheel = Matter.Bodies.circle(
    rightWheelX,
    rightWheelY,
    WHEEL_RADIUS,
    {
      label: "cart_wheel_right",
      friction: MATERIALS.wheel.friction,
      frictionStatic: MATERIALS.wheel.frictionStatic,
      frictionAir: MATERIALS.wheel.frictionAir,
      restitution: MATERIALS.wheel.restitution,
      density: MATERIALS.wheel.density,
      collisionFilter: CART_COLLISION_FILTER,
    },
  );

  // Connect wheels to body with constraints (axles)
  const leftAxle = Matter.Constraint.create({
    bodyA: cartBody,
    pointA: { x: -CART_WIDTH / 2 + WHEEL_RADIUS, y: CART_HEIGHT / 2 },
    bodyB: leftWheel,
    pointB: { x: 0, y: 0 },
    stiffness: 0.9,
    damping: 0.1,
    length: 0,
    render: {
      visible: false,
    },
  });

  const rightAxle = Matter.Constraint.create({
    bodyA: cartBody,
    pointA: { x: CART_WIDTH / 2 - WHEEL_RADIUS, y: CART_HEIGHT / 2 },
    bodyB: rightWheel,
    pointB: { x: 0, y: 0 },
    stiffness: 0.9,
    damping: 0.1,
    length: 0,
    render: {
      visible: false,
    },
  });

  // Create composite to group all cart parts
  const cartComposite = Matter.Composite.create({ label: "cart" });
  Matter.Composite.add(cartComposite, [
    cartBody,
    leftWheel,
    rightWheel,
    leftAxle,
    rightAxle,
  ]);

  // Add to world
  Matter.World.add(world, cartComposite);

  // Create cart entity
  const cartEntity: CartEntity = {
    composite: cartComposite,
    body: cartBody,
    leftWheel,
    rightWheel,
    state: createInitialCartState({ x, y }),
    config: DEFAULT_CART_CONFIG,
    renderer: "cart",
  };

  return cartEntity;
}

// ============================================
// Update Cart State from Physics
// ============================================

export function updateCartStateFromPhysics(cart: CartEntity): void {
  const { body, leftWheel, rightWheel, state } = cart;

  // Update position
  state.position.x = body.position.x;
  state.position.y = body.position.y;

  // Update rotation (convert from radians to degrees)
  state.rotation = (body.angle * 180) / Math.PI;

  // Update velocity
  state.linearVelocity.x = body.velocity.x;
  state.linearVelocity.y = body.velocity.y;

  // Update angular velocity
  state.angularVelocity = (body.angularVelocity * 180) / Math.PI;

  // Check wheel contacts (simplified - would need proper contact detection)
  // This is a placeholder - real implementation would use collision events
  state.leftWheelContact = leftWheel.speed < 0.1;
  state.rightWheelContact = rightWheel.speed < 0.1;

  // Update grounded state based on both wheels
  state.isGrounded = state.leftWheelContact || state.rightWheelContact;
}

// ============================================
// Reset Cart Position
// ============================================

export function resetCartPosition(
  cart: CartEntity,
  x: number,
  y: number,
  angle: number = 0,
): void {
  const { composite, body, leftWheel, rightWheel } = cart;

  // Calculate wheel positions relative to body
  const angleRad = (angle * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const leftOffset = {
    x: (-CART_WIDTH / 2 + WHEEL_RADIUS) * cos - (CART_HEIGHT / 2) * sin,
    y: (-CART_WIDTH / 2 + WHEEL_RADIUS) * sin + (CART_HEIGHT / 2) * cos,
  };

  const rightOffset = {
    x: (CART_WIDTH / 2 - WHEEL_RADIUS) * cos - (CART_HEIGHT / 2) * sin,
    y: (CART_WIDTH / 2 - WHEEL_RADIUS) * sin + (CART_HEIGHT / 2) * cos,
  };

  // Reset body
  Matter.Body.setPosition(body, { x, y: y - WHEEL_RADIUS });
  Matter.Body.setAngle(body, angleRad);
  Matter.Body.setVelocity(body, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(body, 0);

  // Reset wheels
  Matter.Body.setPosition(leftWheel, {
    x: x + leftOffset.x,
    y: y + leftOffset.y,
  });
  Matter.Body.setAngle(leftWheel, angleRad);
  Matter.Body.setVelocity(leftWheel, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(leftWheel, 0);

  Matter.Body.setPosition(rightWheel, {
    x: x + rightOffset.x,
    y: y + rightOffset.y,
  });
  Matter.Body.setAngle(rightWheel, angleRad);
  Matter.Body.setVelocity(rightWheel, { x: 0, y: 0 });
  Matter.Body.setAngularVelocity(rightWheel, 0);

  // Reset state
  cart.state = createInitialCartState({ x, y });
}

// ============================================
// Remove Cart from World
// ============================================

export function removeCartFromWorld(
  cart: CartEntity,
  world: Matter.World,
): void {
  Matter.World.remove(world, cart.composite);
}
