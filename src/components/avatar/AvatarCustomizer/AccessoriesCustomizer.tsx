/**
 * AccessoriesCustomizer Component
 *
 * Customization panel for accessory items:
 * - Headwear (hats, caps, headbands)
 * - Eyewear (glasses, sunglasses)
 * - Earwear (earrings, ear cuffs)
 * - Neckwear (necklaces, scarves)
 * - Wristwear (watches, bracelets)
 *
 * Supports equipped/unequipped states and locked items
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import {
  EARWEAR,
  EYEWEAR,
  HEADWEAR,
  NECKWEAR,
  WRISTWEAR,
} from "@/data/avatarAssets";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  DigitalAvatarConfig,
  EarwearId,
  EyewearId,
  HeadwearId,
  NeckwearId,
  WristwearId,
} from "@/types/avatar";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { StylePicker, type StyleOption } from "./StylePicker";

// =============================================================================
// TYPES
// =============================================================================

export interface AccessoriesCustomizerProps {
  /** Current avatar configuration */
  config: DigitalAvatarConfig;
  /** Update accessory settings */
  onUpdateHeadwear: (headwear: HeadwearId) => void;
  onUpdateEyewear: (eyewear: EyewearId) => void;
  onUpdateEarwear: (earwear: EarwearId) => void;
  onUpdateNeckwear: (neckwear: NeckwearId) => void;
  onUpdateWristwear: (wristwear: WristwearId) => void;
  /** Set of locked item IDs (require unlock) */
  lockedItems?: Set<string>;
  /** Callback when user taps locked item */
  onLockedItemPress?: (itemId: string) => void;
  /** Test ID */
  testID?: string;
}

type AccessoryCategory =
  | "headwear"
  | "eyewear"
  | "earwear"
  | "neckwear"
  | "wristwear";

interface CategoryInfo {
  id: AccessoryCategory;
  label: string;
  icon: string;
}

const CATEGORIES: CategoryInfo[] = [
  { id: "headwear", label: "Headwear", icon: "🧢" },
  { id: "eyewear", label: "Eyewear", icon: "👓" },
  { id: "earwear", label: "Earwear", icon: "💎" },
  { id: "neckwear", label: "Neckwear", icon: "📿" },
  { id: "wristwear", label: "Wristwear", icon: "⌚" },
];

// =============================================================================
// CATEGORY TABS
// =============================================================================

