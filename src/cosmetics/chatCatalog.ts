/**
 * Chat Cosmetics Catalog
 *
 * Catalog entries for chat-related cosmetics:
 *   - chat_bubble_color: Outgoing message bubble background color
 *   - chat_font: Outgoing message font family
 *   - chat_font_color: Custom font/text color override
 *   - chat_animal_theme: Animal-themed chat decoration (COMING SOON)
 *
 * These are appended to the main COSMETICS_CATALOG in catalog.ts.
 *
 * @module cosmetics/chatCatalog
 */

import type { CosmeticDefinition } from "./types";

// =============================================================================
// Chat Bubble Colors
// =============================================================================

export const CHAT_BUBBLE_COLOR_CATALOG: CosmeticDefinition[] = [
  // ── Free / Starter ──────────────────────────────────────────────────────────
  {
    id: "bubble_purple",
    type: "chat_bubble_color",
    name: "Classic Purple",
    description: "The original chat bubble color",
    rarity: "common",
    source: "free",
    tags: ["chat", "bubble", "default"],
    sortOrder: 0,
    metadata: { bubbleColorValue: "#6200EE" },
  },
  {
    id: "bubble_blue",
    type: "chat_bubble_color",
    name: "Cool Blue",
    description: "A calming blue bubble",
    rarity: "common",
    source: "starter",
    tags: ["chat", "bubble"],
    sortOrder: 1,
    metadata: { bubbleColorValue: "#1976D2" },
  },

  // ── Shop (Common) ──────────────────────────────────────────────────────────
  {
    id: "bubble_teal",
    type: "chat_bubble_color",
    name: "Teal Vibes",
    description: "Fresh teal for a relaxed look",
    rarity: "common",
    source: "shop",
    priceTokens: 150,
    tags: ["chat", "bubble"],
    sortOrder: 10,
    metadata: { bubbleColorValue: "#00897B" },
  },
  {
    id: "bubble_green",
    type: "chat_bubble_color",
    name: "Forest Green",
    description: "Deep, earthy green",
    rarity: "common",
    source: "shop",
    priceTokens: 150,
    tags: ["chat", "bubble"],
    sortOrder: 11,
    metadata: { bubbleColorValue: "#2E7D32" },
  },
  {
    id: "bubble_slate",
    type: "chat_bubble_color",
    name: "Slate",
    description: "Sophisticated dark gray-blue",
    rarity: "common",
    source: "shop",
    priceTokens: 150,
    tags: ["chat", "bubble"],
    sortOrder: 12,
    metadata: { bubbleColorValue: "#37474F" },
  },

  // ── Shop (Uncommon) ────────────────────────────────────────────────────────
  {
    id: "bubble_red",
    type: "chat_bubble_color",
    name: "Ruby Red",
    description: "Bold and fiery",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 250,
    tags: ["chat", "bubble"],
    sortOrder: 20,
    metadata: { bubbleColorValue: "#C62828" },
  },
  {
    id: "bubble_orange",
    type: "chat_bubble_color",
    name: "Sunset Orange",
    description: "Warm sunset hues",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 250,
    tags: ["chat", "bubble"],
    sortOrder: 21,
    metadata: { bubbleColorValue: "#E65100" },
  },
  {
    id: "bubble_pink",
    type: "chat_bubble_color",
    name: "Hot Pink",
    description: "Eye-catching pink",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 250,
    tags: ["chat", "bubble"],
    sortOrder: 22,
    metadata: { bubbleColorValue: "#AD1457" },
  },
  {
    id: "bubble_cyan",
    type: "chat_bubble_color",
    name: "Electric Cyan",
    description: "Bright cyan energy",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 250,
    tags: ["chat", "bubble"],
    sortOrder: 23,
    metadata: { bubbleColorValue: "#00838F" },
  },

  // ── Shop (Rare) ────────────────────────────────────────────────────────────
  {
    id: "bubble_indigo",
    type: "chat_bubble_color",
    name: "Indigo Night",
    description: "Deep, mysterious indigo",
    rarity: "rare",
    source: "shop",
    priceTokens: 400,
    tags: ["chat", "bubble"],
    sortOrder: 30,
    metadata: { bubbleColorValue: "#283593" },
  },
  {
    id: "bubble_amber",
    type: "chat_bubble_color",
    name: "Golden Amber",
    description: "Rich amber glow",
    rarity: "rare",
    source: "shop",
    priceTokens: 400,
    tags: ["chat", "bubble"],
    sortOrder: 31,
    metadata: { bubbleColorValue: "#FF8F00" },
  },
  {
    id: "bubble_deep_purple",
    type: "chat_bubble_color",
    name: "Deep Purple",
    description: "Rich and regal purple",
    rarity: "rare",
    source: "shop",
    priceTokens: 400,
    tags: ["chat", "bubble"],
    sortOrder: 32,
    metadata: { bubbleColorValue: "#4527A0" },
  },
  {
    id: "bubble_lime",
    type: "chat_bubble_color",
    name: "Electric Lime",
    description: "Vibrant lime green",
    rarity: "rare",
    source: "shop",
    priceTokens: 400,
    tags: ["chat", "bubble"],
    sortOrder: 33,
    metadata: { bubbleColorValue: "#9E9D24" },
  },

  // ── Shop (Epic) ────────────────────────────────────────────────────────────
  {
    id: "bubble_rose",
    type: "chat_bubble_color",
    name: "Rose Gold",
    description: "Elegant rose gold shimmer",
    rarity: "epic",
    source: "shop",
    priceTokens: 600,
    tags: ["chat", "bubble", "premium"],
    sortOrder: 40,
    metadata: { bubbleColorValue: "#E91E63" },
  },
  {
    id: "bubble_midnight",
    type: "chat_bubble_color",
    name: "Midnight Blue",
    description: "The deepest blue of the night sky",
    rarity: "epic",
    source: "shop",
    priceTokens: 600,
    tags: ["chat", "bubble", "premium"],
    sortOrder: 41,
    metadata: { bubbleColorValue: "#1A237E" },
  },
  {
    id: "bubble_coral",
    type: "chat_bubble_color",
    name: "Living Coral",
    description: "Trendy coral — warm and inviting",
    rarity: "epic",
    source: "shop",
    priceTokens: 600,
    tags: ["chat", "bubble", "premium"],
    sortOrder: 42,
    metadata: { bubbleColorValue: "#FF6F61" },
  },
];

