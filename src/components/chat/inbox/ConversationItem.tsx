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
import { TypingPreview } from "@/components/chat/TypingIndicator";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import { formatRelativeTime, toTimestamp } from "@/utils/dates";
import { createLogger, isDebugEnabled } from "@/utils/log";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Badge, Text } from "react-native-paper";
import { formatUnreadBadge } from "./unreadBadge";

const interactionLog = createLogger("InboxInteraction");
const avatarLog = createLogger("InboxAvatar");

const DEFAULT_TOUCH_POSITION = { pageX: 100, pageY: 200 };
const GROUP_AVATAR_RETRY_DELAY_MS = 250;

function getTouchPosition(event?: GestureResponderEvent) {
  if (!event?.nativeEvent) return null;
  return {
    pageX: event.nativeEvent.pageX,
    pageY: event.nativeEvent.pageY,
  };
}

// =============================================================================
// Text Highlighting Helper
// =============================================================================

/**
 * Highlights matching text within a string for search results
 */
function highlightMatchingText(
  text: string,
  searchTerm: string | undefined,
  colors: {
    primary: string;
    highlightBackground?: string;
    highlightText?: string;
  },
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
        style={{
          backgroundColor: colors.highlightBackground ?? colors.primary + "30",
          color: colors.highlightText,
          fontWeight: "600",
        }}
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
  /** Whether someone is typing in this conversation */
  isTyping?: boolean;
  /** Callback when the row is pressed */
  onPress: () => void;
  /** Callback when avatar is pressed (opens profile preview for DMs) */
  onAvatarPress: () => void;
  /** Callback when long pressed (opens context menu) - receives position for menu placement */
  onLongPress?: (event?: { pageX: number; pageY: number }) => void;
  /** Callback on finger-down (for early warmup before tap completes) */
  onPressIn?: () => void;
  /** Optional search text to highlight in name and preview */
  highlightText?: string;
}

export { formatUnreadBadge } from "./unreadBadge";

interface GroupConversationAvatarProps {
  avatarUrl?: string | null;
  conversationId: string;
}

