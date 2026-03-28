/**
 * Customize Mode Toolbar
 *
 * Floating toolbar shown at the top of the profile when in customize mode.
 * Contains Cancel, Done/Save, and Add Widget actions.
 *
 * @module components/profile/WidgetBoard/CustomizeModeToolbar
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native-paper";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";

// =============================================================================
// Types
// =============================================================================

export interface CustomizeModeToolbarProps {
  saving: boolean;
  onDone: () => void;
  onCancel: () => void;
  onAddWidget: () => void;
}

// =============================================================================
// Component
// =============================================================================

function CustomizeModeToolbarBase({
  saving,
  onDone,
  onCancel,
  onAddWidget,
}: CustomizeModeToolbarProps) {
  const colors = useColors();

  const handleDone = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone();
  }, [onDone]);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  }, [onCancel]);

  const handleAddWidget = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddWidget();
  }, [onAddWidget]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface + "F0",
          borderBottomColor: colors.surfaceVariant,
        },
      ]}
    >
      {/* Cancel */}
      <TouchableOpacity
        style={styles.textButton}
        onPress={handleCancel}
        activeOpacity={0.7}
      >
        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
          Cancel
        </Text>
      </TouchableOpacity>

      {/* Center: Title + Add Widget */}
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.text }]}>Customize</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary + "20" }]}
          onPress={handleAddWidget}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="plus"
            size={16}
            color={colors.primary}
          />
          <Text style={[styles.addButtonText, { color: colors.primary }]}>
            Add
          </Text>
        </TouchableOpacity>
      </View>

      {/* Done */}
      <TouchableOpacity
        style={[styles.doneButton, { backgroundColor: colors.primary }]}
        onPress={handleDone}
        activeOpacity={0.7}
        disabled={saving}
      >
        <Text style={styles.doneText}>{saving ? "Saving..." : "Done"}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export const CustomizeModeToolbar = memo(CustomizeModeToolbarBase);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 0.5,
  },
  textButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    minWidth: 60,
  },
  cancelText: {
    fontSize: FontSizes.md,
    fontWeight: "500",
  },
  center: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: "700",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  addButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
  doneButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
    minWidth: 60,
    alignItems: "center",
  },
  doneText: {
    color: "#fff",
    fontSize: FontSizes.md,
    fontWeight: "700",
  },
});
