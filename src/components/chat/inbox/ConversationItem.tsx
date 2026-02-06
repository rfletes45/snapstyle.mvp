/**
 * ConversationItem Component
 *
 * Displays a single conversation row in the inbox list with:
 * - Avatar (with online indicator for DMs)
 * - Name with pin/mute icons
 * - Last message preview
 * - Timestamp
 * - Unread badge
 *
 * @module components/chat/inbox/ConversationItem
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import { formatRelativeTime, toTimestamp } from "@/utils/dates";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useMemo } from "react";
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Badge, Text } from "react-native-paper";
import { Spacing } from "../../../../constants/theme";

// =============================================================================
// Text Highlighting Helper
// =============================================================================

/**
 * Highlights matching text within a string for search results
 */
function highlightMatchingText(
  text: string,
  searchTerm: string | undefined,
  colors: { primary: string },
): React.ReactNode {
  if (!searchTerm?.trim()) {
    return text;
  }

  const normalizedSearch = searchTerm.toLowerCase();
  const normalizedText = text.toLowerCase();
  const matchIndex = normalizedText.indexOf(normalizedSearch);

  if (matchIndex === -1) {
    return text;
  }

  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + searchTerm.length);
  const after = text.slice(matchIndex + searchTerm.length);

  return (
    <>
      {before}
      <Text
        style={{ backgroundColor: colors.primary + "30", fontWeight: "600" }}
      >
        {match}
      </Text>
      {after}
    </>
  );
}

// =============================================================================
// Types
// =============================================================================

export interface ConversationItemProps {
  /** The conversation to display */
  conversation: InboxConversation;
  /** Callback when the row is pressed */
  onPress: () => void;
  /** Callback when avatar is pressed (opens profile preview for DMs) */
  onAvatarPress: () => void;
  /** Callback when long pressed (opens context menu) - receives position for menu placement */
  onLongPress: (event?: { pageX: number; pageY: number }) => void;
  /** Optional search text to highlight in name and preview */
  highlightText?: string;
}

// =============================================================================
// Component
// =============================================================================

export const ConversationItem = memo(function ConversationItem({
  conversation,
  onPress,
  onAvatarPress,
  onLongPress,
  highlightText,
}: ConversationItemProps) {
  const { colors } = useAppTheme();

  const {
    name,
    avatarUrl,
    avatarConfig,
    profilePictureUrl,
    decorationId,
    type,
    lastMessage,
    memberState,
    unreadCount,
    isOnline,
  } = conversation;

  const isPinned = !!memberState.pinnedAt;
  const isMuted = !!memberState.mutedUntil;
  const isUnread = unreadCount > 0 || !!memberState.lastMarkedUnreadAt;

  // Format last message preview
  const previewText = useMemo(() => {
    if (!lastMessage) return "No messages yet";

    const prefix =
      type === "group" && lastMessage.senderName
        ? `${lastMessage.senderName}: `
        : "";

    switch (lastMessage.type) {
      case "image":
        return `${prefix}📷 Photo`;
      case "voice":
        return `${prefix}🎤 Voice message`;
      case "attachment":
        return `${prefix}📎 Attachment`;
      case "scorecard":
        return `${prefix}🎮 Shared a score`;
      case "game_invite":
        return `${prefix}${lastMessage.text || "🎮 Game invite"}`;
      default:
        return `${prefix}${lastMessage.text}`;
    }
  }, [lastMessage, type]);

  // Format timestamp
  const timeText = useMemo(() => {
    if (!lastMessage?.timestamp) return "";
    return formatRelativeTime(toTimestamp(lastMessage.timestamp));
  }, [lastMessage?.timestamp]);

  // Handle long press with position extraction
  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      onLongPress({ pageX, pageY });
    },
    [onLongPress],
  );

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.surface },
        isUnread && { backgroundColor: colors.primary + "08" },
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${name}${isUnread ? ", unread" : ""}${isPinned ? ", pinned" : ""}`}
    >
      {/* Avatar */}
      <TouchableOpacity
        onPress={onAvatarPress}
        style={styles.avatarContainer}
        accessibilityLabel={`View ${type === "dm" ? "profile" : "group info"}`}
      >
        {type === "group" && avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[
              styles.avatarPlaceholder,
              { width: 52, height: 52, borderRadius: 26 },
            ]}
          />
        ) : type === "group" ? (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="account-group"
              size={28}
              color={colors.textSecondary}
            />
          </View>
        ) : (
          <ProfilePictureWithDecoration
            pictureUrl={profilePictureUrl || avatarUrl}
            name={name}
            decorationId={decorationId}
            size={48}
          />
        )}

        {/* Online indicator (DM only) */}
        {type === "dm" && isOnline && (
          <View
            style={[
              styles.onlineIndicator,
              { backgroundColor: colors.success, borderColor: colors.surface },
            ]}
          />
        )}
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        {/* Top row: Name + Time */}
        <View style={styles.topRow}>
          <View style={styles.nameContainer}>
            {isPinned && (
              <MaterialCommunityIcons
                name="pin"
                size={14}
                color={colors.primary}
                style={styles.statusIcon}
              />
            )}
            <Text
              style={[
                styles.name,
                { color: colors.text },
                isUnread && styles.nameUnread,
              ]}
              numberOfLines={1}
            >
              {highlightText
                ? highlightMatchingText(name, highlightText, colors)
                : name}
            </Text>
            {isMuted && (
              <MaterialCommunityIcons
                name="bell-off"
                size={14}
                color={colors.textSecondary}
                style={styles.statusIcon}
              />
            )}
          </View>

          {timeText && (
            <Text style={[styles.time, { color: colors.textSecondary }]}>
              {timeText}
            </Text>
          )}
        </View>

        {/* Bottom row: Preview + Badge */}
        <View style={styles.bottomRow}>
          <Text
            style={[
              styles.preview,
              { color: colors.textSecondary },
              isUnread && styles.previewUnread,
              isUnread && { color: colors.text },
            ]}
            numberOfLines={1}
          >
            {highlightText
              ? highlightMatchingText(previewText, highlightText, colors)
              : previewText}
          </Text>

          {unreadCount > 0 && (
            <Badge
              size={20}
              style={[
                styles.badge,
                {
                  backgroundColor: isMuted
                    ? colors.textSecondary
                    : colors.primary,
                },
              ]}
            >
              !
            </Badge>
          )}
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
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 72,
  },
  avatarContainer: {
    position: "relative",
    marginRight: Spacing.md,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusIcon: {
    marginRight: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  nameUnread: {
    fontWeight: "700",
  },
  time: {
    fontSize: 13,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preview: {
    fontSize: 14,
    flex: 1,
    marginRight: Spacing.sm,
  },
  previewUnread: {
    fontWeight: "600",
  },
  badge: {
    marginLeft: Spacing.sm,
  },
});
