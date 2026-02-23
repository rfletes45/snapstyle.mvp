/**
 * CosmeticsShopScreen
 *
 * Browse and purchase cosmetics (Backgrounds, Decorations, Badges, Themes)
 * with tokens. Features:
 *   - Category tabs (All, Decorations, Backgrounds, Themes, Badges)
 *   - Featured items carousel
 *   - Bundle deals section
 *   - Item grid with owned/purchasable status
 *   - Purchase confirmation with wallet balance
 *   - Post-purchase "Equip Now" action → navigate to Customization Hub
 *
 * Uses the local COSMETICS_CATALOG and purchaseCosmeticWithTokens Cloud Function.
 *
 * @module screens/shop/CosmeticsShopScreen
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator, Appbar, Searchbar, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CosmeticImage } from "@/components/CosmeticImage";
import { getAnimalImage } from "@/cosmetics/animalAssets";
import { getCosmeticAsset, hasCosmeticAsset } from "@/cosmetics/assetRegistry";
import { getCosmeticById } from "@/cosmetics/catalog";
import { contrastTextColor } from "@/cosmetics/chatAppearanceResolver";
import {
  getChatBubbleColor,
  getChatFontFamily,
} from "@/cosmetics/chatDefaults";
import {
  getBundleUnownedIds,
  isBundleFullyOwned,
} from "@/cosmetics/storeCurations";
import type { CosmeticBundle, CosmeticDefinition } from "@/cosmetics/types";
import {
  type BundleWithStatus,
  type CosmeticsShopTab,
  type ResolvedFeatured,
  useCosmeticsShop,
} from "@/hooks/useCosmeticsShop";
import { playAnimalSound } from "@/services/chat/animalSoundService";
import { prefetchShopCategory } from "@/services/cosmeticsAssetCache";
import { formatTokenAmount } from "@/services/economy";
import { useAuth } from "@/store/AuthContext";
import { useColors } from "@/store/ThemeContext";

import { BorderRadius, Spacing, THEME_METADATA } from "@/constants/theme";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_COLUMNS = 2;
const GRID_GAP = Spacing.sm;
const GRID_PADDING = Spacing.lg;
const ITEM_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
  GRID_COLUMNS;
const THEME_CARD_GAP = Spacing.md;
const THEME_CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - THEME_CARD_GAP) / 2;
const FEATURED_CARD_WIDTH = SCREEN_WIDTH * 0.65;

const RARITY_COLORS: Record<string, string> = {
  common: "#9E9E9E",
  uncommon: "#4CAF50",
  rare: "#2196F3",
  epic: "#9C27B0",
  legendary: "#FF9800",
  mythic: "#F44336",
};

const BADGE_COLORS: Record<string, string> = {
  NEW: "#4CAF50",
  HOT: "#FF5722",
  SALE: "#E91E63",
  LIMITED: "#FF9800",
};

interface TabConfig {
  id: CosmeticsShopTab;
  label: string;
  icon: string;
}

// ── Section-aware tab groups ──────────────────────────────────────────────
type ShopSection = "profile" | "chat";

const PROFILE_TABS: TabConfig[] = [
  { id: "all", label: "All", icon: "store" },
  { id: "decoration", label: "Decorations", icon: "star-circle" },
  { id: "background", label: "Backgrounds", icon: "image" },
  { id: "theme", label: "Themes", icon: "palette" },
  { id: "badge", label: "Badges", icon: "shield-star" },
];

const CHAT_TABS: TabConfig[] = [
  { id: "all", label: "All", icon: "store" },
  { id: "chat_bubble_color", label: "Bubble Colors", icon: "chat" },
  { id: "chat_font", label: "Fonts", icon: "format-font" },
  { id: "chat_animal_theme", label: "Animals", icon: "paw" },
];

/** Types that belong to the Chat section. */
const CHAT_TYPES = new Set<string>([
  "chat_bubble_color",
  "chat_font",
  "chat_animal_theme",
]);
/** Types that belong to the Profile section. */
const PROFILE_TYPES = new Set<string>([
  "decoration",
  "background",
  "theme",
  "badge",
]);

// =============================================================================
// Shop Item Card
// =============================================================================

