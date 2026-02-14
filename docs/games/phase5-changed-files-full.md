# Phase 5 Changed Files (Full Contents)
## client/src/engine/world/WorldBuilder.ts

```ts
import * as THREE from "three";
import type { BoxCollider } from "../collision";
import type {
  Interactable,
  MovingPlatformRef,
  WorldBuildResult,
  ZoneRegion,
} from "./types";

interface MeshOptions {
  name: string;
  category: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  instanceCandidate?: boolean;
  flatShaded?: boolean;
}

const TERRAIN_THICKNESS = 2.6;
const MATERIAL_CACHE = new Map<string, THREE.MeshStandardMaterial>();

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

function materialFor(
  color: string,
  flatShaded = true,
  roughness = 0.9,
  metalness = 0.03,
): THREE.MeshStandardMaterial {
  const key = `${color}|${flatShaded ? "flat" : "smooth"}|${roughness}|${metalness}`;
  let material = MATERIAL_CACHE.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading: flatShaded,
    });
    MATERIAL_CACHE.set(key, material);
  }
  return material;
}

function configureMesh(mesh: THREE.Mesh, options: MeshOptions): THREE.Mesh {
  mesh.name = options.name;
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  mesh.userData.meshCategory = options.category;
  if (options.instanceCandidate) {
    mesh.userData.instanceCandidate = true;
  }
  return mesh;
}

function addBox(
  scene: THREE.Scene,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  options: MeshOptions,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    materialFor(color, options.flatShaded ?? true),
  );
  mesh.position.set(position[0], position[1], position[2]);
  configureMesh(mesh, options);
  scene.add(mesh);
  return mesh;
}

function addDodeca(
  scene: THREE.Scene,
  radius: number,
  position: [number, number, number],
  color: string,
  options: MeshOptions,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(radius, 0),
    materialFor(color, options.flatShaded ?? true),
  );
  mesh.position.set(position[0], position[1], position[2]);
  configureMesh(mesh, options);
  scene.add(mesh);
  return mesh;
}

function addCylinder(
  scene: THREE.Scene,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  position: [number, number, number],
  color: string,
  options: MeshOptions,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    materialFor(color, options.flatShaded ?? true),
  );
  mesh.position.set(position[0], position[1], position[2]);
  configureMesh(mesh, options);
  scene.add(mesh);
  return mesh;
}

function addTerrainSlab(
  scene: THREE.Scene,
  width: number,
  depth: number,
  topY: number,
  x: number,
  z: number,
  color: string,
  name: string,
): THREE.Mesh {
  return addBox(
    scene,
    [width, TERRAIN_THICKNESS, depth],
    [x, topY - TERRAIN_THICKNESS * 0.5, z],
    color,
    {
      name,
      category: "terrain",
      castShadow: false,
      receiveShadow: true,
      flatShaded: true,
    },
  );
}

function addRamp(
  scene: THREE.Scene,
  width: number,
  depth: number,
  fromHeight: number,
  toHeight: number,
  x: number,
  z: number,
  axis: "x" | "z",
  color: string,
  name: string,
): THREE.Mesh {
  const thickness = 1.2;
  const mesh = addBox(
    scene,
    [width, thickness, depth],
    [x, (fromHeight + toHeight) * 0.5 - thickness * 0.5, z],
    color,
    {
      name,
      category: "terrain",
      castShadow: false,
      receiveShadow: true,
      flatShaded: true,
    },
  );
  const span = axis === "z" ? depth : width;
  const angle = Math.atan2(toHeight - fromHeight, span);
  if (axis === "z") {
    mesh.rotation.x = -angle;
  } else {
    mesh.rotation.z = angle;
  }
  return mesh;
}

function addWaterPlane(
  scene: THREE.Scene,
  width: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  color: string,
  zone: "beach" | "river" | "cave" | "volcano" | "oasis",
  name: string,
): THREE.Mesh {
  const material = materialFor(color, false, 0.35, 0);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.meshCategory = "water";
  mesh.userData.waterZone = zone;
  scene.add(mesh);
  return mesh;
}

function addTree(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  addCylinder(scene, 0.23, 0.33, 2.8, 6, [x, y + 1.35, z], "#8b5a3c", {
    name: `${name}_trunk`,
    category: "foliage",
    instanceCandidate: true,
  });
  addBox(scene, [2.2, 1.2, 2], [x, y + 2.85, z], color, {
    name: `${name}_crown`,
    category: "foliage",
    instanceCandidate: true,
  });
}

function addPalm(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  name: string,
): void {
  const trunk = addCylinder(scene, 0.3, 0.42, 3.5, 6, [x, y + 1.75, z], "#b97745", {
    name: `${name}_trunk`,
    category: "foliage",
    instanceCandidate: true,
  });
  trunk.rotation.z = 0.06;
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    const leaf = addBox(
      scene,
      [2, 0.18, 0.55],
      [x + Math.cos(angle) * 0.82, y + 3.35, z + Math.sin(angle) * 0.82],
      "#22c55e",
      {
        name: `${name}_leaf_${i + 1}`,
        category: "foliage",
        instanceCandidate: true,
      },
    );
    leaf.rotation.y = angle;
    leaf.rotation.x = -0.38;
  }
}

function addRock(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  scale: number,
  color: string,
  name: string,
): void {
  const rock = addDodeca(
    scene,
    0.95 * scale,
    [x, y + 0.55 * scale, z],
    color,
    {
      name,
      category: "rock",
      instanceCandidate: true,
    },
  );
  rock.rotation.y = (Math.abs(x * 0.17 + z * 0.11) % 1) * Math.PI;
}

function addShrub(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  addBox(scene, [1.1, 0.7, 0.95], [x, y + 0.35, z], color, {
    name,
    category: "foliage",
    instanceCandidate: true,
  });
}

function addSign(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  addBox(scene, [0.16, 1, 0.16], [x, y + 0.5, z], "#8b5a2b", {
    name: `${name}_post`,
    category: "prop",
    instanceCandidate: true,
  });
  addBox(scene, [1, 0.5, 0.14], [x, y + 1.04, z], color, {
    name: `${name}_board`,
    category: "prop",
    instanceCandidate: true,
  });
}

function addRodStand(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  accent: string,
  name: string,
): void {
  addBox(scene, [0.92, 0.44, 0.92], [x, y + 0.22, z], "#92400e", {
    name: `${name}_base`,
    category: "prop",
    instanceCandidate: true,
  });
  const rod = addBox(scene, [0.12, 1.3, 0.12], [x, y + 1.02, z], accent, {
    name: `${name}_rod`,
    category: "prop",
    instanceCandidate: true,
  });
  rod.rotation.z = -0.3;
}

function addRelicPedestal(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  color: string,
  name: string,
): void {
  addBox(scene, [0.8, 0.5, 0.8], [x, y + 0.25, z], "#6b7280", {
    name: `${name}_pedestal`,
    category: "prop",
  });
  addDodeca(scene, 0.32, [x, y + 0.86, z], color, {
    name: `${name}_relic`,
    category: "prop",
  });
}

function addInteractMarker(scene: THREE.Scene, interactable: Interactable): void {
  const colorByType: Record<Interactable["type"], string> = {
    fishing_spot: "#2dd4bf",
    sell_stand: "#fbbf24",
    rod_shop: "#93c5fd",
    bait_shop: "#86efac",
    gate: "#fca5a5",
    zone_rod_pickup: "#f59e0b",
    challenge_start: "#a78bfa",
    quest_board: "#fb7185",
    npc_hint: "#60a5fa",
    puzzle_pillar: "#67e8f9",
    relic_pickup: "#fde047",
  };

  const base = addCylinder(
    scene,
    0.42,
    0.42,
    0.14,
    16,
    [interactable.position.x, interactable.position.y + 0.07, interactable.position.z],
    "#f8fafc",
    {
      name: `poi_${interactable.id}_base`,
      category: "poi_marker",
      castShadow: false,
      receiveShadow: true,
      flatShaded: false,
    },
  );
  base.userData.poiMarker = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.04, 8, 24),
    materialFor(colorByType[interactable.type], false),
  );
  ring.name = `poi_${interactable.id}_ring`;
  ring.position.set(
    interactable.position.x,
    interactable.position.y + 0.14,
    interactable.position.z,
  );
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = false;
  ring.receiveShadow = true;
  ring.userData.meshCategory = "poi_marker";
  ring.userData.poiMarker = true;
  scene.add(ring);
}

function addBeachChallenge(scene: THREE.Scene): void {
  for (let i = 0; i < 6; i += 1) {
    addBox(
      scene,
      [0.95, 0.42, 0.95],
      [-1 + i * 1.45, 0.21, 27 + (i % 2 === 0 ? 0.25 : -0.2)],
      "#7c3aed",
      {
        name: `beach_challenge_post_${i + 1}`,
        category: "challenge",
      },
    );
  }
  addBox(scene, [1.1, 0.8, 0.9], [8.1, 0.42, 27.3], "#f59e0b", {
    name: "beach_challenge_reward_chest",
    category: "challenge",
  });
}

function addRiverChallenge(scene: THREE.Scene): MovingPlatformRef[] {
  const platforms: MovingPlatformRef[] = [];
  for (let i = 0; i < 4; i += 1) {
    const log = addBox(
      scene,
      [2.2, 0.42, 1.05],
      [41 + i * 5.2, -0.62, -2.4 + (i % 2 === 0 ? 1.1 : -1.2)],
      "#92400e",
      {
        name: `river_challenge_log_${i + 1}`,
        category: "challenge",
      },
    );
    platforms.push({
      mesh: log,
      axis: "z",
      base: log.position.z,
      amplitude: 1.3,
      speed: 0.7 + i * 0.12,
      phase: i * 0.8,
    });
  }
  addBox(scene, [1.1, 0.8, 0.9], [61.8, 0.42, -2.3], "#a855f7", {
    name: "river_challenge_reward_chest",
    category: "challenge",
  });
  return platforms;
}

function addCaveChallenge(scene: THREE.Scene): {
  door: THREE.Mesh;
  pillars: Record<string, THREE.Mesh>;
} {
  addBox(scene, [10, 4, 10], [97, 1.3, 38.5], "#1f2937", {
    name: "cave_challenge_chamber",
    category: "terrain",
    castShadow: false,
  });
  const door = addBox(scene, [2.8, 3.2, 0.6], [102.2, 1.6, 38.5], "#b91c1c", {
    name: "cave_challenge_door",
    category: "challenge",
  });
  const a = addCylinder(scene, 0.5, 0.5, 2.2, 6, [93.5, 1.1, 35.8], "#67e8f9", {
    name: "cave_pillar_a_mesh",
    category: "challenge",
  });
  const b = addCylinder(scene, 0.5, 0.5, 2.2, 6, [96.7, 1.1, 39.2], "#67e8f9", {
    name: "cave_pillar_b_mesh",
    category: "challenge",
  });
  const c = addCylinder(scene, 0.5, 0.5, 2.2, 6, [99.4, 1.1, 35.8], "#67e8f9", {
    name: "cave_pillar_c_mesh",
    category: "challenge",
  });
  addBox(scene, [0.5, 1.2, 0.5], [101.2, 0.6, 38.5], "#22c55e", {
    name: "cave_challenge_receiver",
    category: "challenge",
  });
  addBox(scene, [1.1, 0.8, 0.9], [103.7, 0.42, 38.5], "#38bdf8", {
    name: "cave_challenge_reward_chest",
    category: "challenge",
  });
  return {
    door,
    pillars: { cave_pillar_a: a, cave_pillar_b: b, cave_pillar_c: c },
  };
}

function addVolcanoChallenge(scene: THREE.Scene): MovingPlatformRef[] {
  const platforms: MovingPlatformRef[] = [];
  for (let i = 0; i < 3; i += 1) {
    const platform = addBox(
      scene,
      [2, 0.5, 2],
      [42 + i * 5.1, -0.72, 92 + (i % 2 === 0 ? 1.2 : -1)],
      "#52525b",
      {
        name: `volcano_challenge_platform_${i + 1}`,
        category: "challenge",
      },
    );
    platforms.push({
      mesh: platform,
      axis: "z",
      base: platform.position.z,
      amplitude: 1.1,
      speed: 0.82 + i * 0.08,
      phase: i * 1.2,
    });
  }
  for (let i = 0; i < 4; i += 1) {
    addBox(
      scene,
      [1.1, 0.6, 1.1],
      [38 + i * 6.2, -0.7, 97.2 + (i % 2 === 0 ? 0.8 : -0.8)],
      "#7f1d1d",
      {
        name: `volcano_challenge_vent_${i + 1}`,
        category: "challenge",
      },
    );
  }
  addBox(scene, [1.2, 0.85, 1], [61.2, 0.42, 94.5], "#fb923c", {
    name: "volcano_challenge_reward_chest",
    category: "challenge",
  });
  return platforms;
}

function addOasisChallenge(scene: THREE.Scene): {
  finalDoor: THREE.Mesh;
  plates: Record<"oasis_plate_a" | "oasis_plate_b" | "oasis_plate_c", THREE.Mesh>;
} {
  addBox(scene, [22, 3.2, 16], [159, -1.1, 90], "#d6d3d1", {
    name: "oasis_final_chamber_floor",
    category: "terrain",
    castShadow: false,
  });
  const finalDoor = addBox(scene, [2.2, 3.6, 0.8], [163.3, 1.8, 89.6], "#9f1239", {
    name: "oasis_final_door",
    category: "challenge",
  });
  const plateA = addBox(scene, [1.4, 0.2, 1.4], [151.8, 0.1, 87.4], "#a1a1aa", {
    name: "oasis_plate_a_mesh",
    category: "challenge",
  });
  const plateB = addBox(scene, [1.4, 0.2, 1.4], [155.8, 0.1, 92.2], "#a1a1aa", {
    name: "oasis_plate_b_mesh",
    category: "challenge",
  });
  const plateC = addBox(scene, [1.4, 0.2, 1.4], [160.1, 0.1, 86.7], "#a1a1aa", {
    name: "oasis_plate_c_mesh",
    category: "challenge",
  });
  addBox(scene, [1.4, 0.9, 1.4], [166.2, 0.45, 89.5], "#fde68a", {
    name: "oasis_challenge_reward_altar",
    category: "challenge",
  });
  return { finalDoor, plates: { oasis_plate_a: plateA, oasis_plate_b: plateB, oasis_plate_c: plateC } };
}

function createGroundHeightSampler(): (x: number, z: number) => number {
  return (x, z) => {
    if (x >= 8 && x <= 24 && z >= 41 && z <= 46) {
      const t = (x - 8) / 16;
      return THREE.MathUtils.lerp(2.5, 0, t);
    }
    if (x >= -30 && x <= 10 && z >= 43 && z <= 46) {
      return 2.5;
    }
    if (x >= -26 && x <= 10 && z >= 34 && z < 43) {
      if (z >= 39) {
        return THREE.MathUtils.lerp(1.5, 2.5, (z - 39) / 4);
      }
      return 1.5;
    }
    if (x >= -30 && x <= 24 && z >= -4 && z < 34) {
      if (z >= 28) {
        return THREE.MathUtils.lerp(0, 1.5, (z - 28) / 6);
      }
      return 0;
    }
    if (x >= 78 && x <= 90 && z >= 14 && z <= 24) {
      const t = (x - 78) / 12;
      return -0.5 * t;
    }
    return 0;
  };
}

export function buildBeachHub(scene: THREE.Scene): WorldBuildResult {
  const colliders: BoxCollider[] = [];
  const getGroundHeight = createGroundHeightSampler();
  const posAt = (x: number, z: number): THREE.Vector3 =>
    new THREE.Vector3(x, getGroundHeight(x, z), z);

  scene.fog = new THREE.FogExp2("#b6e8ff", 0.0036);

  const hemiLight = new THREE.HemisphereLight("#fff7ed", "#87a7be", 0.9);
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

  // Beach / Port Overhaul: tiered shoreline -> bluff -> plaza
  addTerrainSlab(scene, 92, 52, 0, -4, 13, "#f4d8a2", "beach_shore_slab");
  addTerrainSlab(scene, 62, 16, 1.5, -7, 36.6, "#bddf95", "beach_bluff_slab");
  addTerrainSlab(scene, 42, 6, 2.5, -11, 44.4, "#b4d38f", "beach_plaza_slab");

  addRamp(
    scene,
    22,
    8,
    0,
    1.5,
    -4,
    30.6,
    "z",
    "#e9cfa2",
    "beach_ramp_t0_to_t1",
  );
  addRamp(
    scene,
    18,
    5.2,
    1.5,
    2.5,
    -10.8,
    41,
    "z",
    "#bfd898",
    "beach_ramp_t1_to_t2",
  );
  addRamp(
    scene,
    18,
    5,
    2.5,
    0,
    16,
    43.4,
    "x",
    "#d5caab",
    "beach_river_trail_ramp",
  );

  addTerrainSlab(scene, 160, 64, -1.8, -4, -18, "#2f9fb3", "beach_ocean_basin");
  addWaterPlane(scene, 152, 52, -4, -0.25, -17, "#4ec6d8", "beach", "beach_ocean_surface");
  addBox(scene, [90, 0.3, 6], [-4, -0.14, -0.2], "#8ce8ff", {
    name: "beach_near_shore_strip",
    category: "water",
    castShadow: false,
    receiveShadow: true,
    flatShaded: false,
  });

  // Chunky pier kit
  addBox(scene, [18, 1.1, 24], [2, 0.55, 10], "#9d7a58", {
    name: "beach_pier_deck",
    category: "structure",
  });
  addBox(scene, [18.4, 0.22, 24.4], [2, 1.12, 10], "#c79f74", {
    name: "beach_pier_top_plank",
    category: "structure",
    flatShaded: false,
  });
  for (let x = -6; x <= 10; x += 4) {
    for (let z = -0.5; z <= 20.5; z += 4) {
      addCylinder(scene, 0.34, 0.42, 3.1, 6, [x, -0.5, z], "#7a5538", {
        name: `beach_pier_post_${x}_${z}`,
        category: "structure",
        instanceCandidate: true,
      });
    }
  }
  addBox(scene, [18, 0.24, 0.24], [2, 1.52, 21.8], "#7b5a3d", {
    name: "beach_pier_rail_north",
    category: "structure",
    instanceCandidate: true,
  });
  addBox(scene, [18, 0.24, 0.24], [2, 1.52, -1.8], "#7b5a3d", {
    name: "beach_pier_rail_south",
    category: "structure",
    instanceCandidate: true,
  });

  // Beach landmarks and hubs
  addBox(scene, [8.8, 4.4, 6.8], [-21.8, 4.7, 44.1], "#f2b78f", {
    name: "beach_rod_shop_body",
    category: "structure",
  });
  addBox(scene, [10.2, 1.3, 8], [-21.8, 7.55, 44.1], "#ee8a6b", {
    name: "beach_rod_shop_roof",
    category: "structure",
  });
  addCollider(colliders, -21.8, 44.1, 9.4, 7.2);

  addBox(scene, [8.2, 4, 6.2], [-12, 4.55, 44.1], "#f8e38b", {
    name: "beach_bait_shop_body",
    category: "structure",
  });
  addBox(scene, [9.4, 1.2, 7.3], [-12, 7.2, 44.1], "#f59e0b", {
    name: "beach_bait_shop_roof",
    category: "structure",
  });
  addCollider(colliders, -12, 44.1, 8.8, 6.6);

  addBox(scene, [6.4, 0.8, 5], [-6.8, 2.9, 43.2], "#d1fae5", {
    name: "beach_npc_plaza_stage",
    category: "structure",
  });
  addBox(scene, [2.2, 1.6, 0.3], [-6.8, 3.9, 43.1], "#f9a8d4", {
    name: "beach_quest_board_sign",
    category: "prop",
  });
  addBox(scene, [0.8, 1.3, 0.8], [-9.2, 3.2, 43.8], "#60a5fa", {
    name: "beach_npc_scout",
    category: "prop",
  });
  addBox(scene, [0.8, 1.3, 0.8], [-9.2, 3.2, 42.4], "#f59e0b", {
    name: "beach_npc_guide",
    category: "prop",
  });
  addBox(scene, [0.8, 1.3, 0.8], [-10.9, 3.2, 43], "#22d3ee", {
    name: "beach_npc_hermit",
    category: "prop",
  });

  addSign(scene, 19.8, 0, 38.8, "#93c5fd", "beach_sign_river_path");
  addSign(scene, 73.8, 0, 15.2, "#bae6fd", "beach_sign_cave_path");
  addBox(scene, [8.8, 6.4, 1.6], [160, 3.2, 100], "#e4d8bd", {
    name: "oasis_distant_ruin_arch",
    category: "landmark",
    castShadow: false,
  });
  addBox(scene, [6, 11, 6], [34, 9.4, 96.7], "#5b3028", {
    name: "volcano_distant_plume",
    category: "landmark",
    castShadow: false,
  });

  // Scenic boundaries and cliff silhouettes
  addTerrainSlab(scene, 20, 18, 3.8, -29, 40, "#7b8f65", "beach_west_cliff");
  addTerrainSlab(scene, 20, 16, 4.4, 15, 46, "#819967", "beach_east_cliff");
  addTerrainSlab(scene, 112, 16, 4.2, -4, -10, "#7f8d79", "beach_back_berm");

  // River zone with banks, depression and waterfall landmark
  addTerrainSlab(scene, 62, 54, 0, 48, 8, "#c7dfa7", "river_ground_slab");
  addTerrainSlab(scene, 62, 10, 0.8, 48, 16.5, "#afd38f", "river_north_bank");
  addTerrainSlab(scene, 62, 10, 0.8, 48, -5.5, "#afd38f", "river_south_bank");
  addWaterPlane(scene, 48, 12, 48, -0.35, 6, "#4cb7ea", "river", "river_surface_upper");
  addWaterPlane(scene, 34, 11, 50, -0.38, -2.7, "#3aa5d9", "river", "river_surface_lower");

  addBox(scene, [11, 7.2, 4.8], [66, 2.6, 5.7], "#64748b", {
    name: "river_waterfall_cliff",
    category: "landmark",
  });
  addCollider(colliders, 66, 5.7, 11, 4.8);
  addWaterPlane(scene, 6.4, 5.8, 66, 2.2, 7.8, "#80e4ff", "river", "river_waterfall_sheet");

  addBox(scene, [10.2, 1.2, 4], [29, 0.62, 36.5], "#8b6a4f", {
    name: "river_bridge_from_beach",
    category: "structure",
  });

  // Cave zone with entrance slope and readable lake pocket
  addTerrainSlab(scene, 36, 40, 0, 101, 24, "#3f4b5c", "cave_outer_slab");
  addRamp(scene, 16, 6.2, 0, -0.6, 82, 18.2, "x", "#64748b", "cave_entry_slope");
  addTerrainSlab(scene, 32, 34, -0.35, 103, 25, "#2e3947", "cave_inner_floor");
  addWaterPlane(scene, 18, 14, 105, -0.45, 24.4, "#35b8ec", "cave", "cave_lake_surface");
  addTerrainSlab(scene, 10, 9, 0.1, 88.2, 16.8, "#718299", "cave_safe_pocket");

  addBox(scene, [2.3, 7.2, 36], [117, 2.2, 25], "#1e293b", {
    name: "cave_wall_east",
    category: "terrain",
    castShadow: false,
  });
  addBox(scene, [34, 7.2, 2.2], [101, 2.2, 7.3], "#1e293b", {
    name: "cave_wall_south",
    category: "terrain",
    castShadow: false,
  });
  addBox(scene, [34, 7.2, 2.2], [101, 2.2, 42.7], "#1e293b", {
    name: "cave_wall_north",
    category: "terrain",
    castShadow: false,
  });
  addCollider(colliders, 117, 25, 2.3, 36);
  addCollider(colliders, 101, 7.3, 34, 2.2);
  addCollider(colliders, 101, 42.7, 34, 2.2);

  addBox(scene, [18, 5.2, 2.6], [78, 3.4, 12.3], "#334155", {
    name: "cave_entrance_arch",
    category: "landmark",
    castShadow: false,
  }).rotation.x = 0.06;

  // Volcano zone with ridges and heat-vibe terrain
  addTerrainSlab(scene, 90, 56, 0, 32, 74, "#897867", "volcano_ground_slab");
  addTerrainSlab(scene, 30, 18, 1.2, 48, 93, "#5a4a3d", "volcano_ridge_east");
  addTerrainSlab(scene, 24, 16, 0.9, 18, 95, "#615243", "volcano_ridge_west");
  addWaterPlane(scene, 16, 11, 24, -0.25, 77.5, "#f08738", "volcano", "volcano_hot_spring");
  addWaterPlane(scene, 28, 8, 49, -0.3, 93.5, "#d85b1a", "volcano", "volcano_lava_stream");

  addBox(scene, [8.4, 4.2, 6.2], [10.6, 1.1, 63.6], "#fcd34d", {
    name: "volcano_sell_hut",
    category: "structure",
  });
  addBox(scene, [9.4, 0.95, 7.1], [10.6, 3.55, 63.6], "#f97316", {
    name: "volcano_sell_hut_roof",
    category: "structure",
  });
  addCollider(colliders, 10.6, 63.6, 8.6, 6.5);

  addBox(scene, [2.4, 8, 56], [-12, 2.6, 74], "#44403c", {
    name: "volcano_boundary_west",
    category: "terrain",
    castShadow: false,
  });
  addBox(scene, [2.4, 8, 56], [76, 2.6, 74], "#44403c", {
    name: "volcano_boundary_east",
    category: "terrain",
    castShadow: false,
  });
  addBox(scene, [86, 8, 2.4], [32, 2.6, 103.8], "#44403c", {
    name: "volcano_boundary_north",
    category: "terrain",
    castShadow: false,
  });
  addCollider(colliders, -12, 74, 2.4, 56);
  addCollider(colliders, 76, 74, 2.4, 56);
  addCollider(colliders, 32, 103.8, 86, 2.4);

  // Oasis zone with bowl valley and ruins
  addTerrainSlab(scene, 86, 60, 0.8, 140, 84, "#c9e89a", "oasis_outer_ring");
  addTerrainSlab(scene, 34, 24, 0, 146, 84, "#addc86", "oasis_inner_valley");
  addWaterPlane(scene, 18, 13, 146.5, -0.22, 84.5, "#61deee", "oasis", "oasis_sacred_pool");

  addBox(scene, [26, 4.5, 20], [159, 1.2, 90], "#e7e5e4", {
    name: "oasis_ruin_chamber",
    category: "structure",
  });
  addBox(scene, [7.8, 3.8, 5.8], [121.8, 0.9, 76.8], "#fde68a", {
    name: "oasis_sell_ruin",
    category: "structure",
  });
  addBox(scene, [8.8, 0.9, 6.8], [121.8, 3.2, 76.8], "#f59e0b", {
    name: "oasis_sell_ruin_roof",
    category: "structure",
  });
  addCollider(colliders, 121.8, 76.8, 8.1, 6.1);

  addBox(scene, [86, 7, 2.4], [140, 2.4, 112.2], "#9ca3af", {
    name: "oasis_boundary_north",
    category: "terrain",
    castShadow: false,
  });
  addBox(scene, [2.4, 7, 56], [182.8, 2.4, 84], "#9ca3af", {
    name: "oasis_boundary_east",
    category: "terrain",
    castShadow: false,
  });
  addBox(scene, [86, 7, 2.4], [140, 2.4, 54], "#9ca3af", {
    name: "oasis_boundary_south",
    category: "terrain",
    castShadow: false,
  });
  addCollider(colliders, 140, 112.2, 86, 2.4);
  addCollider(colliders, 182.8, 84, 2.4, 56);
  addCollider(colliders, 140, 54, 86, 2.4);

  // Repeated foliage and props (instancing candidates)
  for (const [x, z] of [
    [-24, 4],
    [-21, 18],
    [16, 12],
    [18, -4],
    [6, 25],
  ] as Array<[number, number]>) {
    addPalm(scene, x, getGroundHeight(x, z), z, `beach_palm_${x}_${z}`);
  }

  for (const [x, z] of [
    [30, 3],
    [38, -1],
    [48, 20],
    [56, 14],
    [58, 2],
    [76, 18],
    [130, 72],
    [148, 70],
    [164, 80],
    [150, 98],
    [170, 95],
  ] as Array<[number, number]>) {
    addTree(scene, x, getGroundHeight(x, z), z, x < 100 ? "#4d7c0f" : "#65a30d", `tree_${x}_${z}`);
  }

  addTree(scene, -20, getGroundHeight(-20, 36), 36, "#4d7c0f", "beach_landmark_tree");
  addBox(scene, [1.6, 0.5, 0.8], [-17.2, getGroundHeight(-17.2, 35.2) + 0.25, 35.2], "#a16207", {
    name: "beach_bluff_bench",
    category: "prop",
    instanceCandidate: true,
  });

  for (const [x, z, scale, color] of [
    [8.5, 7, 1.2, "#94a3b8"],
    [13.5, 15, 0.9, "#94a3b8"],
    [-2.3, 4.5, 0.8, "#94a3b8"],
    [48, 1, 1.1, "#94a3b8"],
    [54, 9, 1, "#94a3b8"],
    [90, 19, 1.4, "#94a3b8"],
    [94, 29, 1.2, "#94a3b8"],
    [111, 31, 1.4, "#94a3b8"],
    [22, 69, 1.3, "#57534e"],
    [36, 85, 1.1, "#57534e"],
    [48, 100, 1.5, "#57534e"],
    [10, 92, 1.2, "#57534e"],
    [134, 84, 1.2, "#d6d3d1"],
    [156, 101, 1.1, "#d6d3d1"],
    [174, 74, 1.2, "#d6d3d1"],
  ] as Array<[number, number, number, string]>) {
    addRock(
      scene,
      x,
      getGroundHeight(x, z),
      z,
      scale,
      color,
      `rock_${x}_${z}`,
    );
  }

  for (const [x, z, color] of [
    [-18, 15, "#65a30d"],
    [4, 3, "#65a30d"],
    [44, 16, "#65a30d"],
    [60, 18, "#65a30d"],
    [139, 86, "#84cc16"],
    [151, 92, "#84cc16"],
  ] as Array<[number, number, string]>) {
    addShrub(scene, x, getGroundHeight(x, z), z, color, `shrub_${x}_${z}`);
  }

  for (const [x, z, color, scale] of [
    [95, 20, "#22d3ee", 1.15],
    [109, 26, "#67e8f9", 1.25],
    [101, 32, "#93c5fd", 0.9],
    [26, 88, "#fb923c", 1.15],
    [43, 76, "#f97316", 1.2],
  ] as Array<[number, number, string, number]>) {
    addDodeca(scene, 0.7 * scale, [x, getGroundHeight(x, z) + 0.72 * scale, z], color, {
      name: `crystal_${x}_${z}`,
      category: "prop",
    });
  }

  for (const [x, z] of [
    [92, 23],
    [98, 27],
    [112, 20],
    [148, 88],
    [162, 84],
  ] as Array<[number, number]>) {
    addCylinder(scene, 0.12, 0.16, 0.65, 6, [x, getGroundHeight(x, z) + 0.32, z], "#f8fafc", {
      name: `fungi_stem_${x}_${z}`,
      category: "prop",
      instanceCandidate: true,
    });
    const cap = addBox(scene, [0.62, 0.2, 0.62], [x, getGroundHeight(x, z) + 0.73, z], "#67e8f9", {
      name: `fungi_cap_${x}_${z}`,
      category: "prop",
      instanceCandidate: true,
    });
    cap.scale.set(1, 0.6, 1);
  }

  for (const [x, z] of [
    [86, 17],
    [93, 15],
    [18, 66],
    [61, 73],
  ] as Array<[number, number]>) {
    addBox(scene, [0.18, 1.2, 0.18], [x, getGroundHeight(x, z) + 0.6, z], "#78350f", {
      name: `torch_post_${x}_${z}`,
      category: "prop",
      instanceCandidate: true,
    });
    addDodeca(scene, 0.2, [x, getGroundHeight(x, z) + 1.25, z], "#f97316", {
      name: `torch_flame_${x}_${z}`,
      category: "prop",
      instanceCandidate: true,
      flatShaded: false,
    });
  }

  // Challenge, rod stand, relic and puzzle content (kept coordinate-compatible)
  addBeachChallenge(scene);
  const riverPlatforms = addRiverChallenge(scene);
  const caveChallenge = addCaveChallenge(scene);
  const volcanoPlatforms = addVolcanoChallenge(scene);
  const oasisChallenge = addOasisChallenge(scene);
  const movingPlatforms = [...riverPlatforms, ...volcanoPlatforms];

  for (const [x, z, color, key] of [
    [2.8, 21.8, "#f59e0b", "beach_zone_rod_stand"],
    [53.8, 5.8, "#22c55e", "river_zone_rod_stand"],
    [107.8, 24.6, "#38bdf8", "cave_zone_rod_stand"],
    [24.8, 78, "#fb923c", "volcano_zone_rod_stand"],
    [147.4, 84.4, "#facc15", "oasis_zone_rod_stand"],
  ] as Array<[number, number, string, string]>) {
    addRodStand(scene, x, getGroundHeight(x, z), z, color, key);
  }

  addRelicPedestal(scene, 8.4, getGroundHeight(8.4, 17.1), 17.1, "#fef3c7", "relic_beach_pedestal");
  addRelicPedestal(scene, 67.4, getGroundHeight(67.4, 0.5), 0.5, "#bae6fd", "relic_river_pedestal");
  addRelicPedestal(scene, 108.2, getGroundHeight(108.2, 34.2), 34.2, "#a5b4fc", "relic_cave_pedestal");

  // Gate structures
  const volcanoGateDoor = addBox(scene, [4.2, 4.2, 0.7], [12, 2.1, 33.3], "#7f1d1d", {
    name: "volcano_gate_door",
    category: "gate",
  });
  const volcanoGateSign = addBox(scene, [5.2, 1.2, 0.2], [12, 4.8, 33.65], "#fca5a5", {
    name: "volcano_gate_sign",
    category: "gate",
  });

  addBox(scene, [6.8, 5.2, 1.2], [86, 2.6, 76.1], "#78716c", {
    name: "oasis_gate_frame",
    category: "gate",
  });
  const oasisGateDoor = addBox(scene, [4.2, 4.4, 0.7], [86, 2.2, 75.9], "#7f1d1d", {
    name: "oasis_gate_door",
    category: "gate",
  });
  const emblemBeach = addBox(scene, [0.8, 0.8, 0.18], [84.3, 4.65, 76.35], "#7f1d1d", {
    name: "oasis_gate_emblem_beach",
    category: "gate",
  });
  const emblemRiver = addBox(scene, [0.8, 0.8, 0.18], [85.4, 4.65, 76.35], "#7f1d1d", {
    name: "oasis_gate_emblem_river",
    category: "gate",
  });
  const emblemCave = addBox(scene, [0.8, 0.8, 0.18], [86.6, 4.65, 76.35], "#7f1d1d", {
    name: "oasis_gate_emblem_cave",
    category: "gate",
  });
  const emblemVolcano = addBox(scene, [0.8, 0.8, 0.18], [87.7, 4.65, 76.35], "#7f1d1d", {
    name: "oasis_gate_emblem_volcano",
    category: "gate",
  });

  const volcanoGateCollider = colliderAt(12, 33.3, 5.2, 2.4);
  const oasisGateCollider = colliderAt(86, 75.9, 4.6, 2.2);
  const oasisFinalDoorCollider = colliderAt(163.3, 89.6, 2.2, 1);

  const interactables: Interactable[] = [
    {
      id: "beach_fishing_spot",
      type: "fishing_spot",
      label: "FISH",
      position: posAt(2.2, 21.8),
      radius: 2.8,
      title: "Beach Pier Spot",
      zoneId: "beach",
    },
    {
      id: "beach_sell_stand",
      type: "sell_stand",
      label: "SELL",
      position: posAt(-6.4, 18),
      radius: 2.2,
      title: "Beach Sell Stand",
      zoneId: "beach",
    },
    {
      id: "beach_rod_shop",
      type: "rod_shop",
      label: "SHOP",
      position: posAt(-21.8, 44.1),
      radius: 2.4,
      title: "Rod Shop",
      zoneId: "beach",
    },
    {
      id: "beach_bait_shop",
      type: "bait_shop",
      label: "SHOP",
      position: posAt(-12, 44.1),
      radius: 2.4,
      title: "Bait Shop",
      zoneId: "beach",
    },
    {
      id: "river_fishing_spot",
      type: "fishing_spot",
      label: "FISH",
      position: posAt(51, 6.2),
      radius: 2.8,
      title: "River Bend Spot",
      zoneId: "river",
    },
    {
      id: "river_sell_stand",
      type: "sell_stand",
      label: "SELL",
      position: posAt(34.4, 15.3),
      radius: 2.2,
      title: "River Sell Stand",
      zoneId: "river",
    },
    {
      id: "cave_fishing_spot",
      type: "fishing_spot",
      label: "FISH",
      position: posAt(106, 24.2),
      radius: 2.8,
      title: "Cave Lake Spot",
      zoneId: "cave",
    },
    {
      id: "cave_sell_stand",
      type: "sell_stand",
      label: "SELL",
      position: posAt(88, 16.8),
      radius: 2.2,
      title: "Cave Sell Stand",
      zoneId: "cave",
    },
    {
      id: "volcano_fishing_spot",
      type: "fishing_spot",
      label: "FISH",
      position: posAt(24, 77.5),
      radius: 2.8,
      title: "Volcano Hot Spring Spot",
      zoneId: "volcano",
    },
    {
      id: "volcano_sell_stand",
      type: "sell_stand",
      label: "SELL",
      position: posAt(10.6, 66.4),
      radius: 2.2,
      title: "Volcano Sell Stand",
      zoneId: "volcano",
    },
    {
      id: "oasis_fishing_spot",
      type: "fishing_spot",
      label: "FISH",
      position: posAt(146.5, 84.5),
      radius: 2.8,
      title: "Oasis Sacred Pool",
      zoneId: "oasis",
    },
    {
      id: "oasis_sell_stand",
      type: "sell_stand",
      label: "SELL",
      position: posAt(121.8, 79.3),
      radius: 2.2,
      title: "Oasis Sell Stand",
      zoneId: "oasis",
    },
    { id: "volcano_gate", type: "gate", label: "VIEW", position: posAt(12, 31.6), radius: 3.2, title: "Volcano Gate" },
    { id: "oasis_gate", type: "gate", label: "VIEW", position: posAt(86, 73.7), radius: 3, title: "Oasis Gate" },
    { id: "quest_board", type: "quest_board", label: "QUEST", position: posAt(-6.8, 43.2), radius: 2.1, title: "Quest Board" },
    { id: "npc_hint_beach", type: "npc_hint", label: "TALK", position: posAt(-9.2, 43.8), radius: 1.9, title: "Scout Nori" },
    { id: "npc_hint_river", type: "npc_hint", label: "TALK", position: posAt(-9.2, 42.4), radius: 1.9, title: "Guide Piko" },
    { id: "npc_hint_cave", type: "npc_hint", label: "TALK", position: posAt(-10.9, 43), radius: 1.9, title: "Hermit Luma" },
    { id: "beach_zone_rod_pickup", type: "zone_rod_pickup", label: "PICKUP", position: posAt(2.8, 21.8), radius: 2, title: "Beach Zone Luck Rod", zoneId: "beach" },
    { id: "river_zone_rod_pickup", type: "zone_rod_pickup", label: "PICKUP", position: posAt(53.8, 5.8), radius: 2, title: "River Zone Luck Rod", zoneId: "river" },
    { id: "cave_zone_rod_pickup", type: "zone_rod_pickup", label: "PICKUP", position: posAt(107.8, 24.6), radius: 2, title: "Cave Zone Luck Rod", zoneId: "cave" },
    { id: "volcano_zone_rod_pickup", type: "zone_rod_pickup", label: "PICKUP", position: posAt(24.8, 78), radius: 2, title: "Volcano Zone Luck Rod", zoneId: "volcano" },
    { id: "oasis_zone_rod_pickup", type: "zone_rod_pickup", label: "PICKUP", position: posAt(147.4, 84.4), radius: 2, title: "Oasis Zone Luck Rod", zoneId: "oasis" },
    { id: "beach_challenge_start", type: "challenge_start", label: "START", position: posAt(-1.6, 25.6), radius: 2.2, title: "Beach Challenge", zoneId: "beach" },
    { id: "river_challenge_start", type: "challenge_start", label: "START", position: posAt(39.8, -2.3), radius: 2.2, title: "River Challenge", zoneId: "river" },
    { id: "cave_challenge_start", type: "challenge_start", label: "START", position: posAt(91.8, 38.4), radius: 2.2, title: "Cave Challenge", zoneId: "cave" },
    { id: "volcano_challenge_start", type: "challenge_start", label: "START", position: posAt(35.8, 88.9), radius: 2.2, title: "Volcano Challenge", zoneId: "volcano" },
    { id: "oasis_challenge_start", type: "challenge_start", label: "START", position: posAt(150.3, 89.8), radius: 2.2, title: "Oasis Final Challenge", zoneId: "oasis" },
    { id: "relic_beach_shell_sigill", type: "relic_pickup", label: "PICKUP", position: posAt(8.4, 17.1), radius: 1.9, title: "Beach Relic" },
    { id: "relic_river_totem_piece", type: "relic_pickup", label: "PICKUP", position: posAt(67.4, 0.5), radius: 1.9, title: "River Relic" },
    { id: "relic_cave_crystal_key", type: "relic_pickup", label: "PICKUP", position: posAt(108.2, 34.2), radius: 1.9, title: "Cave Relic" },
    { id: "cave_pillar_a", type: "puzzle_pillar", label: "ROTATE", position: posAt(93.5, 35.8), radius: 1.7, title: "Crystal Pillar A", zoneId: "cave" },
    { id: "cave_pillar_b", type: "puzzle_pillar", label: "ROTATE", position: posAt(96.7, 39.2), radius: 1.7, title: "Crystal Pillar B", zoneId: "cave" },
    { id: "cave_pillar_c", type: "puzzle_pillar", label: "ROTATE", position: posAt(99.4, 35.8), radius: 1.7, title: "Crystal Pillar C", zoneId: "cave" },
  ];

  for (const [x, z, color, name] of [
    [-6.4, 18, "#facc15", "sign_beach_sell"],
    [-21.8, 44.1, "#93c5fd", "sign_beach_rod_shop"],
    [-12, 44.1, "#86efac", "sign_beach_bait_shop"],
    [34.4, 15.3, "#facc15", "sign_river_sell"],
    [88, 16.8, "#facc15", "sign_cave_sell"],
    [10.6, 66.4, "#facc15", "sign_volcano_sell"],
    [121.8, 79.3, "#facc15", "sign_oasis_sell"],
  ] as Array<[number, number, string, string]>) {
    addSign(scene, x, getGroundHeight(x, z), z, color, name);
  }

  for (const interactable of interactables) {
    addInteractMarker(scene, interactable);
  }

  for (const [x, z, w, d] of [
    [8.5, 7, 2.3, 2.3],
    [13.5, 15, 1.8, 1.8],
    [48, 1, 2.1, 2.1],
    [54, 9, 2.1, 2.1],
    [90, 19, 2.7, 2.7],
    [94, 29, 2.5, 2.5],
    [111, 31, 2.7, 2.7],
    [-18, 15, 1.6, 1.6],
    [4, 3, 1.6, 1.6],
    [44, 16, 1.7, 1.7],
    [60, 18, 1.7, 1.7],
    [22, 69, 2.4, 2.4],
    [36, 85, 2.2, 2.2],
    [48, 100, 2.8, 2.8],
    [10, 92, 2.3, 2.3],
    [134, 84, 2.4, 2.4],
    [156, 101, 2.2, 2.2],
    [174, 74, 2.3, 2.3],
  ] as Array<[number, number, number, number]>) {
    addCollider(colliders, x, z, w, d);
  }

  const zoneRegions: ZoneRegion[] = [
    { zoneId: "beach", minX: -45, maxX: 24, minZ: -30, maxZ: 50 },
    { zoneId: "river", minX: 24, maxX: 80, minZ: -20, maxZ: 40 },
    { zoneId: "cave", minX: 78, maxX: 122, minZ: 6, maxZ: 48 },
    { zoneId: "volcano", minX: -6, maxX: 86, minZ: 50, maxZ: 110 },
    { zoneId: "oasis", minX: 86, maxX: 196, minZ: 56, maxZ: 122 },
  ];

  return {
    spawnPosition: new THREE.Vector3(2, getGroundHeight(2, 10), 10),
    colliders,
    worldBounds: { minX: -44, maxX: 196, minZ: -28, maxZ: 122 },
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
    cavePuzzleDoor: caveChallenge.door,
    puzzlePillars: caveChallenge.pillars,
    oasisFinalDoor: oasisChallenge.finalDoor,
    oasisChallengePlates: oasisChallenge.plates,
    movingPlatforms,
    volcanoGateCollider,
    oasisGateCollider,
    oasisFinalDoorCollider,
  };
}

```

