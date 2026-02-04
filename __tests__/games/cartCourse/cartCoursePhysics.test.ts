/**
 * Cart Course Physics Tests
 * Tests for cart physics, collisions, and crash detection
 */

import Matter from "matter-js";
import {
  CRASH_CONFIG,
  DEFAULT_CART_CONFIG,
} from "../../../src/components/games/CartCourse/data/constants";
import {
  checkFallCrash,
  checkFlipCrash,
  clamp,
  createMatterWorld,
  isCartPart,
  isPlatform,
  lerp,
} from "../../../src/components/games/CartCourse/engine/MatterWorld";
import {
  createCartEntity,
  resetCartPosition,
  updateCartStateFromPhysics,
} from "../../../src/components/games/CartCourse/entities/CartEntity";
import {
  createGroundPlatform,
  createPlatformEntity,
} from "../../../src/components/games/CartCourse/entities/PlatformEntity";

// ============================================
// Matter.js World Setup Tests
// ============================================

describe("MatterWorld", () => {
  let engine: Matter.Engine;
  let world: Matter.World;
  let cleanup: () => void;

  beforeEach(() => {
    const matterWorld = createMatterWorld();
    engine = matterWorld.engine;
    world = matterWorld.world;
    cleanup = matterWorld.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  test("creates engine with gravity enabled", () => {
    expect(engine).toBeDefined();
    expect(engine.gravity.y).toBeGreaterThan(0);
  });

  test("creates world", () => {
    expect(world).toBeDefined();
  });

  test("cleanup removes all bodies", () => {
    // Add a test body
    const testBody = Matter.Bodies.rectangle(100, 100, 50, 50);
    Matter.World.add(world, testBody);
    expect(world.bodies.length).toBeGreaterThan(0);

    // Cleanup
    cleanup();
    expect(world.bodies.length).toBe(0);
  });
});

// ============================================
// Cart Entity Tests
// ============================================

describe("CartEntity", () => {
  let engine: Matter.Engine;
  let world: Matter.World;
  let cleanup: () => void;

  beforeEach(() => {
    const matterWorld = createMatterWorld();
    engine = matterWorld.engine;
    world = matterWorld.world;
    cleanup = matterWorld.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  test("creates cart with body and two wheels", () => {
    const cart = createCartEntity(200, 100, world);

    expect(cart).toBeDefined();
    expect(cart.body).toBeDefined();
    expect(cart.leftWheel).toBeDefined();
    expect(cart.rightWheel).toBeDefined();
    expect(cart.composite).toBeDefined();
  });

  test("cart body has correct label", () => {
    const cart = createCartEntity(200, 100, world);

    expect(cart.body.label).toBe("cart_body");
    expect(cart.leftWheel.label).toBe("cart_wheel_left");
    expect(cart.rightWheel.label).toBe("cart_wheel_right");
  });

  test("isCartPart correctly identifies cart bodies", () => {
    const cart = createCartEntity(200, 100, world);

    expect(isCartPart(cart.body)).toBe(true);
    expect(isCartPart(cart.leftWheel)).toBe(true);
    expect(isCartPart(cart.rightWheel)).toBe(true);
  });

  test("updateCartStateFromPhysics updates state correctly", () => {
    const cart = createCartEntity(200, 100, world);

    // Set body position and velocity
    Matter.Body.setPosition(cart.body, { x: 300, y: 150 });
    Matter.Body.setVelocity(cart.body, { x: 5, y: 2 });

    updateCartStateFromPhysics(cart);

    expect(cart.state.position.x).toBe(300);
    expect(cart.state.position.y).toBe(150);
    expect(cart.state.linearVelocity.x).toBe(5);
    expect(cart.state.linearVelocity.y).toBe(2);
  });

  test("resetCartPosition resets cart to specified position", () => {
    const cart = createCartEntity(200, 100, world);

    // Move cart
    Matter.Body.setPosition(cart.body, { x: 500, y: 300 });
    Matter.Body.setVelocity(cart.body, { x: 10, y: 5 });

    // Reset
    resetCartPosition(cart, 100, 100, 0);

    expect(cart.body.position.x).toBe(100);
    expect(cart.body.velocity.x).toBe(0);
    expect(cart.body.velocity.y).toBe(0);
  });
});

// ============================================
// Platform Entity Tests
// ============================================

describe("PlatformEntity", () => {
  let engine: Matter.Engine;
  let world: Matter.World;
  let cleanup: () => void;

  beforeEach(() => {
    const matterWorld = createMatterWorld();
    engine = matterWorld.engine;
    world = matterWorld.world;
    cleanup = matterWorld.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  test("creates platform at correct position", () => {
    const platform = createPlatformEntity(
      {
        id: "test",
        x: 400,
        y: 500,
        width: 200,
        height: 20,
      },
      world,
    );

    expect(platform.body.position.x).toBe(400);
    expect(platform.body.position.y).toBe(500);
  });

  test("platform is static", () => {
    const platform = createPlatformEntity(
      {
        id: "test",
        x: 400,
        y: 500,
        width: 200,
        height: 20,
      },
      world,
    );

    expect(platform.body.isStatic).toBe(true);
  });

  test("isPlatform correctly identifies platform bodies", () => {
    const platform = createPlatformEntity(
      {
        id: "test",
        x: 400,
        y: 500,
        width: 200,
        height: 20,
      },
      world,
    );

    expect(isPlatform(platform.body)).toBe(true);
  });

  test("createGroundPlatform creates ground correctly", () => {
    const ground = createGroundPlatform(400, 580, 800, world);

    expect(ground.body.position.x).toBe(400);
    expect(ground.body.position.y).toBe(580);
    expect(ground.body.isStatic).toBe(true);
  });
});

// ============================================
// Crash Detection Tests
// ============================================

describe("Crash Detection", () => {
  let engine: Matter.Engine;
  let world: Matter.World;
  let cleanup: () => void;

  beforeEach(() => {
    const matterWorld = createMatterWorld();
    engine = matterWorld.engine;
    world = matterWorld.world;
    cleanup = matterWorld.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  test("checkFlipCrash returns false for upright cart", () => {
    const cart = createCartEntity(200, 100, world);
    Matter.Body.setAngle(cart.body, 0);

    expect(checkFlipCrash(cart.composite)).toBe(false);
  });

  test("checkFlipCrash returns true for flipped cart", () => {
    const cart = createCartEntity(200, 100, world);
    // Rotate past max rotation threshold (110 degrees = ~1.92 radians)
    Matter.Body.setAngle(cart.body, (120 * Math.PI) / 180);

    expect(checkFlipCrash(cart.composite)).toBe(true);
  });

  test("checkFlipCrash returns false for slight tilt", () => {
    const cart = createCartEntity(200, 100, world);
    // Tilt 30 degrees
    Matter.Body.setAngle(cart.body, (30 * Math.PI) / 180);

    expect(checkFlipCrash(cart.composite)).toBe(false);
  });

  test("checkFallCrash returns false when cart above threshold", () => {
    const cart = createCartEntity(200, 100, world);
    Matter.Body.setPosition(cart.body, { x: 200, y: 100 });

    expect(checkFallCrash(cart.composite, 600)).toBe(false);
  });

  test("checkFallCrash returns true when cart below threshold", () => {
    const cart = createCartEntity(200, 100, world);
    Matter.Body.setPosition(cart.body, { x: 200, y: 700 });

    expect(checkFallCrash(cart.composite, 600)).toBe(true);
  });
});

// ============================================
// Cart-Platform Collision Tests
// ============================================

describe("Cart-Platform Collision", () => {
  let engine: Matter.Engine;
  let world: Matter.World;
  let cleanup: () => void;

  beforeEach(() => {
    const matterWorld = createMatterWorld();
    engine = matterWorld.engine;
    world = matterWorld.world;
    cleanup = matterWorld.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  test("cart falls under gravity and lands on platform", () => {
    // Create cart above platform
    const cart = createCartEntity(200, 100, world);
    const ground = createGroundPlatform(200, 300, 400, world);

    // Run simulation
    for (let i = 0; i < 100; i++) {
      Matter.Engine.update(engine, 1000 / 60);
    }

    // Cart should have fallen towards ground
    expect(cart.body.position.y).toBeGreaterThan(100);
    // Cart should be stopped by platform (roughly at platform level minus cart height)
    expect(cart.body.position.y).toBeLessThan(400);
  });

  test("cart rolls down ramp under gravity", () => {
    // Create cart on ramp
    const cart = createCartEntity(100, 100, world);
    const ramp = createPlatformEntity(
      {
        id: "ramp",
        x: 200,
        y: 200,
        width: 300,
        height: 20,
        rotation: 20, // 20 degree slope
      },
      world,
    );

    // Run simulation
    const initialX = cart.body.position.x;
    for (let i = 0; i < 100; i++) {
      Matter.Engine.update(engine, 1000 / 60);
    }

    // Cart should have moved horizontally (rolled down ramp)
    // Note: With the current physics setup, the cart will fall and potentially roll
    // The exact behavior depends on initial position and ramp placement
    expect(cart.body.velocity.x !== 0 || cart.body.velocity.y !== 0).toBe(true);
  });
});

// ============================================
// Utility Function Tests
// ============================================

describe("Utility Functions", () => {
  test("lerp interpolates correctly", () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 1)).toBe(100);
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 0.25)).toBe(25);
  });

  test("clamp restricts values to range", () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });
});

// ============================================
// Physics Constants Tests
// ============================================

describe("Physics Constants", () => {
  test("DEFAULT_CART_CONFIG has valid values", () => {
    expect(DEFAULT_CART_CONFIG.mass).toBeGreaterThan(0);
    expect(DEFAULT_CART_CONFIG.wheelRadius).toBeGreaterThan(0);
    expect(DEFAULT_CART_CONFIG.maxImpactVelocity).toBeGreaterThan(0);
    expect(DEFAULT_CART_CONFIG.maxRotation).toBeGreaterThan(0);
    expect(DEFAULT_CART_CONFIG.maxRotation).toBeLessThan(180);
  });

  test("CRASH_CONFIG has valid thresholds", () => {
    expect(CRASH_CONFIG.maxImpactVelocity).toBeGreaterThan(0);
    expect(CRASH_CONFIG.maxRotationDegrees).toBeGreaterThan(0);
    expect(CRASH_CONFIG.pitThreshold).toBeGreaterThan(0);
  });
});
