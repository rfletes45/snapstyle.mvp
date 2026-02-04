/**
 * Collectible System
 *
 * Manages collectible items (bananas and coins) in Cart Course.
 * Handles:
 * - Collectible entity creation (sensor bodies)
 * - Collection detection via collision callbacks
 * - Coin spawning logic (coins appear when preceding bananas collected)
 * - Score tracking and updates
 * - Area collectible tracking
 */

import Matter from "matter-js";
import {
  Collectible,
  CollectibleEntity,
  CollectibleType,
  COLLISION_CATEGORIES,
  GameEngineUpdateProps,
  GameEntities,
  Vector2D,
} from "../types/cartCourse.types";

// ============================================
// Collectible Configuration
// ============================================

export interface CollectibleConfig {
  // Point values
  bananaPoints: number;
  coinPoints: number;

  // Physics
  sensorRadius: number;
  bobAmplitude: number; // Pixels to bob up/down
  bobFrequency: number; // Cycles per second
  rotationSpeed: number; // Degrees per second

  // Spawning
  coinSpawnDelay: number; // MS delay before coin appears
  collectFadeTime: number; // MS for collection fade animation

  // Visual effects
  glowEnabled: boolean;
  glowIntensity: number;
  collectParticles: number;
}

export const DEFAULT_COLLECTIBLE_CONFIG: CollectibleConfig = {
  // Point values from game plan
  bananaPoints: 100,
  coinPoints: 500,

  // Physics
  sensorRadius: 16,
  bobAmplitude: 4,
  bobFrequency: 1.5,
  rotationSpeed: 45,

  // Spawning
  coinSpawnDelay: 500,
  collectFadeTime: 200,

  // Visual effects
  glowEnabled: true,
  glowIntensity: 0.6,
  collectParticles: 8,
};

// ============================================
// Collectible State
// ============================================

export interface CollectibleState {
  // Tracking
  collectedIds: Set<string>;
  totalBananas: number;
  totalCoins: number;
  bananasCollected: number;
  coinsCollected: number;

  // Per-area tracking
  areaBananaProgress: Map<number, { collected: number; total: number }>;
  areaCoinProgress: Map<number, { collected: number; total: number }>;

  // Score
  collectibleScore: number;

  // Coin spawning
  pendingCoins: PendingCoin[];
  spawnedCoinIds: Set<string>;

  // Animation state
  collectAnimations: CollectAnimation[];
}

export interface PendingCoin {
  coinId: string;
  position: Vector2D;
  areaIndex: number;
  spawnTime: number;
  requiredBananaIds: string[];
}

export interface CollectAnimation {
  id: string;
  type: CollectibleType;
  position: Vector2D;
  startTime: number;
  duration: number;
}

// ============================================
// State Creation
// ============================================

/**
 * Create initial collectible state for a course
 */
export function createCollectibleState(
  collectibles: Collectible[],
  areaCount: number = 10,
): CollectibleState {
  let totalBananas = 0;
  let totalCoins = 0;

  collectibles.forEach((c) => {
    if (c.type === "banana") totalBananas++;
    else if (c.type === "coin") totalCoins++;
  });

  // Initialize per-area tracking
  const areaBananaProgress = new Map<
    number,
    { collected: number; total: number }
  >();
  const areaCoinProgress = new Map<
    number,
    { collected: number; total: number }
  >();

  for (let i = 0; i < areaCount; i++) {
    areaBananaProgress.set(i, { collected: 0, total: 0 });
    areaCoinProgress.set(i, { collected: 0, total: 0 });
  }

  return {
    collectedIds: new Set(),
    totalBananas,
    totalCoins,
    bananasCollected: 0,
    coinsCollected: 0,
    areaBananaProgress,
    areaCoinProgress,
    collectibleScore: 0,
    pendingCoins: [],
    spawnedCoinIds: new Set(),
    collectAnimations: [],
  };
}

/**
 * Initialize collectible state from course areas
 */
export function initializeCollectibleStateFromAreas(
  areas: { collectibles: Collectible[]; areaNumber: number }[],
): CollectibleState {
  const allCollectibles: Collectible[] = [];
  let totalBananas = 0;
  let totalCoins = 0;

  const areaBananaProgress = new Map<
    number,
    { collected: number; total: number }
  >();
  const areaCoinProgress = new Map<
    number,
    { collected: number; total: number }
  >();

  areas.forEach((area, index) => {
    let areaBananas = 0;
    let areaCoins = 0;

    area.collectibles.forEach((c) => {
      allCollectibles.push(c);
      if (c.type === "banana") {
        totalBananas++;
        areaBananas++;
      } else if (c.type === "coin") {
        totalCoins++;
        areaCoins++;
      }
    });

    areaBananaProgress.set(index, { collected: 0, total: areaBananas });
    areaCoinProgress.set(index, { collected: 0, total: areaCoins });
  });

  return {
    collectedIds: new Set(),
    totalBananas,
    totalCoins,
    bananasCollected: 0,
    coinsCollected: 0,
    areaBananaProgress,
    areaCoinProgress,
    collectibleScore: 0,
    pendingCoins: [],
    spawnedCoinIds: new Set(),
    collectAnimations: [],
  };
}

