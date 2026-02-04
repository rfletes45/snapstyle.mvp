/**
 * Cart Course Phase 4 Tests
 * Tests for advanced mechanisms: launcher, fan platform, auto-rotate, conveyor, and blow detection
 */

// Mock expo-audio before any imports
jest.mock("expo-audio", () => ({
  requestRecordingPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: "granted", granted: true }),
  ),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  AudioRecorder: jest.fn().mockImplementation(() => ({
    prepareToRecordAsync: jest.fn(() => Promise.resolve()),
    startAsync: jest.fn(() => Promise.resolve()),
    stopAsync: jest.fn(() => Promise.resolve()),
    getStatusAsync: jest.fn(() =>
      Promise.resolve({ metering: -40, isRecording: true }),
    ),
    setOnRecordingStatusUpdate: jest.fn(),
    _onRecordingStatusUpdate: null,
  })),
  RecordingPresets: {
    HIGH_QUALITY: {
      android: {},
      ios: {},
    },
  },
  RecordingOptionsPresets: {
    HIGH_QUALITY: {
      android: {},
      ios: {},
    },
  },
}));

import Matter from "matter-js";
import { MECHANISM_CONFIG } from "../../../src/components/games/CartCourse/data/constants";
import {
  getBlowDetector,
  resetBlowDetector,
} from "../../../src/components/games/CartCourse/engine/BlowDetector";
import {
  createAutoRotate,
  resetAutoRotate,
} from "../../../src/components/games/CartCourse/mechanisms/AutoRotate";
import {
  createConveyor,
  resetConveyor,
} from "../../../src/components/games/CartCourse/mechanisms/Conveyor";
import {
  createFanPlatform,
  resetFanPlatform,
  updateFanPlatform,
} from "../../../src/components/games/CartCourse/mechanisms/FanPlatform";
import {
  createLauncherPlatform,
  resetLauncherPlatform,
  updateLauncherPlatform,
} from "../../../src/components/games/CartCourse/mechanisms/LauncherPlatform";
import {
  InputState,
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

// ============================================
// Phase 4 Mechanism Configuration Tests
// ============================================

describe("Phase 4 Configuration (Phase 4)", () => {
  test("launcher config has all required properties", () => {
    expect(MECHANISM_CONFIG.launcher).toBeDefined();
    expect(MECHANISM_CONFIG.launcher.maxLaunchForce).toBeDefined();
    expect(MECHANISM_CONFIG.launcher.chargeTime).toBeDefined();
    expect(MECHANISM_CONFIG.launcher.platformWidth).toBeDefined();
    expect(MECHANISM_CONFIG.launcher.platformHeight).toBeDefined();
  });

  test("fanPlatform config has all required properties", () => {
    expect(MECHANISM_CONFIG.fanPlatform).toBeDefined();
    expect(MECHANISM_CONFIG.fanPlatform.defaultLiftSpeed).toBeDefined();
    expect(MECHANISM_CONFIG.fanPlatform.defaultLiftHeight).toBeDefined();
    expect(MECHANISM_CONFIG.fanPlatform.platformWidth).toBeDefined();
    expect(MECHANISM_CONFIG.fanPlatform.platformHeight).toBeDefined();
  });

  test("autoRotate config has all required properties", () => {
    expect(MECHANISM_CONFIG.autoRotate).toBeDefined();
    expect(MECHANISM_CONFIG.autoRotate.defaultRotationSpeed).toBeDefined();
    expect(MECHANISM_CONFIG.autoRotate.defaultActivationRadius).toBeDefined();
    expect(MECHANISM_CONFIG.autoRotate.platformWidth).toBeDefined();
  });

  test("conveyor config has all required properties", () => {
    expect(MECHANISM_CONFIG.conveyor).toBeDefined();
    expect(MECHANISM_CONFIG.conveyor.defaultSpeed).toBeDefined();
    expect(MECHANISM_CONFIG.conveyor.defaultWidth).toBeDefined();
    expect(MECHANISM_CONFIG.conveyor.defaultHeight).toBeDefined();
  });
});

// ============================================
// Launcher Platform Tests (Phase 4)
// ============================================

describe("Launcher Platform Mechanism (Phase 4)", () => {
  let world: Matter.World;

  beforeEach(() => {
    world = createMockWorld();
  });

  afterEach(() => {
    Matter.World.clear(world, false);
  });

  test("createLauncherPlatform creates mechanism with correct type", () => {
    const launcher = createLauncherPlatform(
      {
        id: "launcher_1",
        x: 200,
        y: 300,
        type: MechanismType.R_LAUNCHER,
      },
      world,
    );

    expect(launcher).toBeDefined();
    expect(launcher.type).toBe(MechanismType.R_LAUNCHER);
  });

  test("createLauncherPlatform initializes with zero charge", () => {
    const launcher = createLauncherPlatform(
      {
        id: "launcher_1",
        x: 200,
        y: 300,
        type: MechanismType.R_LAUNCHER,
      },
      world,
    );

    expect(launcher.chargeLevel).toBe(0);
    expect(launcher.isCharging).toBe(false);
  });

  test("createLauncherPlatform creates platform body", () => {
    const launcher = createLauncherPlatform(
      {
        id: "launcher_1",
        x: 200,
        y: 300,
        type: MechanismType.R_LAUNCHER,
      },
      world,
    );

    expect(launcher.platform).toBeDefined();
    expect(launcher.platform.position.x).toBe(200);
    expect(launcher.platform.position.y).toBe(300);
  });

  test("updateLauncherPlatform charges when button held", () => {
    const launcher = createLauncherPlatform(
      {
        id: "launcher_1",
        x: 200,
        y: 300,
        type: MechanismType.R_LAUNCHER,
      },
      world,
    );

    // Simulate 500ms button hold
    updateLauncherPlatform(launcher, true, 500);

    expect(launcher.isCharging).toBe(true);
    expect(launcher.chargeLevel).toBeGreaterThan(0);
  });

  test("updateLauncherPlatform stops charging when button released", () => {
    const launcher = createLauncherPlatform(
      {
        id: "launcher_1",
        x: 200,
        y: 300,
        type: MechanismType.R_LAUNCHER,
      },
      world,
    );

    // Charge first
    updateLauncherPlatform(launcher, true, 500);
    expect(launcher.chargeLevel).toBeGreaterThan(0);

    // Release - transition state
    updateLauncherPlatform(launcher, false, 100);
    expect(launcher.state).toBe("transitioning");
  });

  test("resetLauncherPlatform resets to initial state", () => {
    const launcher = createLauncherPlatform(
      {
        id: "launcher_1",
        x: 200,
        y: 300,
        type: MechanismType.R_LAUNCHER,
      },
      world,
    );

    // Charge first
    updateLauncherPlatform(launcher, true, 500);

    resetLauncherPlatform(launcher);

    expect(launcher.chargeLevel).toBe(0);
    expect(launcher.isCharging).toBe(false);
    expect(launcher.state).toBe("idle");
  });
});

// ============================================
// Fan Platform Tests (Phase 4)
// ============================================

describe("Fan Platform Mechanism (Phase 4)", () => {
  let world: Matter.World;

  beforeEach(() => {
    world = createMockWorld();
  });

  afterEach(() => {
    Matter.World.clear(world, false);
  });

  test("createFanPlatform creates mechanism with correct type", () => {
    const fan = createFanPlatform(
      {
        id: "fan_1",
        x: 200,
        y: 300,
        type: MechanismType.FAN_PLATFORM,
      },
      world,
    );

    expect(fan).toBeDefined();
    expect(fan.type).toBe(MechanismType.FAN_PLATFORM);
  });

  test("createFanPlatform initializes at base position", () => {
    const fan = createFanPlatform(
      {
        id: "fan_1",
        x: 200,
        y: 300,
        type: MechanismType.FAN_PLATFORM,
      },
      world,
    );

    expect(fan.currentLift).toBe(0);
    expect(fan.platform.position.y).toBe(300);
  });

  test("createFanPlatform creates platform body", () => {
    const fan = createFanPlatform(
      {
        id: "fan_1",
        x: 200,
        y: 300,
        type: MechanismType.FAN_PLATFORM,
      },
      world,
    );

    expect(fan.platform).toBeDefined();
    expect(fan.platform.isStatic).toBe(true);
  });

  test("updateFanPlatform lifts when blowing", () => {
    const fan = createFanPlatform(
      {
        id: "fan_1",
        x: 200,
        y: 300,
        type: MechanismType.FAN_PLATFORM,
        liftHeight: 100,
      },
      world,
    );

    updateFanPlatform(fan, true, 500);

    expect(fan.currentLift).toBeGreaterThan(0);
    // Platform should move up (lower Y)
    expect(fan.platform.position.y).toBeLessThan(300);
  });

  test("resetFanPlatform resets to base position", () => {
    const fan = createFanPlatform(
      {
        id: "fan_1",
        x: 200,
        y: 300,
        type: MechanismType.FAN_PLATFORM,
      },
      world,
    );

    updateFanPlatform(fan, true, 1000);

    resetFanPlatform(fan);
    expect(fan.currentLift).toBe(0);
    expect(fan.state).toBe("idle");
  });
});

// ============================================
// Auto Rotate Tests (Phase 4)
// ============================================

describe("Auto Rotate Mechanism (Phase 4)", () => {
  let world: Matter.World;

  beforeEach(() => {
    world = createMockWorld();
  });

  afterEach(() => {
    Matter.World.clear(world, false);
  });

  test("createAutoRotate creates mechanism with correct type", () => {
    const autoRotate = createAutoRotate(
      {
        id: "auto_rotate_1",
        x: 200,
        y: 300,
        type: MechanismType.AUTO_ROTATE,
      },
      world,
    );

    expect(autoRotate).toBeDefined();
    expect(autoRotate.type).toBe(MechanismType.AUTO_ROTATE);
  });

  test("createAutoRotate initializes in idle state", () => {
    const autoRotate = createAutoRotate(
      {
        id: "auto_rotate_1",
        x: 200,
        y: 300,
        type: MechanismType.AUTO_ROTATE,
      },
      world,
    );

    expect(autoRotate.state).toBe("idle");
    expect(autoRotate.currentAngle).toBe(0);
    expect(autoRotate.isTriggered).toBe(false);
  });

  test("createAutoRotate creates platform body", () => {
    const autoRotate = createAutoRotate(
      {
        id: "auto_rotate_1",
        x: 200,
        y: 300,
        type: MechanismType.AUTO_ROTATE,
      },
      world,
    );

    expect(autoRotate.platform).toBeDefined();
    expect(autoRotate.platform.position.x).toBe(200);
  });

  test("resetAutoRotate resets to initial state", () => {
    const autoRotate = createAutoRotate(
      {
        id: "auto_rotate_1",
        x: 200,
        y: 300,
        type: MechanismType.AUTO_ROTATE,
      },
      world,
    );

    // Simulate trigger
    autoRotate.isTriggered = true;
    autoRotate.state = "active";
    autoRotate.currentAngle = 45;

    resetAutoRotate(autoRotate);

    expect(autoRotate.isTriggered).toBe(false);
    expect(autoRotate.state).toBe("idle");
    expect(autoRotate.currentAngle).toBe(0);
  });
});

// ============================================
// Conveyor Tests (Phase 4)
// ============================================

describe("Conveyor Mechanism (Phase 4)", () => {
  let world: Matter.World;

  beforeEach(() => {
    world = createMockWorld();
  });

  afterEach(() => {
    Matter.World.clear(world, false);
  });

  test("createConveyor creates mechanism with correct type", () => {
    const conveyor = createConveyor(
      {
        id: "conveyor_1",
        x: 200,
        y: 300,
        type: MechanismType.CONVEYOR,
      },
      world,
    );

    expect(conveyor).toBeDefined();
    expect(conveyor.type).toBe(MechanismType.CONVEYOR);
  });

  test("createConveyor initializes with default speed", () => {
    const conveyor = createConveyor(
      {
        id: "conveyor_1",
        x: 200,
        y: 300,
        type: MechanismType.CONVEYOR,
      },
      world,
    );

    expect(conveyor.speed).toBeGreaterThan(0);
    expect(conveyor.isActive).toBe(true);
  });

  test("createConveyor creates belt body", () => {
    const conveyor = createConveyor(
      {
        id: "conveyor_1",
        x: 200,
        y: 300,
        type: MechanismType.CONVEYOR,
      },
      world,
    );

    expect(conveyor.belt).toBeDefined();
    expect(conveyor.belt.isStatic).toBe(true);
  });

  test("createConveyor respects custom direction", () => {
    const leftConveyor = createConveyor(
      {
        id: "conveyor_left",
        x: 200,
        y: 300,
        type: MechanismType.CONVEYOR,
        direction: "left",
      },
      world,
    );

    const rightConveyor = createConveyor(
      {
        id: "conveyor_right",
        x: 400,
        y: 300,
        type: MechanismType.CONVEYOR,
        direction: "right",
      },
      world,
    );

    expect(leftConveyor.direction).toBe("left");
    expect(rightConveyor.direction).toBe("right");
  });

  test("resetConveyor resets animation state", () => {
    const conveyor = createConveyor(
      {
        id: "conveyor_1",
        x: 200,
        y: 300,
        type: MechanismType.CONVEYOR,
      },
      world,
    );

    // Modify animation state
    conveyor.animationOffset = 100;
    conveyor.progress = 0.5;

    resetConveyor(conveyor);

    // Animation should reset but isActive stays as configured
    expect(conveyor.animationOffset).toBe(0);
    expect(conveyor.progress).toBe(0);
  });
});

// ============================================
// Blow Detector Tests (Phase 4)
// ============================================

describe("BlowDetector (Phase 4)", () => {
  beforeEach(() => {
    resetBlowDetector();
  });

  afterEach(() => {
    resetBlowDetector();
  });

  test("getBlowDetector returns singleton instance", () => {
    const detector1 = getBlowDetector();
    const detector2 = getBlowDetector();

    expect(detector1).toBe(detector2);
  });

  test("BlowDetector initializes with isBlowing false", () => {
    const detector = getBlowDetector();
    expect(detector.getIsBlowing()).toBe(false);
  });

  test("BlowDetector has tap state methods", () => {
    const detector = getBlowDetector();

    expect(typeof detector.setTapState).toBe("function");
    expect(typeof detector.setTapActive).toBe("function");
  });

  test("resetBlowDetector creates new detector", () => {
    const detector = getBlowDetector();

    // Reset
    resetBlowDetector();
    const newDetector = getBlowDetector();

    // Should be a different instance
    expect(newDetector).not.toBe(detector);
    expect(newDetector.getIsBlowing()).toBe(false);
  });

  test("setTapState(true) starts blowing state via callback", async () => {
    const detector = getBlowDetector();

    let blowState = false;
    await detector.start((isBlowing) => {
      blowState = isBlowing;
    });

    detector.setTapState(true);
    expect(blowState).toBe(true);
  });

  test("setTapState(false) stops blowing state via callback", async () => {
    const detector = getBlowDetector();

    let blowState = false;
    await detector.start((isBlowing) => {
      blowState = isBlowing;
    });

    detector.setTapState(true);
    expect(blowState).toBe(true);

    detector.setTapState(false);
    expect(blowState).toBe(false);
  });
});
