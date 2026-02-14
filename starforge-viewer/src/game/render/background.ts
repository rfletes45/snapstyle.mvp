/**
 * Background scenery — starfield, distant planets, far wreck silhouettes.
 * All geometry is cheap: Points, low-poly spheres, InstancedMesh.
 * Designed for mobile: no shadows, no postprocessing.
 */
import * as THREE from "three";
import { createRNG } from "../sim/rng";

// ─── Config ──────────────────────────────────────────────────

const STAR_COUNT = 3500;
const STAR_RADIUS = 80; // spread radius for star sphere

const PLANET_COUNT = 3;
const PLANET_MIN_DIST = 50;
const PLANET_MAX_DIST = 70;
const PLANET_MIN_SIZE = 3;
const PLANET_MAX_SIZE = 8;

const WRECK_SILHOUETTE_COUNT = 40;
const WRECK_RING_MIN = 25;
const WRECK_RING_MAX = 55;

// Palette matching fog/clear color #0a0c14
const FOG_COLOR = 0x0a0c14;

// ─── State ───────────────────────────────────────────────────

interface BackgroundState {
  starfield: THREE.Points;
  planets: THREE.Mesh[];
  wreckInstances: THREE.InstancedMesh;
  planetSpeeds: number[]; // rotation speed per planet
}

let bg: BackgroundState | null = null;

// ─── Public API ──────────────────────────────────────────────

/**
 * Initialise background scenery. Call once after scene is ready.
 */
export function initBackground(scene: THREE.Scene, seed: number): void {
  const rng = createRNG(seed + 99991);

  // 1. Starfield
  const starfield = createStarfield(rng);
  scene.add(starfield);

  // 2. Planets
  const { planets, speeds } = createPlanets(rng);
  for (const p of planets) scene.add(p);

  // 3. Far wreck silhouettes
  const wreckInstances = createWreckSilhouettes(rng);
  scene.add(wreckInstances);

  bg = { starfield, planets, wreckInstances, planetSpeeds: speeds };
}

/**
 * Update background each frame — slow rotations/drifts.
 */
export function updateBackground(dt: number): void {
  if (!bg) return;

  // Slowly rotate starfield
  bg.starfield.rotation.y += dt * 0.003;
  bg.starfield.rotation.x += dt * 0.001;

  // Rotate planets
  for (let i = 0; i < bg.planets.length; i++) {
    bg.planets[i].rotation.y += dt * bg.planetSpeeds[i];
  }

  // Slowly rotate wreck field
  bg.wreckInstances.rotation.y += dt * 0.005;
}

// ─── Starfield ───────────────────────────────────────────────

function createStarfield(rng: ReturnType<typeof createRNG>): THREE.Points {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);

  // Tint palette for stars
  const tints = [
    [1.0, 1.0, 1.0], // white
    [0.8, 0.9, 1.0], // blue-white
    [1.0, 0.95, 0.8], // warm white
    [0.6, 0.8, 1.0], // blue
    [1.0, 0.7, 0.5], // orange
  ];

  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform distribution on sphere surface
    const theta = rng.nextFloat() * Math.PI * 2;
    const phi = Math.acos(2 * rng.nextFloat() - 1);
    const r = STAR_RADIUS * (0.6 + rng.nextFloat() * 0.4);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Color
    const tint = tints[rng.nextInt(0, tints.length - 1)];
    const brightness = 0.4 + rng.nextFloat() * 0.6;
    colors[i * 3] = tint[0] * brightness;
    colors[i * 3 + 1] = tint[1] * brightness;
    colors[i * 3 + 2] = tint[2] * brightness;

    // Size
    sizes[i] = 0.5 + rng.nextFloat() * 1.5;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 0.15,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    fog: false, // Stars should NOT fade with fog
  });

  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false; // always render (surrounds camera)
  return points;
}

// ─── Planets ─────────────────────────────────────────────────

