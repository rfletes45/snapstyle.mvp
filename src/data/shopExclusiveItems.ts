/**
 * Shop Exclusive Items Data
 *
 * Contains 100+ shop-exclusive cosmetic items for the Points Shop.
 * These items can ONLY be purchased with tokens and are not obtainable elsewhere.
 *
 * Item Distribution:
 * - Hats: 15 items
 * - Glasses: 12 items
 * - Backgrounds: 15 items
 * - Clothing Tops: 12 items
 * - Clothing Bottoms: 10 items
 * - Neck Accessories: 8 items
 * - Ear Accessories: 8 items
 * - Hand Accessories: 8 items
 * - Profile Frames: 10 items
 * - Profile Banners: 10 items
 * - Profile Themes: 6 items
 * - Chat Bubbles: 10 items
 * - Name Effects: 8 items
 *
 * Rarity Distribution: ~40% Common, ~35% Rare, ~20% Epic, ~5% Legendary
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */

import type {
  ExtendedCosmeticRarity,
  ExtendedCosmeticSlot,
} from "@/types/profile";
import type { PointsShopItem } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

interface ShopItemTemplate {
  itemId: string;
  name: string;
  description: string;
  slot: ExtendedCosmeticSlot;
  rarity: ExtendedCosmeticRarity;
  imagePath: string;
  priceTokens: number;
  tags: string[];
  featured?: boolean;
  discountPercent?: number;
  originalPrice?: number;
}

// =============================================================================
// Price Tiers by Rarity
// =============================================================================

export const PRICE_TIERS = {
  common: { min: 100, max: 300 },
  rare: { min: 300, max: 750 },
  epic: { min: 750, max: 1500 },
  legendary: { min: 1500, max: 3000 },
  mythic: { min: 3000, max: 5000 },
} as const;

// =============================================================================
// Hats (15 items)
// =============================================================================

const HATS: ShopItemTemplate[] = [
  {
    itemId: "shop_hat_pixel_crown",
    name: "Pixel Crown",
    description: "A classic 8-bit royal crown for pixel art enthusiasts",
    slot: "hat",
    rarity: "rare",
    imagePath: "👑",
    priceTokens: 450,
    tags: ["pixel", "royal", "retro"],
    featured: true,
  },
  {
    itemId: "shop_hat_neon_visor",
    name: "Neon Visor",
    description: "Futuristic visor with glowing neon accents",
    slot: "hat",
    rarity: "epic",
    imagePath: "🕶️",
    priceTokens: 950,
    tags: ["cyberpunk", "neon", "futuristic"],
  },
  {
    itemId: "shop_hat_cloud_halo",
    name: "Cloud Halo",
    description: "A fluffy cloud floating above your head",
    slot: "hat",
    rarity: "legendary",
    imagePath: "☁️",
    priceTokens: 2200,
    tags: ["celestial", "cute", "floating"],
    featured: true,
  },
  {
    itemId: "shop_hat_fire_helmet",
    name: "Blazing Helmet",
    description: "A helmet engulfed in animated flames",
    slot: "hat",
    rarity: "epic",
    imagePath: "🔥",
    priceTokens: 1100,
    tags: ["fire", "animated", "fierce"],
  },
  {
    itemId: "shop_hat_ice_crown",
    name: "Frozen Crown",
    description: "An icy crown with crystalline frost effects",
    slot: "hat",
    rarity: "epic",
    imagePath: "❄️",
    priceTokens: 1050,
    tags: ["ice", "winter", "crystal"],
  },
  {
    itemId: "shop_hat_baseball_classic",
    name: "Classic Cap",
    description: "A timeless baseball cap for everyday style",
    slot: "hat",
    rarity: "common",
    imagePath: "🧢",
    priceTokens: 150,
    tags: ["casual", "sports", "classic"],
  },
  {
    itemId: "shop_hat_wizard",
    name: "Arcane Wizard Hat",
    description: "A mystical wizard hat adorned with stars",
    slot: "hat",
    rarity: "rare",
    imagePath: "🧙",
    priceTokens: 550,
    tags: ["magic", "fantasy", "mystical"],
  },
  {
    itemId: "shop_hat_astronaut",
    name: "Space Helmet",
    description: "Ready for intergalactic adventures",
    slot: "hat",
    rarity: "rare",
    imagePath: "🚀",
    priceTokens: 600,
    tags: ["space", "astronaut", "sci-fi"],
  },
  {
    itemId: "shop_hat_bunny_ears",
    name: "Fluffy Bunny Ears",
    description: "Adorable plush bunny ears that bounce",
    slot: "hat",
    rarity: "common",
    imagePath: "🐰",
    priceTokens: 200,
    tags: ["cute", "animal", "bouncy"],
  },
  {
    itemId: "shop_hat_cat_ears",
    name: "Kitty Ears",
    description: "Cute cat ears for the feline fans",
    slot: "hat",
    rarity: "common",
    imagePath: "🐱",
    priceTokens: 180,
    tags: ["cute", "animal", "kawaii"],
  },
  {
    itemId: "shop_hat_pirate",
    name: "Pirate Captain Hat",
    description: "Ahoy! Time to sail the seven seas",
    slot: "hat",
    rarity: "rare",
    imagePath: "🏴‍☠️",
    priceTokens: 500,
    tags: ["pirate", "adventure", "nautical"],
  },
  {
    itemId: "shop_hat_chef",
    name: "Master Chef Toque",
    description: "For the culinary artists among us",
    slot: "hat",
    rarity: "common",
    imagePath: "👨‍🍳",
    priceTokens: 175,
    tags: ["cooking", "professional", "food"],
  },
  {
    itemId: "shop_hat_party",
    name: "Party Hat Deluxe",
    description: "Every day is a celebration!",
    slot: "hat",
    rarity: "common",
    imagePath: "🎉",
    priceTokens: 125,
    tags: ["party", "celebration", "fun"],
  },
  {
    itemId: "shop_hat_ninja",
    name: "Shadow Ninja Hood",
    description: "Move unseen through the digital realm",
    slot: "hat",
    rarity: "rare",
    imagePath: "🥷",
    priceTokens: 480,
    tags: ["ninja", "stealth", "cool"],
  },
  {
    itemId: "shop_hat_galaxy",
    name: "Galaxy Brain",
    description: "A swirling galaxy contained within a dome",
    slot: "hat",
    rarity: "legendary",
    imagePath: "🌌",
    priceTokens: 2500,
    tags: ["space", "galaxy", "premium"],
    featured: true,
  },
];

