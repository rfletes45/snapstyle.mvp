/**
 * FriendRequestItem Component
 *
 * Displays a single friend request in the inbox Requests tab.
 * Shows sender's avatar, name, username, and accept/decline buttons.
 *
 * @module components/chat/inbox/FriendRequestItem
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import type { FriendRequestWithUser } from "@/hooks/useFriendRequests";
import { useAppTheme } from "@/store/ThemeContext";
import { formatRelativeTime, toTimestamp } from "@/utils/dates";
import * as haptics from "@/utils/haptics";
import React, { memo, useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface FriendRequestItemProps {
  /** The friend request to display */
  request: FriendRequestWithUser;
  /** Called when accept button is pressed */
  onAccept: () => void;
  /** Called when decline button is pressed */
  onDecline: () => void;
  /** Called when the row is pressed (view profile) */
  onPress: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const FriendRequestItem = memo(function FriendRequestItem({
  request,
  onAccept,
  onDecline,
  onPress,
}: FriendRequestItemProps) {
  const { colors } = useAppTheme();
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [declineLoading, setDeclineLoading] = useState(false);

  const { fromUser, sentAt } = request;

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

  const timeText = formatRelativeTime(toTimestamp(sentAt));

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Friend request from ${fromUser.displayName}`}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <ProfilePictureWithDecoration
          pictureUrl={fromUser.profilePictureUrl}
          name={fromUser.displayName}
          decorationId={fromUser.decorationId}
          size={48}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {fromUser.displayName}
          </Text>
        </View>
        <Text
          style={[styles.subtitle, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          @{fromUser.username} • {timeText}
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
            Accept
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
    </TouchableOpacity>
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
  avatarPlaceholder: {
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
