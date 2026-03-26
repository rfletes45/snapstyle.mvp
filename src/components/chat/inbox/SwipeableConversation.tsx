/**
 * SwipeableConversation Component
 *
 * Wraps a conversation item with swipe gesture support:
 * - Swipe right: Pin/Unpin action
 * - Swipe left: Mute, Delete actions
 *
 * Uses react-native-gesture-handler for smooth gestures
 * and expo-haptics for tactile feedback.
 *
 * @module components/chat/inbox/SwipeableConversation
 */

import { Spacing } from "@/constants/theme";
import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import * as haptics from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/Swipeable";

// =============================================================================
// Types
// =============================================================================

export interface SwipeableConversationProps {
  /** The conversation data */
  conversation: InboxConversation;
  /** Called when pin/unpin action is triggered */
  onPin: () => void;
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
const RIGHT_ACTION_WIDTH = 120;
const SINGLE_ACTION_WIDTH = 60;

// =============================================================================
// Component
// =============================================================================

export function SwipeableConversation({
  conversation,
  onPin,
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
        <View style={styles.leftActionsClip}>
          {/* Colored background that slides in with the drag distance */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: colors.primary,
                transform: [
                  {
                    translateX: dragX.interpolate({
                      inputRange: [0, LEFT_ACTION_WIDTH],
                      outputRange: [-LEFT_ACTION_WIDTH, 0],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View style={{ transform: [{ scale }] }}>
            <RectButton
              style={styles.actionButton}
              onPress={() => handleAction(onPin)}
            >
              <MaterialCommunityIcons
                name={isPinned ? "pin-off" : "pin"}
                color="white"
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

      return (
        <Animated.View
          style={[styles.rightActions, { transform: [{ translateX }] }]}
        >
          {/* Mute */}
          <RectButton
            style={[styles.singleAction, { backgroundColor: colors.warning }]}
            onPress={() => handleAction(onMute)}
          >
            <MaterialCommunityIcons
              name={isMuted ? "bell" : "bell-off"}
              color="white"
              size={24}
            />
          </RectButton>

          {/* Delete */}
          <RectButton
            style={[styles.singleAction, { backgroundColor: colors.error }]}
            onPress={() => handleAction(onDelete)}
          >
            <MaterialCommunityIcons name="delete" color="white" size={24} />
          </RectButton>
        </Animated.View>
      );
    },
    [colors, conversation.memberState, handleAction, onMute, onDelete],
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
  leftActionsClip: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: Spacing.lg,
    width: LEFT_ACTION_WIDTH,
    overflow: "hidden",
  },
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
