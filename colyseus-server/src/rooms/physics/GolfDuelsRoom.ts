/**
 * GolfDuelsRoom — Colyseus room for multiplayer mini-golf duels
 *
 * Follows the GAME_SYSTEM_REFERENCE.md guide patterns:
 *   - Firebase token auth via onAuth (guide §3.3)
 *   - Spectator support with isSpectator() guard (guide §8 / Appendix A)
 *   - Reconnection with env-based timeout (guide §9.5)
 *   - Rematch flow: rematch → rematch_request → rematch_accept (guide Appendix A)
 *   - Persistence on endMatch AND onDispose guard (guide §9.2)
 *   - firestoreGameId as universal glue (guide Appendix A)
 *
 * Phase FSM:
 *   LOBBY → HOLE_INTRO → AIMING_P1 → BALL_MOVING_P1
 *                       → AIMING_P2 → BALL_MOVING_P2
 *                       → HOLE_RESOLVE → (loop or MATCH_END)
 *
 * Client → Server messages:
 *   "client_ready"           — Player ready / hole loaded
 *   "request_shot" { a, p }  — Request shot (angle radians, power 0-1)
 *   "emote" { key }          — Emote (forwarded to other player)
 *   "rematch"                — Request rematch after MATCH_END
 *   "rematch_accept"         — Accept a rematch request
 *
 * Server → Client broadcasts:
 *   "hole_loaded"      { holeNumber, holeId }
 *   "shot_accepted"    { who, a, p, stroke }
 *   "shot_rejected"    { reason }
 *   "ball_snapshot"    { who, x, z, vx, vz }
 *   "hole_result"      { holeNumber, holeId, p1Strokes, p2Strokes, winner,
 *                         p1HolesWon, p2HolesWon }
 *   "match_end"        { winner, reason, p1HolesWon, p2HolesWon }
 *   "rematch_request"  { fromSlot, fromName }
 *   "rematch_started"  {}
 *   "opponent_reconnecting" { who, displayName }
 *   "opponent_reconnected"  { who, displayName }
 *
 * Rules:
 *   - 15 s shot clock (pauses while opponent is disconnected)
 *   - Disconnect grace via RECONNECTION_TIMEOUT_PHYSICS env var (default from MATCH_RULES)
 *   - Auto-shot on clock expiry: aim toward cup, minimum power
 *   - Stroke cap 8: ball teleports to cup, holed out immediately
 *   - Ball snapshot at 10 Hz while ball is rolling
 *   - Deterministic hole selection via FNV-1a hash
 *
 * @see packages/golf-duels-shared for types, physics, and matchRules
 * @see docs/GAME_SYSTEM_REFERENCE.md for architecture patterns
 */

import { Client, Room } from "colyseus";
import path from "path";
import { BaseGameState, Player } from "../../schemas/common";
import { GolfDuelsState, HoleScoreEntry } from "../../schemas/golfDuels";
import { SpectatorEntry } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";
import {
  type GolfHoleDetail,
  completeGolfInvite,
  persistGolfMatch,
  tierFromHoleId,
  updateGolfStats,
} from "../../services/golfDuelsPersistence";
import { persistGameResult } from "../../services/persistence";
import { createServerLogger } from "../../utils/logger";

import {
  type BallState,
  type CourseLibrary,
  type HoleData,
  MATCH_RULES,
  type MatchPhase,
  PHYSICS,
  type TickResult,
  applyShot,
  evaluateMatch,
  getTierForHoleNumber,
  isStrokeCapped,
  loadCoursesFromDisk,
  physicsTick,
  resolveForfeit,
  resolveHole,
  selectHoleId,
} from "../../../../packages/golf-duels-shared/src";

const log = createServerLogger("GolfDuelsRoom");

// =============================================================================
// Course Library Singleton
// =============================================================================

let courseLibrary: CourseLibrary | null = null;

async function getCourseLibrary(): Promise<CourseLibrary> {
  if (courseLibrary) return courseLibrary;
  const coursesDir = path.resolve(
    __dirname,
    "../../../../packages/golf-duels-shared/courses",
  );
  courseLibrary = await loadCoursesFromDisk(coursesDir);
  log.info(`Course library loaded: ${courseLibrary.count} holes`);
  return courseLibrary;
}

// =============================================================================
// Helpers
// =============================================================================

type Who = "p1" | "p2";

function otherPlayer(who: Who): Who {
  return who === "p1" ? "p2" : "p1";
}

