import * as THREE from "three";
import { clamp } from "../utils/math";

const EYE_HEIGHT = 1.65;

export class FollowCamera {
  private yaw = 0;
  private pitch = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  getYaw(): number {
    return this.yaw;
  }

  getPitch(): number {
    return this.pitch;
  }

  update(
    playerPosition: THREE.Vector3,
    lookDelta: THREE.Vector2,
    _dtSeconds: number,
  ): void {
    const sensitivity = 0.0038;
    this.yaw -= lookDelta.x * sensitivity;
    this.pitch = clamp(this.pitch - lookDelta.y * sensitivity, -1.2, 1.2);

    // Position camera at player eye level
    this.camera.position.set(
      playerPosition.x,
      playerPosition.y + EYE_HEIGHT,
      playerPosition.z,
    );

    // Look forward in the direction the camera is facing
    const lookTarget = new THREE.Vector3(
      playerPosition.x + Math.sin(this.yaw) * Math.cos(this.pitch),
      playerPosition.y + EYE_HEIGHT + Math.sin(this.pitch),
      playerPosition.z + Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.camera.lookAt(lookTarget);
  }
}