// =============================================================================
// Glasses (12 items)
// =============================================================================

const GLASSES: ShopItemTemplate[] = [
  {
    itemId: "shop_glasses_heart",
    name: "Heart Eyes",
    description: "Show your love with heart-shaped frames",
    slot: "glasses",
    rarity: "common",
    imagePath: "😍",
    priceTokens: 150,
    tags: ["love", "cute", "fun"],
  },
  {
    itemId: "shop_glasses_star",
    name: "Star Shades",
    description: "Star-shaped glasses for stellar style",
    slot: "glasses",
    rarity: "common",
    imagePath: "⭐",
    priceTokens: 175,
    tags: ["star", "fun", "unique"],
  },
  {
    itemId: "shop_glasses_vr",
    name: "VR Headset",
    description: "Enter the virtual reality dimension",
    slot: "glasses",
    rarity: "rare",
    imagePath: "🥽",
    priceTokens: 450,
    tags: ["tech", "futuristic", "vr"],
  },
  {
    itemId: "shop_glasses_monocle",
    name: "Fancy Monocle",
    description: "A distinguished monocle for the refined",
    slot: "glasses",
    rarity: "rare",
    imagePath: "🧐",
    priceTokens: 380,
    tags: ["fancy", "vintage", "classy"],
  },
  {
    itemId: "shop_glasses_cyber",
    name: "Cyberpunk Visor",
    description: "Holographic display visor from the future",
    slot: "glasses",
    rarity: "epic",
    imagePath: "🤖",
    priceTokens: 900,
    tags: ["cyberpunk", "tech", "futuristic"],
    featured: true,
  },
  {
    itemId: "shop_glasses_nerd",
    name: "Thick Rimmed Specs",
    description: "Embrace your inner intellectual",
    slot: "glasses",
    rarity: "common",
    imagePath: "🤓",
    priceTokens: 120,
    tags: ["nerd", "smart", "classic"],
  },
  {
    itemId: "shop_glasses_aviator",
    name: "Golden Aviators",
    description: "Classic aviator sunglasses with gold frames",
    slot: "glasses",
    rarity: "rare",
    imagePath: "🕶️",
    priceTokens: 350,
    tags: ["cool", "classic", "stylish"],
  },
  {
    itemId: "shop_glasses_3d",
    name: "3D Movie Glasses",
    description: "The classic red-blue 3D experience",
    slot: "glasses",
    rarity: "common",
    imagePath: "🎬",
    priceTokens: 140,
    tags: ["retro", "movies", "fun"],
  },
  {
    itemId: "shop_glasses_rainbow",
    name: "Rainbow Prism Glasses",
    description: "See the world in all colors",
    slot: "glasses",
    rarity: "rare",
    imagePath: "🌈",
    priceTokens: 420,
    tags: ["colorful", "pride", "vibrant"],
  },
  {
    itemId: "shop_glasses_diamond",
    name: "Diamond Encrusted Shades",
    description: "Luxury eyewear for the elite",
    slot: "glasses",
    rarity: "legendary",
    imagePath: "💎",
    priceTokens: 1800,
    tags: ["luxury", "bling", "premium"],
  },
  {
    itemId: "shop_glasses_goggles",
    name: "Steampunk Goggles",
    description: "Brass and leather goggles from another era",
    slot: "glasses",
    rarity: "rare",
    imagePath: "⚙️",
    priceTokens: 480,
    tags: ["steampunk", "vintage", "industrial"],
  },
  {
    itemId: "shop_glasses_fire",
    name: "Flame Shades",
    description: "Glasses with animated flame effects",
    slot: "glasses",
    rarity: "epic",
    imagePath: "🔥",
    priceTokens: 850,
    tags: ["fire", "animated", "hot"],
  },
];

// =============================================================================
// Backgrounds (15 items)
// =============================================================================

