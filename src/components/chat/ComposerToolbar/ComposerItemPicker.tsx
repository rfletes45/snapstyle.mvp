/**
 * ComposerItemPicker
 *
 * Bottom sheet for adding toolbar items to the composer.
 * Shows available items not currently in the toolbar, grouped by category.
 * Includes a "Restore Defaults" option.
 *
 * @module components/chat/ComposerToolbar/ComposerItemPicker
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "react-native-paper";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";

import { DraggableBottomSheet } from "../DraggableBottomSheet";
import {
  getAvailableToolbarItemDefinitions,
  TOOLBAR_CATEGORY_META,
  TOOLBAR_CATEGORY_ORDER,
} from "./ComposerToolbarRegistry";
import type {
  ComposerToolbarItemId,
  ToolbarItemCategory,
  ToolbarItemDefinition,
} from "./types";
import { MAX_TOOLBAR_ITEMS } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface ComposerItemPickerProps {
  visible: boolean;
  /** IDs of items already in the toolbar. */
  currentItemIds: ComposerToolbarItemId[];
  onAddItem: (itemId: ComposerToolbarItemId) => void;
  onRestoreDefaults: () => void;
  onClose: () => void;
}

// =============================================================================
// Item Card
// =============================================================================

function ItemCard({
  definition,
  onAdd,
  disabled,
}: {
  definition: ToolbarItemDefinition;
  onAdd: () => void;
  disabled: boolean;
}) {
  const colors = useColors();

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd();
  }, [onAdd, disabled]);

  return (
    <TouchableOpacity
      style={[
        styles.itemCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.surfaceVariant,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View
        style={[styles.itemIcon, { backgroundColor: colors.primary + "15" }]}
      >
        <MaterialCommunityIcons
          name={definition.icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={22}
          color={colors.primary}
        />
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.text }]}>
          {definition.displayName}
        </Text>
        <Text
          style={[styles.itemDescription, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {definition.description}
        </Text>
      </View>
      {!definition.available ? (
        <View
          style={[
            styles.comingSoonBadge,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <Text
            style={[styles.comingSoonText, { color: colors.textSecondary }]}
          >
            Soon
          </Text>
        </View>
      ) : (
        <MaterialCommunityIcons
          name="plus-circle"
          size={24}
          color={disabled ? colors.textMuted : colors.primary}
        />
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Component
// =============================================================================

function ComposerItemPickerBase({
  visible,
  currentItemIds,
  onAddItem,
  onRestoreDefaults,
  onClose,
}: ComposerItemPickerProps) {
  const colors = useColors();
  const currentSet = useMemo(() => new Set(currentItemIds), [currentItemIds]);
  const atMax = currentItemIds.length >= MAX_TOOLBAR_ITEMS;

  // Group available items by category, excluding already-added items
  const sections = useMemo(() => {
    const allDefs = getAvailableToolbarItemDefinitions();
    const available = allDefs.filter(
      (d) => !currentSet.has(d.itemId) && d.itemId !== "message-bar",
    );

    const grouped = new Map<ToolbarItemCategory, ToolbarItemDefinition[]>();
    for (const def of available) {
      const existing = grouped.get(def.category) ?? [];
      existing.push(def);
      grouped.set(def.category, existing);
    }

    return TOOLBAR_CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map(
      (cat) => ({
        category: cat,
        meta: TOOLBAR_CATEGORY_META[cat],
        items: grouped.get(cat)!,
      }),
    );
  }, [currentSet]);

  const handleAdd = useCallback(
    (itemId: ComposerToolbarItemId) => {
      onAddItem(itemId);
    },
    [onAddItem],
  );

  const handleRestoreDefaults = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRestoreDefaults();
    onClose();
  }, [onRestoreDefaults, onClose]);

  const isEmpty = sections.every((s) => s.items.length === 0);

  return (
    <DraggableBottomSheet
      open={visible}
      onClose={onClose}
      snapPoints={[0.5, 0.75]}
      initialSnapIndex={1}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Add to Toolbar
        </Text>
        {atMax && (
          <Text style={[styles.maxLabel, { color: colors.textSecondary }]}>
            Max {MAX_TOOLBAR_ITEMS} items
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={48}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              All available items are in your toolbar!
            </Text>
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.category} style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name={
                    section.meta
                      .icon as keyof typeof MaterialCommunityIcons.glyphMap
                  }
                  size={16}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.sectionTitle, { color: colors.textSecondary }]}
                >
                  {section.meta.label}
                </Text>
              </View>
              {section.items.map((def) => (
                <ItemCard
                  key={def.itemId}
                  definition={def}
                  onAdd={() => handleAdd(def.itemId)}
                  disabled={atMax || !def.available}
                />
              ))}
            </View>
          ))
        )}

        {/* Restore defaults */}
        <TouchableOpacity
          style={[styles.restoreButton, { borderColor: colors.surfaceVariant }]}
          onPress={handleRestoreDefaults}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="restore"
            size={18}
            color={colors.textSecondary}
          />
          <Text style={[styles.restoreText, { color: colors.textSecondary }]}>
            Restore Defaults
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </DraggableBottomSheet>
  );
}

export const ComposerItemPicker = memo(ComposerItemPickerBase);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  maxLabel: {
    fontSize: FontSizes.xs,
    fontWeight: "500",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  itemDescription: {
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  comingSoonBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  comingSoonText: {
    fontSize: FontSizes.xs,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.md,
    textAlign: "center",
  },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    marginTop: Spacing.md,
  },
  restoreText: {
    fontSize: FontSizes.md,
    fontWeight: "500",
  },
});
