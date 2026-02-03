/**
 * Wristwear Asset Definitions
 *
 * Contains all wristwear items for the avatar system including
 * watches, bracelets, bangles, and wrist accessories.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

// =============================================================================
// TYPES
// =============================================================================

export type WristwearCategory =
  | "watch"
  | "bracelet"
  | "bangle"
  | "smartwatch"
  | "fitness"
  | "special";

export type WristwearRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type WristwearHand = "left" | "right" | "both";

export interface WristwearData {
  id: string;
  name: string;
  description: string;
  category: WristwearCategory;
  hand: WristwearHand; // Which wrist the item appears on

  // SVG paths - wrists are near bottom of avatar viewport
  paths: {
    left: {
      band: string; // Watch band or bracelet
      face: string | null; // Watch face or main decoration
      details: string | null; // Clasps, gems, etc.
    };
    right: {
      band: string;
      face: string | null;
      details: string | null;
    };
  };

  // Colors
  colors: {
    primary: string; // Band color
    secondary: string | null; // Face/decoration color
    accent: string | null; // Details color
  };

  // Customization
  colorizable: boolean;
  colorOptions: string[] | null;

  // Metadata
  rarity: WristwearRarity;
  tags: string[];
  sortOrder: number;
}

// =============================================================================
// WRISTWEAR DATA - WATCHES (4 items)
// =============================================================================

const WRISTWEAR_WATCHES: WristwearData[] = [
  {
    id: "wristwear_none",
    name: "No Wristwear",
    description: "Keep your wrists bare",
    category: "watch",
    hand: "left",
    paths: {
      left: { band: "", face: null, details: null },
      right: { band: "", face: null, details: null },
    },
    colors: {
      primary: "transparent",
      secondary: null,
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "common",
    tags: [],
    sortOrder: 0,
  },
  {
    id: "wristwear_watch_classic",
    name: "Classic Watch",
    description: "Timeless analog watch with leather band",
    category: "watch",
    hand: "left",
    paths: {
      left: {
        band: "M25,268 L35,265 L35,275 L25,278 Z M25,282 L35,279 L35,289 L25,292 Z",
        face: "M27,275 L33,273 L33,283 L27,285 Q25,280 27,275 Z",
        details: "M29,277 L31,276 M29,279 L31,280 M30,276 L30,282", // Clock hands
      },
      right: { band: "", face: null, details: null },
    },
    colors: {
      primary: "#78350F", // Brown leather
      secondary: "#F5F5F4", // Watch face
      accent: "#1C1917", // Clock hands
    },
    colorizable: true,
    colorOptions: ["#78350F", "#1C1917", "#1E3A8A", "#DC2626"],
    rarity: "common",
    tags: ["classic", "formal", "elegant"],
    sortOrder: 1,
  },
  {
    id: "wristwear_watch_gold",
    name: "Gold Watch",
    description: "Luxurious gold watch with metal band",
    category: "watch",
    hand: "left",
    paths: {
      left: {
        band: "M25,268 L35,265 L35,275 L25,278 Z M25,282 L35,279 L35,289 L25,292 Z M27,268 L33,266 M27,290 L33,288",
        face: "M26,275 L34,272 L34,284 L26,287 Q24,281 26,275 Z",
        details:
          "M28,278 L32,276 M28,280 L32,282 M30,276 L30,283 M29,277 Q30,276 31,277", // Clock details
      },
      right: { band: "", face: null, details: null },
    },
    colors: {
      primary: "#F59E0B", // Gold
      secondary: "#1C1917", // Watch face
      accent: "#FCD34D", // Gold accents
    },
    colorizable: false,
    colorOptions: null,
    rarity: "rare",
    tags: ["luxury", "gold", "fancy"],
    sortOrder: 2,
  },
  {
    id: "wristwear_watch_silver",
    name: "Silver Watch",
    description: "Modern silver watch with metal band",
    category: "watch",
    hand: "left",
    paths: {
      left: {
        band: "M25,268 L35,265 L35,275 L25,278 Z M25,282 L35,279 L35,289 L25,292 Z M27,268 L33,266 M27,290 L33,288",
        face: "M26,275 L34,272 L34,284 L26,287 Q24,281 26,275 Z",
        details: "M28,278 L32,276 M28,280 L32,282 M30,276 L30,283",
      },
      right: { band: "", face: null, details: null },
    },
    colors: {
      primary: "#E5E7EB", // Silver
      secondary: "#1E3A8A", // Watch face (blue)
      accent: "#9CA3AF", // Silver accents
    },
    colorizable: false,
    colorOptions: null,
    rarity: "uncommon",
    tags: ["modern", "silver", "professional"],
    sortOrder: 3,
  },
];

// =============================================================================
// WRISTWEAR DATA - SMARTWATCHES & FITNESS (2 items)
// =============================================================================

const WRISTWEAR_SMART: WristwearData[] = [
  {
    id: "wristwear_smartwatch",
    name: "Smartwatch",
    description: "Modern digital smartwatch",
    category: "smartwatch",
    hand: "left",
    paths: {
      left: {
        band: "M24,267 L36,264 L36,274 L24,277 Z M24,283 L36,280 L36,290 L24,293 Z",
        face: "M25,274 L35,271 L35,285 L25,288 Q23,282 25,274 Z",
        details:
          "M27,276 L33,274 L33,278 L27,280 Z M28,281 L32,279 M28,283 L32,281", // Screen with data
      },
      right: { band: "", face: null, details: null },
    },
    colors: {
      primary: "#1C1917", // Black band
      secondary: "#1E293B", // Dark screen
      accent: "#22C55E", // Green UI elements
    },
    colorizable: true,
    colorOptions: ["#1C1917", "#F5F5F4", "#3B82F6", "#DC2626"],
    rarity: "uncommon",
    tags: ["tech", "modern", "smart"],
    sortOrder: 4,
  },
  {
    id: "wristwear_fitness_band",
    name: "Fitness Band",
    description: "Sporty fitness tracking band",
    category: "fitness",
    hand: "left",
    paths: {
      left: {
        band: "M26,268 L34,266 L34,290 L26,292 Z",
        face: "M27,276 L33,274 L33,282 L27,284 Z",
        details: "M29,277 L31,276 M29,279 L31,278 M29,281 L31,280", // Activity bars
      },
      right: { band: "", face: null, details: null },
    },
    colors: {
      primary: "#1C1917", // Black band
      secondary: "#1E293B", // Screen
      accent: "#F472B6", // Pink accents
    },
    colorizable: true,
    colorOptions: ["#1C1917", "#3B82F6", "#22C55E", "#F472B6", "#7C3AED"],
    rarity: "common",
    tags: ["sports", "fitness", "active"],
    sortOrder: 5,
  },
];

// =============================================================================
// WRISTWEAR DATA - BRACELETS (3 items)
// =============================================================================

const WRISTWEAR_BRACELETS: WristwearData[] = [
  {
    id: "wristwear_bracelet_beaded",
    name: "Beaded Bracelet",
    description: "Colorful beaded friendship bracelet",
    category: "bracelet",
    hand: "right",
    paths: {
      left: { band: "", face: null, details: null },
      right: {
        band: "M165,270 Q175,268 175,280 Q165,282 165,270",
        face: null,
        details:
          "M167,272 Q168,271 169,272 M170,273 Q171,272 172,273 M167,276 Q168,275 169,276 M170,277 Q171,276 172,277 M167,280 Q168,279 169,280", // Beads
      },
    },
    colors: {
      primary: "#3B82F6", // Blue beads
      secondary: "#22C55E", // Green beads
      accent: "#F59E0B", // Yellow beads
    },
    colorizable: true,
    colorOptions: ["#3B82F6", "#DC2626", "#22C55E", "#7C3AED", "#F472B6"],
    rarity: "common",
    tags: ["casual", "colorful", "friendship"],
    sortOrder: 6,
  },
  {
    id: "wristwear_bracelet_chain",
    name: "Chain Bracelet",
    description: "Delicate chain bracelet",
    category: "bracelet",
    hand: "right",
    paths: {
      left: { band: "", face: null, details: null },
      right: {
        band: "M165,275 L167,273 L169,275 L171,273 L173,275 L175,273",
        face: null,
        details: "M169,275 L170,278 L171,275", // Small charm
      },
    },
    colors: {
      primary: "#E5E7EB", // Silver chain
      secondary: "#F59E0B", // Gold charm
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#E5E7EB", "#F59E0B"],
    rarity: "uncommon",
    tags: ["elegant", "delicate", "feminine"],
    sortOrder: 7,
  },
  {
    id: "wristwear_bracelet_leather",
    name: "Leather Cuff",
    description: "Rugged leather cuff bracelet",
    category: "bracelet",
    hand: "right",
    paths: {
      left: { band: "", face: null, details: null },
      right: {
        band: "M163,268 L177,265 L177,285 L163,288 Z",
        face: null,
        details: "M167,272 L173,270 M167,276 L173,274 M167,280 L173,278", // Stitching
      },
    },
    colors: {
      primary: "#78350F", // Brown leather
      secondary: "#44403C", // Dark stitching
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#78350F", "#1C1917", "#7C2D12"],
    rarity: "uncommon",
    tags: ["rugged", "casual", "boho"],
    sortOrder: 8,
  },
];

// =============================================================================
// WRISTWEAR DATA - BANGLES (2 items)
// =============================================================================

const WRISTWEAR_BANGLES: WristwearData[] = [
  {
    id: "wristwear_bangle_gold",
    name: "Gold Bangle",
    description: "Elegant gold bangle bracelet",
    category: "bangle",
    hand: "both",
    paths: {
      left: {
        band: "M24,272 Q34,268 34,280 Q24,284 24,272",
        face: null,
        details: "M26,275 L32,273 M26,279 L32,277",
      },
      right: {
        band: "M166,272 Q176,268 176,280 Q166,284 166,272",
        face: null,
        details: "M168,275 L174,273 M168,279 L174,277",
      },
    },
    colors: {
      primary: "#F59E0B", // Gold
      secondary: "#FCD34D", // Highlights
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "uncommon",
    tags: ["elegant", "gold", "classic"],
    sortOrder: 9,
  },
  {
    id: "wristwear_bangle_stack",
    name: "Stacked Bangles",
    description: "Multiple thin bangles stacked together",
    category: "bangle",
    hand: "right",
    paths: {
      left: { band: "", face: null, details: null },
      right: {
        band: "M165,270 Q175,268 175,272 Q165,274 165,270 M165,274 Q175,272 175,276 Q165,278 165,274 M165,278 Q175,276 175,280 Q165,282 165,278 M165,282 Q175,280 175,284 Q165,286 165,282",
        face: null,
        details: null,
      },
    },
    colors: {
      primary: "#E5E7EB", // Silver
      secondary: "#F59E0B", // Gold alternating
      accent: "#F472B6", // Rose gold
    },
    colorizable: false,
    colorOptions: null,
    rarity: "uncommon",
    tags: ["stacked", "boho", "trendy"],
    sortOrder: 10,
  },
];

// =============================================================================
// WRISTWEAR DATA - SPECIAL (2 items)
// =============================================================================

const WRISTWEAR_SPECIAL: WristwearData[] = [
  {
    id: "wristwear_sweatband",
    name: "Sweatband",
    description: "Athletic wristband for sports",
    category: "special",
    hand: "both",
    paths: {
      left: {
        band: "M24,270 L36,267 L36,283 L24,286 Z",
        face: null,
        details: "M28,273 L32,272 L32,278 L28,279 Z", // Logo area
      },
      right: {
        band: "M164,270 L176,267 L176,283 L164,286 Z",
        face: null,
        details: "M168,273 L172,272 L172,278 L168,279 Z",
      },
    },
    colors: {
      primary: "#DC2626", // Red
      secondary: "#F5F5F4", // White logo
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#DC2626",
      "#1E3A8A",
      "#1C1917",
      "#22C55E",
      "#F59E0B",
      "#F5F5F4",
    ],
    rarity: "common",
    tags: ["sports", "athletic", "active"],
    sortOrder: 11,
  },
  {
    id: "wristwear_scrunchie",
    name: "Scrunchie",
    description: "Fabric scrunchie worn on wrist",
    category: "special",
    hand: "right",
    paths: {
      left: { band: "", face: null, details: null },
      right: {
        band: "M163,272 Q175,268 177,280 Q165,284 163,272 M165,274 Q173,271 174,278 Q166,281 165,274",
        face: null,
        details:
          "M167,275 Q168,274 169,276 M170,274 Q171,273 172,275 M168,278 Q169,277 170,279",
      },
    },
    colors: {
      primary: "#F472B6", // Pink
      secondary: "#EC4899", // Darker pink folds
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#F472B6",
      "#7C3AED",
      "#3B82F6",
      "#22C55E",
      "#F59E0B",
      "#1C1917",
    ],
    rarity: "common",
    tags: ["casual", "cute", "90s"],
    sortOrder: 12,
  },
];

// =============================================================================
// COMBINED WRISTWEAR DATA
// =============================================================================

export const WRISTWEAR: WristwearData[] = [
  ...WRISTWEAR_WATCHES,
  ...WRISTWEAR_SMART,
  ...WRISTWEAR_BRACELETS,
  ...WRISTWEAR_BANGLES,
  ...WRISTWEAR_SPECIAL,
];

export const DEFAULT_WRISTWEAR: WristwearData = WRISTWEAR[0]; // wristwear_none

// =============================================================================
// ACCESSOR FUNCTIONS
// =============================================================================

/**
 * Get wristwear by ID
 */
