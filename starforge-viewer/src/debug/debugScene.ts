/**
 * DebugScene — sets up the Three.js scene, camera, lights, and fog
 * following the "Tabletop Diorama Sci-Fi Salvage" art direction.
 */
import * as THREE from "three";

export interface DebugSceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
}

export function createDebugScene(container: HTMLElement): DebugSceneContext {
  // ── Renderer ───────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0a0c10, 1);
  container.appendChild(renderer.domElement);

  // ── Scene ──────────────────────────────────────────────────
  const scene = new THREE.Scene();

  // Subtle fog — low density so distant objects stay visible when zoomed out
  scene.fog = new THREE.FogExp2(0x0a0c14, 0.018);

  // ── Camera ─────────────────────────────────────────────────
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
  camera.position.set(4, 4, 6);
  camera.lookAt(0, 0.5, 0);

  // ── Lighting (following art guide) ─────────────────────────

  // 1) Key light — cool directional
  const keyLight = new THREE.DirectionalLight(0xccddff, 2.5);
  keyLight.position.set(5, 8, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  scene.add(keyLight);

  // 2) Rim light — cyan, from behind
  const rimLight = new THREE.DirectionalLight(0x31d6ff, 0.8);
  rimLight.position.set(-4, 3, -6);
  scene.add(rimLight);

  // 3) Warm fill — orange, from below-front
  const fillLight = new THREE.DirectionalLight(0xff9a3c, 0.7);
  fillLight.position.set(2, -1, 4);
  scene.add(fillLight);

  // 4) Ambient — soft base fill
  const ambientLight = new THREE.AmbientLight(0x202838, 0.9);
  scene.add(ambientLight);

  // 5) Hemisphere light for soft sky/ground blend
  const hemiLight = new THREE.HemisphereLight(0x3344aa, 0x151822, 0.6);
  scene.add(hemiLight);

  // ── Ground plane (simple dark grid hint) ───────────────────
  const gridHelper = new THREE.GridHelper(20, 20, 0x1a1e28, 0x0f1118);
  gridHelper.position.y = -0.01;
  scene.add(gridHelper);

  // ── Resize handler ─────────────────────────────────────────
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  return { renderer, scene, camera, container };
}
