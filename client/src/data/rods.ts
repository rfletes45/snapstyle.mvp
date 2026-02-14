import type { RodDefinition } from "../game/types";

export const ROD_DEFINITIONS: RodDefinition[] = [
  {
    id: "starter_rod",
    name: "Starter Drift Rod",
    luck: 8,
    sturdiness: 12,
    price: 0,
    source: "starter",
    ownedByDefault: true,
  },
  {
    id: "beach_shop_rod_1",
    name: "Palmcaster Mk I",
    luck: 22,
    sturdiness: 20,
    price: 420,
    source: "shop",
    phaseLocked: true,
  },
  {
    id: "beach_shop_rod_2",
    name: "Sunline Voyager",
    luck: 34,
    sturdiness: 30,
    price: 820,
    source: "shop",
    phaseLocked: true,
  },
  {
    id: "beach_shop_rod_3",
    name: "Trident Apex",
    luck: 46,
    sturdiness: 40,
    price: 1400,
    source: "shop",
    phaseLocked: true,
  },
  {
    id: "beach_zone_luck_rod",
    name: "Tide Charm Rod",
    luck: 20,
    sturdiness: 22,
    price: 0,
    source: "zone_pickup",
    zonePassive: {
      type: "zoneLuck",
      zoneId: "beach",
      zoneLuckBonusMult: 1.2,
    },
  },
  {
    id: "river_zone_luck_rod",
    name: "Current Whisper Rod",
    luck: 24,
    sturdiness: 25,
    price: 0,
    source: "zone_pickup",
    zonePassive: {
      type: "zoneLuck",
      zoneId: "river",
      zoneLuckBonusMult: 1.22,
    },
  },
  {
    id: "cave_zone_luck_rod",
    name: "Glowbrook Rod",
    luck: 28,
    sturdiness: 28,
    price: 0,
    source: "zone_pickup",
    zonePassive: {
      type: "zoneLuck",
      zoneId: "cave",
      zoneLuckBonusMult: 1.24,
    },
  },
  {
    id: "volcano_zone_luck_rod",
    name: "Ember Pulse Rod",
    luck: 36,
    sturdiness: 34,
    price: 0,
    source: "zone_pickup",
    zonePassive: {
      type: "zoneLuck",
      zoneId: "volcano",
      zoneLuckBonusMult: 1.28,
    },
  },
  {
    id: "oasis_zone_luck_rod",
    name: "Lotus Bloom Rod",
    luck: 44,
    sturdiness: 40,
    price: 0,
    source: "zone_pickup",
    zonePassive: {
      type: "zoneLuck",
      zoneId: "oasis",
      zoneLuckBonusMult: 1.3,
    },
  },
  {
    id: "beach_challenge_rod",
    name: "Sunbreak Challenger",
    luck: 34,
    sturdiness: 32,
    price: 0,
    source: "challenge_reward",
  },
  {
    id: "river_challenge_rod",
    name: "Rapids Challenger",
    luck: 39,
    sturdiness: 37,
    price: 0,
    source: "challenge_reward",
  },
  {
    id: "cave_challenge_rod",
    name: "Crystal Challenger",
    luck: 44,
    sturdiness: 42,
    price: 0,
    source: "challenge_reward",
  },
  {
    id: "volcano_challenge_rod",
    name: "Magma Challenger",
    luck: 56,
    sturdiness: 52,
    price: 0,
    source: "challenge_reward",
  },
  {
    id: "oasis_challenge_rod",
    name: "Eternal Oasis Sovereign",
    luck: 74,
    sturdiness: 68,
    price: 0,
    source: "challenge_reward",
  },
];

export function getRodById(rodId: string): RodDefinition | undefined {
  return ROD_DEFINITIONS.find((rod) => rod.id === rodId);
}

export const ZONE_LUCK_ROD_IDS = [
  "beach_zone_luck_rod",
  "river_zone_luck_rod",
  "cave_zone_luck_rod",
  "volcano_zone_luck_rod",
  "oasis_zone_luck_rod",
] as const;

export const CHALLENGE_ROD_IDS = [
  "beach_challenge_rod",
  "river_challenge_rod",
  "cave_challenge_rod",
  "volcano_challenge_rod",
  "oasis_challenge_rod",
] as const;