interface AccessoryCategoryTabsProps {
  selectedCategory: AccessoryCategory;
  onSelectCategory: (category: AccessoryCategory) => void;
  colors: {
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
}

const AccessoryCategoryTabs = memo(function AccessoryCategoryTabs({
  selectedCategory,
  onSelectCategory,
  colors,
}: AccessoryCategoryTabsProps) {
  const indicatorPosition = useSharedValue(
    CATEGORIES.findIndex((c) => c.id === selectedCategory),
  );

  const handleCategoryChange = useCallback(
    (category: AccessoryCategory) => {
      const index = CATEGORIES.findIndex((c) => c.id === category);
      indicatorPosition.value = withSpring(index, {
        damping: 15,
        stiffness: 150,
      });
      onSelectCategory(category);
    },
    [indicatorPosition, onSelectCategory],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value * 72 }],
  }));

  return (
    <View
      style={[
        styles.categoryTabsContainer,
        { backgroundColor: colors.surface },
      ]}
    >
      <Animated.View
        style={[
          styles.categoryIndicator,
          { backgroundColor: colors.primary },
          indicatorStyle,
        ]}
      />
      {CATEGORIES.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={styles.categoryTab}
          onPress={() => handleCategoryChange(category.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.categoryIcon}>{category.icon}</Text>
          <Text
            style={[
              styles.categoryLabel,
              {
                color:
                  selectedCategory === category.id
                    ? "#FFFFFF"
                    : colors.textSecondary,
              },
            ]}
            numberOfLines={1}
          >
            {category.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

// =============================================================================
// EQUIPPED BADGE
// =============================================================================

interface EquippedBadgeProps {
  itemName: string;
  onRemove: () => void;
  colors: {
    primary: string;
    surface: string;
    text: string;
  };
}

const EquippedBadge = memo(function EquippedBadge({
  itemName,
  onRemove,
  colors,
}: EquippedBadgeProps) {
  if (itemName === "None") return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.equippedBadge, { backgroundColor: colors.surface }]}
    >
      <Text style={[styles.equippedText, { color: colors.text }]}>
        Equipped: <Text style={{ fontWeight: "600" }}>{itemName}</Text>
      </Text>
      <TouchableOpacity
        style={[styles.removeButton, { backgroundColor: colors.primary }]}
        onPress={onRemove}
        activeOpacity={0.7}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function AccessoriesCustomizerBase({
  config,
  onUpdateHeadwear,
  onUpdateEyewear,
  onUpdateEarwear,
  onUpdateNeckwear,
  onUpdateWristwear,
  lockedItems = new Set(),
  onLockedItemPress,
  testID,
}: AccessoriesCustomizerProps) {
  const { colors } = useAppTheme();
  const [selectedCategory, setSelectedCategory] =
    useState<AccessoryCategory>("headwear");

  // Convert data to style options with locked state
  const headwearOptions: StyleOption[] = useMemo(
    () =>
      HEADWEAR.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        locked: lockedItems.has(item.id),
      })),
    [lockedItems],
  );

  const eyewearOptions: StyleOption[] = useMemo(
    () =>
      EYEWEAR.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        locked: lockedItems.has(item.id),
      })),
    [lockedItems],
  );

  const earwearOptions: StyleOption[] = useMemo(
    () =>
      EARWEAR.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        locked: lockedItems.has(item.id),
      })),
    [lockedItems],
  );

  const neckwearOptions: StyleOption[] = useMemo(
    () =>
      NECKWEAR.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        locked: lockedItems.has(item.id),
      })),
    [lockedItems],
  );

  const wristwearOptions: StyleOption[] = useMemo(
    () =>
      WRISTWEAR.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        locked: lockedItems.has(item.id),
      })),
    [lockedItems],
  );

  // Get current equipped item name for badge
  const getEquippedName = useCallback(
    (category: AccessoryCategory): string => {
      const accessoryId = config.accessories[category];
      if (!accessoryId || accessoryId === "none") return "None";

      const items: Record<AccessoryCategory, StyleOption[]> = {
        headwear: headwearOptions,
        eyewear: eyewearOptions,
        earwear: earwearOptions,
        neckwear: neckwearOptions,
        wristwear: wristwearOptions,
      };

      const item = items[category].find((i) => i.id === accessoryId);
      return item?.name || "None";
    },
    [
      config.accessories,
      headwearOptions,
      eyewearOptions,
      earwearOptions,
      neckwearOptions,
      wristwearOptions,
    ],
  );

  // Handle remove accessory
  const handleRemove = useCallback(
    (category: AccessoryCategory) => {
      const handlers: Record<AccessoryCategory, (id: string) => void> = {
        headwear: onUpdateHeadwear as (id: string) => void,
        eyewear: onUpdateEyewear as (id: string) => void,
        earwear: onUpdateEarwear as (id: string) => void,
        neckwear: onUpdateNeckwear as (id: string) => void,
        wristwear: onUpdateWristwear as (id: string) => void,
      };
      handlers[category]("none");
    },
    [
      onUpdateHeadwear,
      onUpdateEyewear,
      onUpdateEarwear,
      onUpdateNeckwear,
      onUpdateWristwear,
    ],
  );

  const themeColors = {
    primary: colors.primary,
    surface: colors.surface,
    text: colors.text,
    textSecondary: colors.textSecondary,
  };

  // Render content based on selected category
  const renderCategoryContent = () => {
    const categoryConfig: Record<
      AccessoryCategory,
      {
        options: StyleOption[];
        selectedId: string;
        onSelect: (id: string) => void;
        previewKey: string;
      }
    > = {
      headwear: {
        options: headwearOptions,
        selectedId: config.accessories.headwear || "",
        onSelect: onUpdateHeadwear as (id: string) => void,
        previewKey: "accessories.headwear",
      },
      eyewear: {
        options: eyewearOptions,
        selectedId: config.accessories.eyewear || "",
        onSelect: onUpdateEyewear as (id: string) => void,
        previewKey: "accessories.eyewear",
      },
      earwear: {
        options: earwearOptions,
        selectedId: config.accessories.earwear || "",
        onSelect: onUpdateEarwear as (id: string) => void,
        previewKey: "accessories.earwear",
      },
      neckwear: {
        options: neckwearOptions,
        selectedId: config.accessories.neckwear || "",
        onSelect: onUpdateNeckwear as (id: string) => void,
        previewKey: "accessories.neckwear",
      },
      wristwear: {
        options: wristwearOptions,
        selectedId: config.accessories.wristwear || "",
        onSelect: onUpdateWristwear as (id: string) => void,
        previewKey: "accessories.wristwear",
      },
    };

    const currentConfig = categoryConfig[selectedCategory];
    const equippedName = getEquippedName(selectedCategory);

    return (
      <Animated.View entering={FadeIn.duration(200)} key={selectedCategory}>
        <EquippedBadge
          itemName={equippedName}
          onRemove={() => handleRemove(selectedCategory)}
          colors={themeColors}
        />
        <StylePicker
          title={`Select ${CATEGORIES.find((c) => c.id === selectedCategory)?.label}`}
          options={currentConfig.options}
          selectedId={currentConfig.selectedId}
          onSelectStyle={currentConfig.onSelect}
          onLockedItemPress={onLockedItemPress}
          baseConfig={config}
          previewKey={currentConfig.previewKey}
          itemSize="medium"
          columns={3}
          showCategories={true}
        />
      </Animated.View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      {/* Category Tabs */}
      <View style={styles.tabsWrapper}>
        <AccessoryCategoryTabs
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          colors={themeColors}
        />
      </View>

      {/* Category Content */}
      {renderCategoryContent()}

      {/* Info Card */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>
          ✨ Unlock More Accessories
        </Text>
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Complete achievements, win games, and maintain streaks to unlock
          exclusive accessories for your avatar!
        </Text>
      </View>

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export const AccessoriesCustomizer = memo(AccessoriesCustomizerBase);

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
  tabsWrapper: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  categoryTabsContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    position: "relative",
  },
  categoryIndicator: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 68,
    height: "100%",
    borderRadius: 8,
  },
  categoryTab: {
    width: 68,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  categoryIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  categoryLabel: {
    fontSize: 9,
    fontWeight: "500",
  },
  equippedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
  },
  equippedText: {
    fontSize: 13,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  infoCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
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

export default AccessoriesCustomizer;
