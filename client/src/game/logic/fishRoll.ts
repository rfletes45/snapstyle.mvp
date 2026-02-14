import { clamp01 } from "../../utils/math";
import type {
  BaitDefinition,
  FishDefinition,
  Rarity,
  RarityWeights,
  RodDefinition,
  ZoneId,
} from "../types";

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "mythic"];
const CAPPED_RARITIES: Partial<Record<Rarity, number>> = {
  mythic: 0.1,
};

export const BASE_RARITY_WEIGHTS: RarityWeights = {
  common: 55,
  uncommon: 25,
  rare: 12,
  epic: 6,
  mythic: 2,
};

export interface FishRollResult {
  fish: FishDefinition;
  luckMultiplier: number;
  rarityChances: RarityWeights;
}

export function computeZoneBonusFactor(
  rod: RodDefinition,
  currentZoneId?: ZoneId,
): number {
  if (!rod.zonePassive || !currentZoneId) {
    return 1;
  }
  if (rod.zonePassive.type !== "zoneLuck") {
    return 1;
  }
  return rod.zonePassive.zoneId === currentZoneId
    ? rod.zonePassive.zoneLuckBonusMult
    : 1;
}

function computeBaitLuckFactor(
  bait: BaitDefinition,
  currentZoneId?: ZoneId,
): number {
  if (!bait.zoneRestriction) {
    return bait.luckMultiplier;
  }
  return bait.zoneRestriction === currentZoneId ? bait.luckMultiplier : 1;
}

export function computeLuckMultiplier(
  rod: RodDefinition,
  bait: BaitDefinition,
  zoneBonusFactor = 1,
  currentZoneId?: ZoneId,
): number {
  const baitFactor = computeBaitLuckFactor(bait, currentZoneId);
  return baitFactor * (1 + rod.luck / 100) * Math.max(1, zoneBonusFactor);
}

function normalizeWeights(weights: RarityWeights): RarityWeights {
  const total = RARITIES.reduce((sum, rarity) => sum + weights[rarity], 0);
  if (total <= 0) {
    return {
      common: 1 / 5,
      uncommon: 1 / 5,
      rare: 1 / 5,
      epic: 1 / 5,
      mythic: 1 / 5,
    };
  }

  return {
    common: weights.common / total,
    uncommon: weights.uncommon / total,
    rare: weights.rare / total,
    epic: weights.epic / total,
    mythic: weights.mythic / total,
  };
}

function redistributeExcess(
  probabilities: RarityWeights,
  cappedRarity: Rarity,
  excess: number,
): RarityWeights {
  const recipients = RARITIES.filter((rarity) => rarity !== cappedRarity);
  const recipientTotal = recipients.reduce(
    (sum, rarity) => sum + probabilities[rarity],
    0,
  );
  if (recipientTotal <= 0) {
    const evenShare = excess / recipients.length;
    const copy = { ...probabilities };
    for (const rarity of recipients) {
      copy[rarity] += evenShare;
    }
    return copy;
  }

  const copy = { ...probabilities };
  for (const rarity of recipients) {
    copy[rarity] += (probabilities[rarity] / recipientTotal) * excess;
  }
  return copy;
}

function enforceMythicCap(probabilities: RarityWeights): RarityWeights {
  let copy = { ...probabilities };
  for (let i = 0; i < 3; i += 1) {
    let changed = false;
    for (const rarity of ["mythic"] as const) {
      const cap = CAPPED_RARITIES[rarity];
      if (!cap) {
        continue;
      }
      if (copy[rarity] > cap) {
        const excess = copy[rarity] - cap;
        copy[rarity] = cap;
        copy = redistributeExcess(copy, rarity, excess);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }

  return normalizeWeights(copy);
}

export function computeRarityDistribution(
  luckMultiplier: number,
): RarityWeights {
  const weighted: RarityWeights = {
    ...BASE_RARITY_WEIGHTS,
    rare: BASE_RARITY_WEIGHTS.rare * luckMultiplier,
    epic: BASE_RARITY_WEIGHTS.epic * luckMultiplier,
    mythic: BASE_RARITY_WEIGHTS.mythic * luckMultiplier,
  };

  const normalized = normalizeWeights(weighted);
  return enforceMythicCap(normalized);
}

export function pickRarity(
  weights: RarityWeights,
  rng: () => number = Math.random,
): Rarity {
  const roll = clamp01(rng());
  let accumulator = 0;
  for (const rarity of RARITIES) {
    accumulator += weights[rarity];
    if (roll <= accumulator) {
      return rarity;
    }
  }
  return "common";
}

function pickFishByRarity(
  fishPool: FishDefinition[],
  rarity: Rarity,
  rng: () => number = Math.random,
): FishDefinition {
  const candidates = fishPool.filter((fish) => fish.rarity === rarity);
  if (candidates.length === 0) {
    return fishPool[0];
  }

  const totalWeight = candidates.reduce(
    (sum, fish) => sum + fish.encounterWeight,
    0,
  );
  if (totalWeight <= 0) {
    return candidates[Math.floor(rng() * candidates.length)];
  }

  const roll = rng() * totalWeight;
  let accumulator = 0;
  for (const fish of candidates) {
    accumulator += fish.encounterWeight;
    if (roll <= accumulator) {
      return fish;
    }
  }
  return candidates[candidates.length - 1];
}

export function rollFish(
  fishPool: FishDefinition[],
  rod: RodDefinition,
  bait: BaitDefinition,
  currentZoneId?: ZoneId,
  rng: () => number = Math.random,
): FishRollResult {
  const zoneBonusFactor = computeZoneBonusFactor(rod, currentZoneId);
  const luckMultiplier = computeLuckMultiplier(
    rod,
    bait,
    zoneBonusFactor,
    currentZoneId,
  );
  const rarityChances = computeRarityDistribution(luckMultiplier);
  const rarity = pickRarity(rarityChances, rng);
  const fish = pickFishByRarity(fishPool, rarity, rng);
  return { fish, luckMultiplier, rarityChances };
}
