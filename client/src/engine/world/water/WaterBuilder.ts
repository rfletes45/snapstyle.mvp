import * as THREE from "three";
import type { ZoneId } from "../../../game/types";
import { CAVE_STREAM_PATH } from "../layout/CaveLayout";
import { RIVER_TRIBUTARY_PATH, RIVER_WATER_PATH } from "../layout/RiverLayout";
import { addBox, materialFor } from "../props/PropFactory";

interface WaterPlaneOptions {
  width: number;
  depth: number;
  x: number;
  y: number;
  z: number;
  color: string;
  zone: ZoneId;
  name: string;
  roughness?: number;
}

function configureWaterMesh(
  mesh: THREE.Mesh,
  zone: ZoneId,
  name: string,
): void {
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.meshCategory = "water";
  mesh.userData.waterZone = zone;
  mesh.userData.cullDistanceMultiplier = 1.35;
}

export function addWaterPlane(
  scene: THREE.Scene,
  options: WaterPlaneOptions,
): THREE.Mesh {
  const material = materialFor(
    options.color,
    false,
    options.roughness ?? 0.32,
    0,
  );
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(options.width, options.depth),
    material,
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(options.x, options.y, options.z);
  configureWaterMesh(mesh, options.zone, options.name);
  scene.add(mesh);
  return mesh;
}

export function addWaterStrip(
  scene: THREE.Scene,
  from: { x: number; z: number },
  to: { x: number; z: number },
  width: number,
  y: number,
  color: string,
  zone: ZoneId,
  name: string,
): THREE.Mesh {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const centerX = (from.x + to.x) * 0.5;
  const centerZ = (from.z + to.z) * 0.5;
  const yaw = Math.atan2(dx, dz);

  const mesh = addWaterPlane(scene, {
    width,
    depth: length,
    x: centerX,
    y,
    z: centerZ,
    color,
    zone,
    name,
  });
  // Use rotation.z to rotate around the vertical (world-Y) axis.
  // With Euler order XYZ, after rotation.x = -PI/2 the local Y axis
  // points into world-Z, so rotation.y would tilt the plane vertically.
  // Local Z after the X-rotation points into world -Y, so rotating
  // around local Z by -yaw equals a world-Y rotation by yaw.
  mesh.rotation.y = 0;
  mesh.rotation.z = -yaw;
  return mesh;
}

/*──────────────────────────────────────────────────────────────────────────────
 *  BEACH WATER
 *
 *  Simple, clean layering:
 *    1. Main ocean surface (large, covers everything south of shore)
 *    2. Deep band further south (slightly lower, darker)
 *    3. Shore foam band (bright strip at waterline)
 *    4. Reef cove surface (smaller, lighter)
 *    5. A couple of subtle wave crest accents
 *──────────────────────────────────────────────────────────────────────────────*/

