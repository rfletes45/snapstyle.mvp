/**
 * FACE EFFECT PICKER
 *
 * Horizontal scrollable carousel for selecting AR face effects.
 * Organized by category with a "None" option to disable effects.
 *
 * Design mirrors the existing filter carousel style in CameraScreen.
 */

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import {
  getEffectsGroupedByCategory,
  getPopularEffects,
} from "@/services/camera/faceDetectionService";
import type { FaceEffect, FaceEffectConfig } from "@/types/camera";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

// ─── Types ───────────────────────────────────────────────────────────────────

type EffectCategory =
  | "popular"
  | "accessories"
  | "masks"
  | "expressions"
  | "overlays";

interface Props {
  /** Currently selected effect (null = none) */
  selectedEffect: FaceEffect | null;
  /** Called when an effect is selected (null = deselect) */
  onSelectEffect: (effect: FaceEffect | null) => void;
  /** Whether the picker is expanded (showing category tabs) */
  expanded?: boolean;
}

// ─── Category Config ─────────────────────────────────────────────────────────

interface CategoryInfo {
  id: EffectCategory;
  label: string;
  icon: string;
  iconFamily: "ionicons" | "material";
}

const CATEGORIES: CategoryInfo[] = [
  { id: "popular", label: "Popular", icon: "star", iconFamily: "ionicons" },
  {
    id: "accessories",
    label: "Accessories",
    icon: "glasses",
    iconFamily: "material",
  },
  { id: "masks", label: "Masks", icon: "drama-masks", iconFamily: "material" },
  {
    id: "expressions",
    label: "Expressions",
    icon: "emoticon-happy",
    iconFamily: "material",
  },
  { id: "overlays", label: "Overlays", icon: "layers", iconFamily: "material" },
];

// ─── Effect Icon Mapping ─────────────────────────────────────────────────────
// Maps effect IDs to representative icons until real thumbnails exist

const EFFECT_ICONS: Partial<
  Record<FaceEffect, { icon: string; color: string }>
> = {
  flower_crown: { icon: "🌸", color: "#FF88B0" },
  dog_filter: { icon: "🐶", color: "#C8915A" },
  cat_filter: { icon: "🐱", color: "#808080" },
  sunglasses: { icon: "😎", color: "#333" },
  glasses: { icon: "🤓", color: "#666" },
  crown: { icon: "👑", color: "#FFD700" },
  skull_mask: { icon: "💀", color: "#222" },
  golden_mask: { icon: "🎭", color: "#DAA520" },
  heart_eyes: { icon: "😍", color: "#FF3366" },
  devil_horns: { icon: "😈", color: "#CC0000" },
  tears: { icon: "😢", color: "#66B2FF" },
  nose_blush: { icon: "☺️", color: "#FF8899" },
  bunny_ears: { icon: "🐰", color: "#FFC0CB" },
  butterfly: { icon: "🦋", color: "#9966FF" },
  rainbow_mouth: { icon: "🌈", color: "#FF6600" },
  ice_crown: { icon: "❄️", color: "#88CCFF" },
};

// ─── Effect Item ──────────────────────────────────────────────────────────────

