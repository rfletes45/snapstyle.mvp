/**
 * Chat Cosmetics Catalog
 *
 * Catalog entries for chat-related cosmetics:
 *   - chat_bubble_color: Outgoing message bubble background color
 *   - chat_font: Outgoing message font family
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
    ...CHAT_ANIMAL_THEME_CATALOG,
  ];
}
