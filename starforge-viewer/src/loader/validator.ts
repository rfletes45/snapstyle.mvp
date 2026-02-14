/**
 * Validator for starforge_modules_v1.json
 * Provides helpful error messages for missing/invalid fields.
 */
import type {
  AnimationDef,
  AnimationType,
  GeomDescriptor,
  ModuleDef,
  PartDef,
  StarforgeSpec,
  TierDef,
  TriggerType,
  VfxDef,
  VfxType,
} from "../types/schema";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  todos: string[];
}

const KNOWN_ANIM_TYPES: AnimationType[] = [
  "rotate",
  "translate",
  "swing",
  "bob",
  "orbit",
  "followOrbit",
  "uvScroll",
  "pulseEmissive",
  "chaseEmissive",
  "blinkRandom",
  "flicker",
  "shaderTime",
  "vibrate",
  "extend",
  "sway",
  "tiltToVector",
  "bank",
];

const KNOWN_VFX_TYPES: VfxType[] = [
  "sparks",
  "smoke",
  "steamLeak",
  "steam",
  "pingWave",
  "lightningArcs",
  "debrisCubes",
  "microSparks",
  "stampFlash",
  "emberDrift",
  "inwardDust",
  "spiralParticles",
  "laserBeam",
  "dataPackets",
  "magnetBeam",
  "dustPuff",
  "scrapChunks",
  "valvePuff",
  "grabFlash",
  "nanoGlitter",
  "neonSmoke",
  "paperDust",
  "receiptPaper",
  "cutLineDecal",
  "fragmentOrbit",
  "runeParticles",
];

const KNOWN_TRIGGER_TYPES: TriggerType[] = [
  "always",
  "interval",
  "onClick",
  "onTap",
  "onCollect",
  "onBurst",
  "onContractComplete",
];

const KNOWN_GEOM_TYPES = ["box", "cylinder", "torus", "plane", "cone", "tube"];
const KNOWN_PATTERN_TYPES = [
  "line",
  "grid",
  "stack",
  "circle",
  "orbit",
  "randomDisk",
  "single",
];

export function validateSpec(spec: StarforgeSpec): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const todos: string[] = [];

  // Schema version
  if (spec.schemaVersion !== "starforge.moduleSpec.v1") {
    errors.push(
      `Expected schemaVersion "starforge.moduleSpec.v1", got "${spec.schemaVersion}"`,
    );
  }

  // Materials
  if (
    !spec.materials ||
    !Array.isArray(spec.materials) ||
    spec.materials.length === 0
  ) {
    errors.push("Missing or empty 'materials' array");
  }
  const matIds = new Set(spec.materials?.map((m) => m.id) ?? []);

  // Prefabs
  if (!spec.prefabs || typeof spec.prefabs !== "object") {
    warnings.push("Missing 'prefabs' object");
  }

  // Modules
  if (!spec.modules || typeof spec.modules !== "object") {
    errors.push("Missing 'modules' object");
    return { valid: false, errors, warnings, todos };
  }

  for (const [code, mod] of Object.entries(spec.modules)) {
    const path = `modules.${code}`;
    validateModule(mod, path, matIds, errors, warnings, todos);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    todos,
  };
}

function validateModule(
  mod: ModuleDef,
  path: string,
  matIds: Set<string>,
  errors: string[],
  warnings: string[],
  todos: string[],
) {
  if (!mod.code) errors.push(`${path}: missing 'code'`);
  if (!mod.name) errors.push(`${path}: missing 'name'`);
  if (!mod.footprint || mod.footprint.length !== 2) {
    errors.push(`${path}: missing or invalid 'footprint' (expected [w,d])`);
  }

  // Wreck-type modules have archetypes instead of tiers
  if (mod.archetypes) {
    for (const [archName, arch] of Object.entries(mod.archetypes)) {
      const archPath = `${path}.archetypes.${archName}`;
      if (!arch.tiers) {
        errors.push(`${archPath}: missing 'tiers'`);
      }
    }
    return;
  }

  if (!mod.tiers || !Array.isArray(mod.tiers) || mod.tiers.length === 0) {
    errors.push(`${path}: missing or empty 'tiers' array`);
    return;
  }

  for (let i = 0; i < mod.tiers.length; i++) {
    const tier = mod.tiers[i];
    const tierPath = `${path}.tiers[${i}]`;
    validateTier(tier, tierPath, matIds, errors, warnings, todos);
  }
}

