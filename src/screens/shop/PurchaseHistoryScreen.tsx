/**
 * Purchase History Screen
 *
 * Displays user's complete purchase history with filtering,
 * search, and statistics.
 *
 * Features:
 * - View all past purchases
 * - Filter by type, date, payment method
 * - Search by item name
 * - View purchase statistics
 * - Pull to refresh
 * - Infinite scroll pagination
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md Section 10.4
 */

import { useAppTheme } from "@/store/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { DocumentSnapshot } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  formatPurchaseDate,
  formatPurchasePrice,
  getPurchases,
  getPurchaseStats,
  getPurchaseTypeColor,
  getPurchaseTypeIcon,
  getPurchaseTypeName,
  getRarityColor,
  PurchaseFilter,
  PurchaseRecord,
  PurchaseStats,
  searchPurchases,
} from "@/services/purchaseHistory";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/shop/PurchaseHistoryScreen");
// =============================================================================
// Types
// =============================================================================

type FilterType =
  | "all"
  | "cosmetic"
  | "bundle"
  | "currency"
  | "premium"
  | "gift_sent"
  | "gift_received";

interface FilterOption {
  key: FilterType;
  label: string;
  icon: string;
}

// =============================================================================
// Constants
// =============================================================================

const FILTER_OPTIONS: FilterOption[] = [
  { key: "all", label: "All", icon: "apps-outline" },
  { key: "cosmetic", label: "Cosmetics", icon: "shirt-outline" },
  { key: "bundle", label: "Bundles", icon: "gift-outline" },
  { key: "currency", label: "Currency", icon: "logo-bitcoin" },
  { key: "premium", label: "Premium", icon: "diamond-outline" },
  { key: "gift_sent", label: "Gifts Sent", icon: "paper-plane-outline" },
  { key: "gift_received", label: "Gifts", icon: "gift-outline" },
];

const PAGE_SIZE = 20;

// =============================================================================
// Main Component
// =============================================================================

