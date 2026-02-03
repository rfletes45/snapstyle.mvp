/**
 * PresetPicker Component
 *
 * Grid of avatar presets with category filtering, locked item support,
 * and randomize functionality.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import {
  AVATAR_PRESETS,
  PRESET_CATEGORIES,
  type AvatarPreset,
  type PresetCategory,
} from "@/data";
import { useAppTheme } from "@/store/ThemeContext";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { DigitalAvatar } from "../DigitalAvatar";

// =============================================================================
// TYPES
// =============================================================================

export interface PresetPickerProps {
  /** Currently selected preset ID (if any) */
  selectedPresetId?: string;
  /** Callback when preset is selected */
  onSelectPreset: (preset: AvatarPreset) => void;
  /** Callback when randomize is pressed */
  onRandomize?: () => void;
  /** Set of unlocked achievement preset IDs */
  unlockedPresetIds?: Set<string>;
  /** Callback when locked preset is tapped */
  onLockedPresetPress?: (preset: AvatarPreset) => void;
  /** Test ID */
  testID?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PADDING = 16;
const ITEM_GAP = 12;
const NUM_COLUMNS = 3;
const ITEM_WIDTH =
  (SCREEN_WIDTH - PADDING * 2 - ITEM_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// =============================================================================
// CATEGORY FILTER
// =============================================================================

interface CategoryFilterProps {
  selectedCategory: PresetCategory | "all";
  onSelectCategory: (category: PresetCategory | "all") => void;
  colors: {
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
}

const CategoryFilter = memo(function CategoryFilter({
  selectedCategory,
  onSelectCategory,
  colors,
}: CategoryFilterProps) {
  const scrollRef = useRef<ScrollView>(null);

  const allCategories: {
    id: PresetCategory | "all";
    label: string;
    icon: string;
  }[] = useMemo(
    () => [
      { id: "all", label: "All", icon: "✨" },
      ...PRESET_CATEGORIES.map(
        (c: { id: PresetCategory; label: string; icon: string }) => ({
          id: c.id,
          label: c.label,
          icon: c.icon,
        }),
      ),
    ],
    [],
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryFilterContent}
      style={styles.categoryFilterContainer}
    >
      {allCategories.map((category) => {
        const isSelected = selectedCategory === category.id;
        return (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              {
                backgroundColor: isSelected ? colors.primary : colors.surface,
              },
            ]}
            onPress={() => onSelectCategory(category.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.categoryChipIcon}>{category.icon}</Text>
            <Text
              style={[
                styles.categoryChipLabel,
                { color: isSelected ? "#FFFFFF" : colors.text },
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

// =============================================================================
// PRESET CARD
// =============================================================================

interface PresetCardProps {
  preset: AvatarPreset;
  isSelected: boolean;
  isLocked: boolean;
  onSelect: () => void;
  onLockedPress?: () => void;
  colors: {
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  index: number;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const PresetCard = memo(function PresetCard({
  preset,
  isSelected,
  isLocked,
  onSelect,
  onLockedPress,
  colors,
  index,
}: PresetCardProps) {
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (isLocked && onLockedPress) {
      onLockedPress();
      return;
    }

    scale.value = withSpring(0.95, { damping: 10 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });

    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }

    onSelect();
  }, [isLocked, onLockedPress, onSelect, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      entering={FadeInDown.delay(index * 50).duration(300)}
      style={[
        styles.presetCard,
        {
          backgroundColor: colors.surface,
          borderColor: isSelected ? colors.primary : colors.border,
          borderWidth: isSelected ? 2 : 1,
          opacity: isLocked ? 0.6 : 1,
        },
        animatedStyle,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Avatar Preview */}
      <View style={styles.presetAvatarContainer}>
        <DigitalAvatar
          config={preset.config}
          size={ITEM_WIDTH - 24}
          showBody={false}
        />
        {isLocked && (
          <View style={styles.lockedOverlay}>
            <Text style={styles.lockedIcon}>🔒</Text>
          </View>
        )}
      </View>

      {/* Preset Info */}
      <View style={styles.presetInfo}>
        <Text style={[styles.presetIcon, { fontSize: 14 }]}>{preset.icon}</Text>
        <Text
          style={[styles.presetName, { color: colors.text }]}
          numberOfLines={1}
        >
          {preset.name}
        </Text>
      </View>

      {/* Selection Indicator */}
      {isSelected && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.selectionBadge, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.selectionCheck}>✓</Text>
        </Animated.View>
      )}
    </AnimatedTouchable>
  );
});

// =============================================================================
// RANDOMIZE BUTTON
// =============================================================================

interface RandomizeButtonProps {
  onPress: () => void;
  colors: {
    primary: string;
    text: string;
  };
}

const RandomizeButton = memo(function RandomizeButton({
  onPress,
  colors,
}: RandomizeButtonProps) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 10 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
    rotation.value = withSpring(rotation.value + 360, {
      damping: 15,
      stiffness: 100,
    });

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    onPress();
  }, [onPress, scale, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.randomizeContainer}>
      <TouchableOpacity
        style={[styles.randomizeButton, { backgroundColor: colors.primary }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Animated.View style={animatedStyle}>
          <Text style={styles.randomizeIcon}>🎲</Text>
        </Animated.View>
        <Text style={styles.randomizeText}>Randomize</Text>
      </TouchableOpacity>
      <Text style={[styles.randomizeHint, { color: colors.text }]}>
        Feeling lucky? Generate a random avatar!
      </Text>
    </View>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function PresetPickerBase({
  selectedPresetId,
  onSelectPreset,
  onRandomize,
  unlockedPresetIds = new Set(),
  onLockedPresetPress,
  testID,
}: PresetPickerProps) {
  const { colors } = useAppTheme();
  const [selectedCategory, setSelectedCategory] = useState<
    PresetCategory | "all"
  >("all");

  // Filter presets by category
  const filteredPresets: AvatarPreset[] = useMemo(() => {
    if (selectedCategory === "all") {
      return AVATAR_PRESETS;
    }
    return AVATAR_PRESETS.filter(
      (preset: AvatarPreset) => preset.category === selectedCategory,
    );
  }, [selectedCategory]);

  // Check if preset is locked
  const isPresetLocked = useCallback(
    (preset: AvatarPreset): boolean => {
      if (!preset.locked) return false;
      return !unlockedPresetIds.has(preset.id);
    },
    [unlockedPresetIds],
  );

  const themeColors = {
    primary: colors.primary,
    surface: colors.surface,
    text: colors.text,
    textSecondary: colors.textSecondary,
    border: colors.border,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      {/* Randomize Button */}
      {onRandomize && (
        <RandomizeButton
          onPress={onRandomize}
          colors={{ primary: colors.primary, text: colors.textSecondary }}
        />
      )}

      {/* Category Filter */}
      <CategoryFilter
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        colors={themeColors}
      />

      {/* Presets Grid */}
      <View style={styles.presetsGrid}>
        {filteredPresets.map((preset: AvatarPreset, index: number) => {
          const isLocked = isPresetLocked(preset);
          return (
            <PresetCard
              key={preset.id}
              preset={preset}
              isSelected={selectedPresetId === preset.id}
              isLocked={isLocked}
              onSelect={() => onSelectPreset(preset)}
              onLockedPress={
                onLockedPresetPress
                  ? () => onLockedPresetPress(preset)
                  : undefined
              }
              colors={themeColors}
              index={index}
            />
          );
        })}
      </View>

      {/* Empty State */}
      {filteredPresets.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateIcon]}>🎭</Text>
          <Text
            style={[styles.emptyStateText, { color: colors.textSecondary }]}
          >
            No presets in this category
          </Text>
        </View>
      )}

      {/* Achievement Presets Info */}
      {selectedCategory === "achievement" && (
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            🏆 Achievement Presets
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            These exclusive presets are unlocked by completing achievements,
            maintaining streaks, and reaching milestones. Keep playing to unlock
            them all!
          </Text>
        </View>
      )}

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export const PresetPicker = memo(PresetPickerBase);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  randomizeContainer: {
    alignItems: "center",
    paddingHorizontal: PADDING,
    paddingVertical: 16,
  },
  randomizeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  randomizeIcon: {
    fontSize: 20,
  },
  randomizeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  randomizeHint: {
    fontSize: 12,
    marginTop: 8,
  },
  categoryFilterContainer: {
    maxHeight: 44,
    marginBottom: 16,
  },
  categoryFilterContent: {
    paddingHorizontal: PADDING,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  categoryChipIcon: {
    fontSize: 14,
  },
  categoryChipLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: PADDING,
    gap: ITEM_GAP,
  },
  presetCard: {
    width: ITEM_WIDTH,
    borderRadius: 12,
    overflow: "hidden",
  },
  presetAvatarContainer: {
    width: "100%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedIcon: {
    fontSize: 24,
  },
  presetInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 4,
  },
  presetIcon: {
    fontSize: 12,
  },
  presetName: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
  },
  selectionBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCheck: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 14,
  },
  infoCard: {
    marginHorizontal: PADDING,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default PresetPicker;
