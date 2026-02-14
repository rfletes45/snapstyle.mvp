import * as THREE from "three";
import type { BoxCollider } from "../collision";
import { BEACH_POIS, BEACH_PROP_POINTS } from "./layout/BeachPortLayout";
import { CAVE_POIS, CAVE_PROP_POINTS } from "./layout/CaveLayout";
import { RIVER_POIS, RIVER_PROP_POINTS } from "./layout/RiverLayout";
import {
  addAnchor,
  addBambooClump,
  addBarrel,
  addBeachUmbrella,
  addBench,
  addBoatHull,
  addBox,
  addCampfire,
  addCanopyTree,
  addCylinder,
  addDockCrate,
  addDuneGrass,
  addFallenLog,
  addFernCluster,
  addFishingSpotSet,
  addFlowerBox,
  addFountain,
  addHangingVine,
  addInteractMarker,
  addLanternPost,
  addLifebuoy,
  addLilyPadCluster,
  addMushroomCluster,
  addPalm,
  addReedClump,
  addRock,
  addRodStand,
  addRopeBridge,
  addShrub,
  addSign,
  addSteppingStone,
  addStoneLantern,
  addSurfboard,
  addTikiTorch,
  addTree,
  addWoodenFence,
  addWoodenHut,
  materialFor,
} from "./props/PropFactory";
import {
  buildBeachTerrain,
  buildCaveTerrain,
  buildRiverTerrain,
  createGroundHeightSampler,
} from "./terrain/TerrainBuilder";
import type {
  Interactable,
  MovingPlatformRef,
  WorldBuildResult,
  ZoneRegion,
} from "./types";
import {
  buildBeachWater,
  buildCaveWater,
  buildRiverWater,
} from "./water/WaterBuilder";

function colliderAt(
  x: number,
  z: number,
  width: number,
  depth: number,
): BoxCollider {
  const halfW = width / 2;
  const halfD = depth / 2;
  return {
    minX: x - halfW,
    maxX: x + halfW,
    minZ: z - halfD,
    maxZ: z + halfD,
  };
}

function addCollider(
  colliders: BoxCollider[],
  x: number,
  z: number,
  width: number,
  depth: number,
): void {
  colliders.push(colliderAt(x, z, width, depth));
}

function addSignWithCollider(
  scene: THREE.Scene,
  colliders: BoxCollider[],
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
  width = 1.2,
  depth = 0.82,
): void {
  addSign(scene, x, y, z, color, name);
  addCollider(colliders, x, z, width, depth);
}

function createRuntimeGroundHeightSampler(
  scene: THREE.Scene,
  fallback: (x: number, z: number, currentY?: number) => number,
): (x: number, z: number, currentY?: number) => number {
  const walkables: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) {
      return;
    }
    if (!obj.userData.walkableSurface) {
      return;
    }
    walkables.push(obj);
  });

  scene.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3(0, -1, 0);
  const faceNormal = new THREE.Vector3();

  return (x, z, currentY) => {
    const fallbackY = fallback(x, z, currentY);
    if (!walkables.length) {
      return fallbackY;
    }
    rayOrigin.set(x, 40, z);
    raycaster.set(rayOrigin, rayDirection);
    const hits = raycaster.intersectObjects(walkables, false);
    const referenceY = currentY ?? fallbackY;
    let bestY: number | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const hit of hits) {
      if (hit.face) {
        faceNormal
          .copy(hit.face.normal)
          .transformDirection(hit.object.matrixWorld);
        if (faceNormal.y < 0.32) {
          continue;
        }
      }
      const delta = Math.abs(hit.point.y - referenceY);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestY = hit.point.y;
      }
    }
    if (bestY !== null && bestDelta <= 2.6) {
      return bestY;
    }
    return fallbackY;
  };
}

function addBeachChallenge(scene: THREE.Scene): void {
  for (let i = 0; i < 6; i += 1) {
    // Alternating post heights and slight color variation for visual rhythm.
    const h = 0.42 + (i % 2) * 0.18;
    const shade = i % 2 === 0 ? "#7c3aed" : "#6d28d9";
    addBox(
      scene,
      [0.95, h, 0.95],
      [-1 + i * 1.45, h * 0.5, 27 + (i % 2 === 0 ? 0.25 : -0.2)],
      shade,
      {
        name: `beach_challenge_post_${i + 1}`,
        category: "challenge",
      },
    );
    // Small flag accent on every other post.
    if (i % 2 === 0) {
      addBox(
        scene,
        [0.35, 0.2, 0.06],
        [-1 + i * 1.45, h + 0.12, 27 + 0.25],
        "#f59e0b",
        {
          name: `beach_challenge_flag_${i + 1}`,
          category: "challenge",
        },
      );
    }
  }
  addBox(scene, [1.1, 0.8, 0.9], [8.1, 0.42, 27.3], "#f59e0b", {
    name: "beach_challenge_reward_chest",
    category: "challenge",
  });
  // Chest lid accent.
  addBox(scene, [1.2, 0.18, 1.0], [8.1, 0.88, 27.3], "#d97706", {
    name: "beach_challenge_reward_chest_lid",
    category: "challenge",
  });
}

function addRiverChallenge(scene: THREE.Scene): MovingPlatformRef[] {
  const platforms: MovingPlatformRef[] = [];
  const logColors = ["#92400e", "#7c3612", "#8a3b0e", "#a04810"];
  for (let i = 0; i < 4; i += 1) {
    // Log body: cylinder for natural round look instead of box.
    const log = addCylinder(
      scene,
      0.35,
      0.42,
      2.2,
      8,
      [41 + i * 5.2, 0.22, -2.4 + (i % 2 === 0 ? 1.1 : -1.2)],
      logColors[i],
      {
        name: `river_challenge_log_${i + 1}`,
        category: "challenge",
        walkableSurface: true,
      },
    );
    // Lay the cylinder on its side.
    log.rotation.z = Math.PI * 0.5;
    // Bark ring accents.
    addCylinder(
      scene,
      0.38,
      0.44,
      0.12,
      8,
      [41 + i * 5.2 - 0.6, 0.22, -2.4 + (i % 2 === 0 ? 1.1 : -1.2)],
      "#6b3410",
      {
        name: `river_challenge_log_ring_${i + 1}`,
        category: "challenge",
      },
    ).rotation.z = Math.PI * 0.5;

    platforms.push({
      mesh: log,
      axis: "z",
      base: log.position.z,
      amplitude: 1.3,
      speed: 0.7 + i * 0.12,
      phase: i * 0.8,
    });
  }
  // Reward chest with lid and clasp detail.
  addBox(scene, [1.1, 0.8, 0.9], [61.8, 0.92, -2.3], "#a855f7", {
    name: "river_challenge_reward_chest",
    category: "challenge",
  });
  addBox(scene, [1.2, 0.18, 1.0], [61.8, 1.38, -2.3], "#9333ea", {
    name: "river_challenge_reward_chest_lid",
    category: "challenge",
  });
  addBox(scene, [0.18, 0.22, 0.12], [61.8, 1.2, -1.84], "#fbbf24", {
    name: "river_challenge_reward_chest_clasp",
    category: "challenge",
  });
  return platforms;
}

function addZoneVolumeMarkers(
  scene: THREE.Scene,
  zoneRegions: ZoneRegion[],
): void {
  for (const region of zoneRegions) {
    const width = region.maxX - region.minX;
    const depth = region.maxZ - region.minZ;
    const centerX = region.minX + width * 0.5;
    const centerZ = region.minZ + depth * 0.5;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.1, depth),
      new THREE.MeshBasicMaterial({
        color:
          region.zoneId === "beach"
            ? "#67e8f9"
            : region.zoneId === "river"
              ? "#22c55e"
              : region.zoneId === "cave"
                ? "#60a5fa"
                : region.zoneId === "volcano"
                  ? "#fb923c"
                  : "#facc15",
        transparent: true,
        opacity: 0.18,
        wireframe: true,
        depthWrite: false,
      }),
    );
    marker.name = `zone_volume_${region.zoneId}`;
    marker.position.set(centerX, 4.5, centerZ);
    marker.visible = false;
    marker.renderOrder = 980;
    marker.userData.zoneVolumeMarker = true;
    marker.userData.meshCategory = "debug";
    scene.add(marker);
  }
}

/*••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
 *  BEACH PORT STRUCTURES
 *
 *  All built structures for the beach/port zone.  Each structure is placed
 *  using getGroundHeight() so nothing clips through terrain.
 *
 *  Spacing rules:
 *   €¢ Structures ‰¥ 2 units apart from each other
 *   €¢ Colliders pad visual meshes by ~0.1 unit on each side
 *   €¢ No structure inside water planes (Z < 8) except pier & reef fishing
 *   €¢ Every Y position = getGroundHeight(x, z) + halfHeight
 *••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••*/