interface ShopGridItemProps {
  item: CosmeticDefinition;
  isOwned: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const ShopGridItem = React.memo(function ShopGridItem({
  item,
  isOwned,
  onPress,
}: ShopGridItemProps) {
  const colors = useColors();
  const hasAsset = hasCosmeticAsset(item.type, item.assetKey ?? item.id);
  const assetSource = hasAsset
    ? getCosmeticAsset(item.type, item.assetKey ?? item.id)
    : null;
  const rarityColor = RARITY_COLORS[item.rarity] ?? colors.textSecondary;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.gridItem,
        {
          backgroundColor: colors.surfaceVariant,
          borderColor: isOwned ? colors.primary + "50" : rarityColor + "30",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Image or placeholder */}
      {assetSource ? (
        <CosmeticImage
          source={assetSource}
          style={styles.gridItemImage}
          recyclingKey={item.id}
          debugLabel={`shop-grid-${item.id}`}
        />
      ) : (
        <View
          style={[
            styles.gridItemPlaceholder,
            { backgroundColor: colors.primary + "10" },
          ]}
        >
          <MaterialCommunityIcons
            name={
              item.type === "decoration"
                ? "star-circle"
                : item.type === "theme"
                  ? "palette"
                  : item.type === "badge"
                    ? "shield-star"
                    : "image"
            }
            size={32}
            color={colors.primary}
          />
        </View>
      )}

      {/* Name */}
      <Text
        style={[styles.gridItemName, { color: colors.text }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>

      {/* Price or owned badge */}
      <View style={styles.gridItemFooter}>
        {isOwned ? (
          <View
            style={[
              styles.ownedBadge,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <MaterialCommunityIcons
              name="check-circle"
              size={12}
              color={colors.primary}
            />
            <Text style={[styles.ownedText, { color: colors.primary }]}>
              Owned
            </Text>
          </View>
        ) : item.priceTokens ? (
          <View style={styles.priceRow}>
            <MaterialCommunityIcons
              name="star-circle"
              size={14}
              color="#FFD700"
            />
            <Text style={[styles.priceText, { color: colors.text }]}>
              {formatTokenAmount(item.priceTokens)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.freeText, { color: colors.primary }]}>Free</Text>
        )}
      </View>

      {/* Rarity dot */}
      <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
    </Pressable>
  );
});

// =============================================================================
// Chat Bubble Color Card
// =============================================================================

interface ShopChatBubbleCardProps {
  item: CosmeticDefinition;
  isOwned: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const ShopChatBubbleCard = React.memo(function ShopChatBubbleCard({
  item,
  isOwned,
  onPress,
}: ShopChatBubbleCardProps) {
  const colors = useColors();
  const bubbleColor =
    (item.metadata?.bubbleColorValue as string) ??
    getChatBubbleColor(item.id) ??
    colors.primary;
  const rarityColor = RARITY_COLORS[item.rarity] ?? colors.textSecondary;

  // Compute contrast text color
  const textOnBubble = contrastTextColor(bubbleColor);

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} bubble color${isOwned ? ", owned" : item.priceTokens ? `, ${item.priceTokens} tokens` : ", free"}`}
      style={({ pressed }) => [
        styles.gridItem,
        {
          backgroundColor: colors.surfaceVariant,
          borderColor: isOwned ? colors.primary + "50" : rarityColor + "30",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Bubble preview */}
      <View
        style={[
          styles.chatBubblePreviewContainer,
          { backgroundColor: colors.surface },
        ]}
      >
        <View
          style={[
            styles.chatBubblePreview,
            { backgroundColor: bubbleColor, borderRadius: 16 },
          ]}
        >
          <Text
            style={[styles.chatBubblePreviewText, { color: textOnBubble }]}
            numberOfLines={1}
          >
            Hey there! 👋
          </Text>
        </View>
        <View
          style={[
            styles.chatBubblePreviewSmall,
            { backgroundColor: bubbleColor, borderRadius: 14 },
          ]}
        >
          <Text
            style={[styles.chatBubblePreviewTextSm, { color: textOnBubble }]}
            numberOfLines={1}
          >
            Love this color!
          </Text>
        </View>
      </View>

      {/* Name */}
      <Text
        style={[styles.gridItemName, { color: colors.text }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>

      {/* Price or owned badge */}
      <View style={styles.gridItemFooter}>
        {isOwned ? (
          <View
            style={[
              styles.ownedBadge,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <MaterialCommunityIcons
              name="check-circle"
              size={12}
              color={colors.primary}
            />
            <Text style={[styles.ownedText, { color: colors.primary }]}>
              Owned
            </Text>
          </View>
        ) : item.priceTokens ? (
          <View style={styles.priceRow}>
            <MaterialCommunityIcons
              name="star-circle"
              size={14}
              color="#FFD700"
            />
            <Text style={[styles.priceText, { color: colors.text }]}>
              {formatTokenAmount(item.priceTokens)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.freeText, { color: colors.primary }]}>Free</Text>
        )}
      </View>

      {/* Rarity dot */}
      <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
    </Pressable>
  );
});

// =============================================================================
// Chat Font Card
// =============================================================================

interface ShopChatFontCardProps {
  item: CosmeticDefinition;
  isOwned: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const ShopChatFontCard = React.memo(function ShopChatFontCard({
  item,
  isOwned,
  onPress,
}: ShopChatFontCardProps) {
  const colors = useColors();
  const fontFamily =
    (item.metadata?.fontFamily as string) ??
    getChatFontFamily(item.id) ??
    undefined;
  const rarityColor = RARITY_COLORS[item.rarity] ?? colors.textSecondary;

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} font${isOwned ? ", owned" : item.priceTokens ? `, ${item.priceTokens} tokens` : ", free"}`}
      style={({ pressed }) => [
        styles.gridItem,
        {
          backgroundColor: colors.surfaceVariant,
          borderColor: isOwned ? colors.primary + "50" : rarityColor + "30",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Font preview */}
      <View
        style={[
          styles.chatFontPreviewContainer,
          { backgroundColor: colors.surface },
        ]}
      >
        <Text
          style={[
            styles.chatFontPreviewLarge,
            { color: colors.text, fontFamily },
          ]}
          numberOfLines={1}
        >
          Aa Bb Cc
        </Text>
        <View
          style={[
            styles.chatFontPreviewBubble,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text
            style={[styles.chatFontPreviewBubbleText, { fontFamily }]}
            numberOfLines={1}
          >
            Hello world!
          </Text>
        </View>
      </View>

      {/* Name */}
      <Text
        style={[styles.gridItemName, { color: colors.text }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>

      {/* Price or owned badge */}
      <View style={styles.gridItemFooter}>
        {isOwned ? (
          <View
            style={[
              styles.ownedBadge,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <MaterialCommunityIcons
              name="check-circle"
              size={12}
              color={colors.primary}
            />
            <Text style={[styles.ownedText, { color: colors.primary }]}>
              Owned
            </Text>
          </View>
        ) : item.priceTokens ? (
          <View style={styles.priceRow}>
            <MaterialCommunityIcons
              name="star-circle"
              size={14}
              color="#FFD700"
            />
            <Text style={[styles.priceText, { color: colors.text }]}>
              {formatTokenAmount(item.priceTokens)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.freeText, { color: colors.primary }]}>Free</Text>
        )}
      </View>

      {/* Rarity dot */}
      <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
    </Pressable>
  );
});

// =============================================================================
// Helper: Cosmetic type display label
// =============================================================================

function formatCosmeticTypeLabel(type: string): string {
  switch (type) {
    case "chat_bubble_color":
      return "Bubble Color";
    case "chat_font":
      return "Chat Font";
    case "chat_animal_theme":
      return "Animal Theme";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

// =============================================================================
// Shop Theme Card (ThemePicker-style with color preview + price)
// =============================================================================

interface ShopThemeCardProps {
  item: CosmeticDefinition;
  isOwned: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const ShopThemeCard = React.memo(function ShopThemeCard({
  item,
  isOwned,
  onPress,
}: ShopThemeCardProps) {
  const colors = useColors();
  const meta = THEME_METADATA[item.id as keyof typeof THEME_METADATA];

  // Fallback to standard grid item if metadata missing
  if (!meta) {
    return <ShopGridItem item={item} isOwned={isOwned} onPress={onPress} />;
  }

  const [bgColor, primaryColor, accentColor] = meta.previewColors;
  const rarityColor = RARITY_COLORS[item.rarity] ?? colors.textSecondary;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.shopThemeCard,
        {
          backgroundColor: colors.surface,
          borderColor: isOwned ? colors.primary : rarityColor + "30",
          borderWidth: isOwned ? 2 : 1,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Color Preview */}
      <View style={styles.shopThemePreview}>
        <View style={[styles.shopThemePreviewBg, { backgroundColor: bgColor }]}>
          {/* Primary accent bar */}
          <View
            style={[
              styles.shopThemePreviewAccent,
              { backgroundColor: primaryColor },
            ]}
          />
          {/* Text preview lines */}
          <View style={styles.shopThemePreviewContent}>
            <View
              style={[
                styles.shopThemePreviewLine,
                {
                  backgroundColor: meta.isDark ? "#ffffff" : "#000000",
                  width: "70%",
                  opacity: 0.8,
                },
              ]}
            />
            <View
              style={[
                styles.shopThemePreviewLine,
                {
                  backgroundColor: meta.isDark ? "#ffffff" : "#000000",
                  width: "50%",
                  opacity: 0.5,
                },
              ]}
            />
          </View>
          {/* Surface card preview */}
          <View
            style={[
              styles.shopThemePreviewSwatch,
              { backgroundColor: accentColor },
            ]}
          >
            <View
              style={[
                styles.shopThemePreviewLineSm,
                {
                  backgroundColor: meta.isDark ? "#ffffff" : "#000000",
                  opacity: 0.8,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Theme Info */}
      <View style={styles.shopThemeCardInfo}>
        <View style={styles.shopThemeCardHeader}>
          <Text
            style={[styles.shopThemeCardName, { color: colors.text }]}
            numberOfLines={1}
          >
            {meta.name}
          </Text>
          {isOwned && (
            <View
              style={[
                styles.shopThemeCheckmark,
                { backgroundColor: colors.primary },
              ]}
            >
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
        <Text
          style={[styles.shopThemeCardDesc, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {meta.description}
        </Text>
        {/* Bottom row: badges + price */}
        <View style={styles.shopThemeCardBottom}>
          <View style={styles.shopThemeCardBadges}>
            <View
              style={[
                styles.shopThemeCardBadge,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <Ionicons
                name={meta.isDark ? "moon" : "sunny"}
                size={10}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  styles.shopThemeCardBadgeText,
                  { color: colors.textSecondary },
                ]}
              >
                {meta.isDark ? "Dark" : "Light"}
              </Text>
            </View>
          </View>
          {isOwned ? (
            <View
              style={[
                styles.shopThemeOwnedBadge,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={11}
                color={colors.primary}
              />
              <Text
                style={[styles.shopThemeOwnedText, { color: colors.primary }]}
              >
                Owned
              </Text>
            </View>
          ) : item.priceTokens ? (
            <View style={styles.shopThemePriceRow}>
              <MaterialCommunityIcons
                name="star-circle"
                size={13}
                color="#FFD700"
              />
              <Text style={[styles.shopThemePriceText, { color: colors.text }]}>
                {formatTokenAmount(item.priceTokens)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// =============================================================================
// Featured Card
// =============================================================================

interface FeaturedCardProps {
  data: ResolvedFeatured;
  isOwned: boolean;
  onPress: (item: CosmeticDefinition) => void;
}

const FeaturedCard = React.memo(function FeaturedCard({
  data,
  isOwned,
  onPress,
}: FeaturedCardProps) {
  const colors = useColors();
  const { featured, cosmetic } = data;
  const hasAsset = hasCosmeticAsset(
    cosmetic.type,
    cosmetic.assetKey ?? cosmetic.id,
  );
  const assetSource = hasAsset
    ? getCosmeticAsset(cosmetic.type, cosmetic.assetKey ?? cosmetic.id)
    : null;

  return (
    <Pressable
      onPress={() => onPress(cosmetic)}
      style={({ pressed }) => [
        styles.featuredCard,
        {
          backgroundColor: colors.surfaceVariant,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {assetSource ? (
        <CosmeticImage
          source={assetSource}
          style={styles.featuredCardImage}
          debugLabel={`shop-featured-${cosmetic.id}`}
        />
      ) : (
        <View
          style={[
            styles.featuredCardPlaceholder,
            { backgroundColor: colors.primary + "15" },
          ]}
        >
          <MaterialCommunityIcons
            name="image"
            size={36}
            color={colors.primary}
          />
        </View>
      )}

      {/* Badge */}
      {featured.badge && (
        <View
          style={[
            styles.featuredBadge,
            { backgroundColor: BADGE_COLORS[featured.badge] ?? colors.primary },
          ]}
        >
          <Text style={styles.featuredBadgeText}>{featured.badge}</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.featuredInfo}>
        <Text
          style={[styles.featuredHeadline, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {featured.headline}
        </Text>
        <Text
          style={[styles.featuredName, { color: colors.text }]}
          numberOfLines={1}
        >
          {cosmetic.name}
        </Text>

        {/* Price / status */}
        <View style={styles.featuredPriceRow}>
          {isOwned ? (
            <View
              style={[
                styles.ownedBadge,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={12}
                color={colors.primary}
              />
              <Text style={[styles.ownedText, { color: colors.primary }]}>
                Owned
              </Text>
            </View>
          ) : cosmetic.priceTokens ? (
            <View style={styles.priceRow}>
              <MaterialCommunityIcons
                name="star-circle"
                size={14}
                color="#FFD700"
              />
              <Text style={[styles.priceText, { color: colors.text }]}>
                {formatTokenAmount(cosmetic.priceTokens)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.freeText, { color: colors.primary }]}>
              Free
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

// =============================================================================
// Bundle Card
// =============================================================================

interface BundleCardProps {
  data: BundleWithStatus;
  onPress: (bundle: CosmeticBundle) => void;
}

const BundleCard = React.memo(function BundleCard({
  data,
  onPress,
}: BundleCardProps) {
  const colors = useColors();
  const { bundle, fullyOwned, unownedCount, discount } = data;
  const rarityColor = RARITY_COLORS[bundle.rarity] ?? colors.textSecondary;

  // Show first item's image as preview
  const firstItem = getCosmeticById(bundle.cosmeticIds[0]);
  const hasAsset =
    firstItem &&
    hasCosmeticAsset(firstItem.type, firstItem.assetKey ?? firstItem.id);
  const assetSource =
    firstItem && hasAsset
      ? getCosmeticAsset(firstItem.type, firstItem.assetKey ?? firstItem.id)
      : null;

  return (
    <Pressable
      onPress={() => onPress(bundle)}
      style={({ pressed }) => [
        styles.bundleCard,
        {
          backgroundColor: colors.surfaceVariant,
          borderColor: rarityColor + "40",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Preview image */}
      <View style={styles.bundleImageWrapper}>
        {assetSource ? (
          <CosmeticImage
            source={assetSource}
            style={styles.bundleImage}
            debugLabel={`shop-bundle-${bundle.id}`}
          />
        ) : (
          <View
            style={[
              styles.bundlePlaceholder,
              { backgroundColor: rarityColor + "15" },
            ]}
          >
            <MaterialCommunityIcons
              name="package-variant"
              size={28}
              color={rarityColor}
            />
          </View>
        )}

        {/* Discount badge */}
        {discount > 0 && !fullyOwned && (
          <View style={[styles.discountBadge, { backgroundColor: "#E91E63" }]}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.bundleInfo}>
        <View style={styles.bundleNameRow}>
          <Text
            style={[styles.bundleName, { color: colors.text }]}
            numberOfLines={1}
          >
            {bundle.name}
          </Text>
          {bundle.badge && (
            <View
              style={[styles.bundleBadgeChip, { backgroundColor: rarityColor }]}
            >
              <Text style={styles.bundleBadgeText}>{bundle.badge}</Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.bundleDesc, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {bundle.description}
        </Text>
        <Text style={[styles.bundleItemCount, { color: colors.textSecondary }]}>
          {bundle.cosmeticIds.length} items
          {fullyOwned
            ? " • All owned ✓"
            : unownedCount < bundle.cosmeticIds.length
              ? ` • ${unownedCount} left to unlock`
              : ""}
        </Text>

        {/* Price */}
        <View style={styles.bundlePriceRow}>
          {fullyOwned ? (
            <View
              style={[
                styles.ownedBadge,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={12}
                color={colors.primary}
              />
              <Text style={[styles.ownedText, { color: colors.primary }]}>
                Owned
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={[
                  styles.bundleOrigPrice,
                  { color: colors.textSecondary },
                ]}
              >
                {formatTokenAmount(bundle.originalPriceTokens)}
              </Text>
              <View style={styles.priceRow}>
                <MaterialCommunityIcons
                  name="star-circle"
                  size={14}
                  color="#FFD700"
                />
                <Text style={[styles.priceText, { color: colors.text }]}>
                  {formatTokenAmount(bundle.priceTokens)}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
});

// =============================================================================
// Screen
// =============================================================================

export default function CosmeticsShopScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const shop = useCosmeticsShop(uid);

  // ── Dev-only diagnostics: log shop item counts to catch empty catalog ──
  useEffect(() => {
    if (__DEV__) {
      console.log("[CosmeticsShop] uid:", uid ?? "(not signed in)");
      console.log("[CosmeticsShop] loading:", shop.loading);
      console.log("[CosmeticsShop] shopItems count:", shop.shopItems.length);
      if (shop.shopItems.length > 0) {
        const types = new Map<string, number>();
        for (const item of shop.shopItems) {
          types.set(item.type, (types.get(item.type) ?? 0) + 1);
        }
        console.log(
          "[CosmeticsShop] items by type:",
          Object.fromEntries(types),
        );
      }
    }
  }, [uid, shop.loading, shop.shopItems.length]);

  // ── Dev-only performance metrics ──
  const mountTimeRef = useRef(Date.now());
  const renderCountRef = useRef(0);
  useEffect(() => {
    if (__DEV__) {
      renderCountRef.current += 1;
      if (renderCountRef.current === 1) {
        const elapsed = Date.now() - mountTimeRef.current;
        console.log(`[CosmeticsShop] time-to-first-render: ${elapsed}ms`);
      }
    }
  });

  // ── Prefetch cosmetic assets on mount for fast grid rendering ──
  useEffect(() => {
    prefetchShopCategory("background");
    prefetchShopCategory("decoration");
    prefetchShopCategory("badge");
    prefetchShopCategory("chat_animal_theme");
  }, []);

  // ── Section state (Profile / Chat) ───────────────────────────────────
  const [shopSection, setShopSection] = useState<ShopSection>("profile");
  const sectionTabs = shopSection === "chat" ? CHAT_TABS : PROFILE_TABS;

  /** Shop items filtered to the active section. */
  const sectionFilteredItems = useMemo(() => {
    const typeSet = shopSection === "chat" ? CHAT_TYPES : PROFILE_TYPES;
    if (shop.activeTab === "all") {
      return shop.shopItems.filter((item) => typeSet.has(item.type));
    }
    // When a specific tab is selected, shopItems is already filtered by type
    return shop.shopItems;
  }, [shop.shopItems, shop.activeTab, shopSection]);

  // ── Dev-only assertion: warn about misconfigured purchasable items ────
  useEffect(() => {
    if (!__DEV__) return;
    for (const item of sectionFilteredItems) {
      if (
        item.source === "shop" &&
        (!item.priceTokens || item.priceTokens <= 0)
      ) {
        console.warn(
          `[Shop] Item "${item.id}" is source=shop but has no valid priceTokens (${item.priceTokens}). It will be unpurchasable.`,
        );
      }
      if (item.source !== "shop" && item.priceTokens && item.priceTokens > 0) {
        console.warn(
          `[Shop] Item "${item.id}" has priceTokens=${item.priceTokens} but source="${item.source}" (not "shop"). Purchase will be blocked.`,
        );
      }
    }
  }, [sectionFilteredItems]);

  const handleSectionChange = useCallback(
    (section: ShopSection) => {
      setShopSection(section);
      shop.setActiveTab("all");
      shop.setSearchQuery("");
    },
    [shop],
  );

  // Detail / purchase state
  const [selectedItem, setSelectedItem] = useState<CosmeticDefinition | null>(
    null,
  );
  const [detailVisible, setDetailVisible] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleItemPress = useCallback((item: CosmeticDefinition) => {
    setSelectedItem(item);
    setDetailVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
  }, []);

  const handlePurchase = useCallback(
    async (cosmeticId: string) => {
      const item = getCosmeticById(cosmeticId);
      if (!item) return;

      // Guard: free/starter items should never be routed through purchase
      if (
        item.source !== "shop" ||
        !item.priceTokens ||
        item.priceTokens <= 0
      ) {
        if (__DEV__) {
          console.warn(
            `[Shop] handlePurchase called for non-purchasable item "${cosmeticId}" (source=${item.source}, price=${item.priceTokens}). Skipping.`,
          );
        }
        return;
      }

      // Confirm purchase
      Alert.alert(
        "Confirm Purchase",
        `Buy "${item.name}" for ${formatTokenAmount(item.priceTokens ?? 0)} tokens?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Buy",
            onPress: async () => {
              const result = await shop.purchaseItem(cosmeticId);
              if (result.success) {
                setDetailVisible(false);
                Alert.alert(
                  "Purchase Successful!",
                  `"${item.name}" has been added to your collection.`,
                  [
                    { text: "Continue Shopping" },
                    {
                      text: "Equip Now",
                      onPress: () => {
                        const isChatType =
                          item.type === "chat_bubble_color" ||
                          item.type === "chat_font" ||
                          item.type === "chat_animal_theme";
                        navigation.navigate("Customization", {
                          initialTab: item.type,
                          ...(isChatType && { initialSection: "chat" }),
                        });
                      },
                    },
                  ],
                );
              } else {
                Alert.alert(
                  "Purchase Failed",
                  result.error || "Something went wrong.",
                );
              }
            },
          },
        ],
      );
    },
    [shop, navigation],
  );

  const handleBundlePress = useCallback(
    (bundle: CosmeticBundle) => {
      if (isBundleFullyOwned(bundle, shop.ownedSet)) {
        Alert.alert(
          "Already Owned",
          "You already own all items in this bundle.",
        );
        return;
      }
      const unowned = getBundleUnownedIds(bundle, shop.ownedSet);
      const totalCost = bundle.priceTokens;
      Alert.alert(
        bundle.name,
        `${bundle.description}\n\n${unowned.length} items for ${formatTokenAmount(totalCost)} tokens`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: `Buy for ${formatTokenAmount(totalCost)}`,
            onPress: async () => {
              // Purchase each unowned item individually
              for (const itemId of unowned) {
                const result = await shop.purchaseItem(itemId);
                if (!result.success) {
                  Alert.alert(
                    "Bundle Purchase Error",
                    `Failed on item: ${result.error}`,
                  );
                  return;
                }
              }
              Alert.alert(
                "Bundle Complete!",
                "All items have been added to your collection.",
                [
                  { text: "Continue Shopping" },
                  {
                    text: "Equip Now",
                    onPress: () => navigation.navigate("Customization"),
                  },
                ],
              );
            },
          },
        ],
      );
    },
    [shop, navigation],
  );

  // ── Render helpers ────────────────────────────────────────────────────

  const renderGridItem = useCallback(
    ({ item }: { item: CosmeticDefinition }) => {
      if (item.type === "theme") {
        return (
          <ShopThemeCard
            item={item}
            isOwned={shop.isOwned(item.id)}
            onPress={handleItemPress}
          />
        );
      }
      if (item.type === "chat_bubble_color") {
        return (
          <ShopChatBubbleCard
            item={item}
            isOwned={shop.isOwned(item.id)}
            onPress={handleItemPress}
          />
        );
      }
      if (item.type === "chat_font") {
        return (
          <ShopChatFontCard
            item={item}
            isOwned={shop.isOwned(item.id)}
            onPress={handleItemPress}
          />
        );
      }
      return (
        <ShopGridItem
          item={item}
          isOwned={shop.isOwned(item.id)}
          onPress={handleItemPress}
        />
      );
    },
    [shop, handleItemPress],
  );

  const keyExtractor = useCallback((item: CosmeticDefinition) => item.id, []);

  // ── List header (featured + bundles) ──────────────────────────────────

  const ListHeader = useCallback(() => {
    if (shop.searchQuery.trim()) return null;

    return (
      <View>
        {/* Featured Section (Profile only) */}
        {shopSection === "profile" &&
          shop.featuredItems.length > 0 &&
          shop.activeTab === "all" && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <MaterialCommunityIcons
                  name="fire"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Featured
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredScroll}
              >
                {shop.featuredItems.map((entry) => (
                  <FeaturedCard
                    key={entry.cosmetic.id}
                    data={entry}
                    isOwned={shop.isOwned(entry.cosmetic.id)}
                    onPress={handleItemPress}
                  />
                ))}
              </ScrollView>
            </View>
          )}

        {/* Bundles Section (Profile only) */}
        {shopSection === "profile" &&
          shop.bundles.length > 0 &&
          shop.activeTab === "all" && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Bundle Deals
                </Text>
              </View>
              {shop.bundles.map((entry) => (
                <BundleCard
                  key={entry.bundle.id}
                  data={entry}
                  onPress={handleBundlePress}
                />
              ))}
            </View>
          )}

        {/* Items section header */}
        {sectionFilteredItems.length > 0 && (
          <View style={styles.sectionHeaderRow}>
            <MaterialCommunityIcons
              name="view-grid"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {shop.activeTab === "all"
                ? shopSection === "chat"
                  ? "Chat Cosmetics"
                  : "All Cosmetics"
                : (sectionTabs.find((t) => t.id === shop.activeTab)?.label ??
                  "Items")}
            </Text>
          </View>
        )}
      </View>
    );
  }, [
    shop.searchQuery,
    shop.featuredItems,
    shop.bundles,
    sectionFilteredItems.length,
    shop.activeTab,
    shop.isOwned,
    shopSection,
    sectionTabs,
    handleItemPress,
    handleBundlePress,
    colors,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App bar */}
      <View style={{ paddingTop: insets.top }}>
        <Appbar.Header
          style={[styles.appbar, { backgroundColor: colors.background }]}
          statusBarHeight={0}
        >
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Cosmetics Shop" />
          {/* Wallet balance */}
          <View style={styles.walletChip}>
            <MaterialCommunityIcons
              name="star-circle"
              size={16}
              color="#FFD700"
            />
            <Text style={[styles.walletText, { color: colors.text }]}>
              {formatTokenAmount(shop.walletBalance)}
            </Text>
          </View>
        </Appbar.Header>
      </View>

      {/* ── Section Toggle: Profile / Chat ── */}
      <View style={styles.shopSectionToggleContainer}>
        {(["profile", "chat"] as const).map((s) => {
          const isActive = shopSection === s;
          return (
            <Pressable
              key={s}
              onPress={() => handleSectionChange(s)}
              accessibilityRole="tab"
              accessibilityLabel={`${s === "profile" ? "Profile" : "Chat"} shop section`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.shopSectionToggle,
                {
                  backgroundColor: isActive
                    ? colors.primary
                    : colors.surfaceVariant,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={s === "profile" ? "account" : "chat"}
                size={16}
                color={isActive ? "#fff" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.shopSectionToggleText,
                  {
                    color: isActive ? "#fff" : colors.textSecondary,
                    fontWeight: isActive ? "600" : "400",
                  },
                ]}
              >
                {s === "profile" ? "Profile" : "Chat"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        {sectionTabs.map((tab) => {
          const isActive = shop.activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => shop.setActiveTab(tab.id)}
              style={[
                styles.tabItem,
                {
                  backgroundColor: isActive
                    ? colors.primary + "18"
                    : "transparent",
                  borderColor: isActive
                    ? colors.primary
                    : colors.surfaceVariant,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={16}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? "600" : "400",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Search */}
      <View style={styles.searchRow}>
        <Searchbar
          placeholder="Search cosmetics..."
          value={shop.searchQuery}
          onChangeText={shop.setSearchQuery}
          style={[styles.searchbar, { backgroundColor: colors.surfaceVariant }]}
          inputStyle={styles.searchInput}
          elevation={0}
        />
      </View>

      {/* Content */}
      {shop.loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading shop…
          </Text>
        </View>
      ) : (
        <FlatList
          data={sectionFilteredItems}
          renderItem={renderGridItem}
          keyExtractor={keyExtractor}
          numColumns={GRID_COLUMNS}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          windowSize={7}
          maxToRenderPerBatch={6}
          removeClippedSubviews={Platform.OS === "android"}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="shopping-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {shop.searchQuery
                  ? `No results for "${shop.searchQuery}"`
                  : "No items available in this category"}
              </Text>
            </View>
          }
        />
      )}

      {/* Item Detail Sheet (purchase bottom sheet) */}
      {selectedItem && (
        <CosmeticPurchaseSheet
          visible={detailVisible}
          item={selectedItem}
          isOwned={shop.isOwned(selectedItem.id)}
          walletBalance={shop.walletBalance}
          purchasing={shop.purchasing}
          onClose={handleCloseDetail}
          onPurchase={handlePurchase}
          onEquipNow={(type) => {
            const isChatType =
              type === "chat_bubble_color" ||
              type === "chat_font" ||
              type === "chat_animal_theme";
            navigation.navigate("Customization", {
              initialTab: type,
              ...(isChatType && { initialSection: "chat" }),
            });
          }}
        />
      )}
    </View>
  );
}

// =============================================================================
// Purchase Sheet
// =============================================================================

interface CosmeticPurchaseSheetProps {
  visible: boolean;
  item: CosmeticDefinition;
  isOwned: boolean;
  walletBalance: number;
  purchasing: boolean;
  onClose: () => void;
  onPurchase: (cosmeticId: string) => void;
  onEquipNow: (type: string) => void;
}

function CosmeticPurchaseSheet({
  visible,
  item,
  isOwned,
  walletBalance,
  purchasing,
  onClose,
  onPurchase,
  onEquipNow,
}: CosmeticPurchaseSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const hasAsset = hasCosmeticAsset(item.type, item.assetKey ?? item.id);
  const assetSource = hasAsset
    ? getCosmeticAsset(item.type, item.assetKey ?? item.id)
    : null;
  const rarityColor = RARITY_COLORS[item.rarity] ?? colors.textSecondary;
  const canAfford = !item.priceTokens || walletBalance >= item.priceTokens;

  // Chat-specific preview data
  const isChatBubbleColor = item.type === "chat_bubble_color";
  const isChatFont = item.type === "chat_font";
  const isChatCosmetic =
    isChatBubbleColor || isChatFont || item.type === "chat_animal_theme";
  const chatBubbleColor = isChatBubbleColor
    ? (getChatBubbleColor(item.id) ??
      (item.metadata?.bubbleColorValue as string) ??
      colors.primary)
    : colors.primary;
  const chatFontFamily = isChatFont
    ? (getChatFontFamily(item.id) ??
      (item.metadata?.fontFamily as string) ??
      undefined)
    : undefined;
  const chatTextOnBubble = isChatBubbleColor
    ? contrastTextColor(chatBubbleColor)
    : "#FFFFFF";

  return (
    <View style={[StyleSheet.absoluteFill, styles.sheetBackdrop]}>
      <Pressable style={styles.sheetBackdropTouch} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            maxHeight: Dimensions.get("window").height * 0.8,
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.sheetHandleRow}>
          <View
            style={[
              styles.sheetHandle,
              { backgroundColor: colors.textSecondary + "40" },
            ]}
          />
        </View>

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + Spacing.lg,
          }}
        >
          {/* Preview */}
          <View style={styles.sheetPreview}>
            {isChatBubbleColor ? (
              /* Chat bubble color preview: show sample conversation */
              <View style={styles.sheetChatPreview}>
                <View
                  style={[
                    styles.sheetChatBubbleIncoming,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetChatBubbleInText,
                      { color: colors.text },
                    ]}
                  >
                    Hey, how's it going?
                  </Text>
                </View>
                <View
                  style={[
                    styles.sheetChatBubbleOutgoing,
                    { backgroundColor: chatBubbleColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetChatBubbleOutText,
                      { color: chatTextOnBubble },
                    ]}
                  >
                    Great! Check out my new bubble color 🎉
                  </Text>
                </View>
                <View
                  style={[
                    styles.sheetChatBubbleOutgoing,
                    { backgroundColor: chatBubbleColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetChatBubbleOutText,
                      { color: chatTextOnBubble },
                    ]}
                  >
                    Looking good right?
                  </Text>
                </View>
              </View>
            ) : isChatFont ? (
              /* Chat font preview: show sample text in the font */
              <View style={styles.sheetChatPreview}>
                <View
                  style={[
                    styles.sheetChatBubbleIncoming,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetChatBubbleInText,
                      { color: colors.text },
                    ]}
                  >
                    What font is that?
                  </Text>
                </View>
                <View
                  style={[
                    styles.sheetChatBubbleOutgoing,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetChatBubbleOutText,
                      { fontFamily: chatFontFamily },
                    ]}
                  >
                    It's my new chat font!
                  </Text>
                </View>
                <View
                  style={[
                    styles.sheetChatBubbleOutgoing,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetChatBubbleOutText,
                      { fontFamily: chatFontFamily },
                    ]}
                  >
                    ABCDEFG abcdefg 12345
                  </Text>
                </View>
              </View>
            ) : item.type === "chat_animal_theme" ? (
              /* Animal theme preview: image + play sound button */
              <View style={styles.sheetAnimalPreview}>
                <CosmeticImage
                  source={getAnimalImage(item.id)}
                  style={styles.sheetAnimalImage}
                  debugLabel={`shop-animal-${item.id}`}
                />
                <TouchableOpacity
                  onPress={() => playAnimalSound(item.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.sheetPlaySoundButton,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="volume-high"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.sheetPlaySoundText}>Play Sound</Text>
                </TouchableOpacity>
              </View>
            ) : assetSource ? (
              <CosmeticImage
                source={assetSource}
                style={[
                  styles.sheetImage,
                  item.type === "background" && styles.sheetImageWide,
                ]}
                contentFit="contain"
                debugLabel={`shop-detail-${item.id}`}
              />
            ) : (
              <View
                style={[
                  styles.sheetPlaceholder,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <MaterialCommunityIcons
                  name="image"
                  size={48}
                  color={colors.textSecondary}
                />
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.sheetInfo}>
            <Text
              style={[styles.sheetName, { color: colors.text }]}
              numberOfLines={2}
            >
              {item.name}
            </Text>

            <View style={styles.sheetChipRow}>
              <View
                style={[
                  styles.sheetRarityChip,
                  { backgroundColor: rarityColor + "18" },
                ]}
              >
                <Text style={[styles.sheetRarityText, { color: rarityColor }]}>
                  {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                </Text>
              </View>
              <View
                style={[
                  styles.sheetSourceChip,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <Text
                  style={[
                    styles.sheetSourceText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {formatCosmeticTypeLabel(item.type)}
                </Text>
              </View>
            </View>

            <Text
              style={[styles.sheetDesc, { color: colors.textSecondary }]}
              numberOfLines={3}
            >
              {item.description}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.sheetActions}>
            {isOwned ? (
              <Pressable
                onPress={() => {
                  onClose();
                  if (isChatCosmetic) {
                    onEquipNow(item.type);
                  } else {
                    onEquipNow(item.type);
                  }
                }}
                style={[
                  styles.sheetButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.sheetButtonText}>Equip Now</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => onPurchase(item.id)}
                disabled={purchasing || !canAfford}
                style={[
                  styles.sheetButton,
                  {
                    backgroundColor:
                      purchasing || !canAfford
                        ? colors.surfaceVariant
                        : colors.primary,
                  },
                ]}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="star-circle"
                      size={18}
                      color={canAfford ? "#fff" : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.sheetButtonText,
                        !canAfford && { color: colors.textSecondary },
                      ]}
                    >
                      {canAfford
                        ? `Buy · ${formatTokenAmount(item.priceTokens ?? 0)}`
                        : `Need ${formatTokenAmount(item.priceTokens ?? 0)}`}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Wallet info when not owned */}
            {!isOwned && (
              <Text
                style={[
                  styles.sheetWalletInfo,
                  { color: colors.textSecondary },
                ]}
              >
                Balance: {formatTokenAmount(walletBalance)} tokens
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appbar: {
    elevation: 0,
  },
  walletChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 8,
  },
  walletText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Section Toggle (Profile / Chat) ────────────────────────────────────
  shopSectionToggleContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 0,
    gap: Spacing.sm,
  },
  shopSectionToggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  shopSectionToggleText: {
    fontSize: 14,
  },

  // ── Tabs ──────────────────────────────────────────────────────────────
  tabsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    alignItems: "center",
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Search ────────────────────────────────────────────────────────────
  searchRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchbar: {
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 40,
  },

  // ── Grid ──────────────────────────────────────────────────────────────
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 80,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: ITEM_SIZE,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  gridItemImage: {
    width: "100%",
    height: ITEM_SIZE * 0.65,
  },
  gridItemPlaceholder: {
    width: "100%",
    height: ITEM_SIZE * 0.65,
    justifyContent: "center",
    alignItems: "center",
  },
  gridItemName: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  gridItemFooter: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 4,
  },
  rarityDot: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Owned / Price ─────────────────────────────────────────────────────
  ownedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  ownedText: {
    fontSize: 11,
    fontWeight: "600",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priceText: {
    fontSize: 13,
    fontWeight: "700",
  },
  freeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Sections ──────────────────────────────────────────────────────────
  sectionContainer: {
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  // ── Featured ──────────────────────────────────────────────────────────
  featuredScroll: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  featuredCardImage: {
    width: "100%",
    height: FEATURED_CARD_WIDTH * 0.5,
  },
  featuredCardPlaceholder: {
    width: "100%",
    height: FEATURED_CARD_WIDTH * 0.5,
    justifyContent: "center",
    alignItems: "center",
  },
  featuredBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  featuredBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  featuredInfo: {
    padding: Spacing.sm,
  },
  featuredHeadline: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  featuredName: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  featuredPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  // ── Bundles ───────────────────────────────────────────────────────────
  bundleCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  bundleImageWrapper: {
    width: 90,
    height: 90,
  },
  bundleImage: {
    width: "100%",
    height: "100%",
  },
  bundlePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  discountBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  bundleInfo: {
    flex: 1,
    padding: Spacing.sm,
    justifyContent: "center",
  },
  bundleNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bundleName: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  bundleBadgeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bundleBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  bundleDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  bundleItemCount: {
    fontSize: 10,
    marginTop: 3,
  },
  bundlePriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  bundleOrigPrice: {
    fontSize: 12,
    textDecorationLine: "line-through",
  },

  // ── Loading / Empty ───────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 48,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },

  // ── Purchase Sheet ────────────────────────────────────────────────────
  sheetBackdrop: {
    justifyContent: "flex-end",
    zIndex: 100,
  },
  sheetBackdropTouch: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
  },
  sheetHandleRow: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetPreview: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  sheetImage: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
  },
  sheetImageWide: {
    width: 200,
    height: 120,
    borderRadius: BorderRadius.md,
  },
  sheetPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetAnimalPreview: {
    alignItems: "center",
    gap: Spacing.md,
  },
  sheetAnimalImage: {
    width: 140,
    height: 140,
    borderRadius: BorderRadius.lg,
  },
  sheetPlaySoundButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sheetPlaySoundText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  sheetInfo: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  sheetName: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  sheetChipRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sheetRarityChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sheetRarityText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sheetSourceChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sheetSourceText: {
    fontSize: 11,
  },
  sheetDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  sheetActions: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  sheetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  sheetButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sheetWalletInfo: {
    fontSize: 12,
  },

  // ── Shop Theme Card (ThemePicker-style with color preview) ────────────
  shopThemeCard: {
    width: ITEM_SIZE,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  shopThemePreview: {
    height: 80,
    overflow: "hidden",
  },
  shopThemePreviewBg: {
    flex: 1,
    padding: Spacing.sm,
  },
  shopThemePreviewAccent: {
    height: 4,
    width: "40%",
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  shopThemePreviewContent: {
    gap: 4,
  },
  shopThemePreviewLine: {
    height: 6,
    borderRadius: 3,
  },
  shopThemePreviewSwatch: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    width: 50,
    height: 30,
    borderRadius: BorderRadius.sm,
    padding: 6,
    justifyContent: "center",
  },
  shopThemePreviewLineSm: {
    height: 4,
    width: "80%",
    borderRadius: 2,
  },
  shopThemeCardInfo: {
    padding: Spacing.sm,
  },
  shopThemeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shopThemeCardName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  shopThemeCheckmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  shopThemeCardDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  shopThemeCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  shopThemeCardBadges: {
    flexDirection: "row",
    gap: 4,
  },
  shopThemeCardBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  shopThemeCardBadgeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  shopThemeOwnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  shopThemeOwnedText: {
    fontSize: 10,
    fontWeight: "600",
  },
  shopThemePriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  shopThemePriceText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Chat Bubble Color Card ────────────────────────────────────────────
  chatBubblePreviewContainer: {
    width: "100%",
    height: ITEM_SIZE * 0.65,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  chatBubblePreview: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: "90%",
  },
  chatBubblePreviewText: {
    fontSize: 12,
    fontWeight: "500",
  },
  chatBubblePreviewSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "75%",
  },
  chatBubblePreviewTextSm: {
    fontSize: 10,
    fontWeight: "400",
  },

  // ── Chat Font Card ────────────────────────────────────────────────────
  chatFontPreviewContainer: {
    width: "100%",
    height: ITEM_SIZE * 0.65,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  chatFontPreviewLarge: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 1,
  },
  chatFontPreviewBubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    maxWidth: "90%",
  },
  chatFontPreviewBubbleText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FFFFFF",
  },

  // ── Purchase Sheet: Chat Preview ──────────────────────────────────────
  sheetChatPreview: {
    width: "100%",
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  sheetChatBubbleIncoming: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    maxWidth: "80%",
  },
  sheetChatBubbleInText: {
    fontSize: 14,
  },
  sheetChatBubbleOutgoing: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    maxWidth: "80%",
  },
  sheetChatBubbleOutText: {
    fontSize: 14,
    color: "#FFFFFF",
  },
});
