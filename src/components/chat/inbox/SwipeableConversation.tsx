/**
 * SwipeableConversation Component
 *
 * Wraps a conversation item with swipe gesture support:
 * - Swipe right: Pin/Unpin action
 * - Swipe left: Mute, Archive, Delete actions
 *
 * Uses react-native-gesture-handler for smooth gestures
 * and expo-haptics for tactile feedback.
 *
 * @module components/chat/inbox/SwipeableConversation
 */

import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import * as haptics from "@/utils/haptics";
import React, { useCallback, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { IconButton } from "react-native-paper";
import { Spacing } from "@/constants/theme";

// =============================================================================
// Types
// =============================================================================

export interface SwipeableConversationProps {
  /** The conversation data */
  conversation: InboxConversation;
  /** Called when pin/unpin action is triggered */
  onPin: () => void;
  /** Called when archive action is triggered */
  onArchive: () => void;
  /** Called when delete action is triggered */
  onDelete: () => void;
  /** Called when mute action is triggered */
  onMute: () => void;
  /** Whether swipe actions are enabled */
  enabled?: boolean;
  /** The content to render (ConversationItem) */
  children: React.ReactNode;
}

// =============================================================================
// Constants
// =============================================================================

const LEFT_ACTION_WIDTH = 80;
const RIGHT_ACTION_WIDTH = 180;
const SINGLE_ACTION_WIDTH = 60;

// =============================================================================
// Component
// =============================================================================

export function SwipeableConversation({
  conversation,
  onPin,
  onArchive,
  onDelete,
  onMute,
  enabled = true,
  children,
}: SwipeableConversationProps) {
  const { colors } = useAppTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipeable = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const handleAction = useCallback(
    (action: () => void) => {
      haptics.actionConfirm();
      closeSwipeable();
      action();
    },
    [closeSwipeable],
  );

  // =========================================================================
  // Left Swipe Actions (Swipe Right to Reveal)
  // =========================================================================

  const renderLeftActions = useCallback(
    (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const scale = dragX.interpolate({
        inputRange: [0, LEFT_ACTION_WIDTH],
        outputRange: [0.5, 1],
        extrapolate: "clamp",
      });

      const isPinned = !!conversation.memberState.pinnedAt;

      return (
        <View style={[styles.leftActions, { backgroundColor: colors.primary }]}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <RectButton
              style={styles.actionButton}
              onPress={() => handleAction(onPin)}
            >
              <IconButton
                icon={isPinned ? "pin-off" : "pin"}
                iconColor="white"
                size={24}
              />
            </RectButton>
          </Animated.View>
        </View>
      );
    },
    [colors, conversation.memberState.pinnedAt, handleAction, onPin],
  );

  // =========================================================================
  // Right Swipe Actions (Swipe Left to Reveal)
  // =========================================================================

  const renderRightActions = useCallback(
    (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      const translateX = dragX.interpolate({
        inputRange: [-RIGHT_ACTION_WIDTH, 0],
        outputRange: [0, RIGHT_ACTION_WIDTH],
        extrapolate: "clamp",
      });

      const isMuted = !!conversation.memberState.mutedUntil;
      const isArchived = conversation.memberState.archived;

      return (
        <Animated.View
          style={[styles.rightActions, { transform: [{ translateX }] }]}
        >
          {/* Mute */}
          <RectButton
            style={[styles.singleAction, { backgroundColor: colors.warning }]}
            onPress={() => handleAction(onMute)}
          >
            <IconButton
              icon={isMuted ? "bell" : "bell-off"}
              iconColor="white"
              size={24}
            />
          </RectButton>

          {/* Archive */}
          <RectButton
            style={[styles.singleAction, { backgroundColor: colors.info }]}
            onPress={() => handleAction(onArchive)}
          >
            <IconButton
              icon={isArchived ? "inbox" : "archive"}
              iconColor="white"
              size={24}
            />
          </RectButton>

          {/* Delete */}
          <RectButton
            style={[styles.singleAction, { backgroundColor: colors.error }]}
            onPress={() => handleAction(onDelete)}
          >
            <IconButton icon="delete" iconColor="white" size={24} />
          </RectButton>
        </Animated.View>
      );
    },
    [
      colors,
      conversation.memberState,
      handleAction,
      onMute,
      onArchive,
      onDelete,
    ],
  );

  // =========================================================================
  // Swipe Events
  // =========================================================================

  const onSwipeableOpen = useCallback((direction: "left" | "right") => {
    haptics.swipeThreshold();
  }, []);

  // =========================================================================
  // Render
  // =========================================================================

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={onSwipeableOpen}
      overshootLeft={false}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  leftActions: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: Spacing.lg,
    width: LEFT_ACTION_WIDTH,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    width: RIGHT_ACTION_WIDTH,
  },
  actionButton: {
    justifyContent: "center",
    alignItems: "center",
    width: LEFT_ACTION_WIDTH,
    height: "100%",
  },
  singleAction: {
    justifyContent: "center",
    alignItems: "center",
    width: SINGLE_ACTION_WIDTH,
    height: "100%",
  },
});
