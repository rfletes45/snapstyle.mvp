/**
 * Earwear Asset Definitions
 *
 * Contains all earwear items for the avatar system including
 * earrings, ear cuffs, and ear accessories.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

// =============================================================================
// TYPES
// =============================================================================

export type EarwearCategory =
  | "stud"
  | "hoop"
  | "dangle"
  | "ear_cuff"
  | "plugs"
  | "special";

export type EarwearRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export interface EarwearData {
  id: string;
  name: string;
  description: string;
  category: EarwearCategory;

  // SVG paths - separate for left and right ears
  paths: {
    left: {
      main: string;
      details: string | null;
    };
    right: {
      main: string;
      details: string | null;
    };
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
  rarity: EarwearRarity;
  tags: string[];
  sortOrder: number;
}

// =============================================================================
// EARWEAR DATA - STUDS (4 items)
// =============================================================================

const EARWEAR_STUDS: EarwearData[] = [
  {
    id: "earwear_none",
    name: "No Earwear",
    description: "Keep your ears bare",
    category: "stud",
    paths: {
      left: { main: "", details: null },
      right: { main: "", details: null },
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
    id: "earwear_stud_gold",
    name: "Gold Studs",
    description: "Simple gold stud earrings",
    category: "stud",
    paths: {
      left: {
        main: "M48,95 Q50,93 52,95 Q50,97 48,95",
        details: "M49,94 L51,96",
      },
      right: {
        main: "M148,95 Q150,93 152,95 Q150,97 148,95",
        details: "M149,94 L151,96",
      },
    },
    colors: {
      primary: "#F59E0B",
      secondary: "#FCD34D",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "common",
    tags: ["jewelry", "classic", "minimal"],
    sortOrder: 1,
  },
  {
    id: "earwear_stud_silver",
    name: "Silver Studs",
    description: "Classic silver stud earrings",
    category: "stud",
    paths: {
      left: {
        main: "M48,95 Q50,93 52,95 Q50,97 48,95",
        details: "M49,94 L51,96",
      },
      right: {
        main: "M148,95 Q150,93 152,95 Q150,97 148,95",
        details: "M149,94 L151,96",
      },
    },
    colors: {
      primary: "#E5E7EB",
      secondary: "#9CA3AF",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "common",
    tags: ["jewelry", "classic", "minimal"],
    sortOrder: 2,
  },
  {
    id: "earwear_stud_diamond",
    name: "Diamond Studs",
    description: "Sparkling diamond stud earrings",
    category: "stud",
    paths: {
      left: {
        main: "M47,95 L50,91 L53,95 L50,99 Z",
        details: "M48,95 L50,93 L52,95 M49,94 L51,96",
      },
      right: {
        main: "M147,95 L150,91 L153,95 L150,99 Z",
        details: "M148,95 L150,93 L152,95 M149,94 L151,96",
      },
    },
    colors: {
      primary: "#F5F5F4",
      secondary: "#E5E7EB",
      accent: "#67E8F9",
    },
    colorizable: false,
    colorOptions: null,
    rarity: "rare",
    tags: ["jewelry", "luxury", "sparkling", "diamond"],
    sortOrder: 3,
  },
  {
    id: "earwear_stud_pearl",
    name: "Pearl Studs",
    description: "Elegant pearl stud earrings",
    category: "stud",
    paths: {
      left: {
        main: "M47,94 Q50,90 53,94 Q50,98 47,94",
        details: "M49,92 Q50,91 51,92",
      },
      right: {
        main: "M147,94 Q150,90 153,94 Q150,98 147,94",
        details: "M149,92 Q150,91 151,92",
      },
    },
    colors: {
      primary: "#FEF3C7",
      secondary: "#F5F5F4",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "uncommon",
    tags: ["jewelry", "elegant", "classic", "pearl"],
    sortOrder: 4,
  },
];

// =============================================================================
// EARWEAR DATA - HOOPS (3 items)
// =============================================================================

const EARWEAR_HOOPS: EarwearData[] = [
  {
    id: "earwear_hoop_gold_small",
    name: "Small Gold Hoops",
    description: "Delicate small gold hoop earrings",
    category: "hoop",
    paths: {
      left: {
        main: "M45,95 Q42,100 45,105 Q48,100 45,95",
        details: null,
      },
      right: {
        main: "M155,95 Q158,100 155,105 Q152,100 155,95",
        details: null,
      },
    },
    colors: {
      primary: "#F59E0B",
      secondary: "#FCD34D",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "common",
    tags: ["jewelry", "classic", "hoop"],
    sortOrder: 5,
  },
  {
    id: "earwear_hoop_gold_large",
    name: "Large Gold Hoops",
    description: "Bold large gold hoop earrings",
    category: "hoop",
    paths: {
      left: {
        main: "M42,95 Q35,108 45,118 Q52,108 42,95",
        details: "M43,98 Q38,108 45,115 Q50,108 43,98",
      },
      right: {
        main: "M158,95 Q165,108 155,118 Q148,108 158,95",
        details: "M157,98 Q162,108 155,115 Q150,108 157,98",
      },
    },
    colors: {
      primary: "#F59E0B",
      secondary: "#FCD34D",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "uncommon",
    tags: ["jewelry", "bold", "statement", "hoop"],
    sortOrder: 6,
  },
  {
    id: "earwear_hoop_silver",
    name: "Silver Hoops",
    description: "Sleek silver hoop earrings",
    category: "hoop",
    paths: {
      left: {
        main: "M44,95 Q40,102 44,110 Q48,102 44,95",
        details: null,
      },
      right: {
        main: "M156,95 Q160,102 156,110 Q152,102 156,95",
        details: null,
      },
    },
    colors: {
      primary: "#E5E7EB",
      secondary: "#9CA3AF",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "common",
    tags: ["jewelry", "modern", "hoop"],
    sortOrder: 7,
  },
];

// =============================================================================
// EARWEAR DATA - DANGLE (3 items)
// =============================================================================

const EARWEAR_DANGLE: EarwearData[] = [
  {
    id: "earwear_dangle_crystal",
    name: "Crystal Drops",
    description: "Elegant crystal drop earrings",
    category: "dangle",
    paths: {
      left: {
        main: "M48,95 L48,100 L45,108 L48,116 L51,108 L48,100",
        details: "M47,105 L49,107 M46,110 L50,110",
      },
      right: {
        main: "M152,95 L152,100 L149,108 L152,116 L155,108 L152,100",
        details: "M151,105 L153,107 M150,110 L154,110",
      },
    },
    colors: {
      primary: "#67E8F9",
      secondary: "#F5F5F4",
      accent: "#E5E7EB",
    },
    colorizable: true,
    colorOptions: ["#67E8F9", "#F472B6", "#A78BFA", "#22C55E", "#F59E0B"],
    rarity: "uncommon",
    tags: ["jewelry", "elegant", "sparkling"],
    sortOrder: 8,
  },
  {
    id: "earwear_dangle_feather",
    name: "Feather Earrings",
    description: "Bohemian feather drop earrings",
    category: "dangle",
    paths: {
      left: {
        main: "M48,95 L48,100 Q45,115 40,130 Q48,125 48,100",
        details:
          "M45,108 L48,105 M43,115 L48,110 M41,122 L48,115 M40,128 L48,120",
      },
      right: {
        main: "M152,95 L152,100 Q155,115 160,130 Q152,125 152,100",
        details:
          "M155,108 L152,105 M157,115 L152,110 M159,122 L152,115 M160,128 L152,120",
      },
    },
    colors: {
      primary: "#78716C",
      secondary: "#1C1917",
      accent: "#DC2626",
    },
    colorizable: true,
    colorOptions: ["#78716C", "#1E3A8A", "#DC2626", "#7C3AED", "#22C55E"],
    rarity: "uncommon",
    tags: ["jewelry", "boho", "nature"],
    sortOrder: 9,
  },
  {
    id: "earwear_dangle_chain",
    name: "Chain Drops",
    description: "Modern chain drop earrings",
    category: "dangle",
    paths: {
      left: {
        main: "M48,95 L48,98 L47,100 L49,102 L47,104 L49,106 L47,108 L49,110 L47,112 L49,114 L48,118",
        details: "M46,118 L50,118 L50,122 L46,122 Z",
      },
      right: {
        main: "M152,95 L152,98 L151,100 L153,102 L151,104 L153,106 L151,108 L153,110 L151,112 L153,114 L152,118",
        details: "M150,118 L154,118 L154,122 L150,122 Z",
      },
    },
    colors: {
      primary: "#E5E7EB",
      secondary: "#F59E0B",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "uncommon",
    tags: ["jewelry", "modern", "geometric"],
    sortOrder: 10,
  },
];

// =============================================================================
// EARWEAR DATA - EAR CUFFS & PLUGS (2 items)
// =============================================================================

const EARWEAR_OTHER: EarwearData[] = [
  {
    id: "earwear_cuff",
    name: "Ear Cuff",
    description: "Edgy ear cuff, no piercing needed",
    category: "ear_cuff",
    paths: {
      left: {
        main: "M45,88 Q42,92 42,97 Q42,102 45,105 L47,103 Q45,100 45,97 Q45,94 47,91 Z",
        details: "M43,95 L46,95 M43,99 L46,99",
      },
      right: {
        main: "M155,88 Q158,92 158,97 Q158,102 155,105 L153,103 Q155,100 155,97 Q155,94 153,91 Z",
        details: "M157,95 L154,95 M157,99 L154,99",
      },
    },
    colors: {
      primary: "#E5E7EB",
      secondary: "#9CA3AF",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#E5E7EB", "#F59E0B", "#1C1917"],
    rarity: "uncommon",
    tags: ["jewelry", "edgy", "alternative"],
    sortOrder: 11,
  },
  {
    id: "earwear_plugs",
    name: "Ear Plugs",
    description: "Stretched ear plugs/tunnels",
    category: "plugs",
    paths: {
      left: {
        main: "M44,93 Q48,89 52,93 Q52,100 48,104 Q44,100 44,93 Z",
        details: "M46,95 Q48,93 50,95 Q48,97 46,95",
      },
      right: {
        main: "M148,93 Q152,89 156,93 Q156,100 152,104 Q148,100 148,93 Z",
        details: "M150,95 Q152,93 154,95 Q152,97 150,95",
      },
    },
    colors: {
      primary: "#1C1917",
      secondary: "#44403C",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#1C1917", "#7C3AED", "#DC2626", "#22C55E", "#F59E0B"],
    rarity: "uncommon",
    tags: ["alternative", "punk", "stretched"],
    sortOrder: 12,
  },
];

// =============================================================================
// EARWEAR DATA - SPECIAL (2 items)
// =============================================================================

const EARWEAR_SPECIAL: EarwearData[] = [
  {
    id: "earwear_airpods",
    name: "Wireless Earbuds",
    description: "Modern wireless earbuds",
    category: "special",
    paths: {
      left: {
        main: "M44,93 Q48,90 52,93 L52,105 Q48,108 44,105 Z",
        details: "M46,95 L50,95 M47,100 L49,100 L49,104",
      },
      right: {
        main: "M148,93 Q152,90 156,93 L156,105 Q152,108 148,105 Z",
        details: "M150,95 L154,95 M151,100 L153,100 L153,104",
      },
    },
    colors: {
      primary: "#F5F5F4",
      secondary: "#E5E7EB",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#F5F5F4", "#1C1917", "#3B82F6", "#DC2626"],
    rarity: "rare",
    tags: ["tech", "modern", "music"],
    sortOrder: 13,
  },
  {
    id: "earwear_elf",
    name: "Elf Ears",
    description: "Fantastical pointed elf ear tips",
    category: "special",
    paths: {
      left: {
        main: "M40,90 Q35,75 30,60 Q40,70 45,85 Z",
        details: "M38,80 Q36,72 34,65",
      },
      right: {
        main: "M160,90 Q165,75 170,60 Q160,70 155,85 Z",
        details: "M162,80 Q164,72 166,65",
      },
    },
    colors: {
      primary: "#FECACA",
      secondary: "#FCA5A5",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    rarity: "epic",
    tags: ["fantasy", "elf", "cosplay"],
    sortOrder: 14,
  },
];

// =============================================================================
// COMBINED EARWEAR DATA
// =============================================================================

export const EARWEAR: EarwearData[] = [
  ...EARWEAR_STUDS,
  ...EARWEAR_HOOPS,
  ...EARWEAR_DANGLE,
  ...EARWEAR_OTHER,
  ...EARWEAR_SPECIAL,
];

export const DEFAULT_EARWEAR: EarwearData = EARWEAR[0]; // earwear_none

// =============================================================================
// ACCESSOR FUNCTIONS
// =============================================================================

/**
 * Get earwear by ID
 */
