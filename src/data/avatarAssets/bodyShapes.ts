/**
 * Body Shape Definitions
 *
 * 8 body shapes with SVG path data for torso rendering.
 * Each shape includes different proportions for shoulders, waist, and hips.
 *
 * Coordinate system: viewBox="0 0 200 300"
 * Body is rendered below the head, from approximately y=170 to y=300
 */

import type { BodyShapeId } from "@/types/avatar";

/**
 * Body shape data structure
 */
export interface BodyShapeData {
  /** Unique identifier */
  id: BodyShapeId;
  /** Display name */
  name: string;
  /** Description for UI */
  description: string;
  /** SVG path for body torso outline */
  torsoPath: string;
  /** SVG path for neck connection */
  neckPath: string;
  /** SVG path for left arm */
  leftArmPath: string;
  /** SVG path for right arm */
  rightArmPath: string;
  /** Shoulder width multiplier (1.0 = standard) */
  shoulderWidth: number;
  /** Waist width ratio relative to shoulders */
  waistRatio: number;
  /** Hip width ratio relative to shoulders */
  hipRatio: number;
  /** Torso height multiplier */
  torsoHeight: number;
  /** Neck width multiplier */
  neckWidth: number;
  /** Arm length multiplier */
  armLength: number;
}

/**
 * Complete body shape catalog
 */
