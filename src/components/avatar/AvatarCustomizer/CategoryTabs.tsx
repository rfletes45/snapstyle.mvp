/**
 * CategoryTabs Component
 *
 * Horizontal scrollable tab navigation for avatar customization categories.
 * Displays icons and labels for each customization category.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from "react-native-reanimated";

// =============================================================================
// TYPES
// =============================================================================

export type CustomizationCategory =
  | "presets"
  | "face"
  | "eyes"
  | "hair"
  | "body"
  | "clothing"
  | "accessories";

export interface CategoryTabsProps {
  /** Currently active category */
  activeCategory: CustomizationCategory;
  /** Callback when category is selected */
  onSelectCategory: (category: CustomizationCategory) => void;
  /** Optional test ID prefix */
  testID?: string;
}

interface CategoryConfig {
  id: CustomizationCategory;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORIES: CategoryConfig[] = [
  { id: "presets", label: "Presets", icon: "palette-swatch-variant" },
  { id: "face", label: "Face", icon: "face-man" },
  { id: "eyes", label: "Eyes", icon: "eye" },
  { id: "hair", label: "Hair", icon: "hair-dryer" },
  { id: "body", label: "Body", icon: "human" },
  { id: "clothing", label: "Clothing", icon: "tshirt-crew" },
  { id: "accessories", label: "Extras", icon: "hat-fedora" },
];

const TAB_WIDTH = 80;
const TAB_HEIGHT = 64;
const INDICATOR_HEIGHT = 3;

// =============================================================================
// ANIMATED TAB COMPONENT
// =============================================================================

interface TabItemProps {
  category: CategoryConfig;
  isActive: boolean;
  onPress: () => void;
  colors: {
    primary: string;
    textMuted: string;
    text: string;
  };
  testID?: string;
}

const TabItem = memo(function TabItem({
  category,
  isActive,
  onPress,
  colors,
  testID,
}: TabItemProps) {
  const activeValue = useDerivedValue(() => {
    return withSpring(isActive ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 0.9 + activeValue.value * 0.1 }],
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      activeValue.value,
      [0, 1],
      [colors.textMuted, colors.primary],
    );
    return { color };
  });

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: activeValue.value,
      transform: [{ scaleX: activeValue.value }],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${category.label} tab`}
    >
      <Animated.View style={animatedIconStyle}>
        <MaterialCommunityIcons
          name={category.icon}
          size={24}
          color={isActive ? colors.primary : colors.textMuted}
        />
      </Animated.View>
      <Animated.Text
        style={[styles.tabLabel, animatedTextStyle]}
        numberOfLines={1}
      >
        {category.label}
      </Animated.Text>
      <Animated.View
        style={[
          styles.activeIndicator,
          { backgroundColor: colors.primary },
          animatedIndicatorStyle,
        ]}
      />
    </Pressable>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function CategoryTabsBase({
  activeCategory,
  onSelectCategory,
  testID,
}: CategoryTabsProps) {
  const { colors } = useAppTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSelectCategory = useCallback(
    (category: CustomizationCategory) => {
      onSelectCategory(category);

      // Scroll to make selected tab visible
      const index = CATEGORIES.findIndex((c) => c.id === category);
      if (index >= 0 && scrollViewRef.current) {
        const scrollX = Math.max(0, (index - 2) * TAB_WIDTH);
        scrollViewRef.current.scrollTo({ x: scrollX, animated: true });
      }
    },
    [onSelectCategory],
  );

  const themeColors = {
    primary: colors.primary,
    textMuted: colors.textMuted,
    text: colors.text,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID={testID}
      >
        {CATEGORIES.map((category) => (
          <TabItem
            key={category.id}
            category={category}
            isActive={activeCategory === category.id}
            onPress={() => handleSelectCategory(category.id)}
            colors={themeColors}
            testID={testID ? `${testID}-${category.id}` : undefined}
          />
        ))}
      </ScrollView>
      <View style={[styles.bottomBorder, { backgroundColor: colors.border }]} />
    </View>
  );
}

export const CategoryTabs = memo(CategoryTabsBase);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  scrollContent: {
    flexDirection: "row",
    paddingHorizontal: 8,
  },
  tab: {
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    position: "relative",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
  activeIndicator: {
    position: "absolute",
    bottom: 0,
    left: 12,
    right: 12,
    height: INDICATOR_HEIGHT,
    borderTopLeftRadius: INDICATOR_HEIGHT,
    borderTopRightRadius: INDICATOR_HEIGHT,
  },
  bottomBorder: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});

export default CategoryTabs;
