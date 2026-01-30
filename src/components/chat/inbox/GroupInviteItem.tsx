/**
 * GroupInviteItem Component
 *
 * Displays a single group invite in the inbox Requests tab.
 * Shows group name, inviter info, and accept/decline buttons.
 *
 * @module components/chat/inbox/GroupInviteItem
 */

import { useAppTheme } from "@/store/ThemeContext";
import type { GroupInvite } from "@/types/models";
import { formatRelativeTime, toTimestamp } from "@/utils/dates";
import * as haptics from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Spacing } from "../../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface GroupInviteItemProps {
  /** The group invite to display */
  invite: GroupInvite;
  /** Called when accept button is pressed */
  onAccept: () => void;
  /** Called when decline button is pressed */
  onDecline: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const GroupInviteItem = memo(function GroupInviteItem({
  invite,
  onAccept,
  onDecline,
}: GroupInviteItemProps) {
  const { colors } = useAppTheme();
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [declineLoading, setDeclineLoading] = useState(false);

  const handleAccept = useCallback(async () => {
    haptics.friendRequestAction();
    setAcceptLoading(true);
    try {
      await onAccept();
    } finally {
      setAcceptLoading(false);
    }
  }, [onAccept]);

  const handleDecline = useCallback(async () => {
    haptics.buttonPress();
    setDeclineLoading(true);
    try {
      await onDecline();
    } finally {
      setDeclineLoading(false);
    }
  }, [onDecline]);

  const timeText = formatRelativeTime(toTimestamp(invite.createdAt));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Group Icon */}
      <View style={styles.avatarContainer}>
        <View
          style={[
            styles.groupIconContainer,
            { backgroundColor: colors.primary + "20" },
          ]}
        >
          <MaterialCommunityIcons
            name="account-group"
            size={28}
            color={colors.primary}
          />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {invite.groupName}
          </Text>
        </View>
        <Text
          style={[styles.subtitle, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          Invited by {invite.fromDisplayName} • {timeText}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            compact
            onPress={handleAccept}
            loading={acceptLoading}
            disabled={acceptLoading || declineLoading}
            style={styles.acceptButton}
            labelStyle={styles.buttonLabel}
          >
            Join
          </Button>
          <Button
            mode="outlined"
            compact
            onPress={handleDecline}
            loading={declineLoading}
            disabled={acceptLoading || declineLoading}
            style={styles.declineButton}
            labelStyle={styles.buttonLabel}
          >
            Decline
          </Button>
        </View>
      </View>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  groupIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  acceptButton: {
    minWidth: 80,
  },
  declineButton: {
    minWidth: 80,
  },
  buttonLabel: {
    fontSize: 13,
  },
});