## client/src/engine/world/types.ts

```ts
import * as THREE from "three";
import type { BoxCollider, WorldBounds } from "../collision";
import type { ZoneId } from "../../game/types";

export type InteractableType =
  | "fishing_spot"
  | "sell_stand"
  | "rod_shop"
  | "bait_shop"
  | "gate"
  | "zone_rod_pickup"
  | "challenge_start"
  | "quest_board"
  | "npc_hint"
  | "puzzle_pillar"
  | "relic_pickup";

export type InteractableLabel =
  | "FISH"
  | "SELL"
  | "SHOP"
  | "VIEW"
  | "QUEST"
  | "TALK"
  | "START"
  | "PICKUP"
  | "ROTATE";

export interface Interactable {
  id: string;
  type: InteractableType;
  label: InteractableLabel;
  position: THREE.Vector3;
  radius: number;
  title: string;
  zoneId?: ZoneId;
}

export interface ZoneRegion {
  zoneId: ZoneId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MovingPlatformRef {
  mesh: THREE.Mesh;
  axis: "x" | "z";
  base: number;
  amplitude: number;
  speed: number;
  phase: number;
}

export interface WorldBuildResult {
  spawnPosition: THREE.Vector3;
  colliders: BoxCollider[];
  worldBounds: WorldBounds;
  getGroundHeight: (x: number, z: number) => number;
  interactables: Interactable[];
  zoneRegions: ZoneRegion[];
  volcanoGateDoor: THREE.Mesh;
  volcanoGateSign: THREE.Mesh;
  oasisGateDoor: THREE.Mesh;
  oasisGateEmblems: Record<"beach" | "river" | "cave" | "volcano", THREE.Mesh>;
  cavePuzzleDoor: THREE.Mesh;
  puzzlePillars: Record<string, THREE.Mesh>;
  oasisFinalDoor: THREE.Mesh;
  oasisChallengePlates: Record<"oasis_plate_a" | "oasis_plate_b" | "oasis_plate_c", THREE.Mesh>;
  movingPlatforms: MovingPlatformRef[];
  volcanoGateCollider: BoxCollider;
  oasisGateCollider: BoxCollider;
  oasisFinalDoorCollider: BoxCollider;
}

```

