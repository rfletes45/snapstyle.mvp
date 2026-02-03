/**
 * Profile-specific type definitions
 *
 * Contains types for profile screen, customization, badges, and related features.
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md
 */

import type { AchievementTier } from "./achievements";
import type { AvatarConfig } from "./models";

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

  // Availability
  exclusive?: boolean; // Cannot be purchased, only earned
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
 * Check if avatar config is extended format (has new fields beyond base AvatarConfig)
 */
export function isExtendedConfig(
  config: AvatarConfig | ExtendedAvatarConfig,
): config is ExtendedAvatarConfig {
  const extendedConfig = config as ExtendedAvatarConfig;
  return (
    extendedConfig.clothingTop !== undefined ||
    extendedConfig.profileFrame !== undefined ||
    extendedConfig.chatBubble !== undefined ||
    extendedConfig.featuredBadges !== undefined
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
