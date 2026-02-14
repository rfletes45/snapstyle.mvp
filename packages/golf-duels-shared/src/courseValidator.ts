/**
 * Golf Duels — Course Validator (Zod schemas)
 *
 * Validates course JSON files against the expected schema.
 * Used at build time and server startup to catch malformed data.
 */

import { z } from "zod";

// =============================================================================
// Primitives
// =============================================================================

/** Finite number — rejects NaN and ±Infinity */
const finite = z.number().refine((n) => Number.isFinite(n), {
  message: "Must be a finite number",
});

const finitePositive = finite.refine((n) => n > 0, {
  message: "Must be a positive finite number",
});

const finiteInt = z
  .number()
  .int()
  .refine((n) => Number.isFinite(n), {
    message: "Must be a finite integer",
  });

const Vec2Schema = z.object({
  x: finite,
  z: finite,
});

const WallSchema = z.object({
  a: Vec2Schema,
  b: Vec2Schema,
});

// =============================================================================
// Surfaces
// =============================================================================

const SandSurfaceSchema = z.object({
  type: z.literal("sand"),
  id: z.string(),
  shape: z.literal("aabb"),
  min: Vec2Schema,
  max: Vec2Schema,
});

const SlowSurfaceSchema = z.object({
  type: z.literal("slow"),
  id: z.string(),
  shape: z.literal("aabb"),
  min: Vec2Schema,
  max: Vec2Schema,
});

const SpeedSurfaceSchema = z.object({
  type: z.literal("speed"),
  id: z.string(),
  shape: z.literal("aabb"),
  min: Vec2Schema,
  max: Vec2Schema,
  dir: Vec2Schema,
  accel: finitePositive,
  maxSpeed: finitePositive,
});

const SurfaceSchema = z.discriminatedUnion("type", [
  SandSurfaceSchema,
  SlowSurfaceSchema,
  SpeedSurfaceSchema,
]);

// =============================================================================
// HeightFields
// =============================================================================

const PlaneHeightFieldSchema = z.object({
  type: z.literal("plane"),
  a: finite,
  b: finite,
  zone: z
    .object({
      shape: z.literal("aabb"),
      min: Vec2Schema,
      max: Vec2Schema,
    })
    .optional(),
});

const DomeHeightFieldSchema = z.object({
  type: z.literal("dome"),
  center: Vec2Schema,
  radius: finitePositive,
  height: finite,
});

const HeightFieldSchema = z.discriminatedUnion("type", [
  PlaneHeightFieldSchema,
  DomeHeightFieldSchema,
]);

// =============================================================================
// Obstacles
// =============================================================================

const BumperRoundSchema = z.object({
  type: z.literal("bumper_round"),
  id: z.string(),
  pos: Vec2Schema,
  radius: finitePositive,
});

const BumperWedgeSchema = z.object({
  type: z.literal("bumper_wedge"),
  id: z.string(),
  pos: Vec2Schema,
  halfLength: finitePositive,
  rotationDeg: finite,
});

const SpinnerSchema = z.object({
  type: z.literal("spinner"),
  id: z.string(),
  pivot: Vec2Schema,
  length: finitePositive,
  rps: finite,
  phase: finite,
});

const GateSchema = z.object({
  type: z.literal("gate"),
  id: z.string(),
  hinge: Vec2Schema,
  armLength: finitePositive,
  arcDeg: finitePositive,
  periodSec: finitePositive,
  phase: finite,
  rotationBaseDeg: finite,
});

const BridgeSchema = z.object({
  type: z.literal("bridge"),
  id: z.string(),
  a: Vec2Schema,
  b: Vec2Schema,
  width: finitePositive,
});

const TunnelSchema = z.object({
  type: z.literal("tunnel"),
  id: z.string(),
  enter: Vec2Schema,
  exit: Vec2Schema,
  radius: finitePositive,
});

const SpeedGateSchema = z.object({
  type: z.literal("speed_gate"),
  id: z.string(),
  entry: z.object({
    shape: z.literal("aabb"),
    min: Vec2Schema,
    max: Vec2Schema,
  }),
  exit: Vec2Schema,
  minSpeed: finite,
  maxSpeed: finite,
  onFail: z.string(),
  reflectRestitution: finite,
});

