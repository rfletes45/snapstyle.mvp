/**
 * SkinTonePicker Component
 *
 * Grid of skin tone swatches for avatar customization.
 * Shows all available skin tones with selection state.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import { SKIN_TONES, getSkinTone } from "@/data/avatarAssets";
import { useAppTheme } from "@/store/ThemeContext";
import type { SkinToneData, SkinToneId } from "@/types/avatar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

// =============================================================================
// TYPES
// =============================================================================

export interface SkinTonePickerProps {
  /** Currently selected skin tone ID */
  selectedSkinTone: SkinToneId;
  /** Callback when skin tone is selected */
  onSelectSkinTone: (skinTone: SkinToneId) => void;
  /** Optional title */
  title?: string;
  /** Show tone names on press */
  showNames?: boolean;
  /** Test ID */
  testID?: string;
}

interface SkinToneSwatchProps {
  skinTone: SkinToneId;
  isSelected: boolean;
  onSelect: () => void;
  showName: boolean;
  primaryColor: string;
}

// =============================================================================
// SWATCH COMPONENT
// =============================================================================

const SkinToneSwatch = memo(function SkinToneSwatch({
  skinTone,
  isSelected,
  onSelect,
  showName,
  primaryColor,
}: SkinToneSwatchProps) {
  const toneData = getSkinTone(skinTone);
  const baseColor = toneData?.baseColor ?? "#D2691E";
  const name = toneData?.name ?? skinTone;

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

  return (
    <Pressable
      onPress={handlePress}
      style={styles.swatchContainer}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${name} skin tone`}
    >
      <Animated.View
        style={[
          styles.swatch,
          {
            backgroundColor: baseColor,
            borderColor: isSelected ? primaryColor : "transparent",
            borderWidth: isSelected ? 3 : 0,
          },
          animatedStyle,
        ]}
      >
        {isSelected && (
          <View style={styles.checkContainer}>
            <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
          </View>
        )}
      </Animated.View>
      {showName && (
        <Text style={styles.swatchName} numberOfLines={1}>
          {name}
        </Text>
      )}
    </Pressable>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function SkinTonePickerBase({
  selectedSkinTone,
  onSelectSkinTone,
  title = "Skin Tone",
  showNames = false,
  testID,
}: SkinTonePickerProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container} testID={testID}>
      {title && (
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      )}
      <View style={[styles.grid, { backgroundColor: colors.surface }]}>
        {SKIN_TONES.map((tone: SkinToneData) => (
          <SkinToneSwatch
            key={tone.id}
            skinTone={tone.id}
            isSelected={selectedSkinTone === tone.id}
            onSelect={() => onSelectSkinTone(tone.id)}
            showName={showNames}
            primaryColor={colors.primary}
          />
        ))}
      </View>
    </View>
  );
}

export const SkinTonePicker = memo(SkinTonePickerBase);

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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 4,
  },
  swatchContainer: {
    alignItems: "center",
    padding: 4,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  checkContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  swatchName: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "center",
    width: 44,
  },
});

export default SkinTonePicker;
