/**
 * Knockout — Room Implementation
 *
 * Authoritative FFA penguin physics room extending BaseRealtimeRoom.
 * Owns all physics, planning, round state, and result payloads.
 *
 * Phase machine:
 *   waiting → round_intro → planning → locked/reveal → simulation →
 *   settle → resolve_elims → [shrink] → round_summary → (loop or match_end)
 *
 * The game uses hybrid_round_tick: the tick loop runs during simulation
 * phases to step the physics engine. During planning and other phases,
 * the room is event-driven.
 *
 * @module games/knockout/Room
 */

import type { Client } from "colyseus";
import { BaseRealtimeRoom } from "../../core/BaseRealtimeRoom";
import type {
  RealtimeGameDefinition,
  RealtimeScoreboardEntry,
} from "../../core/types";
import { KNOCKOUT_DEFINITION } from "./Definition";
import {
  ARENA_BASE_HALF_SIDE,
  KnockoutPhysics,
  SHRINK_PER_STAGE,
  type EliminationEvent,
} from "./physics";

// =============================================================================
// Constants
// =============================================================================

/** Duration of round intro overlay (ms) */
const ROUND_INTRO_MS = 2000;
/** Duration of locked countdown before reveal (ms) */
const LOCKED_COUNTDOWN_MS = 1500;
/** Duration of reveal phase showing arrows (ms) */
const REVEAL_MS = 1200;
/** Duration of round summary display (ms) */
const ROUND_SUMMARY_MS = 2500;
/** How many rounds before first shrink */
const SHRINK_START_ROUND = 3;
/** Shrink every N rounds after the first shrink */
const SHRINK_INTERVAL = 2;
/** Fast shrink reduces these intervals */
const SHRINK_START_ROUND_FAST = 2;
const SHRINK_INTERVAL_FAST = 1;

// =============================================================================
// Types
// =============================================================================

export type KnockoutPhase =
  | "waiting"
  | "round_intro"
  | "planning"
  | "locked_countdown"
  | "reveal"
  | "simulation"
  | "settle"
  | "resolve_elims"
  | "shrink"
  | "round_summary"
  | "match_end";

interface StagedMove {
  dx: number;
  dy: number;
  power: number;
  locked: boolean;
}

interface PlayerStats {
  knockouts: number;
  assists: number;
  selfElims: number;
  roundsSurvived: number;
  placement: number;
  eliminatedAtRound: number;
  peakSpeed: number;
  alive: boolean;
}

// =============================================================================
// Room
// =============================================================================

export class KnockoutRoom extends BaseRealtimeRoom {
  // ── Game state ────────────────────────────────────────────────────
  private knockoutPhase: KnockoutPhase = "waiting";
  private roundNumber = 0;
  private physics = new KnockoutPhysics();
  private playerUids: string[] = [];

  // ── Staged moves (private — never broadcast until reveal) ─────────
  private stagedMoves = new Map<string, StagedMove>();

  // ── Revealed moves (public after reveal) ──────────────────────────
  private revealedMoves: Array<{
    uid: string;
    dx: number;
    dy: number;
    power: number;
  }> = [];

  // ── Stats ─────────────────────────────────────────────────────────
  private stats = new Map<string, PlayerStats>();

  // ── Round state ──────────────────────────────────────────────────
  private planningEndsAt = 0;
  private shrinkStage = 0;
  private roundEliminations: EliminationEvent[] = [];
  private roundSummary: {
    eliminations: Array<{
      uid: string;
      killerUid: string | null;
      assistUid: string | null;
    }>;
    aliveCount: number;
  } | null = null;

  // ── Placement tracking ────────────────────────────────────────────
  private nextPlacement = 0;
  private isSimulating = false;

  // ── Timers ────────────────────────────────────────────────────────
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Settings (hydrated) ───────────────────────────────────────────
  private planningTimerSec = 8;
  private shrinkSpeed: "normal" | "fast" = "normal";

  // ═════════════════════════════════════════════════════════════════
  // BaseRealtimeRoom template methods
  // ═════════════════════════════════════════════════════════════════

  protected getGameDefinition(): RealtimeGameDefinition {
    return KNOCKOUT_DEFINITION;
  }

