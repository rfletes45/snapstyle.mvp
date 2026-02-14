/**
 * AnimationSystem — updates all animation types each frame.
 * Supports: rotate, translate, swing, bob, orbit, followOrbit, uvScroll,
 *           pulseEmissive, chaseEmissive, blinkRandom, flicker,
 *           shaderTime, vibrate, extend, sway, tiltToVector, bank.
 */
import * as THREE from "three";
import type { AnimationDef, BuiltModule, Vec3 } from "../types/schema";
import { TriggerManager } from "./triggers";

interface AnimState {
  def: AnimationDef;
  target: THREE.Object3D | null;
  triggerKey: string;
  /** Original position/rotation for restoring after transient anims */
  origPos?: THREE.Vector3;
  origRot?: THREE.Euler;
  /** Per-instance state */
  elapsed: number;
  phase: number;
  /** For blinkRandom */
  blinkTimer: number;
  blinkOn: boolean;
  /** For chaseEmissive */
  chaseIndex: number;
}

export class AnimationSystem {
  private anims: AnimState[] = [];
  private triggerMgr = new TriggerManager();
  private rng: () => number;

  constructor() {
    // Simple mulberry32 seeded prng
    let s = 12345;
    this.rng = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Register all animations from a built module.
   */
  register(built: BuiltModule): void {
    for (let i = 0; i < built.animations.length; i++) {
      const def = built.animations[i];
      const target = this.resolveTarget(def.target, built);

      if (!target) {
        console.warn(
          `AnimationSystem: target "${def.target}" not found in module ${built.moduleDef.code}`,
        );
        continue;
      }

      const triggerKey = `${built.moduleDef.code}_${i}_${def.trigger}`;
      this.triggerMgr.register(triggerKey, def.trigger, def.params);

      this.anims.push({
        def,
        target,
        triggerKey,
        origPos: target.position.clone(),
        origRot: target.rotation.clone(),
        elapsed: 0,
        phase: (def.params?.phase as number) ?? this.rng() * Math.PI * 2,
        blinkTimer: 0,
        blinkOn: true,
        chaseIndex: 0,
      });
    }
  }

  private resolveTarget(
    targetName: string,
    built: BuiltModule,
  ): THREE.Object3D | null {
    // Direct part lookup
    if (built.parts.has(targetName)) {
      return built.parts.get(targetName)!;
    }

    // Dotted name: "dishes.dish" means find within the "dishes" group
    if (targetName.includes(".")) {
      const [groupName, childName] = targetName.split(".");
      const group = built.parts.get(groupName);
      if (group) {
        const child = findDescendant(group, childName);
        if (child) return child;
      }
    }

    // Prefab instance target "drones"
    const prefabTarget = findDescendant(built.group, targetName);
    if (prefabTarget) return prefabTarget;

    // Anchor lookup
    if (built.anchors.has(targetName)) {
      return built.anchors.get(targetName)!;
    }

    return null;
  }

  /** Fire click event on all animations. */
  fireClick(): void {
    this.triggerMgr.fireClick();
  }

  /** Update all animations. */
  update(dt: number, globalTime: number): void {
    this.triggerMgr.update(dt);

    for (const anim of this.anims) {
      if (
        !this.triggerMgr.isActive(anim.triggerKey) &&
        anim.def.trigger !== "always"
      ) {
        // For transient anims, ease back to original
        if (anim.def.trigger === "onClick" || anim.def.trigger === "onTap") {
          this.easeBack(anim, dt);
        }
        continue;
      }

      anim.elapsed += dt;
      const t = globalTime;
      const p = anim.def.params;

      switch (anim.def.type) {
        case "rotate":
          this.animRotate(anim, dt, p);
          break;
        case "translate":
          this.animTranslate(anim, dt, p);
          break;
        case "swing":
          this.animSwing(anim, dt, p);
          break;
        case "bob":
          this.animBob(anim, t, p);
          break;
        case "orbit":
        case "followOrbit":
          this.animOrbit(anim, t, p);
          break;
        case "uvScroll":
          this.animUvScroll(anim, dt, p);
          break;
        case "pulseEmissive":
          this.animPulseEmissive(anim, t, p);
          break;
        case "chaseEmissive":
          this.animChaseEmissive(anim, dt, p);
          break;
        case "blinkRandom":
          this.animBlinkRandom(anim, dt, p);
          break;
        case "flicker":
          this.animFlicker(anim, t, p);
          break;
        case "shaderTime":
          // For modules with custom shaders – store time in userData
          if (anim.target) anim.target.userData.shaderTime = t;
          break;
        case "vibrate":
          this.animVibrate(anim, t, p);
          break;
        case "extend":
          this.animExtend(anim, dt, p);
          break;
        case "sway":
          this.animSway(anim, t, p);
          break;
        case "tiltToVector":
          this.animTiltToVector(anim, dt, p);
          break;
        case "bank":
          this.animBank(anim, t, p);
          break;
        default:
          console.warn(
            `AnimationSystem: unimplemented animation type "${anim.def.type}"`,
          );
          break;
      }
    }
  }

  // ── Animation Handlers ─────────────────────────────────────

  private animRotate(
    anim: AnimState,
    dt: number,
    p: Record<string, unknown>,
  ): void {
    const axis = (p.axis as Vec3) ?? [0, 1, 0];
    const speed = (p.speed as number) ?? 1;
    if (anim.target) {
      if (axis[0]) anim.target.rotation.x += speed * dt * axis[0];
      if (axis[1]) anim.target.rotation.y += speed * dt * axis[1];
      if (axis[2]) anim.target.rotation.z += speed * dt * axis[2];
    }
  }

  private animTranslate(
    anim: AnimState,
    _dt: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target || !anim.origPos) return;
    const by = (p.by as Vec3) ?? [0, 0, 0];
    const duration = (p.duration as number) ?? 0.2;
    const progress = Math.min(anim.elapsed / duration, 1);
    const ease = this.easeOutQuad(progress);
    anim.target.position.set(
      anim.origPos.x + by[0] * ease,
      anim.origPos.y + by[1] * ease,
      anim.origPos.z + by[2] * ease,
    );
  }

