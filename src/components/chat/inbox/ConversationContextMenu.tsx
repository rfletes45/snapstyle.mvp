/**
 * ConversationContextMenu Component
 *
 * Long-press context menu for conversation items.
 * Provides quick access to conversation actions:
 * - Pin/Unpin
 * - Mute/Unmute
 * - Mark as Unread
 * - View Profile (DM only)
 * - Delete/Leave Group (destructive)
 *
 * @module components/chat/inbox/ConversationContextMenu
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import * as haptics from "@/utils/haptics";
import { createLogger } from "@/utils/log";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useMemo } from "react";
import {
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Divider, Text } from "react-native-paper";

const interactionLog = createLogger("InboxInteraction");

// =============================================================================
// Types
// =============================================================================

interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export interface ConversationContextMenuProps {
  /** Whether the menu is visible */
  visible: boolean;
  /** Callback to close the menu */
  onClose: () => void;
  /** The conversation for which to show actions */
  conversation: InboxConversation | null;
  /** Position to render the menu */
  position: { x: number; y: number };
  /** Called when pin/unpin is pressed */
  onPin: () => void;
  /** Called when mute is pressed */
  onMute: () => void;
  /** Called when mark unread is pressed */
  onMarkUnread: () => void;
  /** Called when delete is pressed */
  onDelete: () => void;
  /** Called when archive/unarchive is pressed */
  onArchive?: () => void;
  /** Called when view profile is pressed (DM only) */
  onViewProfile?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const MENU_WIDTH = 220;
const SCREEN_PADDING = 16;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// =============================================================================
// Component
// =============================================================================

export const ConversationContextMenu = memo(function ConversationContextMenu({
  visible,
  onClose,
  conversation,
  position,
  onPin,
  onMute,
  onMarkUnread,
  onDelete,
  onArchive,
  onViewProfile,
}: ConversationContextMenuProps) {
  const { colors } = useAppTheme();

  // Build menu items based on conversation state
  const menuItems = useMemo((): MenuItem[] => {
    if (!conversation) return [];

    const items: MenuItem[] = [
      {
        icon: conversation.memberState.pinnedAt ? "pin-off" : "pin",
        label: conversation.memberState.pinnedAt ? "Unpin" : "Pin",
        onPress: onPin,
      },
      {
        icon: conversation.memberState.mutedUntil ? "bell" : "bell-off",
        label: conversation.memberState.mutedUntil ? "Unmute" : "Mute",
        onPress: onMute,
      },
      {
        icon: "email-mark-as-unread",
        label: "Mark as Unread",
        onPress: onMarkUnread,
      },
    ];

    // Add view profile for DMs
    if (conversation.type === "dm" && onViewProfile) {
      items.push({
        icon: "account",
        label: "View Profile",
        onPress: onViewProfile,
      });
    }

    // Add archive/unarchive action
    if (onArchive) {
      items.push({
        icon: conversation.memberState.archived
          ? "archive-arrow-up-outline"
          : "archive-outline",
        label: conversation.memberState.archived ? "Unarchive" : "Archive",
        onPress: onArchive,
      });
    }

    // Add destructive delete action last
    items.push({
      icon: conversation.type === "group" ? "exit-run" : "delete",
      label: conversation.type === "group" ? "Leave Group" : "Delete",
      onPress: onDelete,
      destructive: true,
    });

    return items;
  }, [
    conversation,
    onPin,
    onMute,
    onMarkUnread,
    onViewProfile,
    onArchive,
    onDelete,
  ]);

  // Calculate menu position to keep it on screen
  const menuPosition = useMemo(() => {
    let x = position.x;
    let y = position.y;

    // Estimate menu height based on items
    const estimatedHeight = menuItems.length * 48 + 16;

    // Keep menu within horizontal bounds
    if (x + MENU_WIDTH > SCREEN_WIDTH - SCREEN_PADDING) {
      x = SCREEN_WIDTH - MENU_WIDTH - SCREEN_PADDING;
    }
    if (x < SCREEN_PADDING) {
      x = SCREEN_PADDING;
    }

    // Keep menu within vertical bounds
    if (y + estimatedHeight > SCREEN_HEIGHT - SCREEN_PADDING) {
      y = SCREEN_HEIGHT - estimatedHeight - SCREEN_PADDING;
    }
    if (y < SCREEN_PADDING) {
      y = SCREEN_PADDING;
    }

    return { x, y };
  }, [position, menuItems.length]);

  useEffect(() => {
    if (!__DEV__ || !visible || !conversation) return;
    interactionLog.debug("context menu visible", {
      data: {
        conversationId: conversation.id,
        type: conversation.type,
        requestedX: position.x,
        requestedY: position.y,
        x: menuPosition.x,
        y: menuPosition.y,
        itemCount: menuItems.length,
      },
    });
  }, [
    conversation,
    menuItems.length,
    menuPosition.x,
    menuPosition.y,
    position.x,
    position.y,
    visible,
  ]);

  // Handle item press with haptic feedback
  const handleItemPress = useCallback(
    (item: MenuItem) => {
      if (__DEV__) {
        interactionLog.debug("context menu item pressed", {
          data: {
            action: item.label,
            conversationId: conversation?.id ?? null,
            type: conversation?.type ?? null,
            destructive: !!item.destructive,
          },
        });
      }
      if (item.destructive) {
        haptics.deleteWarning();
      } else {
        haptics.buttonPress();
      }
      onClose();
      item.onPress();
    },
    [conversation?.id, conversation?.type, onClose],
  );

  const handleBackdropPress = useCallback(() => {
    if (__DEV__) {
      interactionLog.debug("context menu backdrop pressed", {
        data: {
          conversationId: conversation?.id ?? null,
          type: conversation?.type ?? null,
        },
      });
    }
    onClose();
  }, [conversation?.id, conversation?.type, onClose]);

  if (!visible || !conversation) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.menu,
                {
                  backgroundColor: colors.surface,
                  top: menuPosition.y,
                  left: menuPosition.x,
                  shadowColor: colors.text,
                },
              ]}
            >
              {menuItems.map((item, index) => (
                <React.Fragment key={item.label}>
                  {/* Add divider before destructive item */}
                  {item.destructive && (
                    <Divider
                      style={[
                        styles.divider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  )}

                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <MaterialCommunityIcons
                      name={
                        item.icon as keyof typeof MaterialCommunityIcons.glyphMap
                      }
                      size={20}
                      color={item.destructive ? colors.error : colors.text}
                      style={styles.menuIcon}
                    />
                    <Text
                      style={[
                        styles.menuLabel,
                        {
                          color: item.destructive ? colors.error : colors.text,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  menuIcon: {
    marginRight: Spacing.md,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  divider: {
    marginVertical: Spacing.xs,
  },
});
