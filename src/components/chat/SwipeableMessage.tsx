/**
 * SwipeableMessage Component (H6)
 *
 * Wraps a message bubble to enable swipe-to-reply gesture.
 * Uses react-native-gesture-handler for cross-platform gesture support.
 *
 * Features:
 * - Swipe right to trigger reply
 * - Visual feedback during swipe (reply icon appears)
 * - Haptic feedback on threshold crossing (native only)
 * - Locked gesture: continues tracking even when finger leaves bounds
 * - Configurable swipe threshold
 *
 * @module components/chat/SwipeableMessage
 */

import { MessageV2, ReplyToMetadata } from "@/types/messaging";
import React, { useCallback, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { IconButton, useTheme } from "react-native-paper";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

interface SwipeableMessageProps {
  /** The message being wrapped */
  message: MessageV2;
  /** Called when swipe threshold is reached */
  onReply: (replyTo: ReplyToMetadata) => void;
  /** Whether swipe is enabled (disabled for system messages, etc.) */
  enabled?: boolean;
  /** Current user ID (to determine if replying to own message) */
  currentUid?: string;
  /** Children to render (the message bubble) */
  children: React.ReactNode;
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum swipe distance to trigger reply */
const SWIPE_THRESHOLD = 60;

/** Maximum swipe distance (for visual cap) */
const MAX_SWIPE = 80;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create ReplyToMetadata from a message
 */
function createReplyMetadata(message: MessageV2): ReplyToMetadata {
  // Truncate text to first 100 characters
  const textSnippet = message.text
    ? message.text.length > 100
      ? message.text.substring(0, 100) + "..."
      : message.text
    : undefined;

  return {
    messageId: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    kind: message.kind,
    textSnippet,
    attachmentPreview:
      message.attachments && message.attachments.length > 0
        ? {
            kind: message.attachments[0].kind,
            thumbUrl:
              message.attachments[0].thumbUrl || message.attachments[0].url,
          }
        : undefined,
  };
}

// =============================================================================
// Component
// =============================================================================

export function SwipeableMessage({
  message,
  onReply,
  enabled = true,
  currentUid,
  children,
}: SwipeableMessageProps) {
  const theme = useTheme();

  // Reanimated shared values for smooth animation
  const translateX = useSharedValue(0);
  const hasTriggeredReply = useRef(false);

  // Animated style for reply icon opacity
  const replyIconStyle = useAnimatedStyle(() => {
    const progress = Math.min(translateX.value / SWIPE_THRESHOLD, 1);
    return {
      opacity: progress,
      transform: [{ scale: 0.5 + progress * 0.5 }],
    };
  });

  // Animated style for message translation
  const messageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const triggerReply = useCallback(() => {
    if (!enabled) return;

    const replyTo = createReplyMetadata(message);
    onReply(replyTo);

    // Provide haptic feedback on native
    if (Platform.OS !== "web") {
      try {
        // Dynamic import to avoid crash on web
        const { impactAsync, ImpactFeedbackStyle } =
          require("expo-haptics") as typeof import("expo-haptics");
        impactAsync(ImpactFeedbackStyle.Medium);
      } catch (e) {
        // Haptics not available, continue silently
      }
    }
  }, [message, onReply, enabled]);

  // RNGH Gesture with locked tracking (shouldCancelWhenOutside: false)
  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(10) // Only activate after 10px horizontal movement
    .failOffsetY([-15, 15]) // Fail if vertical movement exceeds 15px
    .shouldCancelWhenOutside(false) // KEY: Keep tracking even when finger leaves bounds
    .onStart(() => {
      hasTriggeredReply.current = false;
    })
    .onUpdate((event) => {
      // Only allow swipe right, cap at MAX_SWIPE
      const newValue = Math.max(0, Math.min(event.translationX, MAX_SWIPE));
      translateX.value = newValue;

      // Check if we crossed threshold
      if (newValue >= SWIPE_THRESHOLD && !hasTriggeredReply.current) {
        hasTriggeredReply.current = true;
        runOnJS(triggerReply)();
      }
    })
    .onEnd(() => {
      // Animate back to original position
      translateX.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
    });

  // Don't add gesture handlers if disabled
  if (!enabled) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <View style={styles.container}>
      {/* Reply icon (appears behind message on swipe) */}
      <Animated.View style={[styles.replyIconContainer, replyIconStyle]}>
        <View
          style={[
            styles.replyIconCircle,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <IconButton
            icon="reply"
            size={20}
            iconColor={theme.colors.onPrimaryContainer}
            style={styles.replyIcon}
          />
        </View>
      </Animated.View>

      {/* Message content with gesture detector */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.messageWrapper, messageStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  replyIconContainer: {
    position: "absolute",
    left: Spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: -1,
  },
  replyIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  replyIcon: {
    margin: 0,
  },
  messageWrapper: {
    backgroundColor: "transparent",
  },
});

export default SwipeableMessage;