const EffectItem: React.FC<{
  effect: FaceEffectConfig;
  isSelected: boolean;
  onPress: () => void;
}> = React.memo(({ effect, isSelected, onPress }) => {
  const iconInfo = EFFECT_ICONS[effect.id];
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.effectItem,
          isSelected && styles.effectItemSelected,
          animStyle,
        ]}
      >
        <Text style={styles.effectEmoji}>{iconInfo?.icon || "✨"}</Text>
        <Text
          style={[styles.effectLabel, isSelected && styles.effectLabelSelected]}
          numberOfLines={1}
        >
          {effect.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

EffectItem.displayName = "EffectItem";

// ─── None Item (deselect) ─────────────────────────────────────────────────────

const NoneItem: React.FC<{
  isSelected: boolean;
  onPress: () => void;
}> = React.memo(({ isSelected, onPress }) => (
  <Pressable onPress={onPress}>
    <View style={[styles.effectItem, isSelected && styles.effectItemSelected]}>
      <View style={styles.noneCircle}>
        <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
      </View>
      <Text
        style={[styles.effectLabel, isSelected && styles.effectLabelSelected]}
      >
        None
      </Text>
    </View>
  </Pressable>
));

NoneItem.displayName = "NoneItem";

// ─── Category Tab ─────────────────────────────────────────────────────────────

const CategoryTab: React.FC<{
  category: CategoryInfo;
  isActive: boolean;
  onPress: () => void;
}> = React.memo(({ category, isActive, onPress }) => {
  const IconComponent =
    category.iconFamily === "ionicons" ? Ionicons : MaterialCommunityIcons;

  return (
    <Pressable onPress={onPress}>
      <View style={[styles.categoryTab, isActive && styles.categoryTabActive]}>
        <IconComponent
          name={category.icon as any}
          size={16}
          color={isActive ? "#fff" : "rgba(255,255,255,0.5)"}
        />
        <Text
          style={[
            styles.categoryTabLabel,
            isActive && styles.categoryTabLabelActive,
          ]}
        >
          {category.label}
        </Text>
      </View>
    </Pressable>
  );
});

CategoryTab.displayName = "CategoryTab";

// ─── Main Component ──────────────────────────────────────────────────────────

const FaceEffectPicker: React.FC<Props> = React.memo(
  ({ selectedEffect, onSelectEffect, expanded = true }) => {
    const [activeCategory, setActiveCategory] =
      useState<EffectCategory>("popular");

    const grouped = useMemo(() => getEffectsGroupedByCategory(), []);
    const popular = useMemo(() => getPopularEffects(), []);

    const currentEffects = useMemo(() => {
      if (activeCategory === "popular") return popular;
      return grouped[activeCategory] || [];
    }, [activeCategory, grouped, popular]);

    const handleSelectEffect = useCallback(
      (effectId: FaceEffect | null) => {
        onSelectEffect(effectId);
      },
      [onSelectEffect],
    );

    const renderEffect = useCallback(
      ({ item }: { item: FaceEffectConfig }) => (
        <EffectItem
          effect={item}
          isSelected={selectedEffect === item.id}
          onPress={() => handleSelectEffect(item.id)}
        />
      ),
      [selectedEffect, handleSelectEffect],
    );

    const keyExtractor = useCallback((item: FaceEffectConfig) => item.id, []);

    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={styles.container}
      >
        {/* Category tabs */}
        {expanded && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryBar}
            contentContainerStyle={styles.categoryBarContent}
          >
            {CATEGORIES.map((cat) => (
              <CategoryTab
                key={cat.id}
                category={cat}
                isActive={activeCategory === cat.id}
                onPress={() => setActiveCategory(cat.id)}
              />
            ))}
          </ScrollView>
        )}

        {/* Effects carousel */}
        <FlatList
          data={currentEffects}
          renderItem={renderEffect}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.effectsList}
          ListHeaderComponent={
            <NoneItem
              isSelected={selectedEffect === null}
              onPress={() => handleSelectEffect(null)}
            />
          }
        />
      </Animated.View>
    );
  },
);

FaceEffectPicker.displayName = "FaceEffectPicker";

export default FaceEffectPicker;

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
  },

  // Category bar
  categoryBar: {
    marginBottom: Spacing.sm,
  },
  categoryBarContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.1)",
    gap: Spacing.xs,
  },
  categoryTabActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  categoryTabLabel: {
    fontSize: FontSizes.xs,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
  },
  categoryTabLabelActive: {
    color: "#fff",
  },

  // Effects list
  effectsList: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },

  // Individual effect item
  effectItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 68,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  effectItemSelected: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  effectEmoji: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  effectLabel: {
    fontSize: FontSizes.xs - 1,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    fontWeight: "500",
  },
  effectLabelSelected: {
    color: "#fff",
  },

  // None item
  noneCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
});
