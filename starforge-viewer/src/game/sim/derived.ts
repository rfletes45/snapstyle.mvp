/**
 * Derived modifiers — aggregates upgrade effects into runtime multipliers.
 * Pure function: (upgradesPurchased, catalog) → DerivedMods.
 * No DOM, no Three.js.
 */
import type { BaseSlotsV2Catalog, PlacementMap } from "../data/baseSlotsSchema";
import type { BranchesCatalog } from "../data/branchesSchema";
import type { MachinesV2Catalog, MachineV2Def } from "../data/machinesSchema";
import type { RebirthTreeCatalog } from "../data/rebirthSchema";
import type {
  UpgradesCatalog,
  UpgradesV2Catalog,
  UpgradeV2Condition,
  UpgradeV2Def,
  VisibilityUnlock,
} from "../data/upgradesSchema";
import type {
  MachineCode,
  ResourceCaps,
  RunStats,
  SimMeta,
  SimStateV1,
  WreckRarity,
} from "./types";

// ─── Derived modifier output ────────────────────────────────

export interface DerivedMods {
  /** Multiplicative bonus to tap amount. */
  clickMult: number;
  /** Multiplicative bonus to all machine production. */
  globalProdMult: number;
  /** Per-machine multiplicative production bonus. */
  machineProdMult: Record<string, number>;
  /** Additive cap bonuses (micro-units). */
  capBonusMicro: ResourceCaps;
  /** Per-machine converter efficiency multiplier. */
  converterEfficiency: Record<string, number>;
  /** Per-machine (or "*" wildcard) cost reduction multiplier. */
  costReduction: Record<string, number>;
  /** Additive bonus to contract reveal chance. */
  revealChanceAdd: number;

  // ── V2 cutter-dock derived values ──
  /** Micro-HP damage per CUT_TAP. Sourced from balance.v2. */
  cutDamageMicroPerTap: number;
  /** Multiplicative bonus to cut damage (from upgrades). */
  cutDamageMult: number;
  /** Multiplicative bonus to wreck flux payout on destroy. */
  wreckYieldMult: number;
  /** Multiplicative factor on transit ticks (lower = faster transit). */
  transitTicksMult: number;

  // ── V2 wreck-spawn derived values ──
  /** Max alive wrecks (base from catalog + additive bonuses). */
  maxAliveWrecks: number;
  /** Additive bonus to max alive wrecks (from upgrades). */
  maxAliveWrecksAdd: number;
  /** Multiplicative factor on spawn gap (lower = faster spawns). */
  spawnGapMult: number;
  /** Per-rarity weight multiplier (upgrades can shift rare/epic probability). */
  rarityWeightMult: Record<WreckRarity, number>;

  // ── V2 upgrade-derived flags ──
  /** Tier unlock flags: tierUnlockAllowed[machine][tier] = true. */
  tierUnlockAllowed: Record<string, Record<number, boolean>>;

  // ── V2 optional derived paths (generic numeric) ──
  /** Additive bonus to weakpoint window ticks. */
  weakpointWindowTicksAdd: number;
  /** Additive bonus to weakpoint damage multiplier (stacks with baseMult). */
  weakpointMultAdd: number;
  /** Multiplicative drone cooldown factor. */
  droneCooldownMult: number;
  /** Multiplicative signal rate factor. */
  signalRateMult: number;
  /** Multiplicative nanoforge conversion rate. */
  nanoforgeRateMult: number;
  /** Multiplicative upgrade cost factor (for assembler-type effects). */
  upgradeCostMult: number;
  /** Additive bonus flux (micro) granted at start of a new run after rebirth. */
  startBonusFluxMicro: number;
}

/**
 * Cached v2 base cut damage — set once from balance.v2.json at boot.
 * Falls back to 250 if never set (safe default).
 */
let cachedBaseCutDamage = 250;
let cachedMaxAliveBase = 3;

