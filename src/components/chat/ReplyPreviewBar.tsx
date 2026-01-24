/**
 * ReplyPreviewBar Component (H6)
 *
 * Shows a preview of the message being replied to above the input area.
 * Includes cancel button to clear the reply state.
 *
 * @module components/chat/ReplyPreviewBar
 */

import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, IconButton, useTheme } from "react-native-paper";
import { ReplyToMetadata, MessageKind } from "@/types/messaging";
import { Spacing, BorderRadius } from "../../../constants/theme";

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
// Helper Functions
// =============================================================================

/**
 * Get display text for the reply preview based on message kind
 */
function getPreviewText(replyTo: ReplyToMetadata): string {
  if (replyTo.textSnippet) {
    return replyTo.textSnippet;
  }

  switch (replyTo.kind) {
    case "media":
      return "📷 Photo";
    case "voice":
      return "🎤 Voice message";
    case "file":
      return "📎 File";
    case "system":
      return "System message";
    default:
      return "Message";
  }
}

/**
 * Get icon for the reply kind
 */
function getKindIcon(kind: MessageKind): string {
  switch (kind) {
    case "media":
      return "image";
    case "voice":
      return "microphone";
    case "file":
      return "file";
    case "system":
      return "information";
    default:
      return "message-text";
  }
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
  const senderLabel = isOwnMessage ? "You" : replyTo.senderName || "User";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      {/* Accent bar */}
      <View
        style={[styles.accentBar, { backgroundColor: theme.colors.primary }]}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Thumbnail preview for media */}
        {replyTo.attachmentPreview?.thumbUrl && (
          <View style={styles.thumbnailContainer}>
            {/* Placeholder for image - could be expo-image */}
            <View
              style={[
                styles.thumbnail,
                { backgroundColor: theme.colors.surfaceDisabled },
              ]}
            >
              <IconButton
                icon={getKindIcon(replyTo.kind)}
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
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  accentBar: {
    width: 3,
    height: "100%",
    borderRadius: 2,
    marginRight: Spacing.sm,
    minHeight: 36,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
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
