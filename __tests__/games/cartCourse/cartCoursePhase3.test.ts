/**
 * Cart Course Phase 3 Tests
 * Tests for mechanisms: rotating gears, lift platforms, joystick gears, and touch controls
 */

import Matter from "matter-js";
import {
  BUTTON_CONFIG,
  JOYSTICK_CONFIG,
  MECHANISM_CONFIG,
  TOUCH_ZONES,
} from "../../../src/components/games/CartCourse/data/constants";
import {
  createJoystickGear,
  resetJoystickGear,
  updateJoystickGear,
} from "../../../src/components/games/CartCourse/mechanisms/JoystickGear";
import {
  createLiftPlatform,
  isCartOnLiftPlatform,
  resetLiftPlatform,
  updateLiftPlatform,
} from "../../../src/components/games/CartCourse/mechanisms/LiftPlatform";
import {
  createRotatingGear,
  removeRotatingGear,
  resetRotatingGear,
  updateRotatingGear,
} from "../../../src/components/games/CartCourse/mechanisms/RotatingGear";
import {
  MechanismSystem,
  getAllMechanismPlatforms,
} from "../../../src/components/games/CartCourse/systems/MechanismSystem";
import {
  InputState,
  JoystickInput,
  MechanismControlType,
  MechanismType,
} from "../../../src/components/games/CartCourse/types/cartCourse.types";

// ============================================
// Test Utilities
// ============================================

/**
 * Creates a mock Matter.js world for testing
 */
function createMockWorld(): Matter.World {
  const engine = Matter.Engine.create();
  return engine.world;
}

/**
 * Creates a mock input state for testing
 */
function createMockInputState(overrides: Partial<InputState> = {}): InputState {
  return {
    tilt: { x: 0, y: 0, pitch: 0, roll: 0 },
    leftButton: false,
    rightButton: false,
    isBlowing: false,
    leftJoystick: { angle: 0, magnitude: 0 },
    rightJoystick: { angle: 0, magnitude: 0 },
    ...overrides,
  };
}

/**
 * Creates a mock joystick input
 */
function createMockJoystickInput(x: number = 0, y: number = 0): JoystickInput {
  const magnitude = Math.sqrt(x * x + y * y);
  const angle = Math.atan2(y, x) * (180 / Math.PI);
  return { angle, magnitude: Math.min(magnitude, 1), x, y };
}

// ============================================
// Mechanism Configuration Tests
// ============================================

describe("Mechanism Configuration (Phase 3)", () => {
  test("rotating gear config has all required properties", () => {
    const config = MECHANISM_CONFIG.rotatingGear;
    expect(config.defaultRotationSpeed).toBeDefined();
    expect(config.defaultRotationSpeed).toBeGreaterThan(0);
    expect(config.gearRadius).toBeDefined();
    expect(config.platformWidth).toBeDefined();
    expect(config.returnToNeutral).toBeDefined();
  });

  test("lift platform config has all required properties", () => {
    const config = MECHANISM_CONFIG.liftPlatform;
    expect(config.defaultMoveSpeed).toBeDefined();
    expect(config.defaultMoveSpeed).toBeGreaterThan(0);
    expect(config.defaultReturnSpeed).toBeDefined();
    expect(config.defaultLiftHeight).toBeDefined();
    expect(config.platformWidth).toBeDefined();
    expect(config.platformHeight).toBeDefined();
    expect(config.holdToMaintain).toBeDefined();
  });

  test("joystick gear config has all required properties", () => {
    const config = MECHANISM_CONFIG.joystickGear;
    expect(config.defaultRotationSpeed).toBeDefined();
    expect(config.maxRotation).toBeDefined();
    expect(config.armLength).toBeDefined();
    expect(config.deadzone).toBeDefined();
    expect(config.deadzone).toBeGreaterThan(0);
    expect(config.deadzone).toBeLessThan(1);
    expect(config.returnToNeutral).toBeDefined();
    expect(config.returnSpeed).toBeDefined();
  });
});

// ============================================
// Touch Zone Tests
// ============================================

