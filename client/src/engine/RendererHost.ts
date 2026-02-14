import * as THREE from "three";
import type { QualityPreset } from "../data/quality";

export class RendererHost {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly clock: THREE.Clock;
  private elapsedSeconds = 0;
  private rafId = 0;
  private rafPaused = false;

  constructor(private readonly mountPoint: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#8ecae6");

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, 6, -8);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    mountPoint.appendChild(this.renderer.domElement);
    this.clock = new THREE.Clock();

    window.addEventListener("resize", this.handleResize);
  }

  start(update: (dtSeconds: number) => void): void {
    const tick = (): void => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      if (!this.rafPaused) {
        this.elapsedSeconds += dt;
        update(dt);
        this.renderer.render(this.scene, this.camera);
      }
      this.rafId = window.requestAnimationFrame(tick);
    };
    tick();
  }

  step(update: (dtSeconds: number) => void, dtSeconds: number): void {
    const dt = Math.min(Math.max(dtSeconds, 0), 0.1);
    this.elapsedSeconds += dt;
    update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  setRafPaused(paused: boolean): void {
    this.rafPaused = paused;
  }

  stop(): void {
    if (this.rafId !== 0) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
    this.mountPoint.removeChild(this.renderer.domElement);
  }

  private readonly handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  applyQuality(preset: QualityPreset): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.maxPixelRatio));
    this.renderer.shadowMap.enabled = preset.shadowsEnabled;
    this.camera.far = preset.renderFar;
    this.camera.updateProjectionMatrix();
  }

  getDrawCalls(): number {
    return this.renderer.info.render.calls;
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }
}
