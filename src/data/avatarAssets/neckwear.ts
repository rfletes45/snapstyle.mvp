/**
 * Neckwear Asset Definitions
 *
 * Contains all neckwear items for the avatar system including
 * necklaces, chains, scarves, ties, and accessories.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

// =============================================================================
// TYPES
// =============================================================================

export type NeckwearCategory =
  | "necklace"
  | "chain"
  | "scarf"
  | "tie"
  | "bowtie"
  | "choker"
  | "special";

export type NeckwearRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export interface NeckwearData {
  id: string;
  name: string;
  description: string;
  category: NeckwearCategory;

  // SVG paths
  paths: {
    main: string; // Primary neckwear shape
    details: string | null; // Pendant, patterns, etc.
    shadow: string | null; // Shadow/depth
  };

  // Colors
  colors: {
    primary: string;
    secondary: string | null;
    accent: string | null;
  };

  // Customization
  colorizable: boolean;
  colorOptions: string[] | null;

  // Metadata
  rarity: NeckwearRarity;
  tags: string[];
  sortOrder: number;
}

// =============================================================================
// NECKWEAR DATA - JEWELRY (7 items)
// =============================================================================

const NECKWEAR_JEWELRY: NeckwearData[] = [
  {
    id: "neckwear_none",
    name: "No Neckwear",
    description: "Keep your neck bare",
    category: "necklace",
    paths: {
      main: "",
      details: null,
      shadow: null,
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
    id: "neckwear_chain_gold",
    name: "Gold Chain",
    description: "Classic gold chain necklace",
    category: "chain",
    paths: {
      main: "M65,140 Q100,155 135,140 M67,142 Q100,156 133,142 M69,144 Q100,157 131,144",
      details:
        "M72,145 L74,147 M76,146 L78,148 M80,147 L82,149 M95,150 L97,152 M99,150 L101,152 M118,147 L120,149 M122,146 L124,148 M126,145 L128,147", // Chain links
      shadow: "M70,146 Q100,160 130,146",
    },
    colors: {
      primary: "#F59E0B",
      secondary: "#FCD34D",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "uncommon",
    tags: ["jewelry", "gold", "hip-hop", "bling"],
    sortOrder: 1,
  },
  {
    id: "neckwear_chain_silver",
    name: "Silver Chain",
    description: "Sleek silver chain necklace",
    category: "chain",
    paths: {
      main: "M65,140 Q100,155 135,140 M67,142 Q100,156 133,142 M69,144 Q100,157 131,144",
      details:
        "M72,145 L74,147 M76,146 L78,148 M80,147 L82,149 M95,150 L97,152 M99,150 L101,152 M118,147 L120,149 M122,146 L124,148 M126,145 L128,147",
      shadow: "M70,146 Q100,160 130,146",
    },
    colors: {
      primary: "#E5E7EB",
      secondary: "#9CA3AF",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "uncommon",
    tags: ["jewelry", "silver", "modern"],
    sortOrder: 2,
  },
  {
    id: "neckwear_pendant",
    name: "Pendant Necklace",
    description: "Delicate necklace with pendant",
    category: "necklace",
    paths: {
      main: "M70,138 Q100,145 130,138",
      details:
        "M97,148 L100,158 L103,148 Z M100,158 L100,162 M98,162 L102,162 L100,168 Z", // Pendant shape
      shadow: null,
    },
    colors: {
      primary: "#E5E7EB",
      secondary: "#F59E0B",
      accent: "#DC2626",
    },
    colorizable: true,
    colorOptions: ["#E5E7EB", "#F59E0B", "#F472B6", "#7C3AED"],
    rarity: "uncommon",
    tags: ["jewelry", "elegant", "feminine"],
    sortOrder: 3,
  },
  {
    id: "neckwear_choker",
    name: "Choker",
    description: "Close-fitting choker necklace",
    category: "choker",
    paths: {
      main: "M60,135 Q100,142 140,135 Q142,138 140,141 Q100,148 60,141 Q58,138 60,135 Z",
      details: null,
      shadow: "M62,137 Q100,143 138,137 L136,140 Q100,146 64,140 Z",
    },
    colors: {
      primary: "#1C1917",
      secondary: null,
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#1C1917",
      "#DC2626",
      "#7C3AED",
      "#F472B6",
      "#F5F5F4",
      "#1E3A8A",
    ],
    rarity: "uncommon",
    tags: ["jewelry", "edgy", "gothic"],
    sortOrder: 4,
  },
  {
    id: "neckwear_pearls",
    name: "Pearl Necklace",
    description: "Elegant string of pearls",
    category: "necklace",
    paths: {
      main: "M65,138 Q100,148 135,138",
      details:
        "M68,139 Q70,137 72,139 Q70,141 68,139 M76,141 Q78,139 80,141 Q78,143 76,141 M84,143 Q86,141 88,143 Q86,145 84,143 M92,144 Q94,142 96,144 Q94,146 92,144 M100,145 Q102,143 104,145 Q102,147 100,145 M108,144 Q110,142 112,144 Q110,146 108,144 M116,143 Q118,141 120,143 Q118,145 116,143 M124,141 Q126,139 128,141 Q126,143 124,141 M132,139 Q134,137 136,139 Q134,141 132,139", // Pearl beads
      shadow: null,
    },
    colors: {
      primary: "#FEF3C7",
      secondary: "#F5F5F4",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "rare",
    tags: ["jewelry", "elegant", "classic", "formal"],
    sortOrder: 5,
  },
  {
    id: "neckwear_beads",
    name: "Beaded Necklace",
    description: "Colorful beaded necklace",
    category: "necklace",
    paths: {
      main: "M62,140 Q100,155 138,140",
      details:
        "M66,141 Q68,139 70,141 Q68,143 66,141 M74,144 Q76,142 78,144 Q76,146 74,144 M82,147 Q84,145 86,147 Q84,149 82,147 M90,149 Q92,147 94,149 Q92,151 90,149 M98,150 Q100,148 102,150 Q100,152 98,150 M106,149 Q108,147 110,149 Q108,151 106,149 M114,147 Q116,145 118,147 Q116,149 114,147 M122,144 Q124,142 126,144 Q124,146 122,144 M130,141 Q132,139 134,141 Q132,143 130,141", // Beads
      shadow: null,
    },
    colors: {
      primary: "#3B82F6",
      secondary: "#22C55E",
      accent: "#F59E0B",
    },
    colorizable: true,
    colorOptions: ["#3B82F6", "#DC2626", "#22C55E", "#7C3AED", "#F472B6"],
    rarity: "common",
    tags: ["jewelry", "casual", "colorful", "boho"],
    sortOrder: 6,
  },
  {
    id: "neckwear_locket",
    name: "Locket",
    description: "Heart-shaped locket on chain",
    category: "necklace",
    paths: {
      main: "M70,138 Q100,145 130,138",
      details: "M95,150 Q100,145 105,150 Q105,158 100,164 Q95,158 95,150 Z", // Heart locket
      shadow: "M96,152 Q100,148 104,152 Q104,158 100,162 Q96,158 96,152 Z",
    },
    colors: {
      primary: "#F59E0B",
      secondary: "#FCD34D",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#F59E0B", "#E5E7EB", "#F472B6"],
    rarity: "rare",
    tags: ["jewelry", "romantic", "sentimental"],
    sortOrder: 7,
  },
];

// =============================================================================
// NECKWEAR DATA - CLOTHING ITEMS (5 items)
// =============================================================================

const NECKWEAR_CLOTHING: NeckwearData[] = [
  {
    id: "neckwear_tie",
    name: "Necktie",
    description: "Classic business necktie",
    category: "tie",
    paths: {
      main: "M92,138 L108,138 L105,148 L100,180 L95,148 Z",
      details: "M95,140 L105,140 L103,145 L97,145 Z", // Knot
      shadow: "M94,148 L100,175 L106,148 L103,150 L100,172 L97,150 Z",
    },
    colors: {
      primary: "#1E3A8A",
      secondary: "#1C1917",
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#1E3A8A",
      "#DC2626",
      "#1C1917",
      "#7C3AED",
      "#16A34A",
      "#78716C",
    ],
    rarity: "common",
    tags: ["formal", "business", "professional"],
    sortOrder: 8,
  },
  {
    id: "neckwear_bow_tie",
    name: "Bow Tie",
    description: "Stylish bow tie",
    category: "bowtie",
    paths: {
      main: "M75,140 L95,135 L95,145 L75,140 Z M125,140 L105,135 L105,145 L125,140 Z M95,135 Q100,132 105,135 L105,145 Q100,148 95,145 Z",
      details: "M97,138 Q100,136 103,138 Q100,140 97,138", // Center knot
      shadow: "M78,140 L92,136 L92,144 Z M122,140 L108,136 L108,144 Z",
    },
    colors: {
      primary: "#1C1917",
      secondary: null,
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#1C1917",
      "#DC2626",
      "#1E3A8A",
      "#7C3AED",
      "#F59E0B",
      "#F472B6",
    ],
    rarity: "uncommon",
    tags: ["formal", "fancy", "elegant"],
    sortOrder: 9,
  },
  {
    id: "neckwear_scarf_wrap",
    name: "Wrapped Scarf",
    description: "Cozy scarf wrapped around neck",
    category: "scarf",
    paths: {
      main: "M55,132 Q100,120 145,132 Q150,145 145,158 Q100,170 55,158 Q50,145 55,132 Z",
      details:
        "M60,138 Q100,128 140,138 Q145,148 140,158 Q100,165 60,158 Q55,148 60,138 Z", // Scarf folds
      shadow:
        "M62,145 Q100,138 138,145 Q142,152 138,158 Q100,162 62,158 Q58,152 62,145 Z",
    },
    colors: {
      primary: "#DC2626",
      secondary: "#1C1917",
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#DC2626",
      "#1E3A8A",
      "#22C55E",
      "#F59E0B",
      "#78716C",
      "#F472B6",
    ],
    rarity: "uncommon",
    tags: ["winter", "cozy", "warm"],
    sortOrder: 10,
  },
  {
    id: "neckwear_scarf_long",
    name: "Long Scarf",
    description: "Flowing long scarf",
    category: "scarf",
    paths: {
      main: "M60,135 Q100,128 140,135 L138,145 Q100,138 62,145 Z M62,145 L60,180 L72,180 L74,150 Z",
      details: "M63,155 L67,155 M64,165 L70,165 M62,175 L69,175", // Fringe
      shadow: "M65,147 L63,178 L70,178 L72,150 Z",
    },
    colors: {
      primary: "#78716C",
      secondary: "#44403C",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#78716C", "#DC2626", "#1E3A8A", "#22C55E", "#F59E0B"],
    rarity: "common",
    tags: ["casual", "cozy", "autumn"],
    sortOrder: 11,
  },
  {
    id: "neckwear_bandana_neck",
    name: "Neck Bandana",
    description: "Western-style bandana around neck",
    category: "scarf",
    paths: {
      main: "M60,135 Q100,125 140,135 L135,145 Q100,138 65,145 Z M85,145 L100,175 L115,145 Z",
      details: "M90,150 L95,155 M100,148 L100,158 M105,150 L110,155", // Pattern
      shadow: "M88,147 L100,172 L112,147 Z",
    },
    colors: {
      primary: "#DC2626",
      secondary: "#F5F5F4",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#DC2626", "#1E3A8A", "#1C1917", "#22C55E"],
    rarity: "uncommon",
    tags: ["western", "casual", "country"],
    sortOrder: 12,
  },
];

// =============================================================================
// NECKWEAR DATA - SPECIAL (3 items)
// =============================================================================

const NECKWEAR_SPECIAL: NeckwearData[] = [
  {
    id: "neckwear_headphones",
    name: "Headphones",
    description: "Over-ear headphones around neck",
    category: "special",
    paths: {
      main: "M55,145 Q55,125 75,125 L75,135 Q65,135 65,145 Q65,155 75,155 L75,165 Q55,165 55,145 Z M145,145 Q145,125 125,125 L125,135 Q135,135 135,145 Q135,155 125,155 L125,165 Q145,165 145,145 Z",
      details: "M75,125 Q100,115 125,125 Q100,118 75,125", // Headband
      shadow:
        "M58,145 Q58,130 72,128 L72,138 Q65,138 65,145 Q65,152 72,152 L72,162 Q58,160 58,145 Z M142,145 Q142,130 128,128 L128,138 Q135,138 135,145 Q135,152 128,152 L128,162 Q142,160 142,145 Z",
    },
    colors: {
      primary: "#1C1917",
      secondary: "#44403C",
      accent: "#DC2626",
    },
    colorizable: true,
    colorOptions: ["#1C1917", "#F5F5F4", "#DC2626", "#3B82F6"],
    rarity: "rare",
    tags: ["music", "tech", "audio"],
    sortOrder: 13,
  },
  {
    id: "neckwear_lanyard",
    name: "ID Lanyard",
    description: "Lanyard with ID badge",
    category: "special",
    paths: {
      main: "M70,138 L70,180 L75,180 L75,142 M125,142 L125,180 L130,180 L130,138",
      details:
        "M72,175 L128,175 L128,192 L72,192 Z M80,180 L120,180 L120,188 L80,188 Z", // ID badge
      shadow: "M74,177 L126,177 L126,190 L74,190 Z",
    },
    colors: {
      primary: "#3B82F6",
      secondary: "#F5F5F4",
      accent: "#1C1917",
    },
    colorizable: true,
    colorOptions: ["#3B82F6", "#DC2626", "#22C55E", "#7C3AED", "#F59E0B"],
    rarity: "common",
    tags: ["work", "professional", "badge"],
    sortOrder: 14,
  },
  {
    id: "neckwear_medal",
    name: "Medal",
    description: "Achievement medal on ribbon",
    category: "special",
    paths: {
      main: "M90,138 L100,138 L100,158 L110,138 L110,138 M88,140 L100,138 L100,150 Z M112,140 L100,138 L100,150 Z",
      details:
        "M90,158 Q100,150 110,158 Q110,172 100,180 Q90,172 90,158 Z M95,162 L100,168 L105,162 M100,168 L100,175", // Medal shape
      shadow: "M92,160 Q100,154 108,160 Q108,170 100,176 Q92,170 92,160 Z",
    },
    colors: {
      primary: "#F59E0B",
      secondary: "#1E3A8A",
      accent: "#DC2626",
    },
    colorizable: false,
    colorOptions: null,
    rarity: "epic",
    tags: ["achievement", "award", "winner"],
    sortOrder: 15,
  },
];

// =============================================================================
// COMBINED NECKWEAR DATA
// =============================================================================

export const NECKWEAR: NeckwearData[] = [
  ...NECKWEAR_JEWELRY,
  ...NECKWEAR_CLOTHING,
  ...NECKWEAR_SPECIAL,
];

export const DEFAULT_NECKWEAR: NeckwearData = NECKWEAR[0]; // neckwear_none

// =============================================================================
// ACCESSOR FUNCTIONS
// =============================================================================

/**
 * Get neckwear by ID
 */
