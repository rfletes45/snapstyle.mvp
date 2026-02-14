/**
 * RepeatPatterns — computes positions for repeated part instances.
 * Supported: line, grid, stack, circle, orbit, randomDisk, single.
 */
import * as THREE from "three";
import type { PatternDef, Vec3 } from "../types/schema";

export interface PatternInstance {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  index: number;
}

/** Simple seeded PRNG (mulberry32). */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computePatternPositions(
  pattern: PatternDef,
  count: number,
): PatternInstance[] {
  switch (pattern.type) {
    case "line":
      return computeLine(pattern, count);
    case "grid":
      return computeGrid(pattern, count);
    case "stack":
      return computeStack(pattern, count);
    case "circle":
      return computeCircle(pattern, count);
    case "orbit":
      return computeOrbit(pattern, count);
    case "randomDisk":
      return computeRandomDisk(pattern, count);
    case "single":
      return computeSingle(pattern, count);
    default:
      console.error(
        `RepeatPatterns: unknown pattern type "${(pattern as PatternDef).type}"`,
      );
      // Fallback: stack vertically
      return Array.from({ length: count }, (_, i) => ({
        position: new THREE.Vector3(0, i * 0.2, 0),
        rotation: new THREE.Euler(),
        index: i,
      }));
  }
}

function v3(arr: Vec3): THREE.Vector3 {
  return new THREE.Vector3(arr[0], arr[1], arr[2]);
}

function computeLine(
  p: { start: Vec3; step: Vec3 },
  count: number,
): PatternInstance[] {
  const start = v3(p.start);
  const step = v3(p.step);
  return Array.from({ length: count }, (_, i) => ({
    position: start.clone().addScaledVector(step, i),
    rotation: new THREE.Euler(),
    index: i,
  }));
}

function computeGrid(
  p: {
    origin: Vec3;
    rows: number;
    cols: number;
    step: Vec3;
  },
  count: number,
): PatternInstance[] {
  const origin = v3(p.origin);
  const rows = p.rows ?? 1;
  const cols = p.cols ?? count;
  const stepX = p.step[0];
  const stepZ = p.step[2];
  const instances: PatternInstance[] = [];
  let idx = 0;
  for (let row = 0; row < rows && idx < count; row++) {
    for (let col = 0; col < cols && idx < count; col++) {
      const pos = origin.clone();
      pos.x += col * stepX;
      pos.z += row * stepZ;
      instances.push({
        position: pos,
        rotation: new THREE.Euler(),
        index: idx,
      });
      idx++;
    }
  }
  return instances;
}

function computeStack(
  p: { start: Vec3; step: Vec3 },
  count: number,
): PatternInstance[] {
  // Same logic as line
  return computeLine(p, count);
}

function computeCircle(
  p: { center: Vec3; radius: number; axis?: Vec3 },
  count: number,
): PatternInstance[] {
  const center = v3(p.center);
  const r = p.radius;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const pos = center.clone();
    pos.x += Math.cos(angle) * r;
    pos.z += Math.sin(angle) * r;
    const rot = new THREE.Euler(0, -angle, 0);
    return { position: pos, rotation: rot, index: i };
  });
}

function computeOrbit(
  p: {
    center: Vec3;
    radius: [number, number] | number;
    height?: [number, number];
    phaseSeed?: number;
  },
  count: number,
): PatternInstance[] {
  const center = v3(p.center);
  const rng = seededRandom(p.phaseSeed ?? 42);
  const rMin = Array.isArray(p.radius) ? p.radius[0] : p.radius;
  const rMax = Array.isArray(p.radius) ? p.radius[1] : p.radius;
  const hMin = p.height ? p.height[0] : center.y;
  const hMax = p.height ? p.height[1] : center.y;

  return Array.from({ length: count }, (_, i) => {
    const phase = rng() * Math.PI * 2;
    const r = rMin + rng() * (rMax - rMin);
    const h = hMin + rng() * (hMax - hMin);
    const pos = new THREE.Vector3(
      center.x + Math.cos(phase) * r,
      h,
      center.z + Math.sin(phase) * r,
    );
    return { position: pos, rotation: new THREE.Euler(0, -phase, 0), index: i };
  });
}

function computeRandomDisk(
  p: { center: Vec3; radius: number; seed?: number },
  count: number,
): PatternInstance[] {
  const center = v3(p.center);
  const rng = seededRandom(p.seed ?? 123);
  return Array.from({ length: count }, (_, i) => {
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * p.radius;
    const pos = center.clone();
    pos.x += Math.cos(angle) * dist;
    pos.z += Math.sin(angle) * dist;
    return {
      position: pos,
      rotation: new THREE.Euler(0, rng() * Math.PI * 2, 0),
      index: i,
    };
  });
}

function computeSingle(
  _p: { pos?: Vec3; rot?: Vec3; scale?: Vec3 },
  count: number,
): PatternInstance[] {
  const pos = _p.pos ? v3(_p.pos) : new THREE.Vector3();
  const rot = _p.rot
    ? new THREE.Euler(_p.rot[0], _p.rot[1], _p.rot[2])
    : new THREE.Euler();
  return Array.from({ length: count }, (_, i) => ({
    position: pos.clone(),
    rotation: rot.clone(),
    index: i,
  }));
}
