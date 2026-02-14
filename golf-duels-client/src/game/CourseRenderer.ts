/**
 * Golf Duels Client — Course Renderer
 *
 * Renders a single hole from HoleData JSON using three.js.
 * Creates meshes for:
 * - Ground plane (green)
 * - Walls (dark raised edges)
 * - Cup (dark hole)
 * - Start position (tee marker)
 * - Surface zones (sand=yellow, slow=brown, speed=cyan)
 * - Hazards (water=blue)
 * - Obstacles (bumpers, spinners, gates, bridges, tunnels, speed_gates)
 *
 * Coordinate mapping: JSON x → Three.js x, JSON z → Three.js z
 * Y axis is "up" in Three.js. The course lies on the XZ plane at y=0.
 */

import type {
  BridgeObstacle,
  BumperRoundObstacle,
  BumperWedgeObstacle,
  GateObstacle,
  Hazard,
  HeightField,
  HoleData,
  Obstacle,
  SpeedGateObstacle,
  SpinnerObstacle,
  Surface,
  TunnelObstacle,
  Wall,
} from "@shared/types";
import * as THREE from "three";

// ============================================================================
// Colors
// ============================================================================

const COLORS = {
  green: 0x2e8b57,
  wall: 0x3e2723,
  cup: 0x1a1a1a,
  tee: 0xffffff,
  sand: 0xedc967,
  slow: 0x8b6914,
  speed: 0x00bcd4,
  water: 0x1565c0,
  outOfBounds: 0x424242,
  bumper: 0xff5722,
  spinner: 0x9c27b0,
  gate: 0xff9800,
  bridge: 0x795548,
  tunnel: 0x607d8b,
  speedGate: 0x00e676,
};

// ============================================================================
// CourseRenderer
// ============================================================================

export class CourseRenderer {
  private group = new THREE.Group();
  private animatedObjects: Array<{
    type: "spinner" | "gate";
    mesh: THREE.Mesh;
    data: SpinnerObstacle | GateObstacle;
  }> = [];