## client/src/engine/PlayerController.ts

```ts
import * as THREE from "three";
import { clampToWorldBounds, resolveCircleVsBoxes, type BoxCollider, type WorldBounds } from "./collision";

export class PlayerController {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  readonly collisionRadius = 0.6;

  private readonly velocity = new THREE.Vector3();
  private readonly moveSpeed = 4.4;

  constructor(spawnPosition: THREE.Vector3) {
    this.group = new THREE.Group();
    this.position = this.group.position;
    this.position.copy(spawnPosition);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 1.05, 5, 8),
      new THREE.MeshStandardMaterial({ color: "#fef3c7", roughness: 0.8, metalness: 0.05 })
    );
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 1.1;
    this.group.add(body);

    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 0.6),
      new THREE.MeshStandardMaterial({ color: "#f97316", roughness: 0.85, metalness: 0.05 })
    );
    shirt.position.y = 1.05;
    shirt.castShadow = true;
    shirt.receiveShadow = true;
    this.group.add(shirt);
  }

  update(
    dtSeconds: number,
    input: THREE.Vector2,
    yaw: number,
    colliders: BoxCollider[],
    bounds: WorldBounds,
    getGroundHeight?: (x: number, z: number) => number
  ): void {
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const moveDirection = new THREE.Vector3()
      .addScaledVector(right, input.x)
      .addScaledVector(forward, input.y);

    if (moveDirection.lengthSq() > 1) {
      moveDirection.normalize();
    }

    const targetVelocity = moveDirection.multiplyScalar(this.moveSpeed);
    this.velocity.lerp(targetVelocity, 0.18);

    this.position.addScaledVector(this.velocity, dtSeconds);
    resolveCircleVsBoxes(this.position, this.collisionRadius, colliders);
    clampToWorldBounds(this.position, bounds);

    if (getGroundHeight) {
      const targetY = getGroundHeight(this.position.x, this.position.z);
      this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, 0.35);
    }

    const facingVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z);
    if (facingVelocity.lengthSq() > 0.01) {
      const facing = Math.atan2(this.velocity.x, this.velocity.z);
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, facing, 0.18);
    }
  }

  getHorizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }
}

```

## client/src/app/GameApp.ts

