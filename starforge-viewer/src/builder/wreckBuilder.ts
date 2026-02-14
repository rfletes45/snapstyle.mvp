/**
 * WreckBuilder — builds wreck archetype modules.
 * Handles tier inheritance (inherit:tier1 + add).
 */
import * as THREE from "three";
import { createGeometry } from "../geometry/geometryFactory";
import { materialFactory } from "../materials/materialFactory";
import type {
  BuiltModule,
  DecalDef,
  ModuleDef,
  PartDef,
  WeakpointDef,
  WreckTierDef,
} from "../types/schema";

/**
 * Build a wreck archetype at a specific tier.
 */
export function buildWreck(
  mod: ModuleDef,
  archetypeName: string,
  tierNum: number,
): BuiltModule | null {
  if (!mod.archetypes) {
    console.error(`WreckBuilder: module ${mod.code} has no archetypes`);
    return null;
  }

  const archetype = mod.archetypes[archetypeName];
  if (!archetype) {
    console.error(
      `WreckBuilder: unknown archetype "${archetypeName}" in ${mod.code}`,
    );
    return null;
  }

  // Resolve tier inheritance by collecting parts from tier 1 up to requested tier
  const resolvedParts: PartDef[] = [];
  const resolvedDecals: DecalDef[] = [];
  const resolvedWeakpoints: WeakpointDef[] = [];

  for (let t = 1; t <= tierNum; t++) {
    const tierKey = String(t);
    const tierDef = archetype.tiers[tierKey] as WreckTierDef | undefined;
    if (!tierDef) continue;

    // Parts
    if (Array.isArray(tierDef.parts)) {
      // Tier 1 has direct parts array
      resolvedParts.push(...tierDef.parts);
    }
    if (tierDef.addParts) {
      resolvedParts.push(...tierDef.addParts);
    }

    // Decals
    if (Array.isArray(tierDef.decals)) {
      resolvedDecals.push(...tierDef.decals);
    }
    if (tierDef.addDecals) {
      resolvedDecals.push(...tierDef.addDecals);
    }

    // Weakpoints
    if (tierDef.weakpoints) {
      resolvedWeakpoints.push(...tierDef.weakpoints);
    }
    if (tierDef.weakpointsAdd) {
      resolvedWeakpoints.push(...tierDef.weakpointsAdd);
    }
  }

  // Build the THREE.Group
  const group = new THREE.Group();
  group.name = `MOD_${mod.code}_${archetypeName}`;

  const parts = new Map<string, THREE.Object3D>();
  const anchors = new Map<string, THREE.Object3D>();
  const connectors = new Map<string, THREE.Object3D>();

  // Build parts
  for (let i = 0; i < resolvedParts.length; i++) {
    const part = resolvedParts[i];
    if (!part.geom) continue;

    const geom = createGeometry(part.geom);
    const matId = part.mat ?? "MatMetalDark";
    const mat = materialFactory.isEmissive(matId)
      ? materialFactory.getClone(matId)
      : materialFactory.get(matId);

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `${part.name}_${i}`;
    mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
    mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    group.add(mesh);
    parts.set(mesh.name, mesh);
  }

  // Build weakpoints as invisible markers + small emissive seams
  for (const wp of resolvedWeakpoints) {
    const marker = new THREE.Object3D();
    marker.name = `weakpoint_${wp.name}`;
    marker.position.set(wp.pos[0], wp.pos[1], wp.pos[2]);
    marker.userData = { weakpoint: true, reward: wp.reward, radius: wp.radius };
    group.add(marker);
    anchors.set(`wp_${wp.name}`, marker);

    // Small emissive seam ring at weakpoint
    const ringGeom = new THREE.TorusGeometry(wp.radius, 0.008, 8, 16);
    const ringMat = materialFactory.getClone("MatEmissiveCyan");
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.name = `weakpointRing_${wp.name}`;
    ring.position.set(wp.pos[0], wp.pos[1], wp.pos[2]);
    ring.rotation.set(Math.PI / 2, 0, 0);
    group.add(ring);
    parts.set(ring.name, ring);
  }

  // Build decals
  buildDecals(resolvedDecals, group, parts);

  // Add hitPoint anchor for shared VFX
  const hitPoint = new THREE.Object3D();
  hitPoint.name = "anchor_hitPoint";
  hitPoint.position.set(0, 0.3, 0);
  group.add(hitPoint);
  anchors.set("hitPoint", hitPoint);

  return {
    group,
    parts,
    anchors,
    connectors,
    animations: [],
    vfx: mod.sharedVfx ?? [],
    interactionVolumes: [],
    moduleDef: mod,
    tier: tierNum,
  };
}

function buildDecals(
  decals: DecalDef[],
  parent: THREE.Group,
  parts: Map<string, THREE.Object3D>,
): void {
  for (const decal of decals) {
    // Decals are small offset planes with a colored material
    const geom = new THREE.PlaneGeometry(decal.size[0], decal.size[1]);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      emissive: 0x222222,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    mat.name = `decal_${decal.id}`;

    // Color based on decal type
    if (decal.id.includes("WARNING")) {
      mat.color = new THREE.Color(0xffaa00);
      mat.emissive = new THREE.Color(0x332200);
    } else if (decal.id.includes("PANEL")) {
      mat.color = new THREE.Color(0x333344);
      mat.emissive = new THREE.Color(0x111122);
    } else if (decal.id.includes("SCRATCHES")) {
      mat.color = new THREE.Color(0x555555);
      mat.opacity = 0.3;
    } else if (decal.id.includes("SERIAL")) {
      mat.color = new THREE.Color(0xcccccc);
      mat.opacity = 0.4;
    } else if (decal.id.includes("BOLT")) {
      mat.color = new THREE.Color(0x888888);
      mat.opacity = 0.6;
    }

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `decal_${decal.id}`;
    mesh.position.set(decal.pos[0], decal.pos[1], decal.pos[2]);
    mesh.rotation.set(decal.rot[0], decal.rot[1], decal.rot[2]);
    mesh.renderOrder = 1;

    parent.add(mesh);
    parts.set(mesh.name, mesh);
  }
}

/** Get all archetype names for a wreck-type module. */
export function getWreckArchetypes(mod: ModuleDef): string[] {
  return mod.archetypes ? Object.keys(mod.archetypes) : [];
}

/** Get available tier numbers for a wreck archetype. */
export function getWreckTiers(mod: ModuleDef, archetype: string): number[] {
  if (!mod.archetypes?.[archetype]) return [];
  return Object.keys(mod.archetypes[archetype].tiers).map(Number).sort();
}
