/**
 * StarforgeState — Colyseus schema for the Starforge incremental game.
 *
 * Uses @colyseus/schema decorators for binary delta sync.
 * Every field that changes frequently is a proper schema property,
 * so Colyseus only sends deltas (not full JSON blobs).
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { BaseGameState } from "./common";

// ─── Resources ───────────────────────────────────────────────

export class StarforgeResources extends Schema {
  @type("int64") flux: number = 0;
  @type("int64") alloy: number = 0;
  @type("int64") signal: number = 0;
}

export class StarforgeResourceCaps extends Schema {
  @type("int64") flux: number = 10000;
  @type("int64") alloy: number = 5000;
  @type("int64") signal: number = 3000;
}

// ─── Machines ────────────────────────────────────────────────

export class StarforgeMachineStack extends Schema {
  @type("string") code: string = "";
  @type("uint16") count: number = 0;
  @type("uint8") tier: number = 1;
  @type("uint16") level: number = 1;
  @type("boolean") enabled: boolean = true;
}

// ─── Stats ───────────────────────────────────────────────────

export class StarforgeStats extends Schema {
  @type("int64") totalFluxEarned: number = 0;
  @type("int32") totalTaps: number = 0;
  @type("int64") overflowLost: number = 0;
}

// ─── Wrecks ──────────────────────────────────────────────────

export class StarforgeWreckResources extends Schema {
  @type("int64") flux: number = 0;
  @type("int64") alloy: number = 0;
  @type("int64") signal: number = 0;
}

export class StarforgeWreck extends Schema {
  @type("string") id: string = "";
  @type("string") archetypeId: string = "";
  @type("int64") hpMicro: number = 0;
  @type("int64") maxHpMicro: number = 0;
  @type(StarforgeWreckResources) yieldRemainingMicro = new StarforgeWreckResources();
  @type("float32") x: number = 0;
  @type("float32") z: number = 0;
  @type("uint32") spawnedAtTick: number = 0;
  @type("boolean") depleted: boolean = false;
}

export class StarforgeWrecksField extends Schema {
  @type({ map: StarforgeWreck }) active = new MapSchema<StarforgeWreck>();
  @type("uint32") nextId: number = 0;
  @type("uint32") lastSpawnRollTick: number = 0;
}

// ─── Contracts ───────────────────────────────────────────────

export class StarforgeActiveContract extends Schema {
  @type("string") id: string = "";
  @type("uint32") startedAtTick: number = 0;
  @type("uint32") endsAtTick: number = 0;
  @type("boolean") completed: boolean = false;
  @type("boolean") claimed: boolean = false;
  // Snapshots stored as JSON (rarely changes, only set once at start)
  @type("string") snapshotJson: string = "{}";
}

export class StarforgeContractState extends Schema {
  @type(StarforgeActiveContract) active: StarforgeActiveContract | null = null;
  @type(["string"]) revealed = new ArraySchema<string>();
  @type(["string"]) completed = new ArraySchema<string>();
  @type("uint32") lastRevealRollTick: number = 0;
}

// ─── Events ──────────────────────────────────────────────────

export class StarforgeActiveEvent extends Schema {
  @type("string") id: string = "";
  @type("uint32") spawnedAtTick: number = 0;
  @type("uint32") expiresAtTick: number = 0;
  @type("string") vfxHint: string = "spark";
  @type("string") trigger: string = "TAP";
  @type("boolean") consumed: boolean = false;
}

export class StarforgeProdBoost extends Schema {
  @type("float32") mult: number = 1;
  @type("uint32") expiresAtTick: number = 0;
}

export class StarforgeCapBoost extends Schema {
  @type("string") key: string = "flux";
  @type("int64") amountMicro: number = 0;
  @type("uint32") expiresAtTick: number = 0;
}

export class StarforgeEventState extends Schema {
  @type(StarforgeActiveEvent) activeEvent: StarforgeActiveEvent | null = null;
  @type("uint32") lastSpawnRollTick: number = 0;
  @type([StarforgeProdBoost]) prodBoosts = new ArraySchema<StarforgeProdBoost>();
  @type([StarforgeCapBoost]) capBoosts = new ArraySchema<StarforgeCapBoost>();
}

// ─── Milestones ──────────────────────────────────────────────

export class StarforgeMilestoneState extends Schema {
  @type(["string"]) claimed = new ArraySchema<string>();
  @type(["string"]) pendingToast = new ArraySchema<string>();
}

// ─── Cooperative Presence ────────────────────────────────────

export class StarforgeCoopPresence extends Schema {
  @type("string") uid: string = "";
  @type("string") displayName: string = "";
  @type("string") lastAction: string = ""; // e.g. "TAP", "BUY_MACHINE"
  @type("uint32") lastActionTick: number = 0;
  @type("uint32") totalInputs: number = 0;
  @type("boolean") online: boolean = true;
}

// ─── Top-level State ─────────────────────────────────────────

export class StarforgeState extends BaseGameState {
  // ── Core sim fields ──
  @type("uint32") tick: number = 0;
  @type("int32") seed: number = 12345;

  // ── Resources ──
  @type(StarforgeResources) resources = new StarforgeResources();
  @type(StarforgeResourceCaps) capsMicro = new StarforgeResourceCaps();

  // ── Machines ──
  @type({ map: StarforgeMachineStack })
  machines = new MapSchema<StarforgeMachineStack>();

  // ── Stats ──
  @type(StarforgeStats) stats = new StarforgeStats();

  // ── Wrecks ──
  @type(StarforgeWrecksField) wrecks = new StarforgeWrecksField();

  // ── Contracts ──
  @type(StarforgeContractState) contracts = new StarforgeContractState();

  // ── Events ──
  @type(StarforgeEventState) events = new StarforgeEventState();

  // ── Milestones ──
  @type(StarforgeMilestoneState) milestones = new StarforgeMilestoneState();

  // ── Upgrades purchased (array of IDs) ──
  @type(["string"]) upgradesPurchased = new ArraySchema<string>();

  // ── Cooperative presence — tracks which players are active & their last action
  @type({ map: StarforgeCoopPresence })
  coopPresence = new MapSchema<StarforgeCoopPresence>();
}
