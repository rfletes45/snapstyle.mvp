/**
 * Clothing Bottoms Definitions
 *
 * 30 clothing bottom items with SVG paths for avatar customization.
 * Bottoms render over the lower body area.
 */

import type { ClothingBottomId } from "@/types/avatar";
import type { ClothingRarity } from "./clothingTops";

/**
 * Clothing bottom category
 */
export type ClothingBottomCategory =
  | "jeans"
  | "pants"
  | "shorts"
  | "skirt"
  | "leggings"
  | "sweatpants"
  | "dress_pants"
  | "athletic";

/**
 * Length type for bottoms
 */
export type BottomLength = "mini" | "short" | "knee" | "midi" | "full";

/**
 * Fit type for bottoms
 */
export type BottomFit = "tight" | "regular" | "loose" | "wide";

/**
 * Clothing bottom data structure
 */
export interface ClothingBottomData {
  /** Unique identifier */
  id: ClothingBottomId;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: ClothingBottomCategory;
  /** SVG path for main garment */
  mainPath: string;
  /** SVG path for details (pockets, seams, etc.) */
  detailsPath?: string;
  /** SVG path for shading/folds */
  shadowPath?: string;
  /** Default fill color */
  defaultColor: string;
  /** Secondary color (for details) */
  secondaryColor?: string;
  /** Whether user can customize color */
  colorizable: boolean;
  /** Available color options (if limited) */
  colorOptions?: string[];
  /** Length type */
  length: BottomLength;
  /** Fit type */
  fit: BottomFit;
  /** Rarity for unlock system */
  rarity: ClothingRarity;
  /** Sorting order in UI */
  sortOrder: number;
  /** Tags for filtering */
  tags: string[];
}

/**
 * Complete clothing bottoms catalog
 */
