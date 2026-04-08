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
import React, { memo, useCallback, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

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

interface LeftActionProps {
  isPinned: boolean;
  primaryColor: string;
  translation: SharedValue<number>;
  onPress: () => void;
}

interface RightActionsProps {
  isMuted: boolean;
  warningColor: string;
  errorColor: string;
  translation: SharedValue<number>;
  onMute: () => void;
  onDelete: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const LEFT_ACTION_WIDTH = 80;
const RIGHT_ACTION_WIDTH = 120;
const SINGLE_ACTION_WIDTH = 60;

// =============================================================================
// Action Renderers
// =============================================================================

const LeftAction = memo(function LeftAction({
  isPinned,
  primaryColor,
  translation,
  onPress,
}: LeftActionProps) {
  const backgroundStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          translation.value,
          [0, LEFT_ACTION_WIDTH],
          [-LEFT_ACTION_WIDTH, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translation.value,
      [0, LEFT_ACTION_WIDTH * 0.3, LEFT_ACTION_WIDTH * 0.6],
      [0, 0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateX: interpolate(
          translation.value,
          [0, LEFT_ACTION_WIDTH],
          [-LEFT_ACTION_WIDTH * 0.5, 0],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(
          translation.value,
          [0, LEFT_ACTION_WIDTH],
          [0.5, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={styles.leftActionsClip}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: primaryColor },
          backgroundStyle,
        ]}
      />
      <Animated.View style={iconStyle}>
        <RectButton style={styles.actionButton} onPress={onPress}>
          <MaterialCommunityIcons
            name={isPinned ? "pin-off" : "pin"}
            color="white"
            size={24}
          />
        </RectButton>
      </Animated.View>
    </View>
  );
});

const RightActions = memo(function RightActions({
  isMuted,
  warningColor,
  errorColor,
  translation,
  onMute,
  onDelete,
}: RightActionsProps) {
  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          translation.value,
          [-RIGHT_ACTION_WIDTH, 0],
          [0, RIGHT_ACTION_WIDTH],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.rightActions, containerStyle]}>
      <RectButton
        style={[styles.singleAction, { backgroundColor: warningColor }]}
        onPress={onMute}
      >
        <MaterialCommunityIcons
          name={isMuted ? "bell" : "bell-off"}
          color="white"
          size={24}
        />
      </RectButton>

      <RectButton
        style={[styles.singleAction, { backgroundColor: errorColor }]}
        onPress={onDelete}
      >
        <MaterialCommunityIcons name="delete" color="white" size={24} />
      </RectButton>
    </Animated.View>
  );
});

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
  const swipeableRef = useRef<SwipeableMethods | null>(null);

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

  const isPinned = !!conversation.memberState.pinnedAt;
  const isMuted = !!conversation.memberState.mutedUntil;

  const renderLeftActions = useCallback(
    (_progress: SharedValue<number>, translation: SharedValue<number>) => (
      <LeftAction
        isPinned={isPinned}
        primaryColor={colors.primary}
        translation={translation}
        onPress={() => handleAction(onPin)}
      />
    ),
    [colors.primary, handleAction, isPinned, onPin],
  );

  const renderRightActions = useCallback(
    (_progress: SharedValue<number>, translation: SharedValue<number>) => (
      <RightActions
        isMuted={isMuted}
        warningColor={colors.warning}
        errorColor={colors.error}
        translation={translation}
        onMute={() => handleAction(onMute)}
        onDelete={() => handleAction(onDelete)}
      />
    ),
    [colors.error, colors.warning, handleAction, isMuted, onDelete, onMute],
  );

  const onSwipeableOpen = useCallback(() => {
    haptics.swipeThreshold();
  }, []);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <ReanimatedSwipeable
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
    </ReanimatedSwipeable>
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
