/**
 * Clothing Outfits Definitions
 *
 * 15 full outfit items that replace both top and bottom.
 * Used for dresses, jumpsuits, uniforms, and costumes.
 */

import type { ClothingOutfitId } from "@/types/avatar";
import type { ClothingRarity } from "./clothingTops";

/**
 * Outfit category
 */
export type OutfitCategory =
  | "dress"
  | "jumpsuit"
  | "romper"
  | "uniform"
  | "costume"
  | "sportswear"
  | "formal";

/**
 * Outfit data structure
 */
export interface ClothingOutfitData {
  /** Unique identifier */
  id: ClothingOutfitId;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: OutfitCategory;
  /** SVG path for main garment body */
  mainPath: string;
  /** SVG path for details (buttons, seams, etc.) */
  detailsPath?: string;
  /** SVG path for shading/folds */
  shadowPath?: string;
  /** SVG path for sleeves (if any) */
  sleevesPath?: string;
  /** Default fill color */
  defaultColor: string;
  /** Secondary color (for details) */
  secondaryColor?: string;
  /** Third color (for accents) */
  accentColor?: string;
  /** Whether user can customize color */
  colorizable: boolean;
  /** Available color options (if limited) */
  colorOptions?: string[];
  /** Rarity for unlock system */
  rarity: ClothingRarity;
  /** Sorting order in UI */
  sortOrder: number;
  /** Tags for filtering */
  tags: string[];
}

/**
 * Complete outfits catalog
 */