export const CLOTHING_BOTTOMS: ClothingBottomData[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // NONE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bottom_none",
    name: "No Bottoms",
    description: "No bottom clothing",
    category: "pants",
    mainPath: "",
    defaultColor: "transparent",
    colorizable: false,
    length: "full",
    fit: "regular",
    rarity: "common",
    sortOrder: 0,
    tags: [],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JEANS (6)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bottom_jeans_regular",
    name: "Regular Jeans",
    description: "Classic regular fit jeans",
    category: "jeans",
    mainPath: `
      M55,260 
      L52,300
      L75,300
      L80,280
      L100,280
      L120,280
      L125,300
      L148,300
      L145,260
      Q100,255 55,260
      Z
    `,
    detailsPath: `
      M100,262 L100,280
      M65,270 L72,270 L72,285 L65,285 Z
      M128,270 L135,270 L135,285 L128,285 Z
    `,
    shadowPath: `
      M60,275 Q70,278 75,300 L65,300 Z
      M140,275 Q130,278 125,300 L135,300 Z
    `,
    defaultColor: "#3B82F6",
    colorizable: true,
    colorOptions: ["#3B82F6", "#1E3A8A", "#1F2937", "#000000", "#6B7280"],
    length: "full",
    fit: "regular",
    rarity: "common",
    sortOrder: 1,
    tags: ["casual", "classic", "denim"],
  },
  {
    id: "bottom_jeans_skinny",
    name: "Skinny Jeans",
    description: "Fitted skinny jeans",
    category: "jeans",
    mainPath: `
      M60,260 
      L58,300
      L72,300
      L78,280
      L100,278
      L122,280
      L128,300
      L142,300
      L140,260
      Q100,255 60,260
      Z
    `,
    detailsPath: `
      M100,262 L100,278
      M70,272 L76,272 L76,285 L70,285 Z
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    colorOptions: ["#1F2937", "#000000", "#3B82F6", "#1E3A8A"],
    length: "full",
    fit: "tight",
    rarity: "common",
    sortOrder: 2,
    tags: ["casual", "fitted", "denim"],
  },
  {
    id: "bottom_jeans_bootcut",
    name: "Bootcut Jeans",
    description: "Classic bootcut jeans",
    category: "jeans",
    mainPath: `
      M58,260 
      L48,300
      L78,300
      L82,278
      L100,276
      L118,278
      L122,300
      L152,300
      L142,260
      Q100,255 58,260
      Z
    `,
    detailsPath: `
      M100,262 L100,276
      M68,268 L75,268 L75,282 L68,282 Z
    `,
    defaultColor: "#3B82F6",
    colorizable: true,
    length: "full",
    fit: "regular",
    rarity: "uncommon",
    sortOrder: 3,
    tags: ["casual", "classic", "denim"],
  },
  {
    id: "bottom_jeans_wide",
    name: "Wide-Leg Jeans",
    description: "Trendy wide-leg jeans",
    category: "jeans",
    mainPath: `
      M55,260 
      L40,300
      L85,300
      L88,275
      L100,273
      L112,275
      L115,300
      L160,300
      L145,260
      Q100,252 55,260
      Z
    `,
    detailsPath: `
      M100,260 L100,273
    `,
    defaultColor: "#60A5FA",
    colorizable: true,
    length: "full",
    fit: "wide",
    rarity: "uncommon",
    sortOrder: 4,
    tags: ["trendy", "denim"],
  },
  {
    id: "bottom_jeans_highwaist",
    name: "High-Waist Jeans",
    description: "High-waisted jeans",
    category: "jeans",
    mainPath: `
      M58,255 
      L55,300
      L75,300
      L80,278
      L100,276
      L120,278
      L125,300
      L145,300
      L142,255
      Q100,248 58,255
      Z
    `,
    detailsPath: `
      M100,257 L100,276
      M58,255 Q100,248 142,255 L140,262 Q100,255 60,262 Z
    `,
    defaultColor: "#1E3A8A",
    colorizable: true,
    length: "full",
    fit: "regular",
    rarity: "uncommon",
    sortOrder: 5,
    tags: ["trendy", "denim"],
  },
  {
    id: "bottom_jeans_ripped",
    name: "Ripped Jeans",
    description: "Distressed ripped jeans",
    category: "jeans",
    mainPath: `
      M58,260 
      L55,300
      L75,300
      L80,278
      L100,276
      L120,278
      L125,300
      L145,300
      L142,260
      Q100,255 58,260
      Z
    `,
    detailsPath: `
      M100,262 L100,276
      M65,275 L70,280 M68,277 L72,282 M66,279 L71,284
      M130,275 L135,280 M133,277 L137,282
    `,
    defaultColor: "#60A5FA",
    colorizable: true,
    length: "full",
    fit: "regular",
    rarity: "rare",
    sortOrder: 6,
    tags: ["trendy", "edgy", "denim"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PANTS (6)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bottom_pants_chinos",
    name: "Chinos",
    description: "Classic chino pants",
    category: "pants",
    mainPath: `
      M58,260 
      L55,300
      L78,300
      L82,278
      L100,276
      L118,278
      L122,300
      L145,300
      L142,260
      Q100,255 58,260
      Z
    `,
    detailsPath: `
      M65,268 L72,268 L72,283 L65,283 Z
      M128,268 L135,268 L135,283 L128,283 Z
    `,
    defaultColor: "#D4A574",
    colorizable: true,
    colorOptions: ["#D4A574", "#1F2937", "#7C2D12", "#065F46", "#1E3A8A"],
    length: "full",
    fit: "regular",
    rarity: "common",
    sortOrder: 10,
    tags: ["casual", "classic", "smart"],
  },
  {
    id: "bottom_pants_dress",
    name: "Dress Pants",
    description: "Formal dress pants",
    category: "dress_pants",
    mainPath: `
      M60,258 
      L58,300
      L78,300
      L82,277
      L100,275
      L118,277
      L122,300
      L142,300
      L140,258
      Q100,252 60,258
      Z
    `,
    detailsPath: `
      M100,260 L100,275
    `,
    shadowPath: `
      M65,275 L72,300 L65,300 Z
      M135,275 L128,300 L135,300 Z
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    colorOptions: ["#1F2937", "#000000", "#1E3A8A", "#4B5563"],
    length: "full",
    fit: "regular",
    rarity: "uncommon",
    sortOrder: 11,
    tags: ["formal", "business", "elegant"],
  },
  {
    id: "bottom_pants_cargo",
    name: "Cargo Pants",
    description: "Utility cargo pants with pockets",
    category: "pants",
    mainPath: `
      M55,260 
      L50,300
      L80,300
      L85,275
      L100,273
      L115,275
      L120,300
      L150,300
      L145,260
      Q100,252 55,260
      Z
    `,
    detailsPath: `
      M58,270 L72,270 L72,290 L58,290 Z
      M128,270 L142,270 L142,290 L128,290 Z
      M62,278 L68,278
      M132,278 L138,278
    `,
    defaultColor: "#78716C",
    colorizable: true,
    colorOptions: ["#78716C", "#1F2937", "#65A30D", "#92400E"],
    length: "full",
    fit: "loose",
    rarity: "uncommon",
    sortOrder: 12,
    tags: ["casual", "utility", "military"],
  },
  {
    id: "bottom_pants_wide",
    name: "Wide-Leg Pants",
    description: "Flowing wide-leg pants",
    category: "pants",
    mainPath: `
      M52,260 
      L35,300
      L90,300
      L92,272
      L100,270
      L108,272
      L110,300
      L165,300
      L148,260
      Q100,250 52,260
      Z
    `,
    defaultColor: "#000000",
    colorizable: true,
    length: "full",
    fit: "wide",
    rarity: "uncommon",
    sortOrder: 13,
    tags: ["elegant", "trendy"],
  },
  {
    id: "bottom_pants_paper_bag",
    name: "Paper Bag Pants",
    description: "High-waisted paper bag style",
    category: "pants",
    mainPath: `
      M55,252 
      L52,300
      L80,300
      L85,275
      L100,273
      L115,275
      L120,300
      L148,300
      L145,252
      Q100,242 55,252
      Z
    `,
    detailsPath: `
      M55,252 Q100,242 145,252 L142,262 Q100,255 58,262 Z
      M95,255 L95,262 L105,262 L105,255 Z
    `,
    defaultColor: "#D4A574",
    colorizable: true,
    length: "full",
    fit: "loose",
    rarity: "rare",
    sortOrder: 14,
    tags: ["trendy", "feminine"],
  },
  {
    id: "bottom_pants_culottes",
    name: "Culottes",
    description: "Wide-leg cropped culottes",
    category: "pants",
    mainPath: `
      M52,260 
      L42,290
      L88,290
      L92,268
      L100,266
      L108,268
      L112,290
      L158,290
      L148,260
      Q100,252 52,260
      Z
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    length: "midi",
    fit: "wide",
    rarity: "uncommon",
    sortOrder: 15,
    tags: ["trendy", "elegant"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHORTS (6)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bottom_shorts_casual",
    name: "Casual Shorts",
    description: "Comfortable casual shorts",
    category: "shorts",
    mainPath: `
      M55,260 
      L52,278
      L75,278
      L82,268
      L100,266
      L118,268
      L125,278
      L148,278
      L145,260
      Q100,252 55,260
      Z
    `,
    detailsPath: `
      M65,265 L72,265 L72,275 L65,275 Z
    `,
    defaultColor: "#D4A574",
    colorizable: true,
    colorOptions: ["#D4A574", "#1F2937", "#1E3A8A", "#065F46"],
    length: "short",
    fit: "regular",
    rarity: "common",
    sortOrder: 20,
    tags: ["casual", "summer"],
  },
  {
    id: "bottom_shorts_denim",
    name: "Denim Shorts",
    description: "Classic denim shorts",
    category: "shorts",
    mainPath: `
      M55,260 
      L52,280
      L75,280
      L80,270
      L100,268
      L120,270
      L125,280
      L148,280
      L145,260
      Q100,252 55,260
      Z
    `,
    detailsPath: `
      M100,262 L100,268
      M65,267 L72,267 L72,277 L65,277 Z
    `,
    defaultColor: "#3B82F6",
    colorizable: true,
    length: "short",
    fit: "regular",
    rarity: "common",
    sortOrder: 21,
    tags: ["casual", "summer", "denim"],
  },
  {
    id: "bottom_shorts_athletic",
    name: "Athletic Shorts",
    description: "Performance athletic shorts",
    category: "athletic",
    mainPath: `
      M58,260 
      L55,282
      L78,282
      L85,268
      L100,266
      L115,268
      L122,282
      L145,282
      L142,260
      Q100,252 58,260
      Z
    `,
    detailsPath: `
      M60,260 L60,280 M140,260 L140,280
    `,
    defaultColor: "#1F2937",
    secondaryColor: "#FFFFFF",
    colorizable: true,
    colorOptions: ["#1F2937", "#1E3A8A", "#DC2626", "#16A34A"],
    length: "short",
    fit: "loose",
    rarity: "common",
    sortOrder: 22,
    tags: ["athletic", "sporty", "gym"],
  },
  {
    id: "bottom_shorts_running",
    name: "Running Shorts",
    description: "Lightweight running shorts",
    category: "athletic",
    mainPath: `
      M60,260 
      L58,278
      L80,278
      L88,266
      L100,264
      L112,266
      L120,278
      L142,278
      L140,260
      Q100,254 60,260
      Z
    `,
    defaultColor: "#3B82F6",
    colorizable: true,
    length: "mini",
    fit: "loose",
    rarity: "uncommon",
    sortOrder: 23,
    tags: ["athletic", "running"],
  },
  {
    id: "bottom_shorts_bermuda",
    name: "Bermuda Shorts",
    description: "Knee-length bermuda shorts",
    category: "shorts",
    mainPath: `
      M55,260 
      L52,290
      L78,290
      L82,272
      L100,270
      L118,272
      L122,290
      L148,290
      L145,260
      Q100,252 55,260
      Z
    `,
    detailsPath: `
      M65,268 L73,268 L73,285 L65,285 Z
    `,
    defaultColor: "#D4A574",
    colorizable: true,
    length: "knee",
    fit: "regular",
    rarity: "common",
    sortOrder: 24,
    tags: ["casual", "summer", "smart"],
  },
  {
    id: "bottom_shorts_biker",
    name: "Biker Shorts",
    description: "Fitted biker shorts",
    category: "athletic",
    mainPath: `
      M62,260 
      L60,285
      L75,285
      L82,268
      L100,266
      L118,268
      L125,285
      L140,285
      L138,260
      Q100,254 62,260
      Z
    `,
    defaultColor: "#000000",
    colorizable: true,
    colorOptions: ["#000000", "#1F2937", "#EC4899", "#8B5CF6"],
    length: "short",
    fit: "tight",
    rarity: "uncommon",
    sortOrder: 25,
    tags: ["athletic", "trendy"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SKIRTS (6)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bottom_skirt_mini",
    name: "Mini Skirt",
    description: "Classic mini skirt",
    category: "skirt",
    mainPath: `
      M55,260 
      L50,278
      L150,278
      L145,260
      Q100,252 55,260
      Z
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    colorOptions: ["#1F2937", "#000000", "#DC2626", "#EC4899", "#3B82F6"],
    length: "mini",
    fit: "regular",
    rarity: "common",
    sortOrder: 30,
    tags: ["feminine", "casual"],
  },
  {
    id: "bottom_skirt_denim",
    name: "Denim Skirt",
    description: "Classic denim skirt",
    category: "skirt",
    mainPath: `
      M55,260 
      L48,285
      L152,285
      L145,260
      Q100,252 55,260
      Z
    `,
    detailsPath: `
      M65,268 L72,268 L72,280 L65,280 Z
      M100,262 L100,285
    `,
    defaultColor: "#3B82F6",
    colorizable: true,
    length: "short",
    fit: "regular",
    rarity: "common",
    sortOrder: 31,
    tags: ["casual", "denim"],
  },
  {
    id: "bottom_skirt_pleated",
    name: "Pleated Skirt",
    description: "Classic pleated skirt",
    category: "skirt",
    mainPath: `
      M55,260 
      L45,295
      L155,295
      L145,260
      Q100,252 55,260
      Z
    `,
    detailsPath: `
      M55,262 L48,295 M70,262 L65,295 M85,262 L82,295 M100,262 L100,295
      M115,262 L118,295 M130,262 L135,295 M145,262 L152,295
    `,
    defaultColor: "#1E3A8A",
    colorizable: true,
    length: "knee",
    fit: "regular",
    rarity: "uncommon",
    sortOrder: 32,
    tags: ["preppy", "classic"],
  },
  {
    id: "bottom_skirt_midi",
    name: "Midi Skirt",
    description: "Elegant midi-length skirt",
    category: "skirt",
    mainPath: `
      M55,260 
      L48,300
      L152,300
      L145,260
      Q100,252 55,260
      Z
    `,
    shadowPath: `
      M60,275 Q75,280 80,300 L55,300 Z
      M140,275 Q125,280 120,300 L145,300 Z
    `,
    defaultColor: "#000000",
    colorizable: true,
    length: "midi",
    fit: "regular",
    rarity: "uncommon",
    sortOrder: 33,
    tags: ["elegant", "classic"],
  },
  {
    id: "bottom_skirt_aline",
    name: "A-Line Skirt",
    description: "Flattering A-line cut",
    category: "skirt",
    mainPath: `
      M58,260 
      L42,300
      L158,300
      L142,260
      Q100,250 58,260
      Z
    `,
    defaultColor: "#DC2626",
    colorizable: true,
    length: "knee",
    fit: "regular",
    rarity: "uncommon",
    sortOrder: 34,
    tags: ["feminine", "classic"],
  },
  {
    id: "bottom_skirt_pencil",
    name: "Pencil Skirt",
    description: "Fitted pencil skirt",
    category: "skirt",
    mainPath: `
      M62,260 
      L60,300
      L140,300
      L138,260
      Q100,254 62,260
      Z
    `,
    detailsPath: `
      M98,292 L102,292 L102,300 L98,300 Z
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    colorOptions: ["#1F2937", "#000000", "#1E3A8A", "#7C2D12"],
    length: "knee",
    fit: "tight",
    rarity: "rare",
    sortOrder: 35,
    tags: ["formal", "business", "elegant"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SWEATPANTS & LEGGINGS (6)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "bottom_sweatpants_basic",
    name: "Sweatpants",
    description: "Comfortable sweatpants",
    category: "sweatpants",
    mainPath: `
      M55,260 
      L50,295
      Q52,300 60,300
      L78,300
      L82,275
      L100,273
      L118,275
      L122,300
      L140,300
      Q148,300 150,295
      L145,260
      Q100,250 55,260
      Z
    `,
    detailsPath: `
      M90,262 L90,273 L110,273 L110,262 Z
    `,
    defaultColor: "#4B5563",
    colorizable: true,
    colorOptions: ["#4B5563", "#1F2937", "#000000", "#1E3A8A", "#065F46"],
    length: "full",
    fit: "loose",
    rarity: "common",
    sortOrder: 40,
    tags: ["casual", "cozy", "loungewear"],
  },
  {
    id: "bottom_joggers",
    name: "Joggers",
    description: "Tapered jogger pants",
    category: "sweatpants",
    mainPath: `
      M58,260 
      L55,290
      Q58,298 68,298
      L80,298
      L85,275
      L100,273
      L115,275
      L120,298
      L132,298
      Q142,298 145,290
      L142,260
      Q100,252 58,260
      Z
    `,
    detailsPath: `
      M65,265 L72,265 L72,278 L65,278 Z
      M55,290 Q68,288 80,290 M145,290 Q132,288 120,290
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    length: "full",
    fit: "regular",
    rarity: "common",
    sortOrder: 41,
    tags: ["casual", "athletic", "streetwear"],
  },
  {
    id: "bottom_leggings",
    name: "Leggings",
    description: "Fitted stretch leggings",
    category: "leggings",
    mainPath: `
      M65,260 
      L62,300
      L72,300
      L80,275
      L100,273
      L120,275
      L128,300
      L138,300
      L135,260
      Q100,255 65,260
      Z
    `,
    defaultColor: "#000000",
    colorizable: true,
    colorOptions: ["#000000", "#1F2937", "#7C3AED", "#EC4899"],
    length: "full",
    fit: "tight",
    rarity: "common",
    sortOrder: 42,
    tags: ["athletic", "casual", "comfortable"],
  },
  {
    id: "bottom_leggings_patterned",
    name: "Patterned Leggings",
    description: "Stylish patterned leggings",
    category: "leggings",
    mainPath: `
      M65,260 
      L62,300
      L72,300
      L80,275
      L100,273
      L120,275
      L128,300
      L138,300
      L135,260
      Q100,255 65,260
      Z
    `,
    detailsPath: `
      M68,268 L70,275 L72,268 L74,275 L76,268
      M124,268 L126,275 L128,268 L130,275 L132,268
      M68,285 L70,292 L72,285 L74,292
      M128,285 L130,292 L132,285
    `,
    defaultColor: "#4B5563",
    secondaryColor: "#9CA3AF",
    colorizable: true,
    length: "full",
    fit: "tight",
    rarity: "uncommon",
    sortOrder: 43,
    tags: ["athletic", "trendy"],
  },
  {
    id: "bottom_yoga_pants",
    name: "Yoga Pants",
    description: "High-waisted yoga pants",
    category: "leggings",
    mainPath: `
      M62,255 
      L58,300
      L72,300
      L80,273
      L100,270
      L120,273
      L128,300
      L142,300
      L138,255
      Q100,248 62,255
      Z
    `,
    detailsPath: `
      M62,255 Q100,248 138,255 L136,262 Q100,255 64,262 Z
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    length: "full",
    fit: "tight",
    rarity: "uncommon",
    sortOrder: 44,
    tags: ["athletic", "yoga"],
  },
  {
    id: "bottom_track_pants",
    name: "Track Pants",
    description: "Athletic track pants with stripes",
    category: "athletic",
    mainPath: `
      M55,260 
      L50,300
      L78,300
      L82,275
      L100,273
      L118,275
      L122,300
      L150,300
      L145,260
      Q100,252 55,260
      Z
    `,
    detailsPath: `
      M55,262 L55,300 M58,262 L58,300
      M145,262 L145,300 M142,262 L142,300
    `,
    defaultColor: "#1F2937",
    secondaryColor: "#FFFFFF",
    colorizable: true,
    length: "full",
    fit: "regular",
    rarity: "uncommon",
    sortOrder: 45,
    tags: ["athletic", "sporty", "streetwear"],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Default clothing bottom ID
 */
export const DEFAULT_CLOTHING_BOTTOM: ClothingBottomId = "bottom_jeans_regular";

/**
 * Get clothing bottom data by ID
 * @throws Error if not found
 */
export function getClothingBottom(id: ClothingBottomId): ClothingBottomData {
  const bottom = CLOTHING_BOTTOMS.find((b) => b.id === id);
  if (!bottom) {
    throw new Error(`Clothing bottom not found: ${id}`);
  }
  return bottom;
}

/**
 * Get clothing bottom data with fallback to null
 */
export function getClothingBottomSafe(
  id: ClothingBottomId | null,
): ClothingBottomData | null {
  if (!id || id === "bottom_none") return null;
  const bottom = CLOTHING_BOTTOMS.find((b) => b.id === id);
  return bottom ?? null;
}

/**
 * Get clothing bottoms by category
 */
export function getClothingBottomsByCategory(
  category: ClothingBottomCategory,
): ClothingBottomData[] {
  return CLOTHING_BOTTOMS.filter(
    (b) => b.category === category && b.id !== "bottom_none",
  );
}

/**
 * Get clothing bottoms by length
 */
export function getClothingBottomsByLength(
  length: BottomLength,
): ClothingBottomData[] {
  return CLOTHING_BOTTOMS.filter(
    (b) => b.length === length && b.id !== "bottom_none",
  );
}

/**
 * Get all clothing bottom IDs
 */
export function getAllClothingBottomIds(): ClothingBottomId[] {
  return CLOTHING_BOTTOMS.map((b) => b.id);
}

/**
 * Get colorizable bottoms only
 */
export function getColorizableBottoms(): ClothingBottomData[] {
  return CLOTHING_BOTTOMS.filter(
    (b) => b.colorizable && b.id !== "bottom_none",
  );
}
