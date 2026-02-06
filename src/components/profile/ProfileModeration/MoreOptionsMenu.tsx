/**
 * MoreOptionsMenu Component
 *
 * A bottom sheet menu for profile actions:
 * - Mute/Unmute notifications
 * - Report user
 * - Block/Unblock user
 * - Share profile
 * - Copy profile link
 *
 * @module components/profile/ProfileModeration/MoreOptionsMenu
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Spacing } from "@/constants/theme";
import * as haptics from "@/utils/haptics";

// =============================================================================
// Types
// =============================================================================

interface MenuAction {
  id: string;
  icon: string;
  label: string;
  sublabel?: string;
  color?: string;
  destructive?: boolean;
  disabled?: boolean;
}

export interface MoreOptionsMenuProps {
  /** Whether the menu is visible */
  visible: boolean;
  /** Display name of the target user */
  displayName: string;
  /** Username of the target user */
  username: string;
  /** Current relationship with user */
  relationship: "friend" | "pending" | "stranger" | "blocked";
  /** Whether the user is muted */
  isMuted: boolean;
  /** Called when an action is selected */
  onAction: (action: string) => void;
  /** Called when menu is closed */
  onClose: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const MoreOptionsMenu = memo(function MoreOptionsMenu({
  visible,
  displayName,
  username,
  relationship,
  isMuted,
  onAction,
  onClose,
}: MoreOptionsMenuProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    primary: theme.colors.primary,
    error: theme.colors.error,
    warning: "#FFA000",
  };

  // Build menu actions based on relationship
  const getMenuActions = useCallback((): MenuAction[] => {
    const actions: MenuAction[] = [];

    // Share actions (always available)
    actions.push({
      id: "share",
      icon: "share-variant",
      label: "Share Profile",
      sublabel: "Share via other apps",
    });

    actions.push({
      id: "copy_link",
      icon: "link",
      label: "Copy Profile Link",
    });

    // Add divider-like spacing with a separator action
    actions.push({
      id: "divider_1",
      icon: "",
      label: "",
      disabled: true,
    });

    // Friend-specific actions
    if (relationship === "friend") {
      actions.push({
        id: "mute",
        icon: isMuted ? "bell" : "bell-off",
        label: isMuted ? "Unmute" : "Mute",
        sublabel: isMuted
          ? "Turn notifications back on"
          : "Mute notifications from this user",
        color: colors.warning,
      });

      actions.push({
        id: "remove_friend",
        icon: "account-remove",
        label: "Remove Friend",
        sublabel: "They won't be notified",
        color: colors.error,
        destructive: true,
      });
    }

    // Report (always available except blocked)
    if (relationship !== "blocked") {
      actions.push({
        id: "report",
        icon: "flag",
        label: "Report",
        sublabel: "Report this user for violating guidelines",
        color: colors.error,
      });
    }

    // Block/Unblock
    if (relationship === "blocked") {
      actions.push({
        id: "unblock",
        icon: "account-check",
        label: "Unblock",
        sublabel: `You've blocked @${username}`,
        color: colors.primary,
      });
    } else {
      actions.push({
        id: "block",
        icon: "account-off",
        label: "Block",
        sublabel: "Prevent all interaction",
        color: colors.error,
        destructive: true,
      });
    }

    return actions;
  }, [relationship, isMuted, username, colors]);

  const handleActionPress = useCallback(
    (action: MenuAction) => {
      if (action.disabled) return;

      if (action.destructive) {
        haptics.deleteWarning();
      } else {
        haptics.buttonPress();
      }

      onClose();
      // Small delay to allow modal to close before triggering action
      setTimeout(() => {
        onAction(action.id);
      }, 100);
    },
    [onAction, onClose],
  );

  const handleClose = useCallback(() => {
    haptics.buttonPress();
    onClose();
  }, [onClose]);

  if (!visible) return null;

  const menuActions = getMenuActions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              entering={FadeInDown.duration(250)}
              style={[
                styles.menu,
                {
                  backgroundColor: colors.surface,
                  paddingBottom: insets.bottom + Spacing.md,
                },
              ]}
            >
              {/* Handle bar */}
              <View style={styles.handleBar}>
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                />
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {displayName}
                </Text>
                <Text
                  style={[
                    styles.headerSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  @{username}
                </Text>
              </View>

              <Divider style={styles.headerDivider} />

              {/* Menu Items */}
              <View style={styles.menuItems}>
                {menuActions.map((action, index) => {
                  // Render divider
                  if (action.id.startsWith("divider")) {
                    return (
                      <Divider key={action.id} style={styles.menuDivider} />
                    );
                  }

                  return (
                    <Animated.View
                      key={action.id}
                      entering={FadeInUp.delay(index * 30).duration(200)}
                    >
                      <TouchableOpacity
                        style={[
                          styles.menuItem,
                          action.destructive && styles.menuItemDestructive,
                        ]}
                        onPress={() => handleActionPress(action)}
                        disabled={action.disabled}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.iconContainer,
                            {
                              backgroundColor: action.destructive
                                ? `${colors.error}20`
                                : colors.surfaceVariant,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={action.icon as any}
                            size={22}
                            color={action.color || colors.text}
                          />
                        </View>
                        <View style={styles.menuItemContent}>
                          <Text
                            style={[
                              styles.menuItemLabel,
                              { color: action.color || colors.text },
                            ]}
                          >
                            {action.label}
                          </Text>
                          {action.sublabel && (
                            <Text
                              style={[
                                styles.menuItemSublabel,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              {action.sublabel}
                            </Text>
                          )}
                        </View>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={20}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>

              {/* Cancel Button */}
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  { backgroundColor: colors.surfaceVariant },
                ]}
                onPress={handleClose}
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  menu: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  handleBar: {
    width: "100%",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerDivider: {
    marginTop: Spacing.sm,
  },
  menuItems: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  menuDivider: {
    marginVertical: Spacing.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  menuItemDestructive: {},
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  menuItemSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  cancelButton: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default MoreOptionsMenu;
