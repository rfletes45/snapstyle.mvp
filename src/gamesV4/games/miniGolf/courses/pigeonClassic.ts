/**
 * Mini Golf — Pigeon Classic Course Pack (18 holes)
 *
 * All coordinates are in "world units" where 1 unit ≈ 1 meter.
 * Holes are designed portrait-oriented with typical bounds ~4×8 to ~6×12.
 * Walls use chain shapes; sensors define surfaces/hazards.
 *
 * @module gamesV4/games/miniGolf/courses/pigeonClassic
 */

import type { CoursePackDef, HoleDef } from "../types";

// =============================================================================
// Helper: rect wall (outer boundary)
// =============================================================================

function rectWalls(
  w: number,
  h: number,
  inset = 0.05,
): { points: { x: number; y: number }[]; loop: true }[] {
  return [
    {
      points: [
        { x: inset, y: inset },
        { x: w - inset, y: inset },
        { x: w - inset, y: h - inset },
        { x: inset, y: h - inset },
      ],
      loop: true,
    },
  ];
}

// =============================================================================
// Hole 1: Warmup Lane (Par 2) — Straight shot, gentle introduction
// =============================================================================

const hole01: HoleDef = {
  id: "pigeon_01",
  name: "Warmup Lane",
  par: 2,
  bounds: { width: 3, height: 8 },
  tee: { x: 1.5, y: 7 },
  cup: { x: 1.5, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(3, 8),
    // Slight bump on right — first taste of wall bouncing
    {
      points: [
        { x: 2.4, y: 4.8 },
        { x: 2.4, y: 3.8 },
      ],
      loop: false,
    },
  ],
};

// =============================================================================
// Hole 2: Pocket Corner (Par 2) — L-shaped bank shot
// =============================================================================

const hole02: HoleDef = {
  id: "pigeon_02",
  name: "Pocket Corner",
  par: 2,
  bounds: { width: 5, height: 8 },
  tee: { x: 1.5, y: 7 },
  cup: { x: 3.5, y: 1.5 },
  cupRadius: 0.17,
  walls: [
    // L-shaped corridor
    {
      points: [
        { x: 0.05, y: 0.05 },
        { x: 5, y: 0.05 },
        { x: 5, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 5 },
        { x: 3, y: 8 },
        { x: 0.05, y: 8 },
      ],
      loop: true,
    },
    // Inner corner wall
    {
      points: [
        { x: 2, y: 3 },
        { x: 2, y: 5 },
      ],
      loop: false,
    },
  ],
};

// =============================================================================
// Hole 3: Twin Posts (Par 3) — Navigate double bumper gates
// =============================================================================

const hole03: HoleDef = {
  id: "pigeon_03",
  name: "Twin Posts",
  par: 3,
  bounds: { width: 4, height: 9 },
  tee: { x: 2, y: 8 },
  cup: { x: 2, y: 1 },
  cupRadius: 0.17,
  walls: rectWalls(4, 9),
  bumpers: [
    // Two narrow gate posts at y=5
    { pos: { x: 1.3, y: 5 }, radius: 0.2, restitution: 0.8 },
    { pos: { x: 2.7, y: 5 }, radius: 0.2, restitution: 0.8 },
    // Two more at y=3
    { pos: { x: 1.6, y: 3 }, radius: 0.2, restitution: 0.8 },
    { pos: { x: 2.4, y: 3 }, radius: 0.2, restitution: 0.8 },
  ],
};

// =============================================================================
// Hole 4: Sand Trap Split (Par 3) — Two paths, both hazardous
// =============================================================================

const hole04: HoleDef = {
  id: "pigeon_04",
  name: "Sand Trap Split",
  par: 3,
  bounds: { width: 4, height: 9 },
  tee: { x: 2, y: 8 },
  cup: { x: 2, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(4, 9),
    // Center divider with gaps
    {
      points: [
        { x: 2, y: 3 },
        { x: 2, y: 5 },
      ],
      loop: false,
    },
  ],
  surfaces: [
    // Sand trap on left path
    {
      type: "sand",
      vertices: [
        { x: 0.3, y: 3.5 },
        { x: 1.8, y: 3.5 },
        { x: 1.8, y: 5 },
        { x: 0.3, y: 5 },
      ],
    },
    // Sand trap on right path
    {
      type: "sand",
      vertices: [
        { x: 2.2, y: 4 },
        { x: 3.7, y: 4 },
        { x: 3.7, y: 5.5 },
        { x: 2.2, y: 5.5 },
      ],
    },
  ],
};

