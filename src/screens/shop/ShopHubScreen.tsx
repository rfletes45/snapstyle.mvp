/**
 * Shop Hub Screen
 *
 * Entry point to the shop system with clear navigation to:
 * - Points Shop: Purchase items with tokens (virtual currency)
 * - Premium Shop: Purchase items with real money (IAP)
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { subscribeToWallet } from "@/services/economy";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { Wallet } from "@/types/models";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/shop/ShopHubScreen");
// =============================================================================
// Types
// =============================================================================

// Use any for navigation since ShopHubScreen is a tab screen that needs
// to navigate to screens in the root stack (PointsShop, PremiumShop, etc.)
type NavigationProp = any;

interface ShopOption {
  id: "points" | "premium";
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  features: string[];
  gradient: readonly [string, string];
  onPress: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const SHOP_GRADIENTS = {
  points: ["#FFD700", "#FFA500"] as const, // Gold to Orange
  premium: ["#9C27B0", "#E91E63"] as const, // Purple to Pink
} as const;

// =============================================================================
// Component
// =============================================================================

export default function ShopHubScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;

  // Wallet state
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);

  // Subscribe to wallet updates
  useEffect(() => {
    if (!user?.uid) return;

    setWalletLoading(true);
    const unsubscribe = subscribeToWallet(
      user.uid,
      (newWallet) => {
        setWallet(newWallet);
        setWalletLoading(false);
      },
      (error) => {
        logger.error("[ShopHubScreen] Wallet subscription error:", error);
        setWalletLoading(false);
      },
    );

    return unsubscribe;
  }, [user?.uid]);

  // Navigation handlers
  const handlePointsShop = useCallback(() => {
    // Navigate to Points Shop (reuses existing ShopScreen)
    navigation.navigate("PointsShop");
  }, [navigation]);

  const handlePremiumShop = useCallback(() => {
    navigation.navigate("PremiumShop");
  }, [navigation]);

  const handlePurchaseHistory = useCallback(() => {
    navigation.navigate("PurchaseHistory");
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  // Shop options configuration
  const shopOptions: ShopOption[] = [
    {
      id: "points",
      title: "Points Shop",
      subtitle: "Spend your tokens on cosmetics",
      icon: "star-circle",
      features: ["Avatar items", "Profile decorations", "Chat customizations"],
      gradient: SHOP_GRADIENTS.points,
      onPress: handlePointsShop,
    },
    {
      id: "premium",
      title: "Premium Shop",
      subtitle: "Exclusive items & bundles",
      icon: "diamond-stone",
      features: [
        "Token packs",
        "Premium bundles",
        "Limited exclusives",
        "Gift items",
      ],
      gradient: SHOP_GRADIENTS.premium,
      onPress: handlePremiumShop,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.headerBackground,
          },
        ]}
      >
        {/* Back button - only shown when there's navigation history */}
        {navigation.canGoBack() ? (
          <Pressable
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={colors.headerText}
            />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}

        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          Shop
        </Text>

        {/* Wallet Balance */}
        <View style={styles.walletContainer}>
          <MaterialCommunityIcons
            name="star-circle"
            size={20}
            color="#FFD700"
          />
          <Text style={[styles.walletBalance, { color: colors.headerText }]}>
            {walletLoading
              ? "..."
              : (wallet?.tokensBalance?.toLocaleString() ?? "0")}
          </Text>
        </View>
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Shop Options */}
        {shopOptions.map((option, index) => (
          <ShopOptionCard
            key={option.id}
            option={option}
            index={index}
            colors={colors}
            isDark={isDark}
          />
        ))}

        {/* Purchase History Button */}
        <Animated.View entering={FadeInUp.delay(400).duration(300)}>
          <Pressable
            onPress={handlePurchaseHistory}
            style={({ pressed }) => [
              styles.historyButton,
              {
                backgroundColor: pressed
                  ? colors.surfaceVariant
                  : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="history"
              size={24}
              color={colors.textSecondary}
            />
            <Text
              style={[
                styles.historyButtonText,
                { color: colors.textSecondary },
              ]}
            >
              View Purchase History
            </Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
        </Animated.View>

        {/* Info Text */}
        <Animated.View entering={FadeInUp.delay(500).duration(300)}>
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            Shop items are exclusive and cannot be obtained through achievements
            or milestones.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Shop Option Card Component
// =============================================================================

interface ShopOptionCardProps {
  option: ShopOption;
  index: number;
  colors: ReturnType<typeof useAppTheme>["colors"];
  isDark: boolean;
}

function ShopOptionCard({
  option,
  index,
  colors,
  isDark,
}: ShopOptionCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 15 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15 });
  }, [scale]);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 150).duration(400)}
      style={animatedStyle}
    >
      <Pressable
        onPress={option.onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardPressable}
      >
        <LinearGradient
          colors={[option.gradient[0], option.gradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Icon */}
          <View style={styles.cardIconContainer}>
            <MaterialCommunityIcons
              name={option.icon}
              size={48}
              color="rgba(255, 255, 255, 0.95)"
            />
          </View>

          {/* Content */}
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{option.title}</Text>
            <Text style={styles.cardSubtitle}>{option.subtitle}</Text>

            {/* Features List */}
            <View style={styles.featuresList}>
              {option.features.map((feature, i) => (
                <View key={i} style={styles.featureItem}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={16}
                    color="rgba(255, 255, 255, 0.8)"
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Enter Button */}
            <View style={styles.enterButton}>
              <Text style={styles.enterButtonText}>Enter Shop</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={20}
                color="rgba(255, 255, 255, 0.95)"
              />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 12,
  },
  walletContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  walletBalance: {
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  cardPressable: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cardGradient: {
    flexDirection: "row",
    padding: 20,
    minHeight: 180,
  },
  cardIconContainer: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginBottom: 12,
  },
  featuresList: {
    gap: 6,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
  },
  enterButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  enterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  historyButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  infoText: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 18,
  },
});
