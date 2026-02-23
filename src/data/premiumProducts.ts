/**
 * Premium Shop Product Definitions
 *
 * Defines all products available in the Premium Shop:
 * - Token packs (virtual currency)
 * - Premium bundles (curated item collections)
 * - Exclusive items (premium-only cosmetics)
 *
 * These definitions are used to seed the PremiumProducts Firestore collection.
 * Product IDs must match App Store Connect / Google Play Console.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Appendix A
 */

import type {
  PremiumBundle,
  PremiumExclusiveItem,
  TokenPack,
} from "@/types/shop";

// =============================================================================
// Token Packs
// =============================================================================

/**
 * Token pack definitions
 *
 * Pricing strategy:
 * - Small packs: Lower bonus (0-10%)
 * - Medium packs: Moderate bonus (15-20%)
 * - Large packs: Higher bonus (25-35%)
 */
export const TOKEN_PACKS: Omit<TokenPack, "localizedPrice">[] = [
  {
    id: "tokens_100",
    productId: "com.snapstyle.tokens.100",
    name: "Handful of Tokens",
    tokens: 100,
    bonusTokens: 0,
    totalTokens: 100,
    basePriceUSD: 0.99,
    popular: false,
    featured: false,
    sortOrder: 1,
  },
  {
    id: "tokens_500",
    productId: "com.snapstyle.tokens.500",
    name: "Token Pouch",
    tokens: 500,
    bonusTokens: 50,
    totalTokens: 550,
    basePriceUSD: 4.99,
    popular: false,
    featured: false,
    sortOrder: 2,
  },
  {
    id: "tokens_1200",
    productId: "com.snapstyle.tokens.1200",
    name: "Token Bundle",
    tokens: 1200,
    bonusTokens: 200,
    totalTokens: 1400,
    basePriceUSD: 9.99,
    popular: true, // Best value indicator
    featured: true,
    sortOrder: 3,
  },
  {
    id: "tokens_2500",
    productId: "com.snapstyle.tokens.2500",
    name: "Token Chest",
    tokens: 2500,
    bonusTokens: 500,
    totalTokens: 3000,
    basePriceUSD: 19.99,
    popular: false,
    featured: false,
    sortOrder: 4,
  },
  {
    id: "tokens_5500",
    productId: "com.snapstyle.tokens.5500",
    name: "Token Vault",
    tokens: 5500,
    bonusTokens: 1500,
    totalTokens: 7000,
    basePriceUSD: 39.99,
    popular: false,
    featured: false,
    sortOrder: 5,
  },
  {
    id: "tokens_12000",
    productId: "com.snapstyle.tokens.12000",
    name: "Token Treasury",
    tokens: 12000,
    bonusTokens: 4000,
    totalTokens: 16000,
    basePriceUSD: 79.99,
    popular: false,
    featured: false,
    sortOrder: 6,
  },
];

// =============================================================================
// Premium Bundles
// =============================================================================

/**
 * Premium bundle definitions
 *
 * Each bundle grants real cosmetic entitlements from the catalog.
 * Item IDs MUST match entries in src/cosmetics/catalog.ts.
 */
export const PREMIUM_BUNDLES: Omit<
  PremiumBundle,
  "localizedPrice" | "owned" | "purchasesRemaining"
