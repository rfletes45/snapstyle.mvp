/**
 * CategoryTabs Component
 *
 * Animated tab selector for filtering games by category.
 * Features:
 * - Quick Play, Puzzle, Multiplayer tabs
 * - Animated underline indicator
 * - Category-specific colors
 * - Badge counts for pending items
 *
 * @see constants/gamesTheme.ts for color tokens
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Badge, Text, useTheme } from "react-native-paper";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import {
  GAME_ANIMATIONS,
  GAME_BORDER_RADIUS,
  GAME_SPACING,
  getCategoryColor,
} from "../../../constants/gamesTheme";

// =============================================================================
// Types
// =============================================================================

export type GameCategoryTab = "quickPlay" | "puzzle" | "multiplayer" | "all";

export interface TabConfig {
  id: GameCategoryTab;
  label: string;
  icon: string;
  badgeCount?: number;
}

export interface CategoryTabsProps {
  /** Currently selected tab */
  selectedTab: GameCategoryTab;
  /** Called when tab is selected */
  onSelectTab: (tab: GameCategoryTab) => void;
  /** Tab configurations */
  tabs?: TabConfig[];
  /** Show "All" tab */
  showAllTab?: boolean;
  /** Style variant */
  variant?: "default" | "filled" | "minimal";
}

// =============================================================================
// Default Tab Configurations
// =============================================================================

const DEFAULT_TABS: TabConfig[] = [
  {
    id: "quickPlay",
    label: "Quick Play",
    icon: "lightning-bolt",
  },
  {
    id: "puzzle",
    label: "Puzzle",
    icon: "puzzle",
  },
  {
    id: "multiplayer",
    label: "Multiplayer",
    icon: "account-group",
  },
];

// =============================================================================
// Tab Item Component
// =============================================================================

interface TabItemProps {
  tab: TabConfig;
  isSelected: boolean;
  onSelect: () => void;
  onLayout: (event: LayoutChangeEvent, index: number) => void;
  index: number;
  variant: "default" | "filled" | "minimal";
}

function TabItem({
  tab,
  isSelected,
  onSelect,
  onLayout,
  index,
  variant,
}: TabItemProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  const accentColor =
    tab.id !== "all"
      ? getCategoryColor(tab.id, isDarkMode)
      : theme.colors.primary;

  // Animation for press
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, GAME_ANIMATIONS.spring.snappy);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, GAME_ANIMATIONS.spring.snappy);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout(event, index);
    },
    [onLayout, index],
  );

  if (variant === "filled") {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={onSelect}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLayout={handleLayout}
          style={[
            styles.filledTab,
            {
              backgroundColor: isSelected
                ? accentColor
                : theme.colors.surfaceVariant,
            },
          ]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={tab.icon as any}
            size={18}
            color={isSelected ? "#FFFFFF" : theme.colors.onSurfaceVariant}
          />
          <Text
            style={[
              styles.filledTabText,
              {
                color: isSelected ? "#FFFFFF" : theme.colors.onSurfaceVariant,
              },
            ]}
          >
            {tab.label}
          </Text>
          {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
            <Badge
              size={18}
              style={[
                styles.badge,
                {
                  backgroundColor: isSelected ? "#FFFFFF" : theme.colors.error,
                },
              ]}
            >
              {tab.badgeCount}
            </Badge>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (variant === "minimal") {
    return (
      <TouchableOpacity
        onPress={onSelect}
        onLayout={handleLayout}
        style={styles.minimalTab}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.minimalTabText,
            {
              color: isSelected ? accentColor : theme.colors.onSurfaceVariant,
              fontWeight: isSelected ? "700" : "500",
            },
          ]}
        >
          {tab.label}
        </Text>
        {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
          <Badge size={16} style={styles.minimalBadge}>
            {tab.badgeCount}
          </Badge>
        )}
      </TouchableOpacity>
    );
  }

  // Default variant
  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onSelect}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLayout={handleLayout}
        style={styles.defaultTab}
        activeOpacity={0.7}
      >
        <View style={styles.defaultTabContent}>
          <MaterialCommunityIcons
            name={tab.icon as any}
            size={20}
            color={isSelected ? accentColor : theme.colors.onSurfaceVariant}
          />
          <Text
            style={[
              styles.defaultTabText,
              {
                color: isSelected ? accentColor : theme.colors.onSurfaceVariant,
                fontWeight: isSelected ? "700" : "500",
              },
            ]}
          >
            {tab.label}
          </Text>
          {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
            <Badge
              size={18}
              style={[styles.badge, { backgroundColor: theme.colors.error }]}
            >
              {tab.badgeCount}
            </Badge>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CategoryTabs({
  selectedTab,
  onSelectTab,
  tabs = DEFAULT_TABS,
  showAllTab = false,
  variant = "default",
}: CategoryTabsProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";

  // Tab layout measurements
  const tabWidths = useSharedValue<number[]>([]);
  const tabPositions = useSharedValue<number[]>([]);
  const indicatorWidth = useSharedValue(0);
  const indicatorPosition = useSharedValue(0);

  // All tabs including "All" if enabled
  const allTabs: TabConfig[] = showAllTab
    ? [{ id: "all", label: "All", icon: "apps" }, ...tabs]
    : tabs;

  // Find selected tab index
  const selectedIndex = allTabs.findIndex((t) => t.id === selectedTab);

  // Handle tab layout
  const handleTabLayout = useCallback(
    (event: LayoutChangeEvent, index: number) => {
      const { width, x } = event.nativeEvent.layout;

      const newWidths = [...(tabWidths.value || [])];
      const newPositions = [...(tabPositions.value || [])];

      newWidths[index] = width;
      newPositions[index] = x;

      tabWidths.value = newWidths;
      tabPositions.value = newPositions;

      // Update indicator if this is the selected tab
      if (index === selectedIndex) {
        indicatorWidth.value = withSpring(width, GAME_ANIMATIONS.spring.snappy);
        indicatorPosition.value = withSpring(x, GAME_ANIMATIONS.spring.snappy);
      }
    },
    [selectedIndex, tabWidths, tabPositions, indicatorWidth, indicatorPosition],
  );

  // Update indicator when selection changes
  React.useEffect(() => {
    if (
      tabWidths.value[selectedIndex] !== undefined &&
      tabPositions.value[selectedIndex] !== undefined
    ) {
      indicatorWidth.value = withSpring(
        tabWidths.value[selectedIndex],
        GAME_ANIMATIONS.spring.snappy,
      );
      indicatorPosition.value = withSpring(
        tabPositions.value[selectedIndex],
        GAME_ANIMATIONS.spring.snappy,
      );
    }
  }, [
    selectedIndex,
    tabWidths,
    tabPositions,
    indicatorWidth,
    indicatorPosition,
  ]);

  // Animated indicator style
  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    transform: [{ translateX: indicatorPosition.value }],
  }));

  const selectedAccentColor =
    selectedTab !== "all"
      ? getCategoryColor(selectedTab, isDarkMode)
      : theme.colors.primary;

  if (variant === "filled") {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filledContainer}
      >
        {allTabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isSelected={tab.id === selectedTab}
            onSelect={() => onSelectTab(tab.id)}
            onLayout={handleTabLayout}
            index={index}
            variant="filled"
          />
        ))}
      </ScrollView>
    );
  }

  if (variant === "minimal") {
    return (
      <View style={styles.minimalContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.minimalScrollContent}
        >
          {allTabs.map((tab, index) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isSelected={tab.id === selectedTab}
              onSelect={() => onSelectTab(tab.id)}
              onLayout={handleTabLayout}
              index={index}
              variant="minimal"
            />
          ))}
        </ScrollView>
      </View>
    );
  }

  // Default variant with animated underline
  return (
    <View
      style={[
        styles.defaultContainer,
        { borderBottomColor: theme.colors.outlineVariant },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.defaultScrollContent}
      >
        {allTabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isSelected={tab.id === selectedTab}
            onSelect={() => onSelectTab(tab.id)}
            onLayout={handleTabLayout}
            index={index}
            variant="default"
          />
        ))}

        {/* Animated Indicator */}
        <Animated.View
          style={[
            styles.indicator,
            { backgroundColor: selectedAccentColor },
            indicatorStyle,
          ]}
        />
      </ScrollView>
    </View>
  );
}