function createPlanets(rng: ReturnType<typeof createRNG>): {
  planets: THREE.Mesh[];
  speeds: number[];
} {
  const planets: THREE.Mesh[] = [];
  const speeds: number[] = [];

  // Planet color palette (dark, muted — meant to be semi-hidden in fog)
  const planetColors = [
    { base: 0x1a2a4a, emissive: 0x0a1020 }, // dark blue
    { base: 0x2a1a3a, emissive: 0x100818 }, // dark purple
    { base: 0x1a3a2a, emissive: 0x081810 }, // dark green
    { base: 0x3a2a1a, emissive: 0x181008 }, // dark brown
    { base: 0x2a2a3a, emissive: 0x101018 }, // dark grey-blue
  ];

  for (let i = 0; i < PLANET_COUNT; i++) {
    const radius =
      PLANET_MIN_SIZE + rng.nextFloat() * (PLANET_MAX_SIZE - PLANET_MIN_SIZE);
    const dist =
      PLANET_MIN_DIST + rng.nextFloat() * (PLANET_MAX_DIST - PLANET_MIN_DIST);

    // Use Icosahedron for cheap "planet" look
    const detail = radius > 5 ? 2 : 1;
    const geom = new THREE.IcosahedronGeometry(radius, detail);

    const colorDef = planetColors[rng.nextInt(0, planetColors.length - 1)];
    const mat = new THREE.MeshStandardMaterial({
      color: colorDef.base,
      emissive: colorDef.emissive,
      emissiveIntensity: 0.5,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
      fog: true,
    });

    const mesh = new THREE.Mesh(geom, mat);

    // Position on a sphere far away
    const theta = rng.nextFloat() * Math.PI * 2;
    const phi = 0.3 + rng.nextFloat() * 1.0; // keep above/below horizon
    mesh.position.set(
      dist * Math.sin(phi) * Math.cos(theta),
      dist * Math.cos(phi) - 10, // slightly below center
      dist * Math.sin(phi) * Math.sin(theta),
    );

    // Random tilt
    mesh.rotation.set(
      rng.nextFloat() * Math.PI,
      rng.nextFloat() * Math.PI,
      rng.nextFloat() * 0.5,
    );

    mesh.castShadow = false;
    mesh.receiveShadow = false;

    planets.push(mesh);
    speeds.push(0.01 + rng.nextFloat() * 0.02); // slow rotation
  }

  return { planets, speeds };
}

// ─── Wreck Silhouettes ───────────────────────────────────────

function createWreckSilhouettes(
  rng: ReturnType<typeof createRNG>,
): THREE.InstancedMesh {
  // Mix of simple shapes for silhouette variety
  const geom = new THREE.BoxGeometry(1, 0.3, 0.6);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x111118,
    emissive: 0x060810,
    emissiveIntensity: 0.3,
    roughness: 1.0,
    metalness: 0.3,
    flatShading: true,
    fog: true,
  });

  const mesh = new THREE.InstancedMesh(geom, mat, WRECK_SILHOUETTE_COUNT);
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new THREE.Object3D();

  for (let i = 0; i < WRECK_SILHOUETTE_COUNT; i++) {
    // Position in a wide ring
    const angle = rng.nextFloat() * Math.PI * 2;
    const dist =
      WRECK_RING_MIN + rng.nextFloat() * (WRECK_RING_MAX - WRECK_RING_MIN);
    const y = (rng.nextFloat() - 0.5) * 8; // vertical spread

    dummy.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);

    // Random rotation
    dummy.rotation.set(
      rng.nextFloat() * Math.PI * 2,
      rng.nextFloat() * Math.PI * 2,
      rng.nextFloat() * Math.PI * 2,
    );

    // Random scale (elongated debris look)
    const baseScale = 0.5 + rng.nextFloat() * 2.0;
    dummy.scale.set(
      baseScale * (0.5 + rng.nextFloat()),
      baseScale * (0.3 + rng.nextFloat() * 0.7),
      baseScale * (0.5 + rng.nextFloat()),
    );

    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