const BACKGROUNDS: ShopItemTemplate[] = [
  {
    itemId: "shop_bg_sunset_city",
    name: "Sunset Cityscape",
    description: "A beautiful city skyline at golden hour",
    slot: "background",
    rarity: "rare",
    imagePath: "🌆",
    priceTokens: 400,
    tags: ["city", "sunset", "scenic"],
  },
  {
    itemId: "shop_bg_aurora",
    name: "Northern Lights",
    description: "Mesmerizing aurora borealis display",
    slot: "background",
    rarity: "epic",
    imagePath: "🌌",
    priceTokens: 950,
    tags: ["aurora", "night", "magical"],
    featured: true,
  },
  {
    itemId: "shop_bg_beach",
    name: "Tropical Paradise",
    description: "Palm trees and crystal clear waters",
    slot: "background",
    rarity: "common",
    imagePath: "🏝️",
    priceTokens: 200,
    tags: ["beach", "summer", "relaxing"],
  },
  {
    itemId: "shop_bg_mountain",
    name: "Mountain Peak",
    description: "Majestic snow-capped mountains",
    slot: "background",
    rarity: "common",
    imagePath: "🏔️",
    priceTokens: 175,
    tags: ["nature", "mountain", "peaceful"],
  },
  {
    itemId: "shop_bg_forest_magic",
    name: "Enchanted Forest",
    description: "A mystical forest with glowing plants",
    slot: "background",
    rarity: "rare",
    imagePath: "🌲",
    priceTokens: 500,
    tags: ["forest", "fantasy", "magical"],
  },
  {
    itemId: "shop_bg_space",
    name: "Deep Space",
    description: "Float among the stars and nebulae",
    slot: "background",
    rarity: "rare",
    imagePath: "🚀",
    priceTokens: 550,
    tags: ["space", "cosmic", "sci-fi"],
  },
  {
    itemId: "shop_bg_underwater",
    name: "Ocean Depths",
    description: "Explore the mysterious underwater world",
    slot: "background",
    rarity: "rare",
    imagePath: "🐠",
    priceTokens: 480,
    tags: ["ocean", "underwater", "aquatic"],
  },
  {
    itemId: "shop_bg_neon_city",
    name: "Neon Metropolis",
    description: "A cyberpunk city with neon lights",
    slot: "background",
    rarity: "epic",
    imagePath: "🌃",
    priceTokens: 850,
    tags: ["cyberpunk", "neon", "city"],
  },
  {
    itemId: "shop_bg_cherry_blossom",
    name: "Cherry Blossom Garden",
    description: "Peaceful Japanese garden in spring",
    slot: "background",
    rarity: "rare",
    imagePath: "🌸",
    priceTokens: 450,
    tags: ["japan", "spring", "peaceful"],
  },
  {
    itemId: "shop_bg_volcano",
    name: "Volcanic Realm",
    description: "Dramatic lava flows and volcanic terrain",
    slot: "background",
    rarity: "epic",
    imagePath: "🌋",
    priceTokens: 800,
    tags: ["volcano", "fire", "dramatic"],
  },
  {
    itemId: "shop_bg_clouds",
    name: "Above the Clouds",
    description: "Floating peacefully in the sky",
    slot: "background",
    rarity: "common",
    imagePath: "☁️",
    priceTokens: 225,
    tags: ["sky", "clouds", "serene"],
  },
  {
    itemId: "shop_bg_rainbow",
    name: "Rainbow Road",
    description: "A colorful rainbow pathway",
    slot: "background",
    rarity: "rare",
    imagePath: "🌈",
    priceTokens: 520,
    tags: ["rainbow", "colorful", "whimsical"],
  },
  {
    itemId: "shop_bg_haunted",
    name: "Haunted Mansion",
    description: "Spooky gothic architecture at night",
    slot: "background",
    rarity: "rare",
    imagePath: "🏚️",
    priceTokens: 480,
    tags: ["spooky", "halloween", "gothic"],
  },
  {
    itemId: "shop_bg_crystal_cave",
    name: "Crystal Cavern",
    description: "A cave filled with glowing crystals",
    slot: "background",
    rarity: "epic",
    imagePath: "💎",
    priceTokens: 920,
    tags: ["crystal", "cave", "magical"],
  },
  {
    itemId: "shop_bg_dimension",
    name: "Dimensional Rift",
    description: "A tear in the fabric of reality",
    slot: "background",
    rarity: "legendary",
    imagePath: "🌀",
    priceTokens: 2000,
    tags: ["dimension", "cosmic", "premium"],
    featured: true,
  },
];

// =============================================================================
// Clothing Tops (12 items)
// =============================================================================

const CLOTHING_TOPS: ShopItemTemplate[] = [
  {
    itemId: "shop_top_hoodie_classic",
    name: "Cozy Hoodie",
    description: "A comfortable everyday hoodie",
    slot: "clothing_top",
    rarity: "common",
    imagePath: "🧥",
    priceTokens: 150,
    tags: ["casual", "comfy", "everyday"],
  },
  {
    itemId: "shop_top_suit",
    name: "Business Suit",
    description: "Professional attire for formal occasions",
    slot: "clothing_top",
    rarity: "rare",
    imagePath: "🤵",
    priceTokens: 400,
    tags: ["formal", "business", "professional"],
  },
  {
    itemId: "shop_top_leather_jacket",
    name: "Leather Jacket",
    description: "Classic rebel style",
    slot: "clothing_top",
    rarity: "rare",
    imagePath: "🧥",
    priceTokens: 450,
    tags: ["cool", "edgy", "classic"],
  },
  {
    itemId: "shop_top_kimono",
    name: "Elegant Kimono",
    description: "Traditional Japanese garment",
    slot: "clothing_top",
    rarity: "rare",
    imagePath: "👘",
    priceTokens: 520,
    tags: ["japanese", "traditional", "elegant"],
  },
  {
    itemId: "shop_top_armor",
    name: "Knight's Armor",
    description: "Medieval plate armor chest piece",
    slot: "clothing_top",
    rarity: "epic",
    imagePath: "⚔️",
    priceTokens: 850,
    tags: ["medieval", "armor", "warrior"],
  },
  {
    itemId: "shop_top_space_suit",
    name: "Space Suit",
    description: "Official astronaut gear",
    slot: "clothing_top",
    rarity: "epic",
    imagePath: "🧑‍🚀",
    priceTokens: 900,
    tags: ["space", "astronaut", "sci-fi"],
  },
  {
    itemId: "shop_top_hawaiian",
    name: "Hawaiian Shirt",
    description: "Tropical vibes all year round",
    slot: "clothing_top",
    rarity: "common",
    imagePath: "👕",
    priceTokens: 180,
    tags: ["tropical", "summer", "casual"],
  },
  {
    itemId: "shop_top_jersey",
    name: "Sports Jersey",
    description: "Show your team spirit",
    slot: "clothing_top",
    rarity: "common",
    imagePath: "🏀",
    priceTokens: 160,
    tags: ["sports", "athletic", "team"],
  },
  {
    itemId: "shop_top_tuxedo",
    name: "Golden Tuxedo",
    description: "Luxurious gold-threaded formal wear",
    slot: "clothing_top",
    rarity: "legendary",
    imagePath: "✨",
    priceTokens: 1600,
    tags: ["luxury", "formal", "gold"],
  },
  {
    itemId: "shop_top_lab_coat",
    name: "Lab Coat",
    description: "For the mad scientists",
    slot: "clothing_top",
    rarity: "common",
    imagePath: "🥼",
    priceTokens: 175,
    tags: ["science", "professional", "smart"],
  },
  {
    itemId: "shop_top_superhero",
    name: "Hero Cape & Suit",
    description: "Time to save the world",
    slot: "clothing_top",
    rarity: "epic",
    imagePath: "🦸",
    priceTokens: 1000,
    tags: ["superhero", "cape", "heroic"],
    featured: true,
  },
  {
    itemId: "shop_top_medieval_robe",
    name: "Wizard Robe",
    description: "Flowing robes with arcane symbols",
    slot: "clothing_top",
    rarity: "rare",
    imagePath: "🧙",
    priceTokens: 550,
    tags: ["magic", "wizard", "fantasy"],
  },
];

