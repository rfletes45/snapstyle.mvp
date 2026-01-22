/**
 * ShopScreen
 * Phase 19: Shop + Limited-Time Drops
 *
 * Features:
 * - Featured items carousel with countdown timers
 * - Category-based item browsing (hats, glasses, backgrounds)
 * - Item purchase with tokens
 * - Real-time catalog updates
 * - Owned item indicators
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import {
  Text,
  Card,
  Button,
  Appbar,
  Chip,
  ActivityIndicator,
  Modal,
  Portal,
  IconButton,
  Badge,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";
import {
  getShopCatalogWithStatus,
  getFeaturedItemsWithStatus,
  purchaseWithTokens,
  formatTimeRemaining,
  getRarityColor,
  getRarityLabel,
} from "@/services/shop";
import { subscribeToWallet, formatTokenAmount } from "@/services/economy";
import { ShopItemWithStatus, ShopCategory, Wallet } from "@/types/models";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { Spacing, BorderRadius, AppColors } from "../../../constants/theme";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type CategoryFilter = "all" | "hat" | "glasses" | "background";

const CATEGORIES: { key: CategoryFilter; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "store" },
  { key: "hat", label: "Hats", icon: "hat-fedora" },
  { key: "glasses", label: "Glasses", icon: "glasses" },
  { key: "background", label: "Backgrounds", icon: "image" },
];

export default function ShopScreen({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  const user = currentFirebaseUser;
  const theme = useTheme();

  // State
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [catalogItems, setCatalogItems] = useState<ShopItemWithStatus[]>([]);
  const [featuredItems, setFeaturedItems] = useState<ShopItemWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedItem, setSelectedItem] = useState<ShopItemWithStatus | null>(
    null,
  );
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // Timer ref for countdown updates
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load shop data
  const loadShopData = useCallback(async () => {
    if (!user) return;

    try {
      const [catalog, featured] = await Promise.all([
        getShopCatalogWithStatus(user.uid),
        getFeaturedItemsWithStatus(user.uid),
      ]);

      setCatalogItems(catalog);
      setFeaturedItems(featured);
      setError(null);
    } catch (err) {
      console.error("[ShopScreen] Error loading shop data:", err);
      setError("Failed to load shop");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Subscribe to wallet
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToWallet(
      user.uid,
      (updatedWallet) => setWallet(updatedWallet),
      (err) => console.error("[ShopScreen] Wallet subscription error:", err),
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

  // Handle purchase
  const handlePurchase = async () => {
    if (!selectedItem || purchasing) return;

    setPurchasing(true);
    setPurchaseError(null);
    setPurchaseSuccess(false);

    try {
      const result = await purchaseWithTokens(selectedItem.id);

      if (result.success) {
        setPurchaseSuccess(true);
        // Reload shop data to reflect ownership
        loadShopData();
        // Close modal after a short delay
        setTimeout(() => {
          setSelectedItem(null);
          setPurchaseSuccess(false);
        }, 1500);
      } else {
        setPurchaseError(result.error || "Purchase failed");
      }
    } catch (err: any) {
      console.error("[ShopScreen] Purchase error:", err);
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
        onPress={() => setSelectedItem(item)}
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
              name="currency-usd"
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
        onPress={() => setSelectedItem(item)}
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
              name="currency-usd"
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

  // Render header with balance and featured items
  const renderHeader = () => (
    <View>
      {/* Balance Bar */}
      <View
        style={[
          styles.balanceBar,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <View style={styles.balanceInfo}>
          <MaterialCommunityIcons
            name="currency-usd"
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
          onPress={() => navigation.navigate("Wallet")}
          style={styles.walletButton}
        >
          View Wallet
        </Button>
      </View>

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

      {/* Category Tabs */}
      <View style={styles.categoryTabs}>
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
      </View>
    </View>
  );

  // Purchase confirmation modal
  const renderPurchaseModal = () => (
    <Portal>
      <Modal
        visible={selectedItem !== null}
        onDismiss={() => {
          setSelectedItem(null);
          setPurchaseError(null);
          setPurchaseSuccess(false);
        }}
        contentContainerStyle={[
          styles.modalContent,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        {selectedItem && (
          <View>
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { color: theme.colors.onSurface }]}
              >
                Confirm Purchase
              </Text>
              <IconButton
                icon="close"
                size={20}
                onPress={() => setSelectedItem(null)}
              />
            </View>

            {/* Item Preview */}
            <View style={styles.modalItem}>
              <View
                style={[
                  styles.modalItemImage,
                  {
                    backgroundColor: getRarityColor(selectedItem.rarity) + "30",
                  },
                ]}
              >
                <Text style={styles.modalItemEmoji}>
                  {selectedItem.imagePath &&
                  !selectedItem.imagePath.includes("/")
                    ? selectedItem.imagePath
                    : "✨"}
                </Text>
              </View>
              <View style={styles.modalItemInfo}>
                <Text
                  style={[
                    styles.modalItemName,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  {selectedItem.name}
                </Text>
                <View
                  style={[
                    styles.modalItemRarity,
                    { backgroundColor: getRarityColor(selectedItem.rarity) },
                  ]}
                >
                  <Text style={styles.modalRarityText}>
                    {getRarityLabel(selectedItem.rarity)}
                  </Text>
                </View>
                {selectedItem.description && (
                  <Text
                    style={[
                      styles.modalDescription,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {selectedItem.description}
                  </Text>
                )}
              </View>
            </View>

            {/* Price */}
            <View style={styles.modalPrice}>
              <Text
                style={[
                  styles.modalPriceLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Price:
              </Text>
              <View style={styles.modalPriceValue}>
                <MaterialCommunityIcons
                  name="currency-usd"
                  size={24}
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.modalPriceText,
                    { color: theme.colors.primary },
                  ]}
                >
                  {selectedItem.priceTokens}
                </Text>
              </View>
            </View>

            {/* Balance */}
            <View
              style={[
                styles.modalBalance,
                { borderBottomColor: theme.colors.outlineVariant },
              ]}
            >
              <Text
                style={[
                  styles.modalBalanceLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Your Balance:
              </Text>
              <Text
                style={[
                  styles.modalBalanceValue,
                  { color: theme.colors.onSurface },
                  wallet &&
                    wallet.tokensBalance < selectedItem.priceTokens &&
                    styles.insufficientBalance,
                ]}
              >
                {wallet ? formatTokenAmount(wallet.tokensBalance) : "0"} tokens
              </Text>
            </View>

            {/* Error Message */}
            {purchaseError && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color="#F44336"
                />
                <Text style={styles.errorText}>{purchaseError}</Text>
              </View>
            )}

            {/* Success Message */}
            {purchaseSuccess && (
              <View style={styles.successContainer}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color="#4CAF50"
                />
                <Text style={styles.successText}>Purchase successful!</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setSelectedItem(null)}
                style={styles.cancelButton}
                disabled={purchasing}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handlePurchase}
                style={styles.purchaseButton}
                loading={purchasing}
                disabled={
                  purchasing ||
                  purchaseSuccess ||
                  !wallet ||
                  wallet.tokensBalance < selectedItem.priceTokens
                }
              >
                {purchasing
                  ? "Processing..."
                  : wallet && wallet.tokensBalance < selectedItem.priceTokens
                    ? "Insufficient Tokens"
                    : "Purchase"}
              </Button>
            </View>
          </View>
        )}
      </Modal>
    </Portal>
  );

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

      <FlatList
        data={filteredItems}
        renderItem={renderShopItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        {...LIST_PERFORMANCE_PROPS}
        ListHeaderComponent={renderHeader}
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
  walletButton: {
    backgroundColor: "#222",
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
  categoryTabs: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  categoryTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  categoryTabActive: {
    backgroundColor: "#222",
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  categoryTabText: {
    fontSize: 12,
    color: "#666",
  },
  categoryTabTextActive: {
    color: AppColors.primary,
    fontWeight: "bold",
  },

  // Shop Item Card
  itemCard: {
    width: "48%",
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  itemCardOwned: {
    opacity: 0.6,
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
    fontSize: 36,
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
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 4,
    textAlign: "center",
  },
  itemRarity: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  itemRarityText: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  itemPrice: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemPriceText: {
    fontSize: 14,
    fontWeight: "bold",
    color: AppColors.primary,
  },
  ownedText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "bold",
  },

  // Modal
  modalContent: {
    backgroundColor: "#111",
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFF",
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  modalItemImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalItemEmoji: {
    fontSize: 40,
  },
  modalItemInfo: {
    flex: 1,
    marginLeft: 16,
  },
  modalItemName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 4,
  },
  modalItemRarity: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  modalRarityText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000",
    textTransform: "uppercase",
  },
  modalDescription: {
    fontSize: 12,
    color: "#888",
  },
  modalPrice: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
  modalPriceLabel: {
    fontSize: 14,
    color: "#888",
  },
  modalPriceValue: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalPriceText: {
    fontSize: 24,
    fontWeight: "bold",
    color: AppColors.primary,
  },
  modalBalance: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    marginBottom: 16,
  },
  modalBalanceLabel: {
    fontSize: 14,
    color: "#888",
  },
  modalBalanceValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },
  insufficientBalance: {
    color: "#F44336",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4433620",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#F44336",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF5020",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: "#4CAF50",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderColor: "#444",
  },
  purchaseButton: {
    flex: 2,
    backgroundColor: AppColors.primary,
  },
});
