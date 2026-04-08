/**
 * Premium Shop Screen
 *
 * Main screen for browsing and purchasing items with real money (IAP).
 * Polished premium storefront with curated cosmetic presentation.
 *
 * Features:
 * - Tab navigation (Tokens, Bundles, Exclusives, Gifts)
 * - Token pack displays with localized pricing
 * - Premium bundle showcases
 * - Exclusive items section
 * - Gift purchasing
 * - Restore purchases functionality
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 7
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PremiumBundleCard,
  PremiumExclusiveCard,
  PurchaseConfirmationModal,
  TokenPackCard,
} from "@/components/shop";
import type { CosmeticBundle } from "@/data/cosmeticBundles";
import { usePremiumShop } from "@/hooks";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  PremiumBundle,
  PremiumExclusiveItem,
  ShopStackParamList,
  TokenPack,
} from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

type NavigationProp = NativeStackNavigationProp<
  ShopStackParamList,
  "PremiumShop"
>;

interface PremiumTab {
  id: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

type SelectedItem =
  | { type: "token_pack"; item: TokenPack }
  | { type: "bundle"; item: PremiumBundle }
  | { type: "exclusive"; item: PremiumExclusiveItem };

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_GAP = 12;
const EXCLUSIVE_CARD_WIDTH = (SCREEN_WIDTH - 32 - CARD_GAP) / 2;

const TABS: PremiumTab[] = [
  { id: "tokens", label: "Tokens", icon: "gold" },
  { id: "bundles", label: "Bundles", icon: "package-variant" },
  { id: "exclusives", label: "Exclusives", icon: "star-circle" },
  { id: "gifts", label: "Gifts", icon: "gift" },
];

const PREMIUM_HEADER_GRADIENT: readonly [string, string, ...string[]] = [
  "#2a1052",
  "#150830",
  "#0f0f17",
];

const PREM = {
  gold: "#FFD700",
  purple: "#B24BF3",
  purpleLight: "#D084FF",
  purpleDark: "#7B1FA2",
  surface: "rgba(180, 100, 255, 0.08)",
  surfaceBorder: "rgba(180, 100, 255, 0.15)",
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

function themeToRarity(
  theme: string,
): "common" | "rare" | "epic" | "legendary" | "mythic" {
  switch (theme) {
    case "mythic":
      return "mythic";
    case "legendary":
      return "legendary";
    case "premium":
      return "epic";
    case "starter":
    default:
      return "rare";
  }
}

function mapPremiumBundleToCosmeticBundle(
  bundle: PremiumBundle,
): CosmeticBundle {
  return {
    id: bundle.id,
    name: bundle.name,
    description: bundle.description,
    type: "premium",
    rarity: themeToRarity(bundle.theme),
    items: bundle.items.map((item) => ({
      cosmeticId: item.itemId,
      name: item.name,
      slot: item.slot,
      imagePath: item.imagePath,
      rarity: item.rarity,
      priceTokens: 0,
    })),
    priceTokens: 0,
    originalPriceTokens: 0,
    discountPercent: bundle.savingsPercent,
    priceUSD: bundle.basePriceUSD,
    imagePath: bundle.imagePath,
    featured: bundle.featured,
    sortOrder: bundle.sortOrder,
  };
}

// =============================================================================
// Component
// =============================================================================

export default function PremiumShopScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;

  const {
    tokenPacks,
    bundles,
    exclusives,
    loading,
    purchaseLoading,
    error,
    purchaseError,
    iapReady,
    purchaseTokenPack,
    purchaseBundle,
    purchaseExclusive,
    restorePurchases,
    refresh,
  } = usePremiumShop(user?.uid);

  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const currentTab = TABS[activeTab];

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

  const handleTokenPackPress = useCallback((pack: TokenPack) => {
    setSelectedItem({ type: "token_pack", item: pack });
    setShowPurchaseModal(true);
  }, []);

  const handleBundlePress = useCallback((bundle: PremiumBundle) => {
    setSelectedItem({ type: "bundle", item: bundle });
    setShowPurchaseModal(true);
  }, []);

  const handleExclusivePress = useCallback((item: PremiumExclusiveItem) => {
    setSelectedItem({ type: "exclusive", item: item });
    setShowPurchaseModal(true);
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!selectedItem) return;
    try {
      switch (selectedItem.type) {
        case "token_pack":
          await purchaseTokenPack(selectedItem.item.id);
          break;
        case "bundle":
          await purchaseBundle(selectedItem.item.id);
          break;
        case "exclusive":
          await purchaseExclusive(selectedItem.item.id);
          break;
      }
      setShowPurchaseModal(false);
      setSelectedItem(null);
    } catch {
      // Error handled by hook
    }
  }, [selectedItem, purchaseTokenPack, purchaseBundle, purchaseExclusive]);

  const handleClosePurchaseModal = useCallback(() => {
    setShowPurchaseModal(false);
    setSelectedItem(null);
  }, []);

  const handleRestorePurchases = useCallback(async () => {
    setIsRestoring(true);
    try {
      await restorePurchases();
    } finally {
      setIsRestoring(false);
    }
  }, [restorePurchases]);

  // === Hero Header ===
  const renderHeader = () => (
    <LinearGradient
      colors={PREMIUM_HEADER_GRADIENT}
      style={[styles.header, { paddingTop: insets.top + 8 }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <View style={styles.headerNav}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleRestorePurchases}
          disabled={isRestoring}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="restore"
            size={22}
            color={
              isRestoring ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)"
            }
          />
        </TouchableOpacity>
      </View>
      <View style={styles.headerBranding}>
        <MaterialCommunityIcons
          name="diamond-stone"
          size={28}
          color={PREM.gold}
        />
        <Text style={styles.headerTitle}>Premium Collection</Text>
        <Text style={styles.headerSubtitle}>
          Exclusive cosmetics & limited editions
        </Text>
      </View>
      <View style={styles.headerDivider}>
        <View style={styles.headerDividerLine} />
        <MaterialCommunityIcons
          name="diamond"
          size={10}
          color={PREM.purpleLight}
        />
        <View style={styles.headerDividerLine} />
      </View>
    </LinearGradient>
  );

  // === Tab Bar ===
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab, index) => {
          const isActive = activeTab === index;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTabChange(index)}
              activeOpacity={0.7}
            >
              {isActive && (
                <LinearGradient
                  colors={["rgba(178,75,243,0.25)", "rgba(178,75,243,0.08)"]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <MaterialCommunityIcons
                name={tab.icon}
                size={18}
                color={isActive ? PREM.purpleLight : "rgba(255,255,255,0.35)"}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? "#fff" : "rgba(255,255,255,0.35)",
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // === Section Header ===
  const renderSectionHeader = (
    title: string,
    subtitle: string,
    icon: keyof typeof MaterialCommunityIcons.glyphMap,
  ) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIconBg}>
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={PREM.purpleLight}
          />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>
    </View>
  );

  // === Premium Empty State ===
  const renderPremiumEmpty = (
    icon: keyof typeof MaterialCommunityIcons.glyphMap,
    title: string,
    subtitle: string,
  ) => (
    <View style={styles.premiumEmptyState}>
      <MaterialCommunityIcons name={icon} size={48} color={PREM.purpleLight} />
      <Text style={styles.premiumEmptyTitle}>{title}</Text>
      <Text style={styles.premiumEmptySubtitle}>{subtitle}</Text>
    </View>
  );

  // === Token Packs ===
  const renderTokenPacks = () => (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.section}>
      {renderSectionHeader(
        "Token Packs",
        "Get tokens to spend in the Shop",
        "gold",
      )}
      <View style={styles.tokenPacksGrid}>
        {tokenPacks.map((pack, index) => (
          <Animated.View
            key={pack.id}
            entering={FadeInDown.delay(index * 80).duration(350)}
            style={styles.tokenPackWrapper}
          >
            <TokenPackCard
              id={pack.id}
              tokens={pack.tokens}
              bonusTokens={pack.bonusTokens}
              priceUSD={pack.basePriceUSD}
              popular={pack.popular}
              onPurchase={() => handleTokenPackPress(pack)}
              purchasing={purchaseLoading}
            />
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );

  // === Bundles ===
  const renderBundles = () => (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.section}>
      {renderSectionHeader(
        "Premium Bundles",
        "Curated collections with exclusive items",
        "package-variant",
      )}
      {bundles.length === 0 ? (
        renderPremiumEmpty(
          "package-variant",
          "No Bundles Available",
          "New premium bundles are added regularly. Check back soon!",
        )
      ) : (
        <View style={styles.bundlesContainer}>
          {bundles.map((bundle, index) => (
            <Animated.View
              key={bundle.id}
              entering={FadeInDown.delay(index * 100).duration(350)}
            >
              <PremiumBundleCard
                bundle={bundle}
                onPress={() => handleBundlePress(bundle)}
                purchasing={purchaseLoading}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </Animated.View>
  );

  // === Exclusives ===
  const renderExclusives = () => (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.section}>
      {renderSectionHeader(
        "Exclusive Items",
        "Premium-only cosmetics you can't get anywhere else",
        "star-circle",
      )}
      {exclusives.length === 0 ? (
        renderPremiumEmpty(
          "star-circle",
          "No Exclusives Available",
          "Exclusive premium items drop periodically. Stay tuned!",
        )
      ) : (
        <View style={styles.exclusivesGrid}>
          {exclusives.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.delay(index * 80).duration(350)}
              style={styles.exclusiveCardWrapper}
            >
              <PremiumExclusiveCard
                item={item}
                onPress={() => handleExclusivePress(item)}
                purchasing={purchaseLoading}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </Animated.View>
  );

  // === Gifts ===
  const renderGifts = () => (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.section}>
      {renderSectionHeader("Gift Shop", "Send gifts to your friends", "gift")}
      <View style={styles.giftComingSoon}>
        <View style={styles.giftIconContainer}>
          <LinearGradient
            colors={["rgba(178,75,243,0.2)", "rgba(178,75,243,0.05)"]}
            style={styles.giftIconGlow}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <MaterialCommunityIcons
            name="gift-outline"
            size={56}
            color={PREM.purpleLight}
          />
        </View>
        <Text style={[styles.comingSoonTitle, { color: colors.text }]}>
          Coming Soon
        </Text>
        <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
          Gift tokens and exclusive items to your friends. We&apos;re putting the
          finishing touches on this feature!
        </Text>
      </View>
    </Animated.View>
  );

  // === Content Router ===
  const renderContent = () => {
    if (loading) {
      return (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.premiumLoadingContainer}
        >
          <View style={styles.premiumLoadingGlow}>
            <LinearGradient
              colors={["rgba(178,75,243,0.15)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </View>
          <MaterialCommunityIcons
            name="diamond-stone"
            size={36}
            color={PREM.purpleLight}
          />
          <ActivityIndicator
            size="small"
            color={PREM.purpleLight}
            style={{ marginTop: 16 }}
          />
          <Text style={styles.premiumLoadingText}>
            Loading premium collection...
          </Text>
        </Animated.View>
      );
    }

    if (error) {
      return (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.premiumErrorContainer}
        >
          <View style={styles.premiumErrorIcon}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={48}
              color="#EF5350"
            />
          </View>
          <Text style={styles.premiumErrorTitle}>Unable to Load</Text>
          <Text style={styles.premiumErrorSubtitle}>
            {error.message || "Something went wrong. Please try again."}
          </Text>
          <TouchableOpacity
            style={styles.premiumRetryButton}
            onPress={refresh}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
            <Text style={styles.premiumRetryText}>Try Again</Text>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    if (!iapReady) {
      return (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.premiumErrorContainer}
        >
          <View
            style={[
              styles.premiumErrorIcon,
              { backgroundColor: "rgba(255,255,255,0.05)" },
            ]}
          >
            <MaterialCommunityIcons
              name="store-off-outline"
              size={48}
              color="rgba(255,255,255,0.35)"
            />
          </View>
          <Text style={styles.premiumErrorTitle}>Store Unavailable</Text>
          <Text style={styles.premiumErrorSubtitle}>
            In-app purchases are not available on this device.
          </Text>
        </Animated.View>
      );
    }

    switch (currentTab?.id) {
      case "tokens":
        return renderTokenPacks();
      case "bundles":
        return renderBundles();
      case "exclusives":
        return renderExclusives();
      case "gifts":
        return renderGifts();
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      {renderTabs()}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={PREM.purpleLight}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {renderContent()}
      </ScrollView>

      {selectedItem && (
        <PurchaseConfirmationModal
          visible={showPurchaseModal}
          onDismiss={handleClosePurchaseModal}
          onConfirm={() => handlePurchase()}
          type={
            selectedItem.type === "token_pack"
              ? "tokens"
              : selectedItem.type === "bundle"
                ? "bundle"
                : "item"
          }
          tokenPack={
            selectedItem.type === "token_pack"
              ? {
                  tokens: selectedItem.item.tokens,
                  bonusTokens: selectedItem.item.bonusTokens,
                  priceUSD: selectedItem.item.basePriceUSD,
                }
              : undefined
          }
          bundle={
            selectedItem.type === "bundle"
              ? mapPremiumBundleToCosmeticBundle(selectedItem.item)
              : undefined
          }
          item={
            selectedItem.type === "exclusive"
              ? {
                  id: selectedItem.item.id,
                  cosmeticId: selectedItem.item.id,
                  name: selectedItem.item.name,
                  description: selectedItem.item.description,
                  category: "featured",
                  slot: selectedItem.item.slot,
                  priceTokens: 0,
                  priceUSD: selectedItem.item.basePriceUSD,
                  rarity: selectedItem.item.rarity,
                  imagePath: selectedItem.item.imagePath,
                  featured: selectedItem.item.featured,
                  purchaseCount: 0,
                  active: true,
                  sortOrder: selectedItem.item.sortOrder,
                  createdAt: Date.now(),
                  isAvailable: true,
                  timeRemaining: null,
                  alreadyOwned: selectedItem.item.owned ?? false,
                }
              : undefined
          }
          tokenBalance={0}
          purchasing={purchaseLoading}
          error={purchaseError}
        />
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerBranding: { alignItems: "center", paddingBottom: 12, gap: 6 },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  headerDivider: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  headerDividerLine: {
    width: 40,
    height: 1,
    backgroundColor: "rgba(178,75,243,0.3)",
  },

  // Tabs
  tabsContainer: {
    backgroundColor: "rgba(10,10,20,0.95)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(178,75,243,0.12)",
  },
  tabsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 7,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabActive: { borderColor: "rgba(178,75,243,0.3)" },
  tabLabel: { fontSize: 13, letterSpacing: 0.2 },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },

  // Sections
  section: { marginTop: 24 },
  sectionHeader: { marginBottom: 16 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(178,75,243,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 20, fontWeight: "700", letterSpacing: 0.2 },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
    marginLeft: 42,
    lineHeight: 18,
  },

  // Token Packs
  tokenPacksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CARD_GAP,
    justifyContent: "center",
  },
  tokenPackWrapper: {
    width: (SCREEN_WIDTH - 32 - CARD_GAP * 2) / 3,
    minWidth: 100,
  },

  // Bundles
  bundlesContainer: { gap: 16 },

  // Exclusives
  exclusivesGrid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP },
  exclusiveCardWrapper: { width: EXCLUSIVE_CARD_WIDTH },

  // Empty state
  premiumEmptyState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(178,75,243,0.12)",
    borderStyle: "dashed",
    backgroundColor: "rgba(178,75,243,0.04)",
  },
  premiumEmptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    marginTop: 16,
    textAlign: "center",
  },
  premiumEmptySubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },

  // Loading
  premiumLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  premiumLoadingGlow: {
    position: "absolute",
    top: 20,
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: "hidden",
  },
  premiumLoadingText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    marginTop: 12,
    letterSpacing: 0.3,
  },

  // Error
  premiumErrorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  premiumErrorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239,83,80,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  premiumErrorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  premiumErrorSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  premiumRetryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(178,75,243,0.2)",
    borderWidth: 1,
    borderColor: "rgba(178,75,243,0.3)",
  },
  premiumRetryText: { fontSize: 14, fontWeight: "600", color: "#D084FF" },

  // Gifts
  giftComingSoon: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  giftIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  giftIconGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 48 },
  comingSoonTitle: { fontSize: 20, fontWeight: "700" },
  comingSoonText: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
});
