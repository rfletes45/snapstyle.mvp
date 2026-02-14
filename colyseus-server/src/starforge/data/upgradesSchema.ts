/**
 * TypeScript types for upgrades.v1.json.
 * Pure data — no DOM / Three.js.
 */
import type { ResourceKey } from "../sim/types";

// ─── Upgrade effect variants ────────────────────────────────

export interface ClickMultEffect {
  type: "clickMult";
  /** Multiplicative bonus to tap strength. */
  mult: number;
}

export interface GlobalProdMultEffect {
  type: "globalProdMult";
  /** Multiplicative bonus to all machine production. */
  mult: number;
}

export interface MachineProdMultEffect {
  type: "machineProdMult";
  /** Boost a specific machine code's production. */
  machineCode: string;
  mult: number;
}

export interface CapBonusEffect {
  type: "capBonus";
  /** Additive cap increase (micro-units). */
  resource: ResourceKey;
  amountMicro: number;
}

export interface ConverterEfficiencyEffect {
  type: "converterEfficiency";
  /** Multiplicative bonus to converter outPerIn. */
  machineCode: string;
  mult: number;
}

export interface CostReductionEffect {
  type: "costReduction";
  /** Multiplicative cost reduction (0.9 = 10% cheaper). */
  machineCode: string;
  mult: number;
}

export interface RevealChanceAddEffect {
  type: "revealChanceAdd";
  /** Additive bonus to contract reveal chance. */
  amount: number;
}

export interface TierUnlockEffect {
  type: "tierUnlock";
  /** Machine code whose tier is being unlocked. */
  machineCode: string;
  /** The tier being unlocked (2 or 3). */
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

// ─── Upgrade definition ─────────────────────────────────────

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  /** Flux requirement to unlock (show) this upgrade. */
  requiresFluxMicro: number;
  /** Prerequisites: other upgrade IDs that must be purchased first. */
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
