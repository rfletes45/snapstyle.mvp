/**
 * Optimized List Components
 *
 * Phase 7 of Profile Screen Overhaul
 *
 * Performance-optimized list components using:
 * - FlatList for virtualization
 * - Proper item memoization
 * - Optimized re-renders
 * - Estimated item sizes
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 7
 */

import { BadgeSkeleton, Skeleton } from "@/components/ui";
import type { AchievementTier } from "@/types/achievements";
import type { CosmeticItem } from "@/types/models";
import type { Badge, UserBadge } from "@/types/profile";
import React, { memo, useCallback, useMemo } from "react";
import {
  FlatList,
  ListRenderItem,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface OptimizedBadgeListProps {
  /** User's earned badges */
  badges: Badge[];
  /** User badge data for progress */
  userBadges?: Map<string, UserBadge>;
  /** Number of columns */
  numColumns?: number;
  /** Item size */
  itemSize?: number;
  /** Whether list is loading */
  loading?: boolean;
  /** Loading skeleton count */
  skeletonCount?: number;
  /** Callback when badge is pressed */
  onBadgePress?: (badge: Badge) => void;
  /** Render custom badge item */
  renderBadge?: (badge: Badge, userBadge?: UserBadge) => React.ReactNode;
  /** Empty state */
  emptyMessage?: string;
  /** Header component */
  ListHeaderComponent?: React.ReactElement;
  /** Footer component */
  ListFooterComponent?: React.ReactElement;
}

export interface OptimizedInventoryListProps {
  /** Items to display */
  items: CosmeticItem[];
  /** Category filter */
  category?: string;
  /** Number of columns */
  numColumns?: number;
  /** Item size */
  itemSize?: number;
  /** Whether list is loading */
  loading?: boolean;
  /** Loading skeleton count */
  skeletonCount?: number;
  /** Callback when item is pressed */
  onItemPress?: (item: CosmeticItem) => void;
  /** Currently equipped item ID */
  equippedItemId?: string | null;
  /** Render custom item */
  renderItem?: (item: CosmeticItem, isEquipped: boolean) => React.ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Header component */
  ListHeaderComponent?: React.ReactElement;
  /** Footer component */
  ListFooterComponent?: React.ReactElement;
}

// =============================================================================
// Badge Item Component
// =============================================================================

interface BadgeItemProps {
  badge: Badge;
  userBadge?: UserBadge;
  size: number;
  onPress?: (badge: Badge) => void;
}

const BadgeItem = memo<BadgeItemProps>(function BadgeItem({
  badge,
  userBadge,
  size,
  onPress,
}) {
  const theme = useTheme();
  const isEarned = !!userBadge;

  const handlePress = useCallback(() => {
    onPress?.(badge);
  }, [badge, onPress]);

  const tierColor = useMemo(() => {
    const tier: AchievementTier = badge.tier;
    switch (tier) {
      case "diamond":
        return "#3B82F6";
      case "platinum":
        return "#A855F7";
      case "gold":
        return "#F59E0B";
      case "silver":
        return "#94A3B8";
      case "bronze":
        return "#CD7F32";
      default:
        return "#94A3B8";
    }
  }, [badge.tier]);

  return (
    <View
      style={[
        styles.badgeItem,
        {
          width: size,
          opacity: isEarned ? 1 : 0.4,
        },
      ]}
      onTouchEnd={handlePress}
    >
      <View
        style={[
          styles.badgeIcon,
          {
            width: size - 16,
            height: size - 16,
            borderColor: isEarned ? tierColor : theme.colors.outline,
          },
        ]}
      >
        <Text style={{ fontSize: (size - 16) * 0.5 }}>{badge.icon}</Text>
      </View>
      <Text
        style={[styles.badgeName, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {badge.name}
      </Text>
    </View>
  );
});

// =============================================================================
// Inventory Item Component
// =============================================================================

interface InventoryItemProps {
  item: CosmeticItem;
  size: number;
  isEquipped: boolean;
  onPress?: (item: CosmeticItem) => void;
}

const InventoryItem = memo<InventoryItemProps>(function InventoryItem({
  item,
  size,
  isEquipped,
  onPress,
}) {
  const theme = useTheme();

  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  const rarityColor = useMemo(() => {
    switch (item.rarity) {
      case "epic":
        return "#A855F7";
      case "rare":
        return "#3B82F6";
      default:
        return "#94A3B8";
    }
  }, [item.rarity]);

  return (
    <View
      style={[
        styles.inventoryItem,
        {
          width: size,
          borderColor: isEquipped ? theme.colors.primary : "transparent",
        },
      ]}
      onTouchEnd={handlePress}
    >
      {/* Preview based on item type */}
      <View
        style={[
          styles.itemPreview,
          {
            width: size - 24,
            height: size - 24,
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: rarityColor,
          },
        ]}
      >
        <Text style={{ fontSize: (size - 24) * 0.4 }}>🎨</Text>
      </View>

      <Text
        style={[styles.itemName, { color: theme.colors.onSurface }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>

      {isEquipped && (
        <View
          style={[
            styles.equippedBadge,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <Text style={styles.equippedText}>Equipped</Text>
        </View>
      )}
    </View>
  );
});

// =============================================================================
// Optimized Badge List
// =============================================================================

export const OptimizedBadgeList = memo<OptimizedBadgeListProps>(
  function OptimizedBadgeList({
    badges,
    userBadges,
    numColumns = 3,
    itemSize = 100,
    loading = false,
    skeletonCount = 6,
    onBadgePress,
    renderBadge,
    emptyMessage = "No badges yet",
    ListHeaderComponent,
    ListFooterComponent,
  }) {
    const { width } = useWindowDimensions();
    const theme = useTheme();

    // Calculate item size based on columns and screen width
    const calculatedItemSize = useMemo(() => {
      const availableWidth = width - 32 - (numColumns - 1) * 8;
      return Math.floor(availableWidth / numColumns);
    }, [width, numColumns]);

    const finalItemSize = itemSize || calculatedItemSize;

    // Render badge item
    const renderItem: ListRenderItem<Badge> = useCallback(
      ({ item }) => {
        const userBadge = userBadges?.get(item.id);

        if (renderBadge) {
          return <>{renderBadge(item, userBadge)}</>;
        }

        return (
          <BadgeItem
            badge={item}
            userBadge={userBadge}
            size={finalItemSize}
            onPress={onBadgePress}
          />
        );
      },
      [userBadges, finalItemSize, onBadgePress, renderBadge],
    );

    // Key extractor
    const keyExtractor = useCallback((item: Badge) => item.id, []);

    // Loading state
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          {ListHeaderComponent}
          <View style={styles.skeletonGrid}>
            {Array.from({ length: skeletonCount }).map((_, index) => (
              <BadgeSkeleton key={index} size={finalItemSize - 16} />
            ))}
          </View>
          {ListFooterComponent}
        </View>
      );
    }

    // Empty state
    if (badges.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          {ListHeaderComponent}
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            {emptyMessage}
          </Text>
          {ListFooterComponent}
        </View>
      );
    }

    return (
      <FlatList
        data={badges}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    );
  },
);

// =============================================================================
// Optimized Inventory List
// =============================================================================

export const OptimizedInventoryList = memo<OptimizedInventoryListProps>(
  function OptimizedInventoryList({
    items,
    category,
    numColumns = 3,
    itemSize,
    loading = false,
    skeletonCount = 9,
    onItemPress,
    equippedItemId,
    renderItem: customRenderItem,
    emptyMessage = "No items in inventory",
    ListHeaderComponent,
    ListFooterComponent,
  }) {
    const { width } = useWindowDimensions();
    const theme = useTheme();

    // Filter items by category if provided
    const filteredItems = useMemo(() => {
      if (!category) return items;
      return items.filter((item) => item.slot === category);
    }, [items, category]);

    // Calculate item size based on columns and screen width
    const calculatedItemSize = useMemo(() => {
      const availableWidth = width - 32 - (numColumns - 1) * 8;
      return Math.floor(availableWidth / numColumns);
    }, [width, numColumns]);

    const finalItemSize = itemSize || calculatedItemSize;

    // Render inventory item
    const renderItem: ListRenderItem<CosmeticItem> = useCallback(
      ({ item }) => {
        const isEquipped = item.id === equippedItemId;

        if (customRenderItem) {
          return <>{customRenderItem(item, isEquipped)}</>;
        }

        return (
          <InventoryItem
            item={item}
            size={finalItemSize}
            isEquipped={isEquipped}
            onPress={onItemPress}
          />
        );
      },
      [finalItemSize, equippedItemId, onItemPress, customRenderItem],
    );

    // Key extractor
    const keyExtractor = useCallback((item: CosmeticItem) => item.id, []);

    // Loading state
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          {ListHeaderComponent}
          <View style={styles.skeletonGrid}>
            {Array.from({ length: skeletonCount }).map((_, index) => (
              <View key={index} style={styles.inventorySkeletonItem}>
                <Skeleton
                  width={finalItemSize - 24}
                  height={finalItemSize - 24}
                  variant="rounded"
                  borderRadius={12}
                />
                <Skeleton
                  width={finalItemSize - 32}
                  height={14}
                  variant="text"
                  style={{ marginTop: 8 }}
                />
              </View>
            ))}
          </View>
          {ListFooterComponent}
        </View>
      );
    }

    // Empty state
    if (filteredItems.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          {ListHeaderComponent}
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            {emptyMessage}
          </Text>
          {ListFooterComponent}
        </View>
      );
    }

    return (
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    );
  },
);

// =============================================================================
// Horizontal Badge List (for showcases)
// =============================================================================

export const HorizontalBadgeList = memo<
  Omit<OptimizedBadgeListProps, "numColumns">
>(function HorizontalBadgeList({
  badges,
  userBadges,
  itemSize = 80,
  loading = false,
  skeletonCount = 5,
  onBadgePress,
  renderBadge,
  emptyMessage = "No badges",
  ListHeaderComponent,
  ListFooterComponent,
}) {
  const theme = useTheme();

  // Render badge item
  const renderItem: ListRenderItem<Badge> = useCallback(
    ({ item }) => {
      const userBadge = userBadges?.get(item.id);

      if (renderBadge) {
        return <>{renderBadge(item, userBadge)}</>;
      }

      return (
        <BadgeItem
          badge={item}
          userBadge={userBadge}
          size={itemSize}
          onPress={onBadgePress}
        />
      );
    },
    [userBadges, itemSize, onBadgePress, renderBadge],
  );

  // Key extractor
  const keyExtractor = useCallback((item: Badge) => item.id, []);

  // Loading state
  if (loading) {
    return (
      <View style={styles.horizontalSkeletonContainer}>
        {ListHeaderComponent}
        <View style={styles.horizontalSkeletonList}>
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <BadgeSkeleton key={index} size={itemSize - 16} />
          ))}
        </View>
        {ListFooterComponent}
      </View>
    );
  }

  // Empty state
  if (badges.length === 0) {
    return (
      <View style={styles.horizontalEmptyContainer}>
        {ListHeaderComponent}
        <Text
          style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
        >
          {emptyMessage}
        </Text>
        {ListFooterComponent}
      </View>
    );
  }

  return (
    <FlatList
      data={badges}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      horizontal
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={styles.horizontalListContainer}
      showsHorizontalScrollIndicator={false}
    />
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  horizontalListContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // Badge item
  badgeItem: {
    alignItems: "center",
    padding: 8,
  },
  badgeIcon: {
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  badgeName: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  progressContainer: {
    width: "80%",
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 2,
    marginTop: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  // Inventory item
  inventoryItem: {
    alignItems: "center",
    padding: 12,
    borderWidth: 2,
    borderRadius: 12,
    margin: 4,
  },
  itemPreview: {
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: {
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  equippedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  equippedText: {
    fontSize: 8,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  // Loading states
  skeletonContainer: {
    padding: 16,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inventorySkeletonItem: {
    alignItems: "center",
    padding: 12,
  },
  horizontalSkeletonContainer: {
    paddingVertical: 8,
  },
  horizontalSkeletonList: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 16,
  },
  // Empty states
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  horizontalEmptyContainer: {
    padding: 16,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});

export default OptimizedBadgeList;
