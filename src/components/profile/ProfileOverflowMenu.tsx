/**
 * ProfileOverflowMenu — Overflow (•••) menu for own profile.
 *
 * Shows Privacy / Settings actions for own profile.
 * For other-user profiles, the existing MoreOptionsMenu is used instead.
 *
 * @module components/profile/ProfileOverflowMenu
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native-paper";

import { BorderRadius, FontSizes, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";

// =============================================================================
// Types
// =============================================================================

export interface ProfileOverflowMenuProps {
  /** Callback when Privacy is pressed */
  onPrivacyPress?: () => void;
  /** Callback when Settings is pressed */
  onSettingsPress?: () => void;
  /** Callback when Share Profile is pressed */
  onSharePress?: () => void;
  /** Callback when Shop is pressed */
  onShopPress?: () => void;
  /** Callback when Customize is pressed */
  onCustomizePress?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  onPress?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const ProfileOverflowMenu = memo(function ProfileOverflowMenu({
  onPrivacyPress,
  onSettingsPress,
  onSharePress,
  onShopPress,
  onCustomizePress,
}: ProfileOverflowMenuProps) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);

  const handleOpen = useCallback(() => setVisible(true), []);
  const handleClose = useCallback(() => setVisible(false), []);

  const handleMenuPress = useCallback((action?: () => void) => {
    setVisible(false);
    if (action) {
      // Small delay for menu dismiss animation
      setTimeout(action, 150);
    }
  }, []);

  const items: MenuItem[] = [
    ...(onShopPress
      ? [
          {
            id: "shop",
            label: "Shop",
            icon: "shopping-outline",
            onPress: onShopPress,
          },
        ]
      : []),
    ...(onCustomizePress
      ? [
          {
            id: "customize",
            label: "Customize",
            icon: "palette-outline",
            onPress: onCustomizePress,
          },
        ]
      : []),
    ...(onSharePress
      ? [
          {
            id: "share",
            label: "Share Profile",
            icon: "share-variant-outline",
            onPress: onSharePress,
          },
        ]
      : []),
    ...(onPrivacyPress
      ? [
          {
            id: "privacy",
            label: "Privacy",
            icon: "shield-lock-outline",
            onPress: onPrivacyPress,
          },
        ]
      : []),
    ...(onSettingsPress
      ? [
          {
            id: "settings",
            label: "Settings",
            icon: "cog-outline",
            onPress: onSettingsPress,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity
        onPress={handleOpen}
        style={styles.trigger}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="More options"
        accessibilityRole="button"
      >
        <MaterialCommunityIcons name="dots-vertical" size={24} color="#333" />
      </TouchableOpacity>

      {/* Menu modal */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <View
            style={[
              styles.menu,
              {
                backgroundColor: colors.surface,
                borderColor: colors.surfaceVariant + "30",
              },
            ]}
          >
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleMenuPress(item.onPress)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={20}
                  color={colors.text}
                  style={styles.menuIcon}
                />
                <Text style={[styles.menuLabel, { color: colors.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 60,
    paddingRight: Spacing.lg,
  },
  menu: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    minWidth: 180,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  menuIcon: {
    marginRight: Spacing.md,
  },
  menuLabel: {
    fontSize: FontSizes.md,
  },
});

export default ProfileOverflowMenu;
