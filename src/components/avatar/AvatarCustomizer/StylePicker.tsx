/**
 * StylePicker Component
 *
 * Generic style grid component for selecting avatar features.
 * Supports categories, search, and locked item indicators.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import { useAppTheme } from "@/store/ThemeContext";
import type { DigitalAvatarConfig } from "@/types/avatar";
import { getDefaultAvatarConfig } from "@/utils/avatarHelpers";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { DigitalAvatar } from "../DigitalAvatar";

// =============================================================================
// TYPES
// =============================================================================

export interface StyleOption {
  id: string;
  name: string;
  /** Optional category for grouping */
  category?: string;
  /** Whether item is locked */
  locked?: boolean;
  /** Unlock requirement description */
  unlockRequirement?: string;
  /** Custom preview config override */
  previewConfig?: Partial<DigitalAvatarConfig>;
  /** Tags for search */
  tags?: string[];
}

export interface StylePickerProps<T extends string = string> {
  /** Available style options */
  options: StyleOption[];
  /** Currently selected style ID */
  selectedId: T;
  /** Callback when style is selected */
  onSelectStyle: (styleId: T) => void;
  /** Callback when locked item is pressed */
  onLockedItemPress?: (itemId: string) => void;
  /** Optional title */
  title?: string;
  /** Enable category filtering */
  showCategories?: boolean;
  /** Enable search */
  showSearch?: boolean;
  /** Base avatar config for previews */
  baseConfig?: DigitalAvatarConfig;
  /** Config key to override for preview (e.g., "hair.style") */
  previewKey?: string;
  /** Render custom preview instead of avatar */
  renderPreview?: (option: StyleOption, isSelected: boolean) => React.ReactNode;
  /** Grid columns */
  columns?: number;
  /** Item size */
  itemSize?: "small" | "medium" | "large";
  /** Show item names */
  showNames?: boolean;
  /** Test ID */
  testID?: string;
}

interface StyleItemProps {
  option: StyleOption;
  isSelected: boolean;
  onSelect: () => void;
  size: number;
  showName: boolean;
  baseConfig: DigitalAvatarConfig;
  previewKey?: string;
  renderPreview?: (option: StyleOption, isSelected: boolean) => React.ReactNode;
  colors: {
    primary: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
  };
}

// =============================================================================
// SIZE CONFIGURATIONS
// =============================================================================

const ITEM_SIZES = {
  small: 60,
  medium: 80,
  large: 100,
} as const;

// =============================================================================
// STYLE ITEM COMPONENT
// =============================================================================

const StyleItem = memo(function StyleItem({
  option,
  isSelected,
  onSelect,
  size,
  showName,
  baseConfig,
  previewKey,
  renderPreview,
  colors,
}: StyleItemProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(isSelected ? 1.05 : 1, {
            damping: 15,
            stiffness: 200,
          }),
        },
      ],
    };
  }, [isSelected]);

  const handlePress = useCallback(() => {
    if (option.locked) {
      // TODO: Show unlock requirement
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    onSelect();
  }, [option.locked, onSelect]);

  // Generate preview config
  const previewConfig = useMemo(() => {
    if (option.previewConfig) {
      return { ...baseConfig, ...option.previewConfig };
    }
    if (!previewKey) return baseConfig;

    // Deep set the preview key
    const config = JSON.parse(JSON.stringify(baseConfig));
    const keys = previewKey.split(".");
    let current: Record<string, unknown> = config;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = option.id;
    return config;
  }, [baseConfig, previewKey, option]);

  const renderContent = () => {
    if (renderPreview) {
      return renderPreview(option, isSelected);
    }

    return (
      <DigitalAvatar config={previewConfig} size={size - 16} showBody={false} />
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.itemContainer, { width: size + 8 }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled: option.locked }}
      accessibilityLabel={`${option.name}${option.locked ? " (locked)" : ""}`}
    >
      <Animated.View
        style={[
          styles.itemContent,
          {
            width: size,
            height: size,
            backgroundColor: colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
          animatedStyle,
        ]}
      >
        {renderContent()}

        {/* Lock overlay */}
        {option.locked && (
          <View style={styles.lockOverlay}>
            <MaterialCommunityIcons name="lock" size={20} color="#FFFFFF" />
          </View>
        )}

        {/* Selected indicator */}
        {isSelected && !option.locked && (
          <View
            style={[styles.selectedBadge, { backgroundColor: colors.primary }]}
          >
            <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
          </View>
        )}
      </Animated.View>

      {showName && (
        <Text
          style={[styles.itemName, { color: colors.text }]}
          numberOfLines={1}
        >
          {option.name}
        </Text>
      )}
    </Pressable>
  );
});

