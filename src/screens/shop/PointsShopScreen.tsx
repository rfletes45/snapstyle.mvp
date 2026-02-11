/**
 * Points Shop Screen
 *
 * Main screen for browsing and purchasing items with tokens (virtual currency).
 *
 * Features:
 * - Category tabs (Avatar, Profile, Chat, Effects)
 * - Featured items carousel
 * - Category-based item browsing
 * - Search and filtering
 * - Token balance display
 * - Real-time catalog updates
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 4.2
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  Layout,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  FeaturedCarousel,
  PurchaseConfirmationModal,
  ShopItemGrid,
} from "@/components/shop";
import { EmptyState, LoadingState } from "@/components/ui";
import { usePointsShop } from "@/hooks";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { ShopItemWithStatus } from "@/types/models";
import type { ExtendedCosmeticSlot } from "@/types/profile";
import type { PointsShopItem, ShopStackParamList } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

type NavigationProp = NativeStackNavigationProp<
  ShopStackParamList,
  "PointsShop"
>;

/**
 * Tab configuration for the points shop
 */
interface ShopTab {
  id: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  categories: CategoryConfig[];
}

/**
 * Category within a tab
 */
interface CategoryConfig {
  key: string;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  slots: ExtendedCosmeticSlot[];
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS: ShopTab[] = [
  {
    id: "avatar",
    label: "Avatar",
    icon: "account-circle",
    categories: [
      { key: "hats", label: "Hats", icon: "hat-fedora", slots: ["hat"] },
      { key: "glasses", label: "Glasses", icon: "glasses", slots: ["glasses"] },
      {
        key: "backgrounds",
        label: "Backgrounds",
        icon: "image",
        slots: ["background"],
      },
      {
        key: "clothing",
        label: "Clothing",
        icon: "tshirt-crew",
        slots: ["clothing_top", "clothing_bottom"],
      },
      {
        key: "accessories",
        label: "Accessories",
        icon: "diamond-stone",
        slots: ["accessory_neck", "accessory_ear", "accessory_hand"],
      },
    ],
  },
  {
    id: "profile",
    label: "Profile",
    icon: "card-account-details",
    categories: [
      {
        key: "frames",
        label: "Frames",
        icon: "card-bulleted-outline",
        slots: ["profile_frame"],
      },
      {
        key: "banners",
        label: "Banners",
        icon: "flag-variant",
        slots: ["profile_banner"],
      },
      {
        key: "themes",
        label: "Themes",
        icon: "palette",
        slots: ["profile_theme"],
      },
    ],
  },
  {
    id: "chat",
    label: "Chat",
    icon: "message",
    categories: [
      {
        key: "bubbles",
        label: "Bubbles",
        icon: "message-text",
        slots: ["chat_bubble"],
      },
      {
        key: "effects",
        label: "Name Effects",
        icon: "text-shadow",
        slots: ["name_effect"],
      },
    ],
  },
  {
    id: "effects",
    label: "Effects",
    icon: "auto-fix",
    categories: [
      {
        key: "coming_soon",
        label: "Coming Soon",
        icon: "clock-outline",
        slots: [],
      },
    ],
  },
];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert a PointsShopItem to ShopItemWithStatus for the purchase modal
 */
function convertToShopItemWithStatus(
  item: PointsShopItem,
  tokenBalance: number,
): ShopItemWithStatus {
  const now = Date.now();
  const timeRemaining = item.availableTo ? item.availableTo - now : null;

  return {
    // Required ShopItem fields
    id: item.id,
    cosmeticId: item.itemId,
    name: item.name,
    description: item.description || "",
    category: "featured", // Default category for shop modal
    slot: item.slot as ShopItemWithStatus["slot"], // Map slot type
    priceTokens: item.priceTokens,
    priceUSD: undefined, // Points shop is tokens-only
    rarity: item.rarity as ShopItemWithStatus["rarity"], // Map rarity type
    imagePath: item.imagePath,
    featured: item.featured,
    availableFrom: item.availableFrom,
    availableTo: item.availableTo,
    limitedQuantity: item.stock ?? undefined,
    purchaseCount: 0,
    active: item.active ?? true,
    sortOrder: item.sortOrder,
    createdAt: Date.now(),
    // ShopItemWithStatus fields
    isAvailable:
      item.active !== false && (!item.availableTo || item.availableTo > now),
    timeRemaining: timeRemaining && timeRemaining > 0 ? timeRemaining : null,
    alreadyOwned: item.owned ?? false,
    // Optional bundle fields
    discountPercent: item.discountPercent,
    originalPriceTokens: item.originalPrice,
  };
}

// =============================================================================
// Component
// =============================================================================

export default function PointsShopScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;

