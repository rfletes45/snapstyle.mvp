/**
 * ColorPicker Component
 *
 * Generic color picker component for avatar customization.
 * Supports predefined color palettes with optional category tabs.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

// =============================================================================
// TYPES
// =============================================================================

export interface ColorOption {
  id: string;
  name: string;
  color: string;
  /** Optional category for grouping */
  category?: string;
}

export interface ColorPickerProps {
  /** Available color options */
  colors: ColorOption[];
  /** Currently selected color ID */
  selectedId: string;
  /** Callback when color is selected */
  onSelectColor: (colorId: string) => void;
  /** Optional title */
  title?: string;
  /** Show category tabs if colors have categories */
  showCategories?: boolean;
  /** Swatch size */
  swatchSize?: "small" | "medium" | "large";
  /** Show color names */
  showNames?: boolean;
  /** Horizontal scroll mode */
  horizontal?: boolean;
  /** Test ID */
  testID?: string;
}

interface ColorSwatchProps {
  color: ColorOption;
  isSelected: boolean;
  onSelect: () => void;
  size: number;
  showName: boolean;
  primaryColor: string;
}

// =============================================================================
// SIZE CONFIGURATIONS
// =============================================================================

const SWATCH_SIZES = {
  small: 32,
  medium: 44,
  large: 56,
} as const;

// =============================================================================
// SWATCH COMPONENT
// =============================================================================

const ColorSwatch = memo(function ColorSwatch({
  color,
  isSelected,
  onSelect,
  size,
  showName,
  primaryColor,
}: ColorSwatchProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(isSelected ? 1.1 : 1, {
            damping: 15,
            stiffness: 200,
          }),
        },
      ],
    };
  }, [isSelected]);

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    onSelect();
  }, [onSelect]);

  // Determine if color is light (for checkmark contrast)
  const isLightColor = isColorLight(color.color);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.swatchContainer}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${color.name} color`}
    >
      <Animated.View
        style={[
          styles.swatch,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color.color,
            borderColor: isSelected ? primaryColor : "rgba(0,0,0,0.1)",
            borderWidth: isSelected ? 3 : 1,
          },
          animatedStyle,
        ]}
      >
        {isSelected && (
          <View
            style={[
              styles.checkContainer,
              {
                backgroundColor: isLightColor
                  ? "rgba(0,0,0,0.3)"
                  : "rgba(255,255,255,0.3)",
              },
            ]}
          >
            <MaterialCommunityIcons
              name="check"
              size={size * 0.35}
              color={isLightColor ? "#000000" : "#FFFFFF"}
            />
          </View>
        )}
      </Animated.View>
      {showName && (
        <Text
          style={[styles.swatchName, { width: size + 8 }]}
          numberOfLines={1}
        >
          {color.name}
        </Text>
      )}
    </Pressable>
  );
});

// =============================================================================
// CATEGORY TABS
// =============================================================================

interface CategoryTabsProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  colors: {
    primary: string;
    text: string;
    textMuted: string;
    surface: string;
  };
}

const CategoryTabsInternal = memo(function CategoryTabsInternal({
  categories,
  selectedCategory,
  onSelectCategory,
  colors,
}: CategoryTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryTabs}
    >
      {categories.map((category) => {
        const isActive = selectedCategory === category;
        return (
          <Pressable
            key={category}
            onPress={() => onSelectCategory(category)}
            style={[
              styles.categoryTab,
              {
                backgroundColor: isActive ? colors.primary : colors.surface,
              },
            ]}
          >
            <Text
              style={[
                styles.categoryTabText,
                { color: isActive ? "#FFFFFF" : colors.text },
              ]}
            >
              {category}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function ColorPickerBase({
  colors: colorOptions,
  selectedId,
  onSelectColor,
  title,
  showCategories = true,
  swatchSize = "medium",
  showNames = false,
  horizontal = false,
  testID,
}: ColorPickerProps) {
  const { colors: themeColors } = useAppTheme();

  // Extract unique categories
  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    colorOptions.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return Array.from(cats);
  }, [colorOptions]);

  const hasCategories = categories.length > 1;

  // Selected category state
  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0] ?? "All",
  );

  // Filter colors by category
  const filteredColors = React.useMemo(() => {
    if (!hasCategories || !showCategories) {
      return colorOptions;
    }
    return colorOptions.filter((c) => c.category === selectedCategory);
  }, [colorOptions, selectedCategory, hasCategories, showCategories]);

  const size = SWATCH_SIZES[swatchSize];

  const themeColorsConfig = {
    primary: themeColors.primary,
    text: themeColors.text,
    textMuted: themeColors.textMuted,
    surface: themeColors.surface,
  };

  const renderColorGrid = () => (
    <View style={[styles.grid, horizontal && styles.gridHorizontal]}>
      {filteredColors.map((color) => (
        <ColorSwatch
          key={color.id}
          color={color}
          isSelected={selectedId === color.id}
          onSelect={() => onSelectColor(color.id)}
          size={size}
          showName={showNames}
          primaryColor={themeColors.primary}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container} testID={testID}>
      {title && (
        <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
      )}

      {hasCategories && showCategories && (
        <CategoryTabsInternal
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          colors={themeColorsConfig}
        />
      )}

      {horizontal ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScroll}
        >
          {renderColorGrid()}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.gridContainer,
            { backgroundColor: themeColors.surface },
          ]}
        >
          {renderColorGrid()}
        </View>
      )}
    </View>
  );
}

export const ColorPicker = memo(ColorPickerBase);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Determine if a hex color is light or dark
 */
function isColorLight(hexColor: string): boolean {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  categoryTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: "500",
  },
  gridContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridHorizontal: {
    flexWrap: "nowrap",
  },
  horizontalScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  swatchContainer: {
    alignItems: "center",
    padding: 4,
  },
  swatch: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  checkContainer: {
    width: "60%",
    height: "60%",
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  swatchName: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
  },
});

export default ColorPicker;
