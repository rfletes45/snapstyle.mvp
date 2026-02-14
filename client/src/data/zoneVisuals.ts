import type { ZoneId } from "../game/types";

export interface ZoneVisualPalette {
  ground: string;
  foliage: string;
  rock: string;
  wood: string;
  accent: string;
}

export interface ZoneVisualPreset {
  zoneId: ZoneId;
  label: string;
  fogColor: string;
  fogDensity: number;
  backgroundColor: string;
  ambientIntensity: number;
  ambientSkyColor: string;
  ambientGroundColor: string;
  directionalIntensity: number;
  directionalColor: string;
  directionalY: number;
  directionalX: number;
  directionalZ: number;
  waterColor: string;
  waterPulseColor: string;
  waterWaveAmplitude: number;
  waterWaveFrequency: number;
  waterEmissiveIntensity: number;
  palette: ZoneVisualPalette;
}

export const ZONE_VISUAL_PRESETS: Record<ZoneId, ZoneVisualPreset> = {
  beach: {
    zoneId: "beach",
    label: "Beach",
    fogColor: "#bfe8f2",
    fogDensity: 0.0037,
    backgroundColor: "#8ecfd8",
    ambientIntensity: 0.95,
    ambientSkyColor: "#fff0d8",
    ambientGroundColor: "#8ea68b",
    directionalIntensity: 1.14,
    directionalColor: "#fff3cb",
    directionalY: 35,
    directionalX: 26,
    directionalZ: -16,
    waterColor: "#4ec6d8",
    waterPulseColor: "#91ecff",
    waterWaveAmplitude: 0.028,
    waterWaveFrequency: 1.32,
    waterEmissiveIntensity: 0.055,
    palette: {
      ground: "#f4d8a2",
      foliage: "#4f7d2a",
      rock: "#94a3b8",
      wood: "#9d7a58",
      accent: "#f59e0b",
    },
  },
  river: {
    zoneId: "river",
    label: "River",
    fogColor: "#bad8c7",
    fogDensity: 0.0047,
    backgroundColor: "#a8ccb7",
    ambientIntensity: 0.86,
    ambientSkyColor: "#dcf4e4",
    ambientGroundColor: "#6f8668",
    directionalIntensity: 0.98,
    directionalColor: "#e2f2df",
    directionalY: 31,
    directionalX: 20,
    directionalZ: -9,
    waterColor: "#45b5e5",
    waterPulseColor: "#a0ebff",
    waterWaveAmplitude: 0.04,
    waterWaveFrequency: 1.56,
    waterEmissiveIntensity: 0.08,
    palette: {
      ground: "#8eb574",
      foliage: "#4f7d2a",
      rock: "#8f99a6",
      wood: "#8b6849",
      accent: "#22c55e",
    },
  },
  cave: {
    zoneId: "cave",
    label: "Cave",
    fogColor: "#25374e",
    fogDensity: 0.0105,
    backgroundColor: "#1f3042",
    ambientIntensity: 0.5,
    ambientSkyColor: "#99c8f0",
    ambientGroundColor: "#223042",
    directionalIntensity: 0.7,
    directionalColor: "#8dc0ec",
    directionalY: 24,
    directionalX: 18,
    directionalZ: -14,
    waterColor: "#35b8ec",
    waterPulseColor: "#8ddfff",
    waterWaveAmplitude: 0.05,
    waterWaveFrequency: 1.3,
    waterEmissiveIntensity: 0.095,
    palette: {
      ground: "#3f4a64",
      foliage: "#4e8d87",
      rock: "#4a5b77",
      wood: "#6b5c76",
      accent: "#67e8f9",
    },
  },
  volcano: {
    zoneId: "volcano",
    label: "Volcano",
    fogColor: "#68463a",
    fogDensity: 0.0078,
    backgroundColor: "#5d3f35",
    ambientIntensity: 0.64,
    ambientSkyColor: "#ffcf9e",
    ambientGroundColor: "#4e3931",
    directionalIntensity: 0.94,
    directionalColor: "#ffb57b",
    directionalY: 30,
    directionalX: 22,
    directionalZ: -12,
    waterColor: "#f08738",
    waterPulseColor: "#ffc490",
    waterWaveAmplitude: 0.033,
    waterWaveFrequency: 1.22,
    waterEmissiveIntensity: 0.08,
    palette: {
      ground: "#6d5a50",
      foliage: "#6b5c48",
      rock: "#69534c",
      wood: "#80593c",
      accent: "#f59e0b",
    },
  },
  oasis: {
    zoneId: "oasis",
    label: "Oasis",
    fogColor: "#d9f2cf",
    fogDensity: 0.0039,
    backgroundColor: "#d8f1c7",
    ambientIntensity: 0.98,
    ambientSkyColor: "#fff1c9",
    ambientGroundColor: "#88a47a",
    directionalIntensity: 1.1,
    directionalColor: "#fff0be",
    directionalY: 34,
    directionalX: 24,
    directionalZ: -18,
    waterColor: "#61deee",
    waterPulseColor: "#c6f8ff",
    waterWaveAmplitude: 0.046,
    waterWaveFrequency: 1.35,
    waterEmissiveIntensity: 0.09,
    palette: {
      ground: "#b8d692",
      foliage: "#5ea85f",
      rock: "#c7c2a6",
      wood: "#a57a4e",
      accent: "#facc15",
    },
  },
};
