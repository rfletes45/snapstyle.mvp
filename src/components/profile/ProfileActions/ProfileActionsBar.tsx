/**
 * ProfileActionsBar Component
 *
 * Dynamic action buttons bar for user profiles.
 * Shows different actions based on the relationship between users.
 *
 * @module components/profile/ProfileActions/ProfileActionsBar
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Button, useTheme } from "react-native-paper";

import type { ProfileRelationship } from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface ProfileActionsBarProps {
  /** Relationship between current user and profile owner */
  relationship: ProfileRelationship;
  /** Whether any action is currently loading */
  isLoading?: boolean;
  /** Which specific action is loading */
  loadingAction?: string | null;
  /** Handler for add friend */
  onAddFriend?: () => void;
  /** Handler for cancel friend request */
  onCancelRequest?: () => void;
  /** Handler for accept friend request */
  onAcceptRequest?: () => void;
  /** Handler for decline friend request */
  onDeclineRequest?: () => void;
  /** Handler for message */
  onMessage?: () => void;
  /** Handler for call */
  onCall?: () => void;
  /** Handler for remove friend */
  onRemoveFriend?: () => void;
  /** Handler for unblock */
  onUnblock?: () => void;
  /** Handler for more options (block/report/mute menu) */
  onMoreOptions?: () => void;
  /** Custom container style */
  style?: ViewStyle;
}

// =============================================================================
// Component
// =============================================================================

function ProfileActionsBarBase({
  relationship,
  isLoading = false,
  loadingAction = null,
  onAddFriend,
  onCancelRequest,
  onAcceptRequest,
  onDeclineRequest,
  onMessage,
  onCall,
  onRemoveFriend,
  onUnblock,
  onMoreOptions,
  style,
}: ProfileActionsBarProps) {
  const theme = useTheme();
  const colors = {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    surface: theme.colors.surface,
    surfaceVariant: theme.colors.surfaceVariant,
    text: theme.colors.onSurface,
    textSecondary: theme.colors.onSurfaceVariant,
    error: theme.colors.error,
  };

  // Render based on relationship type
  switch (relationship.type) {
    case "self":
      // Own profile - no action buttons needed
      return null;

    case "stranger":
      // Not friends - show Add Friend button
      return (
        <View style={[styles.container, style]}>
          <Button
            mode="contained"
            onPress={onAddFriend}
            loading={loadingAction === "addFriend"}
            disabled={isLoading}
            icon={({ size, color }) => (
              <MaterialCommunityIcons
                name="account-plus"
                size={size}
                color={color}
              />
            )}
            style={styles.primaryButton}
          >
            Add Friend
          </Button>
          {onMoreOptions && (
            <Button
              mode="outlined"
              onPress={onMoreOptions}
              disabled={isLoading}
              style={styles.iconButton}
              contentStyle={styles.iconButtonContent}
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={20}
                color={colors.text}
              />
            </Button>
          )}
        </View>
      );

    case "pending_sent":
      // Request sent - show Cancel button
      return (
        <View style={[styles.container, style]}>
          <Button
            mode="outlined"
            onPress={onCancelRequest}
            loading={loadingAction === "cancelRequest"}
            disabled={isLoading}
            icon={({ size, color }) => (
              <MaterialCommunityIcons
                name="clock-outline"
                size={size}
                color={color}
              />
            )}
            style={styles.primaryButton}
          >
            Request Pending
          </Button>
          {onMoreOptions && (
            <Button
              mode="outlined"
              onPress={onMoreOptions}
              disabled={isLoading}
              style={styles.iconButton}
              contentStyle={styles.iconButtonContent}
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={20}
                color={colors.text}
              />
            </Button>
          )}
        </View>
      );

    case "pending_received":
      // Request received - show Accept/Decline buttons
      return (
        <View style={[styles.container, style]}>
          <Button
            mode="contained"
            onPress={onAcceptRequest}
            loading={loadingAction === "acceptRequest"}
            disabled={isLoading}
            icon={({ size, color }) => (
              <MaterialCommunityIcons name="check" size={size} color={color} />
            )}
            style={styles.halfButton}
          >
            Accept
          </Button>
          <Button
            mode="outlined"
            onPress={onDeclineRequest}
            loading={loadingAction === "declineRequest"}
            disabled={isLoading}
            style={styles.halfButton}
          >
            Decline
          </Button>
          {onMoreOptions && (
            <Button
              mode="outlined"
              onPress={onMoreOptions}
              disabled={isLoading}
              style={styles.iconButton}
              contentStyle={styles.iconButtonContent}
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={20}
                color={colors.text}
              />
            </Button>
          )}
        </View>
      );

    case "friend":
      // Friends - show Message, Call, and More buttons
      return (
        <View style={[styles.container, style]}>
          <Button
            mode="contained"
            onPress={onMessage}
            disabled={isLoading}
            icon={({ size, color }) => (
              <MaterialCommunityIcons
                name="message-text"
                size={size}
                color={color}
              />
            )}
            style={styles.halfButton}
          >
            Message
          </Button>
          <Button
            mode="outlined"
            onPress={onCall}
            disabled={isLoading}
            icon={({ size, color }) => (
              <MaterialCommunityIcons name="phone" size={size} color={color} />
            )}
            style={styles.halfButton}
          >
            Call
          </Button>
          {onMoreOptions && (
            <Button
              mode="outlined"
              onPress={onMoreOptions}
              disabled={isLoading}
              style={styles.iconButton}
              contentStyle={styles.iconButtonContent}
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={20}
                color={colors.text}
              />
            </Button>
          )}
        </View>
      );

    case "blocked_by_you":
      // You blocked them - show Unblock button
      return (
        <View style={[styles.container, style]}>
          <Button
            mode="outlined"
            onPress={onUnblock}
            loading={loadingAction === "unblock"}
            disabled={isLoading}
            textColor={colors.error}
            style={[styles.primaryButton, { borderColor: colors.error }]}
          >
            Unblock
          </Button>
        </View>
      );

    case "blocked_by_them":
      // They blocked you - limited options
      return (
        <View style={[styles.container, styles.blockedContainer, style]}>
          <MaterialCommunityIcons
            name="account-cancel"
            size={24}
            color={colors.textSecondary}
          />
        </View>
      );

    default:
      return null;
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  blockedContainer: {
    justifyContent: "center",
    opacity: 0.6,
  },
  primaryButton: {
    flex: 1,
  },
  halfButton: {
    flex: 1,
  },
  iconButton: {
    minWidth: 48,
    paddingHorizontal: 0,
  },
  iconButtonContent: {
    paddingHorizontal: 0,
  },
});

// =============================================================================
// Export
// =============================================================================

export const ProfileActionsBar = memo(ProfileActionsBarBase);
