/**
 * PlaySearchBar
 *
 * Search bar component for the Play screen with filter chips.
 *
 * Phase 1: UI (search input, filter chips) ✅
 * Phase 2: Search logic integration ✅
 *
 * Features:
 * - Search input with icon and clear button
 * - Filter chips for quick filtering (All, Single Player, Multiplayer, Puzzle, Quick Play)
 * - Animated focus state with border opacity
 * - Modern, tight design (8px border radius)
 * - Haptic feedback on chip selection
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md - Phase 1 & 2
 */

import { useAppTheme } from "@/store/ThemeContext";
import {
  DEFAULT_FILTER_CHIPS,
  DEFAULT_SEARCH_FILTERS,
  FilterChipConfig,
  PlaySearchBarProps,
} from "@/types/playScreen";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { PLAY_SCREEN_TOKENS } from "../../../../constants/gamesTheme";

const {
  spacing,
  borderRadius,
  typography,
  iconSizes,
  colors: tokenColors,
  animation,
} = PLAY_SCREEN_TOKENS;

/**
 * Filter Chip Component
 */
interface FilterChipProps {
  chip: FilterChipConfig;
  isSelected: boolean;
  onPress: () => void;
}

function FilterChip({ chip, isSelected, onPress }: FilterChipProps) {
  const { colors, isDark } = useAppTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, animation.pressSpring);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animation.pressSpring);
  }, [scale]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.chip,
          {
            backgroundColor: isSelected
              ? colors.primary
              : isDark
                ? tokenColors.searchBgDark
                : tokenColors.searchBgLight,
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.chipText,
            {
              color: isSelected ? "#fff" : colors.text,
            },
          ]}
        >
          {chip.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * PlaySearchBar Component
 *
 * @example
 * <PlaySearchBar
 *   value={searchQuery}
 *   onChangeText={setSearchQuery}
 *   selectedChip="all"
 *   onChipSelect={handleChipSelect}
 *   showChips
 * />
 */
function PlaySearchBarComponent({
  value,
  onChangeText,
  onFocus,
  onBlur,
  filters,
  onFiltersChange,
  isFocused = false,
  selectedChip = "all",
  onChipSelect,
  showChips = true,
}: PlaySearchBarProps) {
  const { colors, isDark } = useAppTheme();
  const inputRef = useRef<TextInput>(null);

  // Animation values
  const borderOpacity = useSharedValue(0);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(${isDark ? "255,255,255" : "0,0,0"}, ${borderOpacity.value})`,
  }));

  const handleFocus = useCallback(() => {
    borderOpacity.value = withTiming(0.2, { duration: 150 });
    onFocus?.();
  }, [borderOpacity, onFocus]);

  const handleBlur = useCallback(() => {
    borderOpacity.value = withTiming(0, { duration: 150 });
    onBlur?.();
  }, [borderOpacity, onBlur]);

  const handleClear = useCallback(() => {
    onChangeText("");
    inputRef.current?.focus();
  }, [onChangeText]);

  const handleChipPress = useCallback(
    (chipId: string) => {
      onChipSelect?.(chipId);
      // Phase 2: Apply filters when chip is selected
      const chip = DEFAULT_FILTER_CHIPS.find((c) => c.id === chipId);
      if (chip && onFiltersChange) {
        // "All" chip resets to default filters
        // Other chips reset to defaults first, then apply their specific filter
        if (chipId === "all") {
          onFiltersChange(DEFAULT_SEARCH_FILTERS);
        } else {
          onFiltersChange({ ...DEFAULT_SEARCH_FILTERS, ...chip.filter });
        }
      }
    },
    [onChipSelect, onFiltersChange],
  );

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <Animated.View
        style={[
          styles.searchContainer,
          containerAnimatedStyle,
          {
            backgroundColor: isDark
              ? tokenColors.searchBgDark
              : tokenColors.searchBgLight,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="magnify"
          size={iconSizes.searchIcon}
          color={colors.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search games..."
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <Pressable onPress={handleClear} style={styles.clearButton}>
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
      </Animated.View>

      {/* Filter Chips */}
      {showChips && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
          style={styles.chipsScroll}
        >
          {DEFAULT_FILTER_CHIPS.map((chip) => (
            <FilterChip
              key={chip.id}
              chip={chip}
              isSelected={selectedChip === chip.id}
              onPress={() => handleChipPress(chip.id)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.horizontalPadding,
    gap: spacing.chipGap,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: spacing.searchBarHeight,
    borderRadius: borderRadius.cardLarge,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.searchInput.fontSize,
    fontWeight: typography.searchInput.fontWeight,
    lineHeight: typography.searchInput.lineHeight,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  chipsScroll: {
    marginTop: 4,
    marginHorizontal: -spacing.horizontalPadding,
  },
  chipsContainer: {
    flexDirection: "row",
    gap: spacing.chipGap,
    paddingHorizontal: spacing.horizontalPadding,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.chip,
    borderWidth: 1,
  },
  chipText: {
    fontSize: typography.chipText.fontSize,
    fontWeight: typography.chipText.fontWeight,
    lineHeight: typography.chipText.lineHeight,
  },
});

export const PlaySearchBar = memo(PlaySearchBarComponent);
export default PlaySearchBar;
