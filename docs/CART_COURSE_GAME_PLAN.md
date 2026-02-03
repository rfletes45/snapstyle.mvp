# Cart Course - Tilt-Based Obstacle Course Game Plan

## Overview

**Game Type:** Single-Player Physics Puzzle/Obstacle Course
**Inspiration:** Nintendo Land - Donkey Kong's Crash Course
**Platform:** React Native / Expo with device accelerometer/gyroscope

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

## 3. Physics System

### 3.1 Tilt Physics

```typescript
interface TiltPhysics {
  // Device tilt affects gravity direction
  baseTiltMultiplier: number; // Sensitivity to device tilt
  maxTiltAngle: number; // Maximum effective tilt
  deadzone: number; // Ignore small tilts
  smoothingFactor: number; // Input smoothing (0-1)
}

function applyTiltGravity(
  cart: CartState,
  deviceTilt: { pitch: number; roll: number },
  config: TiltPhysics,
  deltaTime: number,
): Vector2D {
  // Apply deadzone
  let effectiveTilt = deviceTilt.roll;
  if (Math.abs(effectiveTilt) < config.deadzone) {
    effectiveTilt = 0;
  }

  // Clamp to max
  effectiveTilt = clamp(
    effectiveTilt,
    -config.maxTiltAngle,
    config.maxTiltAngle,
  );

  // Convert tilt to gravity modifier
  const tiltRatio = effectiveTilt / config.maxTiltAngle;
  const horizontalGravity =
    DEFAULT_CART_CONFIG.gravity * tiltRatio * config.baseTiltMultiplier;

  // Gravity always pulls down, tilt adds horizontal component
  return {
    x: horizontalGravity,
    y: DEFAULT_CART_CONFIG.gravity,
  };
}
```

### 3.2 Surface Interaction

```typescript
interface SurfaceProperties {
  type: "solid" | "bouncy" | "slippery" | "sticky";
  friction: number;
  bounciness: number; // Coefficient of restitution
  angle: number; // Surface angle in degrees
}

function applySurfacePhysics(
  cart: CartState,
  surface: SurfaceProperties,
  gravity: Vector2D,
  deltaTime: number,
): CartState {
  // Calculate surface normal
  const surfaceAngleRad = (surface.angle * Math.PI) / 180;
  const surfaceNormal = {
    x: Math.sin(surfaceAngleRad),
    y: -Math.cos(surfaceAngleRad),
  };

  // Project gravity onto surface
  const gravityAlongSurface = Vector2D.dot(gravity, {
    x: Math.cos(surfaceAngleRad),
    y: Math.sin(surfaceAngleRad),
  });

  // Apply friction
  const frictionForce = surface.friction * Vector2D.magnitude(gravity);
  const velocityMagnitude = Vector2D.magnitude(cart.linearVelocity);

  let newVelocity = cart.linearVelocity;

  // Apply surface acceleration
  if (cart.isGrounded) {
    // Add gravity component along surface
    newVelocity = Vector2D.add(
      newVelocity,
      Vector2D.multiply(
        { x: Math.cos(surfaceAngleRad), y: Math.sin(surfaceAngleRad) },
        gravityAlongSurface * deltaTime,
      ),
    );

    // Apply friction (opposes motion)
    if (velocityMagnitude > 0) {
      const frictionDecel = Math.min(
        frictionForce * deltaTime,
        velocityMagnitude,
      );
      const frictionDir = Vector2D.normalize(
        Vector2D.multiply(newVelocity, -1),
      );
      newVelocity = Vector2D.add(
        newVelocity,
        Vector2D.multiply(frictionDir, frictionDecel),
      );
    }
  }

  return {
    ...cart,
    linearVelocity: newVelocity,
    surfaceNormal,
    isGrounded: true,
  };
}
```

### 3.3 Collision Response

