/**
 * Scene controller — thin wrapper around existing Three.js viewer runtime.
 * Initialises scene, camera, renderer.
 * Builds BASE at centre, machines in a ring around it.
 */
import * as THREE from "three";
import { AnimationSystem } from "../../animation/animationSystem";
import { ModuleBuilder } from "../../builder/moduleBuilder";
import { buildWreck } from "../../builder/wreckBuilder";
import { createDebugScene } from "../../debug/debugScene";
import { loadSpec } from "../../loader/loader";
import { materialFactory } from "../../materials/materialFactory";
import type { BuiltModule, ModuleDef } from "../../types/schema";
import { VFXSystem } from "../../vfx/vfxSystem";
import type { PlacementMap } from "../data/baseSlotsSchema";
import type { WrecksCatalog, WrecksV2Catalog } from "../data/wrecksSchema";
import type { MachineCode, MachineStack, WreckState } from "../sim/types";
import { initBackground, updateBackground } from "./background";

/** Fallback machine ring layout — used only when no placement map is set. */
const RING_RADIUS = 4.5;
const MACHINE_ORDER = [
  "CUTTER",
  "SIGNAL",
  "HOPPER",
  "DRONES_MAG",
  "BATTERY",
  "LAB",
  "ASSEMBLER",
  "CRANE",
  "NANOFORGE",
  "PRINTER",
  "SCANNER",
  "DYSON",
];

function ringPosition(index: number, total: number): [number, number] {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS];
}

export class SceneController {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private animSystem!: AnimationSystem;
  private vfxSystem!: VFXSystem;
  private builder!: ModuleBuilder;
  private tapCb: (() => void) | null = null;
  private wreckTapCb: ((wreckId: string) => void) | null = null;
  private globalTime = 0;

  /**
   * Fraction of the viewport height occluded by bottom UI (0–1).
   * Used to bias the camera target upward so the BASE isn't hidden.
   */
  private bottomPadFraction = 0;

  /** Built 3D objects per machine code (one module per stack). */
  private builtMachines = new Map<string, BuiltModule>();
  /** Track tier to detect upgrades. */
  private machineTiers = new Map<string, number>();
  /** Track counts for stack markers. */
  private machineCountLabels = new Map<string, THREE.Sprite>();

  /** Wreck rendering state. */
  private builtWrecks = new Map<string, BuiltModule>();
  private wreckHpBars = new Map<string, THREE.Sprite>();
  private wreckAuraRings = new Map<string, THREE.Mesh>();
  private wreckModDef: ModuleDef | null = null;
  private wrecksCatalog: WrecksCatalog | null = null;
  private wrecksV2Catalog: WrecksV2Catalog | null = null;
  private raycaster = new THREE.Raycaster();

  /** Slot-based placement map: machineCode → world coords. */
  private placementMap: PlacementMap = {};

  /** Camera orbit */
  private orbit = {
    theta: 0.4,
    phi: 0.85,
    radius: 11,
    target: new THREE.Vector3(0, 0.8, 0),
    // Velocity for inertia
    vTheta: 0,
    vPhi: 0,
    vRadius: 0,
    // Drag state
    isDragging: false,
    lastX: 0,
    lastY: 0,
    // Active pointer ID for single-pointer tracking (avoids double-fire)
    activePointerId: -1 as number | null,
  };

  /** Soft-clamp pan bounds (XZ plane). */
  private static readonly PAN_LIMIT = 6;
  private static readonly PAN_SOFT = 4;

  /** Auto-rotate flag — can be toggled at runtime. */
  private autoRotate = true;

  /**
   * Async init — must be awaited before calling renderFrame().
   */
  async init(container: HTMLElement): Promise<void> {
    const ctx = createDebugScene(container);
    this.renderer = ctx.renderer;
    this.scene = ctx.scene;
    this.camera = ctx.camera;

    // Load spec & materials
    const { spec } = await loadSpec("./starforge_modules_v1.json");
    materialFactory.init(spec);

    this.builder = new ModuleBuilder(spec);
    this.animSystem = new AnimationSystem();
    this.vfxSystem = new VFXSystem(this.scene);

    // Cache WRECK ModuleDef for spawning wreck visuals
    this.wreckModDef = spec.modules["WRECK"] ?? null;

    // Build BASE tier 1 at origin (always present)
    const base = this.builder.build("BASE", 1);
    if (base) {
      base.group.position.set(0, 0, 0);
      this.scene.add(base.group);
      this.animSystem.register(base);
      this.vfxSystem.register(base);
    }

    // Background scenery (starfield, planets, far wreck silhouettes)
    initBackground(this.scene, 42);

    // Wire pointer input
    this.wireInput(this.renderer.domElement);

    // Resize handler
    window.addEventListener("resize", () => this.resize());
  }