/** Set the base cut damage from balance.v2 at boot. */
export function setDerivedBaseCutDamage(dmg: number): void {
  cachedBaseCutDamage = dmg;
}

/** Set the base max-alive-wrecks from wrecks.v2.json at boot. */
export function setDerivedMaxAliveBase(n: number): void {
  cachedMaxAliveBase = n;
}

// ─── V2 upgrades catalog cache ──────────────────────────────

let cachedUpgV2: UpgradesV2Catalog | null = null;

/** Set the v2 upgrades catalog at boot. */
export function setDerivedUpgradesV2(cat: UpgradesV2Catalog): void {
  cachedUpgV2 = cat;
}

// ─── Rebirth tree catalog cache ─────────────────────────────

let cachedRebirthTree: RebirthTreeCatalog | null = null;

/** Set the rebirth tree catalog at boot. */
export function setDerivedRebirthTree(cat: RebirthTreeCatalog): void {
  cachedRebirthTree = cat;
}

// ─── Condition evaluation (pure) ────────────────────────────

/** Context needed to evaluate v2 unlock conditions. */
export interface ConditionContext {
  runStats: RunStats;
  totalFluxEarnedMicro: number;
  machines: Record<MachineCode, { count: number }>;
  upgradesPurchasedV2: Record<string, number>;
}

/** Evaluate a single v2 condition. */
export function evaluateCondition(
  cond: UpgradeV2Condition,
  ctx: ConditionContext,
): boolean {
  switch (cond.t) {
    case "TOTAL_WRECKS_DESTROYED":
      return ctx.runStats.wrecksDestroyedTotal >= cond.gte;
    case "TOTAL_CUT_TAPS":
      return ctx.runStats.totalCutTaps >= cond.gte;
    case "DESTROY_RARITY":
      return (
        (ctx.runStats.wrecksDestroyedByRarity[cond.rarity] ?? 0) >= cond.gte
      );
    case "TOTAL_FLUX_EARNED":
      return ctx.totalFluxEarnedMicro >= cond.gteMicro;
    case "OWN_MACHINE_COUNT":
      return (ctx.machines[cond.code]?.count ?? 0) >= cond.gte;
    case "UPGRADE_PURCHASED":
      return ctx.upgradesPurchasedV2[cond.id] === 1;
    default:
      return false;
  }
}

/** Evaluate a visibility unlock rule (all/any groups). */
export function evaluateVisibility(
  rule: VisibilityUnlock,
  ctx: ConditionContext,
): boolean {
  if (rule.all) {
    if (!rule.all.every((c) => evaluateCondition(c, ctx))) return false;
  }
  if (rule.any) {
    if (!rule.any.some((c) => evaluateCondition(c, ctx))) return false;
  }
  return true;
}

/** Is a v2 upgrade visible to the player? */
export function isUpgradeV2Visible(
  upg: UpgradeV2Def,
  ctx: ConditionContext,
): boolean {
  // Already purchased → always visible
  if (ctx.upgradesPurchasedV2[upg.id] === 1) return true;
  return evaluateVisibility(upg.visibilityUnlock, ctx);
}

/** Build a ConditionContext from SimStateV1. */
export function buildConditionContext(state: SimStateV1): ConditionContext {
  return {
    runStats: state.runStats,
    totalFluxEarnedMicro: state.stats.totalFluxEarned,
    machines: state.machines,
    upgradesPurchasedV2: state.upgradesPurchasedV2,
  };
}

// ─── V2 machine visibility (branch gating) ──────────────────

let cachedBranches: BranchesCatalog | null = null;

/** Set the branches catalog at boot. */
export function setDerivedBranchesCatalog(cat: BranchesCatalog): void {
  cachedBranches = cat;
}

/**
 * Is a v2 machine visible to the player?
 *
 * Rules:
 *  1. Always check visibilityUnlock conditions (same as upgrades).
 *  2. Before first rebirth (rebirthCount === 0), only starterMachines are visible.
 *  3. After rebirth, branched machines require their branch to be unlocked
 *     OR the machine is the keystone that *unlocks* the branch.
 *  4. Starter machines (branchId === null) are always visible once conditions pass.
 */