```ts
import * as THREE from "three";
import { BAIT_DEFINITIONS } from "../data/baits";
import {
  DEV_GOLD_GRANT,
  INVENTORY_CAPACITY_BY_LEVEL,
  INVENTORY_UPGRADE_COST_BY_LEVEL,
} from "../data/config";
import { ALL_FISH_BY_ID, FISH_BY_ZONE } from "../data/fish";
import { getQualityPreset, type QualityPreset } from "../data/quality";
import { getQuestById, QUEST_DEFINITIONS } from "../data/quests";
import { getRodById, ROD_DEFINITIONS } from "../data/rods";
import { PLAYABLE_PHASE4_ZONES } from "../data/zones";
import { AudioManager, type SoundEventId } from "../engine/audio/AudioManager";
import type { BoxCollider } from "../engine/collision";
import { MeshAuditHelper } from "../engine/debug/MeshAudit";
import { FollowCamera } from "../engine/FollowCamera";
import { VirtualControls } from "../engine/input/VirtualControls";
import { optimizeStaticInstances } from "../engine/perf/StaticInstanceOptimizer";
import { WorldCullingController } from "../engine/perf/WorldCullingController";
import { PlayerController } from "../engine/PlayerController";
import { RemotePlayerAvatar } from "../engine/RemotePlayerAvatar";
import { RendererHost } from "../engine/RendererHost";
import { ParticleManager } from "../engine/vfx/ParticleManager";
import { ZoneVisualController } from "../engine/visuals/ZoneVisualController";
import type { Interactable } from "../engine/world/types";
import { buildBeachHub } from "../engine/world/WorldBuilder";
import { computeZoneBonusFactor } from "../game/logic/fishRoll";
import {
  getOasisChecklist,
  getZoneProgress,
  isOasisUnlocked,
  isVolcanoUnlocked,
} from "../game/logic/progression";
import { getQuestProgress } from "../game/logic/quests";
import { SaveStore } from "../game/state/SaveStore";
import { FishingSystem } from "../game/systems/FishingSystem";
import type { FishingSnapshot, Rarity, SaveData, ZoneId } from "../game/types";
import { MultiplayerClient } from "../net/MultiplayerClient";
import type {
  NetCelebrationRarity,
  NetFishingState,
  RemotePlayerSnapshot,
} from "../net/types";
import { DiagnosticsOverlay } from "../ui/DiagnosticsOverlay";
import { GameUI } from "../ui/GameUI";
import type {
  BaitViewModel,
  BestiaryEntryViewModel,
  FishInventoryItemViewModel,
  GatePanelViewModel,
  QuestViewModel,
  RodViewModel,
  SettingsViewModel,
  UpgradeViewModel,
  ZoneBestiaryViewModel,
} from "../ui/types";

const RARITY_ORDER: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  mythic: 4,
};

const PLAYER_CAP = 10;
const LOCAL_SYNC_INTERVAL_SECONDS = 1 / 12;
const POSITION_EPSILON = 0.03;
const YAW_EPSILON = 0.02;
const CHALLENGE_GOAL_RADIUS = 1.7;
const NEAR_FULL_THRESHOLD = 0.85;

interface JoinIntent {
  roomId?: string;
  firestoreGameId?: string;
  inviteCode?: string;
  mode: "join" | "game" | "spectate";
}

interface TransformSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

type ChallengeZone = "beach" | "river" | "cave" | "volcano" | "oasis";
type RelicZone = "beach" | "river" | "cave";
type OasisPlateId = "oasis_plate_a" | "oasis_plate_b" | "oasis_plate_c";

interface TimedChallengeRuntime {
  zone: "beach" | "river" | "volcano";
  timeLeft: number;
  checkpoint: THREE.Vector3;
  goal: THREE.Vector3;
  hazardRects: Rect[];
}

const ZONE_LABELS: Record<ZoneId, string> = {
  beach: "Beach",
  river: "River",
  cave: "Cave",
  volcano: "Volcano",
  oasis: "Oasis",
};

const ZONE_ROD_PICKUP_MAP = {
  beach_zone_rod_pickup: {
    pickupKey: "beachZoneRod",
    rodId: "beach_zone_luck_rod",
    zone: "beach",
  },
  river_zone_rod_pickup: {
    pickupKey: "riverZoneRod",
    rodId: "river_zone_luck_rod",
    zone: "river",
  },
  cave_zone_rod_pickup: {
    pickupKey: "caveZoneRod",
    rodId: "cave_zone_luck_rod",
    zone: "cave",
  },
  volcano_zone_rod_pickup: {
    pickupKey: "volcanoZoneRod",
    rodId: "volcano_zone_luck_rod",
    zone: "volcano",
  },
  oasis_zone_rod_pickup: {
    pickupKey: "oasisZoneRod",
    rodId: "oasis_zone_luck_rod",
    zone: "oasis",
  },
} as const;

const CHALLENGE_ROD_BY_ZONE: Record<ChallengeZone, string> = {
  beach: "beach_challenge_rod",
  river: "river_challenge_rod",
  cave: "cave_challenge_rod",
  volcano: "volcano_challenge_rod",
  oasis: "oasis_challenge_rod",
};

const NPC_HINTS: Record<string, { title: string; body: string }> = {
  npc_hint_beach: {
    title: "Scout Nori",
    body: "Beach luck rod sits on a stand by the pier fishing ring. Dock posts mark the beach challenge route.",
  },
  npc_hint_river: {
    title: "Guide Piko",
    body: "River luck rod is near the bend. Logs near the lower river are your challenge path.",
  },
  npc_hint_cave: {
    title: "Hermit Luma",
    body: "Cave luck rod waits by the glowing lake. Rotate all crystal pillars to align the beam and open the chamber.",
  },
};

const RELIC_PICKUP_MAP: Record<string, { relicZone: RelicZone; name: string }> =
  {
    relic_beach_shell_sigill: { relicZone: "beach", name: "Shell Sigill" },
    relic_river_totem_piece: { relicZone: "river", name: "Totem Piece" },
    relic_cave_crystal_key: { relicZone: "cave", name: "Crystal Key" },
  };

const CAVE_PUZZLE_TARGET: Record<string, number> = {
  cave_pillar_a: 1,
  cave_pillar_b: 2,
  cave_pillar_c: 3,
};

const OASIS_PLATE_RECT: Record<OasisPlateId, Rect> = {
  oasis_plate_a: { minX: 151.1, maxX: 152.5, minZ: 86.7, maxZ: 88.1 },
  oasis_plate_b: { minX: 155.1, maxX: 156.5, minZ: 91.5, maxZ: 92.9 },
  oasis_plate_c: { minX: 159.4, maxX: 160.8, minZ: 86, maxZ: 87.4 },
};

export class GameApp {
  private readonly rendererHost: RendererHost;
  private readonly player: PlayerController;
  private readonly followCamera: FollowCamera;
  private readonly controls: VirtualControls;
  private readonly world: ReturnType<typeof buildBeachHub>;

  private readonly saveStore = new SaveStore();
  private readonly ui: GameUI;
  private readonly fishingSystem: FishingSystem;
  private readonly multiplayer: MultiplayerClient;
  private readonly zoneVisuals: ZoneVisualController;
  private readonly audio = new AudioManager();
  private readonly particles: ParticleManager;
  private readonly meshAudit: MeshAuditHelper;
  private readonly worldCulling: WorldCullingController;
  private readonly diagnostics = new DiagnosticsOverlay();
  private qualityPreset: QualityPreset = getQualityPreset("medium");

  private readonly remotePlayers = new Map<string, RemotePlayerAvatar>();
  private currentInteractable: Interactable | null = null;
  private activeFishingSpot: Interactable | null = null;
  private currentZone: ZoneId = "beach";
  private mounted = false;
  private pendingFishingInventoryFull = false;
  private partyGoldMultiplier = 1;
  private onlinePlayerCount = 1;
  private sessionActive = false;
  private joinIntent: JoinIntent | null;
  private syncAccumulator = 0;
  private lastSentTransform: TransformSnapshot | null = null;
  private lastSentFishingState: NetFishingState = "idle";
  private fpsEstimate = 60;
  private diagnosticsAccumulator = 0;
  private audioUnlocked = false;
  private previousVolcanoUnlocked = false;
  private previousOasisUnlocked = false;
  private appliedSettingsSignature = "";
  private cullingDebugEnabled = false;
  private poiMarkersVisible = true;

  private activeTimedChallenge: TimedChallengeRuntime | null = null;
  private caveChallengeStarted = false;
  private cavePuzzleSolved = false;
  private oasisFinalChallengeActive = false;
  private activatedOasisPlates = new Set<OasisPlateId>();
  private cavePillarTurns: Record<string, number> = {
    cave_pillar_a: 0,
    cave_pillar_b: 0,
    cave_pillar_c: 0,
  };

  constructor(mount: HTMLElement) {
    this.rendererHost = new RendererHost(mount);
    const initialSettings = this.saveStore.getSettings();
    this.qualityPreset = getQualityPreset(initialSettings.graphicsQuality);
    this.rendererHost.applyQuality(this.qualityPreset);

    this.world = buildBeachHub(this.rendererHost.scene);
    const instanceResult = optimizeStaticInstances(this.rendererHost.scene);
    if (instanceResult.replacedMeshes > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[perf] instancing replaced ${instanceResult.replacedMeshes} meshes across ${instanceResult.replacedGroups} groups`,
      );
    }

    this.player = new PlayerController(this.world.spawnPosition);
    this.player.group.visible = false; // First-person: hide local player mesh
    this.rendererHost.scene.add(this.player.group);
    this.worldCulling = new WorldCullingController(this.rendererHost.scene);
    this.zoneVisuals = new ZoneVisualController(this.rendererHost.scene);
    this.particles = new ParticleManager(getQualityPreset("high").particleMax);
    this.rendererHost.scene.add(this.particles.points);
    this.meshAudit = new MeshAuditHelper(this.rendererHost.scene);

    this.followCamera = new FollowCamera(this.rendererHost.camera);
    this.controls = new VirtualControls(
      document.body,
      this.rendererHost.renderer.domElement,
    );

    this.joinIntent = this.parseJoinIntent();
    this.multiplayer = new MultiplayerClient(this.resolveServerUrl(), {
      onConnected: (info) => {
        this.setPlayerCount(info.playerCount);
        this.ui.showToast(`Connected to room ${info.roomId}.`);
      },
      onDisconnected: () => {
        this.clearRemotePlayers();
        this.setPlayerCount(1);
        this.lastSentTransform = null;
        this.lastSentFishingState = "idle";
        this.sessionActive = true;
      },
      onPlayerCountChanged: (count) => {
        this.setPlayerCount(count);
      },
      onRemotePlayerUpdate: (snapshot) => {
        this.onRemotePlayerSnapshot(snapshot);
      },
      onRemotePlayerRemoved: (sessionId) => {
        this.removeRemotePlayer(sessionId);
      },
      onCelebration: ({ sessionId, rarity }) => {
        this.handleRemoteCelebration(sessionId, rarity);
      },
    });

    this.ui = new GameUI({
      onPlaySolo: this.handlePlaySolo,
      onPlayOnline: () => {
        void this.handlePlayOnline();
      },
      onInteractPressed: this.handleInteractPressed,
      onOpenBestiary: this.openBestiaryPanel,
      onOpenInventory: this.openInventoryPanel,
      onOpenShops: () => this.openShopPanel("rods"),
      onOpenQuests: this.openQuestsPanel,
      onOpenSettings: this.openSettingsPanel,
      onClosePanel: this.handleClosePanel,
      onCastNow: this.handleCastNow,
      onCancelFishingWait: this.handleCancelWait,
      onGiveUpFishing: this.handleGiveUpFishing,
      onRetryFishing: this.handleRetryFishing,
      onFishAgain: this.handleFishAgain,
      onOpenInventoryFromResult: this.openInventoryPanel,
      onOpenBestiaryFromResult: this.openBestiaryPanel,
      onEquipRod: this.handleEquipRod,
      onEquipBait: this.handleEquipBait,
      onBuyBait: this.handleBuyBait,
      onUpgradeInventory: this.handleUpgradeInventory,
      onSellSelected: this.handleSellSelected,
      onSellAll: this.handleSellAll,
      onCopyInviteLink: this.handleCopyInviteLink,
      onLeaveRoom: () => {
        void this.handleLeaveRoom();
      },
      onTrackQuest: this.handleTrackQuest,
      onClaimQuest: this.handleClaimQuest,
      onClearTrackedQuest: this.handleClearTrackedQuest,
      onResetSave: this.handleResetSave,
      onQuickSell: this.handleQuickSell,
      onUpdateSettings: this.handleUpdateSettings,
    });

    this.fishingSystem = new FishingSystem({
      onStateChanged: this.onFishingStateChanged,
      onBaitConsumeRequested: () => {
        const consumed = this.saveStore.consumeEquippedBait();
        if (consumed) {
          this.playSfx("bite");
          this.spawnBiteVfx();
        }
        this.ui.showToast(
          consumed ? "Bait consumed on bite." : "No bait left.",
        );
        return consumed;
      },
      onCatchResolved: ({ fish, success }) => {
        this.pendingFishingInventoryFull = false;
        if (success && fish) {
          const result = this.saveStore.addCatch(fish);
          this.pendingFishingInventoryFull = result.inventoryFull;
          this.ui.showToast(
            result.inventoryFull
              ? "Inventory full. Fish not stored."
              : `Caught ${fish.name}.`,
          );
          this.playSfx("catch");
          this.particles.spawnCatch(this.player.position.clone(), fish.rarity);
          if (fish.rarity === "mythic") {
            this.playSfx("rarity_stinger");
            this.particles.spawnCelebration(
              this.player.position.clone(),
              fish.rarity,
            );
            this.multiplayer.sendCelebration(
              fish.rarity as NetCelebrationRarity,
            );
          }
        } else {
          this.playSfx("fail");
          this.particles.spawnFail(this.player.position.clone());
        }
      },
    });

    const initialState = this.saveStore.getState();
    this.previousVolcanoUnlocked = isVolcanoUnlocked(initialState);
    this.previousOasisUnlocked = isOasisUnlocked(initialState);
    this.applySettings(initialSettings);
    this.zoneVisuals.setZone(this.currentZone);
    this.setPoiMarkersVisible(this.poiMarkersVisible);
    this.worldCulling.update(
      this.player.position,
      this.qualityPreset.worldCullDistance,
    );

    this.saveStore.subscribe((saveData) => {
      this.applySettings(saveData.settings);
      this.refreshHud(saveData);
      this.refreshOpenPanelsIfNeeded();
      this.applyVolcanoGateVisual();
      this.applyOasisGateVisual();
      this.applyCavePuzzleVisual();
      this.applyOasisChallengeVisual();
      this.syncChallengeStateFromSave();
      this.handleGateUnlockTransitions(saveData);
    });

    this.setPlayerCount(1);

    const initialMessage =
      this.joinIntent?.mode === "spectate"
        ? "Spectating is not supported. Use Play Online to join as a player."
        : undefined;
    this.ui.openSessionModeSelect(initialMessage);

    window.addEventListener("keydown", this.onDebugKeyDown);
    window.addEventListener("pointerdown", this.onFirstUserGesture, {
      passive: true,
    });
    window.addEventListener("keydown", this.onFirstUserGesture);
  }

  start(): void {
    if (this.mounted) {
      return;
    }
    this.mounted = true;
    this.rendererHost.start((dt) => this.update(dt));
  }

  private update(dtSeconds: number): void {
    const elapsedSeconds = this.rendererHost.getElapsedSeconds();
    this.fishingSystem.update(dtSeconds, this.ui.isMinigameHoldActive());

    for (const movingPlatform of this.world.movingPlatforms) {
      const offset =
        Math.sin(elapsedSeconds * movingPlatform.speed + movingPlatform.phase) *
        movingPlatform.amplitude;
      if (movingPlatform.axis === "x") {
        movingPlatform.mesh.position.x = movingPlatform.base + offset;
      } else {
        movingPlatform.mesh.position.z = movingPlatform.base + offset;
      }
    }

    const controlsEnabled =
      this.sessionActive && !this.ui.isGameplayInputBlocked();
    this.controls.setEnabled(controlsEnabled);

    const lookDelta = this.controls.consumeLookDelta();
    if (controlsEnabled) {
      const movementInput = this.controls.getMovementInput();
      this.player.update(
        dtSeconds,
        movementInput,
        this.followCamera.getYaw(),
        this.getActiveColliders(),
        this.world.worldBounds,
        this.world.getGroundHeight,
      );
      this.updateCurrentZone();
      this.updateNearestInteractable();
      this.updateTimedChallenge(dtSeconds);
      this.updateOasisFinalChallenge();
      this.syncLocalPlayerIfNeeded(dtSeconds);
    } else {
      this.currentInteractable = null;
      this.ui.setInteractPrompt(null);
    }

    for (const avatar of this.remotePlayers.values()) {
      avatar.update(dtSeconds);
    }

    this.followCamera.update(this.player.position, lookDelta, dtSeconds);
    this.zoneVisuals.update(dtSeconds, elapsedSeconds);
    this.particles.update(dtSeconds);
    this.worldCulling.update(
      this.player.position,
      this.qualityPreset.worldCullDistance,
    );

    const instantFps = 1 / Math.max(0.0001, dtSeconds);
    this.fpsEstimate = THREE.MathUtils.lerp(this.fpsEstimate, instantFps, 0.08);
    this.diagnosticsAccumulator += dtSeconds;
    if (this.diagnosticsAccumulator >= 0.2) {
      this.diagnosticsAccumulator = 0;
      this.diagnostics.update({
        fps: this.fpsEstimate,
        pingMs: null,
        playerCount: this.multiplayer.isConnected()
          ? this.onlinePlayerCount
          : 1,
        drawCalls: this.rendererHost.getDrawCalls(),
        zoneId: this.currentZone,
      });
    }
  }

  private updateCurrentZone(): void {
    const x = this.player.position.x;
    const z = this.player.position.z;
    let nextZone = this.currentZone;
    for (const region of this.world.zoneRegions) {
      if (
        x >= region.minX &&
        x <= region.maxX &&
        z >= region.minZ &&
        z <= region.maxZ
      ) {
        nextZone = region.zoneId;
        break;
      }
    }
    if (nextZone !== this.currentZone) {
      this.currentZone = nextZone;
      this.ui.showZoneHint(ZONE_LABELS[nextZone]);
      this.zoneVisuals.setZone(nextZone);
      if (this.audioUnlocked) {
        this.audio.setZoneAmbience(nextZone);
      }
      this.refreshHud(this.saveStore.getState());
    }
  }

  private updateNearestInteractable(): void {
    let closest: Interactable | null = null;
    let closestDistanceSq = Number.POSITIVE_INFINITY;

    for (const interactable of this.world.interactables) {
      const distanceSq = interactable.position.distanceToSquared(
        this.player.position,
      );
      if (distanceSq > interactable.radius * interactable.radius) {
        continue;
      }
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
        closest = interactable;
      }
    }

    this.currentInteractable = closest;
    this.ui.setInteractPrompt(closest ? closest.label : null);
  }

  private updateTimedChallenge(dtSeconds: number): void {
    if (!this.activeTimedChallenge) {
      return;
    }

    this.activeTimedChallenge.timeLeft -= dtSeconds;
    if (this.activeTimedChallenge.timeLeft <= 0) {
      const zone = this.activeTimedChallenge.zone;
      this.activeTimedChallenge = null;
      this.ui.showToast(`${ZONE_LABELS[zone]} challenge failed. Time expired.`);
      return;
    }

    const pos = this.player.position;
    for (const rect of this.activeTimedChallenge.hazardRects) {
      if (
        pos.x >= rect.minX &&
        pos.x <= rect.maxX &&
        pos.z >= rect.minZ &&
        pos.z <= rect.maxZ
      ) {
        this.player.position.copy(this.activeTimedChallenge.checkpoint);
        this.ui.showToast("Challenge reset to checkpoint.");
        break;
      }
    }

    const distanceToGoal = pos.distanceTo(this.activeTimedChallenge.goal);
    if (distanceToGoal <= CHALLENGE_GOAL_RADIUS) {
      const zone = this.activeTimedChallenge.zone;
      this.activeTimedChallenge = null;
      this.completeChallenge(zone);
    }
  }

  private onFishingStateChanged = (snapshot: FishingSnapshot): void => {
    this.ui.applyFishingState(snapshot);
    this.broadcastFishingState(snapshot.state);

    if (snapshot.state === "ready") {
      this.openFishingReadyPanel(snapshot.failureReason);
    }

    if (
      snapshot.state === "result_success" ||
      snapshot.state === "result_fail"
    ) {
      this.ui.openFishingResult({
        success: snapshot.state === "result_success",
        fishName: snapshot.currentFish?.name ?? null,
        fishRarity: snapshot.currentFish?.rarity ?? null,
        reason: snapshot.failureReason,
        inventoryFull: this.pendingFishingInventoryFull,
      });
    }
  };

  private openFishingReadyPanel(failureHint: string | null): void {
    const rod = this.saveStore.getEquippedRod();
    const bait = this.saveStore.getEquippedBait();
    const baitQuantity = this.saveStore.getBaitQuantity(bait.id);
    const zoneBonusFactor = computeZoneBonusFactor(
      rod,
      this.activeFishingSpot?.zoneId ?? this.currentZone,
    );
    const zoneBonusPercent = Math.max(
      0,
      Math.round((zoneBonusFactor - 1) * 100),
    );
    this.ui.openFishingReady({
      spotName: this.activeFishingSpot?.title ?? "Fishing Spot",
      rodName: rod.name,
      rodLuck: rod.luck,
      rodSturdiness: rod.sturdiness,
      baitName: bait.name,
      baitQuantity,
      zoneBonusPercent,
      zoneBonusActive: zoneBonusFactor > 1,
      failureHint,
    });
  }

  private handlePlaySolo = (): void => {
    this.playSfx("ui_click");
    this.sessionActive = true;
    this.ui.closePanel();
    this.setPlayerCount(1);
    void this.multiplayer.leave();
    this.clearRemotePlayers();
    this.ui.showToast("Playing solo.");
  };

  private async handlePlayOnline(): Promise<void> {
    this.playSfx("ui_click");
    const intent = this.joinIntent ?? { mode: "join" as const };
    const roomId = intent.roomId;
    const firestoreGameId = intent.firestoreGameId ?? intent.inviteCode;
    const inviteCode = intent.inviteCode;

    try {
      if (intent.mode === "spectate") {
        try {
          await this.multiplayer.connect({
            roomId,
            firestoreGameId,
            inviteCode,
            mode: "spectate",
          });
        } catch {
          this.ui.showToast("Spectating not supported. Joining as player.");
          await this.multiplayer.connect({
            roomId,
            firestoreGameId,
            inviteCode,
            mode: "join",
          });
        }
      } else {
        await this.multiplayer.connect({
          roomId,
          firestoreGameId,
          inviteCode,
          mode: intent.mode,
        });
      }

      this.sessionActive = true;
      this.ui.closePanel();
      this.refreshHud(this.saveStore.getState());
    } catch (error) {
      const message = this.readableJoinError(
        error instanceof Error ? error.message : "Join failed.",
      );
      this.sessionActive = true;
      this.setPlayerCount(1);
      this.clearRemotePlayers();
      this.ui.closePanel();
      this.ui.showToast(`Online unavailable: ${message} Solo mode active.`);
    }
  }

  private handleInteractPressed = (): void => {
    if (!this.currentInteractable) {
      return;
    }

    const interactable = this.currentInteractable;
    switch (interactable.type) {
      case "fishing_spot":
        this.activeFishingSpot = interactable;
        this.fishingSystem.openReady();
        this.openFishingReadyPanel(null);
        break;
      case "sell_stand":
        this.openSellStandPanel();
        break;
      case "rod_shop":
        this.openShopPanel("rods");
        break;
      case "bait_shop":
        this.openShopPanel("bait");
        break;
      case "gate":
        this.openGateInfo(interactable.id);
        break;
      case "quest_board":
        this.openQuestsPanel();
        break;
      case "npc_hint":
        this.openNpcHint(interactable.id);
        break;
      case "zone_rod_pickup":
        this.tryCollectZoneRod(interactable.id);
        break;
      case "challenge_start":
        this.startChallenge(interactable.id);
        break;
      case "puzzle_pillar":
        this.rotateCavePillar(interactable.id);
        break;
      case "relic_pickup":
        this.tryCollectRelic(interactable.id);
        break;
      default:
        break;
    }
  };

  private handleClosePanel = (): void => {
    this.ui.closePanel();
    this.fishingSystem.closeToIdle();
  };

  private handleCastNow = (): void => {
    const rod = this.saveStore.getEquippedRod();
    const bait = this.saveStore.getEquippedBait();
    const baitQuantity = this.saveStore.getBaitQuantity(bait.id);
    const zoneId = this.activeFishingSpot?.zoneId ?? this.currentZone;
    const fishPool = FISH_BY_ZONE[zoneId];
    const started = this.fishingSystem.startCast(
      rod,
      bait,
      fishPool,
      baitQuantity,
      zoneId,
    );
    if (started) {
      this.playSfx("cast");
      this.ui.showToast("Cast launched.");
    }
  };

  private handleCancelWait = (): void => {
    this.fishingSystem.cancelWaiting();
    this.openFishingReadyPanel(null);
  };

  private handleGiveUpFishing = (): void => {
    this.fishingSystem.giveUpMinigame();
  };

  private handleRetryFishing = (): void => {
    this.fishingSystem.retry();
    this.openFishingReadyPanel(null);
  };

  private handleFishAgain = (): void => {
    const inventoryFull =
      this.saveStore.getInventoryCount() >=
      this.saveStore.getInventoryCapacity();
    if (inventoryFull) {
      this.ui.showToast("Inventory full. Sell fish before casting again.");
      this.openSellStandPanel();
      return;
    }
    this.fishingSystem.retry();
    this.openFishingReadyPanel(null);
  };

  private openNpcHint(interactableId: string): void {
    const hint = NPC_HINTS[interactableId];
    if (!hint) {
      return;
    }
    this.ui.openHintDialog(hint.title, hint.body);
  }

  private openGateInfo(interactableId: string): void {
    if (interactableId === "oasis_gate") {
      const checklist = this.saveStore.getOasisChecklist();
      const view: GatePanelViewModel = {
        title: "Oasis Gate",
        description: "Catch 9 unique fish in Beach, River, Cave, and Volcano.",
        unlocked: checklist.unlocked,
        requirements: [
          {
            label: "Beach",
            current: checklist.beachUnique,
            required: checklist.required,
            met: checklist.beachUnique >= checklist.required,
          },
          {
            label: "River",
            current: checklist.riverUnique,
            required: checklist.required,
            met: checklist.riverUnique >= checklist.required,
          },
          {
            label: "Cave",
            current: checklist.caveUnique,
            required: checklist.required,
            met: checklist.caveUnique >= checklist.required,
          },
          {
            label: "Volcano",
            current: checklist.volcanoUnique,
            required: checklist.required,
            met: checklist.volcanoUnique >= checklist.required,
          },
        ],
        footer: checklist.unlocked
          ? "Gate open. Find 3 relics for the final rod."
          : undefined,
      };
      this.ui.openGatePanel(view);
      return;
    }

    const checklist = this.saveStore.getVolcanoChecklist();
    const view: GatePanelViewModel = {
      title: "Volcano Gate",
      description: "Catch 9 unique fish in Beach and River.",
      unlocked: checklist.unlocked,
      requirements: [
        {
          label: "Beach",
          current: checklist.beachUnique,
          required: checklist.required,
          met: checklist.beachUnique >= checklist.required,
        },
        {
          label: "River",
          current: checklist.riverUnique,
          required: checklist.required,
          met: checklist.riverUnique >= checklist.required,
        },
      ],
    };
    this.ui.openGatePanel(view);
  }

  private tryCollectRelic(interactableId: string): void {
    const relic = RELIC_PICKUP_MAP[interactableId];
    if (!relic) {
      return;
    }
    const result = this.saveStore.collectOasisRelic(relic.relicZone);
    if (result === "already_collected") {
      this.ui.showToast("Relic already collected.");
      return;
    }
    this.playSfx("pickup");
    this.ui.showToast(`Relic found: ${relic.name}.`);
    if (this.saveStore.areAllOasisRelicsCollected()) {
      this.ui.showToast(
        "All relics collected. Final Oasis challenge is ready.",
      );
    }
  }

  private tryCollectZoneRod(interactableId: string): void {
    const config =
      ZONE_ROD_PICKUP_MAP[interactableId as keyof typeof ZONE_ROD_PICKUP_MAP];
    if (!config) {
      return;
    }
    const result = this.saveStore.collectZoneRodPickup(
      config.pickupKey,
      config.rodId,
    );
    if (result === "granted") {
      this.playSfx("pickup");
      const rod = getRodById(config.rodId);
      this.ui.showToast(`New Rod Unlocked: ${this.getRodName(config.rodId)}.`);
      if (rod) {
        this.ui.openRodUnlock({
          rodId: rod.id,
          rodName: rod.name,
          luck: rod.luck,
          sturdiness: rod.sturdiness,
          zoneBonusText: rod.zonePassive
            ? `Zone passive: +${Math.round((rod.zonePassive.zoneLuckBonusMult - 1) * 100)}% luck in ${rod.zonePassive.zoneId}.`
            : null,
          sourceText: `${ZONE_LABELS[config.zone]} pickup`,
        });
      } else {
        this.openInventoryPanel();
      }
    } else if (result === "already_collected") {
      this.ui.showToast("Already collected.");
    } else {
      this.ui.showToast("Unable to claim rod.");
    }
  }

  private startChallenge(interactableId: string): void {
    if (interactableId === "beach_challenge_start") {
      if (this.saveStore.isChallengeCompleted("beach")) {
        this.ui.showToast("Beach challenge already completed.");
        return;
      }
      this.activeTimedChallenge = {
        zone: "beach",
        timeLeft: 45,
        checkpoint: new THREE.Vector3(-1.6, 0, 25.4),
        goal: new THREE.Vector3(8.1, 0, 27.3),
        hazardRects: [{ minX: -4.5, maxX: 10.2, minZ: 22.8, maxZ: 25.5 }],
      };
      this.player.position.copy(this.activeTimedChallenge.checkpoint);
      this.ui.showToast("Beach challenge started. Reach the chest.");
      return;
    }

    if (interactableId === "river_challenge_start") {
      if (this.saveStore.isChallengeCompleted("river")) {
        this.ui.showToast("River challenge already completed.");
        return;
      }
      this.activeTimedChallenge = {
        zone: "river",
        timeLeft: 55,
        checkpoint: new THREE.Vector3(39.8, 0, -2.3),
        goal: new THREE.Vector3(61.8, 0, -2.3),
        hazardRects: [{ minX: 40, maxX: 62.6, minZ: -6.7, maxZ: 1.5 }],
      };
      this.player.position.copy(this.activeTimedChallenge.checkpoint);
      this.ui.showToast("River challenge started. Cross the logs.");
      return;
    }

    if (interactableId === "cave_challenge_start") {
      if (this.saveStore.isChallengeCompleted("cave")) {
        this.ui.showToast("Cave challenge already completed.");
        return;
      }
      this.caveChallengeStarted = true;
      this.ui.showToast("Rotate all crystals to align the beam.");
      return;
    }

    if (interactableId === "volcano_challenge_start") {
      if (this.saveStore.isChallengeCompleted("volcano")) {
        this.ui.showToast("Volcano challenge already completed.");
        return;
      }
      this.activeTimedChallenge = {
        zone: "volcano",
        timeLeft: 65,
        checkpoint: new THREE.Vector3(35.8, 0, 88.9),
        goal: new THREE.Vector3(61.2, 0, 94.5),
        hazardRects: [{ minX: 37, maxX: 62.8, minZ: 90.2, maxZ: 98.8 }],
      };
      this.player.position.copy(this.activeTimedChallenge.checkpoint);
      this.ui.showToast(
        "Volcano challenge started. Cross vents and moving platforms.",
      );
      return;
    }

    if (interactableId === "oasis_challenge_start") {
      if (!this.saveStore.areAllOasisRelicsCollected()) {
        this.ui.showToast("Find 3 relics first: Beach, River, and Cave.");
        return;
      }
      if (this.saveStore.isChallengeCompleted("oasis")) {
        this.ui.showToast("Oasis challenge already completed.");
        return;
      }
      this.oasisFinalChallengeActive = true;
      this.activatedOasisPlates.clear();
      this.applyOasisChallengeVisual();
      this.ui.showToast(
        "Final challenge started. Activate all 3 pressure plates.",
      );
    }
  }

  private rotateCavePillar(interactableId: string): void {
    if (
      !this.caveChallengeStarted ||
      this.saveStore.isChallengeCompleted("cave")
    ) {
      this.ui.showToast("Start the cave challenge first.");
      return;
    }
    const pillar = this.world.puzzlePillars[interactableId];
    if (!pillar) {
      return;
    }
    this.cavePillarTurns[interactableId] =
      ((this.cavePillarTurns[interactableId] ?? 0) + 1) % 4;
    pillar.rotation.y = this.cavePillarTurns[interactableId] * (Math.PI / 2);
    this.ui.showToast(
      `${interactableId.replace("cave_pillar_", "Pillar ")} rotated.`,
    );

    const solved = Object.entries(CAVE_PUZZLE_TARGET).every(
      ([id, target]) => this.cavePillarTurns[id] === target,
    );
    if (solved) {
      this.completeChallenge("cave");
    }
  }

  private completeChallenge(zone: ChallengeZone): void {
    const newlyCompleted = this.saveStore.setChallengeCompleted(zone);
    this.caveChallengeStarted = false;
    if (zone === "oasis") {
      this.oasisFinalChallengeActive = false;
    }
    if (!newlyCompleted) {
      this.ui.showToast(`${ZONE_LABELS[zone]} challenge already completed.`);
      return;
    }

    const rewardRodId = CHALLENGE_ROD_BY_ZONE[zone];
    this.saveStore.unlockRod(rewardRodId);
    this.playSfx("pickup");
    const rewardRod = getRodById(rewardRodId);
    this.ui.showToast(
      `${ZONE_LABELS[zone]} challenge complete. Rod unlocked: ${this.getRodName(rewardRodId)}.`,
    );
    if (rewardRod) {
      this.ui.openRodUnlock({
        rodId: rewardRod.id,
        rodName: rewardRod.name,
        luck: rewardRod.luck,
        sturdiness: rewardRod.sturdiness,
        zoneBonusText: rewardRod.zonePassive
          ? `Zone passive: +${Math.round((rewardRod.zonePassive.zoneLuckBonusMult - 1) * 100)}% luck in ${rewardRod.zonePassive.zoneId}.`
          : null,
        sourceText: `${ZONE_LABELS[zone]} challenge reward`,
      });
    }

    if (zone === "cave") {
      this.cavePuzzleSolved = true;
      this.applyCavePuzzleVisual();
    }
    if (zone === "oasis") {
      this.applyOasisChallengeVisual();
    }
  }

  private openInventoryPanel = (): void => {
    this.ui.openInventory({
      fishItems: this.getFishInventoryViewModel(),
      rods: this.getRodsViewModel(),
      baits: this.getBaitsViewModel(),
      upgrades: this.getUpgradesViewModel(),
      inventoryCount: this.saveStore.getInventoryCount(),
      inventoryCapacity: this.saveStore.getInventoryCapacity(),
    });
  };

  private openBestiaryPanel = (): void => {
    const state = this.saveStore.getState();
    const zones: ZoneBestiaryViewModel[] = PLAYABLE_PHASE4_ZONES.map(
      (zoneId) => {
        const fishList = FISH_BY_ZONE[zoneId];
        const entries: BestiaryEntryViewModel[] = fishList.map((fish) => {
          const entry = state.bestiary[fish.id] ?? {
            discovered: false,
            caughtCount: 0,
          };
          return {
            fishId: fish.id,
            name: fish.name,
            rarity: fish.rarity,
            discovered: entry.discovered,
            caughtCount: entry.caughtCount,
          };
        });

        const progress = getZoneProgress(state, zoneId);
        return {
          zoneId,
          zoneName: ZONE_LABELS[zoneId],
          entries,
          discoveredUnique: progress.discoveredUnique,
          total: progress.total,
          percent: progress.percent,
        };
      },
    );

    const initialZone: ZoneId = PLAYABLE_PHASE4_ZONES.includes(this.currentZone)
      ? this.currentZone
      : "beach";
    this.ui.openBestiary(
      zones,
      this.saveStore.getVolcanoChecklist(),
      this.saveStore.getOasisChecklist(),
      this.saveStore.getState().oasisRelics,
      initialZone,
    );
  };

  private openQuestsPanel = (): void => {
    this.ui.openQuests(this.getQuestViewModels());
  };

  private openShopPanel = (initialTab: "rods" | "bait"): void => {
    this.ui.openShops(
      {
        rods: this.getRodsViewModel(),
        baits: this.getBaitsViewModel(),
        gold: this.saveStore.getState().gold,
      },
      initialTab,
    );
  };

  private openSellStandPanel = (): void => {
    this.ui.openSellStand({
      fishItems: this.getFishInventoryViewModel(),
      inventoryCount: this.saveStore.getInventoryCount(),
      inventoryCapacity: this.saveStore.getInventoryCapacity(),
    });
  };

  private openSettingsPanel = (): void => {
    this.playSfx("ui_click");
    this.ui.openSettings(this.getSettingsViewModel());
  };

  private handleEquipRod = (rodId: string): void => {
    const ok = this.saveStore.equipRod(rodId);
    if (ok) {
      this.playSfx("ui_click");
    }
    this.ui.showToast(ok ? "Rod equipped." : "Rod is locked.");
  };

  private handleEquipBait = (baitId: string): void => {
    const ok = this.saveStore.equipBait(baitId);
    if (ok) {
      this.playSfx("ui_click");
    }
    this.ui.showToast(ok ? "Bait equipped." : "Cannot equip bait.");
  };

  private handleBuyBait = (baitId: string, quantity: number): void => {
    if (!this.isBaitAvailableForPurchase(baitId)) {
      this.ui.showToast("This bait is locked.");
      return;
    }
    const result = this.saveStore.buyBait(baitId, quantity);
    if (result.ok) {
      this.playSfx("purchase");
    }
    this.ui.showToast(
      result.ok ? `Bought ${quantity} bait.` : "Not enough gold.",
    );
  };

  private handleUpgradeInventory = (): void => {
    const result = this.saveStore.purchaseNextInventoryUpgrade();
    if (result.ok) {
      this.playSfx("purchase");
      const newCapacity = INVENTORY_CAPACITY_BY_LEVEL[result.newLevel] ?? 0;
      this.ui.showToast(`Inventory upgraded to ${newCapacity}.`);
    } else {
      this.ui.showToast("Upgrade not available.");
    }
  };

  private handleSellSelected = (fishIds: string[]): void => {
    if (fishIds.length > 0 && this.containsRareOrHigherFishIds(fishIds)) {
      const confirmed = window.confirm(
        "Sell selected fish including Rare+ catches?",
      );
      if (!confirmed) {
        return;
      }
    }
    const result = this.saveStore.sellFish(fishIds, this.partyGoldMultiplier);
    if (result.soldCount <= 0) {
      this.ui.showToast("No fish selected.");
      return;
    }
    const bonusText =
      result.multiplierApplied > 1
        ? ` (+${Math.round((result.multiplierApplied - 1) * 100)}% party)`
        : "";
    this.playSfx("sell");
    this.ui.showToast(
      `Sold ${result.soldCount} fish for ${toGold(result.earnedGold)}${bonusText}.`,
    );
    this.openSellStandPanel();
  };

  private handleSellAll = (): void => {
    if (this.containsRareOrHigherInventory()) {
      const confirmed = window.confirm(
        "Sell all includes Rare+ fish. Continue?",
      );
      if (!confirmed) {
        return;
      }
    }
    const result = this.saveStore.sellAllFish(this.partyGoldMultiplier);
    if (result.soldCount <= 0) {
      this.ui.showToast("No fish to sell.");
      return;
    }
    const bonusText =
      result.multiplierApplied > 1
        ? ` (+${Math.round((result.multiplierApplied - 1) * 100)}% party)`
        : "";
    this.playSfx("sell");
    this.ui.showToast(
      `Sold all (${result.soldCount}) for ${toGold(result.earnedGold)}${bonusText}.`,
    );
    this.openSellStandPanel();
  };

  private handleQuickSell = (
    mode: "commons" | "commons_uncommons" | "keep_rares",
  ): void => {
    const fishIds = this.getQuickSellFishIds(mode);
    if (fishIds.length === 0) {
      this.ui.showToast("No fish match this quick sell filter.");
      return;
    }
    const result = this.saveStore.sellFish(fishIds, this.partyGoldMultiplier);
    if (result.soldCount <= 0) {
      this.ui.showToast("No fish sold.");
      return;
    }
    const bonusText =
      result.multiplierApplied > 1
        ? ` (+${Math.round((result.multiplierApplied - 1) * 100)}% party)`
        : "";
    this.playSfx("sell");
    this.ui.showToast(
      `Quick sold ${result.soldCount} fish for ${toGold(result.earnedGold)}${bonusText}.`,
    );
    this.openSellStandPanel();
  };

  private handleUpdateSettings = (settings: SettingsViewModel): void => {
    this.saveStore.updateSettings(settings);
  };

  private handleTrackQuest = (questId: string): void => {
    if (this.saveStore.isQuestCompleted(questId)) {
      this.ui.showToast("Quest already completed.");
      return;
    }
    this.saveStore.setActiveQuest(questId);
    this.ui.showToast("Quest tracked.");
    this.openQuestsPanel();
  };

  private handleClaimQuest = (questId: string): void => {
    const quest = getQuestById(questId);
    if (!quest) {
      return;
    }
    if (this.saveStore.isQuestCompleted(questId)) {
      this.ui.showToast("Quest already claimed.");
      return;
    }
    const progress = getQuestProgress(quest, this.saveStore.getState());
    if (!progress.completed) {
      this.ui.showToast("Quest requirements not met yet.");
      return;
    }

    this.saveStore.completeQuest(questId);
    if (quest.reward.goldAmount) {
      this.saveStore.addGold(quest.reward.goldAmount);
    }
    if (quest.reward.baitPack) {
      this.saveStore.addBait(
        quest.reward.baitPack.baitType,
        quest.reward.baitPack.quantity,
      );
    }
    this.playSfx("purchase");
    this.ui.showToast(`Quest complete: ${quest.title}`);
    this.openQuestsPanel();
  };

  private handleClearTrackedQuest = (): void => {
    this.saveStore.clearActiveQuest();
    this.ui.showToast("Quest untracked.");
    this.openQuestsPanel();
  };

  private handleCopyInviteLink = (): void => {
    const info = this.multiplayer.getConnectionInfo();
    if (!info?.roomId) {
      this.ui.showToast("No active room.");
      return;
    }

    const handledByNative = this.postNativeMessage("copy_invite_link", {
      roomId: info.roomId,
    });
    if (handledByNative) {
      this.ui.showToast("Invite details sent to app.");
      return;
    }

    const invite = `${window.location.origin}?roomId=${encodeURIComponent(info.roomId)}&mode=join`;
    this.playSfx("ui_click");
    navigator.clipboard
      .writeText(invite)
      .then(() => this.ui.showToast("Invite link copied."))
      .catch(() => this.ui.showToast("Unable to copy invite link."));
  };

  private async handleLeaveRoom(): Promise<void> {
    await this.multiplayer.leave();
    this.clearRemotePlayers();
    this.setPlayerCount(1);
    this.sessionActive = true;
    this.playSfx("ui_click");
    this.ui.showToast("Left room. Solo mode active.");
  }

  private handleResetSave = (): void => {
    const confirmed = window.confirm(
      "Reset local save data? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }
    this.saveStore.replaceFromReset();
    this.fishingSystem.closeToIdle();
    this.activeTimedChallenge = null;
    this.caveChallengeStarted = false;
    this.cavePuzzleSolved = false;
    this.oasisFinalChallengeActive = false;
    this.activatedOasisPlates.clear();
    this.cavePillarTurns = {
      cave_pillar_a: 0,
      cave_pillar_b: 0,
      cave_pillar_c: 0,
    };
    this.resetPuzzleMeshRotations();
    this.ui.closePanel();
    this.applyVolcanoGateVisual();
    this.applyOasisGateVisual();
    this.applyCavePuzzleVisual();
    this.applyOasisChallengeVisual();
    this.ui.showToast("Save reset.");
  };

  private refreshHud(saveData: SaveData): void {
    const rod = this.saveStore.getEquippedRod();
    const bait = this.saveStore.getEquippedBait();
    const zoneBonusFactor = computeZoneBonusFactor(rod, this.currentZone);
    this.ui.setHud({
      gold: saveData.gold,
      inventoryCount: this.saveStore.getInventoryCount(),
      inventoryCapacity: this.saveStore.getInventoryCapacity(),
      equippedRodName: rod.name,
      equippedRodLuck: rod.luck,
      equippedRodSturdiness: rod.sturdiness,
      equippedBaitName: bait.name,
      equippedBaitQuantity: this.saveStore.getBaitQuantity(bait.id),
      partyBonusPercent: Math.round((this.partyGoldMultiplier - 1) * 100),
      zoneBonusActive: zoneBonusFactor > 1,
      zoneBonusPercent: Math.max(0, Math.round((zoneBonusFactor - 1) * 100)),
    });

    const inventoryCount = this.saveStore.getInventoryCount();
    const inventoryCapacity = this.saveStore.getInventoryCapacity();
    const fillRatio =
      inventoryCapacity > 0 ? inventoryCount / inventoryCapacity : 0;
    if (inventoryCount >= inventoryCapacity) {
      this.ui.setInventoryHint("Inventory full. Visit a sell stand.");
    } else if (fillRatio >= NEAR_FULL_THRESHOLD) {
      this.ui.setInventoryHint("Inventory nearly full. Sell soon.");
    } else {
      this.ui.setInventoryHint(null);
    }

    const info = this.multiplayer.getConnectionInfo();
    this.ui.setOnlineStatus({
      connected: this.multiplayer.isConnected(),
      roomId: info?.roomId ?? null,
      playerCount: this.multiplayer.isConnected() ? this.onlinePlayerCount : 1,
      playerCap: PLAYER_CAP,
      partyBonusPercent: Math.round((this.partyGoldMultiplier - 1) * 100),
    });
  }

  private refreshOpenPanelsIfNeeded(): void {
    if (!this.ui.isGameplayInputBlocked()) {
      return;
    }
    const fishingState = this.fishingSystem.getSnapshot().state;
    if (fishingState === "ready") {
      this.openFishingReadyPanel(null);
    }
  }

  private getFishInventoryViewModel(): FishInventoryItemViewModel[] {
    const state = this.saveStore.getState();
    const fishItems: FishInventoryItemViewModel[] = [];
    for (const [fishId, count] of Object.entries(state.fishInventory)) {
      const fish = ALL_FISH_BY_ID[fishId];
      if (!fish || count <= 0) {
        continue;
      }
      fishItems.push({
        fishId,
        name: fish.name,
        zoneId: fish.zone,
        rarity: fish.rarity,
        count,
        sellPrice: fish.sellPrice,
        lastCaughtAt: state.bestiary[fishId]?.lastCaughtAt ?? 0,
      });
    }

    fishItems.sort((a, b) => {
      const rarityDiff = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      if (rarityDiff !== 0) {
        return rarityDiff;
      }
      return a.name.localeCompare(b.name);
    });
    return fishItems;
  }

  private getRodsViewModel(): RodViewModel[] {
    const state = this.saveStore.getState();
    return ROD_DEFINITIONS.map((rod) => {
      const zoneBonusFactor = computeZoneBonusFactor(rod, this.currentZone);
      return {
        id: rod.id,
        name: rod.name,
        luck: rod.luck,
        sturdiness: rod.sturdiness,
        price: rod.price,
        source: rod.source,
        owned: state.ownedRods.includes(rod.id),
        phaseLocked: Boolean(rod.phaseLocked),
        zoneBonusPercent: rod.zonePassive
          ? Math.max(
              0,
              Math.round((rod.zonePassive.zoneLuckBonusMult - 1) * 100),
            )
          : 0,
        zoneBonusZoneId: rod.zonePassive?.zoneId ?? null,
        zoneBonusActive: rod.id === state.equippedRodId && zoneBonusFactor > 1,
      };
    });
  }

  private getBaitsViewModel(): BaitViewModel[] {
    return BAIT_DEFINITIONS.map((bait) => {
      const purchasableNow = this.isBaitAvailableForPurchase(bait.id);
      return {
        id: bait.id,
        name: bait.name,
        luckMultiplier: bait.luckMultiplier,
        price: bait.price,
        quantity: this.saveStore.getBaitQuantity(bait.id),
        purchasable: purchasableNow,
        phaseLocked: !purchasableNow,
      };
    });
  }

  private getUpgradesViewModel(): UpgradeViewModel[] {
    const level = this.saveStore.getState().inventoryCapacityLevel;
    return INVENTORY_CAPACITY_BY_LEVEL.slice(1).map((capacity, index) => {
      const targetLevel = index + 1;
      const status: UpgradeViewModel["status"] =
        targetLevel <= level
          ? "owned"
          : targetLevel === level + 1
            ? "available"
            : "locked";
      return {
        level: targetLevel,
        capacity,
        cost: INVENTORY_UPGRADE_COST_BY_LEVEL[index] ?? 0,
        status,
      };
    });
  }

  private getQuestViewModels(): QuestViewModel[] {
    const save = this.saveStore.getState();
    const activeId = save.quests.activeQuestId;

    return QUEST_DEFINITIONS.map((quest) => {
      const progress = getQuestProgress(quest, save);
      const completed = save.quests.completedQuestIds.includes(quest.id);

      let status: QuestViewModel["status"] = "available";
      if (completed) {
        status = "completed";
      } else if (progress.completed) {
        status = "claimable";
      } else if (activeId === quest.id) {
        status = "active";
      }

      const rewardParts: string[] = [];
      if (quest.reward.goldAmount) {
        rewardParts.push(`${quest.reward.goldAmount}g`);
      }
      if (quest.reward.baitPack) {
        rewardParts.push(
          `${quest.reward.baitPack.quantity} ${quest.reward.baitPack.baitType} bait`,
        );
      }

      return {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        hint: quest.hint,
        progressText: `${progress.current}/${progress.target}`,
        status,
        rewardText: rewardParts.join(" + ") || "-",
      };
    });
  }

  private getSettingsViewModel(): SettingsViewModel {
    const settings = this.saveStore.getSettings();
    return {
      masterVolume: settings.masterVolume,
      sfxVolume: settings.sfxVolume,
      musicVolume: settings.musicVolume,
      muted: settings.muted,
      graphicsQuality: settings.graphicsQuality,
      showDiagnostics: settings.showDiagnostics,
      meshAuditEnabled: settings.meshAuditEnabled,
      decayGraceEnabled: settings.decayGraceEnabled,
    };
  }

  private isBaitAvailableForPurchase(baitId: string): boolean {
    const state = this.saveStore.getState();
    if (
      baitId === "normal" ||
      baitId === "quality" ||
      baitId === "beach" ||
      baitId === "river" ||
      baitId === "cave"
    ) {
      return true;
    }
    if (baitId === "volcano") {
      return isVolcanoUnlocked(state);
    }
    if (baitId === "oasis") {
      return isOasisUnlocked(state);
    }
    return false;
  }

  private syncLocalPlayerIfNeeded(dtSeconds: number): void {
    if (!this.multiplayer.isConnected()) {
      return;
    }
    this.syncAccumulator += dtSeconds;
    if (this.syncAccumulator < LOCAL_SYNC_INTERVAL_SECONDS) {
      return;
    }
    this.syncAccumulator = 0;

    const current: TransformSnapshot = {
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
      yaw: this.player.group.rotation.y,
    };

    if (this.lastSentTransform) {
      const dx = current.x - this.lastSentTransform.x;
      const dy = current.y - this.lastSentTransform.y;
      const dz = current.z - this.lastSentTransform.z;
      const distance = Math.hypot(dx, dy, dz);
      const yawDiff = Math.abs(current.yaw - this.lastSentTransform.yaw);
      if (distance < POSITION_EPSILON && yawDiff < YAW_EPSILON) {
        return;
      }
    }

    this.lastSentTransform = current;
    const animState =
      this.player.getHorizontalSpeed() > 0.2 ? "moving" : "idle";
    this.multiplayer.sendTransform({ ...current, animState });
  }

  private broadcastFishingState(state: FishingSnapshot["state"]): void {
    const netState = toNetFishingState(state);
    if (netState === this.lastSentFishingState) {
      return;
    }
    this.lastSentFishingState = netState;
    this.multiplayer.sendFishingState(netState);
  }

  private onRemotePlayerSnapshot(snapshot: RemotePlayerSnapshot): void {
    const localSessionId = this.multiplayer.getConnectionInfo()?.sessionId;
    if (snapshot.sessionId === localSessionId) {
      return;
    }

    let avatar = this.remotePlayers.get(snapshot.sessionId);
    if (!avatar) {
      avatar = new RemotePlayerAvatar(
        new THREE.Vector3(snapshot.x, snapshot.y, snapshot.z),
      );
      this.remotePlayers.set(snapshot.sessionId, avatar);
      this.rendererHost.scene.add(avatar.group);
    }
    avatar.setTarget(snapshot.x, snapshot.y, snapshot.z, snapshot.yaw);
    avatar.setFishingState(snapshot.fishingState);
  }

  private removeRemotePlayer(sessionId: string): void {
    const avatar = this.remotePlayers.get(sessionId);
    if (!avatar) {
      return;
    }
    avatar.dispose();
    this.rendererHost.scene.remove(avatar.group);
    this.remotePlayers.delete(sessionId);
  }

  private clearRemotePlayers(): void {
    for (const [sessionId] of this.remotePlayers) {
      this.removeRemotePlayer(sessionId);
    }
  }

  private setPlayerCount(count: number): void {
    const clamped = Math.max(1, Math.min(PLAYER_CAP, count));
    this.onlinePlayerCount = clamped;
    this.partyGoldMultiplier = this.multiplayer.isConnected()
      ? 1 + 0.05 * (clamped - 1)
      : 1;
    this.refreshHud(this.saveStore.getState());
    this.postNativeMessage("online_status", {
      roomId: this.multiplayer.getConnectionInfo()?.roomId ?? null,
      playerCount: this.multiplayer.isConnected() ? clamped : 1,
    });
  }

  private postNativeMessage(
    type: string,
    payload: Record<string, unknown>,
  ): boolean {
    const bridge = window.ReactNativeWebView;
    if (!bridge || typeof bridge.postMessage !== "function") {
      return false;
    }
    try {
      bridge.postMessage(
        JSON.stringify({
          source: "tropical_fishing",
          type,
          ...payload,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private applyVolcanoGateVisual(): void {
    const unlocked = isVolcanoUnlocked(this.saveStore.getState());
    const doorMaterial = this.world.volcanoGateDoor
      .material as THREE.MeshStandardMaterial;
    const signMaterial = this.world.volcanoGateSign
      .material as THREE.MeshStandardMaterial;

    this.world.volcanoGateDoor.position.y = unlocked ? 6.1 : 2.1;
    doorMaterial.color.set(unlocked ? "#166534" : "#7f1d1d");
    signMaterial.color.set(unlocked ? "#86efac" : "#fca5a5");
    doorMaterial.needsUpdate = true;
    signMaterial.needsUpdate = true;
  }

  private applyOasisGateVisual(): void {
    const save = this.saveStore.getState();
    const checklist = getOasisChecklist(save);
    const unlocked = checklist.unlocked;
    const doorMaterial = this.world.oasisGateDoor
      .material as THREE.MeshStandardMaterial;
    this.world.oasisGateDoor.position.y = unlocked ? 6.4 : 2.2;
    doorMaterial.color.set(unlocked ? "#166534" : "#7f1d1d");
    doorMaterial.needsUpdate = true;

    const emblemStates: Record<
      "beach" | "river" | "cave" | "volcano",
      boolean
    > = {
      beach: checklist.beachUnique >= checklist.required,
      river: checklist.riverUnique >= checklist.required,
      cave: checklist.caveUnique >= checklist.required,
      volcano: checklist.volcanoUnique >= checklist.required,
    };

    for (const [zoneKey, mesh] of Object.entries(
      this.world.oasisGateEmblems,
    ) as Array<["beach" | "river" | "cave" | "volcano", THREE.Mesh]>) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set(emblemStates[zoneKey] ? "#22c55e" : "#7f1d1d");
      material.needsUpdate = true;
    }
  }

  private syncChallengeStateFromSave(): void {
    this.cavePuzzleSolved = this.saveStore.isChallengeCompleted("cave");
    if (this.saveStore.isChallengeCompleted("oasis")) {
      this.oasisFinalChallengeActive = false;
      this.activatedOasisPlates.clear();
      (Object.keys(this.world.oasisChallengePlates) as OasisPlateId[]).forEach(
        (plateId) => {
          this.activatedOasisPlates.add(plateId);
        },
      );
      return;
    }
    if (!this.oasisFinalChallengeActive) {
      this.activatedOasisPlates.clear();
    }
  }

  private applyCavePuzzleVisual(): void {
    const doorMaterial = this.world.cavePuzzleDoor
      .material as THREE.MeshStandardMaterial;
    this.world.cavePuzzleDoor.position.y = this.cavePuzzleSolved ? 5.2 : 1.6;
    doorMaterial.color.set(this.cavePuzzleSolved ? "#166534" : "#b91c1c");
    doorMaterial.needsUpdate = true;
  }

  private applyOasisChallengeVisual(): void {
    const completed = this.saveStore.isChallengeCompleted("oasis");
    const active = this.oasisFinalChallengeActive;
    const doorMaterial = this.world.oasisFinalDoor
      .material as THREE.MeshStandardMaterial;
    this.world.oasisFinalDoor.position.y = completed ? 5.8 : 1.8;
    doorMaterial.color.set(completed ? "#166534" : "#9f1239");
    doorMaterial.needsUpdate = true;

    for (const [plateId, mesh] of Object.entries(
      this.world.oasisChallengePlates,
    ) as Array<[OasisPlateId, THREE.Mesh]>) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const activePlate = this.activatedOasisPlates.has(plateId);
      material.color.set(
        activePlate ? "#22c55e" : active ? "#facc15" : "#a1a1aa",
      );
      material.needsUpdate = true;
      mesh.position.y = activePlate ? 0.06 : 0.1;
    }
  }

  private updateOasisFinalChallenge(): void {
    if (
      !this.oasisFinalChallengeActive ||
      this.saveStore.isChallengeCompleted("oasis")
    ) {
      return;
    }
    for (const [plateId, rect] of Object.entries(OASIS_PLATE_RECT) as Array<
      [OasisPlateId, Rect]
    >) {
      if (this.activatedOasisPlates.has(plateId)) {
        continue;
      }
      const pos = this.player.position;
      if (
        pos.x >= rect.minX &&
        pos.x <= rect.maxX &&
        pos.z >= rect.minZ &&
        pos.z <= rect.maxZ
      ) {
        this.activatedOasisPlates.add(plateId);
        this.applyOasisChallengeVisual();
        this.ui.showToast(
          `Pressure plate ${plateId.replace("oasis_plate_", "").toUpperCase()} activated.`,
        );
      }
    }

    if (this.activatedOasisPlates.size >= 3) {
      this.completeChallenge("oasis");
    }
  }

  private getActiveColliders(): BoxCollider[] {
    const save = this.saveStore.getState();
    const active = [...this.world.colliders];
    if (!isVolcanoUnlocked(save)) {
      active.push(this.world.volcanoGateCollider);
    }
    if (!isOasisUnlocked(save)) {
      active.push(this.world.oasisGateCollider);
    }
    if (!this.saveStore.isChallengeCompleted("oasis")) {
      active.push(this.world.oasisFinalDoorCollider);
    }
    return active;
  }

  private resetPuzzleMeshRotations(): void {
    for (const [pillarId, mesh] of Object.entries(this.world.puzzlePillars)) {
      const turns = this.cavePillarTurns[pillarId] ?? 0;
      mesh.rotation.y = turns * (Math.PI / 2);
    }
  }

  private applySettings(settings: SaveData["settings"]): void {
    const signature = [
      settings.masterVolume,
      settings.sfxVolume,
      settings.musicVolume,
      settings.muted,
      settings.graphicsQuality,
      settings.showDiagnostics,
      settings.meshAuditEnabled,
      settings.decayGraceEnabled,
    ].join("|");
    if (signature === this.appliedSettingsSignature) {
      return;
    }
    this.appliedSettingsSignature = signature;

    const preset = getQualityPreset(settings.graphicsQuality);
    const qualityChanged = preset.id !== this.qualityPreset.id;
    this.qualityPreset = preset;
    if (qualityChanged) {
      this.rendererHost.applyQuality(this.qualityPreset);
    }

    this.particles.setBudget(this.qualityPreset.particleMax);
    this.particles.setEnabled(this.qualityPreset.vfxEnabled);
    this.audio.applySettings({
      masterVolume: settings.masterVolume,
      sfxVolume: settings.sfxVolume,
      musicVolume: settings.musicVolume,
      muted: settings.muted,
    });
    this.diagnostics.setVisible(settings.showDiagnostics);
    this.meshAudit.setEnabled(settings.meshAuditEnabled);
    this.fishingSystem.setDecayGraceEnabled(settings.decayGraceEnabled);
  }

  private setPoiMarkersVisible(visible: boolean): void {
    this.poiMarkersVisible = visible;
    this.rendererHost.scene.traverse((obj) => {
      if (obj.userData.poiMarker) {
        obj.visible = visible;
      }
    });
  }

  private handleGateUnlockTransitions(saveData: SaveData): void {
    const volcanoUnlocked = isVolcanoUnlocked(saveData);
    if (volcanoUnlocked && !this.previousVolcanoUnlocked) {
      this.playSfx("gate_unlock");
      this.ui.showToast("Volcano gate unlocked.");
    }
    this.previousVolcanoUnlocked = volcanoUnlocked;

    const oasisUnlocked = isOasisUnlocked(saveData);
    if (oasisUnlocked && !this.previousOasisUnlocked) {
      this.playSfx("gate_unlock");
      this.ui.showToast("Oasis gate unlocked.");
    }
    this.previousOasisUnlocked = oasisUnlocked;
  }

  private handleRemoteCelebration(
    sessionId: string,
    rarity: NetCelebrationRarity,
  ): void {
    const localSessionId = this.multiplayer.getConnectionInfo()?.sessionId;
    if (sessionId === localSessionId) {
      return;
    }
    const avatar = this.remotePlayers.get(sessionId);
    if (!avatar) {
      return;
    }
    avatar.triggerCelebration(rarity);
    this.particles.spawnCelebration(avatar.group.position.clone(), rarity);
  }

  private getQuickSellFishIds(
    mode: "commons" | "commons_uncommons" | "keep_rares",
  ): string[] {
    const fishIds: string[] = [];
    for (const [fishId, count] of Object.entries(
      this.saveStore.getState().fishInventory,
    )) {
      const fish = ALL_FISH_BY_ID[fishId];
      if (!fish || count <= 0) {
        continue;
      }
      const sellable =
        fish.rarity === "common" ||
        ((mode === "commons_uncommons" || mode === "keep_rares") &&
          fish.rarity === "uncommon");
      if (!sellable) {
        continue;
      }
      for (let i = 0; i < count; i += 1) {
        fishIds.push(fishId);
      }
    }
    return fishIds;
  }

  private containsRareOrHigherInventory(): boolean {
    for (const [fishId, count] of Object.entries(
      this.saveStore.getState().fishInventory,
    )) {
      if (count <= 0) {
        continue;
      }
      const fish = ALL_FISH_BY_ID[fishId];
      if (!fish) {
        continue;
      }
      if (RARITY_ORDER[fish.rarity] >= RARITY_ORDER.rare) {
        return true;
      }
    }
    return false;
  }

  private containsRareOrHigherFishIds(fishIds: string[]): boolean {
    for (const fishId of fishIds) {
      const fish = ALL_FISH_BY_ID[fishId];
      if (!fish) {
        continue;
      }
      if (RARITY_ORDER[fish.rarity] >= RARITY_ORDER.rare) {
        return true;
      }
    }
    return false;
  }

  private spawnBiteVfx(): void {
    const position = this.activeFishingSpot?.position ?? this.player.position;
    this.particles.spawnBite(position.clone());
  }

  private playSfx(id: SoundEventId): void {
    if (!this.audioUnlocked) {
      return;
    }
    this.audio.playSfx(id);
  }

  private async unlockAudio(): Promise<void> {
    if (this.audioUnlocked) {
      return;
    }
    const unlocked = await this.audio.unlockByGesture();
    if (!unlocked) {
      return;
    }
    this.audioUnlocked = true;
    this.audio.applySettings(this.saveStore.getSettings());
    this.audio.setZoneAmbience(this.currentZone);
    window.removeEventListener("pointerdown", this.onFirstUserGesture);
    window.removeEventListener("keydown", this.onFirstUserGesture);
  }

  private parseJoinIntent(): JoinIntent | null {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("roomId") ?? undefined;
    const firestoreGameId =
      params.get("firestoreGameId") ?? params.get("matchId") ?? undefined;
    const inviteCode = params.get("inviteCode") ?? undefined;
    const modeRaw = params.get("mode");
    if (!roomId && !firestoreGameId && !inviteCode && !modeRaw) {
      return null;
    }
    const mode: JoinIntent["mode"] =
      modeRaw === "spectate"
        ? "spectate"
        : modeRaw === "game"
          ? "game"
          : "join";
    return { roomId, firestoreGameId, inviteCode, mode };
  }

  private readableJoinError(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("spectat")) {
      return "Spectating not supported.";
    }
    if (
      lower.includes("max clients") ||
      lower.includes("room full") ||
      lower.includes("full")
    ) {
      return "Room full (10 players max).";
    }
    if (lower.includes("not found")) {
      return "Room not found. Ask host for a valid invite.";
    }
    return message || "Unable to join room.";
  }

  private resolveServerUrl(): string {
    const env = import.meta.env.VITE_COLYSEUS_URL as string | undefined;
    if (env && env.length > 0) {
      return env;
    }
    return `${window.location.protocol}//${window.location.hostname}:2567`;
  }

  private getRodName(rodId: string): string {
    return ROD_DEFINITIONS.find((rod) => rod.id === rodId)?.name ?? rodId;
  }

  private readonly onDebugKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === "g") {
      this.saveStore.addGold(DEV_GOLD_GRANT);
      this.ui.showToast(`Dev gold +${DEV_GOLD_GRANT}.`);
      return;
    }

    if (key === "c") {
      this.cullingDebugEnabled = !this.cullingDebugEnabled;
      this.worldCulling.setDebugEnabled(this.cullingDebugEnabled);
      this.ui.showToast(
        `Culling debug ${this.cullingDebugEnabled ? "enabled" : "disabled"}.`,
      );
      return;
    }

    if (key === "p") {
      this.setPoiMarkersVisible(!this.poiMarkersVisible);
      this.ui.showToast(
        `POI markers ${this.poiMarkersVisible ? "shown" : "hidden"}.`,
      );
      return;
    }

    if (key === "m") {
      const next = !this.saveStore.getSettings().meshAuditEnabled;
      this.saveStore.updateSettings({ meshAuditEnabled: next });
      this.ui.showToast(`Mesh audit ${next ? "enabled" : "disabled"}.`);
    }
  };

  private readonly onFirstUserGesture = (): void => {
    void this.unlockAudio();
  };
}