// =============================================================================
// Room
// =============================================================================

export class GolfDuelsRoom extends Room<{ state: GolfDuelsState }> {
  maxClients = 12; // 2 players + spectators
  patchRate = 33; // ~30 fps state sync
  autoDispose = true;

  // --- Internal ---
  private library!: CourseLibrary;
  private currentHole: HoleData | null = null;
  private activeBall: BallState = { x: 0, z: 0, vx: 0, vz: 0 };
  private lastSafePos: { x: number; z: number } = { x: 0, z: 0 };
  private physicsInterval: ReturnType<typeof setInterval> | null = null;
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;
  private shotClockInterval: ReturnType<typeof setInterval> | null = null;
  private holeElapsed = 0;
  private restAccum = 0;
  private gameCompleted = false;

  /** Maps sessionId → "p1" | "p2" */
  private sessionToSlot = new Map<string, Who>();
  private spectatorSessionIds = new Set<string>();

  /** Disconnect grace timers keyed by "p1"/"p2" */
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Whether shot clock is paused because opponent disconnected */
  private shotClockPaused = false;
  private shotClockRemaining = 0;

  // =========================================================================
  // Lifecycle
  // =========================================================================

  async onCreate(options: any) {
    this.setState(new GolfDuelsState());
    this.state.gameId = this.roomId;
    this.state.firestoreGameId = options.firestoreGameId || "";

    this.library = await getCourseLibrary();

    // Register message handlers
    this.onMessage("client_ready", (client) => this.handleClientReady(client));
    this.onMessage("request_shot", (client, data: { a: number; p: number }) =>
      this.handleRequestShot(client, data),
    );
    this.onMessage("emote", (client, data: { key: string }) =>
      this.handleEmote(client, data),
    );
    this.onMessage("rematch", (client) => this.handleRematch(client));
    this.onMessage("rematch_accept", (client) =>
      this.handleRematchAccept(client),
    );

    log.info(`Room ${this.roomId} created (LOBBY)`);
  }

  // =========================================================================
  // Auth
  // =========================================================================