  // Points shop hook
  const {
    catalog,
    featuredItems,
    wallet,
    balance,
    loading,
    catalogLoading,
    purchaseLoading,
    error,
    purchaseError,
    purchase,
    refresh,
    canAfford,
    filterByCategory,
    searchItems,
  } = usePointsShop(user?.uid);

  // Local state
  const [activeTab, setActiveTab] = useState(0);
  const [activeCategory, setActiveCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PointsShopItem | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Refs
  const scrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);

  // Current tab and category
  const currentTab = TABS[activeTab];
  const currentCategory = currentTab?.categories[activeCategory];

  // Filter items based on current selection and search
  const displayItems = useMemo(() => {
    if (searchQuery.trim()) {
      return searchItems(searchQuery);
    }

    if (!currentCategory || currentCategory.slots.length === 0) {
      return [];
    }

    // Get items for all slots in the current category
    const items: PointsShopItem[] = [];
    for (const slot of currentCategory.slots) {
      const slotItems = filterByCategory(slot);
      items.push(...slotItems);
    }

    return items.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [searchQuery, currentCategory, filterByCategory, searchItems]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle tab change
  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
    setActiveCategory(0);
    setSearchQuery("");
    setShowSearch(false);
  }, []);

  // Handle category change
  const handleCategoryChange = useCallback((index: number) => {
    setActiveCategory(index);
  }, []);

  // Handle search toggle
  const handleSearchToggle = useCallback(() => {
    setShowSearch((prev) => {
      if (!prev) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else {
        setSearchQuery("");
      }
      return !prev;
    });
  }, []);

  // Handle item press
  const handleItemPress = useCallback((item: PointsShopItem) => {
    setSelectedItem(item);
    setShowPurchaseModal(true);
  }, []);

  // Handle purchase - receives paymentMethod from modal
  const handlePurchase = useCallback(
    async (paymentMethod: "tokens" | "iap") => {
      if (!selectedItem) return;

      // Only tokens payment supported in points shop
      if (paymentMethod !== "tokens") return;

      const result = await purchase(selectedItem.id);

      if (result.success) {
        setShowPurchaseModal(false);
        setSelectedItem(null);
        // Show success toast or animation
      }
    },
    [selectedItem, purchase],
  );

  // Handle purchase modal close
  const handleClosePurchaseModal = useCallback(() => {
    setShowPurchaseModal(false);
    setSelectedItem(null);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Render header
  const renderHeader = () => (
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
      {/* Back button */}
      <Pressable
        onPress={handleBack}
        style={styles.headerButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color={colors.headerText}
        />
      </Pressable>

      {/* Title or Search Input */}
      {showSearch ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.searchContainer}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search items..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          )}
        </Animated.View>
      ) : (
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>
          Points Shop
        </Text>
      )}

      {/* Search button */}
      <Pressable
        onPress={handleSearchToggle}
        style={styles.headerButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name={showSearch ? "close" : "magnify"}
          size={24}
          color={colors.headerText}
        />
      </Pressable>

      {/* Token balance */}
      <View style={styles.balanceContainer}>
        <MaterialCommunityIcons name="star-circle" size={20} color="#FFD700" />
        <Text style={[styles.balanceText, { color: colors.headerText }]}>
          {balance.toLocaleString()}
        </Text>
      </View>
    </Animated.View>
  );

