/**
 * Unified Cosmetics Module
 *
 * Central barrel export for the cosmetics system.
 *
 * @module cosmetics
 */

// Types
export type {
  ChatAppearance,
  CosmeticAssetMap,
  CosmeticDefinition,
  CosmeticImageSource,
  CosmeticRarity,
  CosmeticSourceType,
  CosmeticType,
  Entitlement,
  EntitlementDoc,
  EquippedCosmetics,
  SenderStyle,
} from "./types";

export { DEFAULT_CHAT_APPEARANCE, DEFAULT_EQUIPPED } from "./types";

// Asset Registry
export {
  backgroundAssets,
  badgeAssets,
  decorationAssets,
  getAllLoadedIds,
  getCosmeticAsset,
  getLoadedIds,
  hasCosmeticAsset,
  themePreviewAssets,
} from "./assetRegistry";

// Catalog
export {
  COSMETICS_CATALOG,
  getCosmeticById,
  getCosmeticsByRarity,
  getCosmeticsByType,
  getFreeCosmetics,
  getShopCosmetics,
  isCosmeticAvailable,
  searchCosmetics,
} from "./catalog";

// Chat Catalog
export {
  CHAT_ANIMAL_THEME_CATALOG,
  CHAT_BUBBLE_COLOR_CATALOG,
  CHAT_FONT_CATALOG,
  CHAT_FONT_COLOR_CATALOG,
  getChatCosmeticDefinitions,
} from "./chatCatalog";

// Chat Defaults
export {
  CHAT_BUBBLE_COLORS,
  CHAT_FONT_COLORS,
  CHAT_FONT_FAMILIES,
  DEFAULT_CHAT_BUBBLE_COLOR_DARK,
  DEFAULT_CHAT_BUBBLE_COLOR_LIGHT,
  DEFAULT_CHAT_BUBBLE_TEXT_COLOR_DARK,
  DEFAULT_CHAT_BUBBLE_TEXT_COLOR_LIGHT,
  DEFAULT_CHAT_FONT_COLOR_ID,
  DEFAULT_CHAT_FONT_FAMILY,
  DEFAULT_CHAT_FONT_ID,
  getChatBubbleColor,
  getChatFontColor,
  getChatFontFamily,
} from "./chatDefaults";

// Chat Appearance Resolver
export {
  buildSenderStyle,
  contrastTextColor,
  relativeLuminance,
  resolveIncomingBubbleStyle,
  resolveOutgoingChatStyle,
  sanitizeChatAppearance,
} from "./chatAppearanceResolver";
export type {
  ResolveChatStyleOptions,
  ResolveIncomingStyleOptions,
  ResolvedChatStyle,
} from "./chatAppearanceResolver";