export function getWristwear(id: string): WristwearData | undefined {
  return WRISTWEAR.find((w) => w.id === id);
}

/**
 * Get wristwear by ID with fallback to default
 */
export function getWristwearSafe(id: string | null | undefined): WristwearData {
  if (!id) return DEFAULT_WRISTWEAR;
  return getWristwear(id) ?? DEFAULT_WRISTWEAR;
}

/**
 * Get all wristwear in a category
 */
export function getWristwearByCategory(
  category: WristwearCategory,
): WristwearData[] {
  return WRISTWEAR.filter((w) => w.category === category);
}

/**
 * Get all wristwear by rarity
 */
export function getWristwearByRarity(rarity: WristwearRarity): WristwearData[] {
  return WRISTWEAR.filter((w) => w.rarity === rarity);
}

/**
 * Get all colorizable wristwear
 */
export function getColorizableWristwear(): WristwearData[] {
  return WRISTWEAR.filter((w) => w.colorizable);
}

/**
 * Get wristwear for a specific hand
 */
export function getWristwearByHand(hand: WristwearHand): WristwearData[] {
  return WRISTWEAR.filter((w) => w.hand === hand || w.hand === "both");
}

/**
 * Get all watches
 */
export function getWatches(): WristwearData[] {
  return WRISTWEAR.filter(
    (w) =>
      w.category === "watch" ||
      w.category === "smartwatch" ||
      w.category === "fitness",
  ).filter((w) => w.id !== "wristwear_none");
}

/**
 * Get all bracelets
 */
export function getBracelets(): WristwearData[] {
  return WRISTWEAR.filter(
    (w) => w.category === "bracelet" || w.category === "bangle",
  );
}

/**
 * Get all wristwear IDs
 */
export function getAllWristwearIds(): string[] {
  return WRISTWEAR.map((w) => w.id);
}

/**
 * Check if wristwear appears on left wrist
 */
export function hasLeftWristwear(id: string): boolean {
  const wristwear = getWristwearSafe(id);
  return wristwear.hand === "left" || wristwear.hand === "both";
}

/**
 * Check if wristwear appears on right wrist
 */
export function hasRightWristwear(id: string): boolean {
  const wristwear = getWristwearSafe(id);
  return wristwear.hand === "right" || wristwear.hand === "both";
}
