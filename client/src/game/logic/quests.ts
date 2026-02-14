import { ALL_FISH, ALL_FISH_BY_ID } from "../../data/fish";
import type { QuestDefinition, Rarity, SaveData, ZoneId } from "../types";
import { getZoneProgress } from "./progression";

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  mythic: 4,
};

export interface QuestProgressSnapshot {
  current: number;
  target: number;
  completed: boolean;
}

function countZoneCatchesAtOrAbove(
  saveData: SaveData,
  zoneId: ZoneId,
  rarityMin: Rarity,
): number {
  const minRank = RARITY_RANK[rarityMin];
  let total = 0;
  for (const [fishId, entry] of Object.entries(saveData.bestiary)) {
    if (!entry || entry.caughtCount <= 0) {
      continue;
    }
    const fish = ALL_FISH_BY_ID[fishId];
    if (!fish || fish.zone !== zoneId) {
      continue;
    }
    if (RARITY_RANK[fish.rarity] < minRank) {
      continue;
    }
    total += entry.caughtCount;
  }
  return total;
}

export function getQuestProgress(
  quest: QuestDefinition,
  saveData: SaveData,
): QuestProgressSnapshot {
  if (quest.type === "discovery_count") {
    const zoneProgress = getZoneProgress(saveData, quest.requirement.zoneId);
    const current = zoneProgress.discoveredUnique;
    const target = quest.requirement.discoveredCount;
    return {
      current,
      target,
      completed: current >= target,
    };
  }

  const current = countZoneCatchesAtOrAbove(
    saveData,
    quest.requirement.zoneId,
    quest.requirement.rarityMin,
  );
  const target = quest.requirement.count;
  return {
    current,
    target,
    completed: current >= target,
  };
}

export function getQuestDiscoveryHints(quest: QuestDefinition): string[] {
  const hints: string[] = [quest.hint];
  if (quest.type !== "discovery_count") {
    return hints;
  }

  const zoneFish = ALL_FISH.filter(
    (fish) => fish.zone === quest.requirement.zoneId,
  );
  if (zoneFish.length > 0) {
    hints.push(
      `Try rotating spots in ${quest.requirement.zoneId} to widen discoveries.`,
    );
  }
  return hints;
}