  protected registerGameMessages(): void {
    const def = this.getGameDefinition();
    for (const msg of def.messages) {
      this.messageRegistry.register(msg);
    }

    this.registerGameMessage<{ dx: number; dy: number; power?: number }>(
      "submit_move",
      (_client, uid, payload) => {
        this.handleSubmitMove(uid, payload.dx, payload.dy, payload.power ?? 1);
      },
    );

    this.registerGameMessage("lock_move", (_client, uid) => {
      this.handleLockMove(uid);
    });

    this.registerGameMessage("cancel_move", (_client, uid) => {
      this.handleCancelMove(uid);
    });

    this.registerGameMessage("reaction", (_client, uid, payload) => {
      this.broadcast("reaction_event", {
        uid,
        kind: (payload as { kind: string }).kind,
      });
    });
  }

  protected onMatchStart(): void {
    this.hydrateSettings();
    this.initPlayers();
    this.startRound();
  }

  protected onMatchEnd(reason: string): {
    scoreboard: RealtimeScoreboardEntry[];
    winnerIds: string[];
    playerMetrics?: Record<string, Record<string, unknown>>;
  } {
    this.clearPhaseTimer();
    this.knockoutPhase = "match_end";
    this.isSimulating = false;

    // Assign placement 1 to the last alive player(s)
    const aliveUids = this.physics.getAliveUids();
    for (const uid of aliveUids) {
      const st = this.stats.get(uid);
      if (st) {
        st.placement = 1;
        st.alive = false; // match over
      }
    }

    // Build scoreboard sorted by placement (1 = best)
    const entries: Array<{ uid: string; stats: PlayerStats }> = [];
    for (const uid of this.playerUids) {
      const st = this.stats.get(uid);
      if (st) entries.push({ uid, stats: st });
    }
    entries.sort((a, b) => a.stats.placement - b.stats.placement);

    const winnerIds = entries
      .filter((e) => e.stats.placement === 1)
      .map((e) => e.uid);

    const scoreboard: RealtimeScoreboardEntry[] = entries.map((e) => ({
      uid: e.uid,
      displayName:
        (
          this as unknown as { rosterDisplayNames: Map<string, string> }
        ).rosterDisplayNames?.get(e.uid) ?? e.uid,
      score: winnerIds.includes(e.uid) ? 1 : 0,
      placement: e.stats.placement,
      stats: {
        knockouts: e.stats.knockouts,
        assists: e.stats.assists,
        selfElims: e.stats.selfElims,
        roundsSurvived: e.stats.roundsSurvived,
        placement: e.stats.placement,
        eliminatedAtRound: e.stats.eliminatedAtRound,
        peakSpeed: Math.round(e.stats.peakSpeed * 1000) / 1000,
      },
    }));

    const playerMetrics: Record<string, Record<string, unknown>> = {};
    for (const e of entries) {
      playerMetrics[e.uid] = {
        knockouts: e.stats.knockouts,
        assists: e.stats.assists,
        selfElims: e.stats.selfElims,
        roundsSurvived: e.stats.roundsSurvived,
        placement: e.stats.placement,
        eliminatedAtRound: e.stats.eliminatedAtRound,
        peakSpeed: e.stats.peakSpeed,
        wonMatch: winnerIds.includes(e.uid),
        totalRounds: this.roundNumber,
        cleanWin: winnerIds.includes(e.uid) && e.stats.selfElims === 0,
        shrinkStagesSurvived: this.shrinkStage,
        coldBlooded: false, // will be set below
        edgeLord: false,
      };
    }

    // Determine "cold blooded" (final knockout of match)
    if (this.roundEliminations.length > 0) {
      const lastElim =
        this.roundEliminations[this.roundEliminations.length - 1];
      if (lastElim.killerUid && playerMetrics[lastElim.killerUid]) {
        (
          playerMetrics[lastElim.killerUid] as Record<string, unknown>
        ).coldBlooded = true;
      }
    }

    return { scoreboard, winnerIds, playerMetrics };
  }

  protected onTick(deltaMs: number): void {
    if (!this.isSimulating) return;

    // Step physics
    this.physics.step();

    // Track peak speeds
    for (const body of this.physics.bodies.values()) {
      if (!body.alive) continue;
      const speed = Math.sqrt(body.vx ** 2 + body.vy ** 2);
      const st = this.stats.get(body.uid);
      if (st && speed > st.peakSpeed) {
        st.peakSpeed = speed;
      }
    }
  }

