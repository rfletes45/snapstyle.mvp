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

import AppImage from "@/components/AppImage";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import { formatRelativeTime, toTimestamp } from "@/utils/dates";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useMemo } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Badge, Text } from "react-native-paper";
import { formatUnreadBadge } from "./unreadBadge";

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

export { formatUnreadBadge } from "./unreadBadge";

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
  const unreadBadgeText = formatUnreadBadge(unreadCount);

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
        { backgroundColor: colors.background },
        isUnread && { backgroundColor: colors.primary + "08" },
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${name}${isUnread ? `, ${unreadCount > 99 ? "99 plus" : unreadCount} unread` : ""}${isPinned ? ", pinned" : ""}`}
    >
      {/* Avatar */}
      <TouchableOpacity
        onPress={onAvatarPress}
        style={styles.avatarContainer}
        accessibilityLabel={`View ${type === "dm" ? "profile" : "group info"}`}
      >
        {type === "group" && avatarUrl ? (
          <AppImage
            source={{ uri: avatarUrl }}
            style={[
              styles.avatarPlaceholder,
              { width: 48, height: 48, borderRadius: 24 },
            ]}
            debugLabel="ConversationAvatar"
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
              size={26}
              color={colors.textSecondary}
            />
          </View>
        ) : (
          <ProfilePictureWithDecoration
            pictureUrl={profilePictureUrl || avatarUrl}
            name={name}
            decorationId={decorationId}
            size={44}
          />
        )}

        {/* Online indicator (DM only) */}
        {type === "dm" && isOnline && (
          <View
            style={[
              styles.onlineIndicator,
              {
                backgroundColor: colors.success,
                borderColor: colors.background,
              },
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
                size={13}
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
                size={13}
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
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={colors.textMuted}
            style={styles.chevron}
          />
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

          {unreadBadgeText && (
            <Badge
              size={18}
              style={[
                styles.badge,
                {
                  backgroundColor: isMuted
                    ? colors.textSecondary
                    : colors.primary,
                },
              ]}
            >
              {unreadBadgeText}
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 66,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
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
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  nameUnread: {
    fontWeight: "700",
  },
  time: {
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  preview: {
    fontSize: 13,
    flex: 1,
    marginRight: Spacing.xs,
  },
  previewUnread: {
    fontWeight: "600",
  },
  badge: {
    marginLeft: Spacing.xs,
  },
  chevron: {
    marginLeft: 2,
  },
});
