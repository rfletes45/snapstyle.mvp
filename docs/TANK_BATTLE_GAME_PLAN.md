# Tank Battle - Multiplayer Tank Combat Game Plan

## Overview

**Game Type:** 2-Player Real-time Multiplayer (Turn-based invitation, real-time gameplay)
**Inspiration:** Wii Play: Tanks!
**Platform:** React Native / Expo with Firebase for multiplayer sync

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

## 5. Physics & Collision System

### 5.1 Collision Detection

```typescript
interface CollisionSystem {
  // Spatial partitioning for performance
  gridSize: number; // Size of collision grid cells

  // Collision layers
  layers: {
    tanks: CollisionLayer;
    bullets: CollisionLayer;
    mines: CollisionLayer;
    walls: CollisionLayer;
  };

  // Collision matrix (what collides with what)
  collisionMatrix: {
    "tank-tank": true;
    "tank-wall": true;
    "tank-bullet": true;
    "tank-mine": true; // Proximity trigger
    "bullet-wall": true; // Ricochet or destroy
    "bullet-bullet": true; // Bullets destroy each other
    "bullet-mine": true; // Triggers mine
    "mine-mine": false; // Mines don't chain
  };
}

// Bullet ricochet calculation
function handleBulletWallCollision(
  bullet: Bullet,
  wall: Block,
  collisionPoint: Vector2D,
  collisionNormal: Vector2D,
): Bullet | null {
  if (bullet.ricochetsRemaining <= 0) {
    return null; // Bullet destroyed
  }

  // Reflect velocity across collision normal
  const dot = Vector2D.dot(bullet.velocity, collisionNormal);
  const reflectedVelocity = {
    x: bullet.velocity.x - 2 * dot * collisionNormal.x,
    y: bullet.velocity.y - 2 * dot * collisionNormal.y,
  };

  return {
    ...bullet,
    position: collisionPoint,
    velocity: reflectedVelocity,
    ricochetsRemaining: bullet.ricochetsRemaining - 1,
  };
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

### 10.1 Game Loop Architecture

```typescript
// Main game loop using requestAnimationFrame
class TankBattleGame {
  private lastFrameTime: number = 0;
  private accumulator: number = 0;
  private readonly FIXED_TIMESTEP: number = 1000 / 60; // 60 FPS physics

