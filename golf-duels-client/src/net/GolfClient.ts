/**
 * Golf Duels Client — Colyseus Network Client  (Segment 2 protocol)
 *
 * Message protocol:
 *   Client → Server:
 *     "client_ready"                — Ready / hole loaded ack
 *     "request_shot" { a, p }       — Request shot (angle, power)
 *     "emote"  { key }              — Emote reaction
 *     "rematch"                     — Request rematch after MATCH_END
 *     "rematch_accept"              — Accept a rematch request
 *
 *   Server → Client (broadcasts):
 *     "hole_loaded"    { holeNumber, holeId }
 *     "shot_accepted"  { who, a, p, stroke }
 *     "shot_rejected"  { reason }
 *     "ball_snapshot"  { who, x, z, vx, vz }     (10 Hz)
 *     "hole_result"    { holeNumber, holeId, p1Strokes, p2Strokes, winner,
 *                        p1HolesWon, p2HolesWon }
 *     "match_end"      { winner, reason, p1HolesWon, p2HolesWon }
 *     "emote"          { who, key }
 *     "rematch_request"  { fromSlot, fromName }
 *     "rematch_started"  {}
 *     "opponent_reconnecting" { who, displayName }
 *     "opponent_reconnected"  { who, displayName }
 */

import { Callbacks, Client, type Room } from "@colyseus/sdk";
import type { ConnectionParams } from "./params";

// ============================================================================
// Event Types
// ============================================================================

export interface BallSnapshotEvent {
  who: "p1" | "p2";
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface PlayerState {
  uid: string;
  sessionId: string;
  displayName: string;
  connected: boolean;
  ready: boolean;
  holesWon: number;
  totalStrokes: number;
  currentHoleStrokes: number;
  holedOut: boolean;
  aimAngle: number;
  aimPower: number;
}

export interface HoleLoadedEvent {
  holeNumber: number;
  holeId: string;
}

export interface ShotAcceptedEvent {
  who: "p1" | "p2";
  a: number;
  p: number;
  stroke: number;
}

export interface ShotRejectedEvent {
  reason: string;
}

export interface HoleResultEvent {
  holeNumber: number;
  holeId: string;
  p1Strokes: number;
  p2Strokes: number;
  winner: "p1" | "p2" | "tie" | null;
  p1HolesWon: number;
  p2HolesWon: number;
}

export interface MatchEndEvent {
  winner: "p1" | "p2" | null;
  reason: string;
  p1HolesWon: number;
  p2HolesWon: number;
}

export interface EmoteEvent {
  who: "p1" | "p2";
  key: string;
}

export interface CourseInfo {
  holeId: string;
  holeNumber: number;
  courseWidth: number;
  courseHeight: number;
  cupX: number;
  cupZ: number;
  startX: number;
  startZ: number;
}

export interface BallState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  owner: "p1" | "p2";
  holed: boolean;
}

// ============================================================================
// Client
// ============================================================================

export class GolfClient {
  private client: Client;
  private room: Room | null = null;
  private params: ConnectionParams;

  // Callbacks
  onPhaseChange: ((phase: string) => void) | null = null;
  onPlayerUpdate: ((slot: "p1" | "p2", data: PlayerState) => void) | null =
    null;
  onBallUpdate: ((ball: BallState) => void) | null = null;
  onBallSnapshot: ((snap: BallSnapshotEvent) => void) | null = null;
  onHoleLoaded: ((e: HoleLoadedEvent) => void) | null = null;
  onShotAccepted: ((e: ShotAcceptedEvent) => void) | null = null;
  onShotRejected: ((e: ShotRejectedEvent) => void) | null = null;
  onHoleResult: ((e: HoleResultEvent) => void) | null = null;
  onMatchEnd: ((e: MatchEndEvent) => void) | null = null;
  onEmote: ((e: EmoteEvent) => void) | null = null;
  onRematchRequest:
    | ((e: { fromSlot: string; fromName: string }) => void)
    | null = null;
  onRematchStarted: (() => void) | null = null;
  onOpponentReconnecting:
    | ((e: { who: string; displayName: string }) => void)
    | null = null;
  onOpponentReconnected:
    | ((e: { who: string; displayName: string }) => void)
    | null = null;
  onCourseChange: ((info: CourseInfo) => void) | null = null;
  onShotClock: ((value: number) => void) | null = null;
  onActivePlayer: ((who: string) => void) | null = null;
  onHoleElapsed: ((elapsed: number) => void) | null = null;
  onError: ((err: string) => void) | null = null;