  /** Register tap callback (scene click triggers tap). */
  setTapCallback(fn: () => void): void {
    this.tapCb = fn;
  }

  /**
   * Set the bottom padding in pixels. The camera target is shifted upward
   * so the BASE (at origin) is visible above the bottom HUD overlay.
   */
  setBottomPadding(px: number): void {
    const canvas = this.renderer?.domElement;
    if (!canvas) return;
    const viewportH = canvas.clientHeight;
    this.bottomPadFraction = viewportH > 0 ? Math.min(px / viewportH, 0.45) : 0;
  }

  /**
   * Recompute camera framing. Call after HUD layout changes
   * (contracts expand/collapse, orientation change, etc.).
   */
  reframe(): void {
    // The orbit target Y is shifted up proportionally to bottom occlusion.
    // At 0 occlusion → target Y = 0.8 (above origin to keep BASE clear).
    // As occlusion grows → target Y biased further upward.
    const baseTargetY = 0.8;
    const yBias = this.bottomPadFraction * this.orbit.radius * 0.55;
    this.orbit.target.y = baseTargetY + yBias;
  }

  /** Register wreck-tap callback (click on wreck triggers harvest). */
  setWreckTapCallback(fn: (wreckId: string) => void): void {
    this.wreckTapCb = fn;
  }

  /** Set the wreck catalog (needed for archetype → visual mapping). */
  setWrecksCatalog(c: WrecksCatalog): void {
    this.wrecksCatalog = c;
  }

  /** Set the v2 wreck catalog (needed for rarity color lookup). */
  setWrecksV2Catalog(c: WrecksV2Catalog): void {
    this.wrecksV2Catalog = c;
  }

  /** Set the slot-based placement map. syncMachines will use world coords from this. */
  setPlacementMap(map: PlacementMap): void {
    this.placementMap = map;
  }

  /**
   * Sync 3D objects to the current machine stacks.
   * One visual module per stack (keyed by code), plus a count label sprite.
   */
  syncMachines(machines: Record<MachineCode, MachineStack>): void {
    const currentCodes = new Set(Object.keys(machines));

    // Remove stale — machines whose code no longer exists in stacks
    for (const [code, built] of this.builtMachines) {
      if (!currentCodes.has(code)) {
        this.scene.remove(built.group);
        built.group.traverse((obj) => {
          if ((obj as THREE.Mesh).geometry)
            (obj as THREE.Mesh).geometry.dispose();
        });
        this.builtMachines.delete(code);
        this.machineTiers.delete(code);
        // Remove count label
        const sprite = this.machineCountLabels.get(code);
        if (sprite) {
          this.scene.remove(sprite);
          (sprite.material as THREE.SpriteMaterial).map?.dispose();
          this.machineCountLabels.delete(code);
        }
      }
    }

    // Add / update
    for (const s of Object.values(machines)) {
      const existingTier = this.machineTiers.get(s.code);
      if (existingTier !== s.tier) {
        // Remove old if tier changed
        const old = this.builtMachines.get(s.code);
        if (old) {
          this.scene.remove(old.group);
          old.group.traverse((obj) => {
            if ((obj as THREE.Mesh).geometry)
              (obj as THREE.Mesh).geometry.dispose();
          });
        }

        // Build at correct tier
        const built = this.builder.build(s.code, s.tier);
        if (!built) continue;

        // Position from placement map (slot-based) or fallback to ring
        const placement = this.placementMap[s.code];
        if (placement) {
          built.group.position.set(placement.x, 0, placement.z);
        } else {
          const orderIdx = MACHINE_ORDER.indexOf(s.code);
          const slotIdx = orderIdx >= 0 ? orderIdx : MACHINE_ORDER.length;
          const [x, z] = ringPosition(slotIdx, MACHINE_ORDER.length);
          built.group.position.set(x, 0, z);
        }

        this.scene.add(built.group);
        this.animSystem.register(built);
        this.vfxSystem.register(built);

        this.builtMachines.set(s.code, built);
        this.machineTiers.set(s.code, s.tier);
      }

      // Update / create count label sprite
      this.updateCountLabel(s);
    }
  }

