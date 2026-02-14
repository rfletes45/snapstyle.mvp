import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("StarforgeRoom");

/**
 * StarforgeRoom — Colyseus room for the Starforge incremental game.
 *
 * Server-authoritative simulation using the pure sim engine
 * copied from starforge-viewer. Runs stepTick at 20Hz and
 * processes InputCommands via applyInput.
 */

import { IncrementalRoom } from "../incremental/IncrementalRoom";
import type { IncrementalAuth } from "../incremental/IncrementalRoom";
import {
  StarforgeState,
  StarforgeMachineStack,
  StarforgeWreck,
  StarforgeWreckResources,
  StarforgeActiveContract,
  StarforgeActiveEvent,
  StarforgeProdBoost,
  StarforgeCapBoost,
  StarforgeCoopPresence,
} from "../../schemas/starforge";
import { loadStarforgeCatalogs } from "../../starforge/dataLoader";
import type { SimStateV1, InputCommand } from "../../starforge/sim/types";
import {
  applyInput,
  createFreshState,
  setBalance,
  setMachinesCatalog,
  setUpgradesCatalog,
  setContractsCatalog,
  setEventsCatalog,
  setMilestonesCatalog,
  setWrecksCatalog,
  setTierUnlocksCatalog,
} from "../../starforge/sim/reducer";
import {
  stepTick,
  setSimCatalog,
  setSimBalance,
  setSimUpgradesCatalog,
  setSimContractsCatalog,
  setSimEventsCatalog,
  setSimMilestonesCatalog,
  setSimWrecksCatalog,
  setSimHz,
} from "../../starforge/sim/sim";

// ─── Constants ──────────────────────────────────────────────

const DEFAULT_SIM_HZ = 20;
const DEFAULT_SEED = 12345;

// ─── Room Implementation ────────────────────────────────────

export class StarforgeRoom extends IncrementalRoom<{ state: StarforgeState }> {
  protected readonly gameTypeKey = "starforge_game";
  protected readonly simHz = DEFAULT_SIM_HZ;
  protected readonly maxActivePlayers = 2; // host + 1 co-op partner

  /** The authoritative simulation state (plain object, not schema). */
  private sim!: SimStateV1;

  /** Whether catalogs have been loaded for this room. */
  private catalogsLoaded = false;

  /** Session → auth info for co-op presence tracking. */
  private sessionAuth = new Map<string, { uid: string; displayName: string }>();

  /** Session → total input count for co-op stats. */
  private sessionInputCounts = new Map<string, number>();

  // ── IncrementalRoom hooks ─────────────────────────────────

  protected initSim(options: Record<string, unknown>): void {
    // 1. Load data catalogs and inject into sim modules
    this.loadCatalogs();

    // 2. Create schema state for Colyseus delta sync
    const state = new StarforgeState();
    this.setState(state);

    state.gameType = this.gameTypeKey;
    state.gameId = this.roomId;
    state.phase = "waiting";
    state.maxPlayers = this.maxActivePlayers;
    if (options.firestoreGameId) {
      state.firestoreGameId = options.firestoreGameId as string;
    }

    // 3. Create fresh simulation state
    const seed = (options.seed as number) ?? DEFAULT_SEED;
    this.sim = createFreshState(seed);

    // 4. Sync initial state to schema
    this.syncToSchema();

    log.info(`StarforgeRoom initSim (seed=${seed}, hz=${this.simHz})`);
  }

  protected stepSim(_dt: number): void {
    // Step the pure sim forward by one tick
    this.sim = stepTick(this.sim);
    // Sync key fields to the Colyseus schema for delta patching
    this.syncToSchema();
  }