  private animSwing(
    anim: AnimState,
    _dt: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target || !anim.origRot) return;
    const axis = (p.axis as Vec3) ?? [0, 0, 1];
    const angle = (p.angle as number) ?? 0.3;
    const duration = (p.duration as number) ?? 0.15;
    const progress = Math.min(anim.elapsed / duration, 1);
    const ease = this.easeOutQuad(progress);
    const a = angle * ease;
    anim.target.rotation.set(
      anim.origRot.x + a * axis[0],
      anim.origRot.y + a * axis[1],
      anim.origRot.z + a * axis[2],
    );
  }

  private animBob(
    anim: AnimState,
    t: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target || !anim.origPos) return;
    const amplitude = (p.amplitude as number) ?? 0.05;
    const freq = (p.freq as number) ?? 2;
    const axis = (p.axis as Vec3) ?? [0, 1, 0];
    const offset = Math.sin(t * freq * Math.PI * 2 + anim.phase) * amplitude;
    anim.target.position.set(
      anim.origPos.x + offset * axis[0],
      anim.origPos.y + offset * axis[1],
      anim.origPos.z + offset * axis[2],
    );
  }

  private animOrbit(
    anim: AnimState,
    t: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target) return;
    const center = (p.center as Vec3) ?? [0, 0, 0];
    const radius = (p.radius as number) ?? 0.5;
    const speed = (p.speed as number) ?? 1;
    const angle = t * speed + anim.phase;
    anim.target.position.set(
      center[0] + Math.cos(angle) * radius,
      center[1],
      center[2] + Math.sin(angle) * radius,
    );
  }

  private animUvScroll(
    _anim: AnimState,
    dt: number,
    p: Record<string, unknown>,
  ): void {
    // UV scrolling requires custom shader or texture offset
    // For now, store offset in userData
    if (_anim.target) {
      const speed = (p.speed as [number, number]) ?? [0.5, 0];
      if (!_anim.target.userData.uvOffset)
        _anim.target.userData.uvOffset = [0, 0];
      _anim.target.userData.uvOffset[0] += speed[0] * dt;
      _anim.target.userData.uvOffset[1] += speed[1] * dt;

      // If the target is a mesh with a map, offset the texture
      const mesh = _anim.target as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.map) {
          mat.map.offset.set(
            _anim.target.userData.uvOffset[0] % 1,
            _anim.target.userData.uvOffset[1] % 1,
          );
        }
      }
    }
  }

  private animPulseEmissive(
    anim: AnimState,
    t: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target) return;
    const mesh = anim.target as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat?.emissive) return;

    const min = (p.min as number) ?? 0.1;
    const max = (p.max as number) ?? 1.0;
    const freq = (p.freq as number) ?? 1.0;
    const phase = (p.phase as number) ?? anim.phase;
    const val =
      min +
      (max - min) * (0.5 + 0.5 * Math.sin(t * freq * Math.PI * 2 + phase));
    mat.emissiveIntensity = val;
  }

  private animChaseEmissive(
    anim: AnimState,
    dt: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target) return;
    const speed = (p.speed as number) ?? 2;
    const trailLength = (p.trailLength as number) ?? 3;
    anim.chaseIndex += speed * dt;

    // Chase emissive cycles through child meshes
    const parent = anim.target;
    const children = parent.children.filter((c) => (c as THREE.Mesh).isMesh);
    for (let i = 0; i < children.length; i++) {
      const mesh = children[i] as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat?.emissive) continue;
      const dist = Math.abs(
        (i - (anim.chaseIndex % children.length) + children.length) %
          children.length,
      );
      mat.emissiveIntensity =
        dist < trailLength ? 1.0 - dist / trailLength : 0.1;
    }
  }

  private animBlinkRandom(
    anim: AnimState,
    dt: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target) return;
    const mesh = anim.target as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat?.emissive) return;

    anim.blinkTimer -= dt;
    if (anim.blinkTimer <= 0) {
      anim.blinkOn = !anim.blinkOn;
      const onTime = (p.onTime as [number, number]) ?? [0.3, 1.0];
      const offTime = (p.offTime as [number, number]) ?? [0.1, 0.4];
      const range = anim.blinkOn ? onTime : offTime;
      anim.blinkTimer = range[0] + this.rng() * (range[1] - range[0]);
    }
    mat.emissiveIntensity = anim.blinkOn
      ? ((p.intensity as number) ?? 1.0)
      : 0.05;
  }

  private animFlicker(
    anim: AnimState,
    t: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target) return;
    const mesh = anim.target as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat?.emissive) return;

    const freq = (p.freq as number) ?? 8;
    const min = (p.min as number) ?? 0.3;
    const max = (p.max as number) ?? 1.0;
    // Noise-like flicker using multiple sine waves
    const v =
      Math.sin(t * freq * 6.28) * 0.3 +
      Math.sin(t * freq * 2.71 * 6.28 + 1.3) * 0.3 +
      Math.sin(t * freq * 4.37 * 6.28 + 2.7) * 0.4;
    mat.emissiveIntensity = min + (max - min) * (0.5 + 0.5 * v);
  }

  private animVibrate(
    anim: AnimState,
    t: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target || !anim.origPos) return;
    const amplitude = (p.amplitude as number) ?? 0.003;
    const freq = (p.freq as number) ?? 20;
    const offset = Math.sin(t * freq * 6.28) * amplitude;
    anim.target.position.set(
      anim.origPos.x + offset * (0.5 + 0.5 * Math.sin(t * 3.7)),
      anim.origPos.y + offset * (0.5 + 0.5 * Math.cos(t * 4.3)),
      anim.origPos.z,
    );
  }

  private animExtend(
    anim: AnimState,
    _dt: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target) return;
    const axis = (p.axis as Vec3) ?? [0, 1, 0];
    const amount = (p.amount as number) ?? 0.1;
    const duration = (p.duration as number) ?? 0.5;
    const progress = Math.min(anim.elapsed / duration, 1);
    const ease = this.easeOutQuad(progress);
    anim.target.scale.set(
      1 + axis[0] * amount * ease,
      1 + axis[1] * amount * ease,
      1 + axis[2] * amount * ease,
    );
  }

  private animSway(
    anim: AnimState,
    t: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target || !anim.origRot) return;
    const axis = (p.axis as Vec3) ?? [0, 0, 1];
    const angle = (p.angle as number) ?? 0.1;
    const freq = (p.freq as number) ?? 0.5;
    const a = Math.sin(t * freq * 6.28 + anim.phase) * angle;
    anim.target.rotation.set(
      anim.origRot.x + a * axis[0],
      anim.origRot.y + a * axis[1],
      anim.origRot.z + a * axis[2],
    );
  }

  private animTiltToVector(
    anim: AnimState,
    dt: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target) return;
    const targetVec = (p.target as Vec3) ?? [0, 1, 0];
    const speed = (p.speed as number) ?? 1;
    const dir = new THREE.Vector3(
      targetVec[0],
      targetVec[1],
      targetVec[2],
    ).normalize();
    const current = new THREE.Vector3(0, 1, 0).applyQuaternion(
      anim.target.quaternion,
    );
    const q = new THREE.Quaternion().setFromUnitVectors(current, dir);
    anim.target.quaternion.slerp(
      anim.target.quaternion.clone().multiply(q),
      Math.min(speed * dt, 1),
    );
  }

  private animBank(
    anim: AnimState,
    t: number,
    p: Record<string, unknown>,
  ): void {
    if (!anim.target || !anim.origRot) return;
    const maxAngle = (p.maxAngle as number) ?? 0.3;
    const axis = (p.axis as Vec3) ?? [0, 0, 1];
    const a = Math.sin(t * 1.2 + anim.phase) * maxAngle;
    anim.target.rotation.set(
      anim.origRot.x + a * axis[0],
      anim.origRot.y + a * axis[1],
      anim.origRot.z + a * axis[2],
    );
  }

  // ── Easing helpers ─────────────────────────────────────────

  private easeBack(anim: AnimState, dt: number): void {
    if (!anim.target || !anim.origPos || !anim.origRot) return;
    const speed = 8; // Spring-back speed
    anim.target.position.lerp(anim.origPos, Math.min(speed * dt, 1));
    // Euler lerp approximation
    anim.target.rotation.x +=
      (anim.origRot.x - anim.target.rotation.x) * Math.min(speed * dt, 1);
    anim.target.rotation.y +=
      (anim.origRot.y - anim.target.rotation.y) * Math.min(speed * dt, 1);
    anim.target.rotation.z +=
      (anim.origRot.z - anim.target.rotation.z) * Math.min(speed * dt, 1);
    // Reset elapsed so re-trigger starts fresh
    anim.elapsed = 0;
  }

  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /** Clear all registered animations */
  clear(): void {
    this.anims = [];
  }
}

function findDescendant(
  root: THREE.Object3D,
  name: string,
): THREE.Object3D | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findDescendant(child, name);
    if (found) return found;
  }
  return null;
}
