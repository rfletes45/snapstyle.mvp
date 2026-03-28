/**
 * MentionAutocomplete Component (Rebuilt)
 *
 * A polished, production-grade mention suggestion panel and mention rendering
 * system. Appears above the composer when user types "@", with smooth
 * animations, avatar display, and theme-aware styling.
 *
 * Also exports MessageWithMentions for read-time rendering of mentions.
 *
 * @module components/chat/MentionAutocomplete
 */

import type { MentionableMember } from "@/services/mentionParser";
import { segmentTextWithMentions } from "@/services/mentionParser";
import { useAppTheme } from "@/store/ThemeContext";
import type { MentionSpan } from "@/types/messaging";
import React, { memo, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

export interface MentionAutocompleteProps {
  /** Member suggestions to display */
  suggestions: MentionableMember[];
  /** Whether the autocomplete is visible */
  visible: boolean;
  /** Current search query (for highlighting matches) */
  query?: string;
  /** Called when a member is selected */
  onSelect: (member: MentionableMember) => void;
  /** Called when the autocomplete should be dismissed */
  onDismiss: () => void;
  /** Maximum height of the dropdown @default 240 */
  maxHeight?: number;
  /** Position from bottom of composer @default 6 */
  bottomOffset?: number;
  /** Optional: avatar URLs keyed by uid */
  avatarUrls?: Record<string, string | undefined>;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_HEIGHT = 240;
const BOTTOM_OFFSET = 6;
const ITEM_HEIGHT = 56;
const ANIMATION_DURATION = 180;

// =============================================================================
// Sub-Components
// =============================================================================

interface SuggestionRowProps {
  member: MentionableMember;
  query?: string;
  onPress: () => void;
  isLast: boolean;
  avatarUrl?: string;
}

/** Individual suggestion row with avatar, name, username */
const SuggestionRow = memo(function SuggestionRow({
  member,
  query,
  onPress,
  isLast,
  avatarUrl,
}: SuggestionRowProps) {
  const { colors } = useAppTheme();

  const renderHighlightedName = (text: string, highlight?: string) => {
    if (!highlight || !text) {
      return (
        <Text style={[styles.displayName, { color: colors.text }]}>{text}</Text>
      );
    }

    const lower = text.toLowerCase();
    const lowerQ = highlight.toLowerCase();
    const idx = lower.indexOf(lowerQ);

    if (idx === -1) {
      return (
        <Text style={[styles.displayName, { color: colors.text }]}>{text}</Text>
      );
    }

    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + highlight.length);
    const after = text.substring(idx + highlight.length);

    return (
      <Text style={[styles.displayName, { color: colors.text }]}>
        {before}
        <Text
          style={[
            styles.matchHighlight,
            {
              color: colors.primary,
              backgroundColor:
                colors.mentionChipBackground ?? colors.primaryContainer,
            },
          ]}
        >
          {match}
        </Text>
        {after}
      </Text>
    );
  };

  const initials = (member.displayName || "?").charAt(0).toUpperCase();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.suggestionRow,
        {
          backgroundColor: pressed
            ? colors.surfaceVariant
            : (colors.suggestionPanelBackground ?? colors.surfaceElevated),
        },
        !isLast && [
          styles.rowDivider,
          { borderBottomColor: colors.dividerSubtle ?? colors.divider },
        ],
      ]}
      onPress={onPress}
      android_ripple={{ color: colors.surfaceVariant }}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          {
            backgroundColor:
              colors.mentionChipBackground ?? colors.primaryContainer,
          },
        ]}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text
            style={[
              styles.avatarInitials,
              { color: colors.mentionChipText ?? colors.primary },
            ]}
          >
            {initials}
          </Text>
        )}
      </View>

      {/* Name + username */}
      <View style={styles.nameContainer}>
        {renderHighlightedName(member.displayName, query)}
        {member.username && (
          <Text
            style={[styles.username, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            @{member.username}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

// =============================================================================
// Main Component: MentionAutocomplete
// =============================================================================

export const MentionAutocomplete = memo(function MentionAutocomplete({
  suggestions,
  visible,
  query,
  onSelect,
  onDismiss,
  maxHeight = MAX_HEIGHT,
  bottomOffset = BOTTOM_OFFSET,
  avatarUrls,
}: MentionAutocompleteProps) {
  const { colors } = useAppTheme();

  // Animation values
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (visible && suggestions.length > 0) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: ANIMATION_DURATION * 0.7,
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: 12,
          duration: ANIMATION_DURATION * 0.7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, suggestions.length, opacity, slideY]);

  const handleSelect = useCallback(
    (member: MentionableMember) => {
      onSelect(member);
    },
    [onSelect],
  );

  if (!visible || suggestions.length === 0) {
    return null;
  }

  const contentHeight = Math.min(suggestions.length * ITEM_HEIGHT, maxHeight);

  return (
    <Animated.View
      style={[
        styles.panelContainer,
        {
          backgroundColor:
            colors.suggestionPanelBackground ?? colors.surfaceElevated,
          borderColor: colors.suggestionPanelBorder ?? colors.border,
          bottom: "100%",
          marginBottom: bottomOffset,
          maxHeight,
          opacity,
          transform: [{ translateY: slideY }],
        },
      ]}
    >
      {/* Suggestion header */}
      <View
        style={[
          styles.panelHeader,
          { borderBottomColor: colors.dividerSubtle ?? colors.divider },
        ]}
      >
        <Text style={[styles.panelTitle, { color: colors.textMuted }]}>
          Mention someone
        </Text>
        <Pressable
          style={styles.dismissBtn}
          onPress={onDismiss}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Text style={[styles.dismissText, { color: colors.primary }]}>
            Done
          </Text>
        </Pressable>
      </View>

      {/* Suggestion list */}
      <ScrollView
        style={{ maxHeight: contentHeight }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {suggestions.map((member, idx) => (
          <SuggestionRow
            key={member.uid}
            member={member}
            query={query}
            onPress={() => handleSelect(member)}
            isLast={idx === suggestions.length - 1}
            avatarUrl={avatarUrls?.[member.uid]}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
});

// =============================================================================
// MentionText — renders a single mention token in read-time
// =============================================================================

export interface MentionTextProps {
  content: string;
  isMention: boolean;
  uid?: string;
  currentUid?: string;
  onMentionPress?: (uid: string) => void;
  textStyle?: any;
  /** Override border radius for mention token (default: 12) */
  mentionRadius?: number;
}

export const MentionText = memo(function MentionText({
  content,
  isMention,
  uid,
  currentUid,
  onMentionPress,
  textStyle,
  mentionRadius,
}: MentionTextProps) {
  const { colors } = useAppTheme();

  if (!isMention) {
    return <Text style={textStyle}>{content}</Text>;
  }

  const isSelf = uid === currentUid;
  // Darker backgrounds with light text for strong contrast and polish
  const bg = isSelf ? `${colors.primary}88` : `${colors.primary}66`;
  const fg = "#FFFFFF";

  const radiusStyle =
    mentionRadius != null ? { borderRadius: mentionRadius } : undefined;

  // borderRadius doesn't work on <Text> in React Native, so we wrap in a View.
  return (
    <View
      style={[
        styles.mentionTokenContainer,
        { backgroundColor: bg },
        radiusStyle,
      ]}
    >
      <Text
        style={[textStyle, styles.mentionTokenText, { color: fg }]}
        onPress={uid && onMentionPress ? () => onMentionPress(uid) : undefined}
        suppressHighlighting={false}
      >
        {content}
      </Text>
    </View>
  );
});

// =============================================================================
// MessageWithMentions — renders message text with highlighted mentions
// =============================================================================

export interface RenderMessageWithMentionsProps {
  text: string;
  mentionSpans?: MentionSpan[];
  currentUid?: string;
  onMentionPress?: (uid: string) => void;
  textStyle?: any;
  /** Override border radius for mention tokens */
  mentionRadius?: number;
}

export const MessageWithMentions = memo(function MessageWithMentions({
  text,
  mentionSpans,
  currentUid,
  onMentionPress,
  textStyle,
  mentionRadius,
}: RenderMessageWithMentionsProps) {
  const segments = segmentTextWithMentions(text, mentionSpans);

  // Use a flex-wrap View so mention <View> tokens can have borderRadius.
  // Plain text segments stay as <Text>, mention segments render as View-backed chips.
  return (
    <View style={styles.messageWithMentions}>
      {segments.map((segment, index) => {
        if (segment.type === "mention") {
          return (
            <MentionText
              key={`${index}-mention-${segment.uid ?? ""}`}
              content={segment.content}
              isMention
              uid={segment.uid}
              currentUid={currentUid}
              onMentionPress={onMentionPress}
              textStyle={textStyle}
              mentionRadius={mentionRadius}
            />
          );
        }
        return (
          <Text key={`${index}-text`} style={textStyle}>
            {segment.content}
          </Text>
        );
      })}
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Panel container
  panelContainer: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: "0 -3px 12px rgba(0,0,0,0.12)",
      },
    }),
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  dismissBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Suggestion rows
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    height: ITEM_HEIGHT,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: "700",
  },
  nameContainer: {
    flex: 1,
    justifyContent: "center",
  },
  displayName: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  matchHighlight: {
    borderRadius: 3,
    paddingHorizontal: 1,
  },
  username: {
    fontSize: 13,
    marginTop: 1,
    lineHeight: 17,
  },

  // Mention token (read-time) — View container for borderRadius support
  mentionTokenContainer: {
    borderRadius: 12,
    paddingHorizontal: 3,
    paddingVertical: 1,
    overflow: "hidden",
    alignSelf: "center",
  },
  mentionTokenText: {
    fontWeight: "600",
    fontSize: 14,
  },
  // Flex-wrap container for MessageWithMentions
  messageWithMentions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
});

export default MentionAutocomplete;
