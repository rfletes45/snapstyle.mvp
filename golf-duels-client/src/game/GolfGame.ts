/**
 * Golf Duels Client — GolfGame  (Segment 3 protocol)
 *
 * Main three.js game orchestrator.
 * - Creates and manages Scene, Camera, Renderer, Lights.
 * - Single ball mesh (ball owns "p1" or "p2", colored accordingly).
 * - Connects InputController (aim/shoot) and HUD to GolfClient events.
 * - Renders the course from server-reported hole data.
 * - Aim-assist: dotted prediction line (client-side physics for 2 s).
 * - Ball interpolation from server snapshots; snap if drift > 0.5 m.
 * - Provides the render loop.
 */

import * as THREE from "three";
import {
  GolfClient,
  type CourseInfo,
  type PlayerState,
} from "../net/GolfClient";
import { CourseRenderer } from "./CourseRenderer";
import { HUD } from "./HUD";
import { InputController } from "./InputController";

// Shared physics for aim-assist prediction
import { applyShot, physicsTick } from "@shared/physics";
import {
  PHYSICS,
  type HoleData,
  type BallState as SharedBallState,
} from "@shared/types";

// ============================================================================
// Constants
// ============================================================================

const BALL_RADIUS = PHYSICS.BALL_RADIUS;
const BALL_Y = BALL_RADIUS;
const CAMERA_HEIGHT = 18;
const CAMERA_PADDING = 2;

/** Maximum prediction seconds for aim-assist line */
const PREDICTION_SECONDS = 2.0;
/** Maximum prediction ticks */
const PREDICTION_TICKS = Math.ceil(PREDICTION_SECONDS / PHYSICS.DT);
/** Step distance for dotted line sampling */
const PREDICTION_DOT_SPACING = 0.3;
/** Snap threshold for ball interpolation */
const SNAP_THRESHOLD = 0.5;

const SLOT_COLORS: Record<string, number> = {
  p1: 0xffffff, // white
  p2: 0xff4081, // pink
};

// ============================================================================
// GolfGame
// ============================================================================

export class GolfGame {
  // three.js core
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // Sub-systems
  private courseRenderer: CourseRenderer;
  private input: InputController;
  private hud: HUD;
  private client: GolfClient;

  // Game objects
  private ballMesh: THREE.Mesh | null = null;
  private aimLine: THREE.Line | null = null;
  private predictionDots: THREE.Group | null = null;

  // State tracking
  private p1: PlayerState | null = null;
  private p2: PlayerState | null = null;
  private courseWidth = 20;
  private courseHeight = 30;
  private running = false;
  private lastTime = 0;
  private holeElapsed = 0;
  private currentPhase = "LOBBY";

  // Ball interpolation from snapshots
  private serverBallPos = { x: 0, z: 0 };
  private displayBallPos = { x: 0, z: 0 };

  // Current hole data for aim-assist prediction
  private currentHoleData: HoleData | null = null;

  constructor(container: HTMLElement, client: GolfClient, hud: HUD) {
    this.client = client;
    this.hud = hud;

    // ---- Renderer ----------------------------------------------------------
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x1b5e20);
    container.appendChild(this.renderer.domElement);

    // ---- Scene -------------------------------------------------------------
    this.scene = new THREE.Scene();

    // ---- Camera (orthographic, top-down) -----------------------------------
    const aspect = container.clientWidth / container.clientHeight;
    const halfW = (this.courseWidth + CAMERA_PADDING) / 2;
    const halfH = halfW / aspect;
    this.camera = new THREE.OrthographicCamera(
      -halfW,
      halfW,
      halfH,
      -halfH,
      0.1,
      100,
    );
    this.camera.position.set(
      this.courseWidth / 2,
      CAMERA_HEIGHT,
      this.courseHeight / 2,
    );
    this.camera.lookAt(this.courseWidth / 2, 0, this.courseHeight / 2);
    this.camera.up.set(0, 0, -1);