```typescript
function handleCollision(
  cart: CartState,
  collision: CollisionResult,
): CartState {
  const surface = collision.surface;

  // Calculate reflection for bouncy surfaces
  if (surface.bounciness > 0) {
    const reflected = Vector2D.reflect(cart.linearVelocity, collision.normal);

    return {
      ...cart,
      position: collision.resolvedPosition,
      linearVelocity: Vector2D.multiply(reflected, surface.bounciness),
    };
  }

  // For solid surfaces, zero out velocity component into surface
  const normalVelocity = Vector2D.dot(cart.linearVelocity, collision.normal);

  if (normalVelocity < 0) {
    // Moving into surface
    const tangent = { x: -collision.normal.y, y: collision.normal.x };
    const tangentVelocity = Vector2D.dot(cart.linearVelocity, tangent);

    return {
      ...cart,
      position: collision.resolvedPosition,
      linearVelocity: Vector2D.multiply(tangent, tangentVelocity),
      isGrounded: collision.isFloor,
    };
  }

  return cart;
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

### 5.3 Mechanism Behaviors

```typescript
// L/R Button Gear - Rotates while held
class RotatingGearMechanism {
  update(input: { isHeld: boolean }, deltaTime: number): void {
    if (input.isHeld) {
      this.rotation += this.config.rotationSpeed * deltaTime;
      this.rotation = clamp(
        this.rotation,
        this.config.rotationRange.min,
        this.config.rotationRange.max,
      );
    } else if (this.config.returnToNeutral) {
      // Spring back to neutral
      this.rotation = lerp(this.rotation, 0, 0.1);
    }

    // Update attached platforms
    for (const platformId of this.config.attachedPlatforms) {
      const platform = this.getPlatform(platformId);
      platform.rotation = this.rotation;
    }
  }
}

// Joystick Gear - Rotation controlled by stick rotation
class JoystickGearMechanism {
  update(input: { angle: number; magnitude: number }, deltaTime: number): void {
    if (input.magnitude > 0.2) {
      // Map joystick rotation to gear rotation
      const targetRotation =
        input.angle *
        (this.config.rotationRange.max - this.config.rotationRange.min);
      this.rotation = lerp(
        this.rotation,
        targetRotation,
        this.config.rotationSpeed * deltaTime,
      );
    }

    // Update attached platforms position based on rotation
    for (const platformId of this.config.attachedPlatforms) {
      const platform = this.getPlatform(platformId);
      const angle = (this.rotation * Math.PI) / 180;
      const radius = this.config.armLength;
      platform.position = {
        x: this.position.x + Math.cos(angle) * radius,
        y: this.position.y + Math.sin(angle) * radius,
      };
    }
  }
}

// R Launcher - Charge and launch
class LauncherMechanism {
  private chargeLevel: number = 0;

  update(input: { isHeld: boolean }, deltaTime: number): void {
    if (input.isHeld) {
      // Charge up
      this.chargeLevel = Math.min(
        1,
        this.chargeLevel + deltaTime / this.config.chargeTime,
      );
      this.state = "active";
    } else if (this.state === "active") {
      // Release - launch!
      this.launch(this.chargeLevel);
      this.chargeLevel = 0;
      this.state = "idle";
    }
  }

  private launch(power: number): void {
    const cartOnPlatform = this.getCartOnPlatform();
    if (cartOnPlatform) {
      const launchVelocity = {
        x: this.config.launchDirection.x * this.config.launchForce * power,
        y: this.config.launchDirection.y * this.config.launchForce * power,
      };
      cartOnPlatform.applyImpulse(launchVelocity);
    }
  }
}

// Fan Platform - Blow to lift
class FanPlatformMechanism {
  update(input: { isBlowing: boolean }, deltaTime: number): void {
    if (input.isBlowing) {
      // Lift platform
      this.position.y = lerp(
        this.position.y,
        this.config.endPosition.y,
        this.config.moveSpeed * deltaTime,
      );
    } else {
      // Lower platform
      this.position.y = lerp(
        this.position.y,
        this.config.startPosition.y,
        this.config.moveSpeed * 0.5 * deltaTime, // Falls slower
      );
    }
  }
}
```

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
```

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