function toGold(value: number): string {
  return `${value}g`;
}

function toNetFishingState(state: FishingSnapshot["state"]): NetFishingState {
  switch (state) {
    case "casting":
      return "casting";
    case "waiting_for_bite":
    case "hooked":
    case "minigame":
      return "waiting";
    case "result_success":
      return "caught";
    case "result_fail":
      return "fail";
    default:
      return "idle";
  }
}

```

## client/src/data/quality.ts

```ts
import type { GraphicsQuality } from "../game/types";

export interface QualityPreset {
  id: GraphicsQuality;
  label: string;
  maxPixelRatio: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  particleMax: number;
  vfxEnabled: boolean;
  worldCullDistance: number;
  renderFar: number;
  propDensity: number;
  antiAlias: boolean;
}

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityPreset> = {
  low: {
    id: "low",
    label: "Low",
    maxPixelRatio: 1,
    shadowsEnabled: false,
    shadowMapSize: 512,
    particleMax: 60,
    vfxEnabled: false,
    worldCullDistance: 95,
    renderFar: 180,
    propDensity: 0.6,
    antiAlias: false
  },
  medium: {
    id: "medium",
    label: "Medium",
    maxPixelRatio: 1.5,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    particleMax: 120,
    vfxEnabled: true,
    worldCullDistance: 140,
    renderFar: 240,
    propDensity: 1,
    antiAlias: true
  },
  high: {
    id: "high",
    label: "High",
    maxPixelRatio: 2,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    particleMax: 220,
    vfxEnabled: true,
    worldCullDistance: 220,
    renderFar: 320,
    propDensity: 1.35,
    antiAlias: true
  }
};

