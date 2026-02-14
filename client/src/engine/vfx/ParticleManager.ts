import * as THREE from "three";
import type { Rarity } from "../../game/types";

interface Particle {
  alive: boolean;
  life: number;
  maxLife: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  drag: number;
}

interface BurstConfig {
  count: number;
  speed: number;
  lifetime: number;
  verticalBoost: number;
  drag?: number;
}

export class ParticleManager {
  readonly points: THREE.Points;

  private readonly particles: Particle[];
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly geometry: THREE.BufferGeometry;

  private enabled = true;
  private maxParticles: number;

  constructor(maxParticles = 120) {
    this.maxParticles = maxParticles;
    this.particles = [];
    this.positions = new Float32Array(maxParticles * 3);
    this.colors = new Float32Array(maxParticles * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3),
    );

    const material = new THREE.PointsMaterial({
      size: 0.2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;

    for (let i = 0; i < maxParticles; i += 1) {
      this.particles.push({
        alive: false,
        life: 0,
        maxLife: 1,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        color: new THREE.Color("#ffffff"),
        drag: 0.92,
      });
      this.setInactive(i);
    }
  }

  setBudget(maxParticles: number): void {
    this.maxParticles = Math.max(
      24,
      Math.min(this.particles.length, Math.floor(maxParticles)),
    );
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.points.visible = enabled;
  }

  update(dtSeconds: number): void {
    if (!this.enabled) {
      return;
    }

    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i];
      if (!particle.alive) {
        continue;
      }
      particle.life += dtSeconds;
      if (particle.life >= particle.maxLife) {
        particle.alive = false;
        this.setInactive(i);
        continue;
      }

      particle.position.addScaledVector(particle.velocity, dtSeconds);
      const dragStep = Math.pow(particle.drag, dtSeconds * 60);
      particle.velocity.multiplyScalar(dragStep);
      particle.velocity.y -= dtSeconds * 0.65;

      const alpha = 1 - particle.life / particle.maxLife;
      this.positions[i * 3] = particle.position.x;
      this.positions[i * 3 + 1] = particle.position.y;
      this.positions[i * 3 + 2] = particle.position.z;
      this.colors[i * 3] = particle.color.r * alpha;
      this.colors[i * 3 + 1] = particle.color.g * alpha;
      this.colors[i * 3 + 2] = particle.color.b * alpha;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  spawnBite(position: THREE.Vector3): void {
    if (!this.enabled) {
      return;
    }
    this.spawnRing(position, "#7dd3fc", {
      count: 10,
      speed: 0.7,
      lifetime: 0.55,
      verticalBoost: 0.08,
      drag: 0.85,
    });
  }

  spawnCatch(position: THREE.Vector3, rarity: Rarity): void {
    if (!this.enabled) {
      return;
    }
    const configByRarity: Record<Rarity, BurstConfig> = {
      common: { count: 8, speed: 0.8, lifetime: 0.45, verticalBoost: 0.6 },
      uncommon: { count: 10, speed: 0.9, lifetime: 0.5, verticalBoost: 0.65 },
      rare: { count: 14, speed: 1, lifetime: 0.6, verticalBoost: 0.72 },
      epic: { count: 18, speed: 1.1, lifetime: 0.7, verticalBoost: 0.78 },
      mythic: { count: 22, speed: 1.25, lifetime: 0.9, verticalBoost: 0.88 },
    };
    this.spawnBurst(position, rarityColor(rarity), configByRarity[rarity]);
  }

  spawnFail(position: THREE.Vector3): void {
    if (!this.enabled) {
      return;
    }
    this.spawnBurst(position, "#cbd5e1", {
      count: 9,
      speed: 0.72,
      lifetime: 0.5,
      verticalBoost: 0.45,
      drag: 0.86,
    });
  }

  spawnCelebration(position: THREE.Vector3, rarity: "epic" | "mythic"): void {
    if (!this.enabled) {
      return;
    }
    if (rarity === "epic") {
      this.spawnOrbit(position, "#facc15", {
        count: 16,
        speed: 0.85,
        lifetime: 1.1,
        verticalBoost: 0.5,
      });
      return;
    }

    this.spawnOrbit(position, "#a855f7", {
      count: 24,
      speed: 1,
      lifetime: 1.35,
      verticalBoost: 0.6,
    });
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }

  private spawnRing(
    position: THREE.Vector3,
    colorHex: string,
    config: BurstConfig,
  ): void {
    const emitCount = Math.min(config.count, this.maxParticles);
    for (let i = 0; i < emitCount; i += 1) {
      const slot = this.findDeadSlot();
      if (slot < 0) {
        return;
      }
      const angle = (i / emitCount) * Math.PI * 2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * config.speed,
        config.verticalBoost * (0.5 + Math.random() * 0.4),
        Math.sin(angle) * config.speed,
      );
      this.activateParticle(
        slot,
        position,
        velocity,
        colorHex,
        config.lifetime,
        config.drag ?? 0.88,
      );
    }
  }

