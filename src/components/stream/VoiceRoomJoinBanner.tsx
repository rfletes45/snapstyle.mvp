/**
 * VoiceRoomJoinBanner
 *
 * Bottom-anchored banner shown on the group chat screen when an inline
 * voice-room join attempt fails. Provides the error message and a Retry
 * action where applicable. Dismisses cleanly without stacking.
 */

import { useAppTheme } from "@/store/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface VoiceRoomJoinBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

export function VoiceRoomJoinBanner({
  message,
  onRetry,
  onDismiss,
}: VoiceRoomJoinBannerProps) {
  const { colors } = useAppTheme();
  const onErrorContainer =
    (colors as { onErrorContainer?: string }).onErrorContainer ?? "#fff";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.errorContainer ?? colors.error },
      ]}
    >
      <Ionicons
        name="alert-circle"
        size={18}
        color={onErrorContainer}
        style={styles.icon}
      />
      <Text
        style={[styles.message, { color: onErrorContainer }]}
        numberOfLines={4}
      >
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          style={[styles.action, { borderColor: onErrorContainer }]}
          accessibilityLabel="Retry joining voice room"
          accessibilityRole="button"
        >
          <Text style={[styles.actionText, { color: onErrorContainer }]}>
            Retry
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={onDismiss}
        style={styles.dismiss}
        accessibilityLabel="Dismiss error"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={18} color={onErrorContainer} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 10,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  action: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dismiss: {
    marginLeft: 8,
    padding: 2,
  },
});
