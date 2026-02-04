/**
 * useCartCourseGame Hook
 * Initializes and manages the Cart Course game state
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CAMERA_CONFIG } from "../data/constants";
import {
  MatterWorldInstance,
  createMatterWorld,
  setupCollisionHandler,
} from "../engine/MatterWorld";
import {
  TiltController,
  getTiltController,
  resetTiltController,
} from "../engine/TiltController";
import { createCartEntity, resetCartPosition } from "../entities/CartEntity";
import { createPlatformEntity } from "../entities/PlatformEntity";
import { createBoundaryWalls } from "../entities/WallEntity";
import {
  GameEntities,
  GameEvent,
  GameState,
  InputState,
  PlatformEntity,
  TiltInput,
} from "../types/cartCourse.types";

// ============================================
// Initial Game State
// ============================================

const INITIAL_GAME_STATE: GameState = {
  status: "idle",
  lives: 3,
  score: 0,
  elapsedTime: 0,
  currentAreaIndex: 0,
  totalAreas: 1,
  bananasCollected: 0,
  totalBananas: 0,
  isPaused: false,
  showBlowIndicator: false,
  isBlowing: false,
  lastCheckpoint: 0,
};

// ============================================
// Test Course Layout
// ============================================

interface CourseLayout {
  width: number;
  height: number;
  startPosition: { x: number; y: number };
  platforms: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  }>;
}

const TEST_COURSE: CourseLayout = {
  width: 800,
  height: 600,
  startPosition: { x: 200, y: 100 },
  platforms: [
    // Ground platform
    { id: "ground", x: 400, y: 550, width: 800, height: 40 },
    // Left ramp going down
    { id: "ramp1", x: 150, y: 450, width: 200, height: 20, rotation: 15 },
    // Flat platform
    { id: "plat1", x: 350, y: 400, width: 120, height: 20 },
    // Right ramp going down
    { id: "ramp2", x: 500, y: 350, width: 150, height: 20, rotation: -20 },
    // Upper platform
    { id: "plat2", x: 200, y: 250, width: 150, height: 20 },
  ],
};

// ============================================
// Hook Return Type
// ============================================

interface UseCartCourseGameReturn {
  entities: GameEntities | null;
  gameState: GameState;
  inputState: InputState;
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartGame: () => void;
  calibrateTilt: () => void;
  handleEvent: (event: GameEvent) => void;
}

// ============================================
// Create Initial Entities (Synchronous)
// ============================================

function createInitialEntities(): {
  entities: GameEntities;
  matterWorld: MatterWorldInstance;
} {
  // Create Matter.js world
  const matterWorld = createMatterWorld();
  const { engine, world } = matterWorld;

  // Create platforms
  const platforms = new Map<string, PlatformEntity>();
  TEST_COURSE.platforms.forEach((platformConfig) => {
    const platform = createPlatformEntity(platformConfig, world);
    platforms.set(platformConfig.id, platform);
  });

  // Create boundary walls
  const walls = createBoundaryWalls(
    TEST_COURSE.width,
    TEST_COURSE.height,
    world,
  );

  // Create cart
  const cart = createCartEntity(
    TEST_COURSE.startPosition.x,
    TEST_COURSE.startPosition.y,
    world,
  );

  // Create camera
  const camera = {
    position: { ...TEST_COURSE.startPosition },
    targetPosition: { ...TEST_COURSE.startPosition },
    zoom: DEFAULT_CAMERA_CONFIG.defaultZoom,
    targetZoom: DEFAULT_CAMERA_CONFIG.defaultZoom,
    bounds: {
      minX: 0,
      maxX: TEST_COURSE.width,
      minY: 0,
      maxY: TEST_COURSE.height,
    },
    config: DEFAULT_CAMERA_CONFIG,
    currentArea: null,
    areas: [],
    isTransitioning: false,
  };

  // Create empty bumpers and mechanisms maps
  const bumpers = new Map();
  const mechanisms = new Map();

  // Initial input state
  const initialInput: InputState = {
    tilt: { x: 0, y: 0, roll: 0, pitch: 0 },
    leftButton: false,
    rightButton: false,
    leftJoystick: { angle: 0, magnitude: 0 },
    rightJoystick: { angle: 0, magnitude: 0 },
    isBlowing: false,
  };

  // Create game entities
  const entities: GameEntities = {
    physics: { engine, world },
    cart,
    platforms,
    walls,
    bumpers,
    mechanisms,
    camera,
    elapsedTime: 0,
    input: initialInput,
  };

  return { entities, matterWorld };
}

// ============================================
// useCartCourseGame Hook
// ============================================

export function useCartCourseGame(): UseCartCourseGameReturn {
  // Use lazy initializer to create entities synchronously on first render
  const [{ entities, matterWorld }] = useState(() => {
    const result = createInitialEntities();
    return { entities: result.entities, matterWorld: result.matterWorld };
  });

  const [currentEntities, setEntities] = useState<GameEntities>(entities);
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [inputState, setInputState] = useState<InputState>({
    tilt: { x: 0, y: 0, pitch: 0, roll: 0 },
    leftButton: false,
    rightButton: false,
    leftJoystick: { angle: 0, magnitude: 0 },
    rightJoystick: { angle: 0, magnitude: 0 },
    isBlowing: false,
  });

  const matterWorldRef = useRef<MatterWorldInstance>(matterWorld);
  const tiltControllerRef = useRef<TiltController | null>(null);
  const cleanupCollisionRef = useRef<(() => void) | null>(null);

  // ============================================
  // Initialize Game
  // ============================================

  const initializeGame = useCallback(() => {
    // Clean up existing collision handler
    if (cleanupCollisionRef.current) {
      cleanupCollisionRef.current();
    }

    // Setup collision handler with the existing physics engine
    const { engine } = matterWorldRef.current;
    cleanupCollisionRef.current = setupCollisionHandler(engine, {
      onCrash: (type, _position) => {
        handleEvent({ type: "crash", crashType: type });
      },
      onCheckpoint: (index) => {
        handleEvent({ type: "checkpoint", index });
      },
      onCollectible: (id) => {
        handleEvent({ type: "collect", itemType: "banana", id });
      },
    });

    setGameState({ ...INITIAL_GAME_STATE, status: "idle" });
  }, []);

  // ============================================
  // Start Tilt Controller
  // ============================================

  const startTiltController = useCallback(async () => {
    const tiltController = getTiltController();
    tiltControllerRef.current = tiltController;

    await tiltController.start((tilt: TiltInput) => {
      setInputState((prev) => ({
        ...prev,
        tilt,
      }));
    });
  }, []);

  // ============================================
  // Initialize on Mount
  // ============================================

  useEffect(() => {
    initializeGame();
    startTiltController();

    return () => {
      // Cleanup
      if (matterWorldRef.current) {
        matterWorldRef.current.cleanup();
      }
      if (cleanupCollisionRef.current) {
        cleanupCollisionRef.current();
      }
      resetTiltController();
    };
  }, [initializeGame, startTiltController]);

  // ============================================
  // Game Controls
  // ============================================

  const startGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, status: "playing" }));
  }, []);

  const pauseGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, status: "paused", isPaused: true }));
  }, []);

  const resumeGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, status: "playing", isPaused: false }));
  }, []);

  const restartGame = useCallback(() => {
    // Reset cart position
    if (currentEntities?.cart) {
      resetCartPosition(
        currentEntities.cart,
        TEST_COURSE.startPosition.x,
        TEST_COURSE.startPosition.y,
      );
    }

    setGameState({
      ...INITIAL_GAME_STATE,
      status: "playing",
    });
  }, [currentEntities]);

  const calibrateTilt = useCallback(() => {
    if (tiltControllerRef.current) {
      tiltControllerRef.current.calibrate();
    }
  }, []);

  // ============================================
  // Event Handler
  // ============================================

  const handleEvent = useCallback(
    (event: GameEvent) => {
      switch (event.type) {
        case "crash":
          setGameState((prev) => {
            const newLives = prev.lives - 1;
            if (newLives <= 0) {
              return { ...prev, status: "complete", lives: 0 };
            }

            // Reset cart to last checkpoint
            if (currentEntities?.cart) {
              resetCartPosition(
                currentEntities.cart,
                TEST_COURSE.startPosition.x,
                TEST_COURSE.startPosition.y,
              );
            }

            return { ...prev, lives: newLives };
          });
          break;

        case "checkpoint":
          setGameState((prev) => ({
            ...prev,
            lastCheckpoint: event.index,
          }));
          break;

        case "collect":
          setGameState((prev) => ({
            ...prev,
            bananasCollected: prev.bananasCollected + 1,
            score: prev.score + 100,
          }));
          break;

        case "time-up":
          setGameState((prev) => ({ ...prev, status: "complete" }));
          break;

        case "complete":
          setGameState((prev) => ({ ...prev, status: "complete" }));
          break;

        case "pause":
          pauseGame();
          break;

        case "resume":
          resumeGame();
          break;

        case "restart":
          restartGame();
          break;
      }
    },
    [currentEntities, pauseGame, resumeGame, restartGame],
  );

  return {
    entities: currentEntities,
    gameState,
    inputState,
    startGame,
    pauseGame,
    resumeGame,
    restartGame,
    calibrateTilt,
    handleEvent,
  };
}
