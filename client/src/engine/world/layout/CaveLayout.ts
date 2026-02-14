export interface CaveWaterNode {
  x: number;
  z: number;
  y: number;
  width: number;
}

/*==============================================================================
 *  CAVE ZONE  —  MASTER LAYOUT
 *
 *  Coordinate convention  (same as beach / river):
 *    X  east(+) / west(-)     Z  north(+) / south(-)     Y  up(+)
 *
 *  Theme:  crystalline underground cavern network.  The player enters from
 *  the river upstream shelf through a descending passage, opens into a
 *  grand cavern with underground lake, crystal gallery, and a puzzle
 *  chamber guarding the path toward the volcano zone.
 *
 *  Elevation tiers:
 *    entry passage    Y = 0.50 → 0.10  (descending ramp from river)
 *    main cavern      Y = 0.10         (grand open chamber)
 *    south ledge      Y = 0.10         (lake rim, fishing area)
 *    lake bed         Y = -0.40        (underwater, non-walkable)
 *    crystal alcove   Y = 0.60         (elevated gallery with crystals)
 *    puzzle plateau   Y = 0.40         (challenge area, 3 pillars)
 *    volcano ledge    Y = 1.00         (future exit, currently blocked)
 *
 *  Zone AABB:  minX 84   maxX 144   minZ -18   maxZ 38
 *
 *  Connection points:
 *    WEST   X=84, Z=8-20   Y=0.50   ←  river zone (upstream shelf)
 *    EAST   X=144, Z=30-38 Y=1.00   →  future volcano zone
 *==============================================================================*/

export const CAVE_POIS = {
  /* -- Entry -------------------------------------------- */
  entryArch: { x: 88, z: 14 },
  returnRiverSign: { x: 86, z: 16 },

  /* -- Hub (west grand cavern, near entrance) ----------- */
  sellStand: { x: 100, z: 20 },
  caveNpc: { x: 104, z: 22 },

  /* -- Fishing (south ledge, underground lake edge) ----- */
  fishingSpot: { x: 108, z: -5 },

  /* -- Grand cavern landmarks --------------------------- */
  grandCrystal: { x: 112, z: 14 },
  zoneRodStand: { x: 118, z: 10 },
  stoneBridge: { x: 109, z: -1 },

  /* -- Challenge (puzzle chamber, east) ----------------- */
  challengeStart: { x: 130, z: 11 },
  puzzlePillarA: { x: 134, z: 6 },
  puzzlePillarB: { x: 137, z: 11 },
  puzzlePillarC: { x: 134, z: 16 },
  puzzleDoor: { x: 141, z: 11 },
  relicPickup: { x: 142, z: 11 },

  /* -- Crystal gallery ---------------------------------- */
  crystalGallery: { x: 122, z: 32 },

  /* -- Zone connectors ---------------------------------- */
  volcanoPassageHint: { x: 140, z: 34 },
} as const;

export const CAVE_CONNECTORS = [
  { id: "cave_to_river", label: "River Path", x: 86, z: 16 },
  { id: "cave_to_volcano_hint", label: "Volcano Passage", x: 140, z: 34 },
] as const;

/*------------------------------------------------------------------------------
 *  Cave water:  underground lake + inlet stream
 *
 *  A stream flows from the entry passage southward into the underground
 *  lake.  The lake is a large still body of water at Y = -0.05, sitting
 *  over the lake bed at Y = -0.40.
 *------------------------------------------------------------------------------*/

export const CAVE_STREAM_PATH: CaveWaterNode[] = [
  { x: 100, z: 4, y: 0.06, width: 2.0 },
  { x: 102, z: 0, y: 0.04, width: 2.4 },
  { x: 104, z: -3, y: 0.02, width: 2.8 },
  { x: 106, z: -5, y: 0.0, width: 3.2 },
  { x: 108, z: -7, y: -0.02, width: 3.6 },
];

/*==============================================================================
 *  Prop scatter points
 *
 *  Anti-clipping rules  (same standards as river):
 *    - Rocks >= 2.5 units apart
 *    - Mushrooms >= 2.0 units apart
 *    - Crystals >= 3.0 units apart
 *    - No prop in lake water area (Z -16 to -8, X 100-118)
 *    - No prop inside structure footprints
 *    - Stone lanterns along main paths only
 *==============================================================================*/

