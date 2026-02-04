/**
 * Course 4: Expert Industrial
 *
 * Expert variant of the Industrial theme (Course 2) with:
 * - Faster conveyor speeds (2x)
 * - More aggressive gear mechanics
 * - Narrower platforms
 * - Longer timed mechanisms
 * - Complex launcher chains
 *
 * Total Areas: 10
 * Difficulty: 4 (Expert)
 * Par Time: 400 seconds (6:40)
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
// Course 4 Areas - Expert Industrial
// ============================================

/**
 * Area 1: Factory Entry
 * Introduction to faster industrial mechanics
 */
const AREA_1: Area = {
  id: "course4_area1",
  areaNumber: 1,
  name: "Factory Entry",
  bounds: {
    id: "c4_a1_bounds",
    minX: 0,
    maxX: 800,
    minY: 7200,
    maxY: 8000,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 30,
  obstacles: [
    // Starting platform - metal
    {
      id: "c4_a1_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 7900 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Industrial ramps
    {
      id: "c4_a1_ramp1",
      type: StaticObstacleType.RAMP,
      position: { x: 280, y: 7830 },
      size: { width: 140, height: 20 },
      rotation: -15,
      surfaceType: SurfaceType.METAL,
    },
    // Factory support beam
    {
      id: "c4_a1_beam1",
      type: StaticObstacleType.WALL,
      position: { x: 500, y: 7700 },
      size: { width: 30, height: 180 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Platform
    {
      id: "c4_a1_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 350, y: 7700 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Narrow descent
    {
      id: "c4_a1_ramp2",
      type: StaticObstacleType.RAMP,
      position: { x: 200, y: 7600 },
      size: { width: 120, height: 20 },
      rotation: 22,
      surfaceType: SurfaceType.METAL,
    },
    // Mid landing
    {
      id: "c4_a1_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 7520 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit ramp
    {
      id: "c4_a1_ramp3",
      type: StaticObstacleType.RAMP,
      position: { x: 300, y: 7430 },
      size: { width: 180, height: 20 },
      rotation: -10,
      surfaceType: SurfaceType.METAL,
    },
    // Exit platform
    {
      id: "c4_a1_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 550, y: 7350 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // Fast starter conveyor
    {
      id: "c4_a1_conv1",
      type: MechanismType.CONVEYOR,
      position: { x: 650, y: 7280 },
      config: {
        width: 160,
        speed: 4.0,
        direction: -1,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a1_b1",
      type: "banana",
      position: { x: 150, y: 7870 },
      value: 100,
    },
    {
      id: "c4_a1_b2",
      type: "banana",
      position: { x: 300, y: 7800 },
      value: 100,
    },
    {
      id: "c4_a1_b3",
      type: "banana",
      position: { x: 380, y: 7670 },
      value: 100,
    },
    {
      id: "c4_a1_b4",
      type: "banana",
      position: { x: 220, y: 7570 },
      value: 100,
    },
    {
      id: "c4_a1_b5",
      type: "banana",
      position: { x: 100, y: 7490 },
      value: 100,
    },
    {
      id: "c4_a1_b6",
      type: "banana",
      position: { x: 400, y: 7400 },
      value: 100,
    },
    {
      id: "c4_a1_b7",
      type: "banana",
      position: { x: 600, y: 7320 },
      value: 100,
    },
    {
      id: "c4_a1_coin",
      type: "coin",
      position: { x: 650, y: 7250 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint1",
    position: { x: 100, y: 7880 },
    rotation: 0,
    areaIndex: 0,
    flags: { autoSave: true, showTransition: false },
  },
};

/**
 * Area 2: Speed Gears
 * Multiple fast rotating gears
 */
const AREA_2: Area = {
  id: "course4_area2",
  areaNumber: 2,
  name: "Speed Gears",
  bounds: {
    id: "c4_a2_bounds",
    minX: 0,
    maxX: 800,
    minY: 6400,
    maxY: 7200,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 40,
  obstacles: [
    // Entry
    {
      id: "c4_a2_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 7150 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Gear mount pillars
    {
      id: "c4_a2_pillar1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 550, y: 6900 },
      size: { width: 40, height: 200 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a2_pillar2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 250, y: 6650 },
      size: { width: 40, height: 200 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit platform
    {
      id: "c4_a2_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 6500 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // Fast opposing gears
    {
      id: "c4_a2_gear1",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 550, y: 7000 },
      config: {
        radius: 80,
        angularVelocity: 0.05, // 2.5x normal
        friction: 0.8,
        segments: 8,
      },
    },
    {
      id: "c4_a2_gear2",
      type: MechanismType.R_ROTATING_GEAR,
      position: { x: 250, y: 6750 },
      config: {
        radius: 80,
        angularVelocity: 0.05, // 2.5x normal
        friction: 0.8,
        segments: 8,
      },
    },
    {
      id: "c4_a2_gear3",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 550, y: 6550 },
      config: {
        radius: 60,
        angularVelocity: 0.06, // 3x normal
        friction: 0.7,
        segments: 6,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a2_b1",
      type: "banana",
      position: { x: 650, y: 7120 },
      value: 100,
    },
    {
      id: "c4_a2_b2",
      type: "banana",
      position: { x: 480, y: 7000 },
      value: 100,
    },
    {
      id: "c4_a2_b3",
      type: "banana",
      position: { x: 620, y: 7000 },
      value: 100,
    },
    {
      id: "c4_a2_b4",
      type: "banana",
      position: { x: 400, y: 6850 },
      value: 100,
    },
    {
      id: "c4_a2_b5",
      type: "banana",
      position: { x: 180, y: 6750 },
      value: 100,
    },
    {
      id: "c4_a2_b6",
      type: "banana",
      position: { x: 320, y: 6750 },
      value: 100,
    },
    {
      id: "c4_a2_b7",
      type: "banana",
      position: { x: 480, y: 6550 },
      value: 100,
    },
    {
      id: "c4_a2_coin",
      type: "coin",
      position: { x: 550, y: 7000 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint2",
    position: { x: 700, y: 7130 },
    rotation: 0,
    areaIndex: 1,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 3: Ventilation Shafts
 * Powerful cross-wind fans
 */
const AREA_3: Area = {
  id: "course4_area3",
  areaNumber: 3,
  name: "Ventilation Shafts",
  bounds: {
    id: "c4_a3_bounds",
    minX: 0,
    maxX: 800,
    minY: 5600,
    maxY: 6400,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry
    {
      id: "c4_a3_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 6350 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Narrow shaft platforms
    {
      id: "c4_a3_shaft1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 300, y: 6200 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a3_shaft2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 500, y: 6050 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a3_shaft3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 300, y: 5900 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a3_shaft4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 500, y: 5750 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit
    {
      id: "c4_a3_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 5680 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // Strong cross-wind fans (alternating)
    {
      id: "c4_a3_fan1",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 100, y: 6150 },
      config: {
        force: 0.003,
        range: 300,
        direction: 0,
      },
    },
    {
      id: "c4_a3_fan2",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 700, y: 6000 },
      config: {
        force: 0.003,
        range: 300,
        direction: 180,
      },
    },
    {
      id: "c4_a3_fan3",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 100, y: 5850 },
      config: {
        force: 0.0035,
        range: 350,
        direction: 0,
      },
    },
    {
      id: "c4_a3_fan4",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 700, y: 5700 },
      config: {
        force: 0.0025,
        range: 200,
        direction: 180,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a3_b1",
      type: "banana",
      position: { x: 150, y: 6320 },
      value: 100,
    },
    {
      id: "c4_a3_b2",
      type: "banana",
      position: { x: 200, y: 6150 },
      value: 100,
    },
    {
      id: "c4_a3_b3",
      type: "banana",
      position: { x: 400, y: 6100 },
      value: 100,
    },
    {
      id: "c4_a3_b4",
      type: "banana",
      position: { x: 600, y: 6000 },
      value: 100,
    },
    {
      id: "c4_a3_b5",
      type: "banana",
      position: { x: 400, y: 5950 },
      value: 100,
    },
    {
      id: "c4_a3_b6",
      type: "banana",
      position: { x: 200, y: 5850 },
      value: 100,
    },
    {
      id: "c4_a3_b7",
      type: "banana",
      position: { x: 400, y: 5800 },
      value: 100,
    },
    {
      id: "c4_a3_b8",
      type: "banana",
      position: { x: 650, y: 5650 },
      value: 100,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint3",
    position: { x: 100, y: 6330 },
    rotation: 0,
    areaIndex: 2,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 4: Assembly Line
 * Tight conveyor maze
 */
const AREA_4: Area = {
  id: "course4_area4",
  areaNumber: 4,
  name: "Assembly Line",
  bounds: {
    id: "c4_a4_bounds",
    minX: 0,
    maxX: 800,
    minY: 4800,
    maxY: 5600,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry
    {
      id: "c4_a4_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 5550 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Conveyor support platforms
    {
      id: "c4_a4_support1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 5350 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a4_support2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 5150 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a4_support3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 4950 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit
    {
      id: "c4_a4_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 4870 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // High-speed conveyor maze
    {
      id: "c4_a4_conv1",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 5500 },
      config: {
        width: 350,
        speed: 6.0,
        direction: -1,
      },
    },
    {
      id: "c4_a4_conv2",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 5300 },
      config: {
        width: 350,
        speed: 7.0,
        direction: 1,
      },
    },
    {
      id: "c4_a4_conv3",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 5100 },
      config: {
        width: 350,
        speed: 7.5,
        direction: -1,
      },
    },
    {
      id: "c4_a4_conv4",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 4920 },
      config: {
        width: 200,
        speed: 5.0,
        direction: 1,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a4_b1",
      type: "banana",
      position: { x: 650, y: 5520 },
      value: 100,
    },
    {
      id: "c4_a4_b2",
      type: "banana",
      position: { x: 300, y: 5470 },
      value: 100,
    },
    {
      id: "c4_a4_b3",
      type: "banana",
      position: { x: 500, y: 5470 },
      value: 100,
    },
    {
      id: "c4_a4_b4",
      type: "banana",
      position: { x: 200, y: 5270 },
      value: 100,
    },
    {
      id: "c4_a4_b5",
      type: "banana",
      position: { x: 600, y: 5270 },
      value: 100,
    },
    {
      id: "c4_a4_b6",
      type: "banana",
      position: { x: 300, y: 5070 },
      value: 100,
    },
    {
      id: "c4_a4_b7",
      type: "banana",
      position: { x: 500, y: 5070 },
      value: 100,
    },
    {
      id: "c4_a4_coin",
      type: "coin",
      position: { x: 400, y: 5100 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint4",
    position: { x: 700, y: 5530 },
    rotation: 0,
    areaIndex: 3,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 5: Pressure Zone
 * Multiple lift timing challenge
 */
const AREA_5: Area = {
  id: "course4_area5",
  areaNumber: 5,
  name: "Pressure Zone",
  bounds: {
    id: "c4_a5_bounds",
    minX: 0,
    maxX: 800,
    minY: 4000,
    maxY: 4800,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry
    {
      id: "c4_a5_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 4750 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Narrow platforms between lifts
    {
      id: "c4_a5_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 4550 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a5_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 4350 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a5_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 4150 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit
    {
      id: "c4_a5_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 500, y: 4080 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // Fast asynchronous lifts
    {
      id: "c4_a5_lift1",
      type: MechanismType.R_LIFT_PLATFORM,
      position: { x: 350, y: 4650 },
      config: {
        distance: 180,
        speed: 3.5,
        waitTime: 0.3,
        width: 70,
        height: 15,
      },
    },
    {
      id: "c4_a5_lift2",
      type: MechanismType.L_LIFT_PLATFORM,
      position: { x: 450, y: 4450 },
      config: {
        distance: 160,
        speed: 4.0,
        waitTime: 0.2,
        width: 70,
        height: 15,
      },
    },
    {
      id: "c4_a5_lift3",
      type: MechanismType.R_LIFT_PLATFORM,
      position: { x: 350, y: 4250 },
      config: {
        distance: 180,
        speed: 4.5,
        waitTime: 0.2,
        width: 70,
        height: 15,
      },
    },
    {
      id: "c4_a5_lift4",
      type: MechanismType.L_LIFT_PLATFORM,
      position: { x: 300, y: 4100 },
      config: {
        distance: 120,
        speed: 3.0,
        waitTime: 0.4,
        width: 80,
        height: 15,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a5_b1",
      type: "banana",
      position: { x: 450, y: 4720 },
      value: 100,
    },
    {
      id: "c4_a5_b2",
      type: "banana",
      position: { x: 350, y: 4580 },
      value: 100,
    },
    {
      id: "c4_a5_b3",
      type: "banana",
      position: { x: 250, y: 4550 },
      value: 100,
    },
    {
      id: "c4_a5_b4",
      type: "banana",
      position: { x: 450, y: 4380 },
      value: 100,
    },
    {
      id: "c4_a5_b5",
      type: "banana",
      position: { x: 550, y: 4350 },
      value: 100,
    },
    {
      id: "c4_a5_b6",
      type: "banana",
      position: { x: 350, y: 4180 },
      value: 100,
    },
    {
      id: "c4_a5_b7",
      type: "banana",
      position: { x: 250, y: 4150 },
      value: 100,
    },
    {
      id: "c4_a5_b8",
      type: "banana",
      position: { x: 500, y: 4050 },
      value: 100,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint5",
    position: { x: 400, y: 4730 },
    rotation: 0,
    areaIndex: 4,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 6: Control Room
 * Expert joystick gear challenges
 */
const AREA_6: Area = {
  id: "course4_area6",
  areaNumber: 6,
  name: "Control Room",
  bounds: {
    id: "c4_a6_bounds",
    minX: 0,
    maxX: 800,
    minY: 3200,
    maxY: 4000,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 50,
  obstacles: [
    // Entry
    {
      id: "c4_a6_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 500, y: 3950 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Gear pillars (taller)
    {
      id: "c4_a6_pillar1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 3700 },
      size: { width: 40, height: 200 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a6_pillar2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 3500 },
      size: { width: 40, height: 200 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a6_pillar3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 300, y: 3350 },
      size: { width: 40, height: 150 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit
    {
      id: "c4_a6_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 3280 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // Three expert joystick gears
    {
      id: "c4_a6_jgear1",
      type: MechanismType.LEFT_STICK_GEAR,
      position: { x: 200, y: 3850 },
      config: {
        radius: 70,
        maxAngle: 60,
        sensitivity: 2.5,
        returnSpeed: 5.0,
      },
    },
    {
      id: "c4_a6_jgear2",
      type: MechanismType.RIGHT_STICK_GEAR,
      position: { x: 600, y: 3650 },
      config: {
        radius: 65,
        maxAngle: 55,
        sensitivity: 2.5,
        returnSpeed: 5.0,
      },
    },
    {
      id: "c4_a6_jgear3",
      type: MechanismType.LEFT_STICK_GEAR,
      position: { x: 300, y: 3450 },
      config: {
        radius: 60,
        maxAngle: 65,
        sensitivity: 3.0,
        returnSpeed: 6.0,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a6_b1",
      type: "banana",
      position: { x: 450, y: 3920 },
      value: 100,
    },
    {
      id: "c4_a6_b2",
      type: "banana",
      position: { x: 130, y: 3850 },
      value: 100,
    },
    {
      id: "c4_a6_b3",
      type: "banana",
      position: { x: 270, y: 3850 },
      value: 100,
    },
    {
      id: "c4_a6_b4",
      type: "banana",
      position: { x: 400, y: 3750 },
      value: 100,
    },
    {
      id: "c4_a6_b5",
      type: "banana",
      position: { x: 530, y: 3650 },
      value: 100,
    },
    {
      id: "c4_a6_b6",
      type: "banana",
      position: { x: 670, y: 3650 },
      value: 100,
    },
    {
      id: "c4_a6_b7",
      type: "banana",
      position: { x: 230, y: 3450 },
      value: 100,
    },
    {
      id: "c4_a6_b8",
      type: "banana",
      position: { x: 370, y: 3450 },
      value: 100,
    },
    {
      id: "c4_a6_coin",
      type: "coin",
      position: { x: 200, y: 3850 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint6",
    position: { x: 500, y: 3930 },
    rotation: 0,
    areaIndex: 5,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 7: Launch Pad Alpha
 * Power launcher chain
 */
const AREA_7: Area = {
  id: "course4_area7",
  areaNumber: 7,
  name: "Launch Pad Alpha",
  bounds: {
    id: "c4_a7_bounds",
    minX: 0,
    maxX: 800,
    minY: 2400,
    maxY: 3200,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 40,
  obstacles: [
    // Entry
    {
      id: "c4_a7_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 3150 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Small landing pads
    {
      id: "c4_a7_pad1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 2950 },
      size: { width: 70, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a7_pad2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 2750 },
      size: { width: 70, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a7_pad3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 200, y: 2550 },
      size: { width: 70, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit
    {
      id: "c4_a7_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 2480 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // Chain of powerful launchers
    {
      id: "c4_a7_launch1",
      type: MechanismType.R_LAUNCHER,
      position: { x: 550, y: 3100 },
      config: {
        launchForce: 20,
        launchAngle: 130,
        chargeTime: 0.6,
        cooldown: 1.0,
      },
    },
    {
      id: "c4_a7_launch2",
      type: MechanismType.R_LAUNCHER,
      position: { x: 200, y: 2900 },
      config: {
        launchForce: 18,
        launchAngle: 50,
        chargeTime: 0.6,
        cooldown: 1.0,
      },
    },
    {
      id: "c4_a7_launch3",
      type: MechanismType.R_LAUNCHER,
      position: { x: 600, y: 2700 },
      config: {
        launchForce: 16,
        launchAngle: 140,
        chargeTime: 0.8,
        cooldown: 1.2,
      },
    },
    {
      id: "c4_a7_launch4",
      type: MechanismType.R_LAUNCHER,
      position: { x: 200, y: 2500 },
      config: {
        launchForce: 14,
        launchAngle: 45,
        chargeTime: 1.0,
        cooldown: 1.5,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a7_b1",
      type: "banana",
      position: { x: 650, y: 3120 },
      value: 100,
    },
    {
      id: "c4_a7_b2",
      type: "banana",
      position: { x: 380, y: 3000 },
      value: 100,
    },
    {
      id: "c4_a7_b3",
      type: "banana",
      position: { x: 250, y: 2920 },
      value: 100,
    },
    {
      id: "c4_a7_b4",
      type: "banana",
      position: { x: 420, y: 2800 },
      value: 100,
    },
    {
      id: "c4_a7_b5",
      type: "banana",
      position: { x: 550, y: 2720 },
      value: 100,
    },
    {
      id: "c4_a7_b6",
      type: "banana",
      position: { x: 400, y: 2600 },
      value: 100,
    },
    {
      id: "c4_a7_b7",
      type: "banana",
      position: { x: 250, y: 2520 },
      value: 100,
    },
    {
      id: "c4_a7_b8",
      type: "banana",
      position: { x: 400, y: 2450 },
      value: 100,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint7",
    position: { x: 600, y: 3130 },
    rotation: 0,
    areaIndex: 6,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 8: Machinery Heart
 * Combined gear and conveyor challenge
 */
const AREA_8: Area = {
  id: "course4_area8",
  areaNumber: 8,
  name: "Machinery Heart",
  bounds: {
    id: "c4_a8_bounds",
    minX: 0,
    maxX: 800,
    minY: 1600,
    maxY: 2400,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 50,
  obstacles: [
    // Entry
    {
      id: "c4_a8_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 2350 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Central pillar
    {
      id: "c4_a8_pillar",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 1950 },
      size: { width: 50, height: 300 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit
    {
      id: "c4_a8_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 1680 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // Combined mechanisms
    {
      id: "c4_a8_gear1",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 200, y: 2200 },
      config: {
        radius: 70,
        angularVelocity: 0.04,
        friction: 0.7,
        segments: 8,
      },
    },
    {
      id: "c4_a8_conv1",
      type: MechanismType.CONVEYOR,
      position: { x: 600, y: 2100 },
      config: {
        width: 180,
        speed: 5.0,
        direction: -1,
      },
    },
    {
      id: "c4_a8_gear2",
      type: MechanismType.R_ROTATING_GEAR,
      position: { x: 600, y: 1950 },
      config: {
        radius: 60,
        angularVelocity: 0.05,
        friction: 0.7,
        segments: 6,
      },
    },
    {
      id: "c4_a8_conv2",
      type: MechanismType.CONVEYOR,
      position: { x: 200, y: 1850 },
      config: {
        width: 180,
        speed: 6.0,
        direction: 1,
      },
    },
    {
      id: "c4_a8_gear3",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 200, y: 1750 },
      config: {
        radius: 50,
        angularVelocity: 0.06,
        friction: 0.8,
        segments: 6,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a8_b1",
      type: "banana",
      position: { x: 350, y: 2320 },
      value: 100,
    },
    {
      id: "c4_a8_b2",
      type: "banana",
      position: { x: 450, y: 2320 },
      value: 100,
    },
    {
      id: "c4_a8_b3",
      type: "banana",
      position: { x: 130, y: 2200 },
      value: 100,
    },
    {
      id: "c4_a8_b4",
      type: "banana",
      position: { x: 270, y: 2200 },
      value: 100,
    },
    {
      id: "c4_a8_b5",
      type: "banana",
      position: { x: 600, y: 2070 },
      value: 100,
    },
    {
      id: "c4_a8_b6",
      type: "banana",
      position: { x: 530, y: 1950 },
      value: 100,
    },
    {
      id: "c4_a8_b7",
      type: "banana",
      position: { x: 670, y: 1950 },
      value: 100,
    },
    {
      id: "c4_a8_b8",
      type: "banana",
      position: { x: 200, y: 1820 },
      value: 100,
    },
    {
      id: "c4_a8_b9",
      type: "banana",
      position: { x: 130, y: 1750 },
      value: 100,
    },
    {
      id: "c4_a8_coin",
      type: "coin",
      position: { x: 400, y: 1950 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint8",
    position: { x: 400, y: 2330 },
    rotation: 0,
    areaIndex: 7,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 9: Speed Circuit
 * Maximum speed conveyors with gear timing
 */
const AREA_9: Area = {
  id: "course4_area9",
  areaNumber: 9,
  name: "Speed Circuit",
  bounds: {
    id: "c4_a9_bounds",
    minX: 0,
    maxX: 800,
    minY: 800,
    maxY: 1600,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry
    {
      id: "c4_a9_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 1550 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Transfer platforms
    {
      id: "c4_a9_trans1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 1350 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a9_trans2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 1150 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a9_trans3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 950 },
      size: { width: 60, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit
    {
      id: "c4_a9_exit",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 880 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // Maximum speed conveyors
    {
      id: "c4_a9_conv1",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 1480 },
      config: {
        width: 400,
        speed: 8.0,
        direction: -1,
      },
    },
    {
      id: "c4_a9_conv2",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 1280 },
      config: {
        width: 400,
        speed: 9.0,
        direction: 1,
      },
    },
    {
      id: "c4_a9_conv3",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 1080 },
      config: {
        width: 400,
        speed: 10.0,
        direction: -1,
      },
    },
    // Timing gear
    {
      id: "c4_a9_gear",
      type: MechanismType.R_ROTATING_GEAR,
      position: { x: 400, y: 930 },
      config: {
        radius: 50,
        angularVelocity: 0.04,
        friction: 0.8,
        segments: 6,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a9_b1",
      type: "banana",
      position: { x: 350, y: 1520 },
      value: 100,
    },
    {
      id: "c4_a9_b2",
      type: "banana",
      position: { x: 450, y: 1520 },
      value: 100,
    },
    {
      id: "c4_a9_b3",
      type: "banana",
      position: { x: 250, y: 1450 },
      value: 100,
    },
    {
      id: "c4_a9_b4",
      type: "banana",
      position: { x: 550, y: 1450 },
      value: 100,
    },
    {
      id: "c4_a9_b5",
      type: "banana",
      position: { x: 300, y: 1250 },
      value: 100,
    },
    {
      id: "c4_a9_b6",
      type: "banana",
      position: { x: 500, y: 1250 },
      value: 100,
    },
    {
      id: "c4_a9_b7",
      type: "banana",
      position: { x: 350, y: 1050 },
      value: 100,
    },
    {
      id: "c4_a9_b8",
      type: "banana",
      position: { x: 450, y: 1050 },
      value: 100,
    },
    {
      id: "c4_a9_b9",
      type: "banana",
      position: { x: 400, y: 850 },
      value: 100,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint9",
    position: { x: 400, y: 1530 },
    rotation: 0,
    areaIndex: 8,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 10: Core Meltdown
 * Ultimate industrial challenge
 */
const AREA_10: Area = {
  id: "course4_area10",
  areaNumber: 10,
  name: "Core Meltdown",
  bounds: {
    id: "c4_a10_bounds",
    minX: 0,
    maxX: 800,
    minY: 0,
    maxY: 800,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 55,
  obstacles: [
    // Entry
    {
      id: "c4_a10_entry",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 750 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Core support structures
    {
      id: "c4_a10_support1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 600 },
      size: { width: 50, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a10_support2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 500 },
      size: { width: 50, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a10_support3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 400 },
      size: { width: 50, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c4_a10_support4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 300 },
      size: { width: 50, height: 15 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Final platform
    {
      id: "c4_a10_final",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 180 },
      size: { width: 180, height: 30 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Goal
    {
      id: "c4_a10_goal",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 100 },
      size: { width: 250, height: 10 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
  ],
  mechanisms: [
    // Chaos mechanics
    {
      id: "c4_a10_conv1",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 700 },
      config: {
        width: 250,
        speed: 7.0,
        direction: -1,
      },
    },
    {
      id: "c4_a10_gear1",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 350, y: 550 },
      config: {
        radius: 55,
        angularVelocity: 0.05,
        friction: 0.7,
        segments: 8,
      },
    },
    {
      id: "c4_a10_gear2",
      type: MechanismType.R_ROTATING_GEAR,
      position: { x: 450, y: 450 },
      config: {
        radius: 55,
        angularVelocity: 0.05,
        friction: 0.7,
        segments: 8,
      },
    },
    {
      id: "c4_a10_conv2",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 350 },
      config: {
        width: 250,
        speed: 8.0,
        direction: 1,
      },
    },
    {
      id: "c4_a10_fan",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 250 },
      config: {
        force: 0.003,
        range: 150,
        direction: 0,
      },
    },
  ],
  collectibles: [
    {
      id: "c4_a10_b1",
      type: "banana",
      position: { x: 350, y: 720 },
      value: 100,
    },
    {
      id: "c4_a10_b2",
      type: "banana",
      position: { x: 450, y: 720 },
      value: 100,
    },
    {
      id: "c4_a10_b3",
      type: "banana",
      position: { x: 280, y: 670 },
      value: 100,
    },
    {
      id: "c4_a10_b4",
      type: "banana",
      position: { x: 520, y: 670 },
      value: 100,
    },
    {
      id: "c4_a10_b5",
      type: "banana",
      position: { x: 200, y: 570 },
      value: 100,
    },
    {
      id: "c4_a10_b6",
      type: "banana",
      position: { x: 600, y: 470 },
      value: 100,
    },
    {
      id: "c4_a10_b7",
      type: "banana",
      position: { x: 200, y: 370 },
      value: 100,
    },
    {
      id: "c4_a10_b8",
      type: "banana",
      position: { x: 600, y: 270 },
      value: 100,
    },
    {
      id: "c4_a10_b9",
      type: "banana",
      position: { x: 400, y: 220 },
      value: 100,
    },
    {
      id: "c4_a10_coin",
      type: "coin",
      position: { x: 400, y: 150 },
      value: 500,
    },
  ],
  checkpoint: {
    id: "c4_checkpoint10",
    position: { x: 400, y: 730 },
    rotation: 0,
    areaIndex: 9,
    flags: { autoSave: true, showTransition: true },
  },
};

// ============================================
// Export Course 4 Areas
// ============================================

export const COURSE_4_AREAS: Area[] = [
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
// Course 4 Definition
// ============================================

export const COURSE_4: Course = {
  id: "course_4",
  name: "Expert Industrial",
  description:
    "Survive the factory at maximum speed! Faster conveyors and aggressive machinery await.",
  theme: "industrial",

  // Dimensions
  width: 800,
  height: 8000,

  // Areas
  areas: COURSE_4_AREAS,

  // Visual layers
  backgroundLayers: [
    {
      id: "c4_bg_metal",
      color: "#1a1a1a",
      parallaxFactor: 0,
      repeatX: true,
      repeatY: true,
      zIndex: 0,
    },
    {
      id: "c4_bg_gears",
      color: "#2a2a2a",
      parallaxFactor: 0.15,
      repeatX: true,
      repeatY: true,
      zIndex: 1,
    },
    {
      id: "c4_bg_pipes",
      color: "#3a3a3a",
      parallaxFactor: 0.3,
      repeatX: true,
      repeatY: true,
      zIndex: 2,
    },
  ],

  // Camera
  cameraConfig: {
    ...DEFAULT_CAMERA_CONFIG,
    followMode: "ahead",
    followSmoothing: 0.12,
    lookAheadDistance: 120,
    autoZoom: true,
    zoomRange: { min: 0.8, max: 1.2 },
  },

  // Difficulty
  difficulty: 4,
  parentCourseId: "course_2",

  // Spawn
  startPosition: { x: 100, y: 7880 },
  startRotation: 0,

  // Timing
  parTime: 400, // 6:40
  maxTime: 600, // 10 minutes

  // Scoring
  totalBananas: 85,
  totalCoins: 5,
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get all checkpoints from Course 4
 */
export function getCourse4Checkpoints() {
  return COURSE_4_AREAS.map((area) => area.checkpoint);
}

/**
 * Get total collectibles in Course 4
 */
export function getCourse4CollectibleCount() {
  let bananas = 0;
  let coins = 0;
  COURSE_4_AREAS.forEach((area) => {
    area.collectibles.forEach((c) => {
      if (c.type === "banana") bananas++;
      else if (c.type === "coin") coins++;
    });
  });
  return { bananas, coins };
}

// Export statistics
export const COURSE_4_STATS = {
  totalAreas: 10,
  totalBananas: 85,
  totalCoins: 5,
  maxScore: 85 * 100 + 5 * 500,
  parTime: 400,
  difficulty: 4,
};
