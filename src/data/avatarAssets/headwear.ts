/**
 * Headwear Asset Definitions
 *
 * Contains all headwear items for the avatar system including
 * hats, caps, beanies, headbands, crowns, and special items.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md
 */

import type { HairStyleId } from "@/types/avatar";

// =============================================================================
// TYPES
// =============================================================================

export type HeadwearCategory =
  | "hat"
  | "cap"
  | "beanie"
  | "headband"
  | "crown"
  | "special";

export type HeadwearRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type HeadwearPosition = "top" | "full" | "back" | "side";

export type HeadwearHairInteraction = "hide" | "partial" | "none";

export interface HeadwearData {
  id: string;
  name: string;
  description: string;
  category: HeadwearCategory;

  // SVG paths
  paths: {
    main: string; // Primary headwear shape
    details: string | null; // Additional details (logos, patterns)
    shadow: string | null; // Shadow/depth
    back: string | null; // Parts behind head
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

  // Positioning and interaction
  position: HeadwearPosition;
  hairInteraction: HeadwearHairInteraction;

  // Metadata
  rarity: HeadwearRarity;
  tags: string[];
  sortOrder: number;
}

// =============================================================================
// HEADWEAR DATA - HATS/CAPS (15 items)
// =============================================================================

const HEADWEAR_HATS_CAPS: HeadwearData[] = [
  {
    id: "headwear_none",
    name: "No Headwear",
    description: "Show off your hairstyle",
    category: "hat",
    paths: {
      main: "",
      details: null,
      shadow: null,
      back: null,
    },
    colors: {
      primary: "transparent",
      secondary: null,
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    position: "top",
    hairInteraction: "none",
    rarity: "common",
    tags: [],
    sortOrder: 0,
  },
  {
    id: "headwear_baseball_cap",
    name: "Baseball Cap",
    description: "Classic sporty look for everyday wear",
    category: "cap",
    paths: {
      main: "M45,55 Q100,25 155,55 L155,65 Q100,50 45,65 Z M45,55 L30,65 Q25,70 30,75 L55,70 L45,65 Z",
      details: "M75,50 Q100,40 125,50 L120,55 Q100,48 80,55 Z", // Cap logo area
      shadow: "M48,62 Q100,48 152,62 L150,68 Q100,56 50,68 Z",
      back: null,
    },
    colors: {
      primary: "#1E3A8A",
      secondary: "#FFFFFF",
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#1E3A8A",
      "#DC2626",
      "#16A34A",
      "#000000",
      "#FFFFFF",
      "#7C3AED",
      "#EA580C",
      "#0891B2",
    ],
    position: "top",
    hairInteraction: "partial",
    rarity: "common",
    tags: ["casual", "sporty", "everyday"],
    sortOrder: 1,
  },
  {
    id: "headwear_snapback",
    name: "Snapback",
    description: "Flat-brimmed cap with street style",
    category: "cap",
    paths: {
      main: "M42,52 Q100,20 158,52 L158,68 Q100,48 42,68 Z M42,52 L25,62 Q20,68 28,74 L50,68 L42,60 Z",
      details: "M70,42 L130,42 L128,52 L72,52 Z", // Flat top
      shadow: "M45,60 Q100,45 155,60 L152,70 Q100,55 48,70 Z",
      back: null,
    },
    colors: {
      primary: "#000000",
      secondary: "#DC2626",
      accent: "#FFFFFF",
    },
    colorizable: true,
    colorOptions: [
      "#000000",
      "#1E3A8A",
      "#DC2626",
      "#16A34A",
      "#7C3AED",
      "#D97706",
    ],
    position: "top",
    hairInteraction: "partial",
    rarity: "common",
    tags: ["streetwear", "casual", "urban"],
    sortOrder: 2,
  },
  {
    id: "headwear_dad_hat",
    name: "Dad Hat",
    description: "Relaxed unstructured cap with curved brim",
    category: "cap",
    paths: {
      main: "M48,55 Q100,30 152,55 Q155,65 152,70 Q100,55 48,70 Q45,65 48,55 Z M48,55 L35,62 Q30,68 35,73 L52,68 L48,62 Z",
      details: null,
      shadow: "M50,62 Q100,50 150,62 L148,68 Q100,58 52,68 Z",
      back: null,
    },
    colors: {
      primary: "#A3A3A3",
      secondary: null,
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#A3A3A3",
      "#000000",
      "#1E3A8A",
      "#F5F5F4",
      "#166534",
      "#78350F",
    ],
    position: "top",
    hairInteraction: "partial",
    rarity: "common",
    tags: ["casual", "relaxed", "everyday"],
    sortOrder: 3,
  },
  {
    id: "headwear_bucket_hat",
    name: "Bucket Hat",
    description: "Round, soft-brimmed hat for a relaxed look",
    category: "hat",
    paths: {
      main: "M30,60 Q100,35 170,60 Q175,70 170,75 L30,75 Q25,70 30,60 Z",
      details: "M35,62 Q100,40 165,62 Q168,68 165,72 L35,72 Q32,68 35,62 Z", // Inner dome
      shadow: "M40,68 Q100,52 160,68 L158,73 L42,73 Z",
      back: null,
    },
    colors: {
      primary: "#78716C",
      secondary: null,
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#78716C",
      "#000000",
      "#F5F5F4",
      "#1E3A8A",
      "#16A34A",
      "#D97706",
    ],
    position: "full",
    hairInteraction: "partial",
    rarity: "uncommon",
    tags: ["casual", "trendy", "beach"],
    sortOrder: 4,
  },
  {
    id: "headwear_fedora",
    name: "Fedora",
    description: "Classic pinched-crown hat with style",
    category: "hat",
    paths: {
      main: "M35,65 Q100,45 165,65 Q170,72 165,78 L35,78 Q30,72 35,65 Z M50,55 Q100,35 150,55 L145,65 Q100,50 55,65 Z",
      details: "M55,58 Q100,42 145,58 L140,62 Q100,50 60,62 Z", // Crown indent
      shadow: "M40,68 Q100,55 160,68 L158,75 L42,75 Z",
      back: null,
    },
    colors: {
      primary: "#1C1917",
      secondary: "#78716C",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#1C1917", "#78716C", "#422006", "#1E3A8A", "#44403C"],
    position: "top",
    hairInteraction: "partial",
    rarity: "rare",
    tags: ["formal", "classic", "elegant"],
    sortOrder: 5,
  },
  {
    id: "headwear_cowboy",
    name: "Cowboy Hat",
    description: "Western-style hat with wide brim",
    category: "hat",
    paths: {
      main: "M20,70 Q100,55 180,70 Q185,78 180,82 L20,82 Q15,78 20,70 Z M40,50 Q100,30 160,50 Q165,60 160,65 Q100,50 40,65 Q35,60 40,50 Z",
      details:
        "M45,52 Q100,35 155,52 Q158,58 155,62 Q100,50 45,62 Q42,58 45,52 Z", // Crown
      shadow: "M25,72 Q100,60 175,72 L172,80 L28,80 Z",
      back: null,
    },
    colors: {
      primary: "#92400E",
      secondary: "#78350F",
      accent: "#D97706",
    },
    colorizable: true,
    colorOptions: ["#92400E", "#1C1917", "#78716C", "#F5F5F4"],
    position: "full",
    hairInteraction: "partial",
    rarity: "rare",
    tags: ["western", "country", "costume"],
    sortOrder: 6,
  },
  {
    id: "headwear_top_hat",
    name: "Top Hat",
    description: "Elegant tall formal hat",
    category: "hat",
    paths: {
      main: "M35,75 Q100,68 165,75 Q168,80 165,85 L35,85 Q32,80 35,75 Z M55,30 L145,30 Q150,32 150,75 L50,75 Q50,32 55,30 Z",
      details: "M57,35 L143,35 Q147,37 147,72 L53,72 Q53,37 57,35 Z", // Inner shape
      shadow: "M55,70 L145,70 L143,78 L57,78 Z",
      back: null,
    },
    colors: {
      primary: "#1C1917",
      secondary: "#44403C",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    position: "top",
    hairInteraction: "partial",
    rarity: "epic",
    tags: ["formal", "elegant", "fancy", "costume"],
    sortOrder: 7,
  },
  {
    id: "headwear_bowler",
    name: "Bowler Hat",
    description: "Round-crowned hat with curled brim",
    category: "hat",
    paths: {
      main: "M35,70 Q100,62 165,70 Q170,76 165,80 L35,80 Q30,76 35,70 Z M50,50 Q100,35 150,50 Q155,58 150,68 Q100,60 50,68 Q45,58 50,50 Z",
      details: null,
      shadow: "M40,72 Q100,66 160,72 L158,78 L42,78 Z",
      back: null,
    },
    colors: {
      primary: "#1C1917",
      secondary: null,
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#1C1917", "#44403C", "#78716C"],
    position: "top",
    hairInteraction: "partial",
    rarity: "rare",
    tags: ["classic", "vintage", "formal"],
    sortOrder: 8,
  },
  {
    id: "headwear_newsboy",
    name: "Newsboy Cap",
    description: "Vintage style flat cap with paneled crown",
    category: "cap",
    paths: {
      main: "M42,60 Q100,35 158,60 Q160,70 158,75 Q100,65 42,75 Q40,70 42,60 Z M42,60 L30,68 Q28,72 32,76 L48,72 Z",
      details: "M50,45 L100,38 L150,45 L145,55 L100,48 L55,55 Z", // Panel lines
      shadow: "M45,65 Q100,52 155,65 L152,72 Q100,62 48,72 Z",
      back: null,
    },
    colors: {
      primary: "#78716C",
      secondary: "#57534E",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#78716C", "#1C1917", "#422006", "#1E3A8A"],
    position: "top",
    hairInteraction: "partial",
    rarity: "uncommon",
    tags: ["vintage", "classic", "artistic"],
    sortOrder: 9,
  },
  {
    id: "headwear_beret",
    name: "Beret",
    description: "Soft round cap with artistic flair",
    category: "hat",
    paths: {
      main: "M40,65 Q100,40 160,65 Q165,72 160,78 Q100,70 40,78 Q35,72 40,65 Z",
      details: "M95,42 L105,42 L103,48 L97,48 Z", // Small stem
      shadow: "M45,68 Q100,52 155,68 L150,75 Q100,66 50,75 Z",
      back: null,
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
      "#16A34A",
      "#78716C",
      "#7C3AED",
    ],
    position: "top",
    hairInteraction: "partial",
    rarity: "uncommon",
    tags: ["artistic", "french", "casual"],
    sortOrder: 10,
  },
  {
    id: "headwear_sun_hat",
    name: "Sun Hat",
    description: "Wide-brimmed hat for sunny days",
    category: "hat",
    paths: {
      main: "M15,68 Q100,50 185,68 Q190,75 185,80 L15,80 Q10,75 15,68 Z M45,55 Q100,40 155,55 Q158,62 155,68 Q100,58 45,68 Q42,62 45,55 Z",
      details: "M60,60 Q100,52 140,60 L138,65 Q100,58 62,65 Z", // Ribbon band
      shadow: "M20,70 Q100,58 180,70 L178,78 L22,78 Z",
      back: null,
    },
    colors: {
      primary: "#FEF3C7",
      secondary: "#F59E0B",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#FEF3C7", "#F5F5F4", "#FDE68A", "#FECACA", "#A5F3FC"],
    position: "full",
    hairInteraction: "partial",
    rarity: "uncommon",
    tags: ["summer", "beach", "casual"],
    sortOrder: 11,
  },
  {
    id: "headwear_visor",
    name: "Visor",
    description: "Open-top cap that keeps sun out of eyes",
    category: "cap",
    paths: {
      main: "M45,65 Q100,58 155,65 L155,72 Q100,66 45,72 Z M45,65 L28,72 Q24,76 30,80 L52,74 L45,70 Z",
      details: null,
      shadow: "M48,68 Q100,62 152,68 L150,73 Q100,68 50,73 Z",
      back: null,
    },
    colors: {
      primary: "#F5F5F4",
      secondary: "#1E3A8A",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#F5F5F4", "#1E3A8A", "#DC2626", "#000000", "#16A34A"],
    position: "top",
    hairInteraction: "none",
    rarity: "common",
    tags: ["sporty", "tennis", "golf", "summer"],
    sortOrder: 12,
  },
  {
    id: "headwear_trucker",
    name: "Trucker Hat",
    description: "Foam front cap with mesh back",
    category: "cap",
    paths: {
      main: "M45,55 Q100,28 155,55 L155,68 Q100,52 45,68 Z M45,55 L30,62 Q26,68 32,73 L50,67 L45,62 Z",
      details: "M105,32 Q140,35 150,55 L150,65 Q138,52 108,48 Z", // Mesh pattern suggestion
      shadow: "M48,60 Q100,48 152,60 L150,68 Q100,56 50,68 Z",
      back: null,
    },
    colors: {
      primary: "#F5F5F4",
      secondary: "#000000",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#F5F5F4", "#DC2626", "#1E3A8A", "#16A34A", "#D97706"],
    position: "top",
    hairInteraction: "partial",
    rarity: "common",
    tags: ["casual", "americana", "outdoor"],
    sortOrder: 13,
  },
  {
    id: "headwear_safari",
    name: "Safari Hat",
    description: "Outdoor adventure hat with wide brim",
    category: "hat",
    paths: {
      main: "M25,68 Q100,52 175,68 Q180,75 175,80 L25,80 Q20,75 25,68 Z M50,50 Q100,35 150,50 Q155,58 150,66 Q100,55 50,66 Q45,58 50,50 Z",
      details: "M55,54 Q100,42 145,54 L142,60 Q100,50 58,60 Z", // Crown band
      shadow: "M30,70 Q100,58 170,70 L168,78 L32,78 Z",
      back: null,
    },
    colors: {
      primary: "#D6D3D1",
      secondary: "#78716C",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#D6D3D1", "#78716C", "#92400E", "#16A34A"],
    position: "full",
    hairInteraction: "partial",
    rarity: "uncommon",
    tags: ["outdoor", "adventure", "explorer"],
    sortOrder: 14,
  },
];

// =============================================================================
// HEADWEAR DATA - BEANIES/WINTER (5 items)
// =============================================================================

const HEADWEAR_BEANIES: HeadwearData[] = [
  {
    id: "headwear_beanie_basic",
    name: "Basic Beanie",
    description: "Simple warm knit beanie",
    category: "beanie",
    paths: {
      main: "M40,70 Q100,30 160,70 Q165,78 160,85 Q100,80 40,85 Q35,78 40,70 Z",
      details: "M45,72 Q100,38 155,72 L152,78 Q100,72 48,78 Z", // Fold line
      shadow: "M45,75 Q100,58 155,75 L152,82 Q100,76 48,82 Z",
      back: null,
    },
    colors: {
      primary: "#1C1917",
      secondary: null,
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#1C1917",
      "#44403C",
      "#78716C",
      "#1E3A8A",
      "#DC2626",
      "#16A34A",
      "#7C3AED",
      "#D97706",
    ],
    position: "full",
    hairInteraction: "hide",
    rarity: "common",
    tags: ["winter", "casual", "warm"],
    sortOrder: 15,
  },
  {
    id: "headwear_beanie_pom",
    name: "Pom Pom Beanie",
    description: "Cozy beanie with fluffy pom pom on top",
    category: "beanie",
    paths: {
      main: "M40,70 Q100,30 160,70 Q165,78 160,85 Q100,80 40,85 Q35,78 40,70 Z M88,22 Q100,12 112,22 Q120,32 112,42 Q100,50 88,42 Q80,32 88,22 Z",
      details: "M45,72 Q100,38 155,72 L152,78 Q100,72 48,78 Z",
      shadow: "M45,75 Q100,58 155,75 L152,82 Q100,76 48,82 Z",
      back: null,
    },
    colors: {
      primary: "#DC2626",
      secondary: "#F5F5F4",
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#DC2626",
      "#1E3A8A",
      "#16A34A",
      "#F472B6",
      "#FEF3C7",
      "#7C3AED",
    ],
    position: "full",
    hairInteraction: "hide",
    rarity: "common",
    tags: ["winter", "cute", "warm"],
    sortOrder: 16,
  },
  {
    id: "headwear_beanie_slouch",
    name: "Slouchy Beanie",
    description: "Relaxed oversized beanie with extra room",
    category: "beanie",
    paths: {
      main: "M38,72 Q100,25 162,72 Q170,82 165,90 Q100,85 35,90 Q30,82 38,72 Z",
      details: "M45,75 Q100,40 155,75 L150,82 Q100,75 50,82 Z",
      shadow: "M42,78 Q100,55 158,78 L155,88 Q100,82 45,88 Z",
      back: "M120,30 Q145,45 150,72 L145,75 Q140,50 118,38 Z", // Slouch drape
    },
    colors: {
      primary: "#78716C",
      secondary: null,
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#78716C", "#1C1917", "#44403C", "#1E3A8A", "#7C3AED"],
    position: "full",
    hairInteraction: "hide",
    rarity: "uncommon",
    tags: ["winter", "casual", "relaxed", "hipster"],
    sortOrder: 17,
  },
  {
    id: "headwear_ear_flap",
    name: "Ear Flap Hat",
    description: "Warm hat with flaps to cover ears",
    category: "beanie",
    paths: {
      main: "M40,65 Q100,32 160,65 Q165,72 160,78 Q100,72 40,78 Q35,72 40,65 Z",
      details:
        "M30,68 L45,68 L48,95 Q40,100 32,95 L30,68 Z M155,68 L170,68 L168,95 Q160,100 152,95 L155,68 Z", // Ear flaps
      shadow: "M45,70 Q100,48 155,70 L152,76 Q100,68 48,76 Z",
      back: null,
    },
    colors: {
      primary: "#92400E",
      secondary: "#FEF3C7",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#92400E", "#78716C", "#1C1917", "#DC2626"],
    position: "full",
    hairInteraction: "hide",
    rarity: "uncommon",
    tags: ["winter", "warm", "outdoor", "ski"],
    sortOrder: 18,
  },
  {
    id: "headwear_trapper",
    name: "Trapper Hat",
    description: "Fur-lined winter hat for extreme cold",
    category: "beanie",
    paths: {
      main: "M38,62 Q100,35 162,62 Q168,70 162,78 Q100,70 38,78 Q32,70 38,62 Z",
      details:
        "M28,65 L42,62 L45,92 Q38,98 28,92 L25,65 Z M158,62 L172,65 L175,92 Q165,98 155,92 L158,62 Z", // Ear flaps with fur
      shadow:
        "M40,68 Q100,50 160,68 L158,75 Q100,66 42,75 Z M30,70 L40,68 L42,88 L32,88 Z M160,68 L170,70 L168,88 L158,88 Z", // Fur texture
      back: null,
    },
    colors: {
      primary: "#1C1917",
      secondary: "#D6D3D1",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#1C1917", "#78716C", "#92400E"],
    position: "full",
    hairInteraction: "hide",
    rarity: "rare",
    tags: ["winter", "warm", "outdoor", "cold-weather"],
    sortOrder: 19,
  },
];

// =============================================================================
// HEADWEAR DATA - HEADBANDS/SPECIAL (10 items)
// =============================================================================

const HEADWEAR_SPECIAL: HeadwearData[] = [
  {
    id: "headwear_headband_sport",
    name: "Sport Headband",
    description: "Athletic sweatband for active wear",
    category: "headband",
    paths: {
      main: "M35,62 Q100,52 165,62 Q168,68 165,74 Q100,64 35,74 Q32,68 35,62 Z",
      details: null,
      shadow: "M38,65 Q100,56 162,65 L160,71 Q100,62 40,71 Z",
      back: null,
    },
    colors: {
      primary: "#F5F5F4",
      secondary: null,
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#F5F5F4",
      "#000000",
      "#DC2626",
      "#1E3A8A",
      "#16A34A",
      "#F472B6",
    ],
    position: "top",
    hairInteraction: "none",
    rarity: "common",
    tags: ["sporty", "athletic", "gym"],
    sortOrder: 20,
  },
  {
    id: "headwear_headband_thin",
    name: "Thin Headband",
    description: "Delicate headband for a subtle look",
    category: "headband",
    paths: {
      main: "M35,58 Q100,48 165,58 Q167,62 165,66 Q100,56 35,66 Q33,62 35,58 Z",
      details: null,
      shadow: null,
      back: null,
    },
    colors: {
      primary: "#1C1917",
      secondary: null,
      accent: null,
    },
    colorizable: true,
    colorOptions: [
      "#1C1917",
      "#F5F5F4",
      "#DC2626",
      "#F472B6",
      "#7C3AED",
      "#D97706",
    ],
    position: "top",
    hairInteraction: "none",
    rarity: "common",
    tags: ["casual", "simple", "everyday"],
    sortOrder: 21,
  },
  {
    id: "headwear_bandana",
    name: "Bandana",
    description: "Classic patterned headwrap",
    category: "headband",
    paths: {
      main: "M32,60 Q100,42 168,60 Q172,68 168,75 Q100,62 32,75 Q28,68 32,60 Z",
      details:
        "M40,62 L50,55 L48,65 L58,58 L56,68 L66,61 L64,71 Z M140,62 L150,55 L148,65 L158,58 L156,68 L166,61 L164,71 Z", // Pattern
      shadow: "M35,65 Q100,52 165,65 L162,72 Q100,60 38,72 Z",
      back: "M150,60 L165,72 L162,85 Q155,95 145,90 L148,75 Z", // Tied end
    },
    colors: {
      primary: "#DC2626",
      secondary: "#F5F5F4",
      accent: null,
    },
    colorizable: true,
    colorOptions: ["#DC2626", "#1E3A8A", "#000000", "#16A34A", "#7C3AED"],
    position: "top",
    hairInteraction: "none",
    rarity: "uncommon",
    tags: ["casual", "western", "rock"],
    sortOrder: 22,
  },
  {
    id: "headwear_crown_simple",
    name: "Simple Crown",
    description: "Basic golden crown",
    category: "crown",
    paths: {
      main: "M45,65 L55,40 L75,55 L100,35 L125,55 L145,40 L155,65 Z",
      details:
        "M55,42 Q58,45 55,48 M75,55 Q78,58 75,61 M100,35 Q103,38 100,41 M125,55 Q128,58 125,61 M145,42 Q148,45 145,48", // Jewel dots
      shadow: "M50,60 L100,42 L150,60 L148,65 L100,48 L52,65 Z",
      back: null,
    },
    colors: {
      primary: "#F59E0B",
      secondary: "#FCD34D",
      accent: "#DC2626",
    },
    colorizable: false,
    colorOptions: null,
    position: "top",
    hairInteraction: "none",
    rarity: "epic",
    tags: ["royalty", "premium", "achievement"],
    sortOrder: 23,
  },
  {
    id: "headwear_crown_royal",
    name: "Royal Crown",
    description: "Elaborate royal crown with jewels",
    category: "crown",
    paths: {
      main: "M40,70 L45,45 L65,55 L80,35 L100,28 L120,35 L135,55 L155,45 L160,70 Z M40,70 Q100,65 160,70 Q162,75 160,80 Q100,75 40,80 Q38,75 40,70 Z",
      details:
        "M65,55 Q68,52 65,49 M100,28 Q105,25 100,22 M135,55 Q138,52 135,49 M80,48 L82,52 M120,48 L118,52", // Jewels
      shadow: "M45,68 Q100,62 155,68 L152,75 Q100,70 48,75 Z",
      back: null,
    },
    colors: {
      primary: "#F59E0B",
      secondary: "#DC2626",
      accent: "#1E3A8A",
    },
    colorizable: false,
    colorOptions: null,
    position: "top",
    hairInteraction: "none",
    rarity: "legendary",
    tags: ["royalty", "premium", "achievement", "exclusive"],
    sortOrder: 24,
  },
  {
    id: "headwear_tiara",
    name: "Tiara",
    description: "Elegant princess-style tiara",
    category: "crown",
    paths: {
      main: "M50,68 L60,55 L75,62 L90,48 L100,42 L110,48 L125,62 L140,55 L150,68 Q100,62 50,68 Z",
      details:
        "M100,42 Q103,39 100,36 M90,50 Q92,48 90,46 M110,50 Q108,48 110,46", // Jewels
      shadow: "M55,66 Q100,60 145,66 L142,70 Q100,66 58,70 Z",
      back: null,
    },
    colors: {
      primary: "#E5E7EB",
      secondary: "#F472B6",
      accent: "#8B5CF6",
    },
    colorizable: false,
    colorOptions: null,
    position: "top",
    hairInteraction: "none",
    rarity: "epic",
    tags: ["royalty", "elegant", "feminine", "princess"],
    sortOrder: 25,
  },
  {
    id: "headwear_party_hat",
    name: "Party Hat",
    description: "Festive cone party hat",
    category: "special",
    paths: {
      main: "M60,75 L100,20 L140,75 Q100,70 60,75 Z",
      details: "M75,55 Q80,52 85,58 M105,45 Q110,42 115,48 M88,65 Q92,62 96,68", // Confetti dots
      shadow: "M65,72 L100,28 L135,72 Q100,68 65,72 Z",
      back: null,
    },
    colors: {
      primary: "#F472B6",
      secondary: "#FCD34D",
      accent: "#34D399",
    },
    colorizable: true,
    colorOptions: ["#F472B6", "#1E3A8A", "#DC2626", "#16A34A", "#7C3AED"],
    position: "top",
    hairInteraction: "partial",
    rarity: "uncommon",
    tags: ["party", "celebration", "birthday", "fun"],
    sortOrder: 26,
  },
  {
    id: "headwear_graduation_cap",
    name: "Graduation Cap",
    description: "Academic mortarboard cap",
    category: "special",
    paths: {
      main: "M30,62 L100,48 L170,62 L100,75 Z M45,70 Q100,60 155,70 Q158,78 155,85 Q100,80 45,85 Q42,78 45,70 Z",
      details: "M100,48 L100,30 M95,28 L100,30 L105,28 L100,45 Z", // Tassel
      shadow: "M35,64 L100,52 L165,64 L100,72 Z",
      back: null,
    },
    colors: {
      primary: "#1C1917",
      secondary: "#F59E0B",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    position: "top",
    hairInteraction: "partial",
    rarity: "rare",
    tags: ["academic", "graduation", "achievement", "school"],
    sortOrder: 27,
  },
  {
    id: "headwear_chef_hat",
    name: "Chef Hat",
    description: "Classic tall chef's toque",
    category: "special",
    paths: {
      main: "M45,80 Q100,72 155,80 Q158,85 155,90 Q100,85 45,90 Q42,85 45,80 Z M50,25 Q100,15 150,25 Q160,45 155,80 Q100,72 45,80 Q40,45 50,25 Z",
      details:
        "M55,30 Q100,22 145,30 Q152,45 148,75 Q100,68 52,75 Q48,45 55,30 Z", // Pleats
      shadow: "M52,78 Q100,70 148,78 L145,85 Q100,80 55,85 Z",
      back: null,
    },
    colors: {
      primary: "#F5F5F4",
      secondary: "#E5E7EB",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    position: "full",
    hairInteraction: "hide",
    rarity: "rare",
    tags: ["professional", "chef", "cooking", "costume"],
    sortOrder: 28,
  },
  {
    id: "headwear_halo",
    name: "Halo",
    description: "Angelic golden halo ring",
    category: "special",
    paths: {
      main: "M50,42 Q100,25 150,42 Q155,48 150,52 Q100,38 50,52 Q45,48 50,42 Z",
      details:
        "M55,44 Q100,30 145,44 Q148,48 145,50 Q100,38 55,50 Q52,48 55,44 Z", // Inner ring
      shadow: null,
      back: null,
    },
    colors: {
      primary: "#FCD34D",
      secondary: "#F59E0B",
      accent: null,
    },
    colorizable: false,
    colorOptions: null,
    position: "top",
    hairInteraction: "none",
    rarity: "epic",
    tags: ["angelic", "special", "costume", "holy"],
    sortOrder: 29,
  },
];

// =============================================================================
// COMBINED HEADWEAR DATA
// =============================================================================

export const HEADWEAR: HeadwearData[] = [
  ...HEADWEAR_HATS_CAPS,
  ...HEADWEAR_BEANIES,
  ...HEADWEAR_SPECIAL,
];

export const DEFAULT_HEADWEAR: HeadwearData = HEADWEAR[0]; // headwear_none

// =============================================================================
// ACCESSOR FUNCTIONS
// =============================================================================

/**
 * Get headwear by ID
 */
export function getHeadwear(id: string): HeadwearData | undefined {
  return HEADWEAR.find((h) => h.id === id);
}

/**
 * Get headwear by ID with fallback to default
 */
export function getHeadwearSafe(id: string | null | undefined): HeadwearData {
  if (!id) return DEFAULT_HEADWEAR;
  return getHeadwear(id) ?? DEFAULT_HEADWEAR;
}

/**
 * Get all headwear in a category
 */
export function getHeadwearByCategory(
  category: HeadwearCategory,
): HeadwearData[] {
  return HEADWEAR.filter((h) => h.category === category);
}

/**
 * Get all headwear by rarity
 */
export function getHeadwearByRarity(rarity: HeadwearRarity): HeadwearData[] {
  return HEADWEAR.filter((h) => h.rarity === rarity);
}

/**
 * Get all colorizable headwear
 */
export function getColorizableHeadwear(): HeadwearData[] {
  return HEADWEAR.filter((h) => h.colorizable);
}

/**
 * Get headwear compatible with a specific hair style
 */
export function getHeadwearForHairStyle(
  _hairStyleId: HairStyleId,
): HeadwearData[] {
  // For now, return all headwear. In future, can add hair-specific filtering
  return HEADWEAR.filter((h) => h.id !== "headwear_none");
}

/**
 * Get all headwear IDs
 */
export function getAllHeadwearIds(): string[] {
  return HEADWEAR.map((h) => h.id);
}

/**
 * Get caps (baseball caps, snapbacks, etc.)
 */
export function getCaps(): HeadwearData[] {
  return getHeadwearByCategory("cap");
}

/**
 * Get hats (fedora, bucket, etc.)
 */
export function getHats(): HeadwearData[] {
  return getHeadwearByCategory("hat");
}

/**
 * Get beanies
 */
export function getBeanies(): HeadwearData[] {
  return getHeadwearByCategory("beanie");
}

/**
 * Get crowns
 */
export function getCrowns(): HeadwearData[] {
  return getHeadwearByCategory("crown");
}

/**
 * Get special headwear
 */
export function getSpecialHeadwear(): HeadwearData[] {
  return getHeadwearByCategory("special");
}
