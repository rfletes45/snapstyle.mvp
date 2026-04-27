/**
 * InboxFAB Component
 *
 * Multi-action floating action button for the inbox:
 * - New Message (DM)
 * - Add Friend
 *
 * Uses react-native-paper FAB.Group for expandable actions.
 *
 * @module components/chat/inbox/InboxFAB
 */

import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation";
import * as haptics from "@/utils/haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { memo, useCallback, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { FAB, Portal } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface InboxFABProps {
  /** Whether the FAB is visible */
  visible?: boolean;
  /** Opens the dedicated compose modal from the Messages screen */
  onNewMessagePress: () => void;
  /** Optional custom actions */
  customActions?: FABAction[];
}

interface FABAction {
  icon: string;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

// =============================================================================
// Component
// =============================================================================

/** Guard window (ms) to prevent double-tap navigation. */
const NAV_DEBOUNCE_MS = 500;

export const InboxFAB = memo(function InboxFAB({
  visible = true,
  onNewMessagePress,
  customActions,
}: InboxFABProps) {
  const { colors, isDark } = useAppTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [open, setOpen] = useState(false);
  const lastNavRef = useRef(0);

  const onStateChange = useCallback(({ open }: { open: boolean }) => {
    setOpen(open);
    if (open) {
      haptics.buttonPress();
    }
  }, []);

  /** Close the FAB menu and navigate, with double-tap guard. */
  const navigateOnce = useCallback((action: () => void) => {
    const now = Date.now();
    if (now - lastNavRef.current < NAV_DEBOUNCE_MS) return;
    lastNavRef.current = now;
    setOpen(false);
    action();
  }, []);

  const handleNewMessage = useCallback(() => {
    haptics.buttonPress();
    navigateOnce(() => {
      onNewMessagePress();
    });
  }, [navigateOnce, onNewMessagePress]);

  const handleAddFriend = useCallback(() => {
    haptics.buttonPress();
    navigateOnce(() => {
      // Navigate to Friends with the Add Friends sheet auto-opened
      navigation.navigate("Friends", { openAddFriends: true });
    });
  }, [navigation, navigateOnce]);

  // Default actions
  const defaultActions: FABAction[] = [
    {
      icon: "message-plus",
      label: "New Message",
      onPress: handleNewMessage,
      accessibilityLabel: "New Message - compose a chat",
    },
    {
      icon: "account-plus",
      label: "Add Friend",
      onPress: handleAddFriend,
      accessibilityLabel: "Add Friend — find and add new friends",
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
            accessibilityLabel: action.accessibilityLabel,
            style: {
              backgroundColor: colors.surfaceElevated ?? colors.surface,
              elevation: 3,
            },
            labelStyle: {
              backgroundColor: colors.surfaceElevated ?? colors.surface,
              color: colors.text,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 6,
              elevation: 2,
              fontWeight: "600" as const,
              overflow: "hidden" as const,
            },
            labelTextColor: colors.text,
            color: colors.primary,
          }))}
          onStateChange={onStateChange}
          style={styles.fabGroup}
          fabStyle={[styles.fab, { backgroundColor: colors.primary }]}
          color={colors.onPrimary}
          backdropColor={isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.15)"}
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
    paddingBottom: 110,
    paddingRight: 0,
  },
  fab: {
    backgroundColor: undefined,
  },
});