export const CAVE_PROP_POINTS = {
  /* -- Rocks (cave boulders, various grays) -- 28 positions --- */
  rocks: [
    // Entry passage walls
    { x: 86, z: 10, scale: 1.1, color: "#5a5e64" },
    { x: 86, z: 18, scale: 0.9, color: "#4e5258" },
    { x: 90, z: 8, scale: 1.2, color: "#5a5e64" },
    { x: 90, z: 20, scale: 1.0, color: "#4e5258" },
    { x: 94, z: 8, scale: 0.85, color: "#5a5e64" },
    { x: 94, z: 20, scale: 1.1, color: "#4e5258" },
    // Grand cavern scattered
    { x: 100, z: 4, scale: 1.0, color: "#5e6268" },
    { x: 106, z: 24, scale: 0.9, color: "#62666c" },
    { x: 110, z: 2, scale: 1.15, color: "#5a5e64" },
    { x: 114, z: 20, scale: 0.85, color: "#5e6268" },
    { x: 120, z: 4, scale: 1.0, color: "#62666c" },
    { x: 120, z: 24, scale: 0.95, color: "#5a5e64" },
    { x: 126, z: 14, scale: 1.1, color: "#5e6268" },
    { x: 126, z: 24, scale: 0.8, color: "#62666c" },
    // Lake rim
    { x: 100, z: -4, scale: 1.0, color: "#4e5258" },
    { x: 106, z: -2, scale: 0.9, color: "#5a5e64" },
    { x: 114, z: -4, scale: 1.05, color: "#4e5258" },
    { x: 118, z: -2, scale: 0.85, color: "#5a5e64" },
    // Crystal gallery
    { x: 118, z: 30, scale: 0.9, color: "#62666c" },
    { x: 124, z: 34, scale: 1.1, color: "#5a5e64" },
    { x: 128, z: 30, scale: 0.85, color: "#62666c" },
    // Puzzle plateau
    { x: 130, z: 4, scale: 0.9, color: "#5e6268" },
    { x: 130, z: 18, scale: 1.0, color: "#62666c" },
    { x: 140, z: 4, scale: 0.85, color: "#5a5e64" },
    { x: 140, z: 18, scale: 0.9, color: "#62666c" },
    // Boundary accents
    { x: 98, z: -10, scale: 1.2, color: "#4a4e54" },
    { x: 112, z: -10, scale: 1.1, color: "#4a4e54" },
    { x: 130, z: 26, scale: 1.0, color: "#4a4e54" },
  ],

  /* -- Mushroom clusters (bioluminescent) -- 14 positions ----- */
  mushrooms: [
    { x: 98, z: 12 },
    { x: 102, z: 6 },
    { x: 106, z: 18 },
    { x: 110, z: 8 },
    { x: 114, z: 24 },
    { x: 116, z: 4 },
    { x: 120, z: 18 },
    { x: 122, z: 8 },
    { x: 128, z: 20 },
    { x: 104, z: -4 },
    { x: 116, z: -4 },
    { x: 120, z: 30 },
    { x: 126, z: 34 },
    { x: 132, z: 12 },
  ],

  /* -- Ferns (near water and damp areas) -- 12 positions ------ */
  ferns: [
    { x: 100, z: 0 },
    { x: 104, z: -2 },
    { x: 110, z: -4 },
    { x: 116, z: -2 },
    { x: 100, z: 10 },
    { x: 108, z: 26 },
    { x: 116, z: 26 },
    { x: 124, z: 26 },
    { x: 98, z: 18 },
    { x: 106, z: 14 },
    { x: 122, z: 14 },
    { x: 128, z: 8 },
  ],

  /* -- Hanging vines (from cave walls / ceiling) -- 10 pos ---- */
  hangingVines: [
    { x: 88, y: 4.5, z: 10, length: 2.4 },
    { x: 88, y: 4.5, z: 18, length: 2.0 },
    { x: 96, y: 4.8, z: 26, length: 2.6 },
    { x: 104, y: 5.0, z: 26, length: 2.8 },
    { x: 112, y: 5.0, z: 26, length: 3.0 },
    { x: 118, y: 4.6, z: -6, length: 2.2 },
    { x: 106, y: 4.8, z: -6, length: 2.4 },
    { x: 124, y: 4.5, z: 26, length: 2.0 },
    { x: 136, y: 4.0, z: 20, length: 1.8 },
    { x: 134, y: 4.2, z: 2, length: 2.0 },
  ],

  /* -- Crystal formations (custom colored cylinders) -- 18 pos  */
  crystals: [
    // Entry passage — sparse blue hints
    { x: 92, z: 10, color: "#60a5fa", height: 1.2, radius: 0.15, tilt: 0.3 },
    { x: 92, z: 18, color: "#818cf8", height: 0.9, radius: 0.12, tilt: -0.2 },
    // Grand cavern — scattered
    { x: 102, z: 8, color: "#60a5fa", height: 1.4, radius: 0.18, tilt: 0.25 },
    { x: 108, z: 22, color: "#a78bfa", height: 1.1, radius: 0.14, tilt: -0.15 },
    { x: 116, z: 22, color: "#34d399", height: 1.3, radius: 0.16, tilt: 0.2 },
    { x: 122, z: 6, color: "#60a5fa", height: 1.0, radius: 0.13, tilt: -0.3 },
    { x: 126, z: 20, color: "#818cf8", height: 1.5, radius: 0.2, tilt: 0.1 },
    // Grand crystal centerpiece — large
    { x: 112, z: 14, color: "#60a5fa", height: 3.0, radius: 0.35, tilt: 0 },
    { x: 111, z: 13, color: "#818cf8", height: 2.2, radius: 0.22, tilt: 0.15 },
    { x: 113, z: 15, color: "#34d399", height: 2.4, radius: 0.25, tilt: -0.12 },
    // Crystal gallery — dense
    { x: 118, z: 32, color: "#60a5fa", height: 2.0, radius: 0.22, tilt: 0.2 },
    { x: 120, z: 34, color: "#a78bfa", height: 2.5, radius: 0.28, tilt: -0.1 },
    { x: 122, z: 30, color: "#34d399", height: 1.8, radius: 0.2, tilt: 0.15 },
    { x: 124, z: 33, color: "#60a5fa", height: 2.2, radius: 0.25, tilt: -0.2 },
    { x: 126, z: 31, color: "#818cf8", height: 1.6, radius: 0.18, tilt: 0.25 },
    { x: 128, z: 34, color: "#a78bfa", height: 2.0, radius: 0.22, tilt: -0.15 },
    // Lake edge — reflective
    { x: 102, z: -6, color: "#67e8f9", height: 1.0, radius: 0.14, tilt: 0.2 },
    { x: 114, z: -6, color: "#67e8f9", height: 1.2, radius: 0.16, tilt: -0.25 },
  ],

  /* -- Stalactites (cones hanging from cave ceiling) -- 12 pos  */
  stalactites: [
    { x: 96, z: 14, y: 5.6, length: 2.0, radius: 0.3 },
    { x: 100, z: 24, y: 5.8, length: 2.4, radius: 0.35 },
    { x: 106, z: 10, y: 5.4, length: 1.8, radius: 0.28 },
    { x: 110, z: 22, y: 5.6, length: 2.2, radius: 0.32 },
    { x: 116, z: 16, y: 5.8, length: 2.6, radius: 0.36 },
    { x: 122, z: 10, y: 5.4, length: 2.0, radius: 0.3 },
    { x: 108, z: -4, y: 5.2, length: 1.6, radius: 0.25 },
    { x: 118, z: -4, y: 5.4, length: 1.8, radius: 0.28 },
    { x: 128, z: 18, y: 5.0, length: 2.0, radius: 0.3 },
    { x: 132, z: 8, y: 4.8, length: 1.6, radius: 0.25 },
    { x: 136, z: 14, y: 4.6, length: 1.4, radius: 0.22 },
    { x: 120, z: 32, y: 5.0, length: 1.8, radius: 0.28 },
  ],

  /* -- Shrubs (low cave moss / ground cover) -- 10 positions -- */
  shrubs: [
    { x: 98, z: 16 },
    { x: 102, z: 24 },
    { x: 108, z: 4 },
    { x: 114, z: 18 },
    { x: 120, z: 22 },
    { x: 126, z: 10 },
    { x: 110, z: -2 },
    { x: 116, z: -2 },
    { x: 130, z: 22 },
    { x: 124, z: 4 },
  ],

  /* -- Stepping stones (lake crossing) -- 5 positions --------- */
  steppingStones: [
    { x: 108, z: -2, scale: 1.1 },
    { x: 109, z: -4, scale: 0.95 },
    { x: 110, z: -6, scale: 1.0 },
    { x: 109.5, z: -8, scale: 0.9 },
    { x: 109, z: -10, scale: 1.05 },
  ],
};
