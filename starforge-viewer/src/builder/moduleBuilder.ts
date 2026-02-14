/**
 * ModuleBuilder — the core builder that turns a module + tier JSON into a THREE.Group.
 * Produces a BuiltModule with lookup maps for parts, anchors, and connectors.
 */
import * as THREE from "three";
import { createGeometry } from "../geometry/geometryFactory";
import { computePatternPositions } from "../geometry/repeatPatterns";
import { materialFactory } from "../materials/materialFactory";
import type {
  BuiltModule,
  GeomDescriptor,
  ModuleDef,
  PartDef,
  PlaneGeom,
  StarforgeSpec,
  TierDef,
} from "../types/schema";
import { buildPrefabInstances } from "./prefabBuilder";
import { buildWreck, getWreckArchetypes } from "./wreckBuilder";

export class ModuleBuilder {
  private spec: StarforgeSpec;

  constructor(spec: StarforgeSpec) {
    this.spec = spec;
  }

  /**
   * Build a module at a specified tier.
   * For WRECK modules, use archetype param.
   */
  build(
    moduleCode: string,
    tierNum: number,
    archetype?: string,
  ): BuiltModule | null {
    const mod = this.spec.modules[moduleCode];
    if (!mod) {
      console.error(`ModuleBuilder: unknown module "${moduleCode}"`);
      return null;
    }

    // Wreck-type modules
    if (mod.archetypes) {
      const arch = archetype ?? getWreckArchetypes(mod)[0];
      if (!arch) {
        console.error(`ModuleBuilder: no archetypes in "${moduleCode}"`);
        return null;
      }
      return buildWreck(mod, arch, tierNum);
    }

    // Standard tiered modules
    if (!mod.tiers || mod.tiers.length === 0) {
      console.error(`ModuleBuilder: no tiers in "${moduleCode}"`);
      return null;
    }

    const tierIdx = tierNum - 1;
    if (tierIdx < 0 || tierIdx >= mod.tiers.length) {
      console.error(
        `ModuleBuilder: tier ${tierNum} out of range for "${moduleCode}" (has ${mod.tiers.length} tiers)`,
      );
      return null;
    }

    const tierDef = mod.tiers[tierIdx];
    return this.buildTier(mod, tierDef);
  }

  private buildTier(mod: ModuleDef, tier: TierDef): BuiltModule {
    const group = new THREE.Group();
    group.name = `MOD_${mod.code}`;

    const parts = new Map<string, THREE.Object3D>();
    const anchors = new Map<string, THREE.Object3D>();
    const connectors = new Map<string, THREE.Object3D>();

    // ── Build basePlate ──────────────────────────────────
    if (tier.basePlate && tier.basePlate.geom) {
      const mesh = this.buildPart(tier.basePlate);
      mesh.receiveShadow = true;
      group.add(mesh);
      parts.set(tier.basePlate.name, mesh);
    }

    // ── Build parts ──────────────────────────────────────
    for (const part of tier.parts) {
      if (part.repeat) {
        // Handle repeated parts
        const repeatGroup = this.buildRepeatPart(part);
        group.add(repeatGroup);
        parts.set(part.name, repeatGroup);
      } else if (part.parts && part.parts.length > 0) {
        // Handle nested part groups (e.g. CRANE claw)
        const partGroup = this.buildPartGroup(part, parts);
        group.add(partGroup);
        parts.set(part.name, partGroup);
      } else if (part.geom) {
        const mesh = this.buildPart(part);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        parts.set(part.name, mesh);
      }
    }

    // ── Build decals ─────────────────────────────────────
    for (const decal of tier.decals) {
      const geom = new THREE.PlaneGeometry(decal.size[0], decal.size[1]);
      const mat = this.createDecalMaterial(decal.id);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = `decal_${decal.id}`;
      mesh.position.set(decal.pos[0], decal.pos[1], decal.pos[2]);
      mesh.rotation.set(decal.rot[0], decal.rot[1], decal.rot[2]);
      mesh.renderOrder = 1;
      group.add(mesh);
      parts.set(mesh.name, mesh);
    }

    // ── Build prefab instances ───────────────────────────
    if (tier.prefabInstances && tier.prefabInstances.length > 0) {
      const prefabGroup = buildPrefabInstances(
        tier.prefabInstances,
        this.spec.prefabs,
        parts,
        anchors,
      );
      group.add(prefabGroup);
    }

    // ── Background Instances (e.g. DYSON swarm) ──────────
    if (
      tier.backgroundInstances &&
      Array.isArray(tier.backgroundInstances) &&
      tier.backgroundInstances.length > 0
    ) {
      const bgGroup = this.buildBackgroundInstances(
        tier.backgroundInstances as Record<string, unknown>[],
      );
      group.add(bgGroup);
      parts.set("backgroundInstances", bgGroup);
    }

    // ── Anchors ──────────────────────────────────────────
    for (const anchor of tier.anchors) {
      const anchorObj = new THREE.Object3D();
      anchorObj.name = `anchor_${anchor.name}`;
      anchorObj.position.set(anchor.pos[0], anchor.pos[1], anchor.pos[2]);
      group.add(anchorObj);
      anchors.set(anchor.name, anchorObj);
    }

    // ── Connectors ───────────────────────────────────────
    if (tier.connectors) {
      for (const [kind, conns] of Object.entries(tier.connectors)) {
        for (const conn of conns) {
          const connObj = new THREE.Object3D();
          connObj.name = `connector_${conn.name}`;
          connObj.position.set(conn.pos[0], conn.pos[1], conn.pos[2]);
          connObj.userData = {
            kind: conn.kind ?? kind,
            connectorName: conn.name,
          };
          group.add(connObj);
          connectors.set(conn.name, connObj);
        }
      }
    }

    return {
      group,
      parts,
      anchors,
      connectors,
      animations: tier.animations,
      vfx: tier.vfx,
      interactionVolumes: tier.interactionVolumes,
      moduleDef: mod,
      tier: tier.tier,
    };
  }

