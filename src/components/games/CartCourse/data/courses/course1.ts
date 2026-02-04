/**
 * Course 1: The Classic Run
 *
 * Introduction course with 10 areas teaching core mechanics.
 * Theme: Classic Donkey Kong arcade inspired
 * Difficulty: 1 (Easy)
 *
 * Area Breakdown:
 * 1. Tutorial - Basic ramps and bumpers
 * 2. First Gear - Introduction to L-button rotating gear
 * 3. Fan Platform - Blow/tap controlled lift
 * 4. Stairs Challenge - Multiple stairs with timing
 * 5. Fork in the Road - Choice between paths
 * 6. Lift Sequence - Multiple lift platforms
 * 7. Joystick Gear - Introduction to joystick control
 * 8. Launcher Introduction - First launcher platform
 * 9. Conveyor Gauntlet - Multiple conveyors
 * 10. Final Descent - Everything combined
 */

import {
  Area,
  Course,
  MechanismType,
  StaticObstacleType,
  SurfaceType,
} from "../../types/cartCourse.types";
import { DEFAULT_CAMERA_CONFIG } from "../constants";

// ============================================
// Course 1 Areas
// ============================================

/**
 * Area 1: Tutorial
 * Basic ramps and bumpers to teach tilt controls
 */
const AREA_1: Area = {
  id: "course1_area1",
  areaNumber: 1,
  name: "Tutorial",
  bounds: {
    id: "area1_bounds",
    minX: 0,
    maxX: 800,
    minY: 7200,
    maxY: 8000,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 30,
  obstacles: [
    // Starting platform
    {
      id: "c1_a1_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 7900 },
      size: { width: 200, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // First gentle ramp down
    {
      id: "c1_a1_ramp1",
      type: StaticObstacleType.RAMP,
      position: { x: 300, y: 7850 },
      size: { width: 200, height: 20 },
      rotation: -15,
      surfaceType: SurfaceType.NORMAL,
    },
    // Bumper wall (protective)
    {
      id: "c1_a1_bumper1",
      type: StaticObstacleType.BUMPER,
      position: { x: 500, y: 7750 },
      size: { width: 20, height: 100 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
      properties: { bounciness: 0.85 },
    },
    // Second platform
    {
      id: "c1_a1_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 350, y: 7700 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Second ramp (steeper)
    {
      id: "c1_a1_ramp2",
      type: StaticObstacleType.RAMP,
      position: { x: 200, y: 7620 },
      size: { width: 180, height: 20 },
      rotation: 20,
      surfaceType: SurfaceType.NORMAL,
    },
    // Landing platform with bumper
    {
      id: "c1_a1_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 7550 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Left wall bumper
    {
      id: "c1_a1_bumper2",
      type: StaticObstacleType.BUMPER,
      position: { x: 20, y: 7500 },
      size: { width: 20, height: 150 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
    // Final descent ramp
    {
      id: "c1_a1_ramp3",
      type: StaticObstacleType.RAMP,
      position: { x: 250, y: 7450 },
      size: { width: 250, height: 20 },
      rotation: -10,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit platform
    {
      id: "c1_a1_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 550, y: 7380 },
      size: { width: 200, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Walls
    {
      id: "c1_a1_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 7600 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a1_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 7600 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
  ],
  mechanisms: [],
  collectibles: [
    { id: "c1_a1_banana1", type: "banana", position: { x: 200, y: 7870 } },
    { id: "c1_a1_banana2", type: "banana", position: { x: 400, y: 7800 } },
    { id: "c1_a1_banana3", type: "banana", position: { x: 300, y: 7670 } },
    { id: "c1_a1_banana4", type: "banana", position: { x: 150, y: 7520 } },
    { id: "c1_a1_banana5", type: "banana", position: { x: 450, y: 7420 } },
  ],
  checkpoint: {
    id: "c1_checkpoint1",
    position: { x: 100, y: 7880 },
    rotation: 0,
    areaIndex: 0,
    flags: { autoSave: true, showTransition: false },
  },
};

/**
 * Area 2: First Gear
 * Introduction to L-button rotating gear mechanism
 */
const AREA_2: Area = {
  id: "course1_area2",
  areaNumber: 2,
  name: "First Gear",
  bounds: {
    id: "area2_bounds",
    minX: 0,
    maxX: 800,
    minY: 6400,
    maxY: 7200,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry platform from Area 1
    {
      id: "c1_a2_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 550, y: 7150 },
      size: { width: 200, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Ramp down
    {
      id: "c1_a2_ramp1",
      type: StaticObstacleType.RAMP,
      position: { x: 400, y: 7050 },
      size: { width: 200, height: 20 },
      rotation: 15,
      surfaceType: SurfaceType.NORMAL,
    },
    // Platform before gear
    {
      id: "c1_a2_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 6950 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Landing platform (gear will bridge to this)
    {
      id: "c1_a2_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 6800 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Second gear section
    {
      id: "c1_a2_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 6650 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit platform
    {
      id: "c1_a2_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 6500 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Walls
    {
      id: "c1_a2_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 6800 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a2_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 6800 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    // Pit hazard (if you miss the gear platform)
    {
      id: "c1_a2_pit1",
      type: StaticObstacleType.PIT,
      position: { x: 400, y: 6900 },
      size: { width: 150, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
  ],
  mechanisms: [
    // First rotating gear - press L to rotate clockwise
    {
      id: "c1_a2_gear1",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 350, y: 6870 },
      config: {
        controlType: "left_button",
        rotationSpeed: 60,
        rotationRange: { min: 0, max: 90 },
        armLength: 100,
        returnToNeutral: true,
        returnSpeed: 30,
      },
    },
    // Second rotating gear
    {
      id: "c1_a2_gear2",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 400, y: 6580 },
      config: {
        controlType: "left_button",
        rotationSpeed: 75,
        rotationRange: { min: -45, max: 45 },
        armLength: 90,
        returnToNeutral: true,
        returnSpeed: 40,
      },
    },
  ],
  collectibles: [
    { id: "c1_a2_banana1", type: "banana", position: { x: 500, y: 7100 } },
    { id: "c1_a2_banana2", type: "banana", position: { x: 250, y: 6920 } },
    { id: "c1_a2_banana3", type: "banana", position: { x: 650, y: 6770 } },
    { id: "c1_a2_banana4", type: "banana", position: { x: 300, y: 6620 } },
    { id: "c1_a2_banana5", type: "banana", position: { x: 650, y: 6470 } },
    // Coin appears after all bananas
    {
      id: "c1_a2_coin1",
      type: "coin",
      position: { x: 400, y: 6550 },
      value: 500,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c1_checkpoint2",
    position: { x: 550, y: 7130 },
    rotation: 0,
    areaIndex: 1,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 3: Fan Platform
 * Introduction to blow/tap controlled platform
 */
const AREA_3: Area = {
  id: "course1_area3",
  areaNumber: 3,
  name: "Fan Platform",
  bounds: {
    id: "area3_bounds",
    minX: 0,
    maxX: 800,
    minY: 5600,
    maxY: 6400,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 40,
  obstacles: [
    // Entry from Area 2
    {
      id: "c1_a3_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 6350 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Ramp to fan area
    {
      id: "c1_a3_ramp1",
      type: StaticObstacleType.RAMP,
      position: { x: 450, y: 6250 },
      size: { width: 180, height: 20 },
      rotation: 15,
      surfaceType: SurfaceType.NORMAL,
    },
    // Platform before first fan
    {
      id: "c1_a3_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 250, y: 6150 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Upper platform (fan destination)
    {
      id: "c1_a3_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 550, y: 5950 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Second fan section
    {
      id: "c1_a3_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 5800 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit platform
    {
      id: "c1_a3_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 5700 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Walls
    {
      id: "c1_a3_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 6000 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a3_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 6000 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    // Bumper protection
    {
      id: "c1_a3_bumper1",
      type: StaticObstacleType.BUMPER,
      position: { x: 100, y: 6050 },
      size: { width: 20, height: 100 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
  ],
  mechanisms: [
    // First fan platform - blow to lift
    {
      id: "c1_a3_fan1",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 6100 },
      config: {
        controlType: "blow",
        startPosition: { x: 400, y: 6100 },
        endPosition: { x: 400, y: 5920 },
        moveSpeed: 120,
      },
    },
    // Second fan platform
    {
      id: "c1_a3_fan2",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 5850 },
      config: {
        controlType: "blow",
        startPosition: { x: 400, y: 5850 },
        endPosition: { x: 400, y: 5720 },
        moveSpeed: 100,
      },
    },
  ],
  collectibles: [
    { id: "c1_a3_banana1", type: "banana", position: { x: 500, y: 6300 } },
    { id: "c1_a3_banana2", type: "banana", position: { x: 300, y: 6120 } },
    { id: "c1_a3_banana3", type: "banana", position: { x: 400, y: 6000 } },
    { id: "c1_a3_banana4", type: "banana", position: { x: 350, y: 5870 } },
    { id: "c1_a3_banana5", type: "banana", position: { x: 500, y: 5750 } },
    { id: "c1_a3_banana6", type: "banana", position: { x: 650, y: 5670 } },
  ],
  checkpoint: {
    id: "c1_checkpoint3",
    position: { x: 600, y: 6330 },
    rotation: 0,
    areaIndex: 2,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 4: Stairs Challenge
 * Multiple stairs requiring careful speed control
 */
const AREA_4: Area = {
  id: "course1_area4",
  areaNumber: 4,
  name: "Stairs Challenge",
  bounds: {
    id: "area4_bounds",
    minX: 0,
    maxX: 800,
    minY: 4800,
    maxY: 5600,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 50,
  obstacles: [
    // Entry platform
    {
      id: "c1_a4_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 5550 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // First staircase (going left)
    {
      id: "c1_a4_stairs1",
      type: StaticObstacleType.STAIRS,
      position: { x: 400, y: 5450 },
      size: { width: 300, height: 150 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Landing platform
    {
      id: "c1_a4_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 5350 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Second staircase (going right)
    {
      id: "c1_a4_stairs2",
      type: StaticObstacleType.STAIRS,
      position: { x: 350, y: 5200 },
      size: { width: 280, height: 180 },
      rotation: 180,
      surfaceType: SurfaceType.NORMAL,
    },
    // Middle platform
    {
      id: "c1_a4_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 5100 },
      size: { width: 160, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Third staircase (narrow)
    {
      id: "c1_a4_stairs3",
      type: StaticObstacleType.STAIRS,
      position: { x: 400, y: 4950 },
      size: { width: 250, height: 200 },
      rotation: 0,
      surfaceType: SurfaceType.ROUGH,
    },
    // Exit platform
    {
      id: "c1_a4_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 4850 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Walls
    {
      id: "c1_a4_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 5200 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a4_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 5200 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    // Protective bumpers
    {
      id: "c1_a4_bumper1",
      type: StaticObstacleType.BUMPER,
      position: { x: 750, y: 5350 },
      size: { width: 20, height: 100 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
  ],
  mechanisms: [],
  collectibles: [
    { id: "c1_a4_banana1", type: "banana", position: { x: 550, y: 5520 } },
    { id: "c1_a4_banana2", type: "banana", position: { x: 350, y: 5400 } },
    { id: "c1_a4_banana3", type: "banana", position: { x: 200, y: 5320 } },
    { id: "c1_a4_banana4", type: "banana", position: { x: 450, y: 5150 } },
    { id: "c1_a4_banana5", type: "banana", position: { x: 650, y: 5070 } },
    { id: "c1_a4_banana6", type: "banana", position: { x: 350, y: 4920 } },
    { id: "c1_a4_banana7", type: "banana", position: { x: 200, y: 4820 } },
  ],
  checkpoint: {
    id: "c1_checkpoint4",
    position: { x: 600, y: 5530 },
    rotation: 0,
    areaIndex: 3,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 5: Fork in the Road
 * Choice between two paths - left has more bananas, right is faster
 */
const AREA_5: Area = {
  id: "course1_area5",
  areaNumber: 5,
  name: "Fork in the Road",
  bounds: {
    id: "area5_bounds",
    minX: 0,
    maxX: 800,
    minY: 4000,
    maxY: 4800,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry from Area 4
    {
      id: "c1_a5_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 4750 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Central divider
    {
      id: "c1_a5_wall_center",
      type: StaticObstacleType.WALL,
      position: { x: 400, y: 4500 },
      size: { width: 20, height: 400 },
      rotation: 0,
    },
    // LEFT PATH (more bananas, harder)
    {
      id: "c1_a5_plat_left1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 4600 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c1_a5_ramp_left1",
      type: StaticObstacleType.RAMP,
      position: { x: 200, y: 4500 },
      size: { width: 120, height: 20 },
      rotation: -20,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c1_a5_plat_left2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 4400 },
      size: { width: 140, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c1_a5_plat_left3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 4250 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.STICKY,
    },
    // RIGHT PATH (faster, fewer bananas)
    {
      id: "c1_a5_plat_right1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 4650 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c1_a5_ramp_right1",
      type: StaticObstacleType.RAMP,
      position: { x: 600, y: 4450 },
      size: { width: 200, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c1_a5_plat_right2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 4300 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Merge point
    {
      id: "c1_a5_plat_merge",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 4100 },
      size: { width: 300, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Walls
    {
      id: "c1_a5_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 4400 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a5_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 4400 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
  ],
  mechanisms: [
    // Lift on left path
    {
      id: "c1_a5_lift1",
      type: MechanismType.L_LIFT_PLATFORM,
      position: { x: 180, y: 4300 },
      config: {
        controlType: "left_button",
        startPosition: { x: 180, y: 4300 },
        endPosition: { x: 180, y: 4150 },
        moveSpeed: 80,
      },
    },
  ],
  collectibles: [
    // Left path bananas (8 total)
    { id: "c1_a5_banana_l1", type: "banana", position: { x: 200, y: 4720 } },
    { id: "c1_a5_banana_l2", type: "banana", position: { x: 150, y: 4570 } },
    { id: "c1_a5_banana_l3", type: "banana", position: { x: 200, y: 4470 } },
    { id: "c1_a5_banana_l4", type: "banana", position: { x: 150, y: 4370 } },
    { id: "c1_a5_banana_l5", type: "banana", position: { x: 200, y: 4320 } },
    { id: "c1_a5_banana_l6", type: "banana", position: { x: 180, y: 4220 } },
    { id: "c1_a5_banana_l7", type: "banana", position: { x: 150, y: 4170 } },
    { id: "c1_a5_banana_l8", type: "banana", position: { x: 250, y: 4120 } },
    // Right path bananas (3 total)
    { id: "c1_a5_banana_r1", type: "banana", position: { x: 600, y: 4620 } },
    { id: "c1_a5_banana_r2", type: "banana", position: { x: 650, y: 4420 } },
    { id: "c1_a5_banana_r3", type: "banana", position: { x: 650, y: 4270 } },
    // Coin at merge point
    {
      id: "c1_a5_coin1",
      type: "coin",
      position: { x: 400, y: 4070 },
      value: 500,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c1_checkpoint5",
    position: { x: 150, y: 4730 },
    rotation: 0,
    areaIndex: 4,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 6: Lift Sequence
 * Multiple lift platforms in sequence
 */
const AREA_6: Area = {
  id: "course1_area6",
  areaNumber: 6,
  name: "Lift Sequence",
  bounds: {
    id: "area6_bounds",
    minX: 0,
    maxX: 800,
    minY: 3200,
    maxY: 4000,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 55,
  obstacles: [
    // Entry platform
    {
      id: "c1_a6_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 3950 },
      size: { width: 200, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Intermediate platforms for lifts
    {
      id: "c1_a6_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 3750 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c1_a6_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 3550 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c1_a6_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 3350 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit platform
    {
      id: "c1_a6_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 3250 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Walls
    {
      id: "c1_a6_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 3600 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a6_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 3600 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    // Bumpers
    {
      id: "c1_a6_bumper1",
      type: StaticObstacleType.BUMPER,
      position: { x: 400, y: 3800 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
  ],
  mechanisms: [
    // Lift 1 - L button
    {
      id: "c1_a6_lift1",
      type: MechanismType.L_LIFT_PLATFORM,
      position: { x: 350, y: 3850 },
      config: {
        controlType: "left_button",
        startPosition: { x: 350, y: 3850 },
        endPosition: { x: 350, y: 3700 },
        moveSpeed: 100,
      },
    },
    // Lift 2 - R button
    {
      id: "c1_a6_lift2",
      type: MechanismType.R_LIFT_PLATFORM,
      position: { x: 400, y: 3650 },
      config: {
        controlType: "right_button",
        startPosition: { x: 400, y: 3650 },
        endPosition: { x: 400, y: 3500 },
        moveSpeed: 90,
      },
    },
    // Lift 3 - L button
    {
      id: "c1_a6_lift3",
      type: MechanismType.L_LIFT_PLATFORM,
      position: { x: 350, y: 3450 },
      config: {
        controlType: "left_button",
        startPosition: { x: 350, y: 3450 },
        endPosition: { x: 350, y: 3300 },
        moveSpeed: 80,
      },
    },
  ],
  collectibles: [
    { id: "c1_a6_banana1", type: "banana", position: { x: 450, y: 3920 } },
    { id: "c1_a6_banana2", type: "banana", position: { x: 350, y: 3770 } },
    { id: "c1_a6_banana3", type: "banana", position: { x: 200, y: 3720 } },
    { id: "c1_a6_banana4", type: "banana", position: { x: 400, y: 3570 } },
    { id: "c1_a6_banana5", type: "banana", position: { x: 700, y: 3520 } },
    { id: "c1_a6_banana6", type: "banana", position: { x: 350, y: 3370 } },
    { id: "c1_a6_banana7", type: "banana", position: { x: 200, y: 3320 } },
    { id: "c1_a6_banana8", type: "banana", position: { x: 650, y: 3220 } },
  ],
  checkpoint: {
    id: "c1_checkpoint6",
    position: { x: 400, y: 3930 },
    rotation: 0,
    areaIndex: 5,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 7: Joystick Gear
 * Introduction to joystick-controlled gear
 */
const AREA_7: Area = {
  id: "course1_area7",
  areaNumber: 7,
  name: "Joystick Gear",
  bounds: {
    id: "area7_bounds",
    minX: 0,
    maxX: 800,
    minY: 2400,
    maxY: 3200,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 50,
  obstacles: [
    // Entry platform
    {
      id: "c1_a7_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 3150 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Pre-gear platform
    {
      id: "c1_a7_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 3000 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Post-gear platform
    {
      id: "c1_a7_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 2800 },
      size: { width: 140, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Second joystick gear section
    {
      id: "c1_a7_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 2600 },
      size: { width: 130, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit platform
    {
      id: "c1_a7_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 2500 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Walls
    {
      id: "c1_a7_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 2800 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a7_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 2800 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    // Spikes hazard
    {
      id: "c1_a7_spikes1",
      type: StaticObstacleType.SPIKES,
      position: { x: 400, y: 2950 },
      size: { width: 100, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
  ],
  mechanisms: [
    // First joystick gear (left stick)
    {
      id: "c1_a7_jgear1",
      type: MechanismType.LEFT_STICK_GEAR,
      position: { x: 400, y: 2900 },
      config: {
        controlType: "left_joystick",
        rotationSpeed: 90,
        rotationRange: { min: -60, max: 60 },
        armLength: 110,
        returnToNeutral: true,
      },
    },
    // Second joystick gear (right stick)
    {
      id: "c1_a7_jgear2",
      type: MechanismType.RIGHT_STICK_GEAR,
      position: { x: 400, y: 2650 },
      config: {
        controlType: "right_joystick",
        rotationSpeed: 100,
        rotationRange: { min: -45, max: 45 },
        armLength: 100,
        returnToNeutral: true,
      },
    },
  ],
  collectibles: [
    { id: "c1_a7_banana1", type: "banana", position: { x: 550, y: 3120 } },
    { id: "c1_a7_banana2", type: "banana", position: { x: 250, y: 2970 } },
    { id: "c1_a7_banana3", type: "banana", position: { x: 500, y: 2850 } },
    { id: "c1_a7_banana4", type: "banana", position: { x: 700, y: 2770 } },
    { id: "c1_a7_banana5", type: "banana", position: { x: 300, y: 2700 } },
    { id: "c1_a7_banana6", type: "banana", position: { x: 200, y: 2570 } },
    { id: "c1_a7_banana7", type: "banana", position: { x: 650, y: 2470 } },
    {
      id: "c1_a7_coin1",
      type: "coin",
      position: { x: 400, y: 2750 },
      value: 500,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c1_checkpoint7",
    position: { x: 600, y: 3130 },
    rotation: 0,
    areaIndex: 6,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 8: Launcher Introduction
 * First launcher platform usage
 */
const AREA_8: Area = {
  id: "course1_area8",
  areaNumber: 8,
  name: "Launcher Introduction",
  bounds: {
    id: "area8_bounds",
    minX: 0,
    maxX: 800,
    minY: 1600,
    maxY: 2400,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry platform
    {
      id: "c1_a8_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 2350 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Pre-launcher platform
    {
      id: "c1_a8_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 2200 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Landing platform after first launch
    {
      id: "c1_a8_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 2000 },
      size: { width: 200, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Second launcher destination
    {
      id: "c1_a8_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 1800 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit platform
    {
      id: "c1_a8_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 1700 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Walls
    {
      id: "c1_a8_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 2000 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a8_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 2000 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    // Bumper walls for safety
    {
      id: "c1_a8_bumper1",
      type: StaticObstacleType.BUMPER,
      position: { x: 750, y: 2050 },
      size: { width: 20, height: 100 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
    {
      id: "c1_a8_bumper2",
      type: StaticObstacleType.BUMPER,
      position: { x: 50, y: 1850 },
      size: { width: 20, height: 100 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
  ],
  mechanisms: [
    // First launcher - horizontal
    {
      id: "c1_a8_launcher1",
      type: MechanismType.R_LAUNCHER,
      position: { x: 200, y: 2150 },
      config: {
        controlType: "right_button",
        launchForce: 12,
        chargeTime: 1.2,
        launchDirection: { x: 1, y: -0.5 },
      },
    },
    // Second launcher - angled upward
    {
      id: "c1_a8_launcher2",
      type: MechanismType.R_LAUNCHER,
      position: { x: 500, y: 1950 },
      config: {
        controlType: "right_button",
        launchForce: 10,
        chargeTime: 1.0,
        launchDirection: { x: -0.7, y: -0.7 },
      },
    },
  ],
  collectibles: [
    { id: "c1_a8_banana1", type: "banana", position: { x: 550, y: 2320 } },
    { id: "c1_a8_banana2", type: "banana", position: { x: 250, y: 2170 } },
    { id: "c1_a8_banana3", type: "banana", position: { x: 400, y: 2080 } },
    { id: "c1_a8_banana4", type: "banana", position: { x: 650, y: 1970 } },
    { id: "c1_a8_banana5", type: "banana", position: { x: 350, y: 1880 } },
    { id: "c1_a8_banana6", type: "banana", position: { x: 250, y: 1770 } },
    { id: "c1_a8_banana7", type: "banana", position: { x: 650, y: 1670 } },
  ],
  checkpoint: {
    id: "c1_checkpoint8",
    position: { x: 600, y: 2330 },
    rotation: 0,
    areaIndex: 7,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 9: Conveyor Gauntlet
 * Multiple conveyors requiring timing
 */
const AREA_9: Area = {
  id: "course1_area9",
  areaNumber: 9,
  name: "Conveyor Gauntlet",
  bounds: {
    id: "area9_bounds",
    minX: 0,
    maxX: 800,
    minY: 800,
    maxY: 1600,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 50,
  obstacles: [
    // Entry platform
    {
      id: "c1_a9_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 1550 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Safe platforms between conveyors
    {
      id: "c1_a9_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 1350 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c1_a9_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 1150 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c1_a9_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 950 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit platform
    {
      id: "c1_a9_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 850 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Walls
    {
      id: "c1_a9_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 1200 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a9_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 1200 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    // Pit hazards
    {
      id: "c1_a9_pit1",
      type: StaticObstacleType.PIT,
      position: { x: 400, y: 1450 },
      size: { width: 200, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
    {
      id: "c1_a9_pit2",
      type: StaticObstacleType.PIT,
      position: { x: 400, y: 1050 },
      size: { width: 200, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
  ],
  mechanisms: [
    // Conveyor 1 - moving right
    {
      id: "c1_a9_conv1",
      type: MechanismType.CONVEYOR,
      position: { x: 350, y: 1450 },
      config: {
        controlType: "auto",
        moveSpeed: 100,
      },
    },
    // Conveyor 2 - moving left
    {
      id: "c1_a9_conv2",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 1250 },
      config: {
        controlType: "auto",
        moveSpeed: -80,
      },
    },
    // Conveyor 3 - moving right (fast)
    {
      id: "c1_a9_conv3",
      type: MechanismType.CONVEYOR,
      position: { x: 350, y: 1050 },
      config: {
        controlType: "auto",
        moveSpeed: 120,
      },
    },
  ],
  collectibles: [
    { id: "c1_a9_banana1", type: "banana", position: { x: 550, y: 1520 } },
    { id: "c1_a9_banana2", type: "banana", position: { x: 350, y: 1420 } },
    { id: "c1_a9_banana3", type: "banana", position: { x: 150, y: 1320 } },
    { id: "c1_a9_banana4", type: "banana", position: { x: 400, y: 1220 } },
    { id: "c1_a9_banana5", type: "banana", position: { x: 650, y: 1120 } },
    { id: "c1_a9_banana6", type: "banana", position: { x: 350, y: 1020 } },
    { id: "c1_a9_banana7", type: "banana", position: { x: 150, y: 920 } },
    { id: "c1_a9_banana8", type: "banana", position: { x: 650, y: 820 } },
    {
      id: "c1_a9_coin1",
      type: "coin",
      position: { x: 400, y: 1150 },
      value: 500,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c1_checkpoint9",
    position: { x: 600, y: 1530 },
    rotation: 0,
    areaIndex: 8,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 10: Final Descent
 * Everything combined - the final challenge
 */
const AREA_10: Area = {
  id: "course1_area10",
  areaNumber: 10,
  name: "Final Descent",
  bounds: {
    id: "area10_bounds",
    minX: 0,
    maxX: 800,
    minY: 0,
    maxY: 800,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 60,
  obstacles: [
    // Entry platform
    {
      id: "c1_a10_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 750 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Series of narrow platforms
    {
      id: "c1_a10_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 650 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c1_a10_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 500, y: 500 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c1_a10_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 350 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Goal platform
    {
      id: "c1_a10_goal",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 150 },
      size: { width: 250, height: 30 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c1_a10_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 400 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    {
      id: "c1_a10_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 780, y: 400 },
      size: { width: 20, height: 800 },
      rotation: 0,
    },
    // Multiple hazards
    {
      id: "c1_a10_spikes1",
      type: StaticObstacleType.SPIKES,
      position: { x: 350, y: 600 },
      size: { width: 80, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
    {
      id: "c1_a10_pit1",
      type: StaticObstacleType.PIT,
      position: { x: 350, y: 250 },
      size: { width: 100, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
    // Protective bumpers
    {
      id: "c1_a10_bumper1",
      type: StaticObstacleType.BUMPER,
      position: { x: 50, y: 550 },
      size: { width: 20, height: 100 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
    {
      id: "c1_a10_bumper2",
      type: StaticObstacleType.BUMPER,
      position: { x: 750, y: 400 },
      size: { width: 20, height: 100 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
  ],
  mechanisms: [
    // Rotating gear for timing
    {
      id: "c1_a10_gear1",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 400, y: 580 },
      config: {
        controlType: "left_button",
        rotationSpeed: 100,
        rotationRange: { min: -60, max: 60 },
        armLength: 80,
        returnToNeutral: true,
      },
    },
    // Fan platform
    {
      id: "c1_a10_fan1",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 350, y: 420 },
      config: {
        controlType: "blow",
        startPosition: { x: 350, y: 420 },
        endPosition: { x: 350, y: 300 },
        moveSpeed: 100,
      },
    },
    // Final launcher to goal
    {
      id: "c1_a10_launcher1",
      type: MechanismType.R_LAUNCHER,
      position: { x: 200, y: 300 },
      config: {
        controlType: "right_button",
        launchForce: 8,
        chargeTime: 0.8,
        launchDirection: { x: 0.7, y: -0.5 },
      },
    },
  ],
  collectibles: [
    { id: "c1_a10_banana1", type: "banana", position: { x: 550, y: 720 } },
    { id: "c1_a10_banana2", type: "banana", position: { x: 250, y: 620 } },
    { id: "c1_a10_banana3", type: "banana", position: { x: 450, y: 550 } },
    { id: "c1_a10_banana4", type: "banana", position: { x: 550, y: 470 } },
    { id: "c1_a10_banana5", type: "banana", position: { x: 350, y: 380 } },
    { id: "c1_a10_banana6", type: "banana", position: { x: 250, y: 320 } },
    { id: "c1_a10_banana7", type: "banana", position: { x: 450, y: 200 } },
    // Final coin at goal
    {
      id: "c1_a10_coin1",
      type: "coin",
      position: { x: 400, y: 120 },
      value: 1000,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c1_checkpoint10",
    position: { x: 600, y: 730 },
    rotation: 0,
    areaIndex: 9,
    flags: { autoSave: true, showTransition: true },
  },
};

// ============================================
// Export Course 1 Areas
// ============================================

export const COURSE_1_AREAS: Area[] = [
  AREA_1,
  AREA_2,
  AREA_3,
  AREA_4,
  AREA_5,
  AREA_6,
  AREA_7,
  AREA_8,
  AREA_9,
  AREA_10,
];

// ============================================
// Course 1 Definition
// ============================================

export const COURSE_1: Course = {
  id: "course_1",
  name: "The Classic Run",
  description:
    "An introduction to Cart Course. Learn the basics of tilt controls, mechanisms, and precision platforming.",
  theme: "classic",

  // Dimensions
  width: 800,
  height: 8000,

  // Areas
  areas: COURSE_1_AREAS,

  // Visual layers
  backgroundLayers: [
    {
      id: "bg_sky",
      color: "#1a1a2e",
      parallaxFactor: 0,
      repeatX: true,
      repeatY: true,
      zIndex: 0,
    },
    {
      id: "bg_girders",
      color: "#2a2a3e",
      parallaxFactor: 0.2,
      repeatX: true,
      repeatY: true,
      zIndex: 1,
    },
  ],

  // Camera
  cameraConfig: {
    ...DEFAULT_CAMERA_CONFIG,
    followMode: "ahead",
    followSmoothing: 0.08,
    lookAheadDistance: 80,
    autoZoom: true,
    zoomRange: { min: 0.9, max: 1.1 },
  },

  // Difficulty
  difficulty: 1,

  // Spawn
  startPosition: { x: 100, y: 7880 },
  startRotation: 0,

  // Timing
  parTime: 420, // 7 minutes
  maxTime: 600, // 10 minutes

  // Scoring
  totalBananas: 68, // Sum of all bananas across areas
  totalCoins: 6, // Sum of all coins
};
