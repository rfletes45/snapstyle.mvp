/**
 * Shop Item Grid Component
 *
 * Displays a grid of shop items using FlatList for optimal performance.
 * Supports:
 * - Variable column count
 * - Pull to refresh
 * - Load more pagination
 * - Empty state handling
 *
 * @see docs/SHOP_OVERHAUL_PLAN.md
 */

import React, { memo, useCallback } from "react";
import {
  Dimensions,
  FlatList,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeInUp, Layout } from "react-native-reanimated";

import { ShopItemCard } from "@/components/shop/ShopItemCard";
import { useAppTheme } from "@/store/ThemeContext";
import type { PointsShopItem } from "@/types/shop";

// =============================================================================
// Types
// =============================================================================

interface ShopItemGridProps {
  /** Array of items to display */
  items: PointsShopItem[];
  /** User's current token balance */
  balance: number;
  /** Called when an item is pressed */
  onItemPress?: (item: PointsShopItem) => void;
  /** Number of columns in the grid */
  numColumns?: number;
  /** Header component to render above the grid */
  ListHeaderComponent?: React.ComponentType | React.ReactElement;
  /** Footer component to render below the grid */
  ListFooterComponent?: React.ComponentType | React.ReactElement;
  /** Empty state component */
  ListEmptyComponent?: React.ComponentType | React.ReactElement;
  /** Whether currently refreshing */
  refreshing?: boolean;
  /** Called when pull to refresh is triggered */
  onRefresh?: () => void;
  /** Called when end of list is reached */
  onEndReached?: () => void;
  /** End reached threshold (0-1) */
  onEndReachedThreshold?: number;
  /** Whether to show loading indicator at bottom */
  loading?: boolean;
  /** Compact card layout */
  compact?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_PADDING = 8;

/**
 * Calculate item width based on number of columns
 */
function getItemWidth(numColumns: number): number {
  const totalPadding = GRID_PADDING * 2;
  const totalGaps = (numColumns - 1) * 12; // 12px gap between items
  return (SCREEN_WIDTH - totalPadding - totalGaps) / numColumns;
}

// =============================================================================
// Component
// =============================================================================

function ShopItemGridComponent({
  items,
  balance,
  onItemPress,
  numColumns = 2,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  refreshing = false,
  onRefresh,
  onEndReached,
  onEndReachedThreshold = 0.5,
  loading = false,
  compact = false,
}: ShopItemGridProps) {
  const { colors } = useAppTheme();

  const itemWidth = getItemWidth(numColumns);

  // Render individual item
  const renderItem: ListRenderItem<PointsShopItem> = useCallback(
    ({ item, index }) => (
      <Animated.View
        entering={FadeInUp.delay(index * 50).duration(300)}
        layout={Layout.springify()}
      >
        <ShopItemCard
          item={item}
          balance={balance}
          onPress={onItemPress}
          size={numColumns >= 3 ? "small" : "medium"}
          compact={compact}
        />
      </Animated.View>
    ),
    [balance, onItemPress, numColumns, compact],
  );

  // Key extractor
  const keyExtractor = useCallback((item: PointsShopItem) => item.id, []);

  // Get item layout for optimization (optional)
  const getItemLayout = useCallback(
    (data: ArrayLike<PointsShopItem> | null | undefined, index: number) => {
      const itemHeight = numColumns >= 3 ? 180 : 220;
      return {
        length: itemHeight,
        offset: itemHeight * Math.floor(index / numColumns),
        index,
      };
    },
    [numColumns],
  );

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      key={`grid-${numColumns}`} // Force re-render when columns change
      contentContainerStyle={styles.contentContainer}
      columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={
        loading ? (
          <View style={styles.loadingFooter}>
            {/* Loading indicator would go here */}
          </View>
        ) : (
          ListFooterComponent
        )
      }
      ListEmptyComponent={ListEmptyComponent}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={5}
      initialNumToRender={8}
    />
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  contentContainer: {
    padding: GRID_PADDING,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: "flex-start",
  },
  loadingFooter: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
});

// =============================================================================
// Export
// =============================================================================

export const ShopItemGrid = memo(ShopItemGridComponent);
