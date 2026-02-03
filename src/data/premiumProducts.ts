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
 * Each bundle includes:
 * - Multiple exclusive cosmetic items
 * - Bonus tokens
 * - Significant savings over individual purchase
 */
export const PREMIUM_BUNDLES: Omit<
  PremiumBundle,
  "localizedPrice" | "owned" | "purchasesRemaining"
>[] = [
  // === STARTER BUNDLES ===
  {
    id: "bundle_starter",
    productId: "com.snapstyle.bundle.starter",
    name: "Starter Pack",
    description:
      "Perfect for new players! Get a head start with essential items.",
    items: [
      {
        itemId: "starter_hat_cap",
        name: "Classic Cap",
        slot: "hat",
        rarity: "rare",
        imagePath: "🧢",
      },
      {
        itemId: "starter_glasses_cool",
        name: "Cool Shades",
        slot: "glasses",
        rarity: "rare",
        imagePath: "😎",
      },
      {
        itemId: "starter_frame_simple",
        name: "Simple Frame",
        slot: "profile_frame",
        rarity: "rare",
        imagePath: "🖼️",
      },
    ],
    bonusTokens: 100,
    basePriceUSD: 2.99,
    valueUSD: 5.99,
    savingsPercent: 50,
    imagePath: "📦",
    theme: "starter",
    featured: false,
    sortOrder: 1,
    limitedTime: false,
  },

  // === PREMIUM BUNDLES ===
  {
    id: "bundle_style_master",
    productId: "com.snapstyle.bundle.style_master",
    name: "Style Master Pack",
    description:
      "Elevate your look with this premium collection of stylish items.",
    items: [
      {
        itemId: "style_hat_fedora",
        name: "Classic Fedora",
        slot: "hat",
        rarity: "epic",
        imagePath: "🎩",
      },
      {
        itemId: "style_glasses_aviator",
        name: "Aviator Glasses",
        slot: "glasses",
        rarity: "epic",
        imagePath: "🕶️",
      },
      {
        itemId: "style_top_blazer",
        name: "Sharp Blazer",
        slot: "clothing_top",
        rarity: "epic",
        imagePath: "🧥",
      },
      {
        itemId: "style_frame_elegant",
        name: "Elegant Frame",
        slot: "profile_frame",
        rarity: "epic",
        imagePath: "✨",
      },
    ],
    bonusTokens: 300,
    basePriceUSD: 9.99,
    valueUSD: 18.99,
    savingsPercent: 47,
    imagePath: "👔",
    theme: "premium",
    featured: true,
    sortOrder: 2,
    limitedTime: false,
  },
  {
    id: "bundle_chat_master",
    productId: "com.snapstyle.bundle.chat_master",
    name: "Chat Master Pack",
    description:
      "Stand out in conversations with exclusive chat customizations.",
    items: [
      {
        itemId: "chat_bubble_neon",
        name: "Neon Bubble",
        slot: "chat_bubble",
        rarity: "epic",
        imagePath: "💬",
      },
      {
        itemId: "chat_bubble_gradient",
        name: "Gradient Bubble",
        slot: "chat_bubble",
        rarity: "epic",
        imagePath: "🌈",
      },
      {
        itemId: "chat_name_glow",
        name: "Glowing Name",
        slot: "name_effect",
        rarity: "epic",
        imagePath: "✨",
      },
    ],
    bonusTokens: 200,
    basePriceUSD: 7.99,
    valueUSD: 14.99,
    savingsPercent: 47,
    imagePath: "💬",
    theme: "premium",
    featured: false,
    sortOrder: 3,
    limitedTime: false,
  },

  // === LEGENDARY BUNDLES ===
  {
    id: "bundle_legendary",
    productId: "com.snapstyle.bundle.legendary",
    name: "Legendary Collection",
    description:
      "The ultimate bundle with legendary items and massive token bonus!",
    items: [
      {
        itemId: "legend_hat_crown",
        name: "Golden Crown",
        slot: "hat",
        rarity: "legendary",
        imagePath: "👑",
      },
      {
        itemId: "legend_glasses_diamond",
        name: "Diamond Shades",
        slot: "glasses",
        rarity: "legendary",
        imagePath: "💎",
      },
      {
        itemId: "legend_frame_animated",
        name: "Animated Frame",
        slot: "profile_frame",
        rarity: "legendary",
        imagePath: "🌟",
      },
      {
        itemId: "legend_theme_royal",
        name: "Royal Theme",
        slot: "profile_theme",
        rarity: "legendary",
        imagePath: "🏰",
      },
      {
        itemId: "legend_bubble_premium",
        name: "Premium Bubble",
        slot: "chat_bubble",
        rarity: "legendary",
        imagePath: "💬",
      },
    ],
    bonusTokens: 1000,
    basePriceUSD: 24.99,
    valueUSD: 49.99,
    savingsPercent: 50,
    imagePath: "👑",
    theme: "legendary",
    featured: false,
    sortOrder: 4,
    limitedTime: false,
  },

  // === SEASONAL/LIMITED BUNDLES ===
  {
    id: "bundle_holiday_winter",
    productId: "com.snapstyle.bundle.holiday_winter",
    name: "Winter Wonderland Pack",
    description: "Limited time holiday bundle with festive items!",
    items: [
      {
        itemId: "winter_hat_santa",
        name: "Santa Hat",
        slot: "hat",
        rarity: "epic",
        imagePath: "🎅",
      },
      {
        itemId: "winter_bg_snow",
        name: "Snowy Background",
        slot: "background",
        rarity: "epic",
        imagePath: "❄️",
      },
      {
        itemId: "winter_frame_festive",
        name: "Festive Frame",
        slot: "profile_frame",
        rarity: "epic",
        imagePath: "🎄",
      },
    ],
    bonusTokens: 250,
    basePriceUSD: 6.99,
    valueUSD: 12.99,
    savingsPercent: 46,
    imagePath: "❄️",
    theme: "premium",
    featured: false,
    sortOrder: 10,
    limitedTime: true,
    purchaseLimit: 1,
  },
];