// ============================================
// Collectible Body Creation
// ============================================

/**
 * Create collision filter for collectible sensor body
 */
export const COLLECTIBLE_COLLISION_FILTER = {
  category: COLLISION_CATEGORIES.COLLECTIBLE,
  mask: COLLISION_CATEGORIES.CART,
};

/**
 * Create a collectible sensor body (doesn't block cart, just detects overlap)
 */
export function createCollectibleBody(
  collectible: Collectible,
  config: CollectibleConfig = DEFAULT_COLLECTIBLE_CONFIG,
): Matter.Body {
  const body = Matter.Bodies.circle(
    collectible.position.x,
    collectible.position.y,
    config.sensorRadius,
    {
      isStatic: true,
      isSensor: true, // No physical collision, just detection
      label: `collectible_${collectible.id}`,
      collisionFilter: COLLECTIBLE_COLLISION_FILTER,
    },
  );

  // Store collectible data on body for retrieval in collision callback
  (body as CollectibleBody).collectibleData = collectible;

  return body;
}

// Extended body type with collectible data
interface CollectibleBody extends Matter.Body {
  collectibleData?: Collectible;
}

/**
 * Create all collectible bodies for a course area
 */
export function createAreaCollectibles(
  collectibles: Collectible[],
  world: Matter.World,
  config: CollectibleConfig = DEFAULT_COLLECTIBLE_CONFIG,
): Map<string, CollectibleEntity> {
  const entities = new Map<string, CollectibleEntity>();

  collectibles.forEach((collectible) => {
    const body = createCollectibleBody(collectible, config);
    Matter.World.add(world, body);

    entities.set(collectible.id, {
      body,
      collectible,
      isCollected: false,
      renderer: "collectible",
    });
  });

  return entities;
}

// ============================================
// Collection Logic
// ============================================

/**
 * Process collectible collection event
 */
export function collectItem(
  state: CollectibleState,
  collectibleId: string,
  collectible: Collectible,
  currentTime: number,
  config: CollectibleConfig = DEFAULT_COLLECTIBLE_CONFIG,
): {
  state: CollectibleState;
  pointsEarned: number;
  shouldSpawnCoins: { id: string; position: Vector2D }[];
} {
  // Already collected
  if (state.collectedIds.has(collectibleId)) {
    return { state, pointsEarned: 0, shouldSpawnCoins: [] };
  }

  const newState = { ...state };
  newState.collectedIds = new Set(state.collectedIds);
  newState.collectedIds.add(collectibleId);

  let pointsEarned = 0;
  const shouldSpawnCoins: { id: string; position: Vector2D }[] = [];

  if (collectible.type === "banana") {
    pointsEarned = collectible.value ?? config.bananaPoints;
    newState.bananasCollected++;

    // Check if any coins should spawn
    newState.pendingCoins.forEach((pending) => {
      if (
        pending.requiredBananaIds.includes(collectibleId) &&
        !newState.spawnedCoinIds.has(pending.coinId)
      ) {
        // Check if all required bananas are now collected
        const allCollected = pending.requiredBananaIds.every((id) =>
          newState.collectedIds.has(id),
        );
        if (allCollected) {
          newState.spawnedCoinIds.add(pending.coinId);
          shouldSpawnCoins.push({
            id: pending.coinId,
            position: pending.position,
          });
        }
      }
    });
  } else if (collectible.type === "coin") {
    pointsEarned = collectible.value ?? config.coinPoints;
    newState.coinsCollected++;
  }

  newState.collectibleScore += pointsEarned;

  // Add collection animation
  newState.collectAnimations = [
    ...state.collectAnimations,
    {
      id: collectibleId,
      type: collectible.type,
      position: { ...collectible.position },
      startTime: currentTime,
      duration: config.collectFadeTime,
    },
  ];

  return { state: newState, pointsEarned, shouldSpawnCoins };
}

/**
 * Check if all bananas in an area are collected
 */