>[] = [
  // === STARTER PACK ===
  {
    id: "bundle_starter_premium",
    productId: "com.snapstyle.bundle.starter_premium",
    name: "Starter Premium Pack",
    description:
      "The perfect intro to premium! One background, one PFP frame, and 200 bonus tokens.",
    items: [
      {
        itemId: "bg_lofi_alleyway",
        name: "Lofi Alleyway",
        slot: "background",
        rarity: "rare",
        imagePath: "",
      },
      {
        itemId: "premium_chicken_sketch",
        name: "Chicken Sketch",
        slot: "decoration",
        rarity: "uncommon",
        imagePath: "",
      },
    ],
    bonusTokens: 200,
    basePriceUSD: 3.99,
    valueUSD: 6.5,
    savingsPercent: 39,
    imagePath: "",
    theme: "starter",
    featured: true,
    sortOrder: 1,
    limitedTime: false,
  },

  // === BACKGROUND COLLECTION ===
  {
    id: "bundle_background_pack",
    productId: "com.snapstyle.bundle.background_pack",
    name: "Background Collection",
    description: "Three stunning profile backgrounds in one pack. Great value!",
    items: [
      {
        itemId: "bg_galaxy",
        name: "Galaxy",
        slot: "background",
        rarity: "legendary",
        imagePath: "",
      },
      {
        itemId: "bg_steampunk_city",
        name: "Steampunk City",
        slot: "background",
        rarity: "epic",
        imagePath: "",
      },
      {
        itemId: "bg_glitched_tokyo",
        name: "Glitched Tokyo",
        slot: "background",
        rarity: "epic",
        imagePath: "",
      },
    ],
    bonusTokens: 100,
    basePriceUSD: 7.99,
    valueUSD: 14.0,
    savingsPercent: 43,
    imagePath: "",
    theme: "premium",
    featured: true,
    sortOrder: 2,
    limitedTime: false,
  },

  // === DECORATION COLLECTION ===
  {
    id: "bundle_decoration_pack",
    productId: "com.snapstyle.bundle.decoration_pack",
    name: "Decoration Collection",
    description: "Four unique PFP decorations to stand out from the crowd.",
    items: [
      {
        itemId: "premium_fox_ears",
        name: "Fox Ears",
        slot: "decoration",
        rarity: "rare",
        imagePath: "",
      },
      {
        itemId: "premium_retro_arcade",
        name: "Retro Arcade",
        slot: "decoration",
        rarity: "rare",
        imagePath: "",
      },
      {
        itemId: "premium_cozy_cat",
        name: "Cozy Cat",
        slot: "decoration",
        rarity: "rare",
        imagePath: "",
      },
      {
        itemId: "premium_lofi_city",
        name: "Lofi City",
        slot: "decoration",
        rarity: "rare",
        imagePath: "",
      },
    ],
    bonusTokens: 0,
    basePriceUSD: 5.99,
    valueUSD: 10.0,
    savingsPercent: 40,
    imagePath: "",
    theme: "premium",
    featured: false,
    sortOrder: 3,
    limitedTime: false,
  },

  // === CYBER DELUXE BUNDLE ===
  {
    id: "bundle_cyber_deluxe",
    productId: "com.snapstyle.bundle.cyber_deluxe",
    name: "Cyber Deluxe Bundle",
    description:
      "The ultimate cyberpunk set: two neon backgrounds, a PFP frame, and 500 bonus tokens.",
    items: [
      {
        itemId: "bg_cyber_aesthetic",
        name: "Cyber Aesthetic",
        slot: "background",
        rarity: "epic",
        imagePath: "",
      },
      {
        itemId: "bg_pixel_neo_tokyo",
        name: "Pixel Neo Tokyo",
        slot: "background",
        rarity: "epic",
        imagePath: "",
      },
      {
        itemId: "premium_chicago",
        name: "Chicago Skyline",
        slot: "decoration",
        rarity: "rare",
        imagePath: "",
      },
    ],
    bonusTokens: 500,
    basePriceUSD: 12.99,
    valueUSD: 22.0,
    savingsPercent: 41,
    imagePath: "",
    theme: "legendary",
    featured: true,
    sortOrder: 4,
    limitedTime: false,
  },

  // === MYSTIC SEASONAL PACK ===
  {
    id: "bundle_seasonal_mystic",
    productId: "com.snapstyle.bundle.seasonal_mystic",
    name: "Mystic Seasonal Pack",
    description:
      "Limited-time mystical collection: arcane backgrounds, a chess frame, and bonus tokens.",
    items: [
      {
        itemId: "bg_arcane_circles",
        name: "Arcane Circles",
        slot: "background",
        rarity: "epic",
        imagePath: "",
      },
      {
        itemId: "bg_magical_forest",
        name: "Magical Forest",
        slot: "background",
        rarity: "epic",
        imagePath: "",
      },
      {
        itemId: "premium_chess",
        name: "Chess Frame",
        slot: "decoration",
        rarity: "rare",
        imagePath: "",
      },
    ],
    bonusTokens: 300,
    basePriceUSD: 9.99,
    valueUSD: 17.0,
    savingsPercent: 41,
    imagePath: "",
    theme: "mythic",
    featured: false,
    sortOrder: 5,
    limitedTime: true,
    purchaseLimit: 1,
  },

  // === FOUNDERS PACK ===
  {
    id: "bundle_founders",
    productId: "com.snapstyle.bundle.founders",
    name: "Founders Pack",
    description:
      "Exclusive founders bundle with the Galaxy background, premium decorations, and 1 000 bonus tokens. Limited to 500.",
    items: [
      {
        itemId: "bg_galaxy",
        name: "Galaxy",
        slot: "background",
        rarity: "legendary",
        imagePath: "",
      },
      {
        itemId: "premium_retro_arcade",
        name: "Retro Arcade",
        slot: "decoration",
        rarity: "rare",
        imagePath: "",
      },
      {
        itemId: "premium_fox_ears",
        name: "Fox Ears",
        slot: "decoration",
        rarity: "rare",
        imagePath: "",
      },
    ],
    bonusTokens: 1000,
    basePriceUSD: 14.99,
    valueUSD: 28.0,
    savingsPercent: 46,
    imagePath: "",
    theme: "legendary",
    featured: true,
    sortOrder: 6,
    limitedTime: false,
    purchaseLimit: 500,
  },
];

