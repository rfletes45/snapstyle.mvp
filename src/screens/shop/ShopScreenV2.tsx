/**
 * ShopScreen V2 - Enhanced Shop with Bundles and IAP
 *
 * Phase 6 of Profile Screen Overhaul
 *
 * Features:
 * - Featured items carousel with countdown timers
 * - Category-based item browsing (cosmetics, frames, themes, bubbles)
 * - Cosmetic bundles section with themed packs
 * - Token packs for real-money purchases
 * - IAP integration for bundle purchases
 * - Item purchase with tokens or real money
 * - Real-time catalog updates
 * - Owned item indicators
 */

import {
  PurchaseConfirmationModal,
  ShopBundleCard,
  TokenPackCard,
} from "@/components/shop";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import {
  BundleWithStatus,
  getBundlesWithStatus,
  purchaseBundleWithIAP,
  purchaseBundleWithTokens,
} from "@/services/bundles";
import { formatTokenAmount, subscribeToWallet } from "@/services/economy";
import {
  disconnectIAP,
  initializeIAP,
  purchaseTokenPack,
  TOKEN_PACKS,
  TokenPack,
} from "@/services/iap";
import {
  formatTimeRemaining,
  getFeaturedItemsWithStatus,
  getRarityColor,
  getRarityLabel,
  getShopCatalogWithStatus,
  purchaseWithTokens,
} from "@/services/shop";
import { useAuth } from "@/store/AuthContext";
import { ShopItemWithStatus, Wallet } from "@/types/models";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Chip,
  SegmentedButtons,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { PROFILE_FEATURES } from "../../../constants/featureFlags";
import { AppColors } from "../../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Main shop tabs
type ShopTab = "items" | "bundles" | "tokens";

// Category filter for items tab
type CategoryFilter =
  | "all"
  | "hat"
  | "glasses"
  | "background"
  | "profile_frame"
  | "chat_bubble"
  | "profile_theme"
  | "clothing"
  | "accessory";

const CATEGORIES: { key: CategoryFilter; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "store" },
  { key: "hat", label: "Hats", icon: "hat-fedora" },
  { key: "glasses", label: "Glasses", icon: "glasses" },
  { key: "background", label: "Backgrounds", icon: "image" },
  { key: "profile_frame", label: "Frames", icon: "card-outline" },
  { key: "chat_bubble", label: "Bubbles", icon: "message-text" },
  { key: "profile_theme", label: "Themes", icon: "palette" },
  { key: "clothing", label: "Clothing", icon: "tshirt-crew" },
  { key: "accessory", label: "Accessories", icon: "necklace" },
];

// Bundle type filters
type BundleFilter =
  | "all"
  | "starter"
  | "themed"
  | "seasonal"
  | "premium"
  | "limited";

const BUNDLE_FILTERS: { key: BundleFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "starter", label: "Starter" },
  { key: "themed", label: "Themed" },
  { key: "seasonal", label: "Seasonal" },
  { key: "premium", label: "Premium" },
  { key: "limited", label: "Limited" },
];

