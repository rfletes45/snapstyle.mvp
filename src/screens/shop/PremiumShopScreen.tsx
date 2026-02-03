/**
 * Premium Shop Screen
 *
 * Main screen for browsing and purchasing items with real money (IAP).
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
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PremiumBundleCard,
  PremiumExclusiveCard,
  PurchaseConfirmationModal,
  TokenPackCard,
} from "@/components/shop";
import { EmptyState, LoadingState } from "@/components/ui";
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
import { SHOP_COLORS } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

type NavigationProp = NativeStackNavigationProp<
  ShopStackParamList,
  "PremiumShop"
>;

/**
 * Tab configuration for premium shop
 */
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

const TABS: PremiumTab[] = [
  { id: "tokens", label: "Tokens", icon: "gold" },
  { id: "bundles", label: "Bundles", icon: "package-variant" },
  { id: "exclusives", label: "Exclusives", icon: "star-circle" },
  { id: "gifts", label: "Gifts", icon: "gift" },
];

// Premium shop gradient colors
const PREMIUM_GRADIENT: readonly [string, string, ...string[]] = [
  "#1a0a2e",
  "#0d0d1a",
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map bundle theme to rarity
 */
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

/**
 * Convert PremiumBundle to CosmeticBundle format for the confirmation modal
 */
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
    priceTokens: 0, // Premium bundles are IAP only
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
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;

  // Premium shop hook
  const {
    catalog,
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

  // Local state
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Current tab
  const currentTab = TABS[activeTab];

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle tab change
  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

  // Handle token pack press
  const handleTokenPackPress = useCallback((pack: TokenPack) => {
    setSelectedItem({ type: "token_pack", item: pack });
    setShowPurchaseModal(true);
  }, []);

  // Handle bundle press
  const handleBundlePress = useCallback((bundle: PremiumBundle) => {
    setSelectedItem({ type: "bundle", item: bundle });
    setShowPurchaseModal(true);
  }, []);

  // Handle exclusive press
  const handleExclusivePress = useCallback((item: PremiumExclusiveItem) => {
    setSelectedItem({ type: "exclusive", item: item });
    setShowPurchaseModal(true);
  }, []);

  // Handle purchase confirmation
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
    } catch (err) {
      // Error handled by hook
    }
  }, [selectedItem, purchaseTokenPack, purchaseBundle, purchaseExclusive]);

  // Handle purchase modal close
  const handleClosePurchaseModal = useCallback(() => {
    setShowPurchaseModal(false);
    setSelectedItem(null);
  }, []);

  // Handle restore purchases
  const handleRestorePurchases = useCallback(async () => {
    setIsRestoring(true);
    try {
      await restorePurchases();
    } finally {
      setIsRestoring(false);
    }
  }, [restorePurchases]);

  // Render header
  const renderHeader = () => (
    <LinearGradient
      colors={PREMIUM_GRADIENT}
      style={[styles.header, { paddingTop: insets.top + 12 }]}
    >
      <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
        <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>Premium Shop</Text>

      <TouchableOpacity
        style={styles.headerButton}
        onPress={handleRestorePurchases}
        disabled={isRestoring}
      >
        <MaterialCommunityIcons
          name="restore"
          size={24}
          color={isRestoring ? "#666" : "#fff"}
        />
      </TouchableOpacity>
    </LinearGradient>
  );

  // Render tabs
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === index && styles.tabActive,
              activeTab === index && {
                backgroundColor: SHOP_COLORS.premium.primary + "30",
              },
            ]}
            onPress={() => handleTabChange(index)}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={20}
              color={
                activeTab === index
                  ? SHOP_COLORS.premium.primary
                  : colors.textSecondary
              }
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color:
                    activeTab === index
                      ? SHOP_COLORS.premium.primary
                      : colors.textSecondary,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Render token packs section
  const renderTokenPacks = () => (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Token Packs
      </Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Get tokens to spend in the Points Shop
      </Text>

      <View style={styles.tokenPacksGrid}>
        {tokenPacks.map((pack, index) => (
          <Animated.View
            key={pack.id}
            entering={FadeInDown.delay(index * 100).duration(300)}
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

  // Render bundles section
  const renderBundles = () => (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Premium Bundles
      </Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Great value packs with exclusive items
      </Text>

      {bundles.length === 0 ? (
        <EmptyState
          icon="package-variant"
          title="No Bundles Available"
          subtitle="Check back soon for new bundles!"
        />
      ) : (
        <View style={styles.bundlesContainer}>
          {bundles.map((bundle, index) => (
            <Animated.View
              key={bundle.id}
              entering={FadeInDown.delay(index * 100).duration(300)}
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

  // Render exclusives section
  const renderExclusives = () => (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Exclusive Items
      </Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Premium-only items you can't get anywhere else
      </Text>

      {exclusives.length === 0 ? (
        <EmptyState
          icon="star-circle"
          title="No Exclusives Available"
          subtitle="Check back soon for exclusive items!"
        />
      ) : (
        <View style={styles.exclusivesGrid}>
          {exclusives.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.delay(index * 100).duration(300)}
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

  // Render gifts section
  const renderGifts = () => (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Gift Shop
      </Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        Send gifts to your friends
      </Text>

      <View style={styles.giftComingSoon}>
        <MaterialCommunityIcons
          name="gift-outline"
          size={64}
          color={SHOP_COLORS.premium.primary}
        />
        <Text style={[styles.comingSoonTitle, { color: colors.text }]}>
          Coming Soon!
        </Text>
        <Text style={[styles.comingSoonText, { color: colors.textSecondary }]}>
          Gift tokens and exclusive items to your friends. Stay tuned!
        </Text>
      </View>
    </Animated.View>
  );

  // Render content based on active tab
  const renderContent = () => {
    if (loading) {
      return <LoadingState message="Loading premium shop..." />;
    }

    if (error) {
      return (
        <EmptyState
          icon="alert-circle"
          title="Failed to Load"
          subtitle={error.message || "Please try again later"}
          actionLabel="Retry"
          onAction={refresh}
        />
      );
    }

    if (!iapReady) {
      return (
        <EmptyState
          icon="store-off"
          title="Store Not Available"
          subtitle="In-app purchases are not available on this device"
        />
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

  // Get selected item for modal
  const getModalItem = useMemo(() => {
    if (!selectedItem) return undefined;

    switch (selectedItem.type) {
      case "token_pack":
        return {
          id: selectedItem.item.id,
          name: selectedItem.item.name,
          priceUSD: selectedItem.item.basePriceUSD,
          description: `${selectedItem.item.totalTokens.toLocaleString()} tokens`,
          imagePath: "🪙",
        };
      case "bundle":
        return {
          id: selectedItem.item.id,
          name: selectedItem.item.name,
          priceUSD: selectedItem.item.basePriceUSD,
          description: selectedItem.item.description,
          imagePath: selectedItem.item.imagePath,
        };
      case "exclusive":
        return {
          id: selectedItem.item.id,
          name: selectedItem.item.name,
          priceUSD: selectedItem.item.basePriceUSD,
          description: selectedItem.item.description,
          imagePath: selectedItem.item.imagePath,
          rarity: selectedItem.item.rarity,
        };
      default:
        return undefined;
    }
  }, [selectedItem]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      {renderTabs()}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={SHOP_COLORS.premium.primary}
          />
        }
      >
        {renderContent()}
      </ScrollView>

      {/* Purchase Modal */}
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  tabsContainer: {
    backgroundColor: "transparent",
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  tabActive: {
    borderWidth: 1,
    borderColor: SHOP_COLORS.premium.primary + "50",
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  tokenPacksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  bundlesContainer: {
    gap: 16,
  },
  exclusivesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  giftComingSoon: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  comingSoonText: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 280,
  },
});