// =============================================================================
// Chat Fonts
// =============================================================================

export const CHAT_FONT_CATALOG: CosmeticDefinition[] = [
  // ── Free / Starter ──────────────────────────────────────────────────────────
  {
    id: "font_system",
    type: "chat_font",
    name: "System Default",
    description: "Your device's default font",
    rarity: "common",
    source: "free",
    tags: ["chat", "font", "default"],
    sortOrder: 0,
    metadata: { fontFamily: "System" },
  },

  // ── Shop (Common) ──────────────────────────────────────────────────────────
  {
    id: "font_monospace",
    type: "chat_font",
    name: "Monospace",
    description: "Clean, fixed-width coding style",
    rarity: "common",
    source: "shop",
    priceTokens: 200,
    tags: ["chat", "font"],
    sortOrder: 10,
    metadata: { fontFamily: "monospace" },
  },
  {
    id: "font_serif",
    type: "chat_font",
    name: "Classic Serif",
    description: "Timeless serif elegance",
    rarity: "common",
    source: "shop",
    priceTokens: 200,
    tags: ["chat", "font"],
    sortOrder: 11,
    metadata: { fontFamily: "serif" },
  },

  // ── Shop (Uncommon) ────────────────────────────────────────────────────────
  {
    id: "font_rounded",
    type: "chat_font",
    name: "Rounded",
    description: "Soft, rounded letterforms",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 350,
    tags: ["chat", "font"],
    sortOrder: 20,
    metadata: { fontFamily: "pf_agency" },
  },
  {
    id: "font_handwritten",
    type: "chat_font",
    name: "Handwritten",
    description: "Personal handwriting style",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 350,
    tags: ["chat", "font"],
    sortOrder: 21,
    metadata: { fontFamily: "pf_bradleyhand" },
  },

  // ── Shop (Rare) ────────────────────────────────────────────────────────────
  {
    id: "font_retro",
    type: "chat_font",
    name: "Retro Pixel",
    description: "Nostalgic pixel-art typeface",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["chat", "font", "retro"],
    sortOrder: 30,
    metadata: { fontFamily: "pf_bauhaus" },
  },
  {
    id: "font_elegant",
    type: "chat_font",
    name: "Elegant Script",
    description: "Flowing, sophisticated script",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["chat", "font", "fancy"],
    sortOrder: 31,
    metadata: { fontFamily: "pf_bellmt" },
  },

  // ── Shop (Epic) ────────────────────────────────────────────────────────────
  {
    id: "font_comic",
    type: "chat_font",
    name: "Comic Pop",
    description: "Fun, comic-book inspired lettering",
    rarity: "epic",
    source: "shop",
    priceTokens: 750,
    tags: ["chat", "font", "fun"],
    sortOrder: 40,
    metadata: { fontFamily: "pf_chiller" },
  },
];

