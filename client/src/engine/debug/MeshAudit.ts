import * as THREE from "three";

interface MaterialState {
  side: THREE.Side;
  wireframe: boolean;
}

type AuditSeverity = "warning" | "critical";

const PROTECTED_WATER_NAMES = new Set(["water", "waterfall", "foam"]);

function includesAny(source: string, tokens: Set<string>): boolean {
  const lower = source.toLowerCase();
  for (const token of tokens) {
    if (lower.includes(token)) {
      return true;
    }
  }
  return false;
}

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
      const nameSuggestsWater = includesAny(meshName, PROTECTED_WATER_NAMES);
      const isWater = category === "water" || nameSuggestsWater;

      const isPlane = geometryType.includes("Plane");
      if (isPlane && !isWater) {
        this.warnOnce(
          `mesh:${obj.uuid}:plane`,
          "critical",
          `PlaneGeometry on non-water mesh "${meshName}" [category=${category}]. Use closed geometry.`,
        );
      }

      const geometryParams = (obj.geometry as unknown as { parameters?: Record<string, unknown> })
        .parameters;
      if (geometryParams && geometryType.includes("Box")) {
        const width = Number(geometryParams.width ?? 0);
        const height = Number(geometryParams.height ?? 0);
        const depth = Number(geometryParams.depth ?? 0);
        const minDim = Math.min(width, height, depth);
        if (!isWater && minDim > 0 && minDim < 0.06) {
          this.warnOnce(
            `mesh:${obj.uuid}:thin_box`,
            "warning",
            `Very thin BoxGeometry on "${meshName}" [category=${category}] may look like a plane from below.`,
          );
        }
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
