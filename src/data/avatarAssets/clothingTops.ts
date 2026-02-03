/**
 * Clothing Tops Definitions
 *
 * 30 clothing top items with SVG paths for avatar customization.
 * Tops render over the body/torso layer.
 */

import type { ClothingTopId } from "@/types/avatar";

/**
 * Clothing rarity levels (matching existing cosmetics system)
 */
export type ClothingRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

/**
 * Clothing top category
 */
export type ClothingTopCategory =
  | "tshirt"
  | "shirt"
  | "tank"
  | "sweater"
  | "hoodie"
  | "jacket"
  | "coat"
  | "blouse"
  | "crop"
  | "uniform";

/**
 * Sleeve type for tops
 */
export type SleeveType = "none" | "short" | "three_quarter" | "long";

/**
 * Neckline type for tops
 */
export type NecklineType =
  | "crew"
  | "v_neck"
  | "scoop"
  | "collar"
  | "turtle"
  | "off_shoulder"
  | "halter";

/**
 * Clothing top data structure
 */
export interface ClothingTopData {
  /** Unique identifier */
  id: ClothingTopId;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: ClothingTopCategory;
  /** SVG path for main garment */
  mainPath: string;
  /** SVG path for details (buttons, pockets, etc.) */
  detailsPath?: string;
  /** SVG path for shading/folds */
  shadowPath?: string;
  /** SVG path for sleeves (if separate) */
  sleevesPath?: string;
  /** Default fill color */
  defaultColor: string;
  /** Secondary color (for details) */
  secondaryColor?: string;
  /** Whether user can customize color */
  colorizable: boolean;
  /** Available color options (if limited) */
  colorOptions?: string[];
  /** Sleeve type */
  sleeveType: SleeveType;
  /** Neckline type */
  necklineType: NecklineType;
  /** Whether this is a base layer or outer layer */
  layer: "base" | "outer";
  /** Rarity for unlock system */
  rarity: ClothingRarity;
  /** Sorting order in UI */
  sortOrder: number;
  /** Tags for filtering */
  tags: string[];
}

/**
 * Complete clothing tops catalog
 */