  /** Our session ID (set after joining) */
  sessionId: string = "";
  /** Our slot: "p1" | "p2" | "spectator" */
  mySlot: "p1" | "p2" | "spectator" = "spectator";

  constructor(params: ConnectionParams) {
    this.params = params;
    this.client = new Client(params.serverUrl);
  }

  async connect(): Promise<void> {
    const joinOptions: Record<string, unknown> = {
      firestoreGameId: this.params.firestoreGameId,
      role: this.params.role,
    };

    if (this.params.token) joinOptions.token = this.params.token;
    if (this.params.uid) joinOptions.uid = this.params.uid;
    if (this.params.displayName)
      joinOptions.displayName = this.params.displayName;

    this.room = await this.client.joinOrCreate(
      this.params.roomName,
      joinOptions,
    );
    this.sessionId = this.room.sessionId;

    this.bindStateListeners();
    this.bindMessageListeners();
  }

  // ==========================================================================
  // Actions (Client → Server)
  // ==========================================================================

  sendReady(): void {
    this.room?.send("client_ready");
  }

  sendShot(angle: number, power: number): void {
    this.room?.send("request_shot", { a: angle, p: power });
  }

  sendEmote(key: string): void {
    this.room?.send("emote", { key });
  }

  /** Request a rematch after match ends (guide: rematch flow) */
  sendRematch(): void {
    this.room?.send("rematch");
  }

  /** Accept a rematch request (guide: rematch flow) */
  sendRematchAccept(): void {
    this.room?.send("rematch_accept");
  }

  leave(): void {
    this.room?.leave();
  }

  // ==========================================================================
  // State Listeners
  // ==========================================================================

  private bindStateListeners(): void {
    if (!this.room) return;
    const state = this.room.state as any;

    // Callbacks.get() returns a StateCallbackStrategy that uses
    //   $.listen("prop", handler)          — root state properties
    //   $.listen(instance, "prop", handler) — nested schema instances
    const $ = Callbacks.get(this.room);

    // Phase
    $.listen("phase", (value: string) => {
      this.onPhaseChange?.(value);
    });

    // Shot clock
    $.listen("shotClock", (value: number) => {
      this.onShotClock?.(value);
    });

    // Active player
    $.listen("activePlayer", (value: string) => {
      this.onActivePlayer?.(value);
    });

    // Hole elapsed
    $.listen("holeElapsed", (value: number) => {
      this.onHoleElapsed?.(value);
    });

    // Course info — fires when currentHoleId changes on root state.
    // Guard: skip the initial sync where currentHoleId is still "".
    $.listen("currentHoleId", () => {
      if (!state.currentHoleId) return;
      this.onCourseChange?.({
        holeId: state.currentHoleId,
        holeNumber: state.holeNumber,
        courseWidth: state.courseWidth,
        courseHeight: state.courseHeight,
        cupX: state.cupX,
        cupZ: state.cupZ,
        startX: state.startX,
        startZ: state.startZ,
      });
    });

    // Player slots — p1 and p2
    if (state.p1) this.bindPlayerSlotListeners($, state.p1, "p1");
    if (state.p2) this.bindPlayerSlotListeners($, state.p2, "p2");

    // Ball (single nested schema)
    if (state.ball) {
      const emitBall = () => this.emitBallUpdate(state.ball);
      $.listen(state.ball, "x", emitBall);
      $.listen(state.ball, "z", emitBall);
      $.listen(state.ball, "vx", emitBall);
      $.listen(state.ball, "vz", emitBall);
      $.listen(state.ball, "owner", emitBall);
      $.listen(state.ball, "holed", emitBall);
    }

    // Determine our slot
    if (state.p1?.sessionId === this.sessionId) {
      this.mySlot = "p1";
    } else if (state.p2?.sessionId === this.sessionId) {
      this.mySlot = "p2";
    }
    // Also listen for late assignment
    if (state.p1) {
      $.listen(state.p1, "sessionId", (sid: string) => {
        if (sid === this.sessionId) this.mySlot = "p1";
      });
    }
    if (state.p2) {
      $.listen(state.p2, "sessionId", (sid: string) => {
        if (sid === this.sessionId) this.mySlot = "p2";
      });
    }
  }

