/**
 * ReactionBar Component (H8)
 *
 * Displays emoji reactions on/below a message bubble.
 * Provides inline reaction chips with toggle, a quick-reaction tray
 * (from the long-press action sheet), and a "+" button to open
 * the full emoji picker.
 *
 * Architecture:
 * - ReactionPills: Inline chips rendered below the message bubble.
 * - QuickReactionBar: 6-emoji tray shown in MessageActionsSheet.
 * - Full emoji picker (rn-emoji-keyboard) opened via "+" button.
 *
 * @module components/chat/ReactionBar
 */

import {
  formatReactionCount,
  QUICK_REACTIONS,
  ReactionSummary,
  toggleReaction,
} from "@/services/reactions";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import type { EmojiType } from "rn-emoji-keyboard";
import EmojiPicker from "rn-emoji-keyboard";

import { createLogger } from "@/utils/log";
const logger = createLogger("ReactionBar");

// =============================================================================
// Types
// =============================================================================

export interface ReactionPillsProps {
  /** Reactions to display */
  reactions: ReactionSummary[];
  /** Whether the message was sent by the current user */
  isOwnMessage: boolean;
  /** Scope for the toggle call */
  scope: "dm" | "group";
  /** Conversation ID for the toggle call */
  conversationId: string;
  /** Message ID for the toggle call */
  messageId: string;
  /** Current user UID */
  currentUid: string;
  /** Called when reaction detail sheet should open */
  onShowDetail?: () => void;
  /** Called immediately with optimistic state before server round-trip */
  onOptimisticToggle?: (messageId: string, emoji: string) => void;
}

interface QuickReactionBarProps {
  /** Called when user picks an emoji (quick or from full picker) */
  onSelect: (emoji: string) => void;
  /** Whether a reaction toggle call is in-flight */
  loading?: boolean;
}

// =============================================================================
// ReactionPills — displayed below message bubbles
// =============================================================================

/**
 * Animated pill for a single reaction.
 */
