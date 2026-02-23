/**
 * Seed Monthly Tasks and Premium Products into Firestore
 *
 * Usage: node scripts/seed-firestore.js
 *
 * Uses Application Default Credentials (firebase login provides these).
 * Run this after `firebase login` and `firebase use <project>`.
 */

const admin = require("firebase-admin");

// Initialize with application default credentials
admin.initializeApp({
  projectId: "gamerapp-37e70",
});

const db = admin.firestore();

// =============================================================================
// Monthly Tasks
// =============================================================================

const monthlyTasks = [
  {
    id: "monthly_play_20_games",
    title: "Seasoned Player",
    description: "Play 20 games this month",
    icon: "gamepad-variant",
    cadence: "monthly",
    type: "play_game",
    target: 20,
    rewardTokens: 150,
    active: true,
    sortOrder: 1,
  },
  {
    id: "monthly_win_10_games",
    title: "Monthly Champion",
    description: "Win 10 games this month",
    icon: "trophy",
    cadence: "monthly",
    type: "win_game",
    target: 10,
    rewardTokens: 200,
    active: true,
    sortOrder: 2,
  },
  {
    id: "monthly_send_100_messages",
    title: "Chatterbox",
    description: "Send 100 messages this month",
    icon: "message-text-outline",
    cadence: "monthly",
    type: "send_message",
    target: 100,
    rewardTokens: 100,
    active: true,
    sortOrder: 3,
  },
  {
    id: "monthly_post_10_stories",
    title: "Content Creator",
    description: "Post 10 stories this month",
    icon: "image-multiple",
    cadence: "monthly",
    type: "post_story",
    target: 10,
    rewardTokens: 120,
    active: true,
    sortOrder: 4,
  },
  {
    id: "monthly_view_50_stories",
    title: "Story Binge",
    description: "View 50 stories this month",
    icon: "eye-check",
    cadence: "monthly",
    type: "view_story",
    target: 50,
    rewardTokens: 80,
    active: true,
    sortOrder: 5,
  },
  {
    id: "monthly_add_3_friends",
    title: "Expanding Circles",
    description: "Add 3 new friends this month",
    icon: "account-group",
    cadence: "monthly",
    type: "add_friend",
    target: 3,
    rewardTokens: 100,
    active: true,
    sortOrder: 6,
  },
  {
    id: "monthly_7_day_streak",
    title: "Streak Master",
    description: "Maintain a 7-day login streak",
    icon: "fire",
    cadence: "monthly",
    type: "maintain_streak",
    target: 7,
    rewardTokens: 250,
    active: true,
    sortOrder: 7,
  },
];

// =============================================================================
// Premium Products (for the PremiumProducts collection)
// =============================================================================

