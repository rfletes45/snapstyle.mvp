/**
 * Three.js Geometry Helpers
 *
 * Reusable geometry primitives and materials for the play system's 3D visuals.
 * All geometries are created procedurally (no external models needed).
 *
 * @module components/three/geometries
 */

import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
} from "three";

// =============================================================================
// Game Icon Shapes — 3D representations of game emojis/icons
// =============================================================================

/**
 * Create a 3D game piece mesh based on game category
 */
export function createGamePieceMesh(
  category: "quick_play" | "puzzle" | "multiplayer" | "daily",
  color: string,
  size: number = 1,
): Mesh {
  let geometry: BufferGeometry;
  const material = new MeshStandardMaterial({
    color,
    metalness: 0.3,
    roughness: 0.4,
  });

  switch (category) {
    case "quick_play":
      // Lightning bolt approximation — octahedron
      geometry = new OctahedronGeometry(size * 0.6, 0);
      break;
    case "puzzle":
      // Cube for puzzle
      geometry = new BoxGeometry(size * 0.8, size * 0.8, size * 0.8);
      break;
    case "multiplayer":
      // Sphere for multiplayer (represents togetherness)
      geometry = new IcosahedronGeometry(size * 0.6, 1);
      break;
    case "daily":
      // Star shape — dodecahedron
      geometry = new DodecahedronGeometry(size * 0.6, 0);
      break;
    default:
      geometry = new SphereGeometry(size * 0.5, 16, 16);
  }

  return new Mesh(geometry, material);
}

/**
 * Create a floating gem/crystal mesh for invite cards
 */
export function createGemMesh(color: string, size: number = 0.5): Mesh {
  const geometry = new OctahedronGeometry(size, 0);
  const material = new MeshPhongMaterial({
    color,
    shininess: 100,
    specular: 0xffffff,
    transparent: true,
    opacity: 0.9,
  });
  return new Mesh(geometry, material);
}

/**
 * Create a trophy mesh (cone + cylinder base)
 */
export function createTrophyMesh(
  color: string = "#FFD700",
  size: number = 1,
): Mesh {
  const cupGeometry = new CylinderGeometry(
    size * 0.4,
    size * 0.25,
    size * 0.6,
    8,
  );
  const material = new MeshStandardMaterial({
    color,
    metalness: 0.8,
    roughness: 0.2,
  });
  return new Mesh(cupGeometry, material);
}

/**
 * Create a card mesh (flat box)
 */
export function createCardMesh(
  color: string,
  width: number = 1,
  height: number = 1.4,
): Mesh {
  const geometry = new BoxGeometry(width, height, 0.02);
  const material = new MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.6,
  });
  return new Mesh(geometry, material);
}

/**
 * Create a ring/halo effect mesh
 */
export function createRingMesh(
  color: string,
  innerRadius: number = 0.8,
  outerRadius: number = 1.0,
): Mesh {
  const geometry = new RingGeometry(innerRadius, outerRadius, 32);
  const material = new MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.6,
    side: 2, // DoubleSide
  });
  return new Mesh(geometry, material);
}

/**
 * Create a dice-like cube mesh with rounded feel
 */
export function createDiceMesh(color: string, size: number = 0.5): Mesh {
  const geometry = new BoxGeometry(size, size, size, 2, 2, 2);
  const material = new MeshStandardMaterial({
    color,
    metalness: 0.1,
    roughness: 0.3,
  });
  return new Mesh(geometry, material);
}

/**
 * Create a torus (donut) mesh for loading/progress indicators
 */
export function createTorusMesh(
  color: string,
  radius: number = 0.5,
  tubeRadius: number = 0.15,
): Mesh {
  const geometry = new TorusGeometry(radius, tubeRadius, 16, 32);
  const material = new MeshStandardMaterial({
    color,
    metalness: 0.4,
    roughness: 0.3,
  });
  return new Mesh(geometry, material);
}

/**
 * Create a torus knot mesh for decorative elements
 */
export function createKnotMesh(color: string, radius: number = 0.4): Mesh {
  const geometry = new TorusKnotGeometry(radius, radius * 0.3, 64, 16);
  const material = new MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.2,
  });
  return new Mesh(geometry, material);
}

// =============================================================================
// Particle System Helpers
// =============================================================================

/**
 * Create a buffer geometry with random point positions for a particle field
 */
export function createParticleField(
  count: number,
  spread: number = 10,
): BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * spread;
    positions[i3 + 1] = (Math.random() - 0.5) * spread;
    positions[i3 + 2] = (Math.random() - 0.5) * spread;

    // Warm white-ish colors
    colors[i3] = 0.8 + Math.random() * 0.2;
    colors[i3 + 1] = 0.7 + Math.random() * 0.3;
    colors[i3 + 2] = 0.5 + Math.random() * 0.5;

    sizes[i] = Math.random() * 2 + 0.5;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setAttribute("size", new Float32BufferAttribute(sizes, 1));

  return geometry;
}

// =============================================================================
// Animation Helpers
// =============================================================================

/**
 * Smoothly rotate a mesh toward a target rotation
 */
export function lerpRotation(
  mesh: Mesh,
  targetX: number,
  targetY: number,
  targetZ: number,
  speed: number = 0.05,
): void {
  mesh.rotation.x += (targetX - mesh.rotation.x) * speed;
  mesh.rotation.y += (targetY - mesh.rotation.y) * speed;
  mesh.rotation.z += (targetZ - mesh.rotation.z) * speed;
}

/**
 * Float a mesh up and down with sine wave
 */
export function floatMesh(
  mesh: Mesh,
  time: number,
  amplitude: number = 0.1,
  frequency: number = 1,
  baseY: number = 0,
): void {
  mesh.position.y = baseY + Math.sin(time * frequency) * amplitude;
}

/**
 * Pulse the scale of a mesh
 */
export function pulseMesh(
  mesh: Mesh,
  time: number,
  baseScale: number = 1,
  amplitude: number = 0.05,
  frequency: number = 2,
): void {
  const s = baseScale + Math.sin(time * frequency) * amplitude;
  mesh.scale.set(s, s, s);
}