### 10.1 Game Loop

```typescript
class CartCourseGame {
  private lastFrameTime: number = 0;
  private accumulator: number = 0;
  private readonly PHYSICS_TIMESTEP: number = 1000 / 120; // 120 FPS physics for precision
  private readonly RENDER_TIMESTEP: number = 1000 / 60; // 60 FPS render

  public start(): void {
    this.lastFrameTime = performance.now();
    this.inputController.start();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private gameLoop(currentTime: number): void {
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    this.accumulator += deltaTime;

    // Process input
    const input = this.inputController.getInput();

    // Fixed timestep physics (multiple iterations if needed)
    while (this.accumulator >= this.PHYSICS_TIMESTEP) {
      this.updatePhysics(this.PHYSICS_TIMESTEP, input);
      this.accumulator -= this.PHYSICS_TIMESTEP;
    }

    // Update camera
    this.updateCamera(deltaTime);

    // Interpolate for smooth rendering
    const alpha = this.accumulator / this.PHYSICS_TIMESTEP;
    this.render(alpha);

    // Continue loop
    if (this.gameState.status === "playing") {
      requestAnimationFrame(this.gameLoop.bind(this));
    }
  }

  private updatePhysics(dt: number, input: GameInput): void {
    const dtSeconds = dt / 1000;

    // Calculate gravity based on device tilt
    const gravity = this.calculateGravity(input.tilt);

    // Update mechanisms first (they affect surfaces)
    this.updateMechanisms(input, dtSeconds);

    // Update cart physics
    this.cart = this.physicsEngine.updateCart(
      this.cart,
      gravity,
      this.currentArea.obstacles,
      this.currentArea.mechanisms,
      dtSeconds,
    );

    // Check for crashes
    const crash = detectCrash(
      this.cart,
      this.lastCollision,
      this.previousPosition,
    );
    if (crash) {
      this.handleCrash(crash);
      return;
    }

    // Check collectibles
    this.checkCollectibles();

    // Check checkpoint reached
    this.checkCheckpoints();

    // Check area transition
    this.checkAreaTransition();

    // Store for next frame
    this.previousPosition = { ...this.cart.position };
  }
}
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

## 11. Component Architecture

```
src/
├── components/
│   └── games/
│       └── CartCourse/
│           ├── index.tsx                 # Main game component
│           ├── CartCourseGame.ts        # Core game engine class
│           ├── CartCourseCanvas.tsx     # Rendering with Skia
│           ├── CartCourseHUD.tsx        # Score, lives, timer
│           ├── CartCourseControls.tsx   # Touch zones and joysticks
│           ├── BlowIndicator.tsx        # Microphone feedback UI
│           ├── MiniMap.tsx              # Optional course overview
│           ├── CartCoursePauseMenu.tsx
│           ├── CartCourseResults.tsx
│           │
│           ├── engine/
│           │   ├── GameLoop.ts          # Main loop with fixed timestep
│           │   ├── PhysicsEngine.ts     # Cart physics, gravity, collisions
│           │   ├── TiltController.ts    # Accelerometer handling
│           │   ├── MechanismController.ts # All mechanism logic
│           │   ├── BlowDetector.ts      # Microphone detection
│           │   ├── CollisionSystem.ts   # 2D collision detection
│           │   └── CameraController.ts  # Camera follow logic
│           │
│           ├── entities/
│           │   ├── Cart.ts              # Cart entity with wheels
│           │   ├── Obstacle.ts          # Static obstacle class
│           │   ├── Mechanism.ts         # Base mechanism class
│           │   ├── Collectible.ts       # Banana, coin classes
│           │   └── Checkpoint.ts        # Checkpoint flag entity
│           │
│           ├── mechanisms/
│           │   ├── RotatingGear.ts      # L/R button gears
│           │   ├── JoystickGear.ts      # Stick-controlled gears
│           │   ├── LiftPlatform.ts      # Button lift platforms
│           │   ├── TiltPlatform.ts      # Stick tilt platforms
│           │   ├── LauncherPlatform.ts  # Charge and launch
│           │   ├── FanPlatform.ts       # Blow-controlled
│           │   ├── AutoRotate.ts        # Triggered by cart
│           │   └── Conveyor.ts          # Auto-moving belt
│           │
│           ├── renderers/
│           │   ├── CourseRenderer.tsx   # Background, platforms
│           │   ├── CartRenderer.tsx     # Cart with wheels
│           │   ├── MechanismRenderer.tsx # Animated mechanisms
│           │   ├── CollectibleRenderer.tsx
│           │   ├── ParticleRenderer.tsx # Dust, sparks
│           │   └── UIRenderer.tsx       # HUD elements
│           │
│           ├── data/
│           │   ├── courses/
│           │   │   ├── course1.ts       # Classic Run data
│           │   │   ├── course2.ts       # Industrial Zone data
│           │   │   ├── course3.ts       # Classic Expert data
│           │   │   └── course4.ts       # Industrial Expert data
│           │   ├── mechanisms.ts        # Mechanism configs
│           │   ├── stamps.ts            # Achievement definitions
│           │   └── unlockables.ts       # Progression config
│           │
│           ├── hooks/
│           │   ├── useCartCourseGame.ts # Game state management
│           │   ├── useTiltControls.ts   # Accelerometer hook
│           │   ├── useBlowDetection.ts  # Microphone hook
│           │   └── useCartCourseAudio.ts
│           │
│           └── types/
│               └── cartCourse.types.ts  # TypeScript interfaces
│
├── services/
│   └── cartCourseService.ts             # Firebase integration
│
└── types/
    └── games.ts                         # Add CartCourse types
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

