/**
 * Course 2: Industrial Zone
 *
 * Second course with industrial/factory theme.
 * More challenging with tighter timings and new surface types.
 * Theme: Industrial/Factory
 * Difficulty: 2 (Medium)
 *
 * Area Breakdown:
 * 1. Factory Entrance - Metal surfaces and gears
 * 2. Conveyor Chaos - Multiple conveyor belts
 * 3. Steam Pipes - Launchers with precise timing
 * 4. Gear Room - Multiple rotating gears
 * 5. Slippery Slopes - Ice-like metal surfaces
 * 6. Vertical Shaft - Long lift sequence
 * 7. Control Room - Joystick-heavy section
 * 8. Fan Turbines - Multiple fan platforms
 * 9. Assembly Line - Everything combined
 * 10. Reactor Core - Final precision challenge
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
// Course 2 Areas
// ============================================

/**
 * Area 1: Factory Entrance
 * Introduction to industrial theme with metal surfaces
 */
const AREA_1: Area = {
  id: "course2_area1",
  areaNumber: 1,
  name: "Factory Entrance",
  bounds: {
    id: "c2_area1_bounds",
    minX: 0,
    maxX: 800,
    minY: 7200,
    maxY: 8000,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 35,
  obstacles: [
    // Starting platform
    {
      id: "c2_a1_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 7900 },
      size: { width: 200, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Industrial ramp
    {
      id: "c2_a1_ramp1",
      type: StaticObstacleType.RAMP,
      position: { x: 350, y: 7820 },
      size: { width: 200, height: 20 },
      rotation: -20,
      surfaceType: SurfaceType.METAL,
    },
    // Metal landing
    {
      id: "c2_a1_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 550, y: 7700 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Second descent
    {
      id: "c2_a1_ramp2",
      type: StaticObstacleType.RAMP,
      position: { x: 400, y: 7600 },
      size: { width: 180, height: 20 },
      rotation: 25,
      surfaceType: SurfaceType.METAL,
    },
    // Rough surface section
    {
      id: "c2_a1_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 180, y: 7500 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.ROUGH,
    },
    // Final ramp to exit
    {
      id: "c2_a1_ramp3",
      type: StaticObstacleType.RAMP,
      position: { x: 350, y: 7400 },
      size: { width: 200, height: 20 },
      rotation: -15,
      surfaceType: SurfaceType.METAL,
    },
    // Exit platform
    {
      id: "c2_a1_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 7350 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.NORMAL,
    },
    // Industrial walls
    {
      id: "c2_a1_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 7600 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a1_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 7600 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
  ],
  mechanisms: [
    // Introductory gear
    {
      id: "c2_a1_gear1",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 350, y: 7480 },
      config: {
        controlType: "left_button",
        rotationSpeed: 70,
        rotationRange: { min: 0, max: 60 },
        armLength: 90,
        returnToNeutral: true,
      },
    },
  ],
  collectibles: [
    { id: "c2_a1_banana1", type: "banana", position: { x: 200, y: 7870 } },
    { id: "c2_a1_banana2", type: "banana", position: { x: 400, y: 7780 } },
    { id: "c2_a1_banana3", type: "banana", position: { x: 600, y: 7670 } },
    { id: "c2_a1_banana4", type: "banana", position: { x: 350, y: 7570 } },
    { id: "c2_a1_banana5", type: "banana", position: { x: 230, y: 7470 } },
    { id: "c2_a1_banana6", type: "banana", position: { x: 500, y: 7370 } },
  ],
  checkpoint: {
    id: "c2_checkpoint1",
    position: { x: 100, y: 7880 },
    rotation: 0,
    areaIndex: 0,
    flags: { autoSave: true, showTransition: false },
  },
};

/**
 * Area 2: Conveyor Chaos
 * Multiple conveyor belts with different speeds and directions
 */
const AREA_2: Area = {
  id: "course2_area2",
  areaNumber: 2,
  name: "Conveyor Chaos",
  bounds: {
    id: "c2_area2_bounds",
    minX: 0,
    maxX: 800,
    minY: 6400,
    maxY: 7200,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 50,
  obstacles: [
    // Entry platform
    {
      id: "c2_a2_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 7150 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Safe zones between conveyors
    {
      id: "c2_a2_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 6950 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.ROUGH,
    },
    {
      id: "c2_a2_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 6750 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.ROUGH,
    },
    {
      id: "c2_a2_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 6550 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.ROUGH,
    },
    // Exit platform
    {
      id: "c2_a2_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 6450 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c2_a2_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 6800 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a2_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 6800 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    // Pits between conveyors
    {
      id: "c2_a2_pit1",
      type: StaticObstacleType.PIT,
      position: { x: 400, y: 7050 },
      size: { width: 100, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
    {
      id: "c2_a2_pit2",
      type: StaticObstacleType.PIT,
      position: { x: 400, y: 6650 },
      size: { width: 100, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
  ],
  mechanisms: [
    // Conveyor 1 - fast right
    {
      id: "c2_a2_conv1",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 7050 },
      config: {
        controlType: "auto",
        moveSpeed: -130, // Left
      },
    },
    // Conveyor 2 - medium left
    {
      id: "c2_a2_conv2",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 6850 },
      config: {
        controlType: "auto",
        moveSpeed: 100, // Right
      },
    },
    // Conveyor 3 - fast right
    {
      id: "c2_a2_conv3",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 6650 },
      config: {
        controlType: "auto",
        moveSpeed: 140, // Right
      },
    },
    // Conveyor 4 - slow left
    {
      id: "c2_a2_conv4",
      type: MechanismType.CONVEYOR,
      position: { x: 400, y: 6500 },
      config: {
        controlType: "auto",
        moveSpeed: -60, // Left
      },
    },
  ],
  collectibles: [
    { id: "c2_a2_banana1", type: "banana", position: { x: 550, y: 7120 } },
    { id: "c2_a2_banana2", type: "banana", position: { x: 300, y: 7020 } },
    { id: "c2_a2_banana3", type: "banana", position: { x: 150, y: 6920 } },
    { id: "c2_a2_banana4", type: "banana", position: { x: 500, y: 6820 } },
    { id: "c2_a2_banana5", type: "banana", position: { x: 650, y: 6720 } },
    { id: "c2_a2_banana6", type: "banana", position: { x: 300, y: 6620 } },
    { id: "c2_a2_banana7", type: "banana", position: { x: 150, y: 6520 } },
    { id: "c2_a2_banana8", type: "banana", position: { x: 650, y: 6420 } },
    {
      id: "c2_a2_coin1",
      type: "coin",
      position: { x: 400, y: 6750 },
      value: 500,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c2_checkpoint2",
    position: { x: 600, y: 7130 },
    rotation: 0,
    areaIndex: 1,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 3: Steam Pipes
 * Launchers with precise timing requirements
 */
const AREA_3: Area = {
  id: "course2_area3",
  areaNumber: 3,
  name: "Steam Pipes",
  bounds: {
    id: "c2_area3_bounds",
    minX: 0,
    maxX: 800,
    minY: 5600,
    maxY: 6400,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 45,
  obstacles: [
    // Entry platform
    {
      id: "c2_a3_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 6350 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Launcher platforms
    {
      id: "c2_a3_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 6200 },
      size: { width: 140, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a3_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 6000 },
      size: { width: 140, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a3_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 5800 },
      size: { width: 140, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit platform
    {
      id: "c2_a3_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 5700 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c2_a3_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 6000 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a3_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 6000 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    // Hazardous pipes (spikes)
    {
      id: "c2_a3_spikes1",
      type: StaticObstacleType.SPIKES,
      position: { x: 400, y: 6100 },
      size: { width: 100, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
    {
      id: "c2_a3_spikes2",
      type: StaticObstacleType.SPIKES,
      position: { x: 400, y: 5900 },
      size: { width: 100, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
  ],
  mechanisms: [
    // Launcher 1 - diagonal right-up
    {
      id: "c2_a3_launcher1",
      type: MechanismType.R_LAUNCHER,
      position: { x: 150, y: 6150 },
      config: {
        controlType: "right_button",
        launchForce: 14,
        chargeTime: 1.0,
        launchDirection: { x: 0.8, y: -0.6 },
      },
    },
    // Launcher 2 - diagonal left-up
    {
      id: "c2_a3_launcher2",
      type: MechanismType.R_LAUNCHER,
      position: { x: 650, y: 5950 },
      config: {
        controlType: "right_button",
        launchForce: 12,
        chargeTime: 0.9,
        launchDirection: { x: -0.8, y: -0.6 },
      },
    },
    // Launcher 3 - straight right
    {
      id: "c2_a3_launcher3",
      type: MechanismType.R_LAUNCHER,
      position: { x: 150, y: 5750 },
      config: {
        controlType: "right_button",
        launchForce: 10,
        chargeTime: 0.8,
        launchDirection: { x: 1, y: -0.3 },
      },
    },
  ],
  collectibles: [
    { id: "c2_a3_banana1", type: "banana", position: { x: 550, y: 6320 } },
    { id: "c2_a3_banana2", type: "banana", position: { x: 200, y: 6170 } },
    { id: "c2_a3_banana3", type: "banana", position: { x: 400, y: 6050 } },
    { id: "c2_a3_banana4", type: "banana", position: { x: 600, y: 5970 } },
    { id: "c2_a3_banana5", type: "banana", position: { x: 350, y: 5880 } },
    { id: "c2_a3_banana6", type: "banana", position: { x: 200, y: 5770 } },
    { id: "c2_a3_banana7", type: "banana", position: { x: 650, y: 5670 } },
  ],
  checkpoint: {
    id: "c2_checkpoint3",
    position: { x: 600, y: 6330 },
    rotation: 0,
    areaIndex: 2,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 4: Gear Room
 * Multiple rotating gears requiring coordination
 */
const AREA_4: Area = {
  id: "course2_area4",
  areaNumber: 4,
  name: "Gear Room",
  bounds: {
    id: "c2_area4_bounds",
    minX: 0,
    maxX: 800,
    minY: 4800,
    maxY: 5600,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 55,
  obstacles: [
    // Entry platform
    {
      id: "c2_a4_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 5550 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Gear mounting platforms
    {
      id: "c2_a4_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 5350 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a4_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 5150 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a4_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 4950 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit platform
    {
      id: "c2_a4_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 4850 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c2_a4_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 5200 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a4_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 5200 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    // Pits
    {
      id: "c2_a4_pit1",
      type: StaticObstacleType.PIT,
      position: { x: 400, y: 5250 },
      size: { width: 150, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
    {
      id: "c2_a4_pit2",
      type: StaticObstacleType.PIT,
      position: { x: 400, y: 5050 },
      size: { width: 150, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
  ],
  mechanisms: [
    // Gear 1 - L button
    {
      id: "c2_a4_gear1",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 350, y: 5400 },
      config: {
        controlType: "left_button",
        rotationSpeed: 80,
        rotationRange: { min: -45, max: 90 },
        armLength: 120,
        returnToNeutral: false,
      },
    },
    // Gear 2 - R button
    {
      id: "c2_a4_gear2",
      type: MechanismType.R_ROTATING_GEAR,
      position: { x: 450, y: 5200 },
      config: {
        controlType: "right_button",
        rotationSpeed: 90,
        rotationRange: { min: -60, max: 60 },
        armLength: 110,
        returnToNeutral: true,
      },
    },
    // Gear 3 - L button
    {
      id: "c2_a4_gear3",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 350, y: 5000 },
      config: {
        controlType: "left_button",
        rotationSpeed: 70,
        rotationRange: { min: 0, max: 75 },
        armLength: 100,
        returnToNeutral: true,
      },
    },
  ],
  collectibles: [
    { id: "c2_a4_banana1", type: "banana", position: { x: 550, y: 5520 } },
    { id: "c2_a4_banana2", type: "banana", position: { x: 250, y: 5450 } },
    { id: "c2_a4_banana3", type: "banana", position: { x: 150, y: 5320 } },
    { id: "c2_a4_banana4", type: "banana", position: { x: 550, y: 5250 } },
    { id: "c2_a4_banana5", type: "banana", position: { x: 650, y: 5120 } },
    { id: "c2_a4_banana6", type: "banana", position: { x: 250, y: 5050 } },
    { id: "c2_a4_banana7", type: "banana", position: { x: 150, y: 4920 } },
    { id: "c2_a4_banana8", type: "banana", position: { x: 650, y: 4820 } },
    {
      id: "c2_a4_coin1",
      type: "coin",
      position: { x: 400, y: 5100 },
      value: 500,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c2_checkpoint4",
    position: { x: 600, y: 5530 },
    rotation: 0,
    areaIndex: 3,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 5: Slippery Slopes
 * Ice-like metal surfaces with minimal friction
 */
const AREA_5: Area = {
  id: "course2_area5",
  areaNumber: 5,
  name: "Slippery Slopes",
  bounds: {
    id: "c2_area5_bounds",
    minX: 0,
    maxX: 800,
    minY: 4000,
    maxY: 4800,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 40,
  obstacles: [
    // Entry platform
    {
      id: "c2_a5_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 4750 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Slippery ramps
    {
      id: "c2_a5_ramp1",
      type: StaticObstacleType.RAMP,
      position: { x: 400, y: 4650 },
      size: { width: 250, height: 20 },
      rotation: 20,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c2_a5_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 4550 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.ROUGH, // Safe zone
    },
    {
      id: "c2_a5_ramp2",
      type: StaticObstacleType.RAMP,
      position: { x: 350, y: 4450 },
      size: { width: 220, height: 20 },
      rotation: -25,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c2_a5_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 4350 },
      size: { width: 130, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.ROUGH, // Safe zone
    },
    {
      id: "c2_a5_ramp3",
      type: StaticObstacleType.RAMP,
      position: { x: 400, y: 4200 },
      size: { width: 280, height: 20 },
      rotation: 15,
      surfaceType: SurfaceType.SLIPPERY,
    },
    // Exit platform
    {
      id: "c2_a5_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 4100 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c2_a5_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 4400 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a5_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 4400 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    // Bumper walls (very important on slippery surfaces!)
    {
      id: "c2_a5_bumper1",
      type: StaticObstacleType.BUMPER,
      position: { x: 50, y: 4500 },
      size: { width: 20, height: 150 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
    {
      id: "c2_a5_bumper2",
      type: StaticObstacleType.BUMPER,
      position: { x: 750, y: 4300 },
      size: { width: 20, height: 150 },
      rotation: 0,
      surfaceType: SurfaceType.BOUNCY,
    },
  ],
  mechanisms: [],
  collectibles: [
    { id: "c2_a5_banana1", type: "banana", position: { x: 550, y: 4720 } },
    { id: "c2_a5_banana2", type: "banana", position: { x: 350, y: 4620 } },
    { id: "c2_a5_banana3", type: "banana", position: { x: 200, y: 4520 } },
    { id: "c2_a5_banana4", type: "banana", position: { x: 450, y: 4420 } },
    { id: "c2_a5_banana5", type: "banana", position: { x: 650, y: 4320 } },
    { id: "c2_a5_banana6", type: "banana", position: { x: 350, y: 4170 } },
    { id: "c2_a5_banana7", type: "banana", position: { x: 200, y: 4070 } },
  ],
  checkpoint: {
    id: "c2_checkpoint5",
    position: { x: 600, y: 4730 },
    rotation: 0,
    areaIndex: 4,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 6: Vertical Shaft
 * Long sequence of lift platforms
 */
const AREA_6: Area = {
  id: "course2_area6",
  areaNumber: 6,
  name: "Vertical Shaft",
  bounds: {
    id: "c2_area6_bounds",
    minX: 0,
    maxX: 800,
    minY: 3200,
    maxY: 4000,
  },
  scrollDirection: "vertical",
  cameraZoom: 0.95,
  parTime: 60,
  obstacles: [
    // Entry platform
    {
      id: "c2_a6_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 3950 },
      size: { width: 150, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Rest platforms between lifts
    {
      id: "c2_a6_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 3750 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a6_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 3550 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a6_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 3350 },
      size: { width: 120, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit platform
    {
      id: "c2_a6_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 3250 },
      size: { width: 200, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c2_a6_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 3600 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a6_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 3600 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
  ],
  mechanisms: [
    // Lift 1 - L button
    {
      id: "c2_a6_lift1",
      type: MechanismType.L_LIFT_PLATFORM,
      position: { x: 400, y: 3850 },
      config: {
        controlType: "left_button",
        startPosition: { x: 400, y: 3850 },
        endPosition: { x: 400, y: 3700 },
        moveSpeed: 100,
      },
    },
    // Lift 2 - R button
    {
      id: "c2_a6_lift2",
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
      id: "c2_a6_lift3",
      type: MechanismType.L_LIFT_PLATFORM,
      position: { x: 400, y: 3450 },
      config: {
        controlType: "left_button",
        startPosition: { x: 400, y: 3450 },
        endPosition: { x: 400, y: 3300 },
        moveSpeed: 80,
      },
    },
  ],
  collectibles: [
    { id: "c2_a6_banana1", type: "banana", position: { x: 200, y: 3920 } },
    { id: "c2_a6_banana2", type: "banana", position: { x: 400, y: 3800 } },
    { id: "c2_a6_banana3", type: "banana", position: { x: 600, y: 3720 } },
    { id: "c2_a6_banana4", type: "banana", position: { x: 400, y: 3600 } },
    { id: "c2_a6_banana5", type: "banana", position: { x: 200, y: 3520 } },
    { id: "c2_a6_banana6", type: "banana", position: { x: 400, y: 3400 } },
    { id: "c2_a6_banana7", type: "banana", position: { x: 600, y: 3320 } },
    { id: "c2_a6_banana8", type: "banana", position: { x: 450, y: 3220 } },
    {
      id: "c2_a6_coin1",
      type: "coin",
      position: { x: 400, y: 3500 },
      value: 500,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c2_checkpoint6",
    position: { x: 150, y: 3930 },
    rotation: 0,
    areaIndex: 5,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 7: Control Room
 * Joystick-heavy section with precise control
 */
const AREA_7: Area = {
  id: "course2_area7",
  areaNumber: 7,
  name: "Control Room",
  bounds: {
    id: "c2_area7_bounds",
    minX: 0,
    maxX: 800,
    minY: 2400,
    maxY: 3200,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 55,
  obstacles: [
    // Entry platform
    {
      id: "c2_a7_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 3150 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Gear platforms
    {
      id: "c2_a7_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 2950 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a7_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 2750 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a7_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 2550 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit platform
    {
      id: "c2_a7_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 2450 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c2_a7_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 2800 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a7_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 2800 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    // Spikes
    {
      id: "c2_a7_spikes1",
      type: StaticObstacleType.SPIKES,
      position: { x: 400, y: 3000 },
      size: { width: 120, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
    {
      id: "c2_a7_spikes2",
      type: StaticObstacleType.SPIKES,
      position: { x: 400, y: 2600 },
      size: { width: 120, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
  ],
  mechanisms: [
    // Joystick gear 1 - left stick
    {
      id: "c2_a7_jgear1",
      type: MechanismType.LEFT_STICK_GEAR,
      position: { x: 400, y: 3050 },
      config: {
        controlType: "left_joystick",
        rotationSpeed: 100,
        rotationRange: { min: -75, max: 75 },
        armLength: 130,
        returnToNeutral: true,
      },
    },
    // Joystick gear 2 - right stick
    {
      id: "c2_a7_jgear2",
      type: MechanismType.RIGHT_STICK_GEAR,
      position: { x: 400, y: 2850 },
      config: {
        controlType: "right_joystick",
        rotationSpeed: 110,
        rotationRange: { min: -60, max: 60 },
        armLength: 120,
        returnToNeutral: true,
      },
    },
    // Joystick gear 3 - left stick
    {
      id: "c2_a7_jgear3",
      type: MechanismType.LEFT_STICK_GEAR,
      position: { x: 400, y: 2650 },
      config: {
        controlType: "left_joystick",
        rotationSpeed: 90,
        rotationRange: { min: -45, max: 90 },
        armLength: 110,
        returnToNeutral: false,
      },
    },
  ],
  collectibles: [
    { id: "c2_a7_banana1", type: "banana", position: { x: 450, y: 3120 } },
    { id: "c2_a7_banana2", type: "banana", position: { x: 250, y: 3020 } },
    { id: "c2_a7_banana3", type: "banana", position: { x: 150, y: 2920 } },
    { id: "c2_a7_banana4", type: "banana", position: { x: 550, y: 2820 } },
    { id: "c2_a7_banana5", type: "banana", position: { x: 650, y: 2720 } },
    { id: "c2_a7_banana6", type: "banana", position: { x: 250, y: 2620 } },
    { id: "c2_a7_banana7", type: "banana", position: { x: 150, y: 2520 } },
    { id: "c2_a7_banana8", type: "banana", position: { x: 650, y: 2420 } },
  ],
  checkpoint: {
    id: "c2_checkpoint7",
    position: { x: 400, y: 3130 },
    rotation: 0,
    areaIndex: 6,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 8: Fan Turbines
 * Multiple fan platforms in sequence
 */
const AREA_8: Area = {
  id: "course2_area8",
  areaNumber: 8,
  name: "Fan Turbines",
  bounds: {
    id: "c2_area8_bounds",
    minX: 0,
    maxX: 800,
    minY: 1600,
    maxY: 2400,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 50,
  obstacles: [
    // Entry platform
    {
      id: "c2_a8_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 2350 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Fan landing platforms
    {
      id: "c2_a8_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 2150 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a8_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 1950 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a8_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 1750 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit platform
    {
      id: "c2_a8_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 1700 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c2_a8_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 2000 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a8_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 2000 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
  ],
  mechanisms: [
    // Fan 1
    {
      id: "c2_a8_fan1",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 2250 },
      config: {
        controlType: "blow",
        startPosition: { x: 400, y: 2250 },
        endPosition: { x: 400, y: 2100 },
        moveSpeed: 130,
      },
    },
    // Fan 2
    {
      id: "c2_a8_fan2",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 2050 },
      config: {
        controlType: "blow",
        startPosition: { x: 400, y: 2050 },
        endPosition: { x: 400, y: 1900 },
        moveSpeed: 120,
      },
    },
    // Fan 3
    {
      id: "c2_a8_fan3",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 1850 },
      config: {
        controlType: "blow",
        startPosition: { x: 400, y: 1850 },
        endPosition: { x: 400, y: 1720 },
        moveSpeed: 110,
      },
    },
  ],
  collectibles: [
    { id: "c2_a8_banana1", type: "banana", position: { x: 550, y: 2320 } },
    { id: "c2_a8_banana2", type: "banana", position: { x: 400, y: 2200 } },
    { id: "c2_a8_banana3", type: "banana", position: { x: 200, y: 2120 } },
    { id: "c2_a8_banana4", type: "banana", position: { x: 400, y: 2000 } },
    { id: "c2_a8_banana5", type: "banana", position: { x: 600, y: 1920 } },
    { id: "c2_a8_banana6", type: "banana", position: { x: 400, y: 1800 } },
    { id: "c2_a8_banana7", type: "banana", position: { x: 200, y: 1720 } },
    {
      id: "c2_a8_coin1",
      type: "coin",
      position: { x: 400, y: 1950 },
      value: 500,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c2_checkpoint8",
    position: { x: 600, y: 2330 },
    rotation: 0,
    areaIndex: 7,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 9: Assembly Line
 * Everything combined in a factory assembly line
 */
const AREA_9: Area = {
  id: "course2_area9",
  areaNumber: 9,
  name: "Assembly Line",
  bounds: {
    id: "c2_area9_bounds",
    minX: 0,
    maxX: 800,
    minY: 800,
    maxY: 1600,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 55,
  obstacles: [
    // Entry platform
    {
      id: "c2_a9_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 1550 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Assembly stations
    {
      id: "c2_a9_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 1350 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a9_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 700, y: 1150 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    {
      id: "c2_a9_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 100, y: 950 },
      size: { width: 100, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Exit platform
    {
      id: "c2_a9_plat5",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 850 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c2_a9_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 1200 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a9_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 1200 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
  ],
  mechanisms: [
    // Conveyor with gear
    {
      id: "c2_a9_conv1",
      type: MechanismType.CONVEYOR,
      position: { x: 350, y: 1450 },
      config: {
        controlType: "auto",
        moveSpeed: -90,
      },
    },
    // Gear after conveyor
    {
      id: "c2_a9_gear1",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 400, y: 1250 },
      config: {
        controlType: "left_button",
        rotationSpeed: 85,
        rotationRange: { min: -30, max: 60 },
        armLength: 100,
        returnToNeutral: true,
      },
    },
    // Fan platform
    {
      id: "c2_a9_fan1",
      type: MechanismType.FAN_PLATFORM,
      position: { x: 400, y: 1050 },
      config: {
        controlType: "blow",
        startPosition: { x: 400, y: 1050 },
        endPosition: { x: 400, y: 920 },
        moveSpeed: 120,
      },
    },
  ],
  collectibles: [
    { id: "c2_a9_banana1", type: "banana", position: { x: 550, y: 1520 } },
    { id: "c2_a9_banana2", type: "banana", position: { x: 300, y: 1420 } },
    { id: "c2_a9_banana3", type: "banana", position: { x: 150, y: 1320 } },
    { id: "c2_a9_banana4", type: "banana", position: { x: 500, y: 1220 } },
    { id: "c2_a9_banana5", type: "banana", position: { x: 650, y: 1120 } },
    { id: "c2_a9_banana6", type: "banana", position: { x: 400, y: 1000 } },
    { id: "c2_a9_banana7", type: "banana", position: { x: 150, y: 920 } },
    { id: "c2_a9_banana8", type: "banana", position: { x: 650, y: 820 } },
  ],
  checkpoint: {
    id: "c2_checkpoint9",
    position: { x: 600, y: 1530 },
    rotation: 0,
    areaIndex: 8,
    flags: { autoSave: true, showTransition: true },
  },
};

/**
 * Area 10: Reactor Core
 * Final precision challenge with all mechanisms
 */
const AREA_10: Area = {
  id: "course2_area10",
  areaNumber: 10,
  name: "Reactor Core",
  bounds: {
    id: "c2_area10_bounds",
    minX: 0,
    maxX: 800,
    minY: 0,
    maxY: 800,
  },
  scrollDirection: "vertical",
  cameraZoom: 1.0,
  parTime: 65,
  obstacles: [
    // Entry platform
    {
      id: "c2_a10_plat1",
      type: StaticObstacleType.PLATFORM,
      position: { x: 600, y: 750 },
      size: { width: 180, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Narrow precision platforms
    {
      id: "c2_a10_plat2",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 620 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c2_a10_plat3",
      type: StaticObstacleType.PLATFORM,
      position: { x: 650, y: 480 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.SLIPPERY,
    },
    {
      id: "c2_a10_plat4",
      type: StaticObstacleType.PLATFORM,
      position: { x: 150, y: 340 },
      size: { width: 80, height: 20 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Goal platform
    {
      id: "c2_a10_goal",
      type: StaticObstacleType.PLATFORM,
      position: { x: 400, y: 150 },
      size: { width: 220, height: 30 },
      rotation: 0,
      surfaceType: SurfaceType.METAL,
    },
    // Walls
    {
      id: "c2_a10_wall_left",
      type: StaticObstacleType.WALL,
      position: { x: 0, y: 400 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    {
      id: "c2_a10_wall_right",
      type: StaticObstacleType.WALL,
      position: { x: 775, y: 400 },
      size: { width: 25, height: 800 },
      rotation: 0,
    },
    // Multiple hazards
    {
      id: "c2_a10_spikes1",
      type: StaticObstacleType.SPIKES,
      position: { x: 400, y: 680 },
      size: { width: 100, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
    {
      id: "c2_a10_spikes2",
      type: StaticObstacleType.SPIKES,
      position: { x: 400, y: 400 },
      size: { width: 100, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
    {
      id: "c2_a10_pit1",
      type: StaticObstacleType.PIT,
      position: { x: 400, y: 250 },
      size: { width: 120, height: 20 },
      rotation: 0,
      properties: { isFatal: true },
    },
  ],
  mechanisms: [
    // Gear for timing
    {
      id: "c2_a10_gear1",
      type: MechanismType.L_ROTATING_GEAR,
      position: { x: 400, y: 700 },
      config: {
        controlType: "left_button",
        rotationSpeed: 110,
        rotationRange: { min: -45, max: 45 },
        armLength: 90,
        returnToNeutral: true,
      },
    },
    // Joystick gear
    {
      id: "c2_a10_jgear1",
      type: MechanismType.LEFT_STICK_GEAR,
      position: { x: 400, y: 550 },
      config: {
        controlType: "left_joystick",
        rotationSpeed: 100,
        rotationRange: { min: -60, max: 60 },
        armLength: 100,
        returnToNeutral: true,
      },
    },
    // Final launcher
    {
      id: "c2_a10_launcher1",
      type: MechanismType.R_LAUNCHER,
      position: { x: 150, y: 290 },
      config: {
        controlType: "right_button",
        launchForce: 9,
        chargeTime: 0.9,
        launchDirection: { x: 0.6, y: -0.6 },
      },
    },
  ],
  collectibles: [
    { id: "c2_a10_banana1", type: "banana", position: { x: 550, y: 720 } },
    { id: "c2_a10_banana2", type: "banana", position: { x: 300, y: 650 } },
    { id: "c2_a10_banana3", type: "banana", position: { x: 200, y: 590 } },
    { id: "c2_a10_banana4", type: "banana", position: { x: 500, y: 520 } },
    { id: "c2_a10_banana5", type: "banana", position: { x: 600, y: 450 } },
    { id: "c2_a10_banana6", type: "banana", position: { x: 300, y: 380 } },
    { id: "c2_a10_banana7", type: "banana", position: { x: 200, y: 310 } },
    { id: "c2_a10_banana8", type: "banana", position: { x: 450, y: 120 } },
    {
      id: "c2_a10_coin1",
      type: "coin",
      position: { x: 400, y: 120 },
      value: 1000,
      requiresPrecedingBananas: true,
    },
  ],
  checkpoint: {
    id: "c2_checkpoint10",
    position: { x: 600, y: 730 },
    rotation: 0,
    areaIndex: 9,
    flags: { autoSave: true, showTransition: true },
  },
};

// ============================================
// Export Course 2 Areas
// ============================================

export const COURSE_2_AREAS: Area[] = [
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
// Course 2 Definition
// ============================================

export const COURSE_2: Course = {
  id: "course_2",
  name: "Industrial Zone",
  description:
    "Navigate through a dangerous factory filled with conveyors, gears, and steam pipes. Metal surfaces and precise timing required.",
  theme: "industrial",

  // Dimensions
  width: 800,
  height: 8000,

  // Areas
  areas: COURSE_2_AREAS,

  // Visual layers
  backgroundLayers: [
    {
      id: "bg_factory",
      color: "#2d3436",
      parallaxFactor: 0,
      repeatX: true,
      repeatY: true,
      zIndex: 0,
    },
    {
      id: "bg_machinery",
      color: "#3d4446",
      parallaxFactor: 0.15,
      repeatX: true,
      repeatY: true,
      zIndex: 1,
    },
  ],

  // Camera
  cameraConfig: {
    ...DEFAULT_CAMERA_CONFIG,
    followMode: "ahead",
    followSmoothing: 0.07,
    lookAheadDistance: 90,
    autoZoom: true,
    zoomRange: { min: 0.85, max: 1.1 },
  },

  // Difficulty
  difficulty: 2,

  // Spawn
  startPosition: { x: 100, y: 7880 },
  startRotation: 0,

  // Timing
  parTime: 480, // 8 minutes
  maxTime: 600, // 10 minutes

  // Scoring
  totalBananas: 77,
  totalCoins: 6,
};
