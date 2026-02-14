/**
 * Starforge Module Viewer — standalone viewer mode.
 * Loads the spec, builds modules, runs animations + VFX in a debug scene.
 * Extracted from main.ts so it can run independently of the game.
 */
import * as THREE from "three";
import { AnimationSystem } from "./animation/animationSystem";
import { ModuleBuilder } from "./builder/moduleBuilder";
import { createDebugScene } from "./debug/debugScene";
import { initDebugUI } from "./debug/debugUI";
import { loadSpec } from "./loader/loader";
import { materialFactory } from "./materials/materialFactory";
import type { BuiltModule } from "./types/schema";
import { VFXSystem } from "./vfx/vfxSystem";

// ─── State ───────────────────────────────────────────────────

let currentBuilt: BuiltModule | null = null;
let autoRotate = true;
let connectorHelpers: THREE.Object3D[] = [];
let anchorHelpers: THREE.Object3D[] = [];
let showConnectors = false;
let showAnchors = false;
let globalTime = 0;

// ─── Systems ─────────────────────────────────────────────────

let animSystem: AnimationSystem;
let vfxSystem: VFXSystem;
let builder: ModuleBuilder;

// ─── Camera orbit state ─────────────────────────────────────

const orbitState = {
  theta: 0.5,
  phi: 1.0,
  radius: 7,
  target: new THREE.Vector3(0, 0.5, 0),
  isDragging: false,
  lastX: 0,
  lastY: 0,
};

// ─── Public entry ────────────────────────────────────────────

export async function startViewer(): Promise<void> {
  const container = document.getElementById("app")!;
  const infoBar = document.getElementById("info-bar")!;

  // Show the debug panel (hidden by default in HTML for embedded/game mode)
  const debugPanel = document.getElementById("debug-panel");
  if (debugPanel) debugPanel.style.display = "";

  // Create the Three.js scene
  const ctx = createDebugScene(container);
  const { renderer, scene, camera } = ctx;

  // Load the spec
  infoBar.textContent = "Loading spec...";
  const { spec, validation } = await loadSpec("./starforge_modules_v1.json");

  if (validation.errors.length > 0) {
    infoBar.textContent = `⚠ ${validation.errors.length} validation errors (see console)`;
  }

  // Initialize materials from spec
  materialFactory.init(spec);

  // Create systems
  builder = new ModuleBuilder(spec);
  animSystem = new AnimationSystem();
  vfxSystem = new VFXSystem(scene);

  // ── Module switching ─────────────────────────────────────

  function loadModule(code: string, tier: number, archetype?: string): void {
    // Remove old
    if (currentBuilt) {
      scene.remove(currentBuilt.group);
      currentBuilt.group.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry)
          (obj as THREE.Mesh).geometry.dispose();
      });
    }
    clearHelpers(scene);
    animSystem.clear();
    vfxSystem.clear();

    // Build new
    currentBuilt = builder.build(code, tier, archetype);
    if (!currentBuilt) {
      infoBar.textContent = `Failed to build ${code} tier ${tier}`;
      return;
    }

    scene.add(currentBuilt.group);

    // Register animations + VFX
    animSystem.register(currentBuilt);
    vfxSystem.register(currentBuilt);

    // Adjust camera to module bounds
    fitCamera(currentBuilt.group, camera);

    // Update info
    const partCount = currentBuilt.parts.size;
    let triCount = 0;
    currentBuilt.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        const idx = mesh.geometry.index;
        triCount += idx
          ? idx.count / 3
          : mesh.geometry.attributes.position.count / 3;
      }
    });
    infoBar.textContent = `${code} T${tier} | ${partCount} parts | ${Math.round(triCount)} tris`;

    // Rebuild helpers if toggled
    if (showConnectors) toggleConnectors(true, scene);
    if (showAnchors) toggleAnchors(true, scene);
  }

  // ── Debug UI ─────────────────────────────────────────────

  initDebugUI(builder, {
    onModuleChange: loadModule,
    onToggleConnectors: (show) => {
      showConnectors = show;
      toggleConnectors(show, scene);
    },
    onToggleAnchors: (show) => {
      showAnchors = show;
      toggleAnchors(show, scene);
    },
    onToggleWireframe: (enabled) => {
      materialFactory.setWireframe(enabled);
    },
    onToggleAutoRotate: (enabled) => {
      autoRotate = enabled;
    },
  });

  // ── Interaction ──────────────────────────────────────────

  renderer.domElement.addEventListener("pointerdown", (e) => {
    orbitState.isDragging = true;
    orbitState.lastX = e.clientX;
    orbitState.lastY = e.clientY;
  });

  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!orbitState.isDragging) return;
    const dx = e.clientX - orbitState.lastX;
    const dy = e.clientY - orbitState.lastY;
    orbitState.theta -= dx * 0.005;
    orbitState.phi = Math.max(
      0.2,
      Math.min(Math.PI - 0.2, orbitState.phi - dy * 0.005),
    );
    orbitState.lastX = e.clientX;
    orbitState.lastY = e.clientY;
  });

  renderer.domElement.addEventListener("pointerup", () => {
    orbitState.isDragging = false;
  });

  renderer.domElement.addEventListener("wheel", (e) => {
    orbitState.radius = Math.max(
      1,
      Math.min(30, orbitState.radius + e.deltaY * 0.01),
    );
  });

  // Click to trigger animations/VFX
  renderer.domElement.addEventListener("click", () => {
    animSystem.fireClick();
    vfxSystem.fireClick();
  });

  // ── Render loop ──────────────────────────────────────────

  const clock = new THREE.Clock();

  function animate(): void {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.05);
    globalTime += dt;

    // Auto-rotation
    if (autoRotate && !orbitState.isDragging) {
      orbitState.theta += 0.15 * dt;
    }

    // Update camera from orbit state
    camera.position.set(
      orbitState.target.x +
        orbitState.radius *
          Math.sin(orbitState.phi) *
          Math.cos(orbitState.theta),
      orbitState.target.y + orbitState.radius * Math.cos(orbitState.phi),
      orbitState.target.z +
        orbitState.radius *
          Math.sin(orbitState.phi) *
          Math.sin(orbitState.theta),
    );
    camera.lookAt(orbitState.target);

    // Update systems
    animSystem.update(dt, globalTime);
    vfxSystem.update(dt);

    renderer.render(scene, camera);
  }

  animate();
}