  /**
   * Build a single part (basePlate or body part) as a Mesh.
   */
  private buildPart(part: PartDef): THREE.Mesh {
    const geom = createGeometry(part.geom!);
    const matId = part.mat ?? "MatMetalDark";
    let mat: THREE.MeshStandardMaterial;

    // Clone emissive materials so each instance can pulse independently
    if (materialFactory.isEmissive(matId)) {
      mat = materialFactory.getClone(matId);
    } else {
      mat = materialFactory.get(matId);
    }

    // Handle plane-specific properties
    if (part.geom?.type === "plane") {
      const pg = part.geom as PlaneGeom;
      if (pg.doubleSided) mat.side = THREE.DoubleSide;
      if (pg.alpha !== undefined && pg.alpha < 1) {
        mat = mat.clone();
        mat.transparent = true;
        mat.opacity = pg.alpha;
      }
    }

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = part.name;
    mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
    mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
    return mesh;
  }

  /**
   * Build a nested part group (e.g. CRANE claw) — a parent group containing child parts.
   * The parent has no geometry of its own.
   */
  private buildPartGroup(
    groupDef: PartDef,
    namedParts: Map<string, THREE.Object3D>,
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = groupDef.name;

    for (const child of groupDef.parts!) {
      if (!child.geom) continue;

      const geom = createGeometry(child.geom);
      const matId = child.mat ?? "MatMetalDark";
      const mat = materialFactory.isEmissive(matId)
        ? materialFactory.getClone(matId)
        : materialFactory.get(matId);

      if (child.geom.type === "plane") {
        const pg = child.geom as PlaneGeom;
        if (pg.doubleSided) mat.side = THREE.DoubleSide;
        if (pg.alpha !== undefined && pg.alpha < 1) {
          (mat as THREE.MeshStandardMaterial).transparent = true;
          (mat as THREE.MeshStandardMaterial).opacity = pg.alpha;
        }
      }

      const mesh = new THREE.Mesh(geom, mat);
      mesh.name = child.name;
      mesh.position.set(child.pos[0], child.pos[1], child.pos[2]);
      mesh.rotation.set(child.rot[0], child.rot[1], child.rot[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Register child parts with dotted names for animation targeting
      namedParts.set(`${groupDef.name}.${child.name}`, mesh);
    }

    return group;
  }

  /**
   * Build backgroundInstances (e.g. DYSON swarm satellites).
   * Uses seeded orbit placement with InstancedMesh for efficiency.
   */
  private buildBackgroundInstances(
    bgInstances: Record<string, unknown>[],
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = "backgroundInstances";

    // Simple seeded PRNG
    function seeded(seed: number): () => number {
      let s = seed | 0;
      return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    for (const bgInst of bgInstances) {
      const name = (bgInst.name as string) ?? "bg";
      const count = (bgInst.count as number) ?? 10;
      const geomDef = bgInst.geom as Record<string, unknown> | undefined;
      const matId = (bgInst.mat as string) ?? "MatMetalLight";
      const orbitDef = bgInst.orbit as Record<string, unknown> | undefined;

      // Create geometry from descriptor
      let geom: THREE.BufferGeometry;
      if (geomDef) {
        geom = createGeometry(geomDef as unknown as GeomDescriptor);
      } else {
        geom = new THREE.BoxGeometry(0.05, 0.02, 0.08);
      }

      const mat = materialFactory.get(matId);

      // Use InstancedMesh for performance
      const instMesh = new THREE.InstancedMesh(geom, mat, count);
      instMesh.name = name;

      if (orbitDef) {
        const center = (orbitDef.center as number[]) ?? [0, 0, 0];
        const radiusRange = orbitDef.radius as number[];
        const inclRange = (orbitDef.inclination as number[]) ?? [-0.5, 0.5];
        const speedRange = (orbitDef.speed as number[]) ?? [0.01, 0.05];
        const seed = (orbitDef.seed as number) ?? 42;
        const rng = seeded(seed);

        const rMin = radiusRange?.[0] ?? 5;
        const rMax = radiusRange?.[1] ?? 10;
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
          const phase = rng() * Math.PI * 2;
          const r = rMin + rng() * (rMax - rMin);
          const incl = inclRange[0] + rng() * (inclRange[1] - inclRange[0]);
          const speed = speedRange[0] + rng() * (speedRange[1] - speedRange[0]);

          // Place on orbital sphere
          const x = center[0] + Math.cos(phase) * r * Math.cos(incl);
          const y = center[1] + Math.sin(incl) * r * 0.4;
          const z = center[2] + Math.sin(phase) * r * Math.cos(incl);

          dummy.position.set(x, y, z);
          dummy.rotation.set(rng() * Math.PI, phase, rng() * 0.5);
          dummy.scale.setScalar(0.7 + rng() * 0.6);
          dummy.updateMatrix();
          instMesh.setMatrixAt(i, dummy.matrix);

          // Store speed for animation in userData
          instMesh.userData[`speed_${i}`] = speed;
          instMesh.userData[`phase_${i}`] = phase;
          instMesh.userData[`radius_${i}`] = r;
          instMesh.userData[`incl_${i}`] = incl;
        }
        instMesh.instanceMatrix.needsUpdate = true;
      }

      group.add(instMesh);
    }

    return group;
  }

  /**
   * Build a repeat pattern part — a group with N child instances
   */
  private buildRepeatPart(part: PartDef): THREE.Group {
    const repeat = part.repeat!;
    const group = new THREE.Group();
    group.name = part.name;

    const positions = computePatternPositions(repeat.pattern, repeat.count);

    for (const inst of positions) {
      const instanceGroup = new THREE.Group();
      instanceGroup.name = `${part.name}_${inst.index}`;
      instanceGroup.position.copy(inst.position);
      instanceGroup.rotation.copy(inst.rotation);

      // Build sub-parts from repeat.item
      for (const subPart of repeat.item.parts) {
        if (!subPart.geom) continue;

        const geom = createGeometry(subPart.geom);
        const matId = subPart.mat ?? "MatMetalDark";
        const mat = materialFactory.isEmissive(matId)
          ? materialFactory.getClone(matId)
          : materialFactory.get(matId);

        if (subPart.geom.type === "plane") {
          const pg = subPart.geom as PlaneGeom;
          if (pg.doubleSided) mat.side = THREE.DoubleSide;
        }

        const mesh = new THREE.Mesh(geom, mat);
        mesh.name = subPart.name;
        mesh.position.set(subPart.pos[0], subPart.pos[1], subPart.pos[2]);
        mesh.rotation.set(subPart.rot[0], subPart.rot[1], subPart.rot[2]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        instanceGroup.add(mesh);
      }

      group.add(instanceGroup);
    }

    return group;
  }

  private createDecalMaterial(id: string): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    mat.name = `decal_${id}`;

    if (id.includes("WARNING")) {
      mat.color = new THREE.Color(0xffaa00);
      mat.emissive = new THREE.Color(0x332200);
    } else if (id.includes("PANEL")) {
      mat.color = new THREE.Color(0x333344);
      mat.emissive = new THREE.Color(0x111122);
    } else if (id.includes("SCRATCHES")) {
      mat.color = new THREE.Color(0x555555);
      mat.opacity = 0.3;
    } else if (id.includes("SERIAL")) {
      mat.color = new THREE.Color(0xcccccc);
      mat.opacity = 0.4;
    } else if (id.includes("BOLT")) {
      mat.color = new THREE.Color(0x888888);
      mat.opacity = 0.6;
    } else {
      mat.color = new THREE.Color(0x444444);
    }

    return mat;
  }

  /** Get available module codes. */
  getModuleCodes(): string[] {
    return Object.keys(this.spec.modules);
  }

  /** Get tier count for a module. */
  getTierCount(code: string): number {
    const mod = this.spec.modules[code];
    if (!mod) return 0;
    if (mod.archetypes) {
      // Return max tier count across archetypes
      let maxTiers = 0;
      for (const arch of Object.values(mod.archetypes)) {
        maxTiers = Math.max(maxTiers, Object.keys(arch.tiers).length);
      }
      return maxTiers;
    }
    return mod.tiers?.length ?? 0;
  }

  /** Check if module is wreck-type */
  isWreck(code: string): boolean {
    const mod = this.spec.modules[code];
    return !!mod?.archetypes;
  }

  /** Get archetype names for wreck modules */
  getArchetypes(code: string): string[] {
    const mod = this.spec.modules[code];
    if (!mod?.archetypes) return [];
    return Object.keys(mod.archetypes);
  }
}
