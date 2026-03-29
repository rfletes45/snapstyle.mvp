/**
 * StackedReplyReference — Discord-inspired inline reply reference for stacked mode.
 *
 * Renders a compact, timeline-native reference strip above the message body
 * in stacked (feed) display mode. Designed to sit inside the content column
 * of a stacked message row, flush with the text and avatar grid.
 *
 * Visual: 2px accent rail | ↩ SenderName · Preview text (truncated)
 *
 * Bubble mode continues to use ReplyBubbleNew.tsx (glass card + connector).
 *
 * @module components/chat/StackedReplyReference
 */

import { FEED_LAYOUT } from "@/chat/displayMode";
import type { ReplyToMetadata } from "@/types/messaging";
import { getKindIconIonicons, getPreviewText } from "@/utils/messagePreview";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

interface StackedReplyReferenceProps {
  /** Reply metadata to display */
  replyTo: ReplyToMetadata;
  /** Whether the replied-to message was sent by the current user */
  isReplyToMe?: boolean;
  /** Called when user taps to jump to original message */
  onPress?: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function StackedReplyReference({
  replyTo,
  isReplyToMe = false,
  onPress,
}: StackedReplyReferenceProps) {
  const theme = useTheme();

  const senderLabel = isReplyToMe ? "You" : replyTo.senderName || "Friend";
  const previewText = getPreviewText(replyTo, 80);
  const isNonText = replyTo.kind !== "text";
  const showIcon = isNonText && !replyTo.textSnippet;

  // Colors
  const accentColor = theme.colors.primary;
  const senderColor = isReplyToMe
    ? theme.colors.primary
    : theme.dark
      ? "rgba(185, 185, 195, 1)"
      : "rgba(90, 90, 100, 1)";
  const previewColor = theme.dark
    ? "rgba(155, 155, 165, 0.9)"
    : "rgba(110, 110, 120, 0.85)";
  const arrowColor = theme.dark
    ? "rgba(140, 140, 150, 0.7)"
    : "rgba(130, 130, 140, 0.6)";

  const content = (
    <View style={styles.container}>
      {/* Left accent rail */}
      <View style={[styles.accentRail, { backgroundColor: accentColor }]} />

      {/* Reply content */}
      <View style={styles.contentRow}>
        {/* Reply arrow icon */}
        <Ionicons
          name="return-up-back"
          size={12}
          color={arrowColor}
          style={styles.arrowIcon}
        />

        {/* Sender name */}
        <Text
          style={[styles.senderName, { color: senderColor }]}
          numberOfLines={1}
        >
          {senderLabel}
        </Text>

        {/* Separator dot */}
        <Text style={[styles.separator, { color: previewColor }]}>·</Text>

        {/* Content type icon for non-text */}
        {showIcon && (
          <Ionicons
            name={
              getKindIconIonicons(
                replyTo.kind,
              ) as keyof typeof Ionicons.glyphMap
            }
            size={12}
            color={previewColor}
            style={styles.kindIcon}
          />
        )}

        {/* Preview text */}
        <Text
          style={[styles.previewText, { color: previewColor }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {previewText}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.6}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
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
    alignItems: "stretch",
    marginBottom: FEED_LAYOUT.replyPreviewGap,
    paddingVertical: 2,
  },

  // 2px vertical accent rail — Discord-style reply indicator
  accentRail: {
    width: 2,
    borderRadius: 1,
    marginRight: 8,
  },

  // Horizontal content row: arrow + sender + dot + preview
  contentRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 18,
  },

  arrowIcon: {
    marginRight: 4,
  },

  senderName: {
    fontSize: 12.5,
    fontWeight: "600",
    flexShrink: 0,
  },

  separator: {
    fontSize: 12,
    marginHorizontal: 5,
    fontWeight: "400",
  },

  kindIcon: {
    marginRight: 3,
  },

  previewText: {
    fontSize: 12.5,
    lineHeight: 16,
    flex: 1,
  },
});

export default StackedReplyReference;