function buildBeachPortStructures(
  scene: THREE.Scene,
  colliders: BoxCollider[],
  getGroundHeight: (x: number, z: number, currentY?: number) => number,
): void {
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  PIER  (spawn area €” open, spacious, no enclosure)
  //  Footprint: X ˆ’8..8, Z 2..20.  Open exit north toward shore.
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  const pierTopY = 0.56;
  // Pier surface = top of plank layer (deck + half-thickness + plank center + half-plank)
  const pierSurfaceY = pierTopY + 0.52 + 0.07; // ≈ 1.15

  // Main deck €” thick wooden platform above water
  addBox(scene, [16, 1.0, 18], [0, pierTopY, 11], "#9d7a58", {
    name: "beach_pier_deck",
    category: "structure",
    cullDistanceMultiplier: 1.2,
    walkableSurface: true,
  });
  // Plank surface layer
  addBox(scene, [16.2, 0.14, 18.2], [0, pierTopY + 0.52, 11], "#c09068", {
    name: "beach_pier_top_plank",
    category: "structure",
    flatShaded: false,
    cullDistanceMultiplier: 1.2,
    walkableSurface: true,
  });

  // Support posts (under deck, in water)
  for (let px = -6; px <= 6; px += 4) {
    for (let pz = 4; pz <= 18; pz += 7) {
      addCylinder(scene, 0.3, 0.36, 3.0, 6, [px, -0.4, pz], "#7a5538", {
        name: `beach_pier_post_${px}_${pz}`,
        category: "structure",
        instanceCandidate: true,
        cullDistanceMultiplier: 1.1,
      });
    }
  }

  // Rails €” ONLY south, west, east. North is OPEN for exit.
  addBox(scene, [16, 0.22, 0.22], [0, pierTopY + 0.86, 2.2], "#7b5a3d", {
    name: "beach_pier_rail_south",
    category: "structure",
  });
  addCollider(colliders, 0, 2.2, 16, 0.6);

  addBox(scene, [0.22, 0.22, 18], [-8.1, pierTopY + 0.86, 11], "#7b5a3d", {
    name: "beach_pier_rail_west",
    category: "structure",
  });
  addCollider(colliders, -8.1, 11, 0.6, 18);

  addBox(scene, [0.22, 0.22, 18], [8.1, pierTopY + 0.86, 11], "#7b5a3d", {
    name: "beach_pier_rail_east",
    category: "structure",
  });
  addCollider(colliders, 8.1, 11, 0.6, 18);

  // Rail posts (vertical)
  for (const rx of [-8, -4, 0, 4, 8]) {
    addCylinder(
      scene,
      0.12,
      0.12,
      0.9,
      6,
      [rx, pierTopY + 0.45, 2.2],
      "#7b5a3d",
      {
        name: `beach_pier_rail_post_s_${rx}`,
        category: "structure",
        instanceCandidate: true,
      },
    );
  }
  for (const rz of [4, 8, 12, 16, 20]) {
    addCylinder(
      scene,
      0.12,
      0.12,
      0.9,
      6,
      [-8.1, pierTopY + 0.45, rz],
      "#7b5a3d",
      {
        name: `beach_pier_rail_post_w_${rz}`,
        category: "structure",
        instanceCandidate: true,
      },
    );
    addCylinder(
      scene,
      0.12,
      0.12,
      0.9,
      6,
      [8.1, pierTopY + 0.45, rz],
      "#7b5a3d",
      {
        name: `beach_pier_rail_post_e_${rz}`,
        category: "structure",
        instanceCandidate: true,
      },
    );
  }

  // Pier exit ramp (north end †’ shore level, gentle slope)
  addBox(scene, [6, 0.6, 3], [0, 0.28, 21], "#a8875e", {
    name: "beach_pier_exit_ramp",
    category: "structure",
    walkableSurface: true,
  });

  // Pier accent props €” kept away from edges
  addBarrel(scene, -5, pierSurfaceY, 5, "#8b6b42", "beach_pier_barrel_1");
  addCollider(colliders, -5, 5, 1.0, 1.0);
  addBarrel(scene, -5, pierSurfaceY, 8, "#7a5e3a", "beach_pier_barrel_2");
  addCollider(colliders, -5, 8, 1.0, 1.0);
  addDockCrate(scene, 6, pierSurfaceY, 5, 0.7, "#a0845a", "beach_pier_crate_1");
  addCollider(colliders, 6, 5, 1.0, 1.0);
  addLifebuoy(scene, 6, pierSurfaceY, 16, "beach_pier_lifebuoy");
  addAnchor(scene, -6, pierSurfaceY, 16, 0.6, "beach_pier_anchor");

  // Lanterns on pier
  addLanternPost(scene, -6, pierSurfaceY, 10, "beach_pier_lantern_1");
  addCollider(colliders, -6, 10, 0.6, 0.6);
  addLanternPost(scene, 6, pierSurfaceY, 10, "beach_pier_lantern_2");
  addCollider(colliders, 6, 10, 0.6, 0.6);

  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  FISHING PIER SPOT (south end of pier €” facing ocean)
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  {
    const fx = BEACH_POIS.fishingPier.x;
    const fz = BEACH_POIS.fishingPier.z;
    const fy = pierSurfaceY;
    addFishingSpotSet(scene, fx, fy, fz, "beach_fishing_pier_spot", "#3b82f6");
    addTikiTorch(scene, fx - 2.5, fy, fz, "beach_fishing_pier_torch_l");
    addCollider(colliders, fx - 2.5, fz, 0.5, 0.5);
    addTikiTorch(scene, fx + 2.5, fy, fz, "beach_fishing_pier_torch_r");
    addCollider(colliders, fx + 2.5, fz, 0.5, 0.5);
  }

  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  REEF COVE FISHING SPOT (east of pier, shallow water area)
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  {
    const rx = BEACH_POIS.fishingReef.x;
    const rz = BEACH_POIS.fishingReef.z;
    const ry = getGroundHeight(rx, rz);
    addFishingSpotSet(scene, rx, ry, rz, "beach_reef_fishing_spot", "#22d3ee");
    // Small dock platform at reef edge
    addBox(scene, [4, 0.5, 3], [rx, 0.25, rz + 3], "#9d7a58", {
      name: "beach_reef_dock",
      category: "structure",
      walkableSurface: true,
    });
    addSurfboard(
      scene,
      rx + 2,
      0.5,
      rz + 4,
      "#f97316",
      0.4,
      "beach_reef_surfboard",
    );
  }

  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  SELL STAND (west shore, easy walk from pier)
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  {
    const sx = BEACH_POIS.sellStand.x;
    const sz = BEACH_POIS.sellStand.z;
    const sy = getGroundHeight(sx, sz);
    // Stand body
    addBox(scene, [2.4, 1.8, 1.4], [sx, sy + 0.9, sz], "#c9a96a", {
      name: "beach_sell_stand_body",
      category: "structure",
    });
    // Counter top
    addBox(scene, [2.8, 0.14, 1.8], [sx, sy + 1.86, sz], "#dab87c", {
      name: "beach_sell_stand_counter",
      category: "structure",
    });
    // Awning
    addBox(scene, [3.2, 0.12, 2.2], [sx, sy + 2.8, sz - 0.2], "#f59e0b", {
      name: "beach_sell_stand_awning",
      category: "structure",
    });
    // Support posts for awning
    addCylinder(
      scene,
      0.1,
      0.1,
      2.8,
      6,
      [sx - 1.3, sy + 1.4, sz - 0.8],
      "#8b6b42",
      {
        name: "beach_sell_stand_post_l",
        category: "structure",
      },
    );
    addCylinder(
      scene,
      0.1,
      0.1,
      2.8,
      6,
      [sx + 1.3, sy + 1.4, sz - 0.8],
      "#8b6b42",
      {
        name: "beach_sell_stand_post_r",
        category: "structure",
      },
    );
    addCollider(colliders, sx, sz, 3.0, 2.0);
    // Decorative barrel beside stand
    addBarrel(scene, sx + 2.2, sy, sz, "#7c5e36", "beach_sell_barrel");
    addCollider(colliders, sx + 2.2, sz, 1.0, 1.0);
  }

  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  VILLAGE PLAZA €” Rod shop, Bait shop, Quest board, NPC
  //  Located at Z ~44, the highest walkable tier (Y = 2.4)
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  // Rod Shop (west side of plaza)
  {
    const rx = BEACH_POIS.rodShop.x;
    const rz = BEACH_POIS.rodShop.z;
    const ry = getGroundHeight(rx, rz);
    addWoodenHut(scene, rx, ry, rz, 0, "beach_rod_shop_hut");
    // Split collider: back wall + side walls, open front (north)
    addCollider(colliders, rx, rz - 1.4, 4.0, 0.8);
    addCollider(colliders, rx - 1.8, rz, 0.6, 3.6);
    addCollider(colliders, rx + 1.8, rz, 0.6, 3.6);
    addLanternPost(scene, rx + 2.6, ry, rz - 1.4, "beach_rod_shop_lantern");
    addCollider(colliders, rx + 2.6, rz - 1.4, 0.6, 0.6);
  }

  // Bait Shop (east of rod shop)
  {
    const bx = BEACH_POIS.baitShop.x;
    const bz = BEACH_POIS.baitShop.z;
    const by = getGroundHeight(bx, bz);
    addWoodenHut(scene, bx, by, bz, 0, "beach_bait_shop_hut");
    // Split collider: back wall + side walls, open front (north)
    addCollider(colliders, bx, bz - 1.4, 4.0, 0.8);
    addCollider(colliders, bx - 1.8, bz, 0.6, 3.6);
    addCollider(colliders, bx + 1.8, bz, 0.6, 3.6);
    addBarrel(
      scene,
      bx - 2.6,
      by,
      bz + 0.8,
      "#6b8a5a",
      "beach_bait_shop_barrel",
    );
    addCollider(colliders, bx - 2.6, bz + 0.8, 1.0, 1.0);
  }

  // Quest Board (plaza center)
  {
    const qx = BEACH_POIS.questBoard.x;
    const qz = BEACH_POIS.questBoard.z;
    const qy = getGroundHeight(qx, qz);
    addSign(scene, qx, qy, qz, "#a0522d", "beach_quest_board");
    addCollider(colliders, qx, qz, 1.4, 1.0);
  }

  // NPC (next to quest board)
  {
    const nx = BEACH_POIS.beachNpc.x;
    const nz = BEACH_POIS.beachNpc.z;
    const ny = getGroundHeight(nx, nz);
    // Simple NPC marker €” cylinder body + sphere head
    addCylinder(scene, 0.3, 0.3, 1.2, 8, [nx, ny + 0.6, nz], "#e8a87c", {
      name: "beach_npc_body",
      category: "npc",
    });
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 1),
      materialFor("#f0c0a0", true),
    );
    head.position.set(nx, ny + 1.5, nz);
    head.name = "beach_npc_head";
    head.castShadow = true;
    head.receiveShadow = true;
    head.userData.meshCategory = "npc";
    scene.add(head);
    // NPC hat
    addCylinder(scene, 0.32, 0.06, 0.2, 8, [nx, ny + 1.82, nz], "#d97706", {
      name: "beach_npc_hat",
      category: "npc",
    });
    addCollider(colliders, nx, nz, 1.0, 1.0);
  }

  // Plaza fountain (central landmark between shops)
  {
    const fx = -11;
    const fz = 44;
    const fy = getGroundHeight(fx, fz);
    addFountain(scene, fx, fy, fz, "beach_plaza_fountain");
    addCollider(colliders, fx, fz, 2.8, 2.8);
  }

  // Plaza benches
  {
    const by = getGroundHeight(-4, 46);
    addBench(scene, -4, by, 46, 0, "#8b6b42", "beach_plaza_bench_1");
    addCollider(colliders, -4, 46, 1.8, 0.8);
  }
  {
    const by = getGroundHeight(4, 46);
    addBench(scene, 4, by, 46, Math.PI, "#8b6b42", "beach_plaza_bench_2");
    addCollider(colliders, 4, 46, 1.8, 0.8);
  }

  // Plaza flower boxes
  addFlowerBox(
    scene,
    -14,
    getGroundHeight(-14, 42),
    42,
    0,
    "beach_plaza_flowerbox_1",
  );
  addFlowerBox(
    scene,
    2,
    getGroundHeight(2, 42),
    42,
    0,
    "beach_plaza_flowerbox_2",
  );

  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  DUNES AREA €” beach umbrellas, surfboards, casual props
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  // Beach umbrellas (shore area, well-spaced)
  {
    const uy = getGroundHeight(-16, 16);
    addBeachUmbrella(scene, -16, uy, 16, "#f97316", "beach_umbrella_1");
    addCollider(colliders, -16, 16, 1.0, 1.0);
  }
  {
    const uy = getGroundHeight(12, 16);
    addBeachUmbrella(scene, 12, uy, 16, "#3b82f6", "beach_umbrella_2");
    addCollider(colliders, 12, 16, 1.0, 1.0);
  }
  {
    const uy = getGroundHeight(-24, 20);
    addBeachUmbrella(scene, -24, uy, 20, "#ef4444", "beach_umbrella_3");
    addCollider(colliders, -24, 20, 1.0, 1.0);
  }

  // Surfboards leaning on nothing €” placed flat on sand
  addSurfboard(
    scene,
    -18,
    getGroundHeight(-18, 14),
    14,
    "#22d3ee",
    0.8,
    "beach_surfboard_1",
  );
  addSurfboard(
    scene,
    14,
    getGroundHeight(14, 14),
    14,
    "#f472b6",
    -0.6,
    "beach_surfboard_2",
  );

  // Boat hull beached on shore (west)
  {
    const by = getGroundHeight(-28, 12);
    addBoatHull(scene, -28, by, 12, 0.3, "beach_beached_boat");
    addCollider(colliders, -28, 12, 4.0, 2.0);
  }

  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  BLUFF TERRACE €” scenic fences, benches, trail markers
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  // Wooden fence along bluff viewpoint edge (facing south/ocean)
  addWoodenFence(
    scene,
    -10,
    getGroundHeight(-10, 32),
    32,
    12,
    0,
    "beach_bluff_fence_1",
  );
  addCollider(colliders, -10, 32, 12, 0.6);
  addWoodenFence(
    scene,
    6,
    getGroundHeight(6, 32),
    32,
    8,
    0,
    "beach_bluff_fence_2",
  );
  addCollider(colliders, 6, 32, 8, 0.6);

  // Bluff bench (scenic overlook spot)
  addBench(
    scene,
    0,
    getGroundHeight(0, 33),
    33,
    0,
    "#6b7a5a",
    "beach_bluff_bench",
  );
  addCollider(colliders, 0, 33, 1.8, 0.8);

  // Bluff tiki torch pair (path markers)
  addTikiTorch(scene, -6, getGroundHeight(-6, 34), 34, "beach_bluff_torch_1");
  addCollider(colliders, -6, 34, 0.5, 0.5);
  addTikiTorch(scene, 6, getGroundHeight(6, 34), 34, "beach_bluff_torch_2");
  addCollider(colliders, 6, 34, 0.5, 0.5);

  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  ZONE CONNECTOR SIGNS
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  // River trail sign (east bluff edge)
  {
    const sx = BEACH_POIS.riverTrailSign.x;
    const sz = BEACH_POIS.riverTrailSign.z;
    addSignWithCollider(
      scene,
      colliders,
      sx,
      getGroundHeight(sx, sz),
      sz,
      "#22c55e",
      "sign_river_trail",
    );
  }

  // Cave trail sign (plaza north)
  {
    const sx = BEACH_POIS.caveTrailSign.x;
    const sz = BEACH_POIS.caveTrailSign.z;
    addSignWithCollider(
      scene,
      colliders,
      sx,
      getGroundHeight(sx, sz),
      sz,
      "#60a5fa",
      "sign_cave_trail",
    );
  }

  // Volcano vista sign (NE lookout)
  {
    const sx = BEACH_POIS.volcanoVistaSign.x;
    const sz = BEACH_POIS.volcanoVistaSign.z;
    addSignWithCollider(
      scene,
      colliders,
      sx,
      getGroundHeight(sx, sz),
      sz,
      "#fb923c",
      "sign_volcano_vista",
    );
  }

  // Volcano silhouette on the distant horizon (decorative only)
  {
    const silhouette = new THREE.Mesh(
      new THREE.ConeGeometry(8, 18, 6),
      materialFor("#4a4a52", true, 0.9, 0.05),
    );
    silhouette.position.set(65, 4, 60);
    silhouette.name = "volcano_distant_silhouette";
    silhouette.castShadow = false;
    silhouette.receiveShadow = false;
    silhouette.userData.meshCategory = "landmark";
    silhouette.userData.cullDistanceMultiplier = 1.8;
    scene.add(silhouette);
    // Smoke plume
    const smoke = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.5, 1),
      materialFor("#b0b0b4", true, 0.6, 0),
    );
    smoke.position.set(65, 16, 60);
    smoke.name = "volcano_distant_smoke";
    smoke.castShadow = false;
    smoke.receiveShadow = false;
    smoke.userData.meshCategory = "landmark";
    smoke.userData.cullDistanceMultiplier = 1.6;
    scene.add(smoke);
  }

  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  OVERLOOK HILL props
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  // Fence along overlook edge
  addWoodenFence(
    scene,
    -26,
    getGroundHeight(-26, 34),
    34,
    8,
    0,
    "beach_overlook_fence",
  );
  addCollider(colliders, -26, 34, 8, 0.6);

  // Overlook bench
  addBench(
    scene,
    -24,
    getGroundHeight(-24, 38),
    38,
    Math.PI * 0.5,
    "#6b7a5a",
    "beach_overlook_bench",
  );
  addCollider(colliders, -24, 38, 0.8, 1.8);

  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  //  WORLD BOUNDARY COLLIDERS
  //  Keep players inside the zone without visible walls
  // ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€

  // South boundary (ocean, below pier) — stop at X=24 to avoid blocking river zone
  addCollider(colliders, -11, -10, 70, 2);
  // West boundary
  addCollider(colliders, -46, 20, 2, 80);
  // North boundary — stop at X=24 to avoid blocking river zone
  addCollider(colliders, -11, 50, 70, 2);
  // East boundary (except river corridor, X 20-24, Z 28-44)
  addCollider(colliders, 24, 8, 2, 40); // below river corridor
  addCollider(colliders, 24, 48, 2, 8); // above river corridor
}