// ─── Helpers ─────────────────────────────────────────────────

function fitCamera(group: THREE.Group, camera: THREE.PerspectiveCamera): void {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  orbitState.target.copy(center);
  orbitState.radius = maxDim * 2.2;
  orbitState.phi = 1.0;
}

function clearHelpers(scene: THREE.Scene): void {
  for (const h of connectorHelpers) scene.remove(h);
  for (const h of anchorHelpers) scene.remove(h);
  connectorHelpers = [];
  anchorHelpers = [];
}

function toggleConnectors(show: boolean, scene: THREE.Scene): void {
  for (const h of connectorHelpers) scene.remove(h);
  connectorHelpers = [];

  if (!show || !currentBuilt) return;

  const connectorColors: Record<string, number> = {
    powerIn: 0xff3333,
    powerOut: 0xff8833,
    pipeIn: 0x3388ff,
    pipeOut: 0x33bbff,
    dataIn: 0x33ff88,
    dataOut: 0x88ff33,
  };

  for (const [name, obj] of currentBuilt.connectors) {
    const kind = (obj.userData.kind as string) ?? "powerIn";
    const color = connectorColors[kind] ?? 0xffffff;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color, wireframe: true }),
    );
    const worldPos = new THREE.Vector3();
    obj.getWorldPosition(worldPos);
    marker.position.copy(worldPos);
    marker.name = `helper_connector_${name}`;
    scene.add(marker);
    connectorHelpers.push(marker);
  }
}

function toggleAnchors(show: boolean, scene: THREE.Scene): void {
  for (const h of anchorHelpers) scene.remove(h);
  anchorHelpers = [];

  if (!show || !currentBuilt) return;

  for (const [name, obj] of currentBuilt.anchors) {
    const axesHelper = new THREE.AxesHelper(0.15);
    const worldPos = new THREE.Vector3();
    obj.getWorldPosition(worldPos);
    axesHelper.position.copy(worldPos);
    axesHelper.name = `helper_anchor_${name}`;
    scene.add(axesHelper);
    anchorHelpers.push(axesHelper);
  }
}