export function buildBeachWater(scene: THREE.Scene): void {
  // Main ocean surface — covers entire south area
  addWaterPlane(scene, {
    width: 140,
    depth: 60,
    x: -4,
    y: -0.22,
    z: -6,
    color: "#4ec6d8",
    zone: "beach",
    name: "beach_ocean_surface",
  });

  // Deep ocean band — further south, slightly lower & darker
  addWaterPlane(scene, {
    width: 130,
    depth: 30,
    x: -4,
    y: -0.28,
    z: -20,
    color: "#3aa9c6",
    zone: "beach",
    name: "beach_ocean_deep_band",
    roughness: 0.36,
  });

  // Near-shore strip — bright shallow water along the beach edge
  addBox(scene, [80, 0.24, 6], [-4, -0.1, 6], "#8ce8ff", {
    name: "beach_near_shore_strip",
    category: "water",
    castShadow: false,
    receiveShadow: true,
    flatShaded: false,
    roughness: 0.28,
    metalness: 0,
    cullDistanceMultiplier: 1.4,
  });

  // Shore foam band — bright white-blue at exact waterline
  addBox(scene, [78, 0.1, 1.4], [-4, -0.02, 8.2], "#c8f4ff", {
    name: "beach_shore_foam_band",
    category: "water",
    castShadow: false,
    receiveShadow: true,
    flatShaded: false,
    roughness: 0.2,
    metalness: 0,
    cullDistanceMultiplier: 1.35,
  });

  // Reef cove surface — distinct lighter pool east of pier
  addWaterPlane(scene, {
    width: 16,
    depth: 10,
    x: 16,
    y: -0.14,
    z: 4,
    color: "#70d9ea",
    zone: "beach",
    name: "beach_reef_surface",
    roughness: 0.26,
  });

  // Reef foam accent
  addBox(scene, [14, 0.08, 1.2], [16, -0.06, 9], "#adecf7", {
    name: "beach_reef_foam_band",
    category: "water",
    castShadow: false,
    receiveShadow: true,
    flatShaded: false,
    roughness: 0.22,
    metalness: 0,
    cullDistanceMultiplier: 1.1,
  });

  // Subtle mid-ocean wave crest
  addBox(scene, [60, 0.04, 1.8], [-4, -0.16, 2], "#5ecfe2", {
    name: "beach_wave_crest",
    category: "water",
    castShadow: false,
    receiveShadow: true,
    flatShaded: false,
    roughness: 0.26,
    metalness: 0,
    cullDistanceMultiplier: 1.2,
  });
}

/*==============================================================================
 *  RIVER WATER
 *
 *  Layered water system:
 *    1. Main river channel segments from layout path (west -> east)
 *    2. Foam center lines on each segment
 *    3. Calm pool overlay at the widest section (X 56-68)
 *    4. Tributary stream from bamboo grove
 *    5. Upstream surface near cave exit
 *    6. Bank foam / splash accents at key points
 *==============================================================================*/

export function buildRiverWater(scene: THREE.Scene): void {
  // -- Main river channel segments from layout path --------
  for (let i = 0; i < RIVER_WATER_PATH.length - 1; i += 1) {
    const from = RIVER_WATER_PATH[i];
    const to = RIVER_WATER_PATH[i + 1];
    const width = (from.width + to.width) * 0.5;
    const y = (from.y + to.y) * 0.5;
    addWaterStrip(
      scene,
      { x: from.x, z: from.z },
      { x: to.x, z: to.z },
      width,
      y,
      "#45b5e5",
      "river",
      `river_water_segment_${i + 1}`,
    );
    // Foam center line
    addWaterStrip(
      scene,
      { x: from.x, z: from.z },
      { x: to.x, z: to.z },
      Math.max(1.4, width * 0.35),
      y + 0.01,
      "#9deefe",
      "river",
      `river_water_foam_${i + 1}`,
    );
  }

  // -- Calm pool overlay (wide section X 56-68) ------------
  addWaterPlane(scene, {
    width: 16,
    depth: 12,
    x: 62,
    y: 0.04,
    z: 10,
    color: "#5bc8ef",
    zone: "river",
    name: "river_calm_pool_surface",
    roughness: 0.24,
  });

  // Calm pool foam accent
  addBox(scene, [14, 0.06, 1.0], [62, 0.07, 4.5], "#b0ecfa", {
    name: "river_calm_pool_foam",
    category: "water",
    castShadow: false,
    receiveShadow: true,
    flatShaded: false,
    roughness: 0.22,
    metalness: 0,
    cullDistanceMultiplier: 1.1,
  });

  // -- Tributary stream (bamboo grove -> main river) -------
  for (let i = 0; i < RIVER_TRIBUTARY_PATH.length - 1; i += 1) {
    const from = RIVER_TRIBUTARY_PATH[i];
    const to = RIVER_TRIBUTARY_PATH[i + 1];
    const width = (from.width + to.width) * 0.5;
    const y = (from.y + to.y) * 0.5;
    addWaterStrip(
      scene,
      { x: from.x, z: from.z },
      { x: to.x, z: to.z },
      width,
      y,
      "#6dd4f0",
      "river",
      `river_tributary_segment_${i + 1}`,
    );
  }

  // -- Upstream surface (near cave exit, rising water) -----
  addWaterPlane(scene, {
    width: 8,
    depth: 6,
    x: 80,
    y: 0.34,
    z: 13,
    color: "#7fdcf9",
    zone: "river",
    name: "river_upstream_surface",
    roughness: 0.22,
  });

  // -- Bridge splash accents (where bridge meets water) ----
  addBox(scene, [4, 0.05, 1.2], [38, 0.06, 9], "#c4f0fa", {
    name: "river_bridge_splash_south",
    category: "water",
    castShadow: false,
    receiveShadow: true,
    flatShaded: false,
    roughness: 0.2,
    metalness: 0,
    cullDistanceMultiplier: 0.9,
  });
  addBox(scene, [4, 0.05, 1.2], [38, 0.06, 15], "#c4f0fa", {
    name: "river_bridge_splash_north",
    category: "water",
    castShadow: false,
    receiveShadow: true,
    flatShaded: false,
    roughness: 0.2,
    metalness: 0,
    cullDistanceMultiplier: 0.9,
  });
}