// =============================================================================
// Simple Segmented Control Alternative
// =============================================================================

export interface SegmentedTabsProps {
  tabs: Array<{ id: string; label: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}

export function SegmentedTabs({
  tabs,
  selectedId,
  onSelect,
}: SegmentedTabsProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.segmentedContainer,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      {tabs.map((tab) => {
        const isSelected = tab.id === selectedId;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.segmentedTab,
              isSelected && {
                backgroundColor: theme.colors.surface,
              },
            ]}
            onPress={() => onSelect(tab.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentedTabText,
                {
                  color: isSelected
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant,
                  fontWeight: isSelected ? "600" : "500",
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Default variant
  defaultContainer: {
    borderBottomWidth: 1,
  },
  defaultScrollContent: {
    paddingHorizontal: GAME_SPACING.md,
    position: "relative",
  },
  defaultTab: {
    paddingHorizontal: GAME_SPACING.md,
    paddingVertical: GAME_SPACING.sm,
  },
  defaultTabContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.xs,
  },
  defaultTabText: {
    fontSize: 14,
  },
  indicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    borderRadius: 1.5,
  },

  // Filled variant
  filledContainer: {
    paddingHorizontal: GAME_SPACING.md,
    paddingVertical: GAME_SPACING.sm,
    gap: GAME_SPACING.sm,
  },
  filledTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.xs,
    paddingHorizontal: GAME_SPACING.md,
    paddingVertical: GAME_SPACING.sm,
    borderRadius: GAME_BORDER_RADIUS.round,
  },
  filledTabText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Minimal variant
  minimalContainer: {},
  minimalScrollContent: {
    paddingHorizontal: GAME_SPACING.md,
    gap: GAME_SPACING.lg,
  },
  minimalTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAME_SPACING.xs,
    paddingVertical: GAME_SPACING.sm,
  },
  minimalTabText: {
    fontSize: 14,
  },
  minimalBadge: {
    marginLeft: 2,
  },

  // Badges
  badge: {
    marginLeft: 4,
  },

  // Segmented control
  segmentedContainer: {
    flexDirection: "row",
    borderRadius: GAME_BORDER_RADIUS.md,
    padding: 4,
    marginHorizontal: GAME_SPACING.md,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: GAME_SPACING.sm,
    paddingHorizontal: GAME_SPACING.md,
    borderRadius: GAME_BORDER_RADIUS.sm,
    alignItems: "center",
  },
  segmentedTabText: {
    fontSize: 13,
  },
});

export default CategoryTabs;
