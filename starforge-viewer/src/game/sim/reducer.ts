/**
 * Reducer — applies InputCommands to SimStateV1.
 * Pure function: (state, cmd) → newState.
 * No DOM, no Three.js.
 */
import type { BalanceV1, BalanceV2 } from "../data/balanceSchema";
import type { BranchesCatalog } from "../data/branchesSchema";
import type { ContractsCatalog } from "../data/contractsSchema";
import type { EventsCatalog } from "../data/eventsSchema";
import type {
  MachinesCatalog,
  MachinesV2Catalog,
} from "../data/machinesSchema";
import type { MilestonesCatalog } from "../data/milestonesSchema";
import type { RebirthCatalog, RebirthTreeCatalog } from "../data/rebirthSchema";
import type {
  TierUnlocksCatalog,
  TierUnlocksV2Catalog,
} from "../data/tierUnlocksSchema";
import type {
  UpgradesCatalog,
  UpgradesV2Catalog,
} from "../data/upgradesSchema";
import type { WrecksCatalog, WrecksV2Catalog } from "../data/wrecksSchema";
import {
  buildConditionContext,
  computeDerived,
  isMachineV2Visible,
  isUpgradeV2Visible,
  type DerivedMods,
} from "./derived";
import type {
  ContractState,
  CutterDockState,
  EventState,
  InputCommand,
  MachineStack,
  MilestoneState,
  RunStats,
  SimStateV1,
  WrecksField,
  WreckSpawnTimer,
} from "./types";

/** Cached references — set once at boot. */
let bal: BalanceV1 | null = null;
let balV2: BalanceV2 | null = null;
let catalog: MachinesCatalog | null = null;
let upgCatalog: UpgradesCatalog | null = null;
let contractsCatalog: ContractsCatalog | null = null;
let eventsCatalog: EventsCatalog | null = null;
let milestonesCatalog: MilestonesCatalog | null = null;
let wrecksCatalog: WrecksCatalog | null = null;
let wrecksV2Catalog: WrecksV2Catalog | null = null;
let tierUnlocksCatalog: TierUnlocksCatalog | null = null;
let upgV2Catalog: UpgradesV2Catalog | null = null;
let tierUnlocksV2Catalog: TierUnlocksV2Catalog | null = null;
let machinesV2Catalog: MachinesV2Catalog | null = null;
let branchesCatalog: BranchesCatalog | null = null;
let rebirthCatalog: RebirthCatalog | null = null;
let rebirthTreeCatalog: RebirthTreeCatalog | null = null;

export function setBalance(b: BalanceV1): void {
  bal = b;
}

export function setMachinesCatalog(c: MachinesCatalog): void {
  catalog = c;
}

export function setUpgradesCatalog(u: UpgradesCatalog): void {
  upgCatalog = u;
}

export function setContractsCatalog(c: ContractsCatalog): void {
  contractsCatalog = c;
}

export function setEventsCatalog(c: EventsCatalog): void {
  eventsCatalog = c;
}

export function setMilestonesCatalog(c: MilestonesCatalog): void {
  milestonesCatalog = c;
}

export function setWrecksCatalog(c: WrecksCatalog): void {
  wrecksCatalog = c;
}

export function setTierUnlocksCatalog(c: TierUnlocksCatalog): void {
  tierUnlocksCatalog = c;
}

export function setBalanceV2(b: BalanceV2): void {
  balV2 = b;
}

export function setWrecksV2Catalog(c: WrecksV2Catalog): void {
  wrecksV2Catalog = c;
}

export function setUpgradesV2Catalog(c: UpgradesV2Catalog): void {
  upgV2Catalog = c;
}

export function setTierUnlocksV2Catalog(c: TierUnlocksV2Catalog): void {
  tierUnlocksV2Catalog = c;
}

export function setMachinesV2Catalog(c: MachinesV2Catalog): void {
  machinesV2Catalog = c;
}

export function setBranchesCatalog(c: BranchesCatalog): void {
  branchesCatalog = c;
}

export function setRebirthCatalog(c: RebirthCatalog): void {
  rebirthCatalog = c;
}

export function setRebirthTreeCatalog(c: RebirthTreeCatalog): void {
  rebirthTreeCatalog = c;
}

/** Get derived mods for the current state. */
export function getDerived(state: SimStateV1): DerivedMods {
  if (!upgCatalog) {
    return {
      clickMult: 1,
      globalProdMult: 1,
      machineProdMult: {},
      capBonusMicro: { flux: 0, alloy: 0, signal: 0 },
      converterEfficiency: {},
      costReduction: {},
      revealChanceAdd: 0,
      cutDamageMicroPerTap: balV2?.cut.baseDamageMicroPerTap ?? 250,
      cutDamageMult: 1.0,
      wreckYieldMult: 1.0,
      transitTicksMult: 1.0,
      maxAliveWrecks: 3,
      maxAliveWrecksAdd: 0,
      spawnGapMult: 1.0,
      rarityWeightMult: {
        common: 1,
        uncommon: 1,
        rare: 1,
        epic: 1,
        ancient: 1,
      },
      tierUnlockAllowed: {},
      weakpointWindowTicksAdd: 0,
      weakpointMultAdd: 0,
      droneCooldownMult: 1.0,
      signalRateMult: 1.0,
      nanoforgeRateMult: 1.0,
      upgradeCostMult: 1.0,
      startBonusFluxMicro: 0,
    };
  }
  return computeDerived(
    state.upgradesPurchased,
    upgCatalog,
    state.upgradesPurchasedV2,
    state.machines,
    state.meta.rebirthTreePurchased,
  );
}

/**
 * Apply a single input command to the sim state.
 * Returns a new state object (never mutates input).
 */