export const CLOTHING_OUTFITS: ClothingOutfitData[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NONE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "outfit_none",
    name: "No Outfit",
    description: "Use separate top and bottom",
    category: "dress",
    mainPath: "",
    defaultColor: "transparent",
    colorizable: false,
    rarity: "common",
    sortOrder: 0,
    tags: [],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DRESSES (5)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "outfit_dress_casual",
    name: "Casual Dress",
    description: "Comfortable everyday dress",
    category: "dress",
    mainPath: `
      M68,188 
      Q58,200 52,225 
      L45,300 
      L155,300 
      L148,225 
      Q142,200 132,188
      Q115,182 100,182
      Q85,182 68,188
      Z
    `,
    sleevesPath: `
      M52,198 L38,212 L35,250 L50,248 L52,218 Z
      M148,198 L162,212 L165,250 L150,248 L148,218 Z
    `,
    shadowPath: `
      M60,260 Q80,270 95,300 L55,300 Z
      M140,260 Q120,270 105,300 L145,300 Z
    `,
    defaultColor: "#F472B6",
    colorizable: true,
    colorOptions: [
      "#F472B6",
      "#A78BFA",
      "#60A5FA",
      "#34D399",
      "#FBBF24",
      "#000000",
    ],
    rarity: "uncommon",
    sortOrder: 1,
    tags: ["casual", "feminine", "everyday"],
  },
  {
    id: "outfit_dress_aline",
    name: "A-Line Dress",
    description: "Classic A-line silhouette",
    category: "dress",
    mainPath: `
      M70,188 
      Q60,200 55,222 
      L38,300 
      L162,300 
      L145,222 
      Q140,200 130,188
      Q115,182 100,182
      Q85,182 70,188
      Z
    `,
    sleevesPath: `
      M55,200 L40,215 L38,252 L52,250 L55,220 Z
      M145,200 L160,215 L162,252 L148,250 L145,220 Z
    `,
    defaultColor: "#DC2626",
    colorizable: true,
    rarity: "uncommon",
    sortOrder: 2,
    tags: ["classic", "feminine", "elegant"],
  },
  {
    id: "outfit_dress_maxi",
    name: "Maxi Dress",
    description: "Flowing floor-length dress",
    category: "dress",
    mainPath: `
      M70,188 
      Q58,202 50,230 
      L42,300 
      L158,300 
      L150,230 
      Q142,202 130,188
      Q115,180 100,180
      Q85,180 70,188
      Z
    `,
    shadowPath: `
      M55,250 Q75,265 85,300 L48,300 Z
      M145,250 Q125,265 115,300 L152,300 Z
    `,
    defaultColor: "#7C3AED",
    colorizable: true,
    colorOptions: ["#7C3AED", "#EC4899", "#0EA5E9", "#84CC16", "#000000"],
    rarity: "rare",
    sortOrder: 3,
    tags: ["elegant", "feminine", "formal"],
  },
  {
    id: "outfit_dress_cocktail",
    name: "Cocktail Dress",
    description: "Elegant party dress",
    category: "dress",
    mainPath: `
      M72,186 
      Q62,198 58,218 
      L52,295 
      L148,295 
      L142,218 
      Q138,198 128,186
      Q115,180 100,180
      Q85,180 72,186
      Z
    `,
    detailsPath: `
      M72,186 Q100,175 128,186
    `,
    defaultColor: "#000000",
    colorizable: true,
    colorOptions: ["#000000", "#DC2626", "#1E3A8A", "#7C2D12"],
    rarity: "epic",
    sortOrder: 4,
    tags: ["formal", "elegant", "party"],
  },
  {
    id: "outfit_dress_sundress",
    name: "Sundress",
    description: "Light summer sundress",
    category: "dress",
    mainPath: `
      M75,190 
      Q65,202 60,225 
      L52,295 
      L148,295 
      L140,225 
      Q135,202 125,190
      L118,185
      L100,195
      L82,185
      L75,190
      Z
    `,
    detailsPath: `
      M75,190 L78,200 Q100,208 122,200 L125,190
    `,
    shadowPath: `
      M62,260 Q80,275 90,295 L58,295 Z
      M138,260 Q120,275 110,295 L142,295 Z
    `,
    defaultColor: "#FDE047",
    secondaryColor: "#FFFFFF",
    colorizable: true,
    rarity: "uncommon",
    sortOrder: 5,
    tags: ["summer", "casual", "feminine"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JUMPSUITS & ROMPERS (3)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "outfit_jumpsuit_casual",
    name: "Casual Jumpsuit",
    description: "Comfortable one-piece jumpsuit",
    category: "jumpsuit",
    mainPath: `
      M65,188 
      Q55,202 48,230 
      L45,265
      L48,300
      L78,300
      L82,275
      L100,273
      L118,275
      L122,300
      L152,300
      L155,265
      L152,230 
      Q145,202 135,188
      Q118,180 100,180
      Q82,180 65,188
      Z
    `,
    sleevesPath: `
      M48,202 L28,220 L25,268 L45,265 L48,228 Z
      M152,202 L172,220 L175,268 L155,265 L152,228 Z
    `,
    detailsPath: `
      M98,188 L98,273 M102,188 L102,273
      M95,188 L95,265 Q100,258 105,265 L105,188 Z
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    colorOptions: ["#1F2937", "#78350F", "#065F46", "#4B5563"],
    rarity: "rare",
    sortOrder: 10,
    tags: ["casual", "trendy", "practical"],
  },
  {
    id: "outfit_jumpsuit_denim",
    name: "Denim Jumpsuit",
    description: "Classic denim overalls jumpsuit",
    category: "jumpsuit",
    mainPath: `
      M62,188 
      Q52,202 45,232 
      L42,268
      L45,300
      L78,300
      L82,275
      L100,273
      L118,275
      L122,300
      L155,300
      L158,268
      L155,232 
      Q148,202 138,188
      Q118,180 100,180
      Q82,180 62,188
      Z
    `,
    sleevesPath: `
      M45,205 L25,222 L22,272 L42,270 L45,230 Z
      M155,205 L175,222 L178,272 L158,270 L155,230 Z
    `,
    detailsPath: `
      M55,210 L75,210 L75,240 L55,240 Z
      M125,210 L145,210 L145,240 L125,240 Z
      M98,188 L98,273
    `,
    defaultColor: "#3B82F6",
    colorizable: true,
    rarity: "rare",
    sortOrder: 11,
    tags: ["casual", "denim", "workwear"],
  },
  {
    id: "outfit_romper",
    name: "Romper",
    description: "Short one-piece romper",
    category: "romper",
    mainPath: `
      M68,188 
      Q58,200 52,225 
      L50,265
      L52,280
      L78,280
      L85,262
      L100,260
      L115,262
      L122,280
      L148,280
      L150,265
      L148,225 
      Q142,200 132,188
      Q115,182 100,182
      Q85,182 68,188
      Z
    `,
    sleevesPath: `
      M52,200 L38,215 L35,255 L50,252 L52,220 Z
      M148,200 L162,215 L165,255 L150,252 L148,220 Z
    `,
    defaultColor: "#F472B6",
    colorizable: true,
    rarity: "uncommon",
    sortOrder: 12,
    tags: ["casual", "summer", "feminine"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPORTSWEAR (2)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "outfit_athletic_set",
    name: "Athletic Set",
    description: "Matching athletic wear set",
    category: "sportswear",
    mainPath: `
      M70,188 
      Q60,200 55,222 
      L52,248
      M68,260
      L65,300
      L78,300
      L82,275
      L100,273
      L118,275
      L122,300
      L135,300
      L132,260
      M148,248
      L145,222 
      Q140,200 130,188
      Q115,182 100,182
      Q85,182 70,188
      Z
      M52,248 L55,260 L68,260 Q100,255 132,260 L145,260 L148,248 Q100,240 52,248 Z
    `,
    detailsPath: `
      M55,195 L55,245 M145,195 L145,245
      M65,262 L65,298 M135,262 L135,298
    `,
    defaultColor: "#000000",
    secondaryColor: "#FFFFFF",
    colorizable: true,
    colorOptions: ["#000000", "#3B82F6", "#DC2626", "#059669"],
    rarity: "uncommon",
    sortOrder: 20,
    tags: ["athletic", "sporty", "gym"],
  },
  {
    id: "outfit_yoga_set",
    name: "Yoga Set",
    description: "Matching yoga/pilates outfit",
    category: "sportswear",
    mainPath: `
      M72,186 
      Q65,196 62,215 
      L62,242
      M68,255
      L65,300
      L75,300
      L82,273
      L100,270
      L118,273
      L125,300
      L135,300
      L132,255
      M138,242
      L138,215 
      Q135,196 128,186
      Q115,180 100,180
      Q85,180 72,186
      Z
      M62,242 L65,255 L68,255 Q100,248 132,255 L135,255 L138,242 Q100,235 62,242 Z
    `,
    defaultColor: "#7C3AED",
    colorizable: true,
    colorOptions: ["#7C3AED", "#EC4899", "#10B981", "#000000"],
    rarity: "uncommon",
    sortOrder: 21,
    tags: ["athletic", "yoga", "wellness"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMAL (2)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "outfit_suit",
    name: "Business Suit",
    description: "Professional business suit",
    category: "formal",
    mainPath: `
      M58,185 
      Q48,200 42,230 
      L40,268
      L42,300
      L78,300
      L82,275
      L100,273
      L118,275
      L122,300
      L158,300
      L160,268
      L158,230 
      Q152,200 142,185
      Q120,175 100,175
      Q80,175 58,185
      Z
    `,
    sleevesPath: `
      M42,202 L20,222 L18,278 L40,275 L42,228 Z
      M158,202 L180,222 L182,278 L160,275 L158,228 Z
    `,
    detailsPath: `
      M58,185 L80,210 L80,300 L88,300 L88,215 L100,185
      M142,185 L120,210 L120,300 L112,300 L112,215 L100,185
      M85,245 L92,245 M108,245 L115,245
      M100,185 L100,273
    `,
    defaultColor: "#1E3A8A",
    secondaryColor: "#FFFFFF",
    accentColor: "#78350F",
    colorizable: true,
    colorOptions: ["#1E3A8A", "#1F2937", "#000000", "#78350F"],
    rarity: "epic",
    sortOrder: 30,
    tags: ["formal", "business", "professional"],
  },
  {
    id: "outfit_tuxedo",
    name: "Tuxedo",
    description: "Elegant formal tuxedo",
    category: "formal",
    mainPath: `
      M55,182 
      Q45,198 38,230 
      L35,268
      L38,300
      L78,300
      L82,275
      L100,273
      L118,275
      L122,300
      L162,300
      L165,268
      L162,230 
      Q155,198 145,182
      Q122,172 100,172
      Q78,172 55,182
      Z
    `,
    sleevesPath: `
      M38,200 L15,220 L12,280 L35,277 L38,228 Z
      M162,200 L185,220 L188,280 L165,277 L162,228 Z
    `,
    detailsPath: `
      M55,182 L82,215 L82,300 L92,300 L92,220 L100,180
      M145,182 L118,215 L118,300 L108,300 L108,220 L100,180
      M90,195 L92,225 L100,235 L108,225 L110,195 Q100,188 90,195 Z
      M95,245 L95,250 L100,255 L105,250 L105,245 L100,240 Z
    `,
    shadowPath: `
      M55,182 L55,300 L75,300 L75,200 Z
      M145,182 L145,300 L125,300 L125,200 Z
    `,
    defaultColor: "#000000",
    secondaryColor: "#FFFFFF",
    accentColor: "#78350F",
    colorizable: false,
    rarity: "legendary",
    sortOrder: 31,
    tags: ["formal", "elegant", "luxury"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COSTUME (2)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "outfit_superhero",
    name: "Superhero Suit",
    description: "Heroic superhero costume",
    category: "costume",
    mainPath: `
      M62,185 
      Q50,200 42,232 
      L40,268
      L42,300
      L75,300
      L80,275
      L100,272
      L120,275
      L125,300
      L158,300
      L160,268
      L158,232 
      Q150,200 138,185
      Q118,175 100,175
      Q82,175 62,185
      Z
    `,
    sleevesPath: `
      M42,200 L18,222 L15,285 L40,282 L42,228 Z
      M158,200 L182,222 L185,285 L160,282 L158,228 Z
    `,
    detailsPath: `
      M80,210 L100,195 L120,210 L115,245 L100,255 L85,245 Z
      M62,185 Q100,170 138,185 L135,195 Q100,182 65,195 Z
    `,
    defaultColor: "#DC2626",
    secondaryColor: "#1E3A8A",
    accentColor: "#FDE047",
    colorizable: true,
    rarity: "legendary",
    sortOrder: 40,
    tags: ["costume", "fun", "fantasy"],
  },
  {
    id: "outfit_onesie",
    name: "Animal Onesie",
    description: "Cozy animal costume onesie",
    category: "costume",
    mainPath: `
      M55,178 
      Q42,195 35,235 
      L32,275
      L35,300
      L75,300
      L80,275
      L100,272
      L120,275
      L125,300
      L165,300
      L168,275
      L165,235 
      Q158,195 145,178
      Q120,165 100,165
      Q80,165 55,178
      Z
    `,
    sleevesPath: `
      M35,198 L8,220 L5,285 L32,282 L35,230 Z
      M165,198 L192,220 L195,285 L168,282 L165,230 Z
    `,
    detailsPath: `
      M55,178 Q100,158 145,178 Q135,165 100,160 Q65,165 55,178 Z
      M45,168 L55,155 L65,168 Z
      M135,168 L145,155 L155,168 Z
      M80,215 L85,225 L80,235 L85,245 Z
      M120,215 L115,225 L120,235 L115,245 Z
      M92,245 Q100,255 108,245
    `,
    defaultColor: "#D4A574",
    secondaryColor: "#FAFAF9",
    colorizable: true,
    colorOptions: ["#D4A574", "#9CA3AF", "#EC4899", "#10B981"],
    rarity: "epic",
    sortOrder: 41,
    tags: ["costume", "cozy", "fun"],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Default outfit ID (none - use separate pieces)
 */
export const DEFAULT_OUTFIT: ClothingOutfitId = "outfit_none";

/**
 * Get outfit data by ID
 * @throws Error if not found
 */
export function getOutfit(id: ClothingOutfitId): ClothingOutfitData {
  const outfit = CLOTHING_OUTFITS.find((o) => o.id === id);
  if (!outfit) {
    throw new Error(`Outfit not found: ${id}`);
  }
  return outfit;
}

/**
 * Get outfit data with fallback to null
 */
export function getOutfitSafe(
  id: ClothingOutfitId | null,
): ClothingOutfitData | null {
  if (!id || id === "outfit_none") return null;
  const outfit = CLOTHING_OUTFITS.find((o) => o.id === id);
  return outfit ?? null;
}

/**
 * Get outfits by category
 */
export function getOutfitsByCategory(
  category: OutfitCategory,
): ClothingOutfitData[] {
  return CLOTHING_OUTFITS.filter(
    (o) => o.category === category && o.id !== "outfit_none",
  );
}

/**
 * Get all outfit IDs
 */
export function getAllOutfitIds(): ClothingOutfitId[] {
  return CLOTHING_OUTFITS.map((o) => o.id);
}

/**
 * Get dresses only
 */
export function getDresses(): ClothingOutfitData[] {
  return CLOTHING_OUTFITS.filter(
    (o) => o.category === "dress" && o.id !== "outfit_none",
  );
}

/**
 * Get jumpsuits and rompers
 */
export function getJumpsuitsAndRompers(): ClothingOutfitData[] {
  return CLOTHING_OUTFITS.filter(
    (o) =>
      (o.category === "jumpsuit" || o.category === "romper") &&
      o.id !== "outfit_none",
  );
}
