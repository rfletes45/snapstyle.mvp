# Cart Course - Tilt-Based Obstacle Course Game Plan

## Overview

**Game Type:** Single-Player Physics Puzzle/Obstacle Course
**Inspiration:** Nintendo Land - Donkey Kong's Crash Course
**Platform:** React Native / Expo with device accelerometer/gyroscope

### Technology Stack

| Package                      | Version | Purpose                                              |
| ---------------------------- | ------- | ---------------------------------------------------- |
| `matter-js`                  | ^0.19.0 | 2D physics engine (gravity, collisions, constraints) |
| `react-native-game-engine`   | ^1.2.0  | Entity-component game loop (60fps updates)           |
| `@shopify/react-native-skia` | ^1.0.0  | GPU-accelerated canvas rendering                     |
| `expo-sensors`               | ^14.x   | Accelerometer/gyroscope for tilt controls            |

```bash
# Already installed in project
npm install matter-js @types/matter-js react-native-game-engine @shopify/react-native-skia
```

---

## Table of Contents

1. [Game Concept](#1-game-concept)
2. [Core Mechanics](#2-core-mechanics)
3. [Physics System](#3-physics-system)
4. [Control Systems](#4-control-systems)
5. [Obstacle & Mechanism Types](#5-obstacle--mechanism-types)
6. [Course Design System](#6-course-design-system)
7. [Visual Design](#7-visual-design)
8. [Audio System](#8-audio-system)
9. [Progression & Scoring](#9-progression--scoring)
10. [Technical Implementation](#10-technical-implementation)
11. [Component Architecture](#11-component-architecture)
12. [Firebase Data Models](#12-firebase-data-models)
13. [Development Phases](#13-development-phases)

---

## 1. Game Concept

### Core Experience

A precision platforming game where players guide a fragile wheeled cart through intricate 2D obstacle courses by tilting their device. The cart must navigate ramps, platforms, mechanisms, and hazards to reach the goal without crashing.

### Key Features

- **Device Tilt Controls:** Primary movement via accelerometer/gyroscope
- **Multiple Input Methods:** Physical buttons, touch zones, and blowing (microphone) for different mechanisms
- **Fragile Cart:** Cart breaks on hard impacts, requiring precise control
- **Checkpoint System:** Multiple checkpoints per course, restart from last checkpoint on crash
- **Lives System:** 3 lives per course, full course reset when depleted
- **4 Courses:** 2 base courses + 2 harder variants with modified/missing elements
- **Time-Based Scoring:** Points based on completion time and collectibles

### Game Rules

- **3 Lives Per Course:** Lose a life on crash, restart at last checkpoint
- **10-Minute Timer:** Maximum time per course attempt
- **Points Grant Lives:** Extra life every 2000 points
- **Bananas & Coins:** Collectibles scattered throughout courses
- **Coins:** Appear when all preceding bananas collected

---

## 2. Core Mechanics

### 2.1 Cart Physics

```typescript
interface CartConfig {
  // Physical properties
  mass: number; // Affects momentum and gravity response
  wheelRadius: number; // Visual and collision
  wheelBase: number; // Distance between wheels
  maxAngularVelocity: number; // Max rotation speed

  // Movement limits
  maxLinearVelocity: number; // Terminal velocity
  gravity: number; // Gravity strength
  friction: number; // Surface friction coefficient
  airResistance: number; // Drag when airborne

  // Durability
  maxImpactVelocity: number; // Crash threshold for walls
  maxFallDistance: number; // Safe drop height
  maxRotation: number; // Flip threshold (degrees from upright)
}

const DEFAULT_CART_CONFIG: CartConfig = {
  mass: 1.0,
  wheelRadius: 8,
  wheelBase: 24,
  maxAngularVelocity: 720, // degrees/sec
  maxLinearVelocity: 400, // pixels/sec
  gravity: 980, // pixels/sec²
  friction: 0.3,
  airResistance: 0.02,
  maxImpactVelocity: 350, // Crash if hit wall faster than this
  maxFallDistance: 100, // Crash if fall more than this
  maxRotation: 110, // Crash if tilted more than this from vertical
};
```

### 2.2 Cart State

```typescript
interface CartState {
  // Position & rotation
  position: Vector2D; // Center of cart
  rotation: number; // Degrees, 0 = upright

  // Velocity
  linearVelocity: Vector2D; // Movement speed
  angularVelocity: number; // Rotation speed (deg/sec)

  // State flags
  isGrounded: boolean; // On a surface?
  isOnRamp: boolean; // On angled surface?
  surfaceNormal: Vector2D | null; // Surface angle if grounded
  currentMechanism: string | null; // Currently interacting mechanism

  // Visual
  leftWheelContact: boolean; // For animation
  rightWheelContact: boolean; // For animation
}
```

### 2.3 Crash Detection

```typescript
enum CrashType {
  WALL_IMPACT = "wall_impact", // Hit wall too hard
  FLOOR_IMPACT = "floor_impact", // Fell too far
  FLIP = "flip", // Rotated past threshold
  CRUSH = "crush", // Crushed by mechanism
  PIT = "pit", // Fell into bottomless pit
  STUCK = "stuck", // Wedged and can't escape
}

interface CrashEvent {
  type: CrashType;
  position: Vector2D;
  velocity: number;
  timestamp: number;
}

function detectCrash(
  cart: CartState,
  collision: CollisionResult | null,
  previousPosition: Vector2D,
): CrashEvent | null {
  // Check wall impact velocity
  if (collision?.type === "wall") {
    const impactVelocity = Vector2D.magnitude(cart.linearVelocity);
    if (impactVelocity > DEFAULT_CART_CONFIG.maxImpactVelocity) {
      return {
        type: CrashType.WALL_IMPACT,
        position: cart.position,
        velocity: impactVelocity,
        timestamp: Date.now(),
      };
    }
  }

  // Check fall distance
  const fallDistance = cart.position.y - previousPosition.y;
  if (fallDistance > DEFAULT_CART_CONFIG.maxFallDistance && !cart.isGrounded) {
    return {
      type: CrashType.FLOOR_IMPACT,
      position: cart.position,
      velocity: cart.linearVelocity.y,
      timestamp: Date.now(),
    };
  }

  // Check flip
  const normalizedRotation = normalizeAngle(cart.rotation);
  if (Math.abs(normalizedRotation) > DEFAULT_CART_CONFIG.maxRotation) {
    return {
      type: CrashType.FLIP,
      position: cart.position,
      velocity: 0,
      timestamp: Date.now(),
    };
  }

  // Check if in pit
  if (cart.position.y > courseHeight + PIT_THRESHOLD) {
    return {
      type: CrashType.PIT,
      position: cart.position,
      velocity: cart.linearVelocity.y,
      timestamp: Date.now(),
    };
  }

  return null;
}
```

---

## 3. Physics System (Matter.js)

### 3.1 Matter.js World Setup

```typescript
import Matter from "matter-js";

// Create Matter.js engine with gravity
const engine = Matter.Engine.create({
  gravity: { x: 0, y: 1 }, // Default downward gravity
  enableSleeping: false, // Keep all bodies active
});

const world = engine.world;

// Collision categories
const COLLISION_CATEGORIES = {
  CART: 0x0001,
  PLATFORM: 0x0002,
  WALL: 0x0004,
  MECHANISM: 0x0008,
  COLLECTIBLE: 0x0010,
  HAZARD: 0x0020,
  CHECKPOINT: 0x0040,
};

// Cart only collides with solid objects
const CART_COLLISION_FILTER = {
  category: COLLISION_CATEGORIES.CART,
  mask:
    COLLISION_CATEGORIES.PLATFORM |
    COLLISION_CATEGORIES.WALL |
    COLLISION_CATEGORIES.MECHANISM |
    COLLISION_CATEGORIES.HAZARD,
};
```

### 3.2 Cart Creation with Matter.js

```typescript
function createCartBody(x: number, y: number): Matter.Composite {
  // Cart is a composite: body + two wheels connected by constraints
  const cartBody = Matter.Bodies.rectangle(x, y, CART_WIDTH, CART_HEIGHT, {
    label: "cart_body",
    friction: 0.8,
    restitution: 0.1, // Low bounce
    collisionFilter: CART_COLLISION_FILTER,
  });

  const leftWheel = Matter.Bodies.circle(
    x - CART_WIDTH / 2 + WHEEL_RADIUS,
    y + CART_HEIGHT / 2,
    WHEEL_RADIUS,
    {
      label: "cart_wheel_left",
      friction: 0.9, // High friction for grip
      restitution: 0.05, // Very low bounce
      collisionFilter: CART_COLLISION_FILTER,
    },
  );

  const rightWheel = Matter.Bodies.circle(
    x + CART_WIDTH / 2 - WHEEL_RADIUS,
    y + CART_HEIGHT / 2,
    WHEEL_RADIUS,
    {
      label: "cart_wheel_right",
      friction: 0.9,
      restitution: 0.05,
      collisionFilter: CART_COLLISION_FILTER,
    },
  );

  // Connect wheels to body with constraints
  const leftAxle = Matter.Constraint.create({
    bodyA: cartBody,
    pointA: { x: -CART_WIDTH / 2 + WHEEL_RADIUS, y: CART_HEIGHT / 2 },
    bodyB: leftWheel,
    pointB: { x: 0, y: 0 },
    stiffness: 1,
    length: 0,
  });

  const rightAxle = Matter.Constraint.create({
    bodyA: cartBody,
    pointA: { x: CART_WIDTH / 2 - WHEEL_RADIUS, y: CART_HEIGHT / 2 },
    bodyB: rightWheel,
    pointB: { x: 0, y: 0 },
    stiffness: 1,
    length: 0,
  });

  const cart = Matter.Composite.create({ label: "cart" });
  Matter.Composite.add(cart, [
    cartBody,
    leftWheel,
    rightWheel,
    leftAxle,
    rightAxle,
  ]);
  Matter.World.add(world, cart);

  return cart;
}
```

### 3.3 Tilt-Based Gravity with Matter.js

```typescript
import { Accelerometer } from "expo-sensors";

class TiltGravityController {
  private baseGravity = { x: 0, y: 9.8 };
  private tiltMultiplier = 0.5;
  private smoothedTilt = { x: 0, y: 0 };
  private smoothingFactor = 0.15;

  start(engine: Matter.Engine): void {
    Accelerometer.setUpdateInterval(16); // ~60fps

    Accelerometer.addListener(({ x, y }) => {
      // Smooth the input
      this.smoothedTilt.x = lerp(this.smoothedTilt.x, x, this.smoothingFactor);
      this.smoothedTilt.y = lerp(this.smoothedTilt.y, y, this.smoothingFactor);

      // Apply tilt to gravity direction
      // Device tilt X affects horizontal gravity
      // Device tilt Y affects vertical gravity (for forward/back tilt)
      engine.gravity.x =
        this.smoothedTilt.x * this.baseGravity.y * this.tiltMultiplier;
      engine.gravity.y = this.baseGravity.y; // Always pull down
    });
  }

  calibrate(): void {
    // Reset smoothed tilt to treat current position as neutral
    this.smoothedTilt = { x: 0, y: 0 };
  }
}
```

### 3.4 Crash Detection with Matter.js

```typescript
// Listen for collision events
Matter.Events.on(engine, "collisionStart", (event) => {
  event.pairs.forEach((pair) => {
    const bodyA = pair.bodyA;
    const bodyB = pair.bodyB;

    // Check for cart collision
    if (isCartPart(bodyA) || isCartPart(bodyB)) {
      const cartPart = isCartPart(bodyA) ? bodyA : bodyB;
      const otherBody = isCartPart(bodyA) ? bodyB : bodyA;

      // Calculate impact velocity
      const relativeVelocity = Matter.Vector.sub(
        cartPart.velocity,
        otherBody.isStatic ? { x: 0, y: 0 } : otherBody.velocity,
      );
      const impactSpeed = Matter.Vector.magnitude(relativeVelocity);

      // Check for crash-inducing impact
      if (isHazard(otherBody)) {
        triggerCrash(CrashType.HAZARD, cartPart.position);
      } else if (impactSpeed > MAX_SAFE_IMPACT_VELOCITY) {
        triggerCrash(CrashType.WALL_IMPACT, cartPart.position);
      }

      // Check for checkpoint/collectible (sensors)
      if (isCheckpoint(otherBody)) {
        activateCheckpoint(otherBody.plugin.checkpointIndex);
      } else if (isCollectible(otherBody)) {
        collectItem(otherBody);
      }
    }
  });
});

// Check for flip crash each frame
function checkFlipCrash(cart: Matter.Composite): boolean {
  const cartBody = cart.bodies.find((b) => b.label === "cart_body");
  if (!cartBody) return false;

  // Normalize angle to -180 to 180
  const angle = ((((cartBody.angle * 180) / Math.PI) % 360) + 360) % 360;
  const normalizedAngle = angle > 180 ? angle - 360 : angle;

  // Crash if tilted more than threshold from upright
  return Math.abs(normalizedAngle) > MAX_ROTATION_DEGREES;
}

// Check for fall crash
function checkFallCrash(cart: Matter.Composite, maxY: number): boolean {
  const cartBody = cart.bodies.find((b) => b.label === "cart_body");
  return cartBody ? cartBody.position.y > maxY : false;
}
```

---

## 4. Control Systems

### 4.1 Primary Controls (Device Tilt)

```typescript
interface TiltControls {
  // Accelerometer/Gyroscope
  enabled: boolean;
  calibrationOffset: { pitch: number; roll: number };
  sensitivity: number; // 0.5 - 2.0
  invertX: boolean;
  invertY: boolean;

  // Smoothing
  smoothingEnabled: boolean;
  smoothingFrames: number; // Moving average window
}

// React Native implementation
import { Accelerometer, Gyroscope } from "expo-sensors";

class TiltController {
  private tiltHistory: { pitch: number; roll: number }[] = [];
  private subscription: Subscription | null = null;

  start(onTiltChange: (tilt: { pitch: number; roll: number }) => void): void {
    Accelerometer.setUpdateInterval(16); // ~60 FPS

    this.subscription = Accelerometer.addListener(({ x, y, z }) => {
      // Convert accelerometer to tilt angles
      const pitch = (Math.atan2(y, Math.sqrt(x * x + z * z)) * 180) / Math.PI;
      const roll = (Math.atan2(x, Math.sqrt(y * y + z * z)) * 180) / Math.PI;

      // Apply smoothing
      this.tiltHistory.push({ pitch, roll });
      if (this.tiltHistory.length > this.config.smoothingFrames) {
        this.tiltHistory.shift();
      }

      const smoothedTilt = this.getSmoothedTilt();
      onTiltChange(smoothedTilt);
    });
  }

  private getSmoothedTilt(): { pitch: number; roll: number } {
    const sum = this.tiltHistory.reduce(
      (acc, t) => ({ pitch: acc.pitch + t.pitch, roll: acc.roll + t.roll }),
      { pitch: 0, roll: 0 },
    );

    return {
      pitch: sum.pitch / this.tiltHistory.length,
      roll: sum.roll / this.tiltHistory.length,
    };
  }

  calibrate(): void {
    // Set current position as neutral
    const current = this.getSmoothedTilt();
    this.config.calibrationOffset = current;
  }
}
```

### 4.2 Mechanism Controls

```typescript
// Different input methods for different mechanisms
interface MechanismControls {
  // Button-based (L/R shoulder equivalent)
  leftButton: {
    touchZone: "left-side" | "bottom-left";
    mechanisms: ["l_gear", "l_platform", "l_launcher"];
  };

  rightButton: {
    touchZone: "right-side" | "bottom-right";
    mechanisms: ["r_gear", "r_platform", "r_launcher"];
  };

  // Joystick-based
  leftJoystick: {
    touchZone: "left-thumb";
    mechanisms: ["left_stick_gear", "left_stick_platform"];
    inputType: "rotation" | "direction";
  };

  rightJoystick: {
    touchZone: "right-thumb";
    mechanisms: ["right_stick_gear", "right_stick_tilt"];
    inputType: "rotation" | "direction";
  };

  // Microphone (blow detection)
  microphone: {
    mechanisms: ["fan_platform", "wind_lift"];
    alternativeButton: "x_button"; // For accessibility
    sensitivity: number;
  };
}

// Touch zone implementation
const TOUCH_ZONES = {
  "left-side": { x: 0, y: 0, width: "30%", height: "100%" },
  "right-side": { x: "70%", y: 0, width: "30%", height: "100%" },
  "bottom-left": { x: 0, y: "70%", width: "25%", height: "30%" },
  "bottom-right": { x: "75%", y: "70%", width: "25%", height: "30%" },
  "left-thumb": { x: "5%", y: "60%", width: "20%", height: "35%" },
  "right-thumb": { x: "75%", y: "60%", width: "20%", height: "35%" },
};
```

### 4.3 Blow Detection (Microphone)

```typescript
import { Audio } from "expo-av";

class BlowDetector {
  private recording: Audio.Recording | null = null;
  private isBlowing: boolean = false;
  private blowThreshold: number = 0.4; // 0-1 volume threshold

  async start(onBlowChange: (isBlowing: boolean) => void): Promise<void> {
    await Audio.requestPermissionsAsync();

    this.recording = new Audio.Recording();
    await this.recording.prepareToRecordAsync({
      android: {
        extension: ".m4a",
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
      },
      ios: {
        extension: ".m4a",
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MIN,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    });

    // Monitor audio levels
    this.recording.setOnRecordingStatusUpdate((status) => {
      if (status.metering !== undefined) {
        // Convert dB to 0-1 scale
        const normalizedVolume = Math.pow(10, status.metering / 20);
        const newIsBlowing = normalizedVolume > this.blowThreshold;

        if (newIsBlowing !== this.isBlowing) {
          this.isBlowing = newIsBlowing;
          onBlowChange(newIsBlowing);
        }
      }
    });

    await this.recording.startAsync();
  }
}
```

---

## 5. Obstacle & Mechanism Types

### 5.1 Static Obstacles

```typescript
enum StaticObstacleType {
  // Surfaces
  RAMP = "ramp", // Angled surface
  PLATFORM = "platform", // Flat surface
  STAIRS = "stairs", // Stepped surface
  BUMPER = "bumper", // Bouncy wall (saves from crash)

  // Hazards
  SPIKES = "spikes", // Instant crash
  PIT = "pit", // Bottomless fall
  NARROW_GAP = "narrow_gap", // Precision required
}

interface StaticObstacle {
  type: StaticObstacleType;
  position: Vector2D;
  size: { width: number; height: number };
  rotation: number;
  properties: {
    friction?: number;
    bounciness?: number;
    isFatal?: boolean;
  };
}
```

### 5.2 Interactive Mechanisms

```typescript
// Based on Donkey Kong's Crash Course mechanisms
enum MechanismType {
  // L/R Button Controlled
  L_ROTATING_GEAR = "l_rotating_gear", // Hold L to rotate gear
  R_ROTATING_GEAR = "r_rotating_gear", // Hold R to rotate gear
  L_LIFT_PLATFORM = "l_lift_platform", // Hold L to raise platform
  R_LAUNCHER = "r_launcher", // Hold R to charge, release to launch

  // Joystick Controlled
  LEFT_STICK_GEAR = "left_stick_gear", // Rotate left stick to rotate gear
  RIGHT_STICK_GEAR = "right_stick_gear", // Rotate right stick to rotate gear
  RIGHT_STICK_TILT = "right_stick_tilt", // Tilt right stick to tilt platform

  // Microphone/Blow Controlled
  FAN_PLATFORM = "fan_platform", // Blow to lift platform

  // Automatic (triggered by cart)
  AUTO_ROTATE = "auto_rotate", // Rotates when cart touches
  AUTO_MOVE = "auto_move", // Moves when cart touches
  CONVEYOR = "conveyor", // Moves cart automatically
}

interface Mechanism {
  id: string;
  type: MechanismType;
  position: Vector2D;

  // Visual
  sprites: string[]; // Animation frames
  currentFrame: number;

  // State
  state: "idle" | "active" | "transitioning";
  progress: number; // 0-1 for transitions

  // Configuration
  config: MechanismConfig;
}

interface MechanismConfig {
  // Common
  activationZone?: { x: number; y: number; width: number; height: number };

  // Rotation-based
  rotationRange?: { min: number; max: number };
  rotationSpeed?: number;
  returnToNeutral?: boolean;

  // Position-based
  startPosition?: Vector2D;
  endPosition?: Vector2D;
  moveSpeed?: number;

  // Launcher
  launchForce?: number;
  chargeTime?: number;

  // Platform attachment
  attachedPlatforms?: string[]; // Platform IDs that move with this
}
```

### 5.3 Mechanism Behaviors (Matter.js Implementation)

```typescript
import Matter from "matter-js";

// L/R Button Gear - Rotates platform while held using Matter.js constraint
class RotatingGearMechanism {
  body: Matter.Body;
  constraint: Matter.Constraint; // Pivot constraint
  attachedPlatform: Matter.Body;
  currentAngle: number = 0;
  targetAngle: number = 0;

  constructor(config: GearConfig) {
    // Create gear as static body (doesn't move, just rotates)
    this.body = Matter.Bodies.circle(config.x, config.y, config.radius, {
      isStatic: true,
      label: `gear_${config.id}`,
      collisionFilter: { mask: 0 }, // No collisions, visual only
    });

    // Create attached platform
    this.attachedPlatform = Matter.Bodies.rectangle(
      config.x + config.armLength,
      config.y,
      config.platformWidth,
      config.platformHeight,
      {
        isStatic: false,
        label: `platform_${config.id}`,
        friction: 0.9,
      },
    );

    // Pivot constraint - platform rotates around gear center
    this.constraint = Matter.Constraint.create({
      pointA: { x: config.x, y: config.y },
      bodyB: this.attachedPlatform,
      pointB: { x: -config.armLength, y: 0 },
      stiffness: 1,
      length: 0,
    });
  }

  update(isHeld: boolean, deltaTime: number): void {
    if (isHeld) {
      this.targetAngle = Math.min(
        this.targetAngle + this.config.rotationSpeed * deltaTime,
        this.config.maxAngle,
      );
    } else if (this.config.returnToNeutral) {
      this.targetAngle = lerp(this.targetAngle, 0, 0.1);
    }

    // Smoothly rotate toward target
    this.currentAngle = lerp(this.currentAngle, this.targetAngle, 0.2);

    // Update platform position based on rotation
    const angleRad = (this.currentAngle * Math.PI) / 180;
    const newX = this.config.x + Math.cos(angleRad) * this.config.armLength;
    const newY = this.config.y + Math.sin(angleRad) * this.config.armLength;

    Matter.Body.setPosition(this.attachedPlatform, { x: newX, y: newY });
    Matter.Body.setAngle(this.attachedPlatform, angleRad);
  }
}

// Joystick Gear - Rotation controlled by stick angle
class JoystickGearMechanism {
  body: Matter.Body;
  attachedPlatform: Matter.Body;
  currentAngle: number = 0;

  update(
    joystickInput: { angle: number; magnitude: number },
    deltaTime: number,
  ): void {
    if (joystickInput.magnitude > 0.2) {
      // Map joystick angle to gear rotation range
      const targetAngle =
        (joystickInput.angle / Math.PI) * this.config.maxAngle;
      this.currentAngle = lerp(
        this.currentAngle,
        targetAngle,
        this.config.rotationSpeed * deltaTime,
      );
    }

    // Update platform via rotation
    const angleRad = (this.currentAngle * Math.PI) / 180;
    const radius = this.config.armLength;

    Matter.Body.setPosition(this.attachedPlatform, {
      x: this.config.x + Math.cos(angleRad) * radius,
      y: this.config.y + Math.sin(angleRad) * radius,
    });
    Matter.Body.setAngle(this.attachedPlatform, angleRad);
  }
}

// R Launcher - Charge and launch using Matter.js impulse
class LauncherMechanism {
  platform: Matter.Body;
  chargeLevel: number = 0;
  isCharging: boolean = false;

  update(isHeld: boolean, deltaTime: number, cart: CartEntity): void {
    if (isHeld) {
      // Charge up
      this.chargeLevel = Math.min(
        1,
        this.chargeLevel + deltaTime / this.config.chargeTime,
      );
      this.isCharging = true;
    } else if (this.isCharging) {
      // Release - launch!
      this.launch(this.chargeLevel, cart);
      this.chargeLevel = 0;
      this.isCharging = false;
    }
  }

  private launch(power: number, cart: CartEntity): void {
    // Check if cart is on this platform
    const cartBody = cart.composite.bodies.find((b) => b.label === "cart_body");
    if (!cartBody) return;

    const distance = Matter.Vector.magnitude(
      Matter.Vector.sub(cartBody.position, this.platform.position),
    );

    if (distance < this.config.activationRadius) {
      // Apply impulse to cart
      const impulse = Matter.Vector.mult(
        this.config.launchDirection,
        this.config.maxLaunchForce * power,
      );

      Matter.Body.applyForce(cartBody, cartBody.position, impulse);
      playSound("launcher_fire");
    }
  }
}

// Fan Platform - Blow/tap to lift using Matter.js force
class FanPlatformMechanism {
  platform: Matter.Body;
  baseY: number;
  maxLiftY: number;
  currentLift: number = 0;

  constructor(config: FanConfig) {
    this.platform = Matter.Bodies.rectangle(
      config.x,
      config.y,
      config.width,
      config.height,
      {
        isStatic: true, // We control position directly
        label: `fan_platform_${config.id}`,
        friction: 0.8,
      },
    );
    this.baseY = config.y;
    this.maxLiftY = config.y - config.liftHeight;
  }

  update(isBlowing: boolean, deltaTime: number): void {
    if (isBlowing) {
      // Lift platform
      this.currentLift = Math.min(
        1,
        this.currentLift + this.config.liftSpeed * deltaTime,
      );
    } else {
      // Lower platform (slower descent)
      this.currentLift = Math.max(
        0,
        this.currentLift - this.config.liftSpeed * 0.5 * deltaTime,
      );
    }

    // Update platform position
    const newY = lerp(this.baseY, this.maxLiftY, this.currentLift);
    Matter.Body.setPosition(this.platform, {
      x: this.platform.position.x,
      y: newY,
    });
  }
}
```

````

---

## 6. Course Design System

### 6.1 Course Structure

```typescript
interface Course {
  id: string;
  name: string;
  theme: "classic" | "industrial" | "sky" | "underground";

  // Dimensions
  width: number; // Total course width in pixels
  height: number; // Total course height in pixels

  // Areas (like Donkey Kong's Crash Course areas 1-10)
  areas: Area[];

  // Visual layers
  backgroundLayers: BackgroundLayer[];
  foregroundLayers: ForegroundLayer[];

  // Camera
  cameraConfig: CameraConfig;

  // Difficulty
  difficulty: 1 | 2 | 3 | 4; // 1-2 normal, 3-4 hard variants
  parentCourseId?: string; // For hard variants
}

interface Area {
  id: string;
  areaNumber: number; // 1-10+ for display

  // Bounds
  bounds: { x: number; y: number; width: number; height: number };

  // Elements
  obstacles: StaticObstacle[];
  mechanisms: Mechanism[];
  collectibles: Collectible[];

  // Checkpoints
  checkpoint: Checkpoint;

  // Special properties
  scrollDirection: "vertical" | "horizontal" | "both";
  cameraZoom?: number;
}

interface Checkpoint {
  position: Vector2D;
  rotation: number; // Cart orientation at spawn
  areaIndex: number;
  flags?: {
    autoSave: boolean;
    showTransition: boolean;
  };
}
````

### 6.2 Camera System

```typescript
interface CameraConfig {
  // Follow behavior
  followMode: "centered" | "ahead" | "area-locked";
  followSmoothing: number; // 0-1, lower = more lag
  lookAheadDistance: number; // Pixels to look ahead of cart

  // Zoom
  defaultZoom: number; // 1.0 = normal
  zoomRange: { min: number; max: number };
  autoZoom: boolean; // Zoom based on velocity

  // Bounds
  deadZone: { x: number; y: number; width: number; height: number }; // Area where cart can move without camera moving
}

class CourseCamera {
  private position: Vector2D;
  private zoom: number;
  private targetPosition: Vector2D;

  update(cart: CartState, currentArea: Area, deltaTime: number): void {
    // Calculate target based on follow mode
    switch (this.config.followMode) {
      case "centered":
        this.targetPosition = cart.position;
        break;

      case "ahead":
        // Look ahead in movement direction
        const lookAhead = Vector2D.multiply(
          Vector2D.normalize(cart.linearVelocity),
          this.config.lookAheadDistance,
        );
        this.targetPosition = Vector2D.add(cart.position, lookAhead);
        break;

      case "area-locked":
        // Keep camera within current area bounds
        this.targetPosition = {
          x: clamp(
            cart.position.x,
            currentArea.bounds.x,
            currentArea.bounds.x + currentArea.bounds.width,
          ),
          y: clamp(
            cart.position.y,
            currentArea.bounds.y,
            currentArea.bounds.y + currentArea.bounds.height,
          ),
        };
        break;
    }

    // Apply dead zone
    const diff = Vector2D.subtract(this.targetPosition, this.position);
    if (Math.abs(diff.x) < this.config.deadZone.width / 2) {
      this.targetPosition.x = this.position.x;
    }
    if (Math.abs(diff.y) < this.config.deadZone.height / 2) {
      this.targetPosition.y = this.position.y;
    }

    // Smooth follow
    this.position = Vector2D.lerp(
      this.position,
      this.targetPosition,
      this.config.followSmoothing,
    );

    // Auto zoom based on velocity
    if (this.config.autoZoom) {
      const speed = Vector2D.magnitude(cart.linearVelocity);
      const speedRatio = speed / DEFAULT_CART_CONFIG.maxLinearVelocity;
      const targetZoom = lerp(
        this.config.zoomRange.max,
        this.config.zoomRange.min,
        speedRatio,
      );
      this.zoom = lerp(this.zoom, targetZoom, 0.05);
    }
  }
}
```

### 6.3 Course Templates

```typescript
// Course 1: Classic Introduction
const COURSE_1: Course = {
  id: "course_1",
  name: "The Classic Run",
  theme: "classic",
  width: 2400,
  height: 8000,
  difficulty: 1,

  areas: [
    // Area 1: Tutorial - Basic ramps with bumpers
    {
      id: "area_1",
      areaNumber: 1,
      bounds: { x: 0, y: 7200, width: 800, height: 800 },
      obstacles: [
        {
          type: "ramp",
          position: { x: 100, y: 7600 },
          size: { width: 200, height: 100 },
          rotation: -15,
        },
        {
          type: "bumper",
          position: { x: 500, y: 7500 },
          size: { width: 20, height: 100 },
          rotation: 0,
        },
        // ...more obstacles
      ],
      mechanisms: [],
      collectibles: [
        { type: "banana", position: { x: 150, y: 7550 } },
        { type: "banana", position: { x: 300, y: 7450 } },
      ],
      checkpoint: { position: { x: 100, y: 7300 }, rotation: 0, areaIndex: 0 },
      scrollDirection: "vertical",
    },

    // Area 2: First hill and stairs
    {
      id: "area_2",
      areaNumber: 2,
      bounds: { x: 0, y: 6400, width: 800, height: 800 },
      obstacles: [
        {
          type: "stairs",
          position: { x: 200, y: 6800 },
          size: { width: 300, height: 400 },
          rotation: 0,
        },
        // Steep hill requires aggressive tilt
      ],
      mechanisms: [
        {
          id: "mech_2_1",
          type: MechanismType.L_ROTATING_GEAR,
          position: { x: 600, y: 6600 },
          config: {
            rotationRange: { min: 0, max: 90 },
            rotationSpeed: 45,
            returnToNeutral: true,
            attachedPlatforms: ["plat_2_1"],
          },
        },
      ],
      // ...
    },

    // Area 3: First blow-controlled platform
    {
      id: "area_3",
      areaNumber: 3,
      bounds: { x: 0, y: 5600, width: 800, height: 800 },
      mechanisms: [
        {
          id: "mech_3_1",
          type: MechanismType.FAN_PLATFORM,
          position: { x: 400, y: 6000 },
          config: {
            startPosition: { x: 400, y: 6000 },
            endPosition: { x: 400, y: 5700 },
            moveSpeed: 100,
          },
        },
      ],
      // ...
    },

    // Area 4: Joystick gear introduction
    // Area 5: Fork in the road (left = more bananas, right = faster)
    // Area 6: Precise rotating platforms
    // Area 7: Vertical lift sequence
    // Area 8: Tilting platforms with right stick
    // Area 9: Launcher platforms
    // Area 10: Final descent with precision required

    // ... continue for all 10 areas
  ],

  // Camera configuration
  cameraConfig: {
    followMode: "ahead",
    followSmoothing: 0.08,
    lookAheadDistance: 100,
    defaultZoom: 1.0,
    zoomRange: { min: 0.8, max: 1.2 },
    autoZoom: true,
    deadZone: { x: 0, y: 0, width: 100, height: 150 },
  },
};

// Course 3: Hard variant of Course 1
const COURSE_3: Course = {
  ...COURSE_1,
  id: "course_3",
  name: "The Classic Run - Expert",
  difficulty: 3,
  parentCourseId: "course_1",

  // Modifications for hard mode:
  // - Some bumpers removed
  // - Platforms narrower
  // - Some mechanisms removed or behave differently
  // - Tighter timing required
  areas: COURSE_1.areas.map((area) => modifyAreaForHardMode(area)),
};
```

---

## 7. Visual Design

### 7.1 Art Style

```typescript
const VISUAL_STYLE = {
  // Donkey Kong arcade inspired with modern touches
  style: "pixel-modern-hybrid",

  // Color palette per theme
  themes: {
    classic: {
      background: "#1a1a2e", // Dark blue-black
      girders: "#d4a857", // Golden brown (like DK arcade)
      platforms: "#8b4513", // Saddle brown
      accents: "#ff6b6b", // Red accents
      text: "#ffffff",
    },
    industrial: {
      background: "#2d3436",
      girders: "#636e72",
      platforms: "#74b9ff",
      accents: "#fdcb6e",
      text: "#dfe6e9",
    },
  },

  // Cart appearance
  cart: {
    bodyColor: "#e74c3c", // Red cart body
    wheelColor: "#2c3e50", // Dark wheels
    highlightColor: "#f39c12", // Golden highlight
    size: { width: 32, height: 20 },
  },

  // Effects
  effects: {
    dustParticles: true,
    sparkOnImpact: true,
    trailEffect: true,
    glowOnCollectibles: true,
    screenShakeOnCrash: true,
  },
};
```

### 7.2 UI Layout

```typescript
const UI_LAYOUT = {
  // HUD elements
  hud: {
    // Top left: Lives and area indicator
    livesDisplay: { position: "top-left", format: "❤️ x {lives}" },
    areaIndicator: {
      position: "top-left-below",
      format: "Area {current}/{total}",
    },

    // Top right: Timer and score
    timer: { position: "top-right", format: "{minutes}:{seconds}" },
    score: { position: "top-right-below", format: "{score} pts" },

    // Top center: Banana counter
    bananaCounter: { position: "top-center", format: "🍌 {collected}/{total}" },
  },

  // Control overlays
  controls: {
    // Left side: L button zone
    leftButton: {
      position: { x: 0, y: "40%", width: "15%", height: "30%" },
      indicator: { visible: true, label: "L", opacity: 0.5 },
    },

    // Right side: R button zone
    rightButton: {
      position: { x: "85%", y: "40%", width: "15%", height: "30%" },
      indicator: { visible: true, label: "R", opacity: 0.5 },
    },

    // Bottom left: Left joystick
    leftJoystick: {
      position: { x: "5%", y: "65%", width: "20%", height: "30%" },
      style: "virtual-stick",
    },

    // Bottom right: Right joystick
    rightJoystick: {
      position: { x: "75%", y: "65%", width: "20%", height: "30%" },
      style: "virtual-stick",
    },

    // Bottom center: Blow indicator / X button alternative
    blowIndicator: {
      position: { x: "40%", y: "85%", width: "20%", height: "10%" },
      showWhenNeeded: true,
    },
  },

  // Mini-map (optional)
  miniMap: {
    enabled: true,
    position: "bottom-right",
    size: { width: 80, height: 200 },
    showCheckpoints: true,
    showCart: true,
  },
};
```

---

## 8. Audio System

### 8.1 Sound Effects

```typescript
const SOUND_EFFECTS = {
  // Cart sounds
  cartRoll: {
    file: "cart_roll.mp3",
    volume: 0.3,
    loop: true,
    pitchVariation: true,
  },
  cartBounce: { file: "cart_bounce.mp3", volume: 0.5 },
  cartCrash: { file: "cart_crash.mp3", volume: 0.8 },
  cartLand: { file: "cart_land.mp3", volume: 0.4 },

  // Mechanism sounds
  gearRotate: { file: "gear_rotate.mp3", volume: 0.4, loop: true },
  platformMove: { file: "platform_move.mp3", volume: 0.3 },
  launcherCharge: { file: "launcher_charge.mp3", volume: 0.5 },
  launcherFire: { file: "launcher_fire.mp3", volume: 0.7 },
  fanBlow: { file: "fan_blow.mp3", volume: 0.4, loop: true },

  // Collectibles
  bananaCollect: { file: "banana.mp3", volume: 0.5, pitchVariation: true },
  coinCollect: { file: "coin.mp3", volume: 0.6 },

  // Progress
  checkpointReached: { file: "checkpoint.mp3", volume: 0.7 },
  areaComplete: { file: "area_complete.mp3", volume: 0.8 },
  courseComplete: { file: "course_complete.mp3", volume: 1.0 },
  extraLife: { file: "extra_life.mp3", volume: 0.8 },

  // UI
  menuSelect: { file: "menu_select.mp3", volume: 0.4 },
  menuBack: { file: "menu_back.mp3", volume: 0.4 },
  pause: { file: "pause.mp3", volume: 0.5 },
};
```

### 8.2 Music

```typescript
const MUSIC = {
  // Theme-based tracks
  course1: {
    main: { file: "course1_main.mp3", volume: 0.6, loop: true },
    intense: { file: "course1_intense.mp3", volume: 0.7, loop: true }, // Low lives
    victory: { file: "course1_victory.mp3", volume: 0.8 },
  },
  course2: {
    main: { file: "course2_main.mp3", volume: 0.6, loop: true },
    // ... etc
  },

  // Dynamic music based on game state
  dynamicMusicRules: {
    switchToIntense: (gameState) => gameState.lives === 1,
    fadeOutOnPause: true,
    muteOnCrash: true,
    playVictoryOnComplete: true,
  },
};
```

---

## 9. Progression & Scoring

### 9.1 Scoring System

```typescript
interface ScoreConfig {
  // Collectibles
  bananaPoints: 100;
  coinPoints: 500;

  // Time bonus
  timeBonus: {
    enabled: true;
    basePoints: 10000;
    penaltyPerSecond: 10;
    minimumBonus: 1000;
  };

  // Bonus multipliers
  perfectAreaBonus: 500; // No lives lost in area
  perfectCourseBonus: 5000; // No lives lost in course
  speedBonus: {
    threshold: 0.7; // Complete in 70% of par time
    multiplier: 1.5;
  };

  // Extra lives
  pointsPerExtraLife: 2000;
}

function calculateScore(
  collectibles: { bananas: number; coins: number },
  timeElapsed: number,
  livesLost: number,
  parTime: number,
): ScoreResult {
  let score = 0;

  // Base collectible score
  score += collectibles.bananas * ScoreConfig.bananaPoints;
  score += collectibles.coins * ScoreConfig.coinPoints;

  // Time bonus
  const timeBonus = Math.max(
    ScoreConfig.timeBonus.minimumBonus,
    ScoreConfig.timeBonus.basePoints -
      timeElapsed * ScoreConfig.timeBonus.penaltyPerSecond,
  );
  score += timeBonus;

  // Perfect course bonus
  if (livesLost === 0) {
    score += ScoreConfig.perfectCourseBonus;
  }

  // Speed bonus
  if (timeElapsed < parTime * ScoreConfig.speedBonus.threshold) {
    score = Math.floor(score * ScoreConfig.speedBonus.multiplier);
  }

  return {
    total: score,
    breakdown: {
      collectibles:
        collectibles.bananas * ScoreConfig.bananaPoints +
        collectibles.coins * ScoreConfig.coinPoints,
      timeBonus,
      perfectBonus: livesLost === 0 ? ScoreConfig.perfectCourseBonus : 0,
      speedMultiplier:
        timeElapsed < parTime * ScoreConfig.speedBonus.threshold
          ? ScoreConfig.speedBonus.multiplier
          : 1,
    },
  };
}
```

### 9.2 Stamps/Achievements

```typescript
const STAMPS = {
  // Course completion stamps (like DK Crash Course)
  perfectArea2: {
    id: "perfect_area_2",
    name: "Perfect through Area 2",
    description: "Reach the third checkpoint without losing a life",
    icon: "⭐",
  },
  cuttingCorners: {
    id: "cutting_corners",
    name: "Cutting Corners",
    description: "Take a shortcut that bypasses a checkpoint",
    icon: "↗️",
  },
  skip30Bananas: {
    id: "skip_30_bananas",
    name: "Skip 30 Bananas",
    description: "Finish Course 1 while skipping at least 30 bananas",
    icon: "🍌",
  },
  doubleDamselRescue: {
    id: "double_damsel",
    name: "Double Damsel Rescue",
    description: "Complete all four courses",
    icon: "👸👸",
  },
  perfectRun: {
    id: "perfect_run",
    name: "Perfect Run",
    description: "Complete all four courses without losing any lives",
    icon: "🏆",
  },

  // Speed stamps
  speedDemon: {
    id: "speed_demon",
    name: "Speed Demon",
    description: "Complete any course in under 3 minutes",
    icon: "⚡",
  },

  // Skill stamps
  narrowEscape: {
    id: "narrow_escape",
    name: "Narrow Escape",
    description: "Land a jump with less than 10 pixels to spare",
    icon: "😰",
  },
  airTime: {
    id: "air_time",
    name: "Air Time",
    description: "Stay airborne for 3 seconds",
    icon: "🪂",
  },
};
```

### 9.3 Unlockables

```typescript
const UNLOCKABLES = {
  courses: [
    { id: "course_1", name: "Classic Run", requirement: null }, // Available from start
    {
      id: "course_2",
      name: "Industrial Zone",
      requirement: "complete_course_1",
    }, // Beat course 1
    {
      id: "course_3",
      name: "Classic Run - Expert",
      requirement: "star_course_1",
    }, // All bananas on course 1
    {
      id: "course_4",
      name: "Industrial Zone - Expert",
      requirement: "star_course_2",
    },
  ],

  cartSkins: [
    { id: "default", name: "Red Racer", requirement: null },
    { id: "golden", name: "Golden Cart", requirement: "complete_all_courses" },
    { id: "neon", name: "Neon Runner", requirement: "perfect_any_course" },
    { id: "retro", name: "Retro Wooden", requirement: "collect_1000_bananas" },
  ],

  modes: [
    {
      id: "time_attack",
      name: "Time Attack",
      requirement: "complete_any_course",
    },
    { id: "mirror", name: "Mirror Mode", requirement: "complete_all_courses" },
  ],
};
```

---

## 10. Technical Implementation

### 10.1 Game Loop (react-native-game-engine + Matter.js)

```typescript
import { GameEngine } from "react-native-game-engine";
import Matter from "matter-js";

// Entity structure for react-native-game-engine
interface GameEntities {
  physics: { engine: Matter.Engine; world: Matter.World };
  cart: CartEntity;
  platforms: Map<string, PlatformEntity>;
  mechanisms: Map<string, MechanismEntity>;
  collectibles: Map<string, CollectibleEntity>;
  checkpoints: Map<string, CheckpointEntity>;
  camera: CameraEntity;
}

// Physics system - runs Matter.js each frame
const PhysicsSystem = (
  entities: GameEntities,
  { time }: GameEngineUpdateProps,
) => {
  const { engine } = entities.physics;

  // Run physics at 120Hz internally for precision
  // Matter.js handles sub-stepping automatically
  Matter.Engine.update(engine, time.delta);

  return entities;
};

// Tilt gravity system - modifies gravity based on accelerometer
const TiltGravitySystem = (
  entities: GameEntities,
  { tilt }: GameEngineUpdateProps,
) => {
  const { engine } = entities.physics;

  // Apply device tilt to gravity direction
  const tiltMultiplier = 0.5;
  engine.gravity.x = tilt.x * 9.8 * tiltMultiplier;
  engine.gravity.y = 9.8; // Always pull down

  return entities;
};

// Mechanism control system - updates mechanisms based on button/joystick input
const MechanismSystem = (
  entities: GameEntities,
  { input, time }: GameEngineUpdateProps,
) => {
  entities.mechanisms.forEach((mechanism) => {
    switch (mechanism.type) {
      case "L_ROTATING_GEAR":
        updateRotatingGear(mechanism, input.leftButton, time.delta);
        break;
      case "R_ROTATING_GEAR":
        updateRotatingGear(mechanism, input.rightButton, time.delta);
        break;
      case "LEFT_STICK_GEAR":
        updateJoystickGear(mechanism, input.leftJoystick, time.delta);
        break;
      case "FAN_PLATFORM":
        updateFanPlatform(mechanism, input.isBlowing, time.delta);
        break;
      case "R_LAUNCHER":
        updateLauncher(mechanism, input.rightButton, time.delta, entities.cart);
        break;
    }

    // Sync Matter.js body with mechanism state
    syncMechanismBody(mechanism);
  });

  return entities;
};

// Crash detection system
const CrashDetectionSystem = (
  entities: GameEntities,
  { dispatch }: GameEngineUpdateProps,
) => {
  const { cart } = entities;

  // Check flip crash
  if (checkFlipCrash(cart.composite)) {
    dispatch({ type: "crash", crashType: CrashType.FLIP });
    return entities;
  }

  // Check fall out of bounds
  if (checkFallCrash(cart.composite, entities.camera.bounds.maxY + 200)) {
    dispatch({ type: "crash", crashType: CrashType.PIT });
    return entities;
  }

  return entities;
};

// Camera follow system
const CameraSystem = (
  entities: GameEntities,
  { time }: GameEngineUpdateProps,
) => {
  const { cart, camera } = entities;
  const cartBody = cart.composite.bodies.find((b) => b.label === "cart_body");

  if (cartBody) {
    // Smooth camera follow with look-ahead
    const targetX = cartBody.position.x + cartBody.velocity.x * 0.3;
    const targetY = cartBody.position.y + cartBody.velocity.y * 0.2;

    camera.position.x = lerp(camera.position.x, targetX, 0.08);
    camera.position.y = lerp(camera.position.y, targetY, 0.08);

    // Clamp to area bounds
    camera.position.x = clamp(
      camera.position.x,
      camera.bounds.minX,
      camera.bounds.maxX,
    );
    camera.position.y = clamp(
      camera.position.y,
      camera.bounds.minY,
      camera.bounds.maxY,
    );
  }

  return entities;
};

// Collectible system
const CollectibleSystem = (
  entities: GameEntities,
  { dispatch }: GameEngineUpdateProps,
) => {
  entities.collectibles.forEach((collectible, id) => {
    if (collectible.collected && !collectible.removed) {
      // Play sound, add to score
      dispatch({ type: "collect", itemType: collectible.type, id });
      collectible.removed = true;
      Matter.World.remove(entities.physics.world, collectible.body);
    }
  });

  return entities;
};

// Timer system
const TimerSystem = (
  entities: GameEntities,
  { time, dispatch }: GameEngineUpdateProps,
) => {
  entities.elapsedTime += time.delta;

  // Check 10-minute time limit
  if (entities.elapsedTime > 10 * 60 * 1000) {
    dispatch({ type: "time-up" });
  }

  return entities;
};

// All systems in execution order
const GAME_SYSTEMS = [
  TiltGravitySystem, // Update gravity from accelerometer
  MechanismSystem, // Update mechanism positions
  PhysicsSystem, // Matter.js physics step
  CrashDetectionSystem,
  CollectibleSystem,
  CameraSystem,
  TimerSystem,
];
```

### 10.2 React Native Components

```typescript
// Main game screen
const CartCourseScreen: React.FC = () => {
  const game = useRef<CartCourseGame>(null);
  const [gameState, setGameState] = useState<GameState>(initialState);

  // Initialize tilt controls
  useEffect(() => {
    const tiltController = new TiltController();
    tiltController.start((tilt) => {
      game.current?.setTilt(tilt);
    });

    return () => tiltController.stop();
  }, []);

  // Initialize game
  useEffect(() => {
    game.current = new CartCourseGame(courseData, {
      onStateChange: setGameState,
      onCrash: handleCrash,
      onComplete: handleComplete,
    });
    game.current.start();

    return () => game.current?.stop();
  }, []);

  return (
    <View style={styles.container}>
      {/* Game canvas */}
      <CartCourseCanvas game={game.current} state={gameState} />

      {/* Control overlays */}
      <ControlOverlay
        onLeftButtonPress={() => game.current?.setLeftButton(true)}
        onLeftButtonRelease={() => game.current?.setLeftButton(false)}
        onRightButtonPress={() => game.current?.setRightButton(true)}
        onRightButtonRelease={() => game.current?.setRightButton(false)}
        onLeftJoystickChange={(value) => game.current?.setLeftJoystick(value)}
        onRightJoystickChange={(value) => game.current?.setRightJoystick(value)}
      />

      {/* HUD */}
      <GameHUD
        lives={gameState.lives}
        score={gameState.score}
        time={gameState.elapsedTime}
        currentArea={gameState.currentAreaIndex + 1}
        totalAreas={gameState.totalAreas}
        bananas={gameState.bananasCollected}
        totalBananas={gameState.totalBananas}
      />

      {/* Blow indicator */}
      {gameState.showBlowIndicator && (
        <BlowIndicator
          isBlowing={gameState.isBlowing}
          onTapAlternative={() => game.current?.triggerBlow()}
        />
      )}

      {/* Pause button */}
      <PauseButton onPress={() => game.current?.pause()} />

      {/* Modals */}
      {gameState.isPaused && <PauseMenu game={game.current} />}
      {gameState.status === 'crashed' && <CrashOverlay game={game.current} />}
      {gameState.status === 'complete' && <CompleteOverlay game={game.current} score={gameState.score} />}
    </View>
  );
};
```

---

## 11. Component Architecture (Matter.js + react-native-game-engine)

```
src/
├── components/
│   └── games/
│       └── CartCourse/
│           ├── index.tsx                 # Main GameEngine component
│           ├── CartCourseScreen.tsx      # Screen wrapper with HUD
│           ├── CartCourseHUD.tsx         # Score, lives, timer, area
│           ├── CartCourseControls.tsx    # Button zones, joysticks
│           ├── BlowIndicator.tsx         # Microphone feedback UI
│           ├── MiniMap.tsx               # Optional course overview
│           ├── CartCoursePauseMenu.tsx
│           ├── CartCourseResults.tsx
│           │
│           ├── engine/
│           │   ├── MatterWorld.ts        # Matter.js world setup
│           │   ├── CollisionHandler.ts   # Collision event handlers
│           │   ├── EntityFactory.ts      # Create Matter.js bodies
│           │   ├── TiltController.ts     # Accelerometer to gravity
│           │   └── BlowDetector.ts       # Microphone detection
│           │
│           ├── systems/                  # react-native-game-engine systems
│           │   ├── PhysicsSystem.ts      # Matter.Engine.update()
│           │   ├── TiltGravitySystem.ts  # Apply tilt to gravity
│           │   ├── MechanismSystem.ts    # Update all mechanisms
│           │   ├── CrashDetectionSystem.ts # Flip/fall/impact detection
│           │   ├── CollectibleSystem.ts  # Banana/coin collection
│           │   ├── CheckpointSystem.ts   # Checkpoint activation
│           │   ├── CameraSystem.ts       # Camera follow with lookahead
│           │   └── TimerSystem.ts        # Elapsed time tracking
│           │
│           ├── entities/
│           │   ├── CartEntity.ts         # Cart composite (body + wheels)
│           │   ├── PlatformEntity.ts     # Static/kinematic platforms
│           │   ├── WallEntity.ts         # Static wall bodies
│           │   ├── CollectibleEntity.ts  # Sensor bodies for bananas/coins
│           │   └── CheckpointEntity.ts   # Sensor bodies for checkpoints
│           │
│           ├── mechanisms/               # Matter.js mechanism implementations
│           │   ├── RotatingGear.ts       # L/R button rotating gears
│           │   ├── JoystickGear.ts       # Stick-controlled gears
│           │   ├── LiftPlatform.ts       # Button lift platforms
│           │   ├── TiltPlatform.ts       # Stick tilt platforms
│           │   ├── LauncherPlatform.ts   # Charge and launch
│           │   ├── FanPlatform.ts        # Blow-controlled lift
│           │   ├── AutoRotate.ts         # Cart-triggered rotation
│           │   └── Conveyor.ts           # Auto-moving belt
│           │
│           ├── renderers/                # Skia rendering components
│           │   ├── SkiaRenderer.tsx      # Main renderer for GameEngine
│           │   ├── CourseRenderer.tsx    # Background, static platforms
│           │   ├── CartRenderer.tsx      # Cart body + animated wheels
│           │   ├── MechanismRenderer.tsx # Animated mechanisms (gears, etc)
│           │   ├── CollectibleRenderer.tsx # Bananas with glow
│           │   ├── ParticleRenderer.tsx  # Dust, sparks on impact
│           │   └── UIRenderer.tsx        # HUD elements
│           │
│           ├── data/
│           │   ├── courses/
│           │   │   ├── course1.ts        # Classic Run (Matter.js bodies)
│           │   │   ├── course2.ts        # Industrial Zone
│           │   │   ├── course3.ts        # Classic Expert
│           │   │   └── course4.ts        # Industrial Expert
│           │   ├── mechanisms.ts         # Mechanism configs
│           │   ├── stamps.ts             # Achievement definitions
│           │   └── constants.ts          # Physics constants
│           │
│           ├── hooks/
│           │   ├── useCartCourseGame.ts  # Initialize entities & Matter.js
│           │   ├── useTiltControls.ts    # Accelerometer hook
│           │   ├── useBlowDetection.ts   # Microphone hook
│           │   └── useCartCourseAudio.ts
│           │
│           └── types/
│               └── cartCourse.types.ts   # TypeScript interfaces
│
├── services/
│   └── cartCourseService.ts              # Firebase integration
│
└── types/
    └── games.ts                          # Add CartCourse types
```

---

## 12. Firebase Data Models

### 12.1 Firestore Collections

```typescript
// Collection: users/{userId}/cartCourseProgress
interface CartCourseProgress {
  // Course completion status
  courses: {
    [courseId: string]: {
      completed: boolean;
      bestTime: number; // Milliseconds
      bestScore: number;
      bananasCollected: number;
      totalBananas: number;
      starRating: 1 | 2 | 3; // Based on performance
      attempts: number;
    };
  };

  // Unlocks
  unlockedCourses: string[];
  unlockedSkins: string[];
  unlockedModes: string[];

  // Stamps/achievements
  stamps: string[];

  // Statistics
  stats: {
    totalPlayTime: number;
    totalCrashes: number;
    totalBananasCollected: number;
    totalCoinsCollected: number;
    longestAirTime: number;
    fastestCourseTime: { courseId: string; time: number };
  };
}

// Collection: leaderboards/cartCourse/{courseId}
interface CartCourseLeaderboard {
  entries: LeaderboardEntry[];
}

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  time: number;
  bananasCollected: number;
  timestamp: Timestamp;
}
```

---

## 13. Development Phases

### Phase 1: Core Engine Setup (Week 1-2)

- [ ] Configure Matter.js with gravity-enabled world
- [ ] Set up react-native-game-engine with Skia renderer
- [ ] Create cart composite (body + two wheel circles + axle constraints)
- [ ] Implement basic gravity and cart rolling physics
- [ ] Set up accelerometer with expo-sensors
- [ ] Connect device tilt to Matter.js gravity.x
- [ ] Create basic platform as static Matter.Body
- [ ] Implement cart-platform collision

### Phase 2: Advanced Cart Physics (Week 2-3)

- [ ] Wheel friction and grip physics
- [ ] Surface-specific friction (slippery, sticky)
- [ ] Bouncy bumper walls (high restitution)
- [ ] Crash detection: impact velocity threshold
- [ ] Crash detection: flip angle threshold
- [ ] Crash detection: fall out of bounds
- [ ] Smooth camera follow with lookahead
- [ ] Camera bounds clamping per area

### Phase 3: Mechanisms - Part 1 (Week 3-4)

- [ ] L/R button touch zones UI
- [ ] RotatingGear mechanism with Matter.js body rotation
- [ ] Attached platform following gear rotation
- [ ] LiftPlatform mechanism (vertical kinematic body)
- [ ] Joystick touch control component
- [ ] JoystickGear mechanism (angle-mapped rotation)
- [ ] Cart attachment detection (is cart on platform?)

### Phase 4: Mechanisms - Part 2 (Week 4-5)

- [ ] LauncherPlatform with charge indicator UI
- [ ] Matter.Body.applyForce for launch impulse
- [ ] Microphone blow detection with expo-av
- [ ] FanPlatform mechanism (kinematic lift on blow)
- [ ] Alternative tap button for blow accessibility
- [ ] AutoRotate mechanism (triggered by cart contact)
- [ ] Conveyor belt (constant velocity zone)

### Phase 5: Course Design (Week 5-6)

- [ ] Course data structure with Matter.js body definitions
- [ ] Course 1 (10 areas) - Classic theme
- [ ] Course 2 (10 areas) - Industrial theme
- [ ] Area transition detection
- [ ] Checkpoint system (sensor bodies)
- [ ] Lives system with checkpoint respawn
- [ ] Course 3 - Expert variant (modified mechanisms)
- [ ] Course 4 - Expert variant

### Phase 6: Collectibles & Scoring (Week 6-7)

- [ ] Banana collectibles (sensor bodies with callback)
- [ ] Coin spawning after all bananas collected
- [ ] Score calculation system
- [ ] Time tracking with 10-minute limit
- [ ] Extra life every 2000 points
- [ ] Area completion detection
- [ ] Course completion flow

### Phase 7: Polish & Effects (Week 7-8)

- [ ] Skia particle effects (dust on landing, sparks on impact)
- [ ] Wheel rotation animation synced to velocity
- [ ] Cart trail effect
- [ ] Collectible glow and collection animation
- [ ] Sound effects integration
- [ ] Music system with intensity changes
- [ ] HUD animations
- [ ] Tilt calibration UI
- [ ] Tutorial overlays

### Phase 8: Progression & Integration (Week 8-9)

- [ ] Stamp/achievement detection and award
- [ ] Unlockable courses and cart skins
- [ ] Leaderboards (Firebase)
- [ ] Firebase progress persistence
- [ ] App navigation integration
- [ ] Performance optimization
- [ ] E2E testing

---

## Appendix A: Physics Formulas

```typescript
// Tilt to horizontal force
const horizontalForce = gravity * sin(deviceTilt) * tiltMultiplier;

// Surface normal force
const normalForce = mass * gravity * cos(surfaceAngle);

// Friction force (opposes motion)
const frictionForce = frictionCoeff * normalForce * sign(velocity);

// Acceleration along surface
const surfaceAccel = gravity * sin(surfaceAngle) - frictionForce / mass;

// Impact velocity for crash detection
const impactVelocity = sqrt(vx² + vy²);

// Wheel rotation speed
const wheelRotation = linearVelocity / (2 * π * wheelRadius);
```

---

## Appendix B: Testing Requirements

```typescript
// Physics tests
describe("Cart Physics", () => {
  test("cart rolls down ramp under gravity", () => {
    const cart = createCart({ position: { x: 0, y: 100 } });
    const ramp = createRamp({ angle: 30 });

    simulateSeconds(cart, ramp, 1);

    expect(cart.position.x).toBeGreaterThan(0);
    expect(cart.linearVelocity.x).toBeGreaterThan(0);
  });

  test("cart crashes on high-velocity wall impact", () => {
    const cart = createCart({ linearVelocity: { x: 400, y: 0 } });
    const wall = createWall({ x: 100 });

    const crash = detectCrash(cart, simulateUntilCollision(cart, wall));

    expect(crash).not.toBeNull();
    expect(crash.type).toBe(CrashType.WALL_IMPACT);
  });

  test("cart does not crash on low-velocity wall impact", () => {
    const cart = createCart({ linearVelocity: { x: 100, y: 0 } });
    const wall = createWall({ x: 100 });

    const crash = detectCrash(cart, simulateUntilCollision(cart, wall));

    expect(crash).toBeNull();
  });
});

// Mechanism tests
describe("Mechanisms", () => {
  test("L button rotates gear while held", () => {
    const gear = createGear({ type: "L_ROTATING_GEAR" });
    const initialRotation = gear.rotation;

    gear.update({ isHeld: true }, 0.5);

    expect(gear.rotation).toBeGreaterThan(initialRotation);
  });

  test("fan platform rises when blowing", () => {
    const platform = createFanPlatform();
    const initialY = platform.position.y;

    platform.update({ isBlowing: true }, 0.5);

    expect(platform.position.y).toBeLessThan(initialY); // Y decreases = up
  });
});

// Integration tests
describe("Course Progress", () => {
  test("checkpoint saves progress on crash", async () => {
    const game = await startCourse("course_1");
    await reachCheckpoint(game, 2);
    await crashCart(game);

    expect(game.spawnPoint).toEqual(checkpoints[2]);
  });

  test("course completes when reaching final goal", async () => {
    const game = await startCourse("course_1");
    await completeAllAreas(game);

    expect(game.status).toBe("complete");
    expect(game.finalScore).toBeGreaterThan(0);
  });
});
```

---

_Document Version: 1.0_
_Last Updated: February 2026_
_Author: AI Assistant_