const ReactionPill = memo(function ReactionPill({
  emoji,
  count,
  hasReacted,
  onPress,
}: {
  emoji: string;
  count: number;
  hasReacted: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.25, { damping: 6, stiffness: 400 }),
      withSpring(1, { damping: 8, stiffness: 300 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  }, [onPress, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      layout={LinearTransition.springify().damping(14).stiffness(120)}
      style={animatedStyle}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.pill,
          hasReacted && {
            backgroundColor: theme.colors.primaryContainer,
            borderColor: theme.colors.primary,
          },
          !hasReacted && {
            backgroundColor: theme.dark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.05)",
            borderColor: theme.dark
              ? "rgba(255,255,255,0.12)"
              : "rgba(0,0,0,0.08)",
          },
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${emoji} reaction, ${count} ${count === 1 ? "person" : "people"}${hasReacted ? ", you reacted" : ""}`}
        accessibilityHint="Double tap to toggle your reaction"
      >
        <Text style={styles.pillEmoji}>{emoji}</Text>
        <Text
          style={[
            styles.pillCount,
            {
              color: hasReacted
                ? theme.colors.primary
                : theme.colors.onSurfaceVariant,
            },
          ]}
        >
          {formatReactionCount(count)}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

/**
 * ReactionPills — renders all reaction pills below a message bubble.
 * Correctly aligned for sent (right) and received (left) messages.
 */
export const ReactionPills = memo(function ReactionPills({
  reactions,
  isOwnMessage,
  scope,
  conversationId,
  messageId,
  currentUid,
  onShowDetail,
  onOptimisticToggle,
}: ReactionPillsProps) {
  // Track in-flight emoji to debounce rapid same-emoji taps
  const inflight = React.useRef<Set<string>>(new Set());

  const handleToggle = useCallback(
    (emoji: string) => {
      if (inflight.current.has(emoji)) return; // debounce same emoji
      inflight.current.add(emoji);

      // 1. Apply optimistic update immediately (parent mutates state)
      onOptimisticToggle?.(messageId, emoji);

      // 2. Fire server call in the background — no await
      toggleReaction({
        scope,
        conversationId,
        messageId,
        emoji,
        uid: currentUid,
      })
        .then((result) => {
          if (!result.success) {
            logger.warn(
              "Reaction toggle failed, listener will reconcile",
              result.error,
            );
            // Rollback: re-toggle optimistically to undo the local change
            onOptimisticToggle?.(messageId, emoji);
          }
        })
        .catch((e) => {
          logger.error("Toggle reaction error", e);
          // Rollback on network error
          onOptimisticToggle?.(messageId, emoji);
        })
        .finally(() => {
          inflight.current.delete(emoji);
        });
    },
    [scope, conversationId, messageId, currentUid, onOptimisticToggle],
  );

  if (reactions.length === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      layout={LinearTransition.springify().damping(14)}
      style={[
        styles.pillsContainer,
        isOwnMessage ? styles.pillsContainerOwn : styles.pillsContainerOther,
      ]}
    >
      {reactions.map((r) => (
        <ReactionPill
          key={r.emoji}
          emoji={r.emoji}
          count={r.count}
          hasReacted={r.hasReacted}
          onPress={() => handleToggle(r.emoji)}
        />
      ))}
    </Animated.View>
  );
});

// =============================================================================
// QuickReactionBar — shown inside MessageActionsSheet
// =============================================================================

/**
 * QuickReactionBar — 6 quick emojis + a "+" button that opens the
 * full rn-emoji-keyboard picker.
 */
export const QuickReactionBar = memo(function QuickReactionBar({
  onSelect,
  loading = false,
}: QuickReactionBarProps) {
  const theme = useTheme();
  const [fullPickerOpen, setFullPickerOpen] = useState(false);

  const handleQuick = useCallback(
    (emoji: string) => {
      if (loading) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onSelect(emoji);
    },
    [onSelect, loading],
  );

  const handleFullSelect = useCallback(
    (emojiObject: EmojiType) => {
      setFullPickerOpen(false);
      onSelect(emojiObject.emoji);
    },
    [onSelect],
  );

  return (
    <View style={styles.quickBar}>
      {QUICK_REACTIONS.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          style={[
            styles.quickEmoji,
            {
              backgroundColor: theme.dark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.04)",
            },
          ]}
          onPress={() => handleQuick(emoji)}
          activeOpacity={0.6}
          disabled={loading}
        >
          <Text style={styles.quickEmojiText}>{emoji}</Text>
        </TouchableOpacity>
      ))}

      {/* "+" to open full picker */}
      <TouchableOpacity
        style={[
          styles.quickEmoji,
          styles.quickExpandBtn,
          { borderColor: theme.colors.outline },
        ]}
        onPress={() => setFullPickerOpen(true)}
        activeOpacity={0.6}
        disabled={loading}
      >
        <Text
          style={[
            styles.quickExpandText,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          +
        </Text>
      </TouchableOpacity>

      {/* Full emoji picker (rn-emoji-keyboard) */}
      <EmojiPicker
        onEmojiSelected={handleFullSelect}
        open={fullPickerOpen}
        onClose={() => setFullPickerOpen(false)}
        enableSearchBar
        enableRecentlyUsed
        categoryPosition="bottom"
        disabledCategories={["search"]}
        theme={{
          backdrop: theme.dark ? "#00000099" : "#00000066",
          knob: theme.colors.outline,
          container: theme.colors.surface,
          header: theme.colors.onSurface,
          category: {
            icon: theme.colors.onSurfaceVariant,
            iconActive: theme.colors.primary,
            container: theme.colors.surface,
            containerActive: theme.colors.primaryContainer,
          },
          search: {
            text: theme.colors.onSurface,
            placeholder: theme.colors.onSurfaceVariant,
            icon: theme.colors.onSurfaceVariant,
            background: theme.colors.surfaceVariant,
          },
        }}
      />
    </View>
  );
});

// =============================================================================
// Legacy exports (kept for barrel-file compatibility)
// =============================================================================

/** @deprecated Use ReactionPills instead */
export const ReactionBar = ReactionPills;

/** @deprecated Use ReactionPills instead */
export const ReactionsSummary = ReactionPills;

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Pills container
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    paddingTop: 0,
  },
  pillsContainerOwn: {
    justifyContent: "flex-end",
    paddingRight: 4,
  },
  pillsContainerOther: {
    justifyContent: "flex-start",
    paddingLeft: 4,
  },

  // Individual pill
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  pillEmoji: {
    fontSize: 14,
    lineHeight: Platform.OS === "android" ? 20 : undefined,
  },
  pillCount: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Quick bar (inside MessageActionsSheet)
  quickBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  quickEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  quickEmojiText: {
    fontSize: 26,
  },
  quickExpandBtn: {
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  quickExpandText: {
    fontSize: 22,
    fontWeight: "600",
  },
});

export default ReactionPills;