export function getQualityPreset(quality: GraphicsQuality): QualityPreset {
  return QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium;
}

```

## client/src/engine/vfx/ParticleManager.ts

```ts
import * as THREE from "three";
import type { Rarity } from "../../game/types";

interface Particle {
  alive: boolean;
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  drag: number;
}

interface BurstConfig {
  count: number;
  speed: number;
  lifetime: number;
  verticalBoost: number;
  drag?: number;
}

export class ParticleManager {
  readonly points: THREE.Points;

  private readonly particles: Particle[];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geometry: THREE.BufferGeometry;

  private enabled = true;
  private maxParticles: number;

  constructor(maxParticles = 120) {
    this.maxParticles = maxParticles;
    this.particles = [];
    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;

    for (let i = 0; i < maxParticles; i += 1) {
      this.particles.push({
        alive: false,
        life: 0,
        maxLife: 1,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color("#ffffff"),
        drag: 0.92,
      });
      this.setInactive(i);
    }
  }

  setBudget(maxParticles: number): void {
    this.maxParticles = Math.max(
      24,
      Math.min(this.particles.length, Math.floor(maxParticles)),
    );
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.points.visible = enabled;
  }

  update(dtSeconds: number): void {
    if (!this.enabled) {
      return;
    }

    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i];
      if (!particle.alive) {
        continue;
      }
      particle.life += dtSeconds;
      if (particle.life >= particle.maxLife) {
        particle.alive = false;
        this.setInactive(i);
        continue;
      }

