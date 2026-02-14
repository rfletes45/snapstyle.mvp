import * as THREE from "three";
import { ZONE_VISUAL_PRESETS, type ZoneVisualPreset } from "../../data/zoneVisuals";
import type { ZoneId } from "../../game/types";

interface WaterRef {
  mesh: THREE.Mesh;
  baseY: number;
  zone: ZoneId;
}

function lerpColor(target: THREE.Color, to: string, alpha: number): void {
  target.lerp(new THREE.Color(to), alpha);
}

export class ZoneVisualController {
  private readonly ambientLight: THREE.HemisphereLight | null;
  private readonly directionalLight: THREE.DirectionalLight | null;
  private readonly waterMeshes: WaterRef[] = [];

  private activePreset: ZoneVisualPreset;
  private targetPreset: ZoneVisualPreset;

  constructor(private readonly scene: THREE.Scene) {
    this.ambientLight =
      this.scene.children.find(
        (child): child is THREE.HemisphereLight => child instanceof THREE.HemisphereLight,
      ) ?? null;
    this.directionalLight =
      this.scene.children.find(
        (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight,
      ) ?? null;

    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) {
        return;
      }
      const zone = obj.userData.waterZone as ZoneId | undefined;
      if (!zone) {
        return;
      }
      this.waterMeshes.push({
        mesh: obj,
        baseY: obj.position.y,
        zone,
      });
    });

    this.activePreset = ZONE_VISUAL_PRESETS.beach;
    this.targetPreset = this.activePreset;
    this.applyImmediate(this.activePreset);
  }

  setZone(zoneId: ZoneId): void {
    this.targetPreset = ZONE_VISUAL_PRESETS[zoneId] ?? ZONE_VISUAL_PRESETS.beach;
  }

  update(dtSeconds: number, elapsedSeconds: number): void {
    const smoothing = Math.min(1, dtSeconds * 2.8);
    const preset = this.targetPreset;

    if (this.scene.fog instanceof THREE.FogExp2) {
      lerpColor(this.scene.fog.color, preset.fogColor, smoothing);
      this.scene.fog.density = THREE.MathUtils.lerp(
        this.scene.fog.density,
        preset.fogDensity,
        smoothing,
      );
    } else {
      this.scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
    }

    const sceneBg =
      this.scene.background instanceof THREE.Color
        ? this.scene.background
        : new THREE.Color(preset.backgroundColor);
    lerpColor(sceneBg, preset.backgroundColor, smoothing);
    this.scene.background = sceneBg;

    if (this.ambientLight) {
      this.ambientLight.intensity = THREE.MathUtils.lerp(
        this.ambientLight.intensity,
        preset.ambientIntensity,
        smoothing,
      );
      lerpColor(this.ambientLight.color, preset.ambientSkyColor, smoothing);
      lerpColor(this.ambientLight.groundColor, preset.ambientGroundColor, smoothing);
    }

    if (this.directionalLight) {
      this.directionalLight.intensity = THREE.MathUtils.lerp(
        this.directionalLight.intensity,
        preset.directionalIntensity,
        smoothing,
      );
      lerpColor(this.directionalLight.color, preset.directionalColor, smoothing);
      this.directionalLight.position.x = THREE.MathUtils.lerp(
        this.directionalLight.position.x,
        preset.directionalX,
        smoothing,
      );
      this.directionalLight.position.y = THREE.MathUtils.lerp(
        this.directionalLight.position.y,
        preset.directionalY,
        smoothing,
      );
      this.directionalLight.position.z = THREE.MathUtils.lerp(
        this.directionalLight.position.z,
        preset.directionalZ,
        smoothing,
      );
    }

    for (const water of this.waterMeshes) {
      const material = water.mesh.material;
      const zonePreset = ZONE_VISUAL_PRESETS[water.zone] ?? preset;
      if (material instanceof THREE.MeshStandardMaterial) {
        const blend = water.zone === preset.zoneId ? 0.08 : 0.03;
        lerpColor(material.color, zonePreset.waterColor, blend);
        lerpColor(material.emissive, zonePreset.waterPulseColor, blend * 0.7);
        material.emissiveIntensity = THREE.MathUtils.lerp(
          material.emissiveIntensity,
          zonePreset.waterEmissiveIntensity,
          blend,
        );
      }

      const freq = zonePreset.waterWaveFrequency;
      const amp = zonePreset.waterWaveAmplitude;
      water.mesh.position.y =
        water.baseY + Math.sin(elapsedSeconds * freq + water.baseY * 9.7) * amp;
    }

    this.activePreset = preset;
  }

  private applyImmediate(preset: ZoneVisualPreset): void {
    this.scene.background = new THREE.Color(preset.backgroundColor);
    this.scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);

    if (this.ambientLight) {
      this.ambientLight.intensity = preset.ambientIntensity;
      this.ambientLight.color.set(preset.ambientSkyColor);
      this.ambientLight.groundColor.set(preset.ambientGroundColor);
    }

    if (this.directionalLight) {
      this.directionalLight.intensity = preset.directionalIntensity;
      this.directionalLight.color.set(preset.directionalColor);
      this.directionalLight.position.set(
        preset.directionalX,
        preset.directionalY,
        preset.directionalZ,
      );
    }

    for (const water of this.waterMeshes) {
      const material = water.mesh.material;
      if (material instanceof THREE.MeshStandardMaterial) {
        const zonePreset = ZONE_VISUAL_PRESETS[water.zone];
        material.color.set(zonePreset.waterColor);
        material.emissive.set(zonePreset.waterPulseColor);
        material.emissiveIntensity = zonePreset.waterEmissiveIntensity;
      }
    }
  }
}