  constructor() {
    this.group.name = "course";
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Build the 3D representation of a hole.
   * Clears any previous geometry.
   */
  build(hole: HoleData): void {
    this.clear();

    this.buildGround(hole);
    this.buildWalls(hole.walls);
    this.buildCup(hole.cup.x, hole.cup.z);
    this.buildTee(hole.start.x, hole.start.z);
    this.buildSurfaces(hole.surfaces);
    this.buildHazards(hole.hazards);
    this.buildHeightFields(hole.heightFields, hole);
    this.buildObstacles(hole.obstacles);
  }

  /** Clear all course geometry */
  clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }
    this.animatedObjects = [];
  }

  /**
   * Update animated obstacles (spinners, gates).
   * Call every frame with the hole elapsed time from server.
   */
  updateAnimations(elapsed: number): void {
    for (const obj of this.animatedObjects) {
      if (obj.type === "spinner") {
        const s = obj.data as SpinnerObstacle;
        const angle = (s.phase + elapsed * s.rps) * Math.PI * 2;
        obj.mesh.rotation.y = angle;
      } else if (obj.type === "gate") {
        const g = obj.data as GateObstacle;
        const baseRad = (g.rotationBaseDeg * Math.PI) / 180;
        const halfArc = ((g.arcDeg / 2) * Math.PI) / 180;
        const phase = g.phase * Math.PI * 2;
        const oscillation =
          Math.sin((elapsed / g.periodSec) * Math.PI * 2 + phase) * halfArc;
        obj.mesh.rotation.y = baseRad + oscillation;
      }
    }
  }

  // ==========================================================================
  // Build Helpers
  // ==========================================================================

  private buildGround(hole: HoleData): void {
    const geo = new THREE.PlaneGeometry(hole.bounds.width, hole.bounds.height);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.green,
      roughness: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(hole.bounds.width / 2, -0.01, hole.bounds.height / 2);
    mesh.receiveShadow = true;
    mesh.name = "ground";
    this.group.add(mesh);
  }

  private buildWalls(walls: Wall[]): void {
    const wallHeight = 0.3;
    const wallThickness = 0.1;

    for (const wall of walls) {
      const dx = wall.b.x - wall.a.x;
      const dz = wall.b.z - wall.a.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dz, dx);

      const geo = new THREE.BoxGeometry(length, wallHeight, wallThickness);
      const mat = new THREE.MeshStandardMaterial({
        color: COLORS.wall,
        roughness: 0.6,
      });
      const mesh = new THREE.Mesh(geo, mat);

      const mx = (wall.a.x + wall.b.x) / 2;
      const mz = (wall.a.z + wall.b.z) / 2;
      mesh.position.set(mx, wallHeight / 2, mz);
      mesh.rotation.y = -angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  private buildCup(x: number, z: number): void {
    const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.05, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.cup,
      roughness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, -0.02, z);
    mesh.name = "cup";
    this.group.add(mesh);

    // Flag pole
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 0.5, z);
    this.group.add(pole);

    // Flag
    const flagGeo = new THREE.PlaneGeometry(0.4, 0.2);
    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(x + 0.2, 0.9, z);
    this.group.add(flag);
  }

  private buildTee(x: number, z: number): void {
    const geo = new THREE.RingGeometry(0.1, 0.2, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.tee,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.005, z);
    mesh.name = "tee";
    this.group.add(mesh);
  }

  private buildSurfaces(surfaces: Surface[]): void {
    for (const surface of surfaces) {
      const w = surface.max.x - surface.min.x;
      const h = surface.max.z - surface.min.z;
      let color = COLORS.green;

      switch (surface.type) {
        case "sand":
          color = COLORS.sand;
          break;
        case "slow":
          color = COLORS.slow;
          break;
        case "speed":
          color = COLORS.speed;
          break;
      }

      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        transparent: true,
        opacity: 0.7,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(surface.min.x + w / 2, 0.001, surface.min.z + h / 2);
      mesh.name = `surface_${surface.id}`;
      this.group.add(mesh);

      // Speed surface: add arrow indicator
      if (surface.type === "speed") {
        const arrowDir = new THREE.Vector3(
          (surface as any).dir.x,
          0,
          (surface as any).dir.z,
        ).normalize();
        const arrowOrigin = new THREE.Vector3(
          surface.min.x + w / 2,
          0.05,
          surface.min.z + h / 2,
        );
        const arrow = new THREE.ArrowHelper(
          arrowDir,
          arrowOrigin,
          Math.min(w, h) * 0.4,
          0x00ffff,
          0.15,
          0.1,
        );
        this.group.add(arrow);
      }
    }
  }

  private buildHazards(hazards: Hazard[]): void {
    for (const hazard of hazards) {
      const w = hazard.max.x - hazard.min.x;
      const h = hazard.max.z - hazard.min.z;
      const color = hazard.type === "water" ? COLORS.water : COLORS.outOfBounds;

      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.2,
        transparent: true,
        opacity: 0.6,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(hazard.min.x + w / 2, -0.005, hazard.min.z + h / 2);
      mesh.name = `hazard_${hazard.id}`;
      this.group.add(mesh);
    }
  }

  private buildHeightFields(heightFields: HeightField[], hole: HoleData): void {
    for (const hf of heightFields) {
      if (hf.type === "dome") {
        const geo = new THREE.SphereGeometry(
          hf.radius,
          16,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2,
        );
        const mat = new THREE.MeshStandardMaterial({
          color: COLORS.green,
          transparent: true,
          opacity: 0.4,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(hf.center.x, 0, hf.center.z);
        mesh.scale.y = hf.height / hf.radius;
        this.group.add(mesh);
      } else if (hf.type === "plane" && hf.zone) {
        const w = hf.zone.max.x - hf.zone.min.x;
        const h = hf.zone.max.z - hf.zone.min.z;
        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x3d9b69,
          transparent: true,
          opacity: 0.4,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        // Slight tilt to indicate slope direction
        mesh.rotation.z = hf.a * 2;
        mesh.position.set(hf.zone.min.x + w / 2, 0.003, hf.zone.min.z + h / 2);
        this.group.add(mesh);
      }
    }
  }

  private buildObstacles(obstacles: Obstacle[]): void {
    for (const obs of obstacles) {
      switch (obs.type) {
        case "bumper_round":
          this.buildBumperRound(obs);
          break;
        case "bumper_wedge":
          this.buildBumperWedge(obs);
          break;
        case "spinner":
          this.buildSpinner(obs);
          break;
        case "gate":
          this.buildGate(obs);
          break;
        case "bridge":
          this.buildBridge(obs);
          break;
        case "tunnel":
          this.buildTunnel(obs);
          break;
        case "speed_gate":
          this.buildSpeedGate(obs);
          break;
      }
    }
  }

  private buildBumperRound(obs: BumperRoundObstacle): void {
    const geo = new THREE.CylinderGeometry(obs.radius, obs.radius, 0.25, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.bumper,
      emissive: 0xff3300,
      emissiveIntensity: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(obs.pos.x, 0.125, obs.pos.z);
    mesh.castShadow = true;
    mesh.name = `bumper_${obs.id}`;
    this.group.add(mesh);
  }

  private buildBumperWedge(obs: BumperWedgeObstacle): void {
    const geo = new THREE.BoxGeometry(obs.halfLength * 2, 0.2, 0.12);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.bumper,
      emissive: 0xff3300,
      emissiveIntensity: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(obs.pos.x, 0.1, obs.pos.z);
    mesh.rotation.y = -(obs.rotationDeg * Math.PI) / 180;
    mesh.castShadow = true;
    mesh.name = `wedge_${obs.id}`;
    this.group.add(mesh);
  }

  private buildSpinner(obs: SpinnerObstacle): void {
    // Pivot post
    const pivotGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
    const pivotMat = new THREE.MeshStandardMaterial({ color: COLORS.spinner });
    const pivot = new THREE.Mesh(pivotGeo, pivotMat);
    pivot.position.set(obs.pivot.x, 0.15, obs.pivot.z);
    this.group.add(pivot);

    // Spinning arm (centered at pivot, will rotate around Y)
    const armGeo = new THREE.BoxGeometry(obs.length, 0.15, 0.08);
    const armMat = new THREE.MeshStandardMaterial({
      color: COLORS.spinner,
      emissive: 0x7b1fa2,
      emissiveIntensity: 0.3,
    });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(obs.pivot.x, 0.15, obs.pivot.z);
    arm.castShadow = true;
    arm.name = `spinner_${obs.id}`;
    this.group.add(arm);

    this.animatedObjects.push({ type: "spinner", mesh: arm, data: obs });
  }

  private buildGate(obs: GateObstacle): void {
    // Hinge post
    const hingeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8);
    const hingeMat = new THREE.MeshStandardMaterial({ color: COLORS.gate });
    const hinge = new THREE.Mesh(hingeGeo, hingeMat);
    hinge.position.set(obs.hinge.x, 0.175, obs.hinge.z);
    this.group.add(hinge);

    // Gate arm (pivots from one end)
    const armGeo = new THREE.BoxGeometry(obs.armLength, 0.12, 0.06);
    armGeo.translate(obs.armLength / 2, 0, 0); // Pivot from left end
    const armMat = new THREE.MeshStandardMaterial({
      color: COLORS.gate,
      emissive: 0xe65100,
      emissiveIntensity: 0.2,
    });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(obs.hinge.x, 0.15, obs.hinge.z);
    arm.castShadow = true;
    arm.name = `gate_${obs.id}`;
    this.group.add(arm);

    this.animatedObjects.push({ type: "gate", mesh: arm, data: obs });
  }

  private buildBridge(obs: BridgeObstacle): void {
    const dx = obs.b.x - obs.a.x;
    const dz = obs.b.z - obs.a.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);

    const geo = new THREE.BoxGeometry(length, 0.05, obs.width);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.bridge,
      roughness: 0.7,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((obs.a.x + obs.b.x) / 2, 0.1, (obs.a.z + obs.b.z) / 2);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `bridge_${obs.id}`;
    this.group.add(mesh);

    // Railings
    for (const side of [-1, 1]) {
      const railGeo = new THREE.BoxGeometry(length, 0.08, 0.03);
      const railMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(
        (obs.a.x + obs.b.x) / 2,
        0.15,
        (obs.a.z + obs.b.z) / 2 + side * (obs.width / 2),
      );
      rail.rotation.y = -angle;
      this.group.add(rail);
    }
  }

  private buildTunnel(obs: TunnelObstacle): void {
    // Entry portal
    const entryGeo = new THREE.TorusGeometry(obs.radius, 0.05, 8, 16);
    const entryMat = new THREE.MeshStandardMaterial({
      color: COLORS.tunnel,
      emissive: 0x37474f,
      emissiveIntensity: 0.3,
    });
    const entry = new THREE.Mesh(entryGeo, entryMat);
    entry.position.set(obs.enter.x, obs.radius, obs.enter.z);
    entry.rotation.x = Math.PI / 2;
    this.group.add(entry);

    // Exit portal
    const exit = entry.clone();
    exit.position.set(obs.exit.x, obs.radius, obs.exit.z);
    this.group.add(exit);

    // Connecting line (visual guide)
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(obs.enter.x, 0.05, obs.enter.z),
      new THREE.Vector3(obs.exit.x, 0.05, obs.exit.z),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: COLORS.tunnel,
      transparent: true,
      opacity: 0.3,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    this.group.add(line);
  }

  private buildSpeedGate(obs: SpeedGateObstacle): void {
    const w = obs.entry.max.x - obs.entry.min.x;
    const h = obs.entry.max.z - obs.entry.min.z;

    const geo = new THREE.BoxGeometry(w, 0.4, h);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.speedGate,
      transparent: true,
      opacity: 0.5,
      emissive: 0x00c853,
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(obs.entry.min.x + w / 2, 0.2, obs.entry.min.z + h / 2);
    mesh.name = `speedgate_${obs.id}`;
    this.group.add(mesh);

    // Exit marker
    const exitGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const exitMat = new THREE.MeshStandardMaterial({ color: COLORS.speedGate });
    const exitMesh = new THREE.Mesh(exitGeo, exitMat);
    exitMesh.position.set(obs.exit.x, 0.12, obs.exit.z);
    this.group.add(exitMesh);
  }
}