### Phase 1: Core Physics (Week 1-2)

- [ ] Set up game canvas with react-native-skia
- [ ] Implement cart entity with two wheels
- [ ] Basic gravity and movement physics
- [ ] Tilt controls via accelerometer
- [ ] Ground collision detection
- [ ] Basic ramp physics

### Phase 2: Advanced Physics (Week 2-3)

- [ ] Crash detection (velocity, flip, fall)
- [ ] Surface friction variations
- [ ] Bounce/bumper mechanics
- [ ] Air resistance and terminal velocity
- [ ] Precise wheel contact detection
- [ ] Camera follow system

### Phase 3: Mechanisms - Part 1 (Week 3-4)

- [ ] L/R button rotating gears
- [ ] L/R button lift platforms
- [ ] Joystick-controlled gears
- [ ] Joystick-controlled tilt platforms
- [ ] Cart attachment to platforms

### Phase 4: Mechanisms - Part 2 (Week 4-5)

- [ ] Launcher platforms (charge/release)
- [ ] Fan/blow platforms with microphone
- [ ] Alternative X button for blow
- [ ] Auto-rotating platforms
- [ ] Conveyor belts
- [ ] Auto-moving platforms

### Phase 5: Course Design (Week 5-6)

- [ ] Course 1 (10 areas) - Classic
- [ ] Course 2 (10 areas) - Industrial
- [ ] Course 3 - Expert variant of Course 1
- [ ] Course 4 - Expert variant of Course 2
- [ ] Checkpoint system
- [ ] Lives system

### Phase 6: Collectibles & Scoring (Week 6-7)

- [ ] Banana placement and collection
- [ ] Coin spawning logic
- [ ] Score calculation
- [ ] Time tracking
- [ ] Extra life system
- [ ] Area completion detection

### Phase 7: Polish (Week 7-8)

- [ ] Visual effects (particles, trails)
- [ ] Sound effects
- [ ] Music system
- [ ] HUD refinement
- [ ] Control calibration UI
- [ ] Tutorial/help overlays

### Phase 8: Progression & Integration (Week 8-9)

- [ ] Stamp/achievement system
- [ ] Unlockables
- [ ] Leaderboards
- [ ] Firebase integration
- [ ] App integration

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