export const BODY_SHAPES: BodyShapeData[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // SLIM
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "body_slim",
    name: "Slim",
    description: "Narrow, lean build with defined proportions",
    torsoPath: `
      M72,185 
      Q65,195 60,215 
      L58,260 
      Q58,275 68,285 
      L132,285 
      Q142,275 142,260 
      L140,215 
      Q135,195 128,185
      Z
    `,
    neckPath: `
      M88,175 
      L88,190 
      Q100,195 112,190 
      L112,175 
      Q100,180 88,175 
      Z
    `,
    leftArmPath: `
      M60,195 
      Q45,200 38,220 
      L35,260 
      Q35,265 40,268 
      L48,268 
      Q52,265 52,260 
      L55,225 
      Q58,210 60,200 
      Z
    `,
    rightArmPath: `
      M140,195 
      Q155,200 162,220 
      L165,260 
      Q165,265 160,268 
      L152,268 
      Q148,265 148,260 
      L145,225 
      Q142,210 140,200 
      Z
    `,
    shoulderWidth: 0.85,
    waistRatio: 0.75,
    hipRatio: 0.8,
    torsoHeight: 1.0,
    neckWidth: 0.9,
    armLength: 1.0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AVERAGE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "body_average",
    name: "Average",
    description: "Standard proportions, balanced build",
    torsoPath: `
      M68,185 
      Q58,198 52,220 
      L50,265 
      Q50,280 62,290 
      L138,290 
      Q150,280 150,265 
      L148,220 
      Q142,198 132,185
      Z
    `,
    neckPath: `
      M85,175 
      L85,192 
      Q100,200 115,192 
      L115,175 
      Q100,182 85,175 
      Z
    `,
    leftArmPath: `
      M52,198 
      Q35,205 28,230 
      L25,275 
      Q25,282 32,285 
      L42,285 
      Q48,282 48,275 
      L50,235 
      Q52,215 52,205 
      Z
    `,
    rightArmPath: `
      M148,198 
      Q165,205 172,230 
      L175,275 
      Q175,282 168,285 
      L158,285 
      Q152,282 152,275 
      L150,235 
      Q148,215 148,205 
      Z
    `,
    shoulderWidth: 1.0,
    waistRatio: 0.85,
    hipRatio: 0.9,
    torsoHeight: 1.0,
    neckWidth: 1.0,
    armLength: 1.0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATHLETIC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "body_athletic",
    name: "Athletic",
    description: "Muscular build with V-taper, broad shoulders",
    torsoPath: `
      M62,185 
      Q48,200 42,225 
      L45,265 
      Q48,282 65,292 
      L135,292 
      Q152,282 155,265 
      L158,225 
      Q152,200 138,185
      Z
    `,
    neckPath: `
      M82,175 
      L82,195 
      Q100,205 118,195 
      L118,175 
      Q100,185 82,175 
      Z
    `,
    leftArmPath: `
      M42,200 
      Q22,210 15,240 
      L12,280 
      Q12,290 22,293 
      L35,293 
      Q42,290 42,280 
      L45,245 
      Q45,220 42,205 
      Z
    `,
    rightArmPath: `
      M158,200 
      Q178,210 185,240 
      L188,280 
      Q188,290 178,293 
      L165,293 
      Q158,290 158,280 
      L155,245 
      Q155,220 158,205 
      Z
    `,
    shoulderWidth: 1.2,
    waistRatio: 0.7,
    hipRatio: 0.85,
    torsoHeight: 1.05,
    neckWidth: 1.15,
    armLength: 1.05,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BROAD
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "body_broad",
    name: "Broad",
    description: "Wide shoulders and sturdy frame",
    torsoPath: `
      M58,185 
      Q42,200 35,228 
      L35,268 
      Q38,285 58,295 
      L142,295 
      Q162,285 165,268 
      L165,228 
      Q158,200 142,185
      Z
    `,
    neckPath: `
      M80,175 
      L80,195 
      Q100,208 120,195 
      L120,175 
      Q100,188 80,175 
      Z
    `,
    leftArmPath: `
      M35,200 
      Q15,212 8,245 
      L5,285 
      Q5,295 18,298 
      L32,298 
      Q42,295 42,285 
      L42,250 
      Q40,222 35,208 
      Z
    `,
    rightArmPath: `
      M165,200 
      Q185,212 192,245 
      L195,285 
      Q195,295 182,298 
      L168,298 
      Q158,295 158,285 
      L158,250 
      Q160,222 165,208 
      Z
    `,
    shoulderWidth: 1.3,
    waistRatio: 0.9,
    hipRatio: 0.95,
    torsoHeight: 1.05,
    neckWidth: 1.2,
    armLength: 1.0,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CURVY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "body_curvy",
    name: "Curvy",
    description: "Wider hips with defined waist",
    torsoPath: `
      M70,185 
      Q58,200 55,220 
      Q52,240 48,260 
      Q48,280 62,292 
      L138,292 
      Q152,280 152,260 
      Q148,240 145,220 
      Q142,200 130,185
      Z
    `,
    neckPath: `
      M85,175 
      L85,192 
      Q100,200 115,192 
      L115,175 
      Q100,182 85,175 
      Z
    `,
    leftArmPath: `
      M55,198 
      Q38,205 30,232 
      L28,275 
      Q28,285 38,288 
      L50,288 
      Q58,285 58,275 
      L58,238 
      Q55,212 55,205 
      Z
    `,
    rightArmPath: `
      M145,198 
      Q162,205 170,232 
      L172,275 
      Q172,285 162,288 
      L150,288 
      Q142,285 142,275 
      L142,238 
      Q145,212 145,205 
      Z
    `,
    shoulderWidth: 0.95,
    waistRatio: 0.72,
    hipRatio: 1.15,
    torsoHeight: 1.0,
    neckWidth: 0.95,
    armLength: 0.98,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCKY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "body_stocky",
    name: "Stocky",
    description: "Shorter, wider build with strong frame",
    torsoPath: `
      M60,185 
      Q45,198 38,225 
      L38,262 
      Q42,278 60,288 
      L140,288 
      Q158,278 162,262 
      L162,225 
      Q155,198 140,185
      Z
    `,
    neckPath: `
      M82,175 
      L82,192 
      Q100,202 118,192 
      L118,175 
      Q100,185 82,175 
      Z
    `,
    leftArmPath: `
      M38,198 
      Q22,208 15,235 
      L15,270 
      Q15,280 28,283 
      L42,283 
      Q52,280 50,270 
      L48,238 
      Q45,215 38,205 
      Z
    `,
    rightArmPath: `
      M162,198 
      Q178,208 185,235 
      L185,270 
      Q185,280 172,283 
      L158,283 
      Q148,280 150,270 
      L152,238 
      Q155,215 162,205 
      Z
    `,
    shoulderWidth: 1.15,
    waistRatio: 1.0,
    hipRatio: 1.05,
    torsoHeight: 0.9,
    neckWidth: 1.1,
    armLength: 0.9,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TALL
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "body_tall",
    name: "Tall",
    description: "Elongated proportions with longer torso",
    torsoPath: `
      M72,180 
      Q60,195 55,225 
      L52,275 
      Q52,292 65,300 
      L135,300 
      Q148,292 148,275 
      L145,225 
      Q140,195 128,180
      Z
    `,
    neckPath: `
      M85,170 
      L85,188 
      Q100,198 115,188 
      L115,170 
      Q100,180 85,170 
      Z
    `,
    leftArmPath: `
      M55,195 
      Q38,205 30,238 
      L25,290 
      Q25,300 38,303 
      L50,303 
      Q60,300 58,290 
      L58,245 
      Q55,215 55,202 
      Z
    `,
    rightArmPath: `
      M145,195 
      Q162,205 170,238 
      L175,290 
      Q175,300 162,303 
      L150,303 
      Q140,300 142,290 
      L142,245 
      Q145,215 145,202 
      Z
    `,
    shoulderWidth: 0.95,
    waistRatio: 0.82,
    hipRatio: 0.88,
    torsoHeight: 1.15,
    neckWidth: 0.95,
    armLength: 1.15,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PETITE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "body_petite",
    name: "Petite",
    description: "Smaller frame with delicate proportions",
    torsoPath: `
      M75,188 
      Q68,200 65,218 
      L62,258 
      Q62,272 72,280 
      L128,280 
      Q138,272 138,258 
      L135,218 
      Q132,200 125,188
      Z
    `,
    neckPath: `
      M88,178 
      L88,192 
      Q100,198 112,192 
      L112,178 
      Q100,184 88,178 
      Z
    `,
    leftArmPath: `
      M65,200 
      Q52,208 48,228 
      L45,262 
      Q45,270 52,273 
      L62,273 
      Q68,270 68,262 
      L68,232 
      Q65,212 65,205 
      Z
    `,
    rightArmPath: `
      M135,200 
      Q148,208 152,228 
      L155,262 
      Q155,270 148,273 
      L138,273 
      Q132,270 132,262 
      L132,232 
      Q135,212 135,205 
      Z
    `,
    shoulderWidth: 0.8,
    waistRatio: 0.8,
    hipRatio: 0.85,
    torsoHeight: 0.88,
    neckWidth: 0.85,
    armLength: 0.88,
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Default body shape ID
 */
export const DEFAULT_BODY_SHAPE: BodyShapeId = "body_average";

/**
 * Get body shape data by ID
 * @throws Error if body shape not found
 */
export function getBodyShape(id: BodyShapeId): BodyShapeData {
  const shape = BODY_SHAPES.find((s) => s.id === id);
  if (!shape) {
    throw new Error(`Body shape not found: ${id}`);
  }
  return shape;
}

/**
 * Get body shape data by ID with fallback to default
 */
export function getBodyShapeSafe(id: BodyShapeId): BodyShapeData {
  const shape = BODY_SHAPES.find((s) => s.id === id);
  return shape ?? getBodyShape(DEFAULT_BODY_SHAPE);
}

/**
 * Get all body shape IDs
 */
export function getAllBodyShapeIds(): BodyShapeId[] {
  return BODY_SHAPES.map((s) => s.id);
}
