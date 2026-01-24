/**
 * ReactionBar Component (H8)
 *
 * Displays emoji reactions on a message bubble and provides
 * a quick emoji picker for adding reactions.
 *
 * Features:
 * - Shows existing reactions with counts
 * - Tap reaction to toggle (add/remove)
 * - Long-press to show full emoji picker
 * - Highlights user's own reactions
 *
 * @module components/chat/ReactionBar
 */

import React, { useState, useCallback, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "react-native-paper";
import {
  toggleReaction,
  getAllowedEmojis,
  isAllowedEmoji,
  formatReactionCount,
  ReactionSummary,
} from "@/services/reactions";

// =============================================================================
// Types
// =============================================================================

interface ReactionBarProps {
  /** Current reactions on the message */
  reactions: ReactionSummary[];
  /** Message scope - DM or Group */
  scope: "dm" | "group";
  /** Conversation ID */
  conversationId: string;
  /** Message ID */
  messageId: string;
  /** Current user ID */
  currentUid: string;
  /** Whether the message is from the current user */
  isOwnMessage?: boolean;
  /** Callback after reaction is toggled */
  onReactionToggled?: (emoji: string, action: "added" | "removed") => void;
  /** Optional compact mode for smaller bubbles */
  compact?: boolean;
}

interface ReactionChipProps {
  emoji: string;
  count: number;
  hasReacted: boolean;
  onPress: () => void;
  isLoading?: boolean;
  compact?: boolean;
}

interface EmojiPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentReactions: ReactionSummary[];
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Individual reaction chip showing emoji + count
 */
const ReactionChip = memo(function ReactionChip({
  emoji,
  count,
  hasReacted,
  onPress,
  isLoading,
  compact,
}: ReactionChipProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        compact && styles.chipCompact,
        hasReacted && {
          backgroundColor: theme.colors.primaryContainer,
          borderColor: theme.colors.primary,
        },
      ]}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.7}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <>
          <Text style={[styles.chipEmoji, compact && styles.chipEmojiCompact]}>
            {emoji}
          </Text>
          <Text
            style={[
              styles.chipCount,
              compact && styles.chipCountCompact,
              hasReacted && { color: theme.colors.primary },
            ]}
          >
            {formatReactionCount(count)}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
});

/**
 * Add reaction button (+ icon)
 */
const AddReactionButton = memo(function AddReactionButton({
  onPress,
  compact,
}: {
  onPress: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.addButton,
        compact && styles.addButtonCompact,
        { borderColor: theme.colors.outline },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.addButtonText,
          compact && styles.addButtonTextCompact,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        +
      </Text>
    </TouchableOpacity>
  );
});

/**
 * Full emoji picker modal
 */