  /** Create or update a floating ×N label above a machine stack. */
  private updateCountLabel(stack: MachineStack): void {
    const built = this.builtMachines.get(stack.code);
    if (!built) return;

    // Remove existing sprite
    const existingSprite = this.machineCountLabels.get(stack.code);
    if (existingSprite) {
      this.scene.remove(existingSprite);
      (existingSprite.material as THREE.SpriteMaterial).map?.dispose();
    }

    if (stack.count <= 1) {
      // No label needed for count 1
      this.machineCountLabels.delete(stack.code);
      return;
    }

    // Create canvas text
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx2 = canvas.getContext("2d")!;
    ctx2.clearRect(0, 0, 128, 64);
    ctx2.fillStyle = "#31d6ff";
    ctx2.font = "bold 36px monospace";
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(`×${stack.count}`, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.2, 0.6, 1);

    // Position above the module
    const pos = built.group.position.clone();
    pos.y += 1.8;
    sprite.position.copy(pos);

    this.scene.add(sprite);
    this.machineCountLabels.set(stack.code, sprite);
  }

  // ── Wreck Rendering ─────────────────────────────────────

  /**
   * Sync wreck 3D objects to current active wrecks.
   * Builds new wreck modules, removes despawned ones, updates HP bars.
   */
  /** Dock anchor position — where wrecks snap to when docked. */
  private static readonly DOCK_POS = new THREE.Vector3(0, 0, 1.15);

