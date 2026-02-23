/**
 * Seed Monthly Tasks and Premium Products into Firestore
 * Uses the Firestore REST API with Firebase CLI's stored refresh token.
 *
 * Usage: node scripts/seed-firestore-rest.js
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ID = "gamerapp-37e70";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Firebase CLI OAuth client credentials (public, embedded in firebase-tools)
const FIREBASE_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

async function getAccessToken() {
  const configPath = path.join(
    process.env.HOME || process.env.USERPROFILE,
    ".config",
    "configstore",
    "firebase-tools.json",
  );

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Firebase config not found at ${configPath}. Run 'firebase login' first.`,
    );
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const refreshToken = config.tokens?.refresh_token;

  if (!refreshToken) {
    throw new Error("No refresh token found. Run 'firebase login' first.");
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: FIREBASE_CLIENT_ID,
      client_secret: FIREBASE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await resp.json();
  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === "boolean") return { booleanValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "id") continue; // ID is in the document path
    fields[k] = toFirestoreValue(v);
  }
  // Add timestamp
  fields.createdAt = { timestampValue: new Date().toISOString() };
  return { fields };
}

async function writeDoc(accessToken, collection, docId, data) {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}`;
  const body = toFirestoreDoc(data);

  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Failed to write ${collection}/${docId}: ${resp.status} ${text}`,
    );
  }
}

// =============================================================================
// Data
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

const premiumProducts = [
  {
    id: "tokens_100",
    productId: "com.snapstyle.tokens.100",
    type: "token_pack",
    name: "Handful of Tokens",
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
    basePriceUSD: 44.99,
    rewards: { tokens: 10000, bonusTokens: 3500 },
    popular: false,
    featured: false,
    active: true,
    sortOrder: 6,
  },
  {
    id: "bundle_starter",
    productId: "com.snapstyle.bundle.starter",
    type: "bundle",
    name: "Starter Bundle",
    description: "Perfect for new players",
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
    sortOrder: 7,
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
    sortOrder: 8,
  },
  {
    id: "bundle_urban",
    productId: "com.snapstyle.bundle.urban",
    type: "bundle",
    name: "Urban Explorer",
    description: "City vibes and street art",
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
    sortOrder: 9,
  },
  {
    id: "bundle_cozy",
    productId: "com.snapstyle.bundle.cozy",
    type: "bundle",
    name: "Cozy Vibes",
    description: "Warm and comfortable cosmetics",
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
    sortOrder: 10,
  },
  {
    id: "exclusive_galaxy_bg",
    productId: "com.snapstyle.exclusive.galaxy_bg",
    type: "exclusive",
    name: "Galaxy Premium",
    description: "Premium-exclusive Galaxy background",
    slot: "background",
    rarity: "legendary",
    basePriceUSD: 4.99,
    featured: true,
    limitedEdition: false,
    active: true,
    sortOrder: 11,
  },
  {
    id: "exclusive_synthwave_deluxe",
    productId: "com.snapstyle.exclusive.synthwave_deluxe",
    type: "exclusive",
    name: "Synthwave Deluxe",
    description: "Premium synthwave with animated grid",
    slot: "background",
    rarity: "mythic",
    basePriceUSD: 7.99,
    featured: false,
    limitedEdition: true,
    active: true,
    sortOrder: 12,
  },
  {
    id: "exclusive_neon_crown",
    productId: "com.snapstyle.exclusive.neon_crown",
    type: "exclusive",
    name: "Neon Crown Frame",
    description: "Animated neon crown PFP decoration",
    slot: "decoration",
    rarity: "mythic",
    basePriceUSD: 9.99,
    featured: false,
    limitedEdition: true,
    active: true,
    sortOrder: 13,
  },
];

async function main() {
  console.log("🔑 Getting access token...");
  const token = await getAccessToken();
  console.log("  ✅ Got access token\n");

  // Seed Monthly Tasks
  console.log("📋 Seeding monthly tasks...");
  for (const task of monthlyTasks) {
    await writeDoc(token, "Tasks", task.id, task);
    console.log(`  ✓ ${task.id}`);
  }
  console.log(`  ✅ Seeded ${monthlyTasks.length} monthly tasks\n`);

  // Seed Premium Products
  console.log("💎 Seeding premium products...");
  for (const product of premiumProducts) {
    await writeDoc(token, "PremiumProducts", product.id, product);
    console.log(`  ✓ ${product.id}`);
  }
  console.log(`  ✅ Seeded ${premiumProducts.length} premium products\n`);

  console.log("🎉 Seeding complete!");
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err.message);
  process.exit(1);
});
