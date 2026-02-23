/**
 * ThreadIndicator
 *
 * Renders a "View thread (N replies)" link beneath a message that is the
 * root of a reply thread.  Tapping it navigates to the ThreadView screen.
 *
 * @module components/chat/ThreadIndicator
 */

import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

export interface ThreadIndicatorProps {
  /** Number of replies in the thread */
  replyCount: number;
  /** Callback when the user taps to open the thread */
  onPress: () => void;
  /** Whether the root message is outgoing (sent by current user) */
  isOutgoing?: boolean;
}

function ThreadIndicatorInner({
  replyCount,
  onPress,
  isOutgoing,
}: ThreadIndicatorProps) {
  const { colors } = useAppTheme();

  if (!replyCount || replyCount <= 0) return null;

  const label =
    replyCount === 1
      ? "View thread (1 reply)"
      : `View thread (${replyCount} replies)`;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.container,
        isOutgoing ? styles.containerOutgoing : styles.containerIncoming,
      ]}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons
        name="message-reply-text-outline"
        size={14}
        color={colors.primary}
        style={styles.icon}
      />
      <Text style={[styles.text, { color: colors.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const ThreadIndicator = memo(ThreadIndicatorInner);
export default ThreadIndicator;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 2,
    maxWidth: "80%",
  },
  containerOutgoing: {
    alignSelf: "flex-end",
  },
  containerIncoming: {
    alignSelf: "flex-start",
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
