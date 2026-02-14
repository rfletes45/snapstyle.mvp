/**
 * Simulation types — pure data, no DOM / Three.js.
 * All resource values stored as integer micro-units (1 display unit = 1000 micro).
 */

// ─── Resources ───────────────────────────────────────────────

export type ResourceKey = "flux" | "alloy" | "signal";

export const ALL_RESOURCE_KEYS: readonly ResourceKey[] = [
  "flux",
  "alloy",
  "signal",
] as const;

export interface Resources {
  flux: number; // integer micro-flux
  alloy: number; // integer micro-alloy
  signal: number; // integer micro-signal
}

export interface ResourceCaps {
  flux: number;
  alloy: number;
  signal: number;
}

// ─── Machines ────────────────────────────────────────────────

/** Module code string, e.g. "CUTTER", "HOPPER". */
export type MachineCode = string;

/**
 * A stack represents all copies of a single machine type.
 * `count` replaces the old per-instance array approach.
 * Tier / level / enabled apply to the entire stack.
 */
export interface MachineStack {
  code: MachineCode;
  count: number; // how many copies owned
  tier: 1 | 2 | 3;
  level: number; // starts 1
  enabled: boolean;
}

/**
 * @deprecated — kept temporarily for save-migration reference.
 * Will be removed in a future PR.
 */
export interface MachineInstance {
  id: string;
  code: string;
  tier: 1 | 2 | 3;
  level: number;
  enabled: boolean;
}

// ─── Wrecks ──────────────────────────────────────────────────

export interface WreckState {
  id: string;
  archetypeId: string;
  hpMicro: number;
  maxHpMicro: number;
  yieldRemainingMicro: Resources;
  /** Deterministic position — stored directly to avoid client/server drift. */
  x: number;
  z: number;
  spawnedAtTick: number;
  depleted: boolean;
}

export interface WrecksField {
  /** Active wrecks keyed by id. */
  active: Record<string, WreckState>;
  /** Monotonic counter for generating wreck IDs. */
  nextId: number;
  /** Tick of last spawn roll (for deterministic spacing). */
  lastSpawnRollTick: number;
}

// ─── Contracts ───────────────────────────────────────────────

export interface ActiveContract {
  id: string;
  startedAtTick: number;
  endsAtTick: number;
  /** Snapshot of resources at start — used to compute "earned since". */
  snapshotResources: Resources;
  /** Snapshot of stats at start. */
  snapshotStats: Pick<SimStats, "totalFluxEarned">;
  completed: boolean;
  claimed: boolean;
}

export interface ContractState {
  active: ActiveContract | null;
  /** IDs of contracts revealed (available to start). */
  revealed: string[];
  /** IDs of contracts completed & claimed. */
  completed: string[];
  /** Tick of last reveal roll (for deterministic spacing). */
  lastRevealRollTick: number;
}

// ─── Events ──────────────────────────────────────────────────

export interface ActiveEvent {
  id: string; // EventDef id
  spawnedAtTick: number;
  expiresAtTick: number;
  /** VFX hint for the renderer. */
  vfxHint: "spark" | "pulse" | "ring" | "star";
  /** Whether this event needs a TAP or applies automatically. */
  trigger: "TAP" | "AUTO";
  /** Whether the event has been consumed (tapped / auto-applied). */
  consumed: boolean;
}

export interface ProdBoostActive {
  mult: number;
  expiresAtTick: number;
}

export interface CapBoostActive {
  key: ResourceKey;
  amountMicro: number;
  expiresAtTick: number;
}

export interface EventState {
  /** Currently visible event orb (null if none). */
  activeEvent: ActiveEvent | null;
  /** Tick of last spawn roll. */
  lastSpawnRollTick: number;
  /** Active temporary production boosts from events. */
  prodBoosts: ProdBoostActive[];
  /** Active temporary cap boosts from events. */
  capBoosts: CapBoostActive[];
}

// ─── Milestones ──────────────────────────────────────────────

export interface MilestoneState {
  /** IDs of milestones already claimed. */
  claimed: string[];
  /** IDs of milestones just achieved this tick (for toast display). */
  pendingToast: string[];
}

// ─── Stats ───────────────────────────────────────────────────

export interface SimStats {
  totalFluxEarned: number; // integer micro-flux lifetime
  totalTaps: number;
  overflowLost: number; // micro-units lost to overflow
}

// ─── Flags ───────────────────────────────────────────────────

export interface SimFlags {
  /** True when state has changed since last save. */
  dirty: boolean;
}

// ─── Top-level state ─────────────────────────────────────────

export interface SimStateV1 {
  version: 1;
  seed: number;
  /** Monotonic sim tick counter. */
  tick: number;
  resources: Resources;
  capsMicro: ResourceCaps;
  machines: Record<MachineCode, MachineStack>;
  /** Active wrecks. */
  wrecks: WrecksField;
  /** IDs of purchased upgrades. */
  upgradesPurchased: string[];
  /** Contract state. */
  contracts: ContractState;
  /** Event state. */
  events: EventState;
  /** Milestone state. */
  milestones: MilestoneState;
  stats: SimStats;
  flags: SimFlags;
}

// ─── Input commands ──────────────────────────────────────────

export type InputCommand =
  | { t: "TAP"; amount?: number; atTick: number }
  | { t: "BUY_MACHINE"; code: string; qty: number; atTick: number }
  | {
      t: "TOGGLE_MACHINE_ENABLED";
      code: string;
      enabled: boolean;
      atTick: number;
    }
  | { t: "UPGRADE_MACHINE_TIER"; code: string; atTick: number }
  | { t: "BUY_UPGRADE"; upgradeId: string; atTick: number }
  | { t: "START_CONTRACT"; contractId: string; atTick: number }
  | { t: "CLAIM_CONTRACT_REWARD"; atTick: number }
  | { t: "TAP_EVENT"; atTick: number }
  | { t: "TAP_WRECK"; wreckId: string; atTick: number }
  | { t: "DISMISS_MILESTONE_TOAST"; atTick: number }
  | { t: "RESET"; atTick: number };

// ─── Helpers ─────────────────────────────────────────────────

/** Total number of machines across all stacks. */
export function totalMachineCount(
  machines: Record<MachineCode, MachineStack>,
): number {
  let n = 0;
  for (const s of Object.values(machines)) n += s.count;
  return n;
}

/** Count of machines for a specific code (0 if not owned). */
export function machineCount(
  machines: Record<MachineCode, MachineStack>,
  code: string,
): number {
  return machines[code]?.count ?? 0;
}

/** Convert micro integer to display string (3 decimals). */
export function microToDisplay(micro: number): string {
  return (micro / 1000).toFixed(3);
}

/** Convert a display-unit number to micro integer. */
export function displayToMicro(display: number): number {
  return Math.round(display * 1000);
}

/** Compact display: e.g. 1234567 micro → "1,234.567" */
export function microToCompact(micro: number): string {
  const whole = Math.floor(micro / 1000);
  const frac = Math.abs(micro % 1000)
    .toString()
    .padStart(3, "0");
  return `${whole.toLocaleString()}.${frac}`;
}
