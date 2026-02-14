export interface LayoutPoint {
  x: number;
  z: number;
}

export interface HeightTier {
  id: string;
  y: number;
}

export interface NamedMarker extends LayoutPoint {
  id: string;
  label: string;
}

/*──────────────────────────────────────────────────────────────────────────────
 *  BEACH / PORT ZONE — MASTER LAYOUT
 *
 *  Coordinate convention:
 *    X  east(+) / west(−)     Z  north(+) / south(−)     Y  up(+)
 *
 *  Elevation tiers (south → north):
 *    shore    Y = 0      Z ≈ 8 – 22      sandy beach, wide open
 *    dunes    Y = 0.7    Z ≈ 22 – 30     gentle rise, dune grass
 *    bluff    Y = 1.5    Z ≈ 30 – 40     grassy terrace
 *    plaza    Y = 2.4    Z ≈ 40 – 48     village center
 *
 *  Zone AABB:  minX −46  maxX 24  minZ −30  maxZ 50
 *──────────────────────────────────────────────────────────────────────────────*/

export const BEACH_HEIGHT_TIERS: HeightTier[] = [
  { id: "shore", y: 0 },
  { id: "dunes", y: 0.7 },
  { id: "bluff", y: 1.5 },
  { id: "plaza", y: 2.4 },
  { id: "overlook", y: 3.2 },
];

export const BEACH_POIS = {
  /* ── Pier & fishing ─────────────────────────────── */
  spawnPier: { x: 0, z: 12 }, // center of pier, wide open
  fishingPier: { x: 0, z: 4 }, // south end of pier — faces ocean
  fishingReef: { x: 16, z: 6 }, // reef cove east of pier
  zoneRodStand: { x: 4, z: 14 }, // rod pickup — near pier center

  /* ── Commerce ───────────────────────────────────── */
  sellStand: { x: -10, z: 18 }, // west shore, close to pier exit
  rodShop: { x: -16, z: 44 }, // plaza — west side
  baitShop: { x: -6, z: 44 }, // plaza — east of rod shop

  /* ── Social / quest ─────────────────────────────── */
  questBoard: { x: -2, z: 42 }, // plaza center
  beachNpc: { x: 2, z: 43 }, // next to quest board

  /* ── Challenge course ───────────────────────────── */
  challengeStart: { x: -4, z: 26 }, // dunes zone
  challengeGoal: { x: 10, z: 28 }, // dunes zone, east

  /* ── Zone connectors ────────────────────────────── */
  riverTrailSign: { x: 20, z: 36 }, // east bluff edge → river
  caveTrailSign: { x: 8, z: 47 }, // plaza north → future cave
  volcanoVistaSign: { x: 20, z: 47 }, // NE corner lookout pad
} as const;

export const BEACH_CONNECTORS: NamedMarker[] = [
  { id: "beach_to_river", label: "River Path", x: 22, z: 36 },
  { id: "beach_to_cave_hint", label: "Cave Trail", x: 8, z: 47 },
  { id: "beach_to_volcano_hint", label: "Volcano", x: 20, z: 47 },
];

/*──────────────────────────────────────────────────────────────────────────────
 *  Prop scatter points
 *
 *  Rules that prevent clipping:
 *   • Every point is ≥ 2.5 units from any structure or POI
 *   • Palms / trees are ≥ 3.5 units apart from each other
 *   • Shrubs are ≥ 2 units apart
 *   • Rocks are ≥ 2.5 units apart
 *   • No point inside pier footprint (X −8..8, Z 2..20)
 *   • No point inside reef cove water (X 10..22, Z 0..10) unless reef rock
 *──────────────────────────────────────────────────────────────────────────────*/