/*==============================================================================
 *  RIVER STRUCTURES  -  Full jungle river valley
 *
 *  Sub-areas built in order:
 *    1. Rope bridge crossing
 *    2. Ranger station hub  (cabin, NPC, sell stand, campfire)
 *    3. Fishing area  (calm pool dock, rod stand)
 *    4. Ancient shrine ruin
 *    5. Upper ridge furniture  (bench, fences, lanterns)
 *    6. Zone connector signs
 *    7. Entry area props  (stone lanterns, barrel)
 *    8. World boundary colliders
 *==============================================================================*/

function buildRiverStructures(
  scene: THREE.Scene,
  colliders: BoxCollider[],
  getGroundHeight: (x: number, z: number, currentY?: number) => number,
): void {
  // -- 1. ROPE BRIDGE (spans river north-south at X=38) ----
  {
    const bx = RIVER_POIS.bridgeCrossing.x;
    const bz = RIVER_POIS.bridgeCrossing.z;
    const by = getGroundHeight(bx, bz);
    addRopeBridge(scene, bx, by + 0.6, bz, 3, 12, "river_main_bridge");
    // Side-rail colliders only — leave the walkable deck centre open
    addCollider(colliders, bx - 1.7, bz, 0.4, 12.4);
    addCollider(colliders, bx + 1.7, bz, 0.4, 12.4);
    // Tiki torches at bridge ends
    addTikiTorch(
      scene,
      bx - 2,
      getGroundHeight(bx - 2, bz + 6.5),
      bz + 6.5,
      "river_bridge_torch_n1",
    );
    addCollider(colliders, bx - 2, bz + 6.5, 0.5, 0.5);
    addTikiTorch(
      scene,
      bx + 2,
      getGroundHeight(bx + 2, bz + 6.5),
      bz + 6.5,
      "river_bridge_torch_n2",
    );
    addCollider(colliders, bx + 2, bz + 6.5, 0.5, 0.5);
    addTikiTorch(
      scene,
      bx - 2,
      getGroundHeight(bx - 2, bz - 6.5),
      bz - 6.5,
      "river_bridge_torch_s1",
    );
    addCollider(colliders, bx - 2, bz - 6.5, 0.5, 0.5);
    addTikiTorch(
      scene,
      bx + 2,
      getGroundHeight(bx + 2, bz - 6.5),
      bz - 6.5,
      "river_bridge_torch_s2",
    );
    addCollider(colliders, bx + 2, bz - 6.5, 0.5, 0.5);
  }

  // -- 2. RANGER STATION HUB  (valley trail, central) -----

  // Ranger cabin
  {
    const cx = RIVER_POIS.rangerCabin.x;
    const cz = RIVER_POIS.rangerCabin.z;
    const cy = getGroundHeight(cx, cz);
    addWoodenHut(scene, cx, cy, cz, 0, "river_ranger_cabin");
    // Split collider: back wall + side walls, open front (north)
    addCollider(colliders, cx, cz - 1.4, 4.0, 0.8);
    addCollider(colliders, cx - 1.8, cz, 0.6, 3.6);
    addCollider(colliders, cx + 1.8, cz, 0.6, 3.6);
    addLanternPost(scene, cx + 2.6, cy, cz - 1.4, "river_cabin_lantern");
    addCollider(colliders, cx + 2.6, cz - 1.4, 0.6, 0.6);
  }

  // Ranger NPC
  {
    const nx = RIVER_POIS.rangerNpc.x;
    const nz = RIVER_POIS.rangerNpc.z;
    const ny = getGroundHeight(nx, nz);
    addCylinder(scene, 0.3, 0.3, 1.2, 8, [nx, ny + 0.6, nz], "#8a9e78", {
      name: "river_npc_body",
      category: "npc",
    });
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 1),
      materialFor("#d4a88c", true),
    );
    head.position.set(nx, ny + 1.5, nz);
    head.name = "river_npc_head";
    head.castShadow = true;
    head.receiveShadow = true;
    head.userData.meshCategory = "npc";
    scene.add(head);
    // Ranger hat (wide brim)
    addCylinder(scene, 0.34, 0.08, 0.22, 8, [nx, ny + 1.82, nz], "#4a6a38", {
      name: "river_npc_hat",
      category: "npc",
    });
    addCollider(colliders, nx, nz, 1.0, 1.0);
  }

  // Sell stand
  {
    const sx = RIVER_POIS.sellStand.x;
    const sz = RIVER_POIS.sellStand.z;
    const sy = getGroundHeight(sx, sz);
    addBox(scene, [2.4, 1.8, 1.4], [sx, sy + 0.9, sz], "#a88c5a", {
      name: "river_sell_stand_body",
      category: "structure",
    });
    addBox(scene, [2.8, 0.14, 1.8], [sx, sy + 1.86, sz], "#c4a874", {
      name: "river_sell_stand_counter",
      category: "structure",
    });
    addBox(scene, [3.2, 0.12, 2.2], [sx, sy + 2.8, sz - 0.2], "#22c55e", {
      name: "river_sell_stand_awning",
      category: "structure",
    });
    // Awning posts
    addCylinder(
      scene,
      0.1,
      0.1,
      2.8,
      6,
      [sx - 1.3, sy + 1.4, sz - 0.8],
      "#6b5a3a",
      {
        name: "river_sell_stand_post_l",
        category: "structure",
      },
    );
    addCylinder(
      scene,
      0.1,
      0.1,
      2.8,
      6,
      [sx + 1.3, sy + 1.4, sz - 0.8],
      "#6b5a3a",
      {
        name: "river_sell_stand_post_r",
        category: "structure",
      },
    );
    addCollider(colliders, sx, sz, 3.0, 2.0);
    addBarrel(scene, sx - 2.4, sy, sz, "#5a7a46", "river_sell_barrel");
    addCollider(colliders, sx - 2.4, sz, 1.0, 1.0);
  }

  // Campfire
  {
    const fx = RIVER_POIS.campfire.x;
    const fz = RIVER_POIS.campfire.z;
    const fy = getGroundHeight(fx, fz);
    addCampfire(scene, fx, fy, fz, "river_campfire");
    addCollider(colliders, fx, fz, 1.6, 1.6);
    // Benches around campfire
    addBench(
      scene,
      fx - 2.6,
      fy,
      fz,
      Math.PI * 0.5,
      "#6b5a3a",
      "river_campfire_bench_w",
    );
    addCollider(colliders, fx - 2.6, fz, 0.8, 1.8);
    addBench(
      scene,
      fx + 2,
      fy,
      fz,
      -Math.PI * 0.5,
      "#7a6844",
      "river_campfire_bench_e",
    );
    addCollider(colliders, fx + 2, fz, 0.8, 1.8);
  }

  // -- 3. FISHING AREA  (calm pool, south bank) -----------

  // Fishing spot set at calm pool edge
  {
    const fx = RIVER_POIS.fishingSpot.x;
    const fz = RIVER_POIS.fishingSpot.z;
    const fy = getGroundHeight(fx, fz);
    addFishingSpotSet(scene, fx, fy, fz, "river_fishing_spot", "#22c55e");
    // Small fishing dock
    addBox(scene, [3.5, 0.4, 2.5], [fx, 0.2, fz + 2], "#9d7a58", {
      name: "river_fishing_dock",
      category: "structure",
      walkableSurface: true,
    });
    addBox(scene, [3.7, 0.1, 2.7], [fx, 0.42, fz + 2], "#b08a64", {
      name: "river_fishing_dock_planks",
      category: "structure",
      walkableSurface: true,
    });
    addTikiTorch(scene, fx - 2.2, fy, fz + 1, "river_fishing_torch_l");
    addCollider(colliders, fx - 2.2, fz + 1, 0.5, 0.5);
    addTikiTorch(scene, fx + 2.2, fy, fz + 1, "river_fishing_torch_r");
    addCollider(colliders, fx + 2.2, fz + 1, 0.5, 0.5);
    addDockCrate(
      scene,
      fx + 2.5,
      fy,
      fz + 3,
      0.6,
      "#8a7a52",
      "river_fishing_crate",
    );
    addCollider(colliders, fx + 2.5, fz + 3, 0.8, 0.8);
  }

  // -- 4. ANCIENT SHRINE RUIN  (upstream, east side) ------
  {
    const sx = RIVER_POIS.shrineRuin.x;
    const sz = RIVER_POIS.shrineRuin.z;
    const sy = getGroundHeight(sx, sz);
    // Stone platform base
    addBox(scene, [3.0, 0.5, 3.0], [sx, sy + 0.25, sz], "#7a8878", {
      name: "river_shrine_base",
      category: "structure",
      walkableSurface: true,
    });
    // Broken pillar stubs
    addCylinder(
      scene,
      0.25,
      0.25,
      1.2,
      6,
      [sx - 0.9, sy + 1.1, sz - 0.9],
      "#6b7a68",
      {
        name: "river_shrine_pillar_1",
        category: "structure",
      },
    );
    addCylinder(
      scene,
      0.25,
      0.25,
      0.8,
      6,
      [sx + 0.9, sy + 0.9, sz - 0.9],
      "#6b7a68",
      {
        name: "river_shrine_pillar_2",
        category: "structure",
      },
    );
    addCylinder(
      scene,
      0.25,
      0.25,
      1.0,
      6,
      [sx + 0.9, sy + 1.0, sz + 0.9],
      "#6b7a68",
      {
        name: "river_shrine_pillar_3",
        category: "structure",
      },
    );
    // Stone lantern at shrine
    addStoneLantern(scene, sx - 1.8, sy, sz, "river_shrine_lantern");
    addCollider(colliders, sx - 1.8, sz, 0.6, 0.6);
    // Shrine base only — open area, player can walk around pillars
    addCollider(colliders, sx, sz, 3.0, 0.6);
  }

  // -- 5. UPPER RIDGE FURNITURE  --------------------------

  // Overlook bench
  addBench(
    scene,
    RIVER_POIS.overlookBench.x,
    getGroundHeight(RIVER_POIS.overlookBench.x, RIVER_POIS.overlookBench.z),
    RIVER_POIS.overlookBench.z,
    0,
    "#6b7a5a",
    "river_overlook_bench",
  );
  addCollider(
    colliders,
    RIVER_POIS.overlookBench.x,
    RIVER_POIS.overlookBench.z,
    1.8,
    0.8,
  );

  // Ridge fence (along south edge, preventing falls)
  addWoodenFence(
    scene,
    56,
    getGroundHeight(56, 36),
    36,
    16,
    0,
    "river_ridge_fence_center",
  );
  addCollider(colliders, 56, 36, 16, 0.6);
  addWoodenFence(
    scene,
    72,
    getGroundHeight(72, 36),
    36,
    8,
    0,
    "river_ridge_fence_east",
  );
  addCollider(colliders, 72, 36, 8, 0.6);

  // Ridge lanterns
  addLanternPost(
    scene,
    48,
    getGroundHeight(48, 36),
    36,
    "river_ridge_lantern_1",
  );
  addCollider(colliders, 48, 36, 0.6, 0.6);
  addLanternPost(
    scene,
    64,
    getGroundHeight(64, 36),
    36,
    "river_ridge_lantern_2",
  );
  addCollider(colliders, 64, 36, 0.6, 0.6);

  // Stone lantern pair at ridge access point
  addStoneLantern(
    scene,
    54,
    getGroundHeight(54, 34),
    34,
    "river_ridge_stone_lantern_l",
  );
  addCollider(colliders, 54, 34, 0.6, 0.6);
  addStoneLantern(
    scene,
    58,
    getGroundHeight(58, 34),
    34,
    "river_ridge_stone_lantern_r",
  );
  addCollider(colliders, 58, 34, 0.6, 0.6);

  // -- 6. ZONE CONNECTOR SIGNS  ---------------------------

  // Return to beach sign
  addSignWithCollider(
    scene,
    colliders,
    RIVER_POIS.returnBeachSign.x,
    getGroundHeight(RIVER_POIS.returnBeachSign.x, RIVER_POIS.returnBeachSign.z),
    RIVER_POIS.returnBeachSign.z,
    "#f97316",
    "sign_return_beach",
  );

  // Cave trail hint sign (east)
  addSignWithCollider(
    scene,
    colliders,
    RIVER_POIS.caveHintSign.x,
    getGroundHeight(RIVER_POIS.caveHintSign.x, RIVER_POIS.caveHintSign.z),
    RIVER_POIS.caveHintSign.z,
    "#60a5fa",
    "sign_cave_trail",
  );

  // Volcano trail hint sign (north ridge)
  addSignWithCollider(
    scene,
    colliders,
    RIVER_POIS.volcanoHintSign.x,
    getGroundHeight(RIVER_POIS.volcanoHintSign.x, RIVER_POIS.volcanoHintSign.z),
    RIVER_POIS.volcanoHintSign.z,
    "#fb923c",
    "sign_volcano_trail",
  );

  // Challenge sign (south bank)
  addSignWithCollider(
    scene,
    colliders,
    RIVER_POIS.challengeSign.x,
    getGroundHeight(RIVER_POIS.challengeSign.x, RIVER_POIS.challengeSign.z),
    RIVER_POIS.challengeSign.z,
    "#a855f7",
    "sign_river_challenge",
  );

  // -- 7. ENTRY AREA PROPS  ------------------------------

  // Stone lanterns flanking the entry trail descent
  addStoneLantern(
    scene,
    30,
    getGroundHeight(30, 30),
    30,
    "river_entry_lantern_l",
  );
  addCollider(colliders, 30, 30, 0.6, 0.6);
  addStoneLantern(
    scene,
    34,
    getGroundHeight(34, 30),
    30,
    "river_entry_lantern_r",
  );
  addCollider(colliders, 34, 30, 0.6, 0.6);

  // Barrel near entry trail
  addBarrel(
    scene,
    26,
    getGroundHeight(26, 34),
    34,
    "#7a6844",
    "river_entry_barrel",
  );
  addCollider(colliders, 26, 34, 1.0, 1.0);

  // Flower box at entry platform
  addFlowerBox(
    scene,
    32,
    getGroundHeight(32, 40),
    40,
    0,
    "river_entry_flowerbox",
  );

  // -- 8. WORLD BOUNDARY COLLIDERS  ----------------------

  // South boundary
  addCollider(colliders, 54, -22, 62, 2);
  // East boundary — split to leave gap Z 8-20 for cave entry corridor
  addCollider(colliders, 84, -5, 2, 26); // south of cave entry
  addCollider(colliders, 84, 32, 2, 24); // north of cave entry
  // North boundary — leave gap at X 23-37 for entry corridor from beach
  addCollider(colliders, 60, 44, 50, 2);
  // West boundary is handled by beach zone colliders (gap at Z 28-44 for corridor)
}

