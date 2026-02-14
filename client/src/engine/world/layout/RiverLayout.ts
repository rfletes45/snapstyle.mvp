export interface RiverWaterNode {
  x: number;
  z: number;
  y: number;
  width: number;
}

/*==============================================================================
 *  RIVER ZONE  -  MASTER LAYOUT
 *
 *  Coordinate convention  (same as beach):
 *    X  east(+) / west(-)     Z  north(+) / south(-)     Y  up(+)
 *
 *  Elevation tiers (south -> north):
 *    river bed      Y = -0.40   (under water, not walkable)
 *    lowland banks  Y =  0.15   (near water level)
 *    valley trail   Y =  0.70   (main mid-level path)
 *    entry corridor Y =  1.35   (transition from beach)
 *    upper ridge    Y =  2.00   (northern overlook)
 *
 *  Zone AABB:  minX 24   maxX 84   minZ -22   maxZ 44
 *
 *  Connection points:
 *    WEST   X=24, Z=28-44  Y=1.35   ->  beach zone (trail pad)
 *    EAST   X=82, Z=18-24  Y=0.50   ->  future cave zone
 *    NORTH  X=50-62, Z=44  Y=2.00   ->  future volcano zone
 *==============================================================================*/

export const RIVER_POIS = {
  /* -- Entry from beach --------------------------------- */
  entryTrailhead: { x: 28, z: 36 },
  returnBeachSign: { x: 26, z: 38 },

  /* -- Bridge crossing ---------------------------------- */
  bridgeCrossing: { x: 38, z: 12 },

  /* -- Ranger station hub ------------------------------- */
  rangerCabin: { x: 48, z: 26 },
  rangerNpc: { x: 48, z: 22 },
  sellStand: { x: 44, z: 22 },
  campfire: { x: 52, z: 24 },

  /* -- Fishing ------------------------------------------ */
  fishingSpot: { x: 62, z: 6 },
  zoneRodStand: { x: 58, z: 18 },

  /* -- Challenge course --------------------------------- */
  challengeStart: { x: 36, z: -4 },
  challengeGoal: { x: 56, z: -4 },
  challengeSign: { x: 32, z: 2 },

  /* -- Zone connectors & navigation --------------------- */
  caveHintSign: { x: 80, z: 20 },
  volcanoHintSign: { x: 56, z: 42 },

  /* -- Sub-area landmarks ------------------------------- */
  bambooGrove: { x: 52, z: 32 },
  overlookBench: { x: 50, z: 40 },
  steppingStones: { x: 50, z: 11 },
  shrineRuin: { x: 72, z: 22 },
} as const;

export const RIVER_CONNECTORS = [
  { id: "river_to_beach", label: "Beach Path", x: 24, z: 36 },
  { id: "river_to_cave_hint", label: "Cave Trail", x: 82, z: 20 },
  { id: "river_to_volcano_hint", label: "Volcano Path", x: 56, z: 44 },
] as const;

/*------------------------------------------------------------------------------
 *  River water path  (west -> east, main channel)
 *
 *  The river enters from the west at Z~14 and flows eastward, widening
 *  into a calm pool around X 56-68 before narrowing upstream in the east.
 *  Water surface sits at Y = 0.05, rising slightly upstream.
 *------------------------------------------------------------------------------*/

export const RIVER_WATER_PATH: RiverWaterNode[] = [
  { x: 26, z: 14, y: 0.05, width: 5.0 },
  { x: 32, z: 13, y: 0.05, width: 5.5 },
  { x: 38, z: 12, y: 0.05, width: 6.0 }, // bridge crossing
  { x: 44, z: 11.5, y: 0.05, width: 6.5 },
  { x: 50, z: 11, y: 0.05, width: 7.0 },
  { x: 56, z: 10.5, y: 0.05, width: 8.0 }, // widening
  { x: 62, z: 10, y: 0.05, width: 9.0 }, // calm pool center
  { x: 68, z: 10.5, y: 0.05, width: 8.0 }, // narrowing
  { x: 73, z: 11, y: 0.08, width: 6.5 }, // upstream
  { x: 78, z: 12, y: 0.18, width: 5.5 }, // rising
  { x: 82, z: 13, y: 0.35, width: 4.5 }, // exits toward cave
];

/*  Small tributary from bamboo grove flowing south into main river. */
export const RIVER_TRIBUTARY_PATH: RiverWaterNode[] = [
  { x: 52, z: 26, y: 0.55, width: 1.8 },
  { x: 51.5, z: 22, y: 0.3, width: 2.2 },
  { x: 51, z: 18, y: 0.12, width: 2.6 },
  { x: 50.5, z: 15, y: 0.06, width: 2.8 },
];

