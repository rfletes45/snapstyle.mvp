import type { QuestDefinition } from "../game/types";

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: "quest_river_uncommon_hunt",
    title: "River School Patrol",
    description: "Catch 3 Uncommon-or-better fish in River.",
    type: "catch_count",
    requirement: {
      zoneId: "river",
      rarityMin: "uncommon",
      count: 3
    },
    reward: {
      goldAmount: 180
    },
    hint: "River Challenge starts by the log lane near the waterfall."
  },
  {
    id: "quest_river_rare_find",
    title: "Fallside Rarity",
    description: "Catch 1 Rare-or-better fish in River.",
    type: "rarity_catch",
    requirement: {
      zoneId: "river",
      rarityMin: "rare",
      count: 1
    },
    reward: {
      baitPack: {
        baitType: "normal",
        quantity: 6
      }
    },
    hint: "The River Zone Luck Rod stand is near the waterfall fishing pool."
  },
  {
    id: "quest_beach_discovery_path",
    title: "Shoreline Journal",
    description: "Discover 6 unique fish in Beach.",
    type: "discovery_count",
    requirement: {
      zoneId: "beach",
      discoveredCount: 6
    },
    reward: {
      goldAmount: 120,
      baitPack: {
        baitType: "normal",
        quantity: 4
      }
    },
    hint: "Beach Challenge starts at the dock post path near the pier."
  }
];

export function getQuestById(questId: string): QuestDefinition | undefined {
  return QUEST_DEFINITIONS.find((quest) => quest.id === questId);
}
