import {
  DraggableBottomSheet,
  HANDLE_ZONE_HEIGHT,
} from "@/components/chat/DraggableBottomSheet";
import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { useMainNavCustomization } from "@/hooks/useMainNavCustomization";
import {
  getAvailableMainNavItemDefinitions,
  getMainNavItemDefinition,
  MAX_MAIN_NAV_ITEMS,
  MIN_MAIN_NAV_ITEMS,
  type MainNavItemDefinition,
  type MainNavItemId,
} from "@/navigation/mainNav";
import { useAuth } from "@/store/AuthContext";
import { useColors } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type MaterialCommunityIconName = React.ComponentProps<
  typeof MaterialCommunityIcons
>["name"];

export interface MainNavCustomizationSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface NavRowProps {
  definition: MainNavItemDefinition;
  index: number;
  total: number;
  canRemove: boolean;
  onMove: (itemId: MainNavItemId, toPosition: number) => void;
  onRemove: (itemId: MainNavItemId) => void;
}

function NavRow({
  definition,
  index,
  total,
  canRemove,
  onMove,
  onRemove,
}: NavRowProps) {
  const colors = useColors();
  const canMoveUp = definition.canReorder && index > 0;
  const canMoveDown = definition.canReorder && index < total - 1;

  const moveUp = useCallback(() => {
    if (!canMoveUp) return;
    Haptics.selectionAsync();
    onMove(definition.itemId, index - 1);
  }, [canMoveUp, definition.itemId, index, onMove]);

  const moveDown = useCallback(() => {
    if (!canMoveDown) return;
    Haptics.selectionAsync();
    onMove(definition.itemId, index + 1);
  }, [canMoveDown, definition.itemId, index, onMove]);

  const remove = useCallback(() => {
    if (!canRemove) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemove(definition.itemId);
  }, [canRemove, definition.itemId, onRemove]);

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View
        style={[styles.rowIcon, { backgroundColor: colors.primary + "15" }]}
      >
        <MaterialCommunityIcons
          name={definition.icon as MaterialCommunityIconName}
          size={22}
          color={colors.primary}
        />
      </View>
      <View style={styles.rowTextWrap}>
        <Text
          style={[styles.rowTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {definition.label}
        </Text>
        <Text
          style={[styles.rowMeta, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {definition.isCore ? "Locked" : "Optional"}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable
          onPress={moveUp}
          disabled={!canMoveUp}
          style={[styles.iconButton, !canMoveUp && styles.disabledButton]}
          accessibilityRole="button"
          accessibilityLabel={`Move ${definition.label} up`}
        >
          <MaterialCommunityIcons
            name="chevron-up"
            size={22}
            color={canMoveUp ? colors.text : colors.textMuted}
          />
        </Pressable>
        <Pressable
          onPress={moveDown}
          disabled={!canMoveDown}
          style={[styles.iconButton, !canMoveDown && styles.disabledButton]}
          accessibilityRole="button"
          accessibilityLabel={`Move ${definition.label} down`}
        >
          <MaterialCommunityIcons
            name="chevron-down"
            size={22}
            color={canMoveDown ? colors.text : colors.textMuted}
          />
        </Pressable>
        {definition.canRemove ? (
          <Pressable
            onPress={remove}
            disabled={!canRemove}
            style={[styles.iconButton, !canRemove && styles.disabledButton]}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${definition.label}`}
          >
            <MaterialCommunityIcons
              name="close-circle-outline"
              size={21}
              color={canRemove ? colors.error : colors.textMuted}
            />
          </Pressable>
        ) : (
          <View style={styles.iconButton}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={18}
              color={colors.textMuted}
            />
          </View>
        )}
      </View>
    </View>
  );
}

interface AddCardProps {
  definition: MainNavItemDefinition;
  disabled: boolean;
  onAdd: (itemId: MainNavItemId) => void;
}

function AddCard({ definition, disabled, onAdd }: AddCardProps) {
  const colors = useColors();

  const add = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAdd(definition.itemId);
  }, [definition.itemId, disabled, onAdd]);

  return (
    <Pressable
      onPress={add}
      disabled={disabled}
      style={[
        styles.addCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${definition.label}`}
    >
      <View
        style={[styles.addIcon, { backgroundColor: colors.primary + "15" }]}
      >
        <MaterialCommunityIcons
          name={definition.icon as MaterialCommunityIconName}
          size={20}
          color={colors.primary}
        />
      </View>
      <Text style={[styles.addLabel, { color: colors.text }]} numberOfLines={1}>
        {definition.label}
      </Text>
      <MaterialCommunityIcons
        name="plus-circle"
        size={22}
        color={disabled ? colors.textMuted : colors.primary}
      />
    </Pressable>
  );
}

function MainNavCustomizationSheetBase({
  visible,
  onClose,
}: MainNavCustomizationSheetProps) {
  const colors = useColors();
  const { currentFirebaseUser } = useAuth();
  const wasVisibleRef = useRef(false);
  const {
    items,
    saving,
    isEditing,
    enterEditMode,
    saveAndExit,
    cancelEdit,
    moveItem,
    addItem,
    removeItem,
    resetToDefaults,
  } = useMainNavCustomization(currentFirebaseUser?.uid);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      enterEditMode();
    }
    wasVisibleRef.current = visible;
  }, [enterEditMode, visible]);

  const currentIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );
  const availableToAdd = useMemo(
    () =>
      getAvailableMainNavItemDefinitions().filter(
        (definition) => !currentIds.has(definition.itemId),
      ),
    [currentIds],
  );
  const atMax = items.length >= MAX_MAIN_NAV_ITEMS;
  const canRemoveOptional = items.length > MIN_MAIN_NAV_ITEMS;

  const handleCancel = useCallback(() => {
    if (isEditing) cancelEdit();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [cancelEdit, isEditing, onClose]);

  const handleDone = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveAndExit();
    onClose();
  }, [onClose, saveAndExit]);

  const handleRestoreDefaults = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetToDefaults();
  }, [resetToDefaults]);

  const scrollMaxHeight =
    Dimensions.get("window").height * 0.78 - HANDLE_ZONE_HEIGHT - 70;

  return (
    <DraggableBottomSheet
      open={visible}
      onClose={handleCancel}
      snapPoints={[0.62, 0.84]}
      initialSnapIndex={1}
      surfaceColor={colors.background}
      handleColor={colors.textMuted}
      dragGestureArea="handle"
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={handleCancel}
          style={styles.textButton}
          accessibilityRole="button"
          accessibilityLabel="Cancel main navigation changes"
        >
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
            Cancel
          </Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>
          Main Navigation
        </Text>
        <Pressable
          onPress={handleDone}
          disabled={saving}
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Save main navigation changes"
        >
          <Text style={styles.doneText}>{saving ? "Saving" : "Done"}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={[styles.scroll, { maxHeight: scrollMaxHeight }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons
              name="format-list-bulleted"
              size={16}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              Current
            </Text>
          </View>
          {items.map((item, index) => {
            const definition = getMainNavItemDefinition(item.id);
            if (!definition) return null;
            return (
              <NavRow
                key={item.id}
                definition={definition}
                index={index}
                total={items.length}
                canRemove={definition.canRemove && canRemoveOptional}
                onMove={moveItem}
                onRemove={removeItem}
              />
            );
          })}
        </View>

        {availableToAdd.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="plus-circle-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text
                style={[styles.sectionTitle, { color: colors.textSecondary }]}
              >
                Add
              </Text>
              {atMax && (
                <Text style={[styles.maxText, { color: colors.textMuted }]}>
                  Max {MAX_MAIN_NAV_ITEMS}
                </Text>
              )}
            </View>
            {availableToAdd.map((definition) => (
              <AddCard
                key={definition.itemId}
                definition={definition}
                disabled={atMax}
                onAdd={addItem}
              />
            ))}
          </View>
        )}

        <Pressable
          onPress={handleRestoreDefaults}
          style={[styles.restoreButton, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Restore default main navigation"
        >
          <MaterialCommunityIcons
            name="restore"
            size={18}
            color={colors.textSecondary}
          />
          <Text style={[styles.restoreText, { color: colors.textSecondary }]}>
            Restore Defaults
          </Text>
        </Pressable>
      </ScrollView>
    </DraggableBottomSheet>
  );
}

export const MainNavCustomizationSheet = memo(MainNavCustomizationSheetBase);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  textButton: {
    minWidth: 68,
    paddingVertical: Spacing.xs,
  },
  cancelText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: "800",
  },
  doneButton: {
    minWidth: 68,
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
  },
  doneText: {
    color: "#FFFFFF",
    fontSize: FontSizes.md,
    fontWeight: "700",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  maxText: {
    marginLeft: "auto",
    fontSize: FontSizes.xs,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: FontSizes.md,
    fontWeight: "700",
  },
  rowMeta: {
    fontSize: FontSizes.xs,
    fontWeight: "600",
    marginTop: 1,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  disabledButton: {
    opacity: 0.55,
  },
  addCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  addIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  addLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSizes.md,
    fontWeight: "700",
  },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
  },
  restoreText: {
    fontSize: FontSizes.md,
    fontWeight: "700",
  },
});
