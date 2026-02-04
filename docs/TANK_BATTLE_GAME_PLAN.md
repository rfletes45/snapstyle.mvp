# Tank Battle - Multiplayer Tank Combat Game Plan

## Overview

**Game Type:** 2-Player Real-time Multiplayer (Turn-based invitation, real-time gameplay)
**Inspiration:** Wii Play: Tanks!
**Platform:** React Native / Expo with Firebase for multiplayer sync

### Technology Stack

| Package                      | Version | Purpose                                             |
| ---------------------------- | ------- | --------------------------------------------------- |
| `matter-js`                  | ^0.19.0 | 2D physics engine (collisions, ricochets, movement) |
| `react-native-game-engine`   | ^1.2.0  | Entity-component game loop (60fps updates)          |
| `@shopify/react-native-skia` | ^1.0.0  | GPU-accelerated canvas rendering                    |
| `firebase`                   | ^12.x   | Real-time multiplayer state sync                    |

```bash
# Already installed in project
npm install matter-js @types/matter-js react-native-game-engine @shopify/react-native-skia
```

---

## Table of Contents

1. [Game Concept](#1-game-concept)
2. [Core Mechanics](#2-core-mechanics)
3. [Tank Types & AI Behaviors](#3-tank-types--ai-behaviors)
4. [Level Design System](#4-level-design-system)
5. [Physics & Collision System](#5-physics--collision-system)
6. [Multiplayer Architecture](#6-multiplayer-architecture)
7. [Visual Design](#7-visual-design)
8. [Audio System](#8-audio-system)
9. [Progression System](#9-progression-system)
10. [Technical Implementation](#10-technical-implementation)
11. [Component Architecture](#11-component-architecture)
12. [Firebase Data Models](#12-firebase-data-models)
13. [Development Phases](#13-development-phases)

---

## 1. Game Concept

### Core Experience

A top-down tank combat game where 1-2 players battle against AI enemy tanks across progressively challenging missions. Players must destroy all enemy tanks while avoiding bullets, mines, and environmental hazards.

### Key Features

- **2-Player Cooperative/Competitive Mode:** Both players share the battlefield, competing for kills while cooperating to survive
- **Ricocheting Bullets:** Bullets bounce off walls up to a configurable number of times
- **Land Mines:** Deployable explosives with timed detonation and proximity triggers
- **Varied Enemy AI:** 9 distinct enemy tank types with unique behaviors
- **100 Mission Campaign:** Progressive difficulty with unlockable content
- **Destructible Environment:** Some blocks can be destroyed by explosions

### Game Rules

- **Single Hit Kill:** All tanks (player and enemy) are destroyed in one hit
- **Lives System:** Players start with 3 lives, gain 1 extra life every 5 missions
- **Mission Reset on Death:** Current mission resets but destroyed enemies remain gone
- **Co-op Survival:** In 2-player, game ends only when both players die in same mission
- **Friendly Fire:** Players can damage each other (strategic element)

---

## 2. Core Mechanics

### 2.1 Tank Movement

```typescript
interface TankMovement {
  maxSpeed: number; // Pixels per second
  acceleration: number; // Speed ramp-up
  deceleration: number; // Speed ramp-down
  rotationSpeed: number; // Degrees per second (body rotation)
  turretRotationSpeed: number; // Independent turret rotation
  trackMarks: boolean; // Leave visible tracks
}

// Player tank defaults
const PLAYER_MOVEMENT: TankMovement = {
  maxSpeed: 120,
  acceleration: 300,
  deceleration: 400,
  rotationSpeed: 180,
  turretRotationSpeed: 270,
  trackMarks: true,
};
```

### 2.2 Shooting Mechanics

```typescript
interface BulletConfig {
  speed: number; // Pixels per second
  maxRicochets: number; // Times bullet can bounce (0-2)
  maxActiveBullets: number; // Simultaneous bullets allowed
  cooldownMs: number; // Minimum time between shots
  damage: number; // Always 1 for instant kill
}

// Bullet physics
interface Bullet {
  id: string;
  ownerId: string; // Tank that fired it
  position: Vector2D;
  velocity: Vector2D;
  ricochetsRemaining: number;
  createdAt: number;
  maxLifetimeMs: number; // Bullets expire after time
}
```

### 2.3 Mine System

```typescript
interface MineConfig {
  maxMines: number; // Per tank limit
  detonationTimerMs: number; // Time until auto-explode (10 seconds)
  proximityRadius: number; // Trigger distance
  blastRadius: number; // Damage radius
  armingDelayMs: number; // Time before proximity active
}

interface Mine {
  id: string;
  ownerId: string;
  position: Vector2D;
  deployedAt: number;
  isArmed: boolean;
  blastRadius: number;
}
```

### 2.4 Controls (Touch-Based)

```typescript
interface ControlScheme {
  // Left side of screen: Virtual joystick for movement
  movementJoystick: {
    position: "bottom-left";
    radius: 60;
    deadzone: 0.15;
  };

  // Right side: Aim by touch position relative to tank
  aimingMethod: "touch-position" | "virtual-joystick";

  // Buttons
  fireButton: {
    position: "bottom-right";
    size: 70;
  };

  mineButton: {
    position: "bottom-right-secondary";
    size: 50;
  };
}
```

---

## 3. Tank Types & AI Behaviors

### 3.1 Enemy Tank Specifications

| Tank   | Color  | Speed      | Bullet Speed | Fire Rate | Ricochets | Max Bullets | Max Mines | Behavior                                          |
| ------ | ------ | ---------- | ------------ | --------- | --------- | ----------- | --------- | ------------------------------------------------- |
| Brown  | Brown  | Stationary | Normal       | Slow      | 1         | 1           | 0         | Passive - Only fires when player in line of sight |
| Ash    | Gray   | Slow       | Normal       | Slow      | 1         | 1           | 0         | Defensive - Retreats when player approaches       |
| Marine | Teal   | Slow       | Fast         | Slow      | 0         | 1           | 0         | Defensive - Fast non-bouncing shots               |
| Yellow | Yellow | Normal     | Normal       | Slow      | 1         | 1           | 4         | Mine Layer - Aggressively deploys mines           |
| Pink   | Pink   | Slow       | Normal       | Fast      | 1         | 3           | 0         | Offensive - High fire rate, moves toward player   |
| Green  | Green  | Stationary | Fast         | Fast      | 2         | 2           | 0         | Predictor - Aims where player WILL be             |
| Violet | Purple | Normal     | Normal       | Fast      | 1         | 5           | 2         | Aggressive - Pursues and overwhelms               |
| White  | White  | Slow       | Normal       | Fast      | 1         | 5           | 2         | Invisible - Only tracks visible                   |
| Black  | Black  | Fast       | Fast         | Fast      | 0         | 3           | 2         | Elite - Most dangerous, fast & accurate           |

### 3.2 AI Behavior System

```typescript
// AI State Machine
enum AIState {
  IDLE = "idle",
  PATROL = "patrol",
  PURSUE = "pursue",
  ATTACK = "attack",
  RETREAT = "retreat",
  EVADE = "evade",
  LAY_MINE = "lay_mine",
}

interface AIBehavior {
  // Movement patterns
  movementPattern: "stationary" | "patrol" | "pursue" | "retreat" | "dynamic";

  // Targeting
  aimingType: "direct" | "predictive" | "random";
  reactionTimeMs: number; // Delay before responding to player
  accuracyVariance: number; // Degrees of aim randomness

  // Decision making
  engageDistance: number; // Distance to start attacking
  retreatHealthThreshold: number; // N/A for 1-hit kills but useful for future
  mineLayingPriority: number; // 0-1 chance to lay mine vs shoot

  // Awareness
  visionRange: number; // How far can see
  visionAngle: number; // Field of view in degrees
  canDetectMines: boolean; // Avoids player mines?
  hearsShots: boolean; // Reacts to nearby gunfire
}

// Specific behaviors
const AI_BEHAVIORS: Record<TankType, AIBehavior> = {
  brown: {
    movementPattern: "stationary",
    aimingType: "direct",
    reactionTimeMs: 800,
    accuracyVariance: 5,
    engageDistance: 400,
    mineLayingPriority: 0,
    visionRange: 500,
    visionAngle: 360,
    canDetectMines: false,
    hearsShots: false,
  },
  green: {
    movementPattern: "stationary",
    aimingType: "predictive", // KEY: Predicts player movement
    reactionTimeMs: 300,
    accuracyVariance: 2,
    engageDistance: 600,
    mineLayingPriority: 0,
    visionRange: 700,
    visionAngle: 360,
    canDetectMines: true,
    hearsShots: true,
  },
  white: {
    movementPattern: "patrol",
    aimingType: "direct",
    reactionTimeMs: 400,
    accuracyVariance: 3,
    engageDistance: 450,
    mineLayingPriority: 0.3,
    visionRange: 550,
    visionAngle: 360,
    canDetectMines: true,
    hearsShots: true,
    isInvisible: true, // Special: Only tracks visible
  },
  // ... etc for all tank types
};
```

### 3.3 Predictive Aiming (Green Tank)

```typescript
function calculatePredictiveAim(
  shooterPos: Vector2D,
  targetPos: Vector2D,
  targetVelocity: Vector2D,
  bulletSpeed: number,
  maxRicochets: number,
): Vector2D {
  // Calculate time for bullet to reach target's current position
  const distance = Vector2D.distance(shooterPos, targetPos);
  const timeToTarget = distance / bulletSpeed;

  // Predict where target will be
  const predictedPos = {
    x: targetPos.x + targetVelocity.x * timeToTarget,
    y: targetPos.y + targetVelocity.y * timeToTarget,
  };

  // Calculate aim direction
  const aimDirection = Vector2D.normalize(
    Vector2D.subtract(predictedPos, shooterPos),
  );

  // Account for wall ricochets if needed
  if (maxRicochets > 0) {
    const ricochetPath = calculateRicochetPath(
      shooterPos,
      aimDirection,
      maxRicochets,
      walls,
    );
    // Adjust aim to hit predicted position via ricochets
  }

  return aimDirection;
}
```

---

## 4. Level Design System

### 4.1 Arena Structure

```typescript
interface Arena {
  id: string;
  name: string;
  width: number; // Grid units (typically 16-24)
  height: number; // Grid units (typically 12-18)
  tileSize: number; // Pixels per grid unit

  blocks: Block[]; // Obstacles and walls
  spawnPoints: SpawnPoint[]; // Player and enemy spawn locations
  decorations: Decoration[]; // Visual-only elements
}

interface Block {
  gridX: number;
  gridY: number;
  width: number; // Grid units
  height: number; // Grid units
  type: BlockType;
  elevation: number; // 0 = ground, 1+ = raised
}

enum BlockType {
  SOLID = "solid", // Indestructible, blocks movement & bullets
  DESTRUCTIBLE = "destructible", // Can be destroyed by explosions
  LOW_WALL = "low_wall", // Blocks tanks but not bullets
  PIT = "pit", // Blocks tanks, bullets pass over
  WATER = "water", // Visual hazard, blocks movement
}

interface SpawnPoint {
  gridX: number;
  gridY: number;
  type: "player1" | "player2" | "enemy";
  tankType?: TankType; // For enemy spawns
  delay?: number; // Spawn delay in ms
}
```

### 4.2 Mission Configuration

```typescript
interface Mission {
  id: number; // 1-100
  arenaId: string;
  enemies: EnemySpawn[];
  isPreset: boolean; // Fixed layout vs randomized

  // Unlock conditions
  requiredMission: number; // Must complete this mission first

  // Special conditions
  timeLimit?: number; // Optional time challenge
  noMines?: boolean; // Player can't use mines
}

interface EnemySpawn {
  tankType: TankType;
  spawnPointIndex: number; // Which spawn point to use
  spawnDelay: number; // Delay after mission start
}

// Mission milestones
const MISSION_MILESTONES = {
  5: { reward: "bronze_medal", newTank: "marine" },
  10: { reward: "silver_medal", newTank: "pink" },
  12: { newTank: "green" },
  15: { newTank: "violet" },
  20: { reward: "gold_medal", newTank: "white", unlocksExtendedCampaign: true },
  50: { newTank: "black" },
  100: { reward: "platinum_medal", completesGame: true },
};
```

### 4.3 Arena Templates (First 20 Missions)

```typescript
const ARENA_TEMPLATES: Arena[] = [
  // Mission 1: Tutorial - Open arena with few obstacles
  {
    id: "arena_1",
    name: "Training Grounds",
    width: 16,
    height: 12,
    tileSize: 40,
    blocks: [
      {
        gridX: 7,
        gridY: 5,
        width: 2,
        height: 2,
        type: BlockType.SOLID,
        elevation: 1,
      },
    ],
    spawnPoints: [
      { gridX: 2, gridY: 6, type: "player1" },
      { gridX: 14, gridY: 6, type: "player2" },
      { gridX: 8, gridY: 2, type: "enemy", tankType: "brown" },
      { gridX: 8, gridY: 10, type: "enemy", tankType: "brown" },
    ],
  },

  // Mission 5: Introduction of Marine tanks
  {
    id: "arena_5",
    name: "The Maze",
    width: 20,
    height: 14,
    tileSize: 40,
    blocks: [
      // Create maze-like structure with corridors
      {
        gridX: 4,
        gridY: 0,
        width: 1,
        height: 6,
        type: BlockType.SOLID,
        elevation: 1,
      },
      {
        gridX: 8,
        gridY: 4,
        width: 1,
        height: 10,
        type: BlockType.SOLID,
        elevation: 1,
      },
      {
        gridX: 12,
        gridY: 0,
        width: 1,
        height: 8,
        type: BlockType.SOLID,
        elevation: 1,
      },
      {
        gridX: 16,
        gridY: 6,
        width: 1,
        height: 8,
        type: BlockType.SOLID,
        elevation: 1,
      },
    ],
    // ... etc
  },

  // ... Continue for all 20 preset arenas
];
```

---

## 5. Physics & Collision System (Matter.js)

### 5.1 Matter.js World Setup

```typescript
import Matter from "matter-js";

// Create Matter.js engine and world
const engine = Matter.Engine.create({
  gravity: { x: 0, y: 0 }, // Top-down game, no gravity
  enableSleeping: false,
});

const world = engine.world;

// Collision categories (bitmask)
const COLLISION_CATEGORIES = {
  WALL: 0x0001,
  TANK: 0x0002,
  BULLET: 0x0004,
  MINE: 0x0008,
  DESTRUCTIBLE: 0x0010,
};

// Collision filters - what collides with what
const COLLISION_FILTERS = {
  wall: {
    category: COLLISION_CATEGORIES.WALL,
    mask: COLLISION_CATEGORIES.TANK | COLLISION_CATEGORIES.BULLET,
  },
  tank: {
    category: COLLISION_CATEGORIES.TANK,
    mask:
      COLLISION_CATEGORIES.WALL |
      COLLISION_CATEGORIES.TANK |
      COLLISION_CATEGORIES.BULLET |
      COLLISION_CATEGORIES.MINE,
  },
  bullet: {
    category: COLLISION_CATEGORIES.BULLET,
    mask:
      COLLISION_CATEGORIES.WALL |
      COLLISION_CATEGORIES.TANK |
      COLLISION_CATEGORIES.BULLET |
      COLLISION_CATEGORIES.MINE,
  },
  mine: {
    category: COLLISION_CATEGORIES.MINE,
    mask: COLLISION_CATEGORIES.TANK | COLLISION_CATEGORIES.BULLET,
  },
};
```

### 5.2 Tank Body Creation with Matter.js

```typescript
function createTankBody(config: TankConfig): Matter.Body {
  const tankBody = Matter.Bodies.rectangle(
    config.x,
    config.y,
    TANK_WIDTH,
    TANK_HEIGHT,
    {
      label: `tank_${config.id}`,
      friction: 0.1,
      frictionAir: 0.05, // Drag when moving
      restitution: 0.2, // Slight bounce on collision
      collisionFilter: COLLISION_FILTERS.tank,
      // Custom data attached to body
      plugin: {
        tankId: config.id,
        tankType: config.type,
        isPlayer: config.isPlayer,
      },
    },
  );

  Matter.World.add(world, tankBody);
  return tankBody;
}

// Tank movement using Matter.js forces
function moveTank(tank: TankEntity, input: { x: number; y: number }): void {
  const force = Matter.Vector.mult(
    Matter.Vector.normalise({ x: input.x, y: input.y }),
    tank.config.maxSpeed * 0.001, // Convert to force
  );

  Matter.Body.applyForce(tank.body, tank.body.position, force);

  // Clamp velocity to max speed
  const speed = Matter.Vector.magnitude(tank.body.velocity);
  if (speed > tank.config.maxSpeed) {
    Matter.Body.setVelocity(
      tank.body,
      Matter.Vector.mult(
        Matter.Vector.normalise(tank.body.velocity),
        tank.config.maxSpeed,
      ),
    );
  }
}
```

### 5.3 Bullet Ricochet System with Matter.js

```typescript
function createBulletBody(config: BulletConfig): Matter.Body {
  const bullet = Matter.Bodies.circle(config.x, config.y, BULLET_RADIUS, {
    label: `bullet_${config.id}`,
    friction: 0,
    frictionAir: 0,
    restitution: 1.0, // Perfect bounce for ricochets
    collisionFilter: COLLISION_FILTERS.bullet,
    isSensor: false,
    plugin: {
      bulletId: config.id,
      ownerId: config.ownerId,
      ricochetsRemaining: config.maxRicochets,
      createdAt: Date.now(),
    },
  });

  // Set initial velocity
  Matter.Body.setVelocity(bullet, {
    x: Math.cos(config.angle) * config.speed,
    y: Math.sin(config.angle) * config.speed,
  });

  Matter.World.add(world, bullet);
  return bullet;
}

// Handle bullet collision events
Matter.Events.on(engine, "collisionStart", (event) => {
  event.pairs.forEach((pair) => {
    const bodyA = pair.bodyA;
    const bodyB = pair.bodyB;

    // Bullet-Wall collision (ricochet)
    if (isBullet(bodyA) && isWall(bodyB)) {
      handleBulletRicochet(bodyA, pair.collision.normal);
    } else if (isBullet(bodyB) && isWall(bodyA)) {
      handleBulletRicochet(bodyB, pair.collision.normal);
    }

    // Bullet-Tank collision (destroy both)
    if (isBullet(bodyA) && isTank(bodyB)) {
      destroyBullet(bodyA);
      destroyTank(bodyB);
    } else if (isBullet(bodyB) && isTank(bodyA)) {
      destroyBullet(bodyB);
      destroyTank(bodyA);
    }

    // Bullet-Bullet collision (both destroyed)
    if (isBullet(bodyA) && isBullet(bodyB)) {
      destroyBullet(bodyA);
      destroyBullet(bodyB);
    }

    // Bullet-Mine collision (trigger explosion)
    if (isBullet(bodyA) && isMine(bodyB)) {
      destroyBullet(bodyA);
      triggerMineExplosion(bodyB);
    } else if (isBullet(bodyB) && isMine(bodyA)) {
      destroyBullet(bodyB);
      triggerMineExplosion(bodyA);
    }
  });
});

function handleBulletRicochet(
  bullet: Matter.Body,
  normal: Matter.Vector,
): void {
  const ricochets = bullet.plugin.ricochetsRemaining;

  if (ricochets <= 0) {
    destroyBullet(bullet);
    return;
  }

  // Decrement ricochet count
  bullet.plugin.ricochetsRemaining = ricochets - 1;

  // Matter.js handles velocity reflection automatically with restitution: 1.0
  // But we ensure it maintains constant speed
  const speed = Matter.Vector.magnitude(bullet.velocity);
  const targetSpeed = BULLET_SPEEDS[bullet.plugin.bulletType] || 300;

  if (Math.abs(speed - targetSpeed) > 1) {
    Matter.Body.setVelocity(
      bullet,
      Matter.Vector.mult(Matter.Vector.normalise(bullet.velocity), targetSpeed),
    );
  }

  // Play ricochet sound
  playSound("ricochet");
}
```

### 5.2 Explosion System

```typescript
interface Explosion {
  position: Vector2D;
  radius: number;
  damage: number;
  sourceId: string; // What caused the explosion

  // Visual
  duration: number;
  currentFrame: number;
}

function processExplosion(
  explosion: Explosion,
  gameState: GameState,
): GameState {
  const affectedEntities: string[] = [];

  // Check all tanks in radius
  for (const tank of gameState.tanks) {
    const distance = Vector2D.distance(explosion.position, tank.position);
    if (distance <= explosion.radius) {
      affectedEntities.push(tank.id);
    }
  }

  // Check destructible blocks
  for (const block of gameState.arena.blocks) {
    if (block.type === BlockType.DESTRUCTIBLE) {
      const blockCenter = getBlockCenter(block);
      const distance = Vector2D.distance(explosion.position, blockCenter);
      if (distance <= explosion.radius) {
        // Mark block for destruction
        affectedEntities.push(`block_${block.id}`);
      }
    }
  }

  // Destroy bullets in radius
  for (const bullet of gameState.bullets) {
    const distance = Vector2D.distance(explosion.position, bullet.position);
    if (distance <= explosion.radius) {
      affectedEntities.push(bullet.id);
    }
  }

  // NOTE: Explosions can penetrate through thin walls
  // This is intentional game mechanic

  return applyExplosionEffects(gameState, affectedEntities, explosion);
}
```

---

## 6. Multiplayer Architecture

### 6.1 Game Session Management

```typescript
interface TankBattleSession {
  id: string;
  status: "waiting" | "active" | "paused" | "completed";
  createdAt: Timestamp;

  // Players
  player1Id: string;
  player2Id: string | null; // Null for single player

  // Current state
  currentMission: number;
  player1Lives: number;
  player2Lives: number;
  player1Score: number; // Total tanks destroyed
  player2Score: number;

  // Settings
  gameMode: "coop" | "versus" | "solo";
  friendlyFire: boolean;

  // Real-time sync
  lastUpdateAt: Timestamp;
  syncVersion: number;
}
```

### 6.2 Real-time State Synchronization

```typescript
// State updates sent to Firebase at 20Hz (every 50ms)
interface GameStateUpdate {
  sessionId: string;
  timestamp: number;
  syncVersion: number;

  // Delta updates only (not full state)
  tankUpdates: TankStateUpdate[];
  bulletUpdates: BulletStateUpdate[];
  mineUpdates: MineStateUpdate[];
  events: GameEvent[];
}

interface TankStateUpdate {
  tankId: string;
  position: Vector2D;
  rotation: number;
  turretRotation: number;
  velocity: Vector2D;
  isAlive: boolean;
}

// Event-based sync for important actions
interface GameEvent {
  type:
    | "fire"
    | "mine_placed"
    | "tank_destroyed"
    | "mine_triggered"
    | "mission_complete";
  timestamp: number;
  data: Record<string, any>;
}
```

### 6.3 Latency Compensation

```typescript
interface LatencyCompensation {
  // Client-side prediction
  enablePrediction: boolean;
  predictionBufferMs: 100;

  // Server reconciliation
  enableReconciliation: boolean;
  maxReconciliationMs: 200;

  // Interpolation for remote players
  interpolationDelayMs: 100;

  // Lag compensation for hit detection
  enableLagCompensation: boolean;
  maxCompensationMs: 150;
}

// Implementation
function updateLocalTank(input: PlayerInput, deltaTime: number): void {
  // Apply input immediately (client prediction)
  const predictedState = applyInput(localTank, input, deltaTime);

  // Store input for server reconciliation
  inputHistory.push({
    input,
    timestamp: Date.now(),
    predictedState,
  });

  // Send to server
  sendInputToServer(input);
}

function onServerStateReceived(serverState: GameState): void {
  // Find the server state timestamp
  const serverTimestamp = serverState.timestamp;

  // Re-apply any inputs that happened after server timestamp
  const pendingInputs = inputHistory.filter(
    (i) => i.timestamp > serverTimestamp,
  );

  // Start from server state and re-simulate
  let reconciledState = serverState.localTank;
  for (const pendingInput of pendingInputs) {
    reconciledState = applyInput(
      reconciledState,
      pendingInput.input,
      deltaTime,
    );
  }

  // Smooth correction if difference is small, snap if large
  const difference = Vector2D.distance(
    localTank.position,
    reconciledState.position,
  );

  if (difference > SNAP_THRESHOLD) {
    localTank.position = reconciledState.position;
  } else {
    localTank.position = Vector2D.lerp(
      localTank.position,
      reconciledState.position,
      CORRECTION_SPEED,
    );
  }
}
```

---

## 7. Visual Design

### 7.1 Art Style

```typescript
const VISUAL_STYLE = {
  // 2.5D isometric-ish top-down view
  perspective: "top-down-angled",

  // Color palette (military/playful hybrid)
  colors: {
    ground: "#8B7355", // Sandy brown
    grass: "#4A7023", // Olive green
    walls: "#4A4A4A", // Dark gray
    destructible: "#8B4513", // Saddle brown (wooden)
    water: "#4682B4", // Steel blue

    // Player tanks
    player1: "#1E90FF", // Dodger blue
    player2: "#DC143C", // Crimson red

    // Enemy tanks (match original)
    brown: "#8B4513",
    ash: "#708090",
    marine: "#20B2AA",
    yellow: "#FFD700",
    pink: "#FF69B4",
    green: "#228B22",
    violet: "#9932CC",
    white: "#F5F5F5",
    black: "#1A1A1A",
  },

  // Visual effects
  effects: {
    muzzleFlash: true,
    bulletTrails: true,
    explosionParticles: true,
    tankTracks: true,
    dustClouds: true,
    screenShake: true,
  },
};
```

### 7.2 Tank Rendering

```typescript
interface TankSprite {
  // Tank body (rotates with movement direction)
  body: {
    width: 32;
    height: 40;
    texture: string;
  };

  // Turret (rotates independently)
  turret: {
    width: 8;
    height: 24;
    texture: string;
    pivotY: 0.7; // Pivot point for rotation
  };

  // Track marks
  tracks: {
    texture: string;
    fadeTime: 5000; // Ms before tracks disappear
    spacing: 10; // Pixels between track marks
  };
}

// Visibility for white tanks
function renderWhiteTank(tank: Tank, ctx: CanvasRenderingContext2D): void {
  if (tank.type === "white" && tank.isInvisible) {
    // Only render tracks
    renderTracks(tank.trackHistory, ctx);
    return;
  }

  // Normal rendering
  renderTankBody(tank, ctx);
  renderTankTurret(tank, ctx);
}
```

---

## 8. Audio System

### 8.1 Sound Effects

```typescript
const SOUND_EFFECTS = {
  // Tank sounds
  tankMove: { file: "tank_move.mp3", volume: 0.4, loop: true },
  tankIdle: { file: "tank_idle.mp3", volume: 0.2, loop: true },
  tankShoot: { file: "tank_shoot.mp3", volume: 0.7 },
  tankExplode: { file: "tank_explode.mp3", volume: 0.9 },

  // Bullet sounds
  bulletRicochet: { file: "ricochet.mp3", volume: 0.5 },
  bulletHitWall: { file: "bullet_wall.mp3", volume: 0.4 },

  // Mine sounds
  mineDeploy: { file: "mine_deploy.mp3", volume: 0.5 },
  mineBeep: { file: "mine_beep.mp3", volume: 0.3 },
  mineExplode: { file: "mine_explode.mp3", volume: 1.0 },

  // UI sounds
  missionStart: { file: "mission_start.mp3", volume: 0.8 },
  missionComplete: { file: "mission_complete.mp3", volume: 0.8 },
  extraLife: { file: "extra_life.mp3", volume: 0.7 },
};
```

### 8.2 Dynamic Music System (Wii Tanks Style)

```typescript
// Music layers that activate based on enemy tanks present
interface MusicLayer {
  instrument: string;
  file: string;
  volume: number;
  tankTriggers: TankType[]; // Which tanks activate this layer
}

const MUSIC_LAYERS: MusicLayer[] = [
  {
    instrument: "piccolos",
    file: "base_melody.mp3",
    volume: 0.5,
    tankTriggers: [],
  }, // Always plays
  {
    instrument: "snare",
    file: "snare.mp3",
    volume: 0.4,
    tankTriggers: ["brown", "ash"],
  },
  {
    instrument: "metronome",
    file: "metronome.mp3",
    volume: 0.3,
    tankTriggers: ["ash", "marine"],
  },
  {
    instrument: "cymbals",
    file: "cymbals.mp3",
    volume: 0.4,
    tankTriggers: ["marine", "pink"],
  },
  {
    instrument: "timpani",
    file: "timpani.mp3",
    volume: 0.5,
    tankTriggers: ["pink", "yellow"],
  },
  {
    instrument: "bass",
    file: "bass_drum.mp3",
    volume: 0.5,
    tankTriggers: ["yellow", "violet"],
  },
  {
    instrument: "tuba",
    file: "tuba.mp3",
    volume: 0.4,
    tankTriggers: ["violet", "green"],
  },
  {
    instrument: "bells",
    file: "tubular_bells.mp3",
    volume: 0.5,
    tankTriggers: ["green"],
  },
  {
    instrument: "synth",
    file: "synthesizer.mp3",
    volume: 0.5,
    tankTriggers: ["white", "black"],
  },
];

function updateMusicLayers(enemyTanks: Tank[]): void {
  const activeTankTypes = new Set(enemyTanks.map((t) => t.type));

  for (const layer of MUSIC_LAYERS) {
    const shouldPlay =
      layer.tankTriggers.length === 0 ||
      layer.tankTriggers.some((t) => activeTankTypes.has(t));

    if (shouldPlay && !layer.isPlaying) {
      fadeInLayer(layer);
    } else if (!shouldPlay && layer.isPlaying) {
      fadeOutLayer(layer);
    }
  }
}
```

---

## 9. Progression System

### 9.1 Campaign Structure

```typescript
interface CampaignProgress {
  userId: string;
  highestMissionCompleted: number;
  totalTanksDestroyed: number;

  medals: {
    bronze: boolean; // Mission 5
    silver: boolean; // Mission 10
    gold: boolean; // Mission 20
    platinum: boolean; // Mission 30+
  };

  stats: {
    totalMissionsPlayed: number;
    totalDeaths: number;
    accuracy: number; // Shots hit / shots fired
    favoriteArena: string;
    fastestMission: { missionId: number; timeMs: number };
  };
}
```

### 9.2 Unlockables

```typescript
const UNLOCKABLES = {
  // Tank skins (cosmetic)
  tankSkins: [
    { id: "camo", name: "Camouflage", requirement: "complete_mission_10" },
    { id: "gold", name: "Gold Plated", requirement: "complete_mission_50" },
    { id: "neon", name: "Neon", requirement: "destroy_500_tanks" },
  ],

  // Special modes
  modes: [
    {
      id: "survival",
      name: "Survival Mode",
      requirement: "complete_mission_20",
    },
    {
      id: "time_attack",
      name: "Time Attack",
      requirement: "complete_mission_30",
    },
  ],

  // Achievements
  achievements: [
    {
      id: "sharp_shooter",
      name: "Sharp Shooter",
      description: "90% accuracy in mission",
      reward: 50,
    },
    {
      id: "untouchable",
      name: "Untouchable",
      description: "Complete 5 missions without dying",
      reward: 100,
    },
    {
      id: "mine_sweeper",
      name: "Mine Sweeper",
      description: "Destroy 3 tanks with one mine",
      reward: 75,
    },
  ],
};
```

---

## 10. Technical Implementation

### 10.1 Game Loop Architecture (react-native-game-engine + Matter.js)

```typescript
import { GameEngine } from "react-native-game-engine";
import Matter from "matter-js";

// Entity-Component System using react-native-game-engine
interface GameEntities {
  physics: { engine: Matter.Engine; world: Matter.World };
  playerTank: TankEntity;
  opponentTank?: TankEntity;
  enemyTanks: Map<string, TankEntity>;
  bullets: Map<string, BulletEntity>;
  mines: Map<string, MineEntity>;
  arena: ArenaEntity;
}

// Systems run every frame (60fps)
const PhysicsSystem = (
  entities: GameEntities,
  { time }: { time: { delta: number } },
) => {
  const { engine } = entities.physics;

  // Update Matter.js physics (handles all collisions automatically)
  Matter.Engine.update(engine, time.delta);

  return entities;
};

const TankMovementSystem = (
  entities: GameEntities,
  { touches, time }: GameEngineUpdateProps,
) => {
  const { playerTank } = entities;
  const joystickInput = getJoystickInput(touches);

  if (joystickInput.magnitude > 0.1) {
    moveTank(playerTank, joystickInput);
    rotateTankTowards(playerTank, joystickInput.angle);
  }

  return entities;
};

const TurretAimSystem = (
  entities: GameEntities,
  { touches }: GameEngineUpdateProps,
) => {
  const { playerTank } = entities;
  const aimInput = getAimInput(touches);

  if (aimInput) {
    rotateTurretTowards(playerTank, aimInput);
  }

  return entities;
};

const AISystem = (entities: GameEntities, { time }: GameEngineUpdateProps) => {
  entities.enemyTanks.forEach((enemy) => {
    updateEnemyAI(enemy, entities, time.delta);
  });

  return entities;
};

const BulletLifetimeSystem = (
  entities: GameEntities,
  { time }: GameEngineUpdateProps,
) => {
  const now = Date.now();

  entities.bullets.forEach((bullet, id) => {
    // Remove expired bullets
    if (now - bullet.createdAt > BULLET_LIFETIME_MS) {
      destroyBullet(bullet.body);
      entities.bullets.delete(id);
    }
  });

  return entities;
};

const MineTimerSystem = (
  entities: GameEntities,
  { time }: GameEngineUpdateProps,
) => {
  const now = Date.now();

  entities.mines.forEach((mine, id) => {
    // Check auto-detonation timer
    if (now - mine.deployedAt > MINE_DETONATION_TIME_MS) {
      triggerMineExplosion(mine.body);
      entities.mines.delete(id);
    }

    // Check proximity trigger (if armed)
    if (mine.isArmed) {
      checkMineProximity(mine, entities);
    }
  });

  return entities;
};

const MissionStatusSystem = (
  entities: GameEntities,
  { dispatch }: GameEngineUpdateProps,
) => {
  // Check if all enemies destroyed
  const aliveEnemies = Array.from(entities.enemyTanks.values()).filter(
    (e) => e.isAlive,
  );

  if (aliveEnemies.length === 0) {
    dispatch({ type: "mission-complete" });
  }

  // Check if player destroyed
  if (!entities.playerTank.isAlive) {
    dispatch({ type: "player-destroyed" });
  }

  return entities;
};

// Multiplayer sync system
const MultiplayerSyncSystem = (
  entities: GameEntities,
  { time }: GameEngineUpdateProps,
) => {
  // Send local state to Firebase every 50ms (20Hz)
  if (time.current % 50 < time.delta) {
    syncStateToFirebase(entities);
  }

  // Apply received remote state
  applyRemoteState(entities);

  return entities;
};

// All systems in execution order
const GAME_SYSTEMS = [
  TankMovementSystem,
  TurretAimSystem,
  AISystem,
  PhysicsSystem, // Matter.js updates here
  BulletLifetimeSystem,
  MineTimerSystem,
  MissionStatusSystem,
  MultiplayerSyncSystem,
];
```

````

### 10.2 React Native Game Engine + Skia Rendering

```typescript
import { GameEngine } from 'react-native-game-engine';
import { Canvas, useValue, runTiming } from '@shopify/react-native-skia';
import Matter from 'matter-js';

// Main game component using react-native-game-engine
const TankBattleScreen: React.FC = () => {
  const [running, setRunning] = useState(true);
  const gameEngineRef = useRef<GameEngine>(null);

  // Initialize Matter.js world and entities
  const entities = useMemo(() => initializeGameEntities(missionConfig), []);

  // Handle game events
  const onEvent = (event: GameEvent) => {
    switch (event.type) {
      case 'mission-complete':
        setRunning(false);
        onMissionComplete();
        break;
      case 'player-destroyed':
        handlePlayerDeath();
        break;
      case 'fire-bullet':
        fireBullet(entities, event.data);
        break;
      case 'deploy-mine':
        deployMine(entities, event.data);
        break;
    }
  };

  return (
    <View style={styles.container}>
      {/* Game Engine handles systems and game loop */}
      <GameEngine
        ref={gameEngineRef}
        style={styles.gameContainer}
        systems={GAME_SYSTEMS}
        entities={entities}
        running={running}
        onEvent={onEvent}
        renderer={SkiaRenderer} // Custom Skia renderer
      />

      {/* Touch controls overlay */}
      <TankBattleControls
        onFirePress={() => gameEngineRef.current?.dispatch({ type: 'fire-bullet' })}
        onMinePress={() => gameEngineRef.current?.dispatch({ type: 'deploy-mine' })}
      />

      {/* HUD */}
      <TankBattleHUD
        lives={entities.playerTank.lives}
        score={entities.score}
        mission={currentMission}
      />
    </View>
  );
};

// Custom Skia renderer for react-native-game-engine
const SkiaRenderer = (entities: GameEntities, screen: { width: number; height: number }) => {
  return (
    <Canvas style={{ width: screen.width, height: screen.height }}>
      {/* Render arena floor and walls */}
      <ArenaRenderer arena={entities.arena} />

      {/* Render track marks (behind tanks) */}
      <TrackRenderer tracks={entities.trackHistory} />

      {/* Render mines */}
      {Array.from(entities.mines.values()).map(mine => (
        <MineRenderer key={mine.id} mine={mine} />
      ))}

      {/* Render enemy tanks */}
      {Array.from(entities.enemyTanks.values())
        .filter(tank => tank.isAlive)
        .map(tank => (
          <TankRenderer key={tank.id} tank={tank} />
        ))}

      {/* Render player tank */}
      {entities.playerTank.isAlive && (
        <TankRenderer tank={entities.playerTank} isPlayer />
      )}

      {/* Render opponent tank (multiplayer) */}
      {entities.opponentTank?.isAlive && (
        <TankRenderer tank={entities.opponentTank} isPlayer />
      )}

      {/* Render bullets */}
      {Array.from(entities.bullets.values()).map(bullet => (
        <BulletRenderer key={bullet.id} bullet={bullet} />
      ))}

      {/* Render explosions */}
      {entities.explosions.map(explosion => (
        <ExplosionRenderer key={explosion.id} explosion={explosion} />
      ))}
    </Canvas>
  );
};

// Individual renderers using Skia
const TankRenderer: React.FC<{ tank: TankEntity; isPlayer?: boolean }> = ({ tank, isPlayer }) => {
  const { body, turretAngle, type } = tank;
  const pos = body.position;
  const bodyAngle = body.angle;

  return (
    <Group transform={[{ translateX: pos.x }, { translateY: pos.y }]}>
      {/* Tank body */}
      <Group transform={[{ rotate: bodyAngle }]}>
        <RoundedRect
          x={-TANK_WIDTH / 2}
          y={-TANK_HEIGHT / 2}
          width={TANK_WIDTH}
          height={TANK_HEIGHT}
          r={4}
          color={isPlayer ? PLAYER_COLORS[type] : ENEMY_COLORS[type]}
        />
        {/* Track details */}
        <Rect x={-TANK_WIDTH / 2 - 2} y={-TANK_HEIGHT / 2} width={4} height={TANK_HEIGHT} color="#333" />
        <Rect x={TANK_WIDTH / 2 - 2} y={-TANK_HEIGHT / 2} width={4} height={TANK_HEIGHT} color="#333" />
      </Group>

      {/* Turret (rotates independently) */}
      <Group transform={[{ rotate: turretAngle }]}>
        <Circle cx={0} cy={0} r={8} color={isPlayer ? '#1E90FF' : ENEMY_COLORS[type]} />
        <Rect x={-2} y={-20} width={4} height={20} color="#444" />
      </Group>
    </Group>
  );
};

const BulletRenderer: React.FC<{ bullet: BulletEntity }> = ({ bullet }) => {
  const pos = bullet.body.position;

  return (
    <Group>
      {/* Bullet trail */}
      <Line
        p1={{ x: pos.x - bullet.body.velocity.x * 0.1, y: pos.y - bullet.body.velocity.y * 0.1 }}
        p2={pos}
        color="rgba(255, 200, 0, 0.5)"
        strokeWidth={3}
      />
      {/* Bullet */}
      <Circle cx={pos.x} cy={pos.y} r={BULLET_RADIUS} color="#FFD700" />
    </Group>
  );
};
````

```

---

## 11. Component Architecture (Matter.js + react-native-game-engine)

```

src/
├── components/
│ └── games/
│ └── TankBattle/
│ ├── index.tsx # Main GameEngine component
│ ├── TankBattleScreen.tsx # Screen wrapper with HUD
│ ├── TankBattleControls.tsx # Touch controls (joystick, buttons)
│ ├── TankBattleHUD.tsx # Health, score, mission info
│ ├── TankBattlePauseMenu.tsx # Pause screen
│ ├── TankBattleResults.tsx # End of mission/game screen
│ │
│ ├── engine/
│ │ ├── MatterWorld.ts # Matter.js world setup & config
│ │ ├── CollisionHandler.ts # Matter.js collision event handlers
│ │ ├── EntityFactory.ts # Create Matter.js bodies for entities
│ │ └── PhysicsHelpers.ts # Movement, ricochet calculations
│ │
│ ├── systems/ # react-native-game-engine systems
│ │ ├── PhysicsSystem.ts # Matter.Engine.update() each frame
│ │ ├── TankMovementSystem.ts # Apply forces from joystick input
│ │ ├── TurretAimSystem.ts # Rotate turret toward touch
│ │ ├── AISystem.ts # Enemy AI state machine updates
│ │ ├── BulletSystem.ts # Bullet lifetime & cleanup
│ │ ├── MineSystem.ts # Mine timers & proximity
│ │ ├── MissionSystem.ts # Win/lose condition checks
│ │ └── MultiplayerSystem.ts # Firebase sync (20Hz)
│ │
│ ├── entities/
│ │ ├── TankEntity.ts # Tank with Matter.Body + game state
│ │ ├── BulletEntity.ts # Bullet with Matter.Body + ricochet count
│ │ ├── MineEntity.ts # Mine with Matter.Body + timers
│ │ ├── WallEntity.ts # Static Matter.Body for walls
│ │ └── ArenaEntity.ts # All static bodies for arena
│ │
│ ├── ai/
│ │ ├── AIStateMachine.ts # State machine base class
│ │ ├── behaviors/
│ │ │ ├── BrownTankAI.ts # Stationary, simple aim
│ │ │ ├── AshTankAI.ts # Defensive retreat
│ │ │ ├── MarineTankAI.ts # Fast bullets, defensive
│ │ │ ├── YellowTankAI.ts # Mine layer
│ │ │ ├── PinkTankAI.ts # Aggressive pursuer
│ │ │ ├── GreenTankAI.ts # Predictive aiming
│ │ │ ├── VioletTankAI.ts # Overwhelm with bullets
│ │ │ ├── WhiteTankAI.ts # Invisible, tracks only
│ │ │ └── BlackTankAI.ts # Elite, all abilities
│ │ └── PredictiveAiming.ts # Math for leading shots
│ │
│ ├── renderers/ # Skia rendering components
│ │ ├── SkiaRenderer.tsx # Main renderer for GameEngine
│ │ ├── ArenaRenderer.tsx # Floor, walls, decorations
│ │ ├── TankRenderer.tsx # Tank body + turret
│ │ ├── BulletRenderer.tsx # Bullet with trail
│ │ ├── MineRenderer.tsx # Mine + warning indicators
│ │ ├── ExplosionRenderer.tsx # Particle explosion effects
│ │ └── TrackRenderer.tsx # Tank track marks
│ │
│ ├── data/
│ │ ├── tankTypes.ts # Tank configurations (speed, bullets, etc)
│ │ ├── arenas.ts # Level layouts (wall positions)
│ │ ├── missions.ts # Mission configs (which enemies)
│ │ └── constants.ts # Physics constants, collision categories
│ │
│ ├── hooks/
│ │ ├── useTankBattleGame.ts # Initialize entities & Matter.js
│ │ ├── useTankBattleSync.ts # Multiplayer Firebase sync
│ │ └── useTankBattleAudio.ts # Audio management
│ │
│ └── types/
│ └── tankBattle.types.ts # TypeScript interfaces
│
├── services/
│ └── tankBattleService.ts # Firebase integration
│
└── types/
└── games.ts # Add TankBattle game types

````

---

## 12. Firebase Data Models

### 12.1 Firestore Collections

```typescript
// Collection: games/{gameId}
interface TankBattleGameDoc {
  type: "tank_battle";
  status: "waiting" | "active" | "completed";
  createdAt: Timestamp;
  updatedAt: Timestamp;

  hostId: string;
  guestId: string | null;

  settings: {
    mode: "coop" | "versus" | "solo";
    friendlyFire: boolean;
    startingLives: number;
    maxMission: number; // 20 for multiplayer
  };

  state: {
    currentMission: number;
    player1Lives: number;
    player2Lives: number;
    player1Score: number;
    player2Score: number;
  };

  result?: {
    winner: string | null; // null for coop
    finalMission: number;
    totalTanksDestroyed: number;
  };
}

// Subcollection: games/{gameId}/frames/{frameId}
// Used for real-time state sync (similar to flappyFrames)
interface TankBattleFrame {
  timestamp: number;
  syncVersion: number;

  tanks: SerializedTank[];
  bullets: SerializedBullet[];
  mines: SerializedMine[];

  events: GameEvent[];
}

// Collection: users/{userId}/tankBattleProgress
interface TankBattleProgress {
  highestMission: number;
  totalTanksDestroyed: number;
  totalGamesPlayed: number;
  medals: string[];
  achievements: string[];
  unlocks: string[];
}
````

---

## 13. Development Phases

### Phase 1: Core Engine Setup (Week 1-2)

- [ ] Install and configure Matter.js, react-native-game-engine, Skia
- [ ] Set up Matter.js world with zero gravity (top-down)
- [ ] Create collision categories and filters
- [ ] Implement basic GameEngine with Skia renderer
- [ ] Create tank entity with Matter.Body
- [ ] Basic tank movement using Matter.Body.applyForce()
- [ ] Tank rotation and independent turret rotation
- [ ] Wall creation and tank-wall collisions

### Phase 2: Bullet & Combat Systems (Week 2-3)

- [ ] Bullet entity with Matter.Body (restitution: 1.0 for bounce)
- [ ] Bullet firing from turret position
- [ ] Bullet-wall collision with ricochet handling
- [ ] Ricochet counter decrement and bullet destruction
- [ ] Bullet-tank collision detection
- [ ] Tank destruction effects
- [ ] Bullet-bullet collision (both destroyed)

### Phase 3: Mine & Explosion System (Week 3-4)

- [ ] Mine entity with Matter.Body (sensor for proximity)
- [ ] Mine deployment by player
- [ ] Mine arming delay timer
- [ ] Proximity trigger detection
- [ ] Auto-detonation timer
- [ ] Explosion radius damage calculation
- [ ] Chain reaction prevention (intentional)

### Phase 4: AI System (Week 4-5)

- [ ] AI state machine base class
- [ ] Brown tank (stationary) - simple line-of-sight firing
- [ ] Ash tank (defensive) - retreat when player approaches
- [ ] Marine tank - fast non-bouncing bullets
- [ ] Yellow tank - mine laying behavior
- [ ] Pink tank - aggressive pursuit
- [ ] Green tank - predictive aiming (lead target)
- [ ] Violet tank - overwhelming fire
- [ ] White tank - invisible body, visible tracks only
- [ ] Black tank - elite combining all abilities

### Phase 5: Level System (Week 5-6)

- [ ] Arena data structure with wall positions
- [ ] Create Matter.js static bodies from arena data
- [ ] Implement 20 preset arena layouts
- [ ] Mission configuration (which enemies, spawn positions)
- [ ] Progressive difficulty unlock
- [ ] Random arena selection for missions 21+
- [ ] Destructible blocks with explosion interaction

### Phase 6: Multiplayer Integration (Week 6-7)

- [ ] Firebase game session management
- [ ] Real-time state synchronization (20Hz)
- [ ] Input prediction for local player
- [ ] State interpolation for remote player
- [ ] Latency compensation for hit detection
- [ ] Player 2 tank integration
- [ ] Score comparison and lives tracking

### Phase 7: Polish & Effects (Week 7-8)

- [ ] Touch control refinement (joystick + aim)
- [ ] Tank track mark rendering
- [ ] Particle effects for explosions
- [ ] Muzzle flash on firing
- [ ] Screen shake on explosions
- [ ] Dynamic music system (layers based on enemies)
- [ ] Sound effects integration
- [ ] HUD design and animations
- [ ] Pause/resume functionality

### Phase 8: Integration & Testing (Week 8)

- [ ] Game invitation system integration
- [ ] Achievement system integration
- [ ] Statistics tracking
- [ ] Performance optimization
- [ ] E2E testing with react-native-game-engine
- [ ] App store screenshots/marketing

---

## Appendix A: Vector2D Utility Class

```typescript
class Vector2D {
  constructor(
    public x: number,
    public y: number,
  ) {}

  static add(a: Vector2D, b: Vector2D): Vector2D {
    return new Vector2D(a.x + b.x, a.y + b.y);
  }

  static subtract(a: Vector2D, b: Vector2D): Vector2D {
    return new Vector2D(a.x - b.x, a.y - b.y);
  }

  static multiply(v: Vector2D, scalar: number): Vector2D {
    return new Vector2D(v.x * scalar, v.y * scalar);
  }

  static dot(a: Vector2D, b: Vector2D): number {
    return a.x * b.x + a.y * b.y;
  }

  static magnitude(v: Vector2D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  static normalize(v: Vector2D): Vector2D {
    const mag = Vector2D.magnitude(v);
    if (mag === 0) return new Vector2D(0, 0);
    return new Vector2D(v.x / mag, v.y / mag);
  }

  static distance(a: Vector2D, b: Vector2D): number {
    return Vector2D.magnitude(Vector2D.subtract(b, a));
  }

  static lerp(a: Vector2D, b: Vector2D, t: number): Vector2D {
    return new Vector2D(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }

  static rotate(v: Vector2D, angleRad: number): Vector2D {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return new Vector2D(v.x * cos - v.y * sin, v.x * sin + v.y * cos);
  }

  static reflect(v: Vector2D, normal: Vector2D): Vector2D {
    const dot = Vector2D.dot(v, normal);
    return new Vector2D(v.x - 2 * dot * normal.x, v.y - 2 * dot * normal.y);
  }
}
```

---

## Appendix B: Testing Requirements

```typescript
// Unit tests for physics
describe("BulletSystem", () => {
  test("bullet ricochets correctly off vertical wall", () => {
    const bullet = createBullet({ velocity: { x: 1, y: 0 }, ricochets: 1 });
    const wall = createVerticalWall({ x: 100 });
    const result = handleBulletWallCollision(bullet, wall);
    expect(result.velocity.x).toBe(-1);
    expect(result.velocity.y).toBe(0);
    expect(result.ricochetsRemaining).toBe(0);
  });

  test("bullet is destroyed after max ricochets", () => {
    const bullet = createBullet({ ricochets: 0 });
    const wall = createWall();
    const result = handleBulletWallCollision(bullet, wall);
    expect(result).toBeNull();
  });
});

// Integration tests for AI
describe("AI Behaviors", () => {
  test("green tank predicts player movement", () => {
    const greenTank = createTank("green", { x: 0, y: 0 });
    const player = createTank("player", { x: 100, y: 0 }, { vx: 10, vy: 0 });
    const aiDecision = greenTank.ai.decide(player);
    // Should aim ahead of player
    expect(aiDecision.aimTarget.x).toBeGreaterThan(100);
  });

  test("white tank becomes invisible", () => {
    const whiteTank = createTank("white");
    whiteTank.onMissionStart();
    expect(whiteTank.isVisible).toBe(false);
    expect(whiteTank.tracksVisible).toBe(true);
  });
});

// E2E tests
describe("TankBattle Game Flow", () => {
  test("completing mission advances to next", async () => {
    const game = await startTankBattleGame({ mission: 1 });
    await destroyAllEnemies(game);
    expect(game.currentMission).toBe(2);
  });

  test("losing all lives ends game", async () => {
    const game = await startTankBattleGame({ lives: 1 });
    await killPlayer(game);
    expect(game.status).toBe("game_over");
  });
});
```

---

_Document Version: 1.0_
_Last Updated: February 2026_
_Author: AI Assistant_