      particle.position.addScaledVector(particle.velocity, dtSeconds);
      const dragStep = Math.pow(particle.drag, dtSeconds * 60);
      particle.velocity.multiplyScalar(dragStep);
      particle.velocity.y -= dtSeconds * 0.65;

      const alpha = 1 - particle.life / particle.maxLife;
      this.positions[i * 3] = particle.position.x;
      this.positions[i * 3 + 1] = particle.position.y;
      this.positions[i * 3 + 2] = particle.position.z;
      this.colors[i * 3] = particle.color.r * alpha;
      this.colors[i * 3 + 1] = particle.color.g * alpha;
      this.colors[i * 3 + 2] = particle.color.b * alpha;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  spawnBite(position: THREE.Vector3): void {
    if (!this.enabled) {
      return;
    }
    this.spawnRing(position, "#7dd3fc", {
      count: 10,
      speed: 0.7,
      lifetime: 0.55,
      verticalBoost: 0.08,
      drag: 0.85,
    });
  }

  spawnCatch(position: THREE.Vector3, rarity: Rarity): void {
    if (!this.enabled) {
      return;
    }
    const configByRarity: Record<Rarity, BurstConfig> = {
      common: { count: 8, speed: 0.8, lifetime: 0.45, verticalBoost: 0.6 },
      uncommon: { count: 10, speed: 0.9, lifetime: 0.5, verticalBoost: 0.65 },
      rare: { count: 14, speed: 1, lifetime: 0.6, verticalBoost: 0.72 },
      epic: { count: 18, speed: 1.1, lifetime: 0.7, verticalBoost: 0.78 },
      mythic: { count: 22, speed: 1.25, lifetime: 0.9, verticalBoost: 0.88 },
    };
    this.spawnBurst(position, rarityColor(rarity), configByRarity[rarity]);
  }

  spawnFail(position: THREE.Vector3): void {
    if (!this.enabled) {
      return;
    }
    this.spawnBurst(position, "#cbd5e1", {
      count: 9,
      speed: 0.72,
      lifetime: 0.5,
      verticalBoost: 0.45,
      drag: 0.86,
    });
  }

  spawnCelebration(position: THREE.Vector3, rarity: "legendary" | "mythic"): void {
    if (!this.enabled) {
      return;
    }
    if (rarity === "legendary") {
      this.spawnOrbit(position, "#facc15", {
        count: 16,
        speed: 0.85,
        lifetime: 1.1,
        verticalBoost: 0.5,
      });
      return;
    }

    this.spawnOrbit(position, "#a855f7", {
      count: 24,
      speed: 1,
      lifetime: 1.35,
      verticalBoost: 0.6,
    });
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }

  private spawnRing(position: THREE.Vector3, colorHex: string, config: BurstConfig): void {
    const emitCount = Math.min(config.count, this.maxParticles);
    for (let i = 0; i < emitCount; i += 1) {
      const slot = this.findDeadSlot();
      if (slot < 0) {
        return;
      }
      const angle = (i / emitCount) * Math.PI * 2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * config.speed,
        config.verticalBoost * (0.5 + Math.random() * 0.4),
        Math.sin(angle) * config.speed,
      );
      this.activateParticle(slot, position, velocity, colorHex, config.lifetime, config.drag ?? 0.88);
    }
  }

  private spawnOrbit(position: THREE.Vector3, colorHex: string, config: BurstConfig): void {
    const emitCount = Math.min(config.count, this.maxParticles);
    for (let i = 0; i < emitCount; i += 1) {
      const slot = this.findDeadSlot();
      if (slot < 0) {
        return;
      }
      const angle = (i / emitCount) * Math.PI * 2;
      const radius = 0.7 + (i % 3) * 0.2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * config.speed * 0.45,
        config.verticalBoost * (0.45 + Math.random() * 0.35),
        Math.sin(angle) * config.speed * 0.45,
      );
      const spawn = position
        .clone()
        .add(new THREE.Vector3(Math.cos(angle) * radius, 1, Math.sin(angle) * radius));
      this.activateParticle(slot, spawn, velocity, colorHex, config.lifetime, 0.93);
    }
  }

  private spawnBurst(position: THREE.Vector3, colorHex: string, config: BurstConfig): void {
    const emitCount = Math.min(config.count, this.maxParticles);
    for (let i = 0; i < emitCount; i += 1) {
      const slot = this.findDeadSlot();
      if (slot < 0) {
        return;
      }
      const theta = Math.random() * Math.PI * 2;
      const strength = config.speed * (0.5 + Math.random() * 0.7);
      const velocity = new THREE.Vector3(
        Math.cos(theta) * strength,
        config.verticalBoost * (0.8 + Math.random() * 0.5),
        Math.sin(theta) * strength,
      );
      this.activateParticle(slot, position.clone().add(new THREE.Vector3(0, 1, 0)), velocity, colorHex, config.lifetime, config.drag ?? 0.9);
    }
  }

  private activateParticle(
    slot: number,
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    colorHex: string,
    lifetime: number,
    drag: number,
  ): void {
    const particle = this.particles[slot];
    particle.alive = true;
    particle.life = 0;
    particle.maxLife = lifetime * (0.86 + Math.random() * 0.35);
    particle.position.copy(position);
    particle.velocity.copy(velocity);
    particle.color.set(colorHex);
    particle.drag = drag;
  }

  private findDeadSlot(): number {
    for (let i = 0; i < this.maxParticles; i += 1) {
      if (!this.particles[i].alive) {
        return i;
      }
    }
    return -1;
  }

  private setInactive(index: number): void {
    this.positions[index * 3] = 99999;
    this.positions[index * 3 + 1] = 99999;
    this.positions[index * 3 + 2] = 99999;
    this.colors[index * 3] = 0;
    this.colors[index * 3 + 1] = 0;
    this.colors[index * 3 + 2] = 0;
  }
}

function rarityColor(rarity: Rarity): string {
  switch (rarity) {
    case "common":
      return "#84cc16";
    case "uncommon":
      return "#22c55e";
    case "rare":
      return "#3b82f6";
    case "epic":
      return "#f59e0b";
    case "mythic":
      return "#a855f7";
    default:
      return "#ffffff";
  }
}

```

## client/src/engine/perf/WorldCullingController.ts

```ts
import * as THREE from "three";

interface CullingEntry {
  object: THREE.Object3D;
  center: THREE.Vector3;
  debugMarker: THREE.Mesh;
}

export class WorldCullingController {
  private readonly entries: CullingEntry[] = [];
  private debugEnabled = false;

  constructor(private readonly scene: THREE.Scene) {
    scene.traverse((obj) => {
      if (!obj.userData.instanceCandidate) {
        return;
      }
      const center =
        (obj.userData.instanceGroupCenter as THREE.Vector3 | undefined)?.clone() ??
        obj.position.clone();

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 6, 6),
        new THREE.MeshBasicMaterial({
          color: "#22c55e",
          transparent: true,
          opacity: 0.75,
          depthTest: false,
        }),
      );
      marker.position.copy(center);
      marker.visible = false;
      marker.renderOrder = 999;
      this.scene.add(marker);

      this.entries.push({ object: obj, center, debugMarker: marker });
    });
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    for (const entry of this.entries) {
      entry.debugMarker.visible = enabled;
    }
  }

  update(playerPosition: THREE.Vector3, cullDistance: number): void {
    const cullDistanceSq = cullDistance * cullDistance;
    for (const entry of this.entries) {
      const distanceSq = entry.center.distanceToSquared(playerPosition);
      const isVisible = distanceSq <= cullDistanceSq;
      entry.object.visible = isVisible;

      if (!this.debugEnabled) {
        continue;
      }
      const markerMaterial = entry.debugMarker.material as THREE.MeshBasicMaterial;
      markerMaterial.color.set(isVisible ? "#22c55e" : "#ef4444");
      markerMaterial.opacity = isVisible ? 0.75 : 0.45;
      entry.debugMarker.visible = true;
    }
  }
}

```

## client/src/engine/perf/StaticInstanceOptimizer.ts

```ts
import * as THREE from "three";

interface CandidateGroup {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  meshes: THREE.Mesh[];
  groupKey: string;
}

export interface InstanceOptimizationResult {
  replacedGroups: number;
  replacedMeshes: number;
}

const MIN_GROUP_SIZE = 4;

export function optimizeStaticInstances(
  scene: THREE.Scene,
): InstanceOptimizationResult {
  const groups = new Map<string, CandidateGroup>();

  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) {
      return;
    }
    if (!obj.userData.instanceCandidate || obj.userData.noInstance) {
      return;
    }
    if (Array.isArray(obj.material)) {
      return;
    }
    const key = buildKey(obj);
    if (!groups.has(key)) {
      groups.set(key, {
        geometry: obj.geometry,
        material: obj.material,
        meshes: [],
        groupKey: key,
      });
    }
    groups.get(key)?.meshes.push(obj);
  });

  let replacedGroups = 0;
  let replacedMeshes = 0;

  for (const group of groups.values()) {
    if (group.meshes.length < MIN_GROUP_SIZE) {
      continue;
    }

    const instanced = new THREE.InstancedMesh(
      group.geometry,
      group.material,
      group.meshes.length,
    );
    instanced.name = `instanced_${replacedGroups}_${group.meshes[0].name || "group"}`;
    instanced.castShadow = group.meshes[0].castShadow;
    instanced.receiveShadow = group.meshes[0].receiveShadow;
    instanced.frustumCulled = true;
    instanced.userData.instanceCandidate = true;
    instanced.userData.instanceGroupKey = group.groupKey;
    instanced.renderOrder = group.meshes[0].renderOrder;

    const matrix = new THREE.Matrix4();
    const center = new THREE.Vector3();
    group.meshes.forEach((mesh, index) => {
      mesh.updateMatrix();
      matrix.copy(mesh.matrix);
      instanced.setMatrixAt(index, matrix);
      center.add(mesh.position);
      mesh.parent?.remove(mesh);
      replacedMeshes += 1;
    });
    center.multiplyScalar(1 / group.meshes.length);
    instanced.userData.instanceGroupCenter = center;

    scene.add(instanced);
    replacedGroups += 1;
  }

  return { replacedGroups, replacedMeshes };
}

function buildKey(mesh: THREE.Mesh): string {
  const geometry = mesh.geometry;
  const material = mesh.material as THREE.Material;
  const meshCategory = String(mesh.userData.meshCategory ?? "generic");

  const g = `${geometry.type}:${JSON.stringify(
    (geometry as unknown as { parameters?: unknown }).parameters ?? {},
  )}`;

  if (material instanceof THREE.MeshStandardMaterial) {
    return `${meshCategory}|${g}|std:${material.color.getHexString()}:${material.roughness}:${material.metalness}:${material.flatShading}`;
  }

  return `${meshCategory}|${g}|mat:${material.type}`;
}

```

## client/src/engine/debug/MeshAudit.ts

```ts
import * as THREE from "three";

interface MaterialState {
  side: THREE.Side;
  wireframe: boolean;
}

type AuditSeverity = "warning" | "critical";

export class MeshAuditHelper {
  private enabled = false;
  private warned = new Set<string>();
  private readonly materialSnapshot = new WeakMap<THREE.Material, MaterialState>();

  constructor(private readonly scene: THREE.Scene) {}

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) {
      return;
    }
    this.enabled = enabled;
    if (enabled) {
      this.applyDebugView();
      this.runAudit();
    } else {
      this.restoreMaterials();
    }
  }

  private applyDebugView(): void {
    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!this.materialSnapshot.has(material)) {
          this.materialSnapshot.set(material, {
            side: material.side,
            wireframe: material.wireframe,
          });
        }
        material.side = THREE.DoubleSide;
        material.wireframe = true;
        material.needsUpdate = true;
      }
    });
  }

  private restoreMaterials(): void {
    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        const snapshot = this.materialSnapshot.get(material);
        if (!snapshot) {
          continue;
        }
        material.side = snapshot.side;
        material.wireframe = snapshot.wireframe;
        material.needsUpdate = true;
      }
    });
  }

  private runAudit(): void {
    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }

      const meshName = obj.name || obj.uuid;
      const category = String(obj.userData.meshCategory ?? "uncategorized");
      const geometryType = obj.geometry.type;

      const isWater = category === "water";
      const isPlane = geometryType.includes("Plane");
      if (isPlane && !isWater) {
        this.warnOnce(
          `mesh:${obj.uuid}:plane`,
          "critical",
          `PlaneGeometry on non-water mesh "${meshName}" [category=${category}]. Use closed geometry.`,
        );
      }

      if (obj.userData.openBottom === true) {
        this.warnOnce(
          `mesh:${obj.uuid}:open_bottom`,
          "critical",
          `Mesh "${meshName}" [category=${category}] flagged openBottom=true. Close underside faces.`,
        );
      }

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (material.side === THREE.FrontSide && !isWater) {
          this.warnOnce(
            `material:${material.uuid}:frontside`,
            "warning",
            `Material "${material.name || material.uuid}" on mesh "${meshName}" is FrontSide only.`,
          );
        }
      }
    });
  }

  private warnOnce(key: string, severity: AuditSeverity, message: string): void {
    if (this.warned.has(key)) {
      return;
    }
    this.warned.add(key);
    const tag = severity === "critical" ? "[mesh-audit:critical]" : "[mesh-audit:warning]";
    // eslint-disable-next-line no-console
    console.warn(`${tag} ${message}`);
  }
}

```

## client/src/data/zoneVisuals.ts

```ts
import type { ZoneId } from "../game/types";

export interface ZoneVisualPreset {
  zoneId: ZoneId;
  label: string;
  fogColor: string;
  fogDensity: number;
  backgroundColor: string;
  ambientIntensity: number;
  ambientSkyColor: string;
  ambientGroundColor: string;
  directionalIntensity: number;
  directionalColor: string;
  directionalY: number;
  waterColor: string;
  waterPulseColor: string;
}

export const ZONE_VISUAL_PRESETS: Record<ZoneId, ZoneVisualPreset> = {
  beach: {
    zoneId: "beach",
    label: "Beach",
    fogColor: "#bfe8f2",
    fogDensity: 0.0036,
    backgroundColor: "#8ecfd8",
    ambientIntensity: 0.94,
    ambientSkyColor: "#fff0d8",
    ambientGroundColor: "#8ea68b",
    directionalIntensity: 1.14,
    directionalColor: "#fff3cb",
    directionalY: 35,
    waterColor: "#4ec6d8",
    waterPulseColor: "#91ecff",
  },
  river: {
    zoneId: "river",
    label: "River",
    fogColor: "#c9e6c3",
    fogDensity: 0.0043,
    backgroundColor: "#b7dcb0",
    ambientIntensity: 0.88,
    ambientSkyColor: "#e8ffe0",
    ambientGroundColor: "#7f9572",
    directionalIntensity: 1.02,
    directionalColor: "#e7f7db",
    directionalY: 33,
    waterColor: "#4cb7ea",
    waterPulseColor: "#95e4ff",
  },
  cave: {
    zoneId: "cave",
    label: "Cave",
    fogColor: "#25374e",
    fogDensity: 0.0105,
    backgroundColor: "#1f3042",
    ambientIntensity: 0.5,
    ambientSkyColor: "#99c8f0",
    ambientGroundColor: "#223042",
    directionalIntensity: 0.7,
    directionalColor: "#8dc0ec",
    directionalY: 24,
    waterColor: "#35b8ec",
    waterPulseColor: "#8ddfff",
  },
  volcano: {
    zoneId: "volcano",
    label: "Volcano",
    fogColor: "#68463a",
    fogDensity: 0.0078,
    backgroundColor: "#5d3f35",
    ambientIntensity: 0.64,
    ambientSkyColor: "#ffcf9e",
    ambientGroundColor: "#4e3931",
    directionalIntensity: 0.94,
    directionalColor: "#ffb57b",
    directionalY: 30,
    waterColor: "#f08738",
    waterPulseColor: "#ffc490",
  },
  oasis: {
    zoneId: "oasis",
    label: "Oasis",
    fogColor: "#d9f2cf",
    fogDensity: 0.0039,
    backgroundColor: "#d8f1c7",
    ambientIntensity: 0.98,
    ambientSkyColor: "#fff1c9",
    ambientGroundColor: "#88a47a",
    directionalIntensity: 1.1,
    directionalColor: "#fff0be",
    directionalY: 34,
    waterColor: "#61deee",
    waterPulseColor: "#c6f8ff",
  },
};

```

## client/src/engine/visuals/ZoneVisualController.ts

```ts
import * as THREE from "three";
import { ZONE_VISUAL_PRESETS, type ZoneVisualPreset } from "../../data/zoneVisuals";
import type { ZoneId } from "../../game/types";