// =============================================================================
// Premium Exclusives
// =============================================================================

/**
 * Premium exclusive items
 *
 * These items can ONLY be purchased with real money.
 * They are NOT available in the points shop.
 * Higher rarity = higher price and more exclusive.
 */
export const PREMIUM_EXCLUSIVES: Omit<
  PremiumExclusiveItem,
  "localizedPrice" | "owned"
>[] = [
  // === LEGENDARY EXCLUSIVES ===
  {
    id: "exclusive_crown_diamond",
    productId: "com.snapstyle.exclusive.diamond_crown",
    name: "Diamond Crown",
    description: "The ultimate status symbol. A crown encrusted with diamonds.",
    slot: "hat",
    rarity: "legendary",
    imagePath: "💎👑",
    basePriceUSD: 9.99,
    premiumExclusive: true,
    limitedEdition: false,
    featured: true,
    sortOrder: 1,
  },
  {
    id: "exclusive_glasses_hologram",
    productId: "com.snapstyle.exclusive.holo_glasses",
    name: "Hologram Visor",
    description: "Futuristic holographic visor with animated display.",
    slot: "glasses",
    rarity: "legendary",
    imagePath: "🥽✨",
    basePriceUSD: 7.99,
    premiumExclusive: true,
    limitedEdition: false,
    featured: false,
    sortOrder: 2,
  },
  {
    id: "exclusive_frame_animated",
    productId: "com.snapstyle.exclusive.holo_frame",
    name: "Holographic Frame",
    description: "Eye-catching animated holographic profile frame.",
    slot: "profile_frame",
    rarity: "legendary",
    imagePath: "🖼️✨",
    basePriceUSD: 7.99,
    premiumExclusive: true,
    limitedEdition: false,
    featured: false,
    sortOrder: 3,
  },
  {
    id: "exclusive_theme_aurora",
    productId: "com.snapstyle.exclusive.aurora_theme",
    name: "Aurora Theme",
    description: "Mesmerizing Northern Lights theme for your profile.",
    slot: "profile_theme",
    rarity: "legendary",
    imagePath: "🌌",
    basePriceUSD: 12.99,
    premiumExclusive: true,
    limitedEdition: false,
    featured: false,
    sortOrder: 4,
  },

  // === MYTHIC EXCLUSIVES ===
  {
    id: "exclusive_mythic_crown",
    productId: "com.snapstyle.exclusive.mythic_crown",
    name: "Ethereal Crown",
    description:
      "A mystical crown that shifts between dimensions. The rarest headwear.",
    slot: "hat",
    rarity: "mythic",
    imagePath: "👑🔮",
    basePriceUSD: 19.99,
    premiumExclusive: true,
    limitedEdition: false,
    featured: false,
    sortOrder: 10,
  },
  {
    id: "exclusive_mythic_frame",
    productId: "com.snapstyle.exclusive.mythic_frame",
    name: "Dimensional Rift Frame",
    description:
      "A frame that tears through reality itself. Constantly shifting.",
    slot: "profile_frame",
    rarity: "mythic",
    imagePath: "🌀",
    basePriceUSD: 14.99,
    premiumExclusive: true,
    limitedEdition: false,
    featured: false,
    sortOrder: 11,
  },
  {
    id: "exclusive_mythic_theme",
    productId: "com.snapstyle.exclusive.cosmic_theme",
    name: "Cosmic Void Theme",
    description:
      "Your profile floats in the vast cosmic void. Stars and galaxies swirl.",
    slot: "profile_theme",
    rarity: "mythic",
    imagePath: "🌌✨",
    basePriceUSD: 24.99,
    premiumExclusive: true,
    limitedEdition: false,
    featured: false,
    sortOrder: 12,
  },

  // === LIMITED EDITION EXCLUSIVES ===
  {
    id: "exclusive_founders_badge",
    productId: "com.snapstyle.exclusive.founders",
    name: "Founders Frame",
    description:
      "Exclusive to early supporters. Limited to first 1000 purchases.",
    slot: "profile_frame",
    rarity: "mythic",
    imagePath: "🏆",
    basePriceUSD: 19.99,
    premiumExclusive: true,
    limitedEdition: true,
    totalSupply: 1000,
    featured: false,
    sortOrder: 20,
  },
  {
    id: "exclusive_anniversary_set",
    productId: "com.snapstyle.exclusive.anniversary",
    name: "Anniversary Crown",
    description: "Celebrating our first year! Available for limited time only.",
    slot: "hat",
    rarity: "mythic",
    imagePath: "🎂👑",
    basePriceUSD: 14.99,
    premiumExclusive: true,
    limitedEdition: true,
    featured: false,
    sortOrder: 21,
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
  "com.snapstyle.bundle.starter": "snapstyle_bundle_starter",
  "com.snapstyle.bundle.style_master": "snapstyle_bundle_style_master",
  "com.snapstyle.bundle.chat_master": "snapstyle_bundle_chat_master",
  "com.snapstyle.bundle.legendary": "snapstyle_bundle_legendary",
  "com.snapstyle.bundle.holiday_winter": "snapstyle_bundle_holiday_winter",

  // Exclusives
  "com.snapstyle.exclusive.diamond_crown": "snapstyle_exclusive_diamond_crown",
  "com.snapstyle.exclusive.holo_glasses": "snapstyle_exclusive_holo_glasses",
  "com.snapstyle.exclusive.holo_frame": "snapstyle_exclusive_holo_frame",
  "com.snapstyle.exclusive.aurora_theme": "snapstyle_exclusive_aurora_theme",
  "com.snapstyle.exclusive.mythic_crown": "snapstyle_exclusive_mythic_crown",
  "com.snapstyle.exclusive.mythic_frame": "snapstyle_exclusive_mythic_frame",
  "com.snapstyle.exclusive.cosmic_theme": "snapstyle_exclusive_cosmic_theme",
  "com.snapstyle.exclusive.founders": "snapstyle_exclusive_founders",
  "com.snapstyle.exclusive.anniversary": "snapstyle_exclusive_anniversary",
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
 * Calculate total value of a bundle's contents
 */
export function calculateBundleValue(
  bundle: (typeof PREMIUM_BUNDLES)[number],
): number {
  // Estimated value based on item rarities and tokens
  const itemValues: Record<string, number> = {
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