export default function PurchaseHistoryScreen({ navigation }: any) {
  // Theme
  const { colors } = useAppTheme();

  // State
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [stats, setStats] = useState<PurchaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [showStats, setShowStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const loadPurchases = useCallback(
    async (reset: boolean = false) => {
      try {
        if (reset) {
          setLoading(true);
          setLastDoc(null);
        }

        const filter: PurchaseFilter = {
          type: activeFilter === "all" ? undefined : activeFilter,
          includeRefunds: false,
        };

        const result = await getPurchases(
          filter,
          PAGE_SIZE,
          reset ? undefined : lastDoc || undefined,
        );

        if (reset) {
          setPurchases(result.purchases);
        } else {
          setPurchases((prev) => [...prev, ...result.purchases]);
        }

        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
        setError(null);
      } catch (err) {
        logger.error("Error loading purchases:", err);
        setError("Failed to load purchase history");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [activeFilter, lastDoc],
  );

  const loadStats = useCallback(async () => {
    try {
      const purchaseStats = await getPurchaseStats();
      setStats(purchaseStats);
    } catch (err) {
      logger.error("Error loading stats:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadPurchases(true);
    loadStats();
  }, []);

  // Reload when filter changes
  useEffect(() => {
    loadPurchases(true);
  }, [activeFilter]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPurchases(true);
    loadStats();
  }, [loadPurchases, loadStats]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      loadPurchases(false);
    }
  }, [loadingMore, hasMore, loading, loadPurchases]);

  // =============================================================================
  // Filtered Data
  // =============================================================================

  const filteredPurchases = useMemo(() => {
    let result = purchases;

    // Apply search filter
    if (searchQuery.trim()) {
      result = searchPurchases(result, searchQuery);
    }

    return result;
  }, [purchases, searchQuery]);

  // =============================================================================
  // Render Functions
  // =============================================================================

  const renderFilterChip = (option: FilterOption) => {
    const isActive = activeFilter === option.key;

    return (
      <TouchableOpacity
        key={option.key}
        style={[styles.filterChip, isActive && styles.filterChipActive]}
        onPress={() => setActiveFilter(option.key)}
      >
        <Ionicons
          name={option.icon as keyof typeof Ionicons.glyphMap}
          size={16}
          color={isActive ? "#fff" : colors.text}
        />
        <Text
          style={[
            styles.filterChipText,
            isActive && styles.filterChipTextActive,
          ]}
        >
          {option.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderPurchaseItem = ({ item }: { item: PurchaseRecord }) => {
    const typeColor = getPurchaseTypeColor(item.type);
    const rarityColor = getRarityColor(item.itemRarity);

    return (
      <TouchableOpacity
        style={styles.purchaseItem}
        onPress={() => {
          // Could navigate to purchase details
        }}
        activeOpacity={0.7}
      >
        {/* Item Image */}
        <View style={[styles.itemImageContainer, { borderColor: rarityColor }]}>
          {item.itemImagePath ? (
            <Image
              source={{ uri: item.itemImagePath }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons
              name={getPurchaseTypeIcon(item.type) as keyof typeof Ionicons.glyphMap}
              size={28}
              color={typeColor}
            />
          )}
        </View>

        {/* Item Details */}
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.itemName}
          </Text>
          <View style={styles.itemMeta}>
            <View
              style={[styles.typeBadge, { backgroundColor: typeColor + "20" }]}
            >
              <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                {getPurchaseTypeName(item.type)}
              </Text>
            </View>
            {item.discountPercent && item.discountPercent > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  -{item.discountPercent}%
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.itemDate}>
            {formatPurchaseDate(item.purchasedAt)}
          </Text>
        </View>

        {/* Price */}
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>{formatPurchasePrice(item)}</Text>
          {item.originalPrice &&
            item.originalPrice > (item.priceTokens || 0) && (
              <Text style={styles.originalPrice}>
                {item.originalPrice.toLocaleString()}
              </Text>
            )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No Purchases Yet</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? "No purchases match your search"
          : activeFilter !== "all"
            ? "No purchases in this category"
            : "Your purchase history will appear here"}
      </Text>
      {activeFilter === "all" && !searchQuery && (
        <TouchableOpacity
          style={styles.shopButton}
          onPress={() => navigation.navigate("Shop")}
        >
          <Text style={styles.shopButtonText}>Browse Shop</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <Modal
        visible={showStats}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStats(false)}
      >
        <SafeAreaView style={styles.statsModal}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Purchase Statistics</Text>
            <TouchableOpacity
              onPress={() => setShowStats(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.statsContent}>
            {/* Total Purchases */}
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="receipt" size={24} color={colors.primary} />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statLabel}>Total Purchases</Text>
                <Text style={styles.statValue}>{stats.totalPurchases}</Text>
              </View>
            </View>

            {/* Total Spent */}
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="wallet" size={24} color="#EAB308" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statLabel}>Total Spent (Tokens)</Text>
                <Text style={styles.statValue}>
                  {stats.totalSpentTokens.toLocaleString()}
                </Text>
              </View>
            </View>

            {stats.totalSpentUSD > 0 && (
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="card" size={24} color="#10B981" />
                </View>
                <View style={styles.statInfo}>
                  <Text style={styles.statLabel}>Total Spent (USD)</Text>
                  <Text style={styles.statValue}>
                    ${stats.totalSpentUSD.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Breakdown */}
            <Text style={styles.breakdownTitle}>Breakdown by Type</Text>

            <View style={styles.breakdownGrid}>
              <View style={styles.breakdownItem}>
                <Ionicons name="shirt-outline" size={20} color="#9333EA" />
                <Text style={styles.breakdownValue}>
                  {stats.cosmeticsPurchased}
                </Text>
                <Text style={styles.breakdownLabel}>Cosmetics</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Ionicons name="gift-outline" size={20} color="#F97316" />
                <Text style={styles.breakdownValue}>
                  {stats.bundlesPurchased}
                </Text>
                <Text style={styles.breakdownLabel}>Bundles</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Ionicons name="logo-bitcoin" size={20} color="#EAB308" />
                <Text style={styles.breakdownValue}>
                  {stats.currencyPurchased}
                </Text>
                <Text style={styles.breakdownLabel}>Currency</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Ionicons name="diamond-outline" size={20} color="#3B82F6" />
                <Text style={styles.breakdownValue}>
                  {stats.premiumPurchased}
                </Text>
                <Text style={styles.breakdownLabel}>Premium</Text>
              </View>
            </View>

            {/* Gifts */}
            {(stats.giftsSent > 0 || stats.giftsReceived > 0) && (
              <>
                <Text style={styles.breakdownTitle}>Gifts</Text>
                <View style={styles.breakdownGrid}>
                  <View style={styles.breakdownItem}>
                    <Ionicons
                      name="paper-plane-outline"
                      size={20}
                      color="#EC4899"
                    />
                    <Text style={styles.breakdownValue}>{stats.giftsSent}</Text>
                    <Text style={styles.breakdownLabel}>Sent</Text>
                  </View>
                  <View style={styles.breakdownItem}>
                    <Ionicons name="gift-outline" size={20} color="#10B981" />
                    <Text style={styles.breakdownValue}>
                      {stats.giftsReceived}
                    </Text>
                    <Text style={styles.breakdownLabel}>Received</Text>
                  </View>
                </View>
              </>
            )}

            {/* Average & First/Last */}
            {stats.averagePurchaseTokens > 0 && (
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="analytics" size={24} color={colors.primary} />
                </View>
                <View style={styles.statInfo}>
                  <Text style={styles.statLabel}>Avg. Purchase (Tokens)</Text>
                  <Text style={styles.statValue}>
                    {stats.averagePurchaseTokens.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            {stats.firstPurchaseDate && (
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <Ionicons
                    name="calendar"
                    size={24}
                    color={colors.textMuted}
                  />
                </View>
                <View style={styles.statInfo}>
                  <Text style={styles.statLabel}>First Purchase</Text>
                  <Text style={styles.statValue}>
                    {new Date(stats.firstPurchaseDate).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  // =============================================================================
  // Main Render
  // =============================================================================

  if (loading && purchases.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Purchase History</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading purchases...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Purchase History</Text>
        <TouchableOpacity
          style={styles.statsButton}
          onPress={() => setShowStats(true)}
        >
          <Ionicons name="stats-chart" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search purchases..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_OPTIONS.map(renderFilterChip)}
      </ScrollView>

      {/* Error State */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => loadPurchases(true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Purchase List */}
      <FlatList
        data={filteredPurchases}
        keyExtractor={(item) => item.id}
        renderItem={renderPurchaseItem}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={
          filteredPurchases.length === 0 ? styles.emptyList : styles.listContent
        }
      />

      {/* Stats Modal */}
      {renderStats()}
    </SafeAreaView>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

// =============================================================================
// Styles - Default colors (will be overridden by theme in components)
// =============================================================================

const DEFAULT_COLORS = {
  background: "#eff1f5",
  surface: "#ffffff",
  text: "#4c4f69",
  textSecondary: "#5c5f77",
  textMuted: "#9ca0b0",
  primary: "#8839ef",
  border: "#dce0e8",
  gray: "#9ca0b0",
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DEFAULT_COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DEFAULT_COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: DEFAULT_COLORS.text,
  },
  headerRight: {
    width: 40,
  },
  statsButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DEFAULT_COLORS.surface,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: DEFAULT_COLORS.text,
  },
  filterContainer: {
    marginTop: 12,
    maxHeight: 40,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: DEFAULT_COLORS.surface,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: DEFAULT_COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: DEFAULT_COLORS.text,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: "#DC2626",
    fontSize: 14,
  },
  retryText: {
    color: DEFAULT_COLORS.primary,
    fontWeight: "600",
  },
  listContent: {
    paddingVertical: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  purchaseItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: DEFAULT_COLORS.border,
  },
  itemImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: DEFAULT_COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: DEFAULT_COLORS.text,
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  discountBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  itemDate: {
    fontSize: 12,
    color: DEFAULT_COLORS.gray,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceText: {
    fontSize: 16,
    fontWeight: "700",
    color: DEFAULT_COLORS.text,
  },
  originalPrice: {
    fontSize: 12,
    color: DEFAULT_COLORS.gray,
    textDecorationLine: "line-through",
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: DEFAULT_COLORS.background,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: DEFAULT_COLORS.gray,
    textTransform: "uppercase",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: DEFAULT_COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: DEFAULT_COLORS.gray,
    textAlign: "center",
    marginTop: 8,
  },
  shopButton: {
    marginTop: 24,
    backgroundColor: DEFAULT_COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shopButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: DEFAULT_COLORS.gray,
  },
  // Stats Modal
  statsModal: {
    flex: 1,
    backgroundColor: DEFAULT_COLORS.background,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: DEFAULT_COLORS.border,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: DEFAULT_COLORS.text,
  },
  statsContent: {
    padding: 16,
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DEFAULT_COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DEFAULT_COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  statInfo: {
    marginLeft: 16,
  },
  statLabel: {
    fontSize: 14,
    color: DEFAULT_COLORS.gray,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: DEFAULT_COLORS.text,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: DEFAULT_COLORS.text,
    marginTop: 16,
    marginBottom: 12,
  },
  breakdownGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  breakdownItem: {
    width: "47%",
    backgroundColor: DEFAULT_COLORS.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  breakdownValue: {
    fontSize: 28,
    fontWeight: "700",
    color: DEFAULT_COLORS.text,
    marginTop: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    color: DEFAULT_COLORS.gray,
    marginTop: 4,
  },
});