    // ---- Lights ------------------------------------------------------------
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 20, -5);
    this.scene.add(directional);

    // ---- Course Renderer ---------------------------------------------------
    this.courseRenderer = new CourseRenderer();
    this.scene.add(this.courseRenderer.getGroup());

    // ---- Input Controller --------------------------------------------------
    this.input = new InputController(this.renderer.domElement);
    this.input.onShoot = (angle, power) => {
      this.client.sendShot(angle, power);
      this.hud.hidePowerBar();
      this.removeAimLine();
      this.removePredictionDots();
    };
    this.input.onAim = (angle) => {
      this.updatePredictionLine(angle, this.input.getState().power);
    };

    // ---- Bind Client Callbacks ---------------------------------------------
    this.bindClientCallbacks();

    // ---- Resize ------------------------------------------------------------
    window.addEventListener("resize", this.onResize.bind(this));
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop(): void {
    this.running = false;
  }

  dispose(): void {
    this.stop();
    this.input.dispose();
    this.hud.dispose();
    this.renderer.dispose();
  }

  // ==========================================================================
  // Render Loop
  // ==========================================================================

  private tick = (now: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.tick);

    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.courseRenderer.updateAnimations(this.holeElapsed);

    const inputState = this.input.getState();
    if (inputState.mode === "power") {
      this.hud.showPowerBar(inputState.power);
      this.updatePredictionLine(inputState.angle, inputState.power);
    }
    if (inputState.mode === "aiming") {
      this.updateAimLine(inputState.angle);
    }

    // Smooth ball interpolation toward server position
    this.interpolateBall(dt);

    this.updateBallScreenPos();
    this.renderer.render(this.scene, this.camera);
  };

  // ==========================================================================
  // Ball Interpolation / Smoothing
  // ==========================================================================

  private interpolateBall(dt: number): void {
    if (!this.ballMesh) return;

    const dx = this.serverBallPos.x - this.displayBallPos.x;
    const dz = this.serverBallPos.z - this.displayBallPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > SNAP_THRESHOLD) {
      // Snap immediately
      this.displayBallPos.x = this.serverBallPos.x;
      this.displayBallPos.z = this.serverBallPos.z;
    } else if (dist > 0.001) {
      // Smooth interpolation
      const lerpSpeed = 12;
      const t = Math.min(1, lerpSpeed * dt);
      this.displayBallPos.x += dx * t;
      this.displayBallPos.z += dz * t;
    }

    this.ballMesh.position.set(
      this.displayBallPos.x,
      BALL_Y,
      this.displayBallPos.z,
    );
  }

  // ==========================================================================
  // Client Callbacks
  // ==========================================================================

  private bindClientCallbacks(): void {
    this.client.onPhaseChange = (phase) => this.onPhaseChange(phase);

    this.client.onPlayerUpdate = (slot, data) => {
      if (slot === "p1") this.p1 = data;
      else this.p2 = data;
      this.updatePlayerNames();
      this.updateScoreDisplay();
      this.hud.updateStrokes(
        this.p1?.currentHoleStrokes ?? 0,
        this.p2?.currentHoleStrokes ?? 0,
      );
    };

    this.client.onBallUpdate = (ball) => {
      this.serverBallPos = { x: ball.x, z: ball.z };
      this.ensureBallMesh(ball.owner);
    };

    this.client.onBallSnapshot = (snap) => {
      this.serverBallPos = { x: snap.x, z: snap.z };
      this.ensureBallMesh(snap.who);
    };

    this.client.onCourseChange = (info) => this.onCourseChange(info);

    this.client.onShotClock = (value) => {
      this.hud.updateShotClock(value);
    };

    this.client.onActivePlayer = (who) => {
      this.hud.setActivePlayer(who, this.client.mySlot);
      if (who === this.client.mySlot) {
        this.input.enable();
      } else {
        this.input.disable();
        this.hud.hidePowerBar();
        this.removeAimLine();
        this.removePredictionDots();
      }
    };

    this.client.onHoleElapsed = (elapsed) => {
      this.holeElapsed = elapsed;
    };

    this.client.onHoleLoaded = (e) => {
      this.hud.setHoleLabel(e.holeNumber);
      this.client.sendReady();
    };

    this.client.onShotAccepted = (_e) => {
      // Shot animation handled via ball updates
    };

    this.client.onShotRejected = (e) => {
      this.hud.showStatus(`Shot rejected: ${e.reason}`);
      setTimeout(() => this.hud.hideStatus(), 2000);
    };

    this.client.onHoleResult = (result) => {
      const winnerName =
        result.winner === "p1"
          ? (this.p1?.displayName ?? "P1")
          : result.winner === "p2"
            ? (this.p2?.displayName ?? "P2")
            : null;
      this.hud.showHoleResult(
        result.holeNumber,
        winnerName,
        result.p1Strokes,
        result.p2Strokes,
      );
      this.hud.updateScore(result.p1HolesWon, result.p2HolesWon);
      this.hud.updateMatchProgress(result.holeNumber);
    };

    this.client.onMatchEnd = (result) => {
      this.input.disable();
      this.hud.hidePowerBar();
      this.removeAimLine();
      this.removePredictionDots();

      const winnerName =
        result.winner === "p1"
          ? (this.p1?.displayName ?? "P1")
          : result.winner === "p2"
            ? (this.p2?.displayName ?? "P2")
            : null;
      this.hud.showMatchResult(
        winnerName,
        result.p1HolesWon,
        result.p2HolesWon,
        result.reason,
      );
    };

    this.client.onEmote = (_e) => {
      // TODO: Show emote bubble over the player
    };

    this.client.onError = (err) => {
      this.hud.showError(err);
    };
  }

  // ==========================================================================
  // Phase Management
  // ==========================================================================

  private onPhaseChange(phase: string): void {
    this.currentPhase = phase;

    switch (phase) {
      case "LOBBY":
        this.hud.showReadyButton(() => {
          this.client.sendReady();
          this.hud.hideReadyButton();
          this.hud.showStatus("Waiting for opponent...");
        });
        break;

      case "HOLE_INTRO":
        this.hud.hideStatus();
        this.hud.hideReadyButton();
        this.hud.showStatus("Loading hole...");
        break;

      case "AIMING_P1":
      case "AIMING_P2":
        this.hud.hideStatus();
        break;

      case "BALL_MOVING_P1":
      case "BALL_MOVING_P2":
        this.removePredictionDots();
        break;

      case "HOLE_RESOLVE":
        this.input.disable();
        this.removePredictionDots();
        break;

      case "MATCH_END":
        this.input.disable();
        this.removePredictionDots();
        break;
    }
  }

  // ==========================================================================
  // Course Loading
  // ==========================================================================

  private async onCourseChange(info: CourseInfo): Promise<void> {
    this.courseWidth = info.courseWidth;
    this.courseHeight = info.courseHeight;

    if (!info.holeId) {
      console.warn("onCourseChange called with empty holeId — skipping");
      return;
    }

    try {
      // Build an absolute URL so the fetch succeeds in React Native WebView
      // and when served behind a sub-path (e.g. /golf/).
      let courseUrl: string;
      try {
        const base = new URL(".", window.location.href).href;
        courseUrl = new URL(`courses/${info.holeId}.json`, base).href;
      } catch {
        // Fallback: derive from origin + pathname when URL constructor fails
        const { origin, pathname } = window.location;
        const dir = pathname.substring(0, pathname.lastIndexOf("/") + 1) || "/";
        courseUrl = `${origin}${dir}courses/${info.holeId}.json`;
      }
      const resp = await fetch(courseUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${courseUrl}`);
      const holeData: HoleData = await resp.json();

      this.currentHoleData = holeData;
      this.courseRenderer.build(holeData);
      this.updateCameraBounds();

      // Place ball at start
      this.serverBallPos = { x: info.startX, z: info.startZ };
      this.displayBallPos = { x: info.startX, z: info.startZ };
      this.ensureBallMesh("p1");
      if (this.ballMesh) {
        this.ballMesh.position.set(info.startX, BALL_Y, info.startZ);
      }
    } catch (err) {
      console.error("Failed to load course:", err);
      this.hud.showError(`Failed to load course: ${err}`);
    }
  }

  // ==========================================================================
  // Camera
  // ==========================================================================

  private updateCameraBounds(): void {
    const aspect =
      this.renderer.domElement.clientWidth /
      this.renderer.domElement.clientHeight;

    const halfW = (this.courseWidth + CAMERA_PADDING * 2) / 2;
    const halfH = (this.courseHeight + CAMERA_PADDING * 2) / 2;

    let fitW = halfW;
    let fitH = halfH;
    if (fitW / fitH > aspect) {
      fitH = fitW / aspect;
    } else {
      fitW = fitH * aspect;
    }

    this.camera.left = -fitW + this.courseWidth / 2;
    this.camera.right = fitW + this.courseWidth / 2;
    this.camera.top = fitH + this.courseHeight / 2;
    this.camera.bottom = -fitH + this.courseHeight / 2;
    this.camera.position.set(
      this.courseWidth / 2,
      CAMERA_HEIGHT,
      this.courseHeight / 2,
    );
    this.camera.lookAt(this.courseWidth / 2, 0, this.courseHeight / 2);
    this.camera.updateProjectionMatrix();
  }

  private onResize(): void {
    const w = this.renderer.domElement.parentElement?.clientWidth ?? 800;
    const h = this.renderer.domElement.parentElement?.clientHeight ?? 600;
    this.renderer.setSize(w, h);
    this.updateCameraBounds();
  }

  // ==========================================================================
  // Ball Mesh (single ball)
  // ==========================================================================

  private ensureBallMesh(owner: string): void {
    if (!this.ballMesh) {
      const geometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: SLOT_COLORS[owner] ?? 0xffffff,
        roughness: 0.3,
        metalness: 0.1,
      });
      this.ballMesh = new THREE.Mesh(geometry, material);
      this.ballMesh.name = "ball";
      this.ballMesh.castShadow = true;
      this.scene.add(this.ballMesh);
    }

    // Update color when ownership changes
    const color = SLOT_COLORS[owner] ?? 0xffffff;
    (this.ballMesh.material as THREE.MeshStandardMaterial).color.setHex(color);
  }

  // ==========================================================================
  // Aim Line (arrow)
  // ==========================================================================

  private updateAimLine(angle: number): void {
    this.removeAimLine();
    if (!this.ballMesh) return;

    const origin = new THREE.Vector3(
      this.displayBallPos.x,
      0.1,
      this.displayBallPos.z,
    );
    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const end = origin.clone().add(dir.multiplyScalar(3));

    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
    });
    this.aimLine = new THREE.Line(geometry, material);
    this.aimLine.name = "aim_line";
    this.scene.add(this.aimLine);
  }

  private removeAimLine(): void {
    if (this.aimLine) {
      this.scene.remove(this.aimLine);
      this.aimLine.geometry.dispose();
      (this.aimLine.material as THREE.Material).dispose();
      this.aimLine = null;
    }
  }

  // ==========================================================================
  // Prediction Line (aim assist — client runs same physics for 2 s)
  // ==========================================================================

  private updatePredictionLine(angle: number, power: number): void {
    this.removePredictionDots();

    if (!this.currentHoleData) return;
    if (power < 0.01) return;

    const startBall: SharedBallState = {
      x: this.displayBallPos.x,
      z: this.displayBallPos.z,
      vx: 0,
      vz: 0,
    };
    const shotBall = applyShot(startBall, angle, power);

    // Simulate forward, collecting positions
    const points: THREE.Vector3[] = [];
    let ball = { ...shotBall };
    let restAccum = 0;
    let lastX = ball.x;
    let lastZ = ball.z;
    let distAccum = 0;
    let hitWall = false;

    points.push(new THREE.Vector3(ball.x, 0.08, ball.z));

    for (let i = 0; i < PREDICTION_TICKS; i++) {
      const result = physicsTick(
        ball,
        this.currentHoleData,
        PHYSICS.DT,
        this.holeElapsed + i * PHYSICS.DT,
        restAccum,
      );
      ball = result.ball;
      restAccum = result.restAccum;

      const dx = ball.x - lastX;
      const dz = ball.z - lastZ;
      distAccum += Math.sqrt(dx * dx + dz * dz);
      lastX = ball.x;
      lastZ = ball.z;

      // Sample at dot spacing intervals
      if (distAccum >= PREDICTION_DOT_SPACING) {
        points.push(new THREE.Vector3(ball.x, 0.08, ball.z));
        distAccum = 0;
      }

      // Stop at first collision / hazard / hole / stop
      if (result.holed || result.hitHazard || result.stopped) break;

      // Detect wall bounce (velocity direction changed significantly — optionally show 1 bounce)
      if (result.tunneled) break;

      // Simple wall-bounce detection: if we haven't hit yet, check for significant direction change
      if (!hitWall) {
        const dot = shotBall.vx * ball.vx + shotBall.vz * ball.vz;
        if (dot < 0) {
          hitWall = true;
          // Show one bounce then stop
          points.push(new THREE.Vector3(ball.x, 0.08, ball.z));
          break;
        }
      }
    }

    if (points.length < 2) return;

    // Create dotted line using dashed material
    this.predictionDots = new THREE.Group();
    this.predictionDots.name = "prediction_dots";

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: 0xffff00,
      dashSize: 0.15,
      gapSize: 0.1,
      linewidth: 1,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    this.predictionDots.add(line);

    this.scene.add(this.predictionDots);
  }

  private removePredictionDots(): void {
    if (this.predictionDots) {
      this.scene.remove(this.predictionDots);
      this.predictionDots.traverse((child) => {
        if ((child as THREE.Line).geometry) {
          (child as THREE.Line).geometry.dispose();
        }
      });
      this.predictionDots = null;
    }
  }

  // ==========================================================================
  // Ball Screen Pos for Input
  // ==========================================================================

  private updateBallScreenPos(): void {
    if (!this.ballMesh) return;

    const pos = this.ballMesh.position.clone();
    pos.project(this.camera);

    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const sx = ((pos.x + 1) / 2) * w;
    const sy = ((-pos.y + 1) / 2) * h;
    this.input.setBallScreenPosition(sx, sy);
  }

  // ==========================================================================
  // Player Info
  // ==========================================================================

  private updatePlayerNames(): void {
    this.hud.setPlayerNames(
      this.p1?.displayName || "P1",
      this.p2?.displayName || "P2",
    );
  }

  private updateScoreDisplay(): void {
    this.hud.updateScore(this.p1?.holesWon ?? 0, this.p2?.holesWon ?? 0);
  }
}
