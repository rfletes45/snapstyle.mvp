import type { GraphicsQuality } from "../game/types";

export interface QualityPreset {
  id: GraphicsQuality;
  label: string;
  maxPixelRatio: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  particleMax: number;
  vfxEnabled: boolean;
  worldCullDistance: number;
  renderFar: number;
  propDensity: number;
  antiAlias: boolean;
}

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityPreset> = {
  low: {
    id: "low",
    label: "Low",
    maxPixelRatio: 1,
    shadowsEnabled: false,
    shadowMapSize: 512,
    particleMax: 60,
    vfxEnabled: false,
    worldCullDistance: 95,
    renderFar: 180,
    propDensity: 0.6,
    antiAlias: false
  },
  medium: {
    id: "medium",
    label: "Medium",
    maxPixelRatio: 1.5,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    particleMax: 120,
    vfxEnabled: true,
    worldCullDistance: 140,
    renderFar: 240,
    propDensity: 1,
    antiAlias: true
  },
  high: {
    id: "high",
    label: "High",
    maxPixelRatio: 2,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    particleMax: 220,
    vfxEnabled: true,
    worldCullDistance: 220,
    renderFar: 320,
    propDensity: 1.35,
    antiAlias: true
  }
};

export function getQualityPreset(quality: GraphicsQuality): QualityPreset {
  return QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.medium;
}