// =============================================================================
// Hole 5: Water Shelf (Par 3) — Narrow bridge over water
// =============================================================================

const hole05: HoleDef = {
  id: "pigeon_05",
  name: "Water Shelf",
  par: 3,
  bounds: { width: 4, height: 9 },
  tee: { x: 2, y: 8 },
  cup: { x: 2, y: 1.5 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(4, 9),
    // Shelf walls creating narrow bridge
    {
      points: [
        { x: 0.05, y: 4.5 },
        { x: 1.2, y: 4.5 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 2.8, y: 4.5 },
        { x: 3.95, y: 4.5 },
      ],
      loop: false,
    },
  ],
  hazards: [
    // Water below the shelf
    {
      type: "water",
      vertices: [
        { x: 0.3, y: 4.7 },
        { x: 1.5, y: 4.7 },
        { x: 1.5, y: 6 },
        { x: 0.3, y: 6 },
      ],
    },
    {
      type: "water",
      vertices: [
        { x: 2.5, y: 4.7 },
        { x: 3.7, y: 4.7 },
        { x: 3.7, y: 6 },
        { x: 2.5, y: 6 },
      ],
    },
  ],
};

// =============================================================================
// Hole 6: Bumper Pinball (Par 3) — Ricochet through bumper field
// =============================================================================

const hole06: HoleDef = {
  id: "pigeon_06",
  name: "Bumper Pinball",
  par: 3,
  bounds: { width: 4, height: 9 },
  tee: { x: 2, y: 8 },
  cup: { x: 2, y: 1 },
  cupRadius: 0.17,
  walls: rectWalls(4, 9),
  bumpers: [
    { pos: { x: 1.3, y: 6 }, radius: 0.25, restitution: 1.3 },
    { pos: { x: 2.7, y: 6 }, radius: 0.25, restitution: 1.3 },
    { pos: { x: 2, y: 4.5 }, radius: 0.3, restitution: 1.3 },
    { pos: { x: 1, y: 3 }, radius: 0.25, restitution: 1.3 },
    { pos: { x: 3, y: 3 }, radius: 0.25, restitution: 1.3 },
    { pos: { x: 2, y: 2 }, radius: 0.2, restitution: 1.3 },
  ],
};

// =============================================================================
// Hole 7: S-Curve Rail (Par 4) — Weave through S-shaped corridor
// =============================================================================

const hole07: HoleDef = {
  id: "pigeon_07",
  name: "S-Curve Rail",
  par: 4,
  bounds: { width: 5, height: 10 },
  tee: { x: 1.5, y: 9 },
  cup: { x: 3.5, y: 1 },
  cupRadius: 0.17,
  walls: [
    // Outer boundary
    {
      points: [
        { x: 0.05, y: 0.05 },
        { x: 5, y: 0.05 },
        { x: 5, y: 10 },
        { x: 0.05, y: 10 },
      ],
      loop: true,
    },
    // S-curve internal walls
    {
      points: [
        { x: 3, y: 8 },
        { x: 3, y: 6.5 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 2, y: 5.5 },
        { x: 2, y: 4 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 3, y: 3 },
        { x: 3, y: 1.5 },
      ],
      loop: false,
    },
  ],
};

// =============================================================================
// Hole 8: Bridge Over Water (Par 4) — Precision through narrow bridge
// =============================================================================

const hole08: HoleDef = {
  id: "pigeon_08",
  name: "Bridge Over Water",
  par: 4,
  bounds: { width: 5, height: 10 },
  tee: { x: 2.5, y: 9 },
  cup: { x: 2.5, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(5, 10),
    // Bridge rails (narrow passage)
    {
      points: [
        { x: 1.8, y: 6.5 },
        { x: 1.8, y: 4.5 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 3.2, y: 6.5 },
        { x: 3.2, y: 4.5 },
      ],
      loop: false,
    },
  ],
  hazards: [
    // Water on left of bridge
    {
      type: "water",
      vertices: [
        { x: 0.3, y: 4.5 },
        { x: 1.6, y: 4.5 },
        { x: 1.6, y: 6.5 },
        { x: 0.3, y: 6.5 },
      ],
    },
    // Water on right of bridge
    {
      type: "water",
      vertices: [
        { x: 3.4, y: 4.5 },
        { x: 4.7, y: 4.5 },
        { x: 4.7, y: 6.5 },
        { x: 3.4, y: 6.5 },
      ],
    },
  ],
};

// =============================================================================
// Hole 9: Slope Nudge (Par 3) — Compensate for cross-slope
// =============================================================================

