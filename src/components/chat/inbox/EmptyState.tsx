/**
 * EmptyState Component
 *
 * Displays contextual empty states for the inbox:
 * - No conversations: New user state
 * - All caught up: No unread messages
 * - Archive empty: No archived conversations
 * - No results: Search returned nothing
 *
 * @module components/chat/inbox/EmptyState
 */

import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

export type EmptyStateType =
  | "noConversations"
  | "allCaughtUp"
  | "archiveEmpty"
  | "noSearchResults"
  | "noGroups"
  | "noDMs"
  | "noRequests";

export interface EmptyStateProps {
  /** Type of empty state to display */
  type: EmptyStateType;
  /** Optional: Show a CTA button */
  showAction?: boolean;
  /** Optional: Custom action button handler */
  onAction?: () => void;
  /** Optional: Custom action button label */
  actionLabel?: string;
}

// =============================================================================
// Content Config
// =============================================================================

interface EmptyStateContent {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description: string;
  defaultActionLabel?: string;
}

const EMPTY_STATE_CONTENT: Record<EmptyStateType, EmptyStateContent> = {
  noConversations: {
    icon: "chat-outline",
    title: "No conversations yet",
    description:
      "Start chatting with friends or create a group to get started!",
    defaultActionLabel: "Start a Chat",
  },
  allCaughtUp: {
    icon: "check-circle-outline",
    title: "You're all caught up!",
    description: "No unread messages. Enjoy your day!",
  },
  archiveEmpty: {
    icon: "archive-outline",
    title: "Archive is empty",
    description: "Archived conversations will appear here.",
  },
  noSearchResults: {
    icon: "magnify",
    title: "No results found",
    description: "Try a different search term or check your filters.",
  },
  noGroups: {
    icon: "account-group-outline",
    title: "No groups yet",
    description:
      "Create or join a group to chat with multiple friends at once.",
    defaultActionLabel: "Create Group",
  },
  noDMs: {
    icon: "chat-processing-outline",
    title: "No direct messages",
    description: "Start a conversation with a friend!",
    defaultActionLabel: "New Message",
  },
  noRequests: {
    icon: "account-plus-outline",
    title: "No pending requests",
    description: "Friend requests and invites will appear here.",
  },
};

// =============================================================================
// Component
// =============================================================================

export const EmptyState = memo(function EmptyState({
  type,
  showAction = false,
  onAction,
  actionLabel,
}: EmptyStateProps) {
  const { colors } = useAppTheme();
  const content = EMPTY_STATE_CONTENT[type];

  const buttonLabel = actionLabel || content.defaultActionLabel;

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name={content.icon}
        size={64}
        color={colors.textMuted}
        style={styles.icon}
      />

      <Text style={[styles.title, { color: colors.text }]}>
        {content.title}
      </Text>

      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {content.description}
      </Text>

      {showAction && buttonLabel && onAction && (
        <Button
          mode="contained"
          onPress={onAction}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          {buttonLabel}
        </Button>
      )}
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  icon: {
    marginBottom: Spacing.lg,
    opacity: 0.6,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  button: {
    marginTop: Spacing.md,
  },
  buttonContent: {
    paddingHorizontal: Spacing.md,
  },
});
