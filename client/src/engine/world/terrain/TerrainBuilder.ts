import * as THREE from "three";
import { addRamp, addTerrainSlab } from "../props/PropFactory";

/*──────────────────────────────────────────────────────────────────────────────
 *  BEACH TERRAIN
 *
 *  Four walkable tiers from south → north plus boundary / decoration slabs.
 *  Every slab & ramp is carefully positioned so nothing overlaps or clips.
 *
 *  Tier map (Y values):
 *    shore  = 0.00   (Z  8 – 22)
 *    dunes  = 0.70   (Z 22 – 30)
 *    bluff  = 1.50   (Z 30 – 40)
 *    plaza  = 2.40   (Z 40 – 48)
 *    overlook = 3.20 (western hill)
 *──────────────────────────────────────────────────────────────────────────────*/

export function buildBeachTerrain(scene: THREE.Scene): void {
  // ── Walkable tier slabs ────────────────────────────────────────────────

  // Shore — full-width sandy platform (the main play area)
  addTerrainSlab(scene, 80, 20, 0, -4, 14, "#f4d8a2", "beach_shore_slab");

  // Tidal flat — slight rise near reef cove for visual interest
  addTerrainSlab(scene, 16, 10, 0.15, 16, 8, "#e8d0a0", "beach_tidal_flat");

  // Dunes — gentle grass/sand mix
  addTerrainSlab(scene, 72, 10, 0.7, -4, 26, "#e4d09a", "beach_dunes_slab");

  // Bluff — grassy terrace
  addTerrainSlab(scene, 68, 12, 1.5, -4, 36, "#b8d48e", "beach_bluff_slab");

  // Plaza — village center
  addTerrainSlab(scene, 50, 10, 2.4, -8, 44, "#aece86", "beach_plaza_slab");

  // Overlook hill — western elevated viewpoint
  addTerrainSlab(scene, 14, 12, 3.2, -26, 38, "#88a868", "beach_overlook_hill");

  // River trail pad — east corridor connecting to river zone at Y 1.35
  addTerrainSlab(
    scene,
    10,
    14,
    1.35,
    20,
    36,
    "#c4d4a0",
    "beach_river_trail_pad",
  );

  // Volcano lookout pad — NE corner scenic overlook
  addTerrainSlab(
    scene,
    8,
    6,
    1.5,
    20,
    47,
    "#bace94",
    "beach_volcano_lookout_pad",
  );

  // ── Ramps between tiers ────────────────────────────────────────────────

  // Shore → Dunes  (Z-axis ramp, spanning full width)
  addRamp(
    scene,
    40,
    4,
    0,
    0.7,
    -4,
    22,
    "z",
    "#ecca98",
    "beach_ramp_shore_to_dunes",
  );

  // Reef area → Dunes  (secondary eastern ramp)
  addRamp(
    scene,
    14,
    4,
    0,
    0.7,
    14,
    22,
    "z",
    "#e8c896",
    "beach_ramp_reef_to_dunes",
  );

  // Dunes → Bluff
  addRamp(
    scene,
    36,
    3.5,
    0.7,
    1.5,
    -4,
    31.5,
    "z",
    "#ccc292",
    "beach_ramp_dunes_to_bluff",
  );

  // Bluff → Plaza
  addRamp(
    scene,
    32,
    3,
    1.5,
    2.4,
    -6,
    41,
    "z",
    "#b6cc8a",
    "beach_ramp_bluff_to_plaza",
  );

  // Bluff → River trail connector (X-axis, descends east toward river)
  addRamp(
    scene,
    10,
    4,
    1.5,
    1.35,
    16,
    36,
    "x",
    "#c8d098",
    "beach_ramp_bluff_to_river",
  );

  // Bluff → Overlook hill (X-axis, ascends west)
  addRamp(
    scene,
    6,
    5,
    1.5,
    3.2,
    -20,
    38,
    "x",
    "#a0b87c",
    "beach_overlook_ramp",
  );

  // ── Non-walkable boundary & decoration slabs ───────────────────────────

  // Ocean basin — deep floor under water planes
  addTerrainSlab(
    scene,
    140,
    80,
    -2.0,
    -4,
    -10,
    "#2a96aa",
    "beach_ocean_basin",
    {
      walkable: false,
    },
  );

  // Reef shelf — slightly raised seafloor under reef cove
  addTerrainSlab(scene, 18, 12, -0.7, 16, 4, "#4ab0c0", "beach_reef_shelf", {
    walkable: false,
  });

  // Back berm — southern boundary (low, hidden under water)
  addTerrainSlab(scene, 100, 12, -0.8, -4, -16, "#5a7a68", "beach_back_berm", {
    walkable: false,
  });

  // West cliff — impassable western boundary
  addTerrainSlab(scene, 12, 24, 4.0, -42, 30, "#6a7e5a", "beach_west_cliff", {
    walkable: false,
  });

  // East cliff — impassable above river trail
  addTerrainSlab(scene, 6, 10, 4.0, 24, 46, "#728862", "beach_east_cliff", {
    walkable: false,
  });

  // ── Shoreline transition strips (sand → water edge softening) ─────────

  addTerrainSlab(
    scene,
    78,
    2.5,
    -0.06,
    -4,
    9,
    "#ecd4a4",
    "beach_wet_sand_strip",
    {
      walkable: false,
    },
  );
  addTerrainSlab(
    scene,
    76,
    1.2,
    -0.12,
    -4,
    7.6,
    "#dcc89e",
    "beach_tide_strip",
    {
      walkable: false,
    },
  );

  // ── Tier-edge trim strips (mask seams between slabs) ───────────────────

  addTerrainSlab(
    scene,
    68,
    1.2,
    0.72,
    -4,
    21,
    "#e2cc96",
    "beach_dunes_edge_trim",
    {
      walkable: false,
    },
  );
  addTerrainSlab(
    scene,
    64,
    1.0,
    1.52,
    -4,
    30.5,
    "#b0cc86",
    "beach_bluff_edge_trim",
    {
      walkable: false,
    },
  );
  addTerrainSlab(
    scene,
    46,
    0.8,
    2.42,
    -8,
    39.5,
    "#a6c680",
    "beach_plaza_edge_trim",
    {
      walkable: false,
    },
  );

  // ── Worn-path dirt strips (visual wayfinding, not separate walkable) ───

  // Pier exit → dunes (north path)
  addTerrainSlab(
    scene,
    3.0,
    8,
    0.02,
    0,
    18,
    "#e6d2a6",
    "beach_path_pier_north",
    {
      walkable: false,
    },
  );
  // Dunes → bluff center path
  addTerrainSlab(
    scene,
    2.8,
    6,
    0.72,
    -2,
    28,
    "#d8c494",
    "beach_path_dunes_bluff",
    {
      walkable: false,
    },
  );
  // Bluff → plaza center path
  addTerrainSlab(
    scene,
    2.6,
    4,
    1.52,
    -4,
    39,
    "#b8ca88",
    "beach_path_bluff_plaza",
    {
      walkable: false,
    },
  );
  // Pier → reef dock path (east branch)
  addTerrainSlab(
    scene,
    6,
    2.4,
    0.02,
    8,
    12,
    "#e4d0a2",
    "beach_path_pier_reef",
    {
      walkable: false,
    },
  );

  // ── Tide pool depressions near reef ────────────────────────────────────

  addTerrainSlab(scene, 3.5, 2.5, -0.2, 10, 6, "#68c4d4", "beach_tide_pool_1", {
    walkable: false,
  });
  addTerrainSlab(scene, 2.5, 2.0, -0.18, 7, 8, "#6ec8d8", "beach_tide_pool_2", {
    walkable: false,
  });
}

