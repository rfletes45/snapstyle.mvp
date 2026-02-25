import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("MiniGolfDuels");

/**
 * MiniGolfDuelsRoom — Server-authoritative mini-golf duels
 *
 * Two players alternate shots on a 9-hole course.  Physics are computed
 * with Matter.js on the server.  Only ball transforms and kinematic
 * obstacle transforms are synced — NO wall/hazard polygons in state.
 *
 * Lifecycle:
 *   waiting -> countdown -> playing -> finished
 *
 * Sub-phases during "playing":
 *   aiming -> ball_in_motion -> (hole_scorecard -> aiming on next hole)
 *
 * @see docs/06_GAMES.md
 */

import { MapSchema } from "@colyseus/schema";
import { Client, Room } from "colyseus";
import Matter from "matter-js";
import {
  buildAllWallGeometry,
  polygonCentroid as sharedPolygonCentroid,
} from "../../../../shared/golfDuels";
import {
  ANTI_STUCK_MAX_FRAMES,
  BALL_RADIUS,
  BUMPER_RESTITUTION,
  COLLISION_CATEGORY_BALL_A,
  COLLISION_CATEGORY_BALL_B,
  COLLISION_CATEGORY_WORLD,
  COLLISION_MASK_BALL,
  COUNTDOWN_SECONDS,
  DEFAULT_FRICTION,
  LIP_OUT_IMPULSE,
  MAX_POWER,
  MAX_STEPS_PER_TICK,
  MAX_STROKE_CAP,
  PHYSICS_DT,
  PORTAL_COOLDOWN_FRAMES,
  PORTAL_EXIT_MIN_SPEED,
  SCORECARD_DELAY_MS,
  SINK_SPEED_MAX,
  SLOPE_FORCE_SCALE,
  SPEED_CAP,
  STOP_EPS,
  STOP_FRAMES,
  TEE_OFFSET,
  WALL_RESTITUTION,
} from "../../../../shared/golfDuels/physicsConstants";
import { holeCount, loadHole } from "../../games/minigolf/courseLoader";
import type {
  HoleConfig,
  ObstacleDef,
  PortalDef,
  SlopeDef,
} from "../../games/minigolf/types";
import { BaseGameState, Vec2 } from "../../schemas/common";
import {
  GolfBall,
  KinematicObstacle,
  MiniGolfPlayer,
  MiniGolfState,
} from "../../schemas/minigolf";
import { SpectatorEntry } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";
import {
  deleteGameAndInvite,
  extractInviteIdFromExtGameId,
  persistGameResult,
} from "../../services/persistence";
import type { ServerLogger } from "../../utils/logger";
import { checkProtocolVersion } from "../../utils/protocol";

// =============================================================================
// Constants — imported from shared/golfDuels/physicsConstants.ts
// Only labels remain local (never shared with client).
// =============================================================================

// Labels for Matter bodies (used in collision detection)
const LABEL_BALL = "ball";
const LABEL_WALL = "wall";
const LABEL_HAZARD = "hazard";
const LABEL_SURFACE = "surface";
const LABEL_BUMPER = "bumper";
const LABEL_SPINNER = "spinner";
const LABEL_GATE = "gate";
const LABEL_CUP_SENSOR = "cup_sensor";
const LABEL_PORTAL = "portal";
const LABEL_SLOPE = "slope";

// =============================================================================
// Interfaces
// =============================================================================

interface BallRuntime {
  body: Matter.Body;
  uid: string;
  stopCount: number;
  stopped: boolean;
  /** Frames elapsed since the ball started moving (shot taken). */
  motionFrames: number;
  /** Portal cooldown counter — prevents immediate re-trigger. */
  portalCooldown: number;
}

interface ObstacleRuntime {
  def: ObstacleDef;
  body: Matter.Body;
  /** elapsed time for sine-based motion */
  t: number;
}

interface PortalRuntime {
  def: PortalDef;
  body: Matter.Body;
}

interface SlopeRuntime {
  def: SlopeDef;
  body: Matter.Body;
}

// =============================================================================
// Room
// =============================================================================

export class MiniGolfDuelsRoom extends Room<{ state: MiniGolfState }> {
  maxClients = 12; // players + spectators
  patchRate = 33; // ~30 fps state sync
  autoDispose = true;

  protected readonly gameTypeKey = "minigolf_duels";

  // --- Matter engine ---
  private engine!: Matter.Engine;
  private world!: Matter.World;

  // --- Runtime tracking ---
  private ballsByUid = new Map<string, BallRuntime>();
  private obstacleRuntimes: ObstacleRuntime[] = [];
  private hazardBodies = new Map<string, Matter.Body>(); // id -> sensor
  private surfaceBodies = new Map<
    string,
    { body: Matter.Body; frictionMul: number }
  >();
  private portalRuntimes: PortalRuntime[] = [];
  private slopeRuntimes: SlopeRuntime[] = [];
  private cupSensor!: Matter.Body;

  // --- Hole config (current) ---
  private holeConfig!: HoleConfig;
  private packId = "default";

  // --- Spectator tracking ---
  private spectatorSessionIds = new Set<string>();

  // --- Player UID <-> sessionId mapping ---
  private uidToSession = new Map<string, string>();
  private sessionToUid = new Map<string, string>();

  // --- Accumulator ---
  private accumulator = 0;

  // --- Timers ---
  private physicsInterval: { clear(): void } | null = null;
  private scorecardTimeout: { clear(): void } | null = null;
  private roomLog: ServerLogger = log;