function validateTier(
  tier: TierDef,
  path: string,
  matIds: Set<string>,
  errors: string[],
  warnings: string[],
  todos: string[],
) {
  // basePlate
  if (tier.basePlate && tier.basePlate.geom) {
    validateGeom(tier.basePlate.geom, `${path}.basePlate`, errors, todos);
    if (tier.basePlate.mat && !matIds.has(tier.basePlate.mat as string)) {
      warnings.push(
        `${path}.basePlate: unknown material "${tier.basePlate.mat}"`,
      );
    }
  }

  // Parts
  if (tier.parts && Array.isArray(tier.parts)) {
    for (let j = 0; j < tier.parts.length; j++) {
      validatePart(
        tier.parts[j],
        `${path}.parts[${j}]`,
        matIds,
        errors,
        warnings,
        todos,
      );
    }
  }

  // Animations
  if (tier.animations && Array.isArray(tier.animations)) {
    for (let j = 0; j < tier.animations.length; j++) {
      validateAnimation(
        tier.animations[j],
        `${path}.animations[${j}]`,
        errors,
        warnings,
        todos,
      );
    }
  }

  // VFX
  if (tier.vfx && Array.isArray(tier.vfx)) {
    for (let j = 0; j < tier.vfx.length; j++) {
      validateVfx(tier.vfx[j], `${path}.vfx[${j}]`, errors, warnings, todos);
    }
  }
}

function validatePart(
  part: PartDef,
  path: string,
  matIds: Set<string>,
  errors: string[],
  warnings: string[],
  todos: string[],
) {
  if (!part.name) errors.push(`${path}: missing 'name'`);

  // Parts with repeat don't have geom directly
  if (part.repeat) {
    const rp = part.repeat;
    if (!KNOWN_PATTERN_TYPES.includes(rp.pattern?.type)) {
      const t = rp.pattern?.type ?? "undefined";
      errors.push(`${path}.repeat.pattern: unknown pattern type "${t}"`);
      todos.push(
        `TODO [${path}]: Implement repeat pattern type "${t}". ` +
          `Proposed: add a handler in repeatPatterns.ts that computes positions for this type.`,
      );
    }
    return;
  }

  if (part.geom) {
    validateGeom(part.geom, path, errors, todos);
  }

  if (part.mat && !matIds.has(part.mat)) {
    warnings.push(`${path}: unknown material "${part.mat}"`);
  }
}

function validateGeom(
  geom: GeomDescriptor,
  path: string,
  errors: string[],
  todos: string[],
) {
  if (!KNOWN_GEOM_TYPES.includes(geom.type)) {
    errors.push(`${path}.geom: unknown geometry type "${geom.type}"`);
    todos.push(
      `TODO [${path}]: Implement geometry type "${geom.type}". ` +
        `Proposed: add a builder in geometryFactory.ts.`,
    );
  }
}

function validateAnimation(
  anim: AnimationDef,
  path: string,
  errors: string[],
  warnings: string[],
  todos: string[],
) {
  if (!anim.target) errors.push(`${path}: missing 'target'`);
  if (!anim.type) errors.push(`${path}: missing 'type'`);

  if (!KNOWN_ANIM_TYPES.includes(anim.type)) {
    errors.push(`${path}: unknown animation type "${anim.type}"`);
    todos.push(
      `TODO [${path}]: Implement animation type "${anim.type}". ` +
        `Proposed: add a handler in animationSystem.ts that updates the target each frame.`,
    );
  }

  if (anim.trigger && !KNOWN_TRIGGER_TYPES.includes(anim.trigger)) {
    warnings.push(`${path}: unknown trigger type "${anim.trigger}"`);
  }
}

function validateVfx(
  vfx: VfxDef,
  path: string,
  errors: string[],
  warnings: string[],
  todos: string[],
) {
  if (!vfx.type) errors.push(`${path}: missing 'type'`);

  if (!(KNOWN_VFX_TYPES as string[]).includes(vfx.type)) {
    errors.push(`${path}: unknown VFX type "${vfx.type}"`);
    todos.push(
      `TODO [${path}]: Implement VFX type "${vfx.type}". ` +
        `Proposed: add a particle emitter in vfxSystem.ts with billboard quads.`,
    );
  }

  if (vfx.trigger && !KNOWN_TRIGGER_TYPES.includes(vfx.trigger)) {
    warnings.push(`${path}: unknown VFX trigger "${vfx.trigger}"`);
  }
}
