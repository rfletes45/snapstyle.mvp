/**
 * Starforge Data Loader — loads JSON catalogs for server-side simulation.
 * No DOM, no Three.js. Node.js fs-based loading.
 */

import * as path from "path";
import * as fs from "fs";
import type { BalanceV1 } from "./data/balanceSchema";
import type { MachinesCatalog } from "./data/machinesSchema";
import type { UpgradesCatalog } from "./data/upgradesSchema";
import type { ContractsCatalog } from "./data/contractsSchema";
import type { EventsCatalog } from "./data/eventsSchema";
import type { MilestonesCatalog } from "./data/milestonesSchema";
import type { WrecksCatalog } from "./data/wrecksSchema";
import type { TierUnlocksCatalog } from "./data/tierUnlocksSchema";

export interface StarforgeCatalogs {
  balance: BalanceV1;
  machines: MachinesCatalog;
  upgrades: UpgradesCatalog;
  contracts: ContractsCatalog;
  events: EventsCatalog;
  milestones: MilestonesCatalog;
  wrecks: WrecksCatalog;
  tierUnlocks: TierUnlocksCatalog;
}

/** Cached catalogs — loaded once. */
let cached: StarforgeCatalogs | null = null;

function loadJson<T>(filename: string): T {
  const filePath = path.resolve(__dirname, "data", filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Load all Starforge data catalogs from JSON files.
 * Cached after first load.
 */
export function loadStarforgeCatalogs(): StarforgeCatalogs {
  if (cached) return cached;

  cached = {
    balance: loadJson<BalanceV1>("balance.v1.json"),
    machines: loadJson<MachinesCatalog>("machines.v1.json"),
    upgrades: loadJson<UpgradesCatalog>("upgrades.v1.json"),
    contracts: loadJson<ContractsCatalog>("contracts.v1.json"),
    events: loadJson<EventsCatalog>("events.v1.json"),
    milestones: loadJson<MilestonesCatalog>("milestones.v1.json"),
    wrecks: loadJson<WrecksCatalog>("wrecks.v1.json"),
    tierUnlocks: loadJson<TierUnlocksCatalog>("tierUnlocks.v1.json"),
  };

  return cached;
}

/** Reset cached catalogs (for testing). */
export function resetCatalogs(): void {
  cached = null;
}