  private bindPlayerSlotListeners($: any, ps: any, slot: "p1" | "p2"): void {
    const emit = () => this.emitPlayerUpdate(ps, slot);

    $.listen(ps, "uid", emit);
    $.listen(ps, "sessionId", emit);
    $.listen(ps, "displayName", emit);
    $.listen(ps, "connected", emit);
    $.listen(ps, "ready", emit);
    $.listen(ps, "holesWon", emit);
    $.listen(ps, "totalStrokes", emit);
    $.listen(ps, "currentHoleStrokes", emit);
    $.listen(ps, "holedOut", emit);
    $.listen(ps, "aimAngle", emit);
    $.listen(ps, "aimPower", emit);
  }

  private emitPlayerUpdate(ps: any, slot: "p1" | "p2"): void {
    this.onPlayerUpdate?.(slot, {
      uid: ps.uid,
      sessionId: ps.sessionId,
      displayName: ps.displayName,
      connected: ps.connected,
      ready: ps.ready,
      holesWon: ps.holesWon,
      totalStrokes: ps.totalStrokes,
      currentHoleStrokes: ps.currentHoleStrokes,
      holedOut: ps.holedOut,
      aimAngle: ps.aimAngle,
      aimPower: ps.aimPower,
    });
  }

  private emitBallUpdate(ball: any): void {
    this.onBallUpdate?.({
      x: ball.x,
      z: ball.z,
      vx: ball.vx,
      vz: ball.vz,
      owner: ball.owner,
      holed: ball.holed,
    });
  }

  // ==========================================================================
  // Message Listeners (Server → Client)
  // ==========================================================================

  private bindMessageListeners(): void {
    if (!this.room) return;

    this.room.onMessage("hole_loaded", (data: HoleLoadedEvent) => {
      this.onHoleLoaded?.(data);
    });

    this.room.onMessage("shot_accepted", (data: ShotAcceptedEvent) => {
      this.onShotAccepted?.(data);
    });

    this.room.onMessage("shot_rejected", (data: ShotRejectedEvent) => {
      this.onShotRejected?.(data);
    });

    this.room.onMessage("ball_snapshot", (data: BallSnapshotEvent) => {
      this.onBallSnapshot?.(data);
    });

    this.room.onMessage("hole_result", (data: HoleResultEvent) => {
      this.onHoleResult?.(data);
    });

    this.room.onMessage("match_end", (data: MatchEndEvent) => {
      this.onMatchEnd?.(data);
    });

    this.room.onMessage("emote", (data: EmoteEvent) => {
      this.onEmote?.(data);
    });

    // Rematch flow (guide pattern: rematch → rematch_request → rematch_accept → rematch_started)
    this.room.onMessage(
      "rematch_request",
      (data: { fromSlot: string; fromName: string }) => {
        this.onRematchRequest?.(data);
      },
    );

    this.room.onMessage("rematch_started", () => {
      this.onRematchStarted?.();
    });

    // Reconnection notifications (guide §9.5)
    this.room.onMessage(
      "opponent_reconnecting",
      (data: { who: string; displayName: string }) => {
        this.onOpponentReconnecting?.(data);
      },
    );

    this.room.onMessage(
      "opponent_reconnected",
      (data: { who: string; displayName: string }) => {
        this.onOpponentReconnected?.(data);
      },
    );

    this.room.onError((code, message) => {
      this.onError?.(`Room error [${code}]: ${message}`);
    });

    this.room.onLeave((code) => {
      if (code > 1000) {
        this.onError?.(`Disconnected (code ${code})`);
      }
    });
  }
}
