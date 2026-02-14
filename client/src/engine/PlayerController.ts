import * as THREE from "three";
import {
  clampToWorldBounds,
  resolveCircleVsBoxes,
  type BoxCollider,
  type WorldBounds,
} from "./collision";

export class PlayerController {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  readonly collisionRadius = 0.6;

  private readonly velocity = new THREE.Vector3();
  private readonly moveSpeed = 4.4;

  // Jump physics.
  private verticalVelocity = 0;
  private readonly jumpImpulse = 6.8;
  private readonly gravity = -18;
  private isGrounded = true;
  private jumpRequested = false;
  private groundY = 0;

  constructor(spawnPosition: THREE.Vector3) {
    this.group = new THREE.Group();
    this.position = this.group.position;
    this.position.copy(spawnPosition);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 1.05, 5, 8),
      new THREE.MeshStandardMaterial({
        color: "#fef3c7",
        roughness: 0.8,
        metalness: 0.05,
      }),
    );
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 1.1;
    this.group.add(body);

    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 0.6),
      new THREE.MeshStandardMaterial({
        color: "#f97316",
        roughness: 0.85,
        metalness: 0.05,
      }),
    );
    shirt.position.y = 1.05;
    shirt.castShadow = true;
    shirt.receiveShadow = true;
    this.group.add(shirt);
  }

  /** Request a jump on next frame (ignored if already airborne). */
  requestJump(): void {
    this.jumpRequested = true;
  }

  update(
    dtSeconds: number,
    input: THREE.Vector2,
    yaw: number,
    colliders: BoxCollider[],
    bounds: WorldBounds,
    getGroundHeight?: (x: number, z: number, currentY?: number) => number,
  ): void {
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const moveDirection = new THREE.Vector3()
      .addScaledVector(right, input.x)
      .addScaledVector(forward, input.y);

    if (moveDirection.lengthSq() > 1) {
      moveDirection.normalize();
    }

    const targetVelocity = moveDirection.multiplyScalar(this.moveSpeed);
    this.velocity.lerp(targetVelocity, 0.18);

    this.position.addScaledVector(this.velocity, dtSeconds);
    resolveCircleVsBoxes(this.position, this.collisionRadius, colliders);
    clampToWorldBounds(this.position, bounds);
    resolveCircleVsBoxes(this.position, this.collisionRadius, colliders);

    // Compute terrain height at current XZ.
    if (getGroundHeight) {
      this.groundY = getGroundHeight(
        this.position.x,
        this.position.z,
        this.position.y,
      );
    }

    // Jump initiation.
    if (this.jumpRequested && this.isGrounded) {
      this.verticalVelocity = this.jumpImpulse;
      this.isGrounded = false;
    }
    this.jumpRequested = false;

    // Apply gravity when airborne.
    if (!this.isGrounded) {
      this.verticalVelocity += this.gravity * dtSeconds;
      this.position.y += this.verticalVelocity * dtSeconds;

      // Landing check.
      if (this.position.y <= this.groundY) {
        this.position.y = this.groundY;
        this.verticalVelocity = 0;
        this.isGrounded = true;
      }
    } else {
      // Grounded: snap to terrain.
      this.position.y = this.groundY;
    }

    const facingVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z);
    if (facingVelocity.lengthSq() > 0.01) {
      const facing = Math.atan2(this.velocity.x, this.velocity.z);
      this.group.rotation.y = THREE.MathUtils.lerp(
        this.group.rotation.y,
        facing,
        0.18,
      );
    }
  }

  getIsGrounded(): boolean {
    return this.isGrounded;
  }

  getHorizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }
}
