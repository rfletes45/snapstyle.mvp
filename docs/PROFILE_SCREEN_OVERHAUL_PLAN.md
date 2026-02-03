# Profile Screen Overhaul - Comprehensive Plan

**Version:** 1.0
**Date:** February 1, 2026
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Feature Research & Requirements](#3-feature-research--requirements)
4. [New Type Definitions](#4-new-type-definitions)
5. [Data Architecture](#5-data-architecture)
6. [UI/UX Design Plan](#6-uiux-design-plan)
7. [Component Architecture](#7-component-architecture)
8. [Service Layer Updates](#8-service-layer-updates)
9. [Implementation Phases](#9-implementation-phases)
10. [Migration Strategy](#10-migration-strategy)
11. [Testing Plan](#11-testing-plan)

---

## 1. Executive Summary

### Vision

Transform the Profile screen from a basic settings page into a rich, personalized hub that showcases user identity, achievements, and customization options. The new profile will serve as a social centerpiece, displaying earned badges, equipped cosmetics, and providing deep customization capabilities.

### Key Goals

- **Identity Expression**: Allow users to express themselves through avatar customization, badges, and profile themes
- **Achievement Showcase**: Display earned badges prominently with tier-based visual hierarchy
- **Monetization Ready**: Support both earned (achievements) and purchased (real money/tokens) cosmetics
- **Social Engagement**: Make profiles visually compelling to encourage social interaction
- **Seamless Integration**: Connect with existing achievements, cosmetics, shop, and economy systems

### Scope

| Feature                                | Priority | Complexity |
| -------------------------------------- | -------- | ---------- |
| Profile Header Redesign                | P0       | Medium     |
| Badge Display System                   | P0       | High       |
| Extended Cosmetics (Clothing, Jewelry) | P1       | High       |
| Profile Frames/Borders                 | P1       | Medium     |
| Chat Message Borders                   | P1       | Medium     |
| Profile Themes                         | P2       | Medium     |
| Stats Dashboard                        | P2       | Low        |
| Achievement Progress                   | P1       | Medium     |

---

## 2. Current State Analysis

### 2.1 Current ProfileScreen.tsx

**Location:** `src/screens/profile/ProfileScreen.tsx`

**Current Features:**

- Basic avatar display with customization modal
- Display name editing
- Username/email display (read-only)
- Navigation buttons: Wallet, Shop, Daily Tasks, Settings, Debug, Blocked Users
- Sign out functionality

**Current Limitations:**

- No badge/achievement display
- Limited avatar customization (only hat, glasses, background, color)
- No profile statistics
- No profile themes or personalization beyond avatar
- Button-heavy layout with no visual hierarchy

### 2.2 Current Cosmetics System

**Location:** `src/data/cosmetics.ts`

**Current Slots:**

```typescript
type CosmeticSlot = "hat" | "glasses" | "background";
```

**Current Unlock Types:**

```typescript
type UnlockType = "free" | "milestone" | "starter";
```

**Current Rarity:**

```typescript
type Rarity = "common" | "rare" | "epic";
```

### 2.3 Current Achievement System

**Location:** `src/data/gameAchievements.ts`, `src/types/achievements.ts`

**Achievement Unlocks Already Support:**

```typescript
type AchievementUnlockType =
  | "avatar_frame" // Profile frame cosmetic
  | "badge" // Profile badge
  | "title" // Display title
  | "theme" // App theme
  | "cosmetic"; // Other cosmetic item
```

**Existing Badge References in Achievements:**

- `game_master_badge`
- `flappy_master_badge`
- `bounce_legend_badge`
- `combo_master_badge`
- `perfect_memory_badge`
- `lightning_memory_badge`
- `2048_champion_badge`
- `mega_snake_badge`
- `veteran_badge`
- `unstoppable_badge`
- `mp_veteran_badge`

### 2.4 Current Avatar System

**Location:** `src/components/Avatar.tsx`, `src/components/AvatarCustomizer.tsx`

**Current AvatarConfig:**

```typescript
interface AvatarConfig {
  baseColor: string;
  hat?: string;
  glasses?: string;
  background?: string;
}
```

### 2.5 Current Shop System

**Location:** `src/services/shop.ts`, `src/screens/shop/ShopScreen.tsx`

- Supports featured items with countdown timers
- Category-based browsing (hats, glasses, backgrounds)
- Token-based purchases
- Real-time catalog updates
- Owned item indicators

### 2.6 Current Economy System

**Location:** `src/services/economy.ts`

- Token-based soft currency
- Transaction history
- Real-time balance updates
- Cloud Function-based purchases for security

---

## 3. Feature Research & Requirements

### 3.1 Badge System

#### Requirements

| Requirement    | Description                                   | Priority |
| -------------- | --------------------------------------------- | -------- |
| Badge Display  | Show earned badges on profile                 | P0       |
| Badge Tiers    | Visual distinction by tier (bronze → diamond) | P0       |
| Badge Showcase | Pin favorite badges (3-5 featured)            | P1       |
| Badge Details  | Tap badge to see how it was earned            | P1       |
| Badge Progress | Show progress toward unearned badges          | P2       |
| Badge Rarity   | Track how many users have each badge          | P2       |

#### Badge Visual Design

```
Tier Colors (from existing TIER_COLORS):
- Bronze:   #CD7F32
- Silver:   #C0C0C0
- Gold:     #FFD700
- Platinum: #E5E4E2
- Diamond:  #B9F2FF
```

#### Badge Data Structure

```typescript
interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or icon name
  tier: AchievementTier;
  category: BadgeCategory;
  earnedVia: string; // Achievement ID that grants this badge
  rarity: number; // Percentage of users who have it
}

interface UserBadgeData {
  badgeId: string;
  earnedAt: number;
  featured: boolean; // User has pinned this badge
  displayOrder?: number; // Order in featured badges
}
```

### 3.2 Extended Cosmetics System

#### New Cosmetic Slots

| Slot              | Description               | Examples                        |
| ----------------- | ------------------------- | ------------------------------- |
| `clothing_top`    | Upper body clothing       | T-shirts, hoodies, jackets      |
| `clothing_bottom` | Lower body (if visible)   | Pants, shorts, skirts           |
| `accessory_neck`  | Neck accessories          | Necklaces, chains, scarves      |
| `accessory_ear`   | Ear accessories           | Earrings, headphones            |
| `accessory_hand`  | Hand/wrist items          | Watches, bracelets, rings       |
| `profile_frame`   | Avatar border/frame       | Animated frames, themed borders |
| `profile_banner`  | Profile background banner | Patterns, gradients, images     |
| `chat_bubble`     | Message bubble style      | Colors, gradients, patterns     |
| `name_effect`     | Display name styling      | Colors, gradients, animations   |

#### Extended CosmeticItem Type

```typescript
interface CosmeticItem {
  id: string;
  name: string;
  description?: string;
  slot: ExtendedCosmeticSlot;
  imagePath: string;
  previewPath?: string; // For animated previews
  rarity: CosmeticRarity;

  // Unlock methods
  unlock: {
    type:
      | "free"
      | "milestone"
      | "starter"
      | "achievement"
      | "purchase"
      | "premium";
    achievementId?: string; // If unlocked via achievement
    priceTokens?: number; // If purchasable with tokens
    priceUSD?: number; // If purchasable with real money
  };

  // Display properties
  animated?: boolean;
  animationData?: {
    type: "lottie" | "spritesheet" | "css";
    duration?: number;
  };

  // Availability
  limitedTime?: {
    availableFrom: number;
    availableTo: number;
  };
  exclusive?: boolean; // Cannot be purchased, only earned
}
```

#### New Rarity Tier

```typescript
type CosmeticRarity = "common" | "rare" | "epic" | "legendary" | "mythic";

const RARITY_COLORS = {
  common: "#9E9E9E", // Gray
  rare: "#2196F3", // Blue
  epic: "#9C27B0", // Purple
  legendary: "#FF9800", // Orange
  mythic: "#E91E63", // Pink/Red
};
```

### 3.3 Profile Frame System

#### Requirements

- Frames wrap around the avatar
- Support for static and animated frames
- Tier-based visual effects (glow, particles)
- Achievement-unlocked exclusive frames

#### Frame Categories

| Category    | Source                    | Examples                                |
| ----------- | ------------------------- | --------------------------------------- |
| Achievement | Earned via achievements   | Game master frame, 100-day streak frame |
| Seasonal    | Limited-time events       | Halloween frame, Valentine's frame      |
| Premium     | Shop purchase (tokens)    | Neon frame, Galaxy frame                |
| Exclusive   | Special events/promotions | Beta tester frame, Anniversary frame    |

#### Frame Data Structure

```typescript
interface ProfileFrame {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  tier: FrameTier;
  animated: boolean;

  // Visual effects
  effects?: {
    glow?: { color: string; intensity: number };
    particles?: { type: string; color: string };
    animation?: { type: string; duration: number };
  };

  unlock: CosmeticUnlock;
}
```

### 3.4 Chat Message Borders/Bubbles

#### Requirements

- Custom bubble colors/gradients
- Bubble border styles
- Special effects (shimmer, glow)
- Preview in customization UI

#### Chat Bubble Styles

```typescript
interface ChatBubbleStyle {
  id: string;
  name: string;

  // Styling
  backgroundColor: string | GradientConfig;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;

  // Effects
  effect?: "none" | "shimmer" | "glow" | "pulse";
  effectColor?: string;

  // Text styling
  textColor?: string;
  fontStyle?: "normal" | "bold" | "italic";

  unlock: CosmeticUnlock;
}
```

### 3.5 Profile Themes

#### Requirements

- Full profile screen theming
- Background patterns/colors
- Accent color customization
- Font/typography options

#### Theme Data Structure

```typescript
interface ProfileTheme {
  id: string;
  name: string;
  description: string;
  previewImage: string;

  // Colors
  backgroundColor: string | GradientConfig;
  accentColor: string;
  textColor: string;
  cardColor: string;

  // Background
  backgroundPattern?: string;
  backgroundImage?: string;
  backgroundOpacity?: number;

  // Effects
  headerEffect?: "none" | "blur" | "gradient" | "parallax";

  unlock: CosmeticUnlock;
}
```

### 3.6 Stats Dashboard

#### User Statistics to Display

| Stat            | Source             | Display               |
| --------------- | ------------------ | --------------------- |
| Games Played    | GameSessions       | Total count           |
| Games Won       | MultiplayerStats   | Win count + rate      |
| Highest Streaks | Friends collection | Best streak achieved  |
| Total Badges    | UserBadges         | Badge count           |
| Achievements    | PlayerAchievements | Completion percentage |
| Days Active     | User.createdAt     | Account age           |
| Friends Count   | Friends collection | Friend count          |
| Level/XP        | Economy system     | Level + progress bar  |

---

## 4. New Type Definitions

### 4.1 Extended Models (`src/types/models.ts` additions)

```typescript
// =============================================================================
// Extended Cosmetics System
// =============================================================================

/**
 * Extended cosmetic slots for full avatar customization
 */
export type ExtendedCosmeticSlot =
  // Existing slots
  | "hat"
  | "glasses"
  | "background"
  // New avatar slots
  | "clothing_top"
  | "clothing_bottom"
  | "accessory_neck"
  | "accessory_ear"
  | "accessory_hand"
  // Profile customization slots
  | "profile_frame"
  | "profile_banner"
  | "profile_theme"
  // Chat customization
  | "chat_bubble"
  | "name_effect";

/**
 * Extended cosmetic rarity tiers
 */
export type ExtendedCosmeticRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

/**
 * Cosmetic unlock configuration
 */
export interface CosmeticUnlock {
  type:
    | "free"
    | "starter"
    | "milestone"
    | "achievement"
    | "purchase"
    | "premium"
    | "exclusive";
  // For milestone unlocks
  milestoneType?: "streak" | "level" | "games_played";
  milestoneValue?: number;
  // For achievement unlocks
  achievementId?: string;
  // For purchasable items
  priceTokens?: number;
  priceUSD?: number;
  // For premium/exclusive items
  source?: string; // e.g., "battle_pass_s1", "beta_tester"
}

/**
 * Gradient configuration for visual effects
 */
export interface GradientConfig {
  type: "linear" | "radial";
  colors: string[];
  angle?: number; // For linear gradients
  centerX?: number; // For radial gradients (0-1)
  centerY?: number;
}

/**
 * Extended cosmetic item with new properties
 */
export interface ExtendedCosmeticItem {
  id: string;
  name: string;
  description?: string;
  slot: ExtendedCosmeticSlot;
  imagePath: string;
  previewPath?: string;
  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;

  // Animation support
  animated?: boolean;
  animationConfig?: {
    type: "lottie" | "spritesheet" | "css";
    duration?: number;
    loop?: boolean;
  };

  // Visual effects
  effects?: {
    glow?: { color: string; intensity: number };
    particles?: { type: string; color: string; count: number };
    shimmer?: { color: string; speed: number };
  };

  // Availability
  availableFrom?: number;
  availableTo?: number;
  exclusive?: boolean;

  // Metadata
  tags?: string[];
  setId?: string; // For cosmetic sets
  sortOrder?: number;
}

// =============================================================================
// Badge System
// =============================================================================

/**
 * Badge category for organization
 */
export type BadgeCategory =
  | "games" // Game-related achievements
  | "social" // Friend/social achievements
  | "streak" // Streak achievements
  | "collection" // Cosmetic collection achievements
  | "special" // Limited-time or secret badges
  | "seasonal"; // Seasonal event badges

/**
 * Badge definition
 */
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or MaterialCommunityIcon name
  tier: AchievementTier;
  category: BadgeCategory;

  // How to earn
  earnedVia: {
    type: "achievement" | "milestone" | "event" | "purchase";
    achievementId?: string;
    milestoneType?: string;
    milestoneValue?: number;
    eventId?: string;
  };

  // Visual display
  frameColor?: string; // Border color
  animated?: boolean;
  animationData?: string; // Lottie JSON path

  // Metadata
  hidden?: boolean; // Secret badge
  limitedTime?: boolean;
  availableFrom?: number;
  availableTo?: number;
}

/**
 * User's earned badge record
 * Collection: Users/{uid}/Badges/{badgeId}
 */
export interface UserBadge {
  badgeId: string;
  earnedAt: number;
  featured: boolean; // Pinned to profile showcase
  displayOrder?: number; // Order in featured badges (1-5)
  earnedVia?: {
    achievementId?: string;
    eventId?: string;
    meta?: Record<string, unknown>;
  };
}

// =============================================================================
// Profile Frame System
// =============================================================================

/**
 * Frame tier for visual hierarchy
 */
export type FrameTier = "basic" | "premium" | "elite" | "legendary";

/**
 * Profile frame definition
 */
export interface ProfileFrame {
  id: string;
  name: string;
  description: string;
  tier: FrameTier;
  rarity: ExtendedCosmeticRarity;

  // Visual assets
  staticImagePath: string; // Static fallback
  animatedImagePath?: string; // Animated version (Lottie/GIF)

  // Visual effects
  effects?: {
    glow?: {
      color: string;
      intensity: number; // 0-1
      animated?: boolean;
    };
    particles?: {
      type: "sparkle" | "fire" | "snow" | "hearts" | "stars";
      color: string;
      density: number; // Particles per second
    };
    border?: {
      width: number;
      style: "solid" | "dashed" | "dotted" | "gradient";
      color: string | GradientConfig;
    };
  };

  unlock: CosmeticUnlock;
  sortOrder?: number;
}

// =============================================================================
// Chat Bubble Customization
// =============================================================================

/**
 * Chat bubble style definition
 */
export interface ChatBubbleStyle {
  id: string;
  name: string;
  description?: string;
  rarity: ExtendedCosmeticRarity;

  // Bubble styling
  background: string | GradientConfig;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;

  // Effects
  effect?: "none" | "shimmer" | "glow" | "pulse" | "gradient-shift";
  effectColor?: string;
  effectSpeed?: number;

  // Text styling
  textColor?: string;
  linkColor?: string;

  unlock: CosmeticUnlock;
  sortOrder?: number;
}

// =============================================================================
// Profile Theme System
// =============================================================================

/**
 * Profile theme definition
 */
export interface ProfileTheme {
  id: string;
  name: string;
  description: string;
  previewImagePath: string;
  rarity: ExtendedCosmeticRarity;

  // Color scheme
  colors: {
    background: string | GradientConfig;
    surface: string;
    surfaceVariant: string;
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
  };

  // Background customization
  backgroundPattern?: {
    type: "dots" | "lines" | "grid" | "custom";
    color: string;
    opacity: number;
    customPath?: string;
  };
  backgroundImage?: string;
  backgroundBlur?: number;

  // Header effects
  headerStyle?: {
    type: "solid" | "gradient" | "image" | "blur";
    value?: string | GradientConfig;
  };

  unlock: CosmeticUnlock;
  sortOrder?: number;
}

// =============================================================================
// Extended Avatar Config
// =============================================================================

/**
 * Extended avatar configuration with all cosmetic slots
 */
export interface ExtendedAvatarConfig {
  // Base
  baseColor: string;

  // Existing slots
  hat?: string;
  glasses?: string;
  background?: string;

  // New avatar slots
  clothingTop?: string;
  clothingBottom?: string;
  accessoryNeck?: string;
  accessoryEar?: string;
  accessoryHand?: string;

  // Profile customization
  profileFrame?: string;
  profileBanner?: string;
  profileTheme?: string;

  // Chat customization
  chatBubble?: string;
  nameEffect?: string;

  // Featured badges (max 5)
  featuredBadges?: string[];
}

// =============================================================================
// User Profile Extended
// =============================================================================

/**
 * Extended user profile for profile screen
 */
export interface ExtendedUserProfile {
  // Basic info
  uid: string;
  username: string;
  displayName: string;
  avatarConfig: ExtendedAvatarConfig;

  // Account info
  createdAt: number;
  lastActive: number;

  // Stats
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    winRate: number;
    highestStreak: number;
    currentStreak: number;
    totalBadges: number;
    achievementProgress: number; // 0-100 percentage
    friendCount: number;
    daysActive: number;
  };

  // Level system
  level: {
    current: number;
    xp: number;
    xpToNextLevel: number;
    totalXp: number;
  };

  // Customization
  featuredBadges: UserBadge[];
  equippedCosmetics: Record<ExtendedCosmeticSlot, string | undefined>;
}
```

### 4.2 New Type File: `src/types/profile.ts`

```typescript
/**
 * Profile-specific type definitions
 *
 * Contains types for profile screen, customization, and related features.
 */

import type {
  AchievementTier,
  BadgeCategory,
  ExtendedAvatarConfig,
  ExtendedCosmeticRarity,
  ExtendedCosmeticSlot,
  GradientConfig,
  UserBadge,
} from "./models";

// =============================================================================
// Profile Screen Types
// =============================================================================

/**
 * Profile section for UI organization
 */
export type ProfileSection =
  | "header" // Avatar, name, level
  | "badges" // Featured badges
  | "stats" // Statistics dashboard
  | "achievements" // Achievement progress
  | "customization" // Customization options
  | "actions"; // Navigation buttons

/**
 * Profile tab for customization modal
 */
export type ProfileCustomizationTab =
  | "avatar" // Avatar appearance
  | "clothing" // Clothing items
  | "accessories" // Accessories
  | "frame" // Profile frame
  | "theme" // Profile theme
  | "chat" // Chat bubble
  | "badges"; // Badge showcase

/**
 * Profile stats card data
 */
export interface ProfileStatCard {
  id: string;
  label: string;
  value: number | string;
  icon: string;
  color?: string;
  trend?: {
    direction: "up" | "down" | "neutral";
    value: number;
    period: string;
  };
}

// =============================================================================
// Badge Display Types
// =============================================================================

/**
 * Badge display mode for different contexts
 */
export type BadgeDisplayMode =
  | "compact" // Small icon only
  | "standard" // Icon + name
  | "detailed" // Full card with description
  | "showcase"; // Featured badge with effects

/**
 * Badge filter options
 */
export interface BadgeFilterOptions {
  category?: BadgeCategory;
  tier?: AchievementTier;
  earned?: boolean;
  featured?: boolean;
  search?: string;
}

/**
 * Badge sort options
 */
export type BadgeSortOption =
  | "newest"
  | "oldest"
  | "rarity"
  | "category"
  | "name";

// =============================================================================
// Customization Preview Types
// =============================================================================

/**
 * Customization preview state
 */
export interface CustomizationPreview {
  // Current equipped items
  current: ExtendedAvatarConfig;
  // Preview items (not yet saved)
  preview: ExtendedAvatarConfig;
  // Changed slots
  changedSlots: ExtendedCosmeticSlot[];
  // Has unsaved changes
  hasChanges: boolean;
}

/**
 * Cosmetic item display with status
 */
export interface CosmeticItemDisplay {
  id: string;
  name: string;
  description?: string;
  slot: ExtendedCosmeticSlot;
  rarity: ExtendedCosmeticRarity;
  imagePath: string;

  // Status
  owned: boolean;
  equipped: boolean;
  locked: boolean;

  // Unlock info
  unlockMethod?: string; // Human-readable unlock description
  unlockProgress?: {
    current: number;
    target: number;
    percentage: number;
  };

  // Purchase info (if purchasable)
  priceTokens?: number;
  priceUSD?: number;
  canAfford?: boolean;
}

// =============================================================================
// Profile Action Types
// =============================================================================

/**
 * Profile action button configuration
 */
export interface ProfileAction {
  id: string;
  label: string;
  icon: string;
  color?: string;
  onPress: () => void;
  badge?: number; // Notification badge count
  disabled?: boolean;
}

/**
 * Profile navigation destination
 */
export type ProfileDestination =
  | "Shop"
  | "Wallet"
  | "Tasks"
  | "Settings"
  | "BlockedUsers"
  | "Achievements"
  | "Customization"
  | "BadgeCollection"
  | "Stats"
  | "Friends";
```

---

## 5. Data Architecture

### 5.1 Firestore Collections

#### New Collections

```
Badges/{badgeId}                    # Badge definitions
  - id: string
  - name: string
  - description: string
  - icon: string
  - tier: AchievementTier
  - category: BadgeCategory
  - earnedVia: { type, achievementId?, ... }
  - hidden: boolean
  - ...

ProfileFrames/{frameId}             # Frame definitions
  - id: string
  - name: string
  - tier: FrameTier
  - staticImagePath: string
  - animatedImagePath?: string
  - effects: { glow?, particles?, border? }
  - unlock: CosmeticUnlock
  - ...

ChatBubbleStyles/{styleId}          # Chat bubble style definitions
  - id: string
  - name: string
  - background: string | GradientConfig
  - effect?: string
  - unlock: CosmeticUnlock
  - ...

ProfileThemes/{themeId}             # Profile theme definitions
  - id: string
  - name: string
  - colors: { ... }
  - backgroundPattern?: { ... }
  - unlock: CosmeticUnlock
  - ...
```

#### Updated Collections

```
Users/{uid}
  - avatarConfig → extendedAvatarConfig: ExtendedAvatarConfig
  + level: { current, xp, xpToNextLevel, totalXp }
  + statsCache: { gamesPlayed, gamesWon, ... }  # Denormalized for fast reads

Users/{uid}/Badges/{badgeId}        # Earned badges
  - badgeId: string
  - earnedAt: number
  - featured: boolean
  - displayOrder?: number
  - earnedVia?: { ... }

Users/{uid}/inventory/{itemId}      # Extended to include new cosmetic types
  - itemId: string
  - acquiredAt: number
  + slot: ExtendedCosmeticSlot      # For easy filtering
```

### 5.2 Data Relationships

```
┌─────────────────┐     ┌─────────────────┐
│   Achievement   │────▶│      Badge      │
│   Definition    │     │   Definition    │
└─────────────────┘     └─────────────────┘
        │                       │
        │ triggers              │ references
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ UserAchievement │────▶│    UserBadge    │
│   (earned)      │     │   (earned)      │
└─────────────────┘     └─────────────────┘
                              │
                              │ displayed in
                              ▼
                        ┌─────────────────┐
                        │ ExtendedAvatar  │
                        │     Config      │
                        └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────▼─────┐       ┌─────▼─────┐
              │ ProfileFrame│     │ChatBubble │
              │ (equipped) │     │ (equipped)│
              └───────────┘       └───────────┘
```

### 5.3 Caching Strategy

```typescript
// Profile data caching (in UserContext or dedicated ProfileContext)
interface ProfileCache {
  // User data
  profile: ExtendedUserProfile | null;
  lastFetched: number;

  // Badges
  earnedBadges: UserBadge[];
  allBadges: Badge[]; // Definitions
  badgesLastFetched: number;

  // Inventory
  inventory: Map<ExtendedCosmeticSlot, string[]>;
  inventoryLastFetched: number;

  // Stats
  stats: ProfileStats;
  statsLastFetched: number;
}

// Cache invalidation triggers
const CACHE_INVALIDATION = {
  profile: ["profile_updated", "avatar_changed"],
  badges: ["achievement_earned", "badge_featured"],
  inventory: ["item_purchased", "item_earned"],
  stats: ["game_played", "achievement_earned", "friend_added"],
};
```

---

## 6. UI/UX Design Plan

### 6.1 Profile Screen Layout

```
┌────────────────────────────────────────┐
│ ← Profile                    ⚙️ Settings│
├────────────────────────────────────────┤
│                                        │
│     ┌──────────────────────┐           │
│     │    ╭──────────╮      │  Level 24 │
│     │    │  AVATAR  │      │  ████████░│
│     │    │  +FRAME  │      │  2,450 XP │
│     │    ╰──────────╯      │           │
│     │    @username         │           │
│     │    Display Name      │           │
│     │    ✏️ Edit           │           │
│     └──────────────────────┘           │
│                                        │
├────────────────────────────────────────┤
│  Featured Badges                  ▶ All│
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 🏆  │ │ 🎮  │ │ 🔥  │ │ ⭐  │      │
│  │Gold │ │Game │ │Fire │ │Star │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                        │
├────────────────────────────────────────┤
│  Stats                                 │
│  ┌──────────┐ ┌──────────┐            │
│  │  🎮 156  │ │  🏆 89   │            │
│  │  Games   │ │  Wins    │            │
│  └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐            │
│  │  🔥 42   │ │  👥 28   │            │
│  │  Streak  │ │ Friends  │            │
│  └──────────┘ └──────────┘            │
│                                        │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │ 🎨 Customize Profile         →   │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 💰 My Wallet                 →   │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 🏪 Shop                      →   │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 📋 Daily Tasks              (3)  │  │
│  └──────────────────────────────────┘  │
│                                        │
└────────────────────────────────────────┘
```

### 6.2 Customization Modal

```
┌────────────────────────────────────────┐
│ Customize                           ✕  │
├────────────────────────────────────────┤
│                                        │
│         ┌──────────────────┐           │
│         │    LIVE PREVIEW  │           │
│         │    (Avatar with  │           │
│         │    all equipped  │           │
│         │    items)        │           │
│         └──────────────────┘           │
│                                        │
├────────────────────────────────────────┤
│ [Avatar][Clothes][Frame][Theme][Chat]  │
├────────────────────────────────────────┤
│                                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 👕 │ │ 👔 │ │ 🎽 │ │ 🧥 │      │
│  │ Own │ │ Own │ │ 🔒 │ │$50 │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 👚 │ │ 🎒 │ │ ... │ │ ... │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                        │
├────────────────────────────────────────┤
│     [Cancel]           [Save Changes]  │
└────────────────────────────────────────┘
```

### 6.3 Badge Collection Screen

```
┌────────────────────────────────────────┐
│ ← Badges                    🔍 Search  │
├────────────────────────────────────────┤
│ [All] [Games] [Social] [Streak] [Rare] │
├────────────────────────────────────────┤
│                                        │
│  Earned (24/86)                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 🏆  │ │ 🎮  │ │ 🔥  │ │ ⭐  │      │
│  │Gold │ │Mstr │ │Fire │ │Star │      │
│  │ ⭐  │ │     │ │     │ │ ⭐  │ ←Featured│
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                        │
│  In Progress (12)                      │
│  ┌─────────────────────────────────┐   │
│  │ 🎯 Game Veteran       45/100   │   │
│  │ ████████████░░░░░░░░░  45%     │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 🔥 Streak Master      28/30    │   │
│  │ █████████████████░░░░  93%     │   │
│  └─────────────────────────────────┘   │
│                                        │
│  Locked (50)                      ▼    │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 🔒  │ │ 🔒  │ │ 🔒  │ │ 🔒  │      │
│  │ ??? │ │ ??? │ │ ??? │ │ ??? │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                        │
└────────────────────────────────────────┘
```

### 6.4 Badge Detail Modal

```
┌────────────────────────────────────────┐
│                                     ✕  │
├────────────────────────────────────────┤
│                                        │
│              ┌─────────┐               │
│              │   🏆    │               │
│              │  GOLD   │               │
│              │  GLOW   │               │
│              └─────────┘               │
│                                        │
│           Game Master                  │
│       "Play all game types"            │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  Tier:     ⭐⭐⭐ Gold            │  │
│  │  Category: Games                 │  │
│  │  Earned:   Jan 15, 2026          │  │
│  │  Rarity:   2.3% of players       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ⭐ Feature on Profile            │  │
│  └──────────────────────────────────┘  │
│                                        │
│              [Close]                   │
└────────────────────────────────────────┘
```

---

## 7. Component Architecture

### 7.1 New Components

```
src/components/
├── profile/
│   ├── ProfileHeader.tsx           # Avatar, name, level display
│   ├── ProfileStats.tsx            # Stats grid
│   ├── ProfileActions.tsx          # Action buttons list
│   ├── LevelProgress.tsx           # XP progress bar
│   └── EditProfileModal.tsx        # Name/basic info editing
│
├── badges/
│   ├── BadgeCard.tsx               # Individual badge display
│   ├── BadgeGrid.tsx               # Grid of badges
│   ├── BadgeShowcase.tsx           # Featured badges row
│   ├── BadgeDetailModal.tsx        # Badge detail popup
│   ├── BadgeProgress.tsx           # Progress toward badge
│   └── BadgeFilter.tsx             # Filter/sort controls
│
├── customization/
│   ├── CustomizationModal.tsx      # Main customization modal
│   ├── AvatarPreview.tsx           # Live preview with all items
│   ├── CosmeticGrid.tsx            # Grid of cosmetic items
│   ├── CosmeticItem.tsx            # Individual item card
│   ├── FramePreview.tsx            # Frame preview with effects
│   ├── ThemePreview.tsx            # Theme preview
│   └── ChatBubblePreview.tsx       # Chat bubble preview
│
├── Avatar.tsx                      # UPDATED: Support frames
├── AvatarCustomizer.tsx            # DEPRECATED: Replaced by CustomizationModal
└── AvatarWithFrame.tsx             # NEW: Avatar with frame wrapper
```

### 7.2 Screen Structure

```
src/screens/profile/
├── ProfileScreen.tsx               # REFACTORED: Main profile screen
├── BadgeCollectionScreen.tsx       # NEW: All badges view
├── AchievementsScreen.tsx          # NEW: Achievement progress
├── StatsScreen.tsx                 # NEW: Detailed statistics
└── CustomizationScreen.tsx         # NEW: Full customization (optional)
```

### 7.3 Component Props Interfaces

```typescript
// ProfileHeader
interface ProfileHeaderProps {
  profile: ExtendedUserProfile;
  onEditProfile: () => void;
  onAvatarPress: () => void;
}

// BadgeShowcase
interface BadgeShowcaseProps {
  badges: UserBadge[];
  maxDisplay?: number;
  onBadgePress: (badge: UserBadge) => void;
  onViewAll: () => void;
}

// CosmeticItem
interface CosmeticItemProps {
  item: CosmeticItemDisplay;
  selected: boolean;
  onSelect: () => void;
  onPurchase?: () => void;
  showPrice?: boolean;
}

// AvatarWithFrame
interface AvatarWithFrameProps {
  config: ExtendedAvatarConfig;
  size?: number;
  frame?: ProfileFrame | null;
  showEffects?: boolean;
  onPress?: () => void;
}
```

---

## 8. Service Layer Updates

### 8.1 New Services

```typescript
// src/services/badges.ts
export async function getAllBadges(): Promise<Badge[]>;
export async function getUserBadges(uid: string): Promise<UserBadge[]>;
export async function featureBadge(
  uid: string,
  badgeId: string,
  order: number,
): Promise<boolean>;
export async function unfeatureBadge(
  uid: string,
  badgeId: string,
): Promise<boolean>;
export function subscribeToBadges(
  uid: string,
  onUpdate: (badges: UserBadge[]) => void,
): () => void;

// src/services/profileFrames.ts
export async function getAllFrames(): Promise<ProfileFrame[]>;
export async function getUserFrames(uid: string): Promise<string[]>;
export async function equipFrame(
  uid: string,
  frameId: string,
): Promise<boolean>;

// src/services/chatBubbles.ts
export async function getAllBubbleStyles(): Promise<ChatBubbleStyle[]>;
export async function getUserBubbleStyles(uid: string): Promise<string[]>;
export async function equipBubbleStyle(
  uid: string,
  styleId: string,
): Promise<boolean>;

// src/services/profileThemes.ts
export async function getAllThemes(): Promise<ProfileTheme[]>;
export async function getUserThemes(uid: string): Promise<string[]>;
export async function equipTheme(
  uid: string,
  themeId: string,
): Promise<boolean>;

// src/services/profileStats.ts
export async function getProfileStats(uid: string): Promise<ProfileStats>;
export async function getLevelInfo(uid: string): Promise<LevelInfo>;
export function subscribeToStats(
  uid: string,
  onUpdate: (stats: ProfileStats) => void,
): () => void;
```

### 8.2 Updated Services

```typescript
// src/services/cosmetics.ts - Extensions
export async function getExtendedInventory(
  uid: string,
): Promise<Map<ExtendedCosmeticSlot, string[]>>;
export async function updateExtendedAvatarConfig(
  uid: string,
  config: ExtendedAvatarConfig,
): Promise<boolean>;

// src/services/gameAchievements.ts - Extensions
export async function grantBadgeForAchievement(
  uid: string,
  achievementId: string,
): Promise<void>;
export async function checkBadgeUnlocks(
  uid: string,
  achievementId: string,
): Promise<Badge | null>;

// src/services/shop.ts - Extensions
export async function getExtendedShopCatalog(
  uid: string,
): Promise<ExtendedShopItem[]>;
export async function purchaseCosmetic(
  uid: string,
  itemId: string,
  paymentMethod: "tokens" | "usd",
): Promise<PurchaseResult>;
```

### 8.3 New Hooks

```typescript
// src/hooks/useProfileData.ts
export function useProfileData(uid: string): {
  profile: ExtendedUserProfile | null;
  stats: ProfileStats | null;
  badges: UserBadge[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

// src/hooks/useBadges.ts
export function useBadges(uid: string): {
  earnedBadges: UserBadge[];
  allBadges: Badge[];
  featuredBadges: UserBadge[];
  loading: boolean;
  featureBadge: (badgeId: string, order: number) => Promise<void>;
  unfeatureBadge: (badgeId: string) => Promise<void>;
};

// src/hooks/useCustomization.ts
export function useCustomization(uid: string): {
  currentConfig: ExtendedAvatarConfig;
  previewConfig: ExtendedAvatarConfig;
  inventory: Map<ExtendedCosmeticSlot, CosmeticItemDisplay[]>;
  setPreviewItem: (slot: ExtendedCosmeticSlot, itemId: string | null) => void;
  saveChanges: () => Promise<boolean>;
  discardChanges: () => void;
  hasChanges: boolean;
  saving: boolean;
};
```

---

## 9. Implementation Phases (AI-Optimized)

> **IMPORTANT FOR AI IMPLEMENTATION**: Each phase below contains exact file paths, complete code templates, and step-by-step instructions. Follow each task in order. Copy code templates exactly, then modify as specified. All imports use the `@/` alias which maps to `src/`.

---

### Phase 1: Foundation (Week 1-2)

**Goal:** Core type definitions, data architecture, and feature flags

**Prerequisites:** None - this is the foundation phase

---

#### Task 1.1: Create Feature Flags

**File:** `constants/featureFlags.ts`
**Action:** ADD the following to the end of the file (before the final export if any)

```typescript
// =============================================================================
// Profile Overhaul Feature Flags
// =============================================================================

/**
 * Profile overhaul feature flags
 * Enable these progressively as each phase completes
 */
export const PROFILE_FEATURES = {
  /** Phase 1: Extended avatar config with new slots */
  EXTENDED_AVATAR_CONFIG: true,

  /** Phase 2: Badge system - display earned badges */
  BADGE_SYSTEM: false,

  /** Phase 2: Badge showcase on profile */
  BADGE_SHOWCASE: false,

  /** Phase 3: New profile layout with stats */
  NEW_PROFILE_LAYOUT: false,

  /** Phase 3: Profile statistics dashboard */
  PROFILE_STATS: false,

  /** Phase 3: XP-based level system */
  LEVEL_SYSTEM: false,

  /** Phase 4: Extended cosmetics (clothing, accessories) */
  EXTENDED_COSMETICS: false,

  /** Phase 4: Profile frames around avatars */
  PROFILE_FRAMES: false,

  /** Phase 5: Profile theme customization */
  PROFILE_THEMES: false,

  /** Phase 5: Custom chat bubble styles */
  CHAT_BUBBLES: false,

  /** Phase 6: In-app purchases for cosmetics */
  COSMETIC_IAP: false,
} as const;
```

---

#### Task 1.2: Create Profile Types File

**File:** `src/types/profile.ts` (NEW FILE)
**Action:** CREATE with the following content

```typescript
/**
 * Profile-specific type definitions
 *
 * Contains types for profile screen, customization, badges, and related features.
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 */

import type { AchievementTier } from "./achievements";

// =============================================================================
// Extended Cosmetic System Types
// =============================================================================

/**
 * All available cosmetic slots for avatar and profile customization
 */
export type ExtendedCosmeticSlot =
  // Existing avatar slots (from current AvatarConfig)
  | "hat"
  | "glasses"
  | "background"
  // New avatar appearance slots
  | "clothing_top"
  | "clothing_bottom"
  | "accessory_neck"
  | "accessory_ear"
  | "accessory_hand"
  // Profile customization slots
  | "profile_frame"
  | "profile_banner"
  | "profile_theme"
  // Chat customization
  | "chat_bubble"
  | "name_effect";

/**
 * Extended rarity system with 5 tiers
 */
export type ExtendedCosmeticRarity =
  | "common" // Gray - most items
  | "rare" // Blue - some effort to obtain
  | "epic" // Purple - significant effort
  | "legendary" // Orange - very rare
  | "mythic"; // Pink - ultra-rare, exclusive

/**
 * Rarity color mapping for UI display
 */
export const RARITY_COLORS: Record<ExtendedCosmeticRarity, string> = {
  common: "#9E9E9E",
  rare: "#2196F3",
  epic: "#9C27B0",
  legendary: "#FF9800",
  mythic: "#E91E63",
};

/**
 * Cosmetic unlock configuration - how an item can be obtained
 */
export interface CosmeticUnlock {
  /** Primary unlock method */
  type:
    | "free" // Available to all users
    | "starter" // Granted on account creation
    | "milestone" // Streak or level milestone
    | "achievement" // Earned via achievement
    | "purchase" // Buy with tokens
    | "premium" // Buy with real money
    | "exclusive"; // Special event/promotion only

  // Milestone unlock details
  milestoneType?: "streak" | "level" | "games_played";
  milestoneValue?: number;

  // Achievement unlock details
  achievementId?: string;

  // Purchase details
  priceTokens?: number;
  priceUSD?: number;

  // Exclusive source tracking
  source?: string; // e.g., "beta_tester", "anniversary_2026"
}

/**
 * Gradient configuration for visual effects
 */
export interface GradientConfig {
  type: "linear" | "radial";
  colors: string[];
  angle?: number; // For linear gradients (0-360)
  centerX?: number; // For radial gradients (0-1)
  centerY?: number; // For radial gradients (0-1)
}

/**
 * Extended cosmetic item definition
 */
export interface ExtendedCosmeticItem {
  id: string;
  name: string;
  description?: string;
  slot: ExtendedCosmeticSlot;
  imagePath: string;
  previewPath?: string;
  rarity: ExtendedCosmeticRarity;
  unlock: CosmeticUnlock;

  // Animation support
  animated?: boolean;
  animationConfig?: {
    type: "lottie" | "spritesheet" | "css";
    duration?: number;
    loop?: boolean;
  };

  // Visual effects
  effects?: {
    glow?: { color: string; intensity: number };
    particles?: { type: string; color: string; count: number };
    shimmer?: { color: string; speed: number };
  };

  // Limited availability
  availableFrom?: number;
  availableTo?: number;
  exclusive?: boolean;

  // Organization
  tags?: string[];
  setId?: string;
  sortOrder?: number;
}

// =============================================================================
// Badge System Types
// =============================================================================

/**
 * Badge categories for filtering/organization
 */
export type BadgeCategory =
  | "games" // Game-related achievements
  | "social" // Friend/social achievements
  | "streak" // Streak achievements
  | "collection" // Cosmetic collection
  | "special" // Secret or limited badges
  | "seasonal"; // Seasonal event badges

/**
 * Badge definition (stored in Badges collection)
 */
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or MaterialCommunityIcon name
  tier: AchievementTier;
  category: BadgeCategory;

  // How to earn this badge
  earnedVia: {
    type: "achievement" | "milestone" | "event" | "purchase";
    achievementId?: string;
    milestoneType?: string;
    milestoneValue?: number;
    eventId?: string;
  };

  // Visual display
  frameColor?: string;
  animated?: boolean;
  animationData?: string;

  // Metadata
  hidden?: boolean;
  limitedTime?: boolean;
  availableFrom?: number;
  availableTo?: number;
}

/**
 * User's earned badge (stored in Users/{uid}/Badges/{badgeId})
 */
export interface UserBadge {
  badgeId: string;
  earnedAt: number;
  featured: boolean; // Pinned to profile
  displayOrder?: number; // 1-5 for featured badges
  earnedVia?: {
    achievementId?: string;
    eventId?: string;
    meta?: Record<string, unknown>;
  };
}

// =============================================================================
// Profile Frame Types
// =============================================================================

/**
 * Frame tier for visual hierarchy
 */
export type FrameTier = "basic" | "premium" | "elite" | "legendary";

/**
 * Profile frame definition
 */
export interface ProfileFrame {
  id: string;
  name: string;
  description: string;
  tier: FrameTier;
  rarity: ExtendedCosmeticRarity;

  // Assets
  staticImagePath: string;
  animatedImagePath?: string;

  // Effects
  effects?: {
    glow?: {
      color: string;
      intensity: number;
      animated?: boolean;
    };
    particles?: {
      type: "sparkle" | "fire" | "snow" | "hearts" | "stars";
      color: string;
      density: number;
    };
    border?: {
      width: number;
      style: "solid" | "dashed" | "dotted" | "gradient";
      color: string | GradientConfig;
    };
  };

  unlock: CosmeticUnlock;
  sortOrder?: number;
}

// =============================================================================
// Chat Bubble Types
// =============================================================================

/**
 * Chat bubble style definition
 */
export interface ChatBubbleStyle {
  id: string;
  name: string;
  description?: string;
  rarity: ExtendedCosmeticRarity;

  // Styling
  background: string | GradientConfig;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;

  // Effects
  effect?: "none" | "shimmer" | "glow" | "pulse" | "gradient-shift";
  effectColor?: string;
  effectSpeed?: number;

  // Text styling
  textColor?: string;
  linkColor?: string;

  unlock: CosmeticUnlock;
  sortOrder?: number;
}

// =============================================================================
// Profile Theme Types
// =============================================================================

/**
 * Profile theme definition
 */
export interface ProfileTheme {
  id: string;
  name: string;
  description: string;
  previewImagePath: string;
  rarity: ExtendedCosmeticRarity;

  // Color scheme
  colors: {
    background: string | GradientConfig;
    surface: string;
    surfaceVariant: string;
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
  };

  // Background
  backgroundPattern?: {
    type: "dots" | "lines" | "grid" | "custom";
    color: string;
    opacity: number;
    customPath?: string;
  };
  backgroundImage?: string;
  backgroundBlur?: number;

  // Header
  headerStyle?: {
    type: "solid" | "gradient" | "image" | "blur";
    value?: string | GradientConfig;
  };

  unlock: CosmeticUnlock;
  sortOrder?: number;
}

// =============================================================================
// Extended Avatar Config
// =============================================================================

/**
 * Extended avatar configuration with all cosmetic slots
 * Backwards compatible with existing AvatarConfig
 */
export interface ExtendedAvatarConfig {
  // Base (required)
  baseColor: string;

  // Existing slots (optional, from current AvatarConfig)
  hat?: string;
  glasses?: string;
  background?: string;

  // New avatar slots (optional)
  clothingTop?: string;
  clothingBottom?: string;
  accessoryNeck?: string;
  accessoryEar?: string;
  accessoryHand?: string;

  // Profile customization (optional)
  profileFrame?: string;
  profileBanner?: string;
  profileTheme?: string;

  // Chat customization (optional)
  chatBubble?: string;
  nameEffect?: string;

  // Featured badges (max 5)
  featuredBadges?: string[];
}

// =============================================================================
// Profile Stats Types
// =============================================================================

/**
 * User statistics for profile display
 */
export interface ProfileStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  highestStreak: number;
  currentStreak: number;
  totalBadges: number;
  achievementProgress: number; // 0-100
  friendCount: number;
  daysActive: number;
}

/**
 * Level information
 */
export interface LevelInfo {
  current: number;
  xp: number;
  xpToNextLevel: number;
  totalXp: number;
}

/**
 * Extended user profile for profile screen
 */
export interface ExtendedUserProfile {
  uid: string;
  username: string;
  displayName: string;
  avatarConfig: ExtendedAvatarConfig;
  createdAt: number;
  lastActive: number;
  stats: ProfileStats;
  level: LevelInfo;
  featuredBadges: UserBadge[];
  equippedCosmetics: Partial<Record<ExtendedCosmeticSlot, string>>;
}

// =============================================================================
// UI Helper Types
// =============================================================================

/**
 * Profile section identifiers
 */
export type ProfileSection =
  | "header"
  | "badges"
  | "stats"
  | "achievements"
  | "customization"
  | "actions";

/**
 * Customization modal tabs
 */
export type ProfileCustomizationTab =
  | "avatar"
  | "clothing"
  | "accessories"
  | "frame"
  | "theme"
  | "chat"
  | "badges";

/**
 * Badge display modes
 */
export type BadgeDisplayMode =
  | "compact" // Icon only
  | "standard" // Icon + name
  | "detailed" // Full card
  | "showcase"; // Featured with effects

/**
 * Badge filter options
 */
export interface BadgeFilterOptions {
  category?: BadgeCategory;
  tier?: AchievementTier;
  earned?: boolean;
  featured?: boolean;
  search?: string;
}

/**
 * Badge sort options
 */
export type BadgeSortOption =
  | "newest"
  | "oldest"
  | "rarity"
  | "category"
  | "name";

/**
 * Cosmetic item with UI status
 */
export interface CosmeticItemDisplay extends ExtendedCosmeticItem {
  owned: boolean;
  equipped: boolean;
  locked: boolean;
  unlockMethod?: string;
  unlockProgress?: {
    current: number;
    target: number;
    percentage: number;
  };
  canAfford?: boolean;
}

/**
 * Profile action button config
 */
export interface ProfileAction {
  id: string;
  label: string;
  icon: string;
  color?: string;
  onPress: () => void;
  badge?: number;
  disabled?: boolean;
}

/**
 * Profile navigation destinations
 */
export type ProfileDestination =
  | "Shop"
  | "Wallet"
  | "Tasks"
  | "Settings"
  | "BlockedUsers"
  | "Achievements"
  | "Customization"
  | "BadgeCollection"
  | "Stats"
  | "Friends";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get rarity color for display
 */
export function getRarityColor(rarity: ExtendedCosmeticRarity): string {
  return RARITY_COLORS[rarity];
}

/**
 * Check if avatar config is extended format
 */
export function isExtendedConfig(
  config: { baseColor: string } & Record<string, unknown>,
): config is ExtendedAvatarConfig {
  return (
    "clothingTop" in config ||
    "profileFrame" in config ||
    "chatBubble" in config ||
    "featuredBadges" in config
  );
}

/**
 * Normalize avatar config to extended format
 * Ensures backwards compatibility with old AvatarConfig
 */
export function normalizeAvatarConfig(config: {
  baseColor: string;
  hat?: string;
  glasses?: string;
  background?: string;
}): ExtendedAvatarConfig {
  if (isExtendedConfig(config)) {
    return config;
  }

  return {
    baseColor: config.baseColor,
    hat: config.hat,
    glasses: config.glasses,
    background: config.background,
    // New fields default to undefined
    clothingTop: undefined,
    clothingBottom: undefined,
    accessoryNeck: undefined,
    accessoryEar: undefined,
    accessoryHand: undefined,
    profileFrame: undefined,
    profileBanner: undefined,
    profileTheme: undefined,
    chatBubble: undefined,
    nameEffect: undefined,
    featuredBadges: [],
  };
}

/**
 * Calculate level from total XP
 * Formula: Each level requires (level * 100) XP
 */
export function calculateLevelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  let xpUsed = 0;

  while (true) {
    const xpForNextLevel = level * 100;
    if (xpUsed + xpForNextLevel > totalXp) {
      break;
    }
    xpUsed += xpForNextLevel;
    level++;
  }

  const xpInCurrentLevel = totalXp - xpUsed;
  const xpToNextLevel = level * 100;

  return {
    current: level,
    xp: xpInCurrentLevel,
    xpToNextLevel,
    totalXp,
  };
}
```

---

#### Task 1.3: Update Types Index

**File:** `src/types/index.ts` (if exists) or create it
**Action:** Add export for profile types

```typescript
// Add this line to existing exports
export * from "./profile";
```

---

#### Task 1.4: Extend models.ts with Badge Collection Type

**File:** `src/types/models.ts`
**Action:** ADD after the existing `InventoryItem` interface (around line 200)

```typescript
// =============================================================================
// Badge System (Profile Overhaul)
// =============================================================================

/**
 * User badge record stored in Users/{uid}/Badges/{badgeId}
 * @see src/types/profile.ts for full Badge definition
 */
export interface UserBadgeRecord {
  badgeId: string;
  earnedAt: number;
  featured: boolean;
  displayOrder?: number;
  earnedVia?: {
    achievementId?: string;
    eventId?: string;
    meta?: Record<string, unknown>;
  };
}

/**
 * User stats cache for profile display
 * Stored in Users/{uid}.statsCache
 */
export interface UserStatsCache {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  highestStreak: number;
  currentStreak: number;
  totalBadges: number;
  achievementProgress: number;
  friendCount: number;
  daysActive: number;
  lastUpdated: number;
}

/**
 * User level data
 * Stored in Users/{uid}.level
 */
export interface UserLevelData {
  current: number;
  xp: number;
  xpToNextLevel: number;
  totalXp: number;
}
```

---

#### Task 1.5: Create Badge Definitions Data File

**File:** `src/data/badges.ts` (NEW FILE)
**Action:** CREATE with the following content

```typescript
/**
 * Badge Definitions
 *
 * Static data for all badges that can be earned.
 * Badges are earned via achievements, milestones, or special events.
 *
 * @see src/types/profile.ts for Badge interface
 * @see src/data/gameAchievements.ts for achievement definitions
 */

import type { AchievementTier } from "@/types/achievements";
import type { Badge, BadgeCategory } from "@/types/profile";

// =============================================================================
// Badge Definitions
// =============================================================================

export const BADGE_DEFINITIONS: Badge[] = [
  // -------------------------
  // GAMES CATEGORY
  // -------------------------
  {
    id: "first_steps",
    name: "First Steps",
    description: "Play your first game",
    icon: "🎮",
    tier: "bronze",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "first_game" },
    hidden: false,
  },
  {
    id: "game_master",
    name: "Game Master",
    description: "Play all available game types",
    icon: "👑",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "game_master" },
    frameColor: "#FFD700",
    hidden: false,
  },
  {
    id: "dedicated_player",
    name: "Dedicated Player",
    description: "Play 100 total games",
    icon: "🔥",
    tier: "silver",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "games_100" },
    hidden: false,
  },
  {
    id: "gaming_legend",
    name: "Gaming Legend",
    description: "Play 500 total games",
    icon: "🏆",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "games_500" },
    hidden: false,
  },
  {
    id: "flappy_master",
    name: "Sky King",
    description: "Score 50 points in Flappy Snap",
    icon: "🦅",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "flappy_50" },
    frameColor: "#4ECDC4",
    hidden: false,
  },
  {
    id: "bounce_legend",
    name: "Bounce Legend",
    description: "Reach round 50 in Bounce Blitz",
    icon: "🎯",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "bounce_round_50" },
    hidden: false,
  },
  {
    id: "memory_master",
    name: "Memory Master",
    description: "Complete Memory Snap with perfect recall",
    icon: "🧠",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "memory_perfect" },
    hidden: false,
  },
  {
    id: "2048_champion",
    name: "2048 Champion",
    description: "Reach the 2048 tile",
    icon: "🔢",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "tile_2048" },
    hidden: false,
  },
  {
    id: "snake_master",
    name: "Snake Master",
    description: "Reach length 50 in Snap Snake",
    icon: "🐍",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "snake_length_50" },
    hidden: false,
  },

  // -------------------------
  // MULTIPLAYER CATEGORY
  // -------------------------
  {
    id: "first_victory",
    name: "First Victory",
    description: "Win your first multiplayer game",
    icon: "🥇",
    tier: "bronze",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "first_win" },
    hidden: false,
  },
  {
    id: "champion",
    name: "Champion",
    description: "Win 50 multiplayer games",
    icon: "🏆",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "wins_50" },
    hidden: false,
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    description: "Win 5 games in a row",
    icon: "⚡",
    tier: "silver",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "win_streak_5" },
    hidden: false,
  },
  {
    id: "chess_master",
    name: "Chess Master",
    description: "Win 50 chess games",
    icon: "♔",
    tier: "gold",
    category: "games",
    earnedVia: { type: "achievement", achievementId: "chess_wins_50" },
    frameColor: "#8B4513",
    hidden: false,
  },

  // -------------------------
  // STREAK CATEGORY
  // -------------------------
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "Maintain a 7-day streak",
    icon: "🔥",
    tier: "bronze",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 7,
    },
    hidden: false,
  },
  {
    id: "streak_30",
    name: "Monthly Champion",
    description: "Maintain a 30-day streak",
    icon: "💪",
    tier: "silver",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 30,
    },
    hidden: false,
  },
  {
    id: "streak_100",
    name: "Centurion",
    description: "Maintain a 100-day streak",
    icon: "🏅",
    tier: "gold",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 100,
    },
    frameColor: "#FFD700",
    animated: true,
    hidden: false,
  },
  {
    id: "streak_365",
    name: "Year Master",
    description: "Maintain a 365-day streak",
    icon: "👑",
    tier: "platinum",
    category: "streak",
    earnedVia: {
      type: "milestone",
      milestoneType: "streak",
      milestoneValue: 365,
    },
    frameColor: "#E5E4E2",
    animated: true,
    hidden: false,
  },

  // -------------------------
  // SOCIAL CATEGORY
  // -------------------------
  {
    id: "first_friend",
    name: "First Friend",
    description: "Add your first friend",
    icon: "🤝",
    tier: "bronze",
    category: "social",
    earnedVia: { type: "achievement", achievementId: "social_first_friend" },
    hidden: false,
  },
  {
    id: "social_butterfly",
    name: "Social Butterfly",
    description: "Add 10 friends",
    icon: "🦋",
    tier: "silver",
    category: "social",
    earnedVia: { type: "achievement", achievementId: "social_10_friends" },
    hidden: false,
  },
  {
    id: "popular",
    name: "Popular",
    description: "Add 50 friends",
    icon: "⭐",
    tier: "gold",
    category: "social",
    earnedVia: { type: "achievement", achievementId: "social_50_friends" },
    hidden: false,
  },

  // -------------------------
  // COLLECTION CATEGORY
  // -------------------------
  {
    id: "collector_10",
    name: "Collector",
    description: "Own 10 cosmetic items",
    icon: "📦",
    tier: "bronze",
    category: "collection",
    earnedVia: { type: "achievement", achievementId: "collection_10" },
    hidden: false,
  },
  {
    id: "collector_25",
    name: "Hoarder",
    description: "Own 25 cosmetic items",
    icon: "🎁",
    tier: "silver",
    category: "collection",
    earnedVia: { type: "achievement", achievementId: "collection_25" },
    hidden: false,
  },
  {
    id: "collector_50",
    name: "Fashionista",
    description: "Own 50 cosmetic items",
    icon: "💎",
    tier: "gold",
    category: "collection",
    earnedVia: { type: "achievement", achievementId: "collection_50" },
    hidden: false,
  },

  // -------------------------
  // SPECIAL CATEGORY
  // -------------------------
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Play a game between midnight and 4am",
    icon: "🦉",
    tier: "bronze",
    category: "special",
    earnedVia: { type: "achievement", achievementId: "night_owl" },
    hidden: true, // Secret badge
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Play a game between 5am and 7am",
    icon: "🐦",
    tier: "bronze",
    category: "special",
    earnedVia: { type: "achievement", achievementId: "early_bird" },
    hidden: true, // Secret badge
  },
  {
    id: "beta_tester",
    name: "Beta Tester",
    description: "Participated in the beta",
    icon: "🧪",
    tier: "epic",
    category: "special",
    earnedVia: { type: "event", eventId: "beta_2026" },
    frameColor: "#9C27B0",
    hidden: false,
    limitedTime: true,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get badge by ID
 */
export function getBadgeById(badgeId: string): Badge | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === badgeId);
}

/**
 * Get badges by category
 */
export function getBadgesByCategory(category: BadgeCategory): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => b.category === category);
}

/**
 * Get badges by tier
 */
export function getBadgesByTier(tier: AchievementTier): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => b.tier === tier);
}

/**
 * Get visible (non-hidden) badges
 */
export function getVisibleBadges(): Badge[] {
  return BADGE_DEFINITIONS.filter((b) => !b.hidden);
}

/**
 * Get badge for a specific achievement
 */
export function getBadgeForAchievement(
  achievementId: string,
): Badge | undefined {
  return BADGE_DEFINITIONS.find(
    (b) =>
      b.earnedVia.type === "achievement" &&
      b.earnedVia.achievementId === achievementId,
  );
}

/**
 * Get badge for a milestone
 */
export function getBadgeForMilestone(
  milestoneType: string,
  milestoneValue: number,
): Badge | undefined {
  return BADGE_DEFINITIONS.find(
    (b) =>
      b.earnedVia.type === "milestone" &&
      b.earnedVia.milestoneType === milestoneType &&
      b.earnedVia.milestoneValue === milestoneValue,
  );
}

/**
 * Get total badge count
 */
export function getTotalBadgeCount(): number {
  return BADGE_DEFINITIONS.length;
}

/**
 * Get count of visible badges
 */
export function getVisibleBadgeCount(): number {
  return getVisibleBadges().length;
}
```

---

#### Task 1.6: Update Firestore Security Rules

**File:** `firebase-backend/firestore.rules`
**Action:** ADD after the existing `match /Users/{uid}/inventory/{itemId}` block (around line 80)

```plaintext
      // Badges subcollection - earned badges for profile display
      match /Badges/{badgeId} {
        // User can read their own badges, others can read for profile viewing
        allow read: if isAuth();

        // Badges are granted by server (achievement system) or admin
        // Allow client create for development/testing only
        allow create: if isAuth() && isOwner(uid) &&
                        request.resource.data.keys().hasAll(['badgeId', 'earnedAt', 'featured']) &&
                        request.resource.data.badgeId == badgeId &&
                        request.resource.data.featured is bool;

        // User can only update 'featured' and 'displayOrder' fields
        allow update: if isAuth() && isOwner(uid) &&
                        request.resource.data.badgeId == resource.data.badgeId &&
                        request.resource.data.earnedAt == resource.data.earnedAt &&
                        request.resource.data.featured is bool &&
                        (!request.resource.data.keys().hasAll(['displayOrder']) ||
                         (request.resource.data.displayOrder >= 1 &&
                          request.resource.data.displayOrder <= 5));

        // Badges cannot be deleted
        allow delete: if false;
      }
```

---

#### Task 1.7: Create Data Index Export

**File:** `src/data/index.ts`
**Action:** ADD to existing exports or create file

```typescript
// Existing exports
export * from "./cosmetics";
export * from "./gameAchievements";

// New exports
export * from "./badges";
```

---

#### Task 1.8: Verify Phase 1 Completion

**Action:** Run TypeScript compiler to verify no errors

```bash
npx tsc --noEmit
```

**Expected Result:** No TypeScript errors. All new types should compile correctly.

---

### Phase 2: Badge System (Week 2-3)

**Goal:** Complete badge earn/display functionality

**Prerequisites:** Phase 1 completed

**Feature Flag to Enable:** Set `BADGE_SYSTEM: true` and `BADGE_SHOWCASE: true` in `constants/featureFlags.ts`

---

#### Task 2.1: Create Badge Service

**File:** `src/services/badges.ts` (NEW FILE)
**Action:** CREATE with the following content

```typescript
/**
 * Badge Service
 *
 * Handles:
 * - Fetching user's earned badges
 * - Granting badges (via achievements or milestones)
 * - Featuring/unfeaturing badges on profile
 * - Real-time badge subscription
 *
 * @see src/types/profile.ts for Badge types
 * @see src/data/badges.ts for badge definitions
 */

import {
  getBadgeById,
  getBadgeForAchievement,
  getBadgeForMilestone,
  BADGE_DEFINITIONS,
} from "@/data/badges";
import type { Badge, UserBadge } from "@/types/profile";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";

// Lazy getter for Firestore
const getDb = () => getFirestoreInstance();

// =============================================================================
// Badge Fetching
// =============================================================================

/**
 * Get all badge definitions
 */
export function getAllBadges(): Badge[] {
  return BADGE_DEFINITIONS;
}

/**
 * Get a specific badge definition
 */
export function getBadge(badgeId: string): Badge | undefined {
  return getBadgeById(badgeId);
}

/**
 * Get user's earned badges from Firestore
 */
export async function getUserBadges(uid: string): Promise<UserBadge[]> {
  const db = getDb();

  try {
    const badgesRef = collection(db, "Users", uid, "Badges");
    const q = query(badgesRef, orderBy("earnedAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        badgeId: doc.id,
        earnedAt: data.earnedAt,
        featured: data.featured || false,
        displayOrder: data.displayOrder,
        earnedVia: data.earnedVia,
      } as UserBadge;
    });
  } catch (error) {
    console.error("[badges] Error fetching user badges:", error);
    return [];
  }
}

/**
 * Get user's featured badges (for profile display)
 */
export async function getFeaturedBadges(uid: string): Promise<UserBadge[]> {
  const db = getDb();

  try {
    const badgesRef = collection(db, "Users", uid, "Badges");
    const q = query(
      badgesRef,
      where("featured", "==", true),
      orderBy("displayOrder", "asc"),
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        badgeId: doc.id,
        earnedAt: data.earnedAt,
        featured: true,
        displayOrder: data.displayOrder,
        earnedVia: data.earnedVia,
      } as UserBadge;
    });
  } catch (error) {
    console.error("[badges] Error fetching featured badges:", error);
    return [];
  }
}

/**
 * Check if user has a specific badge
 */
export async function hasBadge(uid: string, badgeId: string): Promise<boolean> {
  const db = getDb();

  try {
    const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
    const badgeDoc = await getDoc(badgeRef);
    return badgeDoc.exists();
  } catch (error) {
    console.error("[badges] Error checking badge:", error);
    return false;
  }
}

// =============================================================================
// Badge Granting
// =============================================================================

/**
 * Grant a badge to a user
 * @returns true if badge was granted, false if already owned or error
 */
export async function grantBadge(
  uid: string,
  badgeId: string,
  earnedVia?: UserBadge["earnedVia"],
): Promise<boolean> {
  const db = getDb();

  try {
    // Verify badge exists in definitions
    const badge = getBadgeById(badgeId);
    if (!badge) {
      console.error("[badges] Badge not found in definitions:", badgeId);
      return false;
    }

    // Check if already earned
    const alreadyHas = await hasBadge(uid, badgeId);
    if (alreadyHas) {
      console.log("[badges] User already has badge:", badgeId);
      return false;
    }

    // Grant the badge
    const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
    await setDoc(badgeRef, {
      badgeId,
      earnedAt: Date.now(),
      featured: false,
      earnedVia: earnedVia || {},
    });

    console.log("[badges] Granted badge:", badgeId, "to user:", uid);
    return true;
  } catch (error) {
    console.error("[badges] Error granting badge:", error);
    return false;
  }
}

/**
 * Check and grant badge for an achievement
 * Called when an achievement is earned
 */
export async function checkAndGrantBadgeForAchievement(
  uid: string,
  achievementId: string,
): Promise<Badge | null> {
  const badge = getBadgeForAchievement(achievementId);

  if (!badge) {
    return null;
  }

  const granted = await grantBadge(uid, badge.id, {
    achievementId,
  });

  return granted ? badge : null;
}

/**
 * Check and grant badge for a streak milestone
 */
export async function checkAndGrantBadgeForStreak(
  uid: string,
  streakDays: number,
): Promise<Badge | null> {
  const badge = getBadgeForMilestone("streak", streakDays);

  if (!badge) {
    return null;
  }

  const granted = await grantBadge(uid, badge.id, {
    meta: { streakDays },
  });

  return granted ? badge : null;
}

// =============================================================================
// Badge Featuring
// =============================================================================

/**
 * Feature a badge on profile
 * @param displayOrder - Position 1-5 for display order
 */
export async function featureBadge(
  uid: string,
  badgeId: string,
  displayOrder: number,
): Promise<boolean> {
  const db = getDb();

  if (displayOrder < 1 || displayOrder > 5) {
    console.error("[badges] Invalid display order:", displayOrder);
    return false;
  }

  try {
    // Check user has this badge
    const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
    const badgeDoc = await getDoc(badgeRef);

    if (!badgeDoc.exists()) {
      console.error("[badges] User does not have badge:", badgeId);
      return false;
    }

    // Get current featured badges to check limit
    const featured = await getFeaturedBadges(uid);

    // Check if already featured
    const alreadyFeatured = featured.find((b) => b.badgeId === badgeId);
    if (alreadyFeatured) {
      // Just update display order
      await updateDoc(badgeRef, { displayOrder });
      return true;
    }

    // Check limit (max 5 featured)
    if (featured.length >= 5) {
      console.error("[badges] Max featured badges reached (5)");
      return false;
    }

    // Feature the badge
    await updateDoc(badgeRef, {
      featured: true,
      displayOrder,
    });

    return true;
  } catch (error) {
    console.error("[badges] Error featuring badge:", error);
    return false;
  }
}

/**
 * Unfeature a badge from profile
 */
export async function unfeatureBadge(
  uid: string,
  badgeId: string,
): Promise<boolean> {
  const db = getDb();

  try {
    const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
    await updateDoc(badgeRef, {
      featured: false,
      displayOrder: null,
    });

    return true;
  } catch (error) {
    console.error("[badges] Error unfeaturing badge:", error);
    return false;
  }
}

/**
 * Reorder featured badges
 */
export async function reorderFeaturedBadges(
  uid: string,
  orderedBadgeIds: string[],
): Promise<boolean> {
  const db = getDb();

  if (orderedBadgeIds.length > 5) {
    console.error("[badges] Cannot feature more than 5 badges");
    return false;
  }

  try {
    const batch = writeBatch(db);

    orderedBadgeIds.forEach((badgeId, index) => {
      const badgeRef = doc(db, "Users", uid, "Badges", badgeId);
      batch.update(badgeRef, {
        featured: true,
        displayOrder: index + 1,
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error("[badges] Error reordering badges:", error);
    return false;
  }
}

// =============================================================================
// Real-time Subscriptions
// =============================================================================

/**
 * Subscribe to user's badges for real-time updates
 * @returns Unsubscribe function
 */
export function subscribeToBadges(
  uid: string,
  onUpdate: (badges: UserBadge[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getDb();
  const badgesRef = collection(db, "Users", uid, "Badges");
  const q = query(badgesRef, orderBy("earnedAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const badges = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          badgeId: doc.id,
          earnedAt: data.earnedAt,
          featured: data.featured || false,
          displayOrder: data.displayOrder,
          earnedVia: data.earnedVia,
        } as UserBadge;
      });
      onUpdate(badges);
    },
    (error) => {
      console.error("[badges] Subscription error:", error);
      onError?.(error as Error);
    },
  );
}

/**
 * Subscribe to featured badges only
 */
export function subscribeToFeaturedBadges(
  uid: string,
  onUpdate: (badges: UserBadge[]) => void,
): () => void {
  const db = getDb();
  const badgesRef = collection(db, "Users", uid, "Badges");
  const q = query(
    badgesRef,
    where("featured", "==", true),
    orderBy("displayOrder", "asc"),
  );

  return onSnapshot(q, (snapshot) => {
    const badges = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        badgeId: doc.id,
        earnedAt: data.earnedAt,
        featured: true,
        displayOrder: data.displayOrder,
        earnedVia: data.earnedVia,
      } as UserBadge;
    });
    onUpdate(badges);
  });
}

// =============================================================================
// Badge Stats
// =============================================================================

/**
 * Get badge statistics for a user
 */
export async function getBadgeStats(uid: string): Promise<{
  total: number;
  earned: number;
  featured: number;
  byCategory: Record<string, number>;
  byTier: Record<string, number>;
}> {
  const badges = await getUserBadges(uid);
  const total = BADGE_DEFINITIONS.filter((b) => !b.hidden).length;

  const byCategory: Record<string, number> = {};
  const byTier: Record<string, number> = {};

  for (const userBadge of badges) {
    const definition = getBadgeById(userBadge.badgeId);
    if (definition) {
      byCategory[definition.category] =
        (byCategory[definition.category] || 0) + 1;
      byTier[definition.tier] = (byTier[definition.tier] || 0) + 1;
    }
  }

  return {
    total,
    earned: badges.length,
    featured: badges.filter((b) => b.featured).length,
    byCategory,
    byTier,
  };
}
```

---

#### Task 2.2: Create useBadges Hook

**File:** `src/hooks/useBadges.ts` (NEW FILE)
**Action:** CREATE with the following content

```typescript
/**
 * useBadges Hook
 *
 * Provides badge data and actions for profile/badge screens.
 *
 * @example
 * const { earnedBadges, featuredBadges, featureBadge } = useBadges(userId);
 */

import { getBadgeById, BADGE_DEFINITIONS } from "@/data/badges";
import {
  featureBadge as featureBadgeService,
  subscribeToBadges,
  unfeatureBadge as unfeatureBadgeService,
} from "@/services/badges";
import type { Badge, UserBadge } from "@/types/profile";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseBadgesReturn {
  /** All badges the user has earned */
  earnedBadges: UserBadge[];
  /** All badge definitions (for showing locked badges) */
  allBadges: Badge[];
  /** Featured badges for profile display (max 5) */
  featuredBadges: UserBadge[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Feature a badge on profile */
  featureBadge: (badgeId: string, order: number) => Promise<boolean>;
  /** Remove a badge from featured */
  unfeatureBadge: (badgeId: string) => Promise<boolean>;
  /** Check if a badge is earned */
  hasBadge: (badgeId: string) => boolean;
  /** Get badge definition with earned status */
  getBadgeWithStatus: (
    badgeId: string,
  ) => (Badge & { earned: boolean; featured: boolean }) | undefined;
  /** Statistics */
  stats: {
    total: number;
    earned: number;
    percentage: number;
  };
}

export function useBadges(uid: string | undefined): UseBadgesReturn {
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Subscribe to badges
  useEffect(() => {
    if (!uid) {
      setEarnedBadges([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToBadges(
      uid,
      (badges) => {
        setEarnedBadges(badges);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [uid]);

  // Compute featured badges
  const featuredBadges = useMemo(() => {
    return earnedBadges
      .filter((b) => b.featured)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }, [earnedBadges]);

  // All badge definitions
  const allBadges = useMemo(() => BADGE_DEFINITIONS, []);

  // Stats
  const stats = useMemo(() => {
    const total = BADGE_DEFINITIONS.filter((b) => !b.hidden).length;
    const earned = earnedBadges.length;
    return {
      total,
      earned,
      percentage: total > 0 ? Math.round((earned / total) * 100) : 0,
    };
  }, [earnedBadges]);

  // Check if badge is earned
  const hasBadge = useCallback(
    (badgeId: string) => {
      return earnedBadges.some((b) => b.badgeId === badgeId);
    },
    [earnedBadges],
  );

  // Get badge with status
  const getBadgeWithStatus = useCallback(
    (badgeId: string) => {
      const definition = getBadgeById(badgeId);
      if (!definition) return undefined;

      const userBadge = earnedBadges.find((b) => b.badgeId === badgeId);
      return {
        ...definition,
        earned: !!userBadge,
        featured: userBadge?.featured || false,
      };
    },
    [earnedBadges],
  );

  // Feature badge action
  const featureBadge = useCallback(
    async (badgeId: string, order: number) => {
      if (!uid) return false;
      return featureBadgeService(uid, badgeId, order);
    },
    [uid],
  );

  // Unfeature badge action
  const unfeatureBadge = useCallback(
    async (badgeId: string) => {
      if (!uid) return false;
      return unfeatureBadgeService(uid, badgeId);
    },
    [uid],
  );

  return {
    earnedBadges,
    allBadges,
    featuredBadges,
    loading,
    error,
    featureBadge,
    unfeatureBadge,
    hasBadge,
    getBadgeWithStatus,
    stats,
  };
}

export default useBadges;
```

---

#### Task 2.3: Create BadgeCard Component

**File:** `src/components/badges/BadgeCard.tsx` (NEW FILE)
**Action:** CREATE with the following content

```tsx
/**
 * BadgeCard Component
 *
 * Displays a single badge with tier-based styling.
 * Used in badge grids, showcases, and detail views.
 */

import { getBadgeById } from "@/data/badges";
import { TIER_COLORS } from "@/types/achievements";
import type { Badge, BadgeDisplayMode, UserBadge } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface BadgeCardProps {
  /** Badge ID or full badge object */
  badge: string | Badge;
  /** User's badge data (if earned) */
  userBadge?: UserBadge;
  /** Display mode */
  mode?: BadgeDisplayMode;
  /** Size multiplier (default 1) */
  size?: number;
  /** Whether badge is locked/unearned */
  locked?: boolean;
  /** Show featured star */
  showFeatured?: boolean;
  /** Press handler */
  onPress?: () => void;
  /** Long press handler */
  onLongPress?: () => void;
}

function BadgeCardBase({
  badge,
  userBadge,
  mode = "standard",
  size = 1,
  locked = false,
  showFeatured = true,
  onPress,
  onLongPress,
}: BadgeCardProps) {
  const theme = useTheme();

  // Resolve badge definition
  const badgeData: Badge | undefined =
    typeof badge === "string" ? getBadgeById(badge) : badge;

  if (!badgeData) {
    return null;
  }

  const tierColor = TIER_COLORS[badgeData.tier];
  const isEarned = !!userBadge || !locked;
  const isFeatured = userBadge?.featured;

  // Size calculations
  const baseSize = 64 * size;
  const iconSize = 32 * size;
  const fontSize = 12 * size;

  const renderCompact = () => (
    <View
      style={[
        styles.compactContainer,
        {
          width: baseSize,
          height: baseSize,
          backgroundColor: isEarned
            ? tierColor + "20"
            : theme.colors.surfaceVariant,
          borderColor: isEarned ? tierColor : "transparent",
          opacity: isEarned ? 1 : 0.5,
        },
      ]}
    >
      <Text style={{ fontSize: iconSize * 0.8 }}>
        {isEarned ? badgeData.icon : "🔒"}
      </Text>
      {showFeatured && isFeatured && (
        <View
          style={[
            styles.featuredDot,
            { backgroundColor: theme.colors.primary },
          ]}
        />
      )}
    </View>
  );

  const renderStandard = () => (
    <View
      style={[
        styles.standardContainer,
        {
          backgroundColor: isEarned
            ? tierColor + "15"
            : theme.colors.surfaceVariant,
          borderColor: isEarned ? tierColor : "transparent",
          opacity: isEarned ? 1 : 0.6,
        },
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isEarned ? tierColor + "30" : "#00000010",
            width: baseSize * 0.7,
            height: baseSize * 0.7,
          },
        ]}
      >
        <Text style={{ fontSize: iconSize }}>
          {isEarned ? badgeData.icon : "🔒"}
        </Text>
      </View>
      <Text
        style={[styles.badgeName, { color: theme.colors.onSurface, fontSize }]}
        numberOfLines={1}
      >
        {isEarned ? badgeData.name : "???"}
      </Text>
      {showFeatured && isFeatured && (
        <MaterialCommunityIcons
          name="star"
          size={14 * size}
          color={theme.colors.primary}
          style={styles.featuredStar}
        />
      )}
    </View>
  );

  const renderDetailed = () => (
    <View
      style={[
        styles.detailedContainer,
        {
          backgroundColor: theme.colors.surface,
          borderColor: isEarned ? tierColor : theme.colors.outline,
        },
      ]}
    >
      <View
        style={[styles.detailedHeader, { backgroundColor: tierColor + "20" }]}
      >
        <Text style={{ fontSize: iconSize * 1.2 }}>
          {isEarned ? badgeData.icon : "🔒"}
        </Text>
        <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
          <Text style={styles.tierText}>
            {badgeData.tier.charAt(0).toUpperCase() + badgeData.tier.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.detailedContent}>
        <Text
          style={[styles.detailedName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {isEarned ? badgeData.name : "???"}
        </Text>
        <Text
          style={[
            styles.detailedDesc,
            { color: theme.colors.onSurfaceVariant },
          ]}
          numberOfLines={2}
        >
          {isEarned ? badgeData.description : "Earn this badge to reveal"}
        </Text>
      </View>
      {showFeatured && isFeatured && (
        <View
          style={[
            styles.featuredBanner,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={styles.featuredText}>Featured</Text>
        </View>
      )}
    </View>
  );

  const renderShowcase = () => (
    <View
      style={[
        styles.showcaseContainer,
        {
          backgroundColor: tierColor + "20",
          borderColor: tierColor,
          shadowColor: tierColor,
        },
      ]}
    >
      <View style={styles.showcaseGlow}>
        <Text style={{ fontSize: iconSize * 1.5 }}>{badgeData.icon}</Text>
      </View>
      <Text
        style={[styles.showcaseName, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {badgeData.name}
      </Text>
    </View>
  );

  const content = () => {
    switch (mode) {
      case "compact":
        return renderCompact();
      case "detailed":
        return renderDetailed();
      case "showcase":
        return renderShowcase();
      default:
        return renderStandard();
    }
  };

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        {content()}
      </TouchableOpacity>
    );
  }

  return content();
}

const styles = StyleSheet.create({
  // Compact mode
  compactContainer: {
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  featuredDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Standard mode
  standardContainer: {
    width: 80,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  iconCircle: {
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeName: {
    fontWeight: "600",
    textAlign: "center",
  },
  featuredStar: {
    position: "absolute",
    top: 4,
    right: 4,
  },

  // Detailed mode
  detailedContainer: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
  },
  detailedHeader: {
    paddingVertical: 16,
    alignItems: "center",
    position: "relative",
  },
  tierBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  detailedContent: {
    padding: 16,
  },
  detailedName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailedDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  featuredBanner: {
    paddingVertical: 4,
    alignItems: "center",
  },
  featuredText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  // Showcase mode
  showcaseContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  showcaseGlow: {
    marginBottom: 8,
  },
  showcaseName: {
    fontSize: 14,
    fontWeight: "700",
  },
});

export const BadgeCard = memo(BadgeCardBase);
export default BadgeCard;
```

---

#### Task 2.4: Create BadgeShowcase Component

**File:** `src/components/badges/BadgeShowcase.tsx` (NEW FILE)
**Action:** CREATE with the following content

```tsx
/**
 * BadgeShowcase Component
 *
 * Displays featured badges in a horizontal row on the profile.
 * Shows up to 5 badges with "View All" option.
 */

import { getBadgeById } from "@/data/badges";
import type { UserBadge } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { BadgeCard } from "./BadgeCard";

export interface BadgeShowcaseProps {
  /** User's featured badges */
  badges: UserBadge[];
  /** Maximum badges to display */
  maxDisplay?: number;
  /** Handler when a badge is pressed */
  onBadgePress?: (badge: UserBadge) => void;
  /** Handler for "View All" press */
  onViewAll?: () => void;
  /** Show section header */
  showHeader?: boolean;
  /** Title for the section */
  title?: string;
}

function BadgeShowcaseBase({
  badges,
  maxDisplay = 5,
  onBadgePress,
  onViewAll,
  showHeader = true,
  title = "Featured Badges",
}: BadgeShowcaseProps) {
  const theme = useTheme();

  const displayBadges = badges.slice(0, maxDisplay);

  if (displayBadges.length === 0) {
    return (
      <View style={styles.container}>
        {showHeader && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.emptyContainer,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <MaterialCommunityIcons
            name="medal-outline"
            size={32}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            No featured badges yet
          </Text>
          {onViewAll && (
            <TouchableOpacity onPress={onViewAll}>
              <Text style={[styles.emptyLink, { color: theme.colors.primary }]}>
                View all badges
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          {onViewAll && (
            <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
              <Text
                style={[styles.viewAllText, { color: theme.colors.primary }]}
              >
                View All
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayBadges.map((userBadge) => {
          const badge = getBadgeById(userBadge.badgeId);
          if (!badge) return null;

          return (
            <BadgeCard
              key={userBadge.badgeId}
              badge={badge}
              userBadge={userBadge}
              mode="standard"
              showFeatured={false}
              onPress={() => onBadgePress?.(userBadge)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  emptyContainer: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyLink: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
  },
});

export const BadgeShowcase = memo(BadgeShowcaseBase);
export default BadgeShowcase;
```

---

#### Task 2.5: Create Badges Index Export

**File:** `src/components/badges/index.ts` (NEW FILE)
**Action:** CREATE with the following content

```typescript
/**
 * Badge Components Index
 */

export { BadgeCard } from "./BadgeCard";
export type { BadgeCardProps } from "./BadgeCard";

export { BadgeShowcase } from "./BadgeShowcase";
export type { BadgeShowcaseProps } from "./BadgeShowcase";
```

---

#### Task 2.6: Update Services Index

**File:** `src/services/index.ts`
**Action:** ADD to existing exports

```typescript
// Badge service
export * from "./badges";
```

---

#### Task 2.7: Update Hooks Index

**File:** `src/hooks/index.ts`
**Action:** ADD to existing exports

```typescript
// Badge hook
export { useBadges } from "./useBadges";
```

---

#### Task 2.8: Integrate Badge Granting with Achievement System

**File:** `src/services/gameAchievements.ts`
**Action:** ADD import at top of file

```typescript
import { checkAndGrantBadgeForAchievement } from "./badges";
```

**Action:** FIND the function that grants achievements and ADD badge granting. Look for a function like `grantAchievement` or `unlockAchievement` and add this after the achievement is saved:

```typescript
// After achievement is saved to Firestore, check for badge
const badge = await checkAndGrantBadgeForAchievement(userId, achievementId);
if (badge) {
  console.log("[achievements] Badge granted:", badge.id);
}
```

---

#### Task 2.9: Verify Phase 2 Completion

**Action:** Run TypeScript compiler

```bash
npx tsc --noEmit
```

**Action:** Enable feature flags in `constants/featureFlags.ts`:

- Set `BADGE_SYSTEM: true`
- Set `BADGE_SHOWCASE: true`

---

### Phase 3: Profile Screen Redesign (Week 3-4)

**Goal:** New profile UI with header, stats, and badge showcase

**Prerequisites:** Phase 1 and Phase 2 completed

**Feature Flags to Enable:** `NEW_PROFILE_LAYOUT: true`, `PROFILE_STATS: true`, `LEVEL_SYSTEM: true`

---

#### Task 3.1: Create ProfileHeader Component

**File:** `src/components/profile/ProfileHeader.tsx` (NEW FILE)
**Action:** CREATE with the following content

```tsx
/**
 * ProfileHeader Component
 *
 * Displays avatar with frame, username, display name, and level progress.
 * Central header for the redesigned profile screen.
 */

import Avatar from "@/components/Avatar";
import { TIER_COLORS } from "@/types/achievements";
import type { ExtendedAvatarConfig, LevelInfo } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { LevelProgress } from "./LevelProgress";

export interface ProfileHeaderProps {
  /** User's display name */
  displayName: string;
  /** Username with @ prefix */
  username: string;
  /** Avatar configuration */
  avatarConfig: ExtendedAvatarConfig;
  /** Level information */
  level: LevelInfo;
  /** Handler for edit profile button */
  onEditPress?: () => void;
  /** Handler for avatar/customization press */
  onAvatarPress?: () => void;
}

function ProfileHeaderBase({
  displayName,
  username,
  avatarConfig,
  level,
  onEditPress,
  onAvatarPress,
}: ProfileHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Avatar with optional frame */}
      <TouchableOpacity
        onPress={onAvatarPress}
        activeOpacity={0.8}
        style={styles.avatarContainer}
      >
        <View style={styles.avatarWrapper}>
          <Avatar config={avatarConfig} size={100} />
          {/* Customize overlay */}
          <View
            style={[
              styles.customizeOverlay,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <MaterialCommunityIcons name="palette" size={16} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>

      {/* User info */}
      <View style={styles.infoContainer}>
        <Text style={[styles.displayName, { color: theme.colors.onSurface }]}>
          {displayName}
        </Text>
        <Text
          style={[styles.username, { color: theme.colors.onSurfaceVariant }]}
        >
          @{username}
        </Text>

        {/* Edit button */}
        {onEditPress && (
          <TouchableOpacity
            onPress={onEditPress}
            style={[styles.editButton, { borderColor: theme.colors.outline }]}
          >
            <MaterialCommunityIcons
              name="pencil"
              size={14}
              color={theme.colors.primary}
            />
            <Text style={[styles.editText, { color: theme.colors.primary }]}>
              Edit Profile
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Level progress */}
      <View style={styles.levelContainer}>
        <LevelProgress level={level} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarWrapper: {
    position: "relative",
  },
  customizeOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  infoContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    marginBottom: 12,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  editText: {
    fontSize: 14,
    fontWeight: "600",
  },
  levelContainer: {
    width: "100%",
    maxWidth: 300,
  },
});

export const ProfileHeader = memo(ProfileHeaderBase);
export default ProfileHeader;
```

---

#### Task 3.2: Create LevelProgress Component

**File:** `src/components/profile/LevelProgress.tsx` (NEW FILE)
**Action:** CREATE with the following content

```tsx
/**
 * LevelProgress Component
 *
 * Displays user's level with XP progress bar.
 */

import type { LevelInfo } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { ProgressBar, Text, useTheme } from "react-native-paper";

export interface LevelProgressProps {
  /** Level information */
  level: LevelInfo;
  /** Show detailed XP numbers */
  showDetails?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

function LevelProgressBase({
  level,
  showDetails = true,
  compact = false,
}: LevelProgressProps) {
  const theme = useTheme();

  const progress = level.xpToNextLevel > 0 ? level.xp / level.xpToNextLevel : 1;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View
          style={[
            styles.levelBadgeSmall,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={styles.levelTextSmall}>{level.current}</Text>
        </View>
        <View style={styles.compactProgressWrapper}>
          <ProgressBar
            progress={progress}
            color={theme.colors.primary}
            style={styles.compactProgress}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <MaterialCommunityIcons
            name="star-circle"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={[styles.levelLabel, { color: theme.colors.onSurface }]}>
            Level {level.current}
          </Text>
        </View>
        {showDetails && (
          <Text
            style={[styles.xpText, { color: theme.colors.onSurfaceVariant }]}
          >
            {level.xp.toLocaleString()} / {level.xpToNextLevel.toLocaleString()}{" "}
            XP
          </Text>
        )}
      </View>
      <ProgressBar
        progress={progress}
        color={theme.colors.primary}
        style={[
          styles.progressBar,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  levelLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  xpText: {
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  // Compact styles
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelBadgeSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  levelTextSmall: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  compactProgressWrapper: {
    flex: 1,
  },
  compactProgress: {
    height: 4,
    borderRadius: 2,
  },
});

export const LevelProgress = memo(LevelProgressBase);
export default LevelProgress;
```

---

#### Task 3.3: Create ProfileStats Component

**File:** `src/components/profile/ProfileStats.tsx` (NEW FILE)
**Action:** CREATE with the following content

```tsx
/**
 * ProfileStats Component
 *
 * Displays user statistics in a grid layout.
 */

import type { ProfileStats as ProfileStatsType } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

export interface ProfileStatsProps {
  /** Statistics data */
  stats: ProfileStatsType;
  /** Show all stats or just primary */
  expanded?: boolean;
}

interface StatItemProps {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
}

const StatItem = memo(function StatItem({
  icon,
  value,
  label,
  color,
}: StatItemProps) {
  const theme = useTheme();

  return (
    <View style={styles.statItem}>
      <MaterialCommunityIcons
        name={icon as any}
        size={24}
        color={color || theme.colors.primary}
      />
      <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </Text>
      <Text
        style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
      >
        {label}
      </Text>
    </View>
  );
});

function ProfileStatsBase({ stats, expanded = false }: ProfileStatsProps) {
  const theme = useTheme();

  const primaryStats = [
    { icon: "gamepad-variant", value: stats.gamesPlayed, label: "Games" },
    { icon: "trophy", value: stats.gamesWon, label: "Wins" },
    {
      icon: "fire",
      value: stats.currentStreak,
      label: "Streak",
      color: "#FF6B6B",
    },
    { icon: "account-group", value: stats.friendCount, label: "Friends" },
  ];

  const secondaryStats = [
    { icon: "percent", value: `${stats.winRate}%`, label: "Win Rate" },
    { icon: "medal", value: stats.totalBadges, label: "Badges" },
    { icon: "chart-line", value: stats.highestStreak, label: "Best Streak" },
    { icon: "calendar", value: stats.daysActive, label: "Days Active" },
  ];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.statsGrid,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        {primaryStats.map((stat, index) => (
          <StatItem key={index} {...stat} />
        ))}
      </View>

      {expanded && (
        <View
          style={[
            styles.statsGrid,
            styles.secondaryGrid,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          {secondaryStats.map((stat, index) => (
            <StatItem key={index} {...stat} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 16,
    padding: 8,
  },
  secondaryGrid: {
    marginTop: 12,
  },
  statItem: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

export const ProfileStats = memo(ProfileStatsBase);
export default ProfileStats;
```

---

#### Task 3.4: Create ProfileActions Component

**File:** `src/components/profile/ProfileActions.tsx` (NEW FILE)
**Action:** CREATE with the following content

```tsx
/**
 * ProfileActions Component
 *
 * List of action buttons for profile navigation.
 */

import type { ProfileAction } from "@/types/profile";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Badge, Text, useTheme } from "react-native-paper";

export interface ProfileActionsProps {
  /** List of actions */
  actions: ProfileAction[];
}

function ProfileActionsBase({ actions }: ProfileActionsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.id}
          style={[
            styles.actionItem,
            {
              backgroundColor: theme.colors.surfaceVariant,
              opacity: action.disabled ? 0.5 : 1,
            },
          ]}
          onPress={action.onPress}
          disabled={action.disabled}
          activeOpacity={0.7}
        >
          <View style={styles.actionLeft}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    (action.color || theme.colors.primary) + "20",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={action.icon as any}
                size={22}
                color={action.color || theme.colors.primary}
              />
            </View>
            <Text
              style={[styles.actionLabel, { color: theme.colors.onSurface }]}
            >
              {action.label}
            </Text>
          </View>
          <View style={styles.actionRight}>
            {action.badge !== undefined && action.badge > 0 && (
              <Badge style={styles.badge}>{action.badge}</Badge>
            )}
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    gap: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  actionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    backgroundColor: "#FF6B6B",
  },
});

export const ProfileActions = memo(ProfileActionsBase);
export default ProfileActions;
```

---

#### Task 3.5: Create Profile Components Index

**File:** `src/components/profile/index.ts` (NEW FILE)
**Action:** CREATE with the following content

```typescript
/**
 * Profile Components Index
 */

export { ProfileHeader } from "./ProfileHeader";
export type { ProfileHeaderProps } from "./ProfileHeader";

export { LevelProgress } from "./LevelProgress";
export type { LevelProgressProps } from "./LevelProgress";

export { ProfileStats } from "./ProfileStats";
export type { ProfileStatsProps } from "./ProfileStats";

export { ProfileActions } from "./ProfileActions";
export type { ProfileActionsProps } from "./ProfileActions";
```

---

#### Task 3.6: Create useProfileData Hook

**File:** `src/hooks/useProfileData.ts` (NEW FILE)
**Action:** CREATE with the following content

```typescript
/**
 * useProfileData Hook
 *
 * Combines user profile, stats, level, and badges into a single hook.
 * Provides all data needed for the profile screen.
 */

import { useBadges } from "@/hooks/useBadges";
import { useUser } from "@/store/UserContext";
import type {
  ExtendedAvatarConfig,
  ExtendedUserProfile,
  LevelInfo,
  ProfileStats,
} from "@/types/profile";
import { calculateLevelFromXp, normalizeAvatarConfig } from "@/types/profile";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseProfileDataReturn {
  /** Extended profile data */
  profile: ExtendedUserProfile | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh all profile data */
  refresh: () => Promise<void>;
}

export function useProfileData(uid: string | undefined): UseProfileDataReturn {
  const {
    profile: baseProfile,
    loading: profileLoading,
    refreshProfile,
  } = useUser();
  const {
    earnedBadges,
    featuredBadges,
    loading: badgesLoading,
    stats: badgeStats,
  } = useBadges(uid);

  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Compute extended profile
  const extendedProfile = useMemo<ExtendedUserProfile | null>(() => {
    if (!baseProfile || !uid) return null;

    // Normalize avatar config to extended format
    const avatarConfig = normalizeAvatarConfig(baseProfile.avatarConfig);

    // Get stats from cache or defaults
    // In production, you'd fetch these from Firestore
    const stats: ProfileStats = {
      gamesPlayed: 0,
      gamesWon: 0,
      winRate: 0,
      highestStreak: 0,
      currentStreak: 0,
      totalBadges: badgeStats.earned,
      achievementProgress: badgeStats.percentage,
      friendCount: 0,
      daysActive: Math.floor(
        (Date.now() - baseProfile.createdAt) / (24 * 60 * 60 * 1000),
      ),
    };

    // Calculate level from XP (default to 0 XP if not set)
    const totalXp = 0; // In production, fetch from user document
    const level = calculateLevelFromXp(totalXp);

    return {
      uid: baseProfile.uid,
      username: baseProfile.username,
      displayName: baseProfile.displayName,
      avatarConfig,
      createdAt: baseProfile.createdAt,
      lastActive: baseProfile.lastActive,
      stats,
      level,
      featuredBadges,
      equippedCosmetics: {
        hat: avatarConfig.hat,
        glasses: avatarConfig.glasses,
        background: avatarConfig.background,
        profileFrame: avatarConfig.profileFrame,
        chatBubble: avatarConfig.chatBubble,
      },
    };
  }, [baseProfile, uid, featuredBadges, badgeStats]);

  const loading = profileLoading || badgesLoading || statsLoading;

  const refresh = useCallback(async () => {
    try {
      await refreshProfile();
    } catch (err) {
      setError(err as Error);
    }
  }, [refreshProfile]);

  return {
    profile: extendedProfile,
    loading,
    error,
    refresh,
  };
}

export default useProfileData;
```

---

#### Task 3.7: Update ProfileScreen with New Layout

**File:** `src/screens/profile/ProfileScreen.tsx`
**Action:** REPLACE entire file content with the following

```tsx
/**
 * ProfileScreen
 *
 * Redesigned profile screen with:
 * - Profile header with avatar and level
 * - Featured badges showcase
 * - Stats dashboard
 * - Action buttons for navigation
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 */

import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import { signOut } from "firebase/auth";

import { BadgeShowcase } from "@/components/badges";
import {
  ProfileActions,
  ProfileHeader,
  ProfileStats,
} from "@/components/profile";
import Avatar from "@/components/Avatar";
import AvatarCustomizer from "@/components/AvatarCustomizer";
import { LoadingState } from "@/components/ui";
import { PROFILE_FEATURES } from "../../../constants/featureFlags";
import { Spacing, BorderRadius } from "../../../constants/theme";
import { useProfileData } from "@/hooks/useProfileData";
import { getAuthInstance } from "@/services/firebase";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import type { ProfileAction } from "@/types/profile";
import type { AvatarConfig } from "@/types/models";

export default function ProfileScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { profile: baseProfile, refreshProfile } = useUser();
  const { profile, loading, refresh } = useProfileData(
    currentFirebaseUser?.uid,
  );

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
    } catch (error: any) {
      console.error("Sign out error:", error);
    }
  }, []);

  // Action buttons configuration
  const actions = useMemo<ProfileAction[]>(
    () => [
      {
        id: "customize",
        label: "Customize Profile",
        icon: "palette",
        onPress: () => setShowCustomizer(true),
      },
      {
        id: "wallet",
        label: "My Wallet",
        icon: "wallet",
        onPress: () => navigation.navigate("Wallet"),
      },
      {
        id: "shop",
        label: "Shop",
        icon: "shopping",
        onPress: () => navigation.navigate("Shop"),
      },
      {
        id: "tasks",
        label: "Daily Tasks",
        icon: "clipboard-check",
        onPress: () => navigation.navigate("Tasks"),
        badge: 3, // TODO: Get actual count from tasks service
      },
      {
        id: "settings",
        label: "Settings",
        icon: "cog",
        onPress: () => navigation.navigate("Settings"),
      },
      ...(__DEV__
        ? [
            {
              id: "debug",
              label: "Debug",
              icon: "bug",
              onPress: () => navigation.navigate("Debug"),
            },
          ]
        : []),
      {
        id: "blocked",
        label: "Blocked Users",
        icon: "account-cancel",
        onPress: () => navigation.navigate("BlockedUsers"),
      },
    ],
    [navigation],
  );

  // Loading state
  if (loading || !profile) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <LoadingState message="Loading profile..." />
      </View>
    );
  }

  // Render new layout if feature flag enabled
  if (PROFILE_FEATURES.NEW_PROFILE_LAYOUT) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Profile Header */}
        <ProfileHeader
          displayName={profile.displayName}
          username={profile.username}
          avatarConfig={profile.avatarConfig}
          level={profile.level}
          onAvatarPress={() => setShowCustomizer(true)}
          onEditPress={() => navigation.navigate("Settings")}
        />

        {/* Featured Badges */}
        {PROFILE_FEATURES.BADGE_SHOWCASE && (
          <>
            <BadgeShowcase
              badges={profile.featuredBadges}
              onBadgePress={(badge) => {
                // TODO: Open badge detail modal
                console.log("Badge pressed:", badge.badgeId);
              }}
              onViewAll={() => navigation.navigate("BadgeCollection")}
            />
            <Divider style={styles.divider} />
          </>
        )}

        {/* Stats Dashboard */}
        {PROFILE_FEATURES.PROFILE_STATS && (
          <>
            <ProfileStats stats={profile.stats} expanded={false} />
            <Divider style={styles.divider} />
          </>
        )}

        {/* Action Buttons */}
        <ProfileActions actions={actions} />

        {/* Sign Out */}
        <View style={styles.signOutContainer}>
          <Button
            mode="contained"
            onPress={handleSignOut}
            buttonColor={theme.colors.error}
            textColor={theme.colors.onError}
            style={styles.signOutButton}
          >
            Sign Out
          </Button>
        </View>

        {/* Avatar Customizer Modal */}
        <AvatarCustomizer
          visible={showCustomizer}
          onClose={() => setShowCustomizer(false)}
          userId={currentFirebaseUser?.uid || ""}
          currentConfig={
            baseProfile?.avatarConfig || { baseColor: theme.colors.primary }
          }
          onSave={async (newConfig: AvatarConfig) => {
            await refreshProfile();
          }}
        />
      </ScrollView>
    );
  }

  // ========================================
  // LEGACY LAYOUT (feature flag disabled)
  // ========================================
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>
        Profile
      </Text>

      <View style={styles.avatarSection}>
        <Avatar
          config={
            baseProfile?.avatarConfig || { baseColor: theme.colors.primary }
          }
          size={120}
        />
        <Button
          mode="outlined"
          onPress={() => setShowCustomizer(true)}
          style={styles.customizeButton}
          icon="palette"
        >
          Customize Avatar
        </Button>
      </View>

      <AvatarCustomizer
        visible={showCustomizer}
        onClose={() => setShowCustomizer(false)}
        userId={currentFirebaseUser?.uid || ""}
        currentConfig={
          baseProfile?.avatarConfig || { baseColor: theme.colors.primary }
        }
        onSave={async (newConfig: AvatarConfig) => {
          await refreshProfile();
        }}
      />

      <View style={styles.infoSection}>
        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
          Username
        </Text>
        <Text
          style={[
            styles.value,
            {
              backgroundColor: theme.colors.surfaceVariant,
              color: theme.colors.onBackground,
            },
          ]}
        >
          {baseProfile?.username}
        </Text>

        <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
          Display Name
        </Text>
        <Text
          style={[
            styles.value,
            {
              backgroundColor: theme.colors.surfaceVariant,
              color: theme.colors.onBackground,
            },
          ]}
        >
          {baseProfile?.displayName}
        </Text>
      </View>

      <View style={styles.buttonSection}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate("Wallet")}
          icon="wallet"
          style={styles.button}
        >
          My Wallet
        </Button>
        <Button
          mode="contained-tonal"
          onPress={() => navigation.navigate("Shop")}
          icon="shopping"
          style={styles.button}
        >
          Shop
        </Button>
        <Button
          mode="contained-tonal"
          onPress={() => navigation.navigate("Tasks")}
          icon="clipboard-check"
          style={styles.button}
        >
          Daily Tasks
        </Button>
        <Button
          mode="outlined"
          onPress={() => navigation.navigate("Settings")}
          icon="cog"
          style={styles.button}
        >
          Settings
        </Button>
        {__DEV__ && (
          <Button
            mode="outlined"
            onPress={() => navigation.navigate("Debug")}
            icon="bug"
            style={styles.button}
          >
            Debug
          </Button>
        )}
        <Button
          mode="outlined"
          onPress={() => navigation.navigate("BlockedUsers")}
          icon="account-cancel"
          style={styles.button}
        >
          Blocked
        </Button>
        <Button
          mode="contained"
          onPress={handleSignOut}
          buttonColor={theme.colors.error}
          textColor={theme.colors.onError}
          style={[styles.button, styles.signOutButton]}
        >
          Sign Out
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  // New layout styles
  divider: {
    marginVertical: 16,
    marginHorizontal: 16,
  },
  signOutContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  signOutButton: {
    marginTop: Spacing.md,
  },
  // Legacy layout styles
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: Spacing.xl,
    textAlign: "center",
    marginTop: Spacing.xl,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  customizeButton: {
    marginTop: Spacing.md,
  },
  infoSection: {
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  value: {
    fontSize: 16,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  buttonSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  button: {
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
});
```

---

#### Task 3.8: Add BadgeCollection Screen to Navigation

**File:** `src/navigation/RootNavigator.tsx`
**Action:** ADD import at top

```tsx
// Add with other screen imports
import BadgeCollectionScreen from "@/screens/profile/BadgeCollectionScreen";
```

**Action:** ADD screen to ProfileStack (around line 420, after BlockedUsers screen)

```tsx
<Stack.Screen
  name="BadgeCollection"
  component={BadgeCollectionScreen}
  options={{ title: "Badges" }}
/>
```

---

#### Task 3.9: Create BadgeCollectionScreen (Placeholder)

**File:** `src/screens/profile/BadgeCollectionScreen.tsx` (NEW FILE)
**Action:** CREATE with the following content

```tsx
/**
 * BadgeCollectionScreen
 *
 * Displays all badges - earned, in progress, and locked.
 * Allows featuring/unfeaturing badges.
 *
 * TODO: Full implementation in Phase 2 continuation
 */

import { BadgeCard } from "@/components/badges";
import { BADGE_DEFINITIONS } from "@/data/badges";
import { useBadges } from "@/hooks/useBadges";
import { useAuth } from "@/store/AuthContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BadgeCollectionScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { earnedBadges, hasBadge, stats } = useBadges(currentFirebaseUser?.uid);

  const visibleBadges = BADGE_DEFINITIONS.filter((b) => !b.hidden);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Badges" />
      </Appbar.Header>

      {/* Stats Header */}
      <View
        style={[
          styles.statsHeader,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {stats.earned}
          </Text>
          <Text
            style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Earned
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
            {stats.total}
          </Text>
          <Text
            style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Total
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.colors.secondary }]}>
            {stats.percentage}%
          </Text>
          <Text
            style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Complete
          </Text>
        </View>
      </View>

      {/* Badge Grid */}
      <FlatList
        data={visibleBadges}
        keyExtractor={(item) => item.id}
        numColumns={4}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => {
          const userBadge = earnedBadges.find((b) => b.badgeId === item.id);
          return (
            <View style={styles.badgeWrapper}>
              <BadgeCard
                badge={item}
                userBadge={userBadge}
                mode="compact"
                locked={!hasBadge(item.id)}
                onPress={() => {
                  // TODO: Open badge detail modal
                  console.log("Badge:", item.id);
                }}
              />
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#00000020",
  },
  gridContent: {
    padding: 16,
  },
  badgeWrapper: {
    width: "25%",
    padding: 4,
  },
});
```

---

#### Task 3.10: Update Hooks Index

**File:** `src/hooks/index.ts`
**Action:** ADD export

```typescript
export { useProfileData } from "./useProfileData";
```

---

#### Task 3.11: Verify Phase 3 Completion

**Action:** Run TypeScript compiler

```bash
npx tsc --noEmit
```

**Action:** Enable feature flags in `constants/featureFlags.ts`:

- Set `NEW_PROFILE_LAYOUT: true`
- Set `PROFILE_STATS: true`
- Set `LEVEL_SYSTEM: true`

---

### Phase 4-7: Extended Implementation

> **NOTE:** Phases 4-7 follow the same pattern as Phases 1-3. Each phase builds upon the previous and introduces new services, components, and screens. The detailed implementation for these phases will follow the same structured approach:

**Phase 4: Extended Cosmetics**

- Create `src/data/extendedCosmetics.ts` with clothing and accessory items
- Create `src/services/profileFrames.ts` for frame management
- Update `Avatar.tsx` to support frames
- Create `CustomizationModal.tsx` to replace `AvatarCustomizer.tsx`

**Phase 5: Profile Themes & Chat Bubbles**

- Create `src/services/profileThemes.ts`
- Create `src/services/chatBubbles.ts`
- Update message components to use custom bubble styles
- Create theme/bubble preview components

**Phase 6: Shop Integration**

- Update `src/services/shop.ts` for new cosmetic types
- Implement IAP integration (expo-in-app-purchases)
- Create bundle/set purchase flows

**Phase 7: Polish & Performance**

- Add caching to profile data
- Implement loading skeletons
- Add animations for badge earn, level up
- Performance optimization

---

## Summary: AI Implementation Checklist

### Phase 1 Files to Create/Modify:

- [ ] `constants/featureFlags.ts` - Add PROFILE_FEATURES
- [ ] `src/types/profile.ts` - NEW FILE
- [ ] `src/types/models.ts` - Add badge/stats types
- [ ] `src/data/badges.ts` - NEW FILE
- [ ] `src/data/index.ts` - Add export
- [ ] `firebase-backend/firestore.rules` - Add badge rules

### Phase 2 Files to Create/Modify:

- [ ] `src/services/badges.ts` - NEW FILE
- [ ] `src/hooks/useBadges.ts` - NEW FILE
- [ ] `src/components/badges/BadgeCard.tsx` - NEW FILE
- [ ] `src/components/badges/BadgeShowcase.tsx` - NEW FILE
- [ ] `src/components/badges/index.ts` - NEW FILE
- [ ] `src/services/index.ts` - Add export
- [ ] `src/hooks/index.ts` - Add export
- [ ] `src/services/gameAchievements.ts` - Add badge integration

### Phase 3 Files to Create/Modify:

- [ ] `src/components/profile/ProfileHeader.tsx` - NEW FILE
- [ ] `src/components/profile/LevelProgress.tsx` - NEW FILE
- [ ] `src/components/profile/ProfileStats.tsx` - NEW FILE
- [ ] `src/components/profile/ProfileActions.tsx` - NEW FILE
- [ ] `src/components/profile/index.ts` - NEW FILE
- [ ] `src/hooks/useProfileData.ts` - NEW FILE
- [ ] `src/screens/profile/ProfileScreen.tsx` - REPLACE
- [ ] `src/screens/profile/BadgeCollectionScreen.tsx` - NEW FILE
- [ ] `src/navigation/RootNavigator.tsx` - Add BadgeCollection screen

---

## 10. Migration Strategy

### 10.1 Data Migration

```typescript
// Migration script: migrateUserProfiles.ts

async function migrateUserProfile(userId: string): Promise<void> {
  const db = getFirestoreInstance();
  const userRef = doc(db, "Users", userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) return;

  const data = userDoc.data();
  const oldConfig: AvatarConfig = data.avatarConfig || { baseColor: "#FFD93D" };

  // Convert to extended config
  const extendedConfig: ExtendedAvatarConfig = {
    baseColor: oldConfig.baseColor,
    hat: oldConfig.hat,
    glasses: oldConfig.glasses,
    background: oldConfig.background,
    // New fields default to undefined
    clothingTop: undefined,
    clothingBottom: undefined,
    accessoryNeck: undefined,
    accessoryEar: undefined,
    accessoryHand: undefined,
    profileFrame: undefined,
    profileBanner: undefined,
    profileTheme: undefined,
    chatBubble: undefined,
    nameEffect: undefined,
    featuredBadges: [],
  };

  // Initialize stats cache
  const statsCache = {
    gamesPlayed: 0, // Will be populated by Cloud Function
    gamesWon: 0,
    winRate: 0,
    highestStreak: 0,
    currentStreak: 0,
    totalBadges: 0,
    achievementProgress: 0,
    friendCount: 0,
    daysActive: Math.floor(
      (Date.now() - data.createdAt) / (24 * 60 * 60 * 1000),
    ),
  };

  // Initialize level
  const level = {
    current: 1,
    xp: 0,
    xpToNextLevel: 100,
    totalXp: 0,
  };

  await updateDoc(userRef, {
    avatarConfig: extendedConfig,
    statsCache,
    level,
    migratedAt: Date.now(),
  });
}
```

### 10.2 Backwards Compatibility

```typescript
// Helper to normalize avatar config
function normalizeAvatarConfig(
  config: AvatarConfig | ExtendedAvatarConfig,
): ExtendedAvatarConfig {
  // If it's already extended, return as-is
  if ("clothingTop" in config || "profileFrame" in config) {
    return config as ExtendedAvatarConfig;
  }

  // Convert old format to new
  const oldConfig = config as AvatarConfig;
  return {
    baseColor: oldConfig.baseColor,
    hat: oldConfig.hat,
    glasses: oldConfig.glasses,
    background: oldConfig.background,
    // New fields
    clothingTop: undefined,
    clothingBottom: undefined,
    accessoryNeck: undefined,
    accessoryEar: undefined,
    accessoryHand: undefined,
    profileFrame: undefined,
    profileBanner: undefined,
    profileTheme: undefined,
    chatBubble: undefined,
    nameEffect: undefined,
    featuredBadges: [],
  };
}
```

### 10.3 Feature Flags

```typescript
// constants/featureFlags.ts

export const PROFILE_FEATURE_FLAGS = {
  // Phase 1
  EXTENDED_AVATAR_CONFIG: true,

  // Phase 2
  BADGE_SYSTEM: true,
  BADGE_SHOWCASE: true,

  // Phase 3
  NEW_PROFILE_LAYOUT: true,
  PROFILE_STATS: true,
  LEVEL_SYSTEM: true,

  // Phase 4
  EXTENDED_COSMETICS: false, // Enable after Phase 4 complete
  PROFILE_FRAMES: false,

  // Phase 5
  PROFILE_THEMES: false,
  CHAT_BUBBLES: false,

  // Phase 6
  COSMETIC_IAP: false, // Enable after IAP integration
};
```

---

## 11. Testing Plan

### 11.1 Unit Tests

```typescript
// __tests__/profile/badges.test.ts
describe("Badge System", () => {
  describe("Badge Earning", () => {
    it("grants badge when achievement is earned");
    it("does not duplicate already-earned badges");
    it("handles achievement without badge unlock");
  });

  describe("Badge Display", () => {
    it("shows correct tier color");
    it("displays featured badges in order");
    it("handles missing badge definitions gracefully");
  });

  describe("Badge Featuring", () => {
    it("allows featuring up to 5 badges");
    it("updates display order correctly");
    it("removes badge from featured list");
  });
});

// __tests__/profile/customization.test.ts
describe("Customization System", () => {
  describe("Preview", () => {
    it("shows preview without saving");
    it("reverts on cancel");
    it("saves all changed slots");
  });

  describe("Ownership Check", () => {
    it("prevents equipping unowned items");
    it("allows equipping owned items");
    it("shows correct unlock requirements");
  });
});
```

### 11.2 Integration Tests

```typescript
// __tests__/integration/profileFlow.test.ts
describe("Profile Flow Integration", () => {
  it("loads profile with all data correctly");
  it("updates profile stats after game");
  it("grants badge after achievement unlock");
  it("syncs customization across devices");
});

// __tests__/integration/purchaseFlow.test.ts
describe("Cosmetic Purchase Integration", () => {
  it("completes token purchase flow");
  it("handles insufficient funds gracefully");
  it("adds item to inventory after purchase");
});
```

### 11.3 E2E Tests

```typescript
// e2e/profile/profileCustomization.e2e.ts
describe("Profile Customization E2E", () => {
  it("should open customization modal");
  it("should preview cosmetic items");
  it("should save customization changes");
  it("should navigate to badge collection");
  it("should feature/unfeature badges");
});
```

---

## Appendix A: Badge Definitions

### Initial Badge Set

| ID                 | Name             | Description                   | Tier   | Category   | Earned Via                    |
| ------------------ | ---------------- | ----------------------------- | ------ | ---------- | ----------------------------- |
| `first_steps`      | First Steps      | Play your first game          | Bronze | games      | `first_game` achievement      |
| `game_master`      | Game Master      | Play all game types           | Gold   | games      | `game_master` achievement     |
| `streak_7`         | Week Warrior     | Maintain 7-day streak         | Bronze | streak     | `streak_7_days` achievement   |
| `streak_30`        | Monthly Champion | Maintain 30-day streak        | Silver | streak     | `streak_30_days` achievement  |
| `streak_100`       | Centurion        | Maintain 100-day streak       | Gold   | streak     | `streak_100_days` achievement |
| `social_butterfly` | Social Butterfly | Add 10 friends                | Silver | social     | `friends_10` achievement      |
| `flappy_master`    | Sky King         | Score 50 in Flappy Snap       | Gold   | games      | `flappy_50` achievement       |
| `chess_champion`   | Chess Champion   | Win 50 chess games            | Gold   | games      | `chess_50_wins` achievement   |
| `collector`        | Collector        | Own 25 cosmetic items         | Silver | collection | `cosmetics_25` achievement    |
| `night_owl`        | Night Owl        | Play between midnight and 4am | Bronze | special    | `night_owl` achievement       |

---

## Appendix B: Level System Design

### XP Sources

| Source                        | XP Amount |
| ----------------------------- | --------- |
| Game played                   | 10 XP     |
| Game won                      | 25 XP     |
| Achievement earned (Bronze)   | 25 XP     |
| Achievement earned (Silver)   | 50 XP     |
| Achievement earned (Gold)     | 100 XP    |
| Achievement earned (Platinum) | 250 XP    |
| Achievement earned (Diamond)  | 500 XP    |
| Daily task completed          | 20 XP     |
| Weekly task completed         | 100 XP    |
| 7-day streak milestone        | 50 XP     |
| 30-day streak milestone       | 200 XP    |

### Level Progression

| Level | XP Required | Cumulative XP | Reward               |
| ----- | ----------- | ------------- | -------------------- |
| 1     | 0           | 0             | -                    |
| 2     | 100         | 100           | 50 tokens            |
| 3     | 150         | 250           | -                    |
| 4     | 200         | 450           | -                    |
| 5     | 300         | 750           | Frame unlock         |
| 10    | 500         | 2,750         | Badge + 100 tokens   |
| 15    | 750         | 6,000         | -                    |
| 20    | 1,000       | 10,500        | Exclusive frame      |
| 25    | 1,250       | 16,750        | Badge + 250 tokens   |
| 50    | 2,500       | 56,250        | Legendary badge      |
| 100   | 5,000       | 181,250       | Mythic badge + frame |

---

## Appendix C: File Changes Summary

### New Files

- `src/types/profile.ts`
- `src/services/badges.ts`
- `src/services/profileFrames.ts`
- `src/services/chatBubbles.ts`
- `src/services/profileThemes.ts`
- `src/services/profileStats.ts`
- `src/hooks/useProfileData.ts`
- `src/hooks/useBadges.ts`
- `src/hooks/useCustomization.ts`
- `src/components/profile/ProfileHeader.tsx`
- `src/components/profile/ProfileStats.tsx`
- `src/components/profile/ProfileActions.tsx`
- `src/components/profile/LevelProgress.tsx`
- `src/components/profile/EditProfileModal.tsx`
- `src/components/badges/BadgeCard.tsx`
- `src/components/badges/BadgeGrid.tsx`
- `src/components/badges/BadgeShowcase.tsx`
- `src/components/badges/BadgeDetailModal.tsx`
- `src/components/badges/BadgeProgress.tsx`
- `src/components/badges/BadgeFilter.tsx`
- `src/components/customization/CustomizationModal.tsx`
- `src/components/customization/AvatarPreview.tsx`
- `src/components/customization/CosmeticGrid.tsx`
- `src/components/customization/CosmeticItem.tsx`
- `src/components/customization/FramePreview.tsx`
- `src/components/customization/ThemePreview.tsx`
- `src/components/customization/ChatBubblePreview.tsx`
- `src/components/AvatarWithFrame.tsx`
- `src/screens/profile/BadgeCollectionScreen.tsx`
- `src/screens/profile/AchievementsScreen.tsx`
- `src/screens/profile/StatsScreen.tsx`
- `src/data/badges.ts`
- `src/data/profileFrames.ts`
- `src/data/chatBubbles.ts`
- `src/data/profileThemes.ts`

### Modified Files

- `src/types/models.ts` (extend with new types)
- `src/data/cosmetics.ts` (extend with new items)
- `src/services/cosmetics.ts` (extend for new slots)
- `src/services/gameAchievements.ts` (badge granting)
- `src/services/shop.ts` (new cosmetic types)
- `src/components/Avatar.tsx` (frame support)
- `src/screens/profile/ProfileScreen.tsx` (complete redesign)
- `src/navigation/RootNavigator.tsx` (new screens)
- `constants/featureFlags.ts` (new flags)

### Deprecated Files

- `src/components/AvatarCustomizer.tsx` (replaced by CustomizationModal)

---

## Document History

| Version | Date        | Author  | Changes                    |
| ------- | ----------- | ------- | -------------------------- |
| 1.0     | Feb 1, 2026 | Copilot | Initial comprehensive plan |

---

**Next Steps:**

1. Review and approve this plan
2. Create detailed tickets for each phase
3. Begin Phase 1 implementation
4. Schedule design review for UI mockups