export function applyInput(state: SimStateV1, cmd: InputCommand): SimStateV1 {
  if (!bal) throw new Error("Balance not loaded — call setBalance() first");

  switch (cmd.t) {
    case "TAP":
      // Alias: TAP now acts as CUT_TAP (wreck-driven flux loop)
      return applyCutTap(state);
    case "CUT_TAP":
      return applyCutTap(state);
    case "SELECT_WRECK":
      return applySelectWreck(state, cmd.wreckId);
    case "BUY_MACHINE":
      return applyBuyMachine(state, cmd.code, cmd.qty);
    case "TOGGLE_MACHINE_ENABLED":
      return applyToggleMachineEnabled(state, cmd.code, cmd.enabled);
    case "UPGRADE_MACHINE_TIER":
      return applyUpgradeMachineTier(state, cmd.code);
    case "BUY_UPGRADE":
      return applyBuyUpgrade(state, cmd.upgradeId);
    case "BUY_UPGRADE_V2":
      return applyBuyUpgradeV2(state, cmd.upgradeId);
    case "START_CONTRACT":
      return applyStartContract(state, cmd.contractId);
    case "CLAIM_CONTRACT_REWARD":
      return applyClaimContractReward(state);
    case "TAP_EVENT":
      return applyTapEvent(state);
    case "TAP_WRECK":
      return applyTapWreck(state, cmd.wreckId);
    case "DISMISS_MILESTONE_TOAST":
      return applyDismissMilestoneToast(state);
    case "CONFIRM_REBIRTH":
      return applyConfirmRebirth(state);
    case "BUY_REBIRTH_NODE":
      return applyBuyRebirthNode(state, cmd.nodeId);
    case "RESET":
      return createFreshState(state.seed);
    default:
      return state;
  }
}

// ─── SELECT WRECK (v2 cutter-dock loop) ─────────────────────

/**
 * Player clicks a spawned wreck → reserve it and begin transit to dock.
 * Prereqs: dock must be empty, wreck must exist and be in "spawned" phase.
 */
