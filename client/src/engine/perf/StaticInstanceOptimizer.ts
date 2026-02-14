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

    const source = group.meshes[0];
    const instanced = new THREE.InstancedMesh(
      group.geometry,
      group.material,
      group.meshes.length,
    );
    instanced.name = `instanced_${replacedGroups}_${source.name || "group"}`;
    instanced.castShadow = source.castShadow;
    instanced.receiveShadow = source.receiveShadow;
    instanced.frustumCulled = true;
    instanced.userData.instanceCandidate = true;
    instanced.userData.instanceGroupKey = group.groupKey;
    instanced.userData.meshCategory = source.userData.meshCategory ?? "instanced";
    if (source.userData.cullDistanceMultiplier !== undefined) {
      instanced.userData.cullDistanceMultiplier = source.userData.cullDistanceMultiplier;
    }
    instanced.renderOrder = source.renderOrder;

    const matrix = new THREE.Matrix4();
    const center = new THREE.Vector3();
    for (let index = 0; index < group.meshes.length; index += 1) {
      const mesh = group.meshes[index];
      mesh.updateMatrix();
      matrix.copy(mesh.matrix);
      instanced.setMatrixAt(index, matrix);
      center.add(mesh.position);
      mesh.parent?.remove(mesh);
      replacedMeshes += 1;
    }
    instanced.instanceMatrix.needsUpdate = true;
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