const EmojiPickerModal = memo(function EmojiPickerModal({
  visible,
  onClose,
  onSelect,
  currentReactions,
}: EmojiPickerModalProps) {
  const theme = useTheme();
  const allEmojis = getAllowedEmojis();

  // Create a set of emojis user has already reacted with
  const userReactions = new Set(
    currentReactions.filter((r) => r.hasReacted).map((r) => r.emoji),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.pickerContainer,
            { backgroundColor: theme.colors.surface },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.pickerTitle, { color: theme.colors.onSurface }]}>
            React with emoji
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emojiGrid}
          >
            {allEmojis.map((emoji) => {
              const isSelected = userReactions.has(emoji);
              return (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiOption,
                    isSelected && {
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                  onPress={() => {
                    onSelect(emoji);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

// =============================================================================
// Main Component
// =============================================================================

/**
 * ReactionBar - Displays and manages reactions on a message
 */
export const ReactionBar = memo(function ReactionBar({
  reactions,
  scope,
  conversationId,
  messageId,
  currentUid,
  isOwnMessage,
  onReactionToggled,
  compact = false,
}: ReactionBarProps) {
  const theme = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loadingEmoji, setLoadingEmoji] = useState<string | null>(null);

  // Handle reaction toggle
  const handleToggle = useCallback(
    async (emoji: string) => {
      if (!isAllowedEmoji(emoji)) return;

      setLoadingEmoji(emoji);

      try {
        const result = await toggleReaction({
          scope,
          conversationId,
          messageId,
          emoji,
          uid: currentUid,
        });

        if (result.success && onReactionToggled) {
          onReactionToggled(emoji, result.action);
        }
      } catch (error) {
        console.error("[ReactionBar] Toggle failed:", error);
      } finally {
        setLoadingEmoji(null);
      }
    },
    [scope, conversationId, messageId, currentUid, onReactionToggled],
  );

  // Handle picker selection
  const handlePickerSelect = useCallback(
    (emoji: string) => {
      handleToggle(emoji);
    },
    [handleToggle],
  );

  // Don't render if no reactions and it's not own message (can't add reactions to own messages initially)
  // Actually, users can react to any message, so always show add button
  const hasReactions = reactions.length > 0;

  return (
    <View
      style={[styles.container, isOwnMessage && styles.containerOwnMessage]}
    >
      {/* Existing reactions */}
      {reactions.map((reaction) => (
        <ReactionChip
          key={reaction.emoji}
          emoji={reaction.emoji}
          count={reaction.count}
          hasReacted={reaction.hasReacted}
          onPress={() => handleToggle(reaction.emoji)}
          isLoading={loadingEmoji === reaction.emoji}
          compact={compact}
        />
      ))}

      {/* Add reaction button - only show if there's space for more */}
      {reactions.length < 12 && (
        <AddReactionButton
          onPress={() => setPickerVisible(true)}
          compact={compact}
        />
      )}

      {/* Emoji picker modal */}
      <EmojiPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handlePickerSelect}
        currentReactions={reactions}
      />
    </View>
  );
});

// =============================================================================
// Quick Reaction Bar (for long-press action sheet)
// =============================================================================

interface QuickReactionBarProps {
  onSelect: (emoji: string) => void;
  selectedEmoji?: string;
}

/**
 * QuickReactionBar - Shows frequently used emojis for quick selection
 */
export const QuickReactionBar = memo(function QuickReactionBar({
  onSelect,
  selectedEmoji,
}: QuickReactionBarProps) {
  const theme = useTheme();

  // Frequently used emojis (top 6)
  const quickEmojis = ["👍", "❤️", "😂", "🔥", "😮", "😢"];

  return (
    <View style={styles.quickBar}>
      {quickEmojis.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          style={[
            styles.quickEmoji,
            selectedEmoji === emoji && {
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
          onPress={() => onSelect(emoji)}
          activeOpacity={0.7}
        >
          <Text style={styles.quickEmojiText}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

// =============================================================================
// Reactions Summary Row (for message list)
// =============================================================================

interface ReactionsSummaryProps {
  /** Denormalized reactions summary from message */
  reactionsSummary?: Record<string, number>;
  /** Whether current user has reacted (needs separate query or tracking) */
  userReactions?: string[];
  /** Compact display mode */
  compact?: boolean;
  /** Callback when tapped */
  onPress?: () => void;
}

/**
 * ReactionsSummary - Compact display of reactions from message summary
 */
export const ReactionsSummary = memo(function ReactionsSummary({
  reactionsSummary,
  userReactions = [],
  compact = true,
  onPress,
}: ReactionsSummaryProps) {
  const theme = useTheme();

  if (!reactionsSummary || Object.keys(reactionsSummary).length === 0) {
    return null;
  }

  // Sort by count and take top 3
  const sortedReactions = Object.entries(reactionsSummary)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const totalCount = Object.values(reactionsSummary).reduce((a, b) => a + b, 0);

  return (
    <TouchableOpacity
      style={[
        styles.summaryContainer,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.summaryEmojis}>
        {sortedReactions.map(([emoji]) => (
          <Text key={emoji} style={styles.summaryEmoji}>
            {emoji}
          </Text>
        ))}
      </View>
      {totalCount > 1 && (
        <Text
          style={[
            styles.summaryCount,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {formatReactionCount(totalCount)}
        </Text>
      )}
    </TouchableOpacity>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  containerOwnMessage: {
    justifyContent: "flex-end",
  },

  // Reaction chip
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderWidth: 1,
    borderColor: "transparent",
    minWidth: 40,
  },
  chipCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 32,
  },
  chipEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  chipEmojiCompact: {
    fontSize: 12,
    marginRight: 2,
  },
  chipCount: {
    fontSize: 12,
    color: "#666",
  },
  chipCountCompact: {
    fontSize: 10,
  },

  // Add button
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonCompact: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  addButtonTextCompact: {
    fontSize: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerContainer: {
    width: "90%",
    maxWidth: 360,
    padding: 16,
    borderRadius: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiOptionText: {
    fontSize: 24,
  },

  // Quick bar
  quickBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  quickEmoji: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickEmojiText: {
    fontSize: 24,
  },

  // Summary
  summaryContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  summaryEmojis: {
    flexDirection: "row",
  },
  summaryEmoji: {
    fontSize: 12,
    marginRight: -2,
  },
  summaryCount: {
    fontSize: 10,
    marginLeft: 4,
  },
});

export default ReactionBar;