const GroupConversationAvatar = memo(function GroupConversationAvatar({
  avatarUrl,
  conversationId,
}: GroupConversationAvatarProps) {
  const { colors } = useAppTheme();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [hasRetried, setHasRetried] = useState(false);

  useEffect(() => {
    setRetryNonce(0);
    setHasRetried(false);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [avatarUrl]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  const handleLoad = useCallback(() => {
    if (__DEV__ && isDebugEnabled("CHAT")) {
      avatarLog.debug("group avatar loaded", {
        data: {
          conversationId,
          hasAvatarUrl: !!avatarUrl,
        },
      });
    }
  }, [avatarUrl, conversationId]);

  const handleError = useCallback(() => {
    if (__DEV__) {
      avatarLog.warn("group avatar load failed", {
        data: {
          conversationId,
          hasAvatarUrl: !!avatarUrl,
          willRetry: !!avatarUrl && !hasRetried,
        },
      });
    }

    if (!avatarUrl || hasRetried) return;
    setHasRetried(true);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setRetryNonce((prev) => prev + 1);
    }, GROUP_AVATAR_RETRY_DELAY_MS);
  }, [avatarUrl, conversationId, hasRetried]);

  return (
    <View
      style={[
        styles.avatarPlaceholder,
        styles.groupAvatarFrame,
        { backgroundColor: colors.surfaceVariant },
      ]}
    >
      <MaterialCommunityIcons
        name="account-group"
        size={27}
        color={colors.textSecondary}
      />
      {avatarUrl ? (
        <AppImage
          key={`${avatarUrl}:${retryNonce}`}
          source={{ uri: avatarUrl }}
          style={styles.groupAvatarImage}
          debugLabel="ConversationAvatar"
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : null}
    </View>
  );
});

// =============================================================================
// Component
// =============================================================================

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isTyping = false,
  onPress,
  onAvatarPress,
  onLongPress,
  onPressIn,
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

  useEffect(() => {
    if (!isDebugEnabled("CHAT")) return;
    interactionLog.debug("row render", {
      data: {
        conversationId: conversation.id,
        type,
        hasOnPress: typeof onPress === "function",
        hasOnLongPress: typeof onLongPress === "function",
        hasOnPressIn: typeof onPressIn === "function",
        isPinned,
        isMuted,
        isUnread,
      },
    });
  }, [
    conversation.id,
    isMuted,
    isPinned,
    isUnread,
    onLongPress,
    onPress,
    onPressIn,
    type,
  ]);

  // Format last message preview
  const previewText = useMemo(() => {
    if (!lastMessage) return "No messages yet";

    const prefix =
      type === "group" && lastMessage.senderName
        ? `${lastMessage.senderName}: `
        : "";

    // Scorecards carry a JSON sentinel in their text. Never surface
    // that raw payload in the inbox — substitute the generic label.
    if (
      typeof lastMessage.text === "string" &&
      lastMessage.text.startsWith("[SCORECARD_V1]")
    ) {
      return `${prefix}Game Scorecard`;
    }

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

  // Keep a fallback coordinate from press-in in case a platform omits the
  // long-press event payload.
  const lastTouchPos = useRef(DEFAULT_TOUCH_POSITION);
  const longPressFiredRef = useRef(false);
  const longPressSuppressTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const clearLongPressSuppression = useCallback(() => {
    longPressFiredRef.current = false;
    if (longPressSuppressTimerRef.current) {
      clearTimeout(longPressSuppressTimerRef.current);
      longPressSuppressTimerRef.current = null;
    }
  }, []);

  const armLongPressSuppression = useCallback(() => {
    longPressFiredRef.current = true;
    if (longPressSuppressTimerRef.current) {
      clearTimeout(longPressSuppressTimerRef.current);
    }
    longPressSuppressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = false;
      longPressSuppressTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => clearLongPressSuppression, [clearLongPressSuppression]);

  const handlePress = useCallback(() => {
    if (longPressFiredRef.current) {
      clearLongPressSuppression();
      if (__DEV__) {
        interactionLog.debug("row tap suppressed after long-press", {
          data: { conversationId: conversation.id, type },
        });
      }
      return;
    }

    if (__DEV__) {
      interactionLog.debug("row tap fired", {
        data: { conversationId: conversation.id, type },
      });
    }
    onPress();
  }, [clearLongPressSuppression, conversation.id, onPress, type]);

  const handleAvatarPress = useCallback(() => {
    if (longPressFiredRef.current) {
      clearLongPressSuppression();
      if (__DEV__) {
        interactionLog.debug("avatar tap suppressed after long-press", {
          data: { conversationId: conversation.id, type },
        });
      }
      return;
    }

    if (__DEV__) {
      interactionLog.debug("avatar tap fired", {
        data: { conversationId: conversation.id, type },
      });
    }
    onAvatarPress();
  }, [clearLongPressSuppression, conversation.id, onAvatarPress, type]);

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      const position = getTouchPosition(event);
      if (position) {
        lastTouchPos.current = position;
      }
      if (__DEV__) {
        interactionLog.debug("row press-in fired", {
          data: {
            conversationId: conversation.id,
            type,
            hasPosition: !!position,
            pageX: position?.pageX,
            pageY: position?.pageY,
          },
        });
      }
      onPressIn?.();
    },
    [conversation.id, onPressIn, type],
  );

  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (!onLongPress) return;
      armLongPressSuppression();
      const eventPosition = getTouchPosition(event);
      const position = eventPosition ?? lastTouchPos.current;
      if (__DEV__) {
        interactionLog.debug("row long-press fired", {
          data: {
            conversationId: conversation.id,
            type,
            usedEventPosition: !!eventPosition,
            pageX: position.pageX,
            pageY: position.pageY,
          },
        });
      }
      onLongPress(position);
    },
    [armLongPressSuppression, conversation.id, onLongPress, type],
  );

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.background }]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onLongPress={onLongPress ? handleLongPress : undefined}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${name}${isUnread ? `, ${unreadCount > 99 ? "99 plus" : unreadCount} unread` : ""}${isPinned ? ", pinned" : ""}`}
    >
      {/* Avatar */}
      <TouchableOpacity
        onPress={handleAvatarPress}
        onPressIn={handlePressIn}
        onLongPress={onLongPress ? handleLongPress : undefined}
        style={styles.avatarContainer}
        accessibilityLabel={`View ${type === "dm" ? "profile" : "group info"}`}
      >
        {type === "group" ? (
          <GroupConversationAvatar
            avatarUrl={avatarUrl}
            conversationId={conversation.id}
          />
        ) : (
          <ProfilePictureWithDecoration
            pictureUrl={profilePictureUrl || avatarUrl}
            name={name}
            decorationId={decorationId}
            size={46}
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
            size={19}
            color={colors.textMuted}
            style={styles.chevron}
          />
        </View>

        {/* Bottom row: Preview + Badge */}
        <View style={styles.bottomRow}>
          {isTyping ? (
            <TypingPreview visible />
          ) : (
            <Text
              style={[
                styles.preview,
                { color: colors.textSecondary },
                isUnread && styles.previewUnread,
                isUnread && { color: colors.text },
              ]}
              numberOfLines={2}
            >
              {highlightText
                ? highlightMatchingText(previewText, highlightText, colors)
                : previewText}
            </Text>
          )}

          {unreadBadgeText && (
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
    paddingHorizontal: 12,
    paddingVertical: 5,
    minHeight: 66,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarFrame: {
    overflow: "hidden",
  },
  groupAvatarImage: {
    ...StyleSheet.absoluteFillObject,
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
    fontSize: 15.5,
    fontWeight: "500",
    flex: 1,
  },
  nameUnread: {
    fontWeight: "700",
  },
  time: {
    fontSize: 12.5,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  preview: {
    fontSize: 13.5,
    lineHeight: 18,
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
