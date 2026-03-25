/**
 * Unified Cosmetics Type Definitions
 *
 * Canonical types for the cosmetics system. All cosmetic items —
 * decorations, badges, backgrounds, themes — share these base types.
 *
 * @module cosmetics/types
 */

import type { ImageSourcePropType } from "react-native";

// =============================================================================
// Core Enums & Literals
// =============================================================================

/** Every distinct cosmetic category. Expand this union when adding new slots. */
export type CosmeticType =
  | "badge"
  | "background"
  | "decoration"
  | "theme"
  | "chat_bubble_color"
  | "chat_font"
  | "chat_font_color"
  | "chat_animal_theme";

/** Rarity tiers (ordered lowest → highest). */
export type CosmeticRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

/** How a player can obtain this cosmetic. */
export type CosmeticSourceType =
  | "free"
  | "starter"
  | "shop"
  | "achievement"
  | "milestone"
  | "event"
  | "exclusive"
  | "grant";

// =============================================================================
// Catalog Definition
// =============================================================================

/**
 * Static definition of a cosmetic item in the catalog.
 * This is the single source of truth for what cosmetics exist.
 */
export interface CosmeticDefinition {
  /** Canonical cosmetic ID — must match asset registry key. */
  id: string;
  /** Which slot/category this cosmetic belongs to. */
  type: CosmeticType;
  /** Display name. */
  name: string;
  /** Short description for UI. */
  description: string;
  /** Visual rarity. */
  rarity: CosmeticRarity;
  /** Primary way to obtain this cosmetic. */
  source: CosmeticSourceType;
  /** Token price if purchasable (source === "shop"). */
  priceTokens?: number;
  /** Achievement ID if source === "achievement". */
  achievementId?: string;
  /** Milestone value if source === "milestone" (e.g. streak day count). */
  milestoneValue?: string;
  /** Event identifier if source === "event". */
  eventId?: string;
  /** Searchable/filterable tags. */
  tags?: string[];
  /**
   * Key into the asset registry. Defaults to `id` if omitted.
   * Only set when the asset file name differs from the cosmetic ID.
   */
  assetKey?: string;
  /** Sort priority within its type (lower = first). */
  sortOrder?: number;
  /**
   * Type-specific metadata.
   * - chat_bubble_color: { bubbleColorValue: string (hex) }
   * - chat_font: { fontFamily: string }
   * - chat_animal_theme: { comingSoon?: boolean }
   */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Asset Registry
// =============================================================================

/** A resolved image source produced by require() or a URI object. */
export type CosmeticImageSource = ImageSourcePropType;

/** Typed per-category asset map. */
export type CosmeticAssetMap<K extends string = string> = Record<
  K,
  CosmeticImageSource
>;

// =============================================================================
// Entitlements (Ownership)
// =============================================================================

/**
 * Firestore doc shape: Users/{uid}/Entitlements/{cosmeticId}
 */
export interface EntitlementDoc {
  /** Cosmetic ID (mirrors the doc key). */
  cosmeticId: string;
  /** Which cosmetic category this belongs to. */
  type: CosmeticType;
  /** When the entitlement was created (epoch ms). */
  grantedAt: number;
  /** How the user obtained this cosmetic. */
  source: CosmeticSourceType;
  /** Optional metadata (e.g. transactionId, achievementId, grantedBy). */
  metadata?: Record<string, unknown>;
}

/**
 * Client-side lightweight entitlement record.
 * Mirrors EntitlementDoc but always available as a plain object.
 */
export interface Entitlement {
  cosmeticId: string;
  type: CosmeticType;
  grantedAt: number;
  source: CosmeticSourceType;
}

// =============================================================================
// Store Curations (Featured Items & Bundles)
// =============================================================================

/**
 * A featured item in the store — wraps an existing catalog entry with
 * promotional metadata (banner text, expiry, badge label).
 */
export interface FeaturedItem {
  /** The catalog cosmetic ID being featured. */
  cosmeticId: string;
  /** Short promo headline, e.g. "Staff Pick" or "New Arrival". */
  headline: string;
  /** Optional subtitle / marketing copy. */
  subtitle?: string;
  /** Badge label rendered on the card, e.g. "NEW", "HOT", "SALE". */
  badge?: "NEW" | "HOT" | "SALE" | "LIMITED";
  /** When the feature expires (epoch ms). Omit for evergreen features. */
  expiresAt?: number;
}

/**
 * A bundle of cosmetic items sold at a discounted price.
 */
export interface CosmeticBundle {
  /** Unique bundle ID. */
  id: string;
  /** Display name. */
  name: string;
  /** Short description. */
  description: string;
  /** IDs of cosmetics included in this bundle (catalog entries). */
  cosmeticIds: string[];
  /** Bundle price (tokens) — should be less than sum of individual prices. */
  priceTokens: number;
  /** Sum of individual prices before discount (for "SAVE X%" display). */
  originalPriceTokens: number;
  /** Visual rarity tier for the bundle card. */
  rarity: CosmeticRarity;
  /** Optional badge label. */
  badge?: "BEST VALUE" | "POPULAR" | "LIMITED";
  /** Sort order in the bundles section. */
  sortOrder?: number;
}

// =============================================================================
// Equipped State (lives on Users/{uid} profile doc)
// =============================================================================

// =============================================================================
// Chat Appearance
// =============================================================================

/**
 * User's chat appearance settings.
 * Stored on the user profile doc alongside other equipped cosmetics.
 *
 * - bubbleColorId: references a chat_bubble_color catalog entry (null = default)
 * - fontId: references a chat_font catalog entry (null = system/default font)
 * - fontColorId: references a chat_font_color catalog entry (null = theme-adaptive default)
 * - animalThemeId: references a chat_animal_theme catalog entry (null = default duck)
 */
export interface ChatAppearance {
  bubbleColorId: string | null;
  fontId: string | null;
  fontColorId: string | null;
  animalThemeId: string | null;
}

/** Default chat appearance for new users (no cosmetics equipped). */
export const DEFAULT_CHAT_APPEARANCE: ChatAppearance = {
  bubbleColorId: null,
  fontId: null,
  fontColorId: null,
  animalThemeId: null,
};

/**
 * Snapshot of a sender's chat style, stamped on each outgoing message.
 * Recipients use this to render the sender's bubble color and font.
 *
 * Stored as an optional field on each message document. When missing
 * (historical messages), viewers may fall back to resolving style
 * from the sender's profile.
 */
export interface SenderStyle {
  /** Bubble color catalog ID (null = default). */
  bubbleColorId?: string | null;
  /** Resolved hex color of the bubble (for forward-compat / no catalog lookup). */
  bubbleColorHex?: string | null;
  /** Font catalog ID (null = platform default). */
  fontId?: string | null;
  /** Resolved font family key (for forward-compat / no catalog lookup). */
  fontKey?: string | null;
  /** Font color catalog ID (null = theme-adaptive default). */
  fontColorId?: string | null;
  /** Resolved hex font color (for forward-compat / no catalog lookup). */
  fontColorHex?: string | null;
  /** Animal theme catalog ID (null = default duck). */
  animalThemeId?: string | null;
  /** Schema version for future migrations. */
  v: 1;
}

/**
 * Shape of all cosmetic-equipped fields on the user profile doc.
 * Each field is nullable (null = nothing equipped in that slot).
 */
export interface EquippedCosmetics {
  equippedDecorationId: string | null;
  equippedBackgroundId: string | null;
  equippedThemeId: string;
  featuredBadgeIds: string[];
  chatAppearance: ChatAppearance;
}

/** Default equipped state for new users. */
export const DEFAULT_EQUIPPED: EquippedCosmetics = {
  equippedDecorationId: null,
  equippedBackgroundId: null,
  equippedThemeId: "default",
  featuredBadgeIds: [],
  chatAppearance: DEFAULT_CHAT_APPEARANCE,
};