/*==============================================================================
 *  RIVER TERRAIN
 *
 *  Lush jungle river valley.  The river flows west-to-east through the
 *  centre-south of the zone.  Terrain tiers ascend northward toward an
 *  overlook ridge.
 *
 *  Tier map (Y values):
 *    lowland banks  = 0.15   (Z  -7..7  and  Z 15..23)
 *    valley trail   = 0.70   (Z  23..31)
 *    entry corridor = 1.35   (X 23..37, Z 28..44  — matches beach pad)
 *    upper ridge    = 2.00   (X 39..77, Z 35..45)
 *    upstream shelf = 0.50   (X 75..85, Z  5..23)
 *    river channel  = -0.40  (under water, not walkable)
 *==============================================================================*/

export function buildRiverTerrain(scene: THREE.Scene): void {
  // ── Walkable tier slabs ──────────────────────────────────────────────

  // Entry platform — where players arrive from beach zone
  addTerrainSlab(
    scene,
    14,
    16,
    1.35,
    30,
    36,
    "#b4c896",
    "river_entry_platform",
  );

  // Valley trail — main mid-level walkable path
  addTerrainSlab(scene, 44, 8, 0.7, 56, 27, "#9bb87a", "river_valley_trail");

  // North bank — lowland near the river, north side
  addTerrainSlab(scene, 48, 8, 0.15, 55, 19, "#8aad6c", "river_north_bank");

  // South bank — lowland near the river, south side
  addTerrainSlab(scene, 50, 14, 0.15, 54, 0, "#8aad6c", "river_south_bank");

  // Upper ridge — northern overlook
  addTerrainSlab(scene, 38, 10, 2.0, 58, 40, "#7fa060", "river_upper_ridge");

  // Upstream shelf — eastern elevated approach toward cave
  addTerrainSlab(scene, 10, 18, 0.5, 80, 14, "#92b478", "river_upstream_shelf");

  // Challenge area — south of the south bank
  addTerrainSlab(
    scene,
    24,
    8,
    0.15,
    46,
    -11,
    "#88a86a",
    "river_challenge_area",
  );

  // ── Ramps between tiers ──────────────────────────────────────────────

  // Entry corridor -> valley trail  (descend south)
  addRamp(
    scene,
    10,
    5,
    0.7,
    1.35,
    32,
    25.5,
    "z",
    "#a4c08a",
    "river_ramp_entry_to_trail",
  );

  // Valley trail -> north bank  (descend south toward river)
  addRamp(
    scene,
    18,
    4,
    0.15,
    0.7,
    50,
    22,
    "z",
    "#96b47a",
    "river_ramp_trail_to_bank",
  );

  // Valley trail -> upper ridge  (ascend north) — central ramp
  addRamp(
    scene,
    14,
    5,
    0.7,
    2.0,
    56,
    33,
    "z",
    "#8aaa6a",
    "river_ramp_trail_to_ridge",
  );

  // Valley trail -> upper ridge fill ramps (cover the gaps left & right of central ramp)
  addRamp(
    scene,
    16,
    5,
    0.7,
    2.0,
    42,
    33,
    "z",
    "#88a868",
    "river_ramp_trail_to_ridge_west",
  );
  addRamp(
    scene,
    14,
    5,
    0.7,
    2.0,
    70,
    33,
    "z",
    "#8cac6c",
    "river_ramp_trail_to_ridge_east",
  );

  // Entry corridor -> upper ridge  (eastward connection)
  addRamp(
    scene,
    5,
    8,
    1.35,
    2.0,
    38,
    40,
    "x",
    "#98b87c",
    "river_ramp_entry_to_ridge",
  );

  // North bank -> upstream shelf  (eastward ascent)
  addRamp(
    scene,
    5,
    8,
    0.15,
    0.5,
    76,
    16,
    "x",
    "#8eb472",
    "river_ramp_bank_to_upstream",
  );

  // ── River channel bed (under water, not walkable) ────────────────────

  addTerrainSlab(scene, 54, 14, -0.4, 54, 11, "#4a8a70", "river_channel_bed", {
    walkable: false,
  });

  // ── Non-walkable boundary / decoration slabs ─────────────────────────

  // South cliff — impassable southern boundary, lowered to sit on ground
  addTerrainSlab(scene, 56, 8, 1.2, 54, -20, "#5e7a4a", "river_south_cliff", {
    walkable: false,
  });

  // East cliff — split to leave gap Z 8-20 for cave entry corridor
  addTerrainSlab(scene, 6, 12, 1.5, 84, 26, "#5e7a4a", "river_east_cliff_n", {
    walkable: false,
  });
  addTerrainSlab(scene, 6, 4, 1.5, 84, 6, "#5e7a4a", "river_east_cliff_s", {
    walkable: false,
  });

  // North cliff — impassable behind the upper ridge (close to ridge, minimal gap)
  addTerrainSlab(scene, 36, 4, 2.8, 58, 47, "#5e7a4a", "river_north_cliff", {
    walkable: false,
  });

  // ── Edge-trim strips (mask seams between slabs) ──────────────────────

  addTerrainSlab(
    scene,
    42,
    1.0,
    0.72,
    56,
    23.5,
    "#94b474",
    "river_trail_edge_trim",
    {
      walkable: false,
    },
  );
  addTerrainSlab(
    scene,
    36,
    1.0,
    2.02,
    58,
    35.5,
    "#7ea462",
    "river_ridge_edge_trim",
    {
      walkable: false,
    },
  );

  // ── Worn-path dirt strips (visual wayfinding) ────────────────────────

  // Entry descent path
  addTerrainSlab(
    scene,
    3.0,
    10,
    0.72,
    32,
    26,
    "#c4bc8e",
    "river_path_entry_descent",
    {
      walkable: false,
    },
  );
  // Trail to bridge
  addTerrainSlab(
    scene,
    12,
    2.4,
    0.17,
    40,
    18,
    "#b8b086",
    "river_path_to_bridge",
    {
      walkable: false,
    },
  );
  // Trail to campfire / ranger
  addTerrainSlab(scene, 10, 2.4, 0.72, 48, 25, "#c0b88a", "river_path_ranger", {
    walkable: false,
  });
}

