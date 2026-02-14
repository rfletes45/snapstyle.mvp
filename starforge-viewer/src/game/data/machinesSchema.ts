/**
 * TypeScript types for machines.v1.json and machines.v2.json.
 * Pure data — no DOM / Three.js.
 */
import type { ResourceKey } from "../sim/types";
import type { VisibilityUnlock } from "./upgradesSchema";

// ─── Behavior variants ──────────────────────────────────────

export interface ProducerBehavior {
  type: "PRODUCER";
  resource: ResourceKey;
  perSecMicro: number;
}

export interface ConverterBehavior {
  type: "CONVERTER";
  in: ResourceKey;
  out: ResourceKey;
  inPerSecMicro: number;
  outPerIn: number;
}

export interface BufferBehavior {
  type: "BUFFER";
  capAddMicro: { flux?: number; alloy?: number; signal?: number };
  overflowLossMult: number;
}

export interface BoosterBehavior {
  type: "BOOSTER";
  clickMult: number;
  globalProdMult: number;
}

export interface ContractBehavior {
  type: "CONTRACT";
  signalPerSecMicro: number;
  contractRollMult: number;
}

export interface DiscoveryBehavior {
  type: "DISCOVERY";
  revealChanceAdd: number;
}

export interface CosmicBehavior {
  type: "COSMIC";
  special: string;
}

export type MachineBehavior =
  | ProducerBehavior
  | ConverterBehavior
  | BufferBehavior
  | BoosterBehavior
  | ContractBehavior
  | DiscoveryBehavior
  | CosmicBehavior;

// ─── Machine definition ─────────────────────────────────────

export interface MachineDef {
  unlock: { requiresFluxMicro: number };
  buyCost: { fluxMicro: number; alloyMicro?: number; signalMicro?: number };
  costGrowth: number;
  tierMult: { "1": number; "2": number; "3": number };
  behavior: MachineBehavior;
}

export interface MachinesCatalog {
  schemaVersion: "starforge.machines.v1";
  machines: Record<string, MachineDef>;
}

// ─── V2 Machine definition ──────────────────────────────────

/** V2 behavior type tag (no embedded behavior object — params live in `params`). */
export type MachineV2BehaviorType =
  | "CUTTER"
  | "HOPPER"
  | "DRONE_FETCH"
  | "CRANE"
  | "BATTERY"
  | "SCANNER"
  | "LAB"
  | "SIGNAL"
  | "ASSEMBLER"
  | "CONVERTER_ALLOY_TO_FLUX"
  | "SLOT_UNLOCK_PROGRESS"
  | "DYSON";

export interface MachineFootprint {
  w: number;
  h: number;
}

export interface MachineV2Def {
  code: string;
  title: string;
  desc: string;
  /** Branch this machine belongs to (null = starter). */
  branchId: string | null;
  /** Max purchasable copies (1 = unique, 999999 = stackable). */
  maxCount: number;
  /** True if this machine can be toggled ON/OFF. */
  converter: boolean;
  behaviorType: MachineV2BehaviorType;
  slotPreference: string;
  fixedSlotId: string;
  fixedSlotIdSecondary?: string;
  footprint: MachineFootprint;
  cost: { baseFluxMicro: number; growth: number };
  visibilityUnlock: VisibilityUnlock;
  tier: {
    maxTier: number;
    tierMult: Record<string, number>;
  };
  /** Free-form params consumed by sim behaviours. */
  params: Record<string, unknown>;
}

export interface MachinesV2Catalog {
  schemaVersion: "starforge.machines.v2";
  machines: MachineV2Def[];
}
