/**
 * TypeScript types for upgrades.v1.json and upgrades.v2.json.
 * Pure data — no DOM / Three.js.
 */
import type { ResourceKey, WreckRarity } from "../sim/types";

// ═══════════════════════════════════════════════════════════
// ── Upgrades V1 (legacy) ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

export interface ClickMultEffect {
  type: "clickMult";
  mult: number;
}

export interface GlobalProdMultEffect {
  type: "globalProdMult";
  mult: number;
}

export interface MachineProdMultEffect {
  type: "machineProdMult";
  machineCode: string;
  mult: number;
}

export interface CapBonusEffect {
  type: "capBonus";
  resource: ResourceKey;
  amountMicro: number;
}

export interface ConverterEfficiencyEffect {
  type: "converterEfficiency";
  machineCode: string;
  mult: number;
}

export interface CostReductionEffect {
  type: "costReduction";
  machineCode: string;
  mult: number;
}

export interface RevealChanceAddEffect {
  type: "revealChanceAdd";
  amount: number;
}

export interface TierUnlockEffect {
  type: "tierUnlock";
  machineCode: string;
  tier: 2 | 3;
}

export type UpgradeEffect =
  | ClickMultEffect
  | GlobalProdMultEffect
  | MachineProdMultEffect
  | CapBonusEffect
  | ConverterEfficiencyEffect
  | CostReductionEffect
  | RevealChanceAddEffect
  | TierUnlockEffect;

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  requiresFluxMicro: number;
  requires?: string[];
  cost: {
    fluxMicro?: number;
    alloyMicro?: number;
    signalMicro?: number;
  };
  effects: UpgradeEffect[];
}

export interface UpgradesCatalog {
  schemaVersion: "starforge.upgrades.v1";
  upgrades: UpgradeDef[];
}

// ═══════════════════════════════════════════════════════════
// ── Upgrades V2 ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

// ── Condition types for visibilityUnlock ─────────────────

export interface CondTotalWrecksDestroyed {
  t: "TOTAL_WRECKS_DESTROYED";
  gte: number;
}

export interface CondTotalCutTaps {
  t: "TOTAL_CUT_TAPS";
  gte: number;
}

export interface CondDestroyRarity {
  t: "DESTROY_RARITY";
  rarity: WreckRarity;
  gte: number;
}

export interface CondTotalFluxEarned {
  t: "TOTAL_FLUX_EARNED";
  gteMicro: number;
}

export interface CondOwnMachineCount {
  t: "OWN_MACHINE_COUNT";
  code: string;
  gte: number;
}

export interface CondUpgradePurchased {
  t: "UPGRADE_PURCHASED";
  id: string;
}

export type UpgradeV2Condition =
  | CondTotalWrecksDestroyed
  | CondTotalCutTaps
  | CondDestroyRarity
  | CondTotalFluxEarned
  | CondOwnMachineCount
  | CondUpgradePurchased;

/** Visibility rule: all conditions in a group must pass. */
export interface VisibilityUnlock {
  all?: UpgradeV2Condition[];
  any?: UpgradeV2Condition[];
}

// ── Effect ops ──────────────────────────────────────────

export interface EffectMul {
  op: "mul";
  path: string;
  value: number;
}

export interface EffectAdd {
  op: "add";
  path: string;
  value: number;
}

export interface EffectFlag {
  op: "flag";
  /** Dot-delimited path, e.g. "tierUnlock.CUTTER.2". */
  path: string;
  value: number;
}

export interface EffectMulRarity {
  op: "mulRarity";
  path: string;
  rarity: WreckRarity;
  value: number;
}

export type UpgradeV2Effect =
  | EffectMul
  | EffectAdd
  | EffectFlag
  | EffectMulRarity;

// ── Upgrade V2 definition ───────────────────────────────

export interface UpgradeV2Def {
  id: string;
  title: string;
  desc: string;
  category: string;
  cost: { fluxMicro: number; alloyMicro: number; signalMicro: number };
  purchase: { maxPurchases: number };
  visibilityUnlock: VisibilityUnlock;
  effects: UpgradeV2Effect[];
}

export interface UpgradesV2Catalog {
  schemaVersion: "starforge.upgrades.v2";
  upgrades: UpgradeV2Def[];
}
