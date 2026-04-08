/**
 * Widget Size Selector
 *
 * A bottom sheet / modal overlay that lets the user pick from
 * the approved size presets for a given widget.
 * Shows a visual preview of each size option.
 *
 * @module components/profile/WidgetBoard/WidgetSizeSelector
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";

import { getWidgetDefinition } from "./WidgetRegistry";
import type { WidgetInstance, WidgetSizeKey } from "./types";
import { SIZE_PRESETS } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface WidgetSizeSelectorProps {
  visible: boolean;
  widget: WidgetInstance | null;
  onSelect: (instanceId: string, size: WidgetSizeKey) => void;
  onClose: () => void;
}

// =============================================================================
// Size Label Map
// =============================================================================

const SIZE_LABELS: Record<WidgetSizeKey, string> = {
  mega: "Mega",
  small: "Small",
  medium: "Medium",
  wide: "Wide",
  large: "Large",
  hero: "Hero",
};

const SIZE_DESCRIPTIONS: Record<WidgetSizeKey, string> = {
  mega: "4 x 4 - Full board statement",
  small: "2 × 1 — Compact",
  medium: "2 × 2 — Standard",
  wide: "4 × 1 — Full width, short",
  large: "4 × 2 — Full width, tall",
  hero: "4 × 3 — Full hero",
};

// =============================================================================
// Component
// =============================================================================

function WidgetSizeSelectorBase({
  visible,
  widget,
  onSelect,
  onClose,
}: WidgetSizeSelectorProps) {
  const colors = useColors();

  const definition = widget
    ? getWidgetDefinition(widget.widgetType)
    : undefined;

  const supportedSizes = definition?.supportedSizes ?? [];

  const handleSelect = useCallback(
    (size: WidgetSizeKey) => {
      if (!widget) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(widget.instanceId, size);
      onClose();
    },
    [widget, onSelect, onClose],
  );

  if (!widget || !definition) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(150)}>
          <Pressable>
            <Animated.View
              entering={SlideInDown.duration(300).springify()}
              style={[styles.sheet, { backgroundColor: colors.surface }]}
            >
              {/* Handle */}
              <View style={styles.handleRow}>
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                />
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.text }]}>
                Resize: {definition.displayName}
              </Text>

              {/* Size Options */}
              <View style={styles.optionsContainer}>
                {supportedSizes.map((sizeKey) => {
                  const span = SIZE_PRESETS[sizeKey];
                  const isSelected = widget.size === sizeKey;
                  return (
                    <TouchableOpacity
                      key={sizeKey}
                      style={[
                        styles.option,
                        {
                          backgroundColor: isSelected
                            ? colors.primary + "15"
                            : colors.surfaceVariant,
                          borderColor: isSelected
                            ? colors.primary
                            : "transparent",
                          borderWidth: isSelected ? 1.5 : 0,
                        },
                      ]}
                      onPress={() => handleSelect(sizeKey)}
                      activeOpacity={0.7}
                    >
                      {/* Grid Preview */}
                      <View style={styles.previewContainer}>
                        <View
                          style={[
                            styles.previewBlock,
                            {
                              width: span.w * 16 + (span.w - 1) * 2,
                              height: span.h * 16 + (span.h - 1) * 2,
                              backgroundColor: isSelected
                                ? colors.primary + "40"
                                : colors.textSecondary + "30",
                              borderRadius: 4,
                            },
                          ]}
                        />
                      </View>

                      {/* Label */}
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            color: isSelected ? colors.primary : colors.text,
                          },
                        ]}
                      >
                        {SIZE_LABELS[sizeKey]}
                      </Text>
                      <Text
                        style={[
                          styles.optionDesc,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {SIZE_DESCRIPTIONS[sizeKey]}
                      </Text>

                      {/* Checkmark */}
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color={colors.primary}
                          style={styles.checkIcon}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Close */}
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  { backgroundColor: colors.surfaceVariant },
                ]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.closeText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export const WidgetSizeSelector = memo(WidgetSizeSelectorBase);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingBottom: 34,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  handleRow: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  previewContainer: {
    width: 72,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  previewBlock: {},
  optionLabel: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    flex: 1,
  },
  optionDesc: {
    fontSize: FontSizes.xs,
    position: "absolute",
    bottom: Spacing.xs,
    left: 72 + Spacing.md + Spacing.md,
  },
  checkIcon: {
    marginLeft: Spacing.xs,
  },
  closeButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  closeText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
});
