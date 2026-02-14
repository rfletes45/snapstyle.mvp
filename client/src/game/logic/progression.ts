import { FISH_BY_ZONE } from "../../data/fish";
import type { BestiaryEntry, SaveData, ZoneId } from "../types";

export const ZONE_GATE_THRESHOLD = 8;

export interface ZoneProgress {
  zoneId: ZoneId;
  discoveredUnique: number;
  total: number;
  percent: number;
}

function countDiscoveredForZone(
  bestiary: Record<string, BestiaryEntry>,
  zoneId: ZoneId,
): number {
  const fishList = FISH_BY_ZONE[zoneId] ?? [];
  return fishList.reduce((sum, fish) => {
    const entry = bestiary[fish.id];
    return sum + (entry?.discovered ? 1 : 0);
  }, 0);
}

export function getZoneProgress(
  saveData: SaveData,
  zoneId: ZoneId,
): ZoneProgress {
  const total = FISH_BY_ZONE[zoneId]?.length ?? 0;
  const discoveredUnique = countDiscoveredForZone(saveData.bestiary, zoneId);
  return {
    zoneId,
    discoveredUnique,
    total,
    percent: total > 0 ? (discoveredUnique / total) * 100 : 0,
  };
}

export function isVolcanoUnlocked(saveData: SaveData): boolean {
  const beach = getZoneProgress(saveData, "beach").discoveredUnique;
  const river = getZoneProgress(saveData, "river").discoveredUnique;
  return beach >= ZONE_GATE_THRESHOLD && river >= ZONE_GATE_THRESHOLD;
}

export function isOasisUnlocked(saveData: SaveData): boolean {
  const beach = getZoneProgress(saveData, "beach").discoveredUnique;
  const river = getZoneProgress(saveData, "river").discoveredUnique;
  const cave = getZoneProgress(saveData, "cave").discoveredUnique;
  const volcano = getZoneProgress(saveData, "volcano").discoveredUnique;
  return (
    beach >= ZONE_GATE_THRESHOLD &&
    river >= ZONE_GATE_THRESHOLD &&
    cave >= ZONE_GATE_THRESHOLD &&
    volcano >= ZONE_GATE_THRESHOLD
  );
}

export function getVolcanoChecklist(saveData: SaveData): {
  beachUnique: number;
  riverUnique: number;
  required: number;
  unlocked: boolean;
} {
  const beachUnique = getZoneProgress(saveData, "beach").discoveredUnique;
  const riverUnique = getZoneProgress(saveData, "river").discoveredUnique;
  return {
    beachUnique,
    riverUnique,
    required: ZONE_GATE_THRESHOLD,
    unlocked:
      beachUnique >= ZONE_GATE_THRESHOLD && riverUnique >= ZONE_GATE_THRESHOLD,
  };
}

export function getOasisChecklist(saveData: SaveData): {
  beachUnique: number;
  riverUnique: number;
  caveUnique: number;
  volcanoUnique: number;
  required: number;
  unlocked: boolean;
} {
  const beachUnique = getZoneProgress(saveData, "beach").discoveredUnique;
  const riverUnique = getZoneProgress(saveData, "river").discoveredUnique;
  const caveUnique = getZoneProgress(saveData, "cave").discoveredUnique;
  const volcanoUnique = getZoneProgress(saveData, "volcano").discoveredUnique;
  return {
    beachUnique,
    riverUnique,
    caveUnique,
    volcanoUnique,
    required: ZONE_GATE_THRESHOLD,
    unlocked:
      beachUnique >= ZONE_GATE_THRESHOLD &&
      riverUnique >= ZONE_GATE_THRESHOLD &&
      caveUnique >= ZONE_GATE_THRESHOLD &&
      volcanoUnique >= ZONE_GATE_THRESHOLD,
  };
}
