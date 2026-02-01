/**
 * ReplyBubble Component (Enhanced)
 *
 * A polished, modern reply bubble that appears above the main message.
 * Shows a sleek preview of the original message being replied to,
 * connected to the main message with a smooth connector line.
 *
 * Design Improvements:
 * - Subtle gradient/glass effect background
 * - Primary color accent bar on left edge
 * - Improved typography hierarchy
 * - Smooth animations on appear
 * - Better visual connection to main message
 *
 * @module components/chat/ReplyBubble
 */

import { ReplyToMetadata } from "@/types/messaging";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import Animated, { FadeIn } from "react-native-reanimated";
import { BorderRadius, Spacing } from "../../../constants/theme";

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
    // Truncate to 60 chars for cleaner display
    const text = replyTo.textSnippet;
    return text.length > 60 ? text.substring(0, 60) + "…" : text;
  }

  switch (replyTo.kind) {
    case "media":
      return "Photo";
    case "voice":
      return "Voice message";
    case "file":
      return "File";
    case "system":
      return "System message";
    default:
      return "Message";
  }
}

/**
 * Get icon name for the message kind
 */
function getKindIcon(
  kind: ReplyToMetadata["kind"],
): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "media":
      return "image-outline";
    case "voice":
      return "mic-outline";
    case "file":
      return "document-outline";
    case "system":
      return "information-circle-outline";
    default:
      return "chatbubble-outline";
  }
}

// =============================================================================
// Connector Component
// =============================================================================

interface ConnectorProps {
  /** Whether the main message is sent by current user */
  isSentByMe: boolean;
  /** Whether the reply bubble is on the right side */
  replyOnRight: boolean;
  /** Color of the connector line */
  color: string;
}

/**
 * Sleek connector line that visually links the reply bubble to the main message.
 * Uses a vertical line with smooth edges.
 */
function Connector({ isSentByMe, replyOnRight, color }: ConnectorProps) {
  const messageOnRight = isSentByMe;
  const needsCurve = replyOnRight !== messageOnRight;

  if (!needsCurve) {
    // Same side - simple vertical connector
    return (
      <View
        style={[
          styles.connectorStraight,
          replyOnRight ? styles.connectorRight : styles.connectorLeft,
        ]}
      >
        <View style={[styles.connectorLine, { backgroundColor: color }]} />
      </View>
    );
  }

  // Different sides - curved connector
  const curveToRight = !replyOnRight && messageOnRight;

  return (
    <View style={styles.connectorCurved}>
      {/* Vertical segment */}
      <View
        style={[
          styles.curveVertical,
          { backgroundColor: color },
          curveToRight ? styles.curveVerticalLeft : styles.curveVerticalRight,
        ]}
      />
      {/* Corner piece */}
      <View
        style={[
          styles.curveCorner,
          { borderColor: color },
          curveToRight ? styles.curveCornerRight : styles.curveCornerLeft,
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
  const showMediaIcon = replyTo.kind !== "text" && !replyTo.textSnippet;

  // Accent color - primary for own messages, muted for others
  const accentColor = isReplyToMe
    ? theme.colors.primary
    : theme.dark
      ? "rgba(130, 130, 130, 0.9)"
      : "rgba(120, 120, 120, 0.9)";

  // Background with subtle glass effect
  const backgroundColor = theme.dark
    ? "rgba(50, 50, 50, 0.85)"
    : "rgba(245, 245, 245, 0.95)";

  // Connector color (subtle)
  const connectorColor = theme.dark
    ? "rgba(100, 100, 100, 0.6)"
    : "rgba(180, 180, 180, 0.7)";

  // Text colors
  const senderColor = isReplyToMe
    ? theme.colors.primary
    : theme.dark
      ? theme.colors.onSurface
      : theme.colors.onSurfaceVariant;

  const previewColor = theme.dark
    ? "rgba(200, 200, 200, 0.85)"
    : "rgba(80, 80, 80, 0.85)";

  // Alignment - reply bubble aligns based on original sender
  const alignRight = isReplyToMe;

  const content = (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[
        styles.container,
        alignRight ? styles.alignRight : styles.alignLeft,
      ]}
    >
      {/* Reply bubble with accent bar */}
      <View
        style={[
          styles.replyBubble,
          { backgroundColor },
          alignRight ? styles.replyBubbleRight : styles.replyBubbleLeft,
        ]}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        {/* Content area */}
        <View style={styles.contentArea}>
          {/* Sender row with reply icon */}
          <View style={styles.senderRow}>
            <Ionicons
              name="arrow-undo"
              size={12}
              color={senderColor}
              style={styles.replyIcon}
            />
            <Text
              style={[styles.senderName, { color: senderColor }]}
              numberOfLines={1}
            >
              {senderLabel}
            </Text>
          </View>

          {/* Preview row */}
          <View style={styles.previewRow}>
            {showMediaIcon && (
              <Ionicons
                name={getKindIcon(replyTo.kind)}
                size={14}
                color={previewColor}
                style={styles.mediaIcon}
              />
            )}
            <Text
              style={[styles.previewText, { color: previewColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {previewText}
            </Text>
          </View>
        </View>
      </View>

      {/* Connector line to main message */}
      <Connector
        isSentByMe={isSentByMe}
        replyOnRight={alignRight}
        color={connectorColor}
      />
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
    marginBottom: 4,
    width: "100%",
  },
  alignRight: {
    alignItems: "flex-end",
  },
  alignLeft: {
    alignItems: "flex-start",
  },

  // Reply bubble with glass effect
  replyBubble: {
    flexDirection: "row",
    maxWidth: "75%",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  replyBubbleRight: {
    borderTopRightRadius: BorderRadius.sm,
  },
  replyBubbleLeft: {
    borderTopLeftRadius: BorderRadius.sm,
  },

  // Accent bar on left edge
  accentBar: {
    width: 3,
    borderTopLeftRadius: BorderRadius.md,
    borderBottomLeftRadius: BorderRadius.md,
  },

  // Content area
  contentArea: {
    flex: 1,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    paddingLeft: Spacing.xs + 4,
  },

  // Sender row
  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  replyIcon: {
    marginRight: 4,
    opacity: 0.7,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Preview row
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mediaIcon: {
    marginRight: 4,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 17,
    flex: 1,
  },

  // Straight connector
  connectorStraight: {
    height: 14,
    marginTop: 2,
    width: "100%",
  },
  connectorRight: {
    alignItems: "flex-end",
    paddingRight: 18,
  },
  connectorLeft: {
    alignItems: "flex-start",
    paddingLeft: 18,
  },
  connectorLine: {
    width: 2,
    height: "100%",
    borderRadius: 1,
  },

  // Curved connector
  connectorCurved: {
    height: 18,
    marginTop: 2,
    width: "100%",
    position: "relative",
  },
  curveVertical: {
    width: 2,
    height: 7,
    position: "absolute",
    top: 0,
    borderRadius: 1,
  },
  curveVerticalLeft: {
    left: 18,
  },
  curveVerticalRight: {
    right: 18,
  },
  curveCorner: {
    width: 16,
    height: 16,
    position: "absolute",
    top: 6,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  curveCornerRight: {
    left: 18,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 10,
  },
  curveCornerLeft: {
    right: 18,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 10,
  },
});

export default ReplyBubble;
