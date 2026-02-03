/**
 * Eyewear Asset Definitions
 *
 * Contains all eyewear items for the avatar system including
 * glasses, sunglasses, goggles, and special items.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

// =============================================================================
// TYPES
// =============================================================================

export type EyewearCategory = "glasses" | "sunglasses" | "goggles" | "special";

export type EyewearRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export interface EyewearData {
  id: string;
  name: string;
  description: string;
  category: EyewearCategory;

  // SVG paths
  paths: {
    frame: string; // Frame/rim shape
    lens: string; // Lens shape
    bridge: string; // Bridge between lenses
    details: string | null; // Additional details (hinges, decorations)
  };

  // Colors
  colors: {
    frame: string;
    lens: string;
    accent: string | null;
  };

  // Lens properties
  lensOpacity: number; // 0 = clear, 1 = opaque
  lensTint: string | null; // Tint color for sunglasses

  // Customization
  colorizable: boolean;
  frameColorOptions: string[] | null;
  lensColorOptions: string[] | null;

  // Metadata
  rarity: EyewearRarity;
  tags: string[];
  sortOrder: number;
}

// =============================================================================
// EYEWEAR DATA - GLASSES (10 items)
// =============================================================================

const EYEWEAR_GLASSES: EyewearData[] = [
  {
    id: "eyewear_none",
    name: "No Eyewear",
    description: "Show off your beautiful eyes",
    category: "glasses",
    paths: {
      frame: "",
      lens: "",
      bridge: "",
      details: null,
    },
    colors: {
      frame: "transparent",
      lens: "transparent",
      accent: null,
    },
    lensOpacity: 0,
    lensTint: null,
    colorizable: false,
    frameColorOptions: null,
    lensColorOptions: null,
    rarity: "common",
    tags: [],
    sortOrder: 0,
  },
  {
    id: "eyewear_round_thin",
    name: "Round Thin Frames",
    description: "Classic round glasses with thin metal frames",
    category: "glasses",
    paths: {
      frame:
        "M55,78 Q55,68 65,68 Q75,68 75,78 Q75,88 65,88 Q55,88 55,78 Z M125,78 Q125,68 135,68 Q145,68 145,78 Q145,88 135,88 Q125,88 125,78 Z",
      lens: "M57,78 Q57,70 65,70 Q73,70 73,78 Q73,86 65,86 Q57,86 57,78 Z M127,78 Q127,70 135,70 Q143,70 143,78 Q143,86 135,86 Q127,86 127,78 Z",
      bridge: "M75,76 Q100,72 125,76 Q100,74 75,76 Z",
      details: "M55,76 L48,74 M145,76 L152,74", // Temple arms
    },
    colors: {
      frame: "#44403C",
      lens: "#FFFFFF",
      accent: null,
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#44403C", "#000000", "#F59E0B", "#E5E7EB", "#78350F"],
    lensColorOptions: null,
    rarity: "common",
    tags: ["classic", "intellectual", "vintage"],
    sortOrder: 1,
  },
  {
    id: "eyewear_round_thick",
    name: "Round Thick Frames",
    description: "Bold round glasses with thick frames",
    category: "glasses",
    paths: {
      frame:
        "M52,78 Q52,65 65,65 Q78,65 78,78 Q78,91 65,91 Q52,91 52,78 Z M58,78 Q58,70 65,70 Q72,70 72,78 Q72,86 65,86 Q58,86 58,78 Z M122,78 Q122,65 135,65 Q148,65 148,78 Q148,91 135,91 Q122,91 122,78 Z M128,78 Q128,70 135,70 Q142,70 142,78 Q142,86 135,86 Q128,86 128,78 Z",
      lens: "M58,78 Q58,70 65,70 Q72,70 72,78 Q72,86 65,86 Q58,86 58,78 Z M128,78 Q128,70 135,70 Q142,70 142,78 Q142,86 135,86 Q128,86 128,78 Z",
      bridge: "M78,75 Q100,70 122,75 Q100,72 78,75 Z",
      details: "M52,76 L42,72 M148,76 L158,72",
    },
    colors: {
      frame: "#1C1917",
      lens: "#FFFFFF",
      accent: null,
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#1C1917", "#7C2D12", "#1E3A8A", "#7C3AED", "#44403C"],
    lensColorOptions: null,
    rarity: "common",
    tags: ["bold", "hipster", "statement"],
    sortOrder: 2,
  },
  {
    id: "eyewear_rectangular",
    name: "Rectangular Frames",
    description: "Modern rectangular glasses",
    category: "glasses",
    paths: {
      frame:
        "M50,72 L80,72 L80,88 L50,88 Z M52,74 L78,74 L78,86 L52,86 Z M120,72 L150,72 L150,88 L120,88 Z M122,74 L148,74 L148,86 L122,86 Z",
      lens: "M52,74 L78,74 L78,86 L52,86 Z M122,74 L148,74 L148,86 L122,86 Z",
      bridge: "M80,78 Q100,75 120,78 L120,82 Q100,79 80,82 Z",
      details: "M50,78 L40,76 M150,78 L160,76",
    },
    colors: {
      frame: "#1C1917",
      lens: "#FFFFFF",
      accent: null,
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#1C1917", "#44403C", "#1E3A8A", "#7C2D12", "#E5E7EB"],
    lensColorOptions: null,
    rarity: "common",
    tags: ["modern", "professional", "clean"],
    sortOrder: 3,
  },
  {
    id: "eyewear_square",
    name: "Square Frames",
    description: "Bold square-shaped glasses",
    category: "glasses",
    paths: {
      frame:
        "M48,68 L82,68 L82,90 L48,90 Z M52,72 L78,72 L78,86 L52,86 Z M118,68 L152,68 L152,90 L118,90 Z M122,72 L148,72 L148,86 L122,86 Z",
      lens: "M52,72 L78,72 L78,86 L52,86 Z M122,72 L148,72 L148,86 L122,86 Z",
      bridge: "M82,76 Q100,72 118,76 L118,80 Q100,76 82,80 Z",
      details: "M48,76 L38,74 M152,76 L162,74",
    },
    colors: {
      frame: "#1C1917",
      lens: "#FFFFFF",
      accent: null,
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#1C1917", "#44403C", "#7C3AED", "#DC2626", "#1E3A8A"],
    lensColorOptions: null,
    rarity: "uncommon",
    tags: ["bold", "statement", "trendy"],
    sortOrder: 4,
  },
  {
    id: "eyewear_cat_eye",
    name: "Cat Eye Frames",
    description: "Vintage cat-eye style glasses",
    category: "glasses",
    paths: {
      frame:
        "M48,75 L55,68 L82,68 L82,88 L48,88 Z M52,72 L78,72 L78,86 L52,86 Z M118,68 L145,68 L152,75 L152,88 L118,88 Z M122,72 L148,72 L148,86 L122,86 Z",
      lens: "M52,72 L78,72 L78,86 L52,86 Z M122,72 L148,72 L148,86 L122,86 Z",
      bridge: "M82,76 Q100,73 118,76 Q100,75 82,78 Z",
      details: "M48,78 L38,75 M152,78 L162,75",
    },
    colors: {
      frame: "#1C1917",
      lens: "#FFFFFF",
      accent: "#F472B6",
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#1C1917", "#7C2D12", "#DC2626", "#7C3AED", "#F472B6"],
    lensColorOptions: null,
    rarity: "uncommon",
    tags: ["vintage", "feminine", "retro"],
    sortOrder: 5,
  },
  {
    id: "eyewear_aviator_clear",
    name: "Aviator Clear",
    description: "Classic aviator frames with clear lenses",
    category: "glasses",
    paths: {
      frame:
        "M45,72 Q50,65 70,68 Q80,70 78,82 Q75,92 60,92 Q45,90 45,72 Z M155,72 Q150,65 130,68 Q120,70 122,82 Q125,92 140,92 Q155,90 155,72 Z",
      lens: "M48,74 Q52,68 68,70 Q76,72 75,82 Q72,90 60,90 Q48,88 48,74 Z M152,74 Q148,68 132,70 Q124,72 125,82 Q128,90 140,90 Q152,88 152,74 Z",
      bridge: "M78,75 Q100,70 122,75 M85,72 Q100,68 115,72", // Double bridge
      details: "M45,78 L35,75 M155,78 L165,75",
    },
    colors: {
      frame: "#F59E0B",
      lens: "#FFFFFF",
      accent: null,
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#F59E0B", "#E5E7EB", "#000000", "#44403C"],
    lensColorOptions: null,
    rarity: "uncommon",
    tags: ["classic", "aviator", "timeless"],
    sortOrder: 6,
  },
  {
    id: "eyewear_wayfare",
    name: "Wayfarer Style",
    description: "Iconic wayfarer-style frames",
    category: "glasses",
    paths: {
      frame:
        "M46,70 L82,68 L84,90 L48,92 Z M50,72 L78,71 L80,88 L52,89 Z M116,68 L154,70 L152,92 L116,90 Z M120,71 L150,72 L148,89 L118,88 Z",
      lens: "M50,72 L78,71 L80,88 L52,89 Z M120,71 L150,72 L148,89 L118,88 Z",
      bridge: "M82,76 Q100,73 118,76 Q100,74 82,77 Z",
      details: "M46,76 L36,74 M154,76 L164,74",
    },
    colors: {
      frame: "#1C1917",
      lens: "#FFFFFF",
      accent: null,
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#1C1917", "#7C2D12", "#1E3A8A", "#DC2626", "#44403C"],
    lensColorOptions: null,
    rarity: "common",
    tags: ["classic", "iconic", "casual"],
    sortOrder: 7,
  },
  {
    id: "eyewear_oversized",
    name: "Oversized Frames",
    description: "Large fashion-forward frames",
    category: "glasses",
    paths: {
      frame:
        "M40,70 L85,65 L88,95 L42,98 Z M45,73 L82,69 L84,92 L47,95 Z M112,65 L160,70 L158,98 L115,95 Z M116,69 L155,73 L153,95 L118,92 Z",
      lens: "M45,73 L82,69 L84,92 L47,95 Z M116,69 L155,73 L153,95 L118,92 Z",
      bridge: "M85,78 Q100,75 115,78 L115,82 Q100,79 85,82 Z",
      details: "M40,78 L30,75 M160,78 L170,75",
    },
    colors: {
      frame: "#1C1917",
      lens: "#FFFFFF",
      accent: null,
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#1C1917", "#7C2D12", "#7C3AED", "#F472B6", "#DC2626"],
    lensColorOptions: null,
    rarity: "uncommon",
    tags: ["fashion", "bold", "statement"],
    sortOrder: 8,
  },
  {
    id: "eyewear_rimless",
    name: "Rimless Glasses",
    description: "Minimalist frameless glasses",
    category: "glasses",
    paths: {
      frame: "", // Minimal frame
      lens: "M52,72 Q65,68 78,72 Q82,80 78,88 Q65,92 52,88 Q48,80 52,72 Z M122,72 Q135,68 148,72 Q152,80 148,88 Q135,92 122,88 Q118,80 122,72 Z",
      bridge: "M78,78 L90,76 Q100,75 110,76 L122,78",
      details: "M52,78 L42,76 M148,78 L158,76",
    },
    colors: {
      frame: "#E5E7EB",
      lens: "#FFFFFF",
      accent: null,
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#E5E7EB", "#F59E0B", "#44403C"],
    lensColorOptions: null,
    rarity: "uncommon",
    tags: ["minimalist", "professional", "subtle"],
    sortOrder: 9,
  },
];

// =============================================================================
// EYEWEAR DATA - SUNGLASSES (8 items)
// =============================================================================

const EYEWEAR_SUNGLASSES: EyewearData[] = [
  {
    id: "eyewear_aviator_sun",
    name: "Aviator Sunglasses",
    description: "Classic aviator sunglasses",
    category: "sunglasses",
    paths: {
      frame:
        "M45,72 Q50,65 70,68 Q80,70 78,82 Q75,92 60,92 Q45,90 45,72 Z M155,72 Q150,65 130,68 Q120,70 122,82 Q125,92 140,92 Q155,90 155,72 Z",
      lens: "M48,74 Q52,68 68,70 Q76,72 75,82 Q72,90 60,90 Q48,88 48,74 Z M152,74 Q148,68 132,70 Q124,72 125,82 Q128,90 140,90 Q152,88 152,74 Z",
      bridge: "M78,75 Q100,70 122,75 M85,72 Q100,68 115,72",
      details: "M45,78 L35,75 M155,78 L165,75",
    },
    colors: {
      frame: "#F59E0B",
      lens: "#1C1917",
      accent: null,
    },
    lensOpacity: 0.85,
    lensTint: "#44403C",
    colorizable: true,
    frameColorOptions: ["#F59E0B", "#E5E7EB", "#1C1917"],
    lensColorOptions: ["#44403C", "#3B82F6", "#22C55E", "#A855F7"],
    rarity: "uncommon",
    tags: ["classic", "cool", "pilot"],
    sortOrder: 10,
  },
  {
    id: "eyewear_wayfare_sun",
    name: "Wayfarer Sunglasses",
    description: "Iconic wayfarer-style sunglasses",
    category: "sunglasses",
    paths: {
      frame:
        "M46,70 L82,68 L84,90 L48,92 Z M50,72 L78,71 L80,88 L52,89 Z M116,68 L154,70 L152,92 L116,90 Z M120,71 L150,72 L148,89 L118,88 Z",
      lens: "M50,72 L78,71 L80,88 L52,89 Z M120,71 L150,72 L148,89 L118,88 Z",
      bridge: "M82,76 Q100,73 118,76 Q100,74 82,77 Z",
      details: "M46,76 L36,74 M154,76 L164,74",
    },
    colors: {
      frame: "#1C1917",
      lens: "#44403C",
      accent: null,
    },
    lensOpacity: 0.85,
    lensTint: "#44403C",
    colorizable: true,
    frameColorOptions: ["#1C1917", "#7C2D12", "#1E3A8A"],
    lensColorOptions: ["#44403C", "#3B82F6", "#F59E0B"],
    rarity: "common",
    tags: ["classic", "iconic", "stylish"],
    sortOrder: 11,
  },
  {
    id: "eyewear_sport",
    name: "Sport Sunglasses",
    description: "Aerodynamic wrap-around sport shades",
    category: "sunglasses",
    paths: {
      frame:
        "M35,75 Q50,65 85,72 Q90,80 85,90 Q50,95 35,85 Z M165,75 Q150,65 115,72 Q110,80 115,90 Q150,95 165,85 Z",
      lens: "M38,76 Q52,68 82,74 Q86,80 82,88 Q52,92 38,84 Z M162,76 Q148,68 118,74 Q114,80 118,88 Q148,92 162,84 Z",
      bridge: "M85,78 Q100,75 115,78 Q100,77 85,79 Z",
      details: null,
    },
    colors: {
      frame: "#1C1917",
      lens: "#1C1917",
      accent: "#DC2626",
    },
    lensOpacity: 0.9,
    lensTint: "#1C1917",
    colorizable: true,
    frameColorOptions: ["#1C1917", "#F5F5F4", "#DC2626", "#3B82F6"],
    lensColorOptions: ["#1C1917", "#3B82F6", "#F59E0B", "#A855F7"],
    rarity: "uncommon",
    tags: ["athletic", "sporty", "active"],
    sortOrder: 12,
  },
  {
    id: "eyewear_round_sun",
    name: "Round Sunglasses",
    description: "Retro round sunglasses",
    category: "sunglasses",
    paths: {
      frame:
        "M52,78 Q52,65 65,65 Q78,65 78,78 Q78,91 65,91 Q52,91 52,78 Z M58,78 Q58,70 65,70 Q72,70 72,78 Q72,86 65,86 Q58,86 58,78 Z M122,78 Q122,65 135,65 Q148,65 148,78 Q148,91 135,91 Q122,91 122,78 Z M128,78 Q128,70 135,70 Q142,70 142,78 Q142,86 135,86 Q128,86 128,78 Z",
      lens: "M58,78 Q58,70 65,70 Q72,70 72,78 Q72,86 65,86 Q58,86 58,78 Z M128,78 Q128,70 135,70 Q142,70 142,78 Q142,86 135,86 Q128,86 128,78 Z",
      bridge: "M78,75 Q100,70 122,75 Q100,72 78,75 Z",
      details: "M52,76 L42,74 M148,76 L158,74",
    },
    colors: {
      frame: "#F59E0B",
      lens: "#44403C",
      accent: null,
    },
    lensOpacity: 0.85,
    lensTint: "#44403C",
    colorizable: true,
    frameColorOptions: ["#F59E0B", "#E5E7EB", "#1C1917", "#7C2D12"],
    lensColorOptions: ["#44403C", "#3B82F6", "#A855F7", "#F472B6"],
    rarity: "uncommon",
    tags: ["retro", "hippie", "vintage"],
    sortOrder: 13,
  },
  {
    id: "eyewear_shield",
    name: "Shield Sunglasses",
    description: "Futuristic single-lens shield style",
    category: "sunglasses",
    paths: {
      frame:
        "M35,72 Q100,62 165,72 Q170,82 165,92 Q100,100 35,92 Q30,82 35,72 Z",
      lens: "M40,74 Q100,66 160,74 Q164,82 160,90 Q100,96 40,90 Q36,82 40,74 Z",
      bridge: "M95,72 Q100,70 105,72 Q100,71 95,72 Z",
      details: "M35,78 L25,75 M165,78 L175,75",
    },
    colors: {
      frame: "#E5E7EB",
      lens: "#1C1917",
      accent: null,
    },
    lensOpacity: 0.9,
    lensTint: "#1C1917",
    colorizable: true,
    frameColorOptions: ["#E5E7EB", "#1C1917", "#F5F5F4"],
    lensColorOptions: ["#1C1917", "#3B82F6", "#A855F7", "#F59E0B"],
    rarity: "rare",
    tags: ["futuristic", "bold", "fashion"],
    sortOrder: 14,
  },
  {
    id: "eyewear_mirrored",
    name: "Mirrored Sunglasses",
    description: "Reflective mirrored lens sunglasses",
    category: "sunglasses",
    paths: {
      frame:
        "M45,72 Q50,65 70,68 Q80,70 78,82 Q75,92 60,92 Q45,90 45,72 Z M155,72 Q150,65 130,68 Q120,70 122,82 Q125,92 140,92 Q155,90 155,72 Z",
      lens: "M48,74 Q52,68 68,70 Q76,72 75,82 Q72,90 60,90 Q48,88 48,74 Z M152,74 Q148,68 132,70 Q124,72 125,82 Q128,90 140,90 Q152,88 152,74 Z",
      bridge: "M78,75 Q100,70 122,75 M85,72 Q100,68 115,72",
      details:
        "M45,78 L35,75 M155,78 L165,75 M55,75 L65,85 M60,72 L70,82 M145,75 L135,85 M140,72 L130,82", // Mirror reflection lines
    },
    colors: {
      frame: "#E5E7EB",
      lens: "#3B82F6",
      accent: "#06B6D4",
    },
    lensOpacity: 1,
    lensTint: "#3B82F6",
    colorizable: true,
    frameColorOptions: ["#E5E7EB", "#F59E0B", "#1C1917"],
    lensColorOptions: ["#3B82F6", "#F59E0B", "#A855F7", "#22C55E", "#F472B6"],
    rarity: "rare",
    tags: ["flashy", "reflective", "trendy"],
    sortOrder: 15,
  },
  {
    id: "eyewear_gradient",
    name: "Gradient Sunglasses",
    description: "Sunglasses with gradient tinted lenses",
    category: "sunglasses",
    paths: {
      frame:
        "M46,70 L82,68 L84,90 L48,92 Z M50,72 L78,71 L80,88 L52,89 Z M116,68 L154,70 L152,92 L116,90 Z M120,71 L150,72 L148,89 L118,88 Z",
      lens: "M50,72 L78,71 L80,88 L52,89 Z M120,71 L150,72 L148,89 L118,88 Z",
      bridge: "M82,76 Q100,73 118,76 Q100,74 82,77 Z",
      details: "M46,76 L36,74 M154,76 L164,74",
    },
    colors: {
      frame: "#7C2D12",
      lens: "#44403C",
      accent: null,
    },
    lensOpacity: 0.7,
    lensTint: "#44403C",
    colorizable: true,
    frameColorOptions: ["#7C2D12", "#1C1917", "#F59E0B"],
    lensColorOptions: ["#44403C", "#3B82F6", "#A855F7"],
    rarity: "uncommon",
    tags: ["gradient", "stylish", "casual"],
    sortOrder: 16,
  },
  {
    id: "eyewear_clip_on",
    name: "Clip-On Shades",
    description: "Retro clip-on sunglasses attachment",
    category: "sunglasses",
    paths: {
      frame: "", // No additional frame, clips to existing
      lens: "M55,70 Q65,66 75,70 Q80,78 75,86 Q65,90 55,86 Q50,78 55,70 Z M125,70 Q135,66 145,70 Q150,78 145,86 Q135,90 125,86 Q120,78 125,70 Z",
      bridge: "M75,76 Q100,72 125,76 M78,74 L82,72 M118,74 L122,72", // Clips
      details: "M55,78 L52,78 M145,78 L148,78", // Hinge detail
    },
    colors: {
      frame: "#44403C",
      lens: "#22C55E",
      accent: null,
    },
    lensOpacity: 0.8,
    lensTint: "#22C55E",
    colorizable: true,
    frameColorOptions: ["#44403C", "#F59E0B", "#E5E7EB"],
    lensColorOptions: ["#22C55E", "#44403C", "#3B82F6", "#F59E0B"],
    rarity: "rare",
    tags: ["retro", "unique", "vintage"],
    sortOrder: 17,
  },
];

// =============================================================================
// EYEWEAR DATA - SPECIAL (2 items)
// =============================================================================

const EYEWEAR_SPECIAL: EyewearData[] = [
  {
    id: "eyewear_3d_glasses",
    name: "3D Glasses",
    description: "Classic red and blue 3D movie glasses",
    category: "special",
    paths: {
      frame: "M42,70 L85,70 L85,90 L42,90 Z M115,70 L158,70 L158,90 L115,90 Z",
      lens: "M45,72 L82,72 L82,88 L45,88 Z M118,72 L155,72 L155,88 L118,88 Z",
      bridge: "M85,78 Q100,75 115,78 L115,82 Q100,79 85,82 Z",
      details: "M42,78 L32,76 M158,78 L168,76",
    },
    colors: {
      frame: "#F5F5F4",
      lens: "#DC2626",
      accent: "#3B82F6",
    },
    lensOpacity: 0.7,
    lensTint: "#DC2626", // Left lens is red
    colorizable: false,
    frameColorOptions: null,
    lensColorOptions: null,
    rarity: "rare",
    tags: ["fun", "retro", "movies", "costume"],
    sortOrder: 18,
  },
  {
    id: "eyewear_monocle",
    name: "Monocle",
    description: "Distinguished single-lens eyepiece",
    category: "special",
    paths: {
      frame:
        "M120,78 Q120,65 135,65 Q150,65 150,78 Q150,91 135,91 Q120,91 120,78 Z M125,78 Q125,68 135,68 Q145,68 145,78 Q145,88 135,88 Q125,88 125,78 Z",
      lens: "M125,78 Q125,68 135,68 Q145,68 145,78 Q145,88 135,88 Q125,88 125,78 Z",
      bridge: "",
      details: "M135,91 L135,120 Q130,125 125,120", // Chain detail
    },
    colors: {
      frame: "#F59E0B",
      lens: "#FFFFFF",
      accent: null,
    },
    lensOpacity: 0.05,
    lensTint: null,
    colorizable: true,
    frameColorOptions: ["#F59E0B", "#E5E7EB", "#1C1917"],
    lensColorOptions: null,
    rarity: "epic",
    tags: ["distinguished", "fancy", "vintage", "gentleman"],
    sortOrder: 19,
  },
  {
    id: "eyewear_goggles_ski",
    name: "Ski Goggles",
    description: "Large protective ski/snowboard goggles",
    category: "goggles",
    paths: {
      frame:
        "M30,70 Q100,55 170,70 Q175,82 170,94 Q100,105 30,94 Q25,82 30,70 Z",
      lens: "M35,72 Q100,60 165,72 Q168,82 165,92 Q100,100 35,92 Q32,82 35,72 Z",
      bridge: "M95,68 Q100,66 105,68 Q100,67 95,68 Z",
      details:
        "M30,80 L22,78 M170,80 L178,78 M50,72 L50,92 M85,70 L85,94 M115,70 L115,94 M150,72 L150,92", // Vents
    },
    colors: {
      frame: "#1C1917",
      lens: "#F59E0B",
      accent: "#DC2626",
    },
    lensOpacity: 0.9,
    lensTint: "#F59E0B",
    colorizable: true,
    frameColorOptions: ["#1C1917", "#F5F5F4", "#DC2626", "#3B82F6"],
    lensColorOptions: ["#F59E0B", "#3B82F6", "#A855F7", "#22C55E"],
    rarity: "rare",
    tags: ["winter", "ski", "snowboard", "sport"],
    sortOrder: 20,
  },
  {
    id: "eyewear_star_glasses",
    name: "Star Glasses",
    description: "Fun star-shaped party glasses",
    category: "special",
    paths: {
      frame:
        "M65,78 L55,72 L50,78 L55,84 L65,78 L65,68 L72,78 L65,88 L65,78 L75,78 Z M135,78 L125,72 L120,78 L125,84 L135,78 L135,68 L142,78 L135,88 L135,78 L145,78 Z",
      lens: "M65,78 L58,74 L54,78 L58,82 L65,78 L65,72 L70,78 L65,84 Z M135,78 L128,74 L124,78 L128,82 L135,78 L135,72 L140,78 L135,84 Z",
      bridge: "M75,78 Q100,75 120,78 Q100,77 75,79 Z",
      details: "M50,78 L40,76 M150,78 L160,76",
    },
    colors: {
      frame: "#F472B6",
      lens: "#FBBF24",
      accent: "#A855F7",
    },
    lensOpacity: 0.6,
    lensTint: "#FBBF24",
    colorizable: true,
    frameColorOptions: ["#F472B6", "#A855F7", "#DC2626", "#3B82F6", "#22C55E"],
    lensColorOptions: ["#FBBF24", "#F472B6", "#3B82F6"],
    rarity: "rare",
    tags: ["fun", "party", "costume", "playful"],
    sortOrder: 21,
  },
];

// =============================================================================
// COMBINED EYEWEAR DATA
// =============================================================================

export const EYEWEAR: EyewearData[] = [
  ...EYEWEAR_GLASSES,
  ...EYEWEAR_SUNGLASSES,
  ...EYEWEAR_SPECIAL,
];

export const DEFAULT_EYEWEAR: EyewearData = EYEWEAR[0]; // eyewear_none

// =============================================================================
// ACCESSOR FUNCTIONS
// =============================================================================

/**
 * Get eyewear by ID
 */
