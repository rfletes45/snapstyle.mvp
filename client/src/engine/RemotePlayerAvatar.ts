import * as THREE from "three";
import type { NetCelebrationRarity, NetFishingState } from "../net/types";

const ICON_BY_STATE: Record<NetFishingState, string> = {
  idle: "",
  casting: "\uD83C\uDFA3",
  waiting: "\u23F3",
  caught: "\u2728",
  fail: "\uD83D\uDCA8"
};

function createIconSprite(): { sprite: THREE.Sprite; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.4, 0.7, 1);
  sprite.position.set(0, 2.9, 0);
  sprite.visible = false;
  return { sprite, canvas, texture };
}

export class RemotePlayerAvatar {
  readonly group: THREE.Group;
  private readonly body: THREE.Mesh;
  private readonly targetPosition = new THREE.Vector3();
  private targetYaw = 0;
  private readonly iconSprite: THREE.Sprite;
  private readonly iconCanvas: HTMLCanvasElement;
  private readonly iconTexture: THREE.CanvasTexture;
  private celebrationTimer = 0;
  private lastFishingState: NetFishingState = "idle";

  constructor(initialPosition: THREE.Vector3) {
    this.group = new THREE.Group();
    this.group.position.copy(initialPosition);
    this.targetPosition.copy(initialPosition);

    this.body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 1.05, 5, 8),
      new THREE.MeshStandardMaterial({ color: "#93c5fd", roughness: 0.78, metalness: 0.06 })
    );
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.position.y = 1.1;
    this.group.add(this.body);

    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 0.6),
      new THREE.MeshStandardMaterial({ color: "#2563eb", roughness: 0.84, metalness: 0.05 })
    );
    vest.position.y = 1.05;
    vest.castShadow = true;
    vest.receiveShadow = true;
    this.group.add(vest);

    const icon = createIconSprite();
    this.iconSprite = icon.sprite;
    this.iconCanvas = icon.canvas;
    this.iconTexture = icon.texture;
    this.group.add(this.iconSprite);
  }

  setTarget(x: number, y: number, z: number, yaw: number): void {
    this.targetPosition.set(x, y, z);
    this.targetYaw = yaw;
  }

  setFishingState(state: NetFishingState): void {
    this.lastFishingState = state;
    if (this.celebrationTimer > 0) {
      return;
    }
    const icon = ICON_BY_STATE[state];
    if (!icon) {
      this.iconSprite.visible = false;
      return;
    }
    this.iconSprite.visible = true;
    const context = this.iconCanvas.getContext("2d");
    if (!context) {
      return;
    }
    context.clearRect(0, 0, this.iconCanvas.width, this.iconCanvas.height);
    context.fillStyle = "rgba(15, 23, 42, 0.72)";
    context.fillRect(0, 0, this.iconCanvas.width, this.iconCanvas.height);
    context.font = "42px Segoe UI Emoji, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.fillText(icon, this.iconCanvas.width / 2, this.iconCanvas.height / 2);
    this.iconTexture.needsUpdate = true;
  }

  triggerCelebration(rarity: NetCelebrationRarity): void {
    this.celebrationTimer = rarity === "mythic" ? 1.9 : 1.5;
    this.iconSprite.visible = true;
    const context = this.iconCanvas.getContext("2d");
    if (!context) {
      return;
    }
    context.clearRect(0, 0, this.iconCanvas.width, this.iconCanvas.height);
    context.fillStyle = "rgba(15, 23, 42, 0.78)";
    context.fillRect(0, 0, this.iconCanvas.width, this.iconCanvas.height);
    context.font = "34px Segoe UI Emoji, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = rarity === "mythic" ? "#d8b4fe" : "#f59e0b";
    context.fillText(rarity === "mythic" ? "\u2728" : "\u2b50", this.iconCanvas.width / 2, this.iconCanvas.height / 2);
    this.iconTexture.needsUpdate = true;
  }

  update(dtSeconds: number): void {
    const smoothing = 1 - Math.pow(0.0008, dtSeconds);
    this.group.position.lerp(this.targetPosition, smoothing);
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.targetYaw, 0.18);
    if (this.celebrationTimer > 0) {
      this.celebrationTimer = Math.max(0, this.celebrationTimer - dtSeconds);
      if (this.celebrationTimer <= 0) {
        this.setFishingState(this.lastFishingState);
      }
    }
  }

  dispose(): void {
    const bodyMaterial = this.body.material;
    this.body.geometry.dispose();
    if (Array.isArray(bodyMaterial)) {
      for (const material of bodyMaterial) {
        material.dispose();
      }
    } else {
      bodyMaterial.dispose();
    }
    const spriteMaterial = this.iconSprite.material as THREE.SpriteMaterial;
    spriteMaterial.map?.dispose();
    spriteMaterial.dispose();
  }
}
