/**
 * PrefabBuilder — instantiates prefab definitions into THREE.Group objects.
 * Handles prefab part creation, anchors, and pattern-based instancing.
 */
import * as THREE from "three";
import { createGeometry } from "../geometry/geometryFactory";
import { computePatternPositions } from "../geometry/repeatPatterns";
import { materialFactory } from "../materials/materialFactory";
import type { PartDef, PrefabDef, PrefabInstanceDef } from "../types/schema";

/**
 * Build a single prefab instance as a THREE.Group.
 */
export function buildPrefab(
  prefabDef: PrefabDef,
  namedParts: Map<string, THREE.Object3D>,
  namedAnchors: Map<string, THREE.Object3D>,
  prefabInstanceName: string,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `prefab_${prefabInstanceName}`;

  for (const part of prefabDef.parts) {
    if (!part.geom) continue;
    const geom = createGeometry(part.geom);
    const mat = materialFactory.isEmissive(part.mat ?? "")
      ? materialFactory.getClone(part.mat!)
      : materialFactory.get(part.mat ?? "MatMetalDark");

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = part.name;
    mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
    mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);

    // Handle plane double-sided
    if (part.geom.type === "plane" && part.geom.doubleSided) {
      (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    }
    if (
      part.geom.type === "plane" &&
      part.geom.alpha !== undefined &&
      part.geom.alpha < 1
    ) {
      (mat as THREE.MeshStandardMaterial).transparent = true;
      (mat as THREE.MeshStandardMaterial).opacity = part.geom.alpha;
    }

    group.add(mesh);
    namedParts.set(`${prefabInstanceName}:${part.name}`, mesh);
  }

  // Anchors
  if (prefabDef.anchors) {
    for (const anchor of prefabDef.anchors) {
      const anchorObj = new THREE.Object3D();
      anchorObj.name = `anchor_${anchor.name}`;
      anchorObj.position.set(anchor.pos[0], anchor.pos[1], anchor.pos[2]);
      group.add(anchorObj);
      namedAnchors.set(`${prefabInstanceName}:${anchor.name}`, anchorObj);
    }
  }

  return group;
}

/**
 * Build all prefab instances for a tier, applying patterns.
 */
export function buildPrefabInstances(
  instances: PrefabInstanceDef[],
  prefabs: Record<string, PrefabDef>,
  namedParts: Map<string, THREE.Object3D>,
  namedAnchors: Map<string, THREE.Object3D>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "prefabInstances";

  for (const inst of instances) {
    const prefabDef = prefabs[inst.prefab];
    if (!prefabDef) {
      console.error(`PrefabBuilder: unknown prefab "${inst.prefab}"`);
      continue;
    }

    const count = inst.count ?? 1;

    // Extract addParts from overrides
    const addParts = (inst.overrides as Record<string, unknown>)?.addParts as
      | PartDef[]
      | undefined;

    if (inst.pattern && count > 1) {
      const positions = computePatternPositions(inst.pattern, count);
      for (const pi of positions) {
        const prefabGroup = buildPrefab(
          prefabDef,
          namedParts,
          namedAnchors,
          `${inst.name}_${pi.index}`,
        );
        // Append addParts from overrides
        if (addParts) {
          appendAddParts(
            prefabGroup,
            addParts,
            namedParts,
            `${inst.name}_${pi.index}`,
          );
        }
        prefabGroup.position.copy(pi.position);
        prefabGroup.rotation.copy(pi.rotation);
        group.add(prefabGroup);
      }
    } else {
      const prefabGroup = buildPrefab(
        prefabDef,
        namedParts,
        namedAnchors,
        inst.name,
      );
      if (addParts) {
        appendAddParts(prefabGroup, addParts, namedParts, inst.name);
      }
      group.add(prefabGroup);
    }
  }

  return group;
}

/**
 * Append additional parts from prefabInstance overrides.addParts
 */
function appendAddParts(
  prefabGroup: THREE.Group,
  addParts: PartDef[],
  namedParts: Map<string, THREE.Object3D>,
  instanceName: string,
): void {
  for (const part of addParts) {
    if (!part.geom) continue;
    const geom = createGeometry(part.geom);
    const mat = materialFactory.isEmissive(part.mat ?? "")
      ? materialFactory.getClone(part.mat!)
      : materialFactory.get(part.mat ?? "MatMetalDark");

    if (
      part.geom.type === "plane" &&
      (part.geom as { doubleSided?: boolean }).doubleSided
    ) {
      (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    }

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = part.name;
    mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
    mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    prefabGroup.add(mesh);
    namedParts.set(`${instanceName}:${part.name}`, mesh);
  }
}
