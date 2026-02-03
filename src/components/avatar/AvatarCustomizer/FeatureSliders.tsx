/**
 * FeatureSliders Component
 *
 * Reusable slider components for numeric avatar adjustments.
 * Includes single slider and grouped sliders with labels.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 6
 */

import { useAppTheme } from "@/store/ThemeContext";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

// =============================================================================
// TYPES
// =============================================================================

export interface FeatureSliderProps {
  /** Label for the slider */
  label: string;
  /** Current value */
  value: number;
  /** Minimum value */
  minimumValue?: number;
  /** Maximum value */
  maximumValue?: number;
  /** Step increment */
  step?: number;
  /** Callback when value changes */
  onValueChange: (value: number) => void;
  /** Label for minimum side (optional) */
  minLabel?: string;
  /** Label for maximum side (optional) */
  maxLabel?: string;
  /** Show numeric value display */
  showValue?: boolean;
  /** Value format function */
  formatValue?: (value: number) => string;
  /** Disabled state */
  disabled?: boolean;
  /** Test ID */
  testID?: string;
}

export interface SliderGroupProps {
  /** Group title */
  title: string;
  /** Sliders in this group */
  sliders: Omit<FeatureSliderProps, "onValueChange">[];
  /** Callback when any slider value changes */
  onValueChange: (key: string, value: number) => void;
  /** Test ID prefix */
  testID?: string;
}

// =============================================================================
// SINGLE SLIDER COMPONENT
// =============================================================================

function FeatureSliderBase({
  label,
  value,
  minimumValue = 0.8,
  maximumValue = 1.2,
  step = 0.05,
  onValueChange,
  minLabel,
  maxLabel,
  showValue = false,
  formatValue,
  disabled = false,
  testID,
}: FeatureSliderProps) {
  const { colors } = useAppTheme();

  const handleValueChange = useCallback(
    (newValue: number) => {
      // Round to step precision to avoid floating point issues
      const roundedValue = Math.round(newValue / step) * step;
      onValueChange(roundedValue);
    },
    [onValueChange, step],
  );

  const handleSlidingComplete = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
  }, []);

  // Format display value
  const displayValue = formatValue ? formatValue(value) : value.toFixed(2);

  return (
    <View
      style={[styles.sliderContainer, disabled && styles.disabled]}
      testID={testID}
    >
      {/* Label Row */}
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {showValue && (
          <Text style={[styles.valueDisplay, { color: colors.primary }]}>
            {displayValue}
          </Text>
        )}
      </View>

      {/* Slider Row */}
      <View style={styles.sliderRow}>
        {minLabel && (
          <Text style={[styles.endLabel, { color: colors.textMuted }]}>
            {minLabel}
          </Text>
        )}
        <Slider
          style={styles.slider}
          value={value}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          disabled={disabled}
        />
        {maxLabel && (
          <Text style={[styles.endLabel, { color: colors.textMuted }]}>
            {maxLabel}
          </Text>
        )}
      </View>
    </View>
  );
}

export const FeatureSlider = memo(FeatureSliderBase);

// =============================================================================
// SLIDER GROUP COMPONENT
// =============================================================================

function SliderGroupBase({
  title,
  sliders,
  onValueChange,
  testID,
}: SliderGroupProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.groupContainer} testID={testID}>
      <Text style={[styles.groupTitle, { color: colors.text }]}>{title}</Text>
      <View style={[styles.groupContent, { backgroundColor: colors.surface }]}>
        {sliders.map((slider, index) => (
          <React.Fragment key={slider.label}>
            <FeatureSlider
              {...slider}
              onValueChange={(value) => onValueChange(slider.label, value)}
              testID={testID ? `${testID}-${index}` : undefined}
            />
            {index < sliders.length - 1 && (
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export const SliderGroup = memo(SliderGroupBase);

// =============================================================================
// PRESET SLIDER CONFIGURATIONS
// =============================================================================

/**
 * Common slider configurations for avatar features
 */
export const SLIDER_PRESETS = {
  size: {
    minimumValue: 0.8,
    maximumValue: 1.2,
    step: 0.05,
    minLabel: "Smaller",
    maxLabel: "Larger",
    showValue: false,
  },
  width: {
    minimumValue: 0.8,
    maximumValue: 1.2,
    step: 0.05,
    minLabel: "Narrower",
    maxLabel: "Wider",
    showValue: false,
  },
  spacing: {
    minimumValue: 0.8,
    maximumValue: 1.2,
    step: 0.05,
    minLabel: "Closer",
    maxLabel: "Farther",
    showValue: false,
  },
  thickness: {
    minimumValue: 0.8,
    maximumValue: 1.2,
    step: 0.05,
    minLabel: "Thinner",
    maxLabel: "Thicker",
    showValue: false,
  },
  tilt: {
    minimumValue: -10,
    maximumValue: 10,
    step: 1,
    minLabel: "Down",
    maxLabel: "Up",
    showValue: true,
    formatValue: (v: number) => `${v > 0 ? "+" : ""}${v}°`,
  },
  height: {
    minimumValue: 0.8,
    maximumValue: 1.2,
    step: 0.05,
    minLabel: "Shorter",
    maxLabel: "Taller",
    showValue: false,
  },
} as const;

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  sliderContainer: {
    paddingVertical: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  valueDisplay: {
    fontSize: 14,
    fontWeight: "600",
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  endLabel: {
    fontSize: 11,
    width: 50,
    textAlign: "center",
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  groupContent: {
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
});

export default FeatureSlider;