/*==============================================================================
 *  CAVE STRUCTURES  —  Crystalline underground cavern
 *
 *  Sub-areas built in order:
 *    1. Entry arch (decorative frame at tunnel mouth)
 *    2. Sell stand hub  (sell stand, NPC, lanterns)
 *    3. Fishing grotto  (dock at underground lake edge)
 *    4. Grand crystal  (centerpiece formation)
 *    5. Stone bridge  (over lake inlet)
 *    6. Puzzle chamber  (3 pillars, door, challenge start)
 *    7. Crystal gallery props  (elevated area accents)
 *    8. Zone connector signs
 *    9. World boundary colliders
 *==============================================================================*/

function buildCaveStructures(
  scene: THREE.Scene,
  colliders: BoxCollider[],
  getGroundHeight: (x: number, z: number, currentY?: number) => number,
  puzzlePillars: Record<string, THREE.Mesh>,
  cavePuzzleDoor: THREE.Mesh,
): void {
  // -- 1. ENTRY ARCH  (decorative stone frame) ------------
  {
    const ax = CAVE_POIS.entryArch.x;
    const az = CAVE_POIS.entryArch.z;
    const ay = getGroundHeight(ax, az);
    // Left pillar
    addCylinder(scene, 0.4, 0.4, 3.6, 6, [ax, ay + 1.8, az - 5], "#5a5e64", {
      name: "cave_entry_arch_pillar_l",
      category: "structure",
    });
    // Right pillar
    addCylinder(scene, 0.4, 0.4, 3.6, 6, [ax, ay + 1.8, az + 5], "#5a5e64", {
      name: "cave_entry_arch_pillar_r",
      category: "structure",
    });
    // Lintel
    addBox(scene, [1.2, 0.6, 11], [ax, ay + 3.9, az], "#4a4e54", {
      name: "cave_entry_arch_lintel",
      category: "structure",
    });
    // Hanging crystal accent on lintel
    addCylinder(scene, 0.12, 0.04, 0.8, 6, [ax, ay + 3.2, az], "#60a5fa", {
      name: "cave_entry_arch_crystal",
      category: "decoration",
    });
    addCollider(colliders, ax, az - 5, 1.2, 1.2);
    addCollider(colliders, ax, az + 5, 1.2, 1.2);
  }

  // -- 2. SELL STAND HUB  --------------------------------
  {
    const sx = CAVE_POIS.sellStand.x;
    const sz = CAVE_POIS.sellStand.z;
    const sy = getGroundHeight(sx, sz);
    // Stand body
    addBox(scene, [2.4, 1.8, 1.4], [sx, sy + 0.9, sz], "#5a5e64", {
      name: "cave_sell_stand_body",
      category: "structure",
    });
    // Counter top
    addBox(scene, [2.8, 0.14, 1.8], [sx, sy + 1.86, sz], "#6a6e74", {
      name: "cave_sell_stand_counter",
      category: "structure",
    });
    // Awning (glowing crystal-colored)
    addBox(scene, [3.2, 0.12, 2.2], [sx, sy + 2.8, sz - 0.2], "#60a5fa", {
      name: "cave_sell_stand_awning",
      category: "structure",
    });
    // Support posts
    addCylinder(
      scene,
      0.1,
      0.1,
      2.8,
      6,
      [sx - 1.3, sy + 1.4, sz - 0.8],
      "#4a4e54",
      { name: "cave_sell_stand_post_l", category: "structure" },
    );
    addCylinder(
      scene,
      0.1,
      0.1,
      2.8,
      6,
      [sx + 1.3, sy + 1.4, sz - 0.8],
      "#4a4e54",
      { name: "cave_sell_stand_post_r", category: "structure" },
    );
    addCollider(colliders, sx, sz, 3.0, 2.0);
    // Barrel beside stand
    addBarrel(scene, sx + 2.4, sy, sz, "#4a5448", "cave_sell_barrel");
    addCollider(colliders, sx + 2.4, sz, 1.0, 1.0);
  }

  // Cave NPC (miner / spelunker)
  {
    const nx = CAVE_POIS.caveNpc.x;
    const nz = CAVE_POIS.caveNpc.z;
    const ny = getGroundHeight(nx, nz);
    // Body
    addCylinder(scene, 0.3, 0.3, 1.2, 8, [nx, ny + 0.6, nz], "#7a8a9e", {
      name: "cave_npc_body",
      category: "npc",
    });
    // Head
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 1),
      materialFor("#d4b89c", true),
    );
    head.position.set(nx, ny + 1.5, nz);
    head.name = "cave_npc_head";
    head.castShadow = true;
    head.receiveShadow = true;
    head.userData.meshCategory = "npc";
    scene.add(head);
    // Mining helmet
    addCylinder(scene, 0.3, 0.2, 0.24, 8, [nx, ny + 1.8, nz], "#f59e0b", {
      name: "cave_npc_helmet",
      category: "npc",
    });
    // Headlamp
    addBox(scene, [0.12, 0.12, 0.08], [nx, ny + 1.88, nz - 0.24], "#fde68a", {
      name: "cave_npc_headlamp",
      category: "npc",
    });
    addCollider(colliders, nx, nz, 1.0, 1.0);
  }

  // Stone lanterns near hub
  addStoneLantern(scene, 98, getGroundHeight(98, 18), 18, "cave_hub_lantern_l");
  addCollider(colliders, 98, 18, 0.6, 0.6);
  addStoneLantern(
    scene,
    106,
    getGroundHeight(106, 20),
    20,
    "cave_hub_lantern_r",
  );
  addCollider(colliders, 106, 20, 0.6, 0.6);

  // -- 3. FISHING GROTTO  --------------------------------
  {
    const fx = CAVE_POIS.fishingSpot.x;
    const fz = CAVE_POIS.fishingSpot.z;
    const fy = getGroundHeight(fx, fz);
    addFishingSpotSet(scene, fx, fy, fz, "cave_fishing_spot", "#60a5fa");
    // Small dock platform at lake edge
    addBox(scene, [3.5, 0.4, 2.5], [fx, 0.2, fz - 1], "#5a5452", {
      name: "cave_fishing_dock",
      category: "structure",
      walkableSurface: true,
    });
    addBox(scene, [3.7, 0.1, 2.7], [fx, 0.42, fz - 1], "#6a645e", {
      name: "cave_fishing_dock_planks",
      category: "structure",
      walkableSurface: true,
    });
    // Stone lanterns at fishing spot
    addStoneLantern(scene, fx - 2.4, fy, fz, "cave_fishing_lantern_l");
    addCollider(colliders, fx - 2.4, fz, 0.6, 0.6);
    addStoneLantern(scene, fx + 2.4, fy, fz, "cave_fishing_lantern_r");
    addCollider(colliders, fx + 2.4, fz, 0.6, 0.6);
  }

  // -- 4. GRAND CRYSTAL  (centerpiece formation) ----------
  {
    const gx = CAVE_POIS.grandCrystal.x;
    const gz = CAVE_POIS.grandCrystal.z;
    const gy = getGroundHeight(gx, gz);
    // Stone pedestal
    addBox(scene, [2.0, 0.5, 2.0], [gx, gy + 0.25, gz], "#5a5e64", {
      name: "cave_crystal_pedestal",
      category: "structure",
    });
    addCollider(colliders, gx, gz, 2.4, 2.4);
  }

  // -- 5. STONE BRIDGE  (over lake inlet) -----------------
  {
    const bx = CAVE_POIS.stoneBridge.x;
    const bz = CAVE_POIS.stoneBridge.z;
    // Bridge deck
    addBox(scene, [6.0, 0.4, 3.0], [bx, 0.2, bz], "#6a6e74", {
      name: "cave_stone_bridge_deck",
      category: "structure",
      walkableSurface: true,
    });
    // Side walls
    addBox(scene, [6.2, 0.6, 0.3], [bx, 0.5, bz - 1.4], "#5a5e64", {
      name: "cave_stone_bridge_rail_s",
      category: "structure",
    });
    addBox(scene, [6.2, 0.6, 0.3], [bx, 0.5, bz + 1.4], "#5a5e64", {
      name: "cave_stone_bridge_rail_n",
      category: "structure",
    });
    addCollider(colliders, bx, bz - 1.4, 6.2, 0.6);
    addCollider(colliders, bx, bz + 1.4, 6.2, 0.6);
  }

  // -- 6. PUZZLE CHAMBER  --------------------------------

  // Challenge start marker (stone pillar with glow)
  {
    const cx = CAVE_POIS.challengeStart.x;
    const cz = CAVE_POIS.challengeStart.z;
    const cy = getGroundHeight(cx, cz);
    addCylinder(scene, 0.35, 0.35, 1.4, 6, [cx, cy + 0.7, cz], "#818cf8", {
      name: "cave_challenge_marker",
      category: "challenge",
    });
    addBox(scene, [0.5, 0.2, 0.5], [cx, cy + 1.5, cz], "#a78bfa", {
      name: "cave_challenge_marker_cap",
      category: "challenge",
    });
    addCollider(colliders, cx, cz, 1.0, 1.0);
  }

  // Puzzle pillars (3 rotatable crystal columns)
  for (const [poiKey, id, color] of [
    ["puzzlePillarA", "cave_pillar_a", "#60a5fa"],
    ["puzzlePillarB", "cave_pillar_b", "#a78bfa"],
    ["puzzlePillarC", "cave_pillar_c", "#34d399"],
  ] as const) {
    const poi = CAVE_POIS[poiKey];
    const py = getGroundHeight(poi.x, poi.z);
    // Stone base
    addBox(scene, [1.2, 0.4, 1.2], [poi.x, py + 0.2, poi.z], "#5a5e64", {
      name: `${id}_base`,
      category: "challenge",
    });
    // Crystal pillar body (this is the rotating mesh referenced by GameApp)
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 1.8, 6),
      materialFor(color, true, 0.3, 0.2),
    );
    pillar.position.set(poi.x, py + 1.3, poi.z);
    pillar.name = id;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    pillar.userData.meshCategory = "challenge";
    scene.add(pillar);
    // Facet marker (shows orientation — one bright face)
    const facet = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.6, 0.28),
      materialFor("#fde68a", true, 0.2, 0.1),
    );
    facet.position.set(0.28, 0, 0);
    facet.name = `${id}_facet`;
    facet.userData.meshCategory = "challenge";
    pillar.add(facet);
    puzzlePillars[id] = pillar;
    addCollider(colliders, poi.x, poi.z, 1.2, 1.2);
  }

  // Puzzle door (stone slab blocking passage beyond puzzle area)
  {
    const dx = CAVE_POIS.puzzleDoor.x;
    const dz = CAVE_POIS.puzzleDoor.z;
    cavePuzzleDoor.geometry = new THREE.BoxGeometry(1.2, 3.2, 6);
    (cavePuzzleDoor.material as THREE.MeshStandardMaterial).color.set(
      "#b91c1c",
    );
    cavePuzzleDoor.position.set(dx, 1.6, dz);
    cavePuzzleDoor.name = "cave_puzzle_door";
    cavePuzzleDoor.visible = true;
    cavePuzzleDoor.castShadow = true;
    cavePuzzleDoor.receiveShadow = true;
    cavePuzzleDoor.userData.meshCategory = "challenge";
    scene.add(cavePuzzleDoor);
    // Door frame pillars
    addCylinder(scene, 0.3, 0.3, 3.6, 6, [dx, 1.8, dz - 3.4], "#4a4e54", {
      name: "cave_puzzle_door_frame_l",
      category: "challenge",
    });
    addCylinder(scene, 0.3, 0.3, 3.6, 6, [dx, 1.8, dz + 3.4], "#4a4e54", {
      name: "cave_puzzle_door_frame_r",
      category: "challenge",
    });
    addCollider(colliders, dx, dz, 1.6, 7.2);
  }

  // Relic pickup (behind puzzle door — crystal key)
  {
    const rx = CAVE_POIS.relicPickup.x;
    const rz = CAVE_POIS.relicPickup.z;
    const ry = getGroundHeight(rx, rz);
    // Crystal key on stone pedestal
    addBox(scene, [1.0, 0.5, 1.0], [rx, ry + 0.25, rz], "#6a6e74", {
      name: "cave_relic_pedestal",
      category: "challenge",
    });
    addCylinder(scene, 0.1, 0.06, 0.6, 6, [rx, ry + 0.8, rz], "#60a5fa", {
      name: "cave_relic_crystal",
      category: "challenge",
    });
    addCollider(colliders, rx, rz, 1.2, 1.2);
  }

  // -- 7. CRYSTAL GALLERY PROPS  -------------------------
  {
    const gx = CAVE_POIS.crystalGallery.x;
    const gz = CAVE_POIS.crystalGallery.z;
    const gy = getGroundHeight(gx, gz);
    // Stone display stand
    addBox(scene, [2.0, 0.6, 1.5], [gx, gy + 0.3, gz], "#5a5e64", {
      name: "cave_gallery_display",
      category: "structure",
    });
    addCollider(colliders, gx, gz, 2.2, 1.8);
    // Benches for viewing
    addBench(
      scene,
      gx - 3,
      gy,
      gz,
      Math.PI * 0.5,
      "#5a5452",
      "cave_gallery_bench_w",
    );
    addCollider(colliders, gx - 3, gz, 0.8, 1.8);
    addBench(
      scene,
      gx + 3,
      gy,
      gz,
      -Math.PI * 0.5,
      "#5a5452",
      "cave_gallery_bench_e",
    );
    addCollider(colliders, gx + 3, gz, 0.8, 1.8);
  }

  // -- 8. ZONE CONNECTOR SIGNS  --------------------------

  // Return to river sign
  addSignWithCollider(
    scene,
    colliders,
    CAVE_POIS.returnRiverSign.x,
    getGroundHeight(CAVE_POIS.returnRiverSign.x, CAVE_POIS.returnRiverSign.z),
    CAVE_POIS.returnRiverSign.z,
    "#22c55e",
    "sign_return_river",
  );

  // Volcano passage hint sign (future)
  addSignWithCollider(
    scene,
    colliders,
    CAVE_POIS.volcanoPassageHint.x,
    getGroundHeight(
      CAVE_POIS.volcanoPassageHint.x,
      CAVE_POIS.volcanoPassageHint.z,
    ),
    CAVE_POIS.volcanoPassageHint.z,
    "#fb923c",
    "sign_volcano_passage",
  );

  // -- 9. WORLD BOUNDARY COLLIDERS  ----------------------

  // South boundary
  addCollider(colliders, 114, -20, 62, 2);
  // East boundary
  addCollider(colliders, 146, 12, 2, 58);
  // North boundary
  addCollider(colliders, 114, 40, 62, 2);
  // West boundary is handled by river zone colliders (gap at Z 8-20 for entry)

  // Path lighting — stone lanterns along main routes
  for (const [lx, lz, name] of [
    [96, 14, "cave_path_lantern_1"],
    [104, 14, "cave_path_lantern_2"],
    [110, 8, "cave_path_lantern_3"],
    [118, 14, "cave_path_lantern_4"],
    [124, 14, "cave_path_lantern_5"],
    [118, 26, "cave_path_lantern_6"],
    [130, 16, "cave_path_lantern_7"],
    [132, 6, "cave_path_lantern_8"],
  ] as Array<[number, number, string]>) {
    addStoneLantern(scene, lx, getGroundHeight(lx, lz), lz, name);
    addCollider(colliders, lx, lz, 0.6, 0.6);
  }
}