  syncWrecks(wrecks: Record<string, WreckState>, currentTick?: number): void {
    const activeIds = new Set(Object.keys(wrecks));

    // Remove stale wrecks
    for (const [id, built] of this.builtWrecks) {
      if (!activeIds.has(id)) {
        this.scene.remove(built.group);
        built.group.traverse((obj) => {
          if ((obj as THREE.Mesh).geometry)
            (obj as THREE.Mesh).geometry.dispose();
        });
        this.builtWrecks.delete(id);
        // Remove HP bar
        const bar = this.wreckHpBars.get(id);
        if (bar) {
          this.scene.remove(bar);
          (bar.material as THREE.SpriteMaterial).map?.dispose();
          this.wreckHpBars.delete(id);
        }
        // Remove aura ring
        const aura = this.wreckAuraRings.get(id);
        if (aura) {
          this.scene.remove(aura);
          (aura.material as THREE.MeshBasicMaterial).dispose();
          (aura.geometry as THREE.RingGeometry).dispose();
          this.wreckAuraRings.delete(id);
        }
      }
    }

    // Add new + update positions + HP bars
    for (const [id, ws] of Object.entries(wrecks)) {
      if (!this.builtWrecks.has(id)) {
        // Try v1 archetype lookup for visual
        let built: BuiltModule | null = null;
        if (this.wreckModDef && this.wrecksCatalog) {
          const def = this.wrecksCatalog.wreckArchetypes.find(
            (a) => a.id === ws.archetypeId,
          );
          if (def) {
            built = buildWreck(this.wreckModDef, def.moduleArchetype, 1);
          }
        }
        // fallback for v2 wrecks without v1 archetype
        if (!built && this.wreckModDef) {
          built = buildWreck(this.wreckModDef, "CargoBarge", 1);
        }
        if (!built) continue;

        built.group.position.set(ws.x, 0, ws.z);
        built.group.userData = { wreckId: id };
        this.scene.add(built.group);
        this.animSystem.register(built);
        this.builtWrecks.set(id, built);

        // Add rarity aura ring (colored ground ring beneath wreck)
        const rarityColor = this.getRarityColor(ws.rarity);
        if (rarityColor) {
          const ringGeo = new THREE.RingGeometry(0.7, 0.9, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(rarityColor),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: ws.rarity === "common" ? 0.3 : 0.6,
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.rotation.x = -Math.PI / 2; // lay flat
          ringMesh.position.set(ws.x, 0.02, ws.z);
          this.scene.add(ringMesh);
          this.wreckAuraRings.set(id, ringMesh);
        }
      }

      // Phase-aware positioning
      const built = this.builtWrecks.get(id)!;
      const aura = this.wreckAuraRings.get(id);
      const phase = ws.phase ?? "spawned";
      switch (phase) {
        case "spawned":
          built.group.position.set(ws.x, 0, ws.z);
          if (aura) aura.position.set(ws.x, 0.02, ws.z);
          break;
        case "in_transit": {
          // Interpolate from spawn to dock based on tick progress
          const dock = SceneController.DOCK_POS;
          const spawnPos = new THREE.Vector3(ws.x, 0, ws.z);
          if (
            ws.dockReadyTick != null &&
            ws.spawnedAtTick != null &&
            currentTick != null
          ) {
            const totalTicks = ws.dockReadyTick - ws.spawnedAtTick;
            const elapsed = currentTick - ws.spawnedAtTick;
            const t =
              totalTicks > 0
                ? Math.min(1, Math.max(0, elapsed / totalTicks))
                : 1;
            built.group.position.lerpVectors(spawnPos, dock, t);
          } else {
            built.group.position.lerpVectors(spawnPos, dock, 0.5);
          }
          if (aura) {
            aura.position.set(
              built.group.position.x,
              0.02,
              built.group.position.z,
            );
          }
          break;
        }
        case "docked":
          built.group.position.copy(SceneController.DOCK_POS);
          if (aura) {
            aura.position.set(
              SceneController.DOCK_POS.x,
              0.02,
              SceneController.DOCK_POS.z,
            );
          }
          break;
      }

      // Update HP bar
      this.updateWreckHpBar(id, ws);
    }
  }

  /** Create / update a floating HP bar above a wreck. */
  private updateWreckHpBar(id: string, ws: WreckState): void {
    const built = this.builtWrecks.get(id);
    if (!built) return;

    // Remove existing
    const existing = this.wreckHpBars.get(id);
    if (existing) {
      this.scene.remove(existing);
      (existing.material as THREE.SpriteMaterial).map?.dispose();
    }

    const hpFrac = ws.maxHpMicro > 0 ? ws.hpMicro / ws.maxHpMicro : 0;
    if (hpFrac <= 0) {
      this.wreckHpBars.delete(id);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 16;
    const c = canvas.getContext("2d")!;
    // Background
    c.fillStyle = "#333";
    c.fillRect(0, 0, 128, 16);
    // Fill
    const color = hpFrac > 0.5 ? "#0f0" : hpFrac > 0.25 ? "#ff0" : "#f00";
    c.fillStyle = color;
    c.fillRect(1, 1, Math.round(126 * hpFrac), 14);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 0.18, 1);
    const pos = built.group.position.clone();
    pos.y += 1.6;
    sprite.position.copy(pos);

    this.scene.add(sprite);
    this.wreckHpBars.set(id, sprite);
  }

  /** Look up rarity UI color from v2 catalog, or use fallback. */
  private getRarityColor(rarity: string | undefined): string {
    if (!rarity || rarity === "common") {
      // Common gets a subtle gray aura
      return "#9aa0a6";
    }
    if (this.wrecksV2Catalog) {
      const def =
        this.wrecksV2Catalog.rarities[
          rarity as keyof typeof this.wrecksV2Catalog.rarities
        ];
      if (def) return def.uiColor;
    }
    // Fallback colors
    const fallback: Record<string, string> = {
      uncommon: "#34a853",
      rare: "#4285f4",
      epic: "#a142f4",
      ancient: "#fbbc04",
    };
    return fallback[rarity] ?? "#9aa0a6";
  }

  /** Called every animation frame. */
  renderFrame(dt: number): void {
    this.globalTime += dt;

    const o = this.orbit;
    const damping = 0.92; // velocity decay per frame

    // Auto-rotate only when not dragging and enabled
    if (!o.isDragging && this.autoRotate) {
      o.theta += 0.06 * dt;
    }

    // Apply inertia when not dragging
    if (!o.isDragging) {
      o.theta += o.vTheta;
      o.phi += o.vPhi;
      o.radius += o.vRadius;
      o.vTheta *= damping;
      o.vPhi *= damping;
      o.vRadius *= damping;
      // Kill tiny values
      if (Math.abs(o.vTheta) < 0.00001) o.vTheta = 0;
      if (Math.abs(o.vPhi) < 0.00001) o.vPhi = 0;
      if (Math.abs(o.vRadius) < 0.0001) o.vRadius = 0;
    }

    // Clamp phi
    o.phi = Math.max(0.2, Math.min(Math.PI - 0.2, o.phi));
    // Clamp radius
    o.radius = Math.max(3, Math.min(25, o.radius));

    // Smoothly apply bottom-pad bias to orbit target Y
    const baseTargetY = 0.8;
    const yBias = this.bottomPadFraction * o.radius * 0.55;
    const desiredY = baseTargetY + yBias;
    o.target.y += (desiredY - o.target.y) * 0.05;

    // Update camera from orbit
    this.camera.position.set(
      o.target.x + o.radius * Math.sin(o.phi) * Math.cos(o.theta),
      o.target.y + o.radius * Math.cos(o.phi),
      o.target.z + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
    );
    this.camera.lookAt(o.target);

    // Animate
    this.animSystem.update(dt, this.globalTime);
    this.vfxSystem.update(dt);
    updateBackground(dt);

    this.renderer.render(this.scene, this.camera);
  }

  /** Toggle auto-rotation on/off. Returns the new state. */
  setAutoRotate(enabled: boolean): void {
    this.autoRotate = enabled;
  }

  /** Handle window resize. */
  resize(): void {
    const parent = this.renderer.domElement.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Recompute bottom-pad fraction with new viewport height
    this.reframe();
  }

  // ── Pointer / touch input ──────────────────────────────

  /** Track pinch-to-zoom touch state. */
  private pinchStartDist = 0;
  private pinchStartRadius = 0;

  private wireInput(canvas: HTMLCanvasElement): void {
    // Prevent browser gestures (scroll, double-tap zoom) on the game canvas
    canvas.style.touchAction = "none";

    // Track the pointer-down origin to distinguish taps from drags
    let pointerDownX = 0;
    let pointerDownY = 0;

    // ── Single-pointer orbit (touch + mouse) ──────────────────────────
    // We lock to ONE pointerId to avoid double-fire from touch + emulated
    // mouse events on mobile. Only the locked pointer moves the camera.

    canvas.addEventListener("pointerdown", (e) => {
      if (e.target !== canvas) return;
      // Ignore if we already own a pointer (second finger → handled by
      // touch events for pinch/pan)
      if (this.orbit.activePointerId !== null) return;

      canvas.setPointerCapture(e.pointerId);
      this.orbit.activePointerId = e.pointerId;
      this.orbit.isDragging = true;
      this.orbit.lastX = e.clientX;
      this.orbit.lastY = e.clientY;
      // Kill any residual inertia on new drag
      this.orbit.vTheta = 0;
      this.orbit.vPhi = 0;
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    });

    // Disable context menu on canvas so right-drag works for pan
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.orbit.activePointerId) return;
      const dx = e.clientX - this.orbit.lastX;
      const dy = e.clientY - this.orbit.lastY;

      // Orbit rotation
      const dTheta = -dx * 0.005;
      const dPhi = -dy * 0.005;
      this.orbit.theta += dTheta;
      this.orbit.phi = Math.max(
        0.2,
        Math.min(Math.PI - 0.2, this.orbit.phi + dPhi),
      );

      // Store velocity for inertia (smoothed)
      this.orbit.vTheta = dTheta * 0.5;
      this.orbit.vPhi = dPhi * 0.5;

      this.orbit.lastX = e.clientX;
      this.orbit.lastY = e.clientY;
    });

    const finishPointer = (e: PointerEvent) => {
      if (e.pointerId !== this.orbit.activePointerId) return;

      const dx = Math.abs(e.clientX - pointerDownX);
      const dy = Math.abs(e.clientY - pointerDownY);
      if (e.type === "pointerup" && dx < 6 && dy < 6) {
        // Tap — check wreck raycast first
        const wreckId = this.raycastWreck(e);
        if (wreckId && this.wreckTapCb) {
          this.wreckTapCb(wreckId);
        } else if (this.tapCb) {
          this.tapCb();
          this.animSystem.fireClick();
          this.vfxSystem.fireClick();
        }
        // No inertia on tap
        this.orbit.vTheta = 0;
        this.orbit.vPhi = 0;
      }

      this.orbit.isDragging = false;
      this.orbit.activePointerId = null;
    };

    canvas.addEventListener("pointerup", finishPointer);
    canvas.addEventListener("pointercancel", finishPointer);

    // ── Mouse wheel zoom ──────────────────────────────────────────────
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.orbit.radius = Math.max(
          3,
          Math.min(25, this.orbit.radius + e.deltaY * 0.01),
        );
      },
      { passive: false },
    );

    // ── Two-finger pinch-to-zoom & pan (touch only) ──────────────────
    let pinchStartCX = 0;
    let pinchStartCY = 0;

    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          // Release single-pointer orbit so two-finger takes over
          this.orbit.isDragging = false;
          this.orbit.activePointerId = null;
          this.orbit.vTheta = 0;
          this.orbit.vPhi = 0;

          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.pinchStartDist = Math.sqrt(dx * dx + dy * dy);
          this.pinchStartRadius = this.orbit.radius;
          pinchStartCX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
          pinchStartCY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
        }
      },
      { passive: false },
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const t0x = e.touches[0].clientX;
          const t0y = e.touches[0].clientY;
          const t1x = e.touches[1].clientX;
          const t1y = e.touches[1].clientY;
          const dx = t0x - t1x;
          const dy = t0y - t1y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Pinch-to-zoom
          if (this.pinchStartDist > 0) {
            const scale = this.pinchStartDist / dist;
            this.orbit.radius = Math.max(
              3,
              Math.min(25, this.pinchStartRadius * scale),
            );
          }

          // Two-finger pan
          const cx = (t0x + t1x) * 0.5;
          const cy = (t0y + t1y) * 0.5;
          const panDx = cx - pinchStartCX;
          const panDy = cy - pinchStartCY;
          if (Math.abs(panDx) > 1 || Math.abs(panDy) > 1) {
            const panSpeed = 0.008 * this.orbit.radius * 0.15;
            const sinT = Math.sin(this.orbit.theta);
            const cosT = Math.cos(this.orbit.theta);
            this.orbit.target.x += (-panDx * sinT + panDy * cosT) * panSpeed;
            this.orbit.target.z += (panDx * cosT + panDy * sinT) * panSpeed;
            this.softClampTarget();
          }
          pinchStartCX = cx;
          pinchStartCY = cy;
        }
      },
      { passive: false },
    );

    canvas.addEventListener("touchend", () => {
      this.pinchStartDist = 0;
    });
  }

  /** Soft-clamp orbit target so it can't stray too far from origin. */
  private softClampTarget(): void {
    const t = this.orbit.target;
    const dist = Math.sqrt(t.x * t.x + t.z * t.z);
    const soft = SceneController.PAN_SOFT;
    const limit = SceneController.PAN_LIMIT;

    if (dist > soft) {
      // Exponential falloff past the soft boundary
      const over = dist - soft;
      const range = limit - soft;
      const clamped = soft + range * (1 - Math.exp(-over / range));
      const scale = clamped / dist;
      t.x *= scale;
      t.z *= scale;
    }
  }

  /** Raycast pointer position against wreck groups; return wreckId or null. */
  private raycastWreck(e: PointerEvent): string | null {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(mouse, this.camera);

    // Collect all wreck meshes
    const targets: THREE.Object3D[] = [];
    for (const built of this.builtWrecks.values()) {
      built.group.traverse((obj) => targets.push(obj));
    }

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;

    // Walk up to find group with wreckId userData
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj) {
      if (obj.userData?.wreckId) return obj.userData.wreckId as string;
      obj = obj.parent;
    }
    return null;
  }
}
