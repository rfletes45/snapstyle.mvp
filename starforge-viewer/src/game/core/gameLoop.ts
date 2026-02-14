/**
 * Game loop — fixed sim tick + requestAnimationFrame render.
 * Ties sim, save, render, and UI together.
 *
 * Supports two modes:
 *  - SOLO:  local sim stepping + localStorage save (default)
 *  - MULTI: server-authoritative; no local sim, sends inputs to server
 */
import type { BalanceV1 } from "../data/balanceSchema";
import type { ContractsCatalog } from "../data/contractsSchema";
import type { EventsCatalog } from "../data/eventsSchema";
import type { MachinesCatalog } from "../data/machinesSchema";
import type { MilestonesCatalog } from "../data/milestonesSchema";
import type { TierUnlocksCatalog } from "../data/tierUnlocksSchema";
import type { UpgradesCatalog } from "../data/upgradesSchema";
import type { WrecksCatalog } from "../data/wrecksSchema";
import type { GameMode } from "../net/roomAdapter";
import { clearSave, loadSave, requestSave } from "../save/saveManager";
import {
  applyInput,
  createFreshState,
  setBalance,
  setContractsCatalog,
  setEventsCatalog,
  setMachinesCatalog,
  setMilestonesCatalog,
  setTierUnlocksCatalog,
  setUpgradesCatalog,
  setWrecksCatalog,
} from "../sim/reducer";
import {
  setSimBalance,
  setSimCatalog,
  setSimContractsCatalog,
  setSimEventsCatalog,
  setSimHz,
  setSimMilestonesCatalog,
  setSimUpgradesCatalog,
  setSimWrecksCatalog,
  stepTick,
} from "../sim/sim";
import type { InputCommand, SimStateV1 } from "../sim/types";
import { InputQueue } from "./inputQueue";

const MAX_STEPS_PER_FRAME = 5;
const DEFAULT_SEED = 12345;

export interface GameLoopCallbacks {
  /** Called every render frame with current state. */
  onRender: (state: SimStateV1, dt: number) => void;
  /** Called when state changes (for HUD update). */
  onStateChange: (state: SimStateV1) => void;
}

export class GameLoop {
  private state: SimStateV1;
  private inputQueue = new InputQueue();
  private simAccum = 0;
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private callbacks: GameLoopCallbacks;
  private simDt: number;

  /** Current game mode: SOLO (local sim) or MULTI (server-authoritative). */
  private mode: GameMode = "SOLO";

  /** Callback to send an input command to the server (MULTI mode only). */
  private remoteSend: ((cmd: InputCommand) => void) | null = null;

  constructor(
    balance: BalanceV1,
    machinesCatalog: MachinesCatalog,
    upgradesCatalog: UpgradesCatalog,
    contractsCatalog: ContractsCatalog,
    eventsCatalog: EventsCatalog,
    milestonesCatalog: MilestonesCatalog,
    wrecksCatalog: WrecksCatalog,
    tierUnlocksCatalog: TierUnlocksCatalog,
    callbacks: GameLoopCallbacks,
  ) {
    setBalance(balance);
    setMachinesCatalog(machinesCatalog);
    setUpgradesCatalog(upgradesCatalog);
    setContractsCatalog(contractsCatalog);
    setEventsCatalog(eventsCatalog);
    setMilestonesCatalog(milestonesCatalog);
    setWrecksCatalog(wrecksCatalog);
    setTierUnlocksCatalog(tierUnlocksCatalog);
    setSimCatalog(machinesCatalog);
    setSimUpgradesCatalog(upgradesCatalog);
    setSimContractsCatalog(contractsCatalog);
    setSimEventsCatalog(eventsCatalog);
    setSimMilestonesCatalog(milestonesCatalog);
    setSimWrecksCatalog(wrecksCatalog);
    setSimBalance(balance);
    const hz = balance.simHz ?? 20;
    setSimHz(hz);
    this.simDt = 1 / hz;
    this.callbacks = callbacks;

    // Load or create state
    const saved = loadSave();
    this.state = saved ?? createFreshState(DEFAULT_SEED);
  }

  /** Start the loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.callbacks.onStateChange(this.state);
    this.frame(this.lastTime);
  }

  /** Stop the loop. */
  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  /* ── MULTI mode helpers ─────────────────────────────── */

  /** Switch between SOLO and MULTI mode. */
  setMode(mode: GameMode): void {
    this.mode = mode;
  }

  /** Get the current game mode. */
  getMode(): GameMode {
    return this.mode;
  }

  /**
   * Accept a full state snapshot from the server (MULTI mode).
   * Replaces the local state and triggers render + HUD update.
   */
  setRemoteState(state: SimStateV1): void {
    this.state = state;
    this.callbacks.onStateChange(this.state);
  }

  /**
   * Set the callback used to send inputs to the server (MULTI mode).
   */
  setRemoteSend(send: (cmd: InputCommand) => void): void {
    this.remoteSend = send;
  }

  /** Enqueue a TAP input. */
  tap(): void {
    this.routeInput({ t: "TAP", atTick: this.state.tick });
  }