// =============================================================================
// Clothing Bottoms (10 items)
// =============================================================================

const CLOTHING_BOTTOMS: ShopItemTemplate[] = [
  {
    itemId: "shop_bottom_jeans",
    name: "Classic Jeans",
    description: "Timeless denim for any occasion",
    slot: "clothing_bottom",
    rarity: "common",
    imagePath: "👖",
    priceTokens: 120,
    tags: ["casual", "denim", "classic"],
  },
  {
    itemId: "shop_bottom_shorts",
    name: "Summer Shorts",
    description: "Cool and comfortable",
    slot: "clothing_bottom",
    rarity: "common",
    imagePath: "🩳",
    priceTokens: 100,
    tags: ["summer", "casual", "comfy"],
  },
  {
    itemId: "shop_bottom_suit_pants",
    name: "Formal Trousers",
    description: "Professional dress pants",
    slot: "clothing_bottom",
    rarity: "rare",
    imagePath: "👔",
    priceTokens: 350,
    tags: ["formal", "business", "professional"],
  },
  {
    itemId: "shop_bottom_cargo",
    name: "Cargo Pants",
    description: "Lots of pockets for adventure",
    slot: "clothing_bottom",
    rarity: "common",
    imagePath: "🎒",
    priceTokens: 140,
    tags: ["adventure", "utility", "casual"],
  },
  {
    itemId: "shop_bottom_skirt",
    name: "Pleated Skirt",
    description: "Elegant pleated design",
    slot: "clothing_bottom",
    rarity: "common",
    imagePath: "👗",
    priceTokens: 130,
    tags: ["elegant", "fashion", "cute"],
  },
  {
    itemId: "shop_bottom_armor",
    name: "Plate Greaves",
    description: "Medieval leg armor",
    slot: "clothing_bottom",
    rarity: "epic",
    imagePath: "⚔️",
    priceTokens: 800,
    tags: ["medieval", "armor", "warrior"],
  },
  {
    itemId: "shop_bottom_track",
    name: "Track Pants",
    description: "Athletic wear for champions",
    slot: "clothing_bottom",
    rarity: "common",
    imagePath: "🏃",
    priceTokens: 110,
    tags: ["athletic", "sports", "comfy"],
  },
  {
    itemId: "shop_bottom_kimono",
    name: "Hakama Pants",
    description: "Traditional Japanese pleated pants",
    slot: "clothing_bottom",
    rarity: "rare",
    imagePath: "👘",
    priceTokens: 420,
    tags: ["japanese", "traditional", "elegant"],
  },
  {
    itemId: "shop_bottom_glow",
    name: "Neon Pants",
    description: "Pants that glow in the dark",
    slot: "clothing_bottom",
    rarity: "epic",
    imagePath: "✨",
    priceTokens: 750,
    tags: ["neon", "glow", "party"],
  },
  {
    itemId: "shop_bottom_royal",
    name: "Royal Robes",
    description: "Flowing royal lower garments",
    slot: "clothing_bottom",
    rarity: "legendary",
    imagePath: "👑",
    priceTokens: 1500,
    tags: ["royal", "elegant", "premium"],
  },
];

// =============================================================================
// Neck Accessories (8 items)
// =============================================================================

const NECK_ACCESSORIES: ShopItemTemplate[] = [
  {
    itemId: "shop_neck_scarf",
    name: "Cozy Scarf",
    description: "Warm and stylish winter scarf",
    slot: "accessory_neck",
    rarity: "common",
    imagePath: "🧣",
    priceTokens: 125,
    tags: ["winter", "cozy", "fashion"],
  },
  {
    itemId: "shop_neck_tie",
    name: "Silk Necktie",
    description: "Professional silk tie",
    slot: "accessory_neck",
    rarity: "common",
    imagePath: "👔",
    priceTokens: 100,
    tags: ["formal", "business", "classic"],
  },
  {
    itemId: "shop_neck_bowtie",
    name: "Fancy Bowtie",
    description: "Distinguished bowtie for special occasions",
    slot: "accessory_neck",
    rarity: "rare",
    imagePath: "🎀",
    priceTokens: 300,
    tags: ["formal", "fancy", "cute"],
  },
  {
    itemId: "shop_neck_chain",
    name: "Gold Chain",
    description: "Chunky gold chain necklace",
    slot: "accessory_neck",
    rarity: "rare",
    imagePath: "⛓️",
    priceTokens: 450,
    tags: ["bling", "gold", "stylish"],
  },
  {
    itemId: "shop_neck_pendant",
    name: "Crystal Pendant",
    description: "Glowing crystal on a silver chain",
    slot: "accessory_neck",
    rarity: "epic",
    imagePath: "💎",
    priceTokens: 800,
    tags: ["crystal", "magical", "elegant"],
  },
  {
    itemId: "shop_neck_lei",
    name: "Tropical Lei",
    description: "Hawaiian flower garland",
    slot: "accessory_neck",
    rarity: "common",
    imagePath: "🌺",
    priceTokens: 150,
    tags: ["tropical", "summer", "fun"],
  },
  {
    itemId: "shop_neck_medal",
    name: "Champion Medal",
    description: "A gold medal for winners",
    slot: "accessory_neck",
    rarity: "epic",
    imagePath: "🏅",
    priceTokens: 750,
    tags: ["champion", "winner", "gold"],
  },
  {
    itemId: "shop_neck_legendary",
    name: "Dragon Amulet",
    description: "Ancient amulet with dragon power",
    slot: "accessory_neck",
    rarity: "legendary",
    imagePath: "🐉",
    priceTokens: 1800,
    tags: ["dragon", "magical", "ancient"],
  },
];