// =============================================================================
// Chat Font Colors
// =============================================================================

/**
 * Font color catalog entries.
 *
 * "Default" is NOT a catalog entry: when fontColorId is null the app
 * automatically uses the theme's text token (theme-adaptive).
 *
 * Every entry here represents a **fixed** custom color that persists
 * regardless of theme changes.
 */
export const CHAT_FONT_COLOR_CATALOG: CosmeticDefinition[] = [
  // ── Free / Starter ──────────────────────────────────────────────────────────
  {
    id: "font_color_snow",
    type: "chat_font_color",
    name: "Snow",
    description: "Crisp white text",
    rarity: "common",
    source: "free",
    tags: ["chat", "font-color", "light"],
    sortOrder: 0,
    metadata: { fontColorValue: "#FFFFFF" },
  },
  {
    id: "font_color_charcoal",
    type: "chat_font_color",
    name: "Charcoal",
    description: "Deep, dark charcoal text",
    rarity: "common",
    source: "free",
    tags: ["chat", "font-color", "dark"],
    sortOrder: 1,
    metadata: { fontColorValue: "#2D2D2D" },
  },
  {
    id: "font_color_silver",
    type: "chat_font_color",
    name: "Silver",
    description: "Soft silver for a subtle look",
    rarity: "common",
    source: "starter",
    tags: ["chat", "font-color", "neutral"],
    sortOrder: 2,
    metadata: { fontColorValue: "#B0B0B0" },
  },

  // ── Shop (Common) ──────────────────────────────────────────────────────────
  {
    id: "font_color_sky_blue",
    type: "chat_font_color",
    name: "Sky Blue",
    description: "A calming sky-blue accent",
    rarity: "common",
    source: "shop",
    priceTokens: 150,
    tags: ["chat", "font-color", "blue"],
    sortOrder: 10,
    metadata: { fontColorValue: "#64B5F6" },
  },
  {
    id: "font_color_lavender",
    type: "chat_font_color",
    name: "Lavender",
    description: "Soft purple lavender",
    rarity: "common",
    source: "shop",
    priceTokens: 150,
    tags: ["chat", "font-color", "purple"],
    sortOrder: 11,
    metadata: { fontColorValue: "#B39DDB" },
  },
  {
    id: "font_color_mint",
    type: "chat_font_color",
    name: "Mint",
    description: "Fresh minty green",
    rarity: "common",
    source: "shop",
    priceTokens: 150,
    tags: ["chat", "font-color", "green"],
    sortOrder: 12,
    metadata: { fontColorValue: "#80CBC4" },
  },
  {
    id: "font_color_rose",
    type: "chat_font_color",
    name: "Rose",
    description: "Warm rose-pink tone",
    rarity: "common",
    source: "shop",
    priceTokens: 150,
    tags: ["chat", "font-color", "pink"],
    sortOrder: 13,
    metadata: { fontColorValue: "#F48FB1" },
  },
  {
    id: "font_color_peach",
    type: "chat_font_color",
    name: "Peach",
    description: "Soft warm peach",
    rarity: "common",
    source: "shop",
    priceTokens: 150,
    tags: ["chat", "font-color", "warm"],
    sortOrder: 14,
    metadata: { fontColorValue: "#FFAB91" },
  },

  // ── Shop (Uncommon) ────────────────────────────────────────────────────────
  {
    id: "font_color_coral",
    type: "chat_font_color",
    name: "Coral",
    description: "Vivid coral accent",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 250,
    tags: ["chat", "font-color", "warm"],
    sortOrder: 20,
    metadata: { fontColorValue: "#FF8A65" },
  },
  {
    id: "font_color_gold",
    type: "chat_font_color",
    name: "Gold",
    description: "Luxurious golden text",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 250,
    tags: ["chat", "font-color", "warm", "premium"],
    sortOrder: 21,
    metadata: { fontColorValue: "#FFD54F" },
  },
  {
    id: "font_color_aqua",
    type: "chat_font_color",
    name: "Aqua",
    description: "Electric aquamarine",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 250,
    tags: ["chat", "font-color", "blue", "neon"],
    sortOrder: 22,
    metadata: { fontColorValue: "#4DD0E1" },
  },
  {
    id: "font_color_lime",
    type: "chat_font_color",
    name: "Lime",
    description: "Bright energetic lime",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 250,
    tags: ["chat", "font-color", "green", "neon"],
    sortOrder: 23,
    metadata: { fontColorValue: "#AED581" },
  },

  // ── Shop (Rare) ────────────────────────────────────────────────────────────
  {
    id: "font_color_neon_pink",
    type: "chat_font_color",
    name: "Neon Pink",
    description: "Bold neon pink that pops",
    rarity: "rare",
    source: "shop",
    priceTokens: 400,
    tags: ["chat", "font-color", "neon", "vibrant"],
    sortOrder: 30,
    metadata: { fontColorValue: "#FF4081" },
  },
  {
    id: "font_color_electric_blue",
    type: "chat_font_color",
    name: "Electric Blue",
    description: "High-voltage electric blue",
    rarity: "rare",
    source: "shop",
    priceTokens: 400,
    tags: ["chat", "font-color", "neon", "vibrant"],
    sortOrder: 31,
    metadata: { fontColorValue: "#448AFF" },
  },
  {
    id: "font_color_emerald",
    type: "chat_font_color",
    name: "Emerald",
    description: "Rich emerald green",
    rarity: "rare",
    source: "shop",
    priceTokens: 400,
    tags: ["chat", "font-color", "green", "premium"],
    sortOrder: 32,
    metadata: { fontColorValue: "#66BB6A" },
  },
];