const ObstacleSchema = z.discriminatedUnion("type", [
  BumperRoundSchema,
  BumperWedgeSchema,
  SpinnerSchema,
  GateSchema,
  BridgeSchema,
  TunnelSchema,
  SpeedGateSchema,
]);

// =============================================================================
// Hazards
// =============================================================================

const HazardSchema = z.object({
  type: z.enum(["water", "out_of_bounds"]),
  id: z.string(),
  shape: z.literal("aabb"),
  min: Vec2Schema,
  max: Vec2Schema,
});

// =============================================================================
// Decor
// =============================================================================

const DecorSchema = z.object({
  theme: z.string(),
  seed: finiteInt,
});

// =============================================================================
// HoleData — Complete hole definition
// =============================================================================

export const HoleDataSchema = z.object({
  version: finiteInt.refine((n) => n > 0, {
    message: "version must be positive",
  }),
  holeId: z.string().regex(/^T[1-6]-[1-5]$/),
  tier: finiteInt.refine((n) => n >= 1 && n <= 6, {
    message: "tier must be 1-6",
  }),
  bounds: z.object({
    width: finitePositive,
    height: finitePositive,
  }),
  start: Vec2Schema,
  cup: Vec2Schema,
  walls: z.array(WallSchema).min(4), // at least 4 boundary walls
  surfaces: z.array(SurfaceSchema),
  heightFields: z.array(HeightFieldSchema),
  obstacles: z.array(ObstacleSchema),
  hazards: z.array(HazardSchema),
  decor: DecorSchema,
});

// =============================================================================
// Manifest
// =============================================================================

export const ManifestSchema = z.object({
  version: finiteInt.refine((n) => n > 0, {
    message: "version must be positive",
  }),
  generatedAt: z.string(),
  count: finiteInt.refine((n) => n > 0, { message: "count must be positive" }),
  holes: z.array(
    z.object({
      holeId: z.string().regex(/^T[1-6]-[1-5]$/),
      tier: finiteInt.refine((n) => n >= 1 && n <= 6, { message: "tier 1-6" }),
      file: z.string().endsWith(".json"),
    }),
  ),
});

// =============================================================================
// Validation Functions
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateHole(data: unknown): ValidationResult {
  const result = HoleDataSchema.safeParse(data);
  if (result.success) {
    // Additional semantic checks
    const errors: string[] = [];
    const hole = result.data;

    // Start must be inside bounds
    if (
      hole.start.x < 0 ||
      hole.start.x > hole.bounds.width ||
      hole.start.z < 0 ||
      hole.start.z > hole.bounds.height
    ) {
      errors.push(
        `Start position (${hole.start.x}, ${hole.start.z}) outside bounds`,
      );
    }

    // Cup must be inside bounds
    if (
      hole.cup.x < 0 ||
      hole.cup.x > hole.bounds.width ||
      hole.cup.z < 0 ||
      hole.cup.z > hole.bounds.height
    ) {
      errors.push(`Cup position (${hole.cup.x}, ${hole.cup.z}) outside bounds`);
    }

    // Tier in holeId must match tier field
    const tierFromId = parseInt(hole.holeId.charAt(1), 10);
    if (tierFromId !== hole.tier) {
      errors.push(
        `Tier mismatch: holeId ${hole.holeId} implies tier ${tierFromId} but tier field is ${hole.tier}`,
      );
    }

    return { valid: errors.length === 0, errors };
  }

  return {
    valid: false,
    errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}

export function validateManifest(data: unknown): ValidationResult {
  const result = ManifestSchema.safeParse(data);
  if (result.success) {
    const errors: string[] = [];
    const manifest = result.data;

    if (manifest.holes.length !== manifest.count) {
      errors.push(
        `Manifest count (${manifest.count}) doesn't match holes array length (${manifest.holes.length})`,
      );
    }

    // Check for unique holeIds
    const ids = new Set<string>();
    for (const h of manifest.holes) {
      if (ids.has(h.holeId)) {
        errors.push(`Duplicate holeId: ${h.holeId}`);
      }
      ids.add(h.holeId);
    }

    return { valid: errors.length === 0, errors };
  }

  return {
    valid: false,
    errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}