const hole09: HoleDef = {
  id: "pigeon_09",
  name: "Slope Nudge",
  par: 3,
  bounds: { width: 4, height: 9 },
  tee: { x: 2, y: 8 },
  cup: { x: 2, y: 1 },
  cupRadius: 0.17,
  walls: rectWalls(4, 9),
  slopes: [
    // Slope pushing ball to the right in the middle section
    {
      vertices: [
        { x: 0.3, y: 4 },
        { x: 3.7, y: 4 },
        { x: 3.7, y: 5.5 },
        { x: 0.3, y: 5.5 },
      ],
      force: { x: 1.5, y: 0 },
    },
    // Counter-slope near cup
    {
      vertices: [
        { x: 0.3, y: 1.5 },
        { x: 3.7, y: 1.5 },
        { x: 3.7, y: 2.5 },
        { x: 0.3, y: 2.5 },
      ],
      force: { x: -1.0, y: 0 },
    },
  ],
};

// =============================================================================
// Hole 10: Windmill Gate (Par 4) — Time your shot past the gate
// =============================================================================

const hole10: HoleDef = {
  id: "pigeon_10",
  name: "Windmill Gate",
  par: 4,
  bounds: { width: 4, height: 10 },
  tee: { x: 2, y: 9 },
  cup: { x: 2, y: 1 },
  cupRadius: 0.17,
  walls: rectWalls(4, 10),
  rotatingGates: [
    {
      pivot: { x: 2, y: 5 },
      length: 1.8,
      thickness: 0.12,
      angularVelocity: 0.03, // ~1.7 deg/step
      initialAngle: 0,
    },
  ],
};

// =============================================================================
// Hole 11: Conveyor Strip (Par 4) — Fight the current
// =============================================================================

const hole11: HoleDef = {
  id: "pigeon_11",
  name: "Conveyor Strip",
  par: 4,
  bounds: { width: 4, height: 10 },
  tee: { x: 2, y: 9 },
  cup: { x: 2, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(4, 10),
    // Funnel walls near cup
    {
      points: [
        { x: 0.8, y: 2.5 },
        { x: 1.5, y: 1.5 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 3.2, y: 2.5 },
        { x: 2.5, y: 1.5 },
      ],
      loop: false,
    },
  ],
  conveyors: [
    // Conveyor pushing ball to the left
    {
      vertices: [
        { x: 0.3, y: 5 },
        { x: 3.7, y: 5 },
        { x: 3.7, y: 6.5 },
        { x: 0.3, y: 6.5 },
      ],
      force: { x: -2, y: 0 },
    },
    // Conveyor pushing ball to the right
    {
      vertices: [
        { x: 0.3, y: 3 },
        { x: 3.7, y: 3 },
        { x: 3.7, y: 4.5 },
        { x: 0.3, y: 4.5 },
      ],
      force: { x: 2, y: 0 },
    },
  ],
};

// =============================================================================
// Hole 12: Ice Alley (Par 3) — Low friction chicane
// =============================================================================

const hole12: HoleDef = {
  id: "pigeon_12",
  name: "Ice Alley",
  par: 3,
  bounds: { width: 3, height: 9 },
  tee: { x: 1.5, y: 8 },
  cup: { x: 1.5, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(3, 9),
    // Narrow chicane walls
    {
      points: [
        { x: 0.05, y: 5 },
        { x: 1.5, y: 5 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 1.5, y: 3.5 },
        { x: 2.95, y: 3.5 },
      ],
      loop: false,
    },
  ],
  surfaces: [
    // Ice covering most of the alley
    {
      type: "ice",
      vertices: [
        { x: 0.1, y: 0.1 },
        { x: 2.9, y: 0.1 },
        { x: 2.9, y: 8.9 },
        { x: 0.1, y: 8.9 },
      ],
    },
  ],
};

// =============================================================================
// Hole 13: Spinner Bowl (Par 4) — Bumper ring + rotating gate
// =============================================================================

const hole13: HoleDef = {
  id: "pigeon_13",
  name: "Spinner Bowl",
  par: 4,
  bounds: { width: 5, height: 10 },
  tee: { x: 2.5, y: 9 },
  cup: { x: 2.5, y: 1.5 },
  cupRadius: 0.17,
  walls: rectWalls(5, 10),
  bumpers: [
    // Ring of bumpers forming a bowl
    { pos: { x: 1.5, y: 5 }, radius: 0.3, restitution: 1.2 },
    { pos: { x: 3.5, y: 5 }, radius: 0.3, restitution: 1.2 },
    { pos: { x: 2.5, y: 4 }, radius: 0.3, restitution: 1.2 },
    { pos: { x: 2.5, y: 6 }, radius: 0.3, restitution: 1.2 },
  ],
  rotatingGates: [
    {
      pivot: { x: 2.5, y: 5 },
      length: 1.4,
      thickness: 0.1,
      angularVelocity: 0.04,
      initialAngle: 0,
    },
  ],
};