/*==============================================================================
 *  CAVE TERRAIN
 *
 *  Underground crystalline cavern accessed from the river upstream shelf.
 *  The entry passage descends from the river (Y 0.50) into a sprawling
 *  grand cavern at Y 0.10, with side areas at varying heights.
 *
 *  Tier map (Y values):
 *    entry passage   = 0.50 → 0.10  (X-axis ramp, west to east)
 *    main cavern     = 0.10          (grand open chamber)
 *    south ledge     = 0.10          (lake rim, fishing area)
 *    lake bed        = -0.40         (underwater, non-walkable)
 *    crystal alcove  = 0.60          (elevated gallery)
 *    puzzle plateau  = 0.40          (challenge area, 3 pillars)
 *    volcano ledge   = 1.00          (future exit)
 *==============================================================================*/

export function buildCaveTerrain(scene: THREE.Scene): void {
  // ── Entry passage (ramp from river shelf, descending east) ───────────

  addRamp(scene, 12, 12, 0.5, 0.1, 90, 14, "x", "#5c5e62", "cave_entry_ramp");

  // ── Grand cavern floor ───────────────────────────────────────────────

  addTerrainSlab(scene, 34, 30, 0.1, 113, 13, "#5c5e62", "cave_main_floor");

  // ── South ledge (lake rim, extends south of main cavern) ─────────────

  addTerrainSlab(scene, 22, 6, 0.1, 109, -5, "#585a5e", "cave_south_ledge");

  // ── Lake bed (sunken, non-walkable) ──────────────────────────────────

  addTerrainSlab(scene, 18, 8, -0.4, 109, -12, "#3a4a48", "cave_lake_bed", {
    walkable: false,
  });

  // Transition slope: south ledge -> lake bed
  addRamp(
    scene,
    18,
    2,
    0.1,
    -0.4,
    109,
    -8.5,
    "z",
    "#4a5450",
    "cave_ramp_ledge_to_lake",
  );

  // ── Crystal alcove (elevated gallery, north of main cavern) ──────────

  addTerrainSlab(scene, 14, 8, 0.6, 123, 32, "#5a5e64", "cave_crystal_alcove");

  // Ramp: main cavern -> crystal alcove
  addRamp(
    scene,
    14,
    3,
    0.1,
    0.6,
    123,
    27.5,
    "z",
    "#585c62",
    "cave_ramp_to_crystal",
  );

  // ── Puzzle plateau (elevated challenge area, east of main cavern) ────

  addTerrainSlab(scene, 14, 14, 0.4, 135, 11, "#52565c", "cave_puzzle_plateau");

  // Ramp: main cavern -> puzzle plateau
  addRamp(
    scene,
    4,
    14,
    0.1,
    0.4,
    128,
    11,
    "x",
    "#545860",
    "cave_ramp_to_puzzle",
  );

  // ── Volcano preview ledge (future exit, NE corner) ───────────────────

  addTerrainSlab(scene, 8, 8, 1.0, 140, 34, "#5e5248", "cave_volcano_ledge");

  // Ramp: crystal alcove -> volcano ledge (ascending east)
  addRamp(
    scene,
    6,
    8,
    0.6,
    1.0,
    133,
    34,
    "x",
    "#5a544c",
    "cave_ramp_to_volcano",
  );

  // ── Cave wall slabs (non-walkable boundary / enclosure) ──────────────

  // North wall (above crystal alcove)
  addTerrainSlab(scene, 62, 4, 2.8, 114, 39, "#3a3c40", "cave_wall_north", {
    walkable: false,
  });

  // South wall (below lake)
  addTerrainSlab(scene, 50, 4, 2.0, 114, -18, "#3a3c40", "cave_wall_south", {
    walkable: false,
  });

  // East wall (far east boundary)
  addTerrainSlab(scene, 4, 58, 2.4, 146, 12, "#3a3c40", "cave_wall_east", {
    walkable: false,
  });

  // West entry walls (flanking the entry passage)
  addTerrainSlab(scene, 12, 8, 2.0, 90, 24, "#3a3c40", "cave_wall_entry_n", {
    walkable: false,
  });
  addTerrainSlab(scene, 12, 6, 2.0, 90, 5, "#3a3c40", "cave_wall_entry_s", {
    walkable: false,
  });

  // ── Visual path strips (wayfinding accents) ──────────────────────────

  // Entry -> hub path
  addTerrainSlab(scene, 8, 2.4, 0.12, 100, 16, "#68686e", "cave_path_entry", {
    walkable: false,
  });

  // Hub -> crystal gallery path
  addTerrainSlab(scene, 2.4, 8, 0.12, 118, 26, "#68686e", "cave_path_gallery", {
    walkable: false,
  });

  // Hub -> puzzle path
  addTerrainSlab(scene, 8, 2.4, 0.12, 124, 11, "#68686e", "cave_path_puzzle", {
    walkable: false,
  });
}