  protected getGameState(
    viewerUid?: string,
    isSpectator?: boolean,
  ): Record<string, unknown> {
    const bodies = this.physics.getBodiesSnapshot();
    const aliveCount = this.physics.getAliveCount();

    // Base public state
    const state: Record<string, unknown> = {
      knockoutPhase: this.knockoutPhase,
      roundNumber: this.roundNumber,
      planningEndsAt: this.planningEndsAt,
      shrinkStage: this.shrinkStage,
      arenaHalfSide: this.physics.getArenaHalfSide(),
      aliveCount,
      bodies,
      revealedMoves: this.revealedMoves,
      roundSummary: this.roundSummary,
      stats: this.getPublicStats(),
    };

    // During planning, tell the viewer their own staged move (owner_only)
    if (this.knockoutPhase === "planning" && viewerUid && !isSpectator) {
      const staged = this.stagedMoves.get(viewerUid);
      if (staged) {
        state.myMove = {
          dx: staged.dx,
          dy: staged.dy,
          power: staged.power,
          locked: staged.locked,
        };
      } else {
        state.myMove = null;
      }
    }

    return state;
  }

  protected onPlayerReconnect(client: Client, uid: string): void {
    // Send current staged move if in planning and they had one
    if (this.knockoutPhase === "planning") {
      const staged = this.stagedMoves.get(uid);
      if (staged) {
        client.send("state_sync", {
          phase: this.phase,
          knockoutPhase: this.knockoutPhase,
          myMove: {
            dx: staged.dx,
            dy: staged.dy,
            power: staged.power,
            locked: staged.locked,
          },
        });
      }
    }
  }