// =============================================================================
// Hole 14: Portal Pair (Par 4) — Teleport between chambers
// =============================================================================

const hole14: HoleDef = {
  id: "pigeon_14",
  name: "Portal Pair",
  par: 4,
  bounds: { width: 5, height: 10 },
  tee: { x: 1.5, y: 9 },
  cup: { x: 3.5, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(5, 10),
    // Walls creating separated chambers
    {
      points: [
        { x: 2.5, y: 7 },
        { x: 2.5, y: 3 },
      ],
      loop: false,
    },
  ],
  portals: [
    {
      id: "portal_a",
      pos: { x: 1.5, y: 3.5 },
      radius: 0.25,
      targetId: "portal_b",
      exitOffset: { x: 0, y: -0.5 },
    },
    {
      id: "portal_b",
      pos: { x: 3.5, y: 6.5 },
      radius: 0.25,
      targetId: "portal_a",
      exitOffset: { x: 0, y: -0.5 },
    },
  ],
};

// =============================================================================
// Hole 15: Bump + Ramp (Par 5) — Zigzag with boost zone
// =============================================================================

const hole15: HoleDef = {
  id: "pigeon_15",
  name: "Bump + Ramp",
  par: 5,
  bounds: { width: 5, height: 12 },
  tee: { x: 2.5, y: 11 },
  cup: { x: 2.5, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(5, 12),
    // Zigzag walls
    {
      points: [
        { x: 0.05, y: 8 },
        { x: 3.5, y: 8 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 1.5, y: 6 },
        { x: 4.95, y: 6 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 0.05, y: 4 },
        { x: 3.5, y: 4 },
      ],
      loop: false,
    },
  ],
  bumpers: [
    { pos: { x: 4, y: 9 }, radius: 0.3, restitution: 1.2 },
    { pos: { x: 1, y: 7 }, radius: 0.3, restitution: 1.2 },
    { pos: { x: 4, y: 5 }, radius: 0.3, restitution: 1.2 },
  ],
  boosts: [
    // "Ramp" impulse zone — gives a forward boost
    {
      vertices: [
        { x: 1.5, y: 2.5 },
        { x: 3.5, y: 2.5 },
        { x: 3.5, y: 3.5 },
        { x: 1.5, y: 3.5 },
      ],
      impulse: { x: 0, y: -3 },
    },
  ],
};

// =============================================================================
// Hole 16: Needle Thread (Par 5) — Precision through narrow gates
// =============================================================================

const hole16: HoleDef = {
  id: "pigeon_16",
  name: "Needle Thread",
  par: 5,
  bounds: { width: 4, height: 12 },
  tee: { x: 2, y: 11 },
  cup: { x: 2, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(4, 12),
    // Narrow gates stacked vertically
    {
      points: [
        { x: 0.05, y: 9 },
        { x: 1.5, y: 9 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 2.5, y: 9 },
        { x: 3.95, y: 9 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 0.05, y: 7 },
        { x: 1.3, y: 7 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 2.7, y: 7 },
        { x: 3.95, y: 7 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 0.05, y: 5 },
        { x: 1.6, y: 5 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 2.4, y: 5 },
        { x: 3.95, y: 5 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 0.05, y: 3 },
        { x: 1.4, y: 3 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 2.6, y: 3 },
        { x: 3.95, y: 3 },
      ],
      loop: false,
    },
  ],
  surfaces: [
    // Rough patches between gates
    {
      type: "rough",
      vertices: [
        { x: 0.3, y: 5.2 },
        { x: 3.7, y: 5.2 },
        { x: 3.7, y: 6.8 },
        { x: 0.3, y: 6.8 },
      ],
    },
  ],
};

// =============================================================================
// Hole 17: Split Decision (Par 5) — Choose left (sand) or right (water)
// =============================================================================