export function isMachineV2Visible(
  machine: MachineV2Def,
  ctx: ConditionContext,
  meta: SimMeta,
): boolean {
  // Already owned → always visible
  if ((ctx.machines[machine.code]?.count ?? 0) > 0) return true;

  // Condition gate
  if (!evaluateVisibility(machine.visibilityUnlock, ctx)) return false;

  // Starter machine (no branch) — always visible after conditions pass
  if (machine.branchId === null) return true;

  // Before rebirth — only starters are visible
  if (!cachedBranches) return true; // no catalog = no gating
  if (meta.rebirthCount < cachedBranches.fullEraMinRebirthCount) return false;

  // After rebirth: check branch gating
  const branch = cachedBranches.branches[machine.branchId];
  if (!branch) return true; // unknown branch = no gating

  // Keystone machines are always visible (they unlock the branch)
  if (branch.keystone === machine.code) return true;

  // Non-keystone — branch must be unlocked (keystone purchased)
  return meta.branchUnlocked[machine.branchId] === true;
}

// ─── Default DerivedMods ────────────────────────────────────

function defaultMods(): DerivedMods {
  return {
    clickMult: 1,
    globalProdMult: 1,
    machineProdMult: {},
    capBonusMicro: { flux: 0, alloy: 0, signal: 0 },
    converterEfficiency: {},
    costReduction: {},
    revealChanceAdd: 0,
    cutDamageMicroPerTap: cachedBaseCutDamage,
    cutDamageMult: 1.0,
    wreckYieldMult: 1.0,
    transitTicksMult: 1.0,
    maxAliveWrecks: cachedMaxAliveBase,
    maxAliveWrecksAdd: 0,
    spawnGapMult: 1.0,
    rarityWeightMult: { common: 1, uncommon: 1, rare: 1, epic: 1, ancient: 1 },
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

// ─── Compute derived from V1 + V2 upgrades ─────────────────

/**
 * Compute derived modifiers from the set of purchased upgrade IDs
 * and owned machine stacks (v2 params drive passive effects).
 */
export function computeDerived(
  purchased: readonly string[],
  catalog: UpgradesCatalog,
  purchasedV2?: Record<string, number>,
  machines?: Record<string, { count: number; tier: number; enabled: boolean }>,
  rebirthTreePurchased?: Record<string, number>,
): DerivedMods {
  const mods = defaultMods();

  // ── V1 upgrades ──
  const purchasedSet = new Set(purchased);

  for (const upg of catalog.upgrades) {
    if (!purchasedSet.has(upg.id)) continue;

    for (const eff of upg.effects) {
      switch (eff.type) {
        case "clickMult":
          mods.clickMult *= eff.mult;
          break;
        case "globalProdMult":
          mods.globalProdMult *= eff.mult;
          break;
        case "machineProdMult":
          mods.machineProdMult[eff.machineCode] =
            (mods.machineProdMult[eff.machineCode] ?? 1) * eff.mult;
          break;
        case "capBonus":
          mods.capBonusMicro[eff.resource] += eff.amountMicro;
          break;
        case "converterEfficiency":
          mods.converterEfficiency[eff.machineCode] =
            (mods.converterEfficiency[eff.machineCode] ?? 1) * eff.mult;
          break;
        case "costReduction":
          mods.costReduction[eff.machineCode] =
            (mods.costReduction[eff.machineCode] ?? 1) * eff.mult;
          break;
        case "revealChanceAdd":
          mods.revealChanceAdd += eff.amount;
          break;
        case "tierUnlock":
          // Legacy: no runtime modifier — purely flag check via upgradesPurchased.
          break;
      }
    }
  }

  // ── V2 upgrades ──
  if (cachedUpgV2 && purchasedV2) {
    applyV2Effects(mods, purchasedV2, cachedUpgV2);
  }

  // ── V2 machine-param-driven effects ──
  if (cachedMachinesV2 && machines) {
    applyMachineParamEffects(mods, machines, cachedMachinesV2);
  }

  // ── Rebirth tree effects (permanent across runs) ──
  if (cachedRebirthTree && rebirthTreePurchased) {
    for (const node of cachedRebirthTree.nodes) {
      if (rebirthTreePurchased[node.id] !== 1) continue;
      for (const eff of node.effects) {
        switch (eff.t) {
          case "MUL":
            applyMul(mods, eff.path, eff.value);
            break;
          case "ADD":
            applyAdd(mods, eff.path, eff.value);
            break;
          case "FLAG":
            applyFlag(mods, eff.path, eff.value);
            break;
        }
      }
    }
  }

  // Apply additive max-alive bonus
  mods.maxAliveWrecks += mods.maxAliveWrecksAdd;

  // Apply cut damage mult to base
  mods.cutDamageMicroPerTap = Math.floor(
    mods.cutDamageMicroPerTap * mods.cutDamageMult,
  );

  return mods;
}

/** Apply V2 upgrade effects into DerivedMods. */
function applyV2Effects(
  mods: DerivedMods,
  purchasedV2: Record<string, number>,
  catalog: UpgradesV2Catalog,
): void {
  for (const upg of catalog.upgrades) {
    if (purchasedV2[upg.id] !== 1) continue;

    for (const eff of upg.effects) {
      switch (eff.op) {
        case "mul":
          applyMul(mods, eff.path, eff.value);
          break;
        case "add":
          applyAdd(mods, eff.path, eff.value);
          break;
        case "mulRarity":
          mods.rarityWeightMult[eff.rarity] =
            (mods.rarityWeightMult[eff.rarity] ?? 1) * eff.value;
          break;
        case "flag":
          applyFlag(mods, eff.path, eff.value);
          break;
      }
    }
  }
}

/** Apply a multiplicative effect on a named derived field. */
function applyMul(mods: DerivedMods, path: string, value: number): void {
  switch (path) {
    case "wreckYieldMult":
      mods.wreckYieldMult *= value;
      break;
    case "spawnGapMult":
      mods.spawnGapMult *= value;
      break;
    case "cutDamageMult":
      mods.cutDamageMult *= value;
      break;
    case "transitTicksMult":
      mods.transitTicksMult *= value;
      break;
    case "droneCooldownMult":
      mods.droneCooldownMult *= value;
      break;
    case "signalRateMult":
      mods.signalRateMult *= value;
      break;
    case "nanoforgeRateMult":
      mods.nanoforgeRateMult *= value;
      break;
    case "upgradeCostMult":
      mods.upgradeCostMult *= value;
      break;
    case "clickMult":
      mods.clickMult *= value;
      break;
    case "globalProdMult":
      mods.globalProdMult *= value;
      break;
    default:
      // Unknown path — silently ignore for forward compatibility
      break;
  }
}

/** Apply an additive effect on a named derived field. */
function applyAdd(mods: DerivedMods, path: string, value: number): void {
  switch (path) {
    case "maxAliveWrecks":
      mods.maxAliveWrecksAdd += value;
      break;
    case "weakpointWindowTicksAdd":
      mods.weakpointWindowTicksAdd += value;
      break;
    case "weakpointMultAdd":
      mods.weakpointMultAdd += value;
      break;
    case "revealChanceAdd":
      mods.revealChanceAdd += value;
      break;
    case "startBonusFluxMicro":
      mods.startBonusFluxMicro += value;
      break;
    default:
      break;
  }
}

/** Apply a flag effect — currently supports tierUnlock.MACHINE.TIER paths. */
function applyFlag(mods: DerivedMods, path: string, value: number): void {
  // Parse "tierUnlock.CUTTER.2" → machine=CUTTER, tier=2
  const parts = path.split(".");
  if (parts[0] === "tierUnlock" && parts.length === 3) {
    const machine = parts[1];
    const tier = parseInt(parts[2], 10);
    if (!isNaN(tier) && value === 1) {
      if (!mods.tierUnlockAllowed[machine]) {
        mods.tierUnlockAllowed[machine] = {};
      }
      mods.tierUnlockAllowed[machine][tier] = true;
    }
  }
}

// ─── Machine-param-driven effects ──────────────────────────

/**
 * Apply passive effects from owned v2 machines' params into DerivedMods.
 * These stack multiplicatively / additively based on machine type.
 */
function applyMachineParamEffects(
  mods: DerivedMods,
  machines: Record<string, { count: number; tier: number; enabled: boolean }>,
  catalog: MachinesV2Catalog,
): void {
  for (const mDef of catalog.machines) {
    const stack = machines[mDef.code];
    if (!stack || stack.count <= 0) continue;

    const tierMult = mDef.tier.tierMult[String(stack.tier)] ?? 1;
    const p = mDef.params as Record<string, unknown>;

    switch (mDef.behaviorType) {
      case "CUTTER": {
        // Damage scaling: cutDamageMult *= tierMult * (1 + damageScalePerExtra * (count-1))
        const dmgScale = (p.damageScalePerExtra as number) ?? 0;
        mods.cutDamageMult *= tierMult * (1 + dmgScale * (stack.count - 1));
        // Yield scaling: wreckYieldMult *= (1 + yieldScalePerExtra * (count-1))
        const yieldScale = (p.yieldScalePerExtra as number) ?? 0;
        mods.wreckYieldMult *= 1 + yieldScale * (stack.count - 1);
        break;
      }
      case "CRANE": {
        // Transit speed: multiplicative
        const transitMult = (p.transitTicksMult as number) ?? 1;
        mods.transitTicksMult *= transitMult;
        // Max alive wrecks: additive
        const aliveAdd = (p.maxAliveWrecksAdd as number) ?? 0;
        mods.maxAliveWrecksAdd += aliveAdd;
        break;
      }
      case "BATTERY": {
        // Drone cooldown reduction per unit — multiplicative per stack count
        const cdMult = (p.droneCooldownMultPerUnit as number) ?? 1;
        mods.droneCooldownMult *= Math.pow(cdMult * tierMult, stack.count);
        break;
      }
      case "SCANNER": {
        // Rarity weight multipliers from params
        const rwm = p.rarityWeightMult as Record<string, number> | undefined;
        if (rwm) {
          for (const [rarity, mult] of Object.entries(rwm)) {
            mods.rarityWeightMult[rarity as WreckRarity] =
              (mods.rarityWeightMult[rarity as WreckRarity] ?? 1) * mult;
          }
        }
        // Weakpoint damage mult bonus (adds to baseMult in CUT_TAP)
        const wpAdd = (p.weakpointMultAdd as number) ?? 0;
        mods.weakpointMultAdd += wpAdd * stack.count;
        break;
      }
      case "LAB": {
        // Yield multiplier
        const ym = (p.yieldMult as number) ?? 1;
        mods.wreckYieldMult *= ym;
        break;
      }
      case "SIGNAL": {
        // Signal rate is driven by tier in sim.ts — just apply signalRateMult if any
        // (currently no param-based signalRateMult, but tierMult is used in sim)
        break;
      }
      case "ASSEMBLER": {
        // Upgrade cost multiplier
        const ucm = (p.upgradeCostMult as number) ?? 1;
        mods.upgradeCostMult *= ucm;
        break;
      }
      case "DYSON": {
        // Rarity weight multipliers
        const drwm = p.rarityWeightMult as Record<string, number> | undefined;
        if (drwm) {
          for (const [rarity, mult] of Object.entries(drwm)) {
            mods.rarityWeightMult[rarity as WreckRarity] =
              (mods.rarityWeightMult[rarity as WreckRarity] ?? 1) * mult;
          }
        }
        break;
      }
      // HOPPER, DRONE_FETCH, CONVERTER_ALLOY_TO_FLUX, SLOT_UNLOCK_PROGRESS
      // → handled directly in sim.ts tick logic, not derived
      default:
        break;
    }
  }
}

// ─── BaseSlots / Placement ─────────────────────────────────

let cachedBaseSlots: BaseSlotsV2Catalog | null = null;
let cachedMachinesV2: MachinesV2Catalog | null = null;

/** Set the base-slots catalog at boot. */
export function setDerivedBaseSlots(cat: BaseSlotsV2Catalog): void {
  cachedBaseSlots = cat;
}

/** Set the machines-v2 catalog for placement. */
export function setDerivedMachinesV2(cat: MachinesV2Catalog): void {
  cachedMachinesV2 = cat;
}

/**
 * Deterministic placement priority — machines are placed in this order.
 * Earlier entries get first pick of preferred slots.
 */
const PLACEMENT_PRIORITY: readonly string[] = [
  "CUTTER",
  "DRONES_MAG",
  "CRANE",
  "SCANNER",
  "HOPPER",
  "BATTERY",
  "SIGNAL",
  "ASSEMBLER",
  "NANOFORGE",
  "PRINTER",
  "LAB",
  "DYSON",
] as const;

/**
 * Compute a deterministic PlacementMap from the current machine stacks.
 *
 * Algorithm:
 *  1. Build set of unlocked slots (exclude slots whose lockedByNode is not
 *     in meta.rebirthTreePurchased).
 *  2. Walk machines in PLACEMENT_PRIORITY order.
 *  3. For each owned machine (count > 0):
 *     a. Try its fixedSlotId (primary). If 1×2 footprint, also need
 *        fixedSlotIdSecondary (or auto-find gz+1 neighbour at same gx).
 *     b. If preferred slot(s) taken/locked, fall back to first available
 *        slot of matching type.
 *     c. If no slot available, place at overflow position (0, -4) and warn.
 *  4. Return the map.
 */
export function computePlacement(
  machines: Record<string, { count: number }>,
  meta: { rebirthTreePurchased: Record<string, number> },
): PlacementMap {
  if (!cachedBaseSlots || !cachedMachinesV2) return {};

  const slotDefs = cachedBaseSlots.slots;
  const machDefs = cachedMachinesV2.machines;

  // Build lookup: machineCode → MachineV2Def
  const machByCode = new Map<string, MachineV2Def>();
  for (const m of machDefs) machByCode.set(m.code, m);

  // Build set of unlocked slot IDs
  const unlockedSlotIds = new Set<string>();
  for (const slot of slotDefs) {
    if (slot.lockedByNode) {
      if (meta.rebirthTreePurchased[slot.lockedByNode] === 1) {
        unlockedSlotIds.add(slot.id);
      }
      // else: locked — skip
    } else {
      unlockedSlotIds.add(slot.id);
    }
  }

  // Slot lookup by id
  const slotById = new Map(slotDefs.map((s) => [s.id, s]));

  // Track which slots are occupied
  const occupiedSlots = new Set<string>();

  const result: PlacementMap = {};

  for (const code of PLACEMENT_PRIORITY) {
    const count = machines[code]?.count ?? 0;
    if (count <= 0) continue;

    const mdef = machByCode.get(code);
    if (!mdef) continue;

    const is1x2 = mdef.footprint.h === 2;

    // Try preferred slot
    const preferredPrimary = mdef.fixedSlotId;
    const preferredSecondary = mdef.fixedSlotIdSecondary;

    let placed = false;

    // Attempt preferred placement
    if (
      preferredPrimary &&
      unlockedSlotIds.has(preferredPrimary) &&
      !occupiedSlots.has(preferredPrimary)
    ) {
      if (is1x2) {
        // Need secondary slot too
        const secId =
          preferredSecondary ?? findSecondarySlot(preferredPrimary, slotDefs);
        if (secId && unlockedSlotIds.has(secId) && !occupiedSlots.has(secId)) {
          const ps = slotById.get(preferredPrimary)!;
          const ss = slotById.get(secId)!;
          occupiedSlots.add(preferredPrimary);
          occupiedSlots.add(secId);
          result[code] = {
            primarySlotId: preferredPrimary,
            secondarySlotId: secId,
            x: (ps.x + ss.x) / 2,
            z: (ps.z + ss.z) / 2,
          };
          placed = true;
        }
      } else {
        // 1×1
        const ps = slotById.get(preferredPrimary)!;
        occupiedSlots.add(preferredPrimary);
        result[code] = {
          primarySlotId: preferredPrimary,
          x: ps.x,
          z: ps.z,
        };
        placed = true;
      }
    }

    // Fallback: first available slot(s)
    if (!placed) {
      if (is1x2) {
        placed = fallbackPlace1x2(
          code,
          slotDefs,
          unlockedSlotIds,
          occupiedSlots,
          slotById,
          result,
        );
      } else {
        placed = fallbackPlace1x1(
          code,
          mdef.slotPreference,
          slotDefs,
          unlockedSlotIds,
          occupiedSlots,
          slotById,
          result,
        );
      }
    }

    // Overflow
    if (!placed) {
      console.warn(
        `[Placement] No slot available for ${code} — overflow at (0, -4)`,
      );
      result[code] = {
        primarySlotId: "__OVERFLOW__",
        x: 0,
        z: -4,
      };
    }
  }

  return result;
}

/**
 * Find a secondary slot at (same gx, gz+1) relative to the primary slot.
 */
function findSecondarySlot(
  primaryId: string,
  slots: BaseSlotsV2Catalog["slots"],
): string | undefined {
  const primary = slots.find((s) => s.id === primaryId);
  if (!primary) return undefined;
  const sec = slots.find(
    (s) => s.id !== primaryId && s.gx === primary.gx && s.gz === primary.gz + 1,
  );
  return sec?.id;
}

/** Fallback: place a 1×1 machine in the first available unlocked, unoccupied slot. */
function fallbackPlace1x1(
  code: string,
  _slotPref: string,
  slots: BaseSlotsV2Catalog["slots"],
  unlocked: Set<string>,
  occupied: Set<string>,
  slotById: Map<string, BaseSlotsV2Catalog["slots"][0]>,
  result: PlacementMap,
): boolean {
  for (const slot of slots) {
    if (unlocked.has(slot.id) && !occupied.has(slot.id)) {
      occupied.add(slot.id);
      const s = slotById.get(slot.id)!;
      result[code] = { primarySlotId: slot.id, x: s.x, z: s.z };
      return true;
    }
  }
  return false;
}

/** Fallback: place a 1×2 machine in first available pair at same gx, consecutive gz. */
function fallbackPlace1x2(
  code: string,
  slots: BaseSlotsV2Catalog["slots"],
  unlocked: Set<string>,
  occupied: Set<string>,
  slotById: Map<string, BaseSlotsV2Catalog["slots"][0]>,
  result: PlacementMap,
): boolean {
  for (const slot of slots) {
    if (!unlocked.has(slot.id) || occupied.has(slot.id)) continue;
    // Look for a partner at (gx, gz+1)
    const partner = slots.find(
      (s) =>
        s.id !== slot.id &&
        s.gx === slot.gx &&
        s.gz === slot.gz + 1 &&
        unlocked.has(s.id) &&
        !occupied.has(s.id),
    );
    if (partner) {
      occupied.add(slot.id);
      occupied.add(partner.id);
      const ps = slotById.get(slot.id)!;
      const ss = slotById.get(partner.id)!;
      result[code] = {
        primarySlotId: slot.id,
        secondarySlotId: partner.id,
        x: (ps.x + ss.x) / 2,
        z: (ps.z + ss.z) / 2,
      };
      return true;
    }
  }
  return false;
}