export const BEACH_PROP_POINTS = {
  /* ── Palm trees — shore & dune edges ────────────── */
  palms: [
    // West shore line
    { x: -22, z: 10 },
    { x: -26, z: 14 },
    { x: -30, z: 8 },
    { x: -18, z: 6 },
    // East shore line (avoid reef cove)
    { x: 22, z: 14 },
    { x: 20, z: 20 },
    // Dune crest
    { x: -14, z: 24 },
    { x: -8, z: 26 },
    { x: 6, z: 25 },
    { x: 14, z: 24 },
    // Scattered accent
    { x: -34, z: 12 },
    { x: -38, z: 18 },
  ],

  /* ── Broadleaf trees — bluff & upper dunes ─────── */
  trees: [
    // Bluff tree line (west)
    { x: -24, z: 34, color: "#4d7c0f" },
    { x: -28, z: 38, color: "#4f7d2a" },
    { x: -32, z: 34, color: "#527e28" },
    // Bluff tree line (center/east)
    { x: -8, z: 34, color: "#578d33" },
    { x: 4, z: 36, color: "#4d7c0f" },
    { x: 12, z: 34, color: "#5f8f37" },
    { x: 16, z: 38, color: "#578d33" },
    // Plaza edge
    { x: -20, z: 42, color: "#4f7d2a" },
    { x: -24, z: 46, color: "#4a7a10" },
    // Overlook hillside
    { x: -30, z: 40, color: "#4d7c0f" },
    { x: -34, z: 36, color: "#527e28" },
    // West shore — jungle edge
    { x: -36, z: 22, color: "#4f7d2a" },
    { x: -40, z: 16, color: "#4a7a10" },
  ],

  /* ── Shrubs — ground cover, path edges ──────────── */
  shrubs: [
    // Shore perimeter
    { x: -16, z: 12, color: "#65a30d" },
    { x: -20, z: 18, color: "#6cab2f" },
    { x: 18, z: 18, color: "#72b33a" },
    { x: -12, z: 8, color: "#65a30d" },
    // Dune zone
    { x: -4, z: 24, color: "#6cab2f" },
    { x: 10, z: 26, color: "#72b33a" },
    { x: -18, z: 28, color: "#65a30d" },
    // Bluff edges
    { x: -14, z: 32, color: "#6cab2f" },
    { x: 6, z: 32, color: "#72b33a" },
    { x: -22, z: 36, color: "#65a30d" },
    // Plaza greens
    { x: -10, z: 46, color: "#6cab2f" },
    { x: 4, z: 46, color: "#72b33a" },
    // West wilderness
    { x: -34, z: 20, color: "#65a30d" },
    { x: -38, z: 26, color: "#6cab2f" },
  ],

  /* ── Rocks — shore & reef area ──────────────────── */
  rocks: [
    // Shore scatter
    { x: -14, z: 10, scale: 1.1, color: "#94a3b8" },
    { x: -24, z: 6, scale: 0.9, color: "#8ea0ad" },
    { x: 20, z: 12, scale: 0.85, color: "#94a3b8" },
    // Near reef
    { x: 10, z: 10, scale: 1.0, color: "#8ea0ad" },
    { x: 22, z: 8, scale: 0.75, color: "#8799a6" },
    // Dune accent
    { x: -20, z: 22, scale: 0.8, color: "#94a3b8" },
    { x: 14, z: 22, scale: 0.7, color: "#8ea0ad" },
    // Bluff cliff face
    { x: -36, z: 30, scale: 1.2, color: "#7b8b9a" },
    { x: -38, z: 34, scale: 1.0, color: "#7b8b9a" },
    // West boundary
    { x: -42, z: 12, scale: 1.3, color: "#6b7a86" },
    { x: -40, z: 22, scale: 0.9, color: "#7b8b9a" },
  ],

  /* ── Reef underwater rocks ──────────────────────── */
  reefUnderwaterRocks: [
    { x: 12, z: 2, scale: 0.75, color: "#86a6ad" },
    { x: 15, z: 4, scale: 0.65, color: "#86a6ad" },
    { x: 18, z: 2, scale: 0.8, color: "#7f9ea5" },
    { x: 14, z: 6, scale: 0.55, color: "#86a6ad" },
    { x: 17, z: 8, scale: 0.6, color: "#7f9ea5" },
    { x: 11, z: 5, scale: 0.5, color: "#86a6ad" },
  ],

  /* ── Dune grass clumps — shore→dune transition ──── */
  duneGrass: [
    { x: -10, z: 20 },
    { x: -2, z: 22 },
    { x: 6, z: 20 },
    { x: 12, z: 22 },
    { x: -16, z: 22 },
    { x: -6, z: 18 },
    { x: 16, z: 18 },
    { x: -22, z: 22 },
  ],
};