// =============================================================================
// Premium Exclusives
// =============================================================================

/**
 * Premium exclusive items
 *
 * These cosmetics are ONLY available via real-money purchase.
 * They are NOT purchasable in the points/token shop.
 * Each exclusive has a matching entry in the cosmetics catalog
 * with source: "exclusive".
 */
export const PREMIUM_EXCLUSIVES: Omit<
  PremiumExclusiveItem,
  "localizedPrice" | "owned"
>[] = [
  // === LEGENDARY EXCLUSIVES ===
  {
    id: "exclusive_galaxy_bg",
    productId: "com.snapstyle.exclusive.galaxy_bg",
    name: "Galaxy Premium",
    description:
      "A premium-exclusive variant of the Galaxy background with enhanced cosmic details.",
    slot: "background",
    rarity: "legendary",
    imagePath: "",
    basePriceUSD: 4.99,
    premiumExclusive: true,
    limitedEdition: false,
    featured: true,
    sortOrder: 1,
  },
  {
    id: "exclusive_neon_crown",
    productId: "com.snapstyle.exclusive.neon_crown",
    name: "Neon Crown Frame",
    description:
      "An animated neon crown PFP decoration — only available in the Premium Shop.",
    slot: "decoration",
    rarity: "mythic",
    imagePath: "",
    basePriceUSD: 6.99,
    premiumExclusive: true,
    limitedEdition: true,
    totalSupply: 200,
    featured: true,
    sortOrder: 2,
  },
  {
    id: "exclusive_synthwave_deluxe",
    productId: "com.snapstyle.exclusive.synthwave_deluxe",
    name: "Synthwave Deluxe",
    description:
      "A premium synthwave background with animated grid and sunset. Premium exclusive.",
    slot: "background",
    rarity: "mythic",
    imagePath: "",
    basePriceUSD: 7.99,
    premiumExclusive: true,
    limitedEdition: false,
    featured: false,
    sortOrder: 3,
  },
];

// =============================================================================
// Android Product IDs (Different format for Google Play)
// =============================================================================

/**
 * Maps iOS product IDs to Android product IDs
 */
