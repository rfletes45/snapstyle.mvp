/**
 * Load all data catalogs and initialize the shared sim layer.
 * Must be called once before any sim operations.
 */
import type { BalanceV1 } from "../../src/game/data/balanceSchema";
import type { ContractsCatalog } from "../../src/game/data/contractsSchema";
import type { EventsCatalog } from "../../src/game/data/eventsSchema";
import type { MachinesCatalog } from "../../src/game/data/machinesSchema";
import type { MilestonesCatalog } from "../../src/game/data/milestonesSchema";
import type { UpgradesCatalog } from "../../src/game/data/upgradesSchema";

import balanceJson from "../../src/game/data/balance.v1.json";
import contractsJson from "../../src/game/data/contracts.v1.json";
import eventsJson from "../../src/game/data/events.v1.json";
import machinesJson from "../../src/game/data/machines.v1.json";
import milestonesJson from "../../src/game/data/milestones.v1.json";
import upgradesJson from "../../src/game/data/upgrades.v1.json";

import {
  setBalance,
  setContractsCatalog,
  setEventsCatalog,
  setMachinesCatalog,
  setMilestonesCatalog,
  setUpgradesCatalog,
} from "../../src/game/sim/reducer";
import {
  setSimBalance,
  setSimCatalog,
  setSimContractsCatalog,
  setSimEventsCatalog,
  setSimHz,
  setSimMilestonesCatalog,
  setSimUpgradesCatalog,
} from "../../src/game/sim/sim";

export const balance = balanceJson as BalanceV1;
const machinesCatalog = machinesJson as unknown as MachinesCatalog;
const upgradesCatalog = upgradesJson as unknown as UpgradesCatalog;
const contractsCatalog = contractsJson as unknown as ContractsCatalog;
const eventsCatalog = eventsJson as unknown as EventsCatalog;
const milestonesCatalog = milestonesJson as unknown as MilestonesCatalog;

/**
 * Initialize both reducer-side and sim-side catalogs.
 * Call once per process (all rooms share the same catalogs).
 */
export function initSimLayer(): void {
  // Reducer-side catalogs (for applyInput)
  setBalance(balance);
  setMachinesCatalog(machinesCatalog);
  setUpgradesCatalog(upgradesCatalog);
  setContractsCatalog(contractsCatalog);
  setEventsCatalog(eventsCatalog);
  setMilestonesCatalog(milestonesCatalog);

  // Sim-side catalogs (for stepTick)
  setSimCatalog(machinesCatalog);
  setSimUpgradesCatalog(upgradesCatalog);
  setSimContractsCatalog(contractsCatalog);
  setSimEventsCatalog(eventsCatalog);
  setSimMilestonesCatalog(milestonesCatalog);
  setSimBalance(balance);

  const hz = balance.simHz ?? 20;
  setSimHz(hz);
}