  protected onPlayerDisconnect(uid: string): void {
    // If player disconnected during planning without locking,
    // auto-submit no move (they'll hold position)
    if (this.knockoutPhase === "planning") {
      const staged = this.stagedMoves.get(uid);
      if (!staged || !staged.locked) {
        // Remove staged move — they'll get no impulse
        this.stagedMoves.delete(uid);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // Game Logic
  // ═════════════════════════════════════════════════════════════════

  private hydrateSettings(): void {
    this.planningTimerSec = (this.settings.planningTimerSec as number) ?? 8;
    this.shrinkSpeed =
      (this.settings.shrinkSpeed as "normal" | "fast") ?? "normal";
  }

  private initPlayers(): void {
    this.playerUids = [];
    for (const [uid] of this.players) {
      this.playerUids.push(uid);
    }

    this.nextPlacement = this.playerUids.length;

    // Init stats
    for (const uid of this.playerUids) {
      this.stats.set(uid, {
        knockouts: 0,
        assists: 0,
        selfElims: 0,
        roundsSurvived: 0,
        placement: this.playerUids.length, // default to last
        eliminatedAtRound: 0,
        peakSpeed: 0,
        alive: true,
      });
    }

    // Init physics
    this.physics.initBodies(this.playerUids);
  }

  // ── Round flow ────────────────────────────────────────────────────

  private startRound(): void {
    this.roundNumber++;
    this.roundEliminations = [];
    this.revealedMoves = [];
    this.roundSummary = null;

    this.log(`Starting round ${this.roundNumber}`, {
      aliveCount: this.physics.getAliveCount(),
      shrinkStage: this.shrinkStage,
    });

    this.setKnockoutPhase("round_intro");

    // Check if shrink warning is needed
    const willShrink = this.shouldShrinkThisRound();

    this.broadcastGameState();

    // Notify about upcoming shrink
    if (willShrink) {
      this.broadcast("shrink_warning", {
        roundNumber: this.roundNumber,
        newShrinkStage: this.shrinkStage + 1,
      });
    }

    this.schedulePhase(() => this.startPlanning(), ROUND_INTRO_MS);
  }

  private startPlanning(): void {
    this.stagedMoves.clear();
    this.planningEndsAt = Date.now() + this.planningTimerSec * 1000;
    this.setKnockoutPhase("planning");
    this.broadcastGameState();

    this.schedulePhase(() => this.endPlanning(), this.planningTimerSec * 1000);
  }

  private endPlanning(): void {
    // Auto-lock any submitted but unlocked moves
    for (const [uid, move] of this.stagedMoves) {
      if (!move.locked) {
        move.locked = true;
      }
    }

    this.startReveal();
  }

  private startReveal(): void {
    // Build revealed moves from staged data
    this.revealedMoves = [];
    for (const [uid, move] of this.stagedMoves) {
      const body = this.physics.bodies.get(uid);
      if (body?.alive) {
        this.revealedMoves.push({
          uid,
          dx: move.dx,
          dy: move.dy,
          power: move.power,
        });
      }
    }

    this.setKnockoutPhase("reveal");
    this.broadcastGameState();

    this.schedulePhase(() => this.startSimulation(), REVEAL_MS);
  }

  private startSimulation(): void {
    this.setKnockoutPhase("simulation");
    this.isSimulating = true;

    // Drain any stale events
    this.physics.drainEliminationEvents();
    this.physics.drainCollisionEvents();

    // Apply all impulses at once (with per-player power)
    const moves = new Map<string, { dx: number; dy: number; power: number }>();
    for (const [uid, staged] of this.stagedMoves) {
      const body = this.physics.bodies.get(uid);
      if (body?.alive && staged.locked) {
        moves.set(uid, { dx: staged.dx, dy: staged.dy, power: staged.power });
      }
    }
    this.physics.applyImpulses(moves);

    this.broadcastGameState();

    // Run the simulation in the tick loop; schedule a max-duration timeout
    this.schedulePhase(() => this.endSimulation(), 6000);
  }

  private endSimulation(): void {
    this.isSimulating = false;
    this.setKnockoutPhase("resolve_elims");

    // Collect ALL eliminations that happened during the simulation ticks.
    // The physics engine records them in eliminationEvents during step().
    const simElims = this.physics.drainEliminationEvents();
    this.processEliminations(simElims);

    // Check for shrink
    if (this.shouldShrinkThisRound()) {
      this.performShrink();
    } else {
      this.showRoundSummary();
    }
  }

  private processEliminations(elims: EliminationEvent[]): void {
    // Assign placements in reverse order of elimination
    for (const elim of elims) {
      const st = this.stats.get(elim.uid);
      if (!st) continue;

      st.placement = this.nextPlacement;
      st.eliminatedAtRound = this.roundNumber;
      st.alive = false;
      this.nextPlacement--;

      // Credit killer
      if (elim.killerUid) {
        const killerSt = this.stats.get(elim.killerUid);
        if (killerSt) killerSt.knockouts++;
      }

      // Credit assist
      if (elim.assistUid && elim.assistUid !== elim.killerUid) {
        const assistSt = this.stats.get(elim.assistUid);
        if (assistSt) assistSt.assists++;
      }

      // Track self-elims
      if (elim.selfElim) {
        st.selfElims++;
      }

      this.roundEliminations.push(elim);
    }

    // Broadcast eliminations
    if (elims.length > 0) {
      this.broadcast("eliminations", {
        eliminated: elims.map((e) => ({
          uid: e.uid,
          killerUid: e.killerUid,
          assistUid: e.assistUid,
          selfElim: e.selfElim,
        })),
      });
    }
  }

  private performShrink(): void {
    this.shrinkStage++;
    const newHalfSide =
      ARENA_BASE_HALF_SIDE - this.shrinkStage * SHRINK_PER_STAGE;
    this.physics.setArenaHalfSide(newHalfSide);

    this.setKnockoutPhase("shrink");
    this.broadcastGameState();

    this.broadcast("arena_shrink", {
      stage: this.shrinkStage,
      newHalfSide,
    });

    // Check eliminations caused by shrink
    this.schedulePhase(() => {
      const shrinkElims = this.physics.checkPostShrinkEliminations();
      if (shrinkElims.length > 0) {
        this.processEliminations(shrinkElims);
      }
      this.showRoundSummary();
    }, 1500);
  }

  private showRoundSummary(): void {
    // Update rounds survived for alive players
    for (const uid of this.physics.getAliveUids()) {
      const st = this.stats.get(uid);
      if (st) st.roundsSurvived++;
    }

    const aliveCount = this.physics.getAliveCount();

    this.roundSummary = {
      eliminations: this.roundEliminations.map((e) => ({
        uid: e.uid,
        killerUid: e.killerUid,
        assistUid: e.assistUid,
      })),
      aliveCount,
    };

    this.setKnockoutPhase("round_summary");
    this.broadcastGameState();

    // Check if match should end
    if (aliveCount <= 1 || this.roundNumber >= 50) {
      this.schedulePhase(() => {
        this.endMatch("complete");
      }, ROUND_SUMMARY_MS);
    } else {
      this.schedulePhase(() => this.startRound(), ROUND_SUMMARY_MS);
    }
  }

  // ── Shrink logic ──────────────────────────────────────────────────

  private shouldShrinkThisRound(): boolean {
    const startRound =
      this.shrinkSpeed === "fast"
        ? SHRINK_START_ROUND_FAST
        : SHRINK_START_ROUND;
    const interval =
      this.shrinkSpeed === "fast" ? SHRINK_INTERVAL_FAST : SHRINK_INTERVAL;

    if (this.roundNumber < startRound) return false;
    return (this.roundNumber - startRound) % interval === 0;
  }

  // ── Message handlers ──────────────────────────────────────────────

  private handleSubmitMove(
    uid: string,
    dx: number,
    dy: number,
    power: number,
  ): void {
    if (this.knockoutPhase !== "planning") return;

    // Only alive players can submit
    const body = this.physics.bodies.get(uid);
    if (!body?.alive) return;

    // Check if already locked
    const existing = this.stagedMoves.get(uid);
    if (existing?.locked) return; // Already locked, can't change

    // Normalize direction
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag < 0.01) return;
    const ndx = dx / mag;
    const ndy = dy / mag;

    // Clamp power to [0, 1]
    const clampedPower = Math.max(0, Math.min(1, power));

    this.stagedMoves.set(uid, {
      dx: ndx,
      dy: ndy,
      power: clampedPower,
      locked: false,
    });

    // Send confirmation back to just this player
    const client = this.getClientByUid(uid);
    if (client) {
      client.send("move_ack", {
        dx: ndx,
        dy: ndy,
        power: clampedPower,
        locked: false,
      });
    }
  }

  private handleLockMove(uid: string): void {
    if (this.knockoutPhase !== "planning") return;

    const body = this.physics.bodies.get(uid);
    if (!body?.alive) return;

    const staged = this.stagedMoves.get(uid);
    if (!staged) return; // No move to lock
    if (staged.locked) return; // Already locked

    staged.locked = true;

    const client = this.getClientByUid(uid);
    if (client) {
      client.send("move_ack", {
        dx: staged.dx,
        dy: staged.dy,
        power: staged.power,
        locked: true,
      });
    }

    // Check if all alive players have locked
    this.checkAllLocked();
  }

  private handleCancelMove(uid: string): void {
    if (this.knockoutPhase !== "planning") return;

    const body = this.physics.bodies.get(uid);
    if (!body?.alive) return;

    const staged = this.stagedMoves.get(uid);
    if (!staged || staged.locked) return; // Can't cancel a locked move

    this.stagedMoves.delete(uid);

    const client = this.getClientByUid(uid);
    if (client) {
      client.send("move_ack", { dx: 0, dy: 0, locked: false, cancelled: true });
    }
  }

  private checkAllLocked(): void {
    const aliveBodies = Array.from(this.physics.bodies.values()).filter(
      (b) => b.alive,
    );

    const allLocked = aliveBodies.every((body) => {
      const staged = this.stagedMoves.get(body.uid);
      return staged?.locked === true;
    });

    if (allLocked && aliveBodies.length > 0) {
      // All players locked — start locked countdown for anticipation
      this.clearPhaseTimer();
      this.setKnockoutPhase("locked_countdown");
      this.broadcastGameState();
      this.schedulePhase(() => this.endPlanning(), LOCKED_COUNTDOWN_MS);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private setKnockoutPhase(phase: KnockoutPhase): void {
    this.knockoutPhase = phase;
    this.roomVersion++;
    this.log(`Knockout phase: ${phase}`, { round: this.roundNumber });
  }

  private getPublicStats(): Record<
    string,
    {
      knockouts: number;
      assists: number;
      alive: boolean;
      placement: number;
      eliminatedAtRound: number;
    }
  > {
    const result: Record<
      string,
      {
        knockouts: number;
        assists: number;
        alive: boolean;
        placement: number;
        eliminatedAtRound: number;
      }
    > = {};
    for (const [uid, st] of this.stats) {
      result[uid] = {
        knockouts: st.knockouts,
        assists: st.assists,
        alive: st.alive,
        placement: st.placement,
        eliminatedAtRound: st.eliminatedAtRound,
      };
    }
    return result;
  }

  private schedulePhase(callback: () => void, delayMs: number): void {
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(callback, delayMs);
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }
}