// =============================================================================
// Ear Accessories (8 items)
// =============================================================================

const EAR_ACCESSORIES: ShopItemTemplate[] = [
  {
    itemId: "shop_ear_studs",
    name: "Diamond Studs",
    description: "Classic diamond earrings",
    slot: "accessory_ear",
    rarity: "rare",
    imagePath: "💎",
    priceTokens: 400,
    tags: ["elegant", "diamond", "classic"],
  },
  {
    itemId: "shop_ear_hoops",
    name: "Gold Hoops",
    description: "Large golden hoop earrings",
    slot: "accessory_ear",
    rarity: "common",
    imagePath: "⭕",
    priceTokens: 180,
    tags: ["gold", "fashion", "stylish"],
  },
  {
    itemId: "shop_ear_pods",
    name: "Wireless Earbuds",
    description: "Always connected to the beat",
    slot: "accessory_ear",
    rarity: "common",
    imagePath: "🎧",
    priceTokens: 150,
    tags: ["tech", "music", "modern"],
  },
  {
    itemId: "shop_ear_feather",
    name: "Feather Earrings",
    description: "Bohemian feather accessories",
    slot: "accessory_ear",
    rarity: "common",
    imagePath: "🪶",
    priceTokens: 125,
    tags: ["boho", "feather", "natural"],
  },
  {
    itemId: "shop_ear_star",
    name: "Starlight Dangles",
    description: "Dangling star-shaped earrings",
    slot: "accessory_ear",
    rarity: "rare",
    imagePath: "⭐",
    priceTokens: 350,
    tags: ["star", "celestial", "sparkly"],
  },
  {
    itemId: "shop_ear_moon",
    name: "Moon Phase Earrings",
    description: "Crescent moon with glow effect",
    slot: "accessory_ear",
    rarity: "epic",
    imagePath: "🌙",
    priceTokens: 750,
    tags: ["moon", "celestial", "magical"],
  },
  {
    itemId: "shop_ear_spike",
    name: "Punk Spikes",
    description: "Edgy spike earrings",
    slot: "accessory_ear",
    rarity: "rare",
    imagePath: "⚡",
    priceTokens: 320,
    tags: ["punk", "edgy", "cool"],
  },
  {
    itemId: "shop_ear_galaxy",
    name: "Galaxy Orbs",
    description: "Miniature galaxies as earrings",
    slot: "accessory_ear",
    rarity: "legendary",
    imagePath: "🌌",
    priceTokens: 1600,
    tags: ["galaxy", "cosmic", "premium"],
  },
];

// =============================================================================
// Hand Accessories (8 items)
// =============================================================================

const HAND_ACCESSORIES: ShopItemTemplate[] = [
  {
    itemId: "shop_hand_watch",
    name: "Classic Watch",
    description: "Elegant timepiece",
    slot: "accessory_hand",
    rarity: "common",
    imagePath: "⌚",
    priceTokens: 175,
    tags: ["classic", "time", "elegant"],
  },
  {
    itemId: "shop_hand_smartwatch",
    name: "Smart Watch",
    description: "High-tech wrist computer",
    slot: "accessory_hand",
    rarity: "rare",
    imagePath: "⌚",
    priceTokens: 400,
    tags: ["tech", "smart", "modern"],
  },
  {
    itemId: "shop_hand_bracelet",
    name: "Charm Bracelet",
    description: "Bracelet with dangling charms",
    slot: "accessory_hand",
    rarity: "common",
    imagePath: "📿",
    priceTokens: 150,
    tags: ["cute", "charms", "casual"],
  },
  {
    itemId: "shop_hand_gloves",
    name: "Elegant Gloves",
    description: "Formal satin gloves",
    slot: "accessory_hand",
    rarity: "rare",
    imagePath: "🧤",
    priceTokens: 350,
    tags: ["formal", "elegant", "fancy"],
  },
  {
    itemId: "shop_hand_gauntlet",
    name: "Battle Gauntlet",
    description: "Armored warrior gloves",
    slot: "accessory_hand",
    rarity: "epic",
    imagePath: "🤜",
    priceTokens: 800,
    tags: ["armor", "warrior", "epic"],
  },
  {
    itemId: "shop_hand_rings",
    name: "Stacked Rings",
    description: "Multiple rings for maximum style",
    slot: "accessory_hand",
    rarity: "common",
    imagePath: "💍",
    priceTokens: 125,
    tags: ["rings", "fashion", "stylish"],
  },
  {
    itemId: "shop_hand_power",
    name: "Power Glove",
    description: "Retro gaming power glove",
    slot: "accessory_hand",
    rarity: "epic",
    imagePath: "🎮",
    priceTokens: 900,
    tags: ["retro", "gaming", "fun"],
  },
  {
    itemId: "shop_hand_infinity",
    name: "Infinity Gauntlet",
    description: "All the power in your hand",
    slot: "accessory_hand",
    rarity: "legendary",
    imagePath: "✨",
    priceTokens: 2500,
    tags: ["power", "legendary", "premium"],
    featured: true,
  },
];

