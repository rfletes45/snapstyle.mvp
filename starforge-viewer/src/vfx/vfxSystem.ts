/**
 * VFXSystem — lightweight particle/effect system using billboards and points.
 * Covers all VFX types from the JSON spec.
 * Each effect type is a simple particle emitter with pooled sprites.
 */
import * as THREE from "three";
import type { BuiltModule, VfxDef } from "../types/schema";

// ─── Particle ────────────────────────────────────────────────

interface Particle {
  alive: boolean;
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: number;
  startSize: number;
  endSize: number;
  color: THREE.Color;
  alpha: number;
}

// ─── Emitter ─────────────────────────────────────────────────

interface Emitter {
  def: VfxDef;
  anchor: THREE.Object3D | null;
  particles: Particle[];
  points: THREE.Points;
  triggerKey: string;
  intervalTimer: number;
  burstPending: boolean;
  active: boolean;
}

// ─── Main VFX System ─────────────────────────────────────────

export class VFXSystem {
  private emitters: Emitter[] = [];
  private scene: THREE.Scene;
  private readonly MAX_PARTICLES_PER_EMITTER = 64;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Register VFX from a built module.
   */
  register(built: BuiltModule): void {
    for (let i = 0; i < built.vfx.length; i++) {
      const vfxDef = built.vfx[i];

      // Resolve anchor
      let anchor: THREE.Object3D | null = null;
      if (vfxDef.anchor) {
        anchor = built.anchors.get(vfxDef.anchor) ?? null;
        if (!anchor) {
          // Try parts
          anchor = built.parts.get(vfxDef.anchor) ?? null;
        }
        if (!anchor) {
          // Try finding in the group hierarchy
          anchor = findDescendant(built.group, `anchor_${vfxDef.anchor}`);
        }
      }
      if (!anchor) {
        anchor = built.group; // Fallback to module root
      }

      const emitter = this.createEmitter(
        vfxDef,
        anchor,
        `${built.moduleDef.code}_vfx_${i}`,
      );
      this.emitters.push(emitter);
    }
  }

  private createEmitter(
    def: VfxDef,
    anchor: THREE.Object3D,
    key: string,
  ): Emitter {
    const maxP = this.MAX_PARTICLES_PER_EMITTER;

    // Create particle geometry (points buffer)
    const positions = new Float32Array(maxP * 3);
    const colors = new Float32Array(maxP * 4);
    const sizes = new Float32Array(maxP);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const color = this.getVfxColor(def);
    const material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.name = `vfx_${def.type}`;
    points.frustumCulled = false;
    this.scene.add(points);

    // Initialize particle pool
    const particles: Particle[] = Array.from({ length: maxP }, () => ({
      alive: false,
      life: 0,
      maxLife: 0,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      size: 0.02,
      startSize: 0.02,
      endSize: 0.01,
      color: color.clone(),
      alpha: 1,
    }));

    const interval = (def.params?.interval as number) ?? 5;

    return {
      def,
      anchor,
      particles,
      points,
      triggerKey: key,
      intervalTimer: def.trigger === "interval" ? interval : 0,
      burstPending: def.trigger === "always",
      active: def.trigger === "always",
    };
  }

  /** Fire a click event — triggers onClick/onTap VFX. */
  fireClick(): void {
    for (const em of this.emitters) {
      if (em.def.trigger === "onClick" || em.def.trigger === "onTap") {
        em.burstPending = true;
      }
    }
  }

  /** Fire a collect event. */
  fireCollect(): void {
    for (const em of this.emitters) {
      if (em.def.trigger === "onCollect") {
        em.burstPending = true;
      }
    }
  }

  /** Update all emitters. */
  update(dt: number): void {
    for (const em of this.emitters) {
      // Handle interval triggers
      if (em.def.trigger === "interval") {
        em.intervalTimer -= dt;
        if (em.intervalTimer <= 0) {
          em.burstPending = true;
          em.intervalTimer = (em.def.params?.interval as number) ?? 5;
        }
      }

      // Spawn particles if burst pending
      if (em.burstPending || em.active) {
        this.spawnParticles(em);
        if (em.def.trigger !== "always") {
          em.burstPending = false;
        }
      }

      // Update particles
      this.updateParticles(em, dt);

      // Sync buffer
      this.syncBuffer(em);
    }
  }

  private spawnParticles(em: Emitter): void {
    const p = em.def.params;
    const burst = (p?.burst as number) ?? 8;
    const lifeRange = (p?.life as [number, number]) ?? [0.2, 0.5];
    const speedRange = (p?.speed as [number, number]) ?? [0.5, 1.5];
    const sizeRange = (p?.size as [number, number]) ?? [0.01, 0.03];
    const spread = (p?.spread as number) ?? 1.0;
    const gravity = (p?.gravity as number) ?? 0;

    // Get world position of anchor
    const worldPos = new THREE.Vector3();
    if (em.anchor) {
      em.anchor.getWorldPosition(worldPos);
    }

    let spawned = 0;
    for (let i = 0; i < em.particles.length && spawned < burst; i++) {
      const particle = em.particles[i];
      if (particle.alive) continue;

      particle.alive = true;
      particle.maxLife =
        lifeRange[0] + Math.random() * (lifeRange[1] - lifeRange[0]);
      particle.life = particle.maxLife;
      particle.position.copy(worldPos);

      // Random velocity
      const speed =
        speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
      particle.velocity
        .set(
          (Math.random() - 0.5) * spread,
          Math.random() * 0.6 + 0.2,
          (Math.random() - 0.5) * spread,
        )
        .normalize()
        .multiplyScalar(speed);

      // Apply gravity direction hint
      if (gravity < 0) {
        particle.velocity.y = Math.abs(particle.velocity.y) * 0.8;
      }

      particle.startSize =
        sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
      particle.endSize = particle.startSize * 0.2;
      particle.size = particle.startSize;
      particle.alpha = 1;

      // VFX-specific behavior
      this.applyVfxBehavior(em.def.type, particle, p);

      spawned++;
    }
  }