const hole17: HoleDef = {
  id: "pigeon_17",
  name: "Split Decision",
  par: 5,
  bounds: { width: 6, height: 10 },
  tee: { x: 3, y: 9 },
  cup: { x: 3, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(6, 10),
    // Center island creating two paths (left and right)
    {
      points: [
        { x: 2.3, y: 7.5 },
        { x: 3.7, y: 7.5 },
        { x: 3.7, y: 3 },
        { x: 2.3, y: 3 },
      ],
      loop: true,
    },
  ],
  surfaces: [
    // Sand on left path
    {
      type: "sand",
      vertices: [
        { x: 0.3, y: 4 },
        { x: 2.1, y: 4 },
        { x: 2.1, y: 5.5 },
        { x: 0.3, y: 5.5 },
      ],
    },
  ],
  hazards: [
    // Water on right path
    {
      type: "water",
      vertices: [
        { x: 3.9, y: 5 },
        { x: 5.7, y: 5 },
        { x: 5.7, y: 6.5 },
        { x: 3.9, y: 6.5 },
      ],
    },
  ],
  bumpers: [
    { pos: { x: 1.2, y: 3.5 }, radius: 0.2, restitution: 1.1 },
    { pos: { x: 4.8, y: 3.5 }, radius: 0.2, restitution: 1.1 },
  ],
};

// =============================================================================
// Hole 18: Final Gauntlet (Par 6) — Kitchen sink: every mechanic
// =============================================================================

const hole18: HoleDef = {
  id: "pigeon_18",
  name: "Final Gauntlet",
  par: 6,
  bounds: { width: 6, height: 14 },
  tee: { x: 3, y: 13 },
  cup: { x: 3, y: 1 },
  cupRadius: 0.17,
  walls: [
    ...rectWalls(6, 14),
    // S-curve walls
    {
      points: [
        { x: 4, y: 12 },
        { x: 4, y: 10 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 2, y: 9 },
        { x: 2, y: 7 },
      ],
      loop: false,
    },
    {
      points: [
        { x: 4, y: 6 },
        { x: 4, y: 4 },
      ],
      loop: false,
    },
  ],
  bumpers: [
    { pos: { x: 1.5, y: 11 }, radius: 0.3, restitution: 1.3 },
    { pos: { x: 4.5, y: 8 }, radius: 0.3, restitution: 1.3 },
    { pos: { x: 1.5, y: 5 }, radius: 0.3, restitution: 1.3 },
    { pos: { x: 4.5, y: 3 }, radius: 0.25, restitution: 1.2 },
  ],
  surfaces: [
    // Ice section
    {
      type: "ice",
      vertices: [
        { x: 0.3, y: 7 },
        { x: 5.7, y: 7 },
        { x: 5.7, y: 9 },
        { x: 0.3, y: 9 },
      ],
    },
    // Sand section
    {
      type: "sand",
      vertices: [
        { x: 0.3, y: 4 },
        { x: 5.7, y: 4 },
        { x: 5.7, y: 6 },
        { x: 0.3, y: 6 },
      ],
    },
  ],
  hazards: [
    // Water near the end
    {
      type: "water",
      vertices: [
        { x: 0.3, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
        { x: 0.3, y: 3 },
      ],
    },
    {
      type: "water",
      vertices: [
        { x: 4, y: 2 },
        { x: 5.7, y: 2 },
        { x: 5.7, y: 3 },
        { x: 4, y: 3 },
      ],
    },
  ],
  rotatingGates: [
    {
      pivot: { x: 3, y: 3 },
      length: 1.6,
      thickness: 0.12,
      angularVelocity: 0.025,
      initialAngle: 0,
    },
  ],
  conveyors: [
    {
      vertices: [
        { x: 0.3, y: 10 },
        { x: 5.7, y: 10 },
        { x: 5.7, y: 12 },
        { x: 0.3, y: 12 },
      ],
      force: { x: 2, y: 0 },
    },
  ],
};

// =============================================================================
// Course Pack Export
// =============================================================================

export const PIGEON_CLASSIC: CoursePackDef = {
  id: "pigeon_classic",
  name: "Pigeon Classic",
  holes: [
    hole01,
    hole02,
    hole03,
    hole04,
    hole05,
    hole06,
    hole07,
    hole08,
    hole09,
    hole10,
    hole11,
    hole12,
    hole13,
    hole14,
    hole15,
    hole16,
    hole17,
    hole18,
  ],
};

/**
 * Get a course pack by ID.
 */
export function getCoursePack(id: string): CoursePackDef | null {
  if (id === "pigeon_classic") return PIGEON_CLASSIC;
  return null;
}

/**
 * Get total par for a subset of holes.
 */
export function getTotalPar(pack: CoursePackDef, holeCount: number): number {
  return pack.holes.slice(0, holeCount).reduce((sum, h) => sum + h.par, 0);
}
