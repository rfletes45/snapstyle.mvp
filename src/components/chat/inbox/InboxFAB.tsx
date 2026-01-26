/**
 * InboxFAB Component
 *
 * Multi-action floating action button for the inbox:
 * - New Message (DM)
 * - New Group
 * - Add Friend
 *
 * Uses react-native-paper FAB.Group for expandable actions.
 *
 * @module components/chat/inbox/InboxFAB
 */

import { useAppTheme } from "@/store/ThemeContext";
import * as haptics from "@/utils/haptics";
import { useNavigation } from "@react-navigation/native";
import React, { memo, useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { FAB, Portal } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface InboxFABProps {
  /** Whether the FAB is visible */
  visible?: boolean;
  /** Optional custom actions */
  customActions?: FABAction[];
}

interface FABAction {
  icon: string;
  label: string;
  onPress: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const InboxFAB = memo(function InboxFAB({
  visible = true,
  customActions,
}: InboxFABProps) {
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);

  const onStateChange = useCallback(({ open }: { open: boolean }) => {
    setOpen(open);
    if (open) {
      haptics.buttonPress();
    }
  }, []);

  const handleNewMessage = useCallback(() => {
    haptics.buttonPress();
    // Navigate to Connections tab where users can start a new conversation
    (navigation as any).navigate("Connections");
  }, [navigation]);

  const handleNewGroup = useCallback(() => {
    haptics.buttonPress();
    // Navigate to group creation screen - this is within InboxStack
    (navigation as any).navigate("GroupChatCreate");
  }, [navigation]);

  const handleAddFriend = useCallback(() => {
    haptics.buttonPress();
    // Navigate to Connections tab for finding friends
    (navigation as any).navigate("Connections");
  }, [navigation]);

  // Default actions
  const defaultActions: FABAction[] = [
    {
      icon: "message-plus",
      label: "New Message",
      onPress: handleNewMessage,
    },
    {
      icon: "account-group-outline",
      label: "New Group",
      onPress: handleNewGroup,
    },
    {
      icon: "account-plus",
      label: "Add Friend",
      onPress: handleAddFriend,
    },
  ];

  const actions = customActions || defaultActions;

  return (
    visible && (
      <Portal>
        <FAB.Group
          open={open}
          visible={true}
          icon={open ? "close" : "plus"}
          actions={actions.map((action) => ({
            icon: action.icon,
            label: action.label,
            onPress: action.onPress,
            style: { backgroundColor: colors.surface },
            labelTextColor: colors.text,
            color: colors.primary,
          }))}
          onStateChange={onStateChange}
          style={styles.fabGroup}
          fabStyle={[styles.fab, { backgroundColor: colors.primary }]}
          color={colors.onPrimary}
          backdropColor={isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)"}
        />
      </Portal>
    )
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  fabGroup: {
    paddingBottom: 82,
    paddingRight: 0,
  },
  fab: {
    backgroundColor: undefined,
  },
});