  private applyVfxBehavior(
    type: string,
    particle: Particle,
    p: Record<string, unknown>,
  ): void {
    switch (type) {
      case "sparks":
      case "microSparks":
        particle.color.set(0xffaa33);
        particle.velocity.y += 1.0;
        break;
      case "smoke":
      case "neonSmoke":
        particle.color.set(type === "neonSmoke" ? 0xff33ff : 0x888888);
        particle.velocity.set(
          (Math.random() - 0.5) * 0.2,
          0.3 + Math.random() * 0.4,
          (Math.random() - 0.5) * 0.2,
        );
        particle.startSize = 0.04;
        particle.endSize = 0.12;
        break;
      case "steamLeak":
      case "steam":
      case "valvePuff":
        particle.color.set(0xcccccc);
        particle.velocity.multiplyScalar(0.6);
        break;
      case "debrisCubes":
      case "scrapChunks":
        particle.color.set(0x666666);
        break;
      case "pingWave":
        particle.color.set(0x31d6ff);
        particle.startSize = 0.05;
        particle.endSize = 0.4;
        break;
      case "lightningArcs":
        particle.color.set(0x31d6ff);
        particle.velocity.set(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
        );
        break;
      case "stampFlash":
      case "grabFlash":
        particle.color.set(0xffffff);
        particle.maxLife = 0.08;
        particle.life = 0.08;
        particle.startSize = 0.1;
        break;
      case "emberDrift":
        particle.color.set(0xff6633);
        particle.velocity.set(
          (Math.random() - 0.5) * 0.3,
          0.2 + Math.random() * 0.3,
          (Math.random() - 0.5) * 0.3,
        );
        break;
      case "inwardDust":
      case "spiralParticles":
        particle.color.set(0xb35cff);
        // Pull toward center
        particle.velocity.negate().multiplyScalar(0.3);
        break;
      case "laserBeam":
        particle.color.set(0xff3300);
        particle.startSize = 0.01;
        break;
      case "dataPackets":
        particle.color.set(0x31d6ff);
        particle.startSize = 0.015;
        break;
      case "magnetBeam":
        particle.color.set(0x31d6ff);
        particle.startSize = 0.02;
        particle.velocity.set(0, -0.3, -0.5);
        break;
      case "dustPuff":
      case "paperDust":
        particle.color.set(0xaa9977);
        particle.velocity.multiplyScalar(0.3);
        break;
      case "nanoGlitter":
        particle.color.set(0x88ddff);
        particle.startSize = 0.005;
        particle.velocity.multiplyScalar(0.2);
        break;
      case "receiptPaper":
        particle.color.set(0xeeeedd);
        particle.velocity.set(0, -0.2, 0.1);
        break;
      case "cutLineDecal":
        particle.color.set(0xff9a3c);
        particle.startSize = 0.02;
        break;
      default:
        // Unknown VFX type — use generic white particles
        particle.color.set(0xffffff);
        break;
    }

    // Apply color override from params
    const colorParam = p?.color as string | undefined;
    if (colorParam) {
      switch (colorParam) {
        case "cyan":
          particle.color.set(0x31d6ff);
          break;
        case "orange":
          particle.color.set(0xff9a3c);
          break;
        case "magenta":
          particle.color.set(0xb35cff);
          break;
        default:
          particle.color.set(colorParam);
          break;
      }
    }
  }

  private updateParticles(em: Emitter, dt: number): void {
    const gravity = (em.def.params?.gravity as number) ?? -2;

    for (const particle of em.particles) {
      if (!particle.alive) continue;

      particle.life -= dt;
      if (particle.life <= 0) {
        particle.alive = false;
        continue;
      }

      // Apply gravity
      particle.velocity.y += gravity * dt;

      // Move
      particle.position.addScaledVector(particle.velocity, dt);

      // Interpolate size
      const t = 1 - particle.life / particle.maxLife;
      particle.size =
        particle.startSize + (particle.endSize - particle.startSize) * t;

      // Fade alpha
      particle.alpha = particle.life / particle.maxLife;
    }
  }

  private syncBuffer(em: Emitter): void {
    const positions = em.points.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const colors = em.points.geometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute;
    const sizes = em.points.geometry.getAttribute(
      "size",
    ) as THREE.BufferAttribute;

    for (let i = 0; i < em.particles.length; i++) {
      const p = em.particles[i];
      if (p.alive) {
        positions.setXYZ(i, p.position.x, p.position.y, p.position.z);
        colors.setXYZW(i, p.color.r, p.color.g, p.color.b, p.alpha);
        sizes.setX(i, p.size);
      } else {
        // Move offscreen
        positions.setXYZ(i, 0, -100, 0);
        sizes.setX(i, 0);
      }
    }

    positions.needsUpdate = true;
    colors.needsUpdate = true;
    sizes.needsUpdate = true;
  }

  private getVfxColor(def: VfxDef): THREE.Color {
    const c = def.params?.color as string | undefined;
    switch (c) {
      case "cyan":
        return new THREE.Color(0x31d6ff);
      case "orange":
        return new THREE.Color(0xff9a3c);
      case "magenta":
        return new THREE.Color(0xb35cff);
      default:
        return new THREE.Color(0xffffff);
    }
  }

  /** Remove all emitters from the scene. */
  clear(): void {
    for (const em of this.emitters) {
      this.scene.remove(em.points);
      em.points.geometry.dispose();
      (em.points.material as THREE.PointsMaterial).dispose();
    }
    this.emitters = [];
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