/*••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
 *  NATURE PROPS €” vegetation scatter for both zones
 *
 *  Every prop is placed at getGroundHeight(x, z) so it sits perfectly
 *  on the terrain surface.  All points come from layout files with
 *  pre-validated spacing.
 *••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••*/

function buildNatureProps(
  scene: THREE.Scene,
  colliders: BoxCollider[],
  getGroundHeight: (x: number, z: number, currentY?: number) => number,
): void {
  // ”€”€ Beach palms ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of BEACH_PROP_POINTS.palms) {
    const gy = getGroundHeight(pt.x, pt.z);
    addPalm(scene, pt.x, gy, pt.z, `beach_palm_${pt.x}_${pt.z}`);
    addCollider(colliders, pt.x, pt.z, 1.0, 1.0);
  }

  // ”€”€ Beach trees ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of BEACH_PROP_POINTS.trees) {
    const gy = getGroundHeight(pt.x, pt.z);
    addTree(scene, pt.x, gy, pt.z, pt.color, `beach_tree_${pt.x}_${pt.z}`);
    addCollider(colliders, pt.x, pt.z, 1.2, 1.2);
  }

  // ”€”€ Beach shrubs ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of BEACH_PROP_POINTS.shrubs) {
    const gy = getGroundHeight(pt.x, pt.z);
    addShrub(scene, pt.x, gy, pt.z, pt.color, `beach_shrub_${pt.x}_${pt.z}`);
  }

  // ”€”€ Beach rocks ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of BEACH_PROP_POINTS.rocks) {
    const gy = getGroundHeight(pt.x, pt.z);
    addRock(
      scene,
      pt.x,
      gy,
      pt.z,
      pt.scale,
      pt.color,
      `beach_rock_${pt.x}_${pt.z}`,
    );
    addCollider(colliders, pt.x, pt.z, pt.scale * 1.1, pt.scale * 1.1);
  }

  // ”€”€ Reef underwater rocks ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of BEACH_PROP_POINTS.reefUnderwaterRocks) {
    addRock(
      scene,
      pt.x,
      -0.5,
      pt.z,
      pt.scale,
      pt.color,
      `beach_reef_rock_${pt.x}_${pt.z}`,
    );
  }

  // ”€”€ Dune grass clumps ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  if (BEACH_PROP_POINTS.duneGrass) {
    for (const pt of BEACH_PROP_POINTS.duneGrass) {
      const gy = getGroundHeight(pt.x, pt.z);
      addDuneGrass(scene, pt.x, gy, pt.z, `beach_dgrass_${pt.x}_${pt.z}`);
    }
  }

  // ”€”€ River trees ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.trees) {
    const gy = getGroundHeight(pt.x, pt.z);
    addTree(scene, pt.x, gy, pt.z, pt.color, `river_tree_${pt.x}_${pt.z}`);
    addCollider(colliders, pt.x, pt.z, 1.2, 1.2);
  }

  // ”€”€ River canopy trees ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.canopyTrees) {
    const gy = getGroundHeight(pt.x, pt.z);
    addCanopyTree(
      scene,
      pt.x,
      gy,
      pt.z,
      pt.color,
      `river_canopy_${pt.x}_${pt.z}`,
    );
    addCollider(colliders, pt.x, pt.z, 1.6, 1.6);
  }

  // ”€”€ River bamboo ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.bamboo) {
    const gy = getGroundHeight(pt.x, pt.z);
    addBambooClump(scene, pt.x, gy, pt.z, `river_bamboo_${pt.x}_${pt.z}`);
    addCollider(colliders, pt.x, pt.z, 1.0, 1.0);
  }

  // ”€”€ River shrubs ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.shrubs) {
    const gy = getGroundHeight(pt.x, pt.z);
    addShrub(scene, pt.x, gy, pt.z, "#6cab2f", `river_shrub_${pt.x}_${pt.z}`);
  }

  // ”€”€ River ferns ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.ferns) {
    const gy = getGroundHeight(pt.x, pt.z);
    addFernCluster(scene, pt.x, gy, pt.z, `river_fern_${pt.x}_${pt.z}`);
  }

  // ”€”€ River reeds ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.reeds) {
    const gy = getGroundHeight(pt.x, pt.z);
    addReedClump(
      scene,
      pt.x,
      gy,
      pt.z,
      "#5a8a44",
      `river_reed_${pt.x}_${pt.z}`,
    );
  }

  // ”€”€ River mushrooms ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.mushrooms) {
    const gy = getGroundHeight(pt.x, pt.z);
    addMushroomCluster(scene, pt.x, gy, pt.z, `river_mush_${pt.x}_${pt.z}`);
  }

  // ”€”€ River lily pads ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.lilyPads) {
    addLilyPadCluster(scene, pt.x, 0.06, pt.z, `river_lily_${pt.x}_${pt.z}`);
  }

  // ”€”€ River fallen logs ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.fallenLogs) {
    const gy = getGroundHeight(pt.x, pt.z);
    addFallenLog(
      scene,
      pt.x,
      gy,
      pt.z,
      pt.length,
      pt.rotY,
      `river_log_${pt.x}_${pt.z}`,
    );
    addCollider(colliders, pt.x, pt.z, pt.length, 0.8);
  }

  // ”€”€ River hanging vines ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.hangingVines) {
    addHangingVine(
      scene,
      pt.x,
      pt.y,
      pt.z,
      pt.length,
      `river_vine_${pt.x}_${pt.z}`,
    );
  }

  // ”€”€ River rocks ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.rocks) {
    const gy = getGroundHeight(pt.x, pt.z);
    addRock(
      scene,
      pt.x,
      gy,
      pt.z,
      pt.scale,
      pt.color,
      `river_rock_${pt.x}_${pt.z}`,
    );
    addCollider(colliders, pt.x, pt.z, pt.scale * 1.1, pt.scale * 1.1);
  }

  // ”€”€ River stepping stones ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
  for (const pt of RIVER_PROP_POINTS.steppingStones) {
    const gy = getGroundHeight(pt.x, pt.z);
    addSteppingStone(
      scene,
      pt.x,
      gy,
      pt.z,
      pt.scale,
      `river_step_${pt.x}_${pt.z}`,
    );
  }

  // ── Cave rocks ────────────────────────────────────────────────────────
  for (const pt of CAVE_PROP_POINTS.rocks) {
    const gy = getGroundHeight(pt.x, pt.z);
    addRock(
      scene,
      pt.x,
      gy,
      pt.z,
      pt.scale,
      pt.color,
      `cave_rock_${pt.x}_${pt.z}`,
    );
    addCollider(colliders, pt.x, pt.z, pt.scale * 1.1, pt.scale * 1.1);
  }

  // ── Cave mushrooms (bioluminescent) ───────────────────────────────────
  for (const pt of CAVE_PROP_POINTS.mushrooms) {
    const gy = getGroundHeight(pt.x, pt.z);
    addMushroomCluster(scene, pt.x, gy, pt.z, `cave_mush_${pt.x}_${pt.z}`);
  }

  // ── Cave ferns ────────────────────────────────────────────────────────
  for (const pt of CAVE_PROP_POINTS.ferns) {
    const gy = getGroundHeight(pt.x, pt.z);
    addFernCluster(scene, pt.x, gy, pt.z, `cave_fern_${pt.x}_${pt.z}`);
  }

  // ── Cave hanging vines ────────────────────────────────────────────────
  for (const pt of CAVE_PROP_POINTS.hangingVines) {
    addHangingVine(
      scene,
      pt.x,
      pt.y,
      pt.z,
      pt.length,
      `cave_vine_${pt.x}_${pt.z}`,
    );
  }

  // ── Cave shrubs (mossy ground cover) ──────────────────────────────────
  for (const pt of CAVE_PROP_POINTS.shrubs) {
    const gy = getGroundHeight(pt.x, pt.z);
    addShrub(scene, pt.x, gy, pt.z, "#3a6a2a", `cave_shrub_${pt.x}_${pt.z}`);
  }

  // ── Cave stepping stones (lake crossing) ──────────────────────────────
  for (const pt of CAVE_PROP_POINTS.steppingStones) {
    const gy = getGroundHeight(pt.x, pt.z);
    addSteppingStone(
      scene,
      pt.x,
      gy,
      pt.z,
      pt.scale,
      `cave_step_${pt.x}_${pt.z}`,
    );
  }

  // ── Cave crystal formations (custom colored cylinders) ────────────────
  for (const pt of CAVE_PROP_POINTS.crystals) {
    const gy = getGroundHeight(pt.x, pt.z);
    const crystal = addCylinder(
      scene,
      pt.radius,
      pt.radius * 0.3,
      pt.height,
      6,
      [pt.x, gy + pt.height * 0.5, pt.z],
      pt.color,
      {
        name: `cave_crystal_${pt.x}_${pt.z}`,
        category: "decoration",
        roughness: 0.25,
        metalness: 0.15,
      },
    );
    crystal.rotation.z = pt.tilt;
    if (pt.height >= 2.0) {
      addCollider(colliders, pt.x, pt.z, pt.radius * 3, pt.radius * 3);
    }
  }

  // ── Cave stalactites (cones hanging from ceiling) ─────────────────────
  for (const pt of CAVE_PROP_POINTS.stalactites) {
    const stalactite = new THREE.Mesh(
      new THREE.ConeGeometry(pt.radius, pt.length, 5),
      materialFor("#5a5e64", true, 0.8, 0.02),
    );
    stalactite.position.set(pt.x, pt.y, pt.z);
    stalactite.rotation.x = Math.PI; // point downward
    stalactite.name = `cave_stalactite_${pt.x}_${pt.z}`;
    stalactite.castShadow = true;
    stalactite.receiveShadow = true;
    stalactite.userData.meshCategory = "decoration";
    stalactite.userData.cullDistanceMultiplier = 1.2;
    scene.add(stalactite);
  }
}