interface WaterRef {
  mesh: THREE.Mesh;
  baseY: number;
  zone: ZoneId;
}

function lerpColor(target: THREE.Color, to: string, alpha: number): void {
  target.lerp(new THREE.Color(to), alpha);
}

export class ZoneVisualController {
  private readonly ambientLight: THREE.HemisphereLight | null;
  private readonly directionalLight: THREE.DirectionalLight | null;
  private readonly waterMeshes: WaterRef[] = [];

  private activePreset: ZoneVisualPreset;
  private targetPreset: ZoneVisualPreset;

  constructor(private readonly scene: THREE.Scene) {
    this.ambientLight =
      this.scene.children.find(
        (child): child is THREE.HemisphereLight => child instanceof THREE.HemisphereLight,
      ) ?? null;
    this.directionalLight =
      this.scene.children.find(
        (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight,
      ) ?? null;

    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }
      const zone = obj.userData.waterZone as ZoneId | undefined;
      if (!zone) {
        return;
      }
      this.waterMeshes.push({
        mesh: obj,
        baseY: obj.position.y,
        zone,
      });
    });

    this.activePreset = ZONE_VISUAL_PRESETS.beach;
    this.targetPreset = this.activePreset;
    this.applyImmediate(this.activePreset);
  }

  setZone(zoneId: ZoneId): void {
    this.targetPreset = ZONE_VISUAL_PRESETS[zoneId] ?? ZONE_VISUAL_PRESETS.beach;
  }

  update(dtSeconds: number, elapsedSeconds: number): void {
    const smoothing = Math.min(1, dtSeconds * 2.8);
    const preset = this.targetPreset;

    if (this.scene.fog instanceof THREE.FogExp2) {
      lerpColor(this.scene.fog.color, preset.fogColor, smoothing);
      this.scene.fog.density = THREE.MathUtils.lerp(
        this.scene.fog.density,
        preset.fogDensity,
        smoothing,
      );
    } else {
      this.scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
    }

    const sceneBg =
      this.scene.background instanceof THREE.Color
        ? this.scene.background
        : new THREE.Color(preset.backgroundColor);
    lerpColor(sceneBg, preset.backgroundColor, smoothing);
    this.scene.background = sceneBg;

    if (this.ambientLight) {
      this.ambientLight.intensity = THREE.MathUtils.lerp(
        this.ambientLight.intensity,
        preset.ambientIntensity,
        smoothing,
      );
      lerpColor(this.ambientLight.color, preset.ambientSkyColor, smoothing);
      lerpColor(this.ambientLight.groundColor, preset.ambientGroundColor, smoothing);
    }

    if (this.directionalLight) {
      this.directionalLight.intensity = THREE.MathUtils.lerp(
        this.directionalLight.intensity,
        preset.directionalIntensity,
        smoothing,
      );
      lerpColor(this.directionalLight.color, preset.directionalColor, smoothing);
      this.directionalLight.position.y = THREE.MathUtils.lerp(
        this.directionalLight.position.y,
        preset.directionalY,
        smoothing,
      );
    }

    for (const water of this.waterMeshes) {
      const material = water.mesh.material;
      if (material instanceof THREE.MeshStandardMaterial) {
        const zonePreset = ZONE_VISUAL_PRESETS[water.zone] ?? preset;
        const blend = water.zone === preset.zoneId ? 0.08 : 0.03;
        lerpColor(material.color, zonePreset.waterColor, blend);
        lerpColor(material.emissive, zonePreset.waterPulseColor, blend * 0.6);
        material.emissiveIntensity = THREE.MathUtils.lerp(
          material.emissiveIntensity,
          water.zone === preset.zoneId ? 0.06 : 0.025,
          blend,
        );
      }

      const waveFreq = water.zone === preset.zoneId ? 1.55 : 1.05;
      const waveAmp =
        water.zone === "oasis"
          ? 0.05
          : water.zone === "volcano"
            ? 0.035
            : water.zone === "river"
              ? 0.045
              : 0.03;
      water.mesh.position.y =
        water.baseY + Math.sin(elapsedSeconds * waveFreq + water.baseY) * waveAmp;
    }

    this.activePreset = preset;
  }

  private applyImmediate(preset: ZoneVisualPreset): void {
    this.scene.background = new THREE.Color(preset.backgroundColor);
    this.scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);

    if (this.ambientLight) {
      this.ambientLight.intensity = preset.ambientIntensity;
      this.ambientLight.color.set(preset.ambientSkyColor);
      this.ambientLight.groundColor.set(preset.ambientGroundColor);
    }

    if (this.directionalLight) {
      this.directionalLight.intensity = preset.directionalIntensity;
      this.directionalLight.color.set(preset.directionalColor);
      this.directionalLight.position.y = preset.directionalY;
    }

    for (const water of this.waterMeshes) {
      const material = water.mesh.material;
      if (material instanceof THREE.MeshStandardMaterial) {
        const zonePreset = ZONE_VISUAL_PRESETS[water.zone];
        material.color.set(zonePreset.waterColor);
        material.emissive.set(zonePreset.waterPulseColor);
        material.emissiveIntensity = 0.02;
      }
    }
  }
}

```

## client/src/engine/audio/AudioManager.ts

```ts
import type { ZoneId } from "../../game/types";

export type SoundEventId =
  | "ui_click"
  | "cast"
  | "bite"
  | "progress_tick"
  | "catch"
  | "fail"
  | "purchase"
  | "sell"
  | "pickup"
  | "gate_unlock"
  | "rarity_stinger";

interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
}

const AMBIENCE_FREQ: Record<ZoneId, [number, number]> = {
  beach: [174, 220],
  river: [146, 196],
  cave: [98, 130],
  volcano: [110, 146],
  oasis: [196, 262],
};

const OPTIONAL_AUDIO_FILES: Partial<Record<SoundEventId, string>> = {
  // Place optional files under /public/audio/sfx and keep names below to override synth:
  // cast: "sfx/cast.wav",
  // bite: "sfx/bite.wav",
  // catch: "sfx/catch.wav",
  // sell: "sfx/sell.wav",
};

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private activeSfx = 0;
  private readonly maxSimultaneousSfx = 6;
  private ambienceNodes: OscillatorNode[] = [];
  private assetBasePath = "/audio/";

  private settings: AudioSettings = {
    masterVolume: 0.8,
    sfxVolume: 0.8,
    musicVolume: 0.55,
    muted: false,
  };

  async unlockByGesture(): Promise<boolean> {
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.masterGain = this.context.createGain();
        this.sfxGain = this.context.createGain();
        this.musicGain = this.context.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.context.destination);
        this.applySettings(this.settings);
      } catch {
        return false;
      }
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    return true;
  }

  setAssetBasePath(path: string): void {
    this.assetBasePath = path.endsWith("/") ? path : `${path}/`;
  }

  applySettings(settings: AudioSettings): void {
    this.settings = {
      masterVolume: clamp01(settings.masterVolume),
      sfxVolume: clamp01(settings.sfxVolume),
      musicVolume: clamp01(settings.musicVolume),
      muted: Boolean(settings.muted),
    };

    if (!this.context || !this.masterGain || !this.sfxGain || !this.musicGain) {
      return;
    }

    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(
      this.settings.muted ? 0 : this.settings.masterVolume,
      now,
      0.02,
    );
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume * 0.24, now, 0.08);
  }

  setZoneAmbience(zoneId: ZoneId): void {
    if (!this.context || !this.musicGain) {
      return;
    }

    this.clearAmbience();

    const [f1, f2] = AMBIENCE_FREQ[zoneId];
    const oscA = this.context.createOscillator();
    const oscB = this.context.createOscillator();
    const gainA = this.context.createGain();
    const gainB = this.context.createGain();

    oscA.type = zoneId === "volcano" ? "sawtooth" : "sine";
    oscB.type = zoneId === "cave" ? "triangle" : "sine";
    oscA.frequency.value = f1;
    oscB.frequency.value = f2;
    gainA.gain.value = zoneId === "cave" ? 0.026 : 0.03;
    gainB.gain.value = zoneId === "oasis" ? 0.024 : 0.02;

    oscA.connect(gainA);
    oscB.connect(gainB);
    gainA.connect(this.musicGain);
    gainB.connect(this.musicGain);

    oscA.start();
    oscB.start();
    this.ambienceNodes = [oscA, oscB];
  }

  playSfx(id: SoundEventId): void {
    if (!this.context || !this.sfxGain || this.settings.muted) {
      return;
    }
    if (this.activeSfx >= this.maxSimultaneousSfx) {
      return;
    }

    if (this.tryPlayOptionalFile(id)) {
      return;
    }

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const params = describeSound(id);

    this.activeSfx += 1;
    osc.type = params.type;
    osc.frequency.setValueAtTime(params.startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, params.endFreq),
      now + params.duration,
    );

    filter.type = "lowpass";
    filter.frequency.value = params.filter;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(params.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + params.duration);

    osc.start(now);
    osc.stop(now + params.duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.activeSfx = Math.max(0, this.activeSfx - 1);
    };
  }

  dispose(): void {
    this.clearAmbience();
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    if (this.sfxGain) {
      this.sfxGain.disconnect();
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
    }
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }

  private tryPlayOptionalFile(id: SoundEventId): boolean {
    const file = OPTIONAL_AUDIO_FILES[id];
    if (!file) {
      return false;
    }
    this.activeSfx += 1;
    const audio = new Audio(`${this.assetBasePath}${file}`);
    audio.volume = clamp01(this.settings.sfxVolume * 0.7);
    void audio.play().catch(() => {
      this.activeSfx = Math.max(0, this.activeSfx - 1);
    });
    audio.onended = () => {
      this.activeSfx = Math.max(0, this.activeSfx - 1);
    };
    audio.onerror = () => {
      this.activeSfx = Math.max(0, this.activeSfx - 1);
    };
    return true;
  }

  private clearAmbience(): void {
    for (const osc of this.ambienceNodes) {
      try {
        osc.stop();
      } catch {
        // no-op
      }
      osc.disconnect();
    }
    this.ambienceNodes = [];
  }
}

function describeSound(id: SoundEventId): {
  type: OscillatorType;
  startFreq: number;
  endFreq: number;
  duration: number;
  gain: number;
  filter: number;
} {
  switch (id) {
    case "ui_click":
      return {
        type: "triangle",
        startFreq: 520,
        endFreq: 460,
        duration: 0.08,
        gain: 0.08,
        filter: 4200,
      };
    case "cast":
      return {
        type: "sine",
        startFreq: 240,
        endFreq: 120,
        duration: 0.22,
        gain: 0.1,
        filter: 3200,
      };
    case "bite":
      return {
        type: "square",
        startFreq: 780,
        endFreq: 420,
        duration: 0.18,
        gain: 0.12,
        filter: 3600,
      };
    case "progress_tick":
      return {
        type: "sine",
        startFreq: 620,
        endFreq: 570,
        duration: 0.06,
        gain: 0.04,
        filter: 5000,
      };
    case "catch":
      return {
        type: "triangle",
        startFreq: 460,
        endFreq: 920,
        duration: 0.26,
        gain: 0.12,
        filter: 5200,
      };
    case "fail":
      return {
        type: "sawtooth",
        startFreq: 320,
        endFreq: 120,
        duration: 0.28,
        gain: 0.09,
        filter: 1800,
      };
    case "purchase":
      return {
        type: "triangle",
        startFreq: 520,
        endFreq: 780,
        duration: 0.16,
        gain: 0.1,
        filter: 4600,
      };
    case "sell":
      return {
        type: "triangle",
        startFreq: 360,
        endFreq: 700,
        duration: 0.14,
        gain: 0.09,
        filter: 4200,
      };
    case "pickup":
      return {
        type: "sine",
        startFreq: 640,
        endFreq: 980,
        duration: 0.24,
        gain: 0.12,
        filter: 6000,
      };
    case "gate_unlock":
      return {
        type: "triangle",
        startFreq: 420,
        endFreq: 1120,
        duration: 0.4,
        gain: 0.14,
        filter: 5400,
      };
    case "rarity_stinger":
      return {
        type: "sine",
        startFreq: 680,
        endFreq: 1440,
        duration: 0.42,
        gain: 0.16,
        filter: 7000,
      };
    default:
      return {
        type: "sine",
        startFreq: 400,
        endFreq: 400,
        duration: 0.1,
        gain: 0.08,
        filter: 3000,
      };
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

```

## client/src/data/config.ts

```ts
export const INVENTORY_CAPACITY_BY_LEVEL = [10, 20, 30, 40, 50, 60] as const;

export const INVENTORY_UPGRADE_COST_BY_LEVEL = [250, 450, 700, 1000, 1400] as const;

export const MAX_INVENTORY_LEVEL = 5;

export const DEV_GOLD_GRANT = 200;

export const DEFAULT_MESH_AUDIT_ENABLED = false;

```

## README.md

```md
# Tropical Island Fishing - Phase 5

Phase 5 adds polish, QoL, and performance controls while keeping all locked gameplay rules unchanged.

## Core Status

- 5 zones playable: Beach, River, Cave, Volcano, Oasis
- 17 fish per zone with locked rarity split
- Per-player local progression in online rooms
- Multiplayer sync remains minimal:
  - transform + fishing state icons + celebration ping
  - no syncing of gold/inventory/bestiary/rods/quests
- Spectate join rejected server-side at handshake
- Party bonus still applied at sell stands only:
  - `goldMult = 1 + 0.05 * (players - 1)`

## In-App Integration (Invite System)

- `TropicalFishingGame` now runs embedded inside the app via `WebView` (no external browser handoff).
- Existing invite route params are preserved:
  - `matchId` -> forwarded as fishing `inviteCode`
  - `spectatorMode` -> forwarded as `mode=spectate` (server rejects handshake as required)
- Embedded bridge posts room status back to the native shell for in-app session visibility.
- Fishing multiplayer room is registered in the shared Colyseus server:
  - room name: `island_room`
  - room matching key: `firestoreGameId` (same invite-session pattern as other Colyseus games)
  - room cap: `10`
  - `mode: "spectate"` rejected during handshake.

## Phase 5 Additions

- Zone visual presets (lighting, fog, water tint/pulse) applied by zone
- Audio manager:
  - user-gesture unlock
  - SFX set + zone ambience
  - master/SFX/music/mute controls
- Particle/VFX manager:
  - bite/catch/fail effects
  - legendary/mythic celebration bursts
- Mesh audit debug toggle:
  - wireframe + double-side debug view
  - warnings for plane geometry / front-side-only materials
- Inventory QoL:
  - sort: rarity, sell value, zone, newest
  - filter: zone and Rare+
  - quick sell: commons, commons+uncommons, keep rares+
- Sell safety:
  - confirmation prompt when selling includes Rare+
- Diagnostics overlay (optional):
  - FPS, player count, draw calls, zone
- Performance pass:
  - static instancing pass for repeated world props
  - distance culling for instance-candidate objects
  - particle budget + render settings from quality presets
- Stability:
  - save schema v5 with settings + migration report
  - online join failure now falls back to solo mode cleanly
  - reset save requires confirmation

## Project Layout

- `client/` - three.js + Vite + TypeScript
- `server/` - Colyseus + TypeScript

## Run Server (Shared Colyseus + Embedded Fishing Host)

```bash
cd client
npm install
npm run build

cd colyseus-server
npm install
npm run dev
```

Server default: `http://localhost:2567`  
Health: `http://localhost:2567/health`
Fishing host (embedded): `http://localhost:2567/fishing`

## Run Client

```bash
npm start
```

Optional env var:

- `EXPO_PUBLIC_FISHING_GAME_URL` (override embedded host when needed)

## Build Validation

```bash
cd client
npm run typecheck
npm run build

cd ../colyseus-server
npm run build
```

## Debug / Perf Toggles

In the fishing client runtime:

- `G` key: grant `+200` gold (dev economy test)
- `M` key: toggle mesh audit mode (wireframe + closed-mesh warnings)
- `C` key: toggle culling debug markers (green visible / red culled groups)
- `P` key: toggle POI markers (interactable rings/bases)

Settings panel toggles still available for:

- graphics quality (`low` / `medium` / `high`)
- diagnostics overlay (FPS / draw calls / zone)
- mesh audit
- decay grace

## Multiplayer Quick Test (2 tabs/devices)

1. Start server + client.
2. On client A click `Play Online`.
3. Use `Copy Invite Link`.
4. Open link on client B (`?roomId=<ID>&mode=join`).
5. Confirm room/player panel updates on both clients.
6. Move and fish on one client; verify remote avatar smoothing + fishing state icon updates.
7. Sell fish and confirm party bonus changes payout only at sell stands.

Invite mode behavior:

- `?roomId=<id>&mode=join` -> join as player
- `?roomId=<id>&mode=game` -> join as player
- `?roomId=<id>&mode=spectate` -> rejected by server; client falls back gracefully

## Embedded Client Timeout Troubleshooting

If the in-app fishing screen shows "Failed to load embedded fishing client" or "No reachable fishing host":

1. Build the fishing bundle once:
   - `cd client`
   - `npm run build`
2. Start Colyseus:
   - `cd colyseus-server`
   - `npm run dev`
3. Validate host directly in browser:
   - `http://localhost:2567/fishing/health` should return `ok: true`
   - `http://localhost:2567/fishing` should load the game shell
4. In app, tap `Retry` on the fishing screen.
5. Check probe report in the error card:
   - app now probes integrated host candidates first (`:2567/fishing`) before standalone Vite host candidates (`:5173`).
6. Optional standalone mode (if you want rapid web iteration):
   - `cd client && npm run dev -- --host`
7. If your host is non-standard, set:
   - `EXPO_PUBLIC_FISHING_GAME_URL=http://<your-host>/fishing`

## Gate and Endgame Paths

### Volcano unlock

1. Catch at least 9 unique Beach fish.
2. Catch at least 9 unique River fish.
3. Volcano gate opens for that local save only.

### Oasis unlock

1. Catch at least 9 unique fish in Beach, River, Cave, and Volcano.
2. Oasis emblem lights update per zone.
3. Oasis gate opens for that local save only.

### Final rod path

1. Collect relics:
   - `relic_beach_shell_sigill`
   - `relic_river_totem_piece`
   - `relic_cave_crystal_key`
2. Enter Oasis and start the final challenge.
3. Activate all pressure plates.
4. Claim `oasis_challenge_rod` (best rod).

## Phase 5 Verification Checklist

- [ ] Visual: each zone has distinct fog/light/water feel and remains readable
- [ ] Visual: no visible see-through undersides on world props (use mesh audit toggle)
- [ ] Audio: SFX/ambience start after first user gesture; volume sliders and mute work
- [ ] VFX: bite/catch/fail particles trigger correctly
- [ ] VFX: legendary/mythic catches show celebration effects locally and above remote players
- [ ] QoL: inventory sort/filter works across all options
- [ ] QoL: quick sell buttons work; Rare+ confirmation appears for risky sell actions
- [ ] QoL: bait consumption reminder is visible in fishing UI
- [ ] Performance: quality settings (Low/Medium/High) reduce/increase rendering load
- [ ] Performance: world instancing/culling active; diagnostics overlay shows draw calls/FPS
- [ ] Stability: room join failures return player to solo mode without crash
- [ ] Stability: local save migrates without data loss; reset save asks for confirmation
- [ ] Multiplayer: spectate mode still rejected; progression remains local per player

## Dev Controls

- `G` key: grant `+200` gold
- `M` key: toggle mesh audit
- `C` key: toggle culling debug markers
- `P` key: toggle POI marker visibility
- Settings panel:
  - graphics quality
  - diagnostics toggle
  - mesh audit toggle
  - decay micro-grace toggle
  - reset save

```