  public start(): void {
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private gameLoop(currentTime: number): void {
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    this.accumulator += deltaTime;

    // Process input
    this.processInput();

    // Fixed timestep physics
    while (this.accumulator >= this.FIXED_TIMESTEP) {
      this.updatePhysics(this.FIXED_TIMESTEP);
      this.accumulator -= this.FIXED_TIMESTEP;
    }

    // Interpolate for smooth rendering
    const alpha = this.accumulator / this.FIXED_TIMESTEP;
    this.render(alpha);

    // Sync with server (if multiplayer)
    if (this.isMultiplayer) {
      this.syncWithServer();
    }

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private updatePhysics(dt: number): void {
    // Update all tanks
    this.updateTanks(dt);

    // Update all bullets
    this.updateBullets(dt);

    // Update mines
    this.updateMines(dt);

    // Process AI
    this.updateAI(dt);

    // Check collisions
    this.processCollisions();

    // Check win/lose conditions
    this.checkMissionStatus();
  }
}
```

### 10.2 React Native Canvas Rendering

```typescript
// Using react-native-skia for high-performance 2D rendering
import { Canvas, useFrame } from '@shopify/react-native-skia';

const TankBattleCanvas: React.FC<{ game: TankBattleGame }> = ({ game }) => {
  const [gameState, setGameState] = useState<GameState>(game.getState());

  useFrame((info) => {
    // Update game state for rendering
    setGameState(game.getState());
  });

  return (
    <Canvas style={{ flex: 1 }}>
      {/* Render arena */}
      <ArenaRenderer arena={gameState.arena} />

      {/* Render track marks */}
      <TrackRenderer tracks={gameState.tracks} />

      {/* Render mines */}
      {gameState.mines.map(mine => (
        <MineRenderer key={mine.id} mine={mine} />
      ))}

      {/* Render tanks */}
      {gameState.tanks.map(tank => (
        <TankRenderer key={tank.id} tank={tank} />
      ))}

      {/* Render bullets */}
      {gameState.bullets.map(bullet => (
        <BulletRenderer key={bullet.id} bullet={bullet} />
      ))}

      {/* Render explosions */}
      {gameState.explosions.map(explosion => (
        <ExplosionRenderer key={explosion.id} explosion={explosion} />
      ))}
    </Canvas>
  );
};
```

---

## 11. Component Architecture

```
src/
├── components/
│   └── games/
│       └── TankBattle/
│           ├── index.tsx                 # Main game component
│           ├── TankBattleGame.ts        # Core game engine class
│           ├── TankBattleCanvas.tsx     # Rendering component
│           ├── TankBattleControls.tsx   # Touch controls
│           ├── TankBattleHUD.tsx        # Health, score, mission info
│           ├── TankBattlePauseMenu.tsx  # Pause screen
│           ├── TankBattleResults.tsx    # End of mission/game screen
│           │
│           ├── engine/
│           │   ├── GameLoop.ts          # Main game loop
│           │   ├── PhysicsEngine.ts     # Movement, collision
│           │   ├── CollisionSystem.ts   # Spatial partitioning, detection
│           │   ├── BulletSystem.ts      # Bullet physics, ricochets
│           │   ├── MineSystem.ts        # Mine logic, explosions
│           │   ├── AIController.ts      # Enemy AI state machine
│           │   └── InputHandler.ts      # Touch input processing
│           │
│           ├── entities/
│           │   ├── Tank.ts              # Tank entity class
│           │   ├── Bullet.ts            # Bullet entity class
│           │   ├── Mine.ts              # Mine entity class
│           │   └── Block.ts             # Arena block class
│           │
│           ├── renderers/
│           │   ├── ArenaRenderer.tsx    # Floor, walls, decorations
│           │   ├── TankRenderer.tsx     # Tank body + turret
│           │   ├── BulletRenderer.tsx   # Bullet trails
│           │   ├── MineRenderer.tsx     # Mine + warning indicators
│           │   ├── ExplosionRenderer.tsx # Explosion effects
│           │   └── TrackRenderer.tsx    # Tank track marks
│           │
│           ├── data/
│           │   ├── tankTypes.ts         # Tank configurations
│           │   ├── arenas.ts            # Level layouts
│           │   ├── missions.ts          # Mission configurations
│           │   └── aiProfiles.ts        # AI behavior profiles
│           │
│           ├── hooks/
│           │   ├── useTankBattleGame.ts # Game state management
│           │   ├── useTankBattleSync.ts # Multiplayer sync
│           │   └── useTankBattleAudio.ts # Audio management
│           │
│           └── types/
│               └── tankBattle.types.ts  # TypeScript interfaces
│
├── services/
│   └── tankBattleService.ts             # Firebase integration
│
└── types/
    └── games.ts                         # Add TankBattle game types
```

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
```

---

## 13. Development Phases

### Phase 1: Core Engine (Week 1-2)

- [ ] Set up game canvas with react-native-skia
- [ ] Implement basic tank movement and rotation
- [ ] Add turret independent rotation
- [ ] Basic bullet firing and movement
- [ ] Wall collision detection
- [ ] Bullet ricochet physics

### Phase 2: Combat Systems (Week 2-3)

- [ ] Mine deployment and detonation
- [ ] Explosion effects and damage
- [ ] Tank destruction
- [ ] Lives system
- [ ] Score tracking

### Phase 3: AI System (Week 3-4)

- [ ] Implement AI state machine
- [ ] Brown tank (stationary) behavior
- [ ] Ash tank (defensive) behavior
- [ ] Marine tank (fast bullets) behavior
- [ ] Yellow tank (mine layer) behavior
- [ ] Pink tank (aggressive) behavior
- [ ] Green tank (predictive aiming) behavior
- [ ] Violet tank (pursuer) behavior
- [ ] White tank (invisible) behavior
- [ ] Black tank (elite) behavior

### Phase 4: Level System (Week 4-5)

- [ ] Arena rendering system
- [ ] Create 20 preset arena layouts
- [ ] Mission configuration system
- [ ] Progressive unlocking
- [ ] Random arena selection for missions 21+

### Phase 5: Multiplayer (Week 5-6)

- [ ] Firebase game session management
- [ ] Real-time state synchronization
- [ ] Latency compensation
- [ ] Player 2 integration
- [ ] Score comparison

### Phase 6: Polish (Week 6-7)

- [ ] Touch control refinement
- [ ] Visual effects (particles, screen shake)
- [ ] Dynamic music system
- [ ] Sound effects
- [ ] HUD design
- [ ] Pause/resume functionality

### Phase 7: Integration (Week 7-8)

- [ ] Game invitation system integration
- [ ] Achievement system integration
- [ ] Statistics tracking
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
