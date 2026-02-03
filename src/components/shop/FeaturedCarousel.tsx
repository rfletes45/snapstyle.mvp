/**
 * Featured Carousel Component
 *
 * Horizontal scrolling carousel showcasing featured shop items.
 * Features:
 * - Auto-scroll with pause on touch
 * - Page indicators
 * - Large, prominent item cards
 * - Smooth animations
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import Animated, {
  FadeIn,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useAppTheme } from "@/store/ThemeContext";
import type { PointsShopItem, ShopItemRarity } from "@/types/shop";
import { RARITY_COLORS, SHOP_COLORS } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

interface FeaturedCarouselProps {
  /** Array of featured items to display */
  items: PointsShopItem[];
  /** User's current token balance */
  balance: number;
  /** Called when an item is pressed */
  onItemPress?: (item: PointsShopItem) => void;
  /** Whether to auto-scroll */
  autoScroll?: boolean;
  /** Auto-scroll interval in ms */
  autoScrollInterval?: number;
}

interface FeaturedItemProps {
  item: PointsShopItem;
  balance: number;
  onPress?: (item: PointsShopItem) => void;
  index: number;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_WIDTH = SCREEN_WIDTH - 48;
const ITEM_HEIGHT = 180;
const ITEM_SPACING = 16;

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

// =============================================================================
// Helper Components
// =============================================================================

/**
 * Get the color for a rarity level
 */
function getRarityColor(rarity: ShopItemRarity): string {
  return RARITY_COLORS[rarity] || RARITY_COLORS.common;
}

/**
 * Get icon for item slot
 */
function getItemIcon(
  slot: string,
): keyof typeof MaterialCommunityIcons.glyphMap {
  const icons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
    hat: "hat-fedora",
    glasses: "glasses",
    background: "image",
    clothing_top: "tshirt-crew",
    clothing_bottom: "human-male-height",
    accessory_neck: "necklace",
    accessory_ear: "earbuds",
    accessory_hand: "hand-back-right",
    profile_frame: "card-bulleted-outline",
    profile_banner: "flag-variant",
    profile_theme: "palette",
    chat_bubble: "message-text",
    name_effect: "text-shadow",
  };
  return icons[slot] || "help-circle-outline";
}

/**
 * Featured Item Card
 */
