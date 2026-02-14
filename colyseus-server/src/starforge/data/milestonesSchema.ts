/**
 * TypeScript types for milestones.v1.json.
 * Pure data — no DOM / Three.js.
 */
import type { ResourceKey } from "../sim/types";

// ─── Milestone threshold types ──────────────────────────────

export interface ResourceThreshold {
  t: "RESOURCE_EARNED";
  key: ResourceKey;
  amountMicro: number;
}

export interface TapsThreshold {
  t: "TOTAL_TAPS";
  count: number;
}

export interface MachinesOwnedThreshold {
  t: "MACHINES_OWNED";
  count: number;
}

export interface UpgradesThreshold {
  t: "UPGRADES_PURCHASED";
  count: number;
}

export interface ContractsThreshold {
  t: "CONTRACTS_COMPLETED";
  count: number;
}

export type MilestoneThreshold =
  | ResourceThreshold
  | TapsThreshold
  | MachinesOwnedThreshold
  | UpgradesThreshold
  | ContractsThreshold;

// ─── Milestone reward ───────────────────────────────────────

export interface MilestoneReward {
  fluxMicro?: number;
  alloyMicro?: number;
  signalMicro?: number;
}

// ─── Milestone definition ───────────────────────────────────

export interface MilestoneDef {
  id: string;
  title: string;
  desc: string;
  threshold: MilestoneThreshold;
  reward: MilestoneReward;
}

export interface MilestonesCatalog {
  schemaVersion: "starforge.milestones.v1";
  milestones: MilestoneDef[];
}