// =============================================================================
// Profile Frames (10 items)
// =============================================================================

const PROFILE_FRAMES: ShopItemTemplate[] = [
  {
    itemId: "shop_frame_gold",
    name: "Golden Frame",
    description: "Luxurious gold border",
    slot: "profile_frame",
    rarity: "rare",
    imagePath: "🖼️",
    priceTokens: 500,
    tags: ["gold", "luxury", "elegant"],
  },
  {
    itemId: "shop_frame_neon",
    name: "Neon Glow Frame",
    description: "Animated neon border",
    slot: "profile_frame",
    rarity: "epic",
    imagePath: "💡",
    priceTokens: 850,
    tags: ["neon", "animated", "glowing"],
  },
  {
    itemId: "shop_frame_fire",
    name: "Blazing Frame",
    description: "Animated fire border",
    slot: "profile_frame",
    rarity: "epic",
    imagePath: "🔥",
    priceTokens: 950,
    tags: ["fire", "animated", "hot"],
    featured: true,
  },
  {
    itemId: "shop_frame_ice",
    name: "Frozen Frame",
    description: "Icy crystal border",
    slot: "profile_frame",
    rarity: "epic",
    imagePath: "❄️",
    priceTokens: 900,
    tags: ["ice", "crystal", "cool"],
  },
  {
    itemId: "shop_frame_pixel",
    name: "Pixel Art Frame",
    description: "Retro 8-bit border",
    slot: "profile_frame",
    rarity: "rare",
    imagePath: "👾",
    priceTokens: 400,
    tags: ["retro", "pixel", "8bit"],
  },
  {
    itemId: "shop_frame_flower",
    name: "Floral Frame",
    description: "Beautiful flower border",
    slot: "profile_frame",
    rarity: "common",
    imagePath: "🌸",
    priceTokens: 250,
    tags: ["floral", "nature", "cute"],
  },
  {
    itemId: "shop_frame_star",
    name: "Starlight Frame",
    description: "Twinkling star border",
    slot: "profile_frame",
    rarity: "rare",
    imagePath: "⭐",
    priceTokens: 450,
    tags: ["stars", "sparkly", "celestial"],
  },
  {
    itemId: "shop_frame_rainbow",
    name: "Rainbow Frame",
    description: "Colorful rainbow border",
    slot: "profile_frame",
    rarity: "rare",
    imagePath: "🌈",
    priceTokens: 480,
    tags: ["rainbow", "colorful", "pride"],
  },
  {
    itemId: "shop_frame_galaxy",
    name: "Galaxy Frame",
    description: "Swirling cosmic border",
    slot: "profile_frame",
    rarity: "legendary",
    imagePath: "🌌",
    priceTokens: 1800,
    tags: ["galaxy", "cosmic", "premium"],
  },
  {
    itemId: "shop_frame_basic",
    name: "Simple Frame",
    description: "Clean minimal border",
    slot: "profile_frame",
    rarity: "common",
    imagePath: "⬜",
    priceTokens: 100,
    tags: ["simple", "minimal", "clean"],
  },
];

// =============================================================================
// Profile Banners (10 items)
// =============================================================================

const PROFILE_BANNERS: ShopItemTemplate[] = [
  {
    itemId: "shop_banner_sunset",
    name: "Sunset Banner",
    description: "Beautiful orange sunset gradient",
    slot: "profile_banner",
    rarity: "common",
    imagePath: "🌅",
    priceTokens: 200,
    tags: ["sunset", "gradient", "warm"],
  },
  {
    itemId: "shop_banner_ocean",
    name: "Ocean Wave Banner",
    description: "Animated ocean waves",
    slot: "profile_banner",
    rarity: "rare",
    imagePath: "🌊",
    priceTokens: 450,
    tags: ["ocean", "waves", "animated"],
  },
  {
    itemId: "shop_banner_space",
    name: "Space Banner",
    description: "Deep space with stars",
    slot: "profile_banner",
    rarity: "rare",
    imagePath: "🚀",
    priceTokens: 500,
    tags: ["space", "stars", "cosmic"],
  },
  {
    itemId: "shop_banner_neon",
    name: "Neon City Banner",
    description: "Cyberpunk neon cityscape",
    slot: "profile_banner",
    rarity: "epic",
    imagePath: "🌃",
    priceTokens: 800,
    tags: ["neon", "cyberpunk", "city"],
  },
  {
    itemId: "shop_banner_forest",
    name: "Forest Banner",
    description: "Peaceful forest scenery",
    slot: "profile_banner",
    rarity: "common",
    imagePath: "🌲",
    priceTokens: 225,
    tags: ["forest", "nature", "peaceful"],
  },
  {
    itemId: "shop_banner_fire",
    name: "Inferno Banner",
    description: "Raging fire animation",
    slot: "profile_banner",
    rarity: "epic",
    imagePath: "🔥",
    priceTokens: 850,
    tags: ["fire", "animated", "intense"],
  },
  {
    itemId: "shop_banner_music",
    name: "Music Wave Banner",
    description: "Animated sound wave visualization",
    slot: "profile_banner",
    rarity: "rare",
    imagePath: "🎵",
    priceTokens: 480,
    tags: ["music", "wave", "animated"],
  },
  {
    itemId: "shop_banner_abstract",
    name: "Abstract Art Banner",
    description: "Colorful abstract patterns",
    slot: "profile_banner",
    rarity: "rare",
    imagePath: "🎨",
    priceTokens: 420,
    tags: ["art", "abstract", "colorful"],
  },
  {
    itemId: "shop_banner_aurora",
    name: "Aurora Banner",
    description: "Shimmering northern lights",
    slot: "profile_banner",
    rarity: "epic",
    imagePath: "🌌",
    priceTokens: 920,
    tags: ["aurora", "animated", "magical"],
    featured: true,
  },
  {
    itemId: "shop_banner_dragon",
    name: "Dragon Banner",
    description: "Epic dragon flying through clouds",
    slot: "profile_banner",
    rarity: "legendary",
    imagePath: "🐉",
    priceTokens: 2000,
    tags: ["dragon", "epic", "premium"],
  },
];