  // Render tabs
  const renderTabs = () => (
    <Animated.View
      entering={FadeInUp.delay(100).duration(300)}
      style={[styles.tabsContainer, { backgroundColor: colors.surface }]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab, index) => {
          const isActive = index === activeTab;
          return (
            <Pressable
              key={tab.id}
              onPress={() => handleTabChange(index)}
              style={[
                styles.tab,
                isActive && styles.tabActive,
                isActive && { backgroundColor: colors.primary + "20" },
              ]}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={20}
                color={isActive ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.primary : colors.textSecondary },
                  isActive && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  // Render category pills
  const renderCategories = () => {
    if (!currentTab || currentTab.categories.length === 0) return null;

    return (
      <Animated.View
        entering={FadeInUp.delay(200).duration(300)}
        style={[
          styles.categoriesContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {currentTab.categories.map((category, index) => {
            const isActive = index === activeCategory;
            return (
              <Pressable
                key={category.key}
                onPress={() => handleCategoryChange(index)}
                style={[
                  styles.categoryPill,
                  { borderColor: colors.border },
                  isActive && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={category.icon}
                  size={16}
                  color={isActive ? "#FFFFFF" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    { color: isActive ? "#FFFFFF" : colors.textSecondary },
                  ]}
                >
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    );
  };

  // Render content
  const renderContent = () => {
    if (loading || catalogLoading) {
      return (
        <View style={styles.centerContainer}>
          <LoadingState message="Loading shop..." />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Failed to load shop"
            subtitle={error.message}
            actionLabel="Retry"
            onAction={refresh}
          />
        </View>
      );
    }

    // Effects tab - coming soon
    if (currentTab?.id === "effects") {
      return (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="auto-fix"
            title="Coming Soon"
            subtitle="Avatar animations and particle effects will be available in a future update!"
          />
        </View>
      );
    }

    if (displayItems.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="shopping-outline"
            title={searchQuery ? "No results found" : "No items available"}
            subtitle={
              searchQuery
                ? `No items match "${searchQuery}"`
                : "Check back later for new items!"
            }
          />
        </View>
      );
    }

    return (
      <ShopItemGrid
        items={displayItems}
        onItemPress={handleItemPress}
        balance={balance}
        numColumns={2}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderHeader()}
      {renderTabs()}
      {renderCategories()}

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={catalogLoading && !loading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Featured Section (only on Avatar tab, no search) */}
        {activeTab === 0 && !searchQuery && featuredItems.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              ✨ Featured Items
            </Text>
            <FeaturedCarousel
              items={featuredItems}
              onItemPress={handleItemPress}
              balance={balance}
            />
          </Animated.View>
        )}

        {/* Main Content */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          layout={Layout.springify()}
        >
          {searchQuery && (
            <Text style={[styles.searchResultsTitle, { color: colors.text }]}>
              Search Results ({displayItems.length})
            </Text>
          )}
          {renderContent()}
        </Animated.View>
      </ScrollView>

      {/* Purchase Modal */}
      <PurchaseConfirmationModal
        visible={showPurchaseModal}
        onDismiss={handleClosePurchaseModal}
        onConfirm={handlePurchase}
        type="item"
        item={
          selectedItem
            ? convertToShopItemWithStatus(selectedItem, balance)
            : undefined
        }
        tokenBalance={balance}
        purchasing={purchaseLoading}
        error={purchaseError?.message ?? null}
      />
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(128, 128, 128, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 36,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  balanceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  balanceText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128, 128, 128, 0.2)",
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tabActive: {
    // Background set dynamically
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  tabLabelActive: {
    fontWeight: "600",
  },
  categoriesContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128, 128, 128, 0.1)",
  },
  categoriesContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    minHeight: 300,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
});
