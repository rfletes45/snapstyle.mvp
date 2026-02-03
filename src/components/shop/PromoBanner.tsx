/**
 * Promo Banner Component
 *
 * Displays promotional banners with countdown timers,
 * supports carousel for multiple promotions.
 *
 * Features:
 * - Auto-scrolling carousel
 * - Countdown timer for ending soon
 * - Gradient overlays
 * - Deep linking to promotion
 * - Dismissable banners
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.5
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import {
  formatPromotionTimeRemaining,
  getPromotionBadgeText,
  isPromotionEndingSoon,
} from "../../../src/services/promotions";
import { Promotion } from "../../types/shop";

// =============================================================================
// Types
// =============================================================================

interface PromoBannerProps {
  promotions: Promotion[];
  onPress?: (promotion: Promotion) => void;
  onDismiss?: (promotionId: string) => void;
  autoScroll?: boolean;
  autoScrollInterval?: number;
  showPagination?: boolean;
  height?: number;
  style?: object;
}

interface SingleBannerProps {
  promotion: Promotion;
  onPress?: (promotion: Promotion) => void;
  onDismiss?: (promotionId: string) => void;
  height?: number;
  showDismiss?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_HEIGHT = 160;
const AUTO_SCROLL_INTERVAL = 5000; // 5 seconds

// =============================================================================
// Single Banner Component
// =============================================================================

function SingleBanner({
  promotion,
  onPress,
  onDismiss,
  height = DEFAULT_HEIGHT,
  showDismiss = false,
}: SingleBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const endingSoon = isPromotionEndingSoon(promotion);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Update countdown
  useEffect(() => {
    const updateTime = () => {
      setTimeRemaining(formatPromotionTimeRemaining(promotion));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [promotion]);

  // Pulse animation for ending soon
  useEffect(() => {
    if (endingSoon) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      return () => pulse.stop();
    }
  }, [endingSoon, pulseAnim]);

  const handlePress = () => {
    onPress?.(promotion);
  };

  const handleDismiss = () => {
    onDismiss?.(promotion.id);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      style={[styles.bannerContainer, { height }]}
    >
      {/* Background Image */}
      {promotion.bannerImage ? (
        <Image
          source={{ uri: promotion.bannerImage }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={getGradientColors(promotion.type)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bannerImage}
        />
      )}

      {/* Overlay Gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.7)"]}
        style={styles.overlay}
      />

      {/* Content */}
      <View style={styles.bannerContent}>
        {/* Badge */}
        <Animated.View
          style={[
            styles.badge,
            getBadgeStyle(promotion.type),
            endingSoon && { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.badgeText}>
            {getPromotionBadgeText(promotion)}
          </Text>
        </Animated.View>

        {/* Text Content */}
        <View style={styles.textContent}>
          <Text style={styles.bannerTitle} numberOfLines={2}>
            {promotion.name}
          </Text>
          {promotion.description && (
            <Text style={styles.bannerDescription} numberOfLines={1}>
              {promotion.description}
            </Text>
          )}
        </View>

        {/* Timer */}
        {timeRemaining && (
          <View
            style={[
              styles.timerContainer,
              endingSoon && styles.timerEndingSoon,
            ]}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={endingSoon ? "#EF4444" : "#fff"}
            />
            <Text
              style={[
                styles.timerText,
                endingSoon && styles.timerTextEndingSoon,
              ]}
            >
              {timeRemaining}
            </Text>
          </View>
        )}
      </View>

      {/* Dismiss Button */}
      {showDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      )}

      {/* CTA Arrow */}
      <View style={styles.ctaArrow}>
        <Ionicons name="chevron-forward" size={24} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

// =============================================================================
// Main Carousel Component
// =============================================================================

export function PromoBanner({
  promotions,
  onPress,
  onDismiss,
  autoScroll = true,
  autoScrollInterval = AUTO_SCROLL_INTERVAL,
  showPagination = true,
  height = DEFAULT_HEIGHT,
  style,
}: PromoBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Auto-scroll effect
  useEffect(() => {
    if (!autoScroll || promotions.length <= 1) return;

    const startAutoScroll = () => {
      autoScrollTimerRef.current = setInterval(() => {
        const nextIndex = (activeIndex + 1) % promotions.length;
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        setActiveIndex(nextIndex);
      }, autoScrollInterval);
    };

    startAutoScroll();

    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [autoScroll, autoScrollInterval, activeIndex, promotions.length]);

  // Reset auto-scroll on user interaction
  const resetAutoScroll = useCallback(() => {
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
    }
  }, []);

  // Handle scroll end
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  // Render single promotion
  if (promotions.length === 0) {
    return null;
  }

  if (promotions.length === 1) {
    return (
      <View style={[styles.container, style]}>
        <SingleBanner
          promotion={promotions[0]}
          onPress={onPress}
          onDismiss={onDismiss}
          height={height}
          showDismiss={!!onDismiss}
        />
      </View>
    );
  }

  // Render carousel
  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={flatListRef}
        data={promotions}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={resetAutoScroll}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH - 32 }}>
            <SingleBanner promotion={item} onPress={onPress} height={height} />
          </View>
        )}
        contentContainerStyle={styles.carouselContent}
        snapToInterval={SCREEN_WIDTH - 32}
        decelerationRate="fast"
      />

      {/* Pagination Dots */}
      {showPagination && promotions.length > 1 && (
        <View style={styles.pagination}>
          {promotions.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === activeIndex && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Compact Banner Variant
// =============================================================================

export function CompactPromoBanner({
  promotion,
  onPress,
  onDismiss,
}: {
  promotion: Promotion;
  onPress?: (promotion: Promotion) => void;
  onDismiss?: () => void;
}) {
  const endingSoon = isPromotionEndingSoon(promotion);

  return (
    <TouchableOpacity
      style={styles.compactBanner}
      onPress={() => onPress?.(promotion)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={getGradientColors(promotion.type)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.compactGradient}
      />

      <View style={styles.compactContent}>
        <View style={[styles.compactBadge, getBadgeStyle(promotion.type)]}>
          <Text style={styles.compactBadgeText}>
            {getPromotionBadgeText(promotion)}
          </Text>
        </View>

        <Text style={styles.compactTitle} numberOfLines={1}>
          {promotion.name}
        </Text>

        {endingSoon && (
          <View style={styles.compactTimer}>
            <Ionicons name="time-outline" size={12} color="#EF4444" />
            <Text style={styles.compactTimerText}>
              {formatPromotionTimeRemaining(promotion)}
            </Text>
          </View>
        )}
      </View>

      {onDismiss && (
        <TouchableOpacity style={styles.compactDismiss} onPress={onDismiss}>
          <Ionicons name="close" size={18} color={DEFAULT_GRAY} />
        </TouchableOpacity>
      )}

      <Ionicons name="chevron-forward" size={18} color="#fff" />
    </TouchableOpacity>
  );
}

// =============================================================================
// Constants for theme-independent colors
// =============================================================================

// Default primary color fallback (used when theme context not available)
const DEFAULT_PRIMARY = "#8839ef";
const DEFAULT_SURFACE = "#ffffff";
const DEFAULT_TEXT = "#4c4f69";
const DEFAULT_GRAY = "#9ca0b0";

// =============================================================================
// Inline Promo Code Banner
// =============================================================================

export function PromoCodeBanner({
  code,
  discount,
  onApply,
  onDismiss,
}: {
  code: string;
  discount: string;
  onApply: () => void;
  onDismiss?: () => void;
}) {
  return (
    <View style={styles.promoCodeBanner}>
      <View style={styles.promoCodeContent}>
        <View style={styles.promoCodeIcon}>
          <Ionicons name="ticket-outline" size={20} color={DEFAULT_PRIMARY} />
        </View>
        <View style={styles.promoCodeText}>
          <Text style={styles.promoCodeLabel}>Use code</Text>
          <Text style={styles.promoCodeValue}>{code}</Text>
        </View>
        <Text style={styles.promoCodeDiscount}>{discount}</Text>
      </View>

      <TouchableOpacity style={styles.applyButton} onPress={onApply}>
        <Text style={styles.applyButtonText}>Apply</Text>
      </TouchableOpacity>

      {onDismiss && (
        <TouchableOpacity style={styles.promoCodeDismiss} onPress={onDismiss}>
          <Ionicons name="close" size={16} color={DEFAULT_GRAY} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function getGradientColors(
  type?: string,
  primaryColor?: string,
): [string, string] {
  switch (type) {
    case "flash_sale":
      return ["#EF4444", "#DC2626"];
    case "seasonal":
      return ["#10B981", "#059669"];
    case "bundle_deal":
      return ["#F97316", "#EA580C"];
    case "discount":
    default:
      return [primaryColor || DEFAULT_PRIMARY, "#4F46E5"];
  }
}

function getBadgeStyle(type?: string, primaryColor?: string): object {
  switch (type) {
    case "flash_sale":
      return { backgroundColor: "#EF4444" };
    case "seasonal":
      return { backgroundColor: "#10B981" };
    case "bundle_deal":
      return { backgroundColor: "#F97316" };
    case "discount":
    default:
      return { backgroundColor: primaryColor || DEFAULT_PRIMARY };
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  bannerContainer: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: DEFAULT_SURFACE,
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerContent: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-end",
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  textContent: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerDescription: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 8,
    gap: 4,
  },
  timerEndingSoon: {
    backgroundColor: "rgba(239,68,68,0.2)",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  timerText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  timerTextEndingSoon: {
    color: "#EF4444",
  },
  dismissButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  ctaArrow: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  carouselContent: {
    paddingHorizontal: 0,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DEFAULT_GRAY,
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: DEFAULT_PRIMARY,
  },
  // Compact Banner
  compactBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DEFAULT_SURFACE,
    borderRadius: 12,
    overflow: "hidden",
    paddingRight: 12,
  },
  compactGradient: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  compactContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  compactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  compactBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  compactTitle: {
    flex: 1,
    color: DEFAULT_TEXT,
    fontSize: 14,
    fontWeight: "600",
  },
  compactTimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactTimerText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "500",
  },
  compactDismiss: {
    padding: 8,
  },
  // Promo Code Banner
  promoCodeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DEFAULT_SURFACE,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: DEFAULT_PRIMARY + "30",
    borderStyle: "dashed",
  },
  promoCodeContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promoCodeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: DEFAULT_PRIMARY + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  promoCodeText: {
    flex: 1,
  },
  promoCodeLabel: {
    color: DEFAULT_GRAY,
    fontSize: 12,
  },
  promoCodeValue: {
    color: DEFAULT_TEXT,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
  },
  promoCodeDiscount: {
    color: DEFAULT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  applyButton: {
    backgroundColor: DEFAULT_PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  promoCodeDismiss: {
    position: "absolute",
    top: 4,
    right: 4,
    padding: 4,
  },
});