describe("Touch Zone Configuration (Phase 3)", () => {
  test("touch zones are defined for all controls", () => {
    expect(TOUCH_ZONES.leftButton).toBeDefined();
    expect(TOUCH_ZONES.rightButton).toBeDefined();
    expect(TOUCH_ZONES.leftJoystick).toBeDefined();
    expect(TOUCH_ZONES.rightJoystick).toBeDefined();
    expect(TOUCH_ZONES.blowButton).toBeDefined();
  });

  test("touch zones have required properties", () => {
    Object.values(TOUCH_ZONES).forEach((zone) => {
      expect(zone.id).toBeDefined();
      expect(zone.x).toBeDefined();
      expect(zone.y).toBeDefined();
      expect(zone.width).toBeDefined();
      expect(zone.height).toBeDefined();
      expect(zone.type).toBeDefined();
    });
  });

  test("buttons have correct type", () => {
    expect(TOUCH_ZONES.leftButton.type).toBe("button");
    expect(TOUCH_ZONES.rightButton.type).toBe("button");
    expect(TOUCH_ZONES.blowButton.type).toBe("button");
  });

  test("joysticks have correct type", () => {
    expect(TOUCH_ZONES.leftJoystick.type).toBe("joystick");
    expect(TOUCH_ZONES.rightJoystick.type).toBe("joystick");
  });
});

// ============================================
// Button Configuration Tests
// ============================================

describe("Button Configuration (Phase 3)", () => {
  test("button config has all required properties", () => {
    expect(BUTTON_CONFIG.size).toBeDefined();
    expect(BUTTON_CONFIG.size).toBeGreaterThan(0);
    expect(BUTTON_CONFIG.borderRadius).toBeDefined();
    expect(BUTTON_CONFIG.colors).toBeDefined();
    expect(BUTTON_CONFIG.colors.idle).toBeDefined();
    expect(BUTTON_CONFIG.colors.pressed).toBeDefined();
    expect(BUTTON_CONFIG.colors.border).toBeDefined();
  });

  test("button size is touch-friendly (at least 44px)", () => {
    expect(BUTTON_CONFIG.size).toBeGreaterThanOrEqual(44);
  });

  test("button has labels for all controls", () => {
    expect(BUTTON_CONFIG.labels).toBeDefined();
    expect(BUTTON_CONFIG.labels.left).toBeDefined();
    expect(BUTTON_CONFIG.labels.right).toBeDefined();
    expect(BUTTON_CONFIG.labels.blow).toBeDefined();
  });
});

// ============================================
// Joystick Configuration Tests
// ============================================

describe("Joystick Configuration (Phase 3)", () => {
  test("joystick config has all required properties", () => {
    expect(JOYSTICK_CONFIG.outerRadius).toBeDefined();
    expect(JOYSTICK_CONFIG.innerRadius).toBeDefined();
    expect(JOYSTICK_CONFIG.maxDisplacement).toBeDefined();
  });

  test("inner radius is smaller than outer radius", () => {
    expect(JOYSTICK_CONFIG.innerRadius).toBeLessThan(
      JOYSTICK_CONFIG.outerRadius,
    );
  });

  test("max displacement is within outer radius", () => {
    expect(JOYSTICK_CONFIG.maxDisplacement).toBeLessThanOrEqual(
      JOYSTICK_CONFIG.outerRadius,
    );
  });
});

// ============================================
// Rotating Gear Mechanism Tests
// ============================================