export function isAreaBananasComplete(
  state: CollectibleState,
  areaIndex: number,
): boolean {
  const progress = state.areaBananaProgress.get(areaIndex);
  if (!progress) return true;
  return progress.collected >= progress.total;
}

/**
 * Check if all collectibles in the course are collected
 */
export function isAllCollected(state: CollectibleState): boolean {
  return (
    state.bananasCollected >= state.totalBananas &&
    state.coinsCollected >= state.totalCoins
  );
}

/**
 * Get collection progress as percentage (0-1)
 */
export function getCollectionProgress(state: CollectibleState): number {
  const total = state.totalBananas + state.totalCoins;
  if (total === 0) return 1;
  const collected = state.bananasCollected + state.coinsCollected;
  return collected / total;
}

/**
 * Get banana progress for display
 */
export function getBananaProgress(state: CollectibleState): {
  collected: number;
  total: number;
  percentage: number;
} {
  return {
    collected: state.bananasCollected,
    total: state.totalBananas,
    percentage:
      state.totalBananas > 0 ? state.bananasCollected / state.totalBananas : 1,
  };
}

// ============================================
// Coin Spawning Logic
// ============================================

/**
 * Setup pending coins that require preceding bananas
 * According to game plan: "Coins: Appear when all preceding bananas collected"
 */
export function setupCoinDependencies(
  collectibles: Collectible[],
  areaIndex: number,
): PendingCoin[] {
  const pendingCoins: PendingCoin[] = [];
  const bananaIds: string[] = [];

  // Sort collectibles by position (top to bottom for vertical scrolling)
  const sorted = [...collectibles].sort((a, b) => a.position.y - b.position.y);

  sorted.forEach((collectible) => {
    if (collectible.type === "banana") {
      bananaIds.push(collectible.id);
    } else if (
      collectible.type === "coin" &&
      collectible.requiresPrecedingBananas
    ) {
      // This coin requires all preceding bananas to be collected
      pendingCoins.push({
        coinId: collectible.id,
        position: collectible.position,
        areaIndex,
        spawnTime: 0,
        requiredBananaIds: [...bananaIds], // Copy current bananas
      });
    }
  });

  return pendingCoins;
}

// ============================================
// Animation Updates
// ============================================

/**
 * Update collectible animations (bobbing, rotation, fade)
 */
export function updateCollectibleAnimations(
  state: CollectibleState,
  currentTime: number,
): CollectibleState {
  // Filter out completed animations
  const activeAnimations = state.collectAnimations.filter(
    (anim) => currentTime - anim.startTime < anim.duration,
  );

  if (activeAnimations.length === state.collectAnimations.length) {
    return state;
  }

  return {
    ...state,
    collectAnimations: activeAnimations,
  };
}

/**
 * Calculate bob offset for collectible (visual animation)
 */
export function calculateBobOffset(
  currentTime: number,
  baseY: number,
  config: CollectibleConfig = DEFAULT_COLLECTIBLE_CONFIG,
): number {
  const cycle = (currentTime / 1000) * config.bobFrequency;
  return Math.sin(cycle * Math.PI * 2) * config.bobAmplitude;
}

/**
 * Calculate rotation for collectible (visual animation)
 */
export function calculateRotation(
  currentTime: number,
  config: CollectibleConfig = DEFAULT_COLLECTIBLE_CONFIG,
): number {
  return ((currentTime / 1000) * config.rotationSpeed) % 360;
}

// ============================================
// Reset Functions
// ============================================

/**
 * Reset collectible state (for course restart)
 */
export function resetCollectibleState(
  state: CollectibleState,
): CollectibleState {
  // Reset per-area progress
  const areaBananaProgress = new Map<
    number,
    { collected: number; total: number }
  >();
  const areaCoinProgress = new Map<
    number,
    { collected: number; total: number }
  >();

  state.areaBananaProgress.forEach((progress, key) => {
    areaBananaProgress.set(key, { collected: 0, total: progress.total });
  });

  state.areaCoinProgress.forEach((progress, key) => {
    areaCoinProgress.set(key, { collected: 0, total: progress.total });
  });

  return {
    collectedIds: new Set(),
    totalBananas: state.totalBananas,
    totalCoins: state.totalCoins,
    bananasCollected: 0,
    coinsCollected: 0,
    areaBananaProgress,
    areaCoinProgress,
    collectibleScore: 0,
    pendingCoins: [],
    spawnedCoinIds: new Set(),
    collectAnimations: [],
  };
}

/**
 * Reset collectibles back to checkpoint (partial reset)
 * Only resets collectibles after the checkpoint area
 */