// =============================================================================
// Profile Themes (6 items)
// =============================================================================

const PROFILE_THEMES: ShopItemTemplate[] = [
  {
    itemId: "shop_theme_midnight",
    name: "Midnight Theme",
    description: "Deep purple and blue dark theme",
    slot: "profile_theme",
    rarity: "rare",
    imagePath: "🌙",
    priceTokens: 600,
    tags: ["dark", "purple", "elegant"],
  },
  {
    itemId: "shop_theme_sunrise",
    name: "Sunrise Theme",
    description: "Warm orange and pink light theme",
    slot: "profile_theme",
    rarity: "rare",
    imagePath: "🌅",
    priceTokens: 550,
    tags: ["light", "warm", "cheerful"],
  },
  {
    itemId: "shop_theme_cyber",
    name: "Cyberpunk Theme",
    description: "Neon pink and cyan colors",
    slot: "profile_theme",
    rarity: "epic",
    imagePath: "💜",
    priceTokens: 900,
    tags: ["cyberpunk", "neon", "futuristic"],
  },
  {
    itemId: "shop_theme_nature",
    name: "Forest Theme",
    description: "Earthy greens and browns",
    slot: "profile_theme",
    rarity: "rare",
    imagePath: "🌿",
    priceTokens: 500,
    tags: ["nature", "green", "peaceful"],
  },
  {
    itemId: "shop_theme_royal",
    name: "Royal Theme",
    description: "Gold and purple luxury colors",
    slot: "profile_theme",
    rarity: "epic",
    imagePath: "👑",
    priceTokens: 1000,
    tags: ["royal", "luxury", "gold"],
  },
  {
    itemId: "shop_theme_galaxy",
    name: "Galaxy Theme",
    description: "Cosmic space colors with stars",
    slot: "profile_theme",
    rarity: "legendary",
    imagePath: "🌌",
    priceTokens: 1500,
    tags: ["galaxy", "cosmic", "premium"],
  },
];

// =============================================================================
// Chat Bubbles (10 items)
// =============================================================================

const CHAT_BUBBLES: ShopItemTemplate[] = [
  {
    itemId: "shop_bubble_gradient",
    name: "Gradient Bubble",
    description: "Smooth color gradient background",
    slot: "chat_bubble",
    rarity: "common",
    imagePath: "💬",
    priceTokens: 150,
    tags: ["gradient", "colorful", "smooth"],
  },
  {
    itemId: "shop_bubble_pixel",
    name: "Pixel Bubble",
    description: "Retro 8-bit style bubble",
    slot: "chat_bubble",
    rarity: "rare",
    imagePath: "👾",
    priceTokens: 350,
    tags: ["retro", "pixel", "8bit"],
  },
  {
    itemId: "shop_bubble_neon",
    name: "Neon Bubble",
    description: "Glowing neon outline",
    slot: "chat_bubble",
    rarity: "rare",
    imagePath: "💡",
    priceTokens: 400,
    tags: ["neon", "glow", "cyberpunk"],
  },
  {
    itemId: "shop_bubble_fire",
    name: "Fire Bubble",
    description: "Flames around your messages",
    slot: "chat_bubble",
    rarity: "epic",
    imagePath: "🔥",
    priceTokens: 750,
    tags: ["fire", "animated", "hot"],
  },
  {
    itemId: "shop_bubble_ice",
    name: "Ice Bubble",
    description: "Frozen crystal appearance",
    slot: "chat_bubble",
    rarity: "epic",
    imagePath: "❄️",
    priceTokens: 700,
    tags: ["ice", "crystal", "cool"],
  },
  {
    itemId: "shop_bubble_hearts",
    name: "Hearts Bubble",
    description: "Surrounded by floating hearts",
    slot: "chat_bubble",
    rarity: "common",
    imagePath: "💕",
    priceTokens: 175,
    tags: ["hearts", "love", "cute"],
  },
  {
    itemId: "shop_bubble_space",
    name: "Space Bubble",
    description: "Galaxy pattern background",
    slot: "chat_bubble",
    rarity: "rare",
    imagePath: "🚀",
    priceTokens: 450,
    tags: ["space", "galaxy", "cosmic"],
  },
  {
    itemId: "shop_bubble_rainbow",
    name: "Rainbow Bubble",
    description: "Full spectrum colors",
    slot: "chat_bubble",
    rarity: "rare",
    imagePath: "🌈",
    priceTokens: 420,
    tags: ["rainbow", "colorful", "pride"],
  },
  {
    itemId: "shop_bubble_gold",
    name: "Golden Bubble",
    description: "Luxurious gold finish",
    slot: "chat_bubble",
    rarity: "epic",
    imagePath: "✨",
    priceTokens: 850,
    tags: ["gold", "luxury", "premium"],
  },
  {
    itemId: "shop_bubble_hologram",
    name: "Hologram Bubble",
    description: "Futuristic holographic effect",
    slot: "chat_bubble",
    rarity: "legendary",
    imagePath: "🔮",
    priceTokens: 1600,
    tags: ["hologram", "futuristic", "premium"],
    featured: true,
  },
];

// =============================================================================
// Name Effects (8 items)
// =============================================================================