function applySelectWreck(state: SimStateV1, wreckId: string): SimStateV1 {
  // Dock must be empty
  if (state.cutterDock.status !== "empty") return state;

  const wreck = state.wrecks.active[wreckId];
  if (!wreck) return state;
  if (wreck.phase !== "spawned") return state;

  // Compute transit duration
  const mods = getDerived(state);
  const baseTransitTicks = wrecksV2Catalog?.spawn.transitBaseTicks ?? 40;
  const transitTicks = Math.max(
    1,
    Math.round(baseTransitTicks * mods.transitTicksMult),
  );
  const dockReadyTick = state.tick + transitTicks;

  const updatedWreck: typeof wreck = {
    ...wreck,
    phase: "in_transit",
    dockReadyTick,
  };

  return {
    ...state,
    wrecks: {
      ...state.wrecks,
      active: { ...state.wrecks.active, [wreckId]: updatedWreck },
    },
    cutterDock: {
      status: "transit",
      wreckId: null,
      reservedWreckId: wreckId,
    },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── CUT TAP (v2 cutter-dock loop) ──────────────────────────

/**
 * Player taps CUT while a wreck is docked → deal damage.
 * When HP reaches 0, award Flux payout and clear dock.
 */
function applyCutTap(state: SimStateV1): SimStateV1 {
  // Must have a docked wreck
  if (state.cutterDock.status !== "docked") return state;

  const dockedId = state.cutterDock.wreckId;
  if (!dockedId) return state;

  const wreck = state.wrecks.active[dockedId];
  if (!wreck) return state;

  const mods = getDerived(state);
  let damage = mods.cutDamageMicroPerTap;

  // Weakpoint bonus: if wreck has an active weakpoint, multiply damage
  if (
    wreck.weakpointUntilTick != null &&
    state.tick < wreck.weakpointUntilTick
  ) {
    const baseMult = wrecksV2Catalog?.weakpoints.baseMult ?? 2.0;
    damage = Math.round(damage * (baseMult + mods.weakpointMultAdd));
  }

  const newHp = Math.max(0, wreck.hpMicro - damage);

  // Wreck destroyed?
  if (newHp <= 0) {
    // Award flux payout (scaled by wreckYieldMult)
    const payout = Math.round(wreck.payoutFluxMicro * mods.wreckYieldMult);
    const newFlux = Math.min(
      state.resources.flux + payout,
      state.capsMicro.flux,
    );
    const actualGain = newFlux - state.resources.flux;

    // Remove wreck from active
    const newActive = { ...state.wrecks.active };
    delete newActive[dockedId];

    // Update rarity-based destroy counter
    const rarity = wreck.rarity ?? "common";
    const byRarity = { ...state.runStats.wrecksDestroyedByRarity };
    byRarity[rarity] = (byRarity[rarity] ?? 0) + 1;

    return {
      ...state,
      resources: { ...state.resources, flux: newFlux },
      wrecks: { ...state.wrecks, active: newActive },
      cutterDock: { status: "empty", wreckId: null, reservedWreckId: null },
      runStats: {
        ...state.runStats,
        totalCutTaps: state.runStats.totalCutTaps + 1,
        totalFluxEarnedMicro: state.runStats.totalFluxEarnedMicro + actualGain,
        wrecksDestroyedTotal: state.runStats.wrecksDestroyedTotal + 1,
        wrecksDestroyedByRarity: byRarity,
      },
      stats: {
        ...state.stats,
        totalFluxEarned: state.stats.totalFluxEarned + actualGain,
        totalTaps: state.stats.totalTaps + 1,
      },
      flags: { ...state.flags, dirty: true },
    };
  }

  // Wreck survives — just reduce HP
  const updatedWreck: typeof wreck = { ...wreck, hpMicro: newHp };
  return {
    ...state,
    wrecks: {
      ...state.wrecks,
      active: { ...state.wrecks.active, [dockedId]: updatedWreck },
    },
    runStats: {
      ...state.runStats,
      totalCutTaps: state.runStats.totalCutTaps + 1,
    },
    stats: {
      ...state.stats,
      totalTaps: state.stats.totalTaps + 1,
    },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── LEGACY TAP (kept for backward compat — now aliases to CUT_TAP) ──

function applyTap(state: SimStateV1, overrideAmount?: number): SimStateV1 {
  // Compute click multiplier from BOOSTER machine stacks
  let clickMult = 1;
  if (catalog) {
    for (const s of Object.values(state.machines)) {
      if (!s.enabled) continue;
      const def = catalog.machines[s.code];
      if (!def || def.behavior.type !== "BOOSTER") continue;
      const tMult = def.tierMult[String(s.tier) as "1" | "2" | "3"];
      // Each copy in the stack contributes — exponentiate by count
      clickMult *= Math.pow(def.behavior.clickMult * tMult, s.count);
    }
  }

  // Apply upgrade click multiplier
  const mods = getDerived(state);
  clickMult *= mods.clickMult;

  const baseAmount = overrideAmount ?? bal!.click.baseMicroFlux;
  const amount = Math.round(baseAmount * clickMult);

  const newFlux = Math.min(state.resources.flux + amount, state.capsMicro.flux);
  const actualGain = newFlux - state.resources.flux;

  return {
    ...state,
    resources: { ...state.resources, flux: newFlux },
    stats: {
      ...state.stats,
      totalFluxEarned: state.stats.totalFluxEarned + actualGain,
      totalTaps: state.stats.totalTaps + 1,
      overflowLost: state.stats.overflowLost + (amount - actualGain),
    },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── BUY MACHINE ─────────────────────────────────────────────

/**
 * Compute total cost to buy `qty` copies of a machine starting at `ownedCount`.
 * Uses geometric sum: baseCost × ∑(growth^i, i=ownedCount..ownedCount+qty-1).
 */
function computeBulkCost(
  baseCostMicro: number,
  growth: number,
  ownedCount: number,
  qty: number,
  costReduce: number,
): number {
  if (growth === 1) return Math.round(baseCostMicro * qty * costReduce);
  let total = 0;
  for (let i = 0; i < qty; i++) {
    total += baseCostMicro * Math.pow(growth, ownedCount + i);
  }
  return Math.round(total * costReduce);
}

/**
 * Compute max affordable quantity given current resources.
 * Returns the largest qty where computeBulkCost ≤ available for ALL resource types.
 */
function computeMaxAffordable(
  def: {
    buyCost: { fluxMicro?: number; alloyMicro?: number; signalMicro?: number };
    costGrowth: number;
  },
  ownedCount: number,
  resources: { flux: number; alloy: number; signal: number },
  costReduce: number,
): number {
  let qty = 0;
  let totalF = 0,
    totalA = 0,
    totalS = 0;
  const baseF = def.buyCost.fluxMicro ?? 0;
  const baseA = def.buyCost.alloyMicro ?? 0;
  const baseS = def.buyCost.signalMicro ?? 0;
  const g = def.costGrowth;

  // Iterate until we can't afford the next one
  for (let i = 0; i < 1000; i++) {
    const gMult = Math.pow(g, ownedCount + i);
    const stepF = Math.round(baseF * gMult * costReduce);
    const stepA = Math.round(baseA * gMult * costReduce);
    const stepS = Math.round(baseS * gMult * costReduce);

    if (
      totalF + stepF > resources.flux ||
      totalA + stepA > resources.alloy ||
      totalS + stepS > resources.signal
    )
      break;

    totalF += stepF;
    totalA += stepA;
    totalS += stepS;
    qty++;
  }
  return qty;
}

function applyBuyMachine(
  state: SimStateV1,
  code: string,
  qty: number,
): SimStateV1 {
  // ── V2 path (preferred when catalog loaded) ──
  if (machinesV2Catalog) {
    return applyBuyMachineV2(state, code, qty);
  }

  // ── V1 fallback ──
  if (!catalog) return state;
  const def = catalog.machines[code];
  if (!def) return state;
  if (qty <= 0) return state;

  // Check unlock
  if (state.stats.totalFluxEarned < def.unlock.requiresFluxMicro) return state;

  const existing = state.machines[code];
  const ownedCount = existing?.count ?? 0;

  // Derived cost reduction
  const mods = getDerived(state);
  const costReduce =
    (mods.costReduction[code] ?? 1) * (mods.costReduction["*"] ?? 1);

  // If qty is a sentinel for MAX (e.g. Infinity or very large), compute max affordable
  let actualQty = qty;
  if (qty >= 999) {
    actualQty = computeMaxAffordable(
      def,
      ownedCount,
      state.resources,
      costReduce,
    );
    if (actualQty <= 0) return state;
  }

  // Compute total cost for actualQty
  const costFlux = computeBulkCost(
    def.buyCost.fluxMicro ?? 0,
    def.costGrowth,
    ownedCount,
    actualQty,
    costReduce,
  );
  const costAlloy = computeBulkCost(
    def.buyCost.alloyMicro ?? 0,
    def.costGrowth,
    ownedCount,
    actualQty,
    costReduce,
  );
  const costSignal = computeBulkCost(
    def.buyCost.signalMicro ?? 0,
    def.costGrowth,
    ownedCount,
    actualQty,
    costReduce,
  );

  // Can afford?
  if (
    state.resources.flux < costFlux ||
    state.resources.alloy < costAlloy ||
    state.resources.signal < costSignal
  ) {
    return state;
  }

  const newStack: MachineStack = existing
    ? { ...existing, count: existing.count + actualQty }
    : { code, count: actualQty, tier: 1, level: 1, enabled: true };

  // Recompute caps after adding BUFFER machine
  let newCaps = { ...state.capsMicro };
  if (def.behavior.type === "BUFFER") {
    const b = def.behavior;
    const tMult = def.tierMult[String(newStack.tier) as "1" | "2" | "3"];
    // Recalculate from scratch for this stack
    const baseCaps = bal
      ? { ...bal.defaultCapsMicro }
      : { flux: 10000, alloy: 5000, signal: 3000 };
    let bufCaps = { flux: 0, alloy: 0, signal: 0 };
    const allStacks = { ...state.machines, [code]: newStack };
    for (const s of Object.values(allStacks)) {
      const mDef = catalog.machines[s.code];
      if (!mDef || mDef.behavior.type !== "BUFFER") continue;
      const tm = mDef.tierMult[String(s.tier) as "1" | "2" | "3"];
      const bh = mDef.behavior;
      bufCaps.flux += Math.round((bh.capAddMicro.flux ?? 0) * tm * s.count);
      bufCaps.alloy += Math.round((bh.capAddMicro.alloy ?? 0) * tm * s.count);
      bufCaps.signal += Math.round((bh.capAddMicro.signal ?? 0) * tm * s.count);
    }
    newCaps = {
      flux: baseCaps.flux + bufCaps.flux + mods.capBonusMicro.flux,
      alloy: baseCaps.alloy + bufCaps.alloy + mods.capBonusMicro.alloy,
      signal: baseCaps.signal + bufCaps.signal + mods.capBonusMicro.signal,
    };
  }

  return {
    ...state,
    resources: {
      flux: state.resources.flux - costFlux,
      alloy: state.resources.alloy - costAlloy,
      signal: state.resources.signal - costSignal,
    },
    capsMicro: newCaps,
    machines: { ...state.machines, [code]: newStack },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── BUY MACHINE V2 ──────────────────────────────────────────

/**
 * V2 machine purchase — uses machines.v2 catalog.
 *  - Enforces maxCount.
 *  - Checks v2 visibility (condition + branch gating).
 *  - When buying a keystone, sets branchUnlocked on meta.
 *  - Cost uses v2 schema (baseFluxMicro + geometric growth).
 *  - qty is clamped to 1 for unique machines (maxCount 1).
 */
function applyBuyMachineV2(
  state: SimStateV1,
  code: string,
  qty: number,
): SimStateV1 {
  if (!machinesV2Catalog) return state;

  const def = machinesV2Catalog.machines.find((m) => m.code === code);
  if (!def) return state;
  if (qty <= 0) return state;

  const existing = state.machines[code];
  const ownedCount = existing?.count ?? 0;

  // Max count enforcement
  if (ownedCount >= def.maxCount) return state;

  // Visibility check (includes branch gating)
  const ctx = buildConditionContext(state);
  if (!isMachineV2Visible(def, ctx, state.meta)) return state;

  // Clamp qty to remaining allowed
  let actualQty = Math.min(qty, def.maxCount - ownedCount);

  // Derived cost reduction
  const mods = getDerived(state);
  const costReduce =
    (mods.costReduction[code] ?? 1) * (mods.costReduction["*"] ?? 1);

  // If qty is MAX sentinel, compute max affordable
  if (qty >= 999) {
    actualQty = 0;
    let totalF = 0;
    const baseF = def.cost.baseFluxMicro;
    const g = def.cost.growth;
    const maxBuy = Math.min(1000, def.maxCount - ownedCount);
    for (let i = 0; i < maxBuy; i++) {
      const stepF = Math.round(
        baseF * Math.pow(g, ownedCount + i) * costReduce,
      );
      if (totalF + stepF > state.resources.flux) break;
      totalF += stepF;
      actualQty++;
    }
    if (actualQty <= 0) return state;
  }

  // Compute total flux cost
  let totalCost = 0;
  for (let i = 0; i < actualQty; i++) {
    totalCost += Math.round(
      def.cost.baseFluxMicro *
        Math.pow(def.cost.growth, ownedCount + i) *
        costReduce,
    );
  }

  // Can afford?
  if (state.resources.flux < totalCost) return state;

  const newStack: MachineStack = existing
    ? { ...existing, count: existing.count + actualQty }
    : { code, count: actualQty, tier: 1, level: 1, enabled: true };

  // Branch unlock — if this machine is a keystone for a branch, unlock it
  let newMeta = state.meta;
  if (branchesCatalog && def.branchId) {
    const branch = branchesCatalog.branches[def.branchId];
    if (
      branch &&
      branch.keystone === code &&
      !state.meta.branchUnlocked[def.branchId]
    ) {
      newMeta = {
        ...state.meta,
        branchUnlocked: { ...state.meta.branchUnlocked, [def.branchId]: true },
      };
    }
  }

  return {
    ...state,
    resources: {
      ...state.resources,
      flux: state.resources.flux - totalCost,
    },
    machines: { ...state.machines, [code]: newStack },
    meta: newMeta,
    flags: { ...state.flags, dirty: true },
  };
}

// ─── TOGGLE MACHINE ENABLED ──────────────────────────────────

function applyToggleMachineEnabled(
  state: SimStateV1,
  code: string,
  enabled: boolean,
): SimStateV1 {
  const existing = state.machines[code];
  if (!existing) return state;

  return {
    ...state,
    machines: { ...state.machines, [code]: { ...existing, enabled } },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── UPGRADE MACHINE TIER ────────────────────────────────────

function applyUpgradeMachineTier(state: SimStateV1, code: string): SimStateV1 {
  if (!catalog) return state;

  const existing = state.machines[code];
  if (!existing || existing.count <= 0) return state;
  if (existing.tier >= 3) return state; // already max tier

  const nextTier = (existing.tier + 1) as 2 | 3;

  // Check tier unlock via v2 derived flags first, fall back to v1 upgrade check
  const mods0 = getDerived(state);
  const v2Allowed = mods0.tierUnlockAllowed[code]?.[nextTier] === true;
  const unlockId = `UNLOCK_T${nextTier}_${code}`;
  const v1Allowed = state.upgradesPurchased.includes(unlockId);
  if (!v2Allowed && !v1Allowed) return state;

  // Compute cost from tierUnlocks catalog (or fallback to old multiplier)
  const def = catalog.machines[code];
  if (!def) return state;

  const mods = getDerived(state);
  const costReduce =
    (mods.costReduction[code] ?? 1) *
    (mods.costReduction["*"] ?? 1) *
    mods.upgradeCostMult;

  let costFlux = 0;
  let costAlloy = 0;
  let costSignal = 0;

  // Try v2 tier unlocks catalog first, then v1, then fallback
  const tuV2Machine = tierUnlocksV2Catalog?.machines.find(
    (m) => m.code === code,
  );
  const tuV2Tier = tuV2Machine?.tiers[String(nextTier)];
  const tuDef = tierUnlocksCatalog?.perMachine[code];

  if (tuV2Tier) {
    costFlux = Math.round((tuV2Tier.cost.fluxMicro ?? 0) * costReduce);
    costAlloy = Math.round((tuV2Tier.cost.alloyMicro ?? 0) * costReduce);
    costSignal = Math.round((tuV2Tier.cost.signalMicro ?? 0) * costReduce);
  } else if (tuDef) {
    const tierCostDef =
      nextTier === 2 ? tuDef.tier2UpgradeCost : tuDef.tier3UpgradeCost;
    costFlux = Math.round((tierCostDef.fluxMicro ?? 0) * costReduce);
    costAlloy = Math.round((tierCostDef.alloyMicro ?? 0) * costReduce);
    costSignal = Math.round((tierCostDef.signalMicro ?? 0) * costReduce);
  } else {
    // Fallback: old cost multiplier approach
    const TIER_COST_MULT: Record<number, number> = { 2: 5, 3: 25 };
    const costMult = TIER_COST_MULT[nextTier] ?? 1;
    costFlux = Math.round((def.buyCost.fluxMicro ?? 0) * costMult * costReduce);
    costAlloy = Math.round(
      (def.buyCost.alloyMicro ?? 0) * costMult * costReduce,
    );
    costSignal = Math.round(
      (def.buyCost.signalMicro ?? 0) * costMult * costReduce,
    );
  }

  // Can afford?
  if (
    state.resources.flux < costFlux ||
    state.resources.alloy < costAlloy ||
    state.resources.signal < costSignal
  ) {
    return state;
  }

  const upgradedStack: MachineStack = { ...existing, tier: nextTier };
  const newMachines = { ...state.machines, [code]: upgradedStack };

  // Recompute caps if this is a BUFFER (higher tier = more cap)
  let newCaps = { ...state.capsMicro };
  if (def.behavior.type === "BUFFER") {
    // Recalculate all BUFFER caps from scratch
    const baseCaps = bal
      ? { ...bal.defaultCapsMicro }
      : { flux: 10000, alloy: 5000, signal: 3000 };
    let bufCaps = { flux: 0, alloy: 0, signal: 0 };
    for (const s of Object.values(newMachines)) {
      const mDef = catalog.machines[s.code];
      if (!mDef || mDef.behavior.type !== "BUFFER") continue;
      const tMult = mDef.tierMult[String(s.tier) as "1" | "2" | "3"];
      const b = mDef.behavior;
      bufCaps.flux += Math.round((b.capAddMicro.flux ?? 0) * tMult * s.count);
      bufCaps.alloy += Math.round((b.capAddMicro.alloy ?? 0) * tMult * s.count);
      bufCaps.signal += Math.round(
        (b.capAddMicro.signal ?? 0) * tMult * s.count,
      );
    }
    newCaps = {
      flux: baseCaps.flux + bufCaps.flux + mods.capBonusMicro.flux,
      alloy: baseCaps.alloy + bufCaps.alloy + mods.capBonusMicro.alloy,
      signal: baseCaps.signal + bufCaps.signal + mods.capBonusMicro.signal,
    };
  }

  return {
    ...state,
    resources: {
      flux: state.resources.flux - costFlux,
      alloy: state.resources.alloy - costAlloy,
      signal: state.resources.signal - costSignal,
    },
    capsMicro: newCaps,
    machines: newMachines,
    flags: { ...state.flags, dirty: true },
  };
}

// ─── BUY UPGRADE ─────────────────────────────────────────────

function applyBuyUpgrade(state: SimStateV1, upgradeId: string): SimStateV1 {
  if (!upgCatalog) return state;

  // Already purchased?
  if (state.upgradesPurchased.includes(upgradeId)) return state;

  const def = upgCatalog.upgrades.find((u) => u.id === upgradeId);
  if (!def) return state;

  // Check flux unlock gate
  if (state.stats.totalFluxEarned < def.requiresFluxMicro) return state;

  // Check prerequisites
  if (def.requires) {
    for (const req of def.requires) {
      if (!state.upgradesPurchased.includes(req)) return state;
    }
  }

  // Check cost
  const costF = def.cost.fluxMicro ?? 0;
  const costA = def.cost.alloyMicro ?? 0;
  const costS = def.cost.signalMicro ?? 0;
  if (
    state.resources.flux < costF ||
    state.resources.alloy < costA ||
    state.resources.signal < costS
  ) {
    return state;
  }

  // Deduct cost + add upgrade
  const newState: SimStateV1 = {
    ...state,
    resources: {
      flux: state.resources.flux - costF,
      alloy: state.resources.alloy - costA,
      signal: state.resources.signal - costS,
    },
    upgradesPurchased: [...state.upgradesPurchased, upgradeId],
    flags: { ...state.flags, dirty: true },
  };

  // Recompute caps with new upgrade bonuses
  const mods = getDerived(newState);
  const baseCaps = bal
    ? { ...bal.defaultCapsMicro }
    : { flux: 10000, alloy: 5000, signal: 3000 };

  // Add BUFFER machine cap bonuses
  let bufferCaps = { flux: 0, alloy: 0, signal: 0 };
  if (catalog) {
    for (const s of Object.values(newState.machines)) {
      const mDef = catalog.machines[s.code];
      if (!mDef || mDef.behavior.type !== "BUFFER") continue;
      const tMult = mDef.tierMult[String(s.tier) as "1" | "2" | "3"];
      const b = mDef.behavior;
      bufferCaps.flux += Math.round(
        (b.capAddMicro.flux ?? 0) * tMult * s.count,
      );
      bufferCaps.alloy += Math.round(
        (b.capAddMicro.alloy ?? 0) * tMult * s.count,
      );
      bufferCaps.signal += Math.round(
        (b.capAddMicro.signal ?? 0) * tMult * s.count,
      );
    }
  }

  newState.capsMicro = {
    flux: baseCaps.flux + bufferCaps.flux + mods.capBonusMicro.flux,
    alloy: baseCaps.alloy + bufferCaps.alloy + mods.capBonusMicro.alloy,
    signal: baseCaps.signal + bufferCaps.signal + mods.capBonusMicro.signal,
  };

  return newState;
}

// ─── BUY UPGRADE V2 ──────────────────────────────────────────

function applyBuyUpgradeV2(state: SimStateV1, upgradeId: string): SimStateV1 {
  if (!upgV2Catalog) return state;

  // Already purchased?
  if (state.upgradesPurchasedV2[upgradeId] === 1) return state;

  const def = upgV2Catalog.upgrades.find((u) => u.id === upgradeId);
  if (!def) return state;

  // Must be visible
  const ctx = buildConditionContext(state);
  if (!isUpgradeV2Visible(def, ctx)) return state;

  // Check cost (apply upgradeCostMult from derived)
  const mods = getDerived(state);
  const costF = Math.floor((def.cost.fluxMicro ?? 0) * mods.upgradeCostMult);
  const costA = Math.floor((def.cost.alloyMicro ?? 0) * mods.upgradeCostMult);
  const costS = Math.floor((def.cost.signalMicro ?? 0) * mods.upgradeCostMult);

  if (
    state.resources.flux < costF ||
    state.resources.alloy < costA ||
    state.resources.signal < costS
  ) {
    return state;
  }

  // Deduct cost + mark purchased
  return {
    ...state,
    resources: {
      flux: state.resources.flux - costF,
      alloy: state.resources.alloy - costA,
      signal: state.resources.signal - costS,
    },
    upgradesPurchasedV2: {
      ...state.upgradesPurchasedV2,
      [upgradeId]: 1,
    },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── START CONTRACT ──────────────────────────────────────────

function applyStartContract(state: SimStateV1, contractId: string): SimStateV1 {
  if (!contractsCatalog || !bal) return state;

  // Can't start if one already active
  if (state.contracts.active && !state.contracts.active.claimed) return state;

  // Must be revealed
  if (!state.contracts.revealed.includes(contractId)) return state;

  // Must not already be completed
  if (state.contracts.completed.includes(contractId)) return state;

  const def = contractsCatalog.contracts.find((c) => c.id === contractId);
  if (!def) return state;

  const hz = bal.simHz ?? 20;
  const durationTicks = Math.round(def.durationSec * hz);

  return {
    ...state,
    contracts: {
      ...state.contracts,
      active: {
        id: contractId,
        startedAtTick: state.tick,
        endsAtTick: state.tick + durationTicks,
        snapshotResources: { ...state.resources },
        snapshotStats: { totalFluxEarned: state.stats.totalFluxEarned },
        completed: false,
        claimed: false,
      },
    },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── CLAIM CONTRACT REWARD ───────────────────────────────────

function applyClaimContractReward(state: SimStateV1): SimStateV1 {
  if (!contractsCatalog) return state;

  const active = state.contracts.active;
  if (!active || !active.completed || active.claimed) return state;

  const def = contractsCatalog.contracts.find((c) => c.id === active.id);
  if (!def) return state;

  return {
    ...state,
    resources: {
      flux: Math.min(
        state.resources.flux + (def.rewards.fluxMicro ?? 0),
        state.capsMicro.flux,
      ),
      alloy: Math.min(
        state.resources.alloy + (def.rewards.alloyMicro ?? 0),
        state.capsMicro.alloy,
      ),
      signal: Math.min(
        state.resources.signal + (def.rewards.signalMicro ?? 0),
        state.capsMicro.signal,
      ),
    },
    contracts: {
      ...state.contracts,
      active: { ...active, claimed: true },
      completed: [...state.contracts.completed, active.id],
      revealed: state.contracts.revealed.filter((id) => id !== active.id),
    },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── TAP EVENT ───────────────────────────────────────────────

function applyTapEvent(state: SimStateV1): SimStateV1 {
  if (!eventsCatalog || !bal) return state;

  const ev = state.events.activeEvent;
  if (!ev || ev.consumed || ev.trigger !== "TAP") return state;
  if (state.tick >= ev.expiresAtTick) return state;

  const def = eventsCatalog.events.find((e) => e.id === ev.id);
  if (!def) return state;

  let res = { ...state.resources };
  let prodBoosts = [...state.events.prodBoosts];
  let capBoosts = [...state.events.capBoosts];

  for (const eff of def.effects) {
    switch (eff.t) {
      case "RESOURCE_BURST":
        res = {
          ...res,
          [eff.key]: Math.min(
            res[eff.key] + eff.amountMicro,
            state.capsMicro[eff.key],
          ),
        };
        break;
      case "PROD_BOOST":
        prodBoosts.push({
          mult: eff.mult,
          expiresAtTick: state.tick + eff.durationTicks,
        });
        break;
      case "CAP_BOOST":
        capBoosts.push({
          key: eff.key,
          amountMicro: eff.amountMicro,
          expiresAtTick: state.tick + eff.durationTicks,
        });
        break;
    }
  }

  return {
    ...state,
    resources: res,
    events: {
      ...state.events,
      activeEvent: { ...ev, consumed: true },
      prodBoosts,
      capBoosts,
    },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── TAP WRECK ─────────────────────────────────────────────

function applyTapWreck(state: SimStateV1, wreckId: string): SimStateV1 {
  if (!wrecksCatalog) return state;

  const wreck = state.wrecks.active[wreckId];
  if (!wreck || wreck.depleted) return state;

  const def = wrecksCatalog.wreckArchetypes.find(
    (a) => a.id === wreck.archetypeId,
  );
  if (!def) return state;

  // Compute tap damage (base = hpMicro / expected taps ≈ 500 per tap)
  const tapDamage = bal?.wrecks?.tapDamageMicro ?? 500;

  // Apply click mult from BOOSTERs + upgrades
  let clickMult = 1;
  if (catalog) {
    for (const s of Object.values(state.machines)) {
      if (!s.enabled) continue;
      const mDef = catalog.machines[s.code];
      if (!mDef || mDef.behavior.type !== "BOOSTER") continue;
      const tMult = mDef.tierMult[String(s.tier) as "1" | "2" | "3"];
      clickMult *= Math.pow(mDef.behavior.clickMult * tMult, s.count);
    }
  }
  const mods = getDerived(state);
  clickMult *= mods.clickMult;

  const damage = Math.round(tapDamage * clickMult);
  const newHp = Math.max(0, wreck.hpMicro - damage);

  // Yield per tap (scaled by clickMult)
  const yieldF = Math.min(
    Math.round(def.yieldPerTapMicro.flux * clickMult),
    wreck.yieldRemainingMicro.flux,
  );
  const yieldA = Math.min(
    Math.round(def.yieldPerTapMicro.alloy * clickMult),
    wreck.yieldRemainingMicro.alloy,
  );
  const yieldS = Math.min(
    Math.round(def.yieldPerTapMicro.signal * clickMult),
    wreck.yieldRemainingMicro.signal,
  );

  // Add to resources (capped)
  const newFlux = Math.min(state.resources.flux + yieldF, state.capsMicro.flux);
  const newAlloy = Math.min(
    state.resources.alloy + yieldA,
    state.capsMicro.alloy,
  );
  const newSignal = Math.min(
    state.resources.signal + yieldS,
    state.capsMicro.signal,
  );
  const actualFluxGain = newFlux - state.resources.flux;

  // Update wreck
  const updatedYield = {
    flux: wreck.yieldRemainingMicro.flux - yieldF,
    alloy: wreck.yieldRemainingMicro.alloy - yieldA,
    signal: wreck.yieldRemainingMicro.signal - yieldS,
  };

  const depleted =
    newHp <= 0 ||
    (updatedYield.flux <= 0 &&
      updatedYield.alloy <= 0 &&
      updatedYield.signal <= 0);

  const updatedWreck = {
    ...wreck,
    hpMicro: newHp,
    yieldRemainingMicro: updatedYield,
    depleted,
  };

  // If depleted and despawnOnDepleted, remove from active
  let newActive: Record<string, typeof wreck>;
  if (depleted && def.despawnOnDepleted) {
    newActive = { ...state.wrecks.active };
    delete newActive[wreckId];
  } else {
    newActive = { ...state.wrecks.active, [wreckId]: updatedWreck };
  }

  return {
    ...state,
    resources: {
      flux: newFlux,
      alloy: newAlloy,
      signal: newSignal,
    },
    wrecks: { ...state.wrecks, active: newActive },
    stats: {
      ...state.stats,
      totalFluxEarned: state.stats.totalFluxEarned + actualFluxGain,
      totalTaps: state.stats.totalTaps + 1,
    },
    flags: { ...state.flags, dirty: true },
  };
}

// ─── DISMISS MILESTONE TOAST ─────────────────────────────────

function applyDismissMilestoneToast(state: SimStateV1): SimStateV1 {
  if (state.milestones.pendingToast.length === 0) return state;
  return {
    ...state,
    milestones: { ...state.milestones, pendingToast: [] },
  };
}

// ─── REBIRTH ──────────────────────────────────────────────────

/**
 * Check whether the player meets the gate requirements for their current
 * rebirth tier. Gates are sorted by minRebirthCount descending in the
 * catalog; we pick the first gate whose minRebirthCount ≤ current count.
 */
export function canRebirth(state: SimStateV1): boolean {
  if (!rebirthCatalog) return false;
  const gate = rebirthCatalog.gates
    .slice()
    .sort((a, b) => b.minRebirthCount - a.minRebirthCount)
    .find((g) => state.meta.rebirthCount >= g.minRebirthCount);
  if (!gate) return false;
  const rs = state.runStats;
  if (
    gate.requires.totalFluxEarnedMicro != null &&
    rs.totalFluxEarnedMicro < gate.requires.totalFluxEarnedMicro
  )
    return false;
  if (
    gate.requires.wrecksDestroyedTotal != null &&
    rs.wrecksDestroyedTotal < gate.requires.wrecksDestroyedTotal
  )
    return false;
  return true;
}

/**
 * Compute how many core shards the player would gain from a rebirth.
 * Formula: floor((totalFluxEarned / fluxDivisor) ^ fluxExponent) + rarityBonus
 */
export function computeRebirthShards(state: SimStateV1): number {
  if (!rebirthCatalog) return 0;
  const f = rebirthCatalog.shardFormula;
  const fluxDisplay = state.runStats.totalFluxEarnedMicro / 1000;
  const base = Math.floor(
    Math.pow(fluxDisplay / f.fluxDivisor, f.fluxExponent),
  );
  let bonus = 0;
  const byRarity = state.runStats.wrecksDestroyedByRarity;
  for (const [rarity, multiplier] of Object.entries(f.rarityBonus)) {
    bonus += (byRarity[rarity as keyof typeof byRarity] ?? 0) * multiplier;
  }
  return Math.max(0, base + bonus);
}

/** Apply CONFIRM_REBIRTH: validate gate, award shards, reset run state. */
function applyConfirmRebirth(state: SimStateV1): SimStateV1 {
  if (!canRebirth(state)) return state;

  const shards = computeRebirthShards(state);
  const newRebirthCount = state.meta.rebirthCount + 1;

  // Accumulate lifetime stats
  const newLifetime = {
    totalWrecksDestroyed:
      state.meta.lifetime.totalWrecksDestroyed +
      state.runStats.wrecksDestroyedTotal,
    totalFluxEarnedMicro:
      state.meta.lifetime.totalFluxEarnedMicro +
      state.runStats.totalFluxEarnedMicro,
  };

  // Check FULL_ERA branch unlock
  let newBranchUnlocked = { ...state.meta.branchUnlocked };
  if (branchesCatalog) {
    if (newRebirthCount >= branchesCatalog.fullEraMinRebirthCount) {
      // Unlock all branches that have an allUnlockOnRebirth flag
      // (For now, having met the rebirth count just enables the FULL_ERA;
      //  individual branches are still unlocked by purchasing their keystone.)
    }
  }

  // Compute startBonusFlux from rebirth tree mods
  const mods = getDerived(state);
  const startFlux = mods.startBonusFluxMicro;

  const caps = balV2
    ? {
        flux: balV2.resources.fluxCapMicroBase,
        alloy: balV2.resources.alloyCapMicroBase,
        signal: balV2.resources.signalCapMicroBase,
      }
    : bal
      ? { ...bal.defaultCapsMicro }
      : { flux: 10000, alloy: 5000, signal: 3000 };

  return {
    ...state,
    tick: 0,
    resources: {
      flux: Math.min(startFlux, caps.flux),
      alloy: 0,
      signal: 0,
    },
    capsMicro: caps,
    machines: {},
    wrecks: { ...FRESH_WRECKS },
    upgradesPurchased: [],
    upgradesPurchasedV2: {},
    contracts: { ...FRESH_CONTRACTS },
    events: { ...FRESH_EVENTS },
    milestones: { ...FRESH_MILESTONES },
    stats: { totalFluxEarned: 0, totalTaps: 0, overflowLost: 0 },
    cutterDock: { ...FRESH_CUTTER_DOCK },
    runStats: { ...FRESH_RUN_STATS },
    wreckSpawn: { ...FRESH_WRECK_SPAWN },
    meta: {
      ...state.meta,
      rebirthCount: newRebirthCount,
      coreShards: state.meta.coreShards + shards,
      branchUnlocked: newBranchUnlocked,
      lifetime: newLifetime,
    },
    flags: { dirty: true },
  };
}

/** Apply BUY_REBIRTH_NODE: deduct shards, mark node purchased. */
function applyBuyRebirthNode(state: SimStateV1, nodeId: string): SimStateV1 {
  if (!rebirthTreeCatalog) return state;

  // Already purchased?
  if (state.meta.rebirthTreePurchased[nodeId] === 1) return state;

  const node = rebirthTreeCatalog.nodes.find((n) => n.id === nodeId);
  if (!node) return state;

  // Check prerequisites
  for (const req of node.requires) {
    if (state.meta.rebirthTreePurchased[req] !== 1) return state;
  }

  // Check cost
  if (state.meta.coreShards < node.cost) return state;

  return {
    ...state,
    meta: {
      ...state.meta,
      coreShards: state.meta.coreShards - node.cost,
      rebirthTreePurchased: {
        ...state.meta.rebirthTreePurchased,
        [nodeId]: 1,
      },
    },
    flags: { dirty: true },
  };
}

// ─── Fresh state ─────────────────────────────────────────────

const FRESH_CONTRACTS: ContractState = {
  active: null,
  revealed: [],
  completed: [],
  lastRevealRollTick: 0,
};

const FRESH_EVENTS: EventState = {
  activeEvent: null,
  lastSpawnRollTick: 0,
  prodBoosts: [],
  capBoosts: [],
};

const FRESH_MILESTONES: MilestoneState = {
  claimed: [],
  pendingToast: [],
};

const FRESH_WRECKS: WrecksField = {
  active: {},
  nextId: 1,
  lastSpawnRollTick: 0,
};

const FRESH_CUTTER_DOCK: CutterDockState = {
  status: "empty",
  wreckId: null,
  reservedWreckId: null,
};

const FRESH_RUN_STATS: RunStats = {
  totalCutTaps: 0,
  totalFluxEarnedMicro: 0,
  wrecksDestroyedTotal: 0,
  wrecksDestroyedByRarity: {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    ancient: 0,
  },
};

const FRESH_WRECK_SPAWN: WreckSpawnTimer = {
  nextSpawnTick: 100, // spawn first wreck after 5 seconds at 20 Hz
};

/** Create a blank state (used for RESET and initial boot). */
export function createFreshState(seed: number): SimStateV1 {
  const caps = bal
    ? { ...bal.defaultCapsMicro }
    : { flux: 10000, alloy: 5000, signal: 3000 };

  return {
    version: 1,
    seed,
    tick: 0,
    resources: { flux: 0, alloy: 0, signal: 0 },
    capsMicro: caps,
    machines: {},
    wrecks: { ...FRESH_WRECKS },
    upgradesPurchased: [],
    upgradesPurchasedV2: {},
    contracts: { ...FRESH_CONTRACTS },
    events: { ...FRESH_EVENTS },
    milestones: { ...FRESH_MILESTONES },
    stats: { totalFluxEarned: 0, totalTaps: 0, overflowLost: 0 },
    flags: { dirty: false },
    cutterDock: { ...FRESH_CUTTER_DOCK },
    runStats: { ...FRESH_RUN_STATS },
    wreckSpawn: { ...FRESH_WRECK_SPAWN },
    meta: {
      rebirthCount: 0,
      coreShards: 0,
      branchUnlocked: {},
      rebirthTreePurchased: {},
      lifetime: { totalWrecksDestroyed: 0, totalFluxEarnedMicro: 0 },
    },
  };
}
