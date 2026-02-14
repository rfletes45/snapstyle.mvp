/**
 * TypeScript types for machines.v1.json.
 * Pure data — no DOM / Three.js.
 */
import type { ResourceKey } from "../sim/types";

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
