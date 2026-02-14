/**
 * MaterialFactory — creates and caches THREE.MeshStandardMaterial from spec definitions.
 * Reuses a single material instance per ID across all modules.
 */
import * as THREE from "three";
import type { MaterialDef, StarforgeSpec } from "../types/schema";

export class MaterialFactory {
  private cache: Map<string, THREE.MeshStandardMaterial> = new Map();
  private palette: Record<string, string> = {};

  /** Initialize from the spec's materials array + palette. */
  init(spec: StarforgeSpec): void {
    this.palette = spec.style?.palette ?? {};

    for (const matDef of spec.materials) {
      this.createMaterial(matDef);
    }
  }

  private createMaterial(def: MaterialDef): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial();
    mat.name = def.id;

    // Base color from palette or a neutral gray
    const paletteKey = def.id
      .replace("Mat", "")
      .replace(/([A-Z])/g, (_, c) => c.toLowerCase());
    const colorHex = this.palette[paletteKey] ?? this.getDefaultColor(def.id);
    mat.color = new THREE.Color(colorHex);

    if (def.params.metalness !== undefined)
      mat.metalness = def.params.metalness;
    if (def.params.roughness !== undefined)
      mat.roughness = def.params.roughness;

    if (def.params.emissive) {
      mat.emissive = new THREE.Color(def.params.emissive);
      mat.emissiveIntensity = def.params.emissiveIntensity ?? 1.0;
      // For emissive materials, make the base color dark so emissive shows
      mat.color = new THREE.Color(0x111111);
    }

    this.cache.set(def.id, mat);
    return mat;
  }

  private getDefaultColor(id: string): string {
    switch (id) {
      case "MatMetalDark":
        return "#1f232a";
      case "MatMetalLight":
        return "#a6adb8";
      case "MatPlastic":
        return "#3a3e48";
      case "MatEmissiveCyan":
        return "#111111";
      case "MatEmissiveOrange":
        return "#111111";
      case "MatAnomalyMagenta":
        return "#111111";
      default:
        return "#888888";
    }
  }

  /** Get a cached material by ID. Returns a fallback if not found. */
  get(id: string): THREE.MeshStandardMaterial {
    const mat = this.cache.get(id);
    if (!mat) {
      console.warn(`MaterialFactory: unknown material "${id}", using fallback`);
      return this.getFallback();
    }
    return mat;
  }

  /** Clone a material (for per-instance emissive control). */
  getClone(id: string): THREE.MeshStandardMaterial {
    const base = this.get(id);
    const clone = base.clone();
    clone.name = `${id}_clone`;
    return clone;
  }

  /** Check if a material ID is emissive. */
  isEmissive(id: string): boolean {
    const mat = this.cache.get(id);
    if (!mat) return false;
    return mat.emissiveIntensity > 0 && mat.emissive.getHex() !== 0;
  }

  private _fallback?: THREE.MeshStandardMaterial;
  private getFallback(): THREE.MeshStandardMaterial {
    if (!this._fallback) {
      this._fallback = new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        wireframe: true,
      });
      this._fallback.name = "FALLBACK";
    }
    return this._fallback;
  }

  /** Allow toggling wireframe on all materials. */
  setWireframe(enabled: boolean): void {
    for (const mat of this.cache.values()) {
      mat.wireframe = enabled;
    }
  }

  dispose(): void {
    for (const mat of this.cache.values()) {
      mat.dispose();
    }
    this.cache.clear();
  }
}

/** Singleton instance. */
export const materialFactory = new MaterialFactory();