export function buildBeachHub(scene: THREE.Scene): WorldBuildResult {
  const colliders: BoxCollider[] = [];
  const baseGroundHeight = createGroundHeightSampler();

  scene.fog = new THREE.FogExp2("#b8e7f2", 0.0038);

  const hemiLight = new THREE.HemisphereLight("#fff7ed", "#87a7be", 0.92);
  hemiLight.name = "zone_hemi_light";
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight("#fff6d6", 1.16);
  sun.position.set(26, 35, -16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.name = "zone_sun_light";
  scene.add(sun);

  buildBeachTerrain(scene);
  buildRiverTerrain(scene);
  buildCaveTerrain(scene);
  const terrainGroundHeight = createRuntimeGroundHeightSampler(
    scene,
    baseGroundHeight,
  );

  buildBeachWater(scene);
  buildRiverWater(scene);
  buildCaveWater(scene);

  buildBeachPortStructures(scene, colliders, terrainGroundHeight);
  buildRiverStructures(scene, colliders, terrainGroundHeight);
  buildNatureProps(scene, colliders, terrainGroundHeight);

  addBeachChallenge(scene);
  const riverPlatforms = addRiverChallenge(scene);
  const movingPlatforms = [...riverPlatforms];

  // -- Zone rod stands (beach, river, cave) ----
  addRodStand(
    scene,
    BEACH_POIS.zoneRodStand.x,
    terrainGroundHeight(BEACH_POIS.zoneRodStand.x, BEACH_POIS.zoneRodStand.z),
    BEACH_POIS.zoneRodStand.z,
    "#f59e0b",
    "beach_zone_rod_stand",
  );
  addCollider(
    colliders,
    BEACH_POIS.zoneRodStand.x,
    BEACH_POIS.zoneRodStand.z,
    1.22,
    1.22,
  );
  addRodStand(
    scene,
    RIVER_POIS.zoneRodStand.x,
    terrainGroundHeight(RIVER_POIS.zoneRodStand.x, RIVER_POIS.zoneRodStand.z),
    RIVER_POIS.zoneRodStand.z,
    "#22c55e",
    "river_zone_rod_stand",
  );
  addCollider(
    colliders,
    RIVER_POIS.zoneRodStand.x,
    RIVER_POIS.zoneRodStand.z,
    1.22,
    1.22,
  );
  addRodStand(
    scene,
    CAVE_POIS.zoneRodStand.x,
    terrainGroundHeight(CAVE_POIS.zoneRodStand.x, CAVE_POIS.zoneRodStand.z),
    CAVE_POIS.zoneRodStand.z,
    "#60a5fa",
    "cave_zone_rod_stand",
  );
  addCollider(
    colliders,
    CAVE_POIS.zoneRodStand.x,
    CAVE_POIS.zoneRodStand.z,
    1.22,
    1.22,
  );

  // -- Create cave puzzle door mesh (used by buildCaveStructures & GameApp) --
  const cavePuzzleDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    materialFor("#b91c1c", true),
  );
  cavePuzzleDoor.name = "cave_puzzle_door";
  cavePuzzleDoor.userData.meshCategory = "challenge";

  // -- Build cave structures (needs the puzzle door mesh and creates puzzle pillars) --
  const puzzlePillars: Record<string, THREE.Mesh> = {};
  buildCaveStructures(
    scene,
    colliders,
    terrainGroundHeight,
    puzzlePillars,
    cavePuzzleDoor,
  );

  const getGroundHeight = createRuntimeGroundHeightSampler(
    scene,
    terrainGroundHeight,
  );
  const posAt = (x: number, z: number): THREE.Vector3 =>
    new THREE.Vector3(x, getGroundHeight(x, z), z);

  const createHiddenPlaceholder = (name: string, color: string): THREE.Mesh => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      materialFor(color, true),
    );
    mesh.name = name;
    mesh.visible = false;
    mesh.position.set(5000, -5000, 5000);
    mesh.userData.meshCategory = "placeholder";
    return mesh;
  };

  const volcanoGateDoor = createHiddenPlaceholder(
    "volcano_gate_door_placeholder",
    "#7f1d1d",
  );
  const volcanoGateSign = createHiddenPlaceholder(
    "volcano_gate_sign_placeholder",
    "#fca5a5",
  );
  const oasisGateDoor = createHiddenPlaceholder(
    "oasis_gate_door_placeholder",
    "#7f1d1d",
  );
  const emblemBeach = createHiddenPlaceholder(
    "oasis_gate_emblem_beach_placeholder",
    "#7f1d1d",
  );
  const emblemRiver = createHiddenPlaceholder(
    "oasis_gate_emblem_river_placeholder",
    "#7f1d1d",
  );
  const emblemCave = createHiddenPlaceholder(
    "oasis_gate_emblem_cave_placeholder",
    "#7f1d1d",
  );
  const emblemVolcano = createHiddenPlaceholder(
    "oasis_gate_emblem_volcano_placeholder",
    "#7f1d1d",
  );
  // cavePuzzleDoor already created above and passed to buildCaveStructures
  const oasisFinalDoor = createHiddenPlaceholder(
    "oasis_final_door_placeholder",
    "#9f1239",
  );
  const oasisPlateA = createHiddenPlaceholder(
    "oasis_plate_a_placeholder",
    "#a1a1aa",
  );
  const oasisPlateB = createHiddenPlaceholder(
    "oasis_plate_b_placeholder",
    "#a1a1aa",
  );
  const oasisPlateC = createHiddenPlaceholder(
    "oasis_plate_c_placeholder",
    "#a1a1aa",
  );

  const disabledCollider = colliderAt(5000, 5000, 0.1, 0.1);
  const volcanoGateCollider = { ...disabledCollider };
  const oasisGateCollider = { ...disabledCollider };
  const oasisFinalDoorCollider = { ...disabledCollider };

  const interactables: Interactable[] = [
    {
      id: "beach_fishing_spot",
      type: "fishing_spot",
      label: "FISH",
      position: posAt(BEACH_POIS.fishingPier.x, BEACH_POIS.fishingPier.z),
      radius: 2.9,
      title: "Pier Edge Spot",
      zoneId: "beach",
    },
    {
      id: "beach_reef_fishing_spot",
      type: "fishing_spot",
      label: "FISH",
      position: posAt(BEACH_POIS.fishingReef.x, BEACH_POIS.fishingReef.z),
      radius: 2.8,
      title: "Reef Shore Spot",
      zoneId: "beach",
    },
    {
      id: "beach_sell_stand",
      type: "sell_stand",
      label: "SELL",
      position: posAt(BEACH_POIS.sellStand.x, BEACH_POIS.sellStand.z),
      radius: 2.2,
      title: "Beach Sell Stand",
      zoneId: "beach",
    },
    {
      id: "beach_rod_shop",
      type: "rod_shop",
      label: "SHOP",
      position: posAt(BEACH_POIS.rodShop.x, BEACH_POIS.rodShop.z),
      radius: 2.4,
      title: "Rod Shop",
      zoneId: "beach",
    },
    {
      id: "beach_bait_shop",
      type: "bait_shop",
      label: "SHOP",
      position: posAt(BEACH_POIS.baitShop.x, BEACH_POIS.baitShop.z),
      radius: 2.4,
      title: "Bait Shop",
      zoneId: "beach",
    },
    {
      id: "river_fishing_spot",
      type: "fishing_spot",
      label: "FISH",
      position: posAt(RIVER_POIS.fishingSpot.x, RIVER_POIS.fishingSpot.z),
      radius: 2.8,
      title: "Waterfall Pool Spot",
      zoneId: "river",
    },
    {
      id: "river_sell_stand",
      type: "sell_stand",
      label: "SELL",
      position: posAt(RIVER_POIS.sellStand.x, RIVER_POIS.sellStand.z),
      radius: 2.2,
      title: "River Sell Stand",
      zoneId: "river",
    },
    {
      id: "quest_board",
      type: "quest_board",
      label: "QUEST",
      position: posAt(BEACH_POIS.questBoard.x, BEACH_POIS.questBoard.z),
      radius: 2.1,
      title: "Quest Board",
    },
    {
      id: "npc_hint_beach",
      type: "npc_hint",
      label: "TALK",
      position: posAt(BEACH_POIS.beachNpc.x, BEACH_POIS.beachNpc.z),
      radius: 1.9,
      title: "Scout Nori",
    },
    {
      id: "npc_hint_river",
      type: "npc_hint",
      label: "TALK",
      position: posAt(RIVER_POIS.rangerNpc.x, RIVER_POIS.rangerNpc.z),
      radius: 1.9,
      title: "River Ranger",
    },
    {
      id: "beach_zone_rod_pickup",
      type: "zone_rod_pickup",
      label: "PICKUP",
      position: posAt(BEACH_POIS.zoneRodStand.x, BEACH_POIS.zoneRodStand.z),
      radius: 2,
      title: "Beach Zone Luck Rod",
      zoneId: "beach",
    },
    {
      id: "river_zone_rod_pickup",
      type: "zone_rod_pickup",
      label: "PICKUP",
      position: posAt(RIVER_POIS.zoneRodStand.x, RIVER_POIS.zoneRodStand.z),
      radius: 2,
      title: "River Zone Luck Rod",
      zoneId: "river",
    },
    {
      id: "beach_challenge_start",
      type: "challenge_start",
      label: "START",
      position: posAt(BEACH_POIS.challengeStart.x, BEACH_POIS.challengeStart.z),
      radius: 2.2,
      title: "Beach Challenge",
      zoneId: "beach",
    },
    {
      id: "river_challenge_start",
      type: "challenge_start",
      label: "START",
      position: posAt(RIVER_POIS.challengeStart.x, RIVER_POIS.challengeStart.z),
      radius: 2.2,
      title: "River Challenge",
      zoneId: "river",
    },
    // ── Cave zone interactables ──────────────────────
    {
      id: "cave_fishing_spot",
      type: "fishing_spot",
      label: "FISH",
      position: posAt(CAVE_POIS.fishingSpot.x, CAVE_POIS.fishingSpot.z),
      radius: 2.8,
      title: "Underground Lake Spot",
      zoneId: "cave",
    },
    {
      id: "cave_sell_stand",
      type: "sell_stand",
      label: "SELL",
      position: posAt(CAVE_POIS.sellStand.x, CAVE_POIS.sellStand.z),
      radius: 2.2,
      title: "Cave Sell Stand",
      zoneId: "cave",
    },
    {
      id: "npc_hint_cave",
      type: "npc_hint",
      label: "TALK",
      position: posAt(CAVE_POIS.caveNpc.x, CAVE_POIS.caveNpc.z),
      radius: 1.9,
      title: "Miner Glint",
    },
    {
      id: "cave_zone_rod_pickup",
      type: "zone_rod_pickup",
      label: "PICKUP",
      position: posAt(CAVE_POIS.zoneRodStand.x, CAVE_POIS.zoneRodStand.z),
      radius: 2,
      title: "Cave Zone Luck Rod",
      zoneId: "cave",
    },
    {
      id: "cave_challenge_start",
      type: "challenge_start",
      label: "START",
      position: posAt(CAVE_POIS.challengeStart.x, CAVE_POIS.challengeStart.z),
      radius: 2.2,
      title: "Cave Crystal Puzzle",
      zoneId: "cave",
    },
    {
      id: "cave_pillar_a",
      type: "puzzle_pillar",
      label: "ROTATE",
      position: posAt(CAVE_POIS.puzzlePillarA.x, CAVE_POIS.puzzlePillarA.z),
      radius: 1.6,
      title: "Crystal Pillar A",
      zoneId: "cave",
    },
    {
      id: "cave_pillar_b",
      type: "puzzle_pillar",
      label: "ROTATE",
      position: posAt(CAVE_POIS.puzzlePillarB.x, CAVE_POIS.puzzlePillarB.z),
      radius: 1.6,
      title: "Crystal Pillar B",
      zoneId: "cave",
    },
    {
      id: "cave_pillar_c",
      type: "puzzle_pillar",
      label: "ROTATE",
      position: posAt(CAVE_POIS.puzzlePillarC.x, CAVE_POIS.puzzlePillarC.z),
      radius: 1.6,
      title: "Crystal Pillar C",
      zoneId: "cave",
    },
    {
      id: "relic_cave_crystal_key",
      type: "relic_pickup",
      label: "PICKUP",
      position: posAt(CAVE_POIS.relicPickup.x, CAVE_POIS.relicPickup.z),
      radius: 1.8,
      title: "Crystal Key",
      zoneId: "cave",
    },
  ];

  for (const [x, z, color, name] of [
    [
      BEACH_POIS.sellStand.x,
      BEACH_POIS.sellStand.z,
      "#facc15",
      "sign_beach_sell",
    ],
    [
      BEACH_POIS.rodShop.x,
      BEACH_POIS.rodShop.z,
      "#93c5fd",
      "sign_beach_rod_shop",
    ],
    [
      BEACH_POIS.baitShop.x,
      BEACH_POIS.baitShop.z,
      "#86efac",
      "sign_beach_bait_shop",
    ],
    [
      RIVER_POIS.sellStand.x,
      RIVER_POIS.sellStand.z,
      "#facc15",
      "sign_river_sell",
    ],
    [CAVE_POIS.sellStand.x, CAVE_POIS.sellStand.z, "#facc15", "sign_cave_sell"],
  ] as Array<[number, number, string, string]>) {
    addSignWithCollider(
      scene,
      colliders,
      x,
      getGroundHeight(x, z),
      z,
      color,
      name,
    );
  }

  for (const interactable of interactables) {
    addInteractMarker(scene, interactable);
  }

  const zoneRegions: ZoneRegion[] = [
    { zoneId: "beach", minX: -46, maxX: 24, minZ: -30, maxZ: 50 },
    { zoneId: "river", minX: 24, maxX: 84, minZ: -22, maxZ: 44 },
    { zoneId: "cave", minX: 84, maxX: 144, minZ: -18, maxZ: 38 },
  ];

  addZoneVolumeMarkers(scene, zoneRegions);

  return {
    spawnPosition: new THREE.Vector3(
      BEACH_POIS.spawnPier.x,
      getGroundHeight(BEACH_POIS.spawnPier.x, BEACH_POIS.spawnPier.z),
      BEACH_POIS.spawnPier.z,
    ),
    colliders,
    worldBounds: { minX: -46, maxX: 146, minZ: -30, maxZ: 52 },
    getGroundHeight,
    interactables,
    zoneRegions,
    volcanoGateDoor,
    volcanoGateSign,
    oasisGateDoor,
    oasisGateEmblems: {
      beach: emblemBeach,
      river: emblemRiver,
      cave: emblemCave,
      volcano: emblemVolcano,
    },
    cavePuzzleDoor,
    puzzlePillars,
    oasisFinalDoor,
    oasisChallengePlates: {
      oasis_plate_a: oasisPlateA,
      oasis_plate_b: oasisPlateB,
      oasis_plate_c: oasisPlateC,
    },
    movingPlatforms,
    volcanoGateCollider,
    oasisGateCollider,
    oasisFinalDoorCollider,
  };
}
