/**
 * Unified Cosmetics Catalog
 *
 * Single, typed array of every cosmetic in the game.
 * IDs MUST match asset registry keys for asset-backed items.
 * Items without a mapped asset will report `available: false` at runtime.
 *
 * @module cosmetics/catalog
 */

import { hasCosmeticAsset } from "./assetRegistry";
import { getChatCosmeticDefinitions } from "./chatCatalog";
import { getThemeCosmeticDefinitions } from "./themeRegistry";
import type { CosmeticDefinition, CosmeticRarity, CosmeticType } from "./types";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import pricingTable from "../../shared/cosmetics/shopPricingTable.json";

// =============================================================================
// Catalog Data
// =============================================================================

export const COSMETICS_CATALOG: CosmeticDefinition[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // BADGES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "badge_2048_master",
    type: "badge",
    name: "2048 Master",
    description: "Master the 2048 game",
    rarity: "epic",
    source: "achievement",
    achievementId: "achv.game.play_2048.tile_2048",
    tags: ["games", "2048"],
    sortOrder: 1,
  },
  {
    id: "badge_2048_gold",
    type: "badge",
    name: "2048 Gold",
    description: "Reach the 1024 tile in 2048",
    rarity: "rare",
    source: "achievement",
    achievementId: "achv.game.play_2048.tile_1024",
    tags: ["games", "2048"],
    sortOrder: 1.1,
  },
  {
    id: "badge_2048_legend",
    type: "badge",
    name: "2048 Legend",
    description: "Reach the legendary 4096 tile in 2048",
    rarity: "legendary",
    source: "achievement",
    achievementId: "achv.game.play_2048.tile_4096",
    tags: ["games", "2048"],
    sortOrder: 1.2,
  },
  {
    id: "badge_bounce_blitz_master",
    type: "badge",
    name: "Bounce Blitz Master",
    description: "Master Bounce Blitz",
    rarity: "epic",
    source: "achievement",
    achievementId: "bounce_master",
    tags: ["games", "bounce"],
    sortOrder: 2,
  },
  {
    id: "badge_brick_breaker_master",
    type: "badge",
    name: "Brick Breaker Master",
    description: "Master Brick Breaker",
    rarity: "epic",
    source: "achievement",
    achievementId: "achv.game.brick_breaker.level_30",
    tags: ["games", "brick_breaker"],
    sortOrder: 3,
  },
  {
    id: "badge_breaker_gold",
    type: "badge",
    name: "Brick Breaker Gold",
    description: "Reach level 20 in Brick Breaker",
    rarity: "rare",
    source: "achievement",
    achievementId: "achv.game.brick_breaker.level_20",
    tags: ["games", "brick_breaker"],
    sortOrder: 3.1,
  },
  {
    id: "badge_breaker_master",
    type: "badge",
    name: "Brick Breaker Platinum",
    description: "Reach level 30 in Brick Breaker",
    rarity: "epic",
    source: "achievement",
    achievementId: "achv.game.brick_breaker.level_30",
    tags: ["games", "brick_breaker"],
    sortOrder: 3.2,
  },
  {
    id: "badge_breaker_perfect",
    type: "badge",
    name: "Perfect Breaker",
    description: "Complete a Brick Breaker level without losing a life",
    rarity: "legendary",
    source: "achievement",
    achievementId: "achv.game.brick_breaker.perfect_level",
    tags: ["games", "brick_breaker"],
    sortOrder: 3.3,
  },
  {
    id: "badge_checkers_master",
    type: "badge",
    name: "Checkers Master",
    description: "Master Checkers",
    rarity: "epic",
    source: "achievement",
    achievementId: "checkers_master",
    tags: ["games", "checkers"],
    sortOrder: 4,
  },
  {
    id: "badge_chess_master",
    type: "badge",
    name: "Chess Master",
    description: "Master Chess",
    rarity: "legendary",
    source: "achievement",
    achievementId: "chess_master",
    tags: ["games", "chess"],
    sortOrder: 5,
  },
  {
    id: "badge_dots_and_boxes_master",
    type: "badge",
    name: "Dots & Boxes Master",
    description: "Master Dots & Boxes",
    rarity: "epic",
    source: "achievement",
    achievementId: "dots_boxes_master",
    tags: ["games", "dots_boxes"],
    sortOrder: 6,
  },
  {
    id: "badge_four_master",
    type: "badge",
    name: "Four Master",
    description: "Master Connect Four",
    rarity: "epic",
    source: "achievement",
    achievementId: "four_master",
    tags: ["games", "connect_four"],
    sortOrder: 7,
  },
  {
    id: "badge_gomoku_master",
    type: "badge",
    name: "Gomoku Master",
    description: "Master Gomoku",
    rarity: "epic",
    source: "achievement",
    achievementId: "gomoku_master",
    tags: ["games", "gomoku"],
    sortOrder: 8,
  },
  {
    id: "badge_minesweeper_master",
    type: "badge",
    name: "Minesweeper Master",
    description: "Master Minesweeper",
    rarity: "epic",
    source: "achievement",
    achievementId: "minesweeper_master",
    tags: ["games", "minesweeper"],
    sortOrder: 9,
  },
  {
    id: "badge_pong_master",
    type: "badge",
    name: "Pong Master",
    description: "Master Pong",
    rarity: "epic",
    source: "achievement",
    achievementId: "pong_master",
    tags: ["games", "pong"],
    sortOrder: 10,
  },
  {
    id: "badge_reversi_master",
    type: "badge",
    name: "Reversi Master",
    description: "Master Reversi",
    rarity: "epic",
    source: "achievement",
    achievementId: "reversi_master",
    tags: ["games", "reversi"],
    sortOrder: 11,
  },
  {
    id: "badge_ttt_master",
    type: "badge",
    name: "Tic-Tac-Toe Master",
    description: "Master Tic-Tac-Toe",
    rarity: "epic",
    source: "achievement",
    achievementId: "ttt_master",
    tags: ["games", "ttt"],
    sortOrder: 12,
  },
  {
    id: "badge_bounce_gold",
    type: "badge",
    name: "Bounce Gold",
    description: "Reach level 25 in Bounce Blitz",
    rarity: "rare",
    source: "achievement",
    achievementId: "achv.game.bounce_blitz.level_25",
    tags: ["games", "bounce_blitz"],
    sortOrder: 13,
  },
  {
    id: "badge_wordsmith_platinum",
    type: "badge",
    name: "Wordsmith Platinum",
    description: "Maintain a 30-day Word Master streak",
    rarity: "legendary",
    source: "achievement",
    achievementId: "achv.game.word_master.streak_30",
    tags: ["games", "word_master"],
    sortOrder: 14,
  },
  {
    id: "badge_crossword_master",
    type: "badge",
    name: "Crossword Master",
    description: "Complete 50 crossword puzzles",
    rarity: "epic",
    source: "achievement",
    achievementId: "achv.rt.crossword_puzzle.puzzles_50",
    tags: ["games", "crossword"],
    sortOrder: 15,
  },
  {
    id: "badge_sketch_guesser",
    type: "badge",
    name: "Sharp Eye",
    description: "Guess 100 drawings correctly in Sketch Party",
    rarity: "rare",
    source: "achievement",
    achievementId: "achv.rt.sketch_party_game.correct_100",
    tags: ["games", "sketch_party"],
    sortOrder: 16,
  },
  {
    id: "badge_sketch_artist",
    type: "badge",
    name: "Perfect Artist",
    description: "Have all players guess your drawing 5 times",
    rarity: "epic",
    source: "achievement",
    achievementId: "achv.rt.sketch_party_game.perfect_drawer_5",
    tags: ["games", "sketch_party"],
    sortOrder: 17,
  },
  {
    id: "badge_sketch_legend",
    type: "badge",
    name: "Sketch Legend",
    description: "Score 5000 total points in Sketch Party",
    rarity: "legendary",
    source: "achievement",
    achievementId: "achv.rt.sketch_party_game.score_5000",
    tags: ["games", "sketch_party"],
    sortOrder: 18,
  },

  // ── Master Badges (section completion) ──────────────────────────────────────
  {
    id: "badge_word_master",
    type: "badge",
    name: "Word Master Champion",
    description: "Complete all Word Master achievements",
    rarity: "epic",
    source: "achievement",
    tags: ["games", "word_master", "master"],
    sortOrder: 19,
  },
  {
    id: "badge_crazy_eights_master",
    type: "badge",
    name: "Crazy Cards Master",
    description: "Complete all Crazy Cards achievements",
    rarity: "epic",
    source: "achievement",
    tags: ["games", "crazy_eights", "master"],
    sortOrder: 20,
  },
  {
    id: "badge_sketch_master",
    type: "badge",
    name: "Sketch Party Master",
    description: "Complete all Sketch Party achievements",
    rarity: "epic",
    source: "achievement",
    tags: ["games", "sketch_party", "master"],
    sortOrder: 21,
  },
  {
    id: "badge_all_rounder",
    type: "badge",
    name: "All-Rounder",
    description: "Complete all global achievements",
    rarity: "legendary",
    source: "achievement",
    tags: ["global", "master"],
    sortOrder: 22,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BACKGROUNDS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "bg_donut_wallpaper",
    type: "background",
    name: "Donut Wallpaper",
    description: "Sweet donut-themed wallpaper",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["food", "cute"],
    sortOrder: 1,
  },
  {
    id: "bg_lofi_alleyway",
    type: "background",
    name: "Lofi Alleyway",
    description: "Chill lofi alleyway vibes",
    rarity: "rare",
    source: "shop",
    priceTokens: 600,
    tags: ["lofi", "urban"],
    sortOrder: 2,
  },
  {
    id: "bg_magical_forest",
    type: "background",
    name: "Magical Forest",
    description: "Enchanted forest scene",
    rarity: "epic",
    source: "shop",
    priceTokens: 800,
    tags: ["fantasy", "nature"],
    sortOrder: 3,
  },
  {
    id: "bg_pixel_cafe",
    type: "background",
    name: "Pixel Café",
    description: "Cozy pixel art café",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["pixel", "cozy"],
    sortOrder: 4,
  },
  {
    id: "bg_pixel_neo_tokyo",
    type: "background",
    name: "Pixel Neo Tokyo",
    description: "Futuristic pixel cityscape",
    rarity: "epic",
    source: "shop",
    priceTokens: 800,
    tags: ["pixel", "cyberpunk"],
    sortOrder: 5,
  },
  {
    id: "bg_scary_forest",
    type: "background",
    name: "Scary Forest",
    description: "Spooky dark forest",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["spooky", "nature"],
    sortOrder: 6,
  },
  {
    id: "bg_sketched_alleyway",
    type: "background",
    name: "Sketched Alleyway",
    description: "Hand-drawn alleyway sketch",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["art", "urban"],
    sortOrder: 7,
  },
  {
    id: "bg_steampunk_city",
    type: "background",
    name: "Steampunk City",
    description: "Steam-powered cityscape",
    rarity: "epic",
    source: "shop",
    priceTokens: 900,
    tags: ["steampunk", "urban"],
    sortOrder: 8,
  },
  {
    id: "bg_galaxy",
    type: "background",
    name: "Galaxy",
    description: "Swirling cosmic galaxy background",
    rarity: "legendary",
    source: "shop",
    priceTokens: 1200,
    tags: ["space", "cosmic", "premium"],
    sortOrder: 9,
  },

  // ── New Backgrounds (Phase 3) ───────────────────────────────────────────────
  {
    id: "bg_arcane_circles",
    type: "background",
    name: "Arcane Circles",
    description: "Mystical glowing arcane sigils and rune circles",
    rarity: "epic",
    source: "shop",
    priceTokens: 800,
    tags: ["fantasy", "magic", "dark"],
    sortOrder: 10,
  },
  {
    id: "bg_aurora_borealis",
    type: "background",
    name: "Aurora Borealis",
    description: "Stunning northern lights dancing across the sky",
    rarity: "legendary",
    source: "milestone",
    milestoneValue: "level_10",
    tags: ["nature", "sky", "beautiful"],
    sortOrder: 11,
  },
  {
    id: "bg_circling_waves",
    type: "background",
    name: "Circling Waves",
    description: "Mesmerizing circular wave pattern",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["abstract", "ocean", "calm"],
    sortOrder: 12,
  },
  {
    id: "bg_cyber_aesthetic",
    type: "background",
    name: "Cyber Aesthetic",
    description: "Neon-drenched cyberpunk aesthetic",
    rarity: "epic",
    source: "shop",
    priceTokens: 900,
    tags: ["cyberpunk", "neon", "dark"],
    sortOrder: 13,
  },
  {
    id: "bg_cyber_screens",
    type: "background",
    name: "Cyber Screens",
    description: "Wall of glowing cyber monitors and data feeds",
    rarity: "rare",
    source: "shop",
    priceTokens: 600,
    tags: ["cyberpunk", "tech", "data"],
    sortOrder: 14,
  },
  {
    id: "bg_glitched_tokyo",
    type: "background",
    name: "Glitched Tokyo",
    description: "Tokyo cityscape with digital glitch distortion",
    rarity: "epic",
    source: "shop",
    priceTokens: 900,
    tags: ["cyberpunk", "city", "glitch"],
    sortOrder: 15,
  },
  {
    id: "bg_rune_circles",
    type: "background",
    name: "Rune Circles",
    description: "Ancient rune formations with ethereal glow",
    rarity: "epic",
    source: "milestone",
    milestoneValue: "level_20",
    tags: ["fantasy", "magic", "ancient"],
    sortOrder: 16,
  },
  {
    id: "bg_sketched_lofi_alleyway",
    type: "background",
    name: "Sketched Lofi Alleyway",
    description: "Hand-drawn lofi-style urban alley scene",
    rarity: "rare",
    source: "shop",
    priceTokens: 550,
    tags: ["lofi", "urban", "art"],
    sortOrder: 17,
  },
  {
    id: "bg_synthwave",
    type: "background",
    name: "Synthwave",
    description: "Retro synthwave sunset with grid landscape",
    rarity: "epic",
    source: "milestone",
    milestoneValue: "level_30",
    tags: ["retro", "synthwave", "neon"],
    sortOrder: 18,
  },
  {
    id: "bg_synthwave_videogame",
    type: "background",
    name: "Synthwave Videogame",
    description: "Synthwave-styled retro videogame world",
    rarity: "legendary",
    source: "milestone",
    milestoneValue: "level_50",
    tags: ["retro", "synthwave", "gaming"],
    sortOrder: 19,
  },

  // ── Premium Exclusive Backgrounds (Phase 4) ─────────────────────────────
  {
    id: "exclusive_galaxy_bg",
    type: "background",
    name: "Galaxy Premium",
    description:
      "A premium-exclusive variant of the Galaxy background with enhanced cosmic details",
    rarity: "legendary",
    source: "exclusive",
    tags: ["space", "cosmic", "premium", "exclusive"],
    sortOrder: 20,
  },
  {
    id: "exclusive_synthwave_deluxe",
    type: "background",
    name: "Synthwave Deluxe",
    description:
      "A premium synthwave background with animated grid and sunset. Premium exclusive.",
    rarity: "mythic",
    source: "exclusive",
    tags: ["retro", "synthwave", "premium", "exclusive"],
    sortOrder: 21,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DECORATIONS (PFP frames / overlays)
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Premium Exclusive Decorations (Phase 4) ─────────────────────────────
  {
    id: "exclusive_neon_crown",
    type: "decoration",
    name: "Neon Crown Frame",
    description:
      "An animated neon crown PFP decoration — only available in the Premium Shop.",
    rarity: "mythic",
    source: "exclusive",
    tags: ["neon", "crown", "premium", "exclusive", "animated"],
    sortOrder: 0,
  },

  // Basic (free)
  {
    id: "basic_circle_gold",
    type: "decoration",
    name: "Golden Ring",
    description: "A classic golden circle frame",
    rarity: "common",
    source: "free",
    tags: ["basic", "classic"],
    sortOrder: 1,
  },
  // Achievement-earned
  {
    id: "achievement_streak_7",
    type: "decoration",
    name: "Week Warrior Frame",
    description: "Earned by maintaining a 7-day streak",
    rarity: "rare",
    source: "achievement",
    achievementId: "streak_7_days",
    tags: ["achievement", "streak"],
    sortOrder: 10,
  },
  // Premium (purchasable)
  {
    id: "premium_chess",
    type: "decoration",
    name: "Chess Frame",
    description: "Elegant chess-themed PFP frame",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["games", "chess", "premium"],
    sortOrder: 20,
  },
  {
    id: "premium_chicago",
    type: "decoration",
    name: "Chicago Skyline",
    description: "Chicago skyline PFP frame",
    rarity: "rare",
    source: "shop",
    priceTokens: 600,
    tags: ["city", "premium"],
    sortOrder: 21,
  },
  {
    id: "premium_chicken_sketch",
    type: "decoration",
    name: "Chicken Sketch",
    description: "Fun sketched chicken PFP frame",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 300,
    tags: ["fun", "sketch", "premium"],
    sortOrder: 22,
  },
  {
    id: "premium_cozy_cat",
    type: "decoration",
    name: "Cozy Cat",
    description: "Adorable cozy cat PFP frame",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["cute", "cat", "premium"],
    sortOrder: 23,
  },
  {
    id: "premium_donut",
    type: "decoration",
    name: "Donut Frame",
    description: "Sweet donut PFP frame",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 400,
    tags: ["food", "cute", "premium"],
    sortOrder: 24,
  },
  {
    id: "premium_fox_ears",
    type: "decoration",
    name: "Fox Ears",
    description: "Cute fox ears PFP decoration",
    rarity: "rare",
    source: "shop",
    priceTokens: 500,
    tags: ["animal", "cute", "premium"],
    sortOrder: 25,
  },
  {
    id: "premium_kindergarten_scribble",
    type: "decoration",
    name: "Kindergarten Scribble",
    description: "Playful crayon scribble frame",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 300,
    tags: ["fun", "sketch", "premium"],
    sortOrder: 26,
  },
  {
    id: "premium_lofi_city",
    type: "decoration",
    name: "Lofi City",
    description: "Chill lofi city PFP frame",
    rarity: "rare",
    source: "shop",
    priceTokens: 600,
    tags: ["lofi", "urban", "premium"],
    sortOrder: 27,
  },
  {
    id: "premium_mini_golf",
    type: "decoration",
    name: "Mini Golf",
    description: "Mini golf-themed PFP frame",
    rarity: "uncommon",
    source: "shop",
    priceTokens: 400,
    tags: ["games", "sports", "premium"],
    sortOrder: 28,
  },
  {
    id: "premium_retro_arcade",
    type: "decoration",
    name: "Retro Arcade",
    description: "Retro arcade-style PFP frame",
    rarity: "rare",
    source: "shop",
    priceTokens: 600,
    tags: ["retro", "games", "premium"],
    sortOrder: 29,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // THEMES — auto-generated from themeRegistry.ts (single source of truth).
  // DO NOT add theme entries here manually.
  // See src/cosmetics/themeRegistry.ts for the bridge from constants/theme.ts.
  // ─────────────────────────────────────────────────────────────────────────────
  ...getThemeCosmeticDefinitions(),

  // ─────────────────────────────────────────────────────────────────────────────
  // CHAT COSMETICS — auto-generated from chatCatalog.ts.
  // Includes: chat_bubble_color, chat_font, chat_animal_theme (coming soon).
  // DO NOT add chat cosmetic entries here manually.
  // ─────────────────────────────────────────────────────────────────────────────
  ...getChatCosmeticDefinitions(),
];

// =============================================================================
// Helpers
// =============================================================================

/** Look up a catalog entry by ID. */
export function getCosmeticById(id: string): CosmeticDefinition | undefined {
  return COSMETICS_CATALOG.find((c) => c.id === id);
}

/** Get all cosmetics of a given type, sorted by sortOrder. */
export function getCosmeticsByType(type: CosmeticType): CosmeticDefinition[] {
  return COSMETICS_CATALOG.filter((c) => c.type === type).sort(
    (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
  );
}

/** Check if a catalog cosmetic has an asset ready for display. */
export function isCosmeticAvailable(def: CosmeticDefinition): boolean {
  return hasCosmeticAsset(def.type, def.assetKey ?? def.id);
}

/** Chat cosmetic types are value-based (no image asset required). */
const VALUE_BASED_TYPES = new Set<string>([
  "theme",
  "chat_bubble_color",
  "chat_font",
  "chat_animal_theme",
]);

const HIDDEN_FROM_SHOP_TYPES = new Set<CosmeticType>([
  "chat_font",
  "chat_font_color",
]);

function isVisibleInShop(item: CosmeticDefinition): boolean {
  return !HIDDEN_FROM_SHOP_TYPES.has(item.type);
}

/** Get all purchasable cosmetics with assets (themes & chat cosmetics exempt — they are value-based). */
export function getShopCosmetics(): CosmeticDefinition[] {
  return COSMETICS_CATALOG.filter(
    (c) =>
      c.source === "shop" &&
      isVisibleInShop(c) &&
      !c.metadata?.comingSoon &&
      (VALUE_BASED_TYPES.has(c.type) || isCosmeticAvailable(c)),
  ).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

/** Get all free/starter cosmetics. */
export function getFreeCosmetics(): CosmeticDefinition[] {
  return COSMETICS_CATALOG.filter(
    (c) => c.source === "free" || c.source === "starter",
  );
}

/**
 * Whether a catalog item is purchasable via the token shop.
 * Must have source "shop", positive priceTokens, and not be comingSoon.
 */
export function isPurchasableCosmetic(item: CosmeticDefinition): boolean {
  return (
    item.source === "shop" &&
    isVisibleInShop(item) &&
    typeof item.priceTokens === "number" &&
    item.priceTokens > 0 &&
    !item.metadata?.comingSoon
  );
}

/** Shop section for grouping in the store UI. */
export type ShopSection = "profile" | "chat";

/** Chat cosmetic types. */
const CHAT_SECTION_TYPES = new Set<CosmeticType>([
  "chat_bubble_color",
  "chat_animal_theme",
]);

/**
 * List purchasable cosmetics filtered by shop section.
 * - "profile": decorations, backgrounds, themes, badges
 * - "chat": chat_bubble_color, chat_animal_theme
 */
export function listPurchasableBySection(
  section: ShopSection,
): CosmeticDefinition[] {
  return COSMETICS_CATALOG.filter((c) => {
    if (!isPurchasableCosmetic(c)) return false;
    const isChatType = CHAT_SECTION_TYPES.has(c.type);
    if (section === "chat") return isChatType;
    return !isChatType;
  }).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

/** Filter catalog by rarity. */
export function getCosmeticsByRarity(
  rarity: CosmeticRarity,
): CosmeticDefinition[] {
  return COSMETICS_CATALOG.filter((c) => c.rarity === rarity);
}

/** Search catalog by name or tags. */
export function searchCosmetics(query: string): CosmeticDefinition[] {
  const q = query.toLowerCase();
  return COSMETICS_CATALOG.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags?.some((t) => t.toLowerCase().includes(q)),
  );
}

// =============================================================================
// Owned-Items Selector (canonical inventory source)
// =============================================================================

export interface OwnedCosmeticsOptions {
  /** Include "free" and "starter" items even without an entitlement doc. */
  includeDefaults?: boolean;
}

/**
 * Return only the catalog items the user owns (by type).
 *
 * Ownership is determined by:
 *   1. The user has an entitlement doc for the cosmeticId.
 *   2. (If includeDefaults) The catalog item has source "free" or "starter".
 *
 * This is the single source of truth for "what appears in inventory".
 */
export function getOwnedCosmeticsByType(
  type: CosmeticType,
  ownedIds: ReadonlySet<string>,
  options: OwnedCosmeticsOptions = {},
): CosmeticDefinition[] {
  const { includeDefaults = true } = options;
  return COSMETICS_CATALOG.filter((c) => {
    if (c.type !== type) return false;
    if (ownedIds.has(c.id)) return true;
    if (includeDefaults && (c.source === "free" || c.source === "starter"))
      return true;
    return false;
  }).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

/**
 * Return catalog items the user does NOT own, suitable for the store.
 * Only includes items with source "shop" that have an asset.
 */
export function getUnownedShopCosmeticsByType(
  type: CosmeticType,
  ownedIds: ReadonlySet<string>,
): CosmeticDefinition[] {
  return COSMETICS_CATALOG.filter((c) => {
    if (c.type !== type) return false;
    if (c.source !== "shop") return false;
    if (!isVisibleInShop(c)) return false;
    if (ownedIds.has(c.id)) return false;
    return true;
  }).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

// =============================================================================
// Catalog Validation (dev-time guardrails)
// =============================================================================

/**
 * Validate the catalog at dev time.
 * Logs warnings for:
 *   - Shop items with no asset in the registry
 *   - Duplicate IDs
 *   - Items with priceTokens but wrong source
 *
 * Call this once on app init (dev builds only).
 */
export function validateCatalog(): {
  warnings: string[];
  duplicates: string[];
  missingAssets: string[];
} {
  const warnings: string[] = [];
  const duplicates: string[] = [];
  const missingAssets: string[] = [];
  const seen = new Set<string>();

  for (const item of COSMETICS_CATALOG) {
    // Duplicate check
    if (seen.has(item.id)) {
      duplicates.push(item.id);
      warnings.push(`[CATALOG] Duplicate ID: "${item.id}"`);
    }
    seen.add(item.id);

    // Shop items should have asset (except themes and chat cosmetics — palette/value-based)
    if (
      item.source === "shop" &&
      isVisibleInShop(item) &&
      item.type !== "theme" &&
      item.type !== "chat_bubble_color" &&
      item.type !== "chat_font" &&
      item.type !== "chat_animal_theme" &&
      !hasCosmeticAsset(item.type, item.assetKey ?? item.id)
    ) {
      missingAssets.push(item.id);
      warnings.push(
        `[CATALOG] Shop item "${item.id}" has no asset — will show placeholder`,
      );
    }

    // Price sanity
    if (item.source === "shop" && !item.priceTokens) {
      warnings.push(`[CATALOG] Shop item "${item.id}" has no priceTokens`);
    }
    if (item.source !== "shop" && item.priceTokens) {
      warnings.push(
        `[CATALOG] Non-shop item "${item.id}" has priceTokens (source="${item.source}")`,
      );
    }
  }

  // ── Cross-check against shared pricing table ─────────────────────────
  // Every item in the pricing table MUST exist in the client catalog with
  // matching type and priceTokens. This catches drift between the shared
  // source-of-truth and the client-side definitions.
  interface PricingEntry {
    id: string;
    type: string;
    name: string;
    priceTokens: number;
  }
  const pricingItems = pricingTable.items as PricingEntry[];
  const catalogMap = new Map(COSMETICS_CATALOG.map((c) => [c.id, c]));

  for (const entry of pricingItems) {
    const clientItem = catalogMap.get(entry.id);
    if (!clientItem) {
      warnings.push(
        `[CATALOG↔PRICING] Server pricing has "${entry.id}" but client catalog is missing it`,
      );
      continue;
    }
    if (clientItem.type !== entry.type) {
      warnings.push(
        `[CATALOG↔PRICING] Type mismatch for "${entry.id}": client="${clientItem.type}" pricing="${entry.type}"`,
      );
    }
    if ((clientItem.priceTokens ?? 0) !== entry.priceTokens) {
      warnings.push(
        `[CATALOG↔PRICING] Price mismatch for "${entry.id}": client=${clientItem.priceTokens} pricing=${entry.priceTokens}`,
      );
    }
  }

  // Also check: any client shop item NOT in pricing table (would fail purchase)
  for (const item of COSMETICS_CATALOG) {
    if (
      item.source !== "shop" ||
      item.metadata?.comingSoon ||
      !isVisibleInShop(item)
    )
      continue;
    const inPricing = pricingItems.some((p) => p.id === item.id);
    if (!inPricing) {
      warnings.push(
        `[CATALOG↔PRICING] Client shop item "${item.id}" is NOT in shared pricing table — purchases will fail`,
      );
    }
  }

  return { warnings, duplicates, missingAssets };
}