  private spawnOrbit(
    position: THREE.Vector3,
    colorHex: string,
    config: BurstConfig,
  ): void {
    const emitCount = Math.min(config.count, this.maxParticles);
    for (let i = 0; i < emitCount; i += 1) {
      const slot = this.findDeadSlot();
      if (slot < 0) {
        return;
      }
      const angle = (i / emitCount) * Math.PI * 2;
      const radius = 0.7 + (i % 3) * 0.2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * config.speed * 0.45,
        config.verticalBoost * (0.45 + Math.random() * 0.35),
        Math.sin(angle) * config.speed * 0.45,
      );
      const spawn = position
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(angle) * radius,
            1,
            Math.sin(angle) * radius,
          ),
        );
      this.activateParticle(
        slot,
        spawn,
        velocity,
        colorHex,
        config.lifetime,
        0.93,
      );
    }
  }

  private spawnBurst(
    position: THREE.Vector3,
    colorHex: string,
    config: BurstConfig,
  ): void {
    const emitCount = Math.min(config.count, this.maxParticles);
    for (let i = 0; i < emitCount; i += 1) {
      const slot = this.findDeadSlot();
      if (slot < 0) {
        return;
      }
      const theta = Math.random() * Math.PI * 2;
      const strength = config.speed * (0.5 + Math.random() * 0.7);
      const velocity = new THREE.Vector3(
        Math.cos(theta) * strength,
        config.verticalBoost * (0.8 + Math.random() * 0.5),
        Math.sin(theta) * strength,
      );
      this.activateParticle(
        slot,
        position.clone().add(new THREE.Vector3(0, 1, 0)),
        velocity,
        colorHex,
        config.lifetime,
        config.drag ?? 0.9,
      );
    }
  }

  private activateParticle(
    slot: number,
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    colorHex: string,
    lifetime: number,
    drag: number,
  ): void {
    const particle = this.particles[slot];
    particle.alive = true;
    particle.life = 0;
    particle.maxLife = lifetime * (0.86 + Math.random() * 0.35);
    particle.position.copy(position);
    particle.velocity.copy(velocity);
    particle.color.set(colorHex);
    particle.drag = drag;
  }

  private findDeadSlot(): number {
    for (let i = 0; i < this.maxParticles; i += 1) {
      if (!this.particles[i].alive) {
        return i;
      }
    }
    return -1;
  }

  private setInactive(index: number): void {
    this.positions[index * 3] = 99999;
    this.positions[index * 3 + 1] = 99999;
    this.positions[index * 3 + 2] = 99999;
    this.colors[index * 3] = 0;
    this.colors[index * 3 + 1] = 0;
    this.colors[index * 3 + 2] = 0;
  }
}

function rarityColor(rarity: Rarity): string {
  switch (rarity) {
    case "common":
      return "#84cc16";
    case "uncommon":
      return "#22c55e";
    case "rare":
      return "#3b82f6";
    case "epic":
      return "#f59e0b";
    case "mythic":
      return "#a855f7";
    default:
      return "#ffffff";
  }
}