const premiumProducts = [
  // Token Packs
  {
    id: "tokens_100",
    productId: "com.snapstyle.tokens.100",
    type: "token_pack",
    name: "Handful of Tokens",
    description: "A small pack to get you started",
    basePriceUSD: 0.99,
    rewards: { tokens: 100, bonusTokens: 0 },
    popular: false,
    featured: false,
    active: true,
    sortOrder: 1,
  },
  {
    id: "tokens_500",
    productId: "com.snapstyle.tokens.500",
    type: "token_pack",
    name: "Token Pouch",
    description: "A solid pouch of tokens",
    basePriceUSD: 3.99,
    rewards: { tokens: 500, bonusTokens: 50 },
    popular: false,
    featured: false,
    active: true,
    sortOrder: 2,
  },
  {
    id: "tokens_1000",
    productId: "com.snapstyle.tokens.1000",
    type: "token_pack",
    name: "Token Chest",
    description: "Great value chest of tokens",
    basePriceUSD: 6.99,
    rewards: { tokens: 1000, bonusTokens: 150 },
    popular: true,
    featured: false,
    active: true,
    sortOrder: 3,
  },
  {
    id: "tokens_2500",
    productId: "com.snapstyle.tokens.2500",
    type: "token_pack",
    name: "Token Vault",
    description: "A massive vault of tokens with bonus",
    basePriceUSD: 14.99,
    rewards: { tokens: 2500, bonusTokens: 500 },
    popular: false,
    featured: true,
    active: true,
    sortOrder: 4,
  },
  {
    id: "tokens_5000",
    productId: "com.snapstyle.tokens.5000",
    type: "token_pack",
    name: "Token Treasury",
    description: "The ultimate token collection",
    basePriceUSD: 24.99,
    rewards: { tokens: 5000, bonusTokens: 1250 },
    popular: false,
    featured: false,
    active: true,
    sortOrder: 5,
  },
  {
    id: "tokens_10000",
    productId: "com.snapstyle.tokens.10000",
    type: "token_pack",
    name: "Token Empire",
    description: "Maximum value token mega-pack",
    basePriceUSD: 44.99,
    rewards: { tokens: 10000, bonusTokens: 3500 },
    popular: false,
    featured: false,
    active: true,
    sortOrder: 6,
  },

  // Premium Bundles
  {
    id: "bundle_starter",
    productId: "com.snapstyle.bundle.starter",
    type: "bundle",
    name: "Starter Bundle",
    description: "Perfect for new players — backgrounds and decorations",
    basePriceUSD: 4.99,
    valueUSD: 9.99,
    savingsPercent: 50,
    rewards: {
      itemIds: [
        "bg_donut_wallpaper",
        "bg_lofi_alleyway",
        "premium_chess",
        "premium_donut",
      ],
      bonusTokens: 200,
    },
    theme: "starter",
    featured: false,
    active: true,
    sortOrder: 1,
  },
  {
    id: "bundle_cosmic",
    productId: "com.snapstyle.bundle.cosmic",
    type: "bundle",
    name: "Cosmic Collection",
    description: "Galaxies, stars, and cosmic decorations",
    basePriceUSD: 9.99,
    valueUSD: 19.99,
    savingsPercent: 50,
    rewards: {
      itemIds: [
        "bg_galaxy",
        "bg_arcane_circles",
        "bg_cyber_aesthetic",
        "premium_retro_arcade",
      ],
      bonusTokens: 500,
    },
    theme: "premium",
    featured: true,
    active: true,
    sortOrder: 2,
  },
  {
    id: "bundle_urban",
    productId: "com.snapstyle.bundle.urban",
    type: "bundle",
    name: "Urban Explorer",
    description: "City vibes and street art aesthetics",
    basePriceUSD: 7.99,
    valueUSD: 14.99,
    savingsPercent: 47,
    rewards: {
      itemIds: [
        "bg_pixel_neo_tokyo",
        "bg_glitched_tokyo",
        "premium_chicago",
        "premium_lofi_city",
      ],
      bonusTokens: 300,
    },
    theme: "premium",
    featured: false,
    active: true,
    sortOrder: 3,
  },
  {
    id: "bundle_cozy",
    productId: "com.snapstyle.bundle.cozy",
    type: "bundle",
    name: "Cozy Vibes",
    description: "Warm and comfortable cosmetic collection",
    basePriceUSD: 5.99,
    valueUSD: 11.99,
    savingsPercent: 50,
    rewards: {
      itemIds: [
        "bg_pixel_cafe",
        "bg_magical_forest",
        "premium_cozy_cat",
        "premium_fox_ears",
      ],
      bonusTokens: 250,
    },
    theme: "starter",
    featured: false,
    active: true,
    sortOrder: 4,
  },
  {
    id: "bundle_legendary",
    productId: "com.snapstyle.bundle.legendary",
    type: "bundle",
    name: "Legendary Collection",
    description: "The most exclusive premium bundle",
    basePriceUSD: 19.99,
    valueUSD: 44.99,
    savingsPercent: 55,
    rewards: {
      itemIds: [
        "exclusive_galaxy_bg",
        "exclusive_synthwave_deluxe",
        "exclusive_neon_crown",
      ],
      bonusTokens: 2000,
    },
    theme: "legendary",
    featured: false,
    active: true,
    sortOrder: 5,
  },
  {
    id: "bundle_mythic",
    productId: "com.snapstyle.bundle.mythic",
    type: "bundle",
    name: "Mythic Arsenal",
    description: "Ultra-rare mythic-tier cosmetics bundle",
    basePriceUSD: 29.99,
    valueUSD: 69.99,
    savingsPercent: 57,
    rewards: {
      itemIds: [
        "exclusive_galaxy_bg",
        "exclusive_synthwave_deluxe",
        "exclusive_neon_crown",
        "bg_steampunk_city",
        "bg_cyber_aesthetic",
        "premium_retro_arcade",
      ],
      bonusTokens: 5000,
    },
    theme: "mythic",
    featured: false,
    active: true,
    sortOrder: 6,
  },

  // Exclusive Items
  {
    id: "exclusive_galaxy_bg",
    productId: "com.snapstyle.exclusive.galaxy_bg",
    type: "exclusive",
    name: "Galaxy Premium",
    description:
      "A premium-exclusive variant of the Galaxy background with enhanced cosmic details",
    slot: "background",
    rarity: "legendary",
    basePriceUSD: 4.99,
    featured: true,
    limitedEdition: false,
    active: true,
    sortOrder: 1,
  },
  {
    id: "exclusive_synthwave_deluxe",
    productId: "com.snapstyle.exclusive.synthwave_deluxe",
    type: "exclusive",
    name: "Synthwave Deluxe",
    description:
      "A premium synthwave background with animated grid and sunset",
    slot: "background",
    rarity: "mythic",
    basePriceUSD: 7.99,
    featured: false,
    limitedEdition: true,
    active: true,
    sortOrder: 2,
  },
  {
    id: "exclusive_neon_crown",
    productId: "com.snapstyle.exclusive.neon_crown",
    type: "exclusive",
    name: "Neon Crown Frame",
    description:
      "An animated neon crown PFP decoration — only available in the Premium Shop",
    slot: "decoration",
    rarity: "mythic",
    basePriceUSD: 9.99,
    featured: false,
    limitedEdition: true,
    active: true,
    sortOrder: 3,
  },
];

// =============================================================================
// Seed Logic
// =============================================================================

async function seedAll() {
  console.log("🌱 Starting Firestore seeding...\n");

  // Seed Monthly Tasks
  console.log("📋 Seeding monthly tasks...");
  const taskBatch = db.batch();
  for (const task of monthlyTasks) {
    const taskRef = db.collection("Tasks").doc(task.id);
    taskBatch.set(taskRef, {
      ...task,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await taskBatch.commit();
  console.log(`  ✅ Seeded ${monthlyTasks.length} monthly tasks\n`);

  // Seed Premium Products
  console.log("💎 Seeding premium products...");
  const productBatch = db.batch();
  for (const product of premiumProducts) {
    const productRef = db.collection("PremiumProducts").doc(product.id);
    productBatch.set(productRef, {
      ...product,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await productBatch.commit();
  console.log(`  ✅ Seeded ${premiumProducts.length} premium products\n`);

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seedAll().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