/*──────────────────────────────────────────────────────────────────────────────
 *  GROUND HEIGHT SAMPLER
 *
 *  Analytical fallback used before runtime raycast is available.
 *  Every region must match the terrain slabs / ramps above exactly.
 *──────────────────────────────────────────────────────────────────────────────*/

function isInside(
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): boolean {
  return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
}

export function createGroundHeightSampler(): (x: number, z: number) => number {
  return (x, z) => {
    let y = 0;

    // ── Pier deck: X −8..8, Z 2..20 ─────────────────
    if (isInside(x, z, -8, 8, 2, 20)) {
      return 0.56;
    }
    // Pier exit ramp (north): slopes down from pier to shore
    if (isInside(x, z, -2, 4, 20, 22)) {
      const t = THREE.MathUtils.clamp((z - 20) / 2, 0, 1);
      return THREE.MathUtils.lerp(0.56, 0, t);
    }

    // ── Tidal flat near reef ─────────────────────────
    if (isInside(x, z, 8, 24, 3, 13)) {
      y = Math.max(y, 0.15);
    }

    // ── Dunes ────────────────────────────────────────
    if (isInside(x, z, -40, 24, 20, 24)) {
      // Shore → dunes ramp zone
      const t = THREE.MathUtils.clamp((z - 20) / 4, 0, 1);
      y = Math.max(y, THREE.MathUtils.lerp(0, 0.7, t));
    }
    if (isInside(x, z, -40, 24, 24, 31)) {
      y = Math.max(y, 0.7);
    }

    // ── Dunes → bluff ramp ───────────────────────────
    if (isInside(x, z, -38, 22, 30, 33)) {
      const t = THREE.MathUtils.clamp((z - 30) / 3, 0, 1);
      y = Math.max(y, THREE.MathUtils.lerp(0.7, 1.5, t));
    }

    // ── Bluff ────────────────────────────────────────
    if (isInside(x, z, -38, 22, 33, 40)) {
      y = Math.max(y, 1.5);
    }

    // ── Bluff → plaza ramp ───────────────────────────
    if (isInside(x, z, -33, 17, 39.5, 42)) {
      const t = THREE.MathUtils.clamp((z - 39.5) / 2.5, 0, 1);
      y = Math.max(y, THREE.MathUtils.lerp(1.5, 2.4, t));
    }

    // ── Plaza ────────────────────────────────────────
    if (isInside(x, z, -33, 17, 42, 49)) {
      y = Math.max(y, 2.4);
    }

    // ── Overlook hill ────────────────────────────────
    if (isInside(x, z, -33, -19, 32, 44)) {
      y = Math.max(y, 3.2);
    }
    // Overlook ramp (from bluff, heading west)
    if (isInside(x, z, -22, -17, 34, 42)) {
      const t = THREE.MathUtils.clamp((-17 - x) / 5, 0, 1);
      y = Math.max(y, THREE.MathUtils.lerp(1.5, 3.2, t));
    }

    // ── River trail pad ──────────────────────────────
    if (isInside(x, z, 15, 25, 30, 43)) {
      // Bluff → river trail ramp (X-axis)
      if (x >= 13 && x <= 21) {
        const t = THREE.MathUtils.clamp((x - 13) / 8, 0, 1);
        return THREE.MathUtils.lerp(1.5, 1.35, t);
      }
      return 1.35;
    }

    // ── Volcano lookout pad ──────────────────────────
    if (isInside(x, z, 16, 24, 44, 50)) {
      y = Math.max(y, 1.5);
    }

    // ── River region (X 24-84, Z -22 to 44) ─────────
    if (isInside(x, z, 24, 84, -22, 44)) {
      // Entry platform (X 23-37, Z 28-44, Y=1.35)
      if (isInside(x, z, 23, 37, 28, 44)) return 1.35;

      // Upper ridge (X 39-77, Z 35-45, Y=2.0)
      if (isInside(x, z, 39, 77, 35, 45)) return 2.0;

      // Entry -> upper ridge ramp (X-axis, X 35-41)
      if (isInside(x, z, 35, 41, 36, 44)) {
        const t = THREE.MathUtils.clamp((x - 35) / 6, 0, 1);
        return THREE.MathUtils.lerp(1.35, 2.0, t);
      }

      // Valley trail -> upper ridge ramp (Z 30-36) — all three ramp sections
      if (isInside(x, z, 34, 77, 30, 36)) {
        const t = THREE.MathUtils.clamp((z - 30) / 5, 0, 1);
        return THREE.MathUtils.lerp(0.7, 2.0, t);
      }

      // Entry -> valley trail ramp (Z 23-28)
      if (isInside(x, z, 25, 37, 23, 28)) {
        const t = THREE.MathUtils.clamp((z - 23) / 5, 0, 1);
        return THREE.MathUtils.lerp(0.7, 1.35, t);
      }

      // Valley trail (X 34-78, Z 23-31, Y=0.7)
      if (isInside(x, z, 34, 78, 23, 31)) return 0.7;

      // Valley trail -> north bank ramp (Z 20-24)
      if (isInside(x, z, 34, 68, 20, 24)) {
        const t = THREE.MathUtils.clamp((z - 20) / 4, 0, 1);
        return THREE.MathUtils.lerp(0.15, 0.7, t);
      }

      // Upstream shelf (X 75-85, Z 5-23, Y=0.5)
      if (isInside(x, z, 75, 85, 5, 23)) return 0.5;

      // North bank -> upstream ramp (X 73-79)
      if (isInside(x, z, 73, 79, 10, 22)) {
        const t = THREE.MathUtils.clamp((x - 73) / 6, 0, 1);
        return THREE.MathUtils.lerp(0.15, 0.5, t);
      }

      // North bank (X 31-79, Z 15-23, Y=0.15)
      if (isInside(x, z, 31, 79, 15, 23)) return 0.15;

      // South bank (X 29-79, Z -7 to 7, Y=0.15)
      if (isInside(x, z, 29, 79, -7, 7)) return 0.15;

      // Challenge area (X 34-58, Z -15 to -7, Y=0.15)
      if (isInside(x, z, 34, 58, -15, -7)) return 0.15;

      // Default (river channel / below water)
      return 0;
    }

    // ── Cave region (X 84-144, Z -18 to 38) ─────────
    if (isInside(x, z, 84, 144, -18, 38)) {
      // Entry ramp (X 84-96, Z 8-20, Y 0.50→0.10)
      if (isInside(x, z, 84, 96, 8, 20)) {
        const t = THREE.MathUtils.clamp((x - 84) / 12, 0, 1);
        return THREE.MathUtils.lerp(0.5, 0.1, t);
      }

      // Crystal alcove (X 116-130, Z 28-36, Y=0.60)
      if (isInside(x, z, 116, 130, 28, 36)) return 0.6;

      // Crystal ramp (X 116-130, Z 26-28, Y 0.10→0.60)
      if (isInside(x, z, 116, 130, 26, 29)) {
        const t = THREE.MathUtils.clamp((z - 26) / 3, 0, 1);
        return THREE.MathUtils.lerp(0.1, 0.6, t);
      }

      // Volcano ledge (X 136-144, Z 30-38, Y=1.00)
      if (isInside(x, z, 136, 144, 30, 38)) return 1.0;

      // Volcano ramp (X 130-136, Z 30-38, Y 0.60→1.00)
      if (isInside(x, z, 130, 136, 30, 38)) {
        const t = THREE.MathUtils.clamp((x - 130) / 6, 0, 1);
        return THREE.MathUtils.lerp(0.6, 1.0, t);
      }

      // Puzzle plateau (X 128-142, Z 4-18, Y=0.40)
      if (isInside(x, z, 128, 142, 4, 18)) return 0.4;

      // Puzzle ramp (X 126-130, Z 4-18, Y 0.10→0.40)
      if (isInside(x, z, 126, 130, 4, 18)) {
        const t = THREE.MathUtils.clamp((x - 126) / 4, 0, 1);
        return THREE.MathUtils.lerp(0.1, 0.4, t);
      }

      // South ledge (X 98-120, Z -8 to -2, Y=0.10)
      if (isInside(x, z, 98, 120, -8, -2)) return 0.1;

      // Ledge -> lake ramp (X 100-118, Z -9 to -7.5)
      if (isInside(x, z, 100, 118, -9, -7.5)) {
        const t = THREE.MathUtils.clamp((z - -7.5) / -1.5, 0, 1);
        return THREE.MathUtils.lerp(0.1, -0.4, t);
      }

      // Lake bed (X 100-118, Z -16 to -8, Y=-0.40)
      if (isInside(x, z, 100, 118, -16, -8)) return -0.4;

      // Main cavern floor (X 96-130, Z -2 to 28, Y=0.10)
      if (isInside(x, z, 96, 130, -2, 28)) return 0.1;

      // Default cave (outside defined areas)
      return 0;
    }

    return y;
  };
}