// =============================================================================
// CATEGORY FILTER
// =============================================================================

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  colors: {
    primary: string;
    text: string;
    surface: string;
  };
}

const CategoryFilter = memo(function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  colors,
}: CategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryFilter}
    >
      <Pressable
        onPress={() => onSelectCategory(null)}
        style={[
          styles.categoryChip,
          {
            backgroundColor:
              selectedCategory === null ? colors.primary : colors.surface,
          },
        ]}
      >
        <Text
          style={[
            styles.categoryChipText,
            { color: selectedCategory === null ? "#FFFFFF" : colors.text },
          ]}
        >
          All
        </Text>
      </Pressable>
      {categories.map((category) => (
        <Pressable
          key={category}
          onPress={() => onSelectCategory(category)}
          style={[
            styles.categoryChip,
            {
              backgroundColor:
                selectedCategory === category ? colors.primary : colors.surface,
            },
          ]}
        >
          <Text
            style={[
              styles.categoryChipText,
              {
                color: selectedCategory === category ? "#FFFFFF" : colors.text,
              },
            ]}
          >
            {category}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function StylePickerBase<T extends string = string>({
  options,
  selectedId,
  onSelectStyle,
  title,
  showCategories = true,
  showSearch = false,
  baseConfig,
  previewKey,
  renderPreview,
  columns = 4,
  itemSize = "medium",
  showNames = true,
  testID,
}: StylePickerProps<T>) {
  const { colors } = useAppTheme();

  // Use default config if not provided
  const effectiveBaseConfig = baseConfig ?? getDefaultAvatarConfig();

  // Extract categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    options.forEach((o) => {
      if (o.category) cats.add(o.category);
    });
    return Array.from(cats);
  }, [options]);

  const hasCategories = categories.length > 1;

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter options
  const filteredOptions = useMemo(() => {
    let filtered = options;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((o) => o.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.name.toLowerCase().includes(query) ||
          o.tags?.some((t) => t.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [options, selectedCategory, searchQuery]);

  const size = ITEM_SIZES[itemSize];

  const themeColors = {
    primary: colors.primary,
    surface: colors.surface,
    text: colors.text,
    textMuted: colors.textMuted,
    border: colors.border,
  };

  return (
    <View style={styles.container} testID={testID}>
      {title && (
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      )}

      {/* Search */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchInput,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={colors.textMuted}
            />
            <TextInput
              style={[styles.searchTextInput, { color: colors.text }]}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Category Filter */}
      {hasCategories && showCategories && (
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          colors={themeColors}
        />
      )}

      {/* Grid */}
      <View style={styles.gridContainer}>
        <View style={[styles.grid, { marginHorizontal: 16 - 4 }]}>
          {filteredOptions.map((option) => (
            <StyleItem
              key={option.id}
              option={option}
              isSelected={selectedId === option.id}
              onSelect={() => onSelectStyle(option.id as T)}
              size={size}
              showName={showNames}
              baseConfig={effectiveBaseConfig}
              previewKey={previewKey}
              renderPreview={renderPreview}
              colors={themeColors}
            />
          ))}
        </View>

        {filteredOptions.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="magnify"
              size={48}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No matching styles found
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export const StylePicker = memo(StylePickerBase) as typeof StylePickerBase;

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
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  categoryFilter: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  gridContainer: {
    minHeight: 200,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
  },
  itemContainer: {
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  itemContent: {
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  itemName: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
});

export default StylePicker;
