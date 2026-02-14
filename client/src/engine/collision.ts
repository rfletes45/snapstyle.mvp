import * as THREE from "three";
import { clamp } from "../utils/math";

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function resolveCircleVsBoxes(position: THREE.Vector3, radius: number, colliders: BoxCollider[]): void {
  // Iterate a few times so corner/overlap cases across multiple colliders settle in one frame.
  for (let pass = 0; pass < 3; pass += 1) {
    let moved = false;
    for (const collider of colliders) {
      const closestX = clamp(position.x, collider.minX, collider.maxX);
      const closestZ = clamp(position.z, collider.minZ, collider.maxZ);
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      const distanceSq = dx * dx + dz * dz;
      const radiusSq = radius * radius;

      if (distanceSq >= radiusSq) {
        continue;
      }

      if (distanceSq > 0.000001) {
        const distance = Math.sqrt(distanceSq);
        const push = (radius - distance) / distance;
        position.x += dx * push;
        position.z += dz * push;
        moved = true;
        continue;
      }

      const pushLeft = Math.abs(position.x - collider.minX);
      const pushRight = Math.abs(collider.maxX - position.x);
      const pushDown = Math.abs(position.z - collider.minZ);
      const pushUp = Math.abs(collider.maxZ - position.z);
      const minPush = Math.min(pushLeft, pushRight, pushDown, pushUp);
      if (minPush === pushLeft) {
        position.x = collider.minX - radius;
      } else if (minPush === pushRight) {
        position.x = collider.maxX + radius;
      } else if (minPush === pushDown) {
        position.z = collider.minZ - radius;
      } else {
        position.z = collider.maxZ + radius;
      }
      moved = true;
    }
    if (!moved) {
      break;
    }
  }
}

export function clampToWorldBounds(position: THREE.Vector3, bounds: WorldBounds): void {
  position.x = clamp(position.x, bounds.minX, bounds.maxX);
  position.z = clamp(position.z, bounds.minZ, bounds.maxZ);
}