export const ANDROID_PRODUCT_IDS: Record<string, string> = {
  // Token packs
  "com.snapstyle.tokens.100": "snapstyle_tokens_100",
  "com.snapstyle.tokens.500": "snapstyle_tokens_500",
  "com.snapstyle.tokens.1200": "snapstyle_tokens_1200",
  "com.snapstyle.tokens.2500": "snapstyle_tokens_2500",
  "com.snapstyle.tokens.5500": "snapstyle_tokens_5500",
  "com.snapstyle.tokens.12000": "snapstyle_tokens_12000",

  // Bundles
  "com.snapstyle.bundle.starter_premium": "snapstyle_bundle_starter_premium",
  "com.snapstyle.bundle.background_pack": "snapstyle_bundle_background_pack",
  "com.snapstyle.bundle.decoration_pack": "snapstyle_bundle_decoration_pack",
  "com.snapstyle.bundle.cyber_deluxe": "snapstyle_bundle_cyber_deluxe",
  "com.snapstyle.bundle.seasonal_mystic": "snapstyle_bundle_seasonal_mystic",
  "com.snapstyle.bundle.founders": "snapstyle_bundle_founders",

  // Exclusives
  "com.snapstyle.exclusive.galaxy_bg": "snapstyle_exclusive_galaxy_bg",
  "com.snapstyle.exclusive.neon_crown": "snapstyle_exclusive_neon_crown",
  "com.snapstyle.exclusive.synthwave_deluxe":
    "snapstyle_exclusive_synthwave_deluxe",
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all product IDs for a specific platform
 */
export function getProductIds(platform: "ios" | "android"): string[] {
  const iosIds = [
    ...TOKEN_PACKS.map((p) => p.productId),
    ...PREMIUM_BUNDLES.map((p) => p.productId),
    ...PREMIUM_EXCLUSIVES.map((p) => p.productId),
  ];

  if (platform === "ios") {
    return iosIds;
  }

  return iosIds.map((id) => ANDROID_PRODUCT_IDS[id] || id);
}

/**
 * Get token pack by ID
 */
export function getTokenPackById(
  id: string,
): Omit<TokenPack, "localizedPrice"> | undefined {
  return TOKEN_PACKS.find((p) => p.id === id);
}

/**
 * Get bundle by ID
 */
export function getBundleById(
  id: string,
):
  | Omit<PremiumBundle, "localizedPrice" | "owned" | "purchasesRemaining">
  | undefined {
  return PREMIUM_BUNDLES.find((b) => b.id === id);
}

/**
 * Get exclusive by ID
 */
export function getExclusiveById(
  id: string,
): Omit<PremiumExclusiveItem, "localizedPrice" | "owned"> | undefined {
  return PREMIUM_EXCLUSIVES.find((e) => e.id === id);
}

/**
 * All cosmetic IDs granted by a specific premium bundle.
 */
export function getBundleGrantedIds(bundleId: string): string[] {
  const bundle = PREMIUM_BUNDLES.find((b) => b.id === bundleId);
  return bundle ? bundle.items.map((i) => i.itemId) : [];
}

/**
 * Look up a premium product (any type) by ID.
 */
export function getPremiumProductById(
  id: string,
):
  | Omit<TokenPack, "localizedPrice">
  | Omit<PremiumBundle, "localizedPrice" | "owned" | "purchasesRemaining">
  | Omit<PremiumExclusiveItem, "localizedPrice" | "owned">
  | undefined {
  return (
    TOKEN_PACKS.find((p) => p.id === id) ??
    PREMIUM_BUNDLES.find((b) => b.id === id) ??
    PREMIUM_EXCLUSIVES.find((e) => e.id === id)
  );
}

/**
 * All cosmetic item IDs referenced across every premium bundle & exclusive.
 */
export function getAllPremiumCosmeticIds(): string[] {
  const ids = new Set<string>();
  for (const b of PREMIUM_BUNDLES) {
    for (const item of b.items) {
      ids.add(item.itemId);
    }
  }
  for (const e of PREMIUM_EXCLUSIVES) {
    ids.add(e.id);
  }
  return Array.from(ids);
}

/**
 * Calculate total value of a bundle's contents based on item rarities.
 */
export function calculateBundleValue(
  bundle: (typeof PREMIUM_BUNDLES)[number],
): number {
  const itemValues: Record<string, number> = {
    uncommon: 1.49,
    rare: 2.99,
    epic: 4.99,
    legendary: 7.99,
    mythic: 14.99,
  };

  const itemsValue = bundle.items.reduce((total, item) => {
    return total + (itemValues[item.rarity] || 2.99);
  }, 0);

  // Token value: roughly $1 per 100 tokens
  const tokensValue = bundle.bonusTokens / 100;

  return itemsValue + tokensValue;
}
