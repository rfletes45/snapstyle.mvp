/**
 * ReplyBubble Component (H6)
 *
 * Renders the reply-to preview inside a message bubble.
 * Shows a condensed view of the original message being replied to.
 * Tappable to scroll to the original message.
 *
 * @module components/chat/ReplyBubble
 */

import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { ReplyToMetadata } from "@/types/messaging";
import { Spacing, BorderRadius } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

interface ReplyBubbleProps {
  /** Reply metadata to display */
  replyTo: ReplyToMetadata;
  /** Whether the parent message was sent by current user */
  isSentByMe: boolean;
  /** Called when user taps to scroll to original message */
  onPress?: () => void;
  /** Whether the replied message is from current user */
  isReplyToMe?: boolean;
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
      return "ℹ️ System message";
    default:
      return "Message";
  }
}

// =============================================================================
// Component
// =============================================================================

export function ReplyBubble({
  replyTo,
  isSentByMe,
  onPress,
  isReplyToMe = false,
}: ReplyBubbleProps) {
  const theme = useTheme();

  const previewText = getPreviewText(replyTo);
  const senderLabel = isReplyToMe ? "You" : replyTo.senderName || "User";

  // Colors based on whether this is in a sent or received bubble
  const accentColor = isSentByMe
    ? theme.colors.onPrimary
    : theme.colors.primary;
  const backgroundColor = isSentByMe
    ? "rgba(255, 255, 255, 0.15)"
    : "rgba(0, 0, 0, 0.05)";
  const textColor = isSentByMe
    ? theme.colors.onPrimary
    : theme.colors.onSurface;

  const content = (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Content */}
      <View style={styles.content}>
        {/* Thumbnail for media replies */}
        {replyTo.attachmentPreview?.thumbUrl && (
          <View
            style={[
              styles.thumbnail,
              { backgroundColor: "rgba(128, 128, 128, 0.2)" },
            ]}
          >
            <Text style={{ fontSize: 14 }}>📷</Text>
          </View>
        )}

        {/* Text content */}
        <View style={styles.textContent}>
          <Text
            variant="labelSmall"
            style={[styles.senderName, { color: accentColor }]}
            numberOfLines={1}
          >
            {senderLabel}
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.previewText, { color: textColor, opacity: 0.8 }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {previewText}
          </Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
    overflow: "hidden",
  },
  accentBar: {
    width: 3,
    minHeight: 32,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  thumbnail: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.xs,
  },
  textContent: {
    flex: 1,
  },
  senderName: {
    fontWeight: "600",
    marginBottom: 1,
  },
  previewText: {
    lineHeight: 16,
  },
});

export default ReplyBubble;