export function getEyewear(id: string): EyewearData | undefined {
  return EYEWEAR.find((e) => e.id === id);
}

/**
 * Get eyewear by ID with fallback to default
 */
export function getEyewearSafe(id: string | null | undefined): EyewearData {
  if (!id) return DEFAULT_EYEWEAR;
  return getEyewear(id) ?? DEFAULT_EYEWEAR;
}

/**
 * Get all eyewear in a category
 */
export function getEyewearByCategory(category: EyewearCategory): EyewearData[] {
  return EYEWEAR.filter((e) => e.category === category);
}

/**
 * Get all eyewear by rarity
 */
export function getEyewearByRarity(rarity: EyewearRarity): EyewearData[] {
  return EYEWEAR.filter((e) => e.rarity === rarity);
}

/**
 * Get all colorizable eyewear
 */
export function getColorizableEyewear(): EyewearData[] {
  return EYEWEAR.filter((e) => e.colorizable);
}

/**
 * Get glasses (clear lens)
 */
export function getGlasses(): EyewearData[] {
  return getEyewearByCategory("glasses").filter((e) => e.id !== "eyewear_none");
}

/**
 * Get sunglasses
 */
export function getSunglasses(): EyewearData[] {
  return getEyewearByCategory("sunglasses");
}

/**
 * Get special eyewear
 */
export function getSpecialEyewear(): EyewearData[] {
  return [
    ...getEyewearByCategory("special"),
    ...getEyewearByCategory("goggles"),
  ];
}

/**
 * Get all eyewear IDs
 */
export function getAllEyewearIds(): string[] {
  return EYEWEAR.map((e) => e.id);
}
