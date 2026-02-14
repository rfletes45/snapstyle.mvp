import * as THREE from "three";

interface CullingEntry {
  object: THREE.Object3D;
  center: THREE.Vector3;
  debugMarker: THREE.Mesh;
  multiplier: number;
  category: string;
}

const CATEGORY_DISTANCE_MULTIPLIER: Record<string, number> = {
  terrain: 1.55,
  landmark: 1.45,
  structure: 1.18,
  rock: 1.12,
  foliage: 0.95,
  prop: 0.88,
  poi_marker: 0.82,
  challenge: 1,
  debug: 2,
};

function getCategoryMultiplier(object: THREE.Object3D): number {
  const manual = object.userData.cullDistanceMultiplier;
  if (typeof manual === "number" && Number.isFinite(manual)) {
    return manual;
  }
  const category = String(object.userData.meshCategory ?? "generic");
  return CATEGORY_DISTANCE_MULTIPLIER[category] ?? 1;
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

      this.entries.push({
        object: obj,
        center,
        debugMarker: marker,
        multiplier: getCategoryMultiplier(obj),
        category: String(obj.userData.meshCategory ?? "generic"),
      });
    });
  }

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    for (const entry of this.entries) {
      entry.debugMarker.visible = enabled;
    }
  }

  update(playerPosition: THREE.Vector3, cullDistance: number): void {
    for (const entry of this.entries) {
      const distanceSq = entry.center.distanceToSquared(playerPosition);
      const threshold = cullDistance * entry.multiplier;
      const isVisible = distanceSq <= threshold * threshold;
      entry.object.visible = isVisible;

      if (!this.debugEnabled) {
        continue;
      }
      const markerMaterial = entry.debugMarker.material as THREE.MeshBasicMaterial;
      markerMaterial.color.set(isVisible ? "#22c55e" : "#ef4444");
      markerMaterial.opacity = isVisible ? 0.75 : 0.45;
      entry.debugMarker.visible = true;
      entry.debugMarker.scale.setScalar(entry.multiplier);
      entry.debugMarker.userData.category = entry.category;
    }
  }
}
