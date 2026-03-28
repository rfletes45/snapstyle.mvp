/**
 * Widget Gallery
 *
 * Polished near-full-height bottom sheet for adding and restoring widgets.
 * Shown when user taps "Add" in customize mode.
 *
 * Design:
 * - Near-full-height bottom sheet (92% of screen)
 * - Drag handle + clear header
 * - Category-grouped sections (Profile, Social, Gaming, Activity)
 * - Restore section for hidden widgets (if any)
 * - Preview cards with icon, description, size badges, and add action
 * - Empty state when all widgets are placed
 * - Safe-area-aware bottom padding
 *
 * @module components/profile/WidgetBoard/WidgetGallery
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useMemo } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";

import { getAllWidgetDefinitions } from "./WidgetRegistry";
import type {
  WidgetInstance,
  WidgetTypeDefinition,
  WidgetTypeId,
} from "./types";

// =============================================================================
// Types
// =============================================================================

export interface WidgetGalleryProps {
  visible: boolean;
  widgets: WidgetInstance[];
  hiddenWidgets: WidgetInstance[];
  onAddWidget: (widgetType: WidgetTypeId) => void;
  onRestoreWidget: (instanceId: string) => void;
  onClose: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.92);

const CATEGORY_ORDER = ["profile", "social", "gaming", "activity"] as const;
const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  profile: { label: "Profile", icon: "account-circle-outline" },
  social: { label: "Social", icon: "account-group-outline" },
  gaming: { label: "Gaming", icon: "gamepad-variant-outline" },
  activity: { label: "Activity", icon: "lightning-bolt-outline" },
};

const SIZE_LABELS: Record<string, string> = {
  small: "S",
  medium: "M",
  wide: "W",
  large: "L",
  hero: "XL",
};

// =============================================================================
// Size Badge Component
// =============================================================================

function SizeBadges({ sizes }: { sizes: string[] }) {
  const colors = useColors();
  return (
    <View style={gStyles.sizeBadgeRow}>
      {sizes.map((s) => (
        <View
          key={s}
          style={[
            gStyles.sizeBadge,
            { backgroundColor: colors.primary + "15" },
          ]}
        >
          <Text style={[gStyles.sizeBadgeText, { color: colors.primary }]}>
            {SIZE_LABELS[s] ?? s}
          </Text>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// Widget Card Component
// =============================================================================

function WidgetCard({
  icon,
  name,
  description,
  sizes,
  actionIcon,
  onPress,
  isPlaced,
}: {
  icon: string;
  name: string;
  description: string;
  sizes?: string[];
  actionIcon: string;
  onPress: () => void;
  isPlaced?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[gStyles.card, { backgroundColor: colors.surfaceVariant + "50" }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[gStyles.cardIcon, { backgroundColor: colors.primary + "12" }]}
      >
        <MaterialCommunityIcons
          name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
          size={22}
          color={colors.primary}
        />
      </View>
      <View style={gStyles.cardBody}>
        <Text
          style={[gStyles.cardName, { color: colors.text }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={[gStyles.cardDesc, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {description}
        </Text>
        {sizes && sizes.length > 0 && <SizeBadges sizes={sizes} />}
      </View>
      {isPlaced ? (
        <View
          style={[
            gStyles.cardAction,
            { backgroundColor: colors.surfaceVariant + "40" },
          ]}
        >
          <MaterialCommunityIcons
            name="check"
            size={18}
            color={colors.textSecondary}
          />
        </View>
      ) : (
        <View
          style={[
            gStyles.cardAction,
            { backgroundColor: colors.primary + "15" },
          ]}
        >
          <MaterialCommunityIcons
            name={actionIcon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={18}
            color={colors.primary}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// Section Header
// =============================================================================

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  const colors = useColors();
  return (
    <View style={gStyles.sectionHeader}>
      <MaterialCommunityIcons
        name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={16}
        color={colors.textSecondary}
      />
      <Text style={[gStyles.sectionTitle, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

// =============================================================================
// Gallery Component
// =============================================================================

function WidgetGalleryBase({
  visible,
  widgets,
  hiddenWidgets,
  onAddWidget,
  onRestoreWidget,
  onClose,
}: WidgetGalleryProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const allDefinitions = useMemo(() => getAllWidgetDefinitions(), []);

  const placedTypeSet = useMemo(() => {
    const set = new Set<string>();
    for (const w of widgets) if (w.visible) set.add(w.widgetType);
    return set;
  }, [widgets]);

  // Group available (not yet placed) widgets by category
  const categorizedWidgets = useMemo(() => {
    const groups: Record<string, WidgetTypeDefinition[]> = {};
    for (const def of allDefinitions) {
      if (!def.canRemove) continue; // skip mandatory widgets like profile-header
      if (placedTypeSet.has(def.widgetType)) continue;
      const cat = def.category ?? "activity";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(def);
    }
    return groups;
  }, [allDefinitions, placedTypeSet]);

  const handleAdd = useCallback(
    (typeId: WidgetTypeId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onAddWidget(typeId);
      onClose();
    },
    [onAddWidget, onClose],
  );

  const handleRestore = useCallback(
    (instanceId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRestoreWidget(instanceId);
      onClose();
    },
    [onRestoreWidget, onClose],
  );

  const defMap = useMemo(() => {
    const m = new Map<string, WidgetTypeDefinition>();
    for (const d of allDefinitions) m.set(d.widgetType, d);
    return m;
  }, [allDefinitions]);

  const hasAvailable = Object.keys(categorizedWidgets).length > 0;
  const hasContent = hiddenWidgets.length > 0 || hasAvailable;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={gStyles.backdrop} onPress={onClose}>
        <Animated.View
          entering={FadeIn.duration(150)}
          style={gStyles.backdropInner}
        >
          <Pressable>
            <Animated.View
              entering={SlideInDown.duration(350).springify()}
              style={[
                gStyles.sheet,
                {
                  backgroundColor: colors.surface,
                  height: SHEET_HEIGHT,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
            >
              {/* Drag Handle */}
              <View style={gStyles.handleRow}>
                <View
                  style={[
                    gStyles.handle,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                />
              </View>

              {/* Header */}
              <View style={gStyles.header}>
                <View style={gStyles.headerText}>
                  <Text style={[gStyles.title, { color: colors.text }]}>
                    Add Widgets
                  </Text>
                  <Text
                    style={[gStyles.subtitle, { color: colors.textSecondary }]}
                  >
                    Personalize your profile with widgets
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  activeOpacity={0.7}
                  style={[
                    gStyles.closeIcon,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={18}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>

              {/* Scrollable Content */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={gStyles.scroll}
                contentContainerStyle={[
                  gStyles.scrollContent,
                  { paddingBottom: Spacing.xl + insets.bottom },
                ]}
              >
                {/* Restore Section */}
                {hiddenWidgets.length > 0 && (
                  <View style={gStyles.section}>
                    <SectionHeader icon="restore" label="Restore Hidden" />
                    {hiddenWidgets.map((w) => {
                      const def = defMap.get(w.widgetType);
                      return (
                        <WidgetCard
                          key={w.instanceId}
                          icon={def?.icon ?? "widgets"}
                          name={def?.displayName ?? w.widgetType}
                          description={
                            def?.description ?? "Restore this widget"
                          }
                          actionIcon="undo-variant"
                          onPress={() => handleRestore(w.instanceId)}
                        />
                      );
                    })}
                  </View>
                )}

                {/* Category Sections */}
                {CATEGORY_ORDER.map((cat) => {
                  const defs = categorizedWidgets[cat];
                  if (!defs || defs.length === 0) return null;
                  const meta = CATEGORY_META[cat];
                  return (
                    <View key={cat} style={gStyles.section}>
                      <SectionHeader icon={meta.icon} label={meta.label} />
                      {defs.map((def) => (
                        <WidgetCard
                          key={def.widgetType}
                          icon={def.icon}
                          name={def.displayName}
                          description={def.description}
                          sizes={def.supportedSizes}
                          actionIcon="plus-circle"
                          onPress={() => handleAdd(def.widgetType)}
                        />
                      ))}
                    </View>
                  );
                })}

                {/* Empty State */}
                {!hasContent && (
                  <View style={gStyles.emptyState}>
                    <View
                      style={[
                        gStyles.emptyIcon,
                        { backgroundColor: colors.primary + "10" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="check-decagram"
                        size={40}
                        color={colors.primary + "80"}
                      />
                    </View>
                    <Text style={[gStyles.emptyTitle, { color: colors.text }]}>
                      All Set!
                    </Text>
                    <Text
                      style={[
                        gStyles.emptyDesc,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Every widget is already on your board. Remove one to make
                      room for something new.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export const WidgetGallery = memo(WidgetGalleryBase);

// =============================================================================
// Styles
// =============================================================================

const gStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  backdropInner: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.xs,
    overflow: "hidden",
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
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: FontSizes.sm,
    marginTop: 4,
  },
  closeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  // -- Card --
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: {
    flex: 1,
  },
  cardName: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  cardDesc: {
    fontSize: FontSizes.sm,
    lineHeight: 18,
    marginTop: 2,
  },
  cardAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  // -- Size badges --
  sizeBadgeRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
  },
  sizeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sizeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  // -- Empty state --
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  emptyDesc: {
    fontSize: FontSizes.md,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 21,
  },
});