export const CLOTHING_TOPS: ClothingTopData[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // T-SHIRTS (10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "top_none",
    name: "No Top",
    description: "No top clothing (shows skin)",
    category: "tshirt",
    mainPath: "",
    defaultColor: "transparent",
    colorizable: false,
    sleeveType: "none",
    necklineType: "crew",
    layer: "base",
    rarity: "common",
    sortOrder: 0,
    tags: [],
  },
  {
    id: "top_tshirt_basic",
    name: "Basic Tee",
    description: "A classic, comfortable t-shirt",
    category: "tshirt",
    mainPath: `
      M65,190 
      Q58,198 52,220 
      L50,285 
      L150,285 
      L148,220 
      Q142,198 135,190
      Q118,185 100,185
      Q82,185 65,190
      Z
    `,
    sleevesPath: `
      M52,198 L35,210 L32,250 L48,248 L50,215 Z
      M148,198 L165,210 L168,250 L152,248 L150,215 Z
    `,
    shadowPath: `
      M70,220 Q100,230 130,220 L128,240 Q100,235 72,240 Z
    `,
    defaultColor: "#FFFFFF",
    colorizable: true,
    colorOptions: [
      "#FFFFFF",
      "#000000",
      "#1E3A8A",
      "#DC2626",
      "#16A34A",
      "#7C3AED",
      "#F59E0B",
      "#EC4899",
    ],
    sleeveType: "short",
    necklineType: "crew",
    layer: "base",
    rarity: "common",
    sortOrder: 1,
    tags: ["casual", "basic"],
  },
  {
    id: "top_tshirt_vneck",
    name: "V-Neck Tee",
    description: "Casual v-neck t-shirt",
    category: "tshirt",
    mainPath: `
      M65,192 
      L52,220 
      L50,285 
      L150,285 
      L148,220 
      L135,192
      L118,188
      L100,200
      L82,188
      L65,192
      Z
    `,
    sleevesPath: `
      M52,198 L35,212 L32,248 L48,246 L50,218 Z
      M148,198 L165,212 L168,248 L152,246 L150,218 Z
    `,
    defaultColor: "#4A5568",
    colorizable: true,
    colorOptions: ["#4A5568", "#FFFFFF", "#000000", "#1E3A8A", "#991B1B"],
    sleeveType: "short",
    necklineType: "v_neck",
    layer: "base",
    rarity: "common",
    sortOrder: 2,
    tags: ["casual"],
  },
  {
    id: "top_tshirt_graphic",
    name: "Graphic Tee",
    description: "T-shirt with a fun print",
    category: "tshirt",
    mainPath: `
      M65,190 
      Q58,198 52,220 
      L50,285 
      L150,285 
      L148,220 
      Q142,198 135,190
      Q118,185 100,185
      Q82,185 65,190
      Z
    `,
    sleevesPath: `
      M52,198 L35,210 L32,250 L48,248 L50,215 Z
      M148,198 L165,210 L168,250 L152,248 L150,215 Z
    `,
    detailsPath: `
      M75,220 L125,220 L125,260 L75,260 Z
    `,
    defaultColor: "#1F2937",
    secondaryColor: "#F59E0B",
    colorizable: true,
    sleeveType: "short",
    necklineType: "crew",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 3,
    tags: ["casual", "fun"],
  },
  {
    id: "top_tshirt_striped",
    name: "Striped Tee",
    description: "Classic striped t-shirt",
    category: "tshirt",
    mainPath: `
      M65,190 
      Q58,198 52,220 
      L50,285 
      L150,285 
      L148,220 
      Q142,198 135,190
      Q118,185 100,185
      Q82,185 65,190
      Z
    `,
    sleevesPath: `
      M52,198 L35,210 L32,250 L48,248 L50,215 Z
      M148,198 L165,210 L168,250 L152,248 L150,215 Z
    `,
    detailsPath: `
      M55,210 L145,210 M55,225 L145,225 M55,240 L145,240 M55,255 L145,255 M55,270 L145,270
    `,
    defaultColor: "#FFFFFF",
    secondaryColor: "#1E3A8A",
    colorizable: true,
    sleeveType: "short",
    necklineType: "crew",
    layer: "base",
    rarity: "common",
    sortOrder: 4,
    tags: ["casual", "classic"],
  },
  {
    id: "top_tshirt_pocket",
    name: "Pocket Tee",
    description: "T-shirt with chest pocket",
    category: "tshirt",
    mainPath: `
      M65,190 
      Q58,198 52,220 
      L50,285 
      L150,285 
      L148,220 
      Q142,198 135,190
      Q118,185 100,185
      Q82,185 65,190
      Z
    `,
    sleevesPath: `
      M52,198 L35,210 L32,250 L48,248 L50,215 Z
      M148,198 L165,210 L168,250 L152,248 L150,215 Z
    `,
    detailsPath: `
      M110,205 L130,205 L130,225 L110,225 Z
    `,
    defaultColor: "#059669",
    colorizable: true,
    sleeveType: "short",
    necklineType: "crew",
    layer: "base",
    rarity: "common",
    sortOrder: 5,
    tags: ["casual"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TANK TOPS (4)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "top_tank_basic",
    name: "Tank Top",
    description: "Simple tank top",
    category: "tank",
    mainPath: `
      M72,190 
      Q65,200 60,225 
      L58,285 
      L142,285 
      L140,225 
      Q135,200 128,190
      Q115,185 100,185
      Q85,185 72,190
      Z
    `,
    defaultColor: "#FFFFFF",
    colorizable: true,
    colorOptions: ["#FFFFFF", "#000000", "#DC2626", "#2563EB", "#16A34A"],
    sleeveType: "none",
    necklineType: "scoop",
    layer: "base",
    rarity: "common",
    sortOrder: 10,
    tags: ["casual", "summer"],
  },
  {
    id: "top_tank_athletic",
    name: "Athletic Tank",
    description: "Performance athletic tank",
    category: "tank",
    mainPath: `
      M75,188 
      Q68,198 62,222 
      L60,285 
      L140,285 
      L138,222 
      Q132,198 125,188
      Q112,184 100,184
      Q88,184 75,188
      Z
    `,
    detailsPath: `
      M70,200 L72,280 M128,200 L130,280
    `,
    defaultColor: "#3B82F6",
    colorizable: true,
    sleeveType: "none",
    necklineType: "scoop",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 11,
    tags: ["athletic", "sporty"],
  },
  {
    id: "top_tank_racerback",
    name: "Racerback Tank",
    description: "Sporty racerback style",
    category: "tank",
    mainPath: `
      M78,188 
      L65,205 
      L62,285 
      L138,285 
      L135,205 
      L122,188
      Q110,184 100,184
      Q90,184 78,188
      Z
    `,
    defaultColor: "#EC4899",
    colorizable: true,
    sleeveType: "none",
    necklineType: "scoop",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 12,
    tags: ["athletic", "feminine"],
  },
  {
    id: "top_tank_muscle",
    name: "Muscle Tank",
    description: "Loose fit muscle tank",
    category: "tank",
    mainPath: `
      M68,190 
      Q60,202 55,228 
      L52,285 
      L148,285 
      L145,228 
      Q140,202 132,190
      Q115,185 100,185
      Q85,185 68,190
      Z
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    sleeveType: "none",
    necklineType: "crew",
    layer: "base",
    rarity: "common",
    sortOrder: 13,
    tags: ["casual", "gym"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUTTON-DOWN SHIRTS (4)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "top_shirt_button",
    name: "Button-Down Shirt",
    description: "Classic button-down shirt",
    category: "shirt",
    mainPath: `
      M62,188 
      Q55,200 48,225 
      L45,285 
      L155,285 
      L152,225 
      Q145,200 138,188
      Q118,182 100,182
      Q82,182 62,188
      Z
    `,
    sleevesPath: `
      M48,200 L28,215 L25,270 L45,268 L48,220 Z
      M152,200 L172,215 L175,270 L155,268 L152,220 Z
    `,
    detailsPath: `
      M98,190 L98,285 M102,190 L102,285
      M98,210 L102,210 M98,230 L102,230 M98,250 L102,250 M98,270 L102,270
    `,
    defaultColor: "#FFFFFF",
    secondaryColor: "#CBD5E1",
    colorizable: true,
    sleeveType: "long",
    necklineType: "collar",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 20,
    tags: ["formal", "classic", "business"],
  },
  {
    id: "top_shirt_oxford",
    name: "Oxford Shirt",
    description: "Classic oxford button-down",
    category: "shirt",
    mainPath: `
      M62,188 
      Q55,200 48,225 
      L45,285 
      L155,285 
      L152,225 
      Q145,200 138,188
      Q118,182 100,182
      Q82,182 62,188
      Z
    `,
    sleevesPath: `
      M48,200 L28,215 L25,270 L45,268 L48,220 Z
      M152,200 L172,215 L175,270 L155,268 L152,220 Z
    `,
    detailsPath: `
      M98,190 L98,285
      M98,210 L102,210 M98,235 L102,235 M98,260 L102,260
    `,
    defaultColor: "#93C5FD",
    colorizable: true,
    sleeveType: "long",
    necklineType: "collar",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 21,
    tags: ["formal", "preppy"],
  },
  {
    id: "top_shirt_flannel",
    name: "Flannel Shirt",
    description: "Cozy flannel button-down",
    category: "shirt",
    mainPath: `
      M62,188 
      Q55,200 48,225 
      L45,285 
      L155,285 
      L152,225 
      Q145,200 138,188
      Q118,182 100,182
      Q82,182 62,188
      Z
    `,
    sleevesPath: `
      M48,200 L28,215 L25,270 L45,268 L48,220 Z
      M152,200 L172,215 L175,270 L155,268 L152,220 Z
    `,
    detailsPath: `
      M50,205 L150,205 M50,225 L150,225 M50,245 L150,245 M50,265 L150,265
      M70,190 L70,285 M100,190 L100,285 M130,190 L130,285
    `,
    defaultColor: "#991B1B",
    secondaryColor: "#1F2937",
    colorizable: true,
    sleeveType: "long",
    necklineType: "collar",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 22,
    tags: ["casual", "cozy", "fall"],
  },
  {
    id: "top_shirt_denim",
    name: "Denim Shirt",
    description: "Classic denim button-down",
    category: "shirt",
    mainPath: `
      M62,188 
      Q55,200 48,225 
      L45,285 
      L155,285 
      L152,225 
      Q145,200 138,188
      Q118,182 100,182
      Q82,182 62,188
      Z
    `,
    sleevesPath: `
      M48,200 L28,215 L25,270 L45,268 L48,220 Z
      M152,200 L172,215 L175,270 L155,268 L152,220 Z
    `,
    detailsPath: `
      M70,200 L90,200 L90,225 L70,225 Z
      M110,200 L130,200 L130,225 L110,225 Z
      M98,192 L98,285
    `,
    defaultColor: "#3B82F6",
    colorizable: true,
    sleeveType: "long",
    necklineType: "collar",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 23,
    tags: ["casual", "denim"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SWEATERS (4)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "top_sweater_crew",
    name: "Crewneck Sweater",
    description: "Classic crewneck sweater",
    category: "sweater",
    mainPath: `
      M62,188 
      Q52,202 45,230 
      L42,285 
      L158,285 
      L155,230 
      Q148,202 138,188
      Q118,182 100,182
      Q82,182 62,188
      Z
    `,
    sleevesPath: `
      M45,202 L22,220 L18,275 L42,272 L45,225 Z
      M155,202 L178,220 L182,275 L158,272 L155,225 Z
    `,
    detailsPath: `
      M62,188 Q100,175 138,188
    `,
    defaultColor: "#4B5563",
    colorizable: true,
    colorOptions: [
      "#4B5563",
      "#1F2937",
      "#7C2D12",
      "#1E3A8A",
      "#166534",
      "#7C3AED",
    ],
    sleeveType: "long",
    necklineType: "crew",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 30,
    tags: ["casual", "cozy", "fall", "winter"],
  },
  {
    id: "top_sweater_vneck",
    name: "V-Neck Sweater",
    description: "Elegant v-neck sweater",
    category: "sweater",
    mainPath: `
      M62,190 
      L45,230 
      L42,285 
      L158,285 
      L155,230 
      L138,190
      L120,185
      L100,198
      L80,185
      L62,190
      Z
    `,
    sleevesPath: `
      M45,205 L22,222 L18,275 L42,272 L45,228 Z
      M155,205 L178,222 L182,275 L158,272 L155,228 Z
    `,
    defaultColor: "#1F2937",
    colorizable: true,
    sleeveType: "long",
    necklineType: "v_neck",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 31,
    tags: ["formal", "preppy"],
  },
  {
    id: "top_sweater_turtleneck",
    name: "Turtleneck",
    description: "Cozy turtleneck sweater",
    category: "sweater",
    mainPath: `
      M62,175 
      Q55,185 52,200
      L45,230 
      L42,285 
      L158,285 
      L155,230 
      L148,200
      Q145,185 138,175
      Q118,170 100,170
      Q82,170 62,175
      Z
    `,
    sleevesPath: `
      M52,200 L25,218 L20,275 L45,272 L48,225 Z
      M148,200 L175,218 L180,275 L155,272 L152,225 Z
    `,
    detailsPath: `
      M62,175 Q100,165 138,175 Q138,185 138,188 Q100,178 62,188 Q62,185 62,175 Z
    `,
    defaultColor: "#78350F",
    colorizable: true,
    sleeveType: "long",
    necklineType: "turtle",
    layer: "base",
    rarity: "rare",
    sortOrder: 32,
    tags: ["cozy", "winter", "elegant"],
  },
  {
    id: "top_sweater_cardigan",
    name: "Cardigan",
    description: "Open-front cardigan",
    category: "sweater",
    mainPath: `
      M62,188 
      Q52,202 45,230 
      L42,285 
      L158,285 
      L155,230 
      Q148,202 138,188
      Q118,182 100,182
      Q82,182 62,188
      Z
    `,
    sleevesPath: `
      M45,202 L22,220 L18,275 L42,272 L45,225 Z
      M155,202 L178,220 L182,275 L158,272 L155,225 Z
    `,
    detailsPath: `
      M95,190 L95,285 M105,190 L105,285
      M95,210 L105,210 M95,235 L105,235 M95,260 L105,260
    `,
    defaultColor: "#6B7280",
    colorizable: true,
    sleeveType: "long",
    necklineType: "v_neck",
    layer: "outer",
    rarity: "uncommon",
    sortOrder: 33,
    tags: ["casual", "layering"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HOODIES (4)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "top_hoodie_basic",
    name: "Basic Hoodie",
    description: "Classic pullover hoodie",
    category: "hoodie",
    mainPath: `
      M58,185 
      Q48,200 40,232 
      L38,285 
      L162,285 
      L160,232 
      Q152,200 142,185
      Q120,178 100,178
      Q80,178 58,185
      Z
    `,
    sleevesPath: `
      M40,200 L15,220 L10,280 L38,277 L40,228 Z
      M160,200 L185,220 L190,280 L162,277 L160,228 Z
    `,
    detailsPath: `
      M75,195 L85,285 L115,285 L125,195 Z
      M58,185 Q100,165 142,185 Q130,172 100,172 Q70,172 58,185 Z
    `,
    defaultColor: "#4B5563",
    colorizable: true,
    colorOptions: [
      "#4B5563",
      "#1F2937",
      "#DC2626",
      "#1E3A8A",
      "#16A34A",
      "#7C3AED",
    ],
    sleeveType: "long",
    necklineType: "crew",
    layer: "outer",
    rarity: "uncommon",
    sortOrder: 40,
    tags: ["casual", "cozy", "streetwear"],
  },
  {
    id: "top_hoodie_zip",
    name: "Zip Hoodie",
    description: "Hoodie with front zipper",
    category: "hoodie",
    mainPath: `
      M58,185 
      Q48,200 40,232 
      L38,285 
      L162,285 
      L160,232 
      Q152,200 142,185
      Q120,178 100,178
      Q80,178 58,185
      Z
    `,
    sleevesPath: `
      M40,200 L15,220 L10,280 L38,277 L40,228 Z
      M160,200 L185,220 L190,280 L162,277 L160,228 Z
    `,
    detailsPath: `
      M98,190 L98,285 M102,190 L102,285
      M58,185 Q100,165 142,185 Q130,172 100,172 Q70,172 58,185 Z
      M60,230 L80,230 L80,260 L60,260 Z
      M120,230 L140,230 L140,260 L120,260 Z
    `,
    defaultColor: "#1F2937",
    secondaryColor: "#6B7280",
    colorizable: true,
    sleeveType: "long",
    necklineType: "collar",
    layer: "outer",
    rarity: "uncommon",
    sortOrder: 41,
    tags: ["casual", "cozy", "streetwear"],
  },
  {
    id: "top_hoodie_crop",
    name: "Cropped Hoodie",
    description: "Trendy cropped hoodie",
    category: "hoodie",
    mainPath: `
      M60,185 
      Q50,198 45,220 
      L45,250 
      L155,250 
      L155,220 
      Q150,198 140,185
      Q120,178 100,178
      Q80,178 60,185
      Z
    `,
    sleevesPath: `
      M45,198 L22,215 L20,260 L42,258 L45,218 Z
      M155,198 L178,215 L180,260 L158,258 L155,218 Z
    `,
    detailsPath: `
      M60,185 Q100,165 140,185 Q128,172 100,172 Q72,172 60,185 Z
    `,
    defaultColor: "#EC4899",
    colorizable: true,
    sleeveType: "long",
    necklineType: "crew",
    layer: "outer",
    rarity: "rare",
    sortOrder: 42,
    tags: ["trendy", "feminine"],
  },
  {
    id: "top_hoodie_oversized",
    name: "Oversized Hoodie",
    description: "Extra comfy oversized fit",
    category: "hoodie",
    mainPath: `
      M52,182 
      Q38,198 30,235 
      L28,290 
      L172,290 
      L170,235 
      Q162,198 148,182
      Q122,172 100,172
      Q78,172 52,182
      Z
    `,
    sleevesPath: `
      M30,200 L2,225 L-5,288 L28,285 L30,232 Z
      M170,200 L198,225 L205,288 L172,285 L170,232 Z
    `,
    detailsPath: `
      M70,195 L85,290 L115,290 L130,195 Z
      M52,182 Q100,158 148,182 Q132,165 100,165 Q68,165 52,182 Z
    `,
    defaultColor: "#6B7280",
    colorizable: true,
    sleeveType: "long",
    necklineType: "crew",
    layer: "outer",
    rarity: "rare",
    sortOrder: 43,
    tags: ["casual", "cozy", "oversized"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JACKETS (4)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "top_jacket_denim",
    name: "Denim Jacket",
    description: "Classic denim jacket",
    category: "jacket",
    mainPath: `
      M55,185 
      Q45,200 38,230 
      L35,285 
      L165,285 
      L162,230 
      Q155,200 145,185
      Q122,178 100,178
      Q78,178 55,185
      Z
    `,
    sleevesPath: `
      M38,200 L15,218 L12,278 L35,275 L38,225 Z
      M162,200 L185,218 L188,278 L165,275 L162,225 Z
    `,
    detailsPath: `
      M95,188 L95,285 M105,188 L105,285
      M55,200 L75,200 L75,225 L55,225 Z
      M125,200 L145,200 L145,225 L125,225 Z
      M55,235 L75,235 L75,270 L55,270 Z
      M125,235 L145,235 L145,270 L125,270 Z
    `,
    defaultColor: "#3B82F6",
    colorizable: true,
    sleeveType: "long",
    necklineType: "collar",
    layer: "outer",
    rarity: "rare",
    sortOrder: 50,
    tags: ["casual", "classic", "denim"],
  },
  {
    id: "top_jacket_leather",
    name: "Leather Jacket",
    description: "Edgy leather jacket",
    category: "jacket",
    mainPath: `
      M55,185 
      Q45,200 38,230 
      L35,285 
      L165,285 
      L162,230 
      Q155,200 145,185
      Q122,178 100,178
      Q78,178 55,185
      Z
    `,
    sleevesPath: `
      M38,200 L15,218 L12,278 L35,275 L38,225 Z
      M162,200 L185,218 L188,278 L165,275 L162,225 Z
    `,
    detailsPath: `
      M45,185 L55,225 L45,285 Z
      M155,185 L145,225 L155,285 Z
      M95,188 L95,285
      M55,220 L70,220 M130,220 L145,220
    `,
    defaultColor: "#1F1F1F",
    secondaryColor: "#78716C",
    colorizable: true,
    colorOptions: ["#1F1F1F", "#78350F", "#7F1D1D"],
    sleeveType: "long",
    necklineType: "collar",
    layer: "outer",
    rarity: "epic",
    sortOrder: 51,
    tags: ["edgy", "cool", "classic"],
  },
  {
    id: "top_jacket_bomber",
    name: "Bomber Jacket",
    description: "Classic bomber jacket",
    category: "jacket",
    mainPath: `
      M55,185 
      Q45,200 40,230 
      L40,275 
      Q42,285 55,285
      L145,285 
      Q158,285 160,275
      L160,230 
      Q155,200 145,185
      Q122,178 100,178
      Q78,178 55,185
      Z
    `,
    sleevesPath: `
      M40,200 L18,218 L18,268 Q20,278 35,278 L40,278 L40,225 Z
      M160,200 L182,218 L182,268 Q180,278 165,278 L160,278 L160,225 Z
    `,
    detailsPath: `
      M95,188 L95,285 M105,188 L105,285
      M55,185 Q100,172 145,185 L142,192 Q100,180 58,192 Z
    `,
    defaultColor: "#065F46",
    colorizable: true,
    sleeveType: "long",
    necklineType: "collar",
    layer: "outer",
    rarity: "rare",
    sortOrder: 52,
    tags: ["casual", "military"],
  },
  {
    id: "top_jacket_blazer",
    name: "Blazer",
    description: "Tailored blazer",
    category: "jacket",
    mainPath: `
      M58,185 
      Q48,200 42,228 
      L40,285 
      L160,285 
      L158,228 
      Q152,200 142,185
      Q120,178 100,178
      Q80,178 58,185
      Z
    `,
    sleevesPath: `
      M42,200 L20,218 L18,275 L40,272 L42,225 Z
      M158,200 L180,218 L182,275 L160,272 L158,225 Z
    `,
    detailsPath: `
      M58,185 L78,205 L78,285 L85,285 L85,210 L100,188
      M142,185 L122,205 L122,285 L115,285 L115,210 L100,188
      M80,245 L85,245 M115,245 L120,245
    `,
    defaultColor: "#1E3A8A",
    colorizable: true,
    colorOptions: ["#1E3A8A", "#1F2937", "#78350F", "#000000"],
    sleeveType: "long",
    necklineType: "collar",
    layer: "outer",
    rarity: "rare",
    sortOrder: 53,
    tags: ["formal", "business", "elegant"],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CROP TOPS (4)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "top_crop_basic",
    name: "Crop Top",
    description: "Simple crop top",
    category: "crop",
    mainPath: `
      M70,190 
      Q62,200 58,218 
      L58,248 
      L142,248 
      L142,218 
      Q138,200 130,190
      Q115,185 100,185
      Q85,185 70,190
      Z
    `,
    sleevesPath: `
      M58,198 L42,210 L40,245 L55,243 L58,215 Z
      M142,198 L158,210 L160,245 L145,243 L142,215 Z
    `,
    defaultColor: "#000000",
    colorizable: true,
    colorOptions: ["#000000", "#FFFFFF", "#EC4899", "#8B5CF6", "#F59E0B"],
    sleeveType: "short",
    necklineType: "crew",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 60,
    tags: ["trendy", "summer"],
  },
  {
    id: "top_crop_halter",
    name: "Halter Crop",
    description: "Halter-neck crop top",
    category: "crop",
    mainPath: `
      M78,185 
      L100,175
      L122,185
      L130,195
      Q135,210 138,230
      L138,248 
      L62,248 
      L62,230
      Q65,210 70,195
      L78,185
      Z
    `,
    defaultColor: "#DC2626",
    colorizable: true,
    sleeveType: "none",
    necklineType: "halter",
    layer: "base",
    rarity: "rare",
    sortOrder: 61,
    tags: ["trendy", "feminine", "summer"],
  },
  {
    id: "top_crop_offShoulder",
    name: "Off-Shoulder Crop",
    description: "Off-shoulder crop top",
    category: "crop",
    mainPath: `
      M55,198 
      Q52,215 52,235
      L52,250 
      L148,250 
      L148,235
      Q148,215 145,198
      Q122,192 100,192
      Q78,192 55,198
      Z
    `,
    defaultColor: "#FFFFFF",
    colorizable: true,
    sleeveType: "none",
    necklineType: "off_shoulder",
    layer: "base",
    rarity: "rare",
    sortOrder: 62,
    tags: ["trendy", "feminine"],
  },
  {
    id: "top_crop_athletic",
    name: "Sports Bra",
    description: "Athletic sports bra",
    category: "crop",
    mainPath: `
      M72,188 
      Q65,198 62,215
      L62,240 
      L138,240 
      L138,215
      Q135,198 128,188
      Q115,184 100,184
      Q85,184 72,188
      Z
    `,
    detailsPath: `
      M72,188 Q100,178 128,188
    `,
    defaultColor: "#000000",
    colorizable: true,
    colorOptions: ["#000000", "#EC4899", "#3B82F6", "#10B981"],
    sleeveType: "none",
    necklineType: "scoop",
    layer: "base",
    rarity: "uncommon",
    sortOrder: 63,
    tags: ["athletic", "sporty"],
  },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Default clothing top ID
 */
export const DEFAULT_CLOTHING_TOP: ClothingTopId = "top_tshirt_basic";

/**
 * Get clothing top data by ID
 * @throws Error if not found
 */
export function getClothingTop(id: ClothingTopId): ClothingTopData {
  const top = CLOTHING_TOPS.find((t) => t.id === id);
  if (!top) {
    throw new Error(`Clothing top not found: ${id}`);
  }
  return top;
}

/**
 * Get clothing top data with fallback to default
 */
export function getClothingTopSafe(
  id: ClothingTopId | null,
): ClothingTopData | null {
  if (!id || id === "top_none") return null;
  const top = CLOTHING_TOPS.find((t) => t.id === id);
  return top ?? null;
}

/**
 * Get clothing tops by category
 */
export function getClothingTopsByCategory(
  category: ClothingTopCategory,
): ClothingTopData[] {
  return CLOTHING_TOPS.filter(
    (t) => t.category === category && t.id !== "top_none",
  );
}

/**
 * Get clothing tops by layer type
 */
export function getClothingTopsByLayer(
  layer: "base" | "outer",
): ClothingTopData[] {
  return CLOTHING_TOPS.filter((t) => t.layer === layer && t.id !== "top_none");
}

/**
 * Get all clothing top IDs
 */
export function getAllClothingTopIds(): ClothingTopId[] {
  return CLOTHING_TOPS.map((t) => t.id);
}

/**
 * Get colorizable tops only
 */
export function getColorizableTops(): ClothingTopData[] {
  return CLOTHING_TOPS.filter((t) => t.colorizable && t.id !== "top_none");
}