/*==============================================================================
 *  CAVE WATER
 *
 *  Underground lake and inlet stream.  The lake sits over the sunken cave
 *  bed at Y = -0.40.  Water surface is at Y = -0.05 (dark, deep cave water).
 *  A small stream trickles from the main cavern floor down into the lake.
 *==============================================================================*/

export function buildCaveWater(scene: THREE.Scene): void {
  // -- Underground lake surface (main body) ----------------
  addWaterPlane(scene, {
    width: 18,
    depth: 8,
    x: 109,
    y: -0.05,
    z: -12,
    color: "#2d6fa8",
    zone: "cave",
    name: "cave_lake_surface",
    roughness: 0.18,
  });

  // -- Lake edge shimmer (north rim of lake) ---------------
  addBox(scene, [18, 0.04, 1.2], [109, -0.02, -7.5], "#4494c4", {
    name: "cave_lake_rim_shimmer",
    category: "water",
    castShadow: false,
    receiveShadow: true,
    flatShaded: false,
    roughness: 0.16,
    metalness: 0,
    cullDistanceMultiplier: 1.0,
  });

  // -- Inlet stream (from cavern floor into lake) ----------
  for (let i = 0; i < CAVE_STREAM_PATH.length - 1; i += 1) {
    const from = CAVE_STREAM_PATH[i];
    const to = CAVE_STREAM_PATH[i + 1];
    const width = (from.width + to.width) * 0.5;
    const y = (from.y + to.y) * 0.5;
    addWaterStrip(
      scene,
      { x: from.x, z: from.z },
      { x: to.x, z: to.z },
      width,
      y,
      "#3b82c4",
      "cave",
      `cave_stream_segment_${i + 1}`,
    );
  }

  // -- Drip pools (small puddles in the cave) --------------
  addWaterPlane(scene, {
    width: 2.0,
    depth: 1.6,
    x: 98,
    y: 0.08,
    z: 8,
    color: "#3b82c4",
    zone: "cave",
    name: "cave_drip_pool_1",
    roughness: 0.14,
  });

  addWaterPlane(scene, {
    width: 1.8,
    depth: 1.4,
    x: 122,
    y: 0.08,
    z: 22,
    color: "#3b82c4",
    zone: "cave",
    name: "cave_drip_pool_2",
    roughness: 0.14,
  });

  // -- Crystal gallery reflection pool --------------------
  addWaterPlane(scene, {
    width: 6,
    depth: 3,
    x: 122,
    y: 0.58,
    z: 30,
    color: "#4494c4",
    zone: "cave",
    name: "cave_crystal_pool",
    roughness: 0.12,
  });
}
