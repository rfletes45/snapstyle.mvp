/**
 * MoreOptionsMenu Component
 *
 * Menu for additional profile actions like block, report, mute, share.
 * Displayed as a bottom sheet or dropdown menu.
 *
 * @module components/profile/ProfileActions/MoreOptionsMenu
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ProfileRelationship } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface MoreOptionsMenuProps {
  /** Whether the menu is visible */
  visible: boolean;
  /** Relationship between current user and profile owner */
  relationship: ProfileRelationship;
  /** Whether the user is muted */
  isMuted?: boolean;
  /** Target user's display name (for confirmation messages) */
  targetDisplayName: string;
  /** Handler for close */
  onClose: () => void;
  /** Handler for share profile */
  onShareProfile?: () => void;
  /** Handler for copy profile link */
  onCopyLink?: () => void;
  /** Handler for mute/unmute */
  onToggleMute?: () => void;
  /** Handler for remove friend */
  onRemoveFriend?: () => void;
  /** Handler for block */
  onBlock?: () => void;
  /** Handler for report */
  onReport?: () => void;
}

// =============================================================================
// Menu Option Component
// =============================================================================

interface MenuOptionProps {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

function MenuOption({
  icon,
  label,
  onPress,
  destructive = false,
  disabled = false,
}: MenuOptionProps) {
  const theme = useTheme();
  const colors = {
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    error: theme.colors.error,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[styles.menuOption, disabled && styles.menuOptionDisabled]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={22}
        color={destructive ? colors.error : colors.text}
      />
      <Text
        style={[
          styles.menuOptionText,
          { color: destructive ? colors.error : colors.text },
          disabled && { color: colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// =============================================================================
// Component
// =============================================================================

function MoreOptionsMenuBase({
  visible,
  relationship,
  isMuted = false,
  targetDisplayName,
  onClose,
  onShareProfile,
  onCopyLink,
  onToggleMute,
  onRemoveFriend,
  onBlock,
  onReport,
}: MoreOptionsMenuProps) {
  const theme = useTheme();
  const colors = {
    background: theme.colors.background,
    surface: theme.colors.surface,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    error: theme.colors.error,
    overlay: "rgba(0, 0, 0, 0.5)",
  };
  const insets = useSafeAreaInsets();

  // Determine available actions based on relationship
  const isFriend = relationship.type === "friend";
  const isBlocked = relationship.type === "blocked_by_you";
  const canShare = relationship.type !== "blocked_by_them";
  const canReport =
    relationship.type !== "self" && relationship.type !== "blocked_by_you";
  const canBlock =
    relationship.type !== "self" && relationship.type !== "blocked_by_you";

  const handleOptionPress = useCallback(
    (handler?: () => void) => {
      onClose();
      // Small delay to allow menu to close before action
      if (handler) {
        setTimeout(handler, 200);
      }
    },
    [onClose],
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <View style={styles.backdropInner} />
      </Pressable>

      {/* Menu Sheet */}
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surface,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View
            style={[styles.handle, { backgroundColor: colors.textSecondary }]}
          />
        </View>

        {/* Title */}
        <Text style={[styles.sheetTitle, { color: colors.text }]}>
          {targetDisplayName}
        </Text>

        <Divider style={styles.divider} />

        {/* Share Options */}
        {canShare && (
          <>
            {onShareProfile && (
              <MenuOption
                icon="share-variant"
                label="Share Profile"
                onPress={() => handleOptionPress(onShareProfile)}
              />
            )}
            {onCopyLink && (
              <MenuOption
                icon="link"
                label="Copy Profile Link"
                onPress={() => handleOptionPress(onCopyLink)}
              />
            )}
            <Divider style={styles.divider} />
          </>
        )}

        {/* Friend Options */}
        {isFriend && (
          <>
            {onToggleMute && (
              <MenuOption
                icon={isMuted ? "bell" : "bell-off"}
                label={isMuted ? "Unmute" : "Mute"}
                onPress={() => handleOptionPress(onToggleMute)}
              />
            )}
            {onRemoveFriend && (
              <MenuOption
                icon="account-remove"
                label="Remove Friend"
                onPress={() => handleOptionPress(onRemoveFriend)}
                destructive
              />
            )}
            <Divider style={styles.divider} />
          </>
        )}

        {/* Moderation Options */}
        {canBlock && (
          <MenuOption
            icon="account-cancel"
            label="Block"
            onPress={() => handleOptionPress(onBlock)}
            destructive
          />
        )}
        {canReport && (
          <MenuOption
            icon="flag"
            label="Report"
            onPress={() => handleOptionPress(onReport)}
            destructive
          />
        )}

        <Divider style={styles.divider} />

        {/* Cancel */}
        <MenuOption icon="close" label="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdropInner: {
    flex: 1,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 12,
  },
  divider: {
    marginVertical: 4,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 14,
  },
  menuOptionDisabled: {
    opacity: 0.5,
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: "500",
  },
});

// =============================================================================
// Export
// =============================================================================

export const MoreOptionsMenu = memo(MoreOptionsMenuBase);