/*==============================================================================
 *  Prop scatter points
 *
 *  Anti-clipping rules:
 *    - Trees >= 3.5 units apart from each other
 *    - Trees >= 2.5 units from any structure / POI
 *    - Shrubs >= 2.0 units apart
 *    - Rocks >= 2.5 units apart
 *    - No prop inside river water channel (Z 7-15) except lily pads,
 *      reeds at bank edges, and stepping stones
 *    - No prop inside structure footprints
 *    - Bamboo concentrated in grove area (X 48-56, Z 28-36)
 *==============================================================================*/

export const RIVER_PROP_POINTS = {
  /* -- Trees (lush jungle mix) --  ~29 positions ---------- */
  trees: [
    // North ridge tree line
    { x: 42, z: 41, color: "#4f7d2a" },
    { x: 46, z: 39, color: "#527e28" },
    { x: 58, z: 39, color: "#5b8a34" },
    { x: 64, z: 38, color: "#4f7d2a" },
    { x: 72, z: 41, color: "#527e28" },
    { x: 76, z: 38, color: "#4f7d2a" },
    // Valley trail edges
    { x: 40, z: 33, color: "#5b8a34" },
    { x: 42, z: 29, color: "#4f7d2a" },
    { x: 58, z: 29, color: "#527e28" },
    { x: 66, z: 31, color: "#5b8a34" },
    { x: 74, z: 30, color: "#4f7d2a" },
    // South bank tree line
    { x: 32, z: -4, color: "#4f7d2a" },
    { x: 40, z: -5, color: "#527e28" },
    { x: 48, z: -3, color: "#4f7d2a" },
    { x: 56, z: -5, color: "#5b8a34" },
    { x: 64, z: -4, color: "#4f7d2a" },
    { x: 72, z: -5, color: "#527e28" },
    // Entry corridor flanks
    { x: 24, z: 42, color: "#4a7a10" },
    { x: 28, z: 44, color: "#4f7d2a" },
    { x: 34, z: 42, color: "#527e28" },
    { x: 26, z: 32, color: "#5b8a34" },
    // North bank scattered
    { x: 34, z: 20, color: "#4f7d2a" },
    { x: 42, z: 18, color: "#5b8a34" },
    { x: 54, z: 20, color: "#4f7d2a" },
    { x: 66, z: 18, color: "#527e28" },
    { x: 74, z: 20, color: "#5b8a34" },
    // East side
    { x: 78, z: 24, color: "#4a7a10" },
    { x: 80, z: 16, color: "#4f7d2a" },
  ],

  /* -- Canopy trees (large jungle giants) -- 8 positions -- */
  canopyTrees: [
    { x: 44, z: 36, color: "#3d7a18" },
    { x: 52, z: 38, color: "#457f20" },
    { x: 60, z: 36, color: "#3d7a18" },
    { x: 68, z: 38, color: "#457f20" },
    { x: 38, z: 28, color: "#3d7a18" },
    { x: 62, z: 28, color: "#457f20" },
    { x: 70, z: 28, color: "#3d7a18" },
    { x: 76, z: 34, color: "#457f20" },
  ],

  /* -- Bamboo clumps (concentrated in grove) -- 10 pos ---- */
  bamboo: [
    { x: 48, z: 31 },
    { x: 50, z: 33 },
    { x: 52, z: 31 },
    { x: 54, z: 33 },
    { x: 50, z: 29 },
    { x: 54, z: 29 },
    { x: 48, z: 33 },
    { x: 56, z: 31 },
    { x: 50, z: 35 },
    { x: 54, z: 35 },
  ],

  /* -- Shrubs (ground cover, path edges) -- 25 positions -- */
  shrubs: [
    // North bank area
    { x: 36, z: 22 },
    { x: 44, z: 20 },
    { x: 50, z: 22 },
    { x: 58, z: 20 },
    { x: 66, z: 22 },
    { x: 72, z: 20 },
    // Valley trail edges
    { x: 38, z: 26 },
    { x: 44, z: 28 },
    { x: 56, z: 28 },
    { x: 64, z: 26 },
    { x: 72, z: 26 },
    // South bank
    { x: 34, z: 2 },
    { x: 42, z: 0 },
    { x: 50, z: 2 },
    { x: 58, z: 0 },
    { x: 66, z: 2 },
    { x: 74, z: 0 },
    // Entry area
    { x: 26, z: 34 },
    { x: 30, z: 32 },
    { x: 34, z: 34 },
    // Upper ridge
    { x: 44, z: 42 },
    { x: 54, z: 42 },
    { x: 64, z: 42 },
    { x: 74, z: 42 },
    // West bank
    { x: 28, z: 16 },
  ],

  /* -- Ferns (shady areas) -- 12 positions ---------------- */
  ferns: [
    { x: 34, z: 24 },
    { x: 42, z: 22 },
    { x: 48, z: 24 },
    { x: 54, z: 22 },
    { x: 62, z: 24 },
    { x: 68, z: 22 },
    { x: 74, z: 24 },
    { x: 36, z: 32 },
    { x: 44, z: 30 },
    { x: 60, z: 32 },
    { x: 52, z: 34 },
    { x: 68, z: 34 },
  ],

  /* -- Reeds (along riverbanks) -- 18 positions ----------- */
  reeds: [
    // North bank edge (Z 15-16)
    { x: 32, z: 16 },
    { x: 38, z: 15 },
    { x: 44, z: 16 },
    { x: 50, z: 15 },
    { x: 56, z: 16 },
    { x: 62, z: 15 },
    { x: 68, z: 16 },
    { x: 74, z: 15 },
    // South bank edge (Z 5-6)
    { x: 32, z: 6 },
    { x: 38, z: 5 },
    { x: 44, z: 6 },
    { x: 50, z: 5 },
    { x: 56, z: 6 },
    { x: 62, z: 5 },
    { x: 68, z: 6 },
    // Calm pool area
    { x: 58, z: 4 },
    { x: 64, z: 4 },
    { x: 70, z: 8 },
  ],

  /* -- Mushroom clusters (shady spots) -- 8 positions ----- */
  mushrooms: [
    { x: 34, z: 26 },
    { x: 42, z: 32 },
    { x: 48, z: 30 },
    { x: 55, z: 26 },
    { x: 64, z: 32 },
    { x: 70, z: 24 },
    { x: 46, z: 38 },
    { x: 60, z: 38 },
  ],

  /* -- Lily pads (on calm water) -- 6 positions ----------- */
  lilyPads: [
    { x: 58, z: 10 },
    { x: 62, z: 8 },
    { x: 64, z: 12 },
    { x: 66, z: 9 },
    { x: 60, z: 12 },
    { x: 68, z: 11 },
  ],

  /* -- Fallen logs -- 5 positions ------------------------- */
  fallenLogs: [
    { x: 40, z: 20, length: 3.0, rotY: 0.3 },
    { x: 56, z: 18, length: 2.8, rotY: -0.4 },
    { x: 68, z: 25, length: 3.2, rotY: 0.6 },
    { x: 34, z: -2, length: 2.6, rotY: -0.2 },
    { x: 74, z: 16, length: 2.4, rotY: 0.5 },
  ],

  /* -- Hanging vines (from canopy trees) -- 8 positions --- */
  hangingVines: [
    { x: 44, y: 6.0, z: 35, length: 2.8 },
    { x: 52, y: 6.2, z: 37, length: 3.0 },
    { x: 60, y: 5.8, z: 35, length: 2.6 },
    { x: 68, y: 6.0, z: 37, length: 2.4 },
    { x: 36, y: 5.6, z: 27, length: 2.2 },
    { x: 62, y: 5.8, z: 27, length: 2.8 },
    { x: 70, y: 6.0, z: 27, length: 3.2 },
    { x: 76, y: 5.4, z: 33, length: 2.0 },
  ],

  /* -- Rocks (varied sizes and colors) -- 20 positions ---- */
  rocks: [
    // Riverbank mossy
    { x: 30, z: 16, scale: 0.9, color: "#6b8070" },
    { x: 36, z: 14, scale: 1.0, color: "#7a8a7e" },
    { x: 46, z: 14, scale: 0.85, color: "#6b8070" },
    { x: 54, z: 14, scale: 1.1, color: "#7a8a7e" },
    { x: 62, z: 14, scale: 0.95, color: "#6b8070" },
    { x: 70, z: 14, scale: 1.2, color: "#7a8a7e" },
    { x: 76, z: 14, scale: 0.88, color: "#6b8070" },
    // South bank
    { x: 34, z: 4, scale: 1.0, color: "#8f99a6" },
    { x: 44, z: 2, scale: 0.9, color: "#83907f" },
    { x: 54, z: 4, scale: 1.1, color: "#8f99a6" },
    { x: 64, z: 2, scale: 0.95, color: "#83907f" },
    { x: 74, z: 4, scale: 1.0, color: "#8f99a6" },
    // Valley trail / north bank
    { x: 38, z: 24, scale: 0.8, color: "#83907f" },
    { x: 52, z: 20, scale: 0.75, color: "#7a8a7e" },
    { x: 60, z: 22, scale: 0.9, color: "#83907f" },
    { x: 70, z: 18, scale: 1.05, color: "#8f99a6" },
    // Boundary accents
    { x: 28, z: 0, scale: 1.2, color: "#6b7a68" },
    { x: 78, z: 8, scale: 1.15, color: "#6b7a68" },
    { x: 40, z: -6, scale: 1.0, color: "#6b7a68" },
    { x: 60, z: -6, scale: 0.9, color: "#6b7a68" },
  ],

  /* -- Stepping stones (river crossing) -- 5 positions ---- */
  steppingStones: [
    { x: 49.5, z: 14, scale: 1.2 },
    { x: 50.0, z: 12.5, scale: 1.0 },
    { x: 50.5, z: 11, scale: 1.1 },
    { x: 50.0, z: 9.5, scale: 0.95 },
    { x: 49.5, z: 8, scale: 1.15 },
  ],
};