const NAME_EFFECTS: ShopItemTemplate[] = [
  {
    itemId: "shop_name_rainbow",
    name: "Rainbow Name",
    description: "Your name cycles through colors",
    slot: "name_effect",
    rarity: "rare",
    imagePath: "🌈",
    priceTokens: 500,
    tags: ["rainbow", "animated", "colorful"],
  },
  {
    itemId: "shop_name_fire",
    name: "Blazing Name",
    description: "Your name burns with flames",
    slot: "name_effect",
    rarity: "epic",
    imagePath: "🔥",
    priceTokens: 900,
    tags: ["fire", "animated", "hot"],
  },
  {
    itemId: "shop_name_sparkle",
    name: "Sparkle Name",
    description: "Twinkling sparkles around your name",
    slot: "name_effect",
    rarity: "common",
    imagePath: "✨",
    priceTokens: 250,
    tags: ["sparkle", "animated", "pretty"],
  },
  {
    itemId: "shop_name_glow",
    name: "Neon Glow Name",
    description: "Your name glows neon",
    slot: "name_effect",
    rarity: "rare",
    imagePath: "💡",
    priceTokens: 450,
    tags: ["neon", "glow", "cyberpunk"],
  },
  {
    itemId: "shop_name_gradient",
    name: "Gradient Name",
    description: "Smooth color gradient text",
    slot: "name_effect",
    rarity: "common",
    imagePath: "🎨",
    priceTokens: 200,
    tags: ["gradient", "colorful", "stylish"],
  },
  {
    itemId: "shop_name_shadow",
    name: "Shadow Name",
    description: "Dark shadow effect behind text",
    slot: "name_effect",
    rarity: "rare",
    imagePath: "👤",
    priceTokens: 380,
    tags: ["shadow", "dark", "mysterious"],
  },
  {
    itemId: "shop_name_gold",
    name: "Golden Name",
    description: "Shimmering gold text",
    slot: "name_effect",
    rarity: "epic",
    imagePath: "🏆",
    priceTokens: 800,
    tags: ["gold", "luxury", "premium"],
  },
  {
    itemId: "shop_name_cosmic",
    name: "Cosmic Name",
    description: "Your name contains the universe",
    slot: "name_effect",
    rarity: "legendary",
    imagePath: "🌌",
    priceTokens: 1800,
    tags: ["cosmic", "galaxy", "premium"],
    featured: true,
  },
];

// =============================================================================
// Combined Catalog
// =============================================================================

/**
 * Convert template to full PointsShopItem
 */
function templateToItem(
  template: ShopItemTemplate,
  index: number,
): PointsShopItem {
  return {
    id: template.itemId,
    itemId: template.itemId,
    name: template.name,
    description: template.description,
    slot: template.slot,
    rarity: template.rarity,
    imagePath: template.imagePath,
    priceTokens: template.priceTokens,
    originalPrice: template.originalPrice,
    discountPercent: template.discountPercent,
    featured: template.featured || false,
    sortOrder: index,
    tags: template.tags,
    shopExclusive: true,
    active: true,
  };
}

/**
 * All shop exclusive items
 */
export const SHOP_EXCLUSIVE_ITEMS: PointsShopItem[] = [
  ...HATS.map((t, i) => templateToItem(t, i)),
  ...GLASSES.map((t, i) => templateToItem(t, i + 100)),
  ...BACKGROUNDS.map((t, i) => templateToItem(t, i + 200)),
  ...CLOTHING_TOPS.map((t, i) => templateToItem(t, i + 300)),
  ...CLOTHING_BOTTOMS.map((t, i) => templateToItem(t, i + 400)),
  ...NECK_ACCESSORIES.map((t, i) => templateToItem(t, i + 500)),
  ...EAR_ACCESSORIES.map((t, i) => templateToItem(t, i + 600)),
  ...HAND_ACCESSORIES.map((t, i) => templateToItem(t, i + 700)),
  ...PROFILE_FRAMES.map((t, i) => templateToItem(t, i + 800)),
  ...PROFILE_BANNERS.map((t, i) => templateToItem(t, i + 900)),
  ...PROFILE_THEMES.map((t, i) => templateToItem(t, i + 1000)),
  ...CHAT_BUBBLES.map((t, i) => templateToItem(t, i + 1100)),
  ...NAME_EFFECTS.map((t, i) => templateToItem(t, i + 1200)),
];

/**
 * Featured items from the catalog
 */
export const FEATURED_ITEMS: PointsShopItem[] = SHOP_EXCLUSIVE_ITEMS.filter(
  (item) => item.featured,
);

/**
 * Get items by slot
 */
export function getItemsBySlot(slot: ExtendedCosmeticSlot): PointsShopItem[] {
  return SHOP_EXCLUSIVE_ITEMS.filter((item) => item.slot === slot);
}

/**
 * Get items by rarity
 */
export function getItemsByRarity(
  rarity: ExtendedCosmeticRarity,
): PointsShopItem[] {
  return SHOP_EXCLUSIVE_ITEMS.filter((item) => item.rarity === rarity);
}

/**
 * Get item count statistics
 */
export function getItemStats(): {
  total: number;
  byRarity: Record<string, number>;
  bySlot: Record<string, number>;
} {
  const byRarity: Record<string, number> = {};
  const bySlot: Record<string, number> = {};

  SHOP_EXCLUSIVE_ITEMS.forEach((item) => {
    byRarity[item.rarity] = (byRarity[item.rarity] || 0) + 1;
    bySlot[item.slot] = (bySlot[item.slot] || 0) + 1;
  });

  return {
    total: SHOP_EXCLUSIVE_ITEMS.length,
    byRarity,
    bySlot,
  };
}

// Log stats in development
if (__DEV__) {
  const stats = getItemStats();
  console.log("[shopExclusiveItems] Loaded shop catalog:", stats);
}
