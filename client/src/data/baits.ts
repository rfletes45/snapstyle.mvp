import type { BaitDefinition } from "../game/types";

export const BAIT_DEFINITIONS: BaitDefinition[] = [
  {
    id: "normal",
    name: "Normal Bait",
    luckMultiplier: 1.5,
    price: 8,
    ownedByDefault: 5,
    purchasable: true
  },
  {
    id: "quality",
    name: "Quality Bait",
    luckMultiplier: 2,
    price: 20,
    purchasable: true
  },
  {
    id: "beach",
    name: "Beach Bait",
    luckMultiplier: 2.5,
    zoneRestriction: "beach",
    price: 24,
    purchasable: true,
    phaseLocked: true
  },
  {
    id: "river",
    name: "River Bait",
    luckMultiplier: 2.5,
    zoneRestriction: "river",
    price: 24,
    purchasable: true,
    phaseLocked: true
  },
  {
    id: "cave",
    name: "Cave Bait",
    luckMultiplier: 2.5,
    zoneRestriction: "cave",
    price: 24,
    purchasable: true,
    phaseLocked: true
  },
  {
    id: "volcano",
    name: "Volcano Bait",
    luckMultiplier: 2.5,
    zoneRestriction: "volcano",
    price: 28,
    purchasable: true,
    phaseLocked: true
  },
  {
    id: "oasis",
    name: "Oasis Bait",
    luckMultiplier: 2.5,
    zoneRestriction: "oasis",
    price: 32,
    purchasable: true,
    phaseLocked: true
  }
];

export function getBaitById(baitId: string): BaitDefinition | undefined {
  return BAIT_DEFINITIONS.find((bait) => bait.id === baitId);
}
