/**
 * ClothingCustomizer Component
 *
 * Customization panel for clothing features:
 * - Tops (shirts, jackets, etc.)
 * - Bottoms (pants, skirts, etc.)
 * - Full outfits
 * - Color customization for each
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import {
  CLOTHING_BOTTOMS,
  CLOTHING_OUTFITS,
  CLOTHING_TOPS,
} from "@/data/avatarAssets";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  ClothingBottomId,
  ClothingOutfitId,
  ClothingTopId,
  DigitalAvatarConfig,
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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ColorPicker, type ColorOption } from "./ColorPicker";
import { StylePicker, type StyleOption } from "./StylePicker";

// =============================================================================
// TYPES
// =============================================================================

export interface ClothingCustomizerProps {
  /** Current avatar configuration */
  config: DigitalAvatarConfig;
  /** Update top settings */
  onUpdateTop: (top: ClothingTopId) => void;
  onUpdateTopColor: (color: string) => void;
  /** Update bottom settings */
  onUpdateBottom: (bottom: ClothingBottomId) => void;
  onUpdateBottomColor: (color: string) => void;
  /** Update outfit (sets both top and bottom) */
  onUpdateOutfit: (outfit: ClothingOutfitId) => void;
  /** Test ID */
  testID?: string;
}

type ClothingMode = "separates" | "outfit";

// =============================================================================
// MODE TOGGLE
// =============================================================================

interface ModeToggleProps {
  mode: ClothingMode;
  onModeChange: (mode: ClothingMode) => void;
  colors: {
    primary: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const ModeToggle = memo(function ModeToggle({
  mode,
  onModeChange,
  colors,
}: ModeToggleProps) {
  const indicatorPosition = useSharedValue(mode === "separates" ? 0 : 1);

  const handleModeChange = useCallback(
    (newMode: ClothingMode) => {
      indicatorPosition.value = withSpring(newMode === "separates" ? 0 : 1, {
        damping: 15,
        stiffness: 150,
      });
      onModeChange(newMode);
    },
    [indicatorPosition, onModeChange],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: indicatorPosition.value * 100, // Half width
      },
    ],
  }));

  return (
    <View
      style={[styles.modeToggleContainer, { backgroundColor: colors.surface }]}
    >
      <Animated.View
        style={[
          styles.modeIndicator,
          { backgroundColor: colors.primary },
          indicatorStyle,
        ]}
      />
      <TouchableOpacity
        style={styles.modeButton}
        onPress={() => handleModeChange("separates")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.modeButtonText,
            { color: mode === "separates" ? "#FFFFFF" : colors.textSecondary },
          ]}
        >
          Separates
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.modeButton}
        onPress={() => handleModeChange("outfit")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.modeButtonText,
            { color: mode === "outfit" ? "#FFFFFF" : colors.textSecondary },
          ]}
        >
          Outfits
        </Text>
      </TouchableOpacity>
    </View>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function ClothingCustomizerBase({
  config,
  onUpdateTop,
  onUpdateTopColor,
  onUpdateBottom,
  onUpdateBottomColor,
  onUpdateOutfit,
  testID,
}: ClothingCustomizerProps) {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<ClothingMode>("separates");

  // Convert data to style options
  const topOptions: StyleOption[] = useMemo(
    () =>
      CLOTHING_TOPS.map((top) => ({
        id: top.id,
        name: top.name,
        category: top.category,
      })),
    [],
  );

  const bottomOptions: StyleOption[] = useMemo(
    () =>
      CLOTHING_BOTTOMS.map((bottom) => ({
        id: bottom.id,
        name: bottom.name,
        category: bottom.category,
      })),
    [],
  );

  const outfitOptions: StyleOption[] = useMemo(
    () =>
      CLOTHING_OUTFITS.map((outfit) => ({
        id: outfit.id,
        name: outfit.name,
        category: outfit.category,
      })),
    [],
  );

  // Basic color palette for clothing customization
  const clothingColorOptions: ColorOption[] = useMemo(
    () => [
      { id: "black", name: "Black", color: "#1A1A1A", category: "neutral" },
      { id: "white", name: "White", color: "#FFFFFF", category: "neutral" },
      { id: "gray", name: "Gray", color: "#808080", category: "neutral" },
      { id: "navy", name: "Navy", color: "#1A237E", category: "blue" },
      { id: "blue", name: "Blue", color: "#2196F3", category: "blue" },
      { id: "red", name: "Red", color: "#F44336", category: "warm" },
      { id: "pink", name: "Pink", color: "#E91E63", category: "warm" },
      { id: "green", name: "Green", color: "#4CAF50", category: "cool" },
      { id: "teal", name: "Teal", color: "#009688", category: "cool" },
      { id: "purple", name: "Purple", color: "#9C27B0", category: "cool" },
      { id: "orange", name: "Orange", color: "#FF9800", category: "warm" },
      { id: "brown", name: "Brown", color: "#795548", category: "neutral" },
    ],
    [],
  );

  const themeColors = {
    primary: colors.primary,
    surface: colors.surface,
    text: colors.text,
    textSecondary: colors.textSecondary,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      testID={testID}
    >
      {/* Mode Toggle */}
      <View style={styles.modeToggleWrapper}>
        <ModeToggle mode={mode} onModeChange={setMode} colors={themeColors} />
      </View>

      {mode === "separates" ? (
        <>
          {/* Tops */}
          <StylePicker
            title="Tops"
            options={topOptions}
            selectedId={config.clothing.top || ""}
            onSelectStyle={onUpdateTop}
            baseConfig={config}
            previewKey="clothing.top"
            itemSize="medium"
            columns={3}
            showCategories={true}
          />

          {/* Top Color */}
          <ColorPicker
            title="Top Color"
            colors={clothingColorOptions}
            selectedId={config.clothing.topColor || "black"}
            onSelectColor={onUpdateTopColor as (id: string) => void}
            swatchSize="medium"
            showCategories={true}
          />

          {/* Bottoms */}
          <StylePicker
            title="Bottoms"
            options={bottomOptions}
            selectedId={config.clothing.bottom || ""}
            onSelectStyle={onUpdateBottom}
            baseConfig={config}
            previewKey="clothing.bottom"
            itemSize="medium"
            columns={3}
            showCategories={true}
          />

          {/* Bottom Color */}
          <ColorPicker
            title="Bottom Color"
            colors={clothingColorOptions}
            selectedId={config.clothing.bottomColor || "navy"}
            onSelectColor={onUpdateBottomColor as (id: string) => void}
            swatchSize="medium"
            showCategories={true}
          />
        </>
      ) : (
        <>
          {/* Full Outfits */}
          <StylePicker
            title="Outfits"
            options={outfitOptions}
            selectedId={config.clothing.outfit || ""}
            onSelectStyle={onUpdateOutfit}
            baseConfig={config}
            previewKey="clothing.outfit"
            itemSize="large"
            columns={2}
            showCategories={true}
          />

          {/* Outfit Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              👔 Complete Outfits
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Outfits are pre-styled combinations of tops and bottoms. Select an
              outfit to instantly update your entire look!
            </Text>
          </View>
        </>
      )}

      {/* Bottom spacing */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

export const ClothingCustomizer = memo(ClothingCustomizerBase);

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
  modeToggleWrapper: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modeToggleContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    position: "relative",
  },
  modeIndicator: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 100,
    height: "100%",
    borderRadius: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  modeButtonText: {
    fontSize: 14,
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

export default ClothingCustomizer;