  protected applyCommand(
    sessionId: string,
    cmd: Record<string, unknown>,
  ): boolean {
    const type = cmd.t as string;
    if (!type) {
      log.warn(`No command type from ${sessionId}`);
      return false;
    }

    // Build a typed InputCommand from the raw message
    const inputCmd = this.parseInputCommand(cmd);
    if (!inputCmd) {
      log.warn(`Invalid command: ${type} from ${sessionId}`);
      return false;
    }

    // Apply via the pure reducer
    try {
      this.sim = applyInput(this.sim, inputCmd);
      this.syncToSchema();

      // ── Co-op presence tracking ──
      this.trackCoopInput(sessionId, type);

      // Broadcast the action to co-op partners (not back to sender)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).broadcast(
        "coop_action",
        {
          sessionId,
          displayName: this.sessionAuth.get(sessionId)?.displayName ?? "Unknown",
          action: type,
          tick: this.sim.tick,
        },
      );

      log.debug(`${type} from ${sessionId} applied (tick=${this.sim.tick})`);
      return true;
    } catch (err) {
      log.error(`Error applying ${type} from ${sessionId}:`, err);
      return false;
    }
  }

  protected serializeSnapshot(): Record<string, unknown> {
    return this.sim as unknown as Record<string, unknown>;
  }

  protected hydrateSnapshot(data: Record<string, unknown>): void {
    this.loadCatalogs();
    this.sim = data as unknown as SimStateV1;
    this.syncToSchema();
    log.info(`Hydrated from snapshot (tick=${this.sim.tick})`);
  }

  // ── Internals ─────────────────────────────────────────────

  // ── Co-op lifecycle hooks ─────────────────────────────────

  protected onPlayerJoined(sessionId: string, auth: IncrementalAuth): void {
    this.sessionAuth.set(sessionId, {
      uid: auth.uid,
      displayName: auth.displayName,
    });
    this.sessionInputCounts.set(sessionId, 0);

    // Add co-op presence entry to schema
    const presence = new StarforgeCoopPresence();
    presence.uid = auth.uid;
    presence.displayName = auth.displayName;
    presence.lastAction = "";
    presence.lastActionTick = 0;
    presence.totalInputs = 0;
    presence.online = true;
    this.state.coopPresence.set(sessionId, presence);

    log.info(`Co-op presence added for ${auth.displayName} (session=${sessionId})`);
  }

  protected onPlayerLeft(sessionId: string): void {
    const presence = this.state.coopPresence.get(sessionId);
    if (presence) {
      presence.online = false;
    }
    this.sessionAuth.delete(sessionId);
    this.sessionInputCounts.delete(sessionId);
    log.info(`Co-op presence removed for session=${sessionId}`);
  }

  /** Track a player's input for co-op presence display. */
  private trackCoopInput(sessionId: string, actionType: string): void {
    const presence = this.state.coopPresence.get(sessionId);
    if (!presence) return;

    const count = (this.sessionInputCounts.get(sessionId) ?? 0) + 1;
    this.sessionInputCounts.set(sessionId, count);

    presence.lastAction = actionType;
    presence.lastActionTick = this.sim.tick;
    presence.totalInputs = count;
  }

  /** Load JSON catalogs and inject into the sim modules. */
  private loadCatalogs(): void {
    if (this.catalogsLoaded) return;

    const catalogs = loadStarforgeCatalogs();

    // Inject into reducer module
    setBalance(catalogs.balance);
    setMachinesCatalog(catalogs.machines);
    setUpgradesCatalog(catalogs.upgrades);
    setContractsCatalog(catalogs.contracts);
    setEventsCatalog(catalogs.events);
    setMilestonesCatalog(catalogs.milestones);
    setWrecksCatalog(catalogs.wrecks);
    setTierUnlocksCatalog(catalogs.tierUnlocks);

    // Inject into sim module
    setSimCatalog(catalogs.machines);
    setSimBalance(catalogs.balance);
    setSimUpgradesCatalog(catalogs.upgrades);
    setSimContractsCatalog(catalogs.contracts);
    setSimEventsCatalog(catalogs.events);
    setSimMilestonesCatalog(catalogs.milestones);
    setSimWrecksCatalog(catalogs.wrecks);
    setSimHz(this.simHz);

    this.catalogsLoaded = true;
    log.info("Starforge catalogs loaded");
  }

  /**
   * Sync the plain SimStateV1 object to the Colyseus StarforgeState schema.
   * This enables binary delta patching to clients.
   */
  private syncToSchema(): void {
    const s = this.state;
    const sim = this.sim;

    // Core fields
    s.tick = sim.tick;
    s.seed = sim.seed;

    // Resources
    s.resources.flux = sim.resources.flux;
    s.resources.alloy = sim.resources.alloy;
    s.resources.signal = sim.resources.signal;

    // Caps
    s.capsMicro.flux = sim.capsMicro.flux;
    s.capsMicro.alloy = sim.capsMicro.alloy;
    s.capsMicro.signal = sim.capsMicro.signal;

    // Stats
    s.stats.totalFluxEarned = sim.stats.totalFluxEarned;
    s.stats.totalTaps = sim.stats.totalTaps;
    s.stats.overflowLost = sim.stats.overflowLost;

    // Machines — sync MapSchema
    const currentCodes = new Set(s.machines.keys());
    for (const [code, stack] of Object.entries(sim.machines)) {
      currentCodes.delete(code);
      let schemaStack = s.machines.get(code);
      if (!schemaStack) {
        schemaStack = new StarforgeMachineStack();
        schemaStack.code = code;
        s.machines.set(code, schemaStack);
      }
      schemaStack.count = stack.count;
      schemaStack.tier = stack.tier;
      schemaStack.level = stack.level;
      schemaStack.enabled = stack.enabled;
    }
    for (const removed of currentCodes) {
      s.machines.delete(removed);
    }

    // Wrecks — sync MapSchema
    const currentWreckIds = new Set(s.wrecks.active.keys());
    for (const [id, wreck] of Object.entries(sim.wrecks.active)) {
      currentWreckIds.delete(id);
      let sw = s.wrecks.active.get(id);
      if (!sw) {
        sw = new StarforgeWreck();
        sw.id = wreck.id;
        sw.archetypeId = wreck.archetypeId;
        sw.x = wreck.x;
        sw.z = wreck.z;
        sw.spawnedAtTick = wreck.spawnedAtTick;
        sw.maxHpMicro = wreck.maxHpMicro;
        s.wrecks.active.set(id, sw);
      }
      sw.hpMicro = wreck.hpMicro;
      sw.depleted = wreck.depleted;
      sw.yieldRemainingMicro.flux = wreck.yieldRemainingMicro.flux;
      sw.yieldRemainingMicro.alloy = wreck.yieldRemainingMicro.alloy;
      sw.yieldRemainingMicro.signal = wreck.yieldRemainingMicro.signal;
    }
    for (const removed of currentWreckIds) {
      s.wrecks.active.delete(removed);
    }
    s.wrecks.nextId = sim.wrecks.nextId;
    s.wrecks.lastSpawnRollTick = sim.wrecks.lastSpawnRollTick;

    // Contracts
    if (sim.contracts.active) {
      if (!s.contracts.active) {
        s.contracts.active = new StarforgeActiveContract();
      }
      const ac = s.contracts.active;
      const sc = sim.contracts.active;
      ac.id = sc.id;
      ac.startedAtTick = sc.startedAtTick;
      ac.endsAtTick = sc.endsAtTick;
      ac.completed = sc.completed;
      ac.claimed = sc.claimed;
      ac.snapshotJson = JSON.stringify({
        snapshotResources: sc.snapshotResources,
        snapshotStats: sc.snapshotStats,
      });
    } else {
      s.contracts.active = null;
    }
    this.syncStringArray(s.contracts.revealed, sim.contracts.revealed);
    this.syncStringArray(s.contracts.completed, sim.contracts.completed);
    s.contracts.lastRevealRollTick = sim.contracts.lastRevealRollTick;

    // Events
    if (sim.events.activeEvent) {
      if (!s.events.activeEvent) {
        s.events.activeEvent = new StarforgeActiveEvent();
      }
      const ae = s.events.activeEvent;
      const se = sim.events.activeEvent;
      ae.id = se.id;
      ae.spawnedAtTick = se.spawnedAtTick;
      ae.expiresAtTick = se.expiresAtTick;
      ae.vfxHint = se.vfxHint;
      ae.trigger = se.trigger;
      ae.consumed = se.consumed;
    } else {
      s.events.activeEvent = null;
    }
    s.events.lastSpawnRollTick = sim.events.lastSpawnRollTick;

    // Prod boosts
    while (s.events.prodBoosts.length > sim.events.prodBoosts.length) {
      s.events.prodBoosts.pop();
    }
    for (let i = 0; i < sim.events.prodBoosts.length; i++) {
      const sb = sim.events.prodBoosts[i];
      if (i < s.events.prodBoosts.length) {
        s.events.prodBoosts[i].mult = sb.mult;
        s.events.prodBoosts[i].expiresAtTick = sb.expiresAtTick;
      } else {
        const pb = new StarforgeProdBoost();
        pb.mult = sb.mult;
        pb.expiresAtTick = sb.expiresAtTick;
        s.events.prodBoosts.push(pb);
      }
    }

    // Cap boosts
    while (s.events.capBoosts.length > sim.events.capBoosts.length) {
      s.events.capBoosts.pop();
    }
    for (let i = 0; i < sim.events.capBoosts.length; i++) {
      const sb = sim.events.capBoosts[i];
      if (i < s.events.capBoosts.length) {
        s.events.capBoosts[i].key = sb.key;
        s.events.capBoosts[i].amountMicro = sb.amountMicro;
        s.events.capBoosts[i].expiresAtTick = sb.expiresAtTick;
      } else {
        const cb = new StarforgeCapBoost();
        cb.key = sb.key;
        cb.amountMicro = sb.amountMicro;
        cb.expiresAtTick = sb.expiresAtTick;
        s.events.capBoosts.push(cb);
      }
    }

    // Milestones
    this.syncStringArray(s.milestones.claimed, sim.milestones.claimed);
    this.syncStringArray(s.milestones.pendingToast, sim.milestones.pendingToast);

    // Upgrades purchased
    this.syncStringArray(s.upgradesPurchased, sim.upgradesPurchased);
  }

  /** Sync a plain string[] to an ArraySchema<string>, minimizing deltas. */
  private syncStringArray(
    schema: import("@colyseus/schema").ArraySchema<string>,
    plain: string[],
  ): void {
    // Fast path: same length, check equality
    if (schema.length === plain.length) {
      let equal = true;
      for (let i = 0; i < plain.length; i++) {
        if (schema[i] !== plain[i]) {
          equal = false;
          break;
        }
      }
      if (equal) return;
    }

    // Resize and assign
    while (schema.length > plain.length) schema.pop();
    for (let i = 0; i < plain.length; i++) {
      if (i < schema.length) {
        if (schema[i] !== plain[i]) schema[i] = plain[i];
      } else {
        schema.push(plain[i]);
      }
    }
  }

  /**
   * Parse a raw message object into a typed InputCommand.
   * Returns null if the command type is unrecognized.
   */
  private parseInputCommand(
    cmd: Record<string, unknown>,
  ): InputCommand | null {
    const t = cmd.t as string;
    const atTick = (cmd.atTick as number) ?? this.sim.tick;

    switch (t) {
      case "TAP":
        return {
          t: "TAP",
          amount: cmd.amount as number | undefined,
          atTick,
        };
      case "BUY_MACHINE":
        return {
          t: "BUY_MACHINE",
          code: cmd.code as string,
          qty: (cmd.qty as number) ?? 1,
          atTick,
        };
      case "TOGGLE_MACHINE_ENABLED":
        return {
          t: "TOGGLE_MACHINE_ENABLED",
          code: cmd.code as string,
          enabled: cmd.enabled as boolean,
          atTick,
        };
      case "UPGRADE_MACHINE_TIER":
        return {
          t: "UPGRADE_MACHINE_TIER",
          code: cmd.code as string,
          atTick,
        };
      case "BUY_UPGRADE":
        return {
          t: "BUY_UPGRADE",
          upgradeId: cmd.upgradeId as string,
          atTick,
        };
      case "START_CONTRACT":
        return {
          t: "START_CONTRACT",
          contractId: cmd.contractId as string,
          atTick,
        };
      case "CLAIM_CONTRACT_REWARD":
        return { t: "CLAIM_CONTRACT_REWARD", atTick };
      case "TAP_EVENT":
        return { t: "TAP_EVENT", atTick };
      case "TAP_WRECK":
        return {
          t: "TAP_WRECK",
          wreckId: cmd.wreckId as string,
          atTick,
        };
      case "DISMISS_MILESTONE_TOAST":
        return { t: "DISMISS_MILESTONE_TOAST", atTick };
      case "RESET":
        return { t: "RESET", atTick };
      default:
        return null;
    }
  }
}
