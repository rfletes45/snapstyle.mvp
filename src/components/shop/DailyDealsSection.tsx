/**
 * DailyDealsSection Component
 *
 * Displays rotating daily deals with countdown timer.
 * Shows discounted items in a horizontal carousel.
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.6
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { BorderRadius, Spacing } from "@/constants/theme";
import { formatTimeUntilRefresh } from "@/services/dailyDeals";
import { useAppTheme } from "@/store/ThemeContext";
import type { DailyDeal } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

export interface DailyDealsSectionProps {
  /** Daily deals data */
  deals: DailyDeal[];

  /** Loading state */
  loading?: boolean;

  /** Handle deal press */
  onDealPress: (deal: DailyDeal) => void;

  /** Handle view all press */
  onViewAllPress?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEAL_CARD_WIDTH = SCREEN_WIDTH * 0.4;
const DEAL_CARD_HEIGHT = 180;

// =============================================================================
// Sub-components
// =============================================================================

interface DealCardProps {
  deal: DailyDeal;
  onPress: () => void;
  index: number;
}

const DealCard = memo(function DealCard({
  deal,
  onPress,
  index,
}: DealCardProps) {
  const { colors, isDark } = useAppTheme();

  // Pulse animation for discount badge
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
      true,
    );
  }, []);

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Determine gradient based on discount
  const getDiscountColor = (percent: number) => {
    if (percent >= 50) return "#E91E63"; // Pink for big discounts
    if (percent >= 30) return "#FF5722"; // Orange
    return "#4CAF50"; // Green
  };

  const discountColor = getDiscountColor(deal.discountPercent);

  return (
    <Animated.View entering={FadeInRight.delay(index * 100).duration(300)}>
      <Pressable
        style={({ pressed }) => [
          styles.dealCard,
          { backgroundColor: colors.surface },
          pressed && styles.dealCardPressed,
        ]}
        onPress={onPress}
      >
        {/* Discount Badge */}
        <Animated.View
          style={[
            styles.discountBadge,
            { backgroundColor: discountColor },
            badgeAnimatedStyle,
          ]}
        >
          <Text style={styles.discountText}>-{deal.discountPercent}%</Text>
        </Animated.View>

        {/* Item Image */}
        <View style={styles.itemImageContainer}>
          <Text style={styles.itemImage}>{deal.item.imagePath}</Text>
        </View>

        {/* Item Info */}
        <View style={styles.itemInfo}>
          <Text
            numberOfLines={1}
            style={[styles.itemName, { color: colors.text }]}
          >
            {deal.item.name}
          </Text>

          {/* Price */}
          <View style={styles.priceContainer}>
            <Text
              style={[styles.originalPrice, { color: colors.textSecondary }]}
            >
              {deal.originalPrice}
            </Text>
            <Text style={[styles.dealPrice, { color: colors.primary }]}>
              {deal.dealPrice}
            </Text>
            <MaterialCommunityIcons
              name="gold"
              size={14}
              color={colors.primary}
              style={styles.tokenIcon}
            />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

function DailyDealsSectionBase({
  deals,
  loading = false,
  onDealPress,
  onViewAllPress,
}: DailyDealsSectionProps) {
  const { colors, isDark } = useAppTheme();

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState(formatTimeUntilRefresh());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(formatTimeUntilRefresh());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Render deal card
  const renderDeal = useCallback(
    ({ item, index }: { item: DailyDeal; index: number }) => (
      <DealCard deal={item} onPress={() => onDealPress(item)} index={index} />
    ),
    [onDealPress],
  );

  // Empty state
  if (!loading && deals.length === 0) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons
              name="fire"
              size={24}
              color={colors.primary}
            />
            <Text
              variant="titleMedium"
              style={[styles.title, { color: colors.text }]}
            >
              Daily Deals
            </Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dealCardSkeleton,
                { backgroundColor: colors.surfaceVariant },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="fire" size={24} color="#FF5722" />
          <Text
            variant="titleMedium"
            style={[styles.title, { color: colors.text }]}
          >
            Daily Deals
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Countdown */}
          <View
            style={[
              styles.countdown,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="clock-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.countdownText, { color: colors.textSecondary }]}
            >
              {timeRemaining}
            </Text>
          </View>

          {/* View All */}
          {onViewAllPress && (
            <Pressable onPress={onViewAllPress} style={styles.viewAllButton}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>
                View All
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.primary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Deals List */}
      <FlatList
        data={deals}
        keyExtractor={(deal) => deal.id}
        renderItem={renderDeal}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dealsList}
        snapToInterval={DEAL_CARD_WIDTH + Spacing.sm}
        decelerationRate="fast"
      />
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  title: {
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  countdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: "600",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  dealsList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  dealCard: {
    width: DEAL_CARD_WIDTH,
    height: DEAL_CARD_HEIGHT,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    padding: Spacing.sm,
  },
  dealCardPressed: {
    opacity: 0.8,
  },
  discountBadge: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    zIndex: 1,
  },
  discountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  itemImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  itemImage: {
    fontSize: 48,
  },
  itemInfo: {
    marginTop: "auto",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  dealPrice: {
    fontSize: 16,
    fontWeight: "700",
  },
  tokenIcon: {
    marginLeft: 2,
  },
  loadingContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  dealCardSkeleton: {
    width: DEAL_CARD_WIDTH,
    height: DEAL_CARD_HEIGHT,
    borderRadius: BorderRadius.lg,
  },
});

// =============================================================================
// Export
// =============================================================================

export const DailyDealsSection = memo(DailyDealsSectionBase);
export default DailyDealsSection;