  async onAuth(client: Client, options: any, context: any) {
    const token = context?.token || options?.token;
    if (!token) {
      throw new Error("Authentication required — no token provided");
    }
    try {
      const decoded = await verifyFirebaseToken(token);
      return {
        uid: decoded.uid,
        displayName:
          (decoded as any).name || (decoded as any).email || "Player",
        avatarUrl: (decoded as any).picture || "",
      };
    } catch (err) {
      log.warn(`Auth failed for ${client.sessionId}: ${err}`);
      throw new Error("Authentication failed — invalid token");
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /** Check if a session ID belongs to a spectator */
  private isSpectator(sessionId: string): boolean {
    return this.spectatorSessionIds.has(sessionId);
  }

  // =========================================================================
  // Join / Leave
  // =========================================================================

  onJoin(client: Client, options: any, auth: any) {
    const isSpectator =
      options.spectator === true ||
      options.role === "spectator" ||
      this.state.playerCount >= 2;

    if (isSpectator) {
      this.addSpectator(client, auth);
      return;
    }

    const slot: Who = this.state.playerCount === 0 ? "p1" : "p2";
    const ps = slot === "p1" ? this.state.p1 : this.state.p2;

    ps.uid = auth?.uid || client.sessionId;
    ps.sessionId = client.sessionId;
    ps.displayName = auth?.displayName || `Player ${slot === "p1" ? 1 : 2}`;
    ps.avatarUrl = auth?.avatarUrl || "";
    ps.connected = true;
    ps.ready = false;

    this.sessionToSlot.set(client.sessionId, slot);
    this.state.playerCount++;

    log.info(
      `${ps.displayName} (${client.sessionId}) joined as ${slot.toUpperCase()}`,
    );
  }

  async onLeave(client: Client, code?: number): Promise<void> {
    if (this.isSpectator(client.sessionId)) {
      this.removeSpectator(client);
      return;
    }

    const slot = this.sessionToSlot.get(client.sessionId);
    if (!slot) return;

    const ps = slot === "p1" ? this.state.p1 : this.state.p2;
    ps.connected = false;

    const phase = this.state.phase as MatchPhase;

    // In LOBBY phase — just remove
    if (phase === "LOBBY") {
      log.info(`${ps.displayName} left in LOBBY — removing`);
      // Don't bother with reconnect in lobby
      return;
    }

    // Active game — start disconnect grace timer
    if (phase !== "MATCH_END") {
      const reconnectTimeout = parseInt(
        process.env.RECONNECTION_TIMEOUT_PHYSICS ||
          String(MATCH_RULES.DISCONNECT_GRACE_SECONDS),
        10,
      );

      log.info(`${ps.displayName} disconnected — ${reconnectTimeout}s grace`);

      // Pause shot clock whenever any player disconnects during aiming
      this.pauseShotClockIfNeeded();

      // Broadcast to remaining clients
      this.broadcast(
        "opponent_reconnecting",
        { who: slot, displayName: ps.displayName },
        { except: client },
      );

      // Start grace timer
      const timer = setTimeout(() => {
        this.disconnectTimers.delete(slot);
        log.info(`${ps.displayName} did not reconnect — forfeit`);
        this.handleForfeit(slot);
      }, reconnectTimeout * 1000);

      this.disconnectTimers.set(slot, timer);

      // Allow reconnection during grace period
      try {
        await this.allowReconnection(client, reconnectTimeout);
        // Reconnected!
        ps.connected = true;
        const graceTimer = this.disconnectTimers.get(slot);
        if (graceTimer) {
          clearTimeout(graceTimer);
          this.disconnectTimers.delete(slot);
        }
        this.resumeShotClockIfNeeded();
        this.broadcast(
          "opponent_reconnected",
          { who: slot, displayName: ps.displayName },
          { except: client },
        );
        log.info(`${ps.displayName} reconnected`);
      } catch {
        // Timer will handle forfeit
      }
    }
  }

  async onDispose() {
    this.stopPhysics();
    this.stopShotClock();
    this.stopBallSnapshots();
    this.disconnectTimers.forEach((t) => clearTimeout(t));

    // Ensure persistence if match ended but wasn't persisted yet
    if (this.state.phase === "MATCH_END" && !this.gameCompleted) {
      const winner = this.state.matchWinner as Who | "";
      await this.persistResult(
        winner === "" ? null : winner,
        this.state.matchEndReason || "dispose",
      );
    }

    log.info(`Room ${this.roomId} disposed`);
  }

  // =========================================================================
  // Spectators
  // =========================================================================

  private addSpectator(client: Client, auth: any) {
    this.spectatorSessionIds.add(client.sessionId);
    const entry = new SpectatorEntry();
    entry.sessionId = client.sessionId;
    entry.uid = auth?.uid || client.sessionId;
    entry.displayName = auth?.displayName || "Spectator";
    entry.avatarUrl = auth?.avatarUrl || "";
    entry.joinedAt = Date.now();
    this.state.spectators.set(client.sessionId, entry);
    this.state.spectatorCount = this.spectatorSessionIds.size;
    log.info(
      `Spectator ${entry.displayName} joined (${this.state.spectatorCount} watching)`,
    );
  }

  private removeSpectator(client: Client) {
    this.spectatorSessionIds.delete(client.sessionId);
    this.state.spectators.delete(client.sessionId);
    this.state.spectatorCount = this.spectatorSessionIds.size;
    log.info(`Spectator left (${this.state.spectatorCount} watching)`);
  }

  // =========================================================================
  // Message Handlers
  // =========================================================================

  private handleClientReady(client: Client) {
    if (this.isSpectator(client.sessionId)) return;
    const slot = this.sessionToSlot.get(client.sessionId);
    if (!slot) return;

    const ps = slot === "p1" ? this.state.p1 : this.state.p2;
    ps.ready = true;
    log.info(`${ps.displayName} sent client_ready`);

    const phase = this.state.phase as MatchPhase;

    if (phase === "LOBBY") {
      // Both players ready? → start first hole
      if (
        this.state.playerCount === 2 &&
        this.state.p1.ready &&
        this.state.p2.ready
      ) {
        this.startHole(1);
      }
    } else if (phase === "HOLE_INTRO") {
      // Both acknowledged hole_loaded? → begin aiming for p1
      if (this.state.p1.ready && this.state.p2.ready) {
        this.beginAiming("p1");
      }
    }
  }

  private handleRequestShot(client: Client, data: { a: number; p: number }) {
    if (this.isSpectator(client.sessionId)) return;

    const slot = this.sessionToSlot.get(client.sessionId);
    if (!slot) return;

    const phase = this.state.phase as MatchPhase;
    const expectedPhase: MatchPhase = slot === "p1" ? "AIMING_P1" : "AIMING_P2";

    if (phase !== expectedPhase) {
      this.sendToClient(client, "shot_rejected", {
        reason: "not_your_turn",
      });
      return;
    }

    if (!this.currentHole) {
      this.sendToClient(client, "shot_rejected", { reason: "no_hole" });
      return;
    }

    const angle = typeof data.a === "number" ? data.a : 0;
    const power = Math.max(
      0,
      Math.min(1, typeof data.p === "number" ? data.p : 0.5),
    );

    this.executeShot(slot, angle, power);
  }

  private handleEmote(client: Client, data: { key: string }) {
    if (this.isSpectator(client.sessionId)) return;
    const slot = this.sessionToSlot.get(client.sessionId);
    if (!slot) return;
    // Forward emote to everyone (including sender for confirmation)
    this.broadcast("emote", { who: slot, key: data.key });
  }

  // =========================================================================
  // Rematch (follows guide pattern: rematch → rematch_request → rematch_accept)
  // =========================================================================

  private handleRematch(client: Client) {
    if (this.isSpectator(client.sessionId)) return;
    if (this.state.phase !== "MATCH_END") return;

    const slot = this.sessionToSlot.get(client.sessionId);
    if (!slot) return;

    const ps = slot === "p1" ? this.state.p1 : this.state.p2;
    this.broadcast("rematch_request", {
      fromSlot: slot,
      fromName: ps.displayName,
    });
    log.info(`${ps.displayName} requested rematch`);
  }

  private handleRematchAccept(client: Client) {
    if (this.isSpectator(client.sessionId)) return;
    if (this.state.phase !== "MATCH_END") return;

    const slot = this.sessionToSlot.get(client.sessionId);
    if (!slot) return;

    log.info(`Rematch accepted — resetting match`);
    this.resetForRematch();
  }

  /** Reset all state for a rematch. Follows the guide's Phase-Based Lifecycle
   *  pattern: finished → waiting (LOBBY) → players send ready again. */
  private resetForRematch() {
    this.gameCompleted = false;

    // Reset player states
    for (const ps of [this.state.p1, this.state.p2]) {
      ps.holesWon = 0;
      ps.totalStrokes = 0;
      ps.currentHoleStrokes = 0;
      ps.holedOut = false;
      ps.aimAngle = 0;
      ps.aimPower = 0;
      ps.ready = false;
    }

    // Reset match state
    this.state.holeNumber = 0;
    this.state.currentHoleId = "";
    this.state.holePar = 0;
    this.state.shotClock = 0;
    this.state.activePlayer = "";
    this.state.matchWinner = "";
    this.state.matchEndReason = "";
    this.state.holeElapsed = 0;
    this.state.courseWidth = 0;
    this.state.courseHeight = 0;
    this.state.cupX = 0;
    this.state.cupZ = 0;
    this.state.startX = 0;
    this.state.startZ = 0;

    // Reset ball
    this.state.ball.x = 0;
    this.state.ball.z = 0;
    this.state.ball.vx = 0;
    this.state.ball.vz = 0;
    this.state.ball.owner = "p1";
    this.state.ball.holed = false;

    // Clear hole scores
    this.state.holeScores.clear();

    // Reset internals
    this.currentHole = null;
    this.activeBall = { x: 0, z: 0, vx: 0, vz: 0 };
    this.lastSafePos = { x: 0, z: 0 };
    this.holeElapsed = 0;
    this.restAccum = 0;

    this.stopPhysics();
    this.stopShotClock();
    this.stopBallSnapshots();

    // Back to LOBBY — players send "client_ready" again
    this.setPhase("LOBBY");
    this.broadcast("rematch_started", {});

    log.info("Room reset for rematch — LOBBY phase");
  }

  // =========================================================================
  // Shot Execution (shared by player request & auto-shot)
  // =========================================================================

  private executeShot(who: Who, angle: number, power: number) {
    const ps = who === "p1" ? this.state.p1 : this.state.p2;

    ps.currentHoleStrokes++;
    ps.totalStrokes++;
    ps.aimAngle = angle;
    ps.aimPower = power;

    // Check stroke cap: immediately teleport ball to cup
    if (isStrokeCapped(ps.currentHoleStrokes)) {
      ps.holedOut = true;
      this.state.ball.x = this.currentHole!.cup.x;
      this.state.ball.z = this.currentHole!.cup.z;
      this.state.ball.vx = 0;
      this.state.ball.vz = 0;
      this.state.ball.holed = true;
      this.activeBall = {
        x: this.currentHole!.cup.x,
        z: this.currentHole!.cup.z,
        vx: 0,
        vz: 0,
      };

      this.broadcast("shot_accepted", {
        who,
        a: angle,
        p: power,
        stroke: ps.currentHoleStrokes,
      });

      log.info(
        `${ps.displayName} stroke-capped at ${MATCH_RULES.MAX_STROKES_PER_HOLE} — ball to cup`,
      );

      this.stopShotClock();
      this.onBallStopped(who);
      return;
    }

    // Apply shot to physics engine
    const newBall = applyShot(this.activeBall, angle, power);
    this.activeBall = newBall;

    // Save last safe position
    this.lastSafePos = {
      x: this.state.ball.x,
      z: this.state.ball.z,
    };

    // Update synced ball
    this.state.ball.vx = newBall.vx;
    this.state.ball.vz = newBall.vz;

    this.broadcast("shot_accepted", {
      who,
      a: angle,
      p: power,
      stroke: ps.currentHoleStrokes,
    });

    log.info(
      `${ps.displayName} shot: a=${angle.toFixed(2)} p=${power.toFixed(2)} stroke#${ps.currentHoleStrokes}`,
    );

    // Stop shot clock, transition to BALL_MOVING
    this.stopShotClock();
    this.setPhase(who === "p1" ? "BALL_MOVING_P1" : "BALL_MOVING_P2");

    // Start physics + snapshots
    this.startPhysics(who);
    this.startBallSnapshots(who);
  }

  // =========================================================================
  // Game Flow
  // =========================================================================

  private setPhase(phase: MatchPhase) {
    this.state.phase = phase;
  }

  /** Start a new hole. holeNumber is 1-based. */
  private startHole(holeNumber: number) {
    if (holeNumber > MATCH_RULES.MAX_TOTAL_HOLES) {
      this.endMatch(null, "max_holes");
      return;
    }

    this.state.holeNumber = holeNumber;

    // Deterministic hole selection
    const manifest = this.library.getManifest();
    const tier = getTierForHoleNumber(holeNumber);
    const holeId = selectHoleId(tier, this.roomId, holeNumber, manifest);
    const hole = this.library.getHole(holeId);

    if (!hole) {
      log.error(`Hole ${holeId} not found — ending match`);
      this.endMatch(null, "forfeit");
      return;
    }

    this.currentHole = hole;
    this.state.currentHoleId = holeId;
    this.state.holePar = 0; // par not in course JSON; informational only
    this.holeElapsed = 0;
    this.state.holeElapsed = 0;

    // Course bounds for client rendering
    this.state.courseWidth = hole.bounds.width;
    this.state.courseHeight = hole.bounds.height;
    this.state.cupX = hole.cup.x;
    this.state.cupZ = hole.cup.z;
    this.state.startX = hole.start.x;
    this.state.startZ = hole.start.z;

    // Reset player states for new hole
    for (const ps of [this.state.p1, this.state.p2]) {
      ps.holedOut = false;
      ps.currentHoleStrokes = 0;
      ps.aimAngle = 0;
      ps.aimPower = 0;
      ps.ready = false; // will be set again via client_ready
    }

    // Reset ball at start position
    this.state.ball.x = hole.start.x;
    this.state.ball.z = hole.start.z;
    this.state.ball.vx = 0;
    this.state.ball.vz = 0;
    this.state.ball.owner = "p1";
    this.state.ball.holed = false;

    this.activeBall = { x: hole.start.x, z: hole.start.z, vx: 0, vz: 0 };
    this.lastSafePos = { x: hole.start.x, z: hole.start.z };
    this.restAccum = 0;

    // HOLE_INTRO phase — clients load the course
    this.setPhase("HOLE_INTRO");

    this.broadcast("hole_loaded", { holeNumber, holeId });

    log.info(`Hole ${holeNumber}: ${holeId} (tier ${tier})`);

    // After HOLE_INTRO_SECONDS, auto-advance if clients haven't both acked
    this.clock.setTimeout(() => {
      if ((this.state.phase as MatchPhase) === "HOLE_INTRO") {
        this.beginAiming("p1");
      }
    }, MATCH_RULES.HOLE_INTRO_SECONDS * 1000);
  }

  /** Transition to AIMING phase for the given player. */
  private beginAiming(who: Who) {
    const ps = who === "p1" ? this.state.p1 : this.state.p2;

    // If this player already holed out, check other or resolve
    if (ps.holedOut) {
      const other = otherPlayer(who);
      const otherPs = other === "p1" ? this.state.p1 : this.state.p2;
      if (otherPs.holedOut) {
        this.resolveCurrentHole();
      } else {
        this.beginAiming(other);
      }
      return;
    }

    // Set ball to this player's position & ownership
    this.state.ball.owner = who;
    this.state.activePlayer = who;

    this.setPhase(who === "p1" ? "AIMING_P1" : "AIMING_P2");
    this.startShotClock();

    log.info(`${ps.displayName} (${who}) is aiming`);
  }

  // =========================================================================
  // Physics
  // =========================================================================

  private startPhysics(who: Who) {
    this.stopPhysics();
    this.restAccum = 0;
    const tickMs = 1000 / PHYSICS.TICK_RATE;

    this.physicsInterval = setInterval(() => {
      if (!this.currentHole) return;

      this.holeElapsed += PHYSICS.DT;
      this.state.holeElapsed = this.holeElapsed;

      const result = physicsTick(
        this.activeBall,
        this.currentHole,
        PHYSICS.DT,
        this.holeElapsed,
        this.restAccum,
      );

      this.activeBall = result.ball;
      this.restAccum = result.restAccum;

      // Sync ball state
      this.state.ball.x = result.ball.x;
      this.state.ball.z = result.ball.z;
      this.state.ball.vx = result.ball.vx;
      this.state.ball.vz = result.ball.vz;

      if (result.holed) {
        const ps = who === "p1" ? this.state.p1 : this.state.p2;
        ps.holedOut = true;
        this.state.ball.holed = true;
        log.info(
          `${ps.displayName} holed out in ${ps.currentHoleStrokes} strokes`,
        );
        this.stopPhysics();
        this.stopBallSnapshots();
        this.onBallStopped(who);
      } else if (result.hitHazard) {
        this.handleHazardHit(who, result);
      } else if (result.stopped) {
        this.stopPhysics();
        this.stopBallSnapshots();

        // Update safe position
        this.lastSafePos = { x: result.ball.x, z: result.ball.z };

        this.onBallStopped(who);
      }
    }, tickMs);
  }

  private stopPhysics() {
    if (this.physicsInterval) {
      clearInterval(this.physicsInterval);
      this.physicsInterval = null;
    }
  }

  private handleHazardHit(who: Who, result: TickResult) {
    const ps = who === "p1" ? this.state.p1 : this.state.p2;

    // Reset to last safe position
    this.activeBall = {
      x: this.lastSafePos.x,
      z: this.lastSafePos.z,
      vx: 0,
      vz: 0,
    };

    this.state.ball.x = this.lastSafePos.x;
    this.state.ball.z = this.lastSafePos.z;
    this.state.ball.vx = 0;
    this.state.ball.vz = 0;

    // Penalty stroke
    ps.currentHoleStrokes++;
    ps.totalStrokes++;

    log.info(
      `${ps.displayName} hit ${result.hitHazard!.type} — penalty (${ps.currentHoleStrokes} strokes)`,
    );

    // Check stroke cap after penalty
    if (isStrokeCapped(ps.currentHoleStrokes)) {
      ps.holedOut = true;
      this.state.ball.x = this.currentHole!.cup.x;
      this.state.ball.z = this.currentHole!.cup.z;
      this.state.ball.holed = true;
      this.activeBall = {
        x: this.currentHole!.cup.x,
        z: this.currentHole!.cup.z,
        vx: 0,
        vz: 0,
      };
      log.info(`${ps.displayName} stroke-capped after penalty — ball to cup`);
    }

    this.stopPhysics();
    this.stopBallSnapshots();
    this.onBallStopped(who);
  }

  /** Called when the active ball comes to rest (or is holed / stroke-capped). */
  private onBallStopped(who: Who) {
    const ps = who === "p1" ? this.state.p1 : this.state.p2;

    // Check if hole is over (both holed or this player just finished and other done)
    const otherWho = otherPlayer(who);
    const otherPs = otherWho === "p1" ? this.state.p1 : this.state.p2;

    if (ps.holedOut && otherPs.holedOut) {
      this.resolveCurrentHole();
      return;
    }

    // If this player holed out, switch to other
    if (ps.holedOut) {
      this.beginAiming(otherWho);
      return;
    }

    // Alternate turns: switch to other player
    this.beginAiming(otherWho);
  }

  // =========================================================================
  // Ball Snapshots (10 Hz)
  // =========================================================================

  private startBallSnapshots(who: Who) {
    this.stopBallSnapshots();
    const interval = 1000 / MATCH_RULES.BALL_SNAPSHOT_HZ;

    this.snapshotInterval = setInterval(() => {
      this.broadcast("ball_snapshot", {
        who,
        x: this.state.ball.x,
        z: this.state.ball.z,
        vx: this.state.ball.vx,
        vz: this.state.ball.vz,
      });
    }, interval);
  }

  private stopBallSnapshots() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  // =========================================================================
  // Shot Clock (15 s, pausable)
  // =========================================================================

  private startShotClock() {
    this.stopShotClock();
    this.shotClockPaused = false;
    this.shotClockRemaining = MATCH_RULES.SHOT_CLOCK_SECONDS;
    this.state.shotClock = this.shotClockRemaining;

    this.shotClockInterval = setInterval(() => {
      if (this.shotClockPaused) return;

      this.shotClockRemaining -= 1;
      this.state.shotClock = Math.max(0, this.shotClockRemaining);

      if (this.shotClockRemaining <= 0) {
        this.stopShotClock();
        this.handleShotClockExpired();
      }
    }, 1000);
  }

  private stopShotClock() {
    if (this.shotClockInterval) {
      clearInterval(this.shotClockInterval);
      this.shotClockInterval = null;
    }
  }

  private pauseShotClockIfNeeded() {
    if (this.shotClockInterval && !this.shotClockPaused) {
      this.shotClockPaused = true;
    }
  }

  private resumeShotClockIfNeeded() {
    if (this.shotClockPaused) {
      this.shotClockPaused = false;
    }
  }

  private handleShotClockExpired() {
    const phase = this.state.phase as MatchPhase;
    let who: Who;

    if (phase === "AIMING_P1") who = "p1";
    else if (phase === "AIMING_P2") who = "p2";
    else return; // Not in aiming phase

    const ps = who === "p1" ? this.state.p1 : this.state.p2;
    log.info(`Shot clock expired for ${ps.displayName} — auto-shot`);

    // Auto-shot: aim toward cup, minimum power
    const cup = this.currentHole!.cup;
    const dx = cup.x - this.state.ball.x;
    const dz = cup.z - this.state.ball.z;
    const angleTowardCup = Math.atan2(dx, dz);
    const minPower = 0.1;

    this.executeShot(who, angleTowardCup, minPower);
  }

  // =========================================================================
  // Hole Resolution
  // =========================================================================

  private resolveCurrentHole() {
    if (!this.currentHole) return;

    this.setPhase("HOLE_RESOLVE");

    const p1Strokes = this.state.p1.currentHoleStrokes;
    const p2Strokes = this.state.p2.currentHoleStrokes;
    const holeWinner = resolveHole(p1Strokes, p2Strokes);

    // Record score
    const entry = new HoleScoreEntry();
    entry.holeId = this.currentHole.holeId;
    entry.holeNumber = this.state.holeNumber;
    entry.p1Strokes = p1Strokes;
    entry.p2Strokes = p2Strokes;
    entry.winner = holeWinner ?? "";
    this.state.holeScores.push(entry);

    // Update holes won
    if (holeWinner === "p1") this.state.p1.holesWon++;
    else if (holeWinner === "p2") this.state.p2.holesWon++;

    const holesPlayed = this.state.holeNumber;

    this.broadcast("hole_result", {
      holeNumber: this.state.holeNumber,
      holeId: this.currentHole.holeId,
      p1Strokes,
      p2Strokes,
      winner: holeWinner,
      p1HolesWon: this.state.p1.holesWon,
      p2HolesWon: this.state.p2.holesWon,
    });

    log.info(
      `Hole ${this.currentHole.holeId}: P1=${p1Strokes} P2=${p2Strokes} → ${holeWinner} (${this.state.p1.holesWon}-${this.state.p2.holesWon})`,
    );

    // Check match status
    const matchStatus = evaluateMatch(
      this.state.p1.holesWon,
      this.state.p2.holesWon,
      holesPlayed,
    );

    if (matchStatus.finished) {
      this.endMatch(matchStatus.winner, matchStatus.winReason as string);
    } else {
      // Brief pause then next hole
      this.clock.setTimeout(() => {
        this.startHole(this.state.holeNumber + 1);
      }, 2000);
    }
  }

  // =========================================================================
  // Match End
  // =========================================================================

  private handleForfeit(forfeitingSlot: Who) {
    const result = resolveForfeit(
      forfeitingSlot,
      this.state.p1.holesWon,
      this.state.p2.holesWon,
      this.state.holeNumber,
    );

    this.endMatch(result.winner, "forfeit");
  }

  private async endMatch(winner: "p1" | "p2" | null, reason: string) {
    if (this.gameCompleted) return;
    this.gameCompleted = true;

    this.stopPhysics();
    this.stopShotClock();
    this.stopBallSnapshots();
    this.disconnectTimers.forEach((t) => clearTimeout(t));
    this.disconnectTimers.clear();

    this.setPhase("MATCH_END");
    this.state.matchWinner = winner || "";
    this.state.matchEndReason = reason;

    this.broadcast("match_end", {
      winner: winner || null,
      reason,
      p1HolesWon: this.state.p1.holesWon,
      p2HolesWon: this.state.p2.holesWon,
    });

    log.info(
      `Match ended: winner=${winner ?? "draw"} reason=${reason} (${this.state.p1.holesWon}-${this.state.p2.holesWon})`,
    );

    await this.persistResult(winner, reason);

    this.clock.setTimeout(() => {
      this.disconnect();
    }, 10000);
  }

  // =========================================================================
  // Firebase Persistence
  // =========================================================================

  private async persistResult(winner: "p1" | "p2" | null, reason: string) {
    try {
      const winnerUid = winner
        ? winner === "p1"
          ? this.state.p1.uid
          : this.state.p2.uid
        : "";

      // --- Golf Duels-specific match record (Milestone G) ---
      const holeDetails: GolfHoleDetail[] = [];
      for (let i = 0; i < this.state.holeScores.length; i++) {
        const entry = this.state.holeScores[i];
        holeDetails.push({
          holeId: entry.holeId,
          tier: tierFromHoleId(entry.holeId),
          p1Strokes: entry.p1Strokes,
          p2Strokes: entry.p2Strokes,
          winner: (entry.winner || "tie") as "p1" | "p2" | "tie",
        });
      }

      const { FieldValue } = await import("firebase-admin/firestore");

      await persistGolfMatch(this.roomId, {
        p1Uid: this.state.p1.uid,
        p2Uid: this.state.p2.uid,
        p1DisplayName: this.state.p1.displayName,
        p2DisplayName: this.state.p2.displayName,
        startedAt: FieldValue.serverTimestamp(),
        endedAt: FieldValue.serverTimestamp(),
        holesPlayed: this.state.holeNumber,
        p1HolesWon: this.state.p1.holesWon,
        p2HolesWon: this.state.p2.holesWon,
        winnerUid: winnerUid || null,
        reason,
        holeDetails,
        gameType: "golf_duels",
        source: "colyseus",
      });

      // --- Update per-user Golf Duels stats ---
      await updateGolfStats(
        this.state.p1.uid,
        this.state.p2.uid,
        winnerUid || null,
        holeDetails,
      );

      // --- Mark the invite as "completed" so it disappears from Play page ---
      await completeGolfInvite(
        this.state.firestoreGameId,
        winnerUid || null,
        reason,
      );

      // --- Generic persistence (for existing leaderboard / history hooks) ---
      // NOTE: Don't set firestoreGameId for external-session games — there is
      // no TurnBasedGames document for it.  An empty string routes the record
      // to the RealtimeGameSessions collection instead.
      const tempState = new BaseGameState();
      tempState.gameType = "golf_duels";
      tempState.gameId = this.roomId;
      tempState.firestoreGameId = "";
      tempState.winnerId = winnerUid;
      tempState.winReason = reason;
      tempState.turnNumber = this.state.holeNumber;
      tempState.isRated = this.state.isRated;

      for (const slot of ["p1", "p2"] as const) {
        const gs = slot === "p1" ? this.state.p1 : this.state.p2;
        const p = new Player();
        p.uid = gs.uid;
        p.displayName = gs.displayName;
        p.sessionId = gs.sessionId;
        p.score = gs.holesWon;
        p.playerIndex = slot === "p1" ? 0 : 1;
        p.connected = gs.connected;
        tempState.players.set(gs.sessionId, p);
      }

      await persistGameResult(tempState);
      log.info("Match result persisted to Firestore (golf + generic)");
    } catch (err) {
      log.error(`Failed to persist match result: ${err}`);
    }
  }

  // =========================================================================
  // Util
  // =========================================================================

  private sendToClient(client: Client, type: string, data: any) {
    client.send(type, data);
  }
}