export function resetCollectibleStateToCheckpoint(
  state: CollectibleState,
  checkpointAreaIndex: number,
  areaCollectibles: Map<number, Collectible[]>,
): CollectibleState {
  const newState = { ...state };
  newState.collectedIds = new Set(state.collectedIds);
  newState.spawnedCoinIds = new Set(state.spawnedCoinIds);

  // Remove collectibles from areas after checkpoint
  areaCollectibles.forEach((collectibles, areaIndex) => {
    if (areaIndex > checkpointAreaIndex) {
      collectibles.forEach((c) => {
        newState.collectedIds.delete(c.id);
        newState.spawnedCoinIds.delete(c.id);
      });

      // Reset area progress
      const bananaProgress = newState.areaBananaProgress.get(areaIndex);
      if (bananaProgress) {
        newState.areaBananaProgress.set(areaIndex, {
          collected: 0,
          total: bananaProgress.total,
        });
      }

      const coinProgress = newState.areaCoinProgress.get(areaIndex);
      if (coinProgress) {
        newState.areaCoinProgress.set(areaIndex, {
          collected: 0,
          total: coinProgress.total,
        });
      }
    }
  });

  // Recalculate totals
  newState.bananasCollected = 0;
  newState.coinsCollected = 0;
  newState.collectibleScore = 0;

  areaCollectibles.forEach((collectibles) => {
    collectibles.forEach((c) => {
      if (newState.collectedIds.has(c.id)) {
        if (c.type === "banana") {
          newState.bananasCollected++;
          newState.collectibleScore +=
            c.value ?? DEFAULT_COLLECTIBLE_CONFIG.bananaPoints;
        } else if (c.type === "coin") {
          newState.coinsCollected++;
          newState.collectibleScore +=
            c.value ?? DEFAULT_COLLECTIBLE_CONFIG.coinPoints;
        }
      }
    });
  });

  return newState;
}

// ============================================
// Collectible System (Game Engine)
// ============================================

/**
 * Collectible System for react-native-game-engine
 * Updates collectible animations and processes collection events
 */
export function CollectibleSystem(
  entities: GameEntities & {
    collectibleState?: CollectibleState;
    collectibles?: Map<string, CollectibleEntity>;
  },
  { time, dispatch }: GameEngineUpdateProps,
): GameEntities {
  const { collectibleState, collectibles } = entities;

  if (!collectibleState || !collectibles) {
    return entities;
  }

  // Update animations
  entities.collectibleState = updateCollectibleAnimations(
    collectibleState,
    time.current,
  );

  // Update visual bobbing for uncollected collectibles
  collectibles.forEach((entity, id) => {
    if (!entity.isCollected) {
      const bobOffset = calculateBobOffset(
        time.current,
        entity.collectible.position.y,
      );
      // Update body position for visual (sensor doesn't need exact position)
      Matter.Body.setPosition(entity.body, {
        x: entity.collectible.position.x,
        y: entity.collectible.position.y + bobOffset,
      });
    }
  });

  return entities;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get collectible by ID from entity map
 */
export function getCollectibleById(
  collectibles: Map<string, CollectibleEntity>,
  id: string,
): CollectibleEntity | undefined {
  return collectibles.get(id);
}

/**
 * Mark collectible as collected and remove from world
 */
export function removeCollectedItem(
  collectibles: Map<string, CollectibleEntity>,
  id: string,
  world: Matter.World,
): void {
  const entity = collectibles.get(id);
  if (entity && !entity.isCollected) {
    entity.isCollected = true;
    entity.collectionTime = Date.now();
    Matter.World.remove(world, entity.body);
  }
}

/**
 * Check if collectible ID is a banana
 */
export function isBananaCollectible(collectible: Collectible): boolean {
  return collectible.type === "banana";
}

/**
 * Check if collectible ID is a coin
 */
export function isCoinCollectible(collectible: Collectible): boolean {
  return collectible.type === "coin";
}

/**
 * Get summary stats for display
 */
export function getCollectibleStats(state: CollectibleState): {
  bananas: { collected: number; total: number };
  coins: { collected: number; total: number };
  score: number;
  completionPercent: number;
} {
  const totalItems = state.totalBananas + state.totalCoins;
  const collectedItems = state.bananasCollected + state.coinsCollected;

  return {
    bananas: {
      collected: state.bananasCollected,
      total: state.totalBananas,
    },
    coins: {
      collected: state.coinsCollected,
      total: state.totalCoins,
    },
    score: state.collectibleScore,
    completionPercent:
      totalItems > 0 ? (collectedItems / totalItems) * 100 : 100,
  };
}