export default function ShopScreenV2({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;
  const theme = useTheme();

  // Main tab state
  const [activeTab, setActiveTab] = useState<ShopTab>("items");

  // Wallet state
  const [wallet, setWallet] = useState<Wallet | null>(null);

  // Items tab state
  const [catalogItems, setCatalogItems] = useState<ShopItemWithStatus[]>([]);
  const [featuredItems, setFeaturedItems] = useState<ShopItemWithStatus[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedItem, setSelectedItem] = useState<ShopItemWithStatus | null>(
    null,
  );

  // Bundles tab state
  const [bundles, setBundles] = useState<BundleWithStatus[]>([]);
  const [bundleFilter, setBundleFilter] = useState<BundleFilter>("all");
  const [selectedBundle, setSelectedBundle] = useState<BundleWithStatus | null>(
    null,
  );

  // Token packs tab state
  const [selectedTokenPack, setSelectedTokenPack] = useState<TokenPack | null>(
    null,
  );

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Purchase modal state
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseItem, setPurchaseItem] = useState<any>(null);
  const [purchaseType, setPurchaseType] = useState<
    "item" | "bundle" | "tokenPack"
  >("item");
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // Timer ref for countdown updates
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize IAP on mount
  useEffect(() => {
    if (PROFILE_FEATURES.COSMETIC_IAP) {
      initializeIAP().catch(console.error);
    }

    return () => {
      if (PROFILE_FEATURES.COSMETIC_IAP) {
        disconnectIAP().catch(console.error);
      }
    };
  }, []);

  // Load shop data
  const loadShopData = useCallback(async () => {
    if (!user) return;

    try {
      const [catalog, featured, bundlesData] = await Promise.all([
        getShopCatalogWithStatus(user.uid),
        getFeaturedItemsWithStatus(user.uid),
        getBundlesWithStatus(user.uid, wallet?.tokensBalance ?? 0),
      ]);

      setCatalogItems(catalog);
      setFeaturedItems(featured);
      setBundles(bundlesData);
      setError(null);
    } catch (err) {
      console.error("[ShopScreenV2] Error loading shop data:", err);
      setError("Failed to load shop");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, wallet?.tokensBalance]);

  // Subscribe to wallet
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToWallet(
      user.uid,
      (updatedWallet) => setWallet(updatedWallet),
      (err) => console.error("[ShopScreenV2] Wallet subscription error:", err),
    );

    return () => unsubscribe();
  }, [user]);

  // Load shop data on mount
  useEffect(() => {
    loadShopData();
  }, [loadShopData]);

  // Update countdown timers every second
  useEffect(() => {
    timerRef.current = setInterval(() => {
      // Force re-render to update countdowns
      setFeaturedItems((prev) =>
        prev.map((item) => ({
          ...item,
          timeRemaining: item.availableTo
            ? Math.max(0, item.availableTo - Date.now())
            : null,
        })),
      );
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadShopData();
  }, [loadShopData]);

  // Open purchase modal for item
  const handleItemSelect = (item: ShopItemWithStatus) => {
    setPurchaseItem(item);
    setPurchaseType("item");
    setPurchaseError(null);
    setPurchaseSuccess(false);
    setShowPurchaseModal(true);
  };

  // Open purchase modal for bundle
  const handleBundleSelect = (bundle: BundleWithStatus) => {
    setPurchaseItem(bundle);
    setPurchaseType("bundle");
    setPurchaseError(null);
    setPurchaseSuccess(false);
    setShowPurchaseModal(true);
  };

  // Open purchase modal for token pack
  const handleTokenPackSelect = (pack: TokenPack) => {
    setPurchaseItem(pack);
    setPurchaseType("tokenPack");
    setPurchaseError(null);
    setPurchaseSuccess(false);
    setShowPurchaseModal(true);
  };

  // Handle purchase
  const handlePurchase = async (paymentMethod: "tokens" | "iap") => {
    if (!purchaseItem || purchasing || !user) return;

    setPurchasing(true);
    setPurchaseError(null);
    setPurchaseSuccess(false);

    try {
      if (purchaseType === "item") {
        // Regular item purchase (tokens only)
        const result = await purchaseWithTokens(purchaseItem.id);
        if (result.success) {
          setPurchaseSuccess(true);
          loadShopData();
          setTimeout(() => {
            setShowPurchaseModal(false);
            setPurchaseSuccess(false);
          }, 1500);
        } else {
          setPurchaseError(result.error || "Purchase failed");
        }
      } else if (purchaseType === "bundle") {
        // Bundle purchase
        if (paymentMethod === "tokens") {
          const result = await purchaseBundleWithTokens(purchaseItem.id);
          if (result.success) {
            setPurchaseSuccess(true);
            loadShopData();
            setTimeout(() => {
              setShowPurchaseModal(false);
              setPurchaseSuccess(false);
            }, 1500);
          } else {
            setPurchaseError(result.error || "Purchase failed");
          }
        } else {
          // IAP purchase
          const result = await purchaseBundleWithIAP(purchaseItem.id, user.uid);
          if (result.success) {
            setPurchaseSuccess(true);
            loadShopData();
            setTimeout(() => {
              setShowPurchaseModal(false);
              setPurchaseSuccess(false);
            }, 1500);
          } else {
            setPurchaseError(result.error || "Purchase failed");
          }
        }
      } else if (purchaseType === "tokenPack") {
        // Token pack purchase (IAP only)
        const result = await purchaseTokenPack(purchaseItem.id, user.uid);
        if (result.success) {
          setPurchaseSuccess(true);
          setTimeout(() => {
            setShowPurchaseModal(false);
            setPurchaseSuccess(false);
          }, 1500);
        } else {
          setPurchaseError(result.error || "Purchase failed");
        }
      }
    } catch (err: any) {
      console.error("[ShopScreenV2] Purchase error:", err);
      setPurchaseError(err.message || "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  // Filter items by category
  const filteredItems = catalogItems.filter((item) => {
    if (category === "all") return !item.featured;
    return item.slot === category && !item.featured;
  });

  // Filter bundles by type
  const filteredBundles = bundles.filter((bundle) => {
    if (bundleFilter === "all") return true;
    return bundle.type === bundleFilter;
  });

  // Render featured item card
  const renderFeaturedItem = ({ item }: { item: ShopItemWithStatus }) => {
    const rarityColor = getRarityColor(item.rarity);
    const timeText =
      item.timeRemaining !== null
        ? formatTimeRemaining(item.timeRemaining)
        : null;

    return (
      <TouchableOpacity
        style={[
          styles.featuredCard,
          {
            borderColor: rarityColor,
            backgroundColor: theme.colors.surfaceVariant,
          },
        ]}
        onPress={() => handleItemSelect(item)}
        disabled={item.alreadyOwned}
      >
        <View style={styles.featuredImageContainer}>
          <View
            style={[
              styles.featuredImage,
              { backgroundColor: rarityColor + "30" },
            ]}
          >
            <Text style={styles.featuredEmoji}>
              {item.imagePath?.includes("🔥") || item.imagePath?.includes("👑")
                ? item.imagePath.charAt(item.imagePath.lastIndexOf("/") + 1)
                : "✨"}
            </Text>
          </View>
          {item.alreadyOwned && (
            <View style={styles.ownedBadge}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color="#4CAF50"
              />
            </View>
          )}
        </View>

        <View style={styles.featuredInfo}>
          <View style={styles.featuredHeader}>
            <View
              style={[styles.rarityBadge, { backgroundColor: rarityColor }]}
            >
              <Text style={styles.rarityText}>
                {getRarityLabel(item.rarity)}
              </Text>
            </View>
            {timeText && (
              <View style={styles.timerBadge}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={12}
                  color="#FFF"
                />
                <Text style={styles.timerText}>{timeText}</Text>
              </View>
            )}
          </View>

          <Text
            style={[styles.featuredName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          {item.description && (
            <Text
              style={[
                styles.featuredDescription,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}

          <View style={styles.featuredPrice}>
            <MaterialCommunityIcons
              name="circle-multiple"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={[styles.priceText, { color: theme.colors.primary }]}>
              {item.priceTokens}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render shop item card
  const renderShopItem = ({ item }: { item: ShopItemWithStatus }) => {
    const rarityColor = getRarityColor(item.rarity);

    return (
      <TouchableOpacity
        style={[
          styles.itemCard,
          { backgroundColor: theme.colors.surfaceVariant },
          item.alreadyOwned && styles.itemCardOwned,
        ]}
        onPress={() => handleItemSelect(item)}
        disabled={item.alreadyOwned}
      >
        <View
          style={[styles.itemImage, { backgroundColor: rarityColor + "20" }]}
        >
          <Text style={styles.itemEmoji}>
            {item.imagePath?.startsWith("cosmetics")
              ? "🎨"
              : item.imagePath || "✨"}
          </Text>
          {item.alreadyOwned && (
            <View style={styles.ownedOverlay}>
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color="#4CAF50"
              />
            </View>
          )}
        </View>

        <Text
          style={[styles.itemName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>

        <View
          style={[styles.itemRarity, { backgroundColor: rarityColor + "30" }]}
        >
          <Text style={[styles.itemRarityText, { color: rarityColor }]}>
            {getRarityLabel(item.rarity)}
          </Text>
        </View>

        {!item.alreadyOwned && (
          <View style={styles.itemPrice}>
            <MaterialCommunityIcons
              name="circle-multiple"
              size={14}
              color={theme.colors.primary}
            />
            <Text
              style={[styles.itemPriceText, { color: theme.colors.primary }]}
            >
              {item.priceTokens}
            </Text>
          </View>
        )}

        {item.alreadyOwned && <Text style={styles.ownedText}>Owned</Text>}
      </TouchableOpacity>
    );
  };

  // Render balance bar
  const renderBalanceBar = () => (
    <View
      style={[
        styles.balanceBar,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <View style={styles.balanceInfo}>
        <MaterialCommunityIcons
          name="circle-multiple"
          size={24}
          color={theme.colors.primary}
        />
        <Text style={[styles.balanceText, { color: theme.colors.onSurface }]}>
          {wallet ? formatTokenAmount(wallet.tokensBalance) : "0"}
        </Text>
        <Text
          style={[
            styles.balanceLabel,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          tokens
        </Text>
      </View>
      <Button
        mode="contained"
        compact
        icon="plus"
        onPress={() => setActiveTab("tokens")}
        style={styles.buyTokensButton}
      >
        Buy Tokens
      </Button>
    </View>
  );

  // Render items tab header
  const renderItemsHeader = () => (
    <View>
      {renderBalanceBar()}

      {/* Featured Section */}
      {featuredItems.length > 0 && (
        <View style={styles.featuredSection}>
          <View style={styles.sectionHeader}>
            <Text
              style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
            >
              ⭐ Limited Time
            </Text>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Get them before they're gone!
            </Text>
          </View>
          <FlatList
            horizontal
            data={featuredItems}
            renderItem={renderFeaturedItem}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
          />
        </View>
      )}

      {/* Category Tabs - Scrollable */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScrollView}
        contentContainerStyle={styles.categoryTabs}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryTab,
              { backgroundColor: theme.colors.surfaceVariant },
              category === cat.key && [
                styles.categoryTabActive,
                { borderColor: theme.colors.primary },
              ],
            ]}
            onPress={() => setCategory(cat.key)}
          >
            <MaterialCommunityIcons
              name={cat.icon as any}
              size={18}
              color={
                category === cat.key
                  ? theme.colors.primary
                  : theme.colors.onSurfaceDisabled
              }
            />
            <Text
              style={[
                styles.categoryTabText,
                { color: theme.colors.onSurfaceDisabled },
                category === cat.key && [
                  styles.categoryTabTextActive,
                  { color: theme.colors.primary },
                ],
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Render bundles tab content
  const renderBundlesTab = () => (
    <ScrollView
      style={styles.bundlesContainer}
      contentContainerStyle={styles.bundlesContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      {renderBalanceBar()}

      {/* Bundle type filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bundleFiltersScroll}
        contentContainerStyle={styles.bundleFilters}
      >
        {BUNDLE_FILTERS.map((filter) => (
          <Chip
            key={filter.key}
            selected={bundleFilter === filter.key}
            onPress={() => setBundleFilter(filter.key)}
            style={[
              styles.bundleFilterChip,
              bundleFilter === filter.key && styles.bundleFilterChipActive,
            ]}
            textStyle={
              bundleFilter === filter.key
                ? styles.bundleFilterTextActive
                : undefined
            }
          >
            {filter.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Featured Bundles */}
      {bundleFilter === "all" && (
        <View style={styles.featuredBundlesSection}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            🎁 Featured Bundles
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredBundlesList}
          >
            {bundles
              .filter((b) => b.featured && !b.fullyOwned)
              .slice(0, 3)
              .map((bundle) => (
                <View key={bundle.id} style={styles.featuredBundleWrapper}>
                  <ShopBundleCard
                    bundle={bundle}
                    tokenBalance={wallet?.tokensBalance ?? 0}
                    onPurchase={(bundleId, method) =>
                      handleBundleSelect(bundle)
                    }
                    onPress={(bundleId) => handleBundleSelect(bundle)}
                    compact
                  />
                </View>
              ))}
          </ScrollView>
        </View>
      )}

      {/* Bundle List */}
      <View style={styles.bundleListSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
          {bundleFilter === "all"
            ? "All Bundles"
            : `${bundleFilter.charAt(0).toUpperCase() + bundleFilter.slice(1)} Bundles`}
        </Text>
        {filteredBundles.length === 0 ? (
          <EmptyState
            icon="package-variant"
            title="No bundles available"
            subtitle="Check back later for new bundles!"
          />
        ) : (
          filteredBundles.map((bundle) => (
            <View key={bundle.id} style={styles.bundleCardWrapper}>
              <ShopBundleCard
                bundle={bundle}
                tokenBalance={wallet?.tokensBalance ?? 0}
                onPurchase={(bundleId, method) => handleBundleSelect(bundle)}
                onPress={(bundleId) => handleBundleSelect(bundle)}
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  // Render token packs tab content
  const renderTokenPacksTab = () => (
    <ScrollView
      style={styles.tokenPacksContainer}
      contentContainerStyle={styles.tokenPacksContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={["#6366F1", "#8B5CF6", "#A855F7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tokenPacksHeader}
      >
        <MaterialCommunityIcons name="circle-multiple" size={48} color="#FFF" />
        <Text style={styles.tokenPacksTitle}>Get More Tokens</Text>
        <Text style={styles.tokenPacksSubtitle}>
          Purchase tokens to unlock exclusive cosmetics, bundles, and more!
        </Text>
        <View style={styles.currentBalance}>
          <Text style={styles.currentBalanceLabel}>Current Balance</Text>
          <Text style={styles.currentBalanceValue}>
            {wallet ? formatTokenAmount(wallet.tokensBalance) : "0"} tokens
          </Text>
        </View>
      </LinearGradient>

      {/* Token Packs Grid */}
      <View style={styles.tokenPacksGrid}>
        {TOKEN_PACKS.map((pack) => (
          <View key={pack.id} style={styles.tokenPackWrapper}>
            <TokenPackCard
              id={pack.id}
              tokens={pack.tokens}
              bonusTokens={pack.bonusTokens}
              priceUSD={pack.basePriceUSD}
              popular={pack.popular}
              onPurchase={() => handleTokenPackSelect(pack as TokenPack)}
            />
          </View>
        ))}
      </View>

      {/* Info Section */}
      <View style={styles.tokenInfoSection}>
        <Text
          style={[styles.tokenInfoTitle, { color: theme.colors.onSurface }]}
        >
          About Tokens
        </Text>
        <View style={styles.tokenInfoItem}>
          <MaterialCommunityIcons
            name="shopping"
            size={24}
            color={theme.colors.primary}
          />
          <Text
            style={[
              styles.tokenInfoText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Use tokens to purchase cosmetics, profile frames, themes, and more
          </Text>
        </View>
        <View style={styles.tokenInfoItem}>
          <MaterialCommunityIcons
            name="gift"
            size={24}
            color={theme.colors.primary}
          />
          <Text
            style={[
              styles.tokenInfoText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Earn free tokens through daily rewards and achievements
          </Text>
        </View>
        <View style={styles.tokenInfoItem}>
          <MaterialCommunityIcons
            name="shield-check"
            size={24}
            color={theme.colors.primary}
          />
          <Text
            style={[
              styles.tokenInfoText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Secure payments powered by App Store and Google Play
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  // Render purchase modal
  const renderPurchaseModal = () => {
    if (!purchaseItem) return null;

    // Determine the purchase type for the modal
    let modalType: "item" | "bundle" | "tokens" = "item";
    let modalItem: ShopItemWithStatus | undefined;
    let modalBundle: any | undefined;
    let modalTokenPack:
      | { tokens: number; bonusTokens: number; priceUSD: number }
      | undefined;

    if (purchaseType === "item") {
      modalType = "item";
      modalItem = purchaseItem as ShopItemWithStatus;
    } else if (purchaseType === "bundle") {
      modalType = "bundle";
      modalBundle = purchaseItem;
    } else if (purchaseType === "tokenPack") {
      modalType = "tokens";
      modalTokenPack = {
        tokens: purchaseItem.tokens,
        bonusTokens: purchaseItem.bonusTokens,
        priceUSD: purchaseItem.basePriceUSD,
      };
    }

    return (
      <PurchaseConfirmationModal
        visible={showPurchaseModal}
        onDismiss={() => {
          setShowPurchaseModal(false);
          setPurchaseError(null);
          setPurchaseSuccess(false);
        }}
        onConfirm={handlePurchase}
        type={modalType}
        item={modalItem}
        bundle={modalBundle}
        tokenPack={modalTokenPack}
        tokenBalance={wallet?.tokensBalance ?? 0}
        purchasing={purchasing}
        error={purchaseError}
      />
    );
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Appbar.Header
          style={[styles.header, { backgroundColor: theme.colors.surface }]}
        >
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Shop" />
        </Appbar.Header>
        <LoadingState message="Loading shop..." />
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Appbar.Header
          style={[styles.header, { backgroundColor: theme.colors.surface }]}
        >
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Shop" />
        </Appbar.Header>
        <ErrorState message={error} onRetry={loadShopData} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top", "left", "right"]}
    >
      <Appbar.Header
        style={[styles.header, { backgroundColor: theme.colors.surface }]}
      >
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Shop" />
        <Appbar.Action
          icon="refresh"
          onPress={handleRefresh}
          disabled={refreshing}
        />
      </Appbar.Header>

      {/* Main Tab Buttons */}
      <View style={styles.mainTabs}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ShopTab)}
          buttons={[
            {
              value: "items",
              label: "Items",
              icon: "store",
            },
            {
              value: "bundles",
              label: "Bundles",
              icon: "package-variant",
            },
            {
              value: "tokens",
              label: "Tokens",
              icon: "circle-multiple",
            },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      {/* Tab Content */}
      {activeTab === "items" && (
        <FlatList
          data={filteredItems}
          renderItem={renderShopItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          {...LIST_PERFORMANCE_PROPS}
          ListHeaderComponent={renderItemsHeader}
          ListEmptyComponent={
            <EmptyState
              icon="shopping"
              title="No items available"
              subtitle="Check back later for new items!"
            />
          }
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}

      {activeTab === "bundles" && renderBundlesTab()}

      {activeTab === "tokens" && renderTokenPacksTab()}

      {renderPurchaseModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    backgroundColor: "#000",
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  mainTabs: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentedButtons: {
    backgroundColor: "transparent",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },

  // Balance Bar
  balanceBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  balanceInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  balanceText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
  },
  balanceLabel: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  buyTokensButton: {
    backgroundColor: "#6366F1",
  },

  // Featured Section
  featuredSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  featuredList: {
    paddingRight: 16,
  },
  featuredCard: {
    width: SCREEN_WIDTH * 0.7,
    backgroundColor: "#111",
    borderRadius: 12,
    marginRight: 12,
    overflow: "hidden",
    borderWidth: 2,
  },
  featuredImageContainer: {
    position: "relative",
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  featuredImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  featuredEmoji: {
    fontSize: 48,
  },
  featuredInfo: {
    padding: 12,
  },
  featuredHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000",
    textTransform: "uppercase",
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F44336",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  timerText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFF",
  },
  featuredName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 4,
  },
  featuredDescription: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8,
  },
  featuredPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  priceText: {
    fontSize: 18,
    fontWeight: "bold",
    color: AppColors.primary,
  },
  ownedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 4,
  },

  // Category Tabs
  categoryScrollView: {
    marginBottom: 16,
  },
  categoryTabs: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  categoryTabActive: {
    borderWidth: 1,
  },
  categoryTabText: {
    fontSize: 12,
    color: "#666",
  },
  categoryTabTextActive: {
    fontWeight: "bold",
  },

  // Item Card
  itemCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  itemCardOwned: {
    opacity: 0.7,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  itemEmoji: {
    fontSize: 40,
  },
  ownedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
    textAlign: "center",
    marginBottom: 4,
  },
  itemRarity: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  itemRarityText: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  itemPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemPriceText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  ownedText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "bold",
  },

  // Bundles Tab
  bundlesContainer: {
    flex: 1,
  },
  bundlesContent: {
    padding: 16,
    paddingBottom: 100,
  },
  bundleFiltersScroll: {
    marginBottom: 16,
  },
  bundleFilters: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
  },
  bundleFilterChip: {
    backgroundColor: "#222",
  },
  bundleFilterChipActive: {
    backgroundColor: "#6366F1",
  },
  bundleFilterTextActive: {
    color: "#FFF",
  },
  featuredBundlesSection: {
    marginBottom: 24,
  },
  featuredBundlesList: {
    paddingRight: 16,
    paddingTop: 12,
  },
  featuredBundleWrapper: {
    marginRight: 12,
    width: SCREEN_WIDTH * 0.75,
  },
  bundleListSection: {
    marginBottom: 24,
  },
  bundleCardWrapper: {
    marginTop: 12,
  },

  // Token Packs Tab
  tokenPacksContainer: {
    flex: 1,
  },
  tokenPacksContent: {
    paddingBottom: 100,
  },
  tokenPacksHeader: {
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  tokenPacksTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFF",
    marginTop: 12,
  },
  tokenPacksSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 32,
  },
  currentBalance: {
    marginTop: 16,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  currentBalanceLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  currentBalanceValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF",
  },
  tokenPacksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  tokenPackWrapper: {
    width: (SCREEN_WIDTH - 44) / 2,
  },
  tokenInfoSection: {
    padding: 16,
    margin: 16,
    backgroundColor: "#111",
    borderRadius: 16,
  },
  tokenInfoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 16,
  },
  tokenInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  tokenInfoText: {
    flex: 1,
    fontSize: 14,
  },
});
