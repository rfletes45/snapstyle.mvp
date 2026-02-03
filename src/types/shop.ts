/**
 * Shop Type Definitions
 *
 * Complete type definitions for the shop overhaul including:
 * - Points Shop (virtual currency)
 * - Premium Shop (IAP)
 * - Purchases, Gifts, Promotions
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */

import type { ExtendedCosmeticRarity, ExtendedCosmeticSlot } from "./profile";

// =============================================================================
// Base Types
// =============================================================================

/**
 * Shop type identifier
 */
export type ShopType = "points" | "premium";

/**
 * Payment method for purchases
 */
export type PaymentMethod = "tokens" | "iap";

/**
 * Status of a purchase transaction
 */
export type PurchaseStatus =
  | "pending"
  | "completed"
  | "failed"
  | "refunded"
  | "cancelled";

/**
 * Platform identifier for IAP
 */
export type IAPPlatform = "ios" | "android";

// =============================================================================
// Shop Error Codes
// =============================================================================

/**
 * Error codes for shop operations
 */
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

/**
 * Human-readable error messages
 */
export const SHOP_ERROR_MESSAGES: Record<ShopErrorCode, string> = {
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

/**
 * Shop error object
 */
export interface ShopError {
  code: ShopErrorCode;
  message: string;
}

// =============================================================================
// Points Shop Types
// =============================================================================

/**
 * Item available for purchase with tokens in the Points Shop
 */
export interface PointsShopItem {
  /** Unique identifier for this shop listing */
  id: string;

  /** Reference to the underlying cosmetic item ID */
  itemId: string;

  /** Display name */
  name: string;

  /** Description text */
  description: string;

  /** Which slot this item equips to */
  slot: ExtendedCosmeticSlot;

  /** Rarity tier */
  rarity: ExtendedCosmeticRarity;

  /** Image path or emoji for display */
  imagePath: string;

  // -------------------------------------------------------------------------
  // Pricing
  // -------------------------------------------------------------------------

  /** Price in tokens */
  priceTokens: number;

  /** Original price before discount (for sale display) */
  originalPrice?: number;

  /** Discount percentage (0-100) */
  discountPercent?: number;

  // -------------------------------------------------------------------------
  // Availability
  // -------------------------------------------------------------------------

  /** Timestamp when item becomes available */
  availableFrom?: number;

  /** Timestamp when item stops being available (limited time) */
  availableTo?: number;

  /** Limited quantity available (null = unlimited) */
  stock?: number;

  /** Maximum purchases per user */
  purchaseLimit?: number;

  // -------------------------------------------------------------------------
  // Display
  // -------------------------------------------------------------------------

  /** Whether to show in featured section */
  featured: boolean;

  /** Show "NEW" badge until this timestamp */
  newUntil?: number;

  /** Order in listings */
  sortOrder: number;

  /** Tags for filtering: "sale", "new", "limited" */
  tags: string[];

  // -------------------------------------------------------------------------
  // Exclusivity
  // -------------------------------------------------------------------------

  /** Always true - shop items cannot be obtained elsewhere */
  shopExclusive: true;

  /** Whether item is currently active in shop */
  active?: boolean;

  // -------------------------------------------------------------------------
  // Runtime additions (computed client-side)
  // -------------------------------------------------------------------------

  /** Whether the current user owns this item */
  owned?: boolean;

  /** Whether the current user can afford this item */
  canAfford?: boolean;

  /** Remaining purchases allowed for this user */
  purchasesRemaining?: number;
}

/**
 * Avatar customization categories for points shop
 */
export interface PointsShopAvatarCategories {
  hats: PointsShopItem[];
  glasses: PointsShopItem[];
  backgrounds: PointsShopItem[];
  clothingTops: PointsShopItem[];
  clothingBottoms: PointsShopItem[];
  neckAccessories: PointsShopItem[];
  earAccessories: PointsShopItem[];
  handAccessories: PointsShopItem[];
}

/**
 * Profile customization categories for points shop
 */
export interface PointsShopProfileCategories {
  frames: PointsShopItem[];
  banners: PointsShopItem[];
  themes: PointsShopItem[];
}

/**
 * Chat customization categories for points shop
 */
export interface PointsShopChatCategories {
  bubbles: PointsShopItem[];
  nameEffects: PointsShopItem[];
}

/**
 * Complete points shop catalog organized by category
 */
export interface PointsShopCatalog {
  /** Featured items carousel */
  featured: PointsShopItem[];

  /** Avatar customization items */
  avatar: PointsShopAvatarCategories;

  /** Profile customization items */
  profile: PointsShopProfileCategories;

  /** Chat customization items */
  chat: PointsShopChatCategories;

  /** When the catalog was last updated */
  lastUpdated: number;
}

/**
 * Simplified catalog with flat categories (for hook usage)
 */
export interface PointsShopCatalogFlat {
  featured: PointsShopItem[];
  categories: Record<string, PointsShopItem[]>;
  lastUpdated: number;
}

/**
 * Result from a points purchase operation
 */
export interface PointsPurchaseResult {
  success: boolean;
  transactionId?: string;
  newBalance?: number;
  item?: PointsShopItem;
  error?: string;
  errorCode?: ShopErrorCode;
}

// =============================================================================
// Premium Shop Types
// =============================================================================

/**
 * Token pack available for real money purchase
 */
export interface TokenPack {
  /** Unique identifier */
  id: string;

  /** App Store / Play Store product ID */
  productId: string;

  /** Display name */
  name: string;

  /** Base tokens included */
  tokens: number;

  /** Bonus tokens (promotional) */
  bonusTokens: number;

  /** Total tokens received (tokens + bonusTokens) */
  totalTokens: number;

  // -------------------------------------------------------------------------
  // Pricing
  // -------------------------------------------------------------------------

  /** Reference price in USD (actual from store API) */
  basePriceUSD: number;

  /** Localized price string from store API */
  localizedPrice?: string;

  // -------------------------------------------------------------------------
  // Display
  // -------------------------------------------------------------------------

  /** Show "BEST VALUE" badge */
  popular: boolean;

  /** Show in featured section */
  featured: boolean;

  /** Order in listings */
  sortOrder: number;

  // -------------------------------------------------------------------------
  // Limited time offers
  // -------------------------------------------------------------------------

  /** Discount percentage for limited time */
  discountPercent?: number;

  /** When offer starts */
  availableFrom?: number;

  /** When offer ends */
  availableTo?: number;
}

/**
 * Item included in a premium bundle
 */
export interface BundleItem {
  /** Cosmetic item ID */
  itemId: string;

  /** Display name */
  name: string;

  /** Slot type */
  slot: ExtendedCosmeticSlot;

  /** Rarity tier */
  rarity: ExtendedCosmeticRarity;

  /** Image path */
  imagePath: string;
}

/**
 * Premium bundle containing items and tokens
 */
export interface PremiumBundle {
  /** Unique identifier */
  id: string;

  /** App Store / Play Store product ID */
  productId: string;

  /** Display name */
  name: string;

  /** Description text */
  description: string;

  // -------------------------------------------------------------------------
  // Contents
  // -------------------------------------------------------------------------

  /** Items included in bundle */
  items: BundleItem[];

  /** Bonus tokens included */
  bonusTokens: number;

  // -------------------------------------------------------------------------
  // Pricing
  // -------------------------------------------------------------------------

  /** Reference price in USD */
  basePriceUSD: number;

  /** Localized price string */
  localizedPrice?: string;

  /** Combined value of items if bought separately */
  valueUSD: number;

  /** Savings percentage */
  savingsPercent: number;

  // -------------------------------------------------------------------------
  // Display
  // -------------------------------------------------------------------------

  /** Bundle preview image */
  imagePath: string;

  /** Theme: "starter", "premium", "legendary" */
  theme: string;

  /** Show in featured section */
  featured: boolean;

  /** Order in listings */
  sortOrder: number;

  // -------------------------------------------------------------------------
  // Availability
  // -------------------------------------------------------------------------

  /** Whether this is a limited time bundle */
  limitedTime: boolean;

  /** When bundle becomes available */
  availableFrom?: number;

  /** When bundle stops being available */
  availableTo?: number;

  /** Maximum purchases per user (usually 1) */
  purchaseLimit?: number;

  // -------------------------------------------------------------------------
  // Runtime
  // -------------------------------------------------------------------------

  /** Whether current user owns this bundle */
  owned?: boolean;

  /** Remaining purchases for current user */
  purchasesRemaining?: number;
}

/**
 * Premium exclusive item (real money only, cannot buy with tokens)
 */
export interface PremiumExclusiveItem {
  /** Unique identifier */
  id: string;

  /** App Store / Play Store product ID */
  productId: string;

  /** Display name */
  name: string;

  /** Description text */
  description: string;

  /** Slot type */
  slot: ExtendedCosmeticSlot;

  /** Only high-tier for premium exclusives */
  rarity: "legendary" | "mythic";

  /** Image path */
  imagePath: string;

  // -------------------------------------------------------------------------
  // Pricing
  // -------------------------------------------------------------------------

  /** Reference price in USD */
  basePriceUSD: number;

  /** Localized price string */
  localizedPrice?: string;

  // -------------------------------------------------------------------------
  // Exclusivity
  // -------------------------------------------------------------------------

  /** Always true - cannot buy with tokens */
  premiumExclusive: true;

  /** Whether this is a limited edition item */
  limitedEdition: boolean;

  /** When item becomes available */
  availableFrom?: number;

  /** When item stops being available */
  availableTo?: number;

  /** Total supply globally (for limited editions) */
  totalSupply?: number;

  /** Remaining supply */
  remaining?: number;

  // -------------------------------------------------------------------------
  // Display
  // -------------------------------------------------------------------------

  /** Show in featured section */
  featured: boolean;

  /** Order in listings */
  sortOrder: number;

  // -------------------------------------------------------------------------
  // Runtime
  // -------------------------------------------------------------------------

  /** Whether current user owns this item */
  owned?: boolean;
}

/**
 * Item that can be gifted to another user
 */
export interface GiftableItem {
  /** Unique identifier */
  id: string;

  /** App Store / Play Store product ID */
  productId: string;

  /** Display name */
  name: string;

  /** Type of giftable item */
  type: "tokenPack" | "bundle" | "exclusive";

  /** Reference price in USD */
  basePriceUSD: number;

  /** Localized price string */
  localizedPrice?: string;

  /** Default gift message */
  giftMessage: string;
}

/**
 * Complete premium shop catalog
 */
export interface PremiumShopCatalog {
  /** Available token packs */
  tokenPacks: TokenPack[];

  /** Available bundles */
  bundles: PremiumBundle[];

  /** Premium exclusive items */
  exclusives: PremiumExclusiveItem[];

  /** Items available for gifting */
  giftable: GiftableItem[];

  /** Currently featured bundle */
  featuredBundle?: PremiumBundle;

  /** Currently featured exclusive */
  featuredExclusive?: PremiumExclusiveItem;

  /** When the catalog was last updated */
  lastUpdated: number;
}

// =============================================================================
// IAP Types
// =============================================================================

/**
 * Product information from app store
 */
export interface IAPProduct {
  /** Product ID in store */
  productId: string;

  /** Display title */
  title: string;

  /** Description */
  description: string;

  /** Localized price string (e.g., "$9.99") */
  price: string;

  /** Price in micros (cents * 10000) */
  priceAmountMicros: number;

  /** Currency code (e.g., "USD") */
  priceCurrencyCode: string;

  /** Product type */
  type: "consumable" | "non-consumable";
}

/**
 * Result from an IAP purchase
 */
export interface IAPPurchaseResult {
  success: boolean;
  purchaseId?: string;
  grantedItems?: string[];
  grantedTokens?: number;
  error?: string;
  errorCode?: ShopErrorCode;
}

/**
 * Result from restoring purchases
 */
export interface RestoreResult {
  success: boolean;
  restored: string[];
  error?: string;
}

/**
 * Request to validate a receipt
 */
export interface ValidateReceiptRequest {
  platform: IAPPlatform;
  productId: string;
  purchaseToken: string; // Android
  receiptData?: string; // iOS (base64)
  transactionId?: string; // iOS
}

/**
 * Response from receipt validation
 */
export interface ValidateReceiptResponse {
  success: boolean;
  purchaseId?: string;
  grantedItems?: string[];
  grantedTokens?: number;
  error?: string;
}

// =============================================================================
// Purchase Types
// =============================================================================

/**
 * Type of purchase transaction
 */
export type PurchaseType =
  | "points_item"
  | "token_pack"
  | "bundle"
  | "premium_item"
  | "gift_sent";

/**
 * Record of a purchase transaction
 */
export interface PurchaseRecord {
  /** Unique identifier */
  id: string;

  /** User who made the purchase */
  uid: string;

  /** When the purchase was made */
  timestamp: number;

  // -------------------------------------------------------------------------
  // What was purchased
  // -------------------------------------------------------------------------

  /** Type of purchase */
  type: PurchaseType;

  /** Item/product ID */
  itemId: string;

  /** Display name */
  itemName: string;

  // -------------------------------------------------------------------------
  // Payment
  // -------------------------------------------------------------------------

  /** Payment method used */
  paymentType: PaymentMethod;

  /** Amount paid (tokens or cents) */
  amount: number;

  /** Currency code for IAP */
  currency?: string;

  /** Transaction ID from store */
  transactionId?: string;

  /** Platform for IAP */
  platform?: IAPPlatform;

  // -------------------------------------------------------------------------
  // Rewards
  // -------------------------------------------------------------------------

  /** Item IDs received */
  itemsReceived: string[];

  /** Tokens received (for token packs) */
  tokensReceived?: number;

  // -------------------------------------------------------------------------
  // Gift info
  // -------------------------------------------------------------------------

  /** Recipient UID (for gifts) */
  recipientUid?: string;

  /** Gift message */
  giftMessage?: string;

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  /** Current status */
  status: PurchaseStatus;
}

/**
 * Generic purchase result
 */
export interface PurchaseResult {
  success: boolean;
  purchaseId?: string;
  newBalance?: number;
  itemsReceived?: string[];
  tokensReceived?: number;
  error?: string;
  errorCode?: ShopErrorCode;
}

// =============================================================================
// Gift Types
// =============================================================================

/**
 * Status of a gift
 */
export type GiftStatus = "pending" | "delivered" | "opened" | "expired";

/**
 * Gift record
 */
export interface Gift {
  /** Unique identifier */
  id: string;

  // -------------------------------------------------------------------------
  // Sender
  // -------------------------------------------------------------------------

  /** Sender user ID */
  senderUid: string;

  /** Sender display name */
  senderName: string;

  // -------------------------------------------------------------------------
  // Recipient
  // -------------------------------------------------------------------------

  /** Recipient user ID */
  recipientUid: string;

  /** Recipient display name */
  recipientName: string;

  // -------------------------------------------------------------------------
  // Item
  // -------------------------------------------------------------------------

  /** Item/product ID */
  itemId: string;

  /** Type of gifted item */
  itemType: "tokenPack" | "bundle" | "exclusive";

  /** Display name */
  itemName: string;

  /** Image path */
  itemImagePath: string;

  /** Personal message */
  message: string;

  // -------------------------------------------------------------------------
  // Transaction
  // -------------------------------------------------------------------------

  /** Associated purchase ID */
  purchaseId: string;

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  /** Current status */
  status: GiftStatus;

  /** When the gift was sent */
  sentAt: number;

  /** When the gift was delivered */
  deliveredAt?: number;

  /** When the gift was opened */
  openedAt?: number;

  /** When the gift expires (30 days after sent) */
  expiresAt: number;
}

/**
 * Result from sending a gift
 */
export interface GiftPurchaseResult {
  success: boolean;
  giftId?: string;
  error?: string;
  errorCode?: ShopErrorCode;
}

// =============================================================================
// Promotion Types
// =============================================================================

/**
 * Type of promotion
 */
export type PromotionType =
  | "discount"
  | "bundle_deal"
  | "flash_sale"
  | "seasonal";

/**
 * What the promotion targets
 */
export type PromotionTargetType = "item" | "category" | "all";

/**
 * How the discount is applied
 */
export type DiscountType = "percent" | "fixed";

/**
 * Active promotion/sale
 */
export interface Promotion {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Type of promotion */
  type: PromotionType;

  // -------------------------------------------------------------------------
  // Target
  // -------------------------------------------------------------------------

  /** What this promotion applies to */
  targetType: PromotionTargetType;

  /** Specific item IDs (if targetType is 'item') */
  targetIds?: string[];

  /** Category name (if targetType is 'category') */
  targetCategory?: string;

  // -------------------------------------------------------------------------
  // Discount
  // -------------------------------------------------------------------------

  /** How discount is calculated */
  discountType: DiscountType;

  /** Discount amount (percentage or fixed amount) */
  discountValue: number;

  // -------------------------------------------------------------------------
  // Timing
  // -------------------------------------------------------------------------

  /** When promotion starts */
  startsAt: number;

  /** When promotion ends */
  endsAt: number;

  // -------------------------------------------------------------------------
  // Display
  // -------------------------------------------------------------------------

  /** Banner image URL */
  bannerImage?: string;

  /** Badge text: "50% OFF", "FLASH SALE", etc. */
  badgeText: string;

  // -------------------------------------------------------------------------
  // Limits
  // -------------------------------------------------------------------------

  /** Total usage limit across all users */
  usageLimit?: number;

  /** Usage limit per user */
  perUserLimit?: number;
}

/**
 * Daily deal item
 */
export interface DailyDeal {
  /** Unique identifier */
  id: string;

  /** Item being discounted */
  itemId: string;

  /** Full item data */
  item: PointsShopItem;

  /** Original price before discount */
  originalPrice: number;

  /** Discounted price */
  dealPrice: number;

  /** Discount percentage */
  discountPercent: number;

  /** When deal starts */
  startsAt: number;

  /** When deal ends */
  endsAt: number;

  /** Position in deals grid (1-6) */
  slot: number;
}

// =============================================================================
// Wishlist Types
// =============================================================================

/**
 * Item on user's wishlist
 */
export interface WishlistItem {
  /** Item ID */
  itemId: string;

  /** Which shop the item is from */
  shopType: ShopType;

  /** Price when item was added */
  priceWhenAdded: number;

  /** Whether to notify when on sale */
  notifyOnSale: boolean;

  /** When item was added to wishlist */
  addedAt: number;

  // -------------------------------------------------------------------------
  // Runtime (computed)
  // -------------------------------------------------------------------------

  /** Full item data */
  item?: PointsShopItem | PremiumExclusiveItem;

  /** Current price */
  currentPrice?: number;

  /** Whether price has changed since adding */
  priceChanged?: boolean;

  /** Whether item is currently on sale */
  onSale?: boolean;
}

// =============================================================================
// Navigation Types
// =============================================================================

/**
 * Shop stack navigation param list
 */
export type ShopStackParamList = {
  ShopHub: undefined;
  PointsShop: { initialCategory?: string } | undefined;
  PremiumShop: { initialTab?: string } | undefined;
  PurchaseHistory: undefined;
  ItemDetail: { itemId: string; shopType: ShopType };
  GiftSelect: { itemId: string };
  GiftConfirm: { itemId: string; recipientUid: string };
};

/**
 * Points shop tab options
 */
export type PointsShopTab = "avatar" | "profile" | "chat" | "effects";

/**
 * Premium shop tab options
 */
export type PremiumShopTab = "tokens" | "bundles" | "exclusives" | "gifts";

// =============================================================================
// Category Configuration
// =============================================================================

/**
 * Category configuration for filtering
 */
export interface ShopCategoryConfig {
  /** Unique key */
  key: string;

  /** Display label */
  label: string;

  /** Icon name or emoji */
  icon: string;

  /** Which slots this category includes */
  slots: ExtendedCosmeticSlot[];
}

/**
 * Tab configuration with categories
 */
export interface ShopTabConfig {
  /** Tab identifier */
  tab: PointsShopTab;

  /** Display label */
  label: string;

  /** Icon name */
  icon: string;

  /** Categories within this tab */
  categories: ShopCategoryConfig[];
}

/**
 * Points shop category configuration
 */
export const POINTS_SHOP_TABS: ShopTabConfig[] = [
  {
    tab: "avatar",
    label: "Avatar",
    icon: "account-outline",
    categories: [
      { key: "hats", label: "Hats", icon: "🎩", slots: ["hat"] },
      { key: "glasses", label: "Glasses", icon: "👓", slots: ["glasses"] },
      {
        key: "backgrounds",
        label: "Backgrounds",
        icon: "🌈",
        slots: ["background"],
      },
      { key: "tops", label: "Tops", icon: "👕", slots: ["clothing_top"] },
      {
        key: "bottoms",
        label: "Bottoms",
        icon: "👖",
        slots: ["clothing_bottom"],
      },
      {
        key: "accessories",
        label: "Accessories",
        icon: "💍",
        slots: ["accessory_neck", "accessory_ear", "accessory_hand"],
      },
    ],
  },
  {
    tab: "profile",
    label: "Profile",
    icon: "card-account-details-outline",
    categories: [
      { key: "frames", label: "Frames", icon: "🖼️", slots: ["profile_frame"] },
      {
        key: "banners",
        label: "Banners",
        icon: "🏳️",
        slots: ["profile_banner"],
      },
      { key: "themes", label: "Themes", icon: "🎨", slots: ["profile_theme"] },
    ],
  },
  {
    tab: "chat",
    label: "Chat",
    icon: "chat-outline",
    categories: [
      { key: "bubbles", label: "Bubbles", icon: "💬", slots: ["chat_bubble"] },
      {
        key: "nameEffects",
        label: "Name Effects",
        icon: "✨",
        slots: ["name_effect"],
      },
    ],
  },
  {
    tab: "effects",
    label: "Effects",
    icon: "shimmer",
    categories: [
      // Future: emote_pack, sound_effect, avatar_animation
    ],
  },
];

// =============================================================================
// UI Constants
// =============================================================================

/**
 * Rarity color palette for shop items
 */
export const RARITY_COLORS: Record<ExtendedCosmeticRarity, string> = {
  common: "#9E9E9E", // Gray
  rare: "#2196F3", // Blue
  epic: "#9C27B0", // Purple
  legendary: "#FF9800", // Orange
  mythic: "#E91E63", // Pink
} as const;

/**
 * Rarity type alias for shop items
 */
export type ShopItemRarity = ExtendedCosmeticRarity;

/**
 * Shop color scheme
 */
export const SHOP_COLORS = {
  points: {
    primary: "#FFD700", // Gold for tokens
    accent: "#FFA500", // Orange accent
    background: "#1A1A2E", // Dark blue background
  },
  premium: {
    primary: "#9C27B0", // Purple for premium
    accent: "#E91E63", // Pink accent
    background: "#0D0D1A", // Darker background
  },
  badges: {
    sale: "#F44336", // Red
    new: "#4CAF50", // Green
    popular: "#2196F3", // Blue
    limited: "#FF9800", // Orange
    exclusive: "#9C27B0", // Purple
    soldOut: "#616161", // Gray
    owned: "#4CAF50", // Green
  },
} as const;

/**
 * Badge configurations for shop items
 */
export const SHOP_BADGES = {
  sale: {
    background: "#F44336",
    text: "SALE",
  },
  new: {
    background: "#4CAF50",
    text: "NEW",
  },
  popular: {
    background: "#2196F3",
    text: "POPULAR",
  },
  limited: {
    background: "#FF9800",
    text: "LIMITED",
  },
  exclusive: {
    background: "#9C27B0",
    text: "EXCLUSIVE",
  },
  soldOut: {
    background: "#616161",
    text: "SOLD OUT",
  },
  owned: {
    background: "#4CAF50",
    text: "OWNED",
  },
} as const;