const FeaturedItem = memo(function FeaturedItem({
  item,
  balance,
  onPress,
  index,
}: FeaturedItemProps) {
  const { colors, isDark } = useAppTheme();
  const scale = useSharedValue(1);

  const rarityColor = getRarityColor(item.rarity);
  const canAfford = balance >= item.priceTokens;
  const isOwned = item.owned;
  const hasDiscount =
    item.discountPercent !== undefined && item.discountPercent > 0;

  // Animation styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Handle press in/out
  const handlePressIn = () => {
    scale.value = withSpring(0.98, SPRING_CONFIG);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  const handlePress = () => {
    if (!isOwned) {
      onPress?.(item);
    }
  };

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 100).duration(400)}
      style={[
        animatedStyle,
        { width: ITEM_WIDTH, marginHorizontal: ITEM_SPACING / 2 },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isOwned}
        style={[styles.featuredItem, { borderColor: rarityColor + "60" }]}
      >
        {/* Background Gradient */}
        <LinearGradient
          colors={[`${rarityColor}20`, `${rarityColor}40`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Content */}
        <View style={styles.featuredContent}>
          {/* Left side - Icon/Preview */}
          <View
            style={[
              styles.featuredImageContainer,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name={getItemIcon(item.slot)}
              size={60}
              color={rarityColor}
            />

            {/* Rarity Badge */}
            <View
              style={[
                styles.rarityBadgeLarge,
                { backgroundColor: rarityColor },
              ]}
            >
              <Text style={styles.rarityBadgeText}>
                {item.rarity.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Right side - Info */}
          <View style={styles.featuredInfo}>
            {/* Badges Row */}
            <View style={styles.badgesRow}>
              {hasDiscount && (
                <View
                  style={[
                    styles.discountBadge,
                    { backgroundColor: SHOP_COLORS.badges.sale },
                  ]}
                >
                  <MaterialCommunityIcons name="tag" size={12} color="#FFF" />
                  <Text style={styles.discountText}>
                    -{item.discountPercent}%
                  </Text>
                </View>
              )}
              {item.shopExclusive && (
                <View
                  style={[
                    styles.exclusiveBadge,
                    { backgroundColor: SHOP_COLORS.badges.exclusive },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="diamond"
                    size={12}
                    color="#FFF"
                  />
                  <Text style={styles.exclusiveText}>EXCLUSIVE</Text>
                </View>
              )}
            </View>

            {/* Name */}
            <Text
              numberOfLines={2}
              style={[styles.featuredName, { color: colors.text }]}
            >
              {item.name}
            </Text>

            {/* Description */}
            <Text
              numberOfLines={2}
              style={[
                styles.featuredDescription,
                { color: colors.textSecondary },
              ]}
            >
              {item.description}
            </Text>

            {/* Price */}
            {isOwned ? (
              <View style={styles.ownedBadge}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={18}
                  color={SHOP_COLORS.badges.new}
                />
                <Text
                  style={[styles.ownedText, { color: SHOP_COLORS.badges.new }]}
                >
                  Owned
                </Text>
              </View>
            ) : (
              <View style={styles.priceContainer}>
                {hasDiscount && item.originalPrice && (
                  <Text
                    style={[styles.originalPrice, { color: colors.textMuted }]}
                  >
                    {item.originalPrice.toLocaleString()}
                  </Text>
                )}
                <View style={styles.currentPrice}>
                  <MaterialCommunityIcons
                    name="star-circle"
                    size={22}
                    color={canAfford ? "#FFD700" : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.priceText,
                      { color: canAfford ? colors.text : colors.textMuted },
                    ]}
                  >
                    {item.priceTokens.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Featured Banner */}
        <View style={[styles.featuredBanner, { backgroundColor: rarityColor }]}>
          <MaterialCommunityIcons name="star" size={14} color="#FFF" />
          <Text style={styles.featuredBannerText}>FEATURED</Text>
        </View>

        {/* Owned Overlay */}
        {isOwned && (
          <View style={styles.ownedOverlay}>
            <MaterialCommunityIcons
              name="check-decagram"
              size={48}
              color="#FFF"
            />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
});

/**
 * Page Indicator Dots
 */
const PageIndicator = memo(function PageIndicator({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.pageIndicator}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor:
                index === current ? colors.primary : colors.textMuted + "40",
              width: index === current ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

function FeaturedCarouselComponent({
  items,
  balance,
  onItemPress,
  autoScroll = true,
  autoScrollInterval = 5000,
}: FeaturedCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<PointsShopItem>>(null);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isUserScrollingRef = useRef(false);

  // Handle scroll event
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (ITEM_WIDTH + ITEM_SPACING));
      setCurrentIndex(Math.max(0, Math.min(index, items.length - 1)));
    },
    [items.length],
  );

  // Handle scroll begin
  const handleScrollBegin = useCallback(() => {
    isUserScrollingRef.current = true;
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
    }
  }, []);

  // Handle scroll end
  const handleScrollEnd = useCallback(() => {
    isUserScrollingRef.current = false;
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (!autoScroll || items.length <= 1) return;

    autoScrollTimerRef.current = setInterval(() => {
      if (!isUserScrollingRef.current && flatListRef.current) {
        const nextIndex = (currentIndex + 1) % items.length;
        flatListRef.current.scrollToOffset({
          offset: nextIndex * (ITEM_WIDTH + ITEM_SPACING),
          animated: true,
        });
      }
    }, autoScrollInterval);

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [autoScroll, autoScrollInterval, currentIndex, items.length]);

  // Render item
  const renderItem = useCallback(
    ({ item, index }: { item: PointsShopItem; index: number }) => (
      <FeaturedItem
        item={item}
        balance={balance}
        onPress={onItemPress}
        index={index}
      />
    ),
    [balance, onItemPress],
  );

  // Key extractor
  const keyExtractor = useCallback(
    (item: PointsShopItem) => `featured-${item.id}`,
    [],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled={false}
        snapToInterval={ITEM_WIDTH + ITEM_SPACING}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
      />

      {items.length > 1 && (
        <PageIndicator total={items.length} current={currentIndex} />
      )}
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  listContent: {
    paddingHorizontal: 24 - ITEM_SPACING / 2,
  },
  featuredItem: {
    height: ITEM_HEIGHT,
    borderRadius: 20,
    borderWidth: 2,
    overflow: "hidden",
    position: "relative",
  },
  featuredContent: {
    flex: 1,
    flexDirection: "row",
    padding: 16,
  },
  featuredImageContainer: {
    width: 100,
    height: "100%",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  rarityBadgeLarge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    alignItems: "center",
  },
  rarityBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  featuredInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  discountBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  discountText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  exclusiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  exclusiveText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
  featuredName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  featuredDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  currentPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priceText: {
    fontSize: 18,
    fontWeight: "700",
  },
  ownedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ownedText: {
    fontSize: 14,
    fontWeight: "600",
  },
  featuredBanner: {
    position: "absolute",
    top: 12,
    right: -30,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 4,
    gap: 4,
    transform: [{ rotate: "45deg" }],
  },
  featuredBannerText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  ownedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 200, 0, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  pageIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});

// =============================================================================
// Export
// =============================================================================

export const FeaturedCarousel = memo(FeaturedCarouselComponent);
