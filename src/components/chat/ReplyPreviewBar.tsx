/**
 * ReplyPreviewBar Component (H6)
 *
 * Shows a preview of the message being replied to above the input area.
 * Includes cancel button to clear the reply state.
 *
 * @module components/chat/ReplyPreviewBar
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { ReplyToMetadata } from "@/types/messaging";
import { getKindIconMCI, getPreviewText } from "@/utils/messagePreview";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

interface ReplyPreviewBarProps {
  /** Reply metadata to display */
  replyTo: ReplyToMetadata;
  /** Called when user cancels the reply */
  onCancel: () => void;
  /** Whether the replied message was sent by current user */
  isOwnMessage?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ReplyPreviewBar({
  replyTo,
  onCancel,
  isOwnMessage = false,
}: ReplyPreviewBarProps) {
  const theme = useTheme();

  const previewText = getPreviewText(replyTo);
  const senderLabel = isOwnMessage ? "yourself" : replyTo.senderName || "User";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.dark
            ? "rgba(60, 60, 60, 0.9)"
            : "rgba(230, 230, 230, 0.95)",
        },
      ]}
    >
      {/* Content */}
      <View style={styles.content}>
        {/* Reply icon */}
        <View style={styles.iconContainer}>
          <IconButton
            icon="reply"
            size={18}
            iconColor={theme.colors.primary}
            style={styles.replyIcon}
          />
        </View>

        {/* Thumbnail preview for media */}
        {replyTo.attachmentPreview?.thumbUrl && (
          <View style={styles.thumbnailContainer}>
            <View
              style={[
                styles.thumbnail,
                { backgroundColor: theme.colors.surfaceDisabled },
              ]}
            >
              <IconButton
                icon={getKindIconMCI(replyTo.kind)}
                size={16}
                iconColor={theme.colors.onSurfaceDisabled}
              />
            </View>
          </View>
        )}

        {/* Text content */}
        <View style={styles.textContainer}>
          <Text
            variant="labelSmall"
            style={[styles.senderName, { color: theme.colors.primary }]}
            numberOfLines={1}
          >
            Replying to {senderLabel}
          </Text>
          <Text
            variant="bodySmall"
            style={[
              styles.previewText,
              { color: theme.colors.onSurfaceVariant },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {previewText}
          </Text>
        </View>
      </View>

      {/* Cancel button */}
      <TouchableOpacity
        onPress={onCancel}
        style={styles.cancelButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <IconButton
          icon="close"
          size={18}
          iconColor={theme.colors.onSurfaceVariant}
          style={styles.cancelIcon}
        />
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    marginRight: Spacing.xs,
  },
  replyIcon: {
    margin: 0,
    width: 28,
    height: 28,
  },
  thumbnailContainer: {
    marginRight: Spacing.sm,
  },
  thumbnail: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
  },
  senderName: {
    fontWeight: "600",
    marginBottom: 2,
  },
  previewText: {
    opacity: 0.8,
  },
  cancelButton: {
    marginLeft: Spacing.xs,
  },
  cancelIcon: {
    margin: 0,
  },
});

export default ReplyPreviewBar;