describe("Rotating Gear Mechanism (Phase 3)", () => {
  let world: Matter.World;

  beforeEach(() => {
    world = createMockWorld();
  });

  afterEach(() => {
    Matter.World.clear(world, false);
  });

  test("createRotatingGear creates mechanism with correct type", () => {
    const gear = createRotatingGear(
      {
        id: "test-gear-1",
        type: MechanismType.L_ROTATING_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    expect(gear).toBeDefined();
    expect(gear.id).toBe("test-gear-1");
    expect(gear.type).toBe(MechanismType.L_ROTATING_GEAR);
    expect(gear.config.controlType).toBe("left_button");
  });

  test("createRotatingGear initializes with neutral angle", () => {
    const gear = createRotatingGear(
      {
        id: "test-gear-2",
        type: MechanismType.L_ROTATING_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    expect(gear.currentAngle).toBe(0);
    expect(gear.targetAngle).toBe(0);
    expect(gear.state).toBe("idle");
  });

  test("createRotatingGear creates gear body", () => {
    const gear = createRotatingGear(
      {
        id: "test-gear-3",
        type: MechanismType.L_ROTATING_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    expect(gear.body).toBeDefined();
    expect(gear.body.isStatic).toBe(true);
  });

  test("createRotatingGear creates attached platform", () => {
    const gear = createRotatingGear(
      {
        id: "test-gear-4",
        type: MechanismType.L_ROTATING_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    expect(gear.attachedPlatform).toBeDefined();
    expect(gear.attachedPlatform!.isStatic).toBe(true);
  });

  test("updateRotatingGear rotates when button pressed", () => {
    const gear = createRotatingGear(
      {
        id: "test-gear-5",
        type: MechanismType.L_ROTATING_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    const isButtonHeld = true;
    const deltaTime = 16; // ~60fps in ms

    updateRotatingGear(gear, isButtonHeld, deltaTime);

    expect(gear.state).toBe("active");
    expect(gear.targetAngle).not.toBe(0);
  });

  test("updateRotatingGear returns to neutral when button released", () => {
    const gear = createRotatingGear(
      {
        id: "test-gear-6",
        type: MechanismType.L_ROTATING_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    // Press button to set targetAngle > 0
    updateRotatingGear(gear, true, 16);
    const initialTargetAngle = gear.targetAngle;
    expect(initialTargetAngle).toBeGreaterThan(0);

    // Release button - targetAngle should decrease toward 0
    updateRotatingGear(gear, false, 16);

    // Target angle should be reducing
    expect(gear.targetAngle).toBeLessThan(initialTargetAngle);
  });

  test("resetRotatingGear resets to initial state", () => {
    const gear = createRotatingGear(
      {
        id: "test-gear-8",
        type: MechanismType.L_ROTATING_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    gear.currentAngle = 45;
    gear.state = "active";

    resetRotatingGear(gear);

    expect(gear.currentAngle).toBe(0);
    expect(gear.targetAngle).toBe(0);
    expect(gear.state).toBe("idle");
  });

  test("removeRotatingGear removes bodies from world", () => {
    const gear = createRotatingGear(
      {
        id: "test-gear-9",
        type: MechanismType.L_ROTATING_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    const bodiesBeforeRemove = world.bodies.length;
    removeRotatingGear(gear, world);
    const bodiesAfterRemove = world.bodies.length;

    expect(bodiesAfterRemove).toBeLessThan(bodiesBeforeRemove);
  });

  test("L and R gears both rotate when their buttons are pressed", () => {
    const leftGear = createRotatingGear(
      {
        id: "left-gear",
        type: MechanismType.L_ROTATING_GEAR,
        x: 100,
        y: 300,
      },
      world,
    );

    const rightGear = createRotatingGear(
      {
        id: "right-gear",
        type: MechanismType.R_ROTATING_GEAR,
        x: 300,
        y: 300,
      },
      world,
    );

    updateRotatingGear(leftGear, true, 16);
    updateRotatingGear(rightGear, true, 16);

    // Both should be active and rotating
    expect(leftGear.state).toBe("active");
    expect(rightGear.state).toBe("active");
    expect(leftGear.targetAngle).toBeGreaterThan(0);
    expect(rightGear.targetAngle).toBeGreaterThan(0);
  });
});

// ============================================
// Lift Platform Mechanism Tests
// ============================================

describe("Lift Platform Mechanism (Phase 3)", () => {
  let world: Matter.World;

  beforeEach(() => {
    world = createMockWorld();
  });

  afterEach(() => {
    Matter.World.clear(world, false);
  });

  test("createLiftPlatform creates mechanism with correct type", () => {
    const lift = createLiftPlatform(
      {
        id: "test-lift-1",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    expect(lift).toBeDefined();
    expect(lift.id).toBe("test-lift-1");
    expect(lift.type).toBe(MechanismType.L_LIFT_PLATFORM);
  });

  test("createLiftPlatform initializes at base position", () => {
    const lift = createLiftPlatform(
      {
        id: "test-lift-2",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    expect(lift.currentLift).toBe(0);
    expect(lift.state).toBe("idle");
  });

  test("createLiftPlatform creates platform body", () => {
    const lift = createLiftPlatform(
      {
        id: "test-lift-3",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    expect(lift.platform).toBeDefined();
    expect(lift.platform.isStatic).toBe(true);
  });

  test("updateLiftPlatform lifts when button pressed", () => {
    const lift = createLiftPlatform(
      {
        id: "test-lift-4",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    const isButtonHeld = true;
    const deltaTime = 16;

    updateLiftPlatform(lift, isButtonHeld, deltaTime);

    expect(lift.state).toBe("active");
    expect(lift.currentLift).toBeGreaterThan(0);
  });

  test("updateLiftPlatform lowers when button released", () => {
    const lift = createLiftPlatform(
      {
        id: "test-lift-5",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    // Lift up first
    lift.currentLift = 0.5;
    lift.state = "active";

    const isButtonHeld = false;
    updateLiftPlatform(lift, isButtonHeld, 16);

    expect(lift.state).toBe("returning");
    expect(lift.currentLift).toBeLessThan(0.5);
  });

  test("updateLiftPlatform limits lift to max", () => {
    const lift = createLiftPlatform(
      {
        id: "test-lift-6",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
        liftHeight: 100,
      },
      world,
    );

    const isButtonHeld = true;

    // Simulate many frames
    for (let i = 0; i < 200; i++) {
      updateLiftPlatform(lift, isButtonHeld, 16);
    }

    expect(lift.currentLift).toBeLessThanOrEqual(1);
  });

  test("resetLiftPlatform resets to base position", () => {
    const lift = createLiftPlatform(
      {
        id: "test-lift-7",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    lift.currentLift = 0.75;
    lift.state = "active";

    resetLiftPlatform(lift);

    expect(lift.currentLift).toBe(0);
    expect(lift.state).toBe("idle");
  });
});

// ============================================
// Joystick Gear Mechanism Tests
// ============================================

describe("Joystick Gear Mechanism (Phase 3)", () => {
  let world: Matter.World;

  beforeEach(() => {
    world = createMockWorld();
  });

  afterEach(() => {
    Matter.World.clear(world, false);
  });

  test("createJoystickGear creates mechanism with correct type", () => {
    const gear = createJoystickGear(
      {
        id: "test-jgear-1",
        type: MechanismType.LEFT_STICK_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    expect(gear).toBeDefined();
    expect(gear.id).toBe("test-jgear-1");
    expect(gear.type).toBe(MechanismType.LEFT_STICK_GEAR);
    expect(gear.config.controlType).toBe("left_joystick");
  });

  test("createJoystickGear initializes at neutral angle", () => {
    const gear = createJoystickGear(
      {
        id: "test-jgear-2",
        type: MechanismType.LEFT_STICK_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    expect(gear.currentAngle).toBe(0);
    expect(gear.state).toBe("idle");
  });

  test("updateJoystickGear rotates based on joystick Y axis", () => {
    const gear = createJoystickGear(
      {
        id: "test-jgear-3",
        type: MechanismType.LEFT_STICK_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    const joystick = createMockJoystickInput(0, 1); // Full up
    const deltaTime = 16;

    updateJoystickGear(gear, joystick, deltaTime);

    expect(gear.state).toBe("active");
    // JoystickGear doesn't have targetAngle, only currentAngle which changes based on input
    expect(gear.currentAngle).not.toBe(0);
  });

  test("updateJoystickGear respects deadzone", () => {
    const gear = createJoystickGear(
      {
        id: "test-jgear-4",
        type: MechanismType.LEFT_STICK_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    // Input within deadzone (0.2)
    const joystick = createMockJoystickInput(0, 0.1);

    updateJoystickGear(gear, joystick, 16);

    // With deadzone, should stay at neutral angle or return toward 0
    expect(gear.currentAngle).toBe(0);
  });

  test("updateJoystickGear returns to neutral when joystick centered", () => {
    const gear = createJoystickGear(
      {
        id: "test-jgear-5",
        type: MechanismType.LEFT_STICK_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    // Set to rotated state
    gear.currentAngle = 45;
    gear.state = "active";

    const joystick = createMockJoystickInput(0, 0);

    updateJoystickGear(gear, joystick, 16);

    // State should be returning since we're moving back toward 0
    expect(gear.state).toBe("returning");
    // The currentAngle should be moving toward 0
    expect(gear.currentAngle).toBeLessThan(45);
  });

  test("updateJoystickGear respects max rotation", () => {
    const gear = createJoystickGear(
      {
        id: "test-jgear-6",
        type: MechanismType.LEFT_STICK_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    const maxRotation = MECHANISM_CONFIG.joystickGear.maxRotation;
    const joystick = createMockJoystickInput(0, 1); // Full up

    // Simulate many frames
    for (let i = 0; i < 100; i++) {
      updateJoystickGear(gear, joystick, 16);
    }

    expect(Math.abs(gear.currentAngle)).toBeLessThanOrEqual(maxRotation + 0.1);
  });

  test("resetJoystickGear resets to neutral", () => {
    const gear = createJoystickGear(
      {
        id: "test-jgear-7",
        type: MechanismType.LEFT_STICK_GEAR,
        x: 200,
        y: 300,
      },
      world,
    );

    gear.currentAngle = 60;
    gear.state = "active";

    resetJoystickGear(gear);

    expect(gear.currentAngle).toBe(0);
    expect(gear.state).toBe("idle");
  });
});

// ============================================
// Cart Attachment Detection Tests
// ============================================

describe("Cart Attachment Detection (Phase 3)", () => {
  let world: Matter.World;

  beforeEach(() => {
    world = createMockWorld();
  });

  afterEach(() => {
    Matter.World.clear(world, false);
  });

  test("getAllMechanismPlatforms returns all platforms", () => {
    const lift = createLiftPlatform(
      {
        id: "lift-1",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    const gear = createRotatingGear(
      {
        id: "gear-1",
        type: MechanismType.L_ROTATING_GEAR,
        x: 400,
        y: 400,
      },
      world,
    );

    const mechanisms = new Map<string, any>([
      ["lift-1", lift],
      ["gear-1", gear],
    ]);

    // getAllMechanismPlatforms expects GameEntities
    const mockEntities = {
      mechanisms,
      input: createMockInputState(),
      cart: { body: Matter.Bodies.rectangle(0, 0, 40, 20) },
    } as any;

    const platforms = getAllMechanismPlatforms(mockEntities);

    expect(platforms.length).toBe(2);
  });

  test("isCartOnLiftPlatform returns true when cart on platform", () => {
    const lift = createLiftPlatform(
      {
        id: "lift-detect",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    // Cart positioned on platform
    const cartBody = Matter.Bodies.rectangle(
      lift.platform.position.x,
      lift.platform.position.y - 15,
      40,
      20,
    );

    const result = isCartOnLiftPlatform(lift, cartBody);

    expect(result).toBe(true);
  });

  test("isCartOnLiftPlatform returns false when cart far from platform", () => {
    const lift = createLiftPlatform(
      {
        id: "lift-detect-2",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    // Cart positioned far away
    const cartBody = Matter.Bodies.rectangle(500, 100, 40, 20);

    const result = isCartOnLiftPlatform(lift, cartBody);

    expect(result).toBe(false);
  });
});

// ============================================
// Mechanism System Tests
// ============================================

describe("Mechanism System (Phase 3)", () => {
  let world: Matter.World;

  beforeEach(() => {
    world = createMockWorld();
  });

  afterEach(() => {
    Matter.World.clear(world, false);
  });

  test("MechanismSystem updates all mechanisms", () => {
    const lift = createLiftPlatform(
      {
        id: "sys-lift",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    const gear = createRotatingGear(
      {
        id: "sys-gear",
        type: MechanismType.L_ROTATING_GEAR,
        x: 400,
        y: 400,
      },
      world,
    );

    const mechanisms = new Map<string, any>([
      ["sys-lift", lift],
      ["sys-gear", gear],
    ]);

    const input = createMockInputState({ leftButton: true });

    // MechanismSystem expects GameEntities and { time: { delta } }
    const mockEntities = {
      mechanisms,
      input,
      cart: { body: Matter.Bodies.rectangle(0, 0, 40, 20) },
    } as any;

    MechanismSystem(mockEntities, {
      time: { delta: 16, current: 16, previous: 0 },
    } as any);

    // Both should be active since both use left button
    expect(lift.state).toBe("active");
    expect(gear.state).toBe("active");
  });

  test("MechanismSystem handles empty mechanisms map", () => {
    const mechanisms = new Map();
    const input = createMockInputState();

    // MechanismSystem expects GameEntities and { time: { delta } }
    const mockEntities = {
      mechanisms,
      input,
      cart: { body: Matter.Bodies.rectangle(0, 0, 40, 20) },
    } as any;

    // Should not throw
    expect(() => {
      MechanismSystem(mockEntities, {
        time: { delta: 16, current: 16, previous: 0 },
      } as any);
    }).not.toThrow();
  });

  test("MechanismSystem respects different control types", () => {
    const leftLift = createLiftPlatform(
      {
        id: "left-lift",
        type: MechanismType.L_LIFT_PLATFORM,
        x: 200,
        y: 400,
      },
      world,
    );

    const rightLift = createLiftPlatform(
      {
        id: "right-lift",
        type: MechanismType.R_LIFT_PLATFORM,
        x: 400,
        y: 400,
      },
      world,
    );

    const mechanisms = new Map<string, any>([
      ["left-lift", leftLift],
      ["right-lift", rightLift],
    ]);

    // Only press left button
    const input = createMockInputState({
      leftButton: true,
      rightButton: false,
    });

    // MechanismSystem expects GameEntities and { time: { delta } }
    const mockEntities = {
      mechanisms,
      input,
      cart: { body: Matter.Bodies.rectangle(0, 0, 40, 20) },
    } as any;

    MechanismSystem(mockEntities, {
      time: { delta: 16, current: 16, previous: 0 },
    } as any);

    expect(leftLift.state).toBe("active");
    expect(rightLift.state).toBe("idle");
  });
});

// ============================================
// Joystick Input Calculation Tests
// ============================================

describe("Joystick Input Calculations (Phase 3)", () => {
  test("createMockJoystickInput calculates correct magnitude", () => {
    const input = createMockJoystickInput(0.6, 0.8);
    expect(input.magnitude).toBeCloseTo(1.0, 1);
  });

  test("createMockJoystickInput caps magnitude at 1", () => {
    const input = createMockJoystickInput(1.0, 1.0);
    expect(input.magnitude).toBeLessThanOrEqual(1.0);
  });

  test("createMockJoystickInput calculates angle correctly", () => {
    // Right
    const rightInput = createMockJoystickInput(1, 0);
    expect(rightInput.angle).toBeCloseTo(0, 1);

    // Up (positive Y in screen coordinates)
    const upInput = createMockJoystickInput(0, 1);
    expect(upInput.angle).toBeCloseTo(90, 1);

    // Left
    const leftInput = createMockJoystickInput(-1, 0);
    expect(Math.abs(leftInput.angle)).toBeCloseTo(180, 1);

    // Down
    const downInput = createMockJoystickInput(0, -1);
    expect(downInput.angle).toBeCloseTo(-90, 1);
  });

  test("centered joystick has zero magnitude", () => {
    const input = createMockJoystickInput(0, 0);
    expect(input.magnitude).toBe(0);
  });
});

// ============================================
// Mechanism Type Enum Tests
// ============================================

describe("Mechanism Types (Phase 3)", () => {
  test("MechanismType enum has all required types", () => {
    expect(MechanismType.L_ROTATING_GEAR).toBeDefined();
    expect(MechanismType.R_ROTATING_GEAR).toBeDefined();
    expect(MechanismType.L_LIFT_PLATFORM).toBeDefined();
    expect(MechanismType.R_LIFT_PLATFORM).toBeDefined();
    expect(MechanismType.LEFT_STICK_GEAR).toBeDefined();
    expect(MechanismType.RIGHT_STICK_GEAR).toBeDefined();
    expect(MechanismType.RIGHT_STICK_TILT).toBeDefined();
    expect(MechanismType.FAN_PLATFORM).toBeDefined();
    expect(MechanismType.AUTO_ROTATE).toBeDefined();
    expect(MechanismType.AUTO_MOVE).toBeDefined();
    expect(MechanismType.CONVEYOR).toBeDefined();
  });

  test("MechanismControlType is a valid type", () => {
    // MechanismControlType is a type alias, not an enum
    // We test the valid values directly
    const validControlTypes: MechanismControlType[] = [
      "left_button",
      "right_button",
      "left_joystick",
      "right_joystick",
      "blow",
      "auto",
    ];

    validControlTypes.forEach((type) => {
      expect(typeof type).toBe("string");
    });
  });
});
