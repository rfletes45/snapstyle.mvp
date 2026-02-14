/**
 * TypeScript types for contracts.v1.json.
 * Pure data — no DOM / Three.js.
 */
import type { ResourceKey } from "../sim/types";

// ─── Contract requirement variants ──────────────────────────

export interface EarnResourceReq {
  t: "EARN_RESOURCE";
  key: ResourceKey;
  amountMicro: number;
}

export interface OwnMachineReq {
  t: "OWN_MACHINE";
  code: string;
  count: number;
}

export interface UpgradesPurchasedReq {
  t: "UPGRADES_PURCHASED";
  count: number;
}

export type ContractRequirement =
  | EarnResourceReq
  | OwnMachineReq
  | UpgradesPurchasedReq;

// ─── Contract rewards ───────────────────────────────────────

export interface ContractReward {
  fluxMicro?: number;
  alloyMicro?: number;
  signalMicro?: number;
  echoMicro?: number; // reserved for rebirth PR#7
}

// ─── Contract definition ────────────────────────────────────

export interface ContractDef {
  id: string;
  title: string;
  desc: string;
  durationSec: number;
  requirements: ContractRequirement[];
  rewards: ContractReward;
  difficulty: 1 | 2 | 3 | 4 | 5;
  tags: string[];
}

export interface ContractsCatalog {
  schemaVersion: "starforge.contracts.v1";
  contracts: ContractDef[];
}
