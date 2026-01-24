/**
 * MentionAutocomplete Component (H9)
 *
 * Displays a dropdown list of group members when the user types "@"
 * in the chat composer. Allows selecting a member to mention.
 *
 * Features:
 * - Shows filtered list of members based on query
 * - Displays avatar, display name, and username
 * - Keyboard-friendly selection
 * - Dismissable via tap outside or escape
 *
 * @module components/chat/MentionAutocomplete
 */

import { MentionableMember } from "@/services/mentionParser";
import React, { memo, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";

// =============================================================================
// Constants (inline to avoid path issues)
// =============================================================================

const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
} as const;

const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
} as const;

// =============================================================================
// Types
// =============================================================================

export interface MentionAutocompleteProps {
  /**
   * List of member suggestions to display
   */
  suggestions: MentionableMember[];

  /**
   * Whether the autocomplete is visible
   */
  visible: boolean;

  /**
   * Current search query (for highlighting)
   */
  query?: string;

  /**
   * Called when a member is selected
   */
  onSelect: (member: MentionableMember) => void;

  /**
   * Called when the autocomplete should be dismissed
   */
  onDismiss: () => void;

  /**
   * Maximum height of the dropdown
   * @default 200
   */
  maxHeight?: number;

  /**
   * Position from bottom of composer
   * @default 4
   */
  bottomOffset?: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_HEIGHT = 200;
const DEFAULT_BOTTOM_OFFSET = 4;
const ITEM_HEIGHT = 52;
const ANIMATION_DURATION = 150;

// =============================================================================
// Sub-Components
// =============================================================================

interface MemberItemProps {
  member: MentionableMember;
  query?: string;
  onPress: () => void;
  isLast: boolean;
}

/**
 * Individual member suggestion item
 */
const MemberItem = memo(function MemberItem({
  member,
  query,
  onPress,
  isLast,
}: MemberItemProps) {
  const theme = useTheme();

  // Highlight matching text
  const highlightText = (text: string, highlight?: string) => {
    if (!highlight || !text) {
      return (
        <Text style={[styles.displayName, { color: theme.colors.onSurface }]}>
          {text}
        </Text>
      );
    }

    const lowerText = text.toLowerCase();
    const lowerHighlight = highlight.toLowerCase();
    const startIndex = lowerText.indexOf(lowerHighlight);

    if (startIndex === -1) {
      return (
        <Text style={[styles.displayName, { color: theme.colors.onSurface }]}>
          {text}
        </Text>
      );
    }

    const before = text.substring(0, startIndex);
    const match = text.substring(startIndex, startIndex + highlight.length);
    const after = text.substring(startIndex + highlight.length);

    return (
      <Text style={[styles.displayName, { color: theme.colors.onSurface }]}>
        {before}
        <Text
          style={[
            styles.highlight,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          {match}
        </Text>
        {after}
      </Text>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.memberItem,
        { backgroundColor: theme.colors.surface },
        !isLast && [
          styles.memberItemBorder,
          { borderBottomColor: theme.colors.outlineVariant },
        ],
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.avatar,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        <Text
          style={[
            styles.avatarText,
            { color: theme.colors.onPrimaryContainer },
          ]}
        >
          {(member.displayName || "?").charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        {highlightText(member.displayName, query)}
        {member.username && (
          <Text
            style={[styles.username, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            @{member.username}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

// =============================================================================
// Main Component
// =============================================================================

/**
 * Mention autocomplete dropdown component.
 *
 * Renders above the chat composer when typing "@".
 *
 * @example
 * ```tsx
 * <MentionAutocomplete
 *   visible={mentionState.isVisible}
 *   suggestions={mentionState.suggestions}
 *   query={mentionState.query}
 *   onSelect={(member) => {
 *     const result = mentionState.onSelectMember(member, text, cursor);
 *     setText(result.newText);
 *   }}
 *   onDismiss={mentionState.onDismiss}
 * />
 * ```
 */
export const MentionAutocomplete = memo(function MentionAutocomplete({
  suggestions,
  visible,
  query,
  onSelect,
  onDismiss,
  maxHeight = DEFAULT_MAX_HEIGHT,
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
}: MentionAutocompleteProps) {
  const theme = useTheme();

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  // Animate visibility changes
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 10,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  // Handle member selection
  const handleSelect = useCallback(
    (member: MentionableMember) => {
      onSelect(member);
    },
    [onSelect],
  );

  // Don't render if not visible or no suggestions
  if (!visible || suggestions.length === 0) {
    return null;
  }

  // Calculate dynamic height
  const contentHeight = Math.min(suggestions.length * ITEM_HEIGHT, maxHeight);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
          bottom: bottomOffset,
          maxHeight,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.colors.outlineVariant },
        ]}
      >
        <Text
          style={[styles.headerText, { color: theme.colors.onSurfaceVariant }]}
        >
          Mention someone
        </Text>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={[styles.dismissText, { color: theme.colors.primary }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </View>

      {/* Member list */}
      <ScrollView
        style={{ maxHeight: contentHeight }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {suggestions.map((member, index) => (
          <MemberItem
            key={member.uid}
            member={member}
            query={query}
            onPress={() => handleSelect(member)}
            isLast={index === suggestions.length - 1}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
});

// =============================================================================
// Inline Mention Text Component
// =============================================================================

export interface MentionTextProps {
  /**
   * Text segment from mention parser
   */
  content: string;

  /**
   * Whether this is a mention
   */
  isMention: boolean;

  /**
   * UID of the mentioned user (if mention)
   */
  uid?: string;

  /**
   * Current user's UID (to highlight self-mentions)
   */
  currentUid?: string;

  /**
   * Called when a mention is pressed
   */
  onMentionPress?: (uid: string) => void;
}

/**
 * Renders a text segment with mention styling.
 *
 * Mentions are highlighted with a different background color.
 */
export const MentionText = memo(function MentionText({
  content,
  isMention,
  uid,
  currentUid,
  onMentionPress,
}: MentionTextProps) {
  const theme = useTheme();

  if (!isMention) {
    return <Text>{content}</Text>;
  }

  const isSelfMention = uid === currentUid;

  return (
    <Text
      style={[
        styles.mentionText,
        {
          backgroundColor: isSelfMention
            ? theme.colors.tertiaryContainer
            : theme.colors.primaryContainer,
          color: isSelfMention
            ? theme.colors.onTertiaryContainer
            : theme.colors.onPrimaryContainer,
        },
      ]}
      onPress={uid && onMentionPress ? () => onMentionPress(uid) : undefined}
    >
      {content}
    </Text>
  );
});

// =============================================================================
// Utility: Render Message with Mentions
// =============================================================================

import { segmentTextWithMentions } from "@/services/mentionParser";
import { MentionSpan } from "@/types/messaging";

export interface RenderMessageWithMentionsProps {
  text: string;
  mentionSpans?: MentionSpan[];
  currentUid?: string;
  onMentionPress?: (uid: string) => void;
  textStyle?: any;
}

/**
 * Renders message text with highlighted mentions.
 *
 * @example
 * ```tsx
 * <MessageWithMentions
 *   text={message.text}
 *   mentionSpans={message.mentionSpans}
 *   currentUid={currentUser.uid}
 *   onMentionPress={(uid) => navigateToProfile(uid)}
 * />
 * ```
 */
export const MessageWithMentions = memo(function MessageWithMentions({
  text,
  mentionSpans,
  currentUid,
  onMentionPress,
  textStyle,
}: RenderMessageWithMentionsProps) {
  const segments = segmentTextWithMentions(text, mentionSpans);

  return (
    <Text style={textStyle}>
      {segments.map((segment, index) => (
        <MentionText
          key={`${index}-${segment.content.substring(0, 10)}`}
          content={segment.content}
          isMention={segment.type === "mention"}
          uid={segment.uid}
          currentUid={currentUid}
          onMentionPress={onMentionPress}
        />
      ))}
    </Text>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
  },
  dismissButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  dismissText: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    height: ITEM_HEIGHT,
  },
  memberItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  memberInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: FontSizes.md,
    fontWeight: "500",
  },
  username: {
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  highlight: {
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 2,
  },
  mentionText: {
    borderRadius: BorderRadius.xs,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
});

export default MentionAutocomplete;