export function getEarwear(id: string): EarwearData | undefined {
  return EARWEAR.find((e) => e.id === id);
}

/**
 * Get earwear by ID with fallback to default
 */
export function getEarwearSafe(id: string | null | undefined): EarwearData {
  if (!id) return DEFAULT_EARWEAR;
  return getEarwear(id) ?? DEFAULT_EARWEAR;
}

/**
 * Get all earwear in a category
 */
export function getEarwearByCategory(category: EarwearCategory): EarwearData[] {
  return EARWEAR.filter((e) => e.category === category);
}

/**
 * Get all earwear by rarity
 */
export function getEarwearByRarity(rarity: EarwearRarity): EarwearData[] {
  return EARWEAR.filter((e) => e.rarity === rarity);
}

/**
 * Get all colorizable earwear
 */
export function getColorizableEarwear(): EarwearData[] {
  return EARWEAR.filter((e) => e.colorizable);
}

/**
 * Get all stud earrings
 */
export function getStudEarwear(): EarwearData[] {
  return getEarwearByCategory("stud").filter((e) => e.id !== "earwear_none");
}

/**
 * Get all hoop earrings
 */
export function getHoopEarwear(): EarwearData[] {
  return getEarwearByCategory("hoop");
}

/**
 * Get all dangle earrings
 */
export function getDangleEarwear(): EarwearData[] {
  return getEarwearByCategory("dangle");
}

/**
 * Get all earwear IDs
 */
export function getAllEarwearIds(): string[] {
  return EARWEAR.map((e) => e.id);
}
