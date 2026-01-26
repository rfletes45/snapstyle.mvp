/**
 * ReplyBubble Component (H6)
 *
 * Apple Messages-style reply bubble that appears above the main message.
 * Shows a smaller, outline-style preview of the original message being replied to,
 * connected to the main message with a curved connector line.
 *
 * Design:
 * - Reply bubble uses outline/border style (hollow) for visual distinction
 * - Curved connector line flows from reply bubble down to the main message
 * - Reply bubble aligns based on who sent the ORIGINAL message
 * - Connector curves toward the current sender's message
 *
 * @module components/chat/ReplyBubble
 */

import { ReplyToMetadata } from "@/types/messaging";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

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
// Curved Connector Component
// =============================================================================

interface CurvedConnectorProps {
  /** Whether the main message is sent by current user (determines curve direction) */
  isSentByMe: boolean;
  /** Whether the reply bubble is on the right side */
  replyOnRight: boolean;
  /** Color of the connector line */
  color: string;
}

/**
 * Curved connector line that flows from reply bubble toward main message.
 * Uses View-based approach for compatibility (no SVG dependency).
 * Shows a small curved tail pointing toward the message.
 */
function CurvedConnector({
  isSentByMe,
  replyOnRight,
  color,
}: CurvedConnectorProps) {
  // Determine curve direction based on where reply bubble is vs where message is
  // Reply bubble aligns to original sender, message aligns to current sender
  // If reply is on left (replying to their message) and I'm sending (message on right): curve toward right
  // If reply is on right (replying to my message) and they're sending (message on left): curve toward left
  const messageOnRight = isSentByMe;
  const needsCurve = replyOnRight !== messageOnRight;

  if (!needsCurve) {
    // Same side - just a short vertical line
    return (
      <View
        style={[
          styles.straightConnector,
          replyOnRight ? styles.connectorAlignRight : styles.connectorAlignLeft,
        ]}
      >
        <View style={[styles.verticalLine, { backgroundColor: color }]} />
      </View>
    );
  }

  // Curved connector - small curve pointing toward the message
  // If reply is on LEFT and message is on RIGHT: curve goes down-right (toward right)
  // If reply is on RIGHT and message is on LEFT: curve goes down-left (toward left)
  const curveToRight = !replyOnRight && messageOnRight;

  return (
    <View style={styles.curvedConnectorContainer}>
      {/* Vertical segment coming down from reply bubble */}
      <View
        style={[
          styles.curveVerticalSegment,
          { backgroundColor: color },
          curveToRight ? styles.curveVerticalLeft : styles.curveVerticalRight,
        ]}
      />
      {/* Corner piece - just a small curve */}
      <View
        style={[
          styles.curveCorner,
          { borderColor: color },
          curveToRight ? styles.curveCornerToRight : styles.curveCornerToLeft,
        ]}
      />
    </View>
  );
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

  // Outline/border color based on original message sender
  // Uses theme-aware muted colors for the hollow bubble border
  const borderColor = isReplyToMe
    ? theme.colors.primary
    : theme.dark
      ? "rgba(120, 120, 120, 0.8)"
      : "rgba(160, 160, 160, 0.9)";

  const textColor = theme.colors.onSurface;

  const connectorColor = theme.dark
    ? "rgba(128, 128, 128, 0.6)"
    : "rgba(150, 150, 150, 0.7)";

  // Apple Messages style: Reply preview aligns based on who sent the ORIGINAL message
  // NOT based on who is sending the reply. This creates the visual thread.
  const replyBubbleAlignRight = isReplyToMe;

  const content = (
    <View
      style={[
        styles.container,
        replyBubbleAlignRight ? styles.alignRight : styles.alignLeft,
      ]}
    >
      {/* Mini reply bubble - outline/hollow style */}
      <View
        style={[
          styles.replyBubble,
          { borderColor: borderColor },
          replyBubbleAlignRight
            ? styles.replyBubbleRight
            : styles.replyBubbleLeft,
        ]}
      >
        {/* Sender label */}
        <Text
          style={[styles.senderName, { color: theme.colors.primary }]}
          numberOfLines={1}
        >
          {senderLabel}
        </Text>

        {/* Message preview */}
        <Text
          style={[styles.previewText, { color: textColor, opacity: 0.7 }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {previewText}
        </Text>
      </View>

      {/* Curved connector line - flows from reply bubble to main message */}
      <CurvedConnector
        isSentByMe={isSentByMe}
        replyOnRight={replyBubbleAlignRight}
        color={connectorColor}
      />
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
    marginBottom: 4,
    paddingHorizontal: 4,
    width: "100%", // Take full width so alignItems works correctly
  },
  alignRight: {
    alignItems: "flex-end",
  },
  alignLeft: {
    alignItems: "flex-start",
  },
  // Hollow/outline style reply bubble
  replyBubble: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    maxWidth: "75%",
    borderWidth: 1.5,
    backgroundColor: "transparent", // Hollow inside
  },
  replyBubbleRight: {
    borderBottomRightRadius: 4,
  },
  replyBubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 1,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 16,
  },

  // Straight connector (when reply and message on same side)
  straightConnector: {
    height: 16,
    marginTop: 2,
    width: "100%",
  },
  connectorAlignRight: {
    alignItems: "flex-end",
    paddingRight: 16,
  },
  connectorAlignLeft: {
    alignItems: "flex-start",
    paddingLeft: 16,
  },
  verticalLine: {
    width: 2,
    height: "100%",
    borderRadius: 1,
  },

  // Curved connector (when reply and message on opposite sides)
  curvedConnectorContainer: {
    height: 20,
    marginTop: 2,
    width: "100%",
    position: "relative",
  },

  // Vertical segment of the curve
  curveVerticalSegment: {
    width: 2,
    height: 8,
    position: "absolute",
    top: 0,
    borderRadius: 1,
  },
  curveVerticalLeft: {
    left: 16,
  },
  curveVerticalRight: {
    right: 16,
  },

  // Corner piece using border - small curve pointing toward message
  curveCorner: {
    width: 18,
    height: 18,
    position: "absolute",
    top: 7.7,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  curveCornerToRight: {
    left: 16,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 10,
  },
  curveCornerToLeft: {
    right: 16,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 10,
  },
});

export default ReplyBubble;
