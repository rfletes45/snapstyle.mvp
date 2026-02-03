/**
 * Shop Components Index
 *
 * Exports all shop-related components.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */

// =============================================================================
// Shop Item Components (Phase 2)
// =============================================================================

export { FeaturedCarousel } from "./FeaturedCarousel";
export { ShopItemCard, getRarityColor } from "./ShopItemCard";
export { ShopItemGrid } from "./ShopItemGrid";

// =============================================================================
// Premium Shop Components (Phase 3)
// =============================================================================

export { PremiumBundleCard } from "./PremiumBundleCard";
export type { PremiumBundleCardProps } from "./PremiumBundleCard";

export { PremiumExclusiveCard } from "./PremiumExclusiveCard";
export type { PremiumExclusiveCardProps } from "./PremiumExclusiveCard";

// =============================================================================
// Bundle & Token Components (Existing)
// =============================================================================

export { ShopBundleCard } from "./ShopBundleCard";
export type { ShopBundleCardProps } from "./ShopBundleCard";

export { TokenPackCard } from "./TokenPackCard";
export type { TokenPackCardProps } from "./TokenPackCard";

// =============================================================================
// Modal Components
// =============================================================================

export { PurchaseConfirmationModal } from "./PurchaseConfirmationModal";
export type { PurchaseConfirmationModalProps } from "./PurchaseConfirmationModal";

// =============================================================================
// Phase 4: Additional Features
// =============================================================================

// Wishlist
export { WishlistButton } from "./WishlistButton";
export type { WishlistButtonProps } from "./WishlistButton";

// Gifting
export { GiftModal } from "./GiftModal";

// Daily Deals
export { DailyDealsSection } from "./DailyDealsSection";

// Promotions
export {
  CompactPromoBanner,
  PromoBanner,
  PromoCodeBanner,
} from "./PromoBanner";

// Item Preview
export { ItemPreviewModal } from "./ItemPreviewModal";