// =============================================================================
// Chat Animal Themes
// =============================================================================

export const CHAT_ANIMAL_THEME_CATALOG: CosmeticDefinition[] = [
  {
    id: "animal_duck",
    type: "chat_animal_theme",
    name: "Duck",
    description: "The classic quacking duck — always free!",
    rarity: "common",
    source: "free",
    tags: ["chat", "animal", "default"],
    sortOrder: 0,
    metadata: {
      imageAssetKey: "animal_duck",
      soundAssetKey: "animal_duck",
      emoji: "\uD83E\uDD86",
    },
  },
  {
    id: "animal_turtle",
    type: "chat_animal_theme",
    name: "Turtle",
    description: "A chill turtle — splish splash!",
    rarity: "common",
    source: "starter",
    tags: ["chat", "animal"],
    sortOrder: 1,
    metadata: {
      imageAssetKey: "animal_turtle",
      soundAssetKey: "animal_turtle",
      emoji: "\uD83D\uDC22",
    },
  },
  {
    id: "animal_bear",
    type: "chat_animal_theme",
    name: "Bear",
    description: "A mighty bear with a fearsome growl",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["chat", "animal"],
    sortOrder: 2,
    metadata: {
      imageAssetKey: "animal_bear",
      soundAssetKey: "animal_bear",
      emoji: "\uD83D\uDC3B",
    },
  },
  {
    id: "animal_wolf",
    type: "chat_animal_theme",
    name: "Wolf",
    description: "A lone wolf howling at the moon",
    rarity: "epic",
    source: "shop",
    priceTokens: 750,
    tags: ["chat", "animal"],
    sortOrder: 3,
    metadata: {
      imageAssetKey: "animal_wolf",
      soundAssetKey: "animal_wolf",
      emoji: "\uD83D\uDC3A",
    },
  },
];

// =============================================================================
// Combined Chat Cosmetics
// =============================================================================

/** All chat cosmetic catalog entries combined. */
export function getChatCosmeticDefinitions(): CosmeticDefinition[] {
  return [
    ...CHAT_BUBBLE_COLOR_CATALOG,
    ...CHAT_FONT_CATALOG,
    ...CHAT_FONT_COLOR_CATALOG,
    ...CHAT_ANIMAL_THEME_CATALOG,
  ];
}
