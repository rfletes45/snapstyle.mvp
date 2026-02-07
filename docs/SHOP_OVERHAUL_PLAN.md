# Shop Screen Overhaul Plan

## Document Metadata

- **Created:** 2026-02-01
- **Status:** Planning
- **Priority:** High
- **Estimated Effort:** 3-4 Weeks
- **Dependencies:** Profile Screen Overhaul (Complete)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Screen Structure](#4-screen-structure)
5. [Customization Categories](#5-customization-categories)
6. [Points Shop Implementation](#6-points-shop-implementation)
7. [Premium Shop Implementation](#7-premium-shop-implementation)
8. [IAP Integration Guide](#8-iap-integration-guide)
9. [Shop-Exclusive Items](#9-shop-exclusive-items)
10. [Additional Features](#10-additional-features)
11. [Data Models](#11-data-models)
12. [API Specifications](#12-api-specifications)
13. [Security Rules](#13-security-rules)
14. [UI/UX Specifications](#14-uiux-specifications)
15. [Implementation Phases](#15-implementation-phases)
16. [Testing Strategy](#16-testing-strategy)

---

## 1. Executive Summary

### 1.1 Goals

```yaml
PRIMARY_GOALS:
  - Separate points shop from premium shop into distinct screens
  - Implement all customization categories with shop-exclusive items
  - Integrate Apple App Store and Google Play billing
  - Create intuitive navigation between shop sections
  - Ensure items are EXCLUSIVE to shop (not obtainable via achievements/milestones)

SECONDARY_GOALS:
  - Add gifting system for premium items
  - Implement sales and limited-time offers
  - Add wishlist functionality
  - Create bundle deals
  - Add preview system for all items
```

### 1.2 Key Principles

```yaml
EXCLUSIVITY:
  - Shop items CANNOT be obtained through achievements
  - Shop items CANNOT be obtained through milestones
  - Shop items CANNOT be obtained through daily tasks
  - Clear visual distinction between shop-exclusive and earnable items

SEPARATION:
  - Points Shop: Virtual currency (tokens) only
  - Premium Shop: Real money (IAP) only
  - NO mixing of currencies in single transactions

USER_EXPERIENCE:
  - Easy navigation between shop types
  - Clear pricing display
  - Preview before purchase
  - Purchase confirmation
  - Receipt/transaction history
```

---

## 2. Current State Analysis

### 2.1 Existing Shop Implementation

```yaml
CURRENT_FILES:
  - src/screens/shop/ShopScreen.tsx # Basic shop (tokens only)
  - src/screens/shop/ShopScreenV2.tsx # Enhanced with bundles/IAP
  - src/services/shop.ts # Shop service
  - src/services/iap.ts # IAP service (mock in dev)
  - src/services/economy.ts # Wallet/tokens
  - src/services/bundles.ts # Bundle service

CURRENT_FEATURES:
  - Featured items carousel
  - Category filtering (hat, glasses, background)
  - Token-based purchases
  - Real-time catalog updates
  - Owned item indicators
  - Mock IAP (not production-ready)

CURRENT_LIMITATIONS:
  - Single screen for all items (cluttered)
  - IAP not fully implemented
  - Missing many cosmetic categories
  - Items NOT shop-exclusive (overlap with achievements)
  - No gifting system
  - No wishlist
  - No purchase history UI
```

### 2.2 Existing Customization System

```yaml
COSMETIC_SLOTS_IMPLEMENTED:
  avatar:
    - hat
    - glasses
    - background
    - clothing_top
    - clothing_bottom
    - accessory_neck
    - accessory_ear
    - accessory_hand

  profile:
    - profile_frame
    - profile_banner
    - profile_theme

  chat:
    - chat_bubble
    - name_effect

UNLOCK_TYPES_CURRENT:
  - starter # Given to all users
  - free # Available to all
  - milestone # Streak-based unlocks
  - achievement # Achievement-based unlocks
  - purchase # Token purchase
  - exclusive # Special events
```

---

## 3. Architecture Overview

### 3.1 Navigation Structure

```
RootNavigator
└── ProfileStack
    ├── ProfileScreen
    │   └── [Navigate to Shop]
    │
    └── ShopNavigator (NEW - Tab Navigator)
        ├── PointsShopScreen      # Virtual currency shop
        │   ├── AvatarItemsTab
        │   ├── ProfileItemsTab
        │   └── ChatItemsTab
        │
        └── PremiumShopScreen     # Real money shop
            ├── TokenPacksTab
            ├── BundlesTab
            ├── ExclusivesTab
            └── GiftingTab
```

### 3.2 Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Shop Services                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Points Shop     │    │  Premium Shop    │                   │
│  │  Service         │    │  Service         │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Economy Service │    │  IAP Service     │                   │
│  │  (Tokens)        │    │  (Real Money)    │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Firestore       │    │  App Store /     │                   │
│  │  (Wallets)       │    │  Play Store      │                   │
│  └──────────────────┘    └──────────────────┘                   │
│                                   │                              │
│                                   ▼                              │
│                          ┌──────────────────┐                   │
│                          │  Cloud Functions │                   │
│                          │  (Verification)  │                   │
│                          └──────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Screen Structure

### 4.1 Shop Hub Screen

```typescript
// src/screens/shop/ShopHubScreen.tsx

/**
 * SCREEN: ShopHubScreen
 * PURPOSE: Entry point to shop system with clear navigation to both shops
 *
 * LAYOUT:
 * ┌─────────────────────────────────────────┐
 * │  [←]        Shop                        │
 * ├─────────────────────────────────────────┤
 * │                                         │
 * │  ┌─────────────────────────────────────┐│
 * │  │     🪙 POINTS SHOP                  ││
 * │  │                                     ││
 * │  │  Spend your tokens on:             ││
 * │  │  • Avatar items                    ││
 * │  │  • Profile decorations            ││
 * │  │  • Chat customizations            ││
 * │  │                                     ││
 * │  │  Balance: 1,250 tokens            ││
 * │  │                                     ││
 * │  │        [Enter Shop →]              ││
 * │  └─────────────────────────────────────┘│
 * │                                         │
 * │  ┌─────────────────────────────────────┐│
 * │  │     💎 PREMIUM SHOP                 ││
 * │  │                                     ││
 * │  │  Exclusive items & bundles:        ││
 * │  │  • Token packs                     ││
 * │  │  • Premium bundles                 ││
 * │  │  • Limited exclusives             ││
 * │  │  • Gift items                      ││
 * │  │                                     ││
 * │  │        [Enter Shop →]              ││
 * │  └─────────────────────────────────────┘│
 * │                                         │
 * │  [View Purchase History]               │
 * │                                         │
 * └─────────────────────────────────────────┘
 */

interface ShopHubScreenProps {
  navigation: StackNavigationProp<ShopStackParamList, "ShopHub">;
}

// Navigation options for each shop
interface ShopOption {
  id: "points" | "premium";
  title: string;
  icon: string;
  description: string;
  features: string[];
  gradient: [string, string];
  onPress: () => void;
}
```

### 4.2 Points Shop Screen

```typescript
// src/screens/shop/PointsShopScreen.tsx

/**
 * SCREEN: PointsShopScreen
 * PURPOSE: Browse and purchase items with tokens (virtual currency)
 *
 * LAYOUT:
 * ┌─────────────────────────────────────────┐
 * │  [←]    Points Shop    🪙 1,250        │
 * ├─────────────────────────────────────────┤
 * │ [Avatar] [Profile] [Chat] [Effects]    │  ← Category Tabs
 * ├─────────────────────────────────────────┤
 * │                                         │
 * │  ═══ Featured Items ═══                │
 * │  ┌───────┐ ┌───────┐ ┌───────┐        │
 * │  │ SALE! │ │ NEW!  │ │ HOT!  │        │
 * │  │ 🎩    │ │ 👓    │ │ 🌟    │        │
 * │  │ 200🪙 │ │ 150🪙 │ │ 300🪙 │        │
 * │  └───────┘ └───────┘ └───────┘        │
 * │                                         │
 * │  ═══ Hats ═══                          │
 * │  ┌───────┐ ┌───────┐ ┌───────┐        │
 * │  │ 🎩    │ │ 👒    │ │ 🧢    │        │
 * │  │ 100🪙 │ │ 150🪙 │ │ 200🪙 │        │
 * │  └───────┘ └───────┘ └───────┘        │
 * │                                         │
 * │  ═══ Glasses ═══                       │
 * │  ┌───────┐ ┌───────┐ ┌───────┐        │
 * │  │ 👓    │ │ 🕶️    │ │ 🥽    │        │
 * │  │ 75🪙  │ │ 125🪙 │ │ 250🪙 │        │
 * │  └───────┘ └───────┘ └───────┘        │
 * │                                         │
 * └─────────────────────────────────────────┘
 *
 * TABS:
 * - Avatar: hat, glasses, background, clothing, accessories
 * - Profile: frames, banners, themes
 * - Chat: bubbles, name effects
 * - Effects: animations, particles (future)
 */

interface PointsShopScreenProps {
  navigation: StackNavigationProp<ShopStackParamList, "PointsShop">;
}

// Category tabs for points shop
type PointsShopTab = "avatar" | "profile" | "chat" | "effects";

// Sub-categories within each tab
interface CategoryConfig {
  tab: PointsShopTab;
  categories: {
    key: string;
    label: string;
    icon: string;
    slots: ExtendedCosmeticSlot[];
  }[];
}
```

### 4.3 Premium Shop Screen

```typescript
// src/screens/shop/PremiumShopScreen.tsx

/**
 * SCREEN: PremiumShopScreen
 * PURPOSE: Browse and purchase items with real money (IAP)
 *
 * LAYOUT:
 * ┌─────────────────────────────────────────┐
 * │  [←]    Premium Shop                    │
 * ├─────────────────────────────────────────┤
 * │ [Tokens] [Bundles] [Exclusives] [Gifts]│  ← Category Tabs
 * ├─────────────────────────────────────────┤
 * │                                         │
 * │  ═══ Token Packs ═══                   │
 * │  ┌─────────────────────────────────────┐│
 * │  │ 🪙 500 Tokens          $4.99       ││
 * │  └─────────────────────────────────────┘│
 * │  ┌─────────────────────────────────────┐│
 * │  │ 🪙 1,200 Tokens  ⭐    $9.99       ││
 * │  │    +200 BONUS!         BEST VALUE  ││
 * │  └─────────────────────────────────────┘│
 * │  ┌─────────────────────────────────────┐│
 * │  │ 🪙 2,500 Tokens        $19.99      ││
 * │  │    +500 BONUS!                      ││
 * │  └─────────────────────────────────────┘│
 * │                                         │
 * │  ═══ Premium Bundles ═══               │
 * │  ┌─────────────────────────────────────┐│
 * │  │ 🌟 Starter Pack        $2.99       ││
 * │  │ 5 items + 100 tokens               ││
 * │  └─────────────────────────────────────┘│
 * │                                         │
 * └─────────────────────────────────────────┘
 *
 * TABS:
 * - Tokens: Token pack purchases
 * - Bundles: Curated item bundles
 * - Exclusives: Premium-only items (cannot buy with tokens)
 * - Gifts: Purchase items for friends
 */

interface PremiumShopScreenProps {
  navigation: StackNavigationProp<ShopStackParamList, "PremiumShop">;
}

type PremiumShopTab = "tokens" | "bundles" | "exclusives" | "gifts";
```

---

## 5. Customization Categories

### 5.1 Complete Category Breakdown

```yaml
AVATAR_CUSTOMIZATIONS:
  hats:
    slot: "hat"
    description: "Headwear for your avatar"
    price_range_tokens: 50 - 500
    examples:
      - Baseball Cap (50 tokens)
      - Cowboy Hat (100 tokens)
      - Crown (300 tokens)
      - Wizard Hat (500 tokens)
    shop_exclusive_count: 15+

  glasses:
    slot: "glasses"
    description: "Eyewear and face accessories"
    price_range_tokens: 25 - 300
    examples:
      - Reading Glasses (25 tokens)
      - Sunglasses (75 tokens)
      - VR Headset (200 tokens)
      - Monocle (300 tokens)
    shop_exclusive_count: 12+

  backgrounds:
    slot: "background"
    description: "Avatar background patterns and colors"
    price_range_tokens: 75 - 400
    examples:
      - Solid Colors (75 tokens)
      - Gradients (150 tokens)
      - Patterns (250 tokens)
      - Animated (400 tokens)
    shop_exclusive_count: 20+

  clothing_tops:
    slot: "clothing_top"
    description: "Shirts, jackets, and upper body wear"
    price_range_tokens: 50 - 600
    examples:
      - T-Shirts (50 tokens)
      - Hoodies (150 tokens)
      - Suits (400 tokens)
      - Costumes (600 tokens)
    shop_exclusive_count: 25+

  clothing_bottoms:
    slot: "clothing_bottom"
    description: "Pants, shorts, and lower body wear"
    price_range_tokens: 50 - 400
    examples:
      - Jeans (50 tokens)
      - Shorts (75 tokens)
      - Formal Pants (200 tokens)
      - Costume Bottoms (400 tokens)
    shop_exclusive_count: 15+

  neck_accessories:
    slot: "accessory_neck"
    description: "Necklaces, scarves, ties"
    price_range_tokens: 25 - 250
    examples:
      - Simple Necklace (25 tokens)
      - Scarf (75 tokens)
      - Tie (100 tokens)
      - Gold Chain (250 tokens)
    shop_exclusive_count: 10+

  ear_accessories:
    slot: "accessory_ear"
    description: "Earrings and ear accessories"
    price_range_tokens: 25 - 200
    examples:
      - Studs (25 tokens)
      - Hoops (50 tokens)
      - AirPods (150 tokens)
      - Diamond Earrings (200 tokens)
    shop_exclusive_count: 8+

  hand_accessories:
    slot: "accessory_hand"
    description: "Rings, watches, held items"
    price_range_tokens: 50 - 300
    examples:
      - Ring (50 tokens)
      - Watch (150 tokens)
      - Gloves (200 tokens)
      - Diamond Ring (300 tokens)
    shop_exclusive_count: 10+

PROFILE_CUSTOMIZATIONS:
  profile_frames:
    slot: "profile_frame"
    description: "Decorative borders around profile picture"
    price_range_tokens: 100 - 800
    examples:
      - Simple Border (100 tokens)
      - Gradient Frame (250 tokens)
      - Animated Frame (500 tokens)
      - Legendary Frame (800 tokens)
    shop_exclusive_count: 15+

  profile_banners:
    slot: "profile_banner"
    description: "Background banner on profile"
    price_range_tokens: 75 - 500
    examples:
      - Solid Color (75 tokens)
      - Pattern (200 tokens)
      - Custom Image (350 tokens)
      - Animated Banner (500 tokens)
    shop_exclusive_count: 12+

  profile_themes:
    slot: "profile_theme"
    description: "Complete profile color theme"
    price_range_tokens: 200 - 1000
    examples:
      - Ocean Theme (200 tokens)
      - Sunset Theme (300 tokens)
      - Neon Theme (500 tokens)
      - Holographic Theme (1000 tokens)
    shop_exclusive_count: 10+

CHAT_CUSTOMIZATIONS:
  chat_bubbles:
    slot: "chat_bubble"
    description: "Custom message bubble styles"
    price_range_tokens: 50 - 400
    examples:
      - Rounded Bubbles (50 tokens)
      - Gradient Bubbles (150 tokens)
      - Animated Bubbles (300 tokens)
      - Premium Bubbles (400 tokens)
    shop_exclusive_count: 15+

  name_effects:
    slot: "name_effect"
    description: "Special effects on your display name"
    price_range_tokens: 100 - 600
    examples:
      - Color Name (100 tokens)
      - Gradient Name (250 tokens)
      - Glowing Name (400 tokens)
      - Animated Name (600 tokens)
    shop_exclusive_count: 8+

FUTURE_CUSTOMIZATIONS:
  emote_packs:
    slot: "emote_pack"
    description: "Custom emotes for chat"
    price_range_tokens: 150 - 500
    status: "Planned for Phase 2"

  sound_effects:
    slot: "sound_effect"
    description: "Custom notification sounds"
    price_range_tokens: 75 - 300
    status: "Planned for Phase 2"

  avatar_animations:
    slot: "avatar_animation"
    description: "Idle animations for avatar"
    price_range_tokens: 200 - 800
    status: "Planned for Phase 3"
```

### 5.2 Rarity Distribution for Shop Items

```yaml
RARITY_PRICING_MULTIPLIER:
  common: 1.0x # Base price
  rare: 1.5x # 50% more
  epic: 2.5x # 150% more
  legendary: 4.0x # 300% more
  mythic: 6.0x # 500% more (Premium shop only)

SHOP_ITEM_RARITY_DISTRIBUTION:
  points_shop:
    common: 40%
    rare: 35%
    epic: 20%
    legendary: 5%
    mythic: 0% # Not available in points shop

  premium_shop:
    common: 0% # Not sold for real money
    rare: 20%
    epic: 40%
    legendary: 30%
    mythic: 10% # Exclusive to premium
```

---

## 6. Points Shop Implementation

### 6.1 Service Layer

```typescript
// src/services/pointsShop.ts

/**
 * Points Shop Service
 *
 * PURPOSE: Handle all token-based shop operations
 * CURRENCY: Tokens (virtual currency)
 * SECURITY: All purchases validated server-side via Cloud Functions
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Shop item available for purchase with tokens
 */
export interface PointsShopItem {
  id: string;
  itemId: string; // Reference to cosmetic item ID
  name: string;
  description: string;
  slot: ExtendedCosmeticSlot;
  rarity: ExtendedCosmeticRarity;
  imagePath: string;

  // Pricing
  priceTokens: number;
  originalPrice?: number; // For sales display
  discountPercent?: number;

  // Availability
  availableFrom?: number; // Timestamp
  availableTo?: number; // Timestamp (limited time)
  stock?: number; // Limited quantity (null = unlimited)
  purchaseLimit?: number; // Per-user limit

  // Display
  featured: boolean;
  newUntil?: number; // Show "NEW" badge until
  sortOrder: number;
  tags: string[]; // For filtering: "sale", "new", "limited"

  // Exclusivity flag
  shopExclusive: true; // ALWAYS TRUE - cannot be obtained elsewhere
}

/**
 * Points shop catalog organized by category
 */
export interface PointsShopCatalog {
  featured: PointsShopItem[];
  avatar: {
    hats: PointsShopItem[];
    glasses: PointsShopItem[];
    backgrounds: PointsShopItem[];
    clothingTops: PointsShopItem[];
    clothingBottoms: PointsShopItem[];
    neckAccessories: PointsShopItem[];
    earAccessories: PointsShopItem[];
    handAccessories: PointsShopItem[];
  };
  profile: {
    frames: PointsShopItem[];
    banners: PointsShopItem[];
    themes: PointsShopItem[];
  };
  chat: {
    bubbles: PointsShopItem[];
    nameEffects: PointsShopItem[];
  };
}

/**
 * Purchase result from Cloud Function
 */
export interface PointsPurchaseResult {
  success: boolean;
  transactionId?: string;
  newBalance?: number;
  item?: PointsShopItem;
  error?: string;
  errorCode?:
    | "INSUFFICIENT_FUNDS"
    | "ITEM_NOT_FOUND"
    | "ALREADY_OWNED"
    | "OUT_OF_STOCK"
    | "PURCHASE_LIMIT"
    | "NOT_AVAILABLE"
    | "SERVER_ERROR";
}

// =============================================================================
// Catalog Fetching
// =============================================================================

/**
 * Get full points shop catalog with user ownership status
 */
export async function getPointsShopCatalog(
  uid: string,
): Promise<PointsShopCatalog>;

/**
 * Get items for a specific category
 */
export async function getPointsShopCategory(
  uid: string,
  category:
    | keyof PointsShopCatalog["avatar"]
    | keyof PointsShopCatalog["profile"]
    | keyof PointsShopCatalog["chat"],
): Promise<PointsShopItem[]>;

/**
 * Get featured items only
 */
export async function getFeaturedPointsItems(
  uid: string,
): Promise<PointsShopItem[]>;

/**
 * Search items by name or tag
 */
export async function searchPointsShop(
  uid: string,
  query: string,
): Promise<PointsShopItem[]>;

// =============================================================================
// Purchase Operations
// =============================================================================

/**
 * Purchase item with tokens
 * Calls Cloud Function for secure transaction
 */
export async function purchaseWithTokens(
  itemId: string,
): Promise<PointsPurchaseResult>;

/**
 * Check if user can purchase item
 */
export async function canPurchaseItem(
  uid: string,
  itemId: string,
): Promise<{
  canPurchase: boolean;
  reason?: string;
  balance?: number;
  price?: number;
}>;

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to catalog updates (for sales, new items)
 */
export function subscribeToPointsCatalog(
  uid: string,
  category: string,
  onUpdate: (items: PointsShopItem[]) => void,
  onError?: (error: Error) => void,
): () => void;

/**
 * Subscribe to featured items (rotates)
 */
export function subscribeToFeaturedItems(
  uid: string,
  onUpdate: (items: PointsShopItem[]) => void,
): () => void;
```

### 6.2 Points Shop Hook

```typescript
// src/hooks/usePointsShop.ts

/**
 * Hook for Points Shop functionality
 *
 * USAGE:
 * const {
 *   catalog,
 *   wallet,
 *   purchase,
 *   loading
 * } = usePointsShop();
 */

export interface UsePointsShopReturn {
  // Catalog data
  catalog: PointsShopCatalog | null;
  featuredItems: PointsShopItem[];

  // Wallet
  wallet: Wallet | null;
  balance: number;

  // Loading states
  loading: boolean;
  catalogLoading: boolean;
  purchaseLoading: boolean;

  // Error states
  error: Error | null;
  purchaseError: string | null;

  // Actions
  purchase: (itemId: string) => Promise<PointsPurchaseResult>;
  refresh: () => Promise<void>;
  canAfford: (price: number) => boolean;

  // Filtering
  filterByCategory: (category: string) => PointsShopItem[];
  filterByRarity: (rarity: ExtendedCosmeticRarity) => PointsShopItem[];
  filterByPriceRange: (min: number, max: number) => PointsShopItem[];
  searchItems: (query: string) => PointsShopItem[];
}

export function usePointsShop(uid: string | undefined): UsePointsShopReturn;
```

---

## 7. Premium Shop Implementation

### 7.1 Service Layer

```typescript
// src/services/premiumShop.ts

/**
 * Premium Shop Service
 *
 * PURPOSE: Handle all real-money (IAP) shop operations
 * CURRENCY: Real money via App Store / Play Store
 * SECURITY: Server-side receipt validation required
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Token pack for purchase
 */
export interface TokenPack {
  id: string;
  productId: string; // App Store / Play Store product ID
  name: string;
  tokens: number;
  bonusTokens: number;
  totalTokens: number; // tokens + bonusTokens

  // Pricing (reference - actual from store)
  basePriceUSD: number;
  localizedPrice?: string; // Fetched from store

  // Display
  popular: boolean; // Show "BEST VALUE" badge
  featured: boolean;
  sortOrder: number;

  // Limited time offers
  discountPercent?: number;
  availableFrom?: number;
  availableTo?: number;
}

/**
 * Premium bundle (items + tokens)
 */
export interface PremiumBundle {
  id: string;
  productId: string;
  name: string;
  description: string;

  // Contents
  items: {
    itemId: string;
    name: string;
    slot: ExtendedCosmeticSlot;
    rarity: ExtendedCosmeticRarity;
  }[];
  bonusTokens: number;

  // Pricing
  basePriceUSD: number;
  localizedPrice?: string;
  valueUSD: number; // Combined value of items
  savingsPercent: number; // Calculated savings

  // Display
  imagePath: string;
  theme: string; // "starter", "premium", "legendary"
  featured: boolean;
  sortOrder: number;

  // Availability
  limitedTime: boolean;
  availableFrom?: number;
  availableTo?: number;
  purchaseLimit?: number; // Per-user limit (usually 1)
}

/**
 * Premium exclusive item (real money only)
 */
export interface PremiumExclusiveItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  slot: ExtendedCosmeticSlot;
  rarity: "legendary" | "mythic"; // Only high-tier for premium
  imagePath: string;

  // Pricing
  basePriceUSD: number;
  localizedPrice?: string;

  // Exclusivity
  premiumExclusive: true; // CANNOT buy with tokens
  limitedEdition: boolean;
  availableFrom?: number;
  availableTo?: number;
  totalSupply?: number; // Limited quantity globally

  // Display
  featured: boolean;
  sortOrder: number;
}

/**
 * Gift item configuration
 */
export interface GiftableItem {
  id: string;
  productId: string;
  name: string;
  type: "tokenPack" | "bundle" | "exclusive";
  basePriceUSD: number;
  localizedPrice?: string;
  giftMessage: string; // Default gift message
}

// =============================================================================
// Premium Shop Catalog
// =============================================================================

export interface PremiumShopCatalog {
  tokenPacks: TokenPack[];
  bundles: PremiumBundle[];
  exclusives: PremiumExclusiveItem[];
  giftable: GiftableItem[];

  // Featured section
  featuredBundle?: PremiumBundle;
  featuredExclusive?: PremiumExclusiveItem;
}

// =============================================================================
// Purchase Operations
// =============================================================================

/**
 * Purchase token pack
 */
export async function purchaseTokenPack(
  packId: string,
): Promise<IAPPurchaseResult>;

/**
 * Purchase premium bundle
 */
export async function purchasePremiumBundle(
  bundleId: string,
): Promise<IAPPurchaseResult>;

/**
 * Purchase premium exclusive
 */
export async function purchasePremiumExclusive(
  itemId: string,
): Promise<IAPPurchaseResult>;

/**
 * Gift item to another user
 */
export async function giftItem(
  itemId: string,
  recipientUid: string,
  message?: string,
): Promise<GiftPurchaseResult>;

/**
 * Restore previous purchases
 */
export async function restorePurchases(): Promise<RestoreResult>;
```

### 7.2 Premium Shop Hook

```typescript
// src/hooks/usePremiumShop.ts

/**
 * Hook for Premium Shop functionality
 */

export interface UsePremiumShopReturn {
  // Catalog
  catalog: PremiumShopCatalog | null;
  tokenPacks: TokenPack[];
  bundles: PremiumBundle[];
  exclusives: PremiumExclusiveItem[];

  // Loading states
  loading: boolean;
  purchaseLoading: boolean;

  // Error states
  error: Error | null;
  purchaseError: string | null;

  // IAP state
  iapReady: boolean;

  // Actions
  purchaseTokenPack: (packId: string) => Promise<void>;
  purchaseBundle: (bundleId: string) => Promise<void>;
  purchaseExclusive: (itemId: string) => Promise<void>;
  giftItem: (
    itemId: string,
    recipientUid: string,
    message?: string,
  ) => Promise<void>;
  restorePurchases: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePremiumShop(uid: string | undefined): UsePremiumShopReturn;
```

---

## 8. IAP Integration Guide

### 8.1 Platform Configuration

#### Apple App Store (iOS)

```yaml
APP_STORE_CONNECT_SETUP:
  1_create_in_app_purchases:
    location: "App Store Connect > My Apps > [App] > In-App Purchases"
    steps:
      - Click "+" to create new IAP
      - Select type: "Consumable" for tokens
      - Select type: "Non-Consumable" for exclusive items
      - Fill in Reference Name (internal)
      - Fill in Product ID (must match code)
      - Set price tier
      - Add localized display name and description
      - Upload screenshot (required for review)
      - Submit for review

  2_product_ids_convention:
    format: "com.snapstyle.{type}.{id}"
    examples:
      - com.snapstyle.tokens.500
      - com.snapstyle.tokens.1200
      - com.snapstyle.bundle.starter
      - com.snapstyle.exclusive.mythic_crown

  3_sandbox_testing:
    setup:
      - Create sandbox tester accounts in App Store Connect
      - Sign out of App Store on device
      - Sign in with sandbox account
      - Test purchases (no real charges)

  4_server_verification:
    endpoint: "https://buy.itunes.apple.com/verifyReceipt"      # Production
    sandbox:  "https://sandbox.itunes.apple.com/verifyReceipt"  # Testing
    required_fields:
      - receipt-data (base64 encoded)
      - password (shared secret from App Store Connect)
    response:
      - status (0 = valid)
      - receipt (purchase details)

STOREKIT_2_INTEGRATION:
  benefits:
    - Modern Swift-based API
    - Better error handling
    - Automatic receipt validation
    - Transaction history API

  expo_support:
    - Use expo-in-app-purchases
    - Or react-native-iap for more control
```

#### Google Play Store (Android)

```yaml
GOOGLE_PLAY_CONSOLE_SETUP:
  1_create_in_app_products:
    location: "Google Play Console > [App] > Monetize > Products > In-app products"
    steps:
      - Click "Create product"
      - Enter Product ID (must match code)
      - Set product type: "Managed product" (consumable/non-consumable)
      - Add name, description
      - Set price
      - Activate product

  2_product_ids_convention:
    format: "{app_id}.{type}.{id}"
    examples:
      - snapstyle.tokens.500
      - snapstyle.tokens.1200
      - snapstyle.bundle.starter
      - snapstyle.exclusive.mythic_crown

  3_testing:
    license_testers:
      - Add tester emails in Play Console
      - Testers get free purchases

    internal_testing:
      - Create internal test track
      - Upload APK with billing permission
      - Add testers to track

  4_server_verification:
    google_play_developer_api:
      endpoint: "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/products/{productId}/tokens/{purchaseToken}"
      auth: OAuth 2.0 service account
      required:
        - packageName
        - productId
        - purchaseToken (from purchase)
      response:
        - purchaseState (0 = purchased)
        - consumptionState
        - acknowledgementState

BILLING_LIBRARY_V5:
  features:
    - Pending purchases
    - Multi-quantity purchases
    - Price change confirmation
    - Subscription management
```

### 8.2 Receipt Validation Cloud Function

```typescript
// firebase-backend/functions/src/iap/validateReceipt.ts

/**
 * Cloud Function: validateReceipt
 *
 * PURPOSE: Securely validate purchase receipts from App Store / Play Store
 * SECURITY: Never trust client-side purchase claims
 *
 * FLOW:
 * 1. Client makes purchase through native store
 * 2. Client receives receipt/token
 * 3. Client calls this function with receipt
 * 4. Function validates with store servers
 * 5. Function grants items/tokens to user
 * 6. Function returns result to client
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface ValidateReceiptRequest {
  platform: "ios" | "android";
  productId: string;
  purchaseToken: string; // Android
  receiptData?: string; // iOS (base64)
  transactionId?: string; // iOS
}

interface ValidateReceiptResponse {
  success: boolean;
  purchaseId?: string;
  grantedItems?: string[];
  grantedTokens?: number;
  error?: string;
}

export const validateReceipt = functions.https.onCall(
  async (
    data: ValidateReceiptRequest,
    context,
  ): Promise<ValidateReceiptResponse> => {
    // 1. Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in",
      );
    }

    const uid = context.auth.uid;
    const { platform, productId, purchaseToken, receiptData, transactionId } =
      data;

    try {
      // 2. Check for duplicate transaction
      const existingPurchase = await checkDuplicateTransaction(
        platform === "ios" ? transactionId! : purchaseToken,
        platform,
      );

      if (existingPurchase) {
        return {
          success: true,
          purchaseId: existingPurchase.id,
          grantedItems: existingPurchase.grantedItems,
          grantedTokens: existingPurchase.grantedTokens,
        };
      }

      // 3. Validate with store
      let isValid: boolean;
      let purchaseDetails: any;

      if (platform === "ios") {
        const result = await validateAppleReceipt(receiptData!, productId);
        isValid = result.valid;
        purchaseDetails = result.details;
      } else {
        const result = await validateGooglePurchase(productId, purchaseToken);
        isValid = result.valid;
        purchaseDetails = result.details;
      }

      if (!isValid) {
        return { success: false, error: "Invalid receipt" };
      }

      // 4. Get product configuration
      const product = await getProductConfig(productId);
      if (!product) {
        return { success: false, error: "Product not found" };
      }

      // 5. Grant rewards
      const rewards = await grantPurchaseRewards(uid, product);

      // 6. Record purchase
      const purchaseId = await recordPurchase({
        uid,
        platform,
        productId,
        transactionId: platform === "ios" ? transactionId : purchaseToken,
        purchaseDetails,
        rewards,
      });

      // 7. Acknowledge purchase (Android)
      if (platform === "android") {
        await acknowledgeGooglePurchase(productId, purchaseToken);
      }

      return {
        success: true,
        purchaseId,
        grantedItems: rewards.items,
        grantedTokens: rewards.tokens,
      };
    } catch (error) {
      console.error("Receipt validation error:", error);
      throw new functions.https.HttpsError("internal", "Validation failed");
    }
  },
);

// Apple receipt validation
async function validateAppleReceipt(
  receiptData: string,
  expectedProductId: string,
): Promise<{ valid: boolean; details: any }> {
  const sharedSecret = functions.config().apple.shared_secret;

  // Try production first, fall back to sandbox
  let response = await fetch("https://buy.itunes.apple.com/verifyReceipt", {
    method: "POST",
    body: JSON.stringify({
      "receipt-data": receiptData,
      password: sharedSecret,
    }),
  });

  let result = await response.json();

  // Status 21007 means sandbox receipt sent to production
  if (result.status === 21007) {
    response = await fetch("https://sandbox.itunes.apple.com/verifyReceipt", {
      method: "POST",
      body: JSON.stringify({
        "receipt-data": receiptData,
        password: sharedSecret,
      }),
    });
    result = await response.json();
  }

  if (result.status !== 0) {
    return { valid: false, details: null };
  }

  // Find the specific purchase in receipt
  const purchase = result.receipt.in_app.find(
    (p: any) => p.product_id === expectedProductId,
  );

  return {
    valid: !!purchase,
    details: purchase,
  };
}

// Google purchase validation
async function validateGooglePurchase(
  productId: string,
  purchaseToken: string,
): Promise<{ valid: boolean; details: any }> {
  const auth = await getGoogleAuthClient();
  const packageName = functions.config().android.package_name;

  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`,
    {
      headers: {
        Authorization: `Bearer ${await auth.getAccessToken()}`,
      },
    },
  );

  const result = await response.json();

  // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
  const valid = result.purchaseState === 0;

  return { valid, details: result };
}
```

### 8.3 Client-Side IAP Service

```typescript
// src/services/iap.ts (UPDATED)

/**
 * In-App Purchase Service
 *
 * LIBRARY OPTIONS:
 * - expo-in-app-purchases (Expo managed)
 * - react-native-iap (More features, bare workflow)
 *
 * RECOMMENDATION: react-native-iap for production
 * - Better error handling
 * - More platform features
 * - Active maintenance
 */

import { Platform } from "react-native";
import { httpsCallable } from "firebase/functions";
import { getFunctionsInstance } from "./firebase";

// Use conditional import for native module
let RNIap: typeof import("react-native-iap") | null = null;

// =============================================================================
// Initialization
// =============================================================================

export async function initializeIAP(): Promise<boolean> {
  try {
    // Dynamically import to avoid issues in dev
    if (!__DEV__) {
      RNIap = await import("react-native-iap");
      await RNIap.initConnection();

      // Set up purchase listener
      RNIap.purchaseUpdatedListener(handlePurchaseUpdate);
      RNIap.purchaseErrorListener(handlePurchaseError);
    }

    console.log("[iap] Initialized successfully");
    return true;
  } catch (error) {
    console.error("[iap] Initialization failed:", error);
    return false;
  }
}

export async function disconnectIAP(): Promise<void> {
  if (RNIap) {
    await RNIap.endConnection();
  }
}

// =============================================================================
// Product Fetching
// =============================================================================

export async function getProducts(productIds: string[]): Promise<IAPProduct[]> {
  if (!RNIap) {
    return productIds.map(createMockProduct);
  }

  try {
    const products = await RNIap.getProducts({ skus: productIds });

    return products.map((p) => ({
      productId: p.productId,
      title: p.title,
      description: p.description,
      price: p.localizedPrice,
      priceAmountMicros: parseInt(p.price) * 1000000,
      priceCurrencyCode: p.currency,
      type: "consumable",
    }));
  } catch (error) {
    console.error("[iap] Error fetching products:", error);
    return [];
  }
}

// =============================================================================
// Purchase Flow
// =============================================================================

export async function purchaseProduct(
  productId: string,
): Promise<IAPPurchaseResult> {
  if (!RNIap) {
    // Mock purchase for development
    return mockPurchase(productId);
  }

  try {
    // Request purchase from native store
    const purchase = await RNIap.requestPurchase({
      sku: productId,
      andDangerouslyFinishTransactionAutomaticallyIOS: false,
    });

    // Validate receipt with server
    const validateReceipt = httpsCallable(
      getFunctionsInstance(),
      "validateReceipt",
    );

    const result = await validateReceipt({
      platform: Platform.OS as "ios" | "android",
      productId,
      purchaseToken:
        Platform.OS === "android" ? purchase.purchaseToken : undefined,
      receiptData:
        Platform.OS === "ios" ? purchase.transactionReceipt : undefined,
      transactionId: purchase.transactionId,
    });

    // Finish transaction after server confirms
    if (result.data.success) {
      await RNIap.finishTransaction({
        purchase,
        isConsumable: true,
      });
    }

    return {
      success: result.data.success,
      purchaseId: result.data.purchaseId,
      grantedItems: result.data.grantedItems,
      grantedTokens: result.data.grantedTokens,
      error: result.data.error,
    };
  } catch (error: any) {
    console.error("[iap] Purchase error:", error);

    // Handle specific error codes
    if (error.code === "E_USER_CANCELLED") {
      return { success: false, error: "Purchase cancelled" };
    }

    return { success: false, error: error.message };
  }
}

// =============================================================================
// Restore Purchases
// =============================================================================

export async function restorePurchases(): Promise<RestoreResult> {
  if (!RNIap) {
    return { success: true, restored: [] };
  }

  try {
    const purchases = await RNIap.getAvailablePurchases();

    // Validate each purchase with server
    const restoreResults = await Promise.all(
      purchases
        .filter((p) => isNonConsumable(p.productId))
        .map(async (purchase) => {
          const validateReceipt = httpsCallable(
            getFunctionsInstance(),
            "validateReceipt",
          );

          return validateReceipt({
            platform: Platform.OS,
            productId: purchase.productId,
            purchaseToken: purchase.purchaseToken,
            receiptData: purchase.transactionReceipt,
            transactionId: purchase.transactionId,
          });
        }),
    );

    const restored = restoreResults
      .filter((r) => r.data.success)
      .map((r) => r.data.grantedItems)
      .flat();

    return { success: true, restored };
  } catch (error: any) {
    console.error("[iap] Restore error:", error);
    return { success: false, error: error.message, restored: [] };
  }
}
```

---

## 9. Shop-Exclusive Items

### 9.1 Exclusivity Rules

```yaml
SHOP_EXCLUSIVE_DEFINITION:
  rule: "Items marked as shop-exclusive can ONLY be obtained through the shop"

  NOT_OBTAINABLE_VIA:
    - Achievements (no achievement unlocks shop items)
    - Milestones (no streak unlocks shop items)
    - Daily tasks (no task rewards include shop items)
    - Events (events have separate exclusive items)
    - Gifts from friends (unless purchased as gift)
    - Admin grants (except for compensation)

  ENFORCEMENT:
    - Database schema enforces unlock.type = 'purchase' OR 'premium_purchase'
    - Cloud Functions validate source of all item grants
    - Achievement/milestone reward lists exclude shop items
    - Shop items have shopExclusive: true flag

DATA_MODEL_ENFORCEMENT:
  shop_item:
    unlock:
      type: 'shop_purchase'        # Points shop
      # OR
      type: 'premium_purchase'     # Real money
    shopExclusive: true            # Always true for shop items

  achievement_reward:
    # Cannot reference items where shopExclusive = true
    validation: "itemId NOT IN (SELECT id FROM items WHERE shopExclusive = true)"
```

### 9.2 Exclusive Item Categories

```typescript
// src/data/shopExclusiveItems.ts

/**
 * Shop-Exclusive Items Catalog
 *
 * IMPORTANT: These items can ONLY be purchased from the shop.
 * They are NOT available through achievements, milestones, or tasks.
 */

// =============================================================================
// Points Shop Exclusives (Buy with Tokens)
// =============================================================================

export const POINTS_SHOP_EXCLUSIVES: PointsShopItem[] = [
  // === HATS ===
  {
    id: "shop_hat_astronaut",
    name: "Astronaut Helmet",
    description: "For the space explorers",
    slot: "hat",
    rarity: "epic",
    priceTokens: 400,
    imagePath: "🧑‍🚀",
    shopExclusive: true,
    tags: ["space", "sci-fi"],
  },
  {
    id: "shop_hat_chef",
    name: "Chef Hat",
    description: "Master of the kitchen",
    slot: "hat",
    rarity: "rare",
    priceTokens: 150,
    imagePath: "👨‍🍳",
    shopExclusive: true,
    tags: ["food", "professional"],
  },
  // ... 15+ more shop-exclusive hats

  // === GLASSES ===
  {
    id: "shop_glasses_vr",
    name: "VR Headset",
    description: "Virtual reality vibes",
    slot: "glasses",
    rarity: "epic",
    priceTokens: 350,
    imagePath: "🥽",
    shopExclusive: true,
    tags: ["tech", "gaming"],
  },
  // ... 12+ more shop-exclusive glasses

  // === BACKGROUNDS ===
  {
    id: "shop_bg_matrix",
    name: "Matrix Code",
    description: "Enter the matrix",
    slot: "background",
    rarity: "epic",
    priceTokens: 300,
    imagePath: "matrix",
    shopExclusive: true,
    tags: ["tech", "animated"],
  },
  // ... 20+ more shop-exclusive backgrounds

  // === PROFILE FRAMES ===
  {
    id: "shop_frame_diamond",
    name: "Diamond Frame",
    description: "Sparkling elegance",
    slot: "profile_frame",
    rarity: "legendary",
    priceTokens: 750,
    imagePath: "diamond_frame",
    shopExclusive: true,
    tags: ["luxury", "animated"],
  },
  // ... 15+ more shop-exclusive frames

  // === CHAT BUBBLES ===
  {
    id: "shop_bubble_neon",
    name: "Neon Glow Bubbles",
    description: "Messages that pop",
    slot: "chat_bubble",
    rarity: "rare",
    priceTokens: 200,
    imagePath: "neon_bubble",
    shopExclusive: true,
    tags: ["glowing", "animated"],
  },
  // ... 15+ more shop-exclusive bubbles
];

// =============================================================================
// Premium Shop Exclusives (Buy with Real Money)
// =============================================================================

export const PREMIUM_EXCLUSIVES: PremiumExclusiveItem[] = [
  // === MYTHIC ITEMS (Premium Only) ===
  {
    id: "premium_crown_diamond",
    name: "Diamond Crown",
    description: "The ultimate status symbol",
    slot: "hat",
    rarity: "mythic",
    basePriceUSD: 9.99,
    imagePath: "💎👑",
    premiumExclusive: true,
    limitedEdition: false,
  },
  {
    id: "premium_frame_holographic",
    name: "Holographic Frame",
    description: "Futuristic animated frame",
    slot: "profile_frame",
    rarity: "mythic",
    basePriceUSD: 7.99,
    imagePath: "holo_frame",
    premiumExclusive: true,
    limitedEdition: false,
  },
  {
    id: "premium_theme_aurora",
    name: "Aurora Theme",
    description: "Northern lights on your profile",
    slot: "profile_theme",
    rarity: "mythic",
    basePriceUSD: 12.99,
    imagePath: "aurora_theme",
    premiumExclusive: true,
    limitedEdition: false,
  },

  // === LIMITED EDITION (Time or Quantity Limited) ===
  {
    id: "premium_limited_founders_badge",
    name: "Founders Badge Frame",
    description: "For early supporters - Limited to 1000",
    slot: "profile_frame",
    rarity: "mythic",
    basePriceUSD: 19.99,
    imagePath: "founders_frame",
    premiumExclusive: true,
    limitedEdition: true,
    totalSupply: 1000,
  },
];
```

### 9.3 Validation Functions

```typescript
// src/services/shopValidation.ts

/**
 * Validation functions to ensure shop exclusivity
 */

/**
 * Check if an item is shop-exclusive
 */
export function isShopExclusive(itemId: string): boolean {
  const item = getItemById(itemId);
  return item?.shopExclusive === true;
}

/**
 * Validate that a reward list doesn't contain shop-exclusive items
 * Used when creating achievements, milestones, or tasks
 */
export function validateRewardList(itemIds: string[]): {
  valid: boolean;
  invalidItems: string[];
} {
  const invalidItems = itemIds.filter(isShopExclusive);
  return {
    valid: invalidItems.length === 0,
    invalidItems,
  };
}

/**
 * Get the valid unlock source for an item
 */
export function getUnlockSource(
  itemId: string,
): "shop" | "achievement" | "milestone" | "free" | "starter" {
  const item = getItemById(itemId);

  if (item?.shopExclusive) {
    return "shop";
  }

  switch (item?.unlock.type) {
    case "achievement":
      return "achievement";
    case "milestone":
      return "milestone";
    case "free":
      return "free";
    case "starter":
      return "starter";
    default:
      return "shop";
  }
}
```

---

## 10. Additional Features

### 10.1 Wishlist System

```typescript
// src/services/wishlist.ts

/**
 * Wishlist Service
 *
 * Allows users to save items they want to purchase later.
 * Sends notifications when wishlist items go on sale.
 */

export interface WishlistItem {
  itemId: string;
  addedAt: number;
  shopType: "points" | "premium";
  priceWhenAdded: number;
  notifyOnSale: boolean;
}

// Firestore: Users/{uid}/wishlist/{itemId}

export async function addToWishlist(
  uid: string,
  itemId: string,
  shopType: "points" | "premium",
): Promise<boolean>;

export async function removeFromWishlist(
  uid: string,
  itemId: string,
): Promise<boolean>;

export async function getWishlist(uid: string): Promise<WishlistItem[]>;

export function subscribeToWishlist(
  uid: string,
  onUpdate: (items: WishlistItem[]) => void,
): () => void;
```

### 10.2 Gifting System

```typescript
// src/services/gifting.ts

/**
 * Gifting Service
 *
 * Allows users to purchase items as gifts for friends.
 * Premium shop only (real money purchases).
 */

export interface Gift {
  id: string;
  senderUid: string;
  recipientUid: string;
  itemId: string;
  itemType: "tokenPack" | "bundle" | "exclusive";
  message: string;
  purchaseId: string;

  // Status
  status: "pending" | "delivered" | "opened" | "expired";
  sentAt: number;
  deliveredAt?: number;
  openedAt?: number;
  expiresAt: number; // Gifts expire after 30 days if not claimed
}

// Firestore: Gifts/{giftId}

export async function sendGift(
  itemId: string,
  recipientUid: string,
  message?: string,
): Promise<{ success: boolean; giftId?: string; error?: string }>;

export async function getReceivedGifts(uid: string): Promise<Gift[]>;

export async function getSentGifts(uid: string): Promise<Gift[]>;

export async function openGift(
  giftId: string,
): Promise<{ success: boolean; item?: any; error?: string }>;

export function subscribeToGifts(
  uid: string,
  onUpdate: (gifts: Gift[]) => void,
): () => void;
```

### 10.3 Sales and Promotions System

```typescript
// src/services/promotions.ts

/**
 * Promotions Service
 *
 * Manages sales, discounts, and limited-time offers.
 */

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: "discount" | "bundle_deal" | "flash_sale" | "seasonal";

  // What's on sale
  targetType: "item" | "category" | "all";
  targetIds?: string[];
  targetCategory?: string;

  // Discount
  discountType: "percent" | "fixed";
  discountValue: number;

  // Timing
  startsAt: number;
  endsAt: number;

  // Display
  bannerImage?: string;
  badgeText: string; // "50% OFF", "FLASH SALE", etc.

  // Limits
  usageLimit?: number;
  perUserLimit?: number;
}

// Firestore: Promotions/{promotionId}

export async function getActivePromotions(): Promise<Promotion[]>;

export async function getPromotionForItem(
  itemId: string,
): Promise<Promotion | null>;

export function applyPromotion(
  originalPrice: number,
  promotion: Promotion,
): number;

export function subscribeToPromotions(
  onUpdate: (promotions: Promotion[]) => void,
): () => void;
```

### 10.4 Purchase History

```typescript
// src/services/purchaseHistory.ts

/**
 * Purchase History Service
 *
 * Tracks all user purchases for receipts and support.
 */

export interface PurchaseRecord {
  id: string;
  uid: string;
  timestamp: number;

  // What was purchased
  type: "points_item" | "token_pack" | "bundle" | "premium_item" | "gift_sent";
  itemId: string;
  itemName: string;

  // Payment
  paymentType: "tokens" | "iap";
  amount: number; // Tokens or cents
  currency?: string; // For IAP
  transactionId?: string; // For IAP

  // Rewards received
  itemsReceived: string[];
  tokensReceived?: number;

  // For gifts
  recipientUid?: string;
  giftMessage?: string;
}

// Firestore: Users/{uid}/purchases/{purchaseId}

export async function getPurchaseHistory(
  uid: string,
  limit?: number,
): Promise<PurchaseRecord[]>;

export async function getPurchaseById(
  uid: string,
  purchaseId: string,
): Promise<PurchaseRecord | null>;

export function subscribeToPurchases(
  uid: string,
  onUpdate: (purchases: PurchaseRecord[]) => void,
): () => void;
```

### 10.5 Item Preview System

```typescript
// src/hooks/useItemPreview.ts

/**
 * Item Preview Hook
 *
 * Allows users to preview items on their avatar/profile before purchasing.
 */

export interface UseItemPreviewReturn {
  // Current preview state
  previewItem: ShopItem | null;
  previewConfig: ExtendedAvatarConfig;

  // Actions
  setPreviewItem: (item: ShopItem | null) => void;
  applyPreview: () => void;
  clearPreview: () => void;

  // Preview status
  isPreviewActive: boolean;
  canPreview: (item: ShopItem) => boolean;
}

export function useItemPreview(
  currentConfig: ExtendedAvatarConfig,
): UseItemPreviewReturn;
```

### 10.6 Daily/Weekly Deals

```typescript
// src/services/dailyDeals.ts

/**
 * Daily Deals Service
 *
 * Rotating selection of discounted items that change daily.
 */

export interface DailyDeal {
  id: string;
  itemId: string;
  item: PointsShopItem;
  originalPrice: number;
  dealPrice: number;
  discountPercent: number;
  startsAt: number;
  endsAt: number;
  slot: number; // Position in deals grid (1-6)
}

// Firestore: DailyDeals/{date}/items/{slot}

export async function getDailyDeals(): Promise<DailyDeal[]>;

export async function getWeeklyDeals(): Promise<DailyDeal[]>;

export function subscribeToDeals(
  onUpdate: (deals: DailyDeal[]) => void,
): () => void;

export function getTimeUntilRefresh(): number; // Milliseconds until new deals
```

### 10.7 Referral Rewards

```typescript
// src/services/referralRewards.ts

/**
 * Referral Rewards Service
 *
 * Earn tokens when friends make their first purchase.
 */

export interface ReferralReward {
  referrerReward: number; // Tokens for referrer
  refereeReward: number; // Tokens for new user
  minPurchaseAmount: number; // Minimum purchase to trigger
}

export interface ReferralRecord {
  id: string;
  referrerUid: string;
  refereeUid: string;
  status: "pending" | "qualified" | "rewarded";
  createdAt: number;
  qualifiedAt?: number;
  rewardedAt?: number;
  rewardAmount?: number;
}

export async function generateReferralCode(uid: string): Promise<string>;

export async function applyReferralCode(
  uid: string,
  code: string,
): Promise<{ success: boolean; error?: string }>;

export async function getReferralStats(uid: string): Promise<{
  totalReferrals: number;
  pendingRewards: number;
  earnedTokens: number;
}>;
```

---

## 11. Data Models

### 11.1 Firestore Collections

```yaml
COLLECTIONS:

  # Points Shop Catalog
  PointsShopCatalog:
    description: "Items available for purchase with tokens"
    path: "PointsShopCatalog/{itemId}"
    fields:
      id: string
      itemId: string                 # Reference to cosmetic
      name: string
      description: string
      slot: ExtendedCosmeticSlot
      rarity: ExtendedCosmeticRarity
      imagePath: string
      priceTokens: number
      originalPrice: number | null   # For sales
      discountPercent: number | null
      featured: boolean
      newUntil: timestamp | null
      availableFrom: timestamp | null
      availableTo: timestamp | null
      stock: number | null
      purchaseLimit: number | null
      sortOrder: number
      tags: string[]
      shopExclusive: true            # Always true
      active: boolean
      createdAt: timestamp
      updatedAt: timestamp

  # Premium Shop Products
  PremiumProducts:
    description: "Products available for real money purchase"
    path: "PremiumProducts/{productId}"
    fields:
      id: string
      productId: string              # App Store / Play Store ID
      type: 'token_pack' | 'bundle' | 'exclusive'
      name: string
      description: string
      basePriceUSD: number
      rewards:
        tokens: number | null
        itemIds: string[]
      featured: boolean
      popular: boolean
      sortOrder: number
      platforms: ('ios' | 'android')[]
      availableFrom: timestamp | null
      availableTo: timestamp | null
      totalSupply: number | null
      purchaseLimit: number | null
      active: boolean
      createdAt: timestamp
      updatedAt: timestamp

  # User Purchases
  Users/{uid}/purchases/{purchaseId}:
    description: "User's purchase history"
    fields:
      id: string
      timestamp: timestamp
      type: 'points_item' | 'token_pack' | 'bundle' | 'premium_item' | 'gift_sent'
      itemId: string
      itemName: string
      paymentType: 'tokens' | 'iap'
      amount: number
      currency: string | null
      transactionId: string | null
      platform: 'ios' | 'android' | null
      itemsReceived: string[]
      tokensReceived: number | null
      recipientUid: string | null
      giftMessage: string | null
      status: 'completed' | 'refunded'

  # User Wishlist
  Users/{uid}/wishlist/{itemId}:
    description: "Items user wants to purchase"
    fields:
      itemId: string
      shopType: 'points' | 'premium'
      priceWhenAdded: number
      notifyOnSale: boolean
      addedAt: timestamp

  # Gifts
  Gifts/{giftId}:
    description: "Gift records"
    fields:
      id: string
      senderUid: string
      recipientUid: string
      itemId: string
      itemType: string
      itemName: string
      message: string
      purchaseId: string
      status: 'pending' | 'delivered' | 'opened' | 'expired'
      sentAt: timestamp
      deliveredAt: timestamp | null
      openedAt: timestamp | null
      expiresAt: timestamp

  # Promotions
  Promotions/{promotionId}:
    description: "Active sales and promotions"
    fields:
      id: string
      name: string
      description: string
      type: string
      targetType: string
      targetIds: string[]
      targetCategory: string | null
      discountType: 'percent' | 'fixed'
      discountValue: number
      startsAt: timestamp
      endsAt: timestamp
      bannerImage: string | null
      badgeText: string
      usageLimit: number | null
      usageCount: number
      perUserLimit: number | null
      active: boolean

  # Daily Deals
  DailyDeals/{date}/items/{slot}:
    description: "Daily rotating deals"
    fields:
      itemId: string
      originalPrice: number
      dealPrice: number
      discountPercent: number
      slot: number
      createdAt: timestamp
```

### 11.2 TypeScript Type Definitions

```typescript
// src/types/shop.ts

/**
 * Complete Shop Type Definitions
 */

// =============================================================================
// Base Types
// =============================================================================

export type ShopType = "points" | "premium";

export type PaymentMethod = "tokens" | "iap";

export type PurchaseStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded"
  | "cancelled";

// =============================================================================
// Points Shop Types
// =============================================================================

export interface PointsShopItem {
  id: string;
  itemId: string;
  name: string;
  description: string;
  slot: ExtendedCosmeticSlot;
  rarity: ExtendedCosmeticRarity;
  imagePath: string;
  priceTokens: number;
  originalPrice?: number;
  discountPercent?: number;
  featured: boolean;
  newUntil?: number;
  availableFrom?: number;
  availableTo?: number;
  stock?: number;
  purchaseLimit?: number;
  sortOrder: number;
  tags: string[];
  shopExclusive: true;

  // Runtime additions
  owned?: boolean;
  canAfford?: boolean;
  purchasesRemaining?: number;
}

export interface PointsShopCatalog {
  featured: PointsShopItem[];
  categories: Record<string, PointsShopItem[]>;
  lastUpdated: number;
}

// =============================================================================
// Premium Shop Types
// =============================================================================

export interface TokenPack {
  id: string;
  productId: string;
  name: string;
  tokens: number;
  bonusTokens: number;
  totalTokens: number;
  basePriceUSD: number;
  localizedPrice?: string;
  popular: boolean;
  featured: boolean;
  sortOrder: number;
  discountPercent?: number;
  availableFrom?: number;
  availableTo?: number;
}

export interface PremiumBundle {
  id: string;
  productId: string;
  name: string;
  description: string;
  items: BundleItem[];
  bonusTokens: number;
  basePriceUSD: number;
  localizedPrice?: string;
  valueUSD: number;
  savingsPercent: number;
  imagePath: string;
  theme: string;
  featured: boolean;
  sortOrder: number;
  limitedTime: boolean;
  availableFrom?: number;
  availableTo?: number;
  purchaseLimit?: number;

  // Runtime
  owned?: boolean;
  purchasesRemaining?: number;
}

export interface BundleItem {
  itemId: string;
  name: string;
  slot: ExtendedCosmeticSlot;
  rarity: ExtendedCosmeticRarity;
  imagePath: string;
}

export interface PremiumExclusiveItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  slot: ExtendedCosmeticSlot;
  rarity: "legendary" | "mythic";
  imagePath: string;
  basePriceUSD: number;
  localizedPrice?: string;
  premiumExclusive: true;
  limitedEdition: boolean;
  availableFrom?: number;
  availableTo?: number;
  totalSupply?: number;
  remaining?: number;
  featured: boolean;
  sortOrder: number;

  // Runtime
  owned?: boolean;
}

export interface PremiumShopCatalog {
  tokenPacks: TokenPack[];
  bundles: PremiumBundle[];
  exclusives: PremiumExclusiveItem[];
  featuredBundle?: PremiumBundle;
  featuredExclusive?: PremiumExclusiveItem;
  lastUpdated: number;
}

// =============================================================================
// Purchase Types
// =============================================================================

export interface PurchaseRecord {
  id: string;
  uid: string;
  timestamp: number;
  type: "points_item" | "token_pack" | "bundle" | "premium_item" | "gift_sent";
  itemId: string;
  itemName: string;
  paymentType: PaymentMethod;
  amount: number;
  currency?: string;
  transactionId?: string;
  platform?: "ios" | "android";
  itemsReceived: string[];
  tokensReceived?: number;
  recipientUid?: string;
  giftMessage?: string;
  status: PurchaseStatus;
}

export interface PurchaseResult {
  success: boolean;
  purchaseId?: string;
  newBalance?: number;
  itemsReceived?: string[];
  tokensReceived?: number;
  error?: string;
  errorCode?: string;
}

// =============================================================================
// Gift Types
// =============================================================================

export interface Gift {
  id: string;
  senderUid: string;
  senderName: string;
  recipientUid: string;
  recipientName: string;
  itemId: string;
  itemType: "tokenPack" | "bundle" | "exclusive";
  itemName: string;
  itemImagePath: string;
  message: string;
  purchaseId: string;
  status: "pending" | "delivered" | "opened" | "expired";
  sentAt: number;
  deliveredAt?: number;
  openedAt?: number;
  expiresAt: number;
}

// =============================================================================
// Promotion Types
// =============================================================================

export interface Promotion {
  id: string;
  name: string;
  description: string;
  type: "discount" | "bundle_deal" | "flash_sale" | "seasonal";
  targetType: "item" | "category" | "all";
  targetIds?: string[];
  targetCategory?: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startsAt: number;
  endsAt: number;
  bannerImage?: string;
  badgeText: string;
  usageLimit?: number;
  perUserLimit?: number;
}

export interface DailyDeal {
  id: string;
  itemId: string;
  item: PointsShopItem;
  originalPrice: number;
  dealPrice: number;
  discountPercent: number;
  startsAt: number;
  endsAt: number;
  slot: number;
}

// =============================================================================
// Wishlist Types
// =============================================================================

export interface WishlistItem {
  itemId: string;
  shopType: ShopType;
  priceWhenAdded: number;
  notifyOnSale: boolean;
  addedAt: number;

  // Runtime
  item?: PointsShopItem | PremiumExclusiveItem;
  currentPrice?: number;
  priceChanged?: boolean;
  onSale?: boolean;
}
```

---

## 12. API Specifications

### 12.1 Cloud Functions

```typescript
// firebase-backend/functions/src/shop/index.ts

/**
 * Shop Cloud Functions
 *
 * All purchase operations are handled server-side for security.
 */

// =============================================================================
// Points Shop Functions
// =============================================================================

/**
 * Purchase item with tokens
 *
 * @param itemId - Shop item ID
 * @returns Purchase result
 */
export const purchaseWithTokens = functions.https.onCall(
  async (data: { itemId: string }, context) => {
    // 1. Verify authentication
    // 2. Get user wallet
    // 3. Get item details
    // 4. Validate purchase (stock, limits, availability)
    // 5. Deduct tokens (atomic transaction)
    // 6. Grant item to inventory
    // 7. Record purchase
    // 8. Return result
  },
);

/**
 * Get points shop catalog with user context
 */
export const getPointsCatalog = functions.https.onCall(
  async (data: { category?: string }, context) => {
    // Returns catalog with owned/canAfford flags
  },
);

// =============================================================================
// Premium Shop Functions
// =============================================================================

/**
 * Validate IAP receipt and grant rewards
 */
export const validateReceipt = functions.https.onCall(
  async (data: ValidateReceiptRequest, context) => {
    // See Section 8.2 for implementation
  },
);

/**
 * Get premium shop catalog with localized prices
 */
export const getPremiumCatalog = functions.https.onCall(
  async (data: { platform: "ios" | "android" }, context) => {
    // Returns catalog with platform-specific product IDs
  },
);

// =============================================================================
// Gift Functions
// =============================================================================

/**
 * Send gift to another user
 */
export const sendGift = functions.https.onCall(
  async (
    data: {
      itemId: string;
      recipientUid: string;
      message?: string;
      platform: "ios" | "android";
      receiptData: string;
    },
    context,
  ) => {
    // 1. Validate receipt
    // 2. Verify recipient exists
    // 3. Create gift record
    // 4. Send push notification to recipient
    // 5. Return result
  },
);

/**
 * Open received gift
 */
export const openGift = functions.https.onCall(
  async (data: { giftId: string }, context) => {
    // 1. Verify gift belongs to user
    // 2. Grant items to inventory
    // 3. Update gift status
    // 4. Return items received
  },
);

// =============================================================================
// Promotion Functions
// =============================================================================

/**
 * Apply promotion code (if implementing codes)
 */
export const applyPromoCode = functions.https.onCall(
  async (data: { code: string }, context) => {
    // Validate and apply promotion
  },
);

// =============================================================================
// Scheduled Functions
// =============================================================================

/**
 * Generate daily deals (runs at midnight UTC)
 */
export const generateDailyDeals = functions.pubsub
  .schedule("0 0 * * *")
  .timeZone("UTC")
  .onRun(async () => {
    // Select random items
    // Apply discounts
    // Store in DailyDeals collection
  });

/**
 * Expire old gifts (runs hourly)
 */
export const expireGifts = functions.pubsub
  .schedule("0 * * * *")
  .onRun(async () => {
    // Find gifts past expiration
    // Update status to 'expired'
    // Optionally refund sender
  });

/**
 * Send sale notifications (when promotions start)
 */
export const notifySaleStart = functions.firestore
  .document("Promotions/{promotionId}")
  .onUpdate(async (change, context) => {
    // Check if promotion just became active
    // Find users with wishlisted items on sale
    // Send push notifications
  });
```

---

## 13. Security Rules

### 13.1 Firestore Rules for Shop

```javascript
// firebase-backend/firestore.rules (additions)

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ==========================================================
    // SHOP CATALOG (Read-only for clients)
    // ==========================================================

    match /PointsShopCatalog/{itemId} {
      // Anyone can read catalog
      allow read: if true;

      // Only admin can write
      allow write: if isAdmin();
    }

    match /PremiumProducts/{productId} {
      // Authenticated users can read
      allow read: if isAuth();

      // Only admin can write
      allow write: if isAdmin();
    }

    // ==========================================================
    // USER PURCHASES (User can read own, server writes)
    // ==========================================================

    match /Users/{uid}/purchases/{purchaseId} {
      // User can read own purchases
      allow read: if isAuth() && isOwner(uid);

      // Only server (Cloud Functions) can write
      allow write: if false;
    }

    // ==========================================================
    // USER WISHLIST
    // ==========================================================

    match /Users/{uid}/wishlist/{itemId} {
      // User can read own wishlist
      allow read: if isAuth() && isOwner(uid);

      // User can add/remove from wishlist
      allow create: if isAuth() && isOwner(uid) &&
        request.resource.data.keys().hasAll(['itemId', 'shopType', 'addedAt']) &&
        request.resource.data.itemId == itemId;

      allow update: if isAuth() && isOwner(uid) &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['notifyOnSale']);

      allow delete: if isAuth() && isOwner(uid);
    }

    // ==========================================================
    // GIFTS
    // ==========================================================

    match /Gifts/{giftId} {
      // Sender and recipient can read
      allow read: if isAuth() &&
        (resource.data.senderUid == request.auth.uid ||
         resource.data.recipientUid == request.auth.uid);

      // Only server can write (purchases go through Cloud Functions)
      allow write: if false;
    }

    // ==========================================================
    // PROMOTIONS (Read-only)
    // ==========================================================

    match /Promotions/{promotionId} {
      // Anyone can read active promotions
      allow read: if resource.data.active == true &&
        resource.data.startsAt <= request.time &&
        resource.data.endsAt > request.time;

      // Only admin can write
      allow write: if isAdmin();
    }

    // ==========================================================
    // DAILY DEALS (Read-only)
    // ==========================================================

    match /DailyDeals/{date}/items/{slot} {
      // Anyone can read today's deals
      allow read: if true;

      // Only server can write
      allow write: if false;
    }
  }
}
```

---

## 14. UI/UX Specifications

### 14.1 Design System

```yaml
SHOP_COLORS:
  points_shop:
    primary: "#FFD700" # Gold for tokens
    accent: "#FFA500" # Orange accent
    background: "#1A1A2E" # Dark blue background

  premium_shop:
    primary: "#9C27B0" # Purple for premium
    accent: "#E91E63" # Pink accent
    background: "#0D0D1A" # Darker background

RARITY_COLORS:
  common: "#9E9E9E" # Gray
  rare: "#2196F3" # Blue
  epic: "#9C27B0" # Purple
  legendary: "#FF9800" # Orange
  mythic: "#E91E63" # Pink (animated glow)

BADGES:
  sale:
    background: "#F44336" # Red
    text: "SALE"
  new:
    background: "#4CAF50" # Green
    text: "NEW"
  popular:
    background: "#2196F3" # Blue
    text: "POPULAR"
  limited:
    background: "#FF9800" # Orange
    text: "LIMITED"
  exclusive:
    background: "#9C27B0" # Purple
    text: "EXCLUSIVE"
```

### 14.2 Component Specifications

```typescript
// Component: ShopItemCard
/**
 * LAYOUT:
 * ┌─────────────────────────────┐
 * │ [SALE]              [♡]    │  ← Badge + Wishlist
 * │                             │
 * │         [IMAGE]            │  ← Item preview
 * │          🎩                │
 * │                             │
 * │ ─────────────────────────  │
 * │ Item Name                   │  ← Name
 * │ ⭐⭐⭐                      │  ← Rarity stars
 * │                             │
 * │ ~~200~~ 100 🪙             │  ← Price (with sale)
 * │                             │
 * │ [  PREVIEW  ] [ BUY ]      │  ← Actions
 * └─────────────────────────────┘
 *
 * STATES:
 * - Default: Available for purchase
 * - Owned: Shows "OWNED" badge, no buy button
 * - Can't Afford: Buy button disabled, price in red
 * - Out of Stock: Shows "SOLD OUT"
 * - Limited: Shows remaining count
 */

// Component: TokenPackCard
/**
 * LAYOUT:
 * ┌─────────────────────────────────────┐
 * │                                     │
 * │    🪙 1,200 TOKENS                 │  ← Token amount
 * │    +200 BONUS                       │  ← Bonus (if any)
 * │                                     │
 * │    ⭐ BEST VALUE                   │  ← Badge (if popular)
 * │                                     │
 * │    $9.99                           │  ← Localized price
 * │                                     │
 * │    [     PURCHASE     ]            │  ← Buy button
 * │                                     │
 * └─────────────────────────────────────┘
 */

// Component: PurchaseConfirmationModal
/**
 * LAYOUT:
 * ┌─────────────────────────────────────┐
 * │          Confirm Purchase           │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │         [ITEM IMAGE]               │
 * │            🎩                      │
 * │                                     │
 * │       Astronaut Helmet             │
 * │         ⭐⭐⭐ Epic                │
 * │                                     │
 * │ ─────────────────────────────────  │
 * │                                     │
 * │ Your Balance:     1,250 🪙         │
 * │ Item Price:        -400 🪙         │
 * │ ─────────────────────────────────  │
 * │ After Purchase:     850 🪙         │
 * │                                     │
 * ├─────────────────────────────────────┤
 * │ [ CANCEL ]        [ CONFIRM ]      │
 * └─────────────────────────────────────┘
 */
```

### 14.3 Animations

```yaml
ITEM_CARD_ANIMATIONS:
  on_appear:
    type: "fadeInUp"
    duration: 300ms
    stagger: 50ms per item

  on_press:
    type: "scale"
    scale: 0.95
    duration: 100ms

  rarity_glow:
    legendary:
      type: "pulse"
      color: "#FF9800"
      duration: 2000ms
    mythic:
      type: "rainbow_shimmer"
      duration: 3000ms

PURCHASE_ANIMATIONS:
  success:
    type: "confetti"
    duration: 1500ms
    followed_by: "item_fly_to_inventory"

  token_change:
    type: "count_animation"
    duration: 500ms

PAGE_TRANSITIONS:
  shop_hub_to_points:
    type: "slide_left"
    duration: 300ms

  shop_hub_to_premium:
    type: "slide_right"
    duration: 300ms
```

---

## 15. Implementation Phases

### Phase 1: Foundation (Week 1)

```yaml
TASKS:
  1.1_create_navigation_structure:
    files:
      - src/navigation/ShopNavigator.tsx
      - src/screens/shop/ShopHubScreen.tsx
    description: "Set up shop navigation with hub screen"

  1.2_create_type_definitions:
    files:
      - src/types/shop.ts
    description: "All TypeScript types for shop system"

  1.3_create_points_shop_service:
    files:
      - src/services/pointsShop.ts
    description: "Points shop catalog and purchase functions"

  1.4_create_premium_shop_service:
    files:
      - src/services/premiumShop.ts
    description: "Premium shop catalog functions"

  1.5_create_firestore_collections:
    description: "Set up PointsShopCatalog and PremiumProducts collections"

  1.6_update_security_rules:
    files:
      - firebase-backend/firestore.rules
    description: "Add shop-related security rules"

DELIVERABLES:
  - Shop hub screen with navigation to both shops
  - Type-safe service layer
  - Database structure ready
```

### Phase 2: Points Shop (Week 2)

```yaml
TASKS:
  2.1_create_points_shop_screen:
    files:
      - src/screens/shop/PointsShopScreen.tsx
    description: "Main points shop screen with tabs"

  2.2_create_shop_item_components:
    files:
      - src/components/shop/ShopItemCard.tsx
      - src/components/shop/ShopItemGrid.tsx
      - src/components/shop/CategoryTabs.tsx
      - src/components/shop/FeaturedCarousel.tsx
    description: "Reusable shop UI components"

  2.3_create_purchase_modal:
    files:
      - src/components/shop/PurchaseConfirmationModal.tsx
    description: "Purchase confirmation with preview"

  2.4_create_points_shop_hook:
    files:
      - src/hooks/usePointsShop.ts
    description: "Hook for points shop state management"

  2.5_create_purchase_cloud_function:
    files:
      - firebase-backend/functions/src/shop/purchaseWithTokens.ts
    description: "Server-side purchase validation"

  2.6_populate_shop_catalog:
    files:
      - src/data/shopExclusiveItems.ts
    description: "Create 100+ shop-exclusive items"

DELIVERABLES:
  - Fully functional points shop
  - All customization categories browsable
  - Token purchases working
```

### Phase 3: Premium Shop & IAP (Week 3)

```yaml
TASKS:
  3.1_create_premium_shop_screen:
    files:
      - src/screens/shop/PremiumShopScreen.tsx
    description: "Premium shop with IAP integration"

  3.2_implement_iap_service:
    files:
      - src/services/iap.ts (update)
    description: "Production IAP with react-native-iap"

  3.3_create_receipt_validation:
    files:
      - firebase-backend/functions/src/iap/validateReceipt.ts
    description: "Server-side receipt validation"

  3.4_create_token_pack_components:
    files:
      - src/components/shop/TokenPackCard.tsx
      - src/components/shop/PremiumBundleCard.tsx
    description: "Premium shop UI components"

  3.5_create_premium_shop_hook:
    files:
      - src/hooks/usePremiumShop.ts
    description: "Hook for premium shop state"

  3.6_app_store_setup:
    description: "Configure products in App Store Connect and Play Console"

DELIVERABLES:
  - Premium shop with real IAP
  - Token packs purchasable
  - Receipt validation working
```

### Phase 4: Additional Features (Week 4)

```yaml
TASKS:
  4.1_implement_wishlist:
    files:
      - src/services/wishlist.ts
      - src/hooks/useWishlist.ts
      - src/components/shop/WishlistButton.tsx
    description: "Wishlist functionality"

  4.2_implement_gifting:
    files:
      - src/services/gifting.ts
      - src/screens/shop/GiftScreen.tsx
      - src/components/shop/GiftModal.tsx
      - firebase-backend/functions/src/shop/gifting.ts
    description: "Gift items to friends"

  4.3_implement_daily_deals:
    files:
      - src/services/dailyDeals.ts
      - src/components/shop/DailyDealsSection.tsx
      - firebase-backend/functions/src/shop/generateDailyDeals.ts
    description: "Rotating daily deals"

  4.4_implement_purchase_history:
    files:
      - src/services/purchaseHistory.ts
      - src/screens/shop/PurchaseHistoryScreen.tsx
    description: "View past purchases"

  4.5_implement_promotions:
    files:
      - src/services/promotions.ts
      - src/components/shop/PromoBanner.tsx
    description: "Sales and promotions system"

  4.6_implement_item_preview:
    files:
      - src/hooks/useItemPreview.ts
      - src/components/shop/ItemPreviewModal.tsx
    description: "Preview items before purchase"

DELIVERABLES:
  - Complete shop experience
  - All additional features working
  - Ready for production
```

---

## 16. Testing Strategy

### 16.1 Unit Tests

```typescript
// __tests__/shop/pointsShop.test.ts

describe("Points Shop Service", () => {
  describe("getPointsShopCatalog", () => {
    it("should return catalog with correct categories");
    it("should mark owned items correctly");
    it("should calculate canAfford correctly");
    it("should filter unavailable items");
    it("should apply active promotions");
  });

  describe("purchaseWithTokens", () => {
    it("should deduct correct token amount");
    it("should grant item to inventory");
    it("should fail with insufficient funds");
    it("should fail for already owned items");
    it("should respect purchase limits");
    it("should handle out of stock items");
  });
});

// __tests__/shop/premiumShop.test.ts

describe("Premium Shop Service", () => {
  describe("purchaseTokenPack", () => {
    it("should validate receipt with Apple");
    it("should validate receipt with Google");
    it("should grant correct token amount");
    it("should handle duplicate transactions");
    it("should fail for invalid receipts");
  });

  describe("giftItem", () => {
    it("should create gift record");
    it("should notify recipient");
    it("should fail for invalid recipient");
  });
});
```

### 16.2 Integration Tests

```typescript
// __tests__/integration/shopPurchase.test.ts

describe("Shop Purchase Flow", () => {
  it("should complete points purchase end-to-end");
  it("should complete IAP purchase end-to-end");
  it("should handle purchase cancellation");
  it("should restore previous purchases");
  it("should sync inventory after purchase");
});
```

### 16.3 E2E Tests

```typescript
// e2e/shop/pointsShop.e2e.ts

describe("Points Shop E2E", () => {
  it("should navigate from profile to points shop");
  it("should browse categories");
  it("should preview item");
  it("should purchase item");
  it("should show item in inventory");
  it("should add item to wishlist");
});

// e2e/shop/premiumShop.e2e.ts

describe("Premium Shop E2E", () => {
  it("should display localized prices");
  it("should initiate IAP flow");
  it("should handle IAP cancellation");
  it("should send gift to friend");
});
```

---

## Appendix A: Product ID Reference

### App Store Products (iOS)

```yaml
TOKEN_PACKS:
  - com.snapstyle.tokens.500: $4.99, 500 tokens
  - com.snapstyle.tokens.1200: $9.99, 1200 tokens (+200 bonus)
  - com.snapstyle.tokens.2500: $19.99, 2500 tokens (+500 bonus)
  - com.snapstyle.tokens.5500: $39.99, 5500 tokens (+1500 bonus)
  - com.snapstyle.tokens.12000: $79.99, 12000 tokens (+4000 bonus)

BUNDLES:
  - com.snapstyle.bundle.starter: $2.99, Starter Pack
  - com.snapstyle.bundle.premium: $9.99, Premium Pack
  - com.snapstyle.bundle.legendary: $24.99, Legendary Pack

EXCLUSIVES:
  - com.snapstyle.exclusive.diamond_crown: $9.99
  - com.snapstyle.exclusive.holo_frame: $7.99
  - com.snapstyle.exclusive.aurora_theme: $12.99
  - com.snapstyle.exclusive.founders: $19.99 (limited)
```

### Play Store Products (Android)

```yaml
# Same as iOS with different ID format
TOKEN_PACKS:
  - snapstyle_tokens_500
  - snapstyle_tokens_1200
  - snapstyle_tokens_2500
  - snapstyle_tokens_5500
  - snapstyle_tokens_12000

BUNDLES:
  - snapstyle_bundle_starter
  - snapstyle_bundle_premium
  - snapstyle_bundle_legendary

EXCLUSIVES:
  - snapstyle_exclusive_diamond_crown
  - snapstyle_exclusive_holo_frame
  - snapstyle_exclusive_aurora_theme
  - snapstyle_exclusive_founders
```

---

## Appendix B: Feature Flags

```typescript
// constants/featureFlags.ts (additions)

export const SHOP_FEATURES = {
  // Core features
  POINTS_SHOP: true,
  PREMIUM_SHOP: true,

  // IAP
  IAP_ENABLED: !__DEV__, // Disabled in dev
  MOCK_IAP: __DEV__, // Use mock in dev

  // Additional features
  WISHLIST: true,
  GIFTING: true,
  DAILY_DEALS: true,
  PURCHASE_HISTORY: true,
  PROMOTIONS: true,
  ITEM_PREVIEW: true,

  // Debug
  DEBUG_PURCHASES: __DEV__,
  SHOW_PRODUCT_IDS: __DEV__,
};
```

---

## Appendix C: Error Codes

```typescript
// src/types/shopErrors.ts

export enum ShopErrorCode {
  // Purchase errors
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  ITEM_NOT_FOUND = "ITEM_NOT_FOUND",
  ALREADY_OWNED = "ALREADY_OWNED",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  PURCHASE_LIMIT_REACHED = "PURCHASE_LIMIT_REACHED",
  ITEM_NOT_AVAILABLE = "ITEM_NOT_AVAILABLE",

  // IAP errors
  IAP_NOT_INITIALIZED = "IAP_NOT_INITIALIZED",
  IAP_PURCHASE_CANCELLED = "IAP_PURCHASE_CANCELLED",
  IAP_PURCHASE_FAILED = "IAP_PURCHASE_FAILED",
  IAP_RECEIPT_INVALID = "IAP_RECEIPT_INVALID",
  IAP_PRODUCT_NOT_FOUND = "IAP_PRODUCT_NOT_FOUND",

  // Gift errors
  GIFT_RECIPIENT_NOT_FOUND = "GIFT_RECIPIENT_NOT_FOUND",
  GIFT_SELF_NOT_ALLOWED = "GIFT_SELF_NOT_ALLOWED",
  GIFT_EXPIRED = "GIFT_EXPIRED",

  // General errors
  NOT_AUTHENTICATED = "NOT_AUTHENTICATED",
  SERVER_ERROR = "SERVER_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
}

export const ERROR_MESSAGES: Record<ShopErrorCode, string> = {
  [ShopErrorCode.INSUFFICIENT_FUNDS]: "You don't have enough tokens",
  [ShopErrorCode.ITEM_NOT_FOUND]: "Item not found",
  [ShopErrorCode.ALREADY_OWNED]: "You already own this item",
  [ShopErrorCode.OUT_OF_STOCK]: "This item is sold out",
  [ShopErrorCode.PURCHASE_LIMIT_REACHED]: "You've reached the purchase limit",
  [ShopErrorCode.ITEM_NOT_AVAILABLE]: "This item is no longer available",
  [ShopErrorCode.IAP_NOT_INITIALIZED]: "Store not ready. Please try again",
  [ShopErrorCode.IAP_PURCHASE_CANCELLED]: "Purchase cancelled",
  [ShopErrorCode.IAP_PURCHASE_FAILED]: "Purchase failed. Please try again",
  [ShopErrorCode.IAP_RECEIPT_INVALID]: "Purchase verification failed",
  [ShopErrorCode.IAP_PRODUCT_NOT_FOUND]: "Product not available",
  [ShopErrorCode.GIFT_RECIPIENT_NOT_FOUND]: "Recipient not found",
  [ShopErrorCode.GIFT_SELF_NOT_ALLOWED]: "You cannot gift to yourself",
  [ShopErrorCode.GIFT_EXPIRED]: "This gift has expired",
  [ShopErrorCode.NOT_AUTHENTICATED]: "Please log in to continue",
  [ShopErrorCode.SERVER_ERROR]: "Something went wrong. Please try again",
  [ShopErrorCode.NETWORK_ERROR]: "Network error. Please check your connection",
};
```

---

## Document End

**Next Steps:**

1. Review and approve this plan
2. Create feature branch: `feature/shop-overhaul`
3. Begin Phase 1 implementation
4. Set up App Store Connect and Play Console products
5. Configure Cloud Function secrets for receipt validation