  // --- Ordered UID list for turn alternation ---
  private playerUids: string[] = [];

  // --- Invite ID for finalization fallback (defense-in-depth) ---
  private inviteId: string | undefined;

  // ── Per-player achievement stats (flushed to game result at dispose) ────
  private holesInOneByUid = new Map<string, number>();
  private underParHolesByUid = new Map<string, number>();

  // ===========================================================================
  // Auth
  // ===========================================================================

  async onAuth(
    _client: Client,
    options: Record<string, any>,
    context: any,
  ): Promise<any> {
    // ── Protocol version gate ─────────────────────────────────────────────
    const proto = checkProtocolVersion(options);
    if (!proto.ok) {
      log.warn(`Protocol rejected: ${proto.reason}`, {
        sessionId: _client.sessionId,
        gameType: this.gameTypeKey,
        traceId: options?.traceId,
      });
      throw new Error(proto.reason);
    }

    const decoded = await verifyFirebaseToken(
      context?.token || options?.token || "",
    );
    return {
      uid: decoded.uid,
      displayName: (decoded as any).name || (decoded as any).email || "Player",
      avatarUrl: (decoded as any).picture || "",
    };
  }

  // ===========================================================================
  // onCreate
  // ===========================================================================

  onCreate(options: Record<string, any>): void {
    const state = new MiniGolfState();
    this.setState(state);

    state.gameType = this.gameTypeKey;
    state.gameId = this.roomId;
    state.traceId = options.traceId || "";
    state.maxPlayers = 2;
    state.phase = "waiting";
    state.seed = Math.floor(Math.random() * 2147483647);

    // Course selection chain: courseId > packId > "default"
    this.packId =
      (options.courseId as string) || (options.packId as string) || "default";
    state.packId = this.packId;
    state.holesTotal = holeCount(this.packId) as number;

    if (options.firestoreGameId) {
      state.firestoreGameId = options.firestoreGameId;
    }

    // Capture inviteId for finalization fallback — the firestoreGameId may
    // be a random host key (e.g. "mg_...") that extractInviteIdFromExtGameId
    // cannot parse.  Having the inviteId directly ensures Layer 1 cleanup.
    if (options.inviteId) {
      this.inviteId = options.inviteId;
    }

    this.roomLog = log.child({
      roomId: this.roomId,
      gameType: this.gameTypeKey,
      firestoreGameId: state.firestoreGameId || undefined,
      traceId: options.traceId || undefined,
    });
    this.roomLog.info(
      `Room created: ${this.roomId} (courseId=${this.packId}, holes=${state.holesTotal})`,
    );
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    ready: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.roomLog.info(`Player ready: ${player.displayName}`);
        this.checkAllReady();
      }
    },

    input: (client: Client, payload: any) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") return;
      this.handleInput(client, payload);
    },

    rematch: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "finished") return;
      this.broadcast("rematch_request", {
        fromSessionId: client.sessionId,
        fromName:
          this.state.players.get(client.sessionId)?.displayName || "Player",
      });
    },

    rematch_accept: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "finished") return;
      this.resetForRematch();
    },
  };

  // ===========================================================================
  // Join / Leave
  // ===========================================================================

  onJoin(client: Client, options: Record<string, any>, auth: any): void {
    // Spectator path
    if (options.spectator === true) {
      const entry = new SpectatorEntry();
      entry.uid = auth.uid;
      entry.sessionId = client.sessionId;
      entry.displayName = auth.displayName || "Spectator";
      entry.avatarUrl = auth.avatarUrl || "";
      entry.joinedAt = Date.now();
      this.state.spectators.set(client.sessionId, entry);
      this.state.spectatorCount++;
      this.spectatorSessionIds.add(client.sessionId);

      client.send("welcome", {
        uid: auth.uid,
        spectator: true,
        packId: this.packId,
        courseId: this.packId,
        holesTotal: this.state.holesTotal,
      });

      this.roomLog.info(
        `Spectator joined: ${auth.displayName} (${this.state.spectatorCount} watching)`,
      );
      return;
    }

    // Reject if full
    if (this.state.players.size >= 2) {
      client.leave(4000); // custom code: room full
      return;
    }

    const p = new MiniGolfPlayer();
    p.uid = auth.uid;
    p.sessionId = client.sessionId;
    p.displayName = auth.displayName || "Player";
    p.avatarUrl = auth.avatarUrl || "";
    p.playerIndex = this.state.players.size as number;
    p.connected = true;
    this.state.players.set(client.sessionId, p);

    this.uidToSession.set(auth.uid, client.sessionId);
    this.sessionToUid.set(client.sessionId, auth.uid);
    this.playerUids.push(auth.uid);

    // Init stroke tracking
    this.state.strokesTotalByUid.set(auth.uid, 0);
    this.state.strokesHoleByUid.set(auth.uid, 0);
    this.state.holedByUid.set(auth.uid, 0);

    client.send("welcome", {
      uid: auth.uid,
      sessionId: client.sessionId,
      playerIndex: p.playerIndex,
      seed: this.state.seed,
      packId: this.packId,
      courseId: this.packId,
      holesTotal: this.state.holesTotal,
    });

    this.roomLog.info(
      `Player joined: ${auth.displayName} [${this.state.players.size}/2]`,
    );

    if (this.state.players.size >= 2) {
      this.lock();
    }
  }

  onLeave(client: Client, _code: number): void {
    // Spectator leave
    if (this.spectatorSessionIds.has(client.sessionId)) {
      this.state.spectators.delete(client.sessionId);
      this.state.spectatorCount = Math.max(0, this.state.spectatorCount - 1);
      this.spectatorSessionIds.delete(client.sessionId);
      return;
    }

    const uid = this.sessionToUid.get(client.sessionId);

    if (this.state.phase === "playing" && uid) {
      // Award win to other player
      const opponentUid = this.playerUids.find((u) => u !== uid);
      if (opponentUid) {
        this.endMatch(opponentUid, "opponent_left");
      }
    }

    this.state.players.delete(client.sessionId);
    if (uid) {
      this.uidToSession.delete(uid);
      this.sessionToUid.delete(client.sessionId);
    }
  }

  onDrop(client: Client, _code: number): void {
    if (this.spectatorSessionIds.has(client.sessionId)) return;
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    this.broadcast(
      "opponent_reconnecting",
      { sessionId: client.sessionId },
      { except: client },
    );
    const timeout = parseInt(
      process.env.RECONNECTION_TIMEOUT_PHYSICS || "15",
      10,
    );
    this.allowReconnection(client, timeout);
  }

  onReconnect(client: Client): void {
    if (this.spectatorSessionIds.has(client.sessionId)) return;
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
    this.broadcast(
      "opponent_reconnected",
      { sessionId: client.sessionId },
      { except: client },
    );
  }

  // ===========================================================================
  // Dispose
  // ===========================================================================

  async onDispose(): Promise<void> {
    this.cleanupTimers();

    const firestoreGameId =
      this.state.firestoreGameId || this.state.gameId || this.roomId;
    const inviteId =
      extractInviteIdFromExtGameId(firestoreGameId) ??
      this.inviteId ??
      undefined;

    if (this.state.phase === "finished" && this.state.winnerId) {
      // Persist game result
      try {
        // Build a BaseGameState-like object for persistGameResult
        // Clear firestoreGameId so it writes to RealtimeGameSessions
        // (not non-existent TurnBasedGames for ext_ games)
        const pseudoState = {
          gameType: this.state.gameType,
          gameId: this.state.gameId,
          firestoreGameId: "",
          winnerId: this.state.winnerId,
          winReason: this.state.winReason,
          isRated: this.state.isRated,
          turnNumber: 0,
          currentTurnPlayerId: "",
          phase: this.state.phase,
          players: new MapSchema(),
        } as unknown as BaseGameState;

        // Populate players MapSchema with score = total strokes
        this.state.players.forEach((p: MiniGolfPlayer) => {
          const { Player } = require("../../schemas/common");
          const cp = new Player();
          cp.uid = p.uid;
          cp.displayName = p.displayName;
          cp.score = this.state.strokesTotalByUid.get(p.uid) ?? 0;
          cp.playerIndex = p.playerIndex;
          (pseudoState.players as MapSchema).set(p.sessionId, cp);
        });

        // Build per-player gameSpecific stats for achievement evaluation
        const perPlayerStats: Record<string, Record<string, number>> = {};
        for (const uid of this.playerUids) {
          const totalStrokes = this.state.strokesTotalByUid.get(uid) ?? 0;
          perPlayerStats[uid] = {
            bestTotalStrokes: totalStrokes,
            holesInOne: this.holesInOneByUid.get(uid) ?? 0,
            underParHoles: this.underParHolesByUid.get(uid) ?? 0,
            holesPlayed: this.state.holesTotal,
            bestScore: totalStrokes,
          };
        }

        await persistGameResult(
          pseudoState,
          this.state.elapsed,
          perPlayerStats,
          {
            inviteId,
            firestoreGameId,
          },
        );
      } catch (e) {
        this.roomLog.error("Failed to persist game result:", e);
      }

      // Always attempt invite cleanup, even if persistence failed
      try {
        await deleteGameAndInvite(firestoreGameId, inviteId);
      } catch (e) {
        this.roomLog.error("Failed to clean up game/invite:", e);
      }
    }

    if (this.engine) {
      Matter.Engine.clear(this.engine);
    }

    this.roomLog.info(`Room disposed: ${this.roomId}`);
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  private isSpectator(sessionId: string): boolean {
    return this.spectatorSessionIds.has(sessionId);
  }

  private checkAllReady(): void {
    if (this.state.players.size < 2) return;
    let allReady = true;
    this.state.players.forEach((p: MiniGolfPlayer) => {
      if (!p.ready) allReady = false;
    });
    if (allReady) this.startCountdown();
  }

  private startCountdown(): void {
    this.state.phase = "countdown";
    this.state.countdown = COUNTDOWN_SECONDS;
    const interval = this.clock.setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        interval.clear();
        this.startMatch();
      }
    }, 1000);
  }

  private startMatch(): void {
    this.state.phase = "playing";
    this.state.holeIndex = 0;
    this.loadHoleAtIndex(0);
    this.startPhysicsLoop();
  }

  // ===========================================================================
  // Hole Loading
  // ===========================================================================

  private loadHoleAtIndex(index: number): void {
    this.holeConfig = loadHole(this.packId, index);
    this.state.holeId = this.holeConfig.id;
    this.state.holeIndex = index;
    this.state.par = this.holeConfig.par;
    this.state.fieldWidth = this.holeConfig.bounds.width;
    this.state.fieldHeight = this.holeConfig.bounds.height;

    // Reset per-hole tracking
    this.playerUids.forEach((uid) => {
      this.state.strokesHoleByUid.set(uid, 0);
      this.state.holedByUid.set(uid, 0);
    });

    // Build physics world
    this.buildPhysicsWorld();

    // Place balls on tee
    this.placeBallsOnTee();

    // Starting player alternates by holeIndex parity
    const startingUid = this.playerUids[index % this.playerUids.length];
    this.state.currentTurnUid = startingUid;
    this.state.subPhase = "aiming";

    this.broadcast("hole_start", {
      holeIndex: index,
      holeId: this.holeConfig.id,
      par: this.holeConfig.par,
    });
  }

  // ===========================================================================
  // Matter.js World Construction
  // ===========================================================================

  private buildPhysicsWorld(): void {
    // Tear down previous engine if any
    if (this.engine) {
      Matter.Engine.clear(this.engine);
    }

    this.engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    this.world = this.engine.world;

    this.ballsByUid.clear();
    this.obstacleRuntimes = [];
    this.hazardBodies.clear();
    this.surfaceBodies.clear();
    this.portalRuntimes = [];
    this.slopeRuntimes = [];
    this.state.obstacles.splice(0, this.state.obstacles.length);

    const hc = this.holeConfig;

    // --- Walls (static) — Course System v2 deterministic builder ---
    const { segments, cornerPlugs } = buildAllWallGeometry(hc.walls);
    for (const seg of segments) {
      const wall = Matter.Bodies.rectangle(seg.cx, seg.cy, seg.length, 6, {
        isStatic: true,
        angle: seg.angle,
        restitution: WALL_RESTITUTION,
        friction: 0,
        label: LABEL_WALL,
        collisionFilter: { category: COLLISION_CATEGORY_WORLD },
      });
      Matter.Composite.add(this.world, wall);
    }
    // Corner plugs seal the tiny gaps between adjacent edge rectangles
    for (const plug of cornerPlugs) {
      const cap = Matter.Bodies.circle(plug.x, plug.y, plug.radius, {
        isStatic: true,
        restitution: WALL_RESTITUTION,
        friction: 0,
        label: LABEL_WALL,
        collisionFilter: { category: COLLISION_CATEGORY_WORLD },
      });
      Matter.Composite.add(this.world, cap);
    }

    // --- Cup sensor ---
    this.cupSensor = Matter.Bodies.circle(hc.cup.x, hc.cup.y, hc.cupRadius, {
      isStatic: true,
      isSensor: true,
      label: LABEL_CUP_SENSOR,
      collisionFilter: { category: COLLISION_CATEGORY_WORLD },
    });
    Matter.Composite.add(this.world, this.cupSensor);

    // --- Hazard sensors ---
    for (const hz of hc.hazards) {
      const centre = sharedPolygonCentroid(hz.poly);
      const body = Matter.Bodies.fromVertices(
        centre.x,
        centre.y,
        [hz.poly.map((p) => ({ x: p.x, y: p.y }))],
        {
          isStatic: true,
          isSensor: true,
          label: LABEL_HAZARD,
          collisionFilter: { category: COLLISION_CATEGORY_WORLD },
        },
      );
      if (body) {
        (body as any)._hazardId = hz.id;
        (body as any)._penalty = hz.penalty;
        this.hazardBodies.set(hz.id, body);
        Matter.Composite.add(this.world, body);
      }
    }

    // --- Surface sensors (sand / ice) ---
    for (const sf of hc.surfaces) {
      const centre = sharedPolygonCentroid(sf.poly);
      const body = Matter.Bodies.fromVertices(
        centre.x,
        centre.y,
        [sf.poly.map((p) => ({ x: p.x, y: p.y }))],
        {
          isStatic: true,
          isSensor: true,
          label: LABEL_SURFACE,
          collisionFilter: { category: COLLISION_CATEGORY_WORLD },
        },
      );
      if (body) {
        (body as any)._surfaceId = sf.id;
        this.surfaceBodies.set(sf.id, { body, frictionMul: sf.frictionMul });
        Matter.Composite.add(this.world, body);
      }
    }

    // --- Portal sensors ---
    if (hc.portals) {
      for (const portal of hc.portals) {
        const body = Matter.Bodies.circle(
          portal.position.x,
          portal.position.y,
          portal.radius,
          {
            isStatic: true,
            isSensor: true,
            label: LABEL_PORTAL,
            collisionFilter: { category: COLLISION_CATEGORY_WORLD },
          },
        );
        (body as any)._portalId = portal.id;
        Matter.Composite.add(this.world, body);
        this.portalRuntimes.push({ def: portal, body });
      }
    }

    // --- Slope sensors ---
    if (hc.slopes) {
      for (const slope of hc.slopes) {
        const centre = sharedPolygonCentroid(slope.poly);
        const body = Matter.Bodies.fromVertices(
          centre.x,
          centre.y,
          [slope.poly.map((p) => ({ x: p.x, y: p.y }))],
          {
            isStatic: true,
            isSensor: true,
            label: LABEL_SLOPE,
            collisionFilter: { category: COLLISION_CATEGORY_WORLD },
          },
        );
        if (body) {
          (body as any)._slopeId = slope.id;
          Matter.Composite.add(this.world, body);
          this.slopeRuntimes.push({ def: slope, body });
        }
      }
    }

    // --- Obstacles ---
    for (const obs of hc.obstacles) {
      this.createObstacle(obs);
    }
  }

  private createObstacle(def: ObstacleDef): void {
    let body: Matter.Body;

    switch (def.type) {
      case "bumper": {
        const r = def.radius ?? 20;
        body = Matter.Bodies.circle(def.position.x, def.position.y, r, {
          isStatic: true,
          restitution: def.restitution ?? BUMPER_RESTITUTION,
          label: LABEL_BUMPER,
          collisionFilter: { category: COLLISION_CATEGORY_WORLD },
        });
        break;
      }
      case "spinner": {
        body = Matter.Bodies.rectangle(
          def.position.x,
          def.position.y,
          def.size.width,
          def.size.height,
          {
            isStatic: true,
            restitution: 0.5,
            label: LABEL_SPINNER,
            collisionFilter: { category: COLLISION_CATEGORY_WORLD },
          },
        );
        break;
      }
      case "moving_gate": {
        body = Matter.Bodies.rectangle(
          def.position.x,
          def.position.y,
          def.size.width,
          def.size.height,
          {
            isStatic: true,
            restitution: 0.4,
            label: LABEL_GATE,
            collisionFilter: { category: COLLISION_CATEGORY_WORLD },
          },
        );
        break;
      }
      default:
        return;
    }

    (body as any)._obstacleId = def.id;
    Matter.Composite.add(this.world, body);
    this.obstacleRuntimes.push({ def, body, t: 0 });

    // Sync schema entry
    const ko = new KinematicObstacle();
    ko.id = def.id;
    ko.obstacleType = def.type;
    ko.x = def.position.x;
    ko.y = def.position.y;
    ko.angle = 0;
    this.state.obstacles.push(ko);
  }

  // ===========================================================================
  // Ball Placement
  // ===========================================================================

  private placeBallsOnTee(): void {
    const tee = this.holeConfig.tee;

    // Remove existing ball bodies from world
    this.ballsByUid.forEach((br) => {
      Matter.Composite.remove(this.world, br.body);
    });
    this.ballsByUid.clear();
    this.state.balls.clear();

    let idx = 0;
    for (const uid of this.playerUids) {
      const offsetX = idx === 0 ? -TEE_OFFSET : TEE_OFFSET;
      const bx = tee.x + offsetX;
      const by = tee.y;

      // Assign collision category per player — balls never collide with each other
      const ballCategory =
        idx === 0 ? COLLISION_CATEGORY_BALL_A : COLLISION_CATEGORY_BALL_B;

      const body = Matter.Bodies.circle(bx, by, BALL_RADIUS, {
        restitution: 0.5,
        friction: 0,
        frictionAir: DEFAULT_FRICTION,
        density: 0.001,
        label: LABEL_BALL,
        collisionFilter: {
          category: ballCategory,
          mask: COLLISION_MASK_BALL, // only collide with WORLD category
        },
      });
      (body as any)._uid = uid;
      Matter.Composite.add(this.world, body);

      this.ballsByUid.set(uid, {
        body,
        uid,
        stopCount: 0,
        stopped: true,
        motionFrames: 0,
        portalCooldown: 0,
      });

      // Schema ball
      const gb = new GolfBall();
      gb.uid = uid;
      gb.x = bx;
      gb.y = by;
      gb.radius = BALL_RADIUS;
      this.state.balls.set(uid, gb);

      // Last safe pos
      const sp = new Vec2();
      sp.x = bx;
      sp.y = by;
      this.state.lastSafePosByUid.set(uid, sp);

      idx++;
    }
  }

  // ===========================================================================
  // Physics Loop
  // ===========================================================================

  private startPhysicsLoop(): void {
    this.accumulator = 0;

    this.setSimulationInterval((dtMs: number) => {
      if (this.state.phase !== "playing") return;
      this.state.elapsed += dtMs;
      this.accumulator += dtMs;

      let steps = 0;
      while (this.accumulator >= PHYSICS_DT && steps < MAX_STEPS_PER_TICK) {
        this.physicsTick(PHYSICS_DT);
        this.accumulator -= PHYSICS_DT;
        steps++;
      }
      // Clamp remainder
      if (this.accumulator > PHYSICS_DT * MAX_STEPS_PER_TICK) {
        this.accumulator = 0;
      }

      this.syncBallState();
      this.syncObstacleState();
      this.checkStopConditions();
    }, 16.6);
  }

  private physicsTick(dt: number): void {
    // Update kinematic obstacles
    this.updateKinematics(dt);

    // Step engine
    Matter.Engine.update(this.engine, dt);

    // Post-step: check hazard / surface / cup overlaps
    this.postStepChecks();
  }

  // ===========================================================================
  // Kinematic Obstacle Updates
  // ===========================================================================

  private updateKinematics(dt: number): void {
    for (const or of this.obstacleRuntimes) {
      or.t += dt / 1000; // to seconds

      switch (or.def.type) {
        case "spinner": {
          const speed = or.def.speed ?? 1.0;
          const newAngle = or.t * speed;
          Matter.Body.setAngle(or.body, newAngle);
          break;
        }
        case "moving_gate": {
          if (or.def.pointA && or.def.pointB) {
            const speed = or.def.speed ?? 1.0;
            const t = (Math.sin(or.t * speed) + 1) / 2; // 0..1
            const nx =
              or.def.pointA.x + (or.def.pointB.x - or.def.pointA.x) * t;
            const ny =
              or.def.pointA.y + (or.def.pointB.y - or.def.pointA.y) * t;
            Matter.Body.setPosition(or.body, { x: nx, y: ny });
          }
          break;
        }
        // bumpers are fully static — no update needed
      }
    }
  }

  // ===========================================================================
  // Post-Step Checks (Hazard, Surface, Cup)
  // ===========================================================================

  private postStepChecks(): void {
    for (const [uid, br] of this.ballsByUid) {
      if ((this.state.holedByUid.get(uid) ?? 0) === 1) continue;

      const pos = br.body.position;
      const vel = br.body.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

      // --- Speed cap (prevents tunnelling) ---
      if (speed > SPEED_CAP) {
        const scale = SPEED_CAP / speed;
        Matter.Body.setVelocity(br.body, {
          x: vel.x * scale,
          y: vel.y * scale,
        });
      }

      // --- Decrement portal cooldown ---
      if (br.portalCooldown > 0) br.portalCooldown--;

      // --- Increment motion frames for anti-stuck ---
      if (!br.stopped) br.motionFrames++;

      // --- Cup capture / lip-out ---
      const dx = pos.x - this.cupSensor.position.x;
      const dy = pos.y - this.cupSensor.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.holeConfig.cupRadius) {
        if (speed <= SINK_SPEED_MAX) {
          // Sink!
          this.holeBall(uid, br);
          continue;
        } else {
          // Lip-out: impulse radially away from cup centre
          const norm = dist > 0.01 ? dist : 1;
          const impulseX = (dx / norm) * LIP_OUT_IMPULSE;
          const impulseY = (dy / norm) * LIP_OUT_IMPULSE;
          Matter.Body.applyForce(br.body, pos, {
            x: impulseX * br.body.mass,
            y: impulseY * br.body.mass,
          });
          this.broadcast("lip_out", { uid });
        }
      }

      // --- Hazard check ---
      let inHazard = false;
      this.hazardBodies.forEach((hBody) => {
        if (Matter.Collision.collides(br.body, hBody, undefined as any)) {
          const penalty = (hBody as any)._penalty ?? 1;
          this.applyHazardPenalty(uid, penalty);
          inHazard = true;
        }
      });
      if (inHazard) continue;

      // --- Portal check ---
      if (br.portalCooldown <= 0 && this.portalRuntimes.length > 0) {
        for (const pr of this.portalRuntimes) {
          if (Matter.Collision.collides(br.body, pr.body, undefined as any)) {
            this.teleportBall(uid, br, pr.def);
            break; // only one portal per tick
          }
        }
      }

      // --- Surface friction override ---
      let frictionOverride = DEFAULT_FRICTION;
      this.surfaceBodies.forEach(({ body: sBody, frictionMul }) => {
        if (Matter.Collision.collides(br.body, sBody, undefined as any)) {
          frictionOverride = DEFAULT_FRICTION * frictionMul;
        }
      });
      br.body.frictionAir = frictionOverride;

      // --- Slope / speed-pad force ---
      for (const sr of this.slopeRuntimes) {
        if (Matter.Collision.collides(br.body, sr.body, undefined as any)) {
          const force = sr.def.strength * SLOPE_FORCE_SCALE;
          Matter.Body.applyForce(br.body, pos, {
            x: sr.def.direction.x * force,
            y: sr.def.direction.y * force,
          });
        }
      }

      // --- Update last safe pos when ball is slow enough ---
      if (speed < STOP_EPS * 4) {
        const sp = this.state.lastSafePosByUid.get(uid);
        if (sp) {
          sp.x = pos.x;
          sp.y = pos.y;
        }
      }
    }
  }

  // ===========================================================================
  // Portal Teleportation
  // ===========================================================================

  private teleportBall(
    uid: string,
    br: BallRuntime,
    enterPortal: PortalDef,
  ): void {
    // Find the target portal
    const target = this.portalRuntimes.find(
      (pr) => pr.def.id === enterPortal.targetId,
    );
    if (!target) return;

    const vel = br.body.velocity;
    let speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    // Preserve direction but ensure minimum exit speed
    if (speed < PORTAL_EXIT_MIN_SPEED) speed = PORTAL_EXIT_MIN_SPEED;

    // Keep same velocity direction
    const angle = Math.atan2(vel.y, vel.x);

    Matter.Body.setPosition(br.body, {
      x: target.def.position.x,
      y: target.def.position.y,
    });
    Matter.Body.setVelocity(br.body, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    });

    // Set cooldown on both entrance and exit to prevent loops
    br.portalCooldown = PORTAL_COOLDOWN_FRAMES;

    this.broadcast("portal_teleport", {
      uid,
      fromId: enterPortal.id,
      toId: enterPortal.targetId,
    });
  }

  // ===========================================================================
  // Cup / Hazard Handlers
  // ===========================================================================

  private holeBall(uid: string, br: BallRuntime): void {
    this.state.holedByUid.set(uid, 1);
    // Snap ball to cup
    Matter.Body.setPosition(br.body, {
      x: this.holeConfig.cup.x,
      y: this.holeConfig.cup.y,
    });
    Matter.Body.setVelocity(br.body, { x: 0, y: 0 });
    br.stopped = true;
    br.stopCount = STOP_FRAMES;

    // ── Achievement stats: track hole-in-one / under-par ────────────────
    const holeStrokes = this.state.strokesHoleByUid.get(uid) ?? 0;
    if (holeStrokes === 1) {
      this.holesInOneByUid.set(uid, (this.holesInOneByUid.get(uid) ?? 0) + 1);
    }
    const par = this.holeConfig.par ?? 3;
    if (holeStrokes < par) {
      this.underParHolesByUid.set(
        uid,
        (this.underParHolesByUid.get(uid) ?? 0) + 1,
      );
    }

    this.broadcast("ball_holed", { uid });
    this.roomLog.info(
      `Ball holed: ${uid} (strokes: ${this.state.strokesHoleByUid.get(uid)})`,
    );

    this.checkAllHoled();
  }

  private applyHazardPenalty(uid: string, penalty: number): void {
    // Increase strokes
    const currentHole = this.state.strokesHoleByUid.get(uid) ?? 0;
    this.state.strokesHoleByUid.set(uid, currentHole + penalty);
    const currentTotal = this.state.strokesTotalByUid.get(uid) ?? 0;
    this.state.strokesTotalByUid.set(uid, currentTotal + penalty);

    // Reset ball to last safe pos (or tee if none)
    const br = this.ballsByUid.get(uid);
    if (!br) return;

    const safe = this.state.lastSafePosByUid.get(uid);
    const resetX = safe ? safe.x : this.holeConfig.tee.x;
    const resetY = safe ? safe.y : this.holeConfig.tee.y;

    Matter.Body.setPosition(br.body, { x: resetX, y: resetY });
    Matter.Body.setVelocity(br.body, { x: 0, y: 0 });
    br.stopped = true;
    br.stopCount = STOP_FRAMES;

    this.broadcast("hazard_hit", { uid, penalty, resetX, resetY });
  }

  // ===========================================================================
  // Stop Detection & Turn Advancement
  // ===========================================================================

  private checkStopConditions(): void {
    if (this.state.subPhase !== "ball_in_motion") return;

    const currentUid = this.state.currentTurnUid;
    const br = this.ballsByUid.get(currentUid);
    if (!br) return;

    if ((this.state.holedByUid.get(currentUid) ?? 0) === 1) {
      // Ball was holed — handled in holeBall -> checkAllHoled
      // But we still need to advance turn if not all holed
      if (!this.allHoled()) {
        this.advanceTurn();
      }
      return;
    }

    const vel = br.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    if (speed < STOP_EPS) {
      br.stopCount++;
    } else {
      br.stopCount = 0;
    }

    // --- Normal stop detection ---
    const shouldStop = br.stopCount >= STOP_FRAMES;

    // --- Anti-stuck: force stop after too many frames in motion ---
    const isStuck = br.motionFrames >= ANTI_STUCK_MAX_FRAMES;
    if (isStuck) {
      this.roomLog.warn(
        `Anti-stuck triggered for ${currentUid} after ${br.motionFrames} frames`,
      );
      this.broadcast("anti_stuck", { uid: currentUid });
    }

    if (shouldStop || isStuck) {
      // Force complete stop
      Matter.Body.setVelocity(br.body, { x: 0, y: 0 });
      br.stopped = true;
      br.motionFrames = 0;

      // Check max strokes
      const holeStrokes = this.state.strokesHoleByUid.get(currentUid) ?? 0;
      if (holeStrokes >= (this.holeConfig.maxStrokes || MAX_STROKE_CAP)) {
        // Auto-hole with max strokes
        this.state.holedByUid.set(currentUid, 1);
        this.broadcast("max_strokes_reached", { uid: currentUid });
        this.checkAllHoled();
        return;
      }

      this.advanceTurn();
    }
  }

  private advanceTurn(): void {
    // Find next non-holed player
    const currentIdx = this.playerUids.indexOf(this.state.currentTurnUid);
    for (let i = 1; i <= this.playerUids.length; i++) {
      const nextUid =
        this.playerUids[(currentIdx + i) % this.playerUids.length];
      if ((this.state.holedByUid.get(nextUid) ?? 0) === 0) {
        this.state.currentTurnUid = nextUid;
        this.state.subPhase = "aiming";
        this.broadcast("turn_change", { uid: nextUid });
        return;
      }
    }
    // All holed — shouldn't reach here if checkAllHoled works correctly
    this.checkAllHoled();
  }

  private allHoled(): boolean {
    for (const uid of this.playerUids) {
      if ((this.state.holedByUid.get(uid) ?? 0) === 0) return false;
    }
    return true;
  }

  private checkAllHoled(): void {
    if (!this.allHoled()) {
      // Need to advance turn to next non-holed player
      this.advanceTurn();
      return;
    }

    // All players holed — show scorecard
    this.state.subPhase = "hole_scorecard";
    this.broadcast("hole_scorecard", {
      holeIndex: this.state.holeIndex,
      strokesByUid: this.mapSchemaToObj(this.state.strokesHoleByUid),
      totalsByUid: this.mapSchemaToObj(this.state.strokesTotalByUid),
    });

    // Check if this was the last hole
    const isLastHole = this.state.holeIndex >= this.state.holesTotal - 1;

    this.scorecardTimeout = this.clock.setTimeout(() => {
      if (isLastHole) {
        this.finishMatch();
      } else {
        this.loadHoleAtIndex(this.state.holeIndex + 1);
      }
    }, SCORECARD_DELAY_MS);
  }

  // ===========================================================================
  // Match End
  // ===========================================================================

  private finishMatch(): void {
    // Compute totals
    let lowestStrokes = Infinity;
    let winnerId = "";
    let tied = false;
    const totals: Record<string, number> = {};

    for (const uid of this.playerUids) {
      const total = this.state.strokesTotalByUid.get(uid) ?? 0;
      totals[uid] = total;
      if (total < lowestStrokes) {
        lowestStrokes = total;
        winnerId = uid;
        tied = false;
      } else if (total === lowestStrokes) {
        tied = true;
      }
    }

    if (tied) {
      this.endMatch("", "tie");
    } else {
      this.endMatch(winnerId, "lowest_strokes");
    }
  }

  private endMatch(winnerId: string, reason: string): void {
    if (this.state.phase === "finished") return;

    this.state.phase = "finished";
    this.state.winnerId = winnerId;
    this.state.winReason = reason;

    const results = this.playerUids.map((uid) => ({
      uid,
      totalStrokes: this.state.strokesTotalByUid.get(uid) ?? 0,
      displayName: this.getPlayerByUid(uid)?.displayName ?? "Player",
    }));

    this.broadcast("game_over", {
      winnerId,
      winReason: reason,
      results,
      gameDurationMs: this.state.elapsed,
    });

    this.roomLog.info(`Match over! Winner: ${winnerId || "tie"} (${reason})`);
  }

  // ===========================================================================
  // Input Handling
  // ===========================================================================

  private handleInput(client: Client, payload: any): void {
    const uid = this.sessionToUid.get(client.sessionId);
    if (!uid) return;

    const action = payload?.action;

    if (action === "aim") {
      // Cosmetic broadcast for aiming indicator
      this.broadcast(
        "aim_update",
        { uid, angle: payload.angle ?? 0, power: payload.power ?? 0 },
        { except: client },
      );
      return;
    }

    if (action === "shot") {
      this.handleShot(uid, payload);
    }
  }

  private handleShot(uid: string, payload: any): void {
    // Validate it's this player's turn
    if (uid !== this.state.currentTurnUid) return;
    if (this.state.subPhase !== "aiming") return;
    if ((this.state.holedByUid.get(uid) ?? 0) === 1) return;

    const br = this.ballsByUid.get(uid);
    if (!br || !br.stopped) return;

    // Validate & clamp
    let angle = Number(payload.angle) || 0;
    let power = Number(payload.power) || 0;
    power = Math.max(0, Math.min(power, MAX_POWER));

    // Increment strokes
    const holeStrokes = (this.state.strokesHoleByUid.get(uid) ?? 0) + 1;
    this.state.strokesHoleByUid.set(uid, holeStrokes);
    const totalStrokes = (this.state.strokesTotalByUid.get(uid) ?? 0) + 1;
    this.state.strokesTotalByUid.set(uid, totalStrokes);

    // Apply velocity
    const vx = Math.cos(angle) * power;
    const vy = Math.sin(angle) * power;
    Matter.Body.setVelocity(br.body, { x: vx, y: vy });
    br.stopped = false;
    br.stopCount = 0;
    br.motionFrames = 0;
    br.portalCooldown = 0;

    this.state.subPhase = "ball_in_motion";

    this.broadcast("shot_taken", { uid, angle, power });
  }

  // ===========================================================================
  // State Sync Helpers
  // ===========================================================================

  private syncBallState(): void {
    for (const [uid, br] of this.ballsByUid) {
      const gb = this.state.balls.get(uid);
      if (!gb) continue;
      gb.x = br.body.position.x;
      gb.y = br.body.position.y;
      gb.vx = br.body.velocity.x;
      gb.vy = br.body.velocity.y;
    }
  }

  private syncObstacleState(): void {
    for (let i = 0; i < this.obstacleRuntimes.length; i++) {
      const or = this.obstacleRuntimes[i];
      const ko = this.state.obstacles[i];
      if (!ko) continue;
      ko.x = or.body.position.x;
      ko.y = or.body.position.y;
      ko.angle = or.body.angle;
    }
  }

  // ===========================================================================
  // Rematch
  // ===========================================================================

  private resetForRematch(): void {
    this.cleanupTimers();

    // Reset state
    this.state.phase = "waiting";
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.elapsed = 0;
    this.state.countdown = 0;
    this.state.holeIndex = 0;
    this.state.subPhase = "aiming";
    this.state.seed = Math.floor(Math.random() * 2147483647);

    this.playerUids.forEach((uid) => {
      this.state.strokesTotalByUid.set(uid, 0);
      this.state.strokesHoleByUid.set(uid, 0);
      this.state.holedByUid.set(uid, 0);
    });

    // Reset achievement tracking
    this.holesInOneByUid.clear();
    this.underParHolesByUid.clear();

    this.state.players.forEach((p: MiniGolfPlayer) => {
      p.ready = false;
    });

    this.state.obstacles.splice(0, this.state.obstacles.length);
    this.state.balls.clear();

    if (this.engine) {
      Matter.Engine.clear(this.engine);
    }

    this.unlock();
    this.roomLog.info("Room reset for rematch");
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  private getPlayerByUid(uid: string): MiniGolfPlayer | undefined {
    const sessionId = this.uidToSession.get(uid);
    if (!sessionId) return undefined;
    return this.state.players.get(sessionId) as MiniGolfPlayer | undefined;
  }

  private mapSchemaToObj(map: MapSchema<number>): Record<string, number> {
    const obj: Record<string, number> = {};
    map.forEach((v: number, k: string) => {
      obj[k] = v;
    });
    return obj;
  }

  private cleanupTimers(): void {
    if (this.scorecardTimeout) {
      this.scorecardTimeout.clear();
      this.scorecardTimeout = null;
    }
    // physicsInterval is managed by setSimulationInterval — cleared on dispose
    this.physicsInterval = null;
  }
}

// =============================================================================
// Helpers (module-level)
// =============================================================================

// polygonCentroid is now imported from shared/golfDuels (area-weighted version).
