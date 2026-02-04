/**
 * Course 3: Expert Classic
 *
 * Expert variant of the Classic theme (Course 1) with:
 * - Narrower platforms (30% smaller)
 * - Removed safety bumpers
 * - Faster mechanism speeds (1.5x)
 * - Tighter timing requirements
 * - More challenging collectible placement
 *
 * Total Areas: 10
 * Difficulty: 3 (Hard)
 * Par Time: 360 seconds (6 minutes)
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
// Course 3 Areas - Expert Classic
// ============================================

/**
 * Area 1: Expert Start
 * Narrow platforms, no bumpers
 */
const AREA_1: Area = {
  id: "course3_area1",
  areaNumber: 1,
  name: "Expert Start",
  bounds: {
    id: "c3_a1_bounds",
    minX: 0,
    maxX: 800,
    minY: 7200,
    maxY: 8000,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 25,
  obstacles: [
    // Narrow starting platform (30% smaller than Course 1)
    {
      id: "c3_a1_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 7900 },
      size: { width: 140, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // First narrow ramp
    {
      id: "c3_a1_ramp1",
      type: StaticObstacleType.RAMP,
      position: { x: 280, y: 7850 },
      size: { width: 140, height: 20 },
      rotation: -18,
      surfaceType: SurfaceType.NORMAL,
    },
    // NO BUMPERS in expert mode - straight wall
    {
      id: "c3_a1_wall1",
      type: StaticObstacleType.WALL,
      position: { x: 500, y: 7750 },
      size: { width: 20, height: 100 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow second platform
    {
      id: "c3_a1_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 350, y: 7700 },
      size: { width: 126, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Second ramp (steeper)
    {
      id: "c3_a1_ramp2",
      type: StaticObstacleType.RAMP,
      position: { x: 200, y: 7620 },
      size: { width: 126, height: 20 },
      rotation: 25,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow landing
    {
      id: "c3_a1_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 7550 },
      size: { width: 105, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // No bumper - just wall
    {
      id: "c3_a1_wall2",
      type: StaticObstacleType.WALL,
      position: { x: 20, y: 7500 },
      size: { width: 20, height: 150 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Final descent ramp
    {
      id: "c3_a1_ramp3",
      type: StaticObstacleType.RAMP,
      position: { x: 250, y: 7450 },
      size: { width: 175, height: 20 },
      rotation: -12,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow exit platform
    {
      id: "c3_a1_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 500, y: 7380 },
      size: { width: 140, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Final narrow transition
    {
      id: "c3_a1_ramp4",
      type: StaticObstacleType.RAMP,
      position: { x: 650, y: 7300 },
      size: { width: 140, height: 20 },
      rotation: -20,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [],
  collectibles: [
    {
      id: "c3_a1_b1",
      type: "banana",
      position: { x: 150, y: 7870 },
      value: 100,
    },
    {
      id: "c3_a1_b2",
      type: "banana",
      position: { x: 320, y: 7820 },
      value: 100,
    },
    {
      id: "c3_a1_b3",
      type: "banana",
      position: { x: 380, y: 7670 },
      value: 100,
    },
    {
      id: "c3_a1_b4",
      type: "banana",
      position: { x: 180, y: 7590 },
      value: 100,
    },
    {
      id: "c3_a1_b5",
      type: "banana",
      position: { x: 100, y: 7520 },
      value: 100,
    },
    {
      id: "c3_a1_b6",
      type: "banana",
      position: { x: 350, y: 7420 },
      value: 100,
    },
    {
      id: "c3_a1_b7",
      type: "banana",
      position: { x: 550, y: 7350 },
      value: 100,
    },
    {
      id: "c3_a1_coin",
      type: "coin",
      position: { x: 250, y: 7600 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint1",
    position: { x: 100, y: 7880 },
    rotation: 0,
    areaIndex: 0,
    flags: { autoSave: true, showTransition: false },
  },
};

/**
 * Area 2: Fast Gear
 * Faster rotating gear with narrow platforms
 */
const AREA_2: Area = {
  id: "course3_area2",
  areaNumber: 2,
  name: "Fast Gear",
  bounds: {
    id: "c3_a2_bounds",
    minX: 0,
    maxX: 800,
    minY: 6400,
    maxY: 7200,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 30,
  obstacles: [
    // Entry from Area 1
    {
      id: "c3_a2_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 7150 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow approach
    {
      id: "c3_a2_ramp1",
      type: StaticObstacleType.RAMP,
      position: { x: 550, y: 7050 },
      size: { width: 120, height: 20 },
      rotation: 15,
      surfaceType: SurfaceType.NORMAL,
    },
    // Gear mount pillar
    {
      id: "c3_a2_pillar",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 6750 },
      size: { width: 40, height: 150 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Narrow exit platform
    {
      id: "c3_a2_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 6550 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [
    // Fast rotating gear (1.5x speed)
    {
      id: "c3_a2_gear",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 400, y: 6850 },
      config: {
        radius: 70,
        angularVelocity: 0.03, // 1.5x of normal 0.02
        friction: 0.7,
        segments: 8,
      },
    },
  ],
  collectibles: [
    {
      id: "c3_a2_b1",
      type: "banana",
      position: { x: 650, y: 7120 },
      value: 100,
    },
    {
      id: "c3_a2_b2",
      type: "banana",
      position: { x: 500, y: 7020 },
      value: 100,
    },
    {
      id: "c3_a2_b3",
      type: "banana",
      position: { x: 330, y: 6850 },
      value: 100,
    },
    {
      id: "c3_a2_b4",
      type: "banana",
      position: { x: 470, y: 6850 },
      value: 100,
    },
    {
      id: "c3_a2_b5",
      type: "banana",
      position: { x: 280, y: 6700 },
      value: 100,
    },
    {
      id: "c3_a2_b6",
      type: "banana",
      position: { x: 150, y: 6520 },
      value: 100,
    },
    {
      id: "c3_a2_coin",
      type: "coin",
      position: { x: 400, y: 6850 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint2",
    position: { x: 700, y: 7130 },
    rotation: 0,
    areaIndex: 1,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 3: Wind Tunnel
 * Stronger fans with less landing room
 */
const AREA_3: Area = {
  id: "course3_area3",
  areaNumber: 3,
  name: "Wind Tunnel",
  bounds: {
    id: "c3_a3_bounds",
    minX: 0,
    maxX: 800,
    minY: 5600,
    maxY: 6400,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 35,
  obstacles: [
    // Entry platform
    {
      id: "c3_a3_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 6350 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow ledge 1
    {
      id: "c3_a3_ledge1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 300, y: 6200 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow ledge 2
    {
      id: "c3_a3_ledge2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 500, y: 6050 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit
    {
      id: "c3_a3_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 5700 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [
    // Stronger fans (1.5x force)
    {
      id: "c3_a3_fan1",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 6300 },
      config: {
        force: 0.0015,
        range: 200,
        direction: 0,
      },
    },
    {
      id: "c3_a3_fan2",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 600, y: 5950 },
      config: {
        force: 0.0018,
        range: 220,
        direction: 0,
      },
    },
    {
      id: "c3_a3_fan3",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 5800 },
      config: {
        force: 0.002,
        range: 180,
        direction: 15,
      },
    },
  ],
  collectibles: [
    {
      id: "c3_a3_b1",
      type: "banana",
      position: { x: 200, y: 6320 },
      value: 100,
    },
    {
      id: "c3_a3_b2",
      type: "banana",
      position: { x: 400, y: 6180 },
      value: 100,
    },
    {
      id: "c3_a3_b3",
      type: "banana",
      position: { x: 400, y: 6100 },
      value: 100,
    },
    {
      id: "c3_a3_b4",
      type: "banana",
      position: { x: 600, y: 5900 },
      value: 100,
    },
    {
      id: "c3_a3_b5",
      type: "banana",
      position: { x: 600, y: 5820 },
      value: 100,
    },
    {
      id: "c3_a3_b6",
      type: "banana",
      position: { x: 650, y: 5670 },
      value: 100,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint3",
    position: { x: 150, y: 6330 },
    rotation: 0,
    areaIndex: 2,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 4: Precision Stairs
 * Very narrow stairs with ice section
 */
const AREA_4: Area = {
  id: "course3_area4",
  areaNumber: 4,
  name: "Precision Stairs",
  bounds: {
    id: "c3_a4_bounds",
    minX: 0,
    maxX: 800,
    minY: 4800,
    maxY: 5600,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 40,
  obstacles: [
    // Entry
    {
      id: "c3_a4_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 5550 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow stairs descending
    {
      id: "c3_a4_stair1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 620, y: 5480 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a4_stair2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 540, y: 5410 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a4_stair3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 460, y: 5340 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a4_stair4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 380, y: 5270 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a4_stair5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 300, y: 5200 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a4_stair6",
      type: StaticObstacleType.PLATFORM,
      position: { x: 220, y: 5130 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Middle platform
    {
      id: "c3_a4_mid",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 5060 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Ice section
    {
      id: "c3_a4_ice1",
      type: StaticObstacleType.RAMP,
      position: { x: 220, y: 5000 },
      size: { width: 100, height: 15 },
      rotation: 15,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c3_a4_ice2",
      type: StaticObstacleType.RAMP,
      position: { x: 320, y: 4940 },
      size: { width: 100, height: 15 },
      rotation: 15,
      surfaceType: SurfaceType.SLIPPERY,
    },
    // Exit
    {
      id: "c3_a4_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 450, y: 4880 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [],
  collectibles: [
    {
      id: "c3_a4_b1",
      type: "banana",
      position: { x: 620, y: 5450 },
      value: 100,
    },
    {
      id: "c3_a4_b2",
      type: "banana",
      position: { x: 540, y: 5380 },
      value: 100,
    },
    {
      id: "c3_a4_b3",
      type: "banana",
      position: { x: 460, y: 5310 },
      value: 100,
    },
    {
      id: "c3_a4_b4",
      type: "banana",
      position: { x: 380, y: 5240 },
      value: 100,
    },
    {
      id: "c3_a4_b5",
      type: "banana",
      position: { x: 300, y: 5170 },
      value: 100,
    },
    {
      id: "c3_a4_b6",
      type: "banana",
      position: { x: 220, y: 5100 },
      value: 100,
    },
    {
      id: "c3_a4_coin",
      type: "coin",
      position: { x: 270, y: 4970 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint4",
    position: { x: 700, y: 5530 },
    rotation: 0,
    areaIndex: 3,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 5: Dangerous Fork
 * Two paths with different surface types
 */
const AREA_5: Area = {
  id: "course3_area5",
  areaNumber: 5,
  name: "Dangerous Fork",
  bounds: {
    id: "c3_a5_bounds",
    minX: 0,
    maxX: 800,
    minY: 4000,
    maxY: 4800,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 35,
  obstacles: [
    // Entry
    {
      id: "c3_a5_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 4750 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Left path - sticky
    {
      id: "c3_a5_left1",
      type: StaticObstacleType.RAMP,
      position: { x: 200, y: 4650 },
      size: { width: 100, height: 15 },
      rotation: -20,
      surfaceType: SurfaceType.STICKY,
    },
    {
      id: "c3_a5_left2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 120, y: 4500 },
      size: { width: 80, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.STICKY,
    },
    {
      id: "c3_a5_left3",
      type: StaticObstacleType.RAMP,
      position: { x: 180, y: 4350 },
      size: { width: 100, height: 15 },
      rotation: 15,
      surfaceType: SurfaceType.STICKY,
    },
    // Right path - slippery
    {
      id: "c3_a5_right1",
      type: StaticObstacleType.RAMP,
      position: { x: 600, y: 4650 },
      size: { width: 100, height: 15 },
      rotation: 20,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c3_a5_right2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 680, y: 4500 },
      size: { width: 80, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c3_a5_right3",
      type: StaticObstacleType.RAMP,
      position: { x: 620, y: 4350 },
      size: { width: 100, height: 15 },
      rotation: -15,
      surfaceType: SurfaceType.SLIPPERY,
    },
    // Merge and exit
    {
      id: "c3_a5_merge",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 4200 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a5_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 4080 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [],
  collectibles: [
    {
      id: "c3_a5_b1",
      type: "banana",
      position: { x: 400, y: 4720 },
      value: 100,
    },
    {
      id: "c3_a5_b2",
      type: "banana",
      position: { x: 200, y: 4620 },
      value: 100,
    },
    {
      id: "c3_a5_b3",
      type: "banana",
      position: { x: 120, y: 4470 },
      value: 100,
    },
    {
      id: "c3_a5_b4",
      type: "banana",
      position: { x: 180, y: 4320 },
      value: 100,
    },
    {
      id: "c3_a5_b5",
      type: "banana",
      position: { x: 600, y: 4620 },
      value: 100,
    },
    {
      id: "c3_a5_b6",
      type: "banana",
      position: { x: 680, y: 4470 },
      value: 100,
    },
    {
      id: "c3_a5_b7",
      type: "banana",
      position: { x: 620, y: 4320 },
      value: 100,
    },
    {
      id: "c3_a5_coin",
      type: "coin",
      position: { x: 680, y: 4380 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint5",
    position: { x: 400, y: 4730 },
    rotation: 0,
    areaIndex: 4,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 6: Speed Lifts
 * Faster lifts with narrower platforms
 */
const AREA_6: Area = {
  id: "course3_area6",
  areaNumber: 6,
  name: "Speed Lifts",
  bounds: {
    id: "c3_a6_bounds",
    minX: 0,
    maxX: 800,
    minY: 3200,
    maxY: 4000,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 40,
  obstacles: [
    // Entry
    {
      id: "c3_a6_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 3950 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow ledges between lifts
    {
      id: "c3_a6_ledge1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 280, y: 3750 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a6_ledge2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 520, y: 3550 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit
    {
      id: "c3_a6_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 3300 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [
    // Faster lifts (2.5 speed, 0.5 wait)
    {
      id: "c3_a6_lift1",
      type: MechanismType.R_LIFT_PLATFORM,
      position: { x: 550, y: 3850 },
      config: {
        distance: 180,
        speed: 2.5,
        waitTime: 0.5,
        width: 80,
        height: 15,
      },
    },
    {
      id: "c3_a6_lift2",
      type: MechanismType.L_LIFT_PLATFORM,
      position: { x: 250, y: 3650 },
      config: {
        distance: 180,
        speed: 2.5,
        waitTime: 0.5,
        width: 80,
        height: 15,
      },
    },
    {
      id: "c3_a6_lift3",
      type: MechanismType.R_LIFT_PLATFORM,
      position: { x: 450, y: 3450 },
      config: {
        distance: 150,
        speed: 3.0,
        waitTime: 0.3,
        width: 80,
        height: 15,
      },
    },
  ],
  collectibles: [
    {
      id: "c3_a6_b1",
      type: "banana",
      position: { x: 450, y: 3920 },
      value: 100,
    },
    {
      id: "c3_a6_b2",
      type: "banana",
      position: { x: 550, y: 3780 },
      value: 100,
    },
    {
      id: "c3_a6_b3",
      type: "banana",
      position: { x: 280, y: 3720 },
      value: 100,
    },
    {
      id: "c3_a6_b4",
      type: "banana",
      position: { x: 250, y: 3580 },
      value: 100,
    },
    {
      id: "c3_a6_b5",
      type: "banana",
      position: { x: 520, y: 3520 },
      value: 100,
    },
    {
      id: "c3_a6_b6",
      type: "banana",
      position: { x: 450, y: 3400 },
      value: 100,
    },
    {
      id: "c3_a6_b7",
      type: "banana",
      position: { x: 200, y: 3270 },
      value: 100,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint6",
    position: { x: 400, y: 3930 },
    rotation: 0,
    areaIndex: 5,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 7: Expert Joystick
 * More sensitive joystick gears
 */
const AREA_7: Area = {
  id: "course3_area7",
  areaNumber: 7,
  name: "Expert Joystick",
  bounds: {
    id: "c3_a7_bounds",
    minX: 0,
    maxX: 800,
    minY: 2400,
    maxY: 3200,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry
    {
      id: "c3_a7_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 3150 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Gear mounts
    {
      id: "c3_a7_mount1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 250, y: 2850 },
      size: { width: 40, height: 120 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c3_a7_mount2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 550, y: 2650 },
      size: { width: 40, height: 120 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit
    {
      id: "c3_a7_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 2500 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [
    // Expert joystick gears - more sensitive
    {
      id: "c3_a7_jgear1",
      type: MechanismType.LEFT_STICK_GEAR,
      position: { x: 250, y: 2950 },
      config: {
        radius: 60,
        maxAngle: 50,
        sensitivity: 2.0,
        returnSpeed: 4.0,
      },
    },
    {
      id: "c3_a7_jgear2",
      type: MechanismType.RIGHT_STICK_GEAR,
      position: { x: 550, y: 2750 },
      config: {
        radius: 60,
        maxAngle: 50,
        sensitivity: 2.0,
        returnSpeed: 4.0,
      },
    },
  ],
  collectibles: [
    {
      id: "c3_a7_b1",
      type: "banana",
      position: { x: 250, y: 3120 },
      value: 100,
    },
    {
      id: "c3_a7_b2",
      type: "banana",
      position: { x: 180, y: 2950 },
      value: 100,
    },
    {
      id: "c3_a7_b3",
      type: "banana",
      position: { x: 320, y: 2950 },
      value: 100,
    },
    {
      id: "c3_a7_b4",
      type: "banana",
      position: { x: 400, y: 2850 },
      value: 100,
    },
    {
      id: "c3_a7_b5",
      type: "banana",
      position: { x: 480, y: 2750 },
      value: 100,
    },
    {
      id: "c3_a7_b6",
      type: "banana",
      position: { x: 620, y: 2750 },
      value: 100,
    },
    {
      id: "c3_a7_b7",
      type: "banana",
      position: { x: 650, y: 2470 },
      value: 100,
    },
    {
      id: "c3_a7_coin",
      type: "coin",
      position: { x: 400, y: 2750 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint7",
    position: { x: 200, y: 3130 },
    rotation: 0,
    areaIndex: 6,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 8: Power Launch
 * Higher force launchers
 */
const AREA_8: Area = {
  id: "course3_area8",
  areaNumber: 8,
  name: "Power Launch",
  bounds: {
    id: "c3_a8_bounds",
    minX: 0,
    maxX: 800,
    minY: 1600,
    maxY: 2400,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 35,
  obstacles: [
    // Entry
    {
      id: "c3_a8_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 2350 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow landing platforms
    {
      id: "c3_a8_land1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 2150 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a8_land2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 1950 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit
    {
      id: "c3_a8_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 1700 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [
    // High power launchers
    {
      id: "c3_a8_launch1",
      type: MechanismType.R_LAUNCHER,
      position: { x: 600, y: 2300 },
      config: {
        launchForce: 18,
        launchAngle: 120,
        chargeTime: 0.8,
        cooldown: 1.5,
      },
    },
    {
      id: "c3_a8_launch2",
      type: MechanismType.R_LAUNCHER,
      position: { x: 200, y: 2100 },
      config: {
        launchForce: 16,
        launchAngle: 60,
        chargeTime: 0.8,
        cooldown: 1.5,
      },
    },
    {
      id: "c3_a8_launch3",
      type: MechanismType.R_LAUNCHER,
      position: { x: 600, y: 1900 },
      config: {
        launchForce: 14,
        launchAngle: 135,
        chargeTime: 1.0,
        cooldown: 1.5,
      },
    },
  ],
  collectibles: [
    {
      id: "c3_a8_b1",
      type: "banana",
      position: { x: 680, y: 2320 },
      value: 100,
    },
    {
      id: "c3_a8_b2",
      type: "banana",
      position: { x: 400, y: 2200 },
      value: 100,
    },
    {
      id: "c3_a8_b3",
      type: "banana",
      position: { x: 300, y: 2150 },
      value: 100,
    },
    {
      id: "c3_a8_b4",
      type: "banana",
      position: { x: 400, y: 2000 },
      value: 100,
    },
    {
      id: "c3_a8_b5",
      type: "banana",
      position: { x: 500, y: 1950 },
      value: 100,
    },
    {
      id: "c3_a8_b6",
      type: "banana",
      position: { x: 350, y: 1800 },
      value: 100,
    },
    {
      id: "c3_a8_b7",
      type: "banana",
      position: { x: 150, y: 1670 },
      value: 100,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint8",
    position: { x: 650, y: 2330 },
    rotation: 0,
    areaIndex: 7,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 9: Speed Belts
 * Ultra-fast conveyors
 */
const AREA_9: Area = {
  id: "course3_area9",
  areaNumber: 9,
  name: "Speed Belts",
  bounds: {
    id: "c3_a9_bounds",
    minX: 0,
    maxX: 800,
    minY: 800,
    maxY: 1600,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 40,
  obstacles: [
    // Entry
    {
      id: "c3_a9_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 1550 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Narrow platforms between conveyors
    {
      id: "c3_a9_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 1380 },
      size: { width: 80, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a9_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 1200 },
      size: { width: 80, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    {
      id: "c3_a9_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 1020 },
      size: { width: 80, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Exit
    {
      id: "c3_a9_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 880 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [
    // Ultra-fast conveyors
    {
      id: "c3_a9_conv1",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 1500 },
      config: {
        width: 280,
        speed: 4.5,
        direction: 1,
      },
    },
    {
      id: "c3_a9_conv2",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 1330 },
      config: {
        width: 280,
        speed: 5.0,
        direction: -1,
      },
    },
    {
      id: "c3_a9_conv3",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 1160 },
      config: {
        width: 280,
        speed: 5.5,
        direction: 1,
      },
    },
    {
      id: "c3_a9_conv4",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 980 },
      config: {
        width: 280,
        speed: 6.0,
        direction: -1,
      },
    },
  ],
  collectibles: [
    {
      id: "c3_a9_b1",
      type: "banana",
      position: { x: 180, y: 1520 },
      value: 100,
    },
    {
      id: "c3_a9_b2",
      type: "banana",
      position: { x: 300, y: 1470 },
      value: 100,
    },
    {
      id: "c3_a9_b3",
      type: "banana",
      position: { x: 500, y: 1470 },
      value: 100,
    },
    {
      id: "c3_a9_b4",
      type: "banana",
      position: { x: 350, y: 1300 },
      value: 100,
    },
    {
      id: "c3_a9_b5",
      type: "banana",
      position: { x: 450, y: 1300 },
      value: 100,
    },
    {
      id: "c3_a9_b6",
      type: "banana",
      position: { x: 400, y: 1130 },
      value: 100,
    },
    {
      id: "c3_a9_b7",
      type: "banana",
      position: { x: 400, y: 950 },
      value: 100,
    },
    {
      id: "c3_a9_b8",
      type: "banana",
      position: { x: 400, y: 850 },
      value: 100,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint9",
    position: { x: 150, y: 1530 },
    rotation: 0,
    areaIndex: 8,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 10: Expert Finale
 * Everything combined, maximum challenge
 */
const AREA_10: Area = {
  id: "course3_area10",
  areaNumber: 10,
  name: "Expert Finale",
  bounds: {
    id: "c3_a10_bounds",
    minX: 0,
    maxX: 800,
    minY: 0,
    maxY: 800,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry
    {
      id: "c3_a10_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 750 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Mixed surface gauntlet
    {
      id: "c3_a10_ice1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 250, y: 650 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c3_a10_sticky1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 550, y: 550 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.STICKY,
    },
    {
      id: "c3_a10_ice2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 250, y: 450 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c3_a10_sticky2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 550, y: 350 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.STICKY,
    },
    // Final platform
    {
      id: "c3_a10_final",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 180 },
      size: { width: 180, height: 30 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Goal line
    {
      id: "c3_a10_goal",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 100 },
      size: { width: 250, height: 10 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
  ],
  mechanisms: [
    // Fast gear
    {
      id: "c3_a10_gear",
      type: MechanismType.R_ROTATING_GEAR,
      position: { x: 400, y: 500 },
      config: {
        radius: 50,
        angularVelocity: 0.04,
        friction: 0.7,
        segments: 8,
      },
    },
    // Strong fan
    {
      id: "c3_a10_fan",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 280 },
      config: {
        force: 0.002,
        range: 120,
        direction: 0,
      },
    },
  ],
  collectibles: [
    {
      id: "c3_a10_b1",
      type: "banana",
      position: { x: 350, y: 720 },
      value: 100,
    },
    {
      id: "c3_a10_b2",
      type: "banana",
      position: { x: 450, y: 720 },
      value: 100,
    },
    {
      id: "c3_a10_b3",
      type: "banana",
      position: { x: 250, y: 620 },
      value: 100,
    },
    {
      id: "c3_a10_b4",
      type: "banana",
      position: { x: 550, y: 520 },
      value: 100,
    },
    {
      id: "c3_a10_b5",
      type: "banana",
      position: { x: 400, y: 450 },
      value: 100,
    },
    {
      id: "c3_a10_b6",
      type: "banana",
      position: { x: 250, y: 420 },
      value: 100,
    },
    {
      id: "c3_a10_b7",
      type: "banana",
      position: { x: 550, y: 320 },
      value: 100,
    },
    {
      id: "c3_a10_b8",
      type: "banana",
      position: { x: 400, y: 220 },
      value: 100,
    },
    {
      id: "c3_a10_coin",
      type: "coin",
      position: { x: 400, y: 150 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c3_checkpoint10",
    position: { x: 400, y: 730 },
    rotation: 0,
    areaIndex: 9,
    flags: { autoSave: true, showTransition: true },
  },
};

// ============================================
// Export Course 3 Areas
// ============================================

export const COURSE_3_AREAS: Area[] = [
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
// Course 3 Definition
// ============================================

export const COURSE_3: Course = {
  id: "course_3",
  name: "Expert Classic",
  description:
    "Master the original course with narrower platforms and no safety bumpers!",
  theme: "classic",

  // Dimensions
  width: 800,
  height: 8000,

  // Areas
  areas: COURSE_3_AREAS,

  // Visual layers
  backgroundLayers: [
    {
      id: "c3_bg_sky",
      color: "#1a1a3e",
      parallaxFactor: 0,
      repeatX: true,
      repeatY: true,
      zIndex: 0,
    },
    {
      id: "c3_bg_girders",
      color: "#2a2a4e",
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
    followSmoothing: 0.1,
    lookAheadDistance: 100,
    autoZoom: true,
    zoomRange: { min: 0.85, max: 1.15 },
  },

  // Difficulty
  difficulty: 3,
  parentCourseId: "course_1",

  // Spawn
  startPosition: { x: 100, y: 7880 },
  startRotation: 0,

  // Timing
  parTime: 360, // 6 minutes (faster than Course 1)
  maxTime: 540, // 9 minutes

  // Scoring
  totalBananas: 72,
  totalCoins: 6,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get all checkpoints from Course 3
 */
export function getCourse3Checkpoints() {
  return COURSE_3_AREAS.map((area) => area.checkpoint);
}

/**
 * Get total collectibles in Course 3
 */
export function getCourse3CollectibleCount() {
  let bananas = 0;
  let coins = 0;
  COURSE_3_AREAS.forEach((area) => {
    area.collectibles.forEach((c) => {
      if (c.type === "banana") bananas++;
      else if (c.type === "coin") coins++;
    });
  });
  return { bananas, coins };
}

// Export statistics
export const COURSE_3_STATS = {
  totalAreas: 10,
  totalBananas: 72,
  totalCoins: 6,
  maxScore: 72 * 100 + 6 * 500,
  parTime: 360,
  difficulty: 3,
};