export function getNeckwear(id: string): NeckwearData | undefined {
  return NECKWEAR.find((n) => n.id === id);
}

/**
 * Get neckwear by ID with fallback to default
 */
export function getNeckwearSafe(id: string | null | undefined): NeckwearData {
  if (!id) return DEFAULT_NECKWEAR;
  return getNeckwear(id) ?? DEFAULT_NECKWEAR;
}

/**
 * Get all neckwear in a category
 */
export function getNeckwearByCategory(
  category: NeckwearCategory,
): NeckwearData[] {
  return NECKWEAR.filter((n) => n.category === category);
}

/**
 * Get all neckwear by rarity
 */
export function getNeckwearByRarity(rarity: NeckwearRarity): NeckwearData[] {
  return NECKWEAR.filter((n) => n.rarity === rarity);
}

/**
 * Get all colorizable neckwear
 */
export function getColorizableNeckwear(): NeckwearData[] {
  return NECKWEAR.filter((n) => n.colorizable);
}

/**
 * Get jewelry items
 */
export function getJewelryNeckwear(): NeckwearData[] {
  return NECKWEAR.filter(
    (n) =>
      n.category === "necklace" ||
      n.category === "chain" ||
      n.category === "choker",
  ).filter((n) => n.id !== "neckwear_none");
}

/**
 * Get formal neckwear (ties, bow ties)
 */
export function getFormalNeckwear(): NeckwearData[] {
  return NECKWEAR.filter(
    (n) => n.category === "tie" || n.category === "bowtie",
  );
}

/**
 * Get scarves
 */
export function getScarves(): NeckwearData[] {
  return getNeckwearByCategory("scarf");
}

/**
 * Get all neckwear IDs
 */
export function getAllNeckwearIds(): string[] {
  return NECKWEAR.map((n) => n.id);
}