  /** Enqueue a BUY_MACHINE input. */
  buyMachine(code: string, qty: number = 1): void {
    this.routeInput({ t: "BUY_MACHINE", code, qty, atTick: this.state.tick });
  }

  /** Enqueue a TOGGLE_MACHINE_ENABLED input. */
  toggleMachineEnabled(code: string, enabled: boolean): void {
    this.routeInput({
      t: "TOGGLE_MACHINE_ENABLED",
      code,
      enabled,
      atTick: this.state.tick,
    });
  }

  /** Enqueue a BUY_UPGRADE input. */
  buyUpgrade(upgradeId: string): void {
    this.routeInput({
      t: "BUY_UPGRADE",
      upgradeId,
      atTick: this.state.tick,
    });
  }

  /** Enqueue a BUY_UPGRADE_V2 input. */
  buyUpgradeV2(upgradeId: string): void {
    this.routeInput({
      t: "BUY_UPGRADE_V2",
      upgradeId,
      atTick: this.state.tick,
    });
  }

  /** Enqueue an UPGRADE_MACHINE_TIER input (by code, upgrades whole stack). */
  upgradeMachineTier(code: string): void {
    this.routeInput({
      t: "UPGRADE_MACHINE_TIER",
      code,
      atTick: this.state.tick,
    });
  }

  /** Enqueue a START_CONTRACT input. */
  startContract(contractId: string): void {
    this.routeInput({
      t: "START_CONTRACT",
      contractId,
      atTick: this.state.tick,
    });
  }

  /** Enqueue a CLAIM_CONTRACT_REWARD input. */
  claimContract(): void {
    this.routeInput({
      t: "CLAIM_CONTRACT_REWARD",
      atTick: this.state.tick,
    });
  }

  /** Enqueue a TAP_EVENT input. */
  tapEvent(): void {
    this.routeInput({ t: "TAP_EVENT", atTick: this.state.tick });
  }

  /** Enqueue a TAP_WRECK input. */
  tapWreck(wreckId: string): void {
    this.routeInput({
      t: "TAP_WRECK",
      wreckId,
      atTick: this.state.tick,
    });
  }

  /** Enqueue a SELECT_WRECK input (v2 cutter-dock loop). */
  selectWreck(wreckId: string): void {
    this.routeInput({
      t: "SELECT_WRECK",
      wreckId,
      atTick: this.state.tick,
    });
  }

  /** Enqueue a CUT_TAP input (v2 cutter-dock loop). */
  cutTap(): void {
    this.routeInput({ t: "CUT_TAP", atTick: this.state.tick });
  }

  /** Enqueue a DISMISS_MILESTONE_TOAST input. */
  dismissMilestoneToast(): void {
    this.routeInput({
      t: "DISMISS_MILESTONE_TOAST",
      atTick: this.state.tick,
    });
  }

  /** Enqueue a CONFIRM_REBIRTH input. */
  confirmRebirth(): void {
    this.routeInput({ t: "CONFIRM_REBIRTH", atTick: this.state.tick });
  }

  /** Enqueue a BUY_REBIRTH_NODE input. */
  buyRebirthNode(nodeId: string): void {
    this.routeInput({
      t: "BUY_REBIRTH_NODE",
      nodeId,
      atTick: this.state.tick,
    });
  }

  /** Enqueue an arbitrary input. */
  enqueue(cmd: InputCommand): void {
    this.inputQueue.push(cmd);
  }

  /** Reset save and reload fresh state. */
  reset(): void {
    clearSave();
    this.state = createFreshState(DEFAULT_SEED);
    this.simAccum = 0;
    this.callbacks.onStateChange(this.state);
  }

  /** Read-only access to current state. */
  getState(): Readonly<SimStateV1> {
    return this.state;
  }

  // ── Internal ─────────────────────────────────────────────

  /**
   * Route an input command based on current mode:
   *  - SOLO: enqueue locally for the next sim tick.
   *  - MULTI: send to the server via remoteSend.
   */
  private routeInput(cmd: InputCommand): void {
    if (this.mode === "MULTI" && this.remoteSend) {
      this.remoteSend(cmd);
    } else {
      this.inputQueue.push(cmd);
    }
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, MAX_STEPS_PER_FRAME * this.simDt);

    // In MULTI mode, skip local sim stepping — the server drives state.
    if (this.mode === "MULTI") {
      this.callbacks.onRender(this.state, dt);
      return;
    }

    // ── SOLO mode: local fixed-step sim ──
    this.simAccum += dt;

    let stepped = false;
    let steps = 0;
    while (this.simAccum >= this.simDt && steps < MAX_STEPS_PER_FRAME) {
      // 1. Drain inputs for this tick
      const cmds = this.inputQueue.drain(this.state.tick);
      for (const cmd of cmds) {
        this.state = applyInput(this.state, cmd);
      }

      // 2. Step the sim
      this.state = stepTick(this.state);

      this.simAccum -= this.simDt;
      steps++;
      stepped = true;
    }

    if (stepped) {
      this.state = requestSave(this.state);
      this.callbacks.onStateChange(this.state);
    }

    // 3. Render (every frame)
    this.callbacks.onRender(this.state, dt);
  };
}
